#!/bin/bash
set -e
source /opt/ros/jazzy/setup.bash
export ROS_DOMAIN_ID=0
cd '/mnt/d/FPT MATERIALS/9th Semeter (Final)/HCROBOT'
python3 output/runtime/test_sim_navigation.py
python3 -c "import ast,pathlib; ast.parse(pathlib.Path('robot/ros2_configs/nav2/navigation_launch.py').read_text()); import yaml; print(yaml.safe_load(pathlib.Path('robot/ros2_configs/nav2/sim_navigation_overrides.yaml').read_text()))"
bash -n robot/ros2_configs/start_sim_foxglove.sh
