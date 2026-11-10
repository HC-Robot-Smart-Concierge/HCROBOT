#!/bin/bash
source /opt/ros/jazzy/setup.bash
export ROS_DOMAIN_ID=0
ros2 param set /controller_server FollowPath.rotate_to_goal_heading true
