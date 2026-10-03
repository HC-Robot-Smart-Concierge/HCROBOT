#!/bin/bash
set -e

echo "=== [1/4] CAU HINH CYCLONEDDS UNICAST CHO PI 5 ==="
CONFIG_DIR="$HOME/HCROBOT/robot/ros2_configs"
mkdir -p "$CONFIG_DIR"

cat << 'EOF' > "$CONFIG_DIR/cyclonedds.xml"
<?xml version="1.0" encoding="UTF-8" ?>
<CycloneDDS xmlns="https://cdds.io/config">
    <Domain>
        <General>
            <Interfaces>
                <NetworkInterface address="100.99.72.51" />
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

echo "=== [2/4] KHAI BAO BIEN MOI TRUONG ROS 2 TRONG ~/.bashrc ==="
sed -i '/RMW_IMPLEMENTATION/d' ~/.bashrc
sed -i '/CYCLONEDDS_URI/d' ~/.bashrc
sed -i '/ROS_DOMAIN_ID/d' ~/.bashrc

echo "export RMW_IMPLEMENTATION=rmw_cyclonedds_cpp" >> ~/.bashrc
echo "export CYCLONEDDS_URI=file://$CONFIG_DIR/cyclonedds.xml" >> ~/.bashrc
echo "export ROS_DOMAIN_ID=0" >> ~/.bashrc

echo "=== [3/4] TAO LAUNCH FILE CHO RPLIDAR A1M8 ==="
cat << 'EOF' > "$CONFIG_DIR/launch_rplidar_tf.sh"
#!/bin/bash
source /opt/ros/jazzy/setup.bash 2>/dev/null || true
export RMW_IMPLEMENTATION=rmw_cyclonedds_cpp
export CYCLONEDDS_URI=file://$HOME/HCROBOT/robot/ros2_configs/cyclonedds.xml
export ROS_DOMAIN_ID=0

# Phat TF static tu base_link sang laser
ros2 run tf2_ros static_transform_publisher --x 0.05 --y 0 --z 0.12 --yaw 0 --pitch 0 --roll 0 --frame-id base_link --child-frame-id laser &

echo "TF static publisher base_link -> laser da khoi dong."
EOF
chmod +x "$CONFIG_DIR/launch_rplidar_tf.sh"

echo "=== [4/4] HOAN TAT SETUP PI 5 ==="
echo "Hay chay: source ~/.bashrc"
