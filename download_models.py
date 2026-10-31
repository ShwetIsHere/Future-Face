"""
Model Verification & Download Utility for Microsoft Azure Deployment
Ensures all required model checkpoints exist before starting the application.
"""

import os
import sys
from pathlib import Path

PROJECT_DIR = Path(__file__).resolve().parent

MODELS = {
    "ResNet-50 Age Estimation": {
        "path": PROJECT_DIR / "models" / "Future-Face-ResNet50-Final.pth",
        "env_url": "AZURE_AGE_MODEL_URL",
        "description": "Trained ResNet-50 Age Estimation Model (~94 MB)"
    },
    "YuNet Face Detector": {
        "path": PROJECT_DIR / "models" / "face_detection_yunet_2023mar.onnx",
        "env_url": "AZURE_YUNET_URL",
        "description": "YuNet ONNX Face Detector (~336 KB)"
    },
    "SAM FFHQ Aging Checkpoint": {
        "path": PROJECT_DIR / "SAM-official" / "pretrained_models" / "sam_ffhq_aging.pt",
        "env_url": "AZURE_SAM_MODEL_URL",
        "description": "StyleGAN2 SAM Generative Aging Checkpoint (~2.27 GB)"
    },
    "Dlib 68 Facial Landmarks": {
        "path": PROJECT_DIR / "SAM-official" / "shape_predictor_68_face_landmarks.dat",
        "env_url": "AZURE_DLIB_LANDMARKS_URL",
        "description": "Dlib 68 Facial Landmarks Predictor (~99.7 MB)"
    }
}

def check_or_download_models():
    print("=" * 65)
    print("FUTURE-FACE MODEL CHECKPOINT VERIFICATION (AZURE)")
    print("=" * 65)
    
    all_ready = True
    
    for name, info in MODELS.items():
        file_path = info["path"]
        env_url = info["env_url"]
        url = os.environ.get(env_url)
        
        file_path.parent.mkdir(parents=True, exist_ok=True)
        
        if file_path.is_file():
            size_mb = file_path.stat().st_size / (1024 * 1024)
            print(f"[READY] {name}: Found ({size_mb:.1f} MB) -> {file_path}")
        else:
            if url:
                print(f"[DOWNLOADING] {name} from {url}...")
                try:
                    import requests
                    with requests.get(url, stream=True, timeout=600) as r:
                        r.raise_for_status()
                        with open(file_path, "wb") as f:
                            for chunk in r.iter_content(chunk_size=1024 * 1024):
                                if chunk:
                                    f.write(chunk)
                    print(f"[SUCCESS] Downloaded {name} -> {file_path}")
                except Exception as e:
                    print(f"[ERROR] Failed to download {name}: {e}")
                    all_ready = False
            else:
                print(f"[MISSING] {name} not found at: {file_path}")
                print(f"         Set environment variable '{env_url}' or mount Azure File Share / Blob Storage.")
                all_ready = False
                
    print("=" * 65)
    if all_ready:
        print(">>> ALL MODEL CHECKPOINTS VERIFIED FOR INFERENCE! <<<")
    else:
        print(">>> WARNING: Some model weights are missing. Review instructions above. <<<")
    print("=" * 65)
    return all_ready

if __name__ == "__main__":
    ready = check_or_download_models()
    sys.exit(0 if ready else 1)
