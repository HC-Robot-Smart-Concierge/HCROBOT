#!/bin/bash
# Script build ROS 2 Workspace trên Raspberry Pi 5

set -e

echo "==> Building HC-Robot ROS 2 Client Package..."
colcon build --symlink-install --packages-select hc_robot_client

echo "==> Sourcing setup.bash..."
source install/setup.bash

echo "==> Build thành công! Đã sẵn sàng chạy ros2 run hc_robot_client <node_name>"
