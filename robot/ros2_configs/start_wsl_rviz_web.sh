#!/bin/bash
set -e

source /opt/ros/jazzy/setup.bash 2>/dev/null || true
export ROS_DOMAIN_ID=0
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WS_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "=== [1/5] DON DEP CAC TIEN TRINH CU ==="
killall -9 Xvfb x11vnc websockify rviz2 2>/dev/null || true
pkill -9 -f "Xvfb" 2>/dev/null || true
pkill -9 -f "x11vnc" 2>/dev/null || true
pkill -9 -f "websockify" 2>/dev/null || true
killall -9 rosbridge_websocket async_slam_toolbox_node robot_state_publisher 2>/dev/null || true
pkill -9 -f "async_slam_toolbox_node" 2>/dev/null || true
pkill -9 -f "lidar_ws_to_ros2.py" 2>/dev/null || true
pkill -9 -f "slam_toolbox" 2>/dev/null || true
pkill -9 -f "start_wsl_slam.sh" 2>/dev/null || true
sudo chmod 1777 /tmp/.X11-unix 2>/dev/null || true
rm -f /tmp/.X*-lock /tmp/.X11-unix/X* 2>/dev/null || true
mkdir -p /tmp/.X11-unix 2>/dev/null || true
chmod 1777 /tmp/.X11-unix 2>/dev/null || true
sleep 1

# Tim display number kha dung (99, 98, hoac 97)
DISP_NUM=99
if [ -e "/tmp/.X11-unix/X99" ] || [ -e "/tmp/.X99-lock" ]; then
    DISP_NUM=98
    if [ -e "/tmp/.X11-unix/X98" ] || [ -e "/tmp/.X98-lock" ]; then
        DISP_NUM=97
    fi
fi

echo "=== [2/5] KHOI DONG X VIRTUAL FRAMEBUFFER (:$DISP_NUM, 1600x900) ==="
Xvfb :$DISP_NUM -screen 0 1600x900x24 -ac -listen tcp &
XVFB_PID=$!
sleep 1.5

export DISPLAY=:$DISP_NUM
unset WAYLAND_DISPLAY

echo "=== [3/5] KHOI DONG OPENBOX & VNC WEBSOCKET (Port 6080) ==="
openbox &
OB_PID=$!
sleep 0.5

x11vnc -display :$DISP_NUM -forever -nopw -shared -rfbport 5900 -bg 2>/dev/null || x11vnc -display localhost:$DISP_NUM -forever -nopw -shared -rfbport 5900 -bg
sleep 0.5

websockify --web /usr/share/novnc 0.0.0.0:6080 127.0.0.1:5900 &
WS_PID=$!
sleep 1

echo "=== [4/5] KHOI DONG SLAM TOOLBOX & LIDAR BRIDGE ==="
echo " -> Khoi dong moi toan bo SLAM Stack voi tham so chuan hoa..."
bash "$SCRIPT_DIR/start_wsl_slam.sh" &
SLAM_PID=$!
sleep 3

echo "=== [5/5] KHOI DONG RVIZ2 3D SLAM ==="
RVIZ_CFG="$WS_DIR/robot/ros2_configs/nav2/lidar_view.rviz"
LIBGL_ALWAYS_SOFTWARE=1 rviz2 -d "$RVIZ_CFG" &
RVIZ_PID=$!

# Tu dong maximize cua so RViz2 de chiem tron man hinh ma van giu nguyen thanh Tool & Displays
(
    sleep 3
    wmctrl -r "RViz" -b add,maximized_vert,maximized_horz 2>/dev/null || true
) &

echo "=========================================================="
echo " RVIZ2 WEB STREAMING SERVER DANG HOAT DONG!"
echo "   - Web Client: http://localhost:6080/vnc.html?autoconnect=true&resize=scale"
echo "   - VNC Port: 5900 | Web Port: 6080"
echo "   - Config: $RVIZ_CFG"
echo "=========================================================="

trap "kill $XVFB_PID $OB_PID $WS_PID $RVIZ_PID $SLAM_PID 2>/dev/null || true; killall -9 Xvfb x11vnc websockify rviz2 2>/dev/null || true" EXIT INT TERM

wait $RVIZ_PID $WS_PID
