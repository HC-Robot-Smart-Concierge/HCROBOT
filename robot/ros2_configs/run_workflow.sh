#!/usr/bin/env bash
# Does not start Navigation, mapping, or exploration. Uses an already-ready robot.
set -eo pipefail
source /opt/ros/jazzy/setup.bash
set -u
export ROS_DOMAIN_ID="${ROS_DOMAIN_ID:-0}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ "${1:-}" == "--check" ]]; then
    python3 - "$SCRIPT_DIR" <<'PY'
import sys
sys.path.insert(0, sys.argv[1])
import workflow_executor
print('ROS workflow imports OK; no node or motion started.')
PY
    exit 0
fi
exec python3 "$SCRIPT_DIR/workflow_executor.py" "$@"
