#!/bin/bash
source /opt/ros/jazzy/setup.bash
export ROS_DOMAIN_ID=0
python3 '/mnt/d/FPT MATERIALS/9th Semeter (Final)/HCROBOT/output/runtime/diagnose_navigation.py'
ros2 param get /controller_server FollowPath.max_vel_theta
ros2 param get /controller_server FollowPath.angular_dist_threshold
ros2 param get /controller_server FollowPath.rotate_to_heading_angular_vel
