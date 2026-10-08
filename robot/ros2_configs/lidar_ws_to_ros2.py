import os
import math
import time
import json
import socket
import asyncio
import threading
import websockets

import rclpy
from rclpy.node import Node
from sensor_msgs.msg import LaserScan
from nav_msgs.msg import Odometry, Path
from geometry_msgs.msg import TransformStamped, PoseStamped, Twist
from tf2_ros import TransformBroadcaster
from tf2_ros.static_transform_broadcaster import StaticTransformBroadcaster


class LidarWsToRos2Bridge(Node):
    def __init__(self):
        super().__init__('lidar_ws_to_ros2_bridge')
        self.publisher_ = self.create_publisher(LaserScan, '/scan', 10)
        self.odom_pub_ = self.create_publisher(Odometry, '/odom', 10)
        self.path_pub_ = self.create_publisher(Path, '/robot_path', 10)
        self.static_tf_broadcaster = StaticTransformBroadcaster(self)
        self.tf_broadcaster = TransformBroadcaster(self)
        self.scan_count = 0

        # Lắng nghe topic /cmd_vel để điều khiển xe và di chuyển robot trên RViz
        self.cmd_vel_sub = self.create_subscription(
            Twist,
            '/cmd_vel',
            self.on_cmd_vel_received,
            10
        )

        # Lưu trạng thái vị trí robot và quỹ đạo đường đi
        self.current_pose = {'x': 0.0, 'y': 0.0, 'yaw': 0.0}
        self.last_recorded_pose = {'x': 0.0, 'y': 0.0, 'yaw': 0.0}
        self.trajectory_path = Path()
        self.trajectory_path.header.frame_id = 'odom'

        # Động học Kinematics phục vụ Dead Reckoning theo thời gian thực (30Hz)
        self.current_vx = 0.0
        self.current_wz = 0.0
        self.last_cmd_time = time.monotonic()
        self.last_kinematics_time = time.monotonic()
        self.last_sent_udp_motion = "stop"

        # Cấu hình UDP gửi lệnh sang Pi 5
        self.pi5_ip = os.getenv("PI5_IP", "100.99.72.51")
        self.pi5_port = int(os.getenv("PI5_PORT", "9999"))
        self.udp_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)

        # Timer 30Hz tính toán di chuyển Dead Reckoning
        self.kinematics_timer = self.create_timer(1.0 / 30.0, self.update_kinematics)

        # Broadcast static transform base_link -> laser & laser_frame
        self.broadcast_static_laser_tf()

        # Khởi động UDP listener nhận tín hiệu từ main.py trên Pi 5 (port 9998)
        self.start_pi5_telemetry_udp_server()

        self.get_logger().info("🚀 LidarWsToRos2Bridge da san sang! Ho tro Realtime Teleop Terminal -> RViz2 & Pi 5")

    def broadcast_static_laser_tf(self):
        # Alias static transform laser_frame -> laser (tương thích cả 2 tên frame)
        t_alias = TransformStamped()
        t_alias.header.stamp = self.get_clock().now().to_msg()
        t_alias.header.frame_id = "laser_frame"
        t_alias.child_frame_id = "laser"
        t_alias.transform.rotation.w = 1.0

        self.static_tf_broadcaster.sendTransform([t_alias])
        self.get_logger().info("✅ Đã phát static TF alias: laser_frame -> laser")

    def _record_and_publish_state(self, now, px, py, yaw_deg, vx=0.0, wz=0.0, broadcast_tf=False):
        yaw_rad = math.radians(yaw_deg)
        qz = math.sin(yaw_rad / 2.0)
        qw = math.cos(yaw_rad / 2.0)

        # 1. Dynamic TF odom -> base_link (chỉ phát khi cần để tránh xung đột timestamp với publish_scan)
        if broadcast_tf:
            t_odom = TransformStamped()
            t_odom.header.stamp = now
            t_odom.header.frame_id = "odom"
            t_odom.child_frame_id = "base_link"
            t_odom.transform.translation.x = px
            t_odom.transform.translation.y = py
            t_odom.transform.translation.z = 0.0
            t_odom.transform.rotation.z = qz
            t_odom.transform.rotation.w = qw
            self.tf_broadcaster.sendTransform(t_odom)

        # 2. Publish /odom
        odom_msg = Odometry()
        odom_msg.header.stamp = now
        odom_msg.header.frame_id = 'odom'
        odom_msg.child_frame_id = 'base_link'
        odom_msg.pose.pose.position.x = px
        odom_msg.pose.pose.position.y = py
        odom_msg.pose.pose.position.z = 0.0
        odom_msg.pose.pose.orientation.z = qz
        odom_msg.pose.pose.orientation.w = qw
        odom_msg.twist.twist.linear.x = float(vx)
        odom_msg.twist.twist.angular.z = float(wz)
        self.odom_pub_.publish(odom_msg)

        # 3. Ghi nhận vết đường đi /robot_path (Trajectory Trail)
        dx = px - self.last_recorded_pose['x']
        dy = py - self.last_recorded_pose['y']
        dist = math.hypot(dx, dy)
        d_yaw = abs(yaw_deg - self.last_recorded_pose['yaw'])

        if dist > 0.03 or d_yaw > 4.0 or len(self.trajectory_path.poses) == 0:
            pose_stamped = PoseStamped()
            pose_stamped.header.stamp = now
            pose_stamped.header.frame_id = 'odom'
            pose_stamped.pose.position.x = px
            pose_stamped.pose.position.y = py
            pose_stamped.pose.position.z = 0.0
            pose_stamped.pose.orientation.z = qz
            pose_stamped.pose.orientation.w = qw

            self.trajectory_path.header.stamp = now
            self.trajectory_path.poses.append(pose_stamped)
            if len(self.trajectory_path.poses) > 500:
                self.trajectory_path.poses.pop(0)

            self.last_recorded_pose = {'x': px, 'y': py, 'yaw': yaw_deg}
            self.path_pub_.publish(self.trajectory_path)

    def update_robot_pose(self, pose_dict):
        if not pose_dict:
            return
        px = float(pose_dict.get('x', 0.0))
        py = float(pose_dict.get('y', 0.0))
        yaw_deg = float(pose_dict.get('yaw', 0.0))
        if abs(px) > 0.001 or abs(py) > 0.001 or abs(yaw_deg) > 0.001:
            self.current_pose = {'x': px, 'y': py, 'yaw': yaw_deg}
            now = self.get_clock().now().to_msg()
            self._record_and_publish_state(now, px, py, yaw_deg)

    def on_cmd_vel_received(self, msg: Twist):
        self.last_cmd_time = time.monotonic()
        self.current_vx = msg.linear.x
        self.current_wz = msg.angular.z

        # Phân loại lệnh di chuyển để gửi UDP sang Pi 5
        motion = "stop"
        if msg.linear.x > 0.05:
            if msg.angular.z > 0.2:
                motion = "forward_left"
            elif msg.angular.z < -0.2:
                motion = "forward_right"
            else:
                motion = "forward"
        elif msg.linear.x < -0.05:
            if msg.angular.z > 0.2:
                motion = "backward_left"
            elif msg.angular.z < -0.2:
                motion = "backward_right"
            else:
                motion = "backward"
        elif msg.angular.z > 0.2:
            motion = "left"
        elif msg.angular.z < -0.2:
            motion = "right"
        else:
            motion = "stop"

        self._send_udp_to_pi5(motion)

    def _send_udp_to_pi5(self, motion: str):
        if motion != self.last_sent_udp_motion:
            self.last_sent_udp_motion = motion
            try:
                self.udp_sock.sendto(motion.encode("utf-8"), (self.pi5_ip, self.pi5_port))
            except Exception as e:
                self.get_logger().debug(f"Loi gui UDP Pi 5: {e}")

    def update_kinematics(self):
        now_mono = time.monotonic()
        dt = now_mono - self.last_kinematics_time
        self.last_kinematics_time = now_mono

        # Nếu quá 0.35s không có lệnh điều khiển tiếp, tự động phanh dừng
        if now_mono - self.last_cmd_time > 0.35:
            if self.current_vx != 0.0 or self.current_wz != 0.0:
                self.current_vx = 0.0
                self.current_wz = 0.0
                self._send_udp_to_pi5("stop")

        if abs(self.current_vx) > 0.001 or abs(self.current_wz) > 0.001:
            yaw_deg = self.current_pose['yaw'] + math.degrees(self.current_wz * dt)
            self.current_pose['yaw'] = yaw_deg % 360.0

            yaw_rad = math.radians(self.current_pose['yaw'])
            self.current_pose['x'] += self.current_vx * math.cos(yaw_rad) * dt
            self.current_pose['y'] += self.current_vx * math.sin(yaw_rad) * dt

        # Luôn phát /odom đều đặn 30Hz để các node hạ tầng không bị timeout
        now = self.get_clock().now().to_msg()
        self._record_and_publish_state(
            now,
            self.current_pose['x'],
            self.current_pose['y'],
            self.current_pose['yaw'],
            vx=self.current_vx,
            wz=self.current_wz
        )

    def start_pi5_telemetry_udp_server(self):
        """Lắng nghe UDP trên port 9998 từ SSH main.py nếu người dùng gõ phím trực tiếp trên Pi 5."""
        def udp_listener_worker():
            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            try:
                sock.bind(("0.0.0.0", 9998))
                sock.settimeout(0.5)
                self.get_logger().info("📡 UDP Telemetry Server lắng nghe tại port 9998")
            except Exception as e:
                self.get_logger().warn(f"Khong the mo UDP 9998: {e}")
                return

            motion_to_vel = {
                "forward": (0.35, 0.0),
                "backward": (-0.35, 0.0),
                "left": (0.0, 1.2),
                "right": (0.0, -1.2),
                "forward_left": (0.25, 0.8),
                "forward_right": (0.25, -0.8),
                "backward_left": (-0.25, -0.8),
                "backward_right": (-0.25, 0.8),
                "stop": (0.0, 0.0),
            }

            while rclpy.ok():
                try:
                    data, _ = sock.recvfrom(1024)
                    cmd = data.decode("utf-8", errors="ignore").strip().lower()
                    if cmd in motion_to_vel:
                        vx, wz = motion_to_vel[cmd]
                        self.current_vx = vx
                        self.current_wz = wz
                        self.last_cmd_time = time.monotonic()
                except socket.timeout:
                    pass
                except Exception:
                    pass
            sock.close()

        t = threading.Thread(target=udp_listener_worker, daemon=True)
        t.start()

    def publish_scan(self, points):
        if not points:
            return

        now = self.get_clock().now().to_msg()
        px = self.current_pose['x']
        py = self.current_pose['y']
        yaw_rad = math.radians(self.current_pose['yaw'])
        qz = math.sin(yaw_rad / 2.0)
        qw = math.cos(yaw_rad / 2.0)

        # Dynamic TF odom -> base_link tai dung vi tri robot
        t_odom = TransformStamped()
        t_odom.header.stamp = now
        t_odom.header.frame_id = "odom"
        t_odom.child_frame_id = "base_link"
        t_odom.transform.translation.x = px
        t_odom.transform.translation.y = py
        t_odom.transform.translation.z = 0.0
        t_odom.transform.rotation.z = qz
        t_odom.transform.rotation.w = qw
        self.tf_broadcaster.sendTransform(t_odom)

        self.scan_count += 1
        if self.scan_count % 30 == 1:
            self.get_logger().info(f"📡 Dang publish /scan (packet #{self.scan_count}, {len(points)} tia)")

        msg = LaserScan()
        msg.header.stamp = now
        msg.header.frame_id = 'laser_frame'

        # 360 do: tu 0 den 2*PI, do phan giai 1 do (360 bins)
        num_bins = 360
        msg.angle_min = 0.0
        msg.angle_max = 2.0 * math.pi
        msg.angle_increment = (2.0 * math.pi) / num_bins
        msg.time_increment = 0.0
        msg.scan_time = 0.1
        msg.range_min = 0.12
        msg.range_max = 12.0

        ranges = [float('inf')] * num_bins
        intensities = [0.0] * num_bins

        for pt in points:
            angle_deg = pt.get('angle', 0.0) % 360.0
            dist = pt.get('distance', 0.0)
            quality = pt.get('quality', 0)

            if msg.range_min <= dist <= msg.range_max:
                # Đảo ngược góc từ chuẩn RPLiDAR (CW) sang chuẩn ROS REP-103 (CCW):
                # 0° -> 0 rad (+X Front)
                # 90° (Right) -> 270° (-Y Right)
                # 270° (Left) -> 90° (+Y Left)
                ros_angle_deg = (360.0 - angle_deg) % 360.0
                bin_idx = int(ros_angle_deg) % num_bins
                # Giu khoang cach nho nhat neu co nhieu diem trong 1 bin
                if dist < ranges[bin_idx]:
                    ranges[bin_idx] = float(dist)
                    intensities[bin_idx] = float(quality)

        msg.ranges = ranges
        msg.intensities = intensities
        self.publisher_.publish(msg)


