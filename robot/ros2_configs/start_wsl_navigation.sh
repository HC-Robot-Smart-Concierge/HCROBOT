#!/bin/bash
set -e

source /opt/ros/jazzy/setup.bash
export ROS_DOMAIN_ID=0

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MAPS_DIR="$(cd "$SCRIPT_DIR/../maps" && pwd)"
MAP_INPUT="${1:-phong_lam_viec}"

if [ -f "$MAP_INPUT" ]; then
    MAP_YAML="$(realpath "$MAP_INPUT")"
else
    MAP_NAME="${MAP_INPUT%.yaml}"
    MAP_YAML="$MAPS_DIR/$MAP_NAME.yaml"
fi

if [ ! -f "$MAP_YAML" ]; then
    echo "ERROR: Khong tim thay static map: $MAP_YAML" >&2
    echo "Hay quet va luu map truoc bang save_ros2_map.sh <ten_map>." >&2
    exit 2
fi

RSP_PID=""; BRIDGE_PID=""; FOXGLOVE_PID=""; LIDAR_PID=""; NAV2_PID=""; ZONE_PID=""; LOC_PID=""
stop_robot() {
    for _ in 1 2 3; do
        echo -n stop > "/dev/udp/${PI5_IP:-100.99.72.51}/9999" 2>/dev/null || true
        sleep 0.1
    done
}
cleanup() {
    kill $NAV2_PID 2>/dev/null || true
    stop_robot
    kill -INT $LOC_PID 2>/dev/null || true   # INT: manager luu vi tri cuoi truoc khi thoat
    kill $RSP_PID $BRIDGE_PID $FOXGLOVE_PID $LIDAR_PID $ZONE_PID 2>/dev/null || true
    stop_robot
}
trap cleanup EXIT INT TERM

echo "=== [0/6] DON STACK MAPPING/NAVIGATION CU ==="
pkill -f "[f]rontier_explorer.py" 2>/dev/null || true
pkill -INT -f "[l]ocalization_manager.py" 2>/dev/null || true
pkill -f "[n]avigation_launch.py" 2>/dev/null || true
stop_robot
killall -q rosbridge_websocket foxglove_bridge async_slam_toolbox_node robot_state_publisher \
  map_server amcl controller_server planner_server behavior_server bt_navigator \
  waypoint_follower lifecycle_manager component_container_isolated 2>/dev/null || true
pkill -f "[r]os2 launch rosbridge_server" 2>/dev/null || true
pkill -f "[r]os2 launch foxglove_bridge" 2>/dev/null || true
pkill -f "lidar_ws_to_ros2.py" 2>/dev/null || true
pkill -f "[z]one_filters_launch.py" 2>/dev/null || true
pkill -f "costmap_filter_info_server" 2>/dev/null || true
pkill -f "lifecycle_manager_costmap_filters" 2>/dev/null || true
fuser -k 9090/tcp 2>/dev/null || true
fuser -k 8765/tcp 2>/dev/null || true
sleep 1

echo "=== [1/6] ROBOT STATE PUBLISHER ==="
URDF_PATH="$SCRIPT_DIR/../description/robot.urdf"
ros2 run robot_state_publisher robot_state_publisher "$URDF_PATH" &
RSP_PID=$!
sleep 1

echo "=== [2/6] ROSBRIDGE :9090 ==="
ros2 launch rosbridge_server rosbridge_websocket_launch.xml &
BRIDGE_PID=$!
sleep 2

echo "=== [3/6] FOXGLOVE BRIDGE :8765 ==="
ros2 launch foxglove_bridge foxglove_bridge_launch.xml \
  port:=8765 address:=0.0.0.0 use_sim_time:=False &
FOXGLOVE_PID=$!
sleep 2

echo "=== [4/6] LIDAR + ENCODER/IMU ODOM BRIDGE ==="
# Xe that chi chay duoc xoay tai cho hoac di thang (cung PWM thap kieu drive:0:22 khong
# lan) -> doi lenh Nav2 thanh xoay/di thang, giong che do tu quet (xem diff_drive.py).
# Scan khong deskew tung tia: cat xung xoay de AMCL/costmap co vong quet dung yen,
# bo cac vong thu trong luc gyro quay nhanh (giong mapping).
HCROBOT_MODE=NAVIGATION \
HCROBOT_CMD_VEL_MODE="${HCROBOT_CMD_VEL_MODE:-straight}" \
HCROBOT_TURN_PULSE_ON_SEC="${HCROBOT_TURN_PULSE_ON_SEC:-0.20}" \
HCROBOT_TURN_PULSE_OFF_SEC="${HCROBOT_TURN_PULSE_OFF_SEC:-0.50}" \
HCROBOT_SCAN_MAX_TURN_DPS="${HCROBOT_SCAN_MAX_TURN_DPS:-15}" \
HCROBOT_MAP_DIR="$MAPS_DIR" \
python3 "$SCRIPT_DIR/lidar_ws_to_ros2.py" &
LIDAR_PID=$!
sleep 2

echo "=== [4b/6] VUNG TU WEB ADMIN: CAM VAO (KEEPOUT) + GIOI HAN TOC DO (SPEED) ==="
# Mask do backend tao tu CSDL (luu/xoa vung tren Web, hoac bat Navigation tu Web). Chua co mask
# thi server cho load_map: ve vung tren Web luc Nav2 dang chay van ap dung ngay.
ros2 launch "$SCRIPT_DIR/nav2/zone_filters_launch.py" \
  map_name:="$(basename "${MAP_YAML%.yaml}")" use_sim_time:=False &
ZONE_PID=$!
sleep 1

echo "=== [4c/6] LOCALIZATION MANAGER (KHOA TU HANH TOI KHI LIDAR KHOP BAN DO) ==="
# Chay TRUOC Nav2: AMCL vua active la thu ngay vi tri luu lan truoc (robot/maps/last_pose/)
# va xac minh bang LiDAR. Trang thai: /localization/state - Web hien thi.
python3 "$SCRIPT_DIR/localization_manager.py" --ros-args \
  -p map_name:="$(basename "${MAP_YAML%.yaml}")" &
LOC_PID=$!

echo "=== [5/6] MAP SERVER + AMCL + NAV2 ==="
ros2 launch "$SCRIPT_DIR/nav2/navigation_launch.py" \
  map:="$MAP_YAML" \
  params_file:="$SCRIPT_DIR/nav2/nav2_params.yaml" \
  use_sim_time:=False \
  autostart:=True &
NAV2_PID=$!

echo "=== [6/6] NAVIGATION READY ==="
echo " Static map: $MAP_YAML"
echo " /map       : map_server (read-only)"
echo " /amcl_pose : robot localization"
echo " /localization/state : UNLOCALIZED/LOCALIZING/LOCALIZED/LOST - chi LOCALIZED moi nhan goal"
echo " /scan      : AMCL + obstacle layers + Foxglove"
echo " /cmd_vel   : Nav2 -> Pi 5 motor bridge"
echo " Foxglove   : ws://127.0.0.1:8765"
echo " Slam Toolbox KHONG chay trong mode nay."

wait $RSP_PID $BRIDGE_PID $FOXGLOVE_PID $LIDAR_PID $NAV2_PID
