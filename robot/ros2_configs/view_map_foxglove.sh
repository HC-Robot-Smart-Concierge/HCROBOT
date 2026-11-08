#!/bin/bash
# Xem map DA LUU + costmap Nav2 tren Foxglove, KHONG can Pi, KHONG can Gazebo, KHONG quet lai.
#
#   bash robot/ros2_configs/view_map_foxglove.sh phong_test              # xe gia dat tai (0, 0, 0)
#   bash robot/ros2_configs/view_map_foxglove.sh phong_test 0.5 -0.2 1.57 # xe gia tai x y yaw(rad)
#
# Xe GIA dung yen (TF tinh), khong co LiDAR => costmap chi co: static map + inflation +
# vung cam (keepout). Gui /goal_pose (Foxglove) de xem Nav2 lap duong /plan tren costmap.
# Lenh /cmd_vel cua Nav2 khong toi dau ca: script tat bridge xe that (lidar_ws_to_ros2.py).
# Can xe chay va vat can that su => dung Gazebo: MAP=<map> start_sim_foxglove.sh.
set -e

source /opt/ros/jazzy/setup.bash
export ROS_DOMAIN_ID=0

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MAPS_DIR="$(cd "$SCRIPT_DIR/../maps" && pwd)"
MAP_INPUT="${1:-phong_test}"
ROBOT_X="${2:-0.0}"; ROBOT_Y="${3:-0.0}"; ROBOT_YAW="${4:-0.0}"

if [ -f "$MAP_INPUT" ]; then
    MAP_YAML="$(realpath "$MAP_INPUT")"
else
    MAP_YAML="$MAPS_DIR/${MAP_INPUT%.yaml}.yaml"
fi
if [ ! -f "$MAP_YAML" ]; then
    echo "ERROR: Khong tim thay map: $MAP_YAML" >&2
    echo "Map co san: $(cd "$MAPS_DIR" && ls *.yaml | sed 's/\.yaml$//' | tr '\n' ' ')" >&2
    exit 2
fi

PIDS=""
cleanup() { kill $PIDS 2>/dev/null || true; }
trap cleanup EXIT INT TERM

echo "=== [0/4] TAT STACK CU (xe that / mo phong) ==="
pkill -f "[f]rontier_explorer.py" 2>/dev/null || true
pkill -f "[n]avigation_launch.py" 2>/dev/null || true
pkill -f "lidar_ws_to_ros2.py" 2>/dev/null || true
killall -q rosbridge_websocket foxglove_bridge async_slam_toolbox_node robot_state_publisher \
  map_server amcl controller_server planner_server behavior_server bt_navigator \
  waypoint_follower lifecycle_manager component_container_isolated 2>/dev/null || true
pkill -f "[r]os2 launch rosbridge_server" 2>/dev/null || true
pkill -f "[r]os2 launch foxglove_bridge" 2>/dev/null || true
pkill -f "[z]one_filters_launch.py" 2>/dev/null || true
pkill -f "costmap_filter_info_server" 2>/dev/null || true
pkill -f "static_transform_publisher" 2>/dev/null || true
fuser -k 9090/tcp 8765/tcp 2>/dev/null || true
sleep 1

echo "=== [1/4] TF GIA: map -> odom -> base_link ($ROBOT_X, $ROBOT_Y, yaw $ROBOT_YAW) ==="
ros2 run tf2_ros static_transform_publisher --frame-id map --child-frame-id odom >/dev/null 2>&1 &
PIDS="$PIDS $!"
ros2 run tf2_ros static_transform_publisher --x "$ROBOT_X" --y "$ROBOT_Y" --yaw "$ROBOT_YAW" \
  --frame-id odom --child-frame-id base_link >/dev/null 2>&1 &
PIDS="$PIDS $!"

echo "=== [2/4] FOXGLOVE :8765 + ROSBRIDGE :9090 ==="
ros2 launch foxglove_bridge foxglove_bridge_launch.xml port:=8765 address:=0.0.0.0 use_sim_time:=False &
PIDS="$PIDS $!"
ros2 launch rosbridge_server rosbridge_websocket_launch.xml &
PIDS="$PIDS $!"
sleep 2

echo "=== [3/4] VUNG TU WEB: CAM VAO (KEEPOUT) + GIOI HAN TOC DO (SPEED) ==="
ros2 launch "$SCRIPT_DIR/nav2/zone_filters_launch.py" \
  map_name:="$(basename "${MAP_YAML%.yaml}")" use_sim_time:=False &
PIDS="$PIDS $!"

echo "=== [4/4] MAP SERVER + NAV2 (costmap, planner) ==="
ros2 launch "$SCRIPT_DIR/nav2/navigation_launch.py" map:="$MAP_YAML" \
  params_file:="$SCRIPT_DIR/nav2/nav2_params.yaml" use_sim_time:=False autostart:=True &
PIDS="$PIDS $!"

echo "=========================================================="
echo " Map      : $MAP_YAML"
echo " Foxglove : ws://127.0.0.1:8765  (3D panel, Fixed frame = map)"
echo "   /map  /global_costmap/costmap  /local_costmap/costmap  /plan"
echo "   /keepout_filter_mask  /speed_filter_mask  /speed_limit  /global_costmap/published_footprint"
echo " Thu lap duong: publish /goal_pose (Foxglove 'Publish pose')"
echo " Ctrl+C de tat."
echo "=========================================================="
wait
