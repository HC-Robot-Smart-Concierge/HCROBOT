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

MAPS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "maps")
WORKFLOWS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "workflows")
os.makedirs(MAPS_DIR, exist_ok=True)
os.makedirs(WORKFLOWS_DIR, exist_ok=True)


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

        # Bản đồ 2D Occupancy Grid: 200x200 ô, 0.05m (5cm)/pixel => 10m x 10m
        self.grid_width = 200
        self.grid_height = 200
        self.resolution = 0.05
        self.origin_x = -5.0
        self.origin_y = -5.0
        self.grid_data = [-1] * (self.grid_width * self.grid_height)

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

        # Workflow execution
        self.active_workflow: Optional[Dict] = None
        self._workflow_thread: Optional[threading.Thread] = None
        self.is_workflow_running = False
        self.workflow_step_index = 0
        self.workflow_progress: Dict[str, Any] = {}

    def reset_map(self):
        """Xóa trắng bản đồ 2D về trạng thái ban đầu và đưa vị trí robot về gốc."""
        with self._lock:
            self.grid_data = [-1] * (self.grid_width * self.grid_height)
            self.robot_x = 0.0
            self.robot_y = 0.0
            self.robot_yaw = 0.0
            self.status = "IDLE"
            self.linear_velocity = 0.0
            self.angular_velocity = 0.0
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
                self.grid_width = data.get("width", 200)
                self.grid_height = data.get("height", 200)
                self.resolution = data.get("resolution", 0.05)
                self.origin_x = data.get("origin_x", -5.0)
                self.origin_y = data.get("origin_y", -5.0)
                self.grid_data = data.get("grid_data", [-1] * (self.grid_width * self.grid_height))
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
                        "resolution": data.get("resolution", 0.05),
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

    def _update_grid_from_scan(self, rx: float, ry: float, scan_points: List[Dict[str, Any]]):
        """
        Thuật toán Raytracing Bresenham có cơ chế tự làm sạch:
        - Các ô mà tia laser đi qua ĐƯỢC XÓA THÀNH VÙNG TRỐNG (0).
        - Chỉ ô cuối cùng nơi tia chạm tường mới được đánh dấu VẬT CẢN (100).
        - Giúp bản đồ sắc nét, không bị vệt đen tích lũy như cơn lốc.
        """
        gx_robot, gy_robot = self._world_to_grid(rx, ry)

        for pt in scan_points:
            ox, oy = self._world_to_grid(pt["x"], pt["y"])

            dx = abs(ox - gx_robot)
            dy = abs(oy - gy_robot)
            sx = 1 if gx_robot < ox else -1
            sy = 1 if gy_robot < oy else -1
            err = dx - dy

            curr_x, curr_y = gx_robot, gy_robot
            max_steps = 250
            step = 0

            while step < max_steps:
                step += 1
                if 0 <= curr_x < self.grid_width and 0 <= curr_y < self.grid_height:
                    idx = curr_y * self.grid_width + curr_x
                    if curr_x == ox and curr_y == oy:
                        # Điểm va chạm vật cản / bức tường
                        self.grid_data[idx] = 100
                        break
                    else:
                        # Vùng không gian trống mà tia laser xuyên qua
                        # LÀM SẠCH: xóa vết đen cũ nếu tia hiện tại chứng minh vùng này trống
                        self.grid_data[idx] = 0

                if curr_x == ox and curr_y == oy:
                    break

                e2 = 2 * err
                if e2 > -dy:
                    err -= dy
                    curr_x += sx
                if e2 < dx:
                    err += dx
                    curr_y += sy

    def connect(self) -> bool:
        """Mở cổng Serial và bắt tay với RPLiDAR A1M8."""
        if self.is_connected and self.ser and self.ser.is_open:
            return True

        self.stop()
        self.port = find_rplidar_port()

        try:
            logger.info(f"🔌 Mở cổng Serial {self.port} tốc độ {self.baudrate} baud...")
            self.ser = serial.Serial(self.port, self.baudrate, timeout=0.05)
            self.ser.dtr = False
            self.ser.rts = False
            time.sleep(0.15)

            # STOP
            self.ser.write(b"\xa5\x25")
            time.sleep(0.1)
            self.ser.reset_input_buffer()
            self.ser.reset_output_buffer()

            # GET_INFO
            self.ser.write(b"\xa5\x50")
            time.sleep(0.1)
            desc_info = self.ser.read(7)
            if len(desc_info) == 7 and desc_info[:2] == b"\xa5\x5a":
                info = self.ser.read(20)
                if len(info) >= 20:
                    self.device_info["model"] = f"RPLiDAR A1M8 (Model {info[0]})"
                    self.device_info["firmware"] = f"{info[2]}.{info[1]}"
                    self.device_info["hardware"] = f"{info[3]}"
                    self.device_info["serialnumber"] = info[4:].hex().upper()

            # GET_HEALTH
            self.ser.write(b"\xa5\x52")
            time.sleep(0.05)
            desc_health = self.ser.read(7)
            if len(desc_health) == 7 and desc_health[:2] == b"\xa5\x5a":
                health_data = self.ser.read(3)
                if len(health_data) >= 3:
                    h_status = health_data[0]
                    self.device_info["health"] = "Good" if h_status == 0 else f"Warning({h_status})"

            # Bật quay motor PWM
            try:
                self.ser.write(b"\xa5\xf0\x02\x94\x02\xc5")
                time.sleep(0.1)
            except Exception:
                pass

            self.is_connected = True
            self.last_error = ""
            logger.info(f"✅ Đã kết nối RPLiDAR A1M8 trên {self.port}! Health: {self.device_info['health']}")
            return True

        except Exception as e:
            self.is_connected = False
            self.last_error = str(e)
            logger.error(f"❌ Lỗi kết nối {self.port}: {e}")
            return False

    def start_scanning(self):
        """Bật Thread thu thập tia quét thời gian thực."""
        if self.is_running:
            return
        if not self.is_connected and not self.connect():
            return

        self.is_running = True
        self._scan_thread = threading.Thread(target=self._scan_loop, daemon=True)
        self._scan_thread.start()
        logger.info("🚀 Luồng quét LiDAR SLAM đã sẵn sàng")

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
        """Vòng lặp bóc tách 5-byte packet chuẩn RPLiDAR có lọc nhiễu thân robot."""
        try:
            if not self.ser or not self.ser.is_open:
                return

            self.ser.write(b"\xa5\x20")
            time.sleep(0.1)
            self.ser.read(7)  # Bỏ qua descriptor 7-byte

            buf = bytearray()
            current_scan_batch = []

            while self.is_running and self.ser and self.ser.is_open:
                chunk = self.ser.read(512)
                if not chunk:
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

                    is_new_scan = (s == 1)
                    quality = packet[0] >> 2
                    angle_q6 = (packet[1] >> 1) | (packet[2] << 7)
                    angle = angle_q6 / 64.0
                    distance_q2 = packet[3] | (packet[4] << 8)
                    dist_m = (distance_q2 / 4.0) / 1000.0

                    # 1. Lọc tia khoảng cách hợp lệ (từ 12cm đến 12m)
                    if 0.12 <= dist_m <= 12.0:
                        # RPLiDAR quay theo chiều kim đồng hồ; chuẩn hóa góc về hệ tọa độ chuẩn
                        heading = (angle + self.robot_yaw) % 360.0
                        rad = math.radians(heading)
                        x = self.robot_x + dist_m * math.sin(rad)
                        y = self.robot_y + dist_m * math.cos(rad)

                        current_scan_batch.append({
                            "angle": round(angle, 1),
                            "distance": round(dist_m, 2),
                            "x": round(x, 2),
                            "y": round(y, 2),
                            "quality": quality,
                        })

                    # 2. Cập nhật khi hoàn thành vòng quét hoặc đủ đợt 60 điểm
                    if (is_new_scan and len(current_scan_batch) >= 15) or len(current_scan_batch) >= 60:
                        with self._lock:
                            self._latest_scans = list(current_scan_batch)
                            self._update_grid_from_scan(self.robot_x, self.robot_y, self._latest_scans)
                        current_scan_batch.clear()

        except Exception as e:
            logger.error(f"Lỗi scan loop: {e}")
            self.is_connected = False
            self.is_running = False

    def get_latest_scans(self) -> List[Dict[str, Any]]:
        with self._lock:
            return list(self._latest_scans)

    def get_grid_map(self) -> Dict[str, Any]:
        with self._lock:
            return {
                "width": self.grid_width,
                "height": self.grid_height,
                "resolution": self.resolution,
                "origin_x": self.origin_x,
                "origin_y": self.origin_y,
                "grid_data": list(self.grid_data),
            }

    def send_udp_motor_command(self, cmd: str):
        """Gửi lệnh di chuyển qua UDP tới port 9999 của robot/main.py."""
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            sock.sendto(cmd.encode("utf-8"), ("127.0.0.1", 9999))
            sock.close()
        except Exception as e:
            logger.warning(f"Lỗi gửi lệnh UDP {cmd}: {e}")

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

            # Đã đến đích
            if dist_to_goal < 0.18:
                logger.info(f"🏁 ĐÃ ĐẾN ĐÍCH X={gx:.2f}m, Y={gy:.2f}m!")
                self.send_udp_motor_command("stop")
                self.status = "GOAL_REACHED"
                self.is_navigating = False
                self.active_goal = None
                break

            # Tính góc mục tiêu (trong hệ quy chiếu 0° = North, chiều kim đồng hồ)
            desired_yaw = (math.degrees(math.atan2(dx, dy)) + 360.0) % 360.0
            yaw_error = (desired_yaw - self.robot_yaw + 540.0) % 360.0 - 180.0

            # Kiểm tra vật cản phía trước bằng tia LiDAR
            scans = self.get_latest_scans()
            front_obstacle_dist = 99.0
            for pt in scans:
                ang = pt["angle"]
                # Góc phía trước robot (từ 335° qua 0° tới 25°)
                if ang >= 335 or ang <= 25:
                    if pt["distance"] < front_obstacle_dist:
                        front_obstacle_dist = pt["distance"]

            # Xử lý né vật cản an toàn
            if front_obstacle_dist < 0.40:
                logger.warning(f"⚠️ Phát hiện vật cản trước mặt cự ly {front_obstacle_dist:.2f}m! Đang rẽ tránh...")
                self.send_udp_motor_command("speed:35")
                self.send_udp_motor_command("left")
                time.sleep(0.08)
                self.send_udp_motor_command("stop")
                self.robot_yaw = (self.robot_yaw - 8.0) % 360.0
                time.sleep(0.05)
                continue

            # Điều khiển bám mục tiêu
            if abs(yaw_error) > 15.0:
                # Cần quay đầu về hướng mục tiêu (quay nhẹ nhàng bằng xung 35% công suất)
                turn_cmd = "right" if yaw_error > 0 else "left"
                self.send_udp_motor_command("speed:35")
                self.send_udp_motor_command(turn_cmd)
                time.sleep(0.07)
                self.send_udp_motor_command("stop")

                yaw_step = 7.0 if yaw_error > 0 else -7.0
                self.robot_yaw = (self.robot_yaw + yaw_step) % 360.0
                self.angular_velocity = yaw_step
                self.linear_velocity = 0.0
                time.sleep(0.04)
            else:
                # Hướng đã thẳng: Tiến thẳng về phía trước ở tốc độ ổn định
                self.send_udp_motor_command("speed:45")
                self.send_udp_motor_command("forward")
                speed_mps = 0.18  # Tốc độ tiến ~18cm/s
                rad = math.radians(self.robot_yaw)
                self.robot_x += speed_mps * dt * math.sin(rad)
                self.robot_y += speed_mps * dt * math.cos(rad)
                self.linear_velocity = speed_mps
                self.angular_velocity = 0.0
                time.sleep(dt)

        self.send_udp_motor_command("stop")

    def scan_room_360(self):
        """Quay tròn 360 độ từ tốn để quét toàn cảnh các bức tường xung quanh phòng."""
        def _scan_worker():
            self.stop_navigation()
            self.status = "SCANNING_360"
            logger.info("🔄 BẮT ĐẦU QUÉT TOÀN PHÒNG 360 ĐỘ...")
            self.send_udp_motor_command("speed:30")

            steps = 36  # 36 bước, mỗi bước ~10 độ
            for i in range(steps):
                if self.status != "SCANNING_360":
                    break
                self.send_udp_motor_command("right")
                time.sleep(0.08)
                self.send_udp_motor_command("stop")
                self.robot_yaw = (self.robot_yaw + 10.0) % 360.0
                time.sleep(0.12)  # Dừng để LiDAR quét bức tường sắc nét

            self.status = "IDLE"
            self.send_udp_motor_command("stop")
            logger.info("✅ HOÀN THÀNH QUÉT 360 ĐỘ TOÀN PHÒNG!")

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

                # Bỏ qua frontier đã thăm
                world_x = self.origin_x + (gx + 0.5) * self.resolution
                world_y = self.origin_y + (gy + 0.5) * self.resolution
                frontier_key = (round(world_x, 1), round(world_y, 1))
                if frontier_key in self.explored_frontiers:
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
            dx = target_x - self.robot_x
            dy = target_y - self.robot_y
            dist = math.hypot(dx, dy)

            if dist < goal_radius:
                self.send_udp_motor_command("stop")
                return True

            # Kiểm tra stuck (robot không di chuyển)
            stuck_counter += 1
            if stuck_counter >= stuck_check_interval:
                moved = math.hypot(self.robot_x - last_pos[0], self.robot_y - last_pos[1])
                if moved < 0.03:  # Di chuyển < 3cm trong 2 giây = stuck
                    logger.warning("⚠️ Robot bị kẹt — bỏ qua frontier này.")
                    self.send_udp_motor_command("stop")
                    return False
                last_pos = (self.robot_x, self.robot_y)
                stuck_counter = 0

            # Tính góc mục tiêu
            desired_yaw = (math.degrees(math.atan2(dx, dy)) + 360.0) % 360.0
            yaw_error = (desired_yaw - self.robot_yaw + 540.0) % 360.0 - 180.0

            # Kiểm tra vật cản
            scans = self.get_latest_scans()
            front_dist = 99.0
            for pt in scans:
                ang = pt["angle"]
                if ang >= 335 or ang <= 25:
                    if pt["distance"] < front_dist:
                        front_dist = pt["distance"]

            if front_dist < 0.35:
                # Rẽ tránh: chọn phía trống hơn
                left_dist = min((p["distance"] for p in scans if 45 <= p["angle"] <= 90), default=99.0)
                right_dist = min((p["distance"] for p in scans if 270 <= p["angle"] <= 315), default=99.0)
                turn_cmd = "left" if left_dist > right_dist else "right"
                yaw_step = -10.0 if turn_cmd == "left" else 10.0
                self.send_udp_motor_command("speed:30")
                self.send_udp_motor_command(turn_cmd)
                time.sleep(0.08)
                self.send_udp_motor_command("stop")
                self.robot_yaw = (self.robot_yaw + yaw_step) % 360.0
                time.sleep(0.05)
                continue

            if abs(yaw_error) > 15.0:
                turn_cmd = "right" if yaw_error > 0 else "left"
                yaw_step = 8.0 if yaw_error > 0 else -8.0
                self.send_udp_motor_command("speed:30")
                self.send_udp_motor_command(turn_cmd)
                time.sleep(0.07)
                self.send_udp_motor_command("stop")
                self.robot_yaw = (self.robot_yaw + yaw_step) % 360.0
                time.sleep(0.04)
            else:
                self.send_udp_motor_command("speed:45")
                self.send_udp_motor_command("forward")
                speed_mps = 0.18
                rad = math.radians(self.robot_yaw)
                self.robot_x += speed_mps * dt * math.sin(rad)
                self.robot_y += speed_mps * dt * math.cos(rad)
                self.linear_velocity = speed_mps
                self.angular_velocity = 0.0
                time.sleep(dt)

        self.send_udp_motor_command("stop")
        return False

    def _exploration_loop(self, auto_save: bool = True, save_name: str = "auto_explored_map"):
        """Vòng lặp khám phá: tìm frontier → di chuyển → quét → lặp cho đến khi hết frontier."""
        # Quét 360 tại chỗ ban đầu
        logger.info("📡 Quét 360° tại vị trí xuất phát...")
        self.scan_room_360()
        time.sleep(5.0)  # Chờ quét xong

        max_frontiers = 200  # Giới hạn số frontier để tránh chạy vô tận
        frontier_count = 0

        while self.is_exploring and frontier_count < max_frontiers:
            frontier = self._find_frontier()

            if frontier is None:
                logger.info("🎉 KHÁM PHÁ HOÀN THÀNH — Không còn frontier chưa thăm!")
                break

            fx, fy = frontier
            frontier_count += 1
            logger.info(f"🧭 [{frontier_count}] Di chuyển tới frontier ({fx:.2f}, {fy:.2f})...")

            success = self._navigate_to_sync(fx, fy, timeout=25.0, goal_radius=0.30)
            frontier_key = (round(fx, 1), round(fy, 1))
            self.explored_frontiers.append(frontier_key)

            if success:
                # Quét tại frontier mới
                self.send_udp_motor_command("stop")
                time.sleep(0.3)
                # Quét nhỏ 90° để thu dữ liệu sắc nét hơn
                for _ in range(9):
                    if not self.is_exploring:
                        break
                    self.send_udp_motor_command("speed:25")
                    self.send_udp_motor_command("right")
                    time.sleep(0.06)
                    self.send_udp_motor_command("stop")
                    self.robot_yaw = (self.robot_yaw + 10.0) % 360.0
                    time.sleep(0.15)
            else:
                logger.warning(f"⚠️ Không đến được frontier ({fx:.2f}, {fy:.2f}) — bỏ qua.")

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
          "width": 200, "height": 200,
          "resolution": 0.05, "origin_x": -5.0, "origin_y": -5.0,
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
    return {
        "status": "ONLINE" if slam_core.is_connected else "OFFLINE",
        "is_connected": slam_core.is_connected,
        "is_running": slam_core.is_running,
        "device_info": slam_core.device_info,
        "last_error": slam_core.last_error,
    }


