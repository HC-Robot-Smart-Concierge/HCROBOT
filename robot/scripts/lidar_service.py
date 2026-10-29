"""
Dịch vụ LiDAR SLAM & Tự hành (Autonomous Navigation) cho HC-Robot trên Raspberry Pi 5.
- Tự động nhận diện RPLiDAR A1M8 (/dev/ttyUSB* hoặc by-id CP2102)
- Dựng bản đồ 2D Occupancy Grid sắc nét (thuật toán Raytracing tự làm sạch vùng trống)
- Bộ điều khiển Tự hành (Autonomous Navigation Engine): nhận tọa độ mục tiêu từ Web Admin,
  tự động tính hướng, né vật cản thời gian thực qua LiDAR và điều khiển động cơ qua UDP port 9999.
"""

import asyncio
import glob
import json
import logging
import math
import os
import socket
import threading
import time
from typing import Any, Dict, List, Optional

import serial

try:
    import uvicorn
    from fastapi import FastAPI, WebSocket, WebSocketDisconnect
    from fastapi.middleware.cors import CORSMiddleware
    from pydantic import BaseModel
    HAS_FASTAPI = True
except ImportError:
    HAS_FASTAPI = False
    uvicorn = None
    FastAPI = None
    WebSocket = None
    WebSocketDisconnect = Exception
    CORSMiddleware = None
    BaseModel = object

logging.basicConfig(level=logging.INFO, format="[%(asctime)s] [%(levelname)s] [LiDAR-SLAM] %(message)s")
logger = logging.getLogger("RPLidarSLAM")

ROBOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAPS_DIR = os.path.join(ROBOT_DIR, "maps")
WORKFLOWS_DIR = os.path.join(ROBOT_DIR, "workflows")
os.makedirs(MAPS_DIR, exist_ok=True)
os.makedirs(WORKFLOWS_DIR, exist_ok=True)

import sys
if ROBOT_DIR not in sys.path:
    sys.path.insert(0, ROBOT_DIR)


def find_rplidar_port() -> str:
    """Tự động tìm kiếm cổng Serial của RPLiDAR A1M8 (ưu tiên CP2102 UART Bridge)."""
    by_id_matches = glob.glob("/dev/serial/by-id/*CP2102*") + glob.glob("/dev/serial/by-id/*Silicon_Labs*")
    if by_id_matches:
        real_path = os.path.realpath(by_id_matches[0])
        logger.info(f"Tìm thấy RPLiDAR qua by-id: {by_id_matches[0]} -> {real_path}")
        return real_path

    env_port = os.getenv("LIDAR_PORT")
    if env_port and os.path.exists(env_port):
        return env_port

    for p in ["/dev/ttyUSB0", "/dev/ttyUSB1", "/dev/ttyUSB2", "/dev/ttyACM0"]:
        if os.path.exists(p):
            return p

    return "/dev/ttyUSB0"


