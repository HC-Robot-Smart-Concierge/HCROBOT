#!/bin/bash
set -e

source /opt/ros/jazzy/setup.bash
export ROS_DOMAIN_ID=0

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=== [1/3] KHOI DONG ROSBRIDGE WEBSOCKET SERVER (Port 9090) ==="
ros2 launch rosbridge_server rosbridge_websocket_launch.xml &
BRIDGE_PID=$!
sleep 2

echo "=== [2/3] KHOI DONG LIDAR BRIDGE (Pi 5 WS -> ROS 2 /scan & TF) ==="
python3 "$SCRIPT_DIR/lidar_ws_to_ros2.py" &
LIDAR_PID=$!
sleep 2

echo "=== [3/3] KHOI DONG SLAM TOOLBOX ONLINE ASYNC ==="
ros2 launch slam_toolbox online_async_launch.py use_sim_time:=False slam_params_file:="$SCRIPT_DIR/slam_toolbox_params.yaml" &
SLAM_PID=$!

echo "=========================================================="
echo " HE THONG SLAM DANG HOAT DONG TREN LAPTOP WSL2!"
echo "   - Topic /scan dang nhan tia tu Pi 5 qua Tailscale"
echo "   - SLAM Toolbox dang dung Occupancy Grid Map tren /map"
echo "   - Rosbridge WebSocket mo tai ws://127.0.0.1:9090 cho Web Admin"
echo "=========================================================="

wait $BRIDGE_PID $LIDAR_PID $SLAM_PID
