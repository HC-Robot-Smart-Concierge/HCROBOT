#!/bin/bash
# Script 1-click khởi chạy ROS 2 Node trên Raspberry Pi 5
# Cách dùng: ./scripts/run.sh [tên_node]
# Ví dụ:
#   ./scripts/run.sh                     (mặc định chạy ai_bridge_node)
#   ./scripts/run.sh telemetry_node
#   ./scripts/run.sh motor_driver_node

set -e

NODE=${1:-ai_bridge_node}

# 1. Tự động source ROS 2
if [ -n "$ROS_DISTRO" ] && [ -f "/opt/ros/$ROS_DISTRO/setup.bash" ]; then
    source "/opt/ros/$ROS_DISTRO/setup.bash"
elif [ -f "/opt/ros/lyrical/setup.bash" ]; then
    source /opt/ros/lyrical/setup.bash
elif [ -f "/opt/ros/humble/setup.bash" ]; then
    source /opt/ros/humble/setup.bash
else
    echo "❌ Lỗi: Không tìm thấy ROS 2 trong /opt/ros/"
    exit 1
fi

# 2. Tự động build nếu chưa có thư mục install
if [ ! -f "install/setup.bash" ]; then
    echo "==> Phát hiện chưa build, đang tự động colcon build..."
    colcon build --symlink-install --packages-select hc_robot_client
fi

# 3. Nạp workspace
source install/setup.bash

# 4. Chạy node
echo "==> 🚀 Đang khởi chạy node: $NODE..."
ros2 run hc_robot_client "$NODE"
