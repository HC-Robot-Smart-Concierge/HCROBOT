"""ONNX-based facial age & gender estimation service using InsightFace genderage.onnx."""

import base64
import logging
import math
import os
import threading
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import cv2
import numpy as np

logger = logging.getLogger(__name__)

_DEFAULT_MODEL_PATH = (
    Path(__file__).resolve().parents[3] / "models" / "demographics" / "genderage.onnx"
)


def map_age_to_group(age: int) -> str:
    """Map predicted numeric age into system age_group buckets."""
    if age < 15:
        return "child"
    if age <= 35:
        return "young_adult"
    if age <= 59:
        return "adult"
    return "senior"


def _softmax_2(v0: float, v1: float) -> Tuple[float, float]:
    m = max(v0, v1)
    e0 = math.exp(v0 - m)
    e1 = math.exp(v1 - m)
    s = e0 + e1
    return (e0 / s, e1 / s) if s > 0 else (0.5, 0.5)


class DemographicsService:
    """Lazy-loaded InsightFace genderage.onnx inference wrapper."""

    def __init__(self, model_path: Optional[Path] = None):
        self.model_path = Path(model_path) if model_path else Path(
            os.getenv("DEMOGRAPHICS_MODEL_PATH", str(_DEFAULT_MODEL_PATH))
        )
        self._session = None
        self._input_name: Optional[str] = None
        self._lock = threading.Lock()
        self._cascade = None

    def _ensure_session(self):
        if self._session is not None:
            return self._session
        with self._lock:
            if self._session is not None:
                return self._session
            if not self.model_path.exists():
                raise FileNotFoundError(f"Demographics model not found at {self.model_path}")
            import onnxruntime as ort

            sess = ort.InferenceSession(
                str(self.model_path),
                providers=["CPUExecutionProvider"],
            )
            self._input_name = sess.get_inputs()[0].name
            self._session = sess
            logger.info("[DemographicsService] Loaded genderage.onnx from %s", self.model_path)
            return self._session

    def _detect_face_bbox(self, bgr: np.ndarray) -> Optional[Tuple[int, int, int, int]]:
        """Fallback Haar cascade face detector when client does not pass bbox."""
        if self._cascade is None:
            cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
            self._cascade = cv2.CascadeClassifier(cascade_path)
        gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
        faces = self._cascade.detectMultiScale(gray, scaleFactor=1.15, minNeighbors=4, minSize=(40, 40))
        if len(faces) == 0:
            return None
        x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
        return int(x), int(y), int(x + w), int(y + h)

    @staticmethod
    def _crop_face_for_genderage(bgr: np.ndarray, bbox: Optional[List[float]]) -> Optional[np.ndarray]:
        """Crop and pad square face region (InsightFace standard 1.5x scale) resized to 96x96."""
        img_h, img_w = bgr.shape[:2]
        if bbox and len(bbox) == 4:
            x1, y1, x2, y2 = [float(v) for v in bbox]
            if max(x1, y1, x2, y2) <= 1.5:
                x1, x2 = x1 * img_w, x2 * img_w
                y1, y2 = y1 * img_h, y2 * img_h
        else:
            return None

        bw = max(1.0, x2 - x1)
        bh = max(1.0, y2 - y1)
        cx = (x1 + x2) / 2.0
        cy = (y1 + y2) / 2.0
        side = max(bw, bh) * 1.45
        half = side / 2.0

        sx1 = max(0, int(round(cx - half)))
        sy1 = max(0, int(round(cy - half)))
        sx2 = min(img_w, int(round(cx + half)))
        sy2 = min(img_h, int(round(cy + half)))
        if sx2 - sx1 < 16 or sy2 - sy1 < 16:
            return None

        crop = bgr[sy1:sy2, sx1:sx2]
        return cv2.resize(crop, (96, 96), interpolation=cv2.INTER_LINEAR)

    def analyze_image_base64(
        self, image_base64: str, bbox: Optional[List[float]] = None
    ) -> Dict[str, Any]:
        """Decode base64 JPEG/PNG frame and predict gender, age, age_group, and confidence."""
        raw_b64 = image_base64.split(",", 1)[-1].strip()
        if not raw_b64:
            raise ValueError("Empty image_base64")
        img_bytes = base64.b64decode(raw_b64)
        arr = np.frombuffer(img_bytes, dtype=np.uint8)
        bgr = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if bgr is None:
            raise ValueError("Invalid image data")

        if not bbox or len(bbox) != 4:
            detected = self._detect_face_bbox(bgr)
            if detected is None:
                return {
                    "face_detected": False,
                    "gender": "unknown",
                    "age": None,
                    "age_group": "young_adult",
                    "confidence": 0,
                    "model_used": "insightface_genderage_onnx",
                }
            bbox = list(detected)

        face_96 = self._crop_face_for_genderage(bgr, bbox)
        if face_96 is None:
            return {
                "face_detected": False,
                "gender": "unknown",
                "age": None,
                "age_group": "young_adult",
                "confidence": 0,
                "model_used": "insightface_genderage_onnx",
            }

        sess = self._ensure_session()
        blob = cv2.dnn.blobFromImage(
            face_96, 1.0, (96, 96), (0.0, 0.0, 0.0), swapRB=True
        )
        outputs = sess.run(None, {self._input_name: blob})
        pred = outputs[0][0]
        p_female, p_male = _softmax_2(float(pred[0]), float(pred[1]))
        is_male = p_male >= p_female
        gender = "male" if is_male else "female"
        confidence = int(round(max(p_male, p_female) * 100))
        age = max(1, min(99, int(round(float(pred[2]) * 100))))

        return {
            "face_detected": True,
            "gender": gender,
            "age": age,
            "age_group": map_age_to_group(age),
            "confidence": confidence,
            "model_used": "insightface_genderage_onnx",
        }


demographics_service = DemographicsService()
