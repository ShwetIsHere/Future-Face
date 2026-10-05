import os
import cv2
import torch
import numpy as np
import tkinter as tk

from tkinter import filedialog
from PIL import Image
from torchvision import models, transforms


# ============================================================
# CONFIGURATION
# ============================================================

MODEL_PATH = "v2/future_face_resnet50_best.pth"
YUNET_PATH = "v2/face_detection_yunet_2023mar.onnx"

IMAGE_SIZE = 224


# ============================================================
# DEVICE
# ============================================================

print("=" * 70)
print("FUTURE-FACE AGE ESTIMATION")
print("=" * 70)

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

print(f"Device: {device}")

if torch.cuda.is_available():
    print(f"GPU: {torch.cuda.get_device_name(0)}")
else:
    print("GPU not available. Using CPU.")


# ============================================================
# CHECK FILES
# ============================================================

if not os.path.exists(MODEL_PATH):
    raise FileNotFoundError(
        f"\nModel not found:\n{os.path.abspath(MODEL_PATH)}"
    )

if not os.path.exists(YUNET_PATH):
    raise FileNotFoundError(
        f"\nYuNet model not found:\n{os.path.abspath(YUNET_PATH)}"
    )


# ============================================================
# BUILD EXACT RESNET50 ARCHITECTURE
# ============================================================

print("\nLoading ResNet50...")

model = models.resnet50(weights=None)

# IMPORTANT:
# Your trained model uses a custom sequential regression head.
# The checkpoint contains:
#     fc.1.weight
#     fc.1.bias
#
# Therefore the final layer must NOT be plain nn.Linear.

model.fc = torch.nn.Sequential(
    torch.nn.Dropout(p=0.3),
    torch.nn.Linear(model.fc.in_features, 1)
)

model = model.to(device)


# ============================================================
# LOAD CHECKPOINT
# ============================================================

print("Loading checkpoint...")

checkpoint = torch.load(
    MODEL_PATH,
    map_location=device,
    weights_only=False
)

print("Checkpoint type:", type(checkpoint))

if isinstance(checkpoint, dict) and "model_state_dict" in checkpoint:

    print("Using: model_state_dict")

    model.load_state_dict(
        checkpoint["model_state_dict"],
        strict=True
    )

    if "epoch" in checkpoint:
        print("Checkpoint epoch:", checkpoint["epoch"])

    if "best_mae" in checkpoint:
        print(
            f"Best validation MAE: "
            f"{checkpoint['best_mae']:.4f} years"
        )

    if "val_mae" in checkpoint:
        print(
            f"Checkpoint validation MAE: "
            f"{checkpoint['val_mae']:.4f} years"
        )

else:

    print("Using checkpoint directly")

    model.load_state_dict(
        checkpoint,
        strict=True
    )


model.eval()

print("✅ Model loaded successfully")


# ============================================================
# LOAD YUNET
# ============================================================

print("\nLoading YuNet...")

yunet = cv2.FaceDetectorYN.create(
    YUNET_PATH,
    "",
    (320, 320),
    0.6,
    0.3,
    5000
)

print("✅ YuNet loaded successfully")


# ============================================================
# IMAGE PREPROCESSING
# ============================================================

transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),

    # ImageNet normalization
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225]
    )
])


# ============================================================
# OPEN WINDOWS IMAGE SELECTOR
# ============================================================

print("\nOpening image selector...")

root = tk.Tk()
root.withdraw()

image_path = filedialog.askopenfilename(
    title="Select an image for age estimation",
    filetypes=[
        ("Image files",
         "*.jpg *.jpeg *.png *.bmp *.webp"),
        ("JPEG files",
         "*.jpg *.jpeg"),
        ("PNG files",
         "*.png"),
        ("All files",
         "*.*")
    ]
)

root.destroy()


if not image_path:
    print("\nNo image selected.")
    exit()


print("\nSelected image:")
print(image_path)


# ============================================================
# LOAD IMAGE
# ============================================================

image = cv2.imread(image_path)

if image is None:
    raise RuntimeError("Could not read selected image.")


height, width = image.shape[:2]

print(
    f"\nImage size: "
    f"{width} x {height}"
)


# ============================================================
# DETECT FACE
# ============================================================

yunet.setInputSize((width, height))

_, detections = yunet.detect(image)


if detections is None or len(detections) == 0:

    print("\n❌ No face detected.")
    print("Try another image.")

    cv2.imshow("Image", image)
    cv2.waitKey(0)
    cv2.destroyAllWindows()

    exit()


# ============================================================
# SELECT HIGHEST CONFIDENCE FACE
# ============================================================

best_detection = max(
    detections,
    key=lambda x: x[14]
)

x, y, w, h = best_detection[:4]

confidence = best_detection[14]

x = int(x)
y = int(y)
w = int(w)
h = int(h)


print(f"Face confidence: {confidence:.4f}")

print(
    f"Face bounding box: "
    f"x={x}, y={y}, width={w}, height={h}"
)


# ============================================================
# ADD FACE PADDING
# ============================================================

padding = 0.15

px = int(w * padding)
py = int(h * padding)

x1 = max(0, x - px)
y1 = max(0, y - py)

x2 = min(width, x + w + px)
y2 = min(height, y + h + py)


face = image[y1:y2, x1:x2]


if face.size == 0:
    raise RuntimeError("Invalid face crop.")


# ============================================================
# BGR → RGB
# ============================================================

face_rgb = cv2.cvtColor(
    face,
    cv2.COLOR_BGR2RGB
)

pil_face = Image.fromarray(face_rgb)


# ============================================================
# PREPROCESS
# ============================================================

input_tensor = transform(
    pil_face
).unsqueeze(0).to(device)


print(
    "Input tensor shape:",
    input_tensor.shape
)


# ============================================================
# PREDICTION
# ============================================================

with torch.no_grad():

    prediction = model(
        input_tensor
    )

    predicted_age = prediction.item()


# ============================================================
# SANITY CHECK
# ============================================================

# UTKFace ages are approximately 1–116.
# This only prevents impossible numerical output.

predicted_age = max(
    0.0,
    min(116.0, predicted_age)
)


# ============================================================
# RESULT
# ============================================================

print("\n")
print("=" * 70)
print("AGE ESTIMATION RESULT")
print("=" * 70)

print(
    f"Predicted age: "
    f"{predicted_age:.2f} years"
)

print("=" * 70)


# ============================================================
# DISPLAY RESULT
# ============================================================

display_image = image.copy()

cv2.rectangle(
    display_image,
    (x1, y1),
    (x2, y2),
    (0, 255, 0),
    3
)

text = f"Age: {predicted_age:.1f} years"

cv2.putText(
    display_image,
    text,
    (x1, max(40, y1 - 10)),
    cv2.FONT_HERSHEY_SIMPLEX,
    1.0,
    (0, 255, 0),
    2,
    cv2.LINE_AA
)

cv2.imshow(
    "Future-Face Age Estimation",
    display_image
)

print("\nPress any key in the image window to exit.")

cv2.waitKey(0)
cv2.destroyAllWindows()