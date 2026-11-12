#!/bin/bash
set -e
cd '/mnt/d/FPT MATERIALS/9th Semeter (Final)/HCROBOT'
pkill -f '[f]rontier_explorer.py' 2>/dev/null || true
exec env WORLD="$PWD/robot/worlds/explore_room.world" GZ_GUI=1 EXPLORE=1 EXPLORE_SAVE=explore_room bash robot/ros2_configs/start_sim_foxglove.sh
