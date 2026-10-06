#!/bin/bash
set -e

source /opt/ros/jazzy/setup.bash
export PATH="/opt/ros/jazzy/opt/gz_tools_vendor/bin:$PATH"
export GZ_SIM_RESOURCE_PATH="/mnt/f/DoAn/HC-Robot/robot/models:/home/kha/.gazebo/models:/home/kha/.gz/models:$GZ_SIM_RESOURCE_PATH"
export GAZEBO_MODEL_PATH="/mnt/f/DoAn/HC-Robot/robot/models:/home/kha/.gazebo/models:/home/kha/.gz/models:$GAZEBO_MODEL_PATH"

echo "=========================================================="
echo " KHOI CHAY GAZEBO HARMONIC (ROS 2 JAZZY) TREN WSL2"
echo " Can phong mo phong: /mnt/f/DoAn/HC-Robot/robot/worlds/hotel_room.world"
echo "=========================================================="

gz sim -v 4 -r /mnt/f/DoAn/HC-Robot/robot/worlds/hotel_room.world
