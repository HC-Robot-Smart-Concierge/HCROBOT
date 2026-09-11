#!/usr/bin/env bash
# Cấp quyền truy cập /dev/gpiochip* cho user chạy HCROBOT trên Raspberry Pi OS/Ubuntu.

set -euo pipefail

target_user="${SUDO_USER:-${USER:-}}"
if [[ -z "${target_user}" ]] || ! id "${target_user}" >/dev/null 2>&1; then
    echo "[ERROR] Không xác định được user cần cấp quyền GPIO." >&2
    exit 1
fi

if ! getent group gpio >/dev/null 2>&1; then
    echo "==> Tạo system group gpio..."
    sudo groupadd --system gpio
fi

echo "==> Thêm ${target_user} vào group gpio..."
sudo usermod -aG gpio "${target_user}"

echo "==> Cài udev rule cho /dev/gpiochip*..."
echo 'SUBSYSTEM=="gpio", KERNEL=="gpiochip[0-9]*", GROUP="gpio", MODE="0660"' \
    | sudo tee /etc/udev/rules.d/90-hcrobot-gpio.rules >/dev/null

sudo udevadm control --reload-rules
sudo udevadm trigger --subsystem-match=gpio --action=add

echo
echo "Đã cấu hình quyền GPIO cho ${target_user}."
echo "Hãy chạy 'sudo reboot', sau đó kiểm tra bằng: id -nG && ls -l /dev/gpiochip*"
