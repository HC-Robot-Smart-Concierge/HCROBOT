"""Script kiểm tra encoder & điều khiển thủ công motor từ Raspberry Pi.

Hỗ trợ 2 chế độ:
1. Chế độ GIÁM SÁT (mặc định):
   python3 test_esp32_motors.py --port /dev/ttyUSB0
   -> Đọc và in bảng RPM, Ticks của 4 encoder theo thời gian thực (xoay bánh bằng tay).

2. Chế độ ĐIỀU KHIỂN THỦ CÔNG (WASD):
   python3 test_esp32_motors.py --port /dev/ttyUSB0 --control
   -> Bấm phím W/S/A/D để bật/tắt motor trên Pi và xem số xung encoder nhảy ngay lập tức.
"""

import argparse
import json
import time
import sys
import serial
from ultrasonic_serial import detect_esp32_port

try:
    from motor_controller import MotorController, get_char
    HAS_PI_MOTOR = True
except Exception:
    HAS_PI_MOTOR = False
    get_char = None


def run_interactive_suite(port: str, baud: int = 115200, enable_control: bool = False):
    print("=" * 75)
    print(f"  BỘ TEST & GIÁM SÁT 4 ENCODER + MOTOR ({port} @ {baud})")
    print("  Encoder M1: GPIO 4/5 | M2: GPIO 13/14 | M3: GPIO 16/17 | M4: GPIO 23/27")
    print("=" * 75)

    try:
        ser = serial.Serial(port, baud, timeout=0.1)
        time.sleep(0.5)
    except Exception as e:
        print(f"[LỖI] Không thể mở cổng Serial {port}: {e}")
        return

    # Bật debug mode trên ESP32
    ser.write(b"DEBUG:1\n")

    pi_motor = None
    if enable_control:
        if HAS_PI_MOTOR:
            print("[INFO] Khởi tạo MotorController trên Raspberry Pi (BCM 17, 27, 22, 23)...")
            try:
                pi_motor = MotorController(left_forward_pin=17, left_backward_pin=27,
                                           right_forward_pin=22, right_backward_pin=23)
                print("[OK] Đã kết nối phần cứng Motor L298N trên Pi.")
                print("\n  [PHÍM ĐIỀU KHIỂN]")
                print("  [W] TIẾN          [S] LÙI          [A] XOAY TRÁI     [D] XOAY PHẢI")
                print("  [X / Space] DỪNG                   [Q] THOÁT")
            except Exception as e:
                print(f"[!] Không mở được chân motor trên Pi: {e}")
                pi_motor = None
        else:
            print("[!] Chưa tìm thấy thư viện điều khiển motor trên Pi.")

    if not pi_motor:
        print("\n[CHẾ ĐỘ MONITOR] Dùng tay xoay từng bánh xe để kiểm tra encoder.")
        print("Nhấn CTRL+C để thoát.\n")

    print("-" * 88)
    print(f"{'MOTOR 1 (Trái)':<20} | {'MOTOR 2 (Trái)':<20} | {'MOTOR 3 (Phải)':<20} | {'MOTOR 4 (Phải)':<20}")
    print("-" * 88)

    last_print_time = 0
    current_action = "STOPPED"

    try:
        while True:
            # 1. Đọc phím điều khiển nếu bật chế độ control
            if pi_motor and get_char:
                ch = get_char()
                if ch:
                    k = ch.lower()
                    if k in ('w', '8'):
                        pi_motor.move_forward()
                        current_action = "FORWARD (TIẾN)"
                    elif k in ('s', '2'):
                        pi_motor.move_backward()
                        current_action = "BACKWARD (LÙI)"
                    elif k in ('a', '4'):
                        pi_motor.turn_left()
                        current_action = "TURN LEFT (XOAY TRÁI)"
                    elif k in ('d', '6'):
                        pi_motor.turn_right()
                        current_action = "TURN RIGHT (XOAY PHẢI)"
                    elif k in ('x', '5', ' '):
                        pi_motor.stop()
                        current_action = "STOPPED (DỪNG)"
                    elif k == 'q':
                        print("\nThoát chương trình...")
                        break

            # 2. Đọc gói tin Serial từ ESP32
            line = ser.readline().decode('utf-8', errors='ignore').strip()
            if not line:
                continue

            if line.startswith("{"):
                try:
                    data = json.loads(line)
                    encs = data.get("encoders")
                    if encs and (time.time() - last_print_time >= 0.12):
                        last_print_time = time.time()
                        m1 = encs.get("m1", {})
                        m2 = encs.get("m2", {})
                        m3 = encs.get("m3", {})
                        m4 = encs.get("m4", {})

                        s1 = f"{m1.get('rpm', 0.0):>5.1f} RPM ({m1.get('ticks', 0):>6d})"
                        s2 = f"{m2.get('rpm', 0.0):>5.1f} RPM ({m2.get('ticks', 0):>6d})"
                        s3 = f"{m3.get('rpm', 0.0):>5.1f} RPM ({m3.get('ticks', 0):>6d})"
                        s4 = f"{m4.get('rpm', 0.0):>5.1f} RPM ({m4.get('ticks', 0):>6d})"

                        status_suffix = f"  [{current_action}]" if pi_motor else ""
                        sys.stdout.write(f"\r{s1:<20} | {s2:<20} | {s3:<20} | {s4:<20}{status_suffix}   ")
                        sys.stdout.flush()
                except Exception:
                    pass

    except KeyboardInterrupt:
        print("\n\n[!] Dừng chương trình.")
    finally:
        if pi_motor:
            pi_motor.stop()
            pi_motor.cleanup()
        ser.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Test 4 encoders and manual motor control")
    parser.add_argument("--port", default="auto", help="Serial port (auto or /dev/ttyUSB0)")
    parser.add_argument("--baud", type=int, default=115200, help="Baud rate (default 115200)")
    parser.add_argument("--control", action="store_true", help="Bật chế độ điều khiển thủ công bằng phím WASD")
    args = parser.parse_args()

    port = args.port
    if port == "auto":
        port = detect_esp32_port()
        if not port:
            print("[LỖI] Không tìm thấy ESP32 tự động. Vui lòng chỉ định --port /dev/ttyUSB0.")
            sys.exit(1)

    run_interactive_suite(port, args.baud, args.control)
