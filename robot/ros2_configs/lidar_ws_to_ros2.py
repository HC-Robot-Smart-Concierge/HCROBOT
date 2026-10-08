#!/usr/bin/env python3
"""
Bridge LiDAR scans tu WebSocket cua Pi 5 sang ROS 2 topic /scan tren Laptop WSL2.
Tu dong phat TF static base_link -> laser va odom -> base_link de SLAM Toolbox hoat dong.
"""

import math
import json
import asyncio
import threading
import websockets

import rclpy
from rclpy.node import Node
from sensor_msgs.msg import LaserScan
from nav_msgs.msg import Odometry, Path
from geometry_msgs.msg import TransformStamped, PoseStamped
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

        # Lưu trạng thái vị trí robot và quỹ đạo đường đi
        self.current_pose = {'x': 0.0, 'y': 0.0, 'yaw': 0.0}
        self.last_recorded_pose = {'x': 0.0, 'y': 0.0, 'yaw': 0.0}
        self.trajectory_path = Path()
        self.trajectory_path.header.frame_id = 'odom'

        # Broadcast static transform base_link -> laser
        self.broadcast_static_laser_tf()

        self.get_logger().info("🚀 LidarWsToRos2Bridge da san sang! Ho tro Odometry & Robot Path Trajectory")

    def broadcast_static_laser_tf(self):
        # 1. Alias static transform laser_frame -> laser (de tuong thich ca 2 frame id)
        t_alias = TransformStamped()
        t_alias.header.stamp = self.get_clock().now().to_msg()
        t_alias.header.frame_id = "laser_frame"
        t_alias.child_frame_id = "laser"
        t_alias.transform.rotation.w = 1.0

        # 2. Fallback base_link -> laser_frame neu khong chay robot_state_publisher
        t_fallback = TransformStamped()
        t_fallback.header.stamp = self.get_clock().now().to_msg()
        t_fallback.header.frame_id = "base_link"
        t_fallback.child_frame_id = "laser_frame"
        t_fallback.transform.translation.x = -0.104
        t_fallback.transform.translation.y = 0.0
        t_fallback.transform.translation.z = 0.202
        t_fallback.transform.rotation.w = 1.0

        self.static_tf_broadcaster.sendTransform([t_alias, t_fallback])
        self.get_logger().info("✅ Da phat static TF: laser_frame -> laser & base_link -> laser_frame")

    def update_robot_pose(self, pose_dict):
        if not pose_dict:
            return
        px = float(pose_dict.get('x', 0.0))
        py = float(pose_dict.get('y', 0.0))
        yaw_deg = float(pose_dict.get('yaw', 0.0))
        self.current_pose = {'x': px, 'y': py, 'yaw': yaw_deg}

        now = self.get_clock().now().to_msg()
        yaw_rad = math.radians(yaw_deg)
        qz = math.sin(yaw_rad / 2.0)
        qw = math.cos(yaw_rad / 2.0)

        # 1. Publish /odom
        odom_msg = Odometry()
        odom_msg.header.stamp = now
        odom_msg.header.frame_id = 'odom'
        odom_msg.child_frame_id = 'base_link'
        odom_msg.pose.pose.position.x = px
        odom_msg.pose.pose.position.y = py
        odom_msg.pose.pose.position.z = 0.0
        odom_msg.pose.pose.orientation.z = qz
        odom_msg.pose.pose.orientation.w = qw
        self.odom_pub_.publish(odom_msg)

        # 2. Ghi nhận vết đường đi (Trajectory Trail)
        dx = px - self.last_recorded_pose['x']
        dy = py - self.last_recorded_pose['y']
        dist = math.hypot(dx, dy)
        d_yaw = abs(yaw_deg - self.last_recorded_pose['yaw'])

        # Lưu điểm mới nếu di chuyển > 3cm hoặc quay > 5 độ, hoặc là điểm đầu tiên
        if dist > 0.03 or d_yaw > 5.0 or len(self.trajectory_path.poses) == 0:
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
        if self.scan_count % 20 == 1:
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
                bin_idx = int(angle_deg) % num_bins
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
