#!/bin/bash
# Script lưu bản đồ SLAM Occupancy Grid (.yaml + .pgm)
set -e

source /opt/ros/jazzy/setup.bash
export ROS_DOMAIN_ID=0

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROBOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

MAP_NAME="${1:-phong_lam_viec}"
OUTPUT_DIR="$ROBOT_DIR/maps"
mkdir -p "$OUTPUT_DIR"

TARGET_FILE="$OUTPUT_DIR/$MAP_NAME"

echo "[INFO] Dang trich xuat va luu ban do SLAM hien tai vao: $TARGET_FILE.yaml / .pgm ..."
ros2 run nav2_map_server map_saver_cli -f "$TARGET_FILE" --ros-args -p save_map_timeout:=5.0

echo "[SUCCESS] Da luu ban do thanh cong!"
echo "   - YAML: $TARGET_FILE.yaml"
echo "   - PGM:  $TARGET_FILE.pgm"
