#!/usr/bin/env bash
# Read-only diagnostics: does not publish goals, velocity, or initial poses.
set -eo pipefail

if ! command -v ros2 >/dev/null 2>&1; then
    source /opt/ros/jazzy/setup.bash
fi
set -u
export ROS_DOMAIN_ID="${ROS_DOMAIN_ID:-0}"
SECONDS_TO_RECORD="${1:-60}"
if ! [[ "$SECONDS_TO_RECORD" =~ ^[0-9]+$ ]] || (( SECONDS_TO_RECORD < 10 || SECONDS_TO_RECORD > 300 )); then
    echo "Usage: bash capture_localization.sh [10..300 seconds]" >&2
    exit 2
fi
OUTPUT_DIR="$(mktemp -d /tmp/hcrobot-localization-XXXXXXXX)"
echo "Diagnostics: $OUTPUT_DIR"
echo "Capturing the running ROS stack; no motion commands are sent."

timeout 8 ros2 node list > "$OUTPUT_DIR/nodes.txt" 2>&1 || true
timeout 8 ros2 topic list -t > "$OUTPUT_DIR/topics.txt" 2>&1 || true
timeout 8 ros2 param dump /amcl > "$OUTPUT_DIR/amcl.yaml" 2>&1 || true
timeout 8 ros2 param dump /localization_manager > "$OUTPUT_DIR/localization_manager.yaml" 2>&1 || true
timeout 8 ros2 param dump /controller_server > "$OUTPUT_DIR/controller_server.yaml" 2>&1 || true
cat > "$OUTPUT_DIR/qos.yaml" <<'YAML'
/map:
  durability: transient_local
  reliability: reliable
  history: keep_last
  depth: 1
/tf_static:
  durability: transient_local
  reliability: reliable
  history: keep_last
  depth: 100
YAML

echo "Recording $SECONDS_TO_RECORD seconds now. Perform the supervised test if ready."
status=0
timeout --signal=INT --kill-after=15 "${SECONDS_TO_RECORD}s" \
    ros2 bag record -o "$OUTPUT_DIR/bag" \
    --qos-profile-overrides-path "$OUTPUT_DIR/qos.yaml" \
    /map /tf /tf_static /scan /odom /amcl_pose /initialpose \
    /localization/state /robot/sensor_health /robot/encoder_telemetry \
    /robot/nav_result /cmd_vel /robot/manual_cmd_vel /rosout \
    > "$OUTPUT_DIR/record.log" 2>&1 || status=$?
if [[ "$status" != 0 && "$status" != 124 && "$status" != 130 ]]; then
    cat "$OUTPUT_DIR/record.log" >&2
    echo "Recording failed (exit $status). Partial data: $OUTPUT_DIR" >&2
    exit "$status"
fi
ros2 bag info "$OUTPUT_DIR/bag" > "$OUTPUT_DIR/bag-info.txt" 2>&1
tar -czf "${OUTPUT_DIR}.tar.gz" -C "$(dirname "$OUTPUT_DIR")" "$(basename "$OUTPUT_DIR")"
echo "Done. Share: ${OUTPUT_DIR}.tar.gz"
