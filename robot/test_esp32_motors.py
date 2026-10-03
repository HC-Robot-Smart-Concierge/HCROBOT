"""Script kiểm tra encoder & telemetry ESP32 từ Raspberry Pi.

Hỗ trợ:
1. Chế độ MONITOR (mặc định): Đọc và hiển thị xung Encoder M1..M4, Ultrasonic, MPU từ ESP32 theo thời gian thực.
2. Chế độ DRIVE TEST (--drive-pi): Bật motor chạy từ chân GPIO Pi (L298N) và đọc xung phản hồi từ ESP32.

Chạy trên Raspberry Pi:
    python3 test_esp32_motors.py --port /dev/ttyUSB0
    python3 test_esp32_motors.py --port /dev/ttyUSB0 --drive-pi
"""

import argparse
import json
import time
import sys
import serial
from ultrasonic_serial import detect_esp32_port

try:
    from motor_controller import MotorController
    HAS_PI_MOTOR = True
except Exception:
    HAS_PI_MOTOR = False


def monitor_encoders(port: str, baud: int = 115200, drive_pi: bool = False):
    print("=" * 70)
    print(f"  GIÁM SÁT 4 ENCODER ESP32 ({port} @ {baud})")
    print("  M1: GPIO 4/5 | M2: GPIO 13/14 | M3: GPIO 16/17 | M4: GPIO 23/27")
    print("=" * 70)

    try:
        ser = serial.Serial(port, baud, timeout=0.2)
        time.sleep(1.0)
    except Exception as e:
        print(f"[LỖI] Không thể mở cổng Serial {port}: {e}")
        return

    # Bật debug mode
    ser.write(b"DEBUG:1\n")

    pi_motor = None
    if drive_pi and HAS_PI_MOTOR:
        print("[INFO] Khởi tạo MotorController trên Raspberry Pi (BCM 17, 27, 22, 23)...")
        try:
            pi_motor = MotorController(left_forward_pin=17, left_backward_pin=27,
                                       right_forward_pin=22, right_backward_pin=23)
            print("[OK] Đã kết nối phần cứng Motor L298N trên Pi.")
        except Exception as e:
            print(f"[!] Không khởi tạo được motor trên Pi: {e}")
            pi_motor = None

    print("\n[HƯỚNG DẪN] Bạn hãy dùng tay XOAY TỪNG BÁNH XE để thấy số ticks và RPM thay đổi!")
    print("Nhấn CTRL+C để dừng chương trình bất cứ lúc nào.\n")
    print(f"{'MOTOR 1 (4,5)':<20} | {'MOTOR 2 (13,14)':<20} | {'MOTOR 3 (16,17)':<20} | {'MOTOR 4 (23,27)':<20}")
    print("-" * 88)

    last_print_time = 0

    try:
        if pi_motor:
            print("\n--> [TEST PI MOTOR] Cho motor chạy TIẾN trong 3 giây...")
            pi_motor.move_forward()

        start_time = time.time()
        while True:
            # Nếu đang chạy test drive pi, tự dừng sau 3s
            if pi_motor and (time.time() - start_time > 3.0):
                pi_motor.stop()
                print("\n--> [TEST PI MOTOR] Đã dừng motor.")
                pi_motor = None

            line = ser.readline().decode('utf-8', errors='ignore').strip()
            if not line:
                continue

            if line.startswith("{"):
                try:
                    data = json.loads(line)
                    encs = data.get("encoders")
                    if encs and (time.time() - last_print_time >= 0.15):
                        last_print_time = time.time()
                        m1 = encs.get("m1", {})
                        m2 = encs.get("m2", {})
                        m3 = encs.get("m3", {})
                        m4 = encs.get("m4", {})

                        s1 = f"{m1.get('rpm', 0.0):>5.1f} RPM ({m1.get('ticks', 0):>6d})"
                        s2 = f"{m2.get('rpm', 0.0):>5.1f} RPM ({m2.get('ticks', 0):>6d})"
                        s3 = f"{m3.get('rpm', 0.0):>5.1f} RPM ({m3.get('ticks', 0):>6d})"
                        s4 = f"{m4.get('rpm', 0.0):>5.1f} RPM ({m4.get('ticks', 0):>6d})"

                        sys.stdout.write(f"\r{s1:<20} | {s2:<20} | {s3:<20} | {s4:<20}")
                        sys.stdout.flush()
                except Exception:
                    pass

    except KeyboardInterrupt:
        print("\n\n[!] Dừng giám sát.")
    finally:
        if pi_motor:
            pi_motor.stop()
            pi_motor.cleanup()
        ser.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Monitor 4 encoders from ESP32")
    parser.add_argument("--port", default="auto", help="Serial port (auto or /dev/ttyUSB0)")
    parser.add_argument("--baud", type=int, default=115200, help="Baud rate (default 115200)")
    parser.add_argument("--drive-pi", action="store_true", help="Bật motor từ Raspberry Pi trong 3 giây để test encoder")
    args = parser.parse_args()

    port = args.port
    if port == "auto":
        port = detect_esp32_port()
        if not port:
            print("[LỖI] Không tìm thấy ESP32 tự động. Vui lòng chỉ định --port /dev/ttyUSB0.")
            sys.exit(1)

    monitor_encoders(port, args.baud, args.drive_pi)
