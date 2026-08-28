import math
import os
import threading
import time
import logging
import serial
from typing import Dict, List, Any, Optional

logger = logging.getLogger(__name__)

class RPLidarService:
    def __init__(self, port: str = "COM9", baudrate: int = 115200):
        self.port = os.getenv("LIDAR_PORT", port)
        self.baudrate = int(os.getenv("LIDAR_BAUDRATE", baudrate))
        self.ser: Optional[serial.Serial] = None
        self.is_connected = False
        self.is_running = False
        self.device_info = {"port": self.port, "model": "RPLiDAR A1/A2", "serialnumber": "CP210x_COM9"}
        self.last_error = ""
        self._latest_scans: List[Dict[str, Any]] = []
        self._lock = threading.Lock()
        self._thread: Optional[threading.Thread] = None

        # Cấu trúc 2D Occupancy Grid Map (200x200 cells, độ phân giải 0.05m = 10m x 10m)
        self.grid_width = 200
        self.grid_height = 200
        self.resolution = 0.05  # 5cm / pixel
        self.origin_x = -5.0
        self.origin_y = -5.0
        self.grid_data = [-1] * (self.grid_width * self.grid_height)

    def reset_grid_map(self):
        """Xóa trắng bản đồ 2D để tiến hành quét SLAM lại từ đầu"""
        with self._lock:
            self.grid_data = [-1] * (self.grid_width * self.grid_height)
        logger.info("🧹 Đã xóa trắng bản đồ 2D Occupancy Grid")

    def _world_to_grid(self, x: float, y: float):
        gx = int((x - self.origin_x) / self.resolution)
        gy = int((y - self.origin_y) / self.resolution)
        return gx, gy

    def _update_grid_from_scan(self, robot_x: float, robot_y: float, scan_points: List[Dict[str, Any]]):
        """Thuật toán Raytracing cập nhật bản đồ không gian 2D từ luồng tia laser"""
        rx, ry = self._world_to_grid(robot_x, robot_y)

        for pt in scan_points:
            ox, oy = self._world_to_grid(pt["x"], pt["y"])
            
            # Dùng thuật toán Bresenham dựng đường đi tia laser
            dx = abs(ox - rx)
            dy = abs(oy - ry)
            sx = 1 if rx < ox else -1
            sy = 1 if ry < oy else -1
            err = dx - dy

            curr_x, curr_y = rx, ry
            max_steps = 400
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
                        # Vùng không gian trống mà tia laser đi qua
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
        """Mở cổng Serial và bật motor cấp nguồn RPLiDAR kèm Handshake GET_INFO"""
        if self.is_connected and self.ser and self.ser.is_open:
            return True

        self.stop()

        try:
            logger.info(f"🔌 Đang mở cổng Serial {self.port} (Baudrate {self.baudrate})...")
            self.ser = serial.Serial(self.port, self.baudrate, timeout=0.02)
            
            # Kích hoạt chân DTR & RTS cấp nguồn bật motor RPLiDAR
            self.ser.dtr = False
            self.ser.rts = False
            time.sleep(0.15)

            # Gửi lệnh STOP ngắt các chuỗi quét thừa
            self.ser.write(b'\xa5\x25')
            time.sleep(0.15)
            self.ser.reset_input_buffer()
            self.ser.reset_output_buffer()

            # Handshake check: Gửi lệnh GET_INFO (0xA5 0x50)
            self.ser.write(b'\xa5\x50')
            time.sleep(0.15)
            handshake_resp = self.ser.read(27)

            if len(handshake_resp) == 0 or handshake_resp[0] != 0xA5:
                # Không nhận được phản hồi từ phần cứng RPLiDAR
                self.ser.close()
                self.ser = None
                self.is_connected = False
                self.last_error = f"Cổng {self.port} đã mở thành công nhưng không có phản hồi từ cảm biến RPLiDAR thực tế (Hardware Offline)"
                logger.warning(f"⚠️ {self.last_error}")
                return False

            # Gửi lệnh SET_PWM (Default 660 PWM) cho mô tơ quay
            try:
                self.ser.write(b'\xa5\xf0\x02\x94\x02\xc5')
                time.sleep(0.1)
            except Exception:
                pass

            self.is_connected = True
            self.last_error = ""
            logger.info(f"✅ Kết nối cổng Serial {self.port} thành công với phần cứng RPLiDAR!")
            return True

        except Exception as e:
            err_msg = str(e)
            if "Access is denied" in err_msg or "PermissionError" in err_msg:
                self.last_error = f"Cổng {self.port} đang bị giữ bởi tiến trình khác (Access Denied)"
            else:
                self.last_error = f"Không thể mở cổng {self.port}: {err_msg}"

            logger.warning(f"⚠️ {self.last_error}")
            self.is_connected = False
            return False

    def start_scanning(self):
        """Khởi chạy Thread đọc luồng quét thực tế từ phần cứng RPLiDAR"""
        if self.is_running:
            return

        if not self.is_connected:
            if not self.connect():
                return

        self.is_running = True
        self._thread = threading.Thread(target=self._scan_loop, daemon=True)
        self._thread.start()
        logger.info(f"🚀 Đã bật Thread đọc luồng RPLiDAR thực tế trên {self.port}")

    def _scan_loop(self):
        """Vòng lặp đọc dữ liệu tia quét THỰC TẾ với bóc tách 5-byte protocol tiêu chuẩn"""
        try:
            if not self.ser or not self.ser.is_open:
                return

            # Gửi lệnh SCAN (0xA5 0x20)
            self.ser.write(b'\xa5\x20')
            time.sleep(0.15)

            # Đọc 7 byte Descriptor Header (0xA5 0x5A 0x05 0x00 0x00 0x40 0x81)
            desc = self.ser.read(7)
            if len(desc) < 7 or desc[0] != 0xA5 or desc[1] != 0x5A:
                logger.warning("⚠️ Không nhận được Descriptor Header của RPLiDAR Scan mode")

            buf = bytearray()
            current_scan = []

            while self.is_running and self.is_connected and self.ser and self.ser.is_open:
                chunk = self.ser.read(512)
                if not chunk:
                    time.sleep(0.005)
                    continue
                buf.extend(chunk)

                # Slide window qua mảng byte buffer
                while len(buf) >= 5:
                    b0 = buf[0]
                    b1 = buf[1]

                    new_scan = bool(b0 & 0x01)
                    inversed_new_scan = bool((b0 >> 1) & 0x01)
                    check_bit = b1 & 0x01

                    # Đảm bảo header hợp lệ của gói 5-byte
                    if (new_scan != inversed_new_scan) and (check_bit == 1):
                        b2 = buf[2]
                        b3 = buf[3]
                        b4 = buf[4]

                        quality = b0 >> 2
                        angle_q6 = (b1 >> 1) | (b2 << 7)
                        angle = angle_q6 / 64.0
                        distance_q2 = b3 | (b4 << 8)
                        distance_mm = distance_q2 / 4.0

                        # Nhận điểm khi khoảng cách hợp lệ (0.05m đến 12m)
                        if 0.05 <= (distance_mm / 1000.0) <= 12.0:
                            dist_m = round(distance_mm / 1000.0, 3)
                            rad = math.radians(angle)
                            x = round(dist_m * math.cos(rad), 3)
                            y = round(dist_m * math.sin(rad), 3)

                            current_scan.append({
                                "angle": round(angle, 1),
                                "distance": dist_m,
                                "quality": quality,
                                "x": x,
                                "y": y
                            })

                            # Cập nhật danh sách điểm quét mới nhất & tự động vẽ bản đồ 2D Grid
                            if new_scan or len(current_scan) >= 60:
                                with self._lock:
                                    self._latest_scans = list(current_scan)
                                    self._update_grid_from_scan(0.0, 0.0, current_scan)
                                if new_scan:
                                    current_scan = []

                        del buf[:5]
                    else:
                        del buf[0]

        except Exception as e:
            logger.error(f"Lỗi trong vòng lặp đọc luồng RPLiDAR: {e}")
            self.last_error = str(e)
        finally:
            self.stop()

    def get_latest_scans(self) -> List[Dict[str, Any]]:
        with self._lock:
            return list(self._latest_scans)

    def get_grid_map_data(self) -> Dict[str, Any]:
        with self._lock:
            return {
                "width": self.grid_width,
                "height": self.grid_height,
                "resolution": self.resolution,
                "origin_x": self.origin_x,
                "origin_y": self.origin_y,
                "grid_data": list(self.grid_data)
            }

    def get_status(self) -> Dict[str, Any]:
        source = "REAL_RPLIDAR_HARDWARE" if self.is_connected else "NO_HARDWARE_CONNECTED"
        return {
            "is_connected": self.is_connected,
            "is_running": self.is_running,
            "source": source,
            "scan_point_count": len(self.get_latest_scans()),
            "device_info": self.device_info,
            "last_error": self.last_error
        }

    def stop(self):
        self.is_running = False
        if self.ser:
            try:
                self.ser.write(b'\xa5\x25')  # STOP
                self.ser.dtr = True          # Tắt motor
                self.ser.close()
            except Exception:
                pass
            self.ser = None
        self.is_connected = False
        logger.info("🛑 Đã dừng và đóng cổng Serial RPLiDAR")

# Singleton instance
rplidar_service = RPLidarService(port="COM9")
