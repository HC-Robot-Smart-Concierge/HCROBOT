#!/usr/bin/env bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROBOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
if ! grep -q "GAZEBO_MODEL_PATH" "$HOME/.bashrc"; then
    echo "export GAZEBO_MODEL_PATH=\$GAZEBO_MODEL_PATH:\$HOME/.gazebo/models:$ROBOT_DIR/models" >> "$HOME/.bashrc"
fi
