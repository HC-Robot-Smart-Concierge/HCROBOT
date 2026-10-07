#!/bin/bash
set -e
source /opt/ros/jazzy/setup.bash
export PATH="/opt/ros/jazzy/opt/gz_tools_vendor/bin:$PATH"

gz sim -s -r /mnt/f/DoAn/HC-Robot/robot/worlds/hotel_room.world &
GZ_PID=$!

echo "Cho Gazebo khoi dong..."
sleep 4

echo "Thu spawn robot tu robot.urdf..."
ros2 run ros_gz_sim create -world hotel_lobby_world -file /mnt/f/DoAn/HC-Robot/robot/description/robot.urdf -name hc_robot -x -2.0 -y 1.55 -z 0.05

sleep 2
echo "Da spawn thanh cong! Dang dong tien trinh test..."
kill $GZ_PID || true
