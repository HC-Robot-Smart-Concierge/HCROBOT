#!/bin/bash
# Chạy MỘT LẦN trên Raspberry Pi để cài YOLO và tự bật cùng Pi:
#   bash ~/HCROBOT/robot/scripts/setup_person_vision.sh
#
# Dùng venv riêng để không đụng thư viện của camera stream và main.py.
set -euo pipefail

ROBOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVICE_NAME="hc-robot-vision"
SERVICE_FILE="/etc/systemd/system/$SERVICE_NAME.service"
RUN_USER="${SUDO_USER:-$(id -un)}"
RUN_HOME="$(getent passwd "$RUN_USER" | cut -d: -f6)"
# Nằm ngoài repo để git pull trên Pi không bị vướng thư viện.
VENV="$RUN_HOME/.venvs/hc-robot-vision"

echo "==> [1/4] Cài ultralytics vào $VENV (lần đầu có thể mất vài phút)"
mkdir -p "$(dirname "$VENV")"
python3 -m venv "$VENV"
"$VENV/bin/pip" install --upgrade pip
"$VENV/bin/pip" install "ultralytics>=8.3,<9" pyyaml
# Pi không có màn hình: thay OpenCV bản GUI bằng bản headless.
"$VENV/bin/pip" uninstall -y opencv-python
"$VENV/bin/pip" install --force-reinstall --no-deps opencv-python-headless

echo "==> [2/4] Tải và kiểm tra model yolov8n.pt"
(cd "$ROBOT_DIR" && "$VENV/bin/python" -c "from ultralytics import YOLO; YOLO('yolov8n.pt'); import cv2; print('YOLO OK, OpenCV', cv2.__version__)")

echo "==> [3/4] Tạo dịch vụ $SERVICE_NAME"
sudo tee "$SERVICE_FILE" >/dev/null <<EOF
[Unit]
Description=HC-Robot YOLO person vision
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$RUN_USER
WorkingDirectory=$ROBOT_DIR
Environment=OMP_NUM_THREADS=2
Environment=OPENBLAS_NUM_THREADS=2
ExecStart=$VENV/bin/python $ROBOT_DIR/scripts/person_vision.py
Restart=always
RestartSec=3
# Nhường CPU cho vòng an toàn và LiDAR trong main.py.
Nice=10
CPUQuota=200%

[Install]
WantedBy=multi-user.target
EOF

echo "==> [4/4] Bật dịch vụ"
sudo systemctl daemon-reload
sudo systemctl enable "$SERVICE_NAME"
sudo systemctl restart "$SERVICE_NAME"
sleep 2
sudo systemctl --no-pager --lines=8 status "$SERVICE_NAME" || true

echo "Xong. Xem log: journalctl -u $SERVICE_NAME -f"
