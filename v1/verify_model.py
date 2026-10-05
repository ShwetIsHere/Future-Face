
import os
import cv2
import torch
import numpy as np
import tkinter as tk

from tkinter import filedialog
from PIL import Image
from torchvision import transforms
from torchvision.models import resnet50


# ============================================================
# CONFIGURATION
# ============================================================

MODEL_PATH = "v1/Future-Face-ResNet50-Final.pth"
YUNET_PATH = "v1/face_detection_yunet_2023mar.onnx"

IMAGE_SIZE = 224

# These must match the preprocessing used during training
MEAN = [0.485, 0.456, 0.406]
STD = [0.229, 0.224, 0.225]


# ============================================================
# DEVICE
# ============================================================

device = torch.device(
    "cuda" if torch.cuda.is_available() else "cpu"
)

print("=" * 65)
print("FUTURE-FACE RESNET50 AGE ESTIMATION")
print("=" * 65)

print("Device:", device)

if torch.cuda.is_available():
    print("GPU:", torch.cuda.get_device_name(0))
else:
    print("GPU not available. Using CPU.")


# ============================================================
# CHECK FILES
# ============================================================

if not os.path.exists(MODEL_PATH):
    raise FileNotFoundError(
        f"\nModel not found:\n{MODEL_PATH}"
    )

if not os.path.exists(YUNET_PATH):
    raise FileNotFoundError(
        f"\nYuNet model not found:\n{YUNET_PATH}"
    )


# ============================================================
# CREATE RESNET50
# ============================================================

print("\nCreating ResNet50...")

model = resnet50(weights=None)


# ============================================================
# IMPORTANT:
# YOUR CHECKPOINT HAS:
#
# fc.1.weight
# fc.1.bias
#
# Therefore the original model used a Sequential FC layer.
#
# Likely structure:
#
# fc
# ├── 0 = Dropout
# └── 1 = Linear(2048 -> 1)
#
# ============================================================

model.fc = torch.nn.Sequential(
    torch.nn.Dropout(p=0.5),
    torch.nn.Linear(model.fc.in_features, 1)
)


print("ResNet50 architecture created.")
print("Final layer:", model.fc)


# ============================================================
# LOAD CHECKPOINT
# ============================================================

print("\nLoading checkpoint...")

checkpoint = torch.load(
    MODEL_PATH,
    map_location=device,
    weights_only=False
)


# ============================================================
# FIND STATE DICTIONARY
# ============================================================

if isinstance(checkpoint, dict):

    if "model_state_dict" in checkpoint:

        state_dict = checkpoint["model_state_dict"]

        print("Checkpoint format: model_state_dict")

    elif "state_dict" in checkpoint:

        state_dict = checkpoint["state_dict"]

        print("Checkpoint format: state_dict")

    elif "model" in checkpoint and isinstance(
        checkpoint["model"], dict
    ):

        state_dict = checkpoint["model"]

        print("Checkpoint format: model")

    else:

        state_dict = checkpoint

        print("Checkpoint format: direct state_dict")

else:

    raise TypeError(
        "Checkpoint is not a supported state dictionary."
    )


# ============================================================
# REMOVE DataParallel PREFIX IF PRESENT
# ============================================================

cleaned_state_dict = {}

for key, value in state_dict.items():

    if key.startswith("module."):
        key = key[7:]

    cleaned_state_dict[key] = value


state_dict = cleaned_state_dict


# ============================================================
# SHOW FC KEYS FROM CHECKPOINT
# ============================================================

print("\nChecking checkpoint FC layers...")

fc_keys = [
    key for key in state_dict.keys()
    if key.startswith("fc.")
]

for key in fc_keys:
    print(" ", key)


# ============================================================
# LOAD WEIGHTS
# ============================================================

print("\nLoading model weights...")

try:

    model.load_state_dict(
        state_dict,
        strict=True
    )

    print("✅ ALL MODEL WEIGHTS LOADED SUCCESSFULLY!")

except RuntimeError as e:

    print("\n❌ MODEL ARCHITECTURE MISMATCH")
    print("\nDetailed error:")
    print(e)

    print(
        "\nThe checkpoint architecture does not match "
        "the architecture defined in this script."
    )

    raise


# ============================================================
# MOVE MODEL TO DEVICE
# ============================================================

model = model.to(device)

model.eval()


print("\n============================================================")
print("MODEL READY")
print("============================================================")

print("Architecture : ResNet50")
print("Task         : Age Regression")
print("Input size   :", IMAGE_SIZE, "x", IMAGE_SIZE)
print("Device       :", device)

if torch.cuda.is_available():
    print("GPU          :", torch.cuda.get_device_name(0))


# ============================================================
# LOAD YUNET
# ============================================================

print("\nLoading YuNet...")

detector = cv2.FaceDetectorYN.create(
    YUNET_PATH,
    "",
    (320, 320),
    0.6,
    0.3,
    5000
)

print("✅ YuNet loaded successfully!")


# ============================================================
# TRANSFORM
# ============================================================

