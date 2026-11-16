#!/usr/bin/env python3
"""
ROS 2 Person Detection Node — HC-Robot (Raspberry Pi 5)
Thuần túy đảm nhận tầng Nhận thức Thị giác (Pure Perception):
- Đọc frame hình từ Camera (Picamera2 CSI hoặc OpenCV V4L2 USB).
- Chạy nhận diện người với YOLOv8n.
- Quản lý trạng thái tường minh (Explicit Vision State: YOLO / DEGRADED / FAILED).
  Nếu camera hoặc model lỗi -> chuyển FAILED ngay lập tức (không silent degradation).
- Tính toán góc lệch tâm FOV [theta_min, theta_max] và bearing_deg.
- Publish:
    + /robot/person_detections: BBox, confidence, góc nhìn camera.
    + /robot/vision_status: Trạng thái thị giác, FPS, độ trễ.
- TUYỆT ĐỐI KHÔNG can thiệp /cmd_vel.
- TUYỆT ĐỐI KHÔNG gánh streaming HTTP (đã tách riêng sang Standalone Stream Server).
"""

import enum
import json
import math
import os
import sys
import time
from typing import Dict, List, Optional, Tuple

import yaml

try:
    import rclpy
    from rclpy.node import Node
    from std_msgs.msg import String
except ImportError:
    # Cho phép chạy / test trong môi trường non-ROS
    rclpy = None
    Node = object
    String = None


class VisionMode(str, enum.Enum):
    """Trạng thái tường minh của hệ thống thị giác (Không có silent fallback)."""
    YOLO = "YOLO"           # Hoạt động bình thường với mô hình YOLOv8
    DEGRADED = "DEGRADED"   # Tụt FPS nghiêm trọng hoặc độ trễ inference quá cao
    FAILED = "FAILED"       # Camera đứt kết nối, lỗi phần cứng hoặc model crash


def compute_bearing_and_fov(
    bbox: Dict[str, float],
    frame_width: int,
    hfov_deg: float = 70.0
) -> Tuple[float, List[float]]:
    """
    Tính góc lệch tâm (bearing_deg) và dải góc quét [theta_min, theta_max] từ Bounding Box.
    Theo chuẩn ROS REP-103:
      - Trục X hướng thẳng (Forward).
      - Trục Y hướng sang Trái (Left).
      - Góc dương (theta > 0) là bên TRÁI.
      - Góc âm (theta < 0) là bên PHẢI.
    
    Args:
        bbox: Dict chứa {'x': int, 'y': int, 'width': int, 'height': int}
        frame_width: Độ rộng ảnh (pixel)
        hfov_deg: Góc mở ngang của camera (độ)
        
    Returns:
        (bearing_deg, [theta_min_deg, theta_max_deg])
    """
    if frame_width <= 0:
        return 0.0, [0.0, 0.0]

    x_center = bbox['x'] + bbox['width'] / 2.0
    x_min = bbox['x']
    x_max = bbox['x'] + bbox['width']

    # Chuẩn hóa về [-1, 1] với tâm ảnh là 0
    norm_center = (x_center - frame_width / 2.0) / (frame_width / 2.0)
    norm_min = (x_min - frame_width / 2.0) / (frame_width / 2.0)
    norm_max = (x_max - frame_width / 2.0) / (frame_width / 2.0)

    half_fov = hfov_deg / 2.0

    # ROS REP-103: Tâm ảnh x > width/2 là bên PHẢI -> góc âm (-), x < width/2 là bên TRÁI -> góc dương (+)
    bearing_deg = -norm_center * half_fov
    theta_right = -norm_max * half_fov
    theta_left = -norm_min * half_fov

    # Sắp xếp góc từ nhỏ tới lớn [theta_min, theta_max]
    theta_min = min(theta_right, theta_left)
    theta_max = max(theta_right, theta_left)

    return round(bearing_deg, 2), [round(theta_min, 2), round(theta_max, 2)]


class PersonDetectorBackend:
    """Interface trừu tượng cho detector mô hình AI."""

    def __init__(self, model_path: str = "yolov8n.pt", conf_threshold: float = 0.40):
        self.model_path = model_path
        self.conf_threshold = conf_threshold
        self.model = None
        self.is_ready = False

    def load(self) -> bool:
        """Nạp mô hình YOLOv8."""
        try:
            from ultralytics import YOLO
            self.model = YOLO(self.model_path)
            self.is_ready = True
            return True
        except Exception as e:
            self.is_ready = False
            return False

    def detect(self, frame) -> List[Dict]:
        """
        Nhận diện người trong frame ảnh.
        Chỉ lọc class 0 ('person' trong tập COCO).
        """
        if not self.is_ready or self.model is None:
            return []

        results = self.model(
            frame,
            classes=[0],  # 0 là person trong COCO
            conf=self.conf_threshold,
            verbose=False
        )

        detections = []
        if not results:
            return detections

        person_idx = 1
        for r in results:
            boxes = r.boxes
            if boxes is None:
                continue
            for box in boxes:
                coords = box.xyxy[0].tolist()  # [x1, y1, x2, y2]
                conf = float(box.conf[0])
                x1, y1, x2, y2 = coords
                w = max(0.0, x2 - x1)
                h = max(0.0, y2 - y1)
                detections.append({
                    "id": person_idx,
                    "confidence": round(conf, 3),
                    "bbox": {
                        "x": int(x1),
                        "y": int(y1),
                        "width": int(w),
                        "height": int(h)
                    }
                })
                person_idx += 1

        return detections


