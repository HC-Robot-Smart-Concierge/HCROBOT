"""
Dịch vụ LiDAR SLAM & WebSocket Streaming cho HC-Robot trên Raspberry Pi 5.
Tự động kết nối RPLiDAR A1M8, thực hiện Raytracing 2D Occupancy Grid và phát stream WebSocket tới Web Admin.
"""

import asyncio
import glob
import json
import logging
import math
import os
import threading
import time
from typing import Any, Dict, List, Optional

import serial
import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(level=logging.INFO, format="[%(asctime)s] [%(levelname)s] [LiDAR] %(message)s")
logger = logging.getLogger("RPLidarService")


def find_rplidar_port() -> str:
    """Tự động tìm kiếm cổng Serial của RPLiDAR (ưu tiên CP2102 UART Bridge)."""
    # 1. Kiểm tra qua by-id
    by_id_matches = glob.glob("/dev/serial/by-id/*CP2102*") + glob.glob("/dev/serial/by-id/*Silicon_Labs*")
    if by_id_matches:
        real_path = os.path.realpath(by_id_matches[0])
        logger.info(f"Tìm thấy RPLiDAR qua by-id: {by_id_matches[0]} -> {real_path}")
        return real_path

    # 2. Kiểm tra biến môi trường
    env_port = os.getenv("LIDAR_PORT")
    if env_port and os.path.exists(env_port):
        return env_port

    # 3. Quét các cổng ttyUSB có sẵn (ưu tiên ttyUSB1 nếu ttyUSB0 là CH340)
    for p in ["/dev/ttyUSB1", "/dev/ttyUSB0", "/dev/ttyUSB2", "/dev/ttyACM0"]:
        if os.path.exists(p):
            return p

    return "/dev/ttyUSB1"


