#!/bin/bash
# ============================================================
# Cài đặt dịch vụ tự khởi động (Auto-Start Systemd Service)
# Khi Pi 5 cắm nguồn, Robot tự động chạy Động cơ, Camera, Lidar!
# KHÔNG CẦN PHẢI MỞ TERMINAL SSH NỮA!
# ============================================================
set -e

SERVICE_FILE="/etc/systemd/system/hc-robot.service"
ROBOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> Dang tao file dich vu systemd tai $SERVICE_FILE..."

sudo bash -c "cat << 'EOF' > $SERVICE_FILE
[Unit]
Description=HC-Robot All-in-One Robot Daemon (Motor + Camera + LiDAR + Safety)
After=network.target network-online.target tailscaled.service
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=$ROBOT_DIR
ExecStart=/usr/bin/python3 $ROBOT_DIR/main.py
Restart=always
RestartSec=3
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF"

echo "==> Reload systemd daemon va kich hoat auto-start..."
sudo systemctl daemon-reload
sudo systemctl enable hc-robot.service
sudo systemctl restart hc-robot.service

echo "============================================================"
echo "✅ HOÀN TẤT! Robot đã chạy ngầm và sẽ tự chạy mỗi khi cắm nguồn!"
echo "   - Xem trạng thái: sudo systemctl status hc-robot.service"
echo "   - Xem log real-time: journalctl -u hc-robot.service -f"
echo "   - Dừng service: sudo systemctl stop hc-robot.service"
echo "============================================================"