class RPLidarSLAMCore:
    """Quản lý phần cứng RPLiDAR A1M8 và bản đồ lưới 2D Occupancy Grid."""

    def __init__(self, port: Optional[str] = None, baudrate: int = 115200):
        self.port = port or find_rplidar_port()
        self.baudrate = baudrate
        self.ser: Optional[serial.Serial] = None
        self.is_connected = False
        self.is_running = False
        self.last_error = ""
        self.last_scan_time = 0.0
        self.last_scan_points = 0

        self.device_info = {
            "port": self.port,
            "model": "RPLiDAR A1M8",
            "firmware": "1.29",
            "hardware": "7",
            "serialnumber": "CP2102_A1M8",
            "health": "Good",
        }

        self._lock = threading.Lock()
        self._latest_scans: List[Dict[str, Any]] = []
        self._scan_thread: Optional[threading.Thread] = None

        # Occupancy Grid: 800x800 ô × 0.025m (2.5cm/pixel) => 20m × 20m
        self.grid_width = 800
        self.grid_height = 800
        self.resolution = 0.025
        self.origin_x = -10.0
        self.origin_y = -10.0
        self.grid_data = [-1] * (self.grid_width * self.grid_height)
        # Hit-counter: Xác nhận vật thể cố định ngay từ tia quét đầu tiên (không cần chờ tường)
        self.grid_hits = [0] * (self.grid_width * self.grid_height)
        self.wall_hit_confirm = 1
        self.wall_clear_hits = 8
        self.wall_hit_cap = 12
        self.occupied_count = 0
        self.known_cells: Dict[int, int] = {}
        self._ws_cycle = 0
        self._encoder_cpr = float(os.getenv("HCROBOT_ENCODER_CPR", "330.0"))
        self._wheel_radius = 0.033
        self._wheel_sep = float(os.getenv("HCROBOT_WHEEL_BASE", "0.22"))
        self._encoder_signs = {
            "m1": float(os.getenv("HCROBOT_ENCODER_M1_SIGN", "1")),
            "m2": float(os.getenv("HCROBOT_ENCODER_M2_SIGN", "1")),
            "m3": float(os.getenv("HCROBOT_ENCODER_M3_SIGN", "1")),
            "m4": float(os.getenv("HCROBOT_ENCODER_M4_SIGN", "1")),
        }
        self._prev_left_ticks: Optional[float] = None
        self._prev_right_ticks: Optional[float] = None

        # Hai che do tach biet:
        # - MAPPING: LaserScan duoc phep cap nhat occupancy grid.
        # - NAVIGATION: giu nguyen snapshot da luu; scan chi dung de dinh vi,
        #   tranh vat can va hien thi, tuyet doi khong ve de len ban do goc.
        self.map_mode = "MAPPING"
        self.is_map_locked = False
        self.static_grid_data: Optional[List[int]] = None
        self.active_map_name: Optional[str] = None

        # Trạng thái Robot
        self.robot_x = 0.0
        self.robot_y = 0.0
        self.robot_yaw = 0.0
        self.linear_velocity = 0.0
        self.angular_velocity = 0.0
        self.status = "IDLE"

        # Tự hành (Autonomous Navigation)
        self.active_goal: Optional[Dict[str, float]] = None
        self.nav_thread: Optional[threading.Thread] = None
        self.is_navigating = False

        # Frontier Exploration
        self.is_exploring = False
        self._explore_thread: Optional[threading.Thread] = None
        self.explored_frontiers: List[tuple] = []  # danh sách frontier đã thăm

        # Static Overlay Map (floor plan cứng)
        self._overlay_grid: List[int] = []          # grid vật cản cứng (100/0/-1)
        self._overlay_waypoints: List[Dict] = []    # POI có tên
        self._overlay_zones: List[Dict] = []        # Vùng đặc biệt (no-go, lobby...)
        self._overlay_active = False

        # Chế độ Layout Cứng Cố Định (3x5m) & Mở sương mù (Fog of War)
        self.fixed_layout_active = False
        self.fixed_wall_indices: set = set()
        self.room_bounds: Optional[Dict[str, float]] = None
        self.fog_of_war_mode = False

        # Workflow execution
        self.active_workflow: Optional[Dict] = None
        self._workflow_thread: Optional[threading.Thread] = None
        self.is_workflow_running = False
        self.workflow_step_index = 0
        self.workflow_progress: Dict[str, Any] = {}

        # Direct Motor Control via Raspberry Pi 5 L298N (GPIO 17, 27, 22, 23)
        self.pi_motor = None

        # Hệ thống An toàn Vật cản LiDAR (360-degree Continuous Distance Buffer & Fail-Safe)
        self.angle_distances: List[float] = [99.0] * 360
        self.angle_timestamps: List[float] = [0.0] * 360
        self.front_safety_distance = 0.35   # Ngưỡng phanh khẩn cấp phía trước: <= 35cm
        self.rear_safety_distance = 0.30    # Ngưỡng phanh khẩn cấp phía sau: <= 30cm
        self.current_motion_cmd = "stop"
        self._safety_thread: Optional[threading.Thread] = None
        self.last_safety_alert: str = ""
        # Hysteresis Lock cho thuật toán né vật cản an toàn (chống rung lắc trái-phải)
        self.avoidance_locked_dir: Optional[str] = None
        self.avoidance_steps: int = 0

    def init_direct_motor(self):
        """Khởi tạo MotorController trực tiếp nếu chưa có (dùng khi chạy standalone)."""
        if self.pi_motor is not None:
            return self.pi_motor
        try:
            from motor_controller import MotorController
            self.pi_motor = MotorController(
                left_forward_pin=17,
                left_backward_pin=27,
                right_forward_pin=22,
                right_backward_pin=23,
                invert_left_direction=False,
                invert_right_direction=True,
                default_speed=50,
            )
            logger.info("🚗 [LiDAR-SLAM] Đã khởi tạo MotorController trực tiếp trên Raspberry Pi 5 (GPIO 17, 27, 22, 23)!")
        except Exception as e:
            logger.warning(f"⚠️ [LiDAR-SLAM] Không khởi tạo được MotorController trực tiếp ({e}), sử dụng fallback UDP 9999")
        return self.pi_motor

    def reset_map(self):
        """Xóa trắng bản đồ 2D về trạng thái ban đầu và đưa vị trí robot về gốc."""
        with self._lock:
            self.grid_data = [-1] * (self.grid_width * self.grid_height)
            self.grid_hits = [0] * (self.grid_width * self.grid_height)
            self.occupied_count = 0
            self.known_cells = {}
            self._prev_left_ticks = None
            self._prev_right_ticks = None
            self.static_grid_data = None
            self.active_map_name = None
            self.map_mode = "MAPPING"
            self.is_map_locked = False
            self.fixed_layout_active = False
            self.fixed_wall_indices = set()
            self.room_bounds = None
            self.fog_of_war_mode = False
            self.robot_x = 0.0
            self.robot_y = 0.0
            self.robot_yaw = 0.0
            self.status = "IDLE"
            self.linear_velocity = 0.0
            self.angular_velocity = 0.0
            self.is_exploring = False
            self.explored_frontiers = []
        self.stop_navigation()
        logger.info("🧹 Đã làm sạch bản đồ 2D Occupancy Grid và đặt lại vị trí Robot về (0,0)")

    def save_map(self, name: str = "default_map") -> Dict[str, Any]:
        """Lưu bản đồ 2D Occupancy Grid ra file JSON (Web Admin) và chuẩn ROS 2 / Nav2 (.yaml + .pgm)."""
        safe_name = "".join(c for c in name if c.isalnum() or c in ("_", "-")).strip() or "map"
        json_path = os.path.join(MAPS_DIR, f"{safe_name}.json")
        yaml_path = os.path.join(MAPS_DIR, f"{safe_name}.yaml")
        pgm_path = os.path.join(MAPS_DIR, f"{safe_name}.pgm")

        with self._lock:
            grid_copy = list(self.grid_data)
            w = self.grid_width
            h = self.grid_height
            res = self.resolution
            ox = self.origin_x
            oy = self.origin_y
            pose = {"x": round(self.robot_x, 3), "y": round(self.robot_y, 3), "yaw": round(self.robot_yaw, 1)}

        occupied_count = sum(1 for v in grid_copy if v == 100)
        free_count = sum(1 for v in grid_copy if v == 0)
        unknown_count = sum(1 for v in grid_copy if v < 0)

        # Lưu bản đồ ngay khi có bất kỳ dữ liệu quét nào từ LiDAR (vật cản hoặc vùng trống, không bắt buộc tìm tường)
        if (occupied_count + free_count) < 1:
            raise ValueError("Từ chối lưu bản đồ rỗng vì chưa nhận được dữ liệu tia quét nào từ LiDAR.")

        # 1. Lưu file JSON cho Web Admin
        payload = {
            "name": safe_name,
            "created_at": time.strftime("%Y-%m-%d %H:%M:%S"),
            "width": w,
            "height": h,
            "resolution": res,
            "origin_x": ox,
            "origin_y": oy,
            "robot_pose": pose,
            "grid_data": grid_copy,
            "statistics": {
                "occupied_cells": occupied_count,
                "free_cells": free_count,
                "unknown_cells": unknown_count,
            },
        }
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2)

        # 2. Lưu file PGM (P5 binary) theo chuẩn ROS 2 Nav2 Map Server
        # ROS 2 coordinate: y=0 là hàng đáy (origin_y).
        # Ảnh PGM: hàng 0 là đỉnh trên cùng, nên cần duyệt y từ (h - 1) xuống 0.
        pgm_header = f"P5\n{w} {h}\n255\n".encode("ascii")
        pgm_data = bytearray(w * h)
        idx = 0
        for y in range(h - 1, -1, -1):
            row_offset = y * w
            for x in range(w):
                val = grid_copy[row_offset + x]
                if val == 100:       # Vật cản -> Màu đen (0)
                    pgm_data[idx] = 0
                elif val == 0:       # Vùng trống -> Màu trắng (254)
                    pgm_data[idx] = 254
                else:                # Chưa rõ (-1) -> Màu xám (205)
                    pgm_data[idx] = 205
                idx += 1

        with open(pgm_path, "wb") as f:
            f.write(pgm_header + pgm_data)

        # 3. Lưu file YAML metadata cho ROS 2 Nav2 map_server
        yaml_content = f"""image: {safe_name}.pgm
mode: trinary
resolution: {res}
origin: [{ox}, {oy}, 0.0]
negate: 0
occupied_thresh: 0.65
free_thresh: 0.25
"""
        with open(yaml_path, "w", encoding="utf-8") as f:
            f.write(yaml_content)

        # Luu xong la ket thuc mapping. Tu thoi diem nay grid_data la ban do
        # tinh; LaserScan van tiep tuc chay de tranh vat can nhung khong duoc
        # sua cac cell nua.
        with self._lock:
            self.static_grid_data = list(grid_copy)
            self.active_map_name = safe_name
            self.map_mode = "NAVIGATION"
            self.is_map_locked = True

        logger.info(f"💾 Đã lưu bản đồ '{safe_name}' thành công: JSON, YAML & PGM ({occupied_count} ô vật cản, {free_count} ô trống)")
        return {
            "name": safe_name,
            "json_path": json_path,
            "yaml_path": yaml_path,
            "pgm_path": pgm_path,
            "occupied_cells": occupied_count,
            "free_cells": free_count,
        }

    def load_map(self, name: str) -> bool:
        """Nạp bản đồ đã lưu từ file JSON vào bộ nhớ runtime."""
        safe_name = "".join(c for c in name if c.isalnum() or c in ("_", "-")).strip()
        json_path = os.path.join(MAPS_DIR, f"{safe_name}.json")
        if not os.path.exists(json_path):
            logger.warning(f"Không tìm thấy file bản đồ {json_path}")
            return False

        try:
            with open(json_path, "r", encoding="utf-8") as f:
                data = json.load(f)

            with self._lock:
                self.grid_width = data.get("width", 800)
                self.grid_height = data.get("height", 800)
                self.resolution = data.get("resolution", 0.025)
                self.origin_x = data.get("origin_x", -10.0)
                self.origin_y = data.get("origin_y", -10.0)
                self.grid_data = data.get("grid_data", [-1] * (self.grid_width * self.grid_height))
                self.grid_hits = [
                    self.wall_clear_hits if v == 100 else 0 for v in self.grid_data
                ]
                self._rebuild_known_cells()
                self.static_grid_data = list(self.grid_data)
                self.active_map_name = safe_name
                self.map_mode = "NAVIGATION"
                self.is_map_locked = True
                pose = data.get("robot_pose", {})
                self.robot_x = pose.get("x", 0.0)
                self.robot_y = pose.get("y", 0.0)
                self.robot_yaw = pose.get("yaw", 0.0)

            logger.info(f"📂 Đã nạp bản đồ '{safe_name}' vào SLAM core thành công!")
            return True
        except Exception as e:
            logger.error(f"Lỗi khi đọc file bản đồ {json_path}: {e}")
            return False

    def list_saved_maps(self) -> List[Dict[str, Any]]:
        """Lấy danh sách các bản đồ đã lưu."""
        maps = []
        if not os.path.exists(MAPS_DIR):
            return maps

        for fname in sorted(os.listdir(MAPS_DIR)):
            if fname.endswith(".json"):
                fpath = os.path.join(MAPS_DIR, fname)
                try:
                    with open(fpath, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    maps.append({
                        "name": data.get("name", fname.replace(".json", "")),
                        "created_at": data.get("created_at", ""),
                        "width": data.get("width", 200),
                        "height": data.get("height", 200),
                        "resolution": data.get("resolution", 0.025),
                        "statistics": data.get("statistics", {}),
                        "has_ros2_yaml": os.path.exists(os.path.join(MAPS_DIR, fname.replace(".json", ".yaml"))),
                    })
                except Exception:
                    pass
        return maps

    def delete_map(self, name: str) -> bool:
        """Xóa bản đồ đã lưu."""
        safe_name = "".join(c for c in name if c.isalnum() or c in ("_", "-")).strip()
        deleted = False
        for ext in (".json", ".yaml", ".pgm"):
            p = os.path.join(MAPS_DIR, f"{safe_name}{ext}")
            if os.path.exists(p):
                try:
                    os.remove(p)
                    deleted = True
                except Exception:
                    pass
        return deleted

    def _world_to_grid(self, x: float, y: float):
        gx = int((x - self.origin_x) / self.resolution)
        gy = int((y - self.origin_y) / self.resolution)
        return gx, gy

    def _rebuild_known_cells(self) -> None:
        known: Dict[int, int] = {}
        occupied = 0
        for idx, value in enumerate(self.grid_data):
            if value == -1:
                continue
            known[idx] = value
            if value == 100:
                occupied += 1
        self.known_cells = known
        self.occupied_count = occupied

    def _set_cell(self, idx: int, value: int) -> None:
        old = self.grid_data[idx]
        if old == value:
            return
        if old == 100:
            self.occupied_count = max(0, self.occupied_count - 1)
        if value == 100:
            self.occupied_count += 1
        self.grid_data[idx] = value
        if value == -1:
            self.known_cells.pop(idx, None)
        else:
            self.known_cells[idx] = value

    def _grid_sparse_payload(self) -> Dict[str, List[int]]:
        occ: List[int] = []
        free: List[int] = []
        for idx, value in self.known_cells.items():
            if value == 100:
                occ.append(idx)
            elif value == 0:
                free.append(idx)
        return {"occ": occ, "free": free}

    def _compute_scan_match_score(
        self,
        raw_batch: List[Dict],
        robot_x: float,
        robot_y: float,
        robot_yaw: float,
        grid_snapshot: List[int],
    ) -> float:
        """
        Tính điểm khớp (likelihood score) giữa scan và map hiện tại.
        raw_batch: list of {"angle": float, "distance": float}
        Trả về tỷ lệ [0..1] các điểm chuyển đổi từ raw khớp với ô vật cản (100) trên map.
        """
        if not raw_batch or not grid_snapshot:
            return 0.0

        hit = 0
        total = 0
        ox, oy = self.origin_x, self.origin_y
        res = self.resolution
        gw, gh = self.grid_width, self.grid_height

        for pt in raw_batch:
            dist = pt["distance"]
            if dist < 0.12 or dist > 8.0:
                continue
            heading = (pt["angle"] + robot_yaw) % 360.0
            rad = math.radians(heading)
            wx = robot_x + dist * math.cos(rad)
            wy = robot_y + dist * math.sin(rad)
            gx = int((wx - ox) / res)
            gy = int((wy - oy) / res)
            total += 1
            if 0 <= gx < gw and 0 <= gy < gh:
                idx = gy * gw + gx
                if grid_snapshot[idx] == 100:
                    hit += 2  # chính xác
                else:
                    # Kiểm tra 8 lân cận (kernel mềm)
                    for nx_, ny_ in (
                        (gx-1,gy),(gx+1,gy),(gx,gy-1),(gx,gy+1),
                        (gx-1,gy-1),(gx+1,gy-1),(gx-1,gy+1),(gx+1,gy+1),
                    ):
                        if 0 <= nx_ < gw and 0 <= ny_ < gh:
                            if grid_snapshot[ny_ * gw + nx_] == 100:
                                hit += 1
                                break

        return hit / max(total * 2, 1)

    def _is_turn_command(self) -> bool:
        cmd = (self.current_motion_cmd or "stop").split(":")[0]
        return cmd in (
            "left", "right", "a", "d",
            "forward_left", "forward_right", "backward_left", "backward_right",
            "wa", "wd", "sa", "sd",
        )

    def _is_straight_motion(self, delta_left: float = 0.0, delta_right: float = 0.0) -> bool:
        if self._is_turn_command():
            return False
        cmd = (self.current_motion_cmd or "stop").split(":")[0]
        if cmd in ("forward", "backward", "w", "s"):
            return True
        # Hai bên bánh cùng chiều (cùng tiến hoặc cùng lùi) thì không được cộng yaw.
        return (delta_left * delta_right) > 0.0

    def _encoder_side_ticks(self, encoders: Dict[str, Any]):
        m1 = encoders.get("m1", {}) or {}
        m2 = encoders.get("m2", {}) or {}
        m3 = encoders.get("m3", {}) or {}
        m4 = encoders.get("m4", {}) or {}
        left_ticks = (
            self._encoder_signs["m1"] * float(m1.get("ticks", 0))
            + self._encoder_signs["m2"] * float(m2.get("ticks", 0))
        ) / 2.0
        right_ticks = (
            self._encoder_signs["m3"] * float(m3.get("ticks", 0))
            + self._encoder_signs["m4"] * float(m4.get("ticks", 0))
        ) / 2.0
        return left_ticks, right_ticks

    def _apply_encoder_odometry(
        self,
        encoders: Dict[str, Any],
        dt: float,
        update_yaw: bool = True,
    ) -> None:
        """Cập nhật x/y từ encoder; khóa yaw khi đang đi thẳng/lùi."""
        if not isinstance(encoders, dict) or dt <= 0.0 or dt > 1.0:
            return
        try:
            left_ticks, right_ticks = self._encoder_side_ticks(encoders)
        except (TypeError, ValueError):
            return

        if self._prev_left_ticks is None or self._prev_right_ticks is None:
            self._prev_left_ticks = left_ticks
            self._prev_right_ticks = right_ticks
            return

        delta_left_ticks = left_ticks - self._prev_left_ticks
        delta_right_ticks = right_ticks - self._prev_right_ticks
        self._prev_left_ticks = left_ticks
        self._prev_right_ticks = right_ticks

        max_ticks = self._encoder_cpr * 2.0
        if abs(delta_left_ticks) > max_ticks or abs(delta_right_ticks) > max_ticks:
            return

        dist_per_tick = (2.0 * math.pi * self._wheel_radius) / self._encoder_cpr
        delta_left = delta_left_ticks * dist_per_tick
        delta_right = delta_right_ticks * dist_per_tick
        delta_s = (delta_left + delta_right) / 2.0
        allow_yaw = update_yaw and not self._is_straight_motion(delta_left, delta_right)
        delta_yaw_rad = (delta_right - delta_left) / self._wheel_sep if allow_yaw else 0.0

        yaw_rad = math.radians(self.robot_yaw)
        mid_yaw = yaw_rad + delta_yaw_rad / 2.0
        self.robot_x += delta_s * math.cos(mid_yaw)
        self.robot_y += delta_s * math.sin(mid_yaw)
        if allow_yaw:
            self.robot_yaw = (self.robot_yaw + math.degrees(delta_yaw_rad)) % 360.0

    def _match_scan_to_map(
        self,
        raw_batch: List[Dict],
        init_x: float,
        init_y: float,
        init_yaw: float,
        lock_yaw: bool = False,
    ):
        """
        Likelihood Field Scan Matching (ICP-lite).
        Tìm pose (x, y, yaw) tốt nhất trong vùng lân cận bằng grid search 2 bước.

        Khi đi thẳng/lùi (lock_yaw=True) chỉ dịch x/y, không được xoay góc.
        """
        with self._lock:
            occupied = self.occupied_count
            grid_snap = self.grid_data

        if occupied < 80 or not raw_batch:
            return init_x, init_y, init_yaw

        init_score = self._compute_scan_match_score(raw_batch, init_x, init_y, init_yaw, grid_snap)
        coarse_yaw_steps = (0.0,) if lock_yaw else (-5.0, -2.5, 0.0, 2.5, 5.0)
        fine_yaw_steps = (0.0,) if lock_yaw else (-1.0, -0.5, 0.0, 0.5, 1.0)

        # Bước 1: Coarse search
        best_x, best_y, best_yaw = init_x, init_y, init_yaw
        best_score = init_score
        for dx in (-0.20, -0.15, -0.10, -0.05, 0.0, 0.05, 0.10, 0.15, 0.20):
            for dy in (-0.20, -0.15, -0.10, -0.05, 0.0, 0.05, 0.10, 0.15, 0.20):
                for dyaw in coarse_yaw_steps:
                    s = self._compute_scan_match_score(
                        raw_batch,
                        init_x + dx, init_y + dy,
                        (init_yaw + dyaw) % 360.0,
                        grid_snap,
                    )
                    if s > best_score:
                        best_score = s
                        best_x, best_y = init_x + dx, init_y + dy
                        best_yaw = (init_yaw + dyaw) % 360.0

        # Bước 2: Fine search quanh kết quả coarse
        fine_x, fine_y, fine_yaw = best_x, best_y, best_yaw
        fine_score = best_score
        for dx in (-0.04, -0.03, -0.02, -0.01, 0.0, 0.01, 0.02, 0.03, 0.04):
            for dy in (-0.04, -0.03, -0.02, -0.01, 0.0, 0.01, 0.02, 0.03, 0.04):
                for dyaw in fine_yaw_steps:
                    s = self._compute_scan_match_score(
                        raw_batch,
                        best_x + dx, best_y + dy,
                        (best_yaw + dyaw) % 360.0,
                        grid_snap,
                    )
                    if s > fine_score:
                        fine_score = s
                        fine_x, fine_y = best_x + dx, best_y + dy
                        fine_yaw = (best_yaw + dyaw) % 360.0

        dist_moved = math.hypot(fine_x - init_x, fine_y - init_y)
        delta_yaw_abs = abs((fine_yaw - init_yaw + 180) % 360 - 180)
        max_yaw = 0.01 if lock_yaw else 3.0
        if fine_score > init_score * 1.08 and dist_moved < 0.25 and delta_yaw_abs < max_yaw:
            logger.debug(
                f"[ScanMatch] ✅ Score {init_score:.3f}→{fine_score:.3f} "
                f"Δx={fine_x-init_x:+.3f}m Δy={fine_y-init_y:+.3f}m Δyaw={fine_yaw-init_yaw:+.1f}°"
            )
            return fine_x, fine_y, fine_yaw

        return init_x, init_y, init_yaw

    def init_fixed_layout_3x5m(self, name: str = "phong_3x5m") -> Dict[str, Any]:
        """
        Khởi tạo layout phòng cứng 3m x 5m cố định chuẩn xác:
        - Chiều ngang (Trục X): 3.0m (từ -1.5m đến +1.5m)
        - Chiều dọc (Trục Y): 5.0m (từ -2.5m đến +2.5m)
        - 4 bức tường xung quanh cố định 100% (không bao giờ bị xóa đè)
        - Vùng xám bên ngoài giữ nguyên không đổi (-1)
        - Bên trong phòng hoạt động theo cơ chế Fog of War: robot đi đến đâu mở map đến đó
        """
        with self._lock:
            self.grid_data = [-1] * (self.grid_width * self.grid_height)
            self.grid_hits = [0] * (self.grid_width * self.grid_height)
            self.fixed_wall_indices = set()
            self.room_bounds = {"x_min": -1.5, "x_max": 1.5, "y_min": -2.5, "y_max": 2.5}
            self.fixed_layout_active = True
            self.fog_of_war_mode = True
            self.robot_x = 0.0
            self.robot_y = 0.0
            self.robot_yaw = 0.0
            self.status = "IDLE"
            self.map_mode = "MAPPING"
            self.is_map_locked = False

            min_gx, min_gy = self._world_to_grid(-1.5, -2.5)
            max_gx, max_gy = self._world_to_grid(1.5, 2.5)

            # Vẽ 4 bức tường xung quanh dày 2 ô
            for gx in range(min_gx, max_gx + 1):
                for dgy in (0, 1):
                    for gy in (min_gy + dgy, max_gy - dgy):
                        if 0 <= gx < self.grid_width and 0 <= gy < self.grid_height:
                            idx = gy * self.grid_width + gx
                            self.grid_data[idx] = 100
                            self.grid_hits[idx] = self.wall_hit_cap
                            self.fixed_wall_indices.add(idx)

            for gy in range(min_gy, max_gy + 1):
                for dgx in (0, 1):
                    for gx in (min_gx + dgx, max_gx - dgx):
                        if 0 <= gx < self.grid_width and 0 <= gy < self.grid_height:
                            idx = gy * self.grid_width + gx
                            self.grid_data[idx] = 100
                            self.grid_hits[idx] = self.wall_hit_cap
                            self.fixed_wall_indices.add(idx)

            # Mở sàn trống ban đầu quanh tâm robot (0, 0) bán kính 0.5m
            cgx, cgy = self._world_to_grid(0.0, 0.0)
            for dy in range(-20, 21):
                for dx in range(-20, 21):
                    if dx * dx + dy * dy <= 400:
                        gx = cgx + dx
                        gy = cgy + dy
                        if 0 <= gx < self.grid_width and 0 <= gy < self.grid_height:
                            idx = gy * self.grid_width + gx
                            if idx not in self.fixed_wall_indices:
                                self.grid_data[idx] = 0

            self._rebuild_known_cells()

        logger.info(f"🏢 Đã khởi tạo Layout Cứng 3m x 5m thành công ({len(self.fixed_wall_indices)} ô tường cứng)!")
        res = self.save_map(name)
        with self._lock:
            self.map_mode = "MAPPING"
            self.is_map_locked = False
        return res

    def _update_grid_from_scan(self, rx: float, ry: float, scan_points: List[Dict[str, Any]]):
        """
        Thuật toán Raytracing có cơ chế tự làm sạch và hỗ trợ Layout Cứng 3x5m:
        - Nếu ở chế độ Fixed Layout 3x5m:
          1. 4 bức tường xung quanh được bảo vệ vĩnh viễn, không bao giờ bị xóa đè.
          2. Vùng xám bên ngoài không bao giờ bị mở rộng ra ngoài phạm vi 3x5m.
          3. Robot đi đến đâu mở map đến đó (mở sàn trống quanh robot và trong tầm nhìn gần).
        - Nếu ở chế độ tự do: Raytracing Bresenham tự động cập nhật như bình thường.
        """
        if self.is_map_locked or self.map_mode != "MAPPING":
            return

        gx_robot, gy_robot = self._world_to_grid(rx, ry)

        # ── Chế độ Fog of War / Fixed Layout 3x5m ──────────────────────
        if getattr(self, "fixed_layout_active", False):
            bounds = getattr(self, "room_bounds", None) or {"x_min": -1.5, "x_max": 1.5, "y_min": -2.5, "y_max": 2.5}
            fixed_walls = getattr(self, "fixed_wall_indices", set())

            # 1. Đi đến đâu mở map đến đó: Mở sáng footprint / vết di chuyển quanh robot (bán kính 0.45m)
            trail_radius = 0.45
            clear_cells = int(trail_radius / self.resolution)
            for dy in range(-clear_cells, clear_cells + 1):
                for dx in range(-clear_cells, clear_cells + 1):
                    if dx * dx + dy * dy <= clear_cells * clear_cells:
                        cgx = gx_robot + dx
                        cgy = gy_robot + dy
                        if 0 <= cgx < self.grid_width and 0 <= cgy < self.grid_height:
                            cidx = cgy * self.grid_width + cgx
                            if cidx not in fixed_walls:
                                cwx = self.origin_x + cgx * self.resolution
                                cwy = self.origin_y + cgy * self.resolution
                                if bounds["x_min"] + 0.05 <= cwx <= bounds["x_max"] - 0.05 and bounds["y_min"] + 0.05 <= cwy <= bounds["y_max"] - 0.05:
                                    self._set_cell(cidx, 0)

            # 2. Xử lý tia quét LiDAR bên trong khung phòng
            for pt in scan_points:
                ox, oy = self._world_to_grid(pt["x"], pt["y"])
                dx = abs(ox - gx_robot)
                dy = abs(oy - gy_robot)
                sx = 1 if gx_robot < ox else -1
                sy = 1 if gy_robot < oy else -1
                err = dx - dy
                curr_x, curr_y = gx_robot, gy_robot
                max_steps = 300
                step = 0

                while step < max_steps:
                    step += 1
                    if 0 <= curr_x < self.grid_width and 0 <= curr_y < self.grid_height:
                        idx = curr_y * self.grid_width + curr_x
                        cwx = self.origin_x + curr_x * self.resolution
                        cwy = self.origin_y + curr_y * self.resolution

                        # Nếu chạm biên ngoài 3x5m -> dừng tia ngay lập tức (không vẽ ra ngoài)
                        if cwx < bounds["x_min"] - 0.05 or cwx > bounds["x_max"] + 0.05 or cwy < bounds["y_min"] - 0.05 or cwy > bounds["y_max"] + 0.05:
                            break

                        # Nếu chạm tường cứng của layout -> dừng tia ngay lập tức, KHÔNG XÓA TƯỜNG CỨNG
                        if idx in fixed_walls:
                            break

                        if curr_x == ox and curr_y == oy:
                            # Vật cản bên trong phòng (ví dụ đồ vật, người)
                            if bounds["x_min"] + 0.08 <= cwx <= bounds["x_max"] - 0.08 and bounds["y_min"] + 0.08 <= cwy <= bounds["y_max"] - 0.08:
                                hits = min(self.grid_hits[idx] + 1, self.wall_hit_cap)
                                self.grid_hits[idx] = hits
                                if hits >= self.wall_hit_confirm:
                                    self._set_cell(idx, 100)
                            break
                        else:
                            # Tia quét đi qua bên trong phòng -> mở thành màu trắng (0)
                            if bounds["x_min"] + 0.05 <= cwx <= bounds["x_max"] - 0.05 and bounds["y_min"] + 0.05 <= cwy <= bounds["y_max"] - 0.05:
                                if self.grid_data[idx] == 100 and idx not in fixed_walls:
                                    self.grid_hits[idx] = max(self.grid_hits[idx] - 1, 0)
                                    if self.grid_hits[idx] <= 0:
                                        self._set_cell(idx, 0)
                                elif self.grid_data[idx] != 100:
                                    self.grid_hits[idx] = 0
                                    self._set_cell(idx, 0)

                    if curr_x == ox and curr_y == oy:
                        break

                    e2 = 2 * err
                    if e2 > -dy:
                        err -= dy
                        curr_x += sx
                    if e2 < dx:
                        err += dx
                        curr_y += sy
            return

        # ── Chế độ Mapping tự do thông thường ─────────────────────────
        for pt in scan_points:
            ox, oy = self._world_to_grid(pt["x"], pt["y"])

            dx = abs(ox - gx_robot)
            dy = abs(oy - gy_robot)
            sx = 1 if gx_robot < ox else -1
            sy = 1 if gy_robot < oy else -1
            err = dx - dy

            curr_x, curr_y = gx_robot, gy_robot
            max_steps = 600
            step = 0

            while step < max_steps:
                step += 1
                if 0 <= curr_x < self.grid_width and 0 <= curr_y < self.grid_height:
                    idx = curr_y * self.grid_width + curr_x
                    if curr_x == ox and curr_y == oy:
                        hits = min(self.grid_hits[idx] + 2, self.wall_hit_cap)
                        self.grid_hits[idx] = max(hits, 2)
                        self._set_cell(idx, 100)
                        break
                    else:
                        # Tia xuyên qua: ô tường đã xác nhận cần nhiều miss mới bị xóa.
                        if self.grid_data[idx] == 100:
                            self.grid_hits[idx] = max(self.grid_hits[idx] - 1, 0)
                            if self.grid_hits[idx] <= 0:
                                self._set_cell(idx, 0)
                        else:
                            self.grid_hits[idx] = 0
                            self._set_cell(idx, 0)

                if curr_x == ox and curr_y == oy:
                    break

                e2 = 2 * err
                if e2 > -dy:
                    err -= dy
                    curr_x += sx
                if e2 < dx:
                    err += dx
                    curr_y += sy

    def connect(self, force: bool = False) -> bool:
        """Mở cổng Serial và bắt tay với RPLiDAR A1M8 có cơ chế auto-reset khi đơ/treo."""
        if not force and self.is_connected and self.ser and self.ser.is_open:
            return True

        self.stop()
        self.port = find_rplidar_port()

        try:
            logger.info(f"🔌 Mở cổng Serial {self.port} tốc độ {self.baudrate} baud...")
            self.ser = serial.Serial(self.port, self.baudrate, timeout=0.08)
            # Khởi động motor bằng chân DTR (DTR = False cấp nguồn quay motor trên RPLiDAR A1)
            self.ser.dtr = False
            self.ser.rts = False
            time.sleep(0.15)

            # STOP chuỗi quét cũ
            self.ser.write(b"\xa5\x25")
            time.sleep(0.08)
            self.ser.reset_input_buffer()
            self.ser.reset_output_buffer()

            # Thử GET_HEALTH (0xA5 0x52)
            self.ser.write(b"\xa5\x52")
            time.sleep(0.08)
            desc_health = self.ser.read(7)

            # Nếu cảm biến bị đơ hoặc lỗi sau rung lắc/sụt áp, gửi lệnh RESET (0xA5 0x40)
            if len(desc_health) < 7 or desc_health[:2] != b"\xa5\x5a":
                logger.warning(f"⚠️ Cảm biến {self.port} không phản hồi GET_HEALTH. Gửi mã RESET phần cứng (0xA5 0x40)...")
                self.ser.write(b"\xa5\x40")
                time.sleep(1.2)  # RPLiDAR A1 reboot mất ~1.0 - 1.2s
                self.ser.reset_input_buffer()
                self.ser.reset_output_buffer()
                self.ser.dtr = False
                time.sleep(0.1)
                self.ser.write(b"\xa5\x25")
                time.sleep(0.08)
                self.ser.reset_input_buffer()
                self.ser.write(b"\xa5\x52")
                time.sleep(0.08)
                desc_health = self.ser.read(7)

            if len(desc_health) != 7 or desc_health[:2] != b"\xa5\x5a":
                raw_hex = desc_health.hex().upper() or "EMPTY"
                raise RuntimeError(
                    "RPLiDAR không phản hồi lệnh GET_HEALTH "
                    f"(descriptor={raw_hex}). Kiểm tra cáp 4-pin/nguồn motor LiDAR."
                )

            if len(desc_health) == 7 and desc_health[:2] == b"\xa5\x5a":
                health_data = self.ser.read(3)
                if len(health_data) >= 3:
                    h_status = health_data[0]
                    self.device_info["health"] = "Good" if h_status == 0 else f"Warning({h_status})"
                    logger.info(f"🩺 RPLiDAR Health Status: {self.device_info['health']}")

            # GET_INFO (0xA5 0x50)
            self.ser.write(b"\xa5\x50")
            time.sleep(0.08)
            desc_info = self.ser.read(7)
            if len(desc_info) == 7 and desc_info[:2] == b"\xa5\x5a":
                info = self.ser.read(20)
                if len(info) >= 20:
                    self.device_info["model"] = f"RPLiDAR A1M8 (Model {info[0]})"
                    self.device_info["firmware"] = f"{info[2]}.{info[1]}"
                    self.device_info["hardware"] = f"{info[3]}"
                    self.device_info["serialnumber"] = info[4:].hex().upper()

            self.is_connected = True
            self.last_error = ""
            logger.info(f"✅ Đã kết nối RPLiDAR A1M8 trên {self.port}! Model: {self.device_info['model']}, Firmware: {self.device_info['firmware']}")
            return True

        except Exception as e:
            self.is_connected = False
            self.last_error = str(e)
            self.device_info["health"] = "Error: no sensor response"
            logger.error(f"❌ Lỗi kết nối {self.port}: {e}")
            return False

    def start_scanning(self):
        """Bật Thread thu thập tia quét thời gian thực."""
        if self.is_running and self._scan_thread and self._scan_thread.is_alive():
            return
        if not self.is_connected and not self.connect():
            return

        self.is_running = True
        self.last_error = ""
        self.last_scan_time = 0.0
        self.last_scan_points = 0
        with self._lock:
            self._latest_scans = []
        self._scan_thread = threading.Thread(target=self._scan_loop, daemon=True)
        self._scan_thread.start()
        if not self._safety_thread or not self._safety_thread.is_alive():
            self._safety_thread = threading.Thread(target=self._safety_watchdog_loop, daemon=True)
            self._safety_thread.start()
        logger.info("🚀 Luồng quét LiDAR SLAM & Safety Watchdog đã sẵn sàng")

    def stop(self):
        self.is_running = False
        if self.ser and self.ser.is_open:
            try:
                self.ser.write(b"\xa5\x25")
                self.ser.close()
            except Exception:
                pass
        self.ser = None
        self.is_connected = False

    def _scan_loop(self):
        """Vòng lặp bóc tách 5-byte packet chuẩn RPLiDAR có watchdog tự phục hồi."""
        try:
            if not self.ser or not self.ser.is_open:
                return

            self.ser.write(b"\xa5\x20")
            time.sleep(0.08)
            self.ser.read(7)  # Bỏ qua descriptor 7-byte

            buf = bytearray()
            current_scan_batch = []
            last_packet_time = time.time()
            last_imu_update_time = time.time()  # Thời điểm cập nhật IMU cuối
            stall_retries = 0

            while self.is_running and self.ser and self.ser.is_open:
                chunk = self.ser.read(512)
                now = time.time()

                # ── Encoder + IMU odometry ────────────────────────────────────
                # Encoder cập nhật x/y. Yaw chỉ đổi khi đang quay; đi thẳng thì khóa góc.
                if self.map_mode == "MAPPING":
                    esp_reader = getattr(self, "esp32_reader", None)
                    snap = None
                    if esp_reader and hasattr(esp_reader, "latest"):
                        snap = esp_reader.latest()
                    dt = now - last_imu_update_time
                    if snap is not None and 0.0 < dt < 0.5:
                        with self._lock:
                            has_imu = bool(
                                snap.mpu_available and snap.yaw_rate_dps is not None
                            )
                            if getattr(snap, "encoders", None):
                                self._apply_encoder_odometry(
                                    snap.encoders, dt, update_yaw=self._is_turn_command()
                                )
                            if (
                                self._is_turn_command()
                                and has_imu
                                and abs(snap.yaw_rate_dps) > 2.0
                            ):
                                self.robot_yaw = (self.robot_yaw + snap.yaw_rate_dps * dt) % 360.0
                last_imu_update_time = now
                # ─────────────────────────────────────────────────────────────

                if not chunk:
                    # WATCHDOG: Nếu không có dữ liệu > 2.0s (do sụt áp động cơ, brownout hoặc sensor đơ)
                    if now - last_packet_time > 2.0:
                        stall_retries += 1
                        self.last_error = (
                            f"RPLiDAR không phát dữ liệu scan trong {now - last_packet_time:.1f}s "
                            f"(watchdog {stall_retries}/3)"
                        )
                        logger.warning(
                            f"⚠️ [LiDAR Watchdog] Mất luồng dữ liệu {now - last_packet_time:.1f}s "
                            f"(lần {stall_retries}/3). Kích hoạt soft-reset STOP & SCAN..."
                        )
                        try:
                            self.ser.write(b"\xa5\x25")
                            time.sleep(0.06)
                            self.ser.reset_input_buffer()
                            self.ser.reset_output_buffer()
                            self.ser.dtr = False
                            time.sleep(0.04)
                            self.ser.write(b"\xa5\x20")
                            time.sleep(0.06)
                            self.ser.read(7)
                            buf.clear()
                            last_packet_time = time.time()
                        except Exception as ex:
                            logger.error(f"Lỗi soft-reset LiDAR: {ex}")

                        if stall_retries >= 3:
                            logger.error("🚨 [LiDAR Watchdog] Tín hiệu gián đoạn quá 6s, thực hiện tái kết nối Serial toàn phần...")
                            # connect(force=True) calls stop(), therefore preserve the
                            # requested running state or this scan thread exits while
                            # the API misleadingly still reports a successful connect.
                            should_keep_running = self.is_running
                            reconnected = self.connect(force=True)
                            self.is_running = bool(should_keep_running and reconnected)
                            stall_retries = 0
                            last_packet_time = time.time()
                            if self.ser and self.ser.is_open:
                                self.ser.write(b"\xa5\x20")
                                time.sleep(0.06)
                                self.ser.read(7)

                    time.sleep(0.005)
                    continue

                buf.extend(chunk)

                while len(buf) >= 5:
                    b0 = buf[0]
                    b1 = buf[1]
                    s = b0 & 0x01
                    not_s = (b0 >> 1) & 0x01

                    # Kiểm tra tính toàn vẹn gói tin
                    if s == not_s or not (b1 & 0x01):
                        buf.pop(0)
                        continue

                    packet = buf[:5]
                    del buf[:5]

                    # Nhận được packet hợp lệ: reset watchdog
                    last_packet_time = time.time()
                    stall_retries = 0

                    is_new_scan = (s == 1)
                    quality = packet[0] >> 2
                    angle_q6 = (packet[1] >> 1) | (packet[2] << 7)
                    raw_angle = angle_q6 / 64.0
                    # 1. Bù góc lắp đặt (mặc định 180° do dây cáp RPLiDAR quay về phía sau xe)
                    cw_angle = (raw_angle + float(os.environ.get("HCROBOT_LIDAR_OFFSET", "180.0"))) % 360.0

                    # 2. Đổi chiều quay từ chuẩn RPLiDAR Clockwise (CW) → CCW hình học / ROS:
                    # 0°: Tiến (+X), 90°: Trái (+Y), 180°: Lùi (-X), 270°: Phải (-Y)
                    ccw_angle = (360.0 - cw_angle) % 360.0
                    distance_q2 = packet[3] | (packet[4] << 8)
                    dist_m = (distance_q2 / 4.0) / 1000.0

                    # 3. Lọc tia khoảng cách hợp lệ (12cm → 12m)
                    if 0.12 <= dist_m <= 12.0:
                        # Cập nhật buffer khoảng cách 360° (dùng cho safety watchdog)
                        deg = int(round(ccw_angle)) % 360
                        now_ts = time.time()
                        self.angle_distances[deg] = dist_m
                        self.angle_timestamps[deg] = now_ts

                        # Tính tọa độ world theo pose hiện tại (sẽ được recompute sau scan matching)
                        heading = (ccw_angle + self.robot_yaw) % 360.0
                        rad = math.radians(heading)
                        x = self.robot_x + dist_m * math.cos(rad)
                        y = self.robot_y + dist_m * math.sin(rad)

                        current_scan_batch.append({
                            "angle": round(ccw_angle, 1),
                            "distance": round(dist_m, 2),
                            "x": round(x, 2),
                            "y": round(y, 2),
                            "quality": quality,
                        })

                    # 4. Xử lý khi hoàn thành nguyên 1 vòng quét 360°
                    if (is_new_scan and len(current_scan_batch) >= 60) or len(current_scan_batch) >= 720:
                        # ── Scan Matching: sửa pose trước khi vẽ map ──────────────────
                        # Chỉ match khi MAPPING để không làm sai vị trí khi navigation
                        raw_batch = [
                            {"angle": p["angle"], "distance": p["distance"]}
                            for p in current_scan_batch
                        ]
                        if self.map_mode == "MAPPING":
                            corrected_x, corrected_y, corrected_yaw = self._match_scan_to_map(
                                raw_batch,
                                self.robot_x,
                                self.robot_y,
                                self.robot_yaw,
                                lock_yaw=not self._is_turn_command(),
                            )
                        else:
                            corrected_x = self.robot_x
                            corrected_y = self.robot_y
                            corrected_yaw = self.robot_yaw

                        # Tính lại toạ độ scan points với pose đã sửa bởi scan matching
                        corrected_batch = []
                        for p in current_scan_batch:
                            h2 = (p["angle"] + corrected_yaw) % 360.0
                            r2 = math.radians(h2)
                            corrected_batch.append({
                                "angle": p["angle"],
                                "distance": p["distance"],
                                "x": round(corrected_x + p["distance"] * math.cos(r2), 2),
                                "y": round(corrected_y + p["distance"] * math.sin(r2), 2),
                                "quality": p["quality"],
                            })
                        # ────────────────────────────────────────────────────────────

                        with self._lock:
                            if self.map_mode == "MAPPING":
                                self.robot_x = corrected_x
                                self.robot_y = corrected_y
                                self.robot_yaw = corrected_yaw
                            self._latest_scans = corrected_batch
                            self.last_scan_time = time.time()
                            self.last_scan_points = len(self._latest_scans)
                            self.last_error = ""
                            self._update_grid_from_scan(corrected_x, corrected_y, corrected_batch)
                        current_scan_batch.clear()



        except Exception as e:
            logger.error(f"Lỗi scan loop: {e}")
            self.last_error = f"Lỗi scan loop: {e}"
            self.is_connected = False
            self.is_running = False

    def get_obstacle_distance(self, angle_min: int, angle_max: int, max_age: float = 0.8) -> float:
        """
        Tìm khoảng cách vật cản gần nhất trong cung góc [angle_min, angle_max] (hỗ trợ qua mốc 0°).
        Chỉ tính các tia quét tươi trong vòng max_age giây.
        """
        now = time.time()
        min_d = 99.0
        if angle_min <= angle_max:
            deg_range = range(angle_min, angle_max + 1)
        else:
            deg_range = list(range(angle_min, 360)) + list(range(0, angle_max + 1))

        for deg in deg_range:
            if now - self.angle_timestamps[deg] <= max_age:
                d = self.angle_distances[deg]
                if 0.10 <= d < min_d:
                    min_d = d
        return min_d

    def get_front_distance(self) -> float:
        """Khoảng cách vật cản phía trước mặt (góc mở ±45°: từ 315° qua 0° tới 45°)."""
        return self.get_obstacle_distance(315, 45)

    def get_rear_distance(self) -> float:
        """Khoảng cách vật cản phía sau xe (góc mở ±45°: từ 135° tới 225°)."""
        return self.get_obstacle_distance(135, 225)

    def get_left_distance(self) -> float:
        """Khoảng cách vật cản bên trái xe (45° tới 135°)."""
        return self.get_obstacle_distance(45, 135)

    def get_right_distance(self) -> float:
        """Khoảng cách vật cản bên phải xe (225° tới 315°)."""
        return self.get_obstacle_distance(225, 315)

    def _safety_watchdog_loop(self):
        """Thread giám sát an toàn phần cứng (25Hz): Tự động ngắt motor nếu có vật cản gần."""
        while self.is_running:
            try:
                cmd = self.current_motion_cmd
                if cmd in ("forward", "w", "forward_left", "forward_right", "wa", "wd"):
                    front_d = self.get_front_distance()
                    if front_d < self.front_safety_distance:
                        logger.warning(
                            f"🚨 [WATCHDOG PHANH KHẨN CẤP] Vật cản trước mặt cách {front_d*100:.1f}cm "
                            f"(< {self.front_safety_distance*100:.0f}cm)! DỪNG MOTOR NGAY!"
                        )
                        if self.pi_motor is not None:
                            self.pi_motor.stop()
                        self.current_motion_cmd = "stop"
                        self.status = "OBSTACLE_STOP"
                        self.last_safety_alert = f"🚨 PHANH KHẨN CẤP: Vật cản trước mặt {front_d*100:.1f}cm (< 35cm)!"

                elif cmd in ("backward", "s", "backward_left", "backward_right", "sa", "sd"):
                    rear_d = self.get_rear_distance()
                    if rear_d < self.rear_safety_distance:
                        logger.warning(
                            f"🚨 [WATCHDOG PHANH KHẨN CẤP] Vật cản sau xe cách {rear_d*100:.1f}cm "
                            f"(< {self.rear_safety_distance*100:.0f}cm)! DỪNG MOTOR NGAY!"
                        )
                        if self.pi_motor is not None:
                            self.pi_motor.stop()
                        self.current_motion_cmd = "stop"
                        self.status = "OBSTACLE_STOP"
                        self.last_safety_alert = f"🚨 PHANH KHẨN CẤP: Vật cản sau xe {rear_d*100:.1f}cm (< 30cm)!"
                else:
                    self.last_safety_alert = ""
                    if self.status == "OBSTACLE_STOP":
                        self.status = "IDLE"
            except Exception as e:
                logger.error(f"Lỗi safety watchdog: {e}")
            time.sleep(0.04)

    def get_latest_scans(self) -> List[Dict[str, Any]]:
        with self._lock:
            return list(self._latest_scans)

    def get_grid_map(self) -> Dict[str, Any]:
        with self._lock:
            # Khi đang ở NAVIGATION mode (map đã lock/lưu), trả về static_grid_data
            # để frontend luôn thấy toàn bộ layout cố định thay vì chỉ vùng LiDAR vừa quét.
            display_grid = (
                list(self.static_grid_data)
                if self.is_map_locked and self.static_grid_data
                else list(self.grid_data)
            )
            return {
                "width": self.grid_width,
                "height": self.grid_height,
                "resolution": self.resolution,
                "origin_x": self.origin_x,
                "origin_y": self.origin_y,
                "grid_data": display_grid,
            }

    def send_udp_motor_command(self, cmd: str, force: bool = False):
        """
        Điều khiển động cơ kèm cơ chế bảo vệ an toàn vật cản (Fail-Safe Interlock):
        1. Kiểm tra an toàn hướng di chuyển trước khi cấp lệnh cho motor.
        2. Trực tiếp qua MotorController (L298N GPIO) nếu đang chạy trên Pi 5.
        3. Đồng thời gửi UDP tới 127.0.0.1:9999 nếu main.py đang chạy để đồng bộ.
        """
        cmd_clean = cmd.strip().lower()

        # PRE-FLIGHT SAFETY INTERLOCK
        if not force and cmd_clean in ("forward", "w", "forward_left", "forward_right", "wa", "wd"):
            front_d = self.get_front_distance()
            if front_d < self.front_safety_distance:
                logger.warning(
                    f"🛑 [SAFETY INTERLOCK] Khóa tiến! Phía trước có vật cản cách {front_d*100:.1f}cm "
                    f"(< {self.front_safety_distance*100:.0f}cm)"
                )
                if self.pi_motor is not None:
                    self.pi_motor.stop()
                self.current_motion_cmd = "stop"
                self.status = "OBSTACLE_STOP"
                return

        if not force and cmd_clean in ("backward", "s", "backward_left", "backward_right", "sa", "sd"):
            rear_d = self.get_rear_distance()
            if rear_d < self.rear_safety_distance:
                logger.warning(
                    f"🛑 [SAFETY INTERLOCK] Khóa lùi! Phía sau có vật cản cách {rear_d*100:.1f}cm "
                    f"(< {self.rear_safety_distance*100:.0f}cm)"
                )
                if self.pi_motor is not None:
                    self.pi_motor.stop()
                self.current_motion_cmd = "stop"
                self.status = "OBSTACLE_STOP"
                return

        if cmd_clean.startswith("speed:"):
            try:
                spd = int(cmd_clean.split(":", 1)[1])
            except ValueError:
                return
            spd = max(20, min(100, spd))
            if self.pi_motor is not None:
                try:
                    self.pi_motor.set_speed(spd)
                except Exception as e:
                    logger.warning(f"Lỗi set_speed motor: {e}")
            try:
                sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                sock.settimeout(0.02)
                sock.sendto(f"speed:{spd}".encode("utf-8"), ("127.0.0.1", 9999))
                sock.close()
            except Exception:
                pass
            return

        self.current_motion_cmd = cmd_clean

        # 1. Direct hardware execution
        if self.pi_motor is not None:
            try:
                if cmd_clean in ("forward", "w"):
                    self.pi_motor.move_forward()
                elif cmd_clean in ("backward", "s"):
                    self.pi_motor.move_backward()
                elif cmd_clean in ("left", "a"):
                    self.pi_motor.turn_left()
                elif cmd_clean in ("right", "d"):
                    self.pi_motor.turn_right()
                elif cmd_clean in ("forward_left", "wa", "aw"):
                    self.pi_motor.turn_forward_left()
                elif cmd_clean in ("forward_right", "wd", "dw"):
                    self.pi_motor.turn_forward_right()
                elif cmd_clean in ("backward_left", "sa", "as"):
                    self.pi_motor.turn_backward_left()
                elif cmd_clean in ("backward_right", "sd", "ds"):
                    self.pi_motor.turn_backward_right()
                elif cmd_clean in ("stop", "x", ""):
                    self.pi_motor.stop()
            except Exception as e:
                logger.warning(f"Lỗi motor phần cứng trực tiếp: {e}")

        # 2. UDP Local Sync tới 127.0.0.1:9999 (main.py)
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            sock.settimeout(0.02)
            sock.sendto(cmd.encode("utf-8"), ("127.0.0.1", 9999))
            sock.close()
        except Exception:
            pass

        # 3. UDP Sync sang Laptop WSL (100.92.82.61:9998) để RViz2 & SLAM Toolbox cập nhật odometry mượt mà
        try:
            wsl_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            wsl_sock.settimeout(0.02)
            wsl_sock.sendto(cmd_clean.encode("utf-8"), ("100.92.82.61", 9998))
            wsl_sock.close()
        except Exception:
            pass

    def navigate_to(self, target_x: float, target_y: float):
        """Bắt đầu tác vụ tự hành tới tọa độ mục tiêu (target_x, target_y)."""
        self.stop_navigation()
        self.active_goal = {"x": target_x, "y": target_y}
        self.is_navigating = True
        self.status = "NAVIGATING"
        self.nav_thread = threading.Thread(target=self._navigation_loop, daemon=True)
        self.nav_thread.start()
        logger.info(f"🎯 BẮT ĐẦU TỰ HÀNH: Đích đến X={target_x:.2f}m, Y={target_y:.2f}m")

    def stop_navigation(self):
        """Dừng tác vụ tự hành ngay lập tức."""
        self.is_navigating = False
        self.active_goal = None
        self.status = "IDLE"
        self.linear_velocity = 0.0
        self.angular_velocity = 0.0
        self.send_udp_motor_command("stop")

    def _navigation_loop(self):
        """
        Vòng lặp điều khiển Tự hành (Autonomous Navigation Loop):
        1. Tính vector hướng đến mục tiêu (dx, dy).
        2. Dùng LiDAR quét góc trước mặt (-30° đến +30°): nếu gặp vật cản < 0.45m => phanh / rẽ tránh.
        3. Tự động quay mũi về mục tiêu và tiến tới đích.
        4. Dừng khi cự ly < 0.15m (Goal Reached).
        """
        rate_hz = 10
        dt = 1.0 / rate_hz

        while self.is_navigating and self.active_goal:
            gx = self.active_goal["x"]
            gy = self.active_goal["y"]

            dx = gx - self.robot_x
            dy = gy - self.robot_y
            dist_to_goal = math.hypot(dx, dy)

            # 1. Đã đến đích (Goal Reached)
            if dist_to_goal < 0.22:
                logger.info(f"🏁 ĐÃ ĐẾN ĐÍCH X={gx:.2f}m, Y={gy:.2f}m!")
                self.send_udp_motor_command("stop")
                self.status = "GOAL_REACHED"
                self.is_navigating = False
                self.active_goal = None
                self.avoidance_locked_dir = None
                break

            # 2. Xử lý né vật cản an toàn: Lùi nhẹ nếu quá gần + Xoay dứt khoát (triệt tiêu rung giật 80ms)
            front_obstacle_dist = self.get_front_distance()
            if front_obstacle_dist < 0.40:
                logger.warning(f"⚠️ Phát hiện vật cản trước mặt ({front_obstacle_dist:.2f}m)! Đang rẽ tránh an toàn...")
                self.send_udp_motor_command("stop", force=True)

                # Nếu khoảng cách quá sát (< 30cm): Lùi nhẹ 0.25s để tạo khoảng hở an toàn quay đầu
                if front_obstacle_dist < 0.30:
                    rear_dist = self.get_rear_distance()
                    if rear_dist > 0.35:
                        self.send_udp_motor_command("speed:35")
                        self.send_udp_motor_command("backward", force=True)
                        time.sleep(0.25)
                        self.send_udp_motor_command("stop", force=True)
                        time.sleep(0.08)

                if not self.avoidance_locked_dir:
                    left_dist = self.get_left_distance()
                    right_dist = self.get_right_distance()
                    self.avoidance_locked_dir = "left" if left_dist >= right_dist else "right"

                turn_cmd = self.avoidance_locked_dir
                # Xoay dứt khoát 0.35s ở công suất 38% để robot thực sự xoay được góc ~30-35 độ
                yaw_step = 30.0 if turn_cmd == "left" else -30.0
                self.send_udp_motor_command("speed:38")
                self.send_udp_motor_command(turn_cmd, force=True)
                time.sleep(0.35)
                self.send_udp_motor_command("stop", force=True)
                self.robot_yaw = (self.robot_yaw + yaw_step) % 360.0
                time.sleep(0.10)
                continue
            else:
                if front_obstacle_dist > 0.50:
                    self.avoidance_locked_dir = None

            # 3. Approach Lock (Khóa góc khi cự ly gần < 40cm để triệt tiêu Waypoint Hunting / xoay lắc tại đích)
            if dist_to_goal < 0.40:
                self.send_udp_motor_command("speed:30")
                self.send_udp_motor_command("forward")
                speed_mps = 0.14
                rad = math.radians(self.robot_yaw)
                self.robot_x += speed_mps * dt * math.cos(rad)
                self.robot_y += speed_mps * dt * math.sin(rad)
                self.linear_velocity = speed_mps
                self.angular_velocity = 0.0
                time.sleep(dt)
                continue

            # 4. Tính góc mục tiêu theo chuẩn Cartesian (+X Tiến, +Y Trái, CCW)
            desired_yaw = (math.degrees(math.atan2(dy, dx)) + 360.0) % 360.0
            yaw_error = (desired_yaw - self.robot_yaw + 540.0) % 360.0 - 180.0

            # 5. Điều khiển bám mục tiêu kèm Deadband 15°
            if abs(yaw_error) > 15.0:
                turn_cmd = "left" if yaw_error > 0 else "right"
                yaw_step = 15.0 if yaw_error > 0 else -15.0
                self.send_udp_motor_command("speed:35")
                self.send_udp_motor_command(turn_cmd)
                time.sleep(0.18)
                self.send_udp_motor_command("stop")

                self.robot_yaw = (self.robot_yaw + yaw_step) % 360.0
                self.angular_velocity = yaw_step
                self.linear_velocity = 0.0
                time.sleep(0.06)
            else:
                # Góc hướng đã chuẩn trong deadband: Tiến thẳng ổn định
                self.send_udp_motor_command("speed:45")
                self.send_udp_motor_command("forward")
                speed_mps = 0.18
                rad = math.radians(self.robot_yaw)
                self.robot_x += speed_mps * dt * math.cos(rad)
                self.robot_y += speed_mps * dt * math.sin(rad)
                self.linear_velocity = speed_mps
                self.angular_velocity = 0.0
                time.sleep(dt)

        self.send_udp_motor_command("stop")
        self.avoidance_locked_dir = None

    def scan_room_360(self, blocking: bool = False):
        """
        Quét 360° toàn cảnh ổn định (Stationary Multi-sweep):
        RPLiDAR A1 tự quay 360° với tần số 5.5 Hz. Robot giữ trạng thái tĩnh tuyệt đối
        để lấy toàn bộ các tia quét không gian phòng sắc nét, triệt tiêu sụt áp motor và motion distortion.
        """
        def _scan_worker():
            self.stop_navigation()
            self.status = "SCANNING_360"
            logger.info("🔄 Thu thập dữ liệu quét 360° toàn phòng tĩnh (Stationary Multi-sweep)...")
            self.send_udp_motor_command("stop", force=True)
            time.sleep(1.5)
            self.status = "IDLE"
            logger.info("✅ Hoàn thành quét 360° toàn phòng sắc nét!")

        if blocking:
            _scan_worker()
        else:
            t = threading.Thread(target=_scan_worker, daemon=True)
            t.start()

    # =========================================================================
    # FRONTIER EXPLORATION ENGINE
    # =========================================================================

    def start_exploration(self, auto_save: bool = True, save_name: str = "auto_explored_map"):
        """Bắt đầu chế độ tự động khám phá bản đồ (Greedy Frontier Exploration)."""
        if self.is_exploring:
            logger.warning("⚠️ Đang trong quá trình khám phá — bỏ qua lệnh mới.")
            return
        self.stop_navigation()
        self.explored_frontiers = []
        self.is_exploring = True
        self.status = "EXPLORING"
        logger.info("🗺️ BẮT ĐẦU KHÁM PHÁ TỰ ĐỘNG (Frontier Exploration)...")

        def _worker():
            self._exploration_loop(auto_save=auto_save, save_name=save_name)

        self._explore_thread = threading.Thread(target=_worker, daemon=True)
        self._explore_thread.start()

    def stop_exploration(self):
        """Dừng chế độ tự khám phá."""
        self.is_exploring = False
        self.send_udp_motor_command("stop")
        self.status = "IDLE"
        logger.info("🛑 Đã dừng khám phá tự động.")

    def _find_frontier(self) -> Optional[tuple]:
        """
        Tìm ô frontier gần nhất: ô chưa rõ (-1) tiếp giáp với ô đã biết (0/100).
        Trả về (world_x, world_y) của frontier đó, hoặc None nếu không còn.
        """
        with self._lock:
            w = self.grid_width
            h = self.grid_height
            data = self.grid_data
            rx = self.robot_x
            ry = self.robot_y

        best_frontier = None
        best_score = float('inf')  # Ưu tiên frontier gần nhất

        # Robot vị trí trong grid
        robot_gx = int((rx - self.origin_x) / self.resolution)
        robot_gy = int((ry - self.origin_y) / self.resolution)

        for gy in range(1, h - 1):
            for gx in range(1, w - 1):
                idx = gy * w + gx
                if data[idx] != -1:   # Chỉ xét ô chưa biết
                    continue

                # Kiểm tra xem có ít nhất 1 ô lân cận đã biết không
                has_known_neighbor = False
                for dgx, dgy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                    nidx = (gy + dgy) * w + (gx + dgx)
                    if 0 <= nidx < len(data) and data[nidx] == 0:
                        has_known_neighbor = True
                        break

                if not has_known_neighbor:
                    continue

                # Bo qua frontier da tham hoac qua gan diem da tham (< 30cm)
                world_x = self.origin_x + (gx + 0.5) * self.resolution
                world_y = self.origin_y + (gy + 0.5) * self.resolution
                frontier_key = (round(world_x, 1), round(world_y, 1))
                if frontier_key in self.explored_frontiers:
                    continue

                is_visited = False
                for ef in self.explored_frontiers:
                    if math.hypot(world_x - ef[0], world_y - ef[1]) < 0.30:
                        is_visited = True
                        break
                if is_visited:
                    continue

                dist = math.hypot(gx - robot_gx, gy - robot_gy)
                if dist < best_score:
                    best_score = dist
                    best_frontier = (world_x, world_y)

        return best_frontier

    def _navigate_to_sync(self, target_x: float, target_y: float,
                          timeout: float = 30.0, goal_radius: float = 0.25) -> bool:
        """
        Navigate đến điểm (target_x, target_y) theo kiểu synchronous (chặn thread cho đến khi đến nơi
        hoặc timeout). Trả về True nếu đến được, False nếu thất bại/timeout.
        """
        deadline = time.time() + timeout
        rate_hz = 10
        dt = 1.0 / rate_hz
        stuck_counter = 0
        last_pos = (self.robot_x, self.robot_y)
        stuck_check_interval = 20  # Kiểm tra stuck mỗi 2 giây

        while time.time() < deadline:
            # 0. Thoat ngay lap tuc neu nguoi dung kich hoat lenh dung kham pha
            if not self.is_exploring:
                self.send_udp_motor_command("stop", force=True)
                self.avoidance_locked_dir = None
                return False

            dx = target_x - self.robot_x
            dy = target_y - self.robot_y
            dist = math.hypot(dx, dy)

            # 1. Đã đến đích (Goal Reached)
            if dist < goal_radius:
                self.send_udp_motor_command("stop")
                self.avoidance_locked_dir = None
                return True

            # 2. Kiểm tra kẹt (Robot Stuck Detection)
            stuck_counter += 1
            if stuck_counter >= stuck_check_interval:
                moved = math.hypot(self.robot_x - last_pos[0], self.robot_y - last_pos[1])
                if moved < 0.03:  # Di chuyển < 3cm trong 2 giây = stuck
                    logger.warning("⚠️ Robot bị kẹt — bỏ qua frontier này.")
                    self.send_udp_motor_command("stop")
                    self.avoidance_locked_dir = None
                    return False
                last_pos = (self.robot_x, self.robot_y)
                stuck_counter = 0

            # 3. Né vật cản an toàn: Lùi nhẹ nếu quá gần + Xoay dứt khoát (triệt tiêu rung giật 80ms)
            front_dist = self.get_front_distance()
            if front_dist < 0.40:
                logger.warning(f"⚠️ Frontier navigation: Vật cản phía trước cách {front_dist:.2f}m! Rẽ tránh an toàn...")
                self.send_udp_motor_command("stop", force=True)

                # Nếu khoảng cách quá sát (< 30cm): Lùi nhẹ 0.25s để tạo khoảng hở an toàn quay đầu
                if front_dist < 0.30:
                    rear_dist = self.get_rear_distance()
                    if rear_dist > 0.35:
                        self.send_udp_motor_command("speed:35")
                        self.send_udp_motor_command("backward", force=True)
                        time.sleep(0.25)
                        self.send_udp_motor_command("stop", force=True)
                        time.sleep(0.08)

                if not self.avoidance_locked_dir:
                    left_dist = self.get_left_distance()
                    right_dist = self.get_right_distance()
                    self.avoidance_locked_dir = "left" if left_dist >= right_dist else "right"

                turn_cmd = self.avoidance_locked_dir
                # Xoay dứt khoát 0.35s ở công suất 38% để xe thực sự quay được góc ~30-35 độ
                yaw_step = 30.0 if turn_cmd == "left" else -30.0
                self.send_udp_motor_command("speed:38")
                self.send_udp_motor_command(turn_cmd, force=True)
                time.sleep(0.35)
                self.send_udp_motor_command("stop", force=True)
                self.robot_yaw = (self.robot_yaw + yaw_step) % 360.0
                time.sleep(0.10)
                continue
            else:
                if front_dist > 0.50:
                    self.avoidance_locked_dir = None

            # 4. Approach Lock (Khóa góc khi cự ly gần < 40cm để triệt tiêu hiện tượng lắc quay vòng quanh đích)
            if dist < 0.40:
                self.send_udp_motor_command("speed:30")
                self.send_udp_motor_command("forward")
                speed_mps = 0.14
                rad = math.radians(self.robot_yaw)
                self.robot_x += speed_mps * dt * math.cos(rad)
                self.robot_y += speed_mps * dt * math.sin(rad)
                self.linear_velocity = speed_mps
                self.angular_velocity = 0.0
                time.sleep(dt)
                continue

            # 5. Tính góc mục tiêu theo chuẩn Cartesian (+X Tiến, +Y Trái, CCW)
            desired_yaw = (math.degrees(math.atan2(dy, dx)) + 360.0) % 360.0
            yaw_error = (desired_yaw - self.robot_yaw + 540.0) % 360.0 - 180.0

            # 6. Điều khiển bám mục tiêu kèm Deadband 15°
            if abs(yaw_error) > 15.0:
                turn_cmd = "left" if yaw_error > 0 else "right"
                yaw_step = 15.0 if yaw_error > 0 else -15.0
                self.send_udp_motor_command("speed:35")
                self.send_udp_motor_command(turn_cmd)
                time.sleep(0.18)
                self.send_udp_motor_command("stop")
                self.robot_yaw = (self.robot_yaw + yaw_step) % 360.0
                self.angular_velocity = yaw_step
                self.linear_velocity = 0.0
                time.sleep(0.06)
            else:
                # Góc hướng đã chuẩn trong deadband: Tiến thẳng ổn định
                self.send_udp_motor_command("speed:45")
                self.send_udp_motor_command("forward")
                speed_mps = 0.18
                rad = math.radians(self.robot_yaw)
                self.robot_x += speed_mps * dt * math.cos(rad)
                self.robot_y += speed_mps * dt * math.sin(rad)
                self.linear_velocity = speed_mps
                self.angular_velocity = 0.0
                time.sleep(dt)

        self.send_udp_motor_command("stop")
        self.avoidance_locked_dir = None
        return False

    def _exploration_loop(self, auto_save: bool = True, save_name: str = "auto_explored_map"):
        """Vòng lặp khám phá: tìm frontier → di chuyển → quét → lặp cho đến khi hết frontier."""
        # 1. Thu thập dữ liệu quét 360° tại chỗ xuất phát (Stationary Multi-sweep)
        logger.info("📡 Thu thập dữ liệu quét 360° toàn cảnh tại vị trí xuất phát (Stationary Multi-sweep)...")
        self.send_udp_motor_command("stop", force=True)
        time.sleep(1.5)

        if not self.is_exploring:
            self.send_udp_motor_command("stop", force=True)
            self.status = "IDLE"
            return

        self.status = "EXPLORING"

        # 2. Đảm bảo LiDAR đã có dữ liệu quét thực tế trước khi tìm frontier
        wait_start = time.time()
        while len(self.get_latest_scans()) == 0 and time.time() - wait_start < 5.0 and self.is_exploring:
            logger.warning("⏳ Đang chờ RPLiDAR gửi tia quét...")
            time.sleep(0.5)

        if len(self.get_latest_scans()) == 0:
            logger.error("❌ RPLiDAR chưa gửi tia quét nào. Thử kích hoạt tái kết nối khẩn cấp...")
            self.connect(force=True)
            time.sleep(1.0)

        max_frontiers = 200  # Giới hạn số frontier để tránh chạy vô tận
        frontier_count = 0

        while self.is_exploring and frontier_count < max_frontiers:
            frontier = self._find_frontier()

            if frontier is None:
                # Kiểm tra nếu bản đồ hoàn toàn chưa có điểm nào (chưa có free cell do tia laser bị cản)
                with self._lock:
                    known_free = sum(1 for v in self.grid_data if v == 0)
                if known_free < 20 and frontier_count == 0:
                    logger.warning(f"⚠️ Bản đồ mới có {known_free} ô trống, nhích nhẹ 0.3m để mở rộng góc quan sát...")
                    self.send_udp_motor_command("speed:35")
                    self.send_udp_motor_command("forward")
                    time.sleep(0.6)
                    self.send_udp_motor_command("stop")
                    self.robot_x += 0.20 * math.cos(math.radians(self.robot_yaw))
                    self.robot_y += 0.20 * math.sin(math.radians(self.robot_yaw))
                    time.sleep(0.8)
                    continue

                logger.info("🎉 KHÁM PHÁ HOÀN THÀNH — Đã quét toàn bộ khu vực!")
                break

            fx, fy = frontier
            frontier_count += 1
            logger.info(f"🧭 [{frontier_count}] Di chuyển tới frontier ({fx:.2f}, {fy:.2f})...")

            success = self._navigate_to_sync(fx, fy, timeout=25.0, goal_radius=0.30)
            frontier_key = (round(fx, 1), round(fy, 1))
            self.explored_frontiers.append(frontier_key)

            if success:
                # Đã tới frontier: Dừng yên 0.8s để RPLiDAR A1 quét ổn định toàn cảnh không gian mới
                self.send_udp_motor_command("stop")
                time.sleep(0.8)
            else:
                logger.warning(f"⚠️ Không đến được frontier ({fx:.2f}, {fy:.2f}) — tiếp tục điểm kế tiếp.")

        # Kết thúc khám phá
        self.send_udp_motor_command("stop")
        self.status = "IDLE"
        self.is_exploring = False
        logger.info(f"🗺️ Khám phá hoàn tất — đã thăm {frontier_count} frontier.")

        if auto_save:
            result = self.save_map(save_name)
            logger.info(f"💾 Tự động lưu bản đồ: {result}")

    # =========================================================================
    # STATIC OVERLAY MAP
    # =========================================================================

    def load_overlay_map(self, overlay_path: str) -> bool:
        """
        Nạp floor plan JSON cứng (bản đồ overlay).
        Format:
        {
          "width": 800, "height": 800,
          "resolution": 0.025, "origin_x": -10.0, "origin_y": -10.0,
          "walls": [[gx, gy], ...],          # Ô tường cứng
          "waypoints": [{"name": "Lobby", "x": 1.2, "y": 0.5}, ...],
          "zones": [{"name": "Reception", "type": "poi", "x": 0.5, "y": 1.0, "radius": 0.5}],
          "no_go_zones": [[gx, gy], ...]     # Vùng cấm robot
        }
        """
        try:
            with open(overlay_path, "r", encoding="utf-8") as f:
                data = json.load(f)

            w = data.get("width", self.grid_width)
            h = data.get("height", self.grid_height)

            overlay = [-1] * (w * h)

            # Vẽ tường cứng
            for gx, gy in data.get("walls", []):
                if 0 <= gx < w and 0 <= gy < h:
                    overlay[gy * w + gx] = 100

            # Vùng no-go cũng là tường cứng
            for gx, gy in data.get("no_go_zones", []):
                if 0 <= gx < w and 0 <= gy < h:
                    overlay[gy * w + gx] = 100

            with self._lock:
                self._overlay_grid = overlay
                self._overlay_waypoints = data.get("waypoints", [])
                self._overlay_zones = data.get("zones", [])
                self._overlay_active = True

            logger.info(f"🏢 Đã nạp overlay map: {len(data.get('walls', []))} tường, "
                        f"{len(self._overlay_waypoints)} waypoints.")
            return True
        except Exception as e:
            logger.error(f"❌ Lỗi nạp overlay map: {e}")
            return False

    def merge_maps(self) -> List[int]:
        """
        Hợp nhất LiDAR map + Overlay map:
        - Overlay tường cứng ghi đè lên LiDAR map (tường cứng luôn thắng)
        - Vùng trống trong overlay KHÔNG xóa vật cản LiDAR (thực tế thắng)
        """
        with self._lock:
            lidar = list(self.grid_data)
            overlay = list(self._overlay_grid)

        if not overlay or len(overlay) != len(lidar):
            return lidar

        merged = []
        for i, lval in enumerate(lidar):
            oval = overlay[i]
            if oval == 100:        # Tường cứng luôn thắng
                merged.append(100)
            else:
                merged.append(lval)
        return merged

    def save_overlay_template(self, name: str = "floor_plan") -> str:
        """Tạo file JSON template overlay map rỗng để user chỉnh sửa."""
        template = {
            "name": name,
            "description": "Static floor plan overlay cho HC-Robot",
            "width": self.grid_width,
            "height": self.grid_height,
            "resolution": self.resolution,
            "origin_x": self.origin_x,
            "origin_y": self.origin_y,
            "walls": [],
            "no_go_zones": [],
            "waypoints": [
                {"name": "Diem_Xuat_Phat", "x": 0.0, "y": 0.0, "description": "Vị trí gốc/dock"},
                {"name": "Vi_Tri_A",      "x": 1.0, "y": 0.0, "description": "Điền tọa độ thực"},
            ],
            "zones": [
                {"name": "Reception", "type": "poi", "x": 0.5, "y": 1.0, "radius": 0.5},
            ],
        }
        path = os.path.join(MAPS_DIR, f"{name}_overlay.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(template, f, indent=2, ensure_ascii=False)
        logger.info(f"📄 Đã tạo template overlay map tại: {path}")
        return path

    # =========================================================================
    # WORKFLOW ENGINE
    # =========================================================================

    def list_workflows(self) -> List[Dict]:
        """Lấy danh sách tất cả workflow đã lưu."""
        workflows = []
        for fname in sorted(os.listdir(WORKFLOWS_DIR)):
            if fname.endswith(".json"):
                fpath = os.path.join(WORKFLOWS_DIR, fname)
                try:
                    with open(fpath, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    workflows.append({
                        "id": data.get("id", fname.replace(".json", "")),
                        "name": data.get("name", ""),
                        "description": data.get("description", ""),
                        "created_at": data.get("created_at", ""),
                        "step_count": len(data.get("steps", [])),
                    })
                except Exception:
                    pass
        return workflows

    def save_workflow(self, workflow: Dict) -> str:
        """Lưu workflow ra file JSON."""
        wid = workflow.get("id") or f"wf_{int(time.time())}"
        workflow["id"] = wid
        workflow["created_at"] = workflow.get("created_at") or time.strftime("%Y-%m-%d %H:%M:%S")
        path = os.path.join(WORKFLOWS_DIR, f"{wid}.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(workflow, f, indent=2, ensure_ascii=False)
        logger.info(f"💾 Đã lưu workflow '{workflow.get('name', wid)}'")
        return wid

    def delete_workflow(self, wid: str) -> bool:
        """Xóa workflow."""
        path = os.path.join(WORKFLOWS_DIR, f"{wid}.json")
        if os.path.exists(path):
            os.remove(path)
            return True
        return False

    def execute_workflow(self, wid: str) -> bool:
        """Thực thi workflow theo ID trong background thread."""
        if self.is_workflow_running:
            logger.warning("⚠️ Đã có workflow đang chạy — dừng workflow hiện tại trước.")
            self.stop_workflow()

        path = os.path.join(WORKFLOWS_DIR, f"{wid}.json")
        if not os.path.exists(path):
            logger.error(f"❌ Không tìm thấy workflow '{wid}'")
            return False

        with open(path, "r", encoding="utf-8") as f:
            wf = json.load(f)

        self.active_workflow = wf
        self.is_workflow_running = True
        self.workflow_step_index = 0
        self.workflow_progress = {
            "id": wid, "name": wf.get("name", ""),
            "total_steps": len(wf.get("steps", [])),
            "current_step": 0, "status": "RUNNING",
        }
        self.status = "WORKFLOW_RUNNING"

        self._workflow_thread = threading.Thread(target=self._workflow_loop, daemon=True)
        self._workflow_thread.start()
        logger.info(f"▶️ Bắt đầu Workflow: {wf.get('name', wid)} ({len(wf.get('steps', []))} bước)")
        return True

    def stop_workflow(self):
        """Dừng workflow đang chạy."""
        self.is_workflow_running = False
        self.active_workflow = None
        self.workflow_progress["status"] = "STOPPED"
        self.status = "IDLE"
        self.send_udp_motor_command("stop")
        logger.info("🛑 Đã dừng workflow.")

    def _workflow_loop(self):
        """
        Thực thi từng bước workflow:
        Mỗi step: { "name": "...", "action": "navigate|wait|scan_360|custom",
                    "x": float, "y": float, "wait_sec": float, "speed": int }
        """
        wf = self.active_workflow
        steps = wf.get("steps", [])

        for i, step in enumerate(steps):
            if not self.is_workflow_running:
                break

            self.workflow_step_index = i
            self.workflow_progress["current_step"] = i + 1
            step_name = step.get("name", f"Bước {i + 1}")
            action = step.get("action", "navigate")

            logger.info(f"📍 [WF {i+1}/{len(steps)}] {step_name} — Hành động: {action}")

            if action == "navigate":
                tx = step.get("x", self.robot_x)
                ty = step.get("y", self.robot_y)
                timeout = step.get("timeout", 45.0)
                success = self._navigate_to_sync(tx, ty, timeout=timeout)
                if success:
                    logger.info(f"✅ [{step_name}] Đã đến ({tx:.2f}, {ty:.2f})")
                else:
                    logger.warning(f"⚠️ [{step_name}] Không đến được ({tx:.2f}, {ty:.2f}) — tiếp tục")

            elif action == "scan_360":
                logger.info(f"🔄 [{step_name}] Quét 360°...")
                self.scan_room_360()
                time.sleep(6.0)  # Chờ quét xong

            elif action == "wait":
                wait_sec = step.get("wait_sec", 2.0)
                logger.info(f"⏱️ [{step_name}] Dừng {wait_sec}s...")
                self.send_udp_motor_command("stop")
                deadline = time.time() + wait_sec
                while time.time() < deadline and self.is_workflow_running:
                    time.sleep(0.1)

            elif action == "return_home":
                logger.info(f"🏠 [{step_name}] Quay về gốc (0, 0)...")
                self._navigate_to_sync(0.0, 0.0, timeout=60.0)

        # Workflow hoàn thành
        self.send_udp_motor_command("stop")
        self.is_workflow_running = False
        self.active_workflow = None
        self.status = "IDLE"
        self.workflow_progress["status"] = "COMPLETED"
        logger.info("🎉 WORKFLOW HOÀN THÀNH!")


# Khởi tạo singleton Core
slam_core = RPLidarSLAMCore()

# Khởi tạo FastAPI Server cho Web Admin (hoặc DummyApp nếu chạy test offline)
if HAS_FASTAPI:
    app = FastAPI(title="HC-Robot Pi5 LiDAR SLAM & Navigation Service")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    class DummyApp:
        def get(self, *args, **kwargs): return lambda f: f
        def post(self, *args, **kwargs): return lambda f: f
        def delete(self, *args, **kwargs): return lambda f: f
        def websocket(self, *args, **kwargs): return lambda f: f
    app = DummyApp()


class NavigateGoalRequest(BaseModel):
    target_x: float
    target_y: float
    target_yaw: Optional[float] = None


class ExploreStartRequest(BaseModel):
    auto_save: bool = True
    save_name: str = "auto_explored_map"


class WorkflowStep(BaseModel):
    name: str
    action: str  # navigate | wait | scan_360 | return_home
    x: Optional[float] = None
    y: Optional[float] = None
    wait_sec: Optional[float] = 2.0
    timeout: Optional[float] = 45.0
    speed: Optional[int] = 45


class WorkflowCreateRequest(BaseModel):
    id: Optional[str] = None
    name: str
    description: Optional[str] = ""
    steps: List[WorkflowStep]


class OverlayLoadRequest(BaseModel):
    map_name: str  # Tên file overlay (trong MAPS_DIR): ví dụ "floor_plan_overlay"


@app.get("/api/v1/map/current")
async def get_current_map():
    map_data = slam_core.get_grid_map()
    return {
        "status": "SUCCESS",
        "width": map_data["width"],
        "height": map_data["height"],
        "resolution": map_data["resolution"],
        "origin_x": map_data["origin_x"],
        "origin_y": map_data["origin_y"],
        "grid_data": map_data["grid_data"],
        "waypoints": [],
        "zones": [],
    }


@app.get("/api/v1/map/lidar_status")
async def get_lidar_status():
    scan_age = None if slam_core.last_scan_time <= 0 else max(0.0, time.time() - slam_core.last_scan_time)
    data_live = bool(scan_age is not None and scan_age < 1.5 and slam_core.last_scan_points > 0)
    return {
        "status": "LIVE" if data_live else ("NO_SCAN" if slam_core.is_connected else "OFFLINE"),
        "is_connected": slam_core.is_connected,
        "is_running": slam_core.is_running,
        "data_live": data_live,
        "scan_points": slam_core.last_scan_points,
        "last_scan_age_sec": None if scan_age is None else round(scan_age, 2),
        "device_info": slam_core.device_info,
        "last_error": slam_core.last_error,
    }


@app.post("/api/v1/map/connect_lidar")
async def connect_lidar():
    success = slam_core.connect(force=True)
    if success:
        slam_core.start_scanning()
        # Serial open/GET_HEALTH is not enough. Wait for a complete 360-degree
        # scan so callers cannot mistake an open port for live sensor data.
        for _ in range(25):
            if slam_core.last_scan_time > 0 and time.time() - slam_core.last_scan_time < 1.0:
                return {
                    "status": "SUCCESS",
                    "message": "RPLiDAR đang phát dữ liệu scan thật",
                    "scan_points": slam_core.last_scan_points,
                    "info": slam_core.device_info,
                }
            await asyncio.sleep(0.2)
        return {
            "status": "FAILED",
            "message": slam_core.last_error or "Đã mở cổng LiDAR nhưng không nhận được dữ liệu scan.",
            "info": slam_core.device_info,
        }
    return {"status": "FAILED", "message": slam_core.last_error or "Không thể kết nối RPLiDAR"}


@app.post("/api/v1/system/restart")
async def restart_system():
    """Khởi động lại toàn bộ tiến trình điều khiển robot."""
    def _do_exit():
        time.sleep(0.5)
        os._exit(0)
    threading.Thread(target=_do_exit, daemon=True).start()
    return {"status": "SUCCESS", "message": "Đang khởi động lại tiến trình robot..."}


@app.post("/api/v1/map/reset_map")
async def reset_map():
    slam_core.reset_map()
    return {"status": "SUCCESS", "message": "Đã xóa trắng bản đồ 2D Occupancy Grid"}


class SaveMapRequest(BaseModel):
    name: Optional[str] = "floor1_map"


@app.post("/api/v1/map/save")
async def save_map_endpoint(req: Optional[SaveMapRequest] = None):
    map_name = (req.name if req and req.name else None) or f"map_{int(time.time())}"
    try:
        res = slam_core.save_map(map_name)
    except ValueError as exc:
        return {"status": "FAILED", "message": str(exc)}
    return {
        "status": "SUCCESS",
        "message": f"Đã lưu bản đồ '{map_name}' thành công (JSON + ROS 2 YAML/PGM)",
        "data": res,
    }


@app.get("/api/v1/map/saved_list")
async def get_saved_maps():
    maps = slam_core.list_saved_maps()
    return {
        "status": "SUCCESS",
        "maps": maps,
        "count": len(maps),
        "map_mode": slam_core.map_mode,
        "is_map_locked": slam_core.is_map_locked,
        "active_map_name": slam_core.active_map_name,
    }


class LoadMapRequest(BaseModel):
    name: str


class MapModeRequest(BaseModel):
    mode: str


@app.post("/api/v1/map/load")
async def load_map_endpoint(req: LoadMapRequest):
    ok = slam_core.load_map(req.name)
    if ok:
        return {"status": "SUCCESS", "message": f"Đã nạp bản đồ '{req.name}' vào hệ thống"}
    return {"status": "FAILED", "message": f"Không tìm thấy hoặc không đọc được bản đồ '{req.name}'"}


@app.post("/api/v1/map/mode")
async def set_map_mode(req: MapModeRequest):
    """Chuyen ro rang giua Mapping va Navigation, khong dung toggle mo ho."""
    mode = (req.mode or "").strip().upper()
    if mode not in ("MAPPING", "NAVIGATION"):
        return {"status": "FAILED", "message": "mode phải là MAPPING hoặc NAVIGATION"}

    with slam_core._lock:
        if mode == "MAPPING":
            slam_core.map_mode = "MAPPING"
            slam_core.is_map_locked = False
        else:
            slam_core.static_grid_data = list(slam_core.grid_data)
            slam_core.map_mode = "NAVIGATION"
            slam_core.is_map_locked = True

    return {
        "status": "SUCCESS",
        "map_mode": slam_core.map_mode,
        "is_map_locked": slam_core.is_map_locked,
        "active_map_name": slam_core.active_map_name,
    }


@app.delete("/api/v1/map/saved/{name}")
async def delete_map_endpoint(name: str):
    ok = slam_core.delete_map(name)
    if ok:
        return {"status": "SUCCESS", "message": f"Đã xóa bản đồ '{name}'"}
    return {"status": "FAILED", "message": f"Không tìm thấy bản đồ '{name}'"}


@app.post("/api/v1/map/scan_360")
async def start_scan_360():
    slam_core.scan_room_360()
    return {"status": "SUCCESS", "message": "Robot đang quay 360 độ để quét toàn cảnh phòng"}


class TeleopCommandRequest(BaseModel):
    command: str  # forward, backward, left, right, stop
    speed: Optional[int] = 30


TELEOP_PWM_MIN = 20
TELEOP_PWM_MAX = 50
TELEOP_PWM_FORWARD = 30
TELEOP_PWM_TURN = 38


def _clamp_teleop_pwm(speed: Optional[int], default: int) -> int:
    raw = default if speed is None else int(speed)
    return max(TELEOP_PWM_MIN, min(TELEOP_PWM_MAX, raw))


@app.post("/api/v1/map/teleop")
async def teleop_control(req: TeleopCommandRequest):
    slam_core.stop_navigation()
    cmd = req.command.lower()
    if cmd == "stop":
        slam_core.send_udp_motor_command("stop")
        slam_core.linear_velocity = 0.0
        slam_core.angular_velocity = 0.0
    elif cmd in ["left", "right"]:
        spd = _clamp_teleop_pwm(req.speed, TELEOP_PWM_TURN)
        slam_core.send_udp_motor_command(f"speed:{spd}")
        slam_core.send_udp_motor_command(cmd)
        # Nếu có IMU (ESP32 MPU) thì để scan_loop tích phân yaw_rate tự động.
        # Chỉ fallback bước cố định khi không có IMU hoặc ESP32 chưa kết nối.
        esp_reader = getattr(slam_core, "esp32_reader", None)
        has_imu = False
        if esp_reader and hasattr(esp_reader, "latest"):
            snap = esp_reader.latest()
            has_imu = bool(snap and snap.mpu_available and snap.yaw_rate_dps is not None)
        if not has_imu:
            # Fallback: ước tính thô ±8° khi không có IMU
            yaw_step = -8.0 if cmd == "right" else 8.0
            slam_core.robot_yaw = (slam_core.robot_yaw + yaw_step) % 360.0
    elif cmd in ["forward", "backward"]:
        spd = _clamp_teleop_pwm(req.speed, TELEOP_PWM_FORWARD)
        slam_core.send_udp_motor_command(f"speed:{spd}")
        slam_core.send_udp_motor_command(cmd)
        # Pose x/y do encoder trong scan_loop; không cộng bước mở khi đã có encoder.
        # Yaw bị khóa khi đi thẳng nên không cập nhật góc tại đây.
        has_encoder = False
        esp_reader = getattr(slam_core, "esp32_reader", None)
        if esp_reader and hasattr(esp_reader, "latest"):
            snap = esp_reader.latest()
            has_encoder = bool(snap and getattr(snap, "encoders", None))
        if not has_encoder:
            step_m = 0.08 if cmd == "forward" else -0.08
            rad = math.radians(slam_core.robot_yaw)
            slam_core.robot_x += step_m * math.cos(rad)
            slam_core.robot_y += step_m * math.sin(rad)
    return {"status": "SUCCESS", "command": cmd}


@app.post("/api/v1/map/navigate")
async def navigate_to_point(req: NavigateGoalRequest):
    slam_core.navigate_to(req.target_x, req.target_y)
    return {
        "status": "SUCCESS",
        "message": f"Robot đang tự hành tới (X={req.target_x:.2f}m, Y={req.target_y:.2f}m)",
        "target_x": req.target_x,
        "target_y": req.target_y,
    }


# ─── FRONTIER EXPLORATION ────────────────────────────────────────────────────

@app.post("/api/v1/map/explore/start")
async def start_exploration(req: Optional[ExploreStartRequest] = None):
    auto_save = req.auto_save if req else True
    save_name = req.save_name if req else "auto_explored_map"
    slam_core.start_exploration(auto_save=auto_save, save_name=save_name)
    return {
        "status": "SUCCESS",
        "message": "Robot đang bắt đầu khám phá tự động (Frontier Exploration)",
        "auto_save": auto_save,
        "save_name": save_name,
    }


@app.post("/api/v1/map/explore/stop")
async def stop_exploration():
    slam_core.stop_exploration()
    return {"status": "SUCCESS", "message": "Đã dừng khám phá tự động"}


@app.post("/api/v1/map/emergency_stop")
async def emergency_stop():
    """Dừng khẩn cấp: ngắt toàn bộ quét map frontier, navigation và phanh động cơ lập tức."""
    slam_core.stop_exploration()
    slam_core.stop_navigation()
    slam_core.send_udp_motor_command("stop", force=True)
    slam_core.status = "EMERGENCY_STOPPED"
    slam_core.linear_velocity = 0.0
    slam_core.angular_velocity = 0.0
    logger.warning("🛑 [E-STOP] Đã kích hoạt dừng khẩn cấp: ngắt toàn bộ tự hành, quét map và động cơ bánh xe!")
    return {
        "status": "SUCCESS",
        "message": "Đã ngắt toàn bộ chuyển động khẩn cấp (Emergency Stop Activated). Robot đứng yên an toàn."
    }


@app.get("/api/v1/map/explore/status")
async def get_explore_status():
    return {
        "status": "SUCCESS",
        "is_exploring": slam_core.is_exploring,
        "robot_status": slam_core.status,
        "explored_count": len(slam_core.explored_frontiers),
        "linear_velocity": round(slam_core.linear_velocity, 2),
        "angular_velocity": round(slam_core.angular_velocity, 1),
    }


# ─── STATIC OVERLAY MAP ──────────────────────────────────────────────────────

@app.post("/api/v1/map/overlay/load")
async def load_overlay(req: OverlayLoadRequest):
    safe_name = "".join(c for c in req.map_name if c.isalnum() or c in ("_", "-")).strip()
    candidates = [
        os.path.join(MAPS_DIR, f"{safe_name}.json"),
        os.path.join(MAPS_DIR, f"{safe_name}_overlay.json"),
    ]
    if safe_name.endswith("_overlay"):
        base_name = safe_name[:-8]
        candidates.append(os.path.join(MAPS_DIR, f"{base_name}.json"))
    
    overlay_path = None
    for c in candidates:
        if os.path.exists(c):
            overlay_path = c
            break

    if not overlay_path:
        return {"status": "FAILED", "message": f"Không tìm thấy overlay map '{safe_name}' (đã tìm trong {MAPS_DIR})"}

    ok = slam_core.load_overlay_map(overlay_path)
    if ok:
        return {"status": "SUCCESS", "message": f"Đã nạp overlay map từ '{os.path.basename(overlay_path)}'",
                "waypoints": slam_core._overlay_waypoints,
                "zones": slam_core._overlay_zones}
    return {"status": "FAILED", "message": f"Không thể giải mã file overlay '{safe_name}'"}


@app.post("/api/v1/map/overlay/disable")
async def disable_overlay():
    slam_core._overlay_active = False
    return {"status": "SUCCESS", "message": "Đã tắt overlay map"}


@app.post("/api/v1/map/layout/3x5m")
async def create_layout_3x5m():
    """Khởi tạo nhanh Layout Cứng 3m x 5m, cố định 4 bức tường và bật chế độ mở sương mù."""
    res = slam_core.init_fixed_layout_3x5m("phong_3x5m")
    return {"status": "SUCCESS", "message": "Đã khởi tạo Layout Cứng 3m x 5m", "data": res}


@app.get("/api/v1/map/overlay/template")
async def create_overlay_template(name: str = "floor_plan"):
    path = slam_core.save_overlay_template(name)
    return {"status": "SUCCESS", "message": f"Đã tạo template tại {path}", "path": path}


@app.get("/api/v1/map/merged")
async def get_merged_map():
    """Trả về bản đồ đã merge LiDAR + Overlay."""
    merged = slam_core.merge_maps()
    meta = slam_core.get_grid_map()
    waypoints = slam_core._overlay_waypoints if slam_core._overlay_active else []
    zones = slam_core._overlay_zones if slam_core._overlay_active else []
    return {
        "status": "SUCCESS",
        "width": meta["width"],
        "height": meta["height"],
        "resolution": meta["resolution"],
        "origin_x": meta["origin_x"],
        "origin_y": meta["origin_y"],
        "grid_data": merged,
        "overlay_active": slam_core._overlay_active,
        "waypoints": waypoints,
        "zones": zones,
    }


# ─── WORKFLOW ENGINE ──────────────────────────────────────────────────────────

@app.get("/api/v1/workflow/list")
async def list_workflows():
    wfs = slam_core.list_workflows()
    return {"status": "SUCCESS", "workflows": wfs, "count": len(wfs)}


@app.post("/api/v1/workflow/create")
async def create_workflow(req: WorkflowCreateRequest):
    wf_dict = req.dict()
    wid = slam_core.save_workflow(wf_dict)
    return {"status": "SUCCESS", "message": f"Đã lưu workflow '{req.name}'", "id": wid}


@app.post("/api/v1/workflow/execute/{wid}")
async def execute_workflow(wid: str):
    ok = slam_core.execute_workflow(wid)
    if ok:
        return {"status": "SUCCESS", "message": f"Đang thực thi workflow '{wid}'"}
    return {"status": "FAILED", "message": f"Không tìm thấy workflow '{wid}' hoặc lỗi khởi động"}


@app.post("/api/v1/workflow/stop")
async def stop_workflow():
    slam_core.stop_workflow()
    return {"status": "SUCCESS", "message": "Đã dừng workflow"}


@app.delete("/api/v1/workflow/{wid}")
async def delete_workflow(wid: str):
    ok = slam_core.delete_workflow(wid)
    if ok:
        return {"status": "SUCCESS", "message": f"Đã xóa workflow '{wid}'"}
    return {"status": "FAILED", "message": f"Không tìm thấy workflow '{wid}'"}


@app.get("/api/v1/workflow/status")
async def workflow_status():
    return {
        "status": "SUCCESS",
        "is_running": slam_core.is_workflow_running,
        "progress": slam_core.workflow_progress,
        "robot_status": slam_core.status,
    }


@app.websocket("/api/v1/map/ws")
async def map_ws_endpoint(websocket: WebSocket):
    await websocket.accept()
    logger.info("🔌 Web Admin LiDAR Canvas đã kết nối WebSocket")
    ros2_consumer = websocket.query_params.get("consumer", "").lower() == "ros2"
    ws_cycle = 0

    if not slam_core.is_running:
        if slam_core.connect():
            slam_core.start_scanning()

    try:
        while True:
            scans = slam_core.get_latest_scans()

            encoders_payload = {"m1": {"rpm": 0, "ticks": 0}, "m2": {"rpm": 0, "ticks": 0}, "m3": {"rpm": 0, "ticks": 0}, "m4": {"rpm": 0, "ticks": 0}}
            esp_reader = getattr(slam_core, "esp32_reader", None)
            snap = esp_reader.latest() if (esp_reader and hasattr(esp_reader, "latest")) else None
            if snap and snap.encoders:
                encoders_payload = snap.encoders

            yaw_rate_dps = 0.0
            imu_available = bool(
                snap and getattr(snap, "mpu_available", False)
                and getattr(snap, "yaw_rate_dps", None) is not None
            )
            if imu_available and snap is not None:
                yaw_rate_dps = float(snap.yaw_rate_dps)

            # ROS 2 chỉ cần scan + encoder/IMU. Không copy/serialize occupancy
            # grid 800x800 cho kết nối này vì payload lớn gây dồn gói 1-2 giây,
            # khiến TF nhảy cục và cùng một vòng scan bị publish lặp nhiều lần.
            if ros2_consumer:
                payload = {
                    "type": "ros2_sensor_frame",
                    "scan_id": slam_core.last_scan_time,
                    "scan_points": scans,
                    "encoder_sequence": getattr(snap, "sequence", None) if snap else None,
                    "encoder_received_at": getattr(snap, "received_at", None) if snap else None,
                    "encoders": encoders_payload,
                    "yaw_rate_dps": yaw_rate_dps,
                    # Cho ROS bridge phân biệt "gyro đo 0" với "không có IMU".
                    "imu_available": imu_available,
                    # Tuổi dữ liệu đo bằng đồng hồ Pi ngay lúc gửi, để bridge
                    # đặt timestamp scan đúng so với odom mà không cần đồng bộ
                    # giờ Pi/laptop. last_scan_time là time.time() lúc xong vòng.
                    "scan_age_sec": (
                        max(0.0, time.time() - slam_core.last_scan_time)
                        if slam_core.last_scan_time else None
                    ),
                    "encoder_age_sec": (
                        max(0.0, time.monotonic() - snap.received_at)
                        if snap is not None and getattr(snap, "received_at", None) is not None
                        else None
                    ),
                }
                await websocket.send_text(json.dumps(payload))
                await asyncio.sleep(0.04)
                continue

            map_data = slam_core.get_grid_map()

            front_cm = round(slam_core.get_front_distance() * 100, 1) if slam_core.get_front_distance() < 90 else None
            rear_cm = round(slam_core.get_rear_distance() * 100, 1) if slam_core.get_rear_distance() < 90 else None
            left_cm = round(slam_core.get_left_distance() * 100, 1) if slam_core.get_left_distance() < 90 else None
            right_cm = round(slam_core.get_right_distance() * 100, 1) if slam_core.get_right_distance() < 90 else None

            # Kết hợp dữ liệu cảm biến siêu âm ESP32 khi LiDAR chưa kịp quét hoặc bị che
            if snap and snap.distances:
                if front_cm is None and snap.distances.get("front") is not None:
                    front_cm = round(snap.distances["front"], 1)
                if rear_cm is None and snap.distances.get("rear") is not None:
                    rear_cm = round(snap.distances["rear"], 1)
                if left_cm is None and snap.distances.get("left") is not None:
                    left_cm = round(snap.distances["left"], 1)
                if right_cm is None and snap.distances.get("right") is not None:
                    right_cm = round(snap.distances["right"], 1)

            payload = {
                "type": "telemetry_update",
                "source": "REAL_RPLIDAR_A1M8_PI5" if scans else "RPLIDAR_NO_LIVE_SCAN",
                "device_info": slam_core.device_info,
                "robot_pose": {
                    "x": round(slam_core.robot_x, 2),
                    "y": round(slam_core.robot_y, 2),
                    "yaw": round(slam_core.robot_yaw, 1),
                },
                "battery": 98,
                "linear_velocity": round(slam_core.linear_velocity, 2),
                "angular_velocity": round(slam_core.angular_velocity, 1),
                "status": slam_core.status,
                "is_exploring": slam_core.is_exploring,
                "is_workflow_running": slam_core.is_workflow_running,
                "workflow_progress": slam_core.workflow_progress,
                "overlay_active": slam_core._overlay_active,
                "overlay_waypoints": slam_core._overlay_waypoints if slam_core._overlay_active else [],
                "scan_points": scans,
                "scan_id": slam_core.last_scan_time,
                "encoders": encoders_payload,
                "encoder_sequence": getattr(snap, "sequence", None) if snap else None,
                "yaw_rate_dps": yaw_rate_dps,
                "map_mode": slam_core.map_mode,
                "is_map_locked": slam_core.is_map_locked,
                "active_map_name": slam_core.active_map_name,
                "safety": {
                    "front_cm": front_cm,
                    "rear_cm": rear_cm,
                    "left_cm": left_cm,
                    "right_cm": right_cm,
                    "alert": getattr(slam_core, "last_safety_alert", ""),
                },
                "grid_metadata": {
                    "width": map_data["width"],
                    "height": map_data["height"],
                    "resolution": map_data["resolution"],
                    "origin_x": map_data["origin_x"],
                    "origin_y": map_data["origin_y"],
                },
            }

            # Không gửi 800x800 JSON 25Hz — payload đó làm nghẽn TF/RobotModel trên RViz.
            ws_cycle += 1
            if ws_cycle % 5 == 1:
                with slam_core._lock:
                    payload["grid_sparse"] = slam_core._grid_sparse_payload()

            await websocket.send_text(json.dumps(payload))
            await asyncio.sleep(0.04)  # 25 Hz

    except WebSocketDisconnect:
        logger.info("🔌 Web Admin LiDAR Canvas ngắt kết nối WebSocket")


def run_lidar_server(host="0.0.0.0", port=8000):
    if slam_core.pi_motor is None:
        slam_core.init_direct_motor()
    slam_core.connect()
    slam_core.start_scanning()
    uvicorn.run(app, host=host, port=port, log_level="warning")


if __name__ == "__main__":
    run_lidar_server()
