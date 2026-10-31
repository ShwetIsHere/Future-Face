import os
import sys
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
# Allow override via environment variable, fallback to active python interpreter
PYTHON_EXE = os.environ.get("PYTHON_EXE", sys.executable)
AGE_MODEL_PATH = PROJECT_DIR / "models" / "Future-Face-ResNet50-Final.pth"
YUNET_PATH = PROJECT_DIR / "models" / "face_detection_yunet_2023mar.onnx"
SAM_CHECKPOINT = PROJECT_DIR / "SAM-official" / "pretrained_models" / "sam_ffhq_aging.pt"
SAM_INFERENCE_SCRIPT = PROJECT_DIR / "SAM-official" / "scripts" / "inference.py"
IMAGES_DIR = PROJECT_DIR / "images"
DEMO_DIR = PROJECT_DIR / "demo"

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

# Ensure Visual Studio C++ compiler tools are available in PATH (Windows only)
def init_msvc_environment():
    if os.name != "nt":
        return
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

from face_validator import FaceQualityValidator, ValidationConfig

print("[Init] Loading ResNet-50 Age Estimation model and YuNet face detector...")
AGE_MODEL, YUNET_DETECTOR = load_age_model()
VALIDATOR = FaceQualityValidator(YUNET_DETECTOR, ValidationConfig())
print("[Init] Models & Face Quality Validation Pipeline successfully initialized!")

# ============================================================
# CORE AI FUNCTIONS
# ============================================================

def detect_and_crop_face(image_bgr):
    """
    Validates face image quality through the FaceQualityValidator pipeline
    (Face count, boundary, size, solvePnP head pose, blur variance, landmarks).
    Returns (pil_crop, rejection_reason, validation_result).
    """
    val_res = VALIDATOR.validate(image_bgr)
    if not val_res.is_valid:
        return None, val_res.rejection_reason, val_res
    return val_res.face_crop_pil, None, val_res

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

def add_watermark(image, text="Generated by Future-Face AI"):
    """Adds a stylish, semi-transparent watermark badge to the bottom-right of the image."""
    img = image.convert("RGBA")
    overlay = Image.new("RGBA", img.size, (255, 255, 255, 0))
    draw = ImageDraw.Draw(overlay)

    font_size = max(16, int(min(img.size) * 0.035))
    font = load_font(font_size)

    bbox = draw.textbbox((0, 0), text, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]

    pad_x, pad_y = int(font_size * 0.65), int(font_size * 0.4)
    pill_w = text_w + pad_x * 2
    pill_h = text_h + pad_y * 2

    margin = int(font_size * 0.85)
    x1 = img.width - pill_w - margin
    y1 = img.height - pill_h - margin
    x2 = x1 + pill_w
    y2 = y1 + pill_h

    # Semi-transparent dark pill background (slate-900 with alpha & cyan subtle border)
    draw.rounded_rectangle([x1, y1, x2, y2], radius=int(pill_h * 0.35), fill=(15, 23, 42, 195), outline=(56, 189, 248, 140), width=1)

    text_x = x1 + pad_x
    text_y = y1 + pad_y - bbox[1]
    draw.text((text_x, text_y), text, fill=(248, 250, 252, 240), font=font)

    combined = Image.alpha_composite(img, overlay)
    return combined.convert("RGB")

def create_comparison_image(left_img, right_img, estimated_age, years, target_age):
    """Creates a high-resolution side-by-side comparison card fitting box-to-box with watermark."""
    left = left_img.convert("RGB")
    right = right_img.convert("RGB")

    panel_w, panel_h = 720, 720
    header_h, margin, gap = 105, 28, 24
    footer_h = 44
    canvas_w = margin * 2 + panel_w * 2 + gap
    canvas_h = header_h + panel_h + footer_h + margin * 2

    canvas = Image.new("RGB", (canvas_w, canvas_h), "#0f172a")
    draw = ImageDraw.Draw(canvas)
    title_font = load_font(26)
    sub_font = load_font(20)
    footer_font = load_font(18)

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

    # Watermark Footer on Comparison Poster
    footer_y = header_h + panel_h + margin
    draw.line([(lx, footer_y - 8), (canvas_w - margin, footer_y - 8)], fill="#334155", width=1)
    draw.text((lx, footer_y + 4), "Generated by Future-Face AI  •  ResNet-50 & StyleGAN2 Generative Synthesis", fill="#94a3b8", font=footer_font)

    credit_text = "Developed by Shwet Patel (heyshwet.me)"
    credit_bbox = draw.textbbox((0, 0), credit_text, font=footer_font)
    credit_w = credit_bbox[2] - credit_bbox[0]
    draw.text((canvas_w - margin - credit_w, footer_y + 4), credit_text, fill="#38bdf8", font=footer_font)

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
    return render_template("index.html", active_page="home")

