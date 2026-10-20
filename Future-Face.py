import os
import sys
import subprocess
from pathlib import Path
import tkinter as tk
from tkinter import filedialog, simpledialog, messagebox

import cv2
import torch
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from torchvision import transforms
from torchvision.models import resnet50

PROJECT_DIR = Path(r"E:\Face Convert\Fature-Face")
PYTHON_EXE = Path(r"C:\Users\SHWET\.conda\envs\sam_env\python.exe")
AGE_MODEL_PATH = Path(r"E:\Face Convert\Fature-Face\models\Future-Face-ResNet50-Final.pth")
YUNET_PATH = Path(r"E:\Face Convert\Fature-Face\models\face_detection_yunet_2023mar.onnx")
SAM_CHECKPOINT = PROJECT_DIR / "SAM-official" / "pretrained_models" / "sam_ffhq_aging.pt"
IMAGE_SIZE = 224
MEAN = [0.485, 0.456, 0.406]
STD = [0.229, 0.224, 0.225]
SUPPORTED = [("Image files", "*.jpg *.jpeg *.png *.bmp *.webp *.tif *.tiff")]

def choose_image():
    root = tk.Tk()
    root.withdraw()
    root.attributes("-topmost", True)
    path = filedialog.askopenfilename(title="Future-Face - Select an image", filetypes=SUPPORTED)
    root.destroy()
    return Path(path) if path else None

def ask_years():
    root = tk.Tk()
    root.withdraw()
    root.attributes("-topmost", True)
    # years = simpledialog.askinteger(
    #     "Future-Face - Age Transformation",
    #     "How many years into the future?\nEnter a whole number from 1 to 80.",
    #     minvalue=1, maxvalue=80, parent=root
    # )


    ############################################################################################################
    years = simpledialog.askinteger(
        "Future-Face - Age Transformation",
        "How many years do you want to change?\n\n"
        "Positive number = Future (e.g. +10)\n"
        "Negative number = Past (e.g. -10)\n"
        "Enter a value from -80 to +80.",
        minvalue=-80,
        maxvalue=80,
        parent=root
    )
    ############################################################################################################
    root.destroy()
    return years

def notify_error(title, message):
    try:
        root = tk.Tk()
        root.withdraw()
        root.attributes("-topmost", True)
        messagebox.showerror(title, message, parent=root)
        root.destroy()
    except Exception:
        pass

def load_age_model(device):
    if not AGE_MODEL_PATH.is_file():
        raise FileNotFoundError(f"Age-estimation model not found:\n{AGE_MODEL_PATH}")
    if not YUNET_PATH.is_file():
        raise FileNotFoundError(f"YuNet face detector not found:\n{YUNET_PATH}")

    model = resnet50(weights=None)
    model.fc = torch.nn.Sequential(torch.nn.Dropout(p=0.5), torch.nn.Linear(model.fc.in_features, 1))
    checkpoint = torch.load(str(AGE_MODEL_PATH), map_location=device, weights_only=False)
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
        raise TypeError("Unsupported age-estimation checkpoint format.")
    state_dict = {(k[7:] if k.startswith("module.") else k): v for k, v in state_dict.items()}
    model.load_state_dict(state_dict, strict=True)
    model.to(device).eval()
    detector = cv2.FaceDetectorYN.create(str(YUNET_PATH), "", (320, 320), 0.6, 0.3, 5000)
    return model, detector

def detect_and_crop_face(image_path, detector):
    """Detect the clearest/largest face, crop away background, and prepare a square 224x224 face image."""
    image = cv2.imread(str(image_path))
    if image is None:
        raise ValueError(f"Could not read image:\n{image_path}")
    height, width = image.shape[:2]
    detector.setInputSize((width, height))
    _, faces = detector.detect(image)
    if faces is None or len(faces) == 0:
        raise RuntimeError("YuNet could not detect a face. Please choose a clearer image with a visible face.")

    # Prefer the largest detected face, which is usually the main subject.
    face = max(faces, key=lambda f: float(f[2] * f[3]))
    x, y, w, h = [int(round(face[i])) for i in range(4)]
    # Make a square crop around the face, with a small amount of head/shoulder context.
    side = int(round(max(w, h) * 1.35))
    cx, cy = x + w // 2, y + h // 2
    x1, y1 = cx - side // 2, cy - side // 2
    x2, y2 = x1 + side, y1 + side

    # Pad at image edges rather than clipping the face.
    pad_left, pad_top = max(0, -x1), max(0, -y1)
    pad_right, pad_bottom = max(0, x2 - width), max(0, y2 - height)
    if any((pad_left, pad_top, pad_right, pad_bottom)):
        image = cv2.copyMakeBorder(image, pad_top, pad_bottom, pad_left, pad_right,
                                   cv2.BORDER_REPLICATE)
        x1 += pad_left; x2 += pad_left; y1 += pad_top; y2 += pad_top
    crop = image[max(0, y1):min(image.shape[0], y2), max(0, x1):min(image.shape[1], x2)]
    if crop.size == 0:
        raise RuntimeError("Face crop was empty. Please select another image.")
    crop = cv2.resize(crop, (IMAGE_SIZE, IMAGE_SIZE), interpolation=cv2.INTER_CUBIC)
    return Image.fromarray(cv2.cvtColor(crop, cv2.COLOR_BGR2RGB))

