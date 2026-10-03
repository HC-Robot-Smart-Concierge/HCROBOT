#!/usr/bin/env bash
# ==============================================================================
# HCRobot: Script cài đặt tự động ROS 2 (Jazzy / Humble) trên Raspberry Pi 5
# ==============================================================================

set -e

echo "=========================================================="
echo "  BẮT ĐẦU CÀI ĐẶT ROS 2 CHO RASPBERRY PI 5 (ARM64)"
echo "=========================================================="

# 1. Cập nhật hệ thống & cài công cụ phụ trợ
echo "[1/5] Cập nhật apt & cài đặt công cụ thiết yếu..."
sudo apt update -y
sudo apt install -y software-properties-common curl gnupg lsb-release

# 2. Thêm khóa GPG chính thức của Open Robotics
echo "[2/5] Cấu hình ROS 2 GPG Key..."
sudo mkdir -p /etc/apt/keyrings
sudo curl -sSL https://raw.githubusercontent.com/ros/rosdistro/master/ros.key -o /etc/apt/keyrings/ros-archive-keyring.gpg

# 3. Xác định bản phân phối ROS 2 phù hợp
# Ubuntu 24.04 (Noble) -> ROS 2 Jazzy Jalisco
# Ubuntu 22.04 (Jammy) -> ROS 2 Humble Hawksbill
UBUNTU_CODENAME=$(lsb_release -cs 2>/dev/null || echo "noble")
if [ "$UBUNTU_CODENAME" = "jammy" ]; then
    ROS_DISTRO="humble"
    TARGET_CODENAME="jammy"
else
    ROS_DISTRO="jazzy"
    TARGET_CODENAME="noble" # Fallback noble nếu là bản rolling/resolute
fi

echo "[3/5] Cấu hình ROS 2 Repository (${ROS_DISTRO} cho ${TARGET_CODENAME})..."
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/ros-archive-keyring.gpg] http://packages.ros.org/ros2/ubuntu ${TARGET_CODENAME} main" | sudo tee /etc/apt/sources.list.d/ros2.list > /dev/null

# 4. Cài đặt ROS 2 Base và các công cụ phát triển
echo "[4/5] Cài đặt ROS 2 ${ROS_DISTRO} Base & Build Tools..."
sudo apt update -y
sudo apt install -y \
    ros-${ROS_DISTRO}-ros-base \
    ros-dev-tools \
    python3-colcon-common-extensions \
    python3-rosdep

# Cài đặt thêm driver RPLiDAR và package SLAM nếu có sẵn
echo "Cài đặt package LiDAR & SLAM cho ROS 2..."
sudo apt install -y \
    ros-${ROS_DISTRO}-rplidar-ros \
    ros-${ROS_DISTRO}-slam-toolbox \
    ros-${ROS_DISTRO}-navigation2 \
    ros-${ROS_DISTRO}-nav2-bringup || true

# 5. Khởi tạo rosdep và thêm source vào .bashrc
echo "[5/5] Cấu hình môi trường ROS 2..."
if [ ! -d "/etc/ros/rosdep/sources.list.d" ]; then
    sudo rosdep init || true
fi
rosdep update || true

# Thêm source vào .bashrc nếu chưa có
if ! grep -q "source /opt/ros/${ROS_DISTRO}/setup.bash" ~/.bashrc; then
    echo "source /opt/ros/${ROS_DISTRO}/setup.bash" >> ~/.bashrc
    echo "export ROS_DOMAIN_ID=42" >> ~/.bashrc
    echo "export RMW_IMPLEMENTATION=rmw_cyclonedds_cpp" >> ~/.bashrc
fi

echo "=========================================================="
echo "  ✅ HOÀN TẤT CÀI ĐẶT ROS 2 (${ROS_DISTRO}) TRÊN PI 5!"
echo "  Để kích hoạt ngay, hãy chạy: source ~/.bashrc"
echo "=========================================================="