@app.post("/api/v1/map/connect_lidar")
async def connect_lidar():
    success = slam_core.connect()
    if success:
        slam_core.start_scanning()
        return {"status": "SUCCESS", "message": "Đã kết nối thành công RPLiDAR A1M8", "info": slam_core.device_info}
    return {"status": "FAILED", "message": slam_core.last_error or "Không thể kết nối RPLiDAR"}


@app.post("/api/v1/map/reset_map")
async def reset_map():
    slam_core.reset_map()
    return {"status": "SUCCESS", "message": "Đã xóa trắng bản đồ 2D Occupancy Grid"}


class SaveMapRequest(BaseModel):
    name: Optional[str] = "floor1_map"


@app.post("/api/v1/map/save")
async def save_map_endpoint(req: Optional[SaveMapRequest] = None):
    map_name = (req.name if req and req.name else None) or f"map_{int(time.time())}"
    res = slam_core.save_map(map_name)
    return {
        "status": "SUCCESS",
        "message": f"Đã lưu bản đồ '{map_name}' thành công (JSON + ROS 2 YAML/PGM)",
        "data": res,
    }


@app.get("/api/v1/map/saved_list")
async def get_saved_maps():
    maps = slam_core.list_saved_maps()
    return {"status": "SUCCESS", "maps": maps, "count": len(maps)}


