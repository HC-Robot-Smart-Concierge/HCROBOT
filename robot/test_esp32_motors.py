"""Script kiểm tra encoder, điều khiển thủ công và TỰ ĐỘNG PHANH DỪNG KHI CÓ VẬT CẢN.

Hỗ trợ:
1. Chế độ GIÁM SÁT (mặc định):
   python3 test_esp32_motors.py --port /dev/ttyUSB0
   -> Xem khoảng cách 4 cảm biến siêu âm (F, R, L, R) và số xung / RPM 4 encoder.

2. Chế độ LÁI THỦ CÔNG CÓ AN TOÀN VẬT CẢN (WASD):
   python3 test_esp32_motors.py --port /dev/ttyUSB0 --control
   -> Bấm W/S/A/D để lái xe. Nếu gặp vật cản (Phía trước <= 35cm, Phía sau <= 35cm, Trái/Phải <= 20cm),
      xe sẽ TỰ ĐỘNG PHANH DỪNG NGAY LẬP TỨC để tránh va chạm.
"""

import argparse
import json
import time
import sys
import serial
from ultrasonic_serial import detect_esp32_port

try:
    from motor_controller import MotorController, get_char, load_config
    HAS_PI_MOTOR = True
except Exception:
    HAS_PI_MOTOR = False
    get_char = None
    load_config = None


