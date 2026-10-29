#!/bin/bash
set -e

source /opt/ros/jazzy/setup.bash
export ROS_DOMAIN_ID=0

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=== [0/5] DON DEP CAC TIEN TRINH CU (NEU CO) ==="
killall -q rosbridge_websocket foxglove_bridge async_slam_toolbox_node robot_state_publisher \
  map_server amcl controller_server planner_server behavior_server bt_navigator \
  waypoint_follower lifecycle_manager component_container_isolated 2>/dev/null || true
pkill -f "rosbridge_websocket" 2>/dev/null || true
pkill -f "[r]os2 launch rosbridge_server" 2>/dev/null || true
pkill -f "[r]os2 launch foxglove_bridge" 2>/dev/null || true
pkill -f "lidar_ws_to_ros2.py" 2>/dev/null || true
pkill -f "static_transform_publisher" 2>/dev/null || true
pkill -f "async_slam_toolbox_node" 2>/dev/null || true
fuser -k 9090/tcp 2>/dev/null || true
fuser -k 8765/tcp 2>/dev/null || true
sleep 1

echo "=== [1/5] KHOI DONG ROBOT STATE PUBLISHER (URDF 3D Model & TF Tree) ==="
URDF_PATH="$SCRIPT_DIR/../description/robot.urdf"
ros2 run robot_state_publisher robot_state_publisher "$URDF_PATH" &
RSP_PID=$!
sleep 1

echo "=== [2/5] KHOI DONG ROSBRIDGE WEBSOCKET SERVER (Port 9090) ==="
ros2 launch rosbridge_server rosbridge_websocket_launch.xml &
BRIDGE_PID=$!
sleep 2

echo "=== [3/5] KHOI DONG FOXGLOVE BRIDGE (Port 8765) ==="
ros2 launch foxglove_bridge foxglove_bridge_launch.xml \
  port:=8765 address:=0.0.0.0 use_sim_time:=False &
FOXGLOVE_PID=$!
sleep 2

echo "=== [4/5] KHOI DONG LIDAR BRIDGE (Pi 5 WS -> ROS 2 /scan & TF) ==="
HCROBOT_MODE=MAPPING \
HCROBOT_TELEOP_PWM=30 \
HCROBOT_TELEOP_TURN_PWM=25 \
HCROBOT_MAP_DIR="$SCRIPT_DIR/../maps" \
python3 "$SCRIPT_DIR/lidar_ws_to_ros2.py" &
LIDAR_PID=$!
sleep 2

echo "=== [5/5] KHOI DONG SLAM TOOLBOX ONLINE ASYNC ==="
ros2 launch slam_toolbox online_async_launch.py use_sim_time:=False slam_params_file:="$SCRIPT_DIR/slam_toolbox_params.yaml" &
SLAM_PID=$!

echo "=========================================================="
echo " HE THONG SLAM DANG HOAT DONG TREN LAPTOP WSL2!"
echo "   - Robot Model: Load URDF tu robot/description/robot.urdf"
echo "   - Topic /scan dang nhan tia tu Pi 5 qua Tailscale"
echo "   - SLAM Toolbox dang dung Occupancy Grid Map tren /map"
echo "   - MODE=MAPPING: chi dung de tao map mot lan"
echo "   - Rosbridge WebSocket mo tai ws://127.0.0.1:9090 cho Web Admin"
echo "   - Foxglove WebSocket mo tai ws://127.0.0.1:8765 cho map realtime"
echo "=========================================================="

trap "kill $RSP_PID $BRIDGE_PID $FOXGLOVE_PID $LIDAR_PID $SLAM_PID 2>/dev/null || true" EXIT INT TERM

wait $RSP_PID $BRIDGE_PID $FOXGLOVE_PID $LIDAR_PID $SLAM_PID
