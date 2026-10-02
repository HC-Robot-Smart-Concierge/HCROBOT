#!/bin/bash
set -e

echo "=== [1/4] CAI DAT ROS 2 JAZZY & CAC GOI SLAM / NAV2 TREN LAPTOP WSL2 ==="
sudo apt update
sudo apt install -y \
  ros-jazzy-rmw-cyclonedds-cpp \
  ros-jazzy-slam-toolbox \
  ros-jazzy-navigation2 \
  ros-jazzy-nav2-bringup \
  ros-jazzy-rosbridge-server \
  ros-jazzy-rviz2 \
  ros-jazzy-tf2-tools

echo "=== [2/4] CAU HINH CYCLONEDDS UNICAST CHO LAPTOP ==="
CONFIG_DIR="$HOME/ros2_configs"
mkdir -p "$CONFIG_DIR"

cat << 'EOF' > "$CONFIG_DIR/cyclonedds.xml"
<?xml version="1.0" encoding="UTF-8" ?>
<CycloneDDS xmlns="https://cdds.io/config">
    <Domain>
        <General>
            <Interfaces>
                <NetworkInterface name="tailscale0" />
            </Interfaces>
            <AllowMulticast>false</AllowMulticast>
        </General>
        <Discovery>
            <Peers>
                <Peer address="100.99.72.51"/>
                <Peer address="100.92.82.61"/>
            </Peers>
        </Discovery>
    </Domain>
</CycloneDDS>
EOF

echo "=== [3/4] THEM BIEN MOI TRUONG VAO ~/.bashrc ==="
sed -i '/RMW_IMPLEMENTATION/d' ~/.bashrc
sed -i '/CYCLONEDDS_URI/d' ~/.bashrc
sed -i '/ROS_DOMAIN_ID/d' ~/.bashrc

echo "source /opt/ros/jazzy/setup.bash" >> ~/.bashrc
echo "export RMW_IMPLEMENTATION=rmw_cyclonedds_cpp" >> ~/.bashrc
echo "export CYCLONEDDS_URI=file://$CONFIG_DIR/cyclonedds.xml" >> ~/.bashrc
echo "export ROS_DOMAIN_ID=0" >> ~/.bashrc

echo "=== [4/4] TAO FILE CHAY SLAM & NAV2 & ROSBRIDGE ==="
cat << 'EOF' > "$CONFIG_DIR/start_laptop_stack.sh"
#!/bin/bash
source /opt/ros/jazzy/setup.bash
export RMW_IMPLEMENTATION=rmw_cyclonedds_cpp
export CYCLONEDDS_URI=file://$HOME/ros2_configs/cyclonedds.xml
export ROS_DOMAIN_ID=0

echo "1. Khoi dong Rosbridge WebSocket tren port 9090..."
ros2 launch rosbridge_server rosbridge_websocket_launch.xml &
ROSBRIDGE_PID=$!

echo "2. Khoi dong Slam Toolbox (Online Async)..."
ros2 launch slam_toolbox online_async_launch.py use_sim_time:=False &
SLAM_PID=$!

echo "He thong Backend ROS 2 dang chay! Nhan Ctrl+C de dung."
wait $ROSBRIDGE_PID $SLAM_PID
EOF
chmod +x "$CONFIG_DIR/start_laptop_stack.sh"

echo "=== HOAN TAT SETUP LAPTOP WSL2 ==="