def run_interactive_suite(port: str, baud: int = 115200, enable_control: bool = False,
                          invert_left: bool = None, invert_right: bool = None):
    print("=" * 80)
    print(f"  HỆ THỐNG GIÁM SÁT SENSOR + ENCODER + TỰ DỪNG TRÁNH VẬT CẢN ({port})")
    print("=" * 80)

    try:
        ser = serial.Serial(port, baud, timeout=0.1)
        time.sleep(0.5)
    except Exception as e:
        print(f"[LỖI] Không thể mở cổng Serial {port}: {e}")
        return

    # Bật debug mode trên ESP32
    ser.write(b"DEBUG:1\n")

    config = load_config() if load_config else {}
    gpio_cfg = config.get("robot", {}).get("gpio", {})
    safety_cfg = config.get("robot", {}).get("safety", {})

    # Ngưỡng phanh an toàn (cm)
    front_stop = safety_cfg.get("front_stop_cm", 35.0)
    rear_stop = safety_cfg.get("rear_stop_cm", 35.0)
    left_stop = safety_cfg.get("left_stop_cm", 20.0)
    right_stop = safety_cfg.get("right_stop_cm", 20.0)

    pi_motor = None
    if enable_control:
        if HAS_PI_MOTOR:
            print("[INFO] Khởi tạo MotorController trên Raspberry Pi (BCM 17, 27, 22, 23)...")
            try:
                l_fwd = gpio_cfg.get("left_forward", 17)
                l_bwd = gpio_cfg.get("left_backward", 27)
                r_fwd = gpio_cfg.get("right_forward", 22)
                r_bwd = gpio_cfg.get("right_backward", 23)

                inv_l = invert_left if invert_left is not None else gpio_cfg.get("invert_left_direction", False)
                inv_r = invert_right if invert_right is not None else gpio_cfg.get("invert_right_direction", True)

                pi_motor = MotorController(
                    left_forward_pin=l_fwd,
                    left_backward_pin=l_bwd,
                    right_forward_pin=r_fwd,
                    right_backward_pin=r_bwd,
                    invert_left_direction=inv_l,
                    invert_right_direction=inv_r,
                )
                print(f"[OK] Đã kết nối Motor L298N (invert_left={inv_l}, invert_right={inv_r}).")
                print(f"[SAFETY] Ngưỡng phanh dừng: Trước <={front_stop}cm | Sau <={rear_stop}cm | Hông <={left_stop}cm")
                print("\n  [BÀN PHÍM LÁI XE]")
                print("  [W] TIẾN          [S] LÙI          [A] XOAY TRÁI     [D] XOAY PHẢI")
                print("  [X / Space] DỪNG                   [Q] THOÁT")
            except Exception as e:
                print(f"[!] Không mở được chân motor trên Pi: {e}")
                pi_motor = None
        else:
            print("[!] Chưa tìm thấy thư viện điều khiển motor trên Pi.")

    if not pi_motor:
        print("\n[CHẾ ĐỘ MONITOR] Giám sát khoảng cách siêu âm & xung encoder.")
        print("Nhấn CTRL+C để thoát.\n")

    print("-" * 92)
    print(f"{'M1 (Trái)':<18} | {'M2 (Trái)':<18} | {'M3 (Phải)':<18} | {'M4 (Phải)':<18} | KHOẢNG CÁCH (F/R/L/R)")
    print("-" * 92)

    last_print_time = 0
    current_action = "STOPPED"
    dist_front = None
    dist_rear = None
    dist_left = None
    dist_right = None

    try:
        while True:
            # 1. Đọc dữ liệu cảm biến & encoder từ ESP32
            line = ser.readline().decode('utf-8', errors='ignore').strip()

            if line and line.startswith("{"):
                try:
                    data = json.loads(line)
                    dist_front = data.get("front")
                    dist_rear = data.get("rear")
                    dist_left = data.get("left")
                    dist_right = data.get("right")

                    # KIỂM TRA AN TOÀN VẬT CẢN (TỰ DỪNG XE NGAY KHI PHÁT HIỆN)
                    if pi_motor and pi_motor.motion != "stop":
                        if pi_motor.motion == "forward" and dist_front is not None and dist_front <= front_stop:
                            pi_motor.stop()
                            current_action = f"PHANH DỪNG! CẢN TRƯỚC {dist_front}cm <= {front_stop}cm"

                        elif pi_motor.motion == "backward" and dist_rear is not None and dist_rear <= rear_stop:
                            pi_motor.stop()
                            current_action = f"PHANH DỪNG! CẢN SAU {dist_rear}cm <= {rear_stop}cm"

                        elif pi_motor.motion == "left" and dist_left is not None and dist_left <= left_stop:
                            pi_motor.stop()
                            current_action = f"PHANH DỪNG! CẢN TRÁI {dist_left}cm <= {left_stop}cm"

                        elif pi_motor.motion == "right" and dist_right is not None and dist_right <= right_stop:
                            pi_motor.stop()
                            current_action = f"PHANH DỪNG! CẢN PHẢI {dist_right}cm <= {right_stop}cm"

                    # In thông số hiển thị
                    encs = data.get("encoders")
                    if encs and (time.time() - last_print_time >= 0.12):
                        last_print_time = time.time()
                        m1 = encs.get("m1", {})
                        m2 = encs.get("m2", {})
                        m3 = encs.get("m3", {})
                        m4 = encs.get("m4", {})

                        s1 = f"{m1.get('rpm', 0.0):>4.1f}R ({m1.get('ticks', 0):>5d})"
                        s2 = f"{m2.get('rpm', 0.0):>4.1f}R ({m2.get('ticks', 0):>5d})"
                        s3 = f"{m3.get('rpm', 0.0):>4.1f}R ({m3.get('ticks', 0):>5d})"
                        s4 = f"{m4.get('rpm', 0.0):>4.1f}R ({m4.get('ticks', 0):>5d})"

                        f_str = f"{dist_front:>4.1f}" if dist_front is not None else " ---"
                        r_str = f"{dist_rear:>4.1f}" if dist_rear is not None else " ---"
                        l_str = f"{dist_left:>4.1f}" if dist_left is not None else " ---"
                        rg_str = f"{dist_right:>4.1f}" if dist_right is not None else " ---"
                        dist_summary = f"F:{f_str} R:{r_str} L:{l_str} R:{rg_str}"

                        status_suffix = f" [{current_action}]" if pi_motor else ""
                        sys.stdout.write(f"\r{s1:<18} | {s2:<18} | {s3:<18} | {s4:<18} | {dist_summary}{status_suffix}   ")
                        sys.stdout.flush()
                except Exception:
                    pass

            # 2. Đọc phím điều khiển từ bàn phím người dùng
            if pi_motor and get_char:
                ch = get_char()
                if ch:
                    k = ch.lower()
                    if k in ('w', '8'):
                        # Kiểm tra vật cản trước khi cho tiến
                        if dist_front is not None and dist_front <= front_stop:
                            current_action = f"CHẶN TIẾN! CẢN TRƯỚC {dist_front}cm <= {front_stop}cm"
                        else:
                            pi_motor.move_forward()
                            current_action = "TIẾN"
                    elif k in ('s', '2'):
                        # Kiểm tra vật cản trước khi cho lùi
                        if dist_rear is not None and dist_rear <= rear_stop:
                            current_action = f"CHẶN LÙI! CẢN SAU {dist_rear}cm <= {rear_stop}cm"
                        else:
                            pi_motor.move_backward()
                            current_action = "LÙI"
                    elif k in ('a', '4'):
                        if dist_left is not None and dist_left <= left_stop:
                            current_action = f"CHẶN TRÁI! CẢN TRÁI {dist_left}cm <= {left_stop}cm"
                        else:
                            pi_motor.turn_left()
                            current_action = "XOAY TRÁI"
                    elif k in ('d', '6'):
                        if dist_right is not None and dist_right <= right_stop:
                            current_action = f"CHẶN PHẢI! CẢN PHẢI {dist_right}cm <= {right_stop}cm"
                        else:
                            pi_motor.turn_right()
                            current_action = "XOAY PHẢI"
                    elif k in ('x', '5', ' '):
                        pi_motor.stop()
                        current_action = "DỪNG"
                    elif k == 'q':
                        print("\nThoát chương trình...")
                        break

    except KeyboardInterrupt:
        print("\n\n[!] Dừng chương trình.")
    finally:
        if pi_motor:
            pi_motor.stop()
            pi_motor.cleanup()
        ser.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Test encoders with obstacle safety auto-stop")
    parser.add_argument("--port", default="auto", help="Serial port (auto or /dev/ttyUSB0)")
    parser.add_argument("--baud", type=int, default=115200, help="Baud rate (default 115200)")
    parser.add_argument("--control", action="store_true", help="Bật chế độ điều khiển thủ công bằng phím WASD")
    parser.add_argument("--invert-left", type=lambda x: (str(x).lower() in ['true', '1', 'yes']), default=None, help="Đảo chiều motor trái (True/False)")
    parser.add_argument("--invert-right", type=lambda x: (str(x).lower() in ['true', '1', 'yes']), default=None, help="Đảo chiều motor phải (True/False)")
    args = parser.parse_args()

    port = args.port
    if port == "auto":
        port = detect_esp32_port()
        if not port:
            print("[LỖI] Không tìm thấy ESP32 tự động. Vui lòng chỉ định --port /dev/ttyUSB0.")
            sys.exit(1)

    run_interactive_suite(port, args.baud, args.control, args.invert_left, args.invert_right)
