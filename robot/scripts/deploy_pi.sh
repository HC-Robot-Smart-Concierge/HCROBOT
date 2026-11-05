#!/bin/bash
# Đồng bộ code an toàn + ngưỡng sonar từ LAPTOP lên Raspberry Pi 5 (chạy bằng Git Bash/WSL):
#
#   bash robot/scripts/deploy_pi.sh                        # Pi mặc định phuc@100.99.72.51
#   PI=phuc@192.168.1.50 bash robot/scripts/deploy_pi.sh   # Pi khác
#
# - Chỉ chép file KHÁC bản trên Pi (so md5, bỏ qua khác biệt CRLF/LF của Windows).
# - Sao lưu bản cũ trên Pi thành <file>.bak-<giờ>, ghi file mới kiểu nguyên tử (cat > tmp; mv).
# - Kiểm tra cú pháp Python trên Pi và in ngưỡng an toàn Pi sẽ dùng.
# Xong PHẢI khởi động lại main.py trên Pi (Ctrl+C rồi: sudo python3 main.py) thì mới có hiệu lực.
set -euo pipefail

PI="${PI:-phuc@100.99.72.51}"
REMOTE_DIR="${REMOTE_DIR:-HCROBOT/robot}"   # tính từ thư mục home trên Pi
ROBOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FILES=(main.py obstacle_safety.py udp_command_watchdog.py motor_controller.py ultrasonic_serial.py settings.yaml)
STAMP="$(date +%Y%m%d-%H%M%S)"

hash_local() { tr -d '\r' < "$ROBOT_DIR/$1" | md5sum | cut -d' ' -f1; }

echo "== So sánh code trên laptop với Pi ($PI:~/$REMOTE_DIR)"
REMOTE_HASHES="$(ssh -o ConnectTimeout=8 "$PI" bash -s -- "$REMOTE_DIR" "${FILES[@]}" <<'EOS'
cd "$1" || { echo "NO_DIR"; exit 0; }
shift
for f in "$@"; do
  if [ -f "$f" ]; then
    printf '%s %s\n' "$(tr -d '\r' < "$f" | md5sum | cut -d' ' -f1)" "$f"
  else
    echo "missing $f"
  fi
done
EOS
)"
if [ "$REMOTE_HASHES" = "NO_DIR" ]; then
  echo "!!! Không có thư mục ~/$REMOTE_DIR trên Pi. Đặt REMOTE_DIR=... cho đúng." >&2
  exit 1
fi

CHANGED=()
for f in "${FILES[@]}"; do
  l="$(hash_local "$f")"
  r="$(awk -v f="$f" '$2 == f { print $1 }' <<<"$REMOTE_HASHES")"
  if [ "$l" = "$r" ]; then
    echo "   giống   $f"
  else
    echo "   KHÁC    $f"
    CHANGED+=("$f")
  fi
done

for f in "${CHANGED[@]+"${CHANGED[@]}"}"; do
  tr -d '\r' < "$ROBOT_DIR/$f" | ssh "$PI" \
    "cd '$REMOTE_DIR' && { [ -f '$f' ] && cp -p '$f' '$f.bak-$STAMP' || true; } && cat > '$f.tmp-$STAMP' && mv '$f.tmp-$STAMP' '$f'"
  echo "   -> đã chép $f (bản cũ: $f.bak-$STAMP)"
done
[ ${#CHANGED[@]} -eq 0 ] && echo "   Pi đã dùng bản mới nhất, không cần chép."

echo "== Kiểm tra trên Pi"
ssh "$PI" bash -s -- "$REMOTE_DIR" <<'EOS'
cd "$1"
python3 -m py_compile main.py obstacle_safety.py udp_command_watchdog.py motor_controller.py \
  && echo "   Cú pháp Python: OK"
python3 - <<'PY'
import yaml
s = ((yaml.safe_load(open("settings.yaml", encoding="utf-8")) or {}).get("robot") or {}).get("safety") or {}
keys = ["front_stop_cm", "rear_stop_cm", "left_stop_cm", "right_stop_cm", "turn_clearance_cm", "resume_margin_cm"]
print("   Ngưỡng an toàn Pi sẽ dùng: " + ", ".join(f"{k}={s.get(k)}" for k in keys))
PY
if grep -q pi_status main.py; then
  echo "   main.py có gửi trạng thái an toàn về laptop (dòng 🩺 sẽ hiện 'Sonar' và lý do Pi chặn)"
fi
if pgrep -f "python3 main.py" >/dev/null; then
  echo "   !!! main.py ĐANG CHẠY bằng code cũ trong bộ nhớ: Ctrl+C ở terminal đang chạy nó rồi:"
  echo "       cd ~/HCROBOT/robot && sudo python3 main.py"
else
  echo "   main.py chưa chạy. Bật bằng: cd ~/HCROBOT/robot && sudo python3 main.py"
fi
EOS
