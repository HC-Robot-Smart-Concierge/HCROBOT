#!/usr/bin/env bash
if ! grep -q "GAZEBO_MODEL_PATH" /root/.bashrc; then
    echo 'export GAZEBO_MODEL_PATH=$GAZEBO_MODEL_PATH:/root/.gazebo/models:/mnt/d/Learning/Ki_9/SEP490/HCROBOT/robot/models' >> /root/.bashrc
fi
