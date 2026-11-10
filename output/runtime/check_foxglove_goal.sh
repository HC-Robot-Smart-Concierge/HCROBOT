#!/bin/bash
source /opt/ros/jazzy/setup.bash
export ROS_DOMAIN_ID=0
ros2 topic info /goal_pose --verbose
ros2 node info /bt_navigator
ros2 lifecycle get /bt_navigator
ss -ltnp '( sport = :8765 )'
