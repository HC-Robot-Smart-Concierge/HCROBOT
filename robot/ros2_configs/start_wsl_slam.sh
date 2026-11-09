#!/bin/bash
# Quet map bang XE THAT (Pi 5 phai dang chay: sudo python3 main.py).
#
#   bash robot/ros2_configs/start_wsl_slam.sh                       # lai tay (WASD / Web / Foxglove)
#   EXPLORE=1 bash robot/ros2_configs/start_wsl_slam.sh             # XE TU DI quet het map (Nav2 + frontier)
#   EXPLORE=1 EXPLORE_SAVE=phong_khach bash ...                     # ten map tu luu khi quet xong
#   PI5_IP=192.168.1.50 bash ...                                    # IP Pi (mac dinh Tailscale 100.99.72.51)
#
# EXPLORE=1: XE THAT SE TU CHAY. Ctrl+C trong terminal nay de dung; Pi tu ngat motor
# sau 0.5 s mat lenh (watchdog) va cam bien sieu am tren Pi van chan va cham.
set -e

source /opt/ros/jazzy/setup.bash
export ROS_DOMAIN_ID=0

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXPLORE="${EXPLORE:-0}"
if [ "$EXPLORE" = "1" ]; then
  # Tu quet xe that di theo DOAN THANG: xoay tai cho (38%, cat xung nhu lai tay) roi
  # chay thang (moi ben >= 30%). Che do diff cu phat cung PWM thap (vd drive:0:22) ma
  # xe that khong lan duoc -> Nav2 "Failed to make progress", xe dung im.
  DEFAULT_CMD_VEL_MODE=straight
else
  DEFAULT_CMD_VEL_MODE=discrete
fi

echo "=== [0/5] DON DEP CAC TIEN TRINH CU (NEU CO) ==="
killall -q rosbridge_websocket foxglove_bridge async_slam_toolbox_node robot_state_publisher \
  map_server amcl controller_server planner_server behavior_server bt_navigator \
  waypoint_follower lifecycle_manager component_container_isolated 2>/dev/null || true
pkill -f "rosbridge_websocket" 2>/dev/null || true
pkill -f "[r]os2 launch rosbridge_server" 2>/dev/null || true
pkill -f "[r]os2 launch foxglove_bridge" 2>/dev/null || true
pkill -f "lidar_ws_to_ros2.py" 2>/dev/null || true
pkill -f "static_transform_publisher" 2>/dev/null || true
pkill -f "async_slam_toolbox_node" 2>/dev/null || true
pkill -f "frontier_explorer.py" 2>/dev/null || true
# Gac cong dinh vi cua che do Navigation con sot se HUY moi goal cua bo tu quet => tat.
pkill -INT -f "[l]ocalization_manager.py" 2>/dev/null || true
pkill -f "[n]avigation_launch.py" 2>/dev/null || true
fuser -k 9090/tcp 2>/dev/null || true
fuser -k 8765/tcp 2>/dev/null || true
sleep 1

echo "=== [1/5] KHOI DONG ROBOT STATE PUBLISHER (URDF 3D Model & TF Tree) ==="
URDF_PATH="$SCRIPT_DIR/../description/robot.urdf"
ros2 run robot_state_publisher robot_state_publisher "$URDF_PATH" &
RSP_PID=$!
sleep 1

echo "=== [2/5] KHOI DONG ROSBRIDGE WEBSOCKET SERVER (Port 9090) ==="
ros2 launch rosbridge_server rosbridge_websocket_launch.xml &
BRIDGE_PID=$!
sleep 2

echo "=== [3/5] KHOI DONG FOXGLOVE BRIDGE (Port 8765) ==="
ros2 launch foxglove_bridge foxglove_bridge_launch.xml \
  port:=8765 address:=0.0.0.0 use_sim_time:=False &
FOXGLOVE_PID=$!
sleep 2

