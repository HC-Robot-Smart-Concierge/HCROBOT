#!/bin/bash
# Script lưu bản đồ SLAM Occupancy Grid (.yaml + .pgm)
set -e

source /opt/ros/jazzy/setup.bash
export ROS_DOMAIN_ID=0

MAP_NAME="${1:-phong_lam_viec}"
OUTPUT_DIR="/mnt/f/DoAn/HC-Robot/robot/maps"
mkdir -p "$OUTPUT_DIR"

TARGET_FILE="$OUTPUT_DIR/$MAP_NAME"

echo "💾 Đang trích xuất và lưu bản đồ SLAM hiện tại vào: $TARGET_FILE.yaml / .pgm ..."
ros2 run nav2_map_server map_saver_cli -f "$TARGET_FILE" --ros-args -p save_map_timeout:=5.0

echo "✅ Đã lưu bản đồ thành công!"
echo "   - YAML: $TARGET_FILE.yaml"
echo "   - PGM:  $TARGET_FILE.pgm"
