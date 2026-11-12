#!/bin/bash
# Mo phong Gazebo + SLAM Toolbox + Foxglove: lai xe AO trong Foxglove, KHONG dieu khien xe that.
#
#   bash robot/ros2_configs/start_sim_foxglove.sh          # Gazebo chay ngam (khong cua so)
#   GZ_GUI=1 bash robot/ros2_configs/start_sim_foxglove.sh # mo them cua so Gazebo
#   SLAM=0 bash robot/ros2_configs/start_sim_foxglove.sh   # chi lai xe, khong quet map
#   GZ_SOFTWARE=1 bash ...                                  # ve bang CPU neu GPU (D3D12) bi loi
#   EXPLORE=1 bash robot/ros2_configs/start_sim_foxglove.sh # xe ao TU DI quet het map (Nav2 + frontier)
#   EXPLORE=1 EXPLORE_SAVE=ten_map bash ...                # ten file map tu luu khi quet xong
#   WORLD=$PWD/robot/worlds/explore_room.world bash ...     # chon world khac (mac dinh hotel_room)
#   CMD_TIMEOUT=0.3 bash ...                                # xe ao tu dung khi mat lenh > 0.3 s (mac dinh 0.5)
#   SLAM_PARAMS=/duong/dan/khac.yaml bash ...             # thu cau hinh SLAM khac (mac dinh: file cua XE THAT)
#   MAP=ten_map bash ...                                    # KHONG quet: nap map DA LUU + AMCL + Nav2 (test costmap)
#   MAP=ten_map INIT_X=0 INIT_Y=0 INIT_YAW=0 bash ...       # vi tri xe ao tren map luc dau (mac dinh 0 0 0 =
#                                                           #   cho xe xuat phat khi quet map do bang Gazebo)
#
# MAP=...: map phai quet tu CUNG world Gazebo (map xe that khong khop tuong ao -> AMCL lac).
# Nav2 dung cau hinh xe that + sim_navigation_overrides.yaml de can huong dich trong Gazebo.
# Foxglove: ws://127.0.0.1:8765 - Teleop panel publish /cmd_vel (geometry_msgs/Twist).
# Web Admin (ROS 2 Gia Lap): ws://127.0.0.1:9090.
set -e

source /opt/ros/jazzy/setup.bash
export ROS_DOMAIN_ID=0
export PATH="/usr/bin:/bin:/usr/local/bin:/opt/ros/jazzy/opt/gz_tools_vendor/bin:$PATH"
export GZ_CONFIG_PATH="/opt/ros/jazzy/opt/gz_sim_vendor/share/gz:/opt/ros/jazzy/opt/gz_gui_vendor/share/gz:/opt/ros/jazzy/opt/gz_msgs_vendor/share/gz:/opt/ros/jazzy/opt/gz_transport_vendor/share/gz:/opt/ros/jazzy/opt/gz_plugin_vendor/share/gz:/opt/ros/jazzy/opt/sdformat_vendor/share/gz:/opt/ros/jazzy/opt/gz_fuel_tools_vendor/share/gz:${GZ_CONFIG_PATH:-}"

# WSL mac dinh ve bang CPU (llvmpipe): GUI an het CPU, mo phong chi con ~0.25x toc do.
# Co /dev/dxg (WSLg GPU) thi ep Mesa dung GPU that qua D3D12. GZ_SOFTWARE=1 de tat.
if [ -e /dev/dxg ] && [ "${GZ_SOFTWARE:-0}" != "1" ] && [ -z "${GALLIUM_DRIVER:-}" ]; then
  export GALLIUM_DRIVER=d3d12
  echo ">> Dung GPU qua D3D12 (GZ_SOFTWARE=1 neu bi loi hien thi)"
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROBOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
WORLD="${WORLD:-$ROBOT_DIR/worlds/hotel_room.world}"
export GZ_SIM_RESOURCE_PATH="$ROBOT_DIR/models:${GZ_SIM_RESOURCE_PATH:-}"

MAP_YAML=""
if [ -n "${MAP:-}" ]; then
  if [ -f "$MAP" ]; then MAP_YAML="$(realpath "$MAP")"; else MAP_YAML="$ROBOT_DIR/maps/${MAP%.yaml}.yaml"; fi
  if [ ! -f "$MAP_YAML" ]; then
    echo "ERROR: Khong tim thay map: $MAP_YAML" >&2
    echo "Map co san: $(cd "$ROBOT_DIR/maps" && ls *.yaml | sed 's/\.yaml$//' | tr '\n' ' ')" >&2
    exit 2
  fi
  if [ "${EXPLORE:-0}" = "1" ]; then
    echo "ERROR: MAP=... (nap map da luu) khong di cung EXPLORE=1 (quet map moi)." >&2
    exit 2
  fi
  SLAM=0   # map da co san: map_server + AMCL thay cho SLAM Toolbox
fi