echo "=== [4/5] KHOI DONG LIDAR BRIDGE (Pi 5 WS -> ROS 2 /scan & TF) ==="
HCROBOT_MODE=MAPPING \
HCROBOT_TELEOP_PWM=30 \
HCROBOT_TELEOP_TURN_PWM=38 \
HCROBOT_TURN_PULSE_ON_SEC=0.20 \
HCROBOT_TURN_PULSE_OFF_SEC=0.50 \
HCROBOT_SCAN_MAX_TURN_DPS=15 \
HCROBOT_CMD_VEL_MODE="${HCROBOT_CMD_VEL_MODE:-$DEFAULT_CMD_VEL_MODE}" \
HCROBOT_MAP_DIR="$SCRIPT_DIR/../maps" \
python3 "$SCRIPT_DIR/lidar_ws_to_ros2.py" &
LIDAR_PID=$!
sleep 2

echo "=== [5/5] KHOI DONG SLAM TOOLBOX ONLINE ASYNC ==="
# Drive lifecycle transitions explicitly. The launch autostart can miss the
# configuring -> inactive event, leaving SLAM inactive and Nav2 without /map.
ros2 launch slam_toolbox online_async_launch.py autostart:=False use_sim_time:=False slam_params_file:="$SCRIPT_DIR/slam_toolbox_params.yaml" &
SLAM_PID=$!

SLAM_READY=0
for _ in $(seq 1 20); do
  SLAM_STATE="$(timeout 5 ros2 lifecycle get /slam_toolbox 2>/dev/null || true)"
  case "$SLAM_STATE" in
    *"unconfigured [1]"*)
      timeout 10 ros2 lifecycle set /slam_toolbox configure || true
      ;;
    *"inactive [2]"*)
      timeout 10 ros2 lifecycle set /slam_toolbox activate || true
      ;;
    *"active [3]"*)
      SLAM_READY=1
      break
      ;;
  esac
  echo "   ...cho SLAM active: ${SLAM_STATE:-node chua san sang}"
  sleep 1
done
if [ "$SLAM_READY" != "1" ]; then
  echo "!!! SLAM chua active -> khong bat tu hanh. Xem log /slam_toolbox."
fi

NAV_PID=""; EXPLORE_PID=""
if [ "$EXPLORE" = "1" ] && [ "$SLAM_READY" = "1" ]; then
  echo "=== [6/6] TU KHAM PHA: kiem tra cam bien truoc khi cho xe chay ==="
  # Chi cho xe tu chay khi Pi da ket noi, LiDAR co du lieu va co encoder. Khong dat
  # trong 60 s thi bo qua che do tu chay (xe dung yen, SLAM van chay de lai tay).
  READY=0
  for _ in $(seq 1 30); do
    # --full-length: ros2 topic echo MAC DINH CAT chuoi o 128 ky tu. JSON suc khoe dai ~550 ky tu
    # nen "lidar_live" nam o phan bi cat => truoc day script khong bao gio thay LiDAR san sang
    # va xe khong bao gio tu chay (09/11). Phan tich JSON thay vi grep chuoi.
    HEALTH="$(timeout 4 ros2 topic echo --once --full-length /robot/sensor_health std_msgs/msg/String 2>/dev/null || true)"
    VERDICT="$(printf '%s' "$HEALTH" | python3 -c '
import json, sys, yaml
try:
    d = json.loads(next(yaml.safe_load_all(sys.stdin.read()))["data"])
except Exception:
    print("WAIT chua nhan /robot/sensor_health tu bridge"); sys.exit()
