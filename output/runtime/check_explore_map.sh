#!/bin/bash
source /opt/ros/jazzy/setup.bash
export ROS_DOMAIN_ID=0
cd '/mnt/d/FPT MATERIALS/9th Semeter (Final)/HCROBOT'
ros2 run nav2_map_server map_saver_cli -f "$PWD/output/runtime/explore-room-preview" --ros-args -p map_subscribe_transient_local:=true