echo "=== [0/6] TAT STACK XE THAT (khong gui lenh UDP sang Pi) VA MO PHONG CU ==="
pkill -f "lidar_ws_to_ros2.py" 2>/dev/null || true
pkill -f "sim_cmd_watchdog.py" 2>/dev/null || true
killall -q rosbridge_websocket foxglove_bridge async_slam_toolbox_node robot_state_publisher \
  map_server amcl controller_server planner_server behavior_server bt_navigator \
  waypoint_follower lifecycle_manager component_container_isolated 2>/dev/null || true
pkill -f "[r]os2 launch rosbridge_server" 2>/dev/null || true
pkill -f "[r]os2 launch foxglove_bridge" 2>/dev/null || true
pkill -f "[r]os2 launch slam_toolbox" 2>/dev/null || true
pkill -f "static_transform_publisher" 2>/dev/null || true
pkill -f "[n]avigation_launch.py" 2>/dev/null || true
pkill -INT -f "[l]ocalization_manager.py" 2>/dev/null || true
pkill -f "[z]one_filters_launch.py" 2>/dev/null || true
pkill -f "costmap_filter_info_server" 2>/dev/null || true
pkill -9 -f "gz sim" 2>/dev/null || true
pkill -9 -f "parameter_bridge" 2>/dev/null || true
fuser -k 9090/tcp 8765/tcp 2>/dev/null || true
sleep 1

echo "=== [1/6] GAZEBO SIM ($(basename "$WORLD")) ==="
# Luon chay server rieng (-s). Neu can cua so thi mo GUI (-g) SAU khi LiDAR da co
# SensorTopic: server chi gui component nay cho GUI dung 1 lan; GUI mo cung luc voi
# server se lo mat -> panel "Visualize Lidar" bao "lidar entity ... could not be
# found" va ve tia o goc toa do (0,0,0) thay vi theo xe.
gz sim -r -s "$WORLD" &
GZ_PID=$!
sleep 4

GUI_PID=""
if [ "${GZ_GUI:-0}" = "1" ]; then
  STATE_SRV=""
  GUI_DEADLINE=$((SECONDS + 20))   # cho toi da 20 s roi van mo GUI
  while [ $SECONDS -lt $GUI_DEADLINE ]; do
    if [ -z "$STATE_SRV" ]; then
      STATE_SRV="$(timeout 3 gz service -l 2>/dev/null | grep -m1 -E '^/world/[^/]+/state$' || true)"
    fi
    if [ -n "$STATE_SRV" ] && timeout 3 gz service -s "$STATE_SRV" \
         --reqtype gz.msgs.Empty --reptype gz.msgs.SerializedStepMap --timeout 2000 --req "" \
         2>/dev/null | grep -q 'component: "/scan"'; then
      echo ">> LiDAR san sang (/scan) - mo cua so Gazebo"
      break
    fi
    sleep 0.5
  done
  gz sim -g &
  GUI_PID=$!
fi

echo "=== [2/6] GZ <-> ROS 2 BRIDGE (clock, cmd_vel, odom, scan, tf) ==="
ros2 run ros_gz_bridge parameter_bridge \
  '/clock@rosgraph_msgs/msg/Clock[gz.msgs.Clock' \
  '/cmd_vel@geometry_msgs/msg/Twist]gz.msgs.Twist' \
  '/odom@nav_msgs/msg/Odometry[gz.msgs.Odometry' \
  '/scan@sensor_msgs/msg/LaserScan[gz.msgs.LaserScan' \
  '/tf@tf2_msgs/msg/TFMessage[gz.msgs.Pose_V' &
BRIDGE_PID=$!

# DiffDrive cua Gazebo giu mai lenh cuoi -> nha nut Teleop xe ao van chay. Xe that tu
# dung khi mat lenh > 0.5 s (motor_controller), nen mo phong cung lam y vay.
python3 "$SCRIPT_DIR/sim_cmd_watchdog.py" --timeout "${CMD_TIMEOUT:-0.5}" &
WATCHDOG_PID=$!
sleep 2

echo "=== [3/6] TF TINH base_link -> laser_frame (dung vi tri LiDAR trong model.sdf) ==="
# Xe ao gan LiDAR DUNG vi tri xe that (lidar.xacro): giua than xe, cao 0.202 m.
ros2 run tf2_ros static_transform_publisher \
  --x 0 --y 0 --z 0.202 --frame-id base_link --child-frame-id laser_frame \
  --ros-args -p use_sim_time:=true &
TF_PID=$!

echo "=== [4/6] FOXGLOVE BRIDGE :8765 + ROSBRIDGE :9090 ==="
ros2 launch foxglove_bridge foxglove_bridge_launch.xml \
  port:=8765 address:=0.0.0.0 use_sim_time:=true &
FOX_PID=$!
ros2 launch rosbridge_server rosbridge_websocket_launch.xml &
WS_PID=$!
sleep 2

SLAM_PID=""
if [ "${SLAM:-1}" = "1" ]; then
  echo "=== [5/6] SLAM TOOLBOX (use_sim_time) ==="
  ros2 launch slam_toolbox online_async_launch.py use_sim_time:=True \
    slam_params_file:="${SLAM_PARAMS:-$SCRIPT_DIR/slam_toolbox_params.yaml}" &
  SLAM_PID=$!
else
  echo "=== [5/6] Bo qua SLAM (SLAM=0) ==="
