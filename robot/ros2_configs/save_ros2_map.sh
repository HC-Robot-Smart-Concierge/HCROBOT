#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MAP_NAME="${1:-my_map}"
OUTPUT_DIR="$SCRIPT_DIR/../maps"
OUTPUT_PATH="$OUTPUT_DIR/$MAP_NAME"

mkdir -p "$OUTPUT_DIR"

source /opt/ros/jazzy/setup.bash 2>/dev/null || source /opt/ros/humble/setup.bash 2>/dev/null || true
export ROS_DOMAIN_ID=0

echo "💾 Dang luu Occupancy Grid Map tu ROS 2 topic /map sang $OUTPUT_PATH ..."
ros2 run nav2_map_server map_saver_cli -f "$OUTPUT_PATH"

echo "✅ Da luu ban do thanh cong:"
echo "   - File YAML: ${OUTPUT_PATH}.yaml"
echo "   - File PGM:  ${OUTPUT_PATH}.pgm"
