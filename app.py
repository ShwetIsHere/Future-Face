import os
import io
import time
import uuid
import shutil
import base64
import tempfile
import subprocess
from pathlib import Path

import cv2
import torch
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from torchvision import transforms
from torchvision.models import resnet50
from flask import Flask, render_template, request, jsonify

# ============================================================
# PATHS AND CONFIGURATION
# ============================================================

PROJECT_DIR = Path(__file__).resolve().parent
PYTHON_EXE = Path(r"C:\Users\SHWET\.conda\envs\sam_env\python.exe")
AGE_MODEL_PATH = PROJECT_DIR / "models" / "Future-Face-ResNet50-Final.pth"
YUNET_PATH = PROJECT_DIR / "models" / "face_detection_yunet_2023mar.onnx"
SAM_CHECKPOINT = PROJECT_DIR / "SAM-official" / "pretrained_models" / "sam_ffhq_aging.pt"
SAM_INFERENCE_SCRIPT = PROJECT_DIR / "SAM-official" / "scripts" / "inference.py"
IMAGES_DIR = PROJECT_DIR / "images"

IMAGE_SIZE = 224
MEAN = [0.485, 0.456, 0.406]
STD = [0.229, 0.224, 0.225]

MIN_TARGET_AGE = 8
MAX_TARGET_AGE = 90

# In-Memory Session Storage (Zero disk saving)
# session_id -> { "face_bytes": bytes, "estimated_age": float, "timestamp": float }
IN_MEMORY_SESSIONS = {}

def clean_expired_memory_sessions():
    """Purge sessions older than 1 hour from memory."""
    now = time.time()
    expired = [k for k, v in IN_MEMORY_SESSIONS.items() if now - v.get("timestamp", 0) > 3600]
    for k in expired:
        IN_MEMORY_SESSIONS.pop(k, None)

# Ensure Visual Studio C++ compiler tools are available in PATH
def init_msvc_environment():
    if shutil.which("cl.exe") is None:
        vsvars = Path(r"C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat")
        if vsvars.is_file():
            print(f"[Init] Setting up MSVC Build Tools from: {vsvars}")
            try:
                cmd = f'cmd.exe /c "call \"{vsvars}\" >nul && set"'
                output = subprocess.check_output(cmd, shell=True, text=True)
                for line in output.splitlines():
                    if "=" in line:
                        k, v = line.split("=", 1)
                        os.environ[k] = v
                print(f"[Init] cl.exe located at: {shutil.which('cl.exe')}")
            except Exception as e:
                print(f"[Warning] Could not initialize MSVC Build Tools automatically: {e}")

init_msvc_environment()

# ============================================================
# LOAD MODELS
# ============================================================

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print("=" * 65)
print("FUTURE-FACE WEB SERVER STARTUP")
print("=" * 65)
print(f"Device: {DEVICE}")
if torch.cuda.is_available():
    print(f"GPU: {torch.cuda.get_device_name(0)}")

def load_age_model():
    if not AGE_MODEL_PATH.is_file():
        raise FileNotFoundError(f"Age model not found: {AGE_MODEL_PATH}")
    if not YUNET_PATH.is_file():
        raise FileNotFoundError(f"YuNet model not found: {YUNET_PATH}")

    model = resnet50(weights=None)
    model.fc = torch.nn.Sequential(
        torch.nn.Dropout(p=0.5),
        torch.nn.Linear(model.fc.in_features, 1)
    )
    checkpoint = torch.load(str(AGE_MODEL_PATH), map_location=DEVICE, weights_only=False)
    if isinstance(checkpoint, dict):
        if "model_state_dict" in checkpoint:
            state_dict = checkpoint["model_state_dict"]
        elif "state_dict" in checkpoint:
            state_dict = checkpoint["state_dict"]
        elif isinstance(checkpoint.get("model"), dict):
            state_dict = checkpoint["model"]
        else:
            state_dict = checkpoint
    else:
        raise TypeError("Unsupported checkpoint format.")

    state_dict = {(k[7:] if k.startswith("module.") else k): v for k, v in state_dict.items()}
    model.load_state_dict(state_dict, strict=True)
    model.to(DEVICE).eval()

    detector = cv2.FaceDetectorYN.create(str(YUNET_PATH), "", (320, 320), 0.6, 0.3, 5000)
    return model, detector