def estimate_age(face_image, device, model):
    """Estimate age from the cropped, square 224x224 face image."""
    transform = transforms.Compose([
        transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
        transforms.ToTensor(),
        transforms.Normalize(mean=MEAN, std=STD)
    ])
    tensor = transform(face_image.convert("RGB")).unsqueeze(0).to(device)
    with torch.no_grad():
        age = float(model(tensor).squeeze().item())
    return max(0.0, min(116.0, age))

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
    images = [p for p in output_dir.rglob("*") if p.is_file() and p.suffix.lower() in {".jpg", ".jpeg", ".png", ".bmp", ".webp"} and "coupled" not in str(p).lower()]
    if images:
        return max(images, key=lambda p: p.stat().st_mtime)
    raise FileNotFoundError(f"Could not locate the generated image under:\n{output_dir}")

def load_font(size):
    candidates = [
        r"C:\Windows\Fonts\arial.ttf",
        r"C:\Windows\Fonts\segoeui.ttf"
    ]
    for f in candidates:
        if Path(f).is_file():
            try:
                return ImageFont.truetype(f, size)
            except Exception:
                pass
    return ImageFont.load_default()

# def create_comparison(original_path, generated_path, estimated_age, years, target_age, output_path):
#     left = Image.open(original_path).convert("RGB")
#     right = Image.open(generated_path).convert("RGB")

                                            # if error occure then remove below part and uncomment about part
#################################################################################################################################
def create_comparison(original_path, generated_path, estimated_age, years, target_age, output_path):
    # Accept either a PIL image or a file path for the original face.
    if isinstance(original_path, Image.Image):
        left = original_path.convert("RGB")
    else:
        left = Image.open(original_path).convert("RGB")

    # The generated result is a saved image file.
    right = Image.open(generated_path).convert("RGB")

#################################################################################################################################
    # Give both images a consistent display area while preserving their aspect ratio.
    panel_w, panel_h = 720, 720
    header_h, margin, gap = 105, 28, 24
    canvas = Image.new("RGB", (margin*2 + panel_w*2 + gap, header_h + panel_h + margin*2), "white")
    draw = ImageDraw.Draw(canvas)
    title_font = load_font(26)
    sub_font = load_font(20)

    def contain(img, size):
        img.thumbnail(size, Image.Resampling.LANCZOS)
        panel = Image.new("RGB", size, "#f0f0f0")
        x = (size[0] - img.width)//2
        y = (size[1] - img.height)//2
        panel.paste(img, (x, y))
        return panel

    lx, rx = margin, margin + panel_w + gap
    draw.text((lx, 18), f"Original image | Estimated age: {estimated_age:.1f} years", fill="black", font=title_font)
    draw.text((rx, 18), f"After {years} years | Target age: {target_age}", fill="black", font=title_font)
    draw.text((lx, 58), "Age is an AI estimate", fill="#555555", font=sub_font)
    draw.text((rx, 58), "AI-generated age transformation", fill="#555555", font=sub_font)
    canvas.paste(contain(left, (panel_w, panel_h)), (lx, header_h))
    canvas.paste(contain(right, (panel_w, panel_h)), (rx, header_h))
    output_path.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(output_path, quality=95)
    return output_path

def remove_path(path):
    """Remove temporary inference output (including stats and coupled-output folders)."""
    import shutil
    path = Path(path)
    if path.is_dir():
        shutil.rmtree(path, ignore_errors=True)
    elif path.exists():
        try:
            path.unlink()
        except OSError:
            pass

def ask_test_again():
    root = tk.Tk()
    root.withdraw()
    root.attributes("-topmost", True)
    again = messagebox.askyesno(
        "Future-Face - Test Again?",
        "Comparison image generated successfully.\n\nDo you want to test another image?",
        parent=root
    )
    root.destroy()
    return again

def process_one_image(image_path, device, model, detector):
    print("\n" + "=" * 65)
    print("Future-Face - Age Transformation Launcher")
    print("=" * 65)
    print("Selected image:", image_path)
    if not SAM_CHECKPOINT.is_file():
        raise FileNotFoundError(f"Age-transformation checkpoint not found:\n{SAM_CHECKPOINT}")

    print("\nDetecting face with YuNet, cropping background, and resizing to 224x224...")
    face_image = detect_and_crop_face(image_path, detector)
    estimated_age = estimate_age(face_image, device, model)
    print(f"Estimated age from cropped face: {estimated_age:.1f} years")

    years = ask_years()
    if years is None:
        print("Transformation cancelled.")
        return None

    
    # target_age = max(0, min(100, int(round(estimated_age)) + years))


    target_age = max(0, min(100, int(round(estimated_age)) + years))


    # print(f"Requested future shift: +{years} years")

