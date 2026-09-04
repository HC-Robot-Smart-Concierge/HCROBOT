import time
import sys

print("=" * 65)
print("  CHƯƠNG TRÌNH KIỂM TRA CHUYÊN SÂU CẶP CHÂN OUT1 & OUT2 L298N")
print("=" * 65)

# Khai báo các chân GPIO theo sơ đồ của ông chủ:
# Mạch 1 (Trái): IN1/IN3 = GPIO 17, IN2/IN4 = GPIO 27
# Mạch 2 (Phải): IN1/IN3 = GPIO 22, IN2/IN4 = GPIO 23
M1_IN1 = 17  # Nối IN1 (+IN3) Mạch 1
M1_IN2 = 27  # Nối IN2 (+IN4) Mạch 1
M2_IN1 = 22  # Nối IN1 (+IN3) Mạch 2
M2_IN2 = 23  # Nối IN2 (+IN4) Mạch 2

lgpio = None
gpiozero = None

try:
    import lgpio
except ImportError:
    pass

try:
    import gpiozero
    from gpiozero import DigitalOutputDevice
except ImportError:
    pass

h = None
devs = {}

# 1. Khởi tạo GPIO bằng lgpio (Pi 5)
if lgpio is not None:
    for chip_num in [4, 0]:
        try:
            h = lgpio.gpiochip_open(chip_num)
            for p in [M1_IN1, M1_IN2, M2_IN1, M2_IN2]:
                lgpio.gpio_claim_output(h, p, 0)
            print(f"[OK] Đã kết nối phần cứng Raspberry Pi 5 qua lgpio (chip {chip_num})")
            break
        except Exception:
            if h is not None:
                try:
                    lgpio.gpiochip_close(h)
                except Exception:
                    pass
            h = None

# 2. Khởi tạo GPIO bằng gpiozero nếu lgpio chưa có
if h is None and gpiozero is not None:
    try:
        devs[M1_IN1] = DigitalOutputDevice(M1_IN1)
        devs[M1_IN2] = DigitalOutputDevice(M1_IN2)
        devs[M2_IN1] = DigitalOutputDevice(M2_IN1)
        devs[M2_IN2] = DigitalOutputDevice(M2_IN2)
        print("[OK] Đã kết nối phần cứng qua gpiozero")
    except Exception as e:
        print(f"[!] Lỗi gpiozero: {e}")

if h is None and not devs:
    print("\n[LỖI] Chưa cài thư viện GPIO. Vui lòng chạy lệnh:")
    print("  sudo apt install -y python3-lgpio python3-gpiozero\n")
    sys.exit(1)


def set_pin(pin: int, state: int):
    """Bật/tắt chân GPIO."""
    if h is not None:
        lgpio.gpio_write(h, pin, 1 if state else 0)
    elif pin in devs:
        if state:
            devs[pin].on()
        else:
            devs[pin].off()


def stop_all():
    """Tắt toàn bộ chân GPIO."""
    set_pin(M1_IN1, 0)
    set_pin(M1_IN2, 0)
    set_pin(M2_IN1, 0)
    set_pin(M2_IN2, 0)


def test_mach1_out12():
    print("\n---> ĐANG TEST MẠCH 1 (BÊN TRÁI) - CẶP OUT1 & OUT2 <---")
    print("1.1 Bật OUT1 dương (+V), OUT2 âm (GND) trong 3 giây...")
    set_pin(M1_IN1, 1)  # IN1 = HIGH
    set_pin(M1_IN2, 0)  # IN2 = LOW
    time.sleep(3.0)

    print("1.2 Đảo chiều: OUT1 âm (GND), OUT2 dương (+V) trong 3 giây...")
    set_pin(M1_IN1, 0)  # IN1 = LOW
    set_pin(M1_IN2, 1)  # IN2 = HIGH
    time.sleep(3.0)

    stop_all()
    print("--> Đã dừng Mạch 1.")


def test_mach2_out12():
    print("\n---> ĐANG TEST MẠCH 2 (BÊN PHẢI) - CẶP OUT1 & OUT2 <---")
    print("2.1 Bật OUT1 dương (+V), OUT2 âm (GND) trong 3 giây...")
    set_pin(M2_IN1, 1)  # IN1 = HIGH
    set_pin(M2_IN2, 0)  # IN2 = LOW
    time.sleep(3.0)

    print("2.2 Đảo chiều: OUT1 âm (GND), OUT2 dương (+V) trong 3 giây...")
    set_pin(M2_IN1, 0)  # IN1 = LOW
    set_pin(M2_IN2, 1)  # IN2 = HIGH
    time.sleep(3.0)

    stop_all()
    print("--> Đã dừng Mạch 2.")


def main():
    try:
        stop_all()
        print("\nHƯỚNG DẪN TEST CẶP CHÂN OUT1, OUT2:")
        print(" [1] Test OUT1, OUT2 Mạch 1 (Bên Trái)")
        print(" [2] Test OUT1, OUT2 Mạch 2 (Bên Phải)")
        print(" [3] Chạy tự động test cả 2 Mạch lần lượt")
        print(" [Q] Thoát")

        while True:
            cmd = input("\nNhập lựa chọn (1/2/3/q): ").strip().lower()
            if cmd == '1':
                test_mach1_out12()
            elif cmd == '2':
                test_mach2_out12()
            elif cmd == '3':
                test_mach1_out12()
                time.sleep(1.0)
                test_mach2_out12()
            elif cmd == 'q':
                break
            else:
                print("Lựa chọn không hợp lệ!")
    except KeyboardInterrupt:
        print("\n[!] Dừng khẩn cấp.")
    finally:
        stop_all()
        if h is not None:
            for p in [M1_IN1, M1_IN2, M2_IN1, M2_IN2]:
                try:
                    lgpio.gpio_free(h, p)
                except Exception:
                    pass
            lgpio.gpiochip_close(h)
        for d in devs.values():
            try:
                d.close()
            except Exception:
                pass
        print("Đã tắt an toàn toàn bộ thiết bị.")


if __name__ == '__main__':
    main()
