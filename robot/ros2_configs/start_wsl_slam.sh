#!/bin/bash
set -e

source /opt/ros/jazzy/setup.bash
export ROS_DOMAIN_ID=0

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=== [0/4] DON DEP CAC TIEN TRINH CU (NEU CO) ==="
killall -q rosbridge_websocket async_slam_toolbox_node robot_state_publisher 2>/dev/null || true
pkill -f "lidar_ws_to_ros2.py" 2>/dev/null || true
sleep 1

echo "=== [1/4] KHOI DONG ROBOT STATE PUBLISHER (URDF 3D Model & TF Tree) ==="
URDF_PATH="$SCRIPT_DIR/../description/robot.urdf"
ros2 run robot_state_publisher robot_state_publisher "$URDF_PATH" &
RSP_PID=$!
sleep 1

echo "=== [2/4] KHOI DONG ROSBRIDGE WEBSOCKET SERVER (Port 9090) ==="
ros2 launch rosbridge_server rosbridge_websocket_launch.xml &
BRIDGE_PID=$!
sleep 2

echo "=== [3/4] KHOI DONG LIDAR BRIDGE (Pi 5 WS -> ROS 2 /scan & TF) ==="
python3 "$SCRIPT_DIR/lidar_ws_to_ros2.py" &
LIDAR_PID=$!
sleep 2

echo "=== [4/4] KHOI DONG SLAM TOOLBOX ONLINE ASYNC ==="
ros2 launch slam_toolbox online_async_launch.py use_sim_time:=False slam_params_file:="$SCRIPT_DIR/slam_toolbox_params.yaml" &
SLAM_PID=$!

echo "=========================================================="
echo " HE THONG SLAM DANG HOAT DONG TREN LAPTOP WSL2!"
echo "   - Robot Model: Load URDF tu robot/description/robot.urdf"
echo "   - Topic /scan dang nhan tia tu Pi 5 qua Tailscale"
echo "   - SLAM Toolbox dang dung Occupancy Grid Map tren /map"
echo "   - Rosbridge WebSocket mo tai ws://127.0.0.1:9090 cho Web Admin"
echo "=========================================================="

trap "kill $RSP_PID $BRIDGE_PID $LIDAR_PID $SLAM_PID 2>/dev/null || true" EXIT INT TERM

wait $RSP_PID $BRIDGE_PID $LIDAR_PID $SLAM_PID
