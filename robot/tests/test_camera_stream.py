import os
import sys
from unittest.mock import MagicMock, patch
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from scripts.camera_stream import (
    CameraBackend,
    OpenCVBackend,
    create_camera_backend,
    MJPEGHandler,
)
from main import build_argument_parser


def test_main_argument_parser_camera_device():
    parser = build_argument_parser()
    args = parser.parse_args(["--camera-device", "2"])
    assert args.camera_device == "2"
    assert not args.no_camera


def test_opencv_backend_fallback_scan_fails_gracefully():
    mock_cv2 = MagicMock()
    mock_cap = MagicMock()
    mock_cap.isOpened.return_value = False
    mock_cv2.VideoCapture.return_value = mock_cap
    mock_cv2.CAP_V4L2 = 200

    with patch.dict(sys.modules, {"cv2": mock_cv2}):
        backend = OpenCVBackend(width=640, height=480, fps=15, device=0)
        with pytest.raises(RuntimeError, match="Không thể mở USB camera"):
            backend.start()


def test_create_camera_backend_uses_opencv_when_picamera_absent():
    with patch("scripts.camera_stream.Picamera2Backend.start", side_effect=ImportError("No picamera2")):
        with patch("scripts.camera_stream.OpenCVBackend.start") as mock_cv_start:
            backend = create_camera_backend(width=640, height=480, fps=15, device=1)
            assert isinstance(backend, OpenCVBackend)
            assert backend.device == 1
            mock_cv_start.assert_called_once()
