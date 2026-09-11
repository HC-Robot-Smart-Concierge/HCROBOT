import time
import sys
import os

print("=" * 60)
print("  CHƯƠNG TRÌNH KIỂM TRA ĐIỆN ÁP TRỰC TIẾP GPIO PI 5")
print("=" * 60)

lgpio = None
gpiozero = None

# Thử import lgpio
try:
    import lgpio
except ImportError:
    pass

# Thử import gpiozero
try:
    import gpiozero
except ImportError:
    pass

h = None
devices = []

pins = [17, 27, 22, 23]

# 1. Thử dùng lgpio
if lgpio is not None:
    for chip_num in [4, 0]:
        try:
            h = lgpio.gpiochip_open(chip_num)
            for p in pins:
                lgpio.gpio_claim_output(h, p, 0)
            print(f"[OK] Đã kết nối GPIO qua lgpio (chip {chip_num})")
            break
        except Exception:
            if h is not None:
                try:
                    lgpio.gpiochip_close(h)
                except Exception:
                    pass
            h = None

# 2. Thử dùng gpiozero nếu lgpio không có
if h is None and gpiozero is not None:
    try:
        from gpiozero import DigitalOutputDevice
        devices = [DigitalOutputDevice(p) for p in pins]
        print("[OK] Đã kết nối GPIO qua gpiozero")
    except Exception as e:
        print(f"[!] Warning gpiozero: {e}")

# 3. Nếu cả 2 đều thiếu
if h is None and not devices:
    print("\n[LỖI] Chưa cài thư viện điều khiển GPIO trên Python!")
    print("Vui lòng gõ lệnh sau để cài đặt lập tức:")
    print("  sudo apt update && sudo apt install -y python3-lgpio python3-gpiozero")
    print("  HOẶC: pip install rpi-lgpio gpiozero\n")
    sys.exit(1)

print("\n---> ĐANG BẬT ĐIỆN THẾ HIGH (3.3V) LÊN TOÀN BỘ CHÂN GPIO 17, 27, 22, 23 <---")
print("Nếu đấu nối đúng & đủ nguồn, động cơ sẽ QUAY LIÊN TỤC ngay lúc này!")
print("Nhấn CTRL+C để dừng test.\n")

try:
    while True:
        if h is not None:
            # GPIO 17 (Tiến Trái ON), 27 (OFF), 22 (Tiến Phải ON), 23 (OFF)
            lgpio.gpio_write(h, 17, 1)
            lgpio.gpio_write(h, 27, 0)
            lgpio.gpio_write(h, 22, 1)
            lgpio.gpio_write(h, 23, 0)
        elif devices:
            devices[0].on()  # 17
            devices[1].off() # 27
            devices[2].on()  # 22
            devices[3].off() # 23
        time.sleep(0.5)

except KeyboardInterrupt:
    print("\n[!] Đã dừng test.")
    if h is not None:
        for p in pins:
            lgpio.gpio_write(h, p, 0)
            lgpio.gpio_free(h, p)
        lgpio.gpiochip_close(h)
    if devices:
        for d in devices:
            d.off()
            d.close()
    sys.exit(0)
