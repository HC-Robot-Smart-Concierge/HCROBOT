#!/bin/bash
set -e

source /opt/ros/jazzy/setup.bash
export ROS_LOCALHOST_ONLY=1
export PATH="/usr/bin:/bin:/usr/local/bin:/opt/ros/jazzy/opt/gz_tools_vendor/bin:$PATH"
export GZ_CONFIG_PATH="/opt/ros/jazzy/opt/gz_sim_vendor/share/gz:/opt/ros/jazzy/opt/gz_gui_vendor/share/gz:/opt/ros/jazzy/opt/gz_msgs_vendor/share/gz:/opt/ros/jazzy/opt/gz_transport_vendor/share/gz:/opt/ros/jazzy/opt/gz_plugin_vendor/share/gz:/opt/ros/jazzy/opt/sdformat_vendor/share/gz:/opt/ros/jazzy/opt/gz_fuel_tools_vendor/share/gz:${GZ_CONFIG_PATH:-}"
export GZ_SIM_RESOURCE_PATH="/mnt/f/DoAn/HC-Robot/robot/models:/home/kha/.gazebo/models:/home/kha/.gz/models:$GZ_SIM_RESOURCE_PATH"
export GAZEBO_MODEL_PATH="/mnt/f/DoAn/HC-Robot/robot/models:/home/kha/.gazebo/models:/home/kha/.gz/models:$GAZEBO_MODEL_PATH"

echo "=========================================================="
echo "   KHOI CHAY MO PHONG GAZEBO SIM + ROS 2 + WEB BRIDGE     "
echo "   Sanh Khach San Ground Floor (10m x 6m) + Robot Tu Hanh "
echo "=========================================================="

echo " [1/4] Don dep cac tien trinh cu neu co..."
pkill -9 -f 'gz sim' 2>/dev/null || true
pkill -9 -f 'parameter_bridge' 2>/dev/null || true
pkill -9 -f 'autonomous_navigator' 2>/dev/null || true
pkill -9 -f 'rosbridge_websocket' 2>/dev/null || true
sleep 1

# Dong bo model hc_robot moi nhat vao thu muc cache
mkdir -p /home/kha/.gazebo/models/hc_robot /home/kha/.gz/models/hc_robot 2>/dev/null || true
cp -rf /mnt/f/DoAn/HC-Robot/robot/models/hc_robot/* /home/kha/.gazebo/models/hc_robot/ 2>/dev/null || true
cp -rf /mnt/f/DoAn/HC-Robot/robot/models/hc_robot/* /home/kha/.gz/models/hc_robot/ 2>/dev/null || true

echo " [2/4] Khoi dong Gazebo Sim Harmonic (World: hotel_room.world)..."
gz sim -r /mnt/f/DoAn/HC-Robot/robot/worlds/hotel_room.world &
GZ_PID=$!
sleep 4

echo " [3/4] Khoi dong ROS 2 Bridge (cmd_vel, odom, scan, camera)..."
ros2 run ros_gz_bridge parameter_bridge \
    /clock@rosgraph_msgs/msg/Clock[gz.msgs.Clock \
    /cmd_vel@geometry_msgs/msg/Twist]gz.msgs.Twist \
    /odom@nav_msgs/msg/Odometry[gz.msgs.Odometry \
    /scan@sensor_msgs/msg/LaserScan[gz.msgs.LaserScan \
    /camera/image_raw@sensor_msgs/msg/Image[gz.msgs.Image \
    /camera/camera_info@sensor_msgs/msg/CameraInfo[gz.msgs.CameraInfo &
BRIDGE_PID=$!
sleep 2

echo " [4/4] Khoi dong Rosbridge WebSocket Server (Port 9090 cho Web)..."
ros2 launch rosbridge_server rosbridge_websocket_launch.xml &
WS_PID=$!
sleep 2

cleanup() {
    echo ">> Dang dong toan bo tien trinh mo phong va don dep sach se..."
    kill $WS_PID $BRIDGE_PID $GZ_PID 2>/dev/null || true
    pkill -9 -f 'gz sim' 2>/dev/null || true
    pkill -9 -f 'parameter_bridge' 2>/dev/null || true
    pkill -9 -f 'autonomous_navigator' 2>/dev/null || true
    pkill -9 -f 'rosbridge_websocket' 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "=========================================================="
echo " SAN SANG! KICH HOAT NODE TU HANH NE TUONG TRONG GAZEBO..."
echo " Node dang san sang tiep nhan lenh A->B tu Web hoac Tuan tra"
echo "=========================================================="
python3 /mnt/f/DoAn/HC-Robot/robot/scripts/autonomous_navigator.py --ros-args -p use_sim_time:=true
