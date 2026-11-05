#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MAP_NAME="${1:-my_map}"
PAUSE_MODE="${2:-pause}"
OUTPUT_DIR="$SCRIPT_DIR/../maps"
OUTPUT_PATH="$OUTPUT_DIR/$MAP_NAME"

mkdir -p "$OUTPUT_DIR"

source /opt/ros/jazzy/setup.bash 2>/dev/null || source /opt/ros/humble/setup.bash 2>/dev/null || true
export ROS_DOMAIN_ID=0

echo "💾 Dang luu Occupancy Grid Map tu ROS 2 topic /map sang $OUTPUT_PATH ..."
ros2 run nav2_map_server map_saver_cli -f "$OUTPUT_PATH" \
  --ros-args -p map_subscribe_transient_local:=true

if [ "$PAUSE_MODE" != "--no-pause" ]; then
  # Dong bang Slam Toolbox sau khi luu. /scan van tiep tuc hoat dong de hien thi
  # va tranh vat can, nhung occupancy grid khong con nhan measurement moi.
  ros2 topic pub --once /robot/pause_map std_msgs/msg/Empty '{}' >/dev/null 2>&1 || true
  curl -fsS -X POST "http://${PI5_IP:-100.99.72.51}:8000/api/v1/map/mode" \
    -H 'Content-Type: application/json' -d '{"mode":"NAVIGATION"}' >/dev/null 2>&1 || true
fi

echo "✅ Da luu ban do thanh cong:"
echo "   - File YAML: ${OUTPUT_PATH}.yaml"
echo "   - File PGM:  ${OUTPUT_PATH}.pgm"
if [ "$PAUSE_MODE" != "--no-pause" ]; then
  echo "   - Mapping da khoa. Chay start_wsl_navigation.sh $MAP_NAME de tu hanh."
fi
