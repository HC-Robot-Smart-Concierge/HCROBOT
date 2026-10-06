#!/bin/bash
set -e

source /opt/ros/jazzy/setup.bash
export ROS_LOCALHOST_ONLY=1
export PATH="/opt/ros/jazzy/opt/gz_tools_vendor/bin:$PATH"
export GZ_SIM_RESOURCE_PATH="/mnt/f/DoAn/HC-Robot/robot/models:/home/kha/.gazebo/models:/home/kha/.gz/models:$GZ_SIM_RESOURCE_PATH"
export GAZEBO_MODEL_PATH="/mnt/f/DoAn/HC-Robot/robot/models:/home/kha/.gazebo/models:/home/kha/.gz/models:$GAZEBO_MODEL_PATH"

echo "=========================================================="
echo "    HC-ROBOT AUTONOMOUS NAVIGATION DEMO (8m x 6m ARENA)   "
echo "=========================================================="

echo " [1/3] Don dep triet de moi tien trinh Gazebo / ROS 2 cu..."
pkill -9 -f 'gz sim' 2>/dev/null || true
pkill -9 -f 'parameter_bridge' 2>/dev/null || true
pkill -9 -f 'autonomous_navigator' 2>/dev/null || true
killall -9 gz-sim-server gz-sim-gui parameter_bridge rviz2 robot_state_publisher async_slam_toolbox_node 2>/dev/null || true
sleep 1

# Dong bo model hc_robot moi nhat vao thu muc cache cua he thong
mkdir -p /home/kha/.gazebo/models/hc_robot /home/kha/.gz/models/hc_robot 2>/dev/null || true
cp -rf /mnt/f/DoAn/HC-Robot/robot/models/hc_robot/* /home/kha/.gazebo/models/hc_robot/ 2>/dev/null || true
cp -rf /mnt/f/DoAn/HC-Robot/robot/models/hc_robot/* /home/kha/.gz/models/hc_robot/ 2>/dev/null || true

echo " [2/3] Khoi dong Duy Nhat 1 Cua So: Gazebo Sim (Sa ban 8x6m + HC-Robot)..."
gz sim -r /mnt/f/DoAn/HC-Robot/robot/worlds/hotel_room.world &
GZ_PID=$!
sleep 4

echo " [3/3] Khoi dong ROS 2 Bridge (clock, cmd_vel, odom, scan, camera)..."
ros2 run ros_gz_bridge parameter_bridge \
    /clock@rosgraph_msgs/msg/Clock[gz.msgs.Clock \
    /cmd_vel@geometry_msgs/msg/Twist]gz.msgs.Twist \
    /odom@nav_msgs/msg/Odometry[gz.msgs.Odometry \
    /scan@sensor_msgs/msg/LaserScan[gz.msgs.LaserScan \
    /camera/image_raw@sensor_msgs/msg/Image[gz.msgs.Image \
    /camera/camera_info@sensor_msgs/msg/CameraInfo[gz.msgs.CameraInfo &
BRIDGE_PID=$!
sleep 2

cleanup() {
    echo ">> Dang don dep va dong toan bo tien trinh mo phong..."
    kill $BRIDGE_PID $GZ_PID 2>/dev/null || true
    pkill -9 -f 'gz sim' 2>/dev/null || true
    pkill -9 -f 'parameter_bridge' 2>/dev/null || true
    pkill -9 -f 'autonomous_navigator' 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "=========================================================="
echo " KICH HOAT TU HANH: ROBOT TUAN TRA NE VAT CAN TRONG GAZEBO..."
echo "=========================================================="
python3 /mnt/f/DoAn/HC-Robot/robot/scripts/autonomous_navigator.py --ros-args -p use_sim_time:=true
