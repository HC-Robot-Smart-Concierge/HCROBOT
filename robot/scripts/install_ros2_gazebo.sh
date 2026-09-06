#!/usr/bin/env bash
# ==============================================================================
# Script tự động cài đặt ROS 2 Humble & Gazebo cho HC-Robot trên Ubuntu 22.04
# ==============================================================================
set -e
export DEBIAN_FRONTEND=noninteractive

echo "=========================================================="
echo ">>> [1/5] Cập nhật hệ thống & cấu hình Locale (UTF-8)..."
echo "=========================================================="
sudo apt update && sudo apt install -y locales curl gnupg lsb-release software-properties-common
sudo locale-gen en_US en_US.UTF-8
sudo update-locale LC_ALL=en_US.UTF-8 LANG=en_US.UTF-8
export LANG=en_US.UTF-8

echo "=========================================================="
echo ">>> [2/5] Thêm kho phần mềm chính thức ROS 2 Humble..."
echo "=========================================================="
sudo add-apt-repository universe -y
sudo curl -sSL https://raw.githubusercontent.com/ros/rosdistro/master/ros.key -o /usr/share/keyrings/ros-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/ros-archive-keyring.gpg] http://packages.ros.org/ros2/ubuntu $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/ros2.list > /dev/null

echo "=========================================================="
echo ">>> [3/5] Cài đặt ROS 2 Humble Desktop & Build tools..."
echo "=========================================================="
sudo apt update
sudo apt install -y \
    ros-humble-desktop \
    python3-colcon-common-extensions \
    python3-rosdep \
    python3-argcomplete

echo "=========================================================="
echo ">>> [4/5] Cài đặt Gazebo & các gói ROS 2 Gazebo Plugins..."
echo "=========================================================="
sudo apt install -y \
    gazebo \
    ros-humble-gazebo-ros-pkgs \
    ros-humble-gazebo-ros2-control \
    ros-humble-xacro \
    ros-humble-joint-state-publisher \
    ros-humble-robot-state-publisher

echo "=========================================================="
echo ">>> [5/5] Cài đặt Nav2, SLAM Toolbox & Teleop..."
echo "=========================================================="
sudo apt install -y \
    ros-humble-navigation2 \
    ros-humble-nav2-bringup \
    ros-humble-slam-toolbox \
    ros-humble-teleop-twist-keyboard

# Khởi tạo rosdep nếu chưa có
if [ ! -f /etc/ros/rosdep/sources.list.d/20-default.list ]; then
    echo ">>> Khởi tạo rosdep..."
    sudo rosdep init || true
fi
rosdep update || true

# Tự động source ROS 2 vào ~/.bashrc nếu chưa có
if ! grep -q "source /opt/ros/humble/setup.bash" ~/.bashrc; then
    echo "source /opt/ros/humble/setup.bash" >> ~/.bashrc
fi

echo "=========================================================="
echo ">>> HOÀN TẤT CÀI ĐẶT ROS 2 HUMBLE & GAZEBO THÀNH CÔNG!"
echo "=========================================================="