###################################################################################################################
    direction = "future" if years > 0 else "past" if years < 0 else "current age"
    print(f"Requested age change: {years:+d} years ({direction})")
###################################################################################################################


    print(f"Target age passed to transformation model: {target_age}")

    root = tk.Tk()
    root.withdraw()
    root.attributes("-topmost", True)
    messagebox.showinfo(
        "Future-Face - Age Estimate",
        f"Estimated age: {estimated_age:.1f} years\n\n"
        f"Transforming approximately {years} years into the future.\n"
        f"Target age used: {target_age} years.", parent=root
    )
    root.destroy()

    import shutil
    input_dir = PROJECT_DIR / "_future_face_temp_input"
    output_dir = PROJECT_DIR / "_future_face_temp_output"
    comparison_path = PROJECT_DIR / "Future-Face_Comparison.jpg"
    remove_path(input_dir)
    remove_path(output_dir)
    input_dir.mkdir(parents=True, exist_ok=True)
    # The transformation model receives only the detected face, not the full image/background.
    model_input = input_dir / "face_224.jpg"
    face_image.save(model_input, quality=98)

    command = [
        str(PYTHON_EXE), str(PROJECT_DIR / "SAM-official" / "scripts" / "inference.py"),
        "--exp_dir", str(output_dir),
        "--checkpoint_path", str(SAM_CHECKPOINT),
        "--data_path", str(input_dir),
        "--target_age", str(target_age),
        "--test_batch_size", "1",
        "--test_workers", "0",
        "--n_images", "1",
        "--couple_outputs"
    ]
    print("\nRunning age transformation on the 224x224 cropped face...")
    print("Command:", subprocess.list2cmdline(command))
    result = subprocess.run(command, cwd=str(PROJECT_DIR / "SAM-official"))
    if result.returncode != 0:
                                                        # if error occure then remove below part
        #####################################################################################################
        print("\nDEBUG: Inference output files:")
        for path in output_dir.rglob("*"):
            if path.is_file():
                print(f"  {path} ({path.stat().st_size} bytes)")
        #######################################################################################################

        remove_path(input_dir); remove_path(output_dir)
        raise RuntimeError(f"Age transformation failed with exit code {result.returncode}.")

    try:
        generated = find_generated_image(output_dir, target_age, model_input.name)
        # Compare cropped face to generated face; no separate generated/crop files are retained.
        create_comparison(face_image, generated, estimated_age, years, target_age, comparison_path)
    finally:
        # Remove inference_results, inference_coupled, stats, and all temporary inference artifacts.
        remove_path(input_dir)
        remove_path(output_dir)
        for legacy_name in ("inference_coupled", "inference_results", "inference-result", "stats", "statistics"):
            remove_path(PROJECT_DIR / legacy_name)
        # Remove output directories made by the previous launcher version.
        for legacy_output in PROJECT_DIR.glob("future_face_output_*"):
            remove_path(legacy_output)

    print("\nCompleted successfully.")
    print(f"Estimated age: {estimated_age:.1f} years")
    print(f"Future shift: +{years} years")
    print(f"Only saved output: {comparison_path}")
    try:
        os.startfile(str(comparison_path))
    except Exception as exc:
        print("Could not automatically open comparison image:", exc)
    return comparison_path

def main():
    os.chdir(PROJECT_DIR)
    if not PYTHON_EXE.is_file():
        raise FileNotFoundError(f"Python environment not found:\n{PYTHON_EXE}")
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print("Device:", device)
    if torch.cuda.is_available():
        print("GPU:", torch.cuda.get_device_name(0))
    print("\nLoading age-estimation model and YuNet face detector...")
    model, detector = load_age_model(device)

    while True:
        image_path = choose_image()
        if not image_path:
            print("No image selected. Exiting.")
            return 0

        ####################################################################################
        # try:
        #     process_one_image(image_path, device, model, detector)
        # except Exception as exc:
        #     print(f"\nERROR processing image: {exc}")
        #     notify_error("Future-Face - Error", str(exc))
        ########################################################################################
                                                                #if error occure then remove below part and uncomment about 5 lines
        
        try:
            process_one_image(image_path, device, model, detector)
        except Exception as exc:
            import traceback
            error_details = traceback.format_exc()
            print("\nERROR processing image:")
            print(error_details)
            notify_error(
                "Future-Face - Error",
                f"{type(exc).__name__}: {exc}\n\nSee the terminal for the full traceback."
            )

        ###########################################################################################
        if not ask_test_again():
            print("Future-Face closed.")
            return 0

if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:
        print(f"\nERROR: {exc}")
        notify_error("Future-Face - Error", str(exc))
        input("\nPress Enter to close...")
        sys.exit(1)
