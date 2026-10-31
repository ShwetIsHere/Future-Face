"""
Future-Face: Face Image Quality Validation Pipeline
===================================================
Validates uploaded/captured portraits before sending to ResNet-50 / SAM StyleGAN2.

Validation Sequence:
1. Face Detection & Count (zero, exactly one, multiple)
2. Face Boundary Validation (not cropped / cut off at image edges)
3. Face Size / Camera Distance (occupies sufficient fraction of frame)
4. Head Pose Detection (Yaw, Pitch, Roll via solvePnP and landmark geometry)
5. Blur / Clarity Detection (Laplacian variance on face crop)
6. Facial Landmark Positioning & Visibility
"""

from dataclasses import dataclass, field
from typing import Optional, Dict, Tuple, Any
import numpy as np
import cv2
from PIL import Image


@dataclass
class ValidationConfig:
    """Configurable thresholds for face quality validation."""
    # Detection
    min_confidence: float = 0.50
    
    # Feature toggle flags - ALL blocking quality errors disabled per user request
    enable_boundary_check: bool = False
    enable_distance_check: bool = False
    enable_tilt_check: bool = False
    enable_look_at_camera_check: bool = False
    enable_blur_check: bool = False
    enable_landmarks_check: bool = False
    
    # Framing scale factor: 1.48 encompasses only face and hair (matches user red box reference)
    framing_scale: float = 1.48
    
    # Boundary margin: min pixels from image edge before considered partially cropped
    boundary_margin: int = 15
    
    # Size / Distance relative to image dimensions
    min_width_ratio: float = 0.03     # Face bbox width >= 3% of image width (allows natural desk webcam distance)
    min_height_ratio: float = 0.06    # Face bbox height >= 6% of image height
    min_area_ratio: float = 0.002     # Face area >= 0.2% of total image area
    min_face_pixels: int = 32         # Min face dimension in pixels
    
    # Head Pose acceptable ranges (degrees)
    min_yaw_deg: float = -45.0
    max_yaw_deg: float = 45.0
    
    # Vertical (Pitch): [-16° (chin-up / looking away), +45° (chin-down)]
    min_pitch_deg: float = -16.0
    max_pitch_deg: float = 45.0
    
    # Sideways in-plane tilt (Roll): [-10°, +10°]
    max_roll_deg: float = 10.0
    
    # Clarity / Blur on cropped face region
    min_blur_score: float = 18.0      # Calibrated for natural portraits
    
    # Landmark proportion limits
    min_eye_dist_ratio: float = 0.22  # Eye distance >= 22% of face width
    min_mouth_width_ratio: float = 0.18 # Mouth width >= 18% of face width


@dataclass
class ValidationResult:
    """Structured validation output containing full telemetry."""
    is_valid: bool
    rejection_reason: Optional[str]
    detected_face_count: int
    face_size_ratio: float
    blur_score: float
    yaw: float
    pitch: float
    roll: float
    individual_results: Dict[str, bool] = field(default_factory=dict)
    face_crop_pil: Optional[Image.Image] = None
    face_bbox: Optional[Tuple[int, int, int, int]] = None
    landmarks: Optional[np.ndarray] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "is_valid": self.is_valid,
            "rejection_reason": self.rejection_reason,
            "detected_face_count": self.detected_face_count,
            "face_size_ratio": round(float(self.face_size_ratio), 4),
            "blur_score": round(float(self.blur_score), 2),
            "yaw": round(float(self.yaw), 1),
            "pitch": round(float(self.pitch), 1),
            "roll": round(float(self.roll), 1),
            "individual_results": self.individual_results
        }


def compute_iou(box1: np.ndarray, box2: np.ndarray) -> float:
    """Calculate Intersection over Union (IoU) of two bounding boxes [x, y, w, h]."""
    x1 = max(float(box1[0]), float(box2[0]))
    y1 = max(float(box1[1]), float(box2[1]))
    x2 = min(float(box1[0] + box1[2]), float(box2[0] + box2[2]))
    y2 = min(float(box1[1] + box1[3]), float(box2[1] + box2[3]))
    inter_w = max(0.0, x2 - x1)
    inter_h = max(0.0, y2 - y1)
    inter = inter_w * inter_h
    area1 = float(box1[2] * box1[3])
    area2 = float(box2[2] * box2[3])
    union = area1 + area2 - inter
    return inter / union if union > 0 else 0.0