print("[Init] Loading ResNet-50 Age Estimation model and YuNet face detector...")
AGE_MODEL, YUNET_DETECTOR = load_age_model()
print("[Init] Models successfully loaded and cached in memory!")

# ============================================================
# CORE AI FUNCTIONS
# ============================================================

def detect_and_crop_face(image_bgr):
    """Detect primary face using YuNet, make a square crop with 35% margin, resize to 224x224."""
    height, width = image_bgr.shape[:2]
    YUNET_DETECTOR.setInputSize((width, height))
    _, faces = YUNET_DETECTOR.detect(image_bgr)

    if faces is None or len(faces) == 0:
        return None, "No face detected. Please ensure your face is clearly visible, well-lit, and facing the camera."

    face = max(faces, key=lambda f: float(f[2] * f[3]))
    x, y, w, h = [int(round(face[i])) for i in range(4)]

    # 35% square margin around face
    side = int(round(max(w, h) * 1.35))
    cx, cy = x + w // 2, y + h // 2
    x1, y1 = cx - side // 2, cy - side // 2
    x2, y2 = x1 + side, y1 + side

    pad_left, pad_top = max(0, -x1), max(0, -y1)
    pad_right, pad_bottom = max(0, x2 - width), max(0, y2 - height)

    if any((pad_left, pad_top, pad_right, pad_bottom)):
        image_bgr = cv2.copyMakeBorder(
            image_bgr, pad_top, pad_bottom, pad_left, pad_right, cv2.BORDER_REPLICATE
        )
        x1 += pad_left
        x2 += pad_left
        y1 += pad_top
        y2 += pad_top

    crop = image_bgr[max(0, y1):min(image_bgr.shape[0], y2), max(0, x1):min(image_bgr.shape[1], x2)]
    if crop.size == 0:
        return None, "Face crop resulted in empty region."

    crop_resized = cv2.resize(crop, (IMAGE_SIZE, IMAGE_SIZE), interpolation=cv2.INTER_CUBIC)
    pil_crop = Image.fromarray(cv2.cvtColor(crop_resized, cv2.COLOR_BGR2RGB))
    return pil_crop, None

def estimate_age(pil_face):
    """Estimate age using the cached ResNet-50 regression model."""
    transform = transforms.Compose([
        transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
        transforms.ToTensor(),
        transforms.Normalize(mean=MEAN, std=STD)
    ])
    tensor = transform(pil_face.convert("RGB")).unsqueeze(0).to(DEVICE)
    with torch.no_grad():
        age = float(AGE_MODEL(tensor).squeeze().item())
    return max(0.0, min(116.0, age))

def load_font(size):
    candidates = [
        r"C:\Windows\Fonts\arial.ttf",
        r"C:\Windows\Fonts\segoeui.ttf",
        r"C:\Windows\Fonts\calibri.ttf"
    ]
    for f in candidates:
        if Path(f).is_file():
            try:
                return ImageFont.truetype(f, size)
            except Exception:
                pass
    return ImageFont.load_default()

def create_comparison_image(left_img, right_img, estimated_age, years, target_age):
    """Creates a high-resolution side-by-side comparison card fitting box-to-box without tiny borders."""
    left = left_img.convert("RGB")
    right = right_img.convert("RGB")

    panel_w, panel_h = 720, 720
    header_h, margin, gap = 105, 28, 24
    canvas = Image.new("RGB", (margin * 2 + panel_w * 2 + gap, header_h + panel_h + margin * 2), "#0f172a")
    draw = ImageDraw.Draw(canvas)
    title_font = load_font(26)
    sub_font = load_font(20)

    # Stretch both images to fully fit the 720x720 panels box-to-box
    left_fitted = left.resize((panel_w, panel_h), Image.Resampling.LANCZOS)
    right_fitted = right.resize((panel_w, panel_h), Image.Resampling.LANCZOS)

    lx, rx = margin, margin + panel_w + gap
    draw.text((lx, 20), f"Original Image | Estimated: {estimated_age:.1f} years", fill="#f8fafc", font=title_font)

    if years > 0:
        dir_text = f"After {years} years (Future)"
    elif years < 0:
        dir_text = f"Before {abs(years)} years (Past)"
    else:
        dir_text = "Current Age (No Shift)"

    draw.text((rx, 20), f"{dir_text} | Target: {target_age} years", fill="#38bdf8", font=title_font)
    draw.text((lx, 60), "AI Age Estimation Model (ResNet-50)", fill="#94a3b8", font=sub_font)
    draw.text((rx, 60), "SAM StyleGAN2 Generative Synthesis", fill="#94a3b8", font=sub_font)

    canvas.paste(left_fitted, (lx, header_h))
    canvas.paste(right_fitted, (rx, header_h))

    return canvas