reasons = d.get("reasons") or []
ok = d.get("pi_ws_connected") is True and d.get("lidar_live") is True and "NO_ENCODER_TELEMETRY" not in reasons
print(("READY " if ok else "WAIT ") + (", ".join(reasons) or "-"))
' 2>/dev/null || echo "WAIT khong doc duoc /robot/sensor_health")"
    if [ "${VERDICT%% *}" = "READY" ]; then
      READY=1; break
    fi
    echo "   ...cho Pi/LiDAR/encoder: ${VERDICT#* }"
    sleep 1
  done
  if [ "$READY" != "1" ]; then
    echo "!!! Cam bien CHUA SAN SANG sau 60 s -> KHONG cho xe tu chay."
    echo "    Kiem tra Pi (sudo python3 main.py), PI5_IP, LiDAR. SLAM van chay de lai tay."
  else
    # Sensor health alone does not guarantee that SLAM has published a map.
    # Starting Nav2 too early makes planner_server activation time out forever.
    echo ">> Cho ban do dau tien tu SLAM..."
    if ! timeout 30 ros2 topic echo --once /map nav_msgs/msg/OccupancyGrid \
        --field info --qos-durability transient_local >/dev/null; then
      echo "!!! Khong nhan /map tu SLAM -> KHONG cho xe tu chay. Kiem tra SLAM/TF."
      READY=0
    fi
  fi
  if [ "$READY" = "1" ]; then
    echo ">> Cam bien OK. Bat Nav2 (dung map cua SLAM, khong AMCL)..."
    ros2 launch "$SCRIPT_DIR/nav2/navigation_launch.py" slam:=true use_sim_time:=False \
      params_file:="$SCRIPT_DIR/nav2/nav2_params.yaml" autostart:=True &
    NAV_PID=$!
    sleep 8
    echo "!!! XE THAT SE TU CHAY SAU 10 GIAY. Dung xa xe ra. Ctrl+C de huy/dung bat ky luc nao."
    for i in 10 9 8 7 6 5 4 3 2 1; do echo "   $i..."; sleep 1; done
    # EXPLORE_SAVE khong dat -> ten tu dong; dat rong (EXPLORE_SAVE=, Web) -> quet xong KHONG tu
    # luu, Web hoi ten roi luu. Khong truyen "-p save_map_name:=" rong: rcl khong parse duoc gia
    # tri rong => explorer chet ngay luc khoi dong, xe khong bao gio tu chay.
    EXPLORE_SAVE_NAME="${EXPLORE_SAVE-auto_map_$(date +%Y_%m_%d_%H%M)}"
    EXPLORE_ARGS=()
    if [ -n "$EXPLORE_SAVE_NAME" ]; then
      EXPLORE_ARGS=(--ros-args -p "save_map_name:=$EXPLORE_SAVE_NAME")
    fi
    python3 "$SCRIPT_DIR/frontier_explorer.py" "${EXPLORE_ARGS[@]}" &
    EXPLORE_PID=$!
  fi
fi

echo "=========================================================="
echo " HE THONG SLAM DANG HOAT DONG TREN LAPTOP WSL2!"
echo "   - Robot Model: Load URDF tu robot/description/robot.urdf"
echo "   - Topic /scan dang nhan tia tu Pi 5 qua Tailscale"
echo "   - SLAM Toolbox dang dung Occupancy Grid Map tren /map"
echo "   - MODE=MAPPING: chi dung de tao map mot lan"
echo "   - Rosbridge WebSocket mo tai ws://127.0.0.1:9090 cho Web Admin"
echo "   - Foxglove WebSocket mo tai ws://127.0.0.1:8765 cho map realtime"
echo "=========================================================="

if [ -n "$EXPLORE_PID" ]; then
  echo "   - EXPLORE=1: XE DANG TU CHAY quet map. Ctrl+C de DUNG XE."
fi

# Tat explorer + Nav2 TRUOC (ngung phat /cmd_vel), GUI THANG "stop" sang Pi (UDP 9999)
# vai lan roi moi tat bridge: neu chi trong cho bridge tu gui stop (sau 0.8 s) thi bridge
# co the bi tat truoc -> Pi giu lenh "drive" cuoi.
stop_robot() {
  for _ in 1 2 3 4 5; do
    echo -n stop > "/dev/udp/${PI5_IP:-100.99.72.51}/9999" 2>/dev/null || true
    sleep 0.1
  done
}
cleanup() {
  kill $EXPLORE_PID $NAV_PID 2>/dev/null || true
  stop_robot
  kill $RSP_PID $BRIDGE_PID $FOXGLOVE_PID $LIDAR_PID $SLAM_PID 2>/dev/null || true
  stop_robot
}
trap cleanup EXIT INT TERM

wait $RSP_PID $BRIDGE_PID $FOXGLOVE_PID $LIDAR_PID $SLAM_PID
