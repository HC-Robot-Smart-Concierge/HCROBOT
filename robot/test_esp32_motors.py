"""Script kiểm tra động cơ và encoder ESP32 từ Raspberry Pi qua Serial.

Chạy trên Raspberry Pi:
    python3 test_esp32_motors.py --port auto
    python3 test_esp32_motors.py --port /dev/ttyUSB0
"""

import argparse
import json
import time
import sys
import serial
from ultrasonic_serial import detect_esp32_port


def test_motor_suite(port: str, baud: int = 115200):
    print("=" * 65)
    print(f"  KIỂM TRA 4 ĐỘNG CƠ & ENCODER ESP32 ({port} @ {baud})")
    print("=" * 65)

    try:
        ser = serial.Serial(port, baud, timeout=0.2)
        time.sleep(1.0) # Chờ ESP32 khởi động lại khi mở cổng DTR
    except Exception as e:
        print(f"[LỖI] Không thể mở cổng Serial {port}: {e}")
        return

    # Bật chế độ DEBUG trên ESP32
    ser.write(b"DEBUG:1\n")
    time.sleep(0.1)

    def read_responses(duration_sec=1.0):
        deadline = time.time() + duration_sec
        while time.time() < deadline:
            line = ser.readline().decode('utf-8', errors='ignore').strip()
            if line:
                if line.startswith("#"):
                    print(f"  [ESP32] {line}")
                elif line.startswith("{"):
                    try:
                        data = json.loads(line)
                        encs = data.get("encoders", {})
                        if encs:
                            print(f"  [ENCODERS] M1: {encs.get('m1', {}).get('rpm')} RPM (ticks: {encs.get('m1', {}).get('ticks')}) | "
                                  f"M2: {encs.get('m2', {}).get('rpm')} RPM (ticks: {encs.get('m2', {}).get('ticks')}) | "
                                  f"M3: {encs.get('m3', {}).get('rpm')} RPM (ticks: {encs.get('m3', {}).get('ticks')}) | "
                                  f"M4: {encs.get('m4', {}).get('rpm')} RPM (ticks: {encs.get('m4', {}).get('ticks')})")
                    except Exception:
                        pass

    try:
        # 1. Test Motor 1
        print("\n--> [1/5] Kiểm tra Motor 1 (Tiến speed=180 trong 2s)...")
        for _ in range(10): # Giữ watchdog bằng cách gửi liên tục
            ser.write(b"M1:180\n")
            read_responses(0.2)
        ser.write(b"STOP\n")
        read_responses(0.5)

        # 2. Test Motor 2
        print("\n--> [2/5] Kiểm tra Motor 2 (Tiến speed=180 trong 2s)...")
        for _ in range(10):
            ser.write(b"M2:180\n")
            read_responses(0.2)
        ser.write(b"STOP\n")
        read_responses(0.5)

        # 3. Test Motor 3
        print("\n--> [3/5] Kiểm tra Motor 3 (Tiến speed=180 trong 2s)...")
        for _ in range(10):
            ser.write(b"M3:180\n")
            read_responses(0.2)
        ser.write(b"STOP\n")
        read_responses(0.5)

        # 4. Test Motor 4
        print("\n--> [4/5] Kiểm tra Motor 4 (Tiến speed=180 trong 2s)...")
        for _ in range(10):
            ser.write(b"M4:180\n")
            read_responses(0.2)
        ser.write(b"STOP\n")
        read_responses(0.5)

        # 5. Test cả 4 motor đồng thời
        print("\n--> [5/5] Kiểm tra CẢ 4 MOTOR TIẾN (M:180,180,180,180 trong 3s)...")
        for _ in range(15):
            ser.write(b"M:180,180,180,180\n")
            read_responses(0.2)

        print("\n--> Dừng tất cả motor (STOP)...")
        ser.write(b"STOP\n")
        read_responses(1.0)

        print("\n[THÀNH CÔNG] Hoàn tất kiểm tra!")

    except KeyboardInterrupt:
        print("\n[!] Người dùng bấm dừng test. Gửi lệnh STOP khẩn cấp...")
        ser.write(b"STOP\n")
    finally:
        ser.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Test 4 motors and encoders via ESP32")
    parser.add_argument("--port", default="auto", help="Serial port (auto or /dev/ttyUSB0)")
    parser.add_argument("--baud", type=int, default=115200, help="Baud rate (default 115200)")
    args = parser.parse_args()

    port = args.port
    if port == "auto":
        port = detect_esp32_port()
        if not port:
            print("[LỖI] Không tìm thấy ESP32 tự động. Vui lòng cắm cáp USB hoặc chỉ định --port.")
            sys.exit(1)

    test_motor_suite(port, args.baud)
