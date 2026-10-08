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
from geometry_msgs.msg import TransformStamped
from tf2_ros import TransformBroadcaster
from tf2_ros.static_transform_broadcaster import StaticTransformBroadcaster


class LidarWsToRos2Bridge(Node):
    def __init__(self):
        super().__init__('lidar_ws_to_ros2_bridge')
        self.publisher_ = self.create_publisher(LaserScan, '/scan', 10)
        self.static_tf_broadcaster = StaticTransformBroadcaster(self)
        self.tf_broadcaster = TransformBroadcaster(self)
        self.scan_count = 0

        # Broadcast static transform base_link -> laser
        self.broadcast_static_laser_tf()

        self.get_logger().info("🚀 LidarWsToRos2Bridge da san sang! Dang ket noi toi Pi 5 ws://100.99.72.51:8000/api/v1/map/ws ...")

    def broadcast_static_laser_tf(self):
        t1 = TransformStamped()
        t1.header.stamp = self.get_clock().now().to_msg()
        t1.header.frame_id = "base_link"
        t1.child_frame_id = "laser"
        t1.transform.translation.x = 0.0
        t1.transform.translation.y = 0.0
        t1.transform.translation.z = 0.15
        t1.transform.rotation.w = 1.0
        self.static_tf_broadcaster.sendTransform(t1)
        self.get_logger().info("✅ Da phat static TF: base_link -> laser")

    def publish_scan(self, points):
        if not points:
            return

        now = self.get_clock().now().to_msg()

        # Dynamic TF odom -> base_link tai dung thoi diem cua LaserScan
        t_odom = TransformStamped()
        t_odom.header.stamp = now
        t_odom.header.frame_id = "odom"
        t_odom.child_frame_id = "base_link"
        t_odom.transform.translation.x = 0.0
        t_odom.transform.translation.y = 0.0
        t_odom.transform.translation.z = 0.0
        t_odom.transform.rotation.w = 1.0
        self.tf_broadcaster.sendTransform(t_odom)

        self.scan_count += 1
        if self.scan_count % 20 == 1:
            self.get_logger().info(f"📡 Dang publish /scan (packet #{self.scan_count}, {len(points)} tia)")

        msg = LaserScan()
        msg.header.stamp = now
        msg.header.frame_id = 'laser'

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