async def ws_loop(node: LidarWsToRos2Bridge, ws_url="ws://100.99.72.51:8000/api/v1/map/ws"):
    while rclpy.ok():
        try:
            async with websockets.connect(ws_url, ping_interval=10, ping_timeout=5) as ws:
                node.get_logger().info("✅ Da ket noi thanh cong toi WebSocket LiDAR Pi 5!")
                async for msg_str in ws:
                    if not rclpy.ok():
                        break
                    try:
                        data = json.loads(msg_str)
                        robot_pose = data.get("robot_pose")
                        if robot_pose:
                            node.update_robot_pose(robot_pose)
                        points = data.get("scan_points", [])
                        if points:
                            node.publish_scan(points)
                    except Exception as e:
                        node.get_logger().warn(f"Loi parse frame: {e}")
        except Exception as e:
            node.get_logger().warn(f"Mat ket noi WS toi Pi 5 ({e}), se thu lai sau 2s...")
            await asyncio.sleep(2.0)


def start_asyncio_loop(node):
    asyncio.run(ws_loop(node))


def main(args=None):
    rclpy.init(args=args)
    node = LidarWsToRos2Bridge()

    # Chay WebSocket client tren background thread
    ws_thread = threading.Thread(target=start_asyncio_loop, args=(node,), daemon=True)
    ws_thread.start()

    try:
        rclpy.spin(node)
    except (KeyboardInterrupt, Exception):
        pass
    finally:
        try:
            node.destroy_node()
        except Exception:
            pass
        if rclpy.ok():
            rclpy.shutdown()


if __name__ == '__main__':
    main()