def find_generated_image(output_dir, target_age, filename):
    expected_root = output_dir / "inference_results" / str(target_age)
    if expected_root.is_dir():
        exact = expected_root / filename
        if exact.is_file():
            return exact
        candidates = list(expected_root.rglob("*"))
        images = [p for p in candidates if p.is_file() and p.suffix.lower() in {".jpg", ".jpeg", ".png", ".bmp", ".webp"}]
        if images:
            return images[0]

    images = [
        p for p in output_dir.rglob("*")
        if p.is_file() and p.suffix.lower() in {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
        and "coupled" not in str(p).lower()
    ]
    if images:
        return max(images, key=lambda p: p.stat().st_mtime)
    raise FileNotFoundError(f"Could not locate generated image under {output_dir}")

def pil_to_base64_data_url(pil_img, quality=95):
    """Converts a PIL image to a base64 JPEG data URL in memory."""
    buf = io.BytesIO()
    pil_img.save(buf, format="JPEG", quality=quality)
    encoded = base64.b64encode(buf.getvalue()).decode("utf-8")
    return f"data:image/jpeg;base64,{encoded}"

# ============================================================
# FLASK WEB APP
# ============================================================

app = Flask(__name__)

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/health")
def health():
    return jsonify({
        "status": "ready",
        "device": str(DEVICE),
        "gpu": torch.cuda.get_device_name(0) if torch.cuda.is_available() else "None",
        "pytorch": torch.__version__,
        "opencv": cv2.__version__
    })

@app.route("/api/sample-images")
def sample_images():
    samples = []
    if IMAGES_DIR.is_dir():
        for p in IMAGES_DIR.glob("*.*"):
            if p.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}:
                samples.append({
                    "name": p.name,
                    "url": f"/sample-image/{p.name}"
                })
    return jsonify(samples[:12])

@app.route("/sample-image/<filename>")
def serve_sample_image(filename):
    from flask import send_from_directory
    return send_from_directory(IMAGES_DIR, filename)

@app.route("/api/estimate-age", methods=["POST"])
def api_estimate_age():
    try:
        clean_expired_memory_sessions()
        image_bytes = None

        if "image" in request.files:
            file = request.files["image"]
            if file and file.filename:
                image_bytes = file.read()
        elif request.is_json and "image" in request.json:
            data_url = request.json["image"]
            if "," in data_url:
                header, encoded = data_url.split(",", 1)
            else:
                encoded = data_url
            image_bytes = base64.b64decode(encoded)

        if not image_bytes:
            return jsonify({"success": False, "error": "No image data received."}), 400

        np_arr = np.frombuffer(image_bytes, np.uint8)
        image_bgr = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

        if image_bgr is None:
            return jsonify({"success": False, "error": "Invalid or corrupted image format."}), 400

        pil_face, error_msg = detect_and_crop_face(image_bgr)
        if error_msg:
            return jsonify({"success": False, "error": error_msg}), 422

        predicted_age = estimate_age(pil_face)

        # Store in-memory buffer (zero disk file storage)
        buf = io.BytesIO()
        pil_face.save(buf, format="JPEG", quality=98)
        face_bytes = buf.getvalue()

        session_id = uuid.uuid4().hex[:12]
        IN_MEMORY_SESSIONS[session_id] = {
            "face_bytes": face_bytes,
            "estimated_age": float(predicted_age),
            "timestamp": time.time()
        }

        cropped_data_url = f"data:image/jpeg;base64,{base64.b64encode(face_bytes).decode('utf-8')}"

        return jsonify({
            "success": True,
            "session_id": session_id,
            "estimated_age": round(predicted_age, 1),
            "cropped_url": cropped_data_url
        })

    except Exception as exc:
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "error": f"Server error: {str(exc)}"}), 500

