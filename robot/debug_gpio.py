import time
import sys

print("=" * 60)
print("  CHƯƠNG TRÌNH KIỂM TRA ĐIỆN ÁP TRỰC TIẾP GPIO PI 5")
print("=" * 60)

# Thử mở bằng lgpio
try:
    import lgpio
    h = lgpio.gpiochip_open(4) # RP1 chip trên Pi 5
    print("[OK] Đã mở thành công /dev/gpiochip4 (Raspberry Pi 5 RP1 chip)")

    pins = [17, 27, 22, 23]
    for p in pins:
        try:
            lgpio.gpio_claim_output(h, p, 0)
        except Exception as e:
            print(f"[!] Warning claim pin {p}: {e}")

    print("\n---> ĐANG BẬT ĐIỆN THẾ HIGH (3.3V) LÊN TOÀN BỘ CHÂN GPIO 17, 27, 22, 23 <---")
    print("Nếu đấu nối đúng, động cơ sẽ QUAY LIÊN TỤC ngay lúc này!")
    print("Nhấn CTRL+C để tắt.\n")

    while True:
        # Bật GPIO 17 (Tiến Trái) và GPIO 22 (Tiến Phải)
        lgpio.gpio_write(h, 17, 1)
        lgpio.gpio_write(h, 27, 0)
        lgpio.gpio_write(h, 22, 1)
        lgpio.gpio_write(h, 23, 0)
        time.sleep(0.5)

except KeyboardInterrupt:
    print("\n[!] Đã dừng test.")
    if 'h' in locals() and h is not None:
        for p in [17, 27, 22, 23]:
            lgpio.gpio_write(h, p, 0)
            lgpio.gpio_free(h, p)
        lgpio.gpiochip_close(h)
    sys.exit(0)
except Exception as err:
    print(f"[LỖI RỒI]: {err}")
    sys.exit(1)
