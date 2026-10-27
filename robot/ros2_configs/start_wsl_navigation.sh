#!/bin/bash
set -e

source /opt/ros/jazzy/setup.bash
export ROS_DOMAIN_ID=0

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MAPS_DIR="$(cd "$SCRIPT_DIR/../maps" && pwd)"
MAP_INPUT="${1:-phong_lam_viec}"

if [ -f "$MAP_INPUT" ]; then
    MAP_YAML="$(realpath "$MAP_INPUT")"
else
    MAP_NAME="${MAP_INPUT%.yaml}"
    MAP_YAML="$MAPS_DIR/$MAP_NAME.yaml"
fi

if [ ! -f "$MAP_YAML" ]; then
    echo "ERROR: Khong tim thay static map: $MAP_YAML" >&2
    echo "Hay quet va luu map truoc bang save_ros2_map.sh <ten_map>." >&2
    exit 2
fi

echo "=== [0/5] DON STACK MAPPING/NAVIGATION CU ==="
killall -q rosbridge_websocket async_slam_toolbox_node robot_state_publisher \
  map_server amcl controller_server planner_server behavior_server bt_navigator \
  waypoint_follower lifecycle_manager component_container_isolated 2>/dev/null || true
pkill -f "lidar_ws_to_ros2.py" 2>/dev/null || true
fuser -k 9090/tcp 2>/dev/null || true
sleep 1

echo "=== [1/5] ROBOT STATE PUBLISHER ==="
URDF_PATH="$SCRIPT_DIR/../description/robot.urdf"
ros2 run robot_state_publisher robot_state_publisher "$URDF_PATH" &
RSP_PID=$!
sleep 1

echo "=== [2/5] ROSBRIDGE :9090 ==="
ros2 launch rosbridge_server rosbridge_websocket_launch.xml &
BRIDGE_PID=$!
sleep 2

echo "=== [3/5] LIDAR + ENCODER/IMU ODOM BRIDGE ==="
HCROBOT_MODE=NAVIGATION \
HCROBOT_MAP_DIR="$MAPS_DIR" \
python3 "$SCRIPT_DIR/lidar_ws_to_ros2.py" &
LIDAR_PID=$!
sleep 2

echo "=== [4/5] MAP SERVER + AMCL + NAV2 ==="
ros2 launch "$SCRIPT_DIR/nav2/navigation_launch.py" \
  map:="$MAP_YAML" \
  params_file:="$SCRIPT_DIR/nav2/nav2_params.yaml" \
  use_sim_time:=False \
  autostart:=True &
NAV2_PID=$!

echo "=== [5/5] NAVIGATION READY ==="
echo " Static map: $MAP_YAML"
echo " /map       : map_server (read-only)"
echo " /amcl_pose : robot localization"
echo " /scan      : AMCL + obstacle layers + RViz only"
echo " /cmd_vel   : Nav2 -> Pi 5 motor bridge"
echo " Slam Toolbox KHONG chay trong mode nay."

trap "kill $RSP_PID $BRIDGE_PID $LIDAR_PID $NAV2_PID 2>/dev/null || true" EXIT INT TERM
wait $RSP_PID $BRIDGE_PID $LIDAR_PID $NAV2_PID
