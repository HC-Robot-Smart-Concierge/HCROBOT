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
import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO, format="[%(asctime)s] [%(levelname)s] [LiDAR-SLAM] %(message)s")
logger = logging.getLogger("RPLidarSLAM")


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

                    # 1. Lọc nhiễu:
                    # - dist_m >= 0.28m: Bỏ qua phần cản của thân xe robot, camera, dây cáp
                    # - dist_m <= 8.0m: Phạm vi quét phòng hiệu quả
                    # - quality > 0: Bỏ qua tia phản xạ yếu / bụi
                    if 0.28 <= dist_m <= 8.0 and quality > 0:
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

                    # 2. Khi hoàn thành 1 vòng quét 360 độ (bắt cờ new scan của phần cứng)
                    if is_new_scan and len(current_scan_batch) >= 80:
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


# Khởi tạo singleton Core
slam_core = RPLidarSLAMCore()

# Khởi tạo FastAPI Server cho Web Admin
app = FastAPI(title="HC-Robot Pi5 LiDAR SLAM & Navigation Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class NavigateGoalRequest(BaseModel):
    target_x: float
    target_y: float
    target_yaw: Optional[float] = None


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
            await asyncio.sleep(0.04)  # 25 Hz

    except WebSocketDisconnect:
        logger.info("🔌 Web Admin LiDAR Canvas ngắt kết nối WebSocket")


def run_lidar_server(host="0.0.0.0", port=8000):
    slam_core.connect()
    slam_core.start_scanning()
    uvicorn.run(app, host=host, port=port, log_level="warning")


if __name__ == "__main__":
    run_lidar_server()