@app.route("/try-now")
def try_now():
    return render_template("try_now.html", active_page="try_now")

@app.route("/about")
def about():
    return render_template("about.html", active_page="about")

@app.route("/feedback")
def feedback():
    return render_template("feedback.html", active_page="feedback")

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

@app.route("/demo/<path:filename>")
def serve_demo_file(filename):
    from flask import send_from_directory
    return send_from_directory(DEMO_DIR, filename)

@app.route("/api/feedback", methods=["POST"])
def api_feedback():
    try:
        data = request.get_json(force=True) if request.is_json else request.form
        name = data.get("name", "Anonymous")
        email = data.get("email", "")
        rating = data.get("rating", "5")
        message = data.get("feedback") or data.get("message", "")
        print(f"[Feedback] Name: {name} | Rating: {rating} stars | Email: {email} | Message: {message}")
        return jsonify({"success": True, "message": "Thank you for your feedback!"})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 400

@app.route("/api/estimate-age", methods=["POST"])
def api_estimate_age():
    try:
        clean_expired_memory_sessions()
        image_bytes = None

        if "image" in request.files:
            file = request.files["image"]
            if file and file.filename:
                image_bytes = file.read()
        elif request.is_json and ("image" in request.json or "image_data" in request.json):
            data_url = request.json.get("image") or request.json.get("image_data")
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

        is_pre_cropped = False
        if request.is_json:
            is_pre_cropped = bool(request.json.get("skip_autocrop") or request.json.get("is_cropped"))

        if is_pre_cropped:
            crop_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
            pil_face = Image.fromarray(crop_rgb)
            if pil_face.width > 1024 or pil_face.height > 1024:
                pil_face = pil_face.resize((1024, 1024), Image.Resampling.LANCZOS)
            val_res = None
        else:
            pil_face, error_msg, val_res = detect_and_crop_face(image_bgr)
            if error_msg:
                return jsonify({
                    "success": False,
                    "error": error_msg,
                    "validation": val_res.to_dict() if val_res else None
                }), 422

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
        face_bbox = val_res.face_bbox if val_res else None

        return jsonify({
            "success": True,
            "session_id": session_id,
            "estimated_age": round(predicted_age, 1),
            "cropped_url": cropped_data_url,
            "cropped_image": cropped_data_url,
            "validation": val_res.to_dict() if val_res else None,
            "face_bbox": face_bbox
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
        years = data.get("years") if data.get("years") is not None else data.get("shift")

        if not session_id or years is None:
            return jsonify({"success": False, "error": "Missing session_id or years/shift parameter."}), 400

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
            result = subprocess.run(
                command,
                cwd=str(PROJECT_DIR / "SAM-official"),
                env=os.environ.copy(),
                capture_output=True,
                text=True
            )

            if result.returncode != 0:
                print(f"[Error] SAM Return Code: {result.returncode}")
                if result.stdout:
                    print(f"[Error] SAM STDOUT:\n{result.stdout}")
                if result.stderr:
                    print(f"[Error] SAM STDERR:\n{result.stderr}")
                err_detail = result.stderr.strip() if result.stderr else result.stdout.strip()
                last_err = err_detail.splitlines()[-1] if err_detail else f"Exit code {result.returncode}"
                return jsonify({"success": False, "error": f"SAM transformation failed: {last_err}"}), 500

            generated_source = find_generated_image(output_dir, target_age, "face_224.jpg")
            pil_generated_raw = Image.open(generated_source).convert("RGB")

            # Apply watermark to generated face portrait
            pil_generated = add_watermark(pil_generated_raw, "Generated by Future-Face AI")

            # Create comparison poster in memory with box-to-box stretched fit and watermark
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
            "shift_years": years,
            "target_age": target_age,
            "direction": direction,
            "cropped_url": cropped_data_url,
            "cropped_image": cropped_data_url,
            "original_image": cropped_data_url,
            "transformed_url": transformed_data_url,
            "transformed_image": transformed_data_url,
            "comparison_url": comparison_data_url,
            "comparison_image": comparison_data_url
        })

    except Exception as exc:
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "error": f"Transformation error: {str(exc)}"}), 500

if __name__ == "__main__":
    host = os.environ.get("HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", 5000))
    print("\n" + "=" * 65)
    print(f"Future-Face Web Application is running at:")
    print(f"👉 http://{host}:{port}")
    print("=" * 65 + "\n")
    app.run(host=host, port=port, debug=False)
