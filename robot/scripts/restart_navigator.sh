#!/bin/bash
source /opt/ros/jazzy/setup.bash
pkill -9 -f "autonomous_navigator" 2>/dev/null || true
sleep 1
python3 /mnt/f/DoAn/HC-Robot/robot/scripts/autonomous_navigator.py --ros-args -p use_sim_time:=true