@app.route("/api/transform", methods=["POST"])
def api_transform():
    try:
        data = request.get_json(force=True)
        session_id = data.get("session_id")
        years = data.get("years")

        if not session_id or years is None:
            return jsonify({"success": False, "error": "Missing session_id or years parameter."}), 400

        try:
            years = int(years)
        except ValueError:
            return jsonify({"success": False, "error": "Years must be an integer."}), 400

        session_data = IN_MEMORY_SESSIONS.get(session_id)
        if not session_data:
            return jsonify({"success": False, "error": "Session expired or not found. Please upload or capture your photo again."}), 404

        estimated_age = session_data["estimated_age"]
        face_bytes = session_data["face_bytes"]
        pil_face = Image.open(io.BytesIO(face_bytes))

        # Enforce target age range strictly between 8 and 90 years
        target_age = max(MIN_TARGET_AGE, min(MAX_TARGET_AGE, int(round(estimated_age)) + years))
        direction = "future" if years > 0 else ("past" if years < 0 else "current")

        # Execute SAM inference inside an isolated temporary directory that is automatically deleted
        with tempfile.TemporaryDirectory() as temp_dir_str:
            temp_path = Path(temp_dir_str)
            input_dir = temp_path / "input"
            output_dir = temp_path / "output"
            input_dir.mkdir(parents=True, exist_ok=True)

            face_temp_input = input_dir / "face_224.jpg"
            face_temp_input.write_bytes(face_bytes)

            command = [
                str(PYTHON_EXE),
                str(SAM_INFERENCE_SCRIPT),
                "--exp_dir", str(output_dir),
                "--checkpoint_path", str(SAM_CHECKPOINT),
                "--data_path", str(input_dir),
                "--target_age", str(target_age),
                "--test_batch_size", "1",
                "--test_workers", "0",
                "--n_images", "1",
                "--couple_outputs"
            ]

            print(f"\n[Transform] In-Memory Session {session_id} -> Estimated: {estimated_age:.1f}, Shift: {years:+d}, Target: {target_age}")
            result = subprocess.run(command, cwd=str(PROJECT_DIR / "SAM-official"), env=os.environ.copy())

            if result.returncode != 0:
                return jsonify({"success": False, "error": f"SAM transformation failed with exit code {result.returncode}."}), 500

            generated_source = find_generated_image(output_dir, target_age, "face_224.jpg")
            pil_generated = Image.open(generated_source).convert("RGB")

            # Create comparison poster in memory with box-to-box stretched fit
            pil_comparison = create_comparison_image(pil_face, pil_generated, estimated_age, years, target_age)

            # Convert images to base64 Data URLs before temporary directory is purged
            transformed_data_url = pil_to_base64_data_url(pil_generated, quality=95)
            comparison_data_url = pil_to_base64_data_url(pil_comparison, quality=95)
            cropped_data_url = f"data:image/jpeg;base64,{base64.b64encode(face_bytes).decode('utf-8')}"

        # Temporary folder and all files inside temp_dir_str are now completely deleted from disk!
        return jsonify({
            "success": True,
            "session_id": session_id,
            "estimated_age": round(estimated_age, 1),
            "years": years,
            "target_age": target_age,
            "direction": direction,
            "cropped_url": cropped_data_url,
            "transformed_url": transformed_data_url,
            "comparison_url": comparison_data_url
        })

    except Exception as exc:
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "error": f"Transformation error: {str(exc)}"}), 500

if __name__ == "__main__":
    host = "127.0.0.1"
    port = 5000
    print("\n" + "=" * 65)
    print(f"Future-Face Web Application is running at:")
    print(f"👉 http://{host}:{port}")
    print("=" * 65 + "\n")
    app.run(host=host, port=port, debug=False)
