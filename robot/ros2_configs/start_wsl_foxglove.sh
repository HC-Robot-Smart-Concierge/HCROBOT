#!/bin/bash
set -e

source /opt/ros/jazzy/setup.bash
export ROS_DOMAIN_ID=0

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODE="${1:-navigation}"
MAP_NAME="${2:-phong_lam_viec}"

echo "=== DON VIEWER RVIZ/VNC CU ==="
killall -9 Xvfb x11vnc websockify rviz2 2>/dev/null || true
pkill -f "[X]vfb :99" 2>/dev/null || true
pkill -f "[w]ebsockify.*6080" 2>/dev/null || true
fuser -k 6080/tcp 5900/tcp 2>/dev/null || true
rm -f /tmp/.X99-lock /tmp/.X11-unix/X99 2>/dev/null || true

MAPPING_RUNNING=false
if { [ "$MODE" = "mapping" ] || [ "$MODE" = "MAPPING" ]; } \
  && pgrep -f "[l]idar_ws_to_ros2.py" >/dev/null \
  && pgrep -f "[a]sync_slam_toolbox_node" >/dev/null; then
    MAPPING_RUNNING=true
fi

if [ "$MAPPING_RUNNING" = true ]; then
    echo "MAPPING dang chay: giu nguyen pose graph va occupancy map hien tai."

    if ! pgrep -x rosbridge_websocket >/dev/null; then
        nohup ros2 launch rosbridge_server rosbridge_websocket_launch.xml \
          >/tmp/hcrobot-rosbridge.log 2>&1 &
    fi
    if ! pgrep -x foxglove_bridge >/dev/null; then
        nohup ros2 launch foxglove_bridge foxglove_bridge_launch.xml \
          port:=8765 address:=0.0.0.0 use_sim_time:=False \
          >/tmp/hcrobot-foxglove.log 2>&1 &
    fi
else
    echo "Khoi dong ROS 2 mode=$MODE, map=$MAP_NAME"
    if [ "$MODE" = "mapping" ] || [ "$MODE" = "MAPPING" ]; then
        nohup bash "$SCRIPT_DIR/start_wsl_slam.sh" \
          >/tmp/hcrobot-slam.log 2>&1 &
    else
        nohup bash "$SCRIPT_DIR/start_wsl_navigation.sh" "$MAP_NAME" \
          >/tmp/hcrobot-navigation.log 2>&1 &
    fi
    # Cho stack cu dong han va stack moi chiem lai cac port. Neu kiem tra ngay,
    # port cua phien cu co the lam wrapper bao READY som trong luc dang restart.
    sleep 3
fi

echo "Dang cho Rosbridge :9090 va Foxglove :8765..."
for _attempt in $(seq 1 30); do
    if (echo >/dev/tcp/127.0.0.1/9090) 2>/dev/null \
      && (echo >/dev/tcp/127.0.0.1/8765) 2>/dev/null; then
        echo "READY: rosbridge=ws://127.0.0.1:9090 foxglove=ws://127.0.0.1:8765"
        exit 0
    fi
    sleep 1
done

echo "ERROR: ROS 2/Foxglove khong san sang sau 30 giay." >&2
exit 1
