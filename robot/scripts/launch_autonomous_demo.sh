#!/bin/bash
set -e

source /opt/ros/jazzy/setup.bash
export PATH="/usr/bin:/bin:/usr/local/bin:/opt/ros/jazzy/opt/gz_tools_vendor/bin:$PATH"
export GZ_CONFIG_PATH="/opt/ros/jazzy/opt/gz_sim_vendor/share/gz:/opt/ros/jazzy/opt/gz_gui_vendor/share/gz:/opt/ros/jazzy/opt/gz_msgs_vendor/share/gz:/opt/ros/jazzy/opt/gz_transport_vendor/share/gz:/opt/ros/jazzy/opt/gz_plugin_vendor/share/gz:/opt/ros/jazzy/opt/sdformat_vendor/share/gz:/opt/ros/jazzy/opt/gz_fuel_tools_vendor/share/gz:${GZ_CONFIG_PATH:-}"
export GZ_SIM_RESOURCE_PATH="/mnt/f/DoAn/HC-Robot/robot/models:/home/kha/.gazebo/models:/home/kha/.gz/models:$GZ_SIM_RESOURCE_PATH"
export GAZEBO_MODEL_PATH="/mnt/f/DoAn/HC-Robot/robot/models:/home/kha/.gazebo/models:/home/kha/.gz/models:$GAZEBO_MODEL_PATH"

echo "=========================================================="
echo "    HC-ROBOT AUTONOMOUS NAVIGATION DEMO (10m x 6m ARENA)  "
echo "=========================================================="

echo " [1/4] Don dep triet de moi tien trinh Gazebo / ROS 2 cu..."
pkill -9 -f 'gz sim' 2>/dev/null || true
pkill -9 -f 'parameter_bridge' 2>/dev/null || true
pkill -9 -f 'autonomous_navigator' 2>/dev/null || true
pkill -9 -f 'rosbridge_websocket' 2>/dev/null || true
killall -9 gz-sim-server gz-sim-gui parameter_bridge rviz2 robot_state_publisher async_slam_toolbox_node rosbridge_websocket 2>/dev/null || true
sleep 1

# Dong bo model hc_robot moi nhat vao thu muc cache cua he thong
mkdir -p /home/kha/.gazebo/models/hc_robot /home/kha/.gz/models/hc_robot 2>/dev/null || true
cp -rf /mnt/f/DoAn/HC-Robot/robot/models/hc_robot/* /home/kha/.gazebo/models/hc_robot/ 2>/dev/null || true
cp -rf /mnt/f/DoAn/HC-Robot/robot/models/hc_robot/* /home/kha/.gz/models/hc_robot/ 2>/dev/null || true

echo " [2/4] Khoi dong Gazebo Sim (Sa ban 10x6m + HC-Robot)..."
gz sim -r /mnt/f/DoAn/HC-Robot/robot/worlds/hotel_room.world &
GZ_PID=$!
sleep 4

echo " [3/4] Khoi dong ROS 2 Bridge (clock, cmd_vel, odom, scan, camera)..."
ros2 run ros_gz_bridge parameter_bridge \
    '/clock@rosgraph_msgs/msg/Clock[gz.msgs.Clock' \
    '/cmd_vel@geometry_msgs/msg/Twist]gz.msgs.Twist' \
    '/odom@nav_msgs/msg/Odometry[gz.msgs.Odometry' \
    '/scan@sensor_msgs/msg/LaserScan[gz.msgs.LaserScan' \
    '/camera/image_raw@sensor_msgs/msg/Image[gz.msgs.Image' \
    '/camera/camera_info@sensor_msgs/msg/CameraInfo[gz.msgs.CameraInfo' &
BRIDGE_PID=$!
sleep 2

echo " [4/4] Khoi dong Rosbridge WebSocket (Cong 9090 cho Web Admin & Kiosk)..."
ros2 launch rosbridge_server rosbridge_websocket_launch.xml &
ROSBRIDGE_PID=$!
sleep 2

cleanup() {
    echo ">> Dang don dep va dong toan bo tien trinh mo phong..."
    kill $BRIDGE_PID $GZ_PID $ROSBRIDGE_PID 2>/dev/null || true
    pkill -9 -f 'gz sim' 2>/dev/null || true
    pkill -9 -f 'parameter_bridge' 2>/dev/null || true
    pkill -9 -f 'autonomous_navigator' 2>/dev/null || true
    pkill -9 -f 'rosbridge_websocket' 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "=========================================================="
echo " KICH HOAT TU HANH: ROBOT SAN SANG NHAN LENH TU WEB VA TUAN TRA..."
echo "=========================================================="
python3 /mnt/f/DoAn/HC-Robot/robot/scripts/autonomous_navigator.py --ros-args -p use_sim_time:=true