class RPLidarSLAMCore:
    """Quản lý giao tiếp phần cứng RPLiDAR A1M8 và thuật toán dựng bản đồ 2D Occupancy Grid."""

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
            "firmware": "Unknown",
            "hardware": "Unknown",
            "serialnumber": "Unknown",
            "health": "Unknown",
        }

        # Dữ liệu tia quét
        self._lock = threading.Lock()
        self._latest_scans: List[Dict[str, Any]] = []
        self._points_count = 0
        self._scan_thread: Optional[threading.Thread] = None

        # Bản đồ 2D Occupancy Grid: 200x200 ô, 5cm/pixel => 10m x 10m
        self.grid_width = 200
        self.grid_height = 200
        self.resolution = 0.05
        self.origin_x = -5.0
        self.origin_y = -5.0
        self.grid_data = [-1] * (self.grid_width * self.grid_height)

        # Tọa độ Robot hiện tại
        self.robot_x = 0.0
        self.robot_y = 0.0
        self.robot_yaw = 0.0

    def reset_map(self):
        """Xóa trắng bản đồ về trạng thái ban đầu."""
        with self._lock:
            self.grid_data = [-1] * (self.grid_width * self.grid_height)
        logger.info("🧹 Đã làm sạch bản đồ Occupancy Grid 2D")

    def _world_to_grid(self, x: float, y: float):
        gx = int((x - self.origin_x) / self.resolution)
        gy = int((y - self.origin_y) / self.resolution)
        return gx, gy

    def _update_grid_from_scan(self, rx: float, ry: float, scan_points: List[Dict[str, Any]]):
        """Thuật toán Raytracing cập nhật bản đồ không gian 2D từ luồng tia laser."""
        gx_robot, gy_robot = self._world_to_grid(rx, ry)

        for pt in scan_points:
            ox, oy = self._world_to_grid(pt["x"], pt["y"])

            # Bresenham raytracing
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
                    if curr_x == ox and curr_y == oy:
                        # Điểm va chạm vật cản / tường
                        self.grid_data[idx] = 100
                        break
                    else:
                        # Vùng không gian trống
                        if self.grid_data[idx] != 100:
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
        """Mở cổng Serial và bắt tay handshake với RPLiDAR A1M8."""
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

            # Gửi lệnh STOP ngắt quét cũ
            self.ser.write(b"\xa5\x25")
            time.sleep(0.1)
            self.ser.reset_input_buffer()
            self.ser.reset_output_buffer()

            # Lấy thông tin thiết bị (GET_INFO: 0xA5 0x50)
            self.ser.write(b"\xa5\x50")
            time.sleep(0.1)
            desc_info = self.ser.read(7)
            if len(desc_info) == 7 and desc_info[:2] == b"\xa5\x5a":
                info = self.ser.read(20)
                if len(info) >= 20:
                    self.device_info["model"] = f"RPLiDAR (Model {info[0]})"
                    self.device_info["firmware"] = f"{info[2]}.{info[1]}"
                    self.device_info["hardware"] = f"{info[3]}"
                    self.device_info["serialnumber"] = info[4:].hex().upper()

            # Lấy sức khỏe cảm biến (GET_HEALTH: 0xA5 0x52)
            self.ser.write(b"\xa5\x52")
            time.sleep(0.05)
            desc_health = self.ser.read(7)
            if len(desc_health) == 7 and desc_health[:2] == b"\xa5\x5a":
                health_data = self.ser.read(3)
                if len(health_data) >= 3:
                    h_status = health_data[0]
                    self.device_info["health"] = "Good" if h_status == 0 else f"Warning({h_status})"

            # Khởi động quay motor (PWM)
            try:
                self.ser.write(b"\xa5\xf0\x02\x94\x02\xc5")
                time.sleep(0.1)
            except Exception:
                pass

            self.is_connected = True
            self.last_error = ""
            logger.info(f"✅ Đã kết nối RPLiDAR A1M8 trên {self.port} thành công! Health: {self.device_info['health']}")
            return True

        except Exception as e:
            self.is_connected = False
            self.last_error = str(e)
            logger.error(f"❌ Không thể kết nối RPLiDAR trên {self.port}: {e}")
            return False

    def start_scanning(self):
        """Khởi động luồng quét liên tục."""
        if self.is_running:
            return
        if not self.is_connected and not self.connect():
            return

        self.is_running = True
        self._scan_thread = threading.Thread(target=self._scan_loop, daemon=True)
        self._scan_thread.start()
        logger.info("🚀 Luồng quét LiDAR SLAM đã bắt đầu hoạt động")

    def stop(self):
        """Dừng quét và đóng cổng."""
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
        """Vòng lặp đọc dữ liệu tia quét thời gian thực."""
        try:
            if not self.ser or not self.ser.is_open:
                return

            self.ser.write(b"\xa5\x20")
            time.sleep(0.1)
            # Bỏ qua 7 byte descriptor header
            self.ser.read(7)

            buf = bytearray()
            current_scan_batch = []
            last_heading = 0.0

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

                    # Check bit logic
                    if s == not_s or not (b1 & 0x01):
                        buf.pop(0)
                        continue

                    packet = buf[:5]
                    del buf[:5]

                    quality = packet[0] >> 2
                    angle_q6 = (packet[1] >> 1) | (packet[2] << 7)
                    angle = angle_q6 / 64.0
                    distance_q2 = packet[3] | (packet[4] << 8)
                    dist_m = (distance_q2 / 4.0) / 1000.0

                    if 0.15 <= dist_m <= 12.0:
                        rad = math.radians(angle + self.robot_yaw)
                        x = self.robot_x + dist_m * math.sin(rad)
                        y = self.robot_y + dist_m * math.cos(rad)

                        current_scan_batch.append({
                            "angle": round(angle, 1),
                            "distance": round(dist_m, 3),
                            "x": round(x, 3),
                            "y": round(y, 3),
                            "quality": quality,
                        })

                    # Khi hoàn thành một vòng quét 360 độ (nhận diện góc quay về 0)
                    if angle < last_heading and len(current_scan_batch) >= 150:
                        with self._lock:
                            self._latest_scans = list(current_scan_batch)
                            self._update_grid_from_scan(self.robot_x, self.robot_y, self._latest_scans)
                        current_scan_batch.clear()

                    last_heading = angle

        except Exception as e:
            logger.error(f"Lỗi vòng lặp quét LiDAR: {e}")
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


# Khởi tạo singleton Core
slam_core = RPLidarSLAMCore()

# Khởi tạo FastAPI Server cho Web Admin
app = FastAPI(title="HC-Robot Pi5 LiDAR SLAM Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
                    "x": slam_core.robot_x,
                    "y": slam_core.robot_y,
                    "yaw": slam_core.robot_yaw,
                },
                "battery": 98,
                "linear_velocity": 0.0,
                "angular_velocity": 0.0,
                "status": "SCANNING_ACTIVE" if slam_core.is_running else "IDLE",
                "scan_points": scans,
                "grid_data": map_data["grid_data"],
                "grid_metadata": {
                    "width": map_data["width"],
                    "height": map_data["height"],
                    "resolution": map_data["resolution"],
                    "origin_x": map_data["origin_x"],
                    "origin_y": map_data["origin_y"],
                },
            }

            await websocket.send_text(json.dumps(payload))
            await asyncio.sleep(0.04)  # 25 Hz update rate

    except WebSocketDisconnect:
        logger.info("🔌 Web Admin LiDAR Canvas ngắt kết nối WebSocket")


def run_lidar_server(host="0.0.0.0", port=8000):
    """Hàm khởi chạy server uvicorn."""
    slam_core.connect()
    slam_core.start_scanning()
    uvicorn.run(app, host=host, port=port, log_level="warning")


if __name__ == "__main__":
    run_lidar_server()