class LoadMapRequest(BaseModel):
    name: str


@app.post("/api/v1/map/load")
async def load_map_endpoint(req: LoadMapRequest):
    ok = slam_core.load_map(req.name)
    if ok:
        return {"status": "SUCCESS", "message": f"Đã nạp bản đồ '{req.name}' vào hệ thống"}
    return {"status": "FAILED", "message": f"Không tìm thấy hoặc không đọc được bản đồ '{req.name}'"}


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
    speed: Optional[int] = 45


@app.post("/api/v1/map/teleop")
async def teleop_control(req: TeleopCommandRequest):
    slam_core.stop_navigation()
    cmd = req.command.lower()
    if cmd == "stop":
        slam_core.send_udp_motor_command("stop")
        slam_core.linear_velocity = 0.0
        slam_core.angular_velocity = 0.0
    elif cmd in ["left", "right"]:
        spd = req.speed or 35
        slam_core.send_udp_motor_command(f"speed:{spd}")
        slam_core.send_udp_motor_command(cmd)
        yaw_step = 8.0 if cmd == "right" else -8.0
        slam_core.robot_yaw = (slam_core.robot_yaw + yaw_step) % 360.0
    elif cmd in ["forward", "backward"]:
        spd = req.speed or 45
        slam_core.send_udp_motor_command(f"speed:{spd}")
        slam_core.send_udp_motor_command(cmd)
        step_m = 0.08 if cmd == "forward" else -0.08
        rad = math.radians(slam_core.robot_yaw)
        slam_core.robot_x += step_m * math.sin(rad)
        slam_core.robot_y += step_m * math.cos(rad)
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