transform = transforms.Compose([
    transforms.Resize(
        (IMAGE_SIZE, IMAGE_SIZE)
    ),

    transforms.ToTensor(),

    transforms.Normalize(
        mean=MEAN,
        std=STD
    )
])


# ============================================================
# SELECT IMAGE
# ============================================================

print("\nOpening image selector...")

root = tk.Tk()
root.withdraw()

image_path = filedialog.askopenfilename(
    title="Select image for age estimation",

    filetypes=[
        (
            "Image files",
            "*.jpg *.jpeg *.png *.bmp *.webp"
        ),
        (
            "JPG files",
            "*.jpg *.jpeg"
        ),
        (
            "PNG files",
            "*.png"
        ),
        (
            "All files",
            "*.*"
        )
    ]
)

root.destroy()


if not image_path:

    print("No image selected.")
    exit()


print("\nSelected image:")
print(image_path)


# ============================================================
# READ IMAGE
# ============================================================

image = cv2.imread(image_path)

if image is None:
    raise ValueError(
        "Could not read selected image."
    )


original_image = image.copy()

height, width = image.shape[:2]

print(
    f"\nImage size: {width} x {height}"
)


# ============================================================
# FACE DETECTION
# ============================================================

detector.setInputSize(
    (width, height)
)

_, faces = detector.detect(image)


if faces is None or len(faces) == 0:

    print("\n❌ No face detected.")

    cv2.imshow(
        "Future-Face",
        original_image
    )

    cv2.waitKey(0)
    cv2.destroyAllWindows()

    exit()


# ============================================================
# SELECT HIGHEST CONFIDENCE FACE
# ============================================================

best_face = None
best_confidence = -1

for face in faces:

    confidence = float(face[14])

    if confidence > best_confidence:

        best_confidence = confidence
        best_face = face


# ============================================================
# FACE BOX
# ============================================================

x = int(best_face[0])
y = int(best_face[1])
w = int(best_face[2])
h = int(best_face[3])


print(
    f"Face confidence: {best_confidence:.4f}"
)

print(
    f"Face bounding box: "
    f"x={x}, y={y}, "
    f"width={w}, height={h}"
)


# ============================================================
# FACE CROP
# ============================================================

# Keep some surrounding facial context

padding = 0.20

pad_x = int(w * padding)
pad_y = int(h * padding)


x1 = max(
    0,
    x - pad_x
)

y1 = max(
    0,
    y - pad_y
)

x2 = min(
    width,
    x + w + pad_x
)

y2 = min(
    height,
    y + h + pad_y
)


face_crop = image[
    y1:y2,
    x1:x2
]


if face_crop.size == 0:

    raise RuntimeError(
        "Face crop is empty."
    )


# ============================================================
# BGR -> RGB
# ============================================================

face_rgb = cv2.cvtColor(
    face_crop,
    cv2.COLOR_BGR2RGB
)


pil_face = Image.fromarray(
    face_rgb
)


# ============================================================
# PREPROCESS
# ============================================================

input_tensor = transform(
    pil_face
)


input_tensor = input_tensor.unsqueeze(0)


input_tensor = input_tensor.to(device)


print(
    "\nInput tensor shape:",
    input_tensor.shape
)


# ============================================================
# INFERENCE
# ============================================================

with torch.no_grad():

    output = model(
        input_tensor
    )

    predicted_age = output.squeeze().item()


# ============================================================
# DISPLAY VALUE
# ============================================================

predicted_age = max(
    0.0,
    min(
        116.0,
        predicted_age
    )
)


# ============================================================
# RESULT
# ============================================================

print("\n")
print("=" * 65)
print("AGE ESTIMATION RESULT")
print("=" * 65)

print(
    f"Predicted age: {predicted_age:.2f} years"
)

print("=" * 65)


# ============================================================
# DRAW RESULT
# ============================================================

result_image = original_image.copy()


# Face rectangle

cv2.rectangle(
    result_image,
    (x1, y1),
    (x2, y2),
    (0, 255, 0),
    3
)


# Text

text = f"Age: {predicted_age:.1f}"

font = cv2.FONT_HERSHEY_SIMPLEX

font_scale = 1.2

thickness = 3


(text_width, text_height), baseline = cv2.getTextSize(
    text,
    font,
    font_scale,
    thickness
)


text_x = x1

text_y = max(
    text_height + 10,
    y1 - 10
)


# Background

cv2.rectangle(
    result_image,

    (
        text_x,
        text_y - text_height - baseline
    ),

    (
        text_x + text_width + 10,
        text_y + 5
    ),

    (0, 0, 0),

    -1
)


# Text

cv2.putText(
    result_image,
    text,
    (
        text_x + 5,
        text_y
    ),
    font,
    font_scale,
    (0, 255, 0),
    thickness,
    cv2.LINE_AA
)


# ============================================================
# SHOW DETECTED FACE
# ============================================================

cv2.imshow(
    "Detected Face",
    face_crop
)


# ============================================================
# SHOW RESULT
# ============================================================

cv2.imshow(
    "Future-Face Age Estimation",
    result_image
)


print(
    "\nPress any key inside an image window to exit."
)

cv2.waitKey(0)

cv2.destroyAllWindows()