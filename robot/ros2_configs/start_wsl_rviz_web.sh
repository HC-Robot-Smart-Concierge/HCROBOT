#!/bin/bash
set -e

source /opt/ros/jazzy/setup.bash 2>/dev/null || true
export ROS_DOMAIN_ID=0
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WS_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "=== [1/5] DON DEP CAC TIEN TRINH RVIZ / VNC CU ==="
killall -9 Xvfb x11vnc websockify rviz2 2>/dev/null || true
pkill -9 -f "Xvfb" 2>/dev/null || true
pkill -9 -f "x11vnc" 2>/dev/null || true
pkill -9 -f "websockify" 2>/dev/null || true
pkill -9 -f "rviz2" 2>/dev/null || true
fuser -k 5900/tcp 6080/tcp 2>/dev/null || true
rm -f /tmp/.X*-lock /tmp/.X11-unix/X9* 2>/dev/null || true
sleep 1

# Kiem tra xem SLAM Stack co dang chay san trong terminal khac khong
SLAM_RUNNING=0
if pgrep -f "async_slam_toolbox_node" >/dev/null 2>&1; then
    SLAM_RUNNING=1
    echo " -> SLAM Toolbox dang hoat dong san tren he thong. Giu nguyen khong reset."
else
    echo " -> Chua co tien trinh SLAM. Se don dep va khoi dong moi SLAM Stack..."
    killall -9 rosbridge_websocket robot_state_publisher 2>/dev/null || true
    pkill -9 -f "lidar_ws_to_ros2.py" 2>/dev/null || true
    pkill -9 -f "start_wsl_slam.sh" 2>/dev/null || true
    fuser -k 9090/tcp 2>/dev/null || true
fi

# Tim display number kha dung (99, 98, hoac 97)
DISP_NUM=99
if netstat -tuln 2>/dev/null | grep -q ":6099 "; then
    DISP_NUM=98
    if netstat -tuln 2>/dev/null | grep -q ":6098 "; then
        DISP_NUM=97
    fi
fi

unset WAYLAND_DISPLAY
export DISPLAY=127.0.0.1:$DISP_NUM

echo "=== [2/5] KHOI DONG X VIRTUAL FRAMEBUFFER (:$DISP_NUM, 1600x900) ==="
Xvfb :$DISP_NUM -screen 0 1600x900x24 -ac -listen tcp -nolisten unix &
XVFB_PID=$!
sleep 1.5

echo "=== [3/5] KHOI DONG OPENBOX & VNC WEBSOCKET (Port 6080) ==="
openbox &
OB_PID=$!
sleep 0.5

x11vnc -display 127.0.0.1:$DISP_NUM -noshm -forever -nopw -shared -rfbport 5900 -bg
sleep 0.5

websockify --web /usr/share/novnc 0.0.0.0:6080 127.0.0.1:5900 &
WS_PID=$!
sleep 1

if [ "$SLAM_RUNNING" -eq 0 ]; then
    echo "=== [4/5] KHOI DONG SLAM TOOLBOX & LIDAR BRIDGE ==="
    echo " -> Khoi dong moi toan bo SLAM Stack voi tham so chuan hoa..."
    bash "$SCRIPT_DIR/start_wsl_slam.sh" &
    SLAM_PID=$!
    sleep 3
else
    echo "=== [4/5] SLAM TOOLBOX & ROSBRIDGE DA SAN SANG (Bo qua buoc khoi dong lai) ==="
fi

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

trap "kill $XVFB_PID $OB_PID $WS_PID $RVIZ_PID ${SLAM_PID:-} 2>/dev/null || true; killall -9 Xvfb x11vnc websockify rviz2 2>/dev/null || true" EXIT INT TERM

wait $RVIZ_PID $WS_PID
