#!/usr/bin/env python3
"""Script chan doan tin hieu va ban xung lien tuc toi day cam bien dang sau (HC-SR04 REAR).
Chan ESP32:
  - TRIG: GPIO 19
  - ECHO: GPIO 35 (Input-only)
"""

import sys
import time
import argparse
import serial
from serial.tools import list_ports


def find_esp32_port():
    ports = list_ports.comports()
    for p in ports:
        desc = (p.description or "").lower()
        hwid = (p.hwid or "").lower()
        if "1a86" in hwid or "ch340" in desc or "cp210" in desc or "usb-serial" in desc:
            return p.device
    for default_candidate in ["/dev/ttyUSB1", "/dev/ttyUSB0", "/dev/ttyACM0"]:
        import os
        if os.path.exists(default_candidate):
            return default_candidate
    return None


def run_diagnostic(port, mode="pulse"):
    print("=" * 70)
    print(" CHUONG TRINH CHAN DOAN TIN HIEU CAM BIEN DANG SAU (REAR SENSOR)")
    print(" Chân ESP32: TRIG = GPIO 19 | ECHO = GPIO 35")
    print(f" Cổng kết nối ESP32: {port}")
    print("=" * 70)

    try:
        ser = serial.Serial(port, 115200, timeout=1)
    except Exception as exc:
        print(f"\n[LOI] Khong the mo cong {port}: {exc}")
        print("Kiem tra xem co tien trinh nao dang chiem cong (vi du main.py)?")
        print("Hay chay: sudo pkill -f main.py truoc khi test.\n")
        sys.exit(1)

    print("\nDang gui tin hieu ngat vao ESP32 (Ctrl+C) de vao REPL chan doan...")
    time.sleep(0.5)
    ser.write(b"\r\x03\x03")  # Send Ctrl+C twice
    time.sleep(0.5)
    ser.write(b"\r\x01")      # Enter raw REPL (Ctrl+A)
    time.sleep(0.5)
    ser.reset_input_buffer()

    if mode == "toggle":
        # Che do ban xung vuong 1Hz de do VOM
        code = (
            "import time\n"
            "from machine import Pin\n"
            "t = Pin(19, Pin.OUT)\n"
            "e = Pin(35, Pin.IN)\n"
            "for i in range(120):\n"
            "    t.value(1)\n"
            "    ev = e.value()\n"
            "    print('STATE:TRIG=1 (3.3V)|ECHO=' + str(ev))\n"
            "    time.sleep(0.5)\n"
            "    t.value(0)\n"
            "    print('STATE:TRIG=0 (0.0V)|ECHO=' + str(ev))\n"
            "    time.sleep(0.5)\n"
        )
        print("\n>>> DANG BAN XUNG VUONG 1Hz (500ms ON / 500ms OFF) TOI DAY TRIG (GPIO 19)")
        print("HUONG DAN DO BANG DONG HO VOM (thang do DC Volt 20V):")
        print("1. Que den cam vao GND chung (hoac vo kim loai/chan GND)")
        print("2. Que do cham vao chan TRIG o jack cam cam bien sau (HC-SR04)")
        print("=> Neu VOM nhay deu giua 0V va 3.3V: Day TRIG thong tot, ESP32 xuat tot!")
        print("=> Neu VOM luon la 0V: Dut day TRIG hoac cam nham chan GPIO!\n")
    else:
        # Che do kich xung sieu am lien tuc de bat phan hoi Echo
        code = (
            "import time\n"
            "from machine import Pin, time_pulse_us\n"
            "t = Pin(19, Pin.OUT, value=0)\n"
            "e = Pin(35, Pin.IN)\n"
            "for i in range(150):\n"
            "    t.value(0)\n"
            "    time.sleep_us(2)\n"
            "    t.value(1)\n"
            "    time.sleep_us(10)\n"
            "    t.value(0)\n"
            "    try:\n"
            "        dur = time_pulse_us(e, 1, 30000)\n"
            "    except Exception as ex:\n"
            "        dur = -999\n"
            "    ev = e.value()\n"
            "    print('ECHO_STATIC=' + str(ev) + '|DUR=' + str(dur))\n"
            "    time.sleep_ms(100)\n"
        )
        print("\n>>> DANG KICH XUNG TRIGGER 10us LIEN TUC VA BAT TIN HIEU ECHO (GPIO 35)")
        print("Theo doi phan hoi tu chan Echo:")

    ser.write(code.encode("ascii") + b"\x04")  # Execute in raw REPL

    start_time = time.time()
    try:
        while time.time() - start_time < 65:
            line = ser.readline().decode("utf-8", errors="ignore").strip()
            if not line:
                continue
            if "STATE:TRIG=1" in line:
                print(f"[{time.strftime('%H:%M:%S')}] [TRIG = HIGH 3.3V] -> DANG PHAT DIEN AP RA DAY DANG SAU... | {line}", flush=True)
            elif "STATE:TRIG=0" in line:
                print(f"[{time.strftime('%H:%M:%S')}] [TRIG = LOW  0.0V] -> XUNG XUONG MUC 0V...               | {line}", flush=True)
            elif "ECHO_STATIC=" in line:
                parts = dict(p.split("=") for p in line.split("|") if "=" in p)
                dur = int(parts.get("DUR", -999))
                ev = parts.get("ECHO_STATIC", "?")
                if dur == -2:
                    diag = "TIMEOUT (Chan Echo khong nhan duoc xung doi ve - Dut day Echo/Trig hoac cam bien mat nguon 5V)"
                elif dur == -1:
                    diag = "TIMEOUT_FALLING (Chan Echo bi ket o muc HIGH)"
                elif dur > 0:
                    cm = dur / 58.0
                    diag = f"THANH CONG! Khoang cach: {cm:.1f} cm"
                else:
                    diag = f"Ma loi: {dur}"
                print(f"[{time.strftime('%H:%M:%S')}] Echo={ev} | Dur={dur:6d} us => {diag}", flush=True)
            else:
                if not line.startswith("OK"):
                    print(f"  {line}", flush=True)
    except KeyboardInterrupt:
        print("\nNguoi dung dung chuong trinh test.")
    finally:
        # Reset ESP32 back to normal running
        ser.write(b"\r\x02\x04")  # Exit raw REPL and soft reset
        ser.close()
        print("\nDa khoi phuc ESP32 ve trang thai ban dau.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Chan doan cam bien sau ESP32")
    parser.add_argument("--port", default=None, help="Cong serial ESP32 (mac dinh tu do)")
    parser.add_argument("--mode", choices=["pulse", "toggle"], default="toggle",
                        help="toggle: ban xung vuong 1Hz do VOM, pulse: kich sieu am do phan hoi")
    args = parser.parse_args()

    target_port = args.port or find_esp32_port() or "/dev/ttyUSB1"
    run_diagnostic(target_port, mode=args.mode)
