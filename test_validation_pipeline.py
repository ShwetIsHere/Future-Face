import os
import sys
import cv2
import numpy as np

# Add project root
sys.path.insert(0, r"E:\Face Convert\Fature-Face")

from face_validator import FaceQualityValidator, ValidationConfig

yunet_model = r"E:\Face Convert\Fature-Face\models\face_detection_yunet_2023mar.onnx"
detector = cv2.FaceDetectorYN.create(yunet_model, "", (320, 320), 0.5, 0.3, 5000)
# Strict validator tests configurable thresholds
strict_config = ValidationConfig(
    enable_boundary_check=True,
    enable_distance_check=True,
    enable_tilt_check=True,
    enable_look_at_camera_check=True,
    enable_blur_check=True,
    min_width_ratio=0.10  # For small face test
)
validator = FaceQualityValidator(detector, strict_config)
default_validator = FaceQualityValidator(detector, ValidationConfig())

def run_tests():
    print("=" * 80)
    print("FACE QUALITY VALIDATION PIPELINE: 9-SCENARIO VERIFICATION TEST")
    print("=" * 80)
    
    # Load base clear face
    base_img_path = r"E:\Face Convert\Fature-Face\demo\person1.jpg"
    base_img = cv2.imread(base_img_path)
    assert base_img is not None, "Base test image not found"
    bh, bw = base_img.shape[:2]

    test_cases = []

    # 1. Clear front-facing image
    test_cases.append(("1. Clear Front-Facing", base_img.copy(), True, None))

    # 2. Blurry image (Gaussian blur filter)
    blurry_img = cv2.GaussianBlur(base_img, (31, 31), 15.0)
    test_cases.append(("2. Blurry Image", blurry_img, False, "Image is blurry"))

    # 3. Face far away from camera (face shrunk to 5% width in large canvas)
    canvas = np.zeros((1000, 1000, 3), dtype=np.uint8) + 128
    small_face = cv2.resize(base_img, (50, 50)) # 50px in 1000px canvas = 5%
    canvas[475:525, 475:525] = small_face
    test_cases.append(("3. Face Far Away", canvas, False, "Your face is too far away"))

    # 4. Side-facing / Angled image (Verified allowed per user request, removing "Please look directly at the camera")
    sam_path = r"C:\Users\SHWET\.gemini\antigravity\brain\51a5fa0c-8456-45ec-8346-024c9c4b0b3e\.user_uploaded\media_1793445437276_fbe6c65e.jpg"
    sam_img = cv2.imread(sam_path)
    test_cases.append(("4. Angled / SAM Portrait", sam_img, True, None))

    # 5. Tilted face (in-plane clockwise tilt of 25 degrees)
    M_rot = cv2.getRotationMatrix2D((bw/2, bh/2), -25, 1.0)
    tilted_img = cv2.warpAffine(base_img, M_rot, (bw, bh), borderMode=cv2.BORDER_REPLICATE)
    test_cases.append(("5. Tilted Face (Roll > 10°)", tilted_img, False, "Your face is tilted"))

    # 6. Partially cropped face (face cut off by cropping left edge through cheek/eye)
    detector.setInputSize((bw, bh))
    _, faces = detector.detect(base_img)
    fx, fy, fw, fh = faces[0][:4]
    # Crop so left edge cuts 35% of the face bbox
    crop_x = int(fx + fw * 0.35)
    cut_img = base_img[:, crop_x:]
    test_cases.append(("6. Partially Cropped Face", cut_img, False, "Your face is partially cropped"))

    # 7. Multiple faces (duplicate face horizontally)
    two_faces = np.hstack([cv2.resize(base_img, (500, 500)), cv2.resize(base_img, (500, 500))])
    test_cases.append(("7. Multiple Faces", two_faces, False, "Multiple faces detected"))

    # 8. Poor lighting / heavy underexposure
    dark_img = cv2.convertScaleAbs(base_img, alpha=0.15, beta=-30)
    test_cases.append(("8. Poor Lighting", dark_img, False, "No face detected"))

    # 9. Face partially covered (black rectangle over mouth & nose)
    covered_img = base_img.copy()
    f = faces[0]
    nose_y = int(f[9])
    mouth_y = int(f[11])
    fx, fy, fw, fh = int(f[0]), int(f[1]), int(f[2]), int(f[3])
    # Place a solid occlusion patch over lower face
    covered_img[nose_y - 20:int(fy + fh), fx + int(fw*0.15):fx + int(fw*0.85)] = 0
    test_cases.append(("9. Face Partially Covered", covered_img, False, None))

    # Run evaluations
    all_passed = True
    print(f"{'Test Scenario':<28} | {'Valid?':<7} | {'Detected Faces':<14} | {'Pose (Y/P/R)':<18} | {'Blur':<7} | Result")
    print("-" * 115)

    for name, img, expected_valid, expected_reason_substr in test_cases:
        res = validator.validate(img)
        pose_str = f"{res.yaw:+.0f}/{res.pitch:+.0f}/{res.roll:+.0f} deg"
        verdict = "PASS" if res.is_valid == expected_valid else "FAIL"
        
        # If expected to be rejected with a reason substring, check it
        if not expected_valid and expected_reason_substr:
            if not res.rejection_reason or expected_reason_substr.lower() not in res.rejection_reason.lower():
                verdict = f"FAIL (Got: '{res.rejection_reason}')"
                all_passed = False
        elif res.is_valid != expected_valid:
            all_passed = False

        print(f"{name:<28} | {str(res.is_valid):<7} | Count: {res.detected_face_count:<8} | {pose_str:<18} | {res.blur_score:<7.1f} | [{verdict}]")
        if res.rejection_reason:
            print(f"   -> Rejection Reason: \"{res.rejection_reason}\"")
            print(f"   -> Checks: {res.individual_results}")

    print("=" * 80)
    if all_passed:
        print(">>> ALL 9 VALIDATION SCENARIOS TESTED & VERIFIED SUCCESSFULLY! <<<")
    else:
        print(">>> SOME TESTS FAILED. PLEASE REVIEW ABOVE. <<<")
    return all_passed

if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