def apply_nms(faces: np.ndarray, iou_thresh: float = 0.25) -> list:
    """Non-Maximum Suppression to remove duplicate bounding boxes of the same person."""
    if faces is None or len(faces) == 0:
        return []
    # Sort by confidence score descending
    sorted_faces = sorted(faces, key=lambda f: float(f[-1] if len(f) > 14 else f[14]), reverse=True)
    kept = []
    for f in sorted_faces:
        overlap = False
        for k in kept:
            if compute_iou(f, k) >= iou_thresh:
                overlap = True
                break
        if not overlap:
            kept.append(f)
    return kept
# Point 0: Right Eye pupil (person's right)
# Point 1: Left Eye pupil (person's left)
# Point 2: Nose tip
# Point 3: Right mouth corner
# Point 4: Left mouth corner
# Point 5: Chin tip
CANONICAL_FACE_3D = np.array([
    [-32.0, -30.0, -10.0],
    [ 32.0, -30.0, -10.0],
    [  0.0,   0.0,  15.0],
    [-24.0,  30.0, -10.0],
    [ 24.0,  30.0, -10.0],
    [  0.0,  55.0, -15.0]
], dtype=np.float64)


class FaceQualityValidator:
    """Modular Face Quality Validation Pipeline."""

    def __init__(self, detector: cv2.FaceDetectorYN, config: Optional[ValidationConfig] = None):
        self.detector = detector
        self.config = config or ValidationConfig()

    def estimate_head_pose(self, landmarks_5: np.ndarray, bbox: Tuple[float, float, float, float], img_w: int, img_h: int) -> Tuple[float, float, float]:
        """
        Estimates Yaw, Pitch, Roll in degrees using OpenCV solvePnP and
        geometric upright projection.
        """
        r_eye = landmarks_5[0]
        l_eye = landmarks_5[1]
        nose = landmarks_5[2]
        r_mouth = landmarks_5[3]
        l_mouth = landmarks_5[4]

        # 1. Roll (In-plane eye slope): mathematically exact
        dx = l_eye[0] - r_eye[0]
        dy = l_eye[1] - r_eye[1]
        roll_deg = np.degrees(np.arctan2(dy, dx))
        if roll_deg > 90:
            roll_deg -= 180
        elif roll_deg < -90:
            roll_deg += 180

        # 2. Geometric upright projection to remove roll for robust yaw/pitch
        eye_center = (r_eye + l_eye) / 2.0
        rad = np.radians(-roll_deg)
        c, s = np.cos(rad), np.sin(rad)

        def rot(pt):
            ox = pt[0] - eye_center[0]
            oy = pt[1] - eye_center[1]
            return np.array([ox * c - oy * s + eye_center[0], ox * s + oy * c + eye_center[1]])

        r_eye_r = rot(r_eye)
        l_eye_r = rot(l_eye)
        nose_r = rot(nose)
        r_mouth_r = rot(r_mouth)
        l_mouth_r = rot(l_mouth)

        eye_dist = abs(l_eye_r[0] - r_eye_r[0])
        eye_mid_x = (r_eye_r[0] + l_eye_r[0]) / 2.0
        yaw_geom = float(np.degrees(np.arcsin(np.clip((nose_r[0] - eye_mid_x) / (eye_dist / 2.0 + 1e-6), -1.0, 1.0))))

        # 3. OpenCV solvePnP validation with 6-point model
        mouth_center = (r_mouth + l_mouth) / 2.0
        face_dir = mouth_center - eye_center
        face_len = np.linalg.norm(face_dir)
        chin = mouth_center + (face_dir / (face_len + 1e-6)) * (face_len * 0.55)

        img_pts = np.array([r_eye, l_eye, nose, r_mouth, l_mouth, chin], dtype=np.float64)
        focal_length = max(img_w, img_h)
        cam_mat = np.array([
            [focal_length, 0, img_w / 2.0],
            [0, focal_length, img_h / 2.0],
            [0, 0, 1]
        ], dtype=np.float64)
        dist = np.zeros((4, 1), dtype=np.float64)

        success, rvec, tvec = cv2.solvePnP(
            CANONICAL_FACE_3D,
            img_pts,
            cam_mat,
            dist,
            flags=cv2.SOLVEPNP_ITERATIVE
        )

        if success:
            rmat, _ = cv2.Rodrigues(rvec)
            angles, _, _, _, _, _ = cv2.RQDecomp3x3(rmat)
            y_pnp = angles[1]
            if abs(y_pnp) <= 90:
                yaw = float(0.65 * y_pnp + 0.35 * yaw_geom)
            else:
                yaw = float(yaw_geom)
        else:
            yaw = float(yaw_geom)

        # 4. Multi-cue Pitch Estimation:
        # Robust against smile/laughter muscle shifts and facial expression variations
        mouth_center_y = (r_mouth_r[1] + l_mouth_r[1]) / 2.0
        total_v = mouth_center_y - eye_center[1]
        eye_to_nose = nose_r[1] - eye_center[1]
        
        fx, fy, fw, fh = bbox
        v_ratio = eye_to_nose / (total_v + 1e-6) if total_v > 0 else 0.60
        nose_in_box = (nose[1] - fy) / (fh + 1e-6)
        forehead_margin = (eye_center[1] - fy) / (fh + 1e-6)
        chin_margin = ((fy + fh) - mouth_center_y) / (fh + 1e-6)
        chin_balance = (chin_margin - forehead_margin)

        # Facial feature ratio (neutral ~0.60):
        pitch_features = (v_ratio - 0.60) * 120.0
        # Nose vertical position in bounding box (neutral ~0.60):
        pitch_bbox = (nose_in_box - 0.60) * 100.0
        # Chin-up tilt penalty: activates when chin significantly exceeds forehead (chin tilted to ceiling)
        pitch_chin = - (chin_balance + 0.10) * 60.0 if chin_balance > 0 else 0.0

        pitch = float(pitch_features * 0.60 + pitch_bbox * 0.40 + pitch_chin)

        return yaw, pitch, float(roll_deg)

    def validate(self, image_bgr: np.ndarray) -> ValidationResult:
        """
        Executes the full 7-step quality validation pipeline.
        Returns ValidationResult with details and friendly user rejection message.
        """
        checks: Dict[str, bool] = {
            "face_count": False,
            "boundary": False,
            "size_distance": False,
            "head_pose": False,
            "clarity": False,
            "landmarks": False
        }

        if image_bgr is None or image_bgr.size == 0:
            return ValidationResult(
                is_valid=False,
                rejection_reason="No face detected. Please upload a face image.",
                detected_face_count=0,
                face_size_ratio=0.0,
                blur_score=0.0,
                yaw=0.0,
                pitch=0.0,
                roll=0.0,
                individual_results=checks
            )

        img_h, img_w = image_bgr.shape[:2]
        self.detector.setInputSize((img_w, img_h))
        _, faces = self.detector.detect(image_bgr)

        # -------------------------------------------------------------
        # Step A: Face Detection & Count Check
        # -------------------------------------------------------------
        if faces is None or len(faces) == 0:
            return ValidationResult(
                is_valid=False,
                rejection_reason="No face detected. Please upload a face image.",
                detected_face_count=0,
                face_size_ratio=0.0,
                blur_score=0.0,
                yaw=0.0,
                pitch=0.0,
                roll=0.0,
                individual_results=checks
            )

        # Apply Non-Maximum Suppression to remove duplicate/overlapping boxes of same person
        nms_faces = apply_nms(faces, iou_thresh=0.25)
        if len(nms_faces) == 0:
            return ValidationResult(
                is_valid=False,
                rejection_reason="No face detected. Please upload a face image.",
                detected_face_count=0,
                face_size_ratio=0.0,
                blur_score=0.0,
                yaw=0.0,
                pitch=0.0,
                roll=0.0,
                individual_results=checks
            )

        primary_face = max(nms_faces, key=lambda f: float(f[2] * f[3]))
        primary_area = float(primary_face[2] * primary_face[3])

        # Count distinct people with confidence and prominent size
        prominent_faces = [
            f for f in nms_faces
            if float(f[-1] if len(f) > 14 else f[14]) >= self.config.min_confidence
            and float(f[2] * f[3]) >= (primary_area * 0.20)
        ]

        if len(prominent_faces) > 1:
            return ValidationResult(
                is_valid=False,
                rejection_reason="Multiple faces detected. Please upload an image containing only one person.",
                detected_face_count=len(prominent_faces),
                face_size_ratio=round(primary_area / (img_w * img_h), 4),
                blur_score=0.0,
                yaw=0.0,
                pitch=0.0,
                roll=0.0,
                individual_results=checks
            )

        checks["face_count"] = True

        # Extract primary face bounding box & landmarks
        face = primary_face
        fx, fy, fw, fh = float(face[0]), float(face[1]), float(face[2]), float(face[3])
        x, y, w, h = int(round(fx)), int(round(fy)), int(round(fw)), int(round(fh))

        landmarks_5 = np.array([
            [float(face[4]), float(face[5])],   # Right eye
            [float(face[6]), float(face[7])],   # Left eye
            [float(face[8]), float(face[9])],   # Nose
            [float(face[10]), float(face[11])], # Right mouth
            [float(face[12]), float(face[13])]  # Left mouth
        ], dtype=np.float64)

        # -------------------------------------------------------------
        # Step B: Face Boundary Validation (Partially cropped / cut off)
        # -------------------------------------------------------------
        bm = self.config.boundary_margin
        is_boundary_clipped = (
            (x < bm) or
            (y < bm) or
            (x + w > img_w - bm) or
            (y + h > img_h - bm)
        )
        # Also verify all 5 landmarks are comfortably inside the frame
        lm_outside = any(
            pt[0] < bm or pt[0] > (img_w - bm) or pt[1] < bm or pt[1] > (img_h - bm)
            for pt in landmarks_5
        )

        if self.config.enable_boundary_check and (is_boundary_clipped or lm_outside):
            return ValidationResult(
                is_valid=False,
                rejection_reason="Your face is partially cropped. Please upload a complete face image.",
                detected_face_count=1,
                face_size_ratio=round((fw * fh) / (img_w * img_h), 4),
                blur_score=0.0,
                yaw=0.0,
                pitch=0.0,
                roll=0.0,
                individual_results=checks,
                face_bbox=(x, y, w, h),
                landmarks=landmarks_5
            )

        checks["boundary"] = True

        # -------------------------------------------------------------
        # Step C: Face Size & Camera Distance Validation
        # -------------------------------------------------------------
        width_ratio = fw / img_w
        height_ratio = fh / img_h
        area_ratio = (fw * fh) / (img_w * img_h)

        if self.config.enable_distance_check and (
            width_ratio < self.config.min_width_ratio
            or height_ratio < self.config.min_height_ratio
            or area_ratio < self.config.min_area_ratio
            or fw < self.config.min_face_pixels
            or fh < self.config.min_face_pixels
        ):
            return ValidationResult(
                is_valid=False,
                rejection_reason="Your face is too far away. Please move closer to the camera.",
                detected_face_count=1,
                face_size_ratio=round(area_ratio, 4),
                blur_score=0.0,
                yaw=0.0,
                pitch=0.0,
                roll=0.0,
                individual_results=checks,
                face_bbox=(x, y, w, h),
                landmarks=landmarks_5
            )

        checks["size_distance"] = True

        # -------------------------------------------------------------
        # Step D: Head Pose Validation (Yaw, Pitch, Roll)
        # -------------------------------------------------------------
        yaw, pitch, roll = self.estimate_head_pose(landmarks_5, (fx, fy, fw, fh), img_w, img_h)

        # 1. Roll check (head tilted sideways)
        if self.config.enable_tilt_check and abs(roll) > self.config.max_roll_deg:
            return ValidationResult(
                is_valid=False,
                rejection_reason="Your face is tilted. Please keep your head straight.",
                detected_face_count=1,
                face_size_ratio=round(area_ratio, 4),
                blur_score=0.0,
                yaw=yaw,
                pitch=pitch,
                roll=roll,
                individual_results=checks,
                face_bbox=(x, y, w, h),
                landmarks=landmarks_5
            )

        # 2. Horizontal (Yaw) & Vertical (Pitch)
        if self.config.enable_look_at_camera_check:
            if not (self.config.min_yaw_deg <= yaw <= self.config.max_yaw_deg) or not (self.config.min_pitch_deg <= pitch <= self.config.max_pitch_deg):
                return ValidationResult(
                    is_valid=False,
                    rejection_reason="Please look directly at the camera.",
                    detected_face_count=1,
                    face_size_ratio=round(area_ratio, 4),
                    blur_score=0.0,
                    yaw=yaw,
                    pitch=pitch,
                    roll=roll,
                    individual_results=checks,
                    face_bbox=(x, y, w, h),
                    landmarks=landmarks_5
                )

        checks["head_pose"] = True

        # -------------------------------------------------------------
        # Step E: Clarity / Blur Detection on Face Region
        # -------------------------------------------------------------
        face_roi = image_bgr[max(0, y):min(img_h, y + h), max(0, x):min(img_w, x + w)]
        if face_roi.size == 0:
            face_roi = image_bgr
        gray_face = cv2.cvtColor(face_roi, cv2.COLOR_BGR2GRAY)
        blur_score = float(cv2.Laplacian(gray_face, cv2.CV_64F).var())

        if self.config.enable_blur_check and blur_score < self.config.min_blur_score:
            return ValidationResult(
                is_valid=False,
                rejection_reason="Image is blurry. Please upload a clearer image.",
                detected_face_count=1,
                face_size_ratio=round(area_ratio, 4),
                blur_score=blur_score,
                yaw=yaw,
                pitch=pitch,
                roll=roll,
                individual_results=checks,
                face_bbox=(x, y, w, h),
                landmarks=landmarks_5
            )

        checks["clarity"] = True

        # -------------------------------------------------------------
        # Step F: Facial Landmark Positioning & Visibility Validation
        # -------------------------------------------------------------
        r_eye = landmarks_5[0]
        l_eye = landmarks_5[1]
        nose = landmarks_5[2]
        r_mouth = landmarks_5[3]
        l_mouth = landmarks_5[4]

        eye_dist = np.linalg.norm(l_eye - r_eye)
        mouth_width = np.linalg.norm(l_mouth - r_mouth)

        if self.config.enable_landmarks_check and (
            eye_dist < (fw * self.config.min_eye_dist_ratio)
            or mouth_width < (fw * self.config.min_mouth_width_ratio)
            or nose[1] <= min(r_eye[1], l_eye[1])
            or max(r_mouth[1], l_mouth[1]) <= nose[1]
        ):
            return ValidationResult(
                is_valid=False,
                rejection_reason="Facial features are not clearly visible.",
                detected_face_count=1,
                face_size_ratio=round(area_ratio, 4),
                blur_score=blur_score,
                yaw=yaw,
                pitch=pitch,
                roll=roll,
                individual_results=checks,
                face_bbox=(x, y, w, h),
                landmarks=landmarks_5
            )

        checks["landmarks"] = True

        # -------------------------------------------------------------
        # Step G: Facial Part & Hair Framing (Matching User Red Box Reference)
        # -------------------------------------------------------------
        # Crop only the face, hair, ears, chin, and collar.
        # Scale: 1.48x max(w, h), centered at cy = y + 0.45h (user red box reference).
        face_size = max(w, h)
        scale = self.config.framing_scale
        side = int(round(face_size * scale))

        cx = x + w // 2
        cy = int(round(y + h * 0.45))

        x1 = cx - side // 2
        y1 = cy - side // 2
        x2 = x1 + side
        y2 = y1 + side

        # Pad with reflection if framing extends outside original image bounds
        pad_left = max(0, -x1)
        pad_top = max(0, -y1)
        pad_right = max(0, x2 - img_w)
        pad_bottom = max(0, y2 - img_h)

        working_img = image_bgr
        if any((pad_left, pad_top, pad_right, pad_bottom)):
            working_img = cv2.copyMakeBorder(
                working_img, pad_top, pad_bottom, pad_left, pad_right, cv2.BORDER_REFLECT_101
            )
            x1 += pad_left
            x2 += pad_left
            y1 += pad_top
            y2 += pad_top

        crop = working_img[max(0, y1):min(working_img.shape[0], y2), max(0, x1):min(working_img.shape[1], x2)]
        if crop.size == 0:
            crop = image_bgr

        # High-resolution PIL RGB image preserving crisp details
        crop_rgb = cv2.cvtColor(crop, cv2.COLOR_BGR2RGB)
        pil_crop = Image.fromarray(crop_rgb)

        # Cap at 1024x1024 for ultra-large photos to match SAM native resolution
        if pil_crop.width > 1024 or pil_crop.height > 1024:
            pil_crop = pil_crop.resize((1024, 1024), Image.Resampling.LANCZOS)

        # -------------------------------------------------------------
        # All checks passed!
        # -------------------------------------------------------------
        return ValidationResult(
            is_valid=True,
            rejection_reason=None,
            detected_face_count=1,
            face_size_ratio=round(area_ratio, 4),
            blur_score=blur_score,
            yaw=yaw,
            pitch=pitch,
            roll=roll,
            individual_results=checks,
            face_crop_pil=pil_crop,
            face_bbox=(x, y, w, h),
            landmarks=landmarks_5
        )