class PersonDetectionNode(Node if Node is not object else object):
    """
    ROS 2 Node chạy YOLOv8 phát hiện người trên Raspberry Pi 5.
    """

    def __init__(self):
        if Node is not object:
            super().__init__('person_detection_node')
        
        self.config_path = self._get_config_path()
        self.config = self._load_config()

        # Cấu hình Camera & Vision
        vision_cfg = self.config.get('vision', {})
        self.camera_type = vision_cfg.get('camera_type', 'usb')
        self.device_index = int(vision_cfg.get('device_index', 0))
        self.frame_width = int(vision_cfg.get('width', 640))
        self.frame_height = int(vision_cfg.get('height', 480))
        self.target_fps = int(vision_cfg.get('fps', 15))
        self.hfov_deg = float(vision_cfg.get('camera_hfov_deg', 70.0))
        self.conf_threshold = float(vision_cfg.get('confidence_threshold', 0.40))
        self.model_path = vision_cfg.get('model_path', 'yolov8n.pt')

        # Cấu hình Topics
        topics_cfg = self.config.get('topics', {})
        self.detections_topic = topics_cfg.get('person_detections', '/robot/person_detections')
        self.vision_status_topic = topics_cfg.get('vision_status', '/robot/vision_status')

        # Máy trạng thái nhận thức
        self.vision_mode = VisionMode.YOLO
        self.last_frame_time = time.time()
        self.consecutive_cam_errors = 0
        self.max_cam_errors = 5

        # Khởi tạo detector
        self.detector = PersonDetectorBackend(
            model_path=self.model_path,
            conf_threshold=self.conf_threshold
        )
        model_loaded = self.detector.load()
        if not model_loaded:
            self._log_warn(f"Không thể nạp YOLOv8 từ '{self.model_path}'. Chuyển sang VISION_MODE = FAILED")
            self.vision_mode = VisionMode.FAILED

        # Khởi tạo Camera Backend
        self.camera = None
        self._init_camera()

        # ROS 2 Publishers & Timer
        if Node is not object:
            self.detections_pub = self.create_publisher(String, self.detections_topic, 10)
            self.status_pub = self.create_publisher(String, self.vision_status_topic, 10)
            
            # Timer chu kỳ xử lý frame
            timer_period = 1.0 / max(1, self.target_fps)
            self.timer = self.create_timer(timer_period, self.process_frame_cycle)
            self._log_info(f"PersonDetectionNode đã khởi động. Mode: {self.vision_mode.value}, Topic: {self.detections_topic}")

    def _log_info(self, msg: str):
        if Node is not object and hasattr(self, 'get_logger'):
            self.get_logger().info(msg)
        else:
            print(f"[INFO] {msg}")

    def _log_warn(self, msg: str):
        if Node is not object and hasattr(self, 'get_logger'):
            self.get_logger().warn(msg)
        else:
            print(f"[WARN] {msg}")

    def _log_error(self, msg: str):
        if Node is not object and hasattr(self, 'get_logger'):
            self.get_logger().error(msg)
        else:
            print(f"[ERROR] {msg}")

    def _get_config_path(self) -> str:
        """Định vị file cấu hình settings.yaml."""
        try:
            from ament_index_python.packages import get_package_share_directory
            share_config = os.path.join(get_package_share_directory('hc_robot_client'), 'config', 'settings.yaml')
            if os.path.exists(share_config):
                return share_config
        except Exception:
            pass

        curr_dir = os.path.dirname(os.path.abspath(__file__))
        candidates = [
            os.path.abspath(os.path.join(curr_dir, '../../../../config/settings.yaml')),
            os.path.abspath(os.path.join(curr_dir, '../../../../../robot/config/settings.yaml')),
            os.path.abspath(os.path.join(curr_dir, '../../../../../config/settings.yaml')),
        ]
        for path in candidates:
            if os.path.exists(path):
                return path
        return candidates[0]

    def _load_config(self) -> dict:
        if os.path.exists(self.config_path):
            try:
                with open(self.config_path, 'r', encoding='utf-8') as f:
                    return yaml.safe_load(f) or {}
            except Exception as e:
                self._log_error(f"Lỗi đọc file cấu hình {self.config_path}: {e}")
        return {}

    def _init_camera(self):
        """Khởi tạo camera theo cấu hình."""
        if self.camera_type == "csi":
            try:
                from picamera2 import Picamera2
                self.camera = Picamera2()
                cfg = self.camera.create_video_configuration(
                    main={"size": (self.frame_width, self.frame_height), "format": "RGB888"}
                )
                self.camera.configure(cfg)
                self.camera.start()
                self._log_info("Picamera2 CSI khởi động thành công.")
                return
            except Exception as e:
                self._log_error(f"Khởi tạo Picamera2 thất bại: {e}. Thử chuyển sang OpenCV V4L2...")
        
        # OpenCV fallback
        try:
            import cv2
            cap = cv2.VideoCapture(self.device_index)
            if cap.isOpened():
                cap.set(cv2.CAP_PROP_FRAME_WIDTH, self.frame_width)
                cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.frame_height)
                cap.set(cv2.CAP_PROP_FPS, self.target_fps)
                self.camera = cap
                self._log_info(f"OpenCV Camera (index {self.device_index}) đã mở.")
            else:
                self._log_error(f"Không thể mở OpenCV camera index {self.device_index}.")
                self.vision_mode = VisionMode.FAILED
        except Exception as e:
            self._log_error(f"Lỗi khởi tạo OpenCV: {e}")
            self.vision_mode = VisionMode.FAILED

    def capture_frame(self):
        """Chụp 1 frame RGB/BGR từ camera."""
        if self.camera is None:
            return None

        if hasattr(self.camera, 'capture_array'):
            # Picamera2
            try:
                return self.camera.capture_array()
            except Exception as e:
                self._log_error(f"Lỗi capture Picamera2: {e}")
                return None
        elif hasattr(self.camera, 'read'):
            # OpenCV
            ret, frame = self.camera.read()
            if ret:
                return frame
            return None
        return None

    def process_frame_cycle(self):
        """Vòng lặp định kỳ đọc frame, chạy YOLO và xuất bản topic."""
        start_time = time.time()
        frame = self.capture_frame()

        if frame is None:
            self.consecutive_cam_errors += 1
            if self.consecutive_cam_errors >= self.max_cam_errors:
                if self.vision_mode != VisionMode.FAILED:
                    self.vision_mode = VisionMode.FAILED
                    self._log_error("Mất tín hiệu camera liên tiếp. Chuyển sang VISION_MODE = FAILED")
                    self.publish_status(fps=0.0, latency_ms=0.0, err="Camera feed lost")
            return

        self.consecutive_cam_errors = 0

        # Nếu model chưa nạp được, giữ FAILED và publish status
        if not self.detector.is_ready:
            self.vision_mode = VisionMode.FAILED
            self.publish_status(fps=0.0, latency_ms=0.0, err="YOLO detector not ready")
            return

        # Thực thi nhận diện YOLO
        infer_start = time.time()
        detections = self.detector.detect(frame)
        latency_ms = (time.time() - infer_start) * 1000.0

        # Kiểm tra hiệu năng để cảnh báo DEGRADED nếu latency quá cao (> 200ms)
        if latency_ms > 200.0:
            self.vision_mode = VisionMode.DEGRADED
        else:
            self.vision_mode = VisionMode.YOLO

        # Bổ sung góc lệch tâm bearing và fov_sector cho từng người
        persons_payload = []
        for det in detections:
            bbox = det["bbox"]
            bearing_deg, fov_sector = compute_bearing_and_fov(
                bbox, self.frame_width, self.hfov_deg
            )
            persons_payload.append({
                "id": det["id"],
                "confidence": det["confidence"],
                "bbox": bbox,
                "bearing_deg": bearing_deg,
                "fov_sector_deg": fov_sector
            })

        now = time.time()
        actual_fps = 1.0 / max(1e-4, (now - self.last_frame_time))
        self.last_frame_time = now

        # Publish /robot/person_detections
        msg_payload = {
            "timestamp": now,
            "mode": self.vision_mode.value,
            "count": len(persons_payload),
            "persons": persons_payload
        }
        if Node is not object and hasattr(self, 'detections_pub'):
            msg = String()
            msg.data = json.dumps(msg_payload)
            self.detections_pub.publish(msg)

        # Publish /robot/vision_status định kỳ
        self.publish_status(fps=actual_fps, latency_ms=latency_ms)

    def publish_status(self, fps: float, latency_ms: float, err: str = ""):
        """Xuất bản trạng thái hoạt động của tầng thị giác."""
        if Node is object or not hasattr(self, 'status_pub'):
            return

        status_payload = {
            "timestamp": time.time(),
            "mode": self.vision_mode.value,
            "fps": round(fps, 1),
            "latency_ms": round(latency_ms, 1),
            "error_message": err
        }
        status_msg = String()
        status_msg.data = json.dumps(status_payload)
        self.status_pub.publish(status_msg)

    def destroy_node(self):
        """Dọn dẹp tài nguyên khi tắt node."""
        if self.camera is not None:
            if hasattr(self.camera, 'stop'):
                self.camera.stop()
            elif hasattr(self.camera, 'release'):
                self.camera.release()
        if Node is not object and hasattr(super(), 'destroy_node'):
            super().destroy_node()


def main(args=None):
    if rclpy is None:
        print("rclpy chưa được cài đặt trong môi trường này.")
        return

    rclpy.init(args=args)
    node = PersonDetectionNode()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        node.destroy_node()
        rclpy.shutdown()


if __name__ == '__main__':
    main()