fi

NAV_PID=""; EXPLORE_PID=""
if [ "${EXPLORE:-0}" = "1" ]; then
  if [ "${SLAM:-1}" != "1" ]; then
    echo "ERROR: EXPLORE=1 can SLAM=1 (Nav2 dung map cua SLAM Toolbox)." >&2
    exit 2
  fi
  echo "=== [5b/6] NAV2 (dung map SLAM, khong AMCL) + FRONTIER EXPLORER ==="
  ros2 launch "$SCRIPT_DIR/nav2/navigation_launch.py" slam:=true use_sim_time:=True \
    params_file:="$SCRIPT_DIR/nav2/nav2_params.yaml" autostart:=True &
  NAV_PID=$!
  sleep 8   # cho SLAM phat /map va Nav2 kich hoat xong
  python3 "$SCRIPT_DIR/frontier_explorer.py" --ros-args -p use_sim_time:=true \
    -p save_map_name:="${EXPLORE_SAVE:-sim_explored}" &
  EXPLORE_PID=$!
fi

MASK_PIDS=""
if [ -n "$MAP_YAML" ]; then
  echo "=== [5b/6] MAP DA LUU: $(basename "$MAP_YAML") -> MAP SERVER + AMCL + NAV2 ==="
  # Vung ve tren Web: cam vao (keepout) + gioi han toc do (speed)
  ros2 launch "$SCRIPT_DIR/nav2/zone_filters_launch.py" \
    map_name:="$(basename "${MAP_YAML%.yaml}")" use_sim_time:=True &
  MASK_PIDS="$!"
  # Gac cong dinh vi giong xe that; KHONG luu/khoi phuc vi tri (persist_pose:=false) de khong
  # ghi de file vi tri cua xe that cung ten map. Vi tri dau do script gui ben duoi.
  python3 "$SCRIPT_DIR/localization_manager.py" --ros-args -p use_sim_time:=true \
    -p map_name:="$(basename "${MAP_YAML%.yaml}")" -p persist_pose:=false &
  MASK_PIDS="$MASK_PIDS $!"
  ros2 launch "$SCRIPT_DIR/nav2/navigation_launch.py" map:="$MAP_YAML" use_sim_time:=True simulation:=true \
    params_file:="$SCRIPT_DIR/nav2/nav2_params.yaml" autostart:=True &
  NAV_PID=$!

  # AMCL can vi tri dau: doi AMCL active roi gui /initialpose (INIT_X/Y/YAW, mac dinh 0 0 0).
  for _ in $(seq 1 60); do
    timeout 5 ros2 lifecycle get /amcl 2>/dev/null | grep -q "^active" && break
    sleep 1
  done
  read -r QZ QW < <(python3 -c "import math,sys; y=float(sys.argv[1]); print(math.sin(y/2), math.cos(y/2))" "${INIT_YAW:-0}")
  # -w 2: cho ca AMCL va localization_manager nghe /initialpose roi moi gui (1 lan).
  timeout 15 ros2 topic pub --once -w 2 /initialpose geometry_msgs/msg/PoseWithCovarianceStamped \
    "{header: {frame_id: map}, pose: {pose: {position: {x: ${INIT_X:-0}, y: ${INIT_Y:-0}}, orientation: {z: $QZ, w: $QW}},
      covariance: [0.0625, 0, 0, 0, 0, 0, 0, 0.0625, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                   0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.0685]}}" >/dev/null \
    && echo " Da dat vi tri dau AMCL: (${INIT_X:-0}, ${INIT_Y:-0}, yaw ${INIT_YAW:-0})" \
    || echo " CANH BAO: chua gui duoc /initialpose - dat tay bang Foxglove 'Publish pose estimate'."
fi

cleanup() {
  echo ">> Dang tat mo phong..."
  kill $EXPLORE_PID $NAV_PID $MASK_PIDS $SLAM_PID $WS_PID $FOX_PID $TF_PID $WATCHDOG_PID $BRIDGE_PID $GUI_PID $GZ_PID 2>/dev/null || true
  pkill -9 -f "gz sim" 2>/dev/null || true
  pkill -9 -f "parameter_bridge" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "=========================================================="
echo " [6/6] MO PHONG SAN SANG - XE THAT KHONG BI DIEU KHIEN"
echo "  Foxglove : ws://127.0.0.1:8765"
echo "    - 3D panel: Fixed frame = map (hoac odom neu SLAM=0 va khong co MAP)"
if [ -n "$MAP_YAML" ]; then
echo "    - Costmap: /global_costmap/costmap /local_costmap/costmap /plan /keepout_filter_mask /speed_limit"
echo "    - Gui dich: publish /goal_pose (Foxglove 'Publish pose')"
fi
echo "    - Teleop panel: topic /cmd_vel de lai xe ao"
echo "  Web Admin: ROS 2 Gia Lap (ws://127.0.0.1:9090)"
echo "  Luu map ao: bash $SCRIPT_DIR/save_ros2_map.sh ten_map --no-pause"
echo "  Ctrl+C de tat."
echo "=========================================================="
wait $GZ_PID