# ─── STATIC OVERLAY MAP ──────────────────────────────────────────────────────

@app.post("/api/v1/map/overlay/load")
async def load_overlay(req: OverlayLoadRequest):
    safe_name = "".join(c for c in req.map_name if c.isalnum() or c in ("_", "-")).strip()
    overlay_path = os.path.join(MAPS_DIR, f"{safe_name}.json")
    ok = slam_core.load_overlay_map(overlay_path)
    if ok:
        return {"status": "SUCCESS", "message": f"Đã nạp overlay map '{safe_name}'",
                "waypoints": slam_core._overlay_waypoints,
                "zones": slam_core._overlay_zones}
    return {"status": "FAILED", "message": f"Không tìm thấy overlay map '{safe_name}'"}


@app.post("/api/v1/map/overlay/disable")
async def disable_overlay():
    slam_core._overlay_active = False
    return {"status": "SUCCESS", "message": "Đã tắt overlay map"}


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

    if not slam_core.is_running:
        if slam_core.connect():
            slam_core.start_scanning()

    try:
        while True:
            scans = slam_core.get_latest_scans()
            map_data = slam_core.get_grid_map()

            payload = {
                "type": "telemetry_update",
                "source": "REAL_RPLIDAR_A1M8_PI5",
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
                "grid_data": slam_core.merge_maps() if slam_core._overlay_active else map_data["grid_data"],
                "grid_metadata": {
                    "width": map_data["width"],
                    "height": map_data["height"],
                    "resolution": map_data["resolution"],
                    "origin_x": map_data["origin_x"],
                    "origin_y": map_data["origin_y"],
                },
            }

            await websocket.send_text(json.dumps(payload))
            await asyncio.sleep(0.04)  # 25 Hz

    except WebSocketDisconnect:
        logger.info("🔌 Web Admin LiDAR Canvas ngắt kết nối WebSocket")


def run_lidar_server(host="0.0.0.0", port=8000):
    slam_core.connect()
    slam_core.start_scanning()
    uvicorn.run(app, host=host, port=port, log_level="warning")


if __name__ == "__main__":
    run_lidar_server()
