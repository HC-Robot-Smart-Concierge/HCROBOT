#!/bin/bash
# Nạp firmware MicroPython (các file robot/esp32/*.py) vào ESP32 đang cắm USB trên Raspberry Pi.
# Chạy từ LAPTOP (Git Bash/WSL):
#
#   bash robot/scripts/flash_esp32.sh                          # Pi mặc định phuc@100.99.72.51
#   PI=phuc@192.168.1.50 bash robot/scripts/flash_esp32.sh     # Pi khác
#   ESP32_PORT=/dev/ttyUSB1 bash robot/scripts/flash_esp32.sh  # nếu tự dò nhầm cổng
#
# - Chỉ chép file .py (KHÔNG xóa flash, KHÔNG nạp lại MicroPython .bin).
# - Trước khi chạy: DỪNG main.py trên Pi (nó giữ cổng Serial của ESP32) và để xe ĐỨNG YÊN:
#   ESP32 hiệu chuẩn gyro 1.5 s ngay khi khởi động lại.
# - Xong script tự đọc telemetry 10 s để xác nhận ESP32 gửi đều (khe hở lớn nhất < 0.3 s).
set -euo pipefail

PI="${PI:-phuc@100.99.72.51}"
REMOTE_DIR="${REMOTE_DIR:-HCROBOT/robot}"   # tính từ thư mục home trên Pi
ROBOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# main.py nạp SAU CÙNG: nó import các module còn lại.
MODULES=(encoder.py motor.py mpu.py ultrasonic.py gyro_integrator.py main.py)

STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
for f in "${MODULES[@]}"; do
  tr -d '\r' < "$ROBOT_DIR/esp32/$f" > "$STAGE/$f"
done

echo "== Chép firmware lên Pi ($PI:~/$REMOTE_DIR/esp32)"
tar -C "$STAGE" -cf - "${MODULES[@]}" | ssh -o ConnectTimeout=8 "$PI" \
  "mkdir -p '$REMOTE_DIR/esp32' && tar -C '$REMOTE_DIR/esp32' -xf -"

echo "== Nạp vào ESP32"
# "auto" thay cho rỗng: ssh nối tham số thành 1 chuỗi, tham số rỗng sẽ biến mất.
ssh "$PI" bash -s -- "$REMOTE_DIR" "${ESP32_PORT:-auto}" "${MODULES[@]}" <<'EOS'
set -euo pipefail
cd "$1"; PORT="$2"; shift 2

if pgrep -f "python3 .*main\.py" >/dev/null; then
  echo "!!! main.py đang chạy và giữ cổng ESP32. Dừng nó (Ctrl+C ở terminal đang chạy," >&2
  echo "    hoặc sudo systemctl stop <service> nếu chạy bằng systemd) rồi chạy lại script." >&2
  exit 1
fi

if command -v mpremote >/dev/null; then MP=(mpremote)
elif [ -x "$HOME/.local/bin/mpremote" ]; then MP=("$HOME/.local/bin/mpremote")
elif python3 -c "import mpremote" 2>/dev/null; then MP=(python3 -m mpremote)
else
  echo "!!! Pi chưa có mpremote. Cài: python3 -m pip install --user --break-system-packages mpremote" >&2
  exit 1
fi

[ "$PORT" = auto ] && PORT=""
if [ -z "$PORT" ]; then
  # ESP32 dùng CH340 (1a86) / Espressif; RPLiDAR dùng CP2102 nên không được chọn ở đây.
  PORT="$(ls /dev/serial/by-id/*1a86* /dev/serial/by-id/*Espressif* 2>/dev/null | head -1 || true)"
fi
if [ -z "$PORT" ]; then
  PORT="$(python3 -c 'from ultrasonic_serial import detect_esp32_port; print(detect_esp32_port() or "")' 2>/dev/null || true)"
fi
[ -n "$PORT" ] || { echo "!!! Không thấy cổng ESP32. Cắm USB rồi thử ESP32_PORT=/dev/ttyUSB0" >&2; exit 1; }
echo "   Cổng ESP32: $PORT -> $(readlink -f "$PORT")"
if [ ! -w "$PORT" ]; then
  echo "!!! User $USER không ghi được $PORT. Chạy: sudo usermod -aG dialout $USER, đăng nhập lại SSH." >&2
  exit 1
fi

ARGS=()
for f in "$@"; do ARGS+=(fs cp "esp32/$f" ":$f" +); done
# </dev/null: stdin của shell này là chính script, mpremote không được đọc mất phần còn lại.
"${MP[@]}" connect "$PORT" "${ARGS[@]}" \
  exec "import gyro_integrator, ultrasonic; print('   ESP32: module moi da co')" + reset </dev/null
echo "   Đã nạp: $*"

echo "== Kiểm tra telemetry 10 s (xe phải đứng yên lúc hiệu chuẩn gyro)"
python3 - "$PORT" <<'PY'
import json, sys, time
import serial

s = serial.Serial()
s.port, s.baudrate, s.timeout = sys.argv[1], 115200, 0.2
s.dtr = s.rts = False  # không kéo EN/IO0: tránh reset ESP32 lần nữa
s.open()
end, last, gaps, packets, payload = time.monotonic() + 10, None, [], 0, None
while time.monotonic() < end:
    line = s.readline().decode("utf-8", "ignore").strip()
    if line.startswith("#"):
        print("   ESP32:", line)
    elif line.startswith("{"):
        now = time.monotonic()
        if last is not None:
            gaps.append(now - last)
        last, packets = now, packets + 1
        try:
            payload = json.loads(line)
        except ValueError:
            pass
worst = max(gaps) if gaps else float("inf")
print(f"   {packets} packet, khe hở lớn nhất {worst:.2f} s, "
      f"IMU={'có' if payload and payload.get('mpu_available') else 'KHÔNG'}, "
      f"encoder={'có' if payload and payload.get('encoders') else 'KHÔNG'}")
if packets < 50 or worst > 0.3:
    sys.exit("!!! Telemetry chưa đều: xem các dòng 'ESP32:' ở trên (lỗi import/MPU?).")
print("   OK: ESP32 chạy firmware mới, telemetry đều.")
PY
echo "   Giờ bật lại main.py trên Pi: cd ~/HCROBOT/robot && sudo python3 main.py"
EOS
