#!/bin/bash
set -e

echo "=== Adding ROS 2 Jazzy repository ==="
apt update
apt install -y software-properties-common curl gnupg
add-apt-repository -y universe

curl -sSL https://raw.githubusercontent.com/ros/rosdistro/master/ros.key -o /usr/share/keyrings/ros-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/ros-archive-keyring.gpg] http://packages.ros.org/ros2/ubuntu $(. /etc/os-release && echo $UBUNTU_CODENAME) main" > /etc/apt/sources.list.d/ros2.list

apt update
echo "ROS 2 repo added successfully!"
