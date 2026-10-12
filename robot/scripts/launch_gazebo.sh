#!/bin/bash
set -e

source /opt/ros/jazzy/setup.bash
export PATH="/usr/bin:/bin:/usr/local/bin:/opt/ros/jazzy/opt/gz_tools_vendor/bin:$PATH"
export GZ_CONFIG_PATH="/opt/ros/jazzy/opt/gz_sim_vendor/share/gz:/opt/ros/jazzy/opt/gz_gui_vendor/share/gz:/opt/ros/jazzy/opt/gz_msgs_vendor/share/gz:/opt/ros/jazzy/opt/gz_transport_vendor/share/gz:/opt/ros/jazzy/opt/gz_plugin_vendor/share/gz:/opt/ros/jazzy/opt/sdformat_vendor/share/gz:/opt/ros/jazzy/opt/gz_fuel_tools_vendor/share/gz:${GZ_CONFIG_PATH:-}"
export GZ_SIM_RESOURCE_PATH="/mnt/d/do_an_fptu/HCROBOT/robot/models:$HOME/.gazebo/models:$HOME/.gz/models:$GZ_SIM_RESOURCE_PATH"
export GAZEBO_MODEL_PATH="/mnt/d/do_an_fptu/HCROBOT/robot/models:$HOME/.gazebo/models:$HOME/.gz/models:$GAZEBO_MODEL_PATH"

echo "=========================================================="
echo " KHOI CHAY GAZEBO HARMONIC (ROS 2 JAZZY) TREN WSL2"
echo " Can phong mo phong: /mnt/d/do_an_fptu/HCROBOT/robot/worlds/hotel_room.world"
echo "=========================================================="

gz sim -v 4 -r /mnt/d/do_an_fptu/HCROBOT/robot/worlds/hotel_room.world
