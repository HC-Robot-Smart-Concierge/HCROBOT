#!/bin/bash
source /opt/ros/jazzy/setup.bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
pkill -9 -f "autonomous_navigator" 2>/dev/null || true
sleep 1
python3 "$SCRIPT_DIR/autonomous_navigator.py" --ros-args -p use_sim_time:=true
