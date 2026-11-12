#!/usr/bin/env python3
"""Show the applied Nav2 speed mask in Foxglove; never publishes motion commands."""
import json
import math
from copy import deepcopy

import rclpy
from geometry_msgs.msg import Point
from nav_msgs.msg import OccupancyGrid
from nav2_msgs.msg import SpeedLimit
from rclpy.node import Node
from rclpy.qos import DurabilityPolicy, QoSProfile, ReliabilityPolicy
from std_msgs.msg import String
from visualization_msgs.msg import Marker, MarkerArray

from speed_zone_logic import speed_mask_regions


class SpeedZoneVisualizer(Node):
    def __init__(self):
        super().__init__('speed_zone_visualizer')
        latched = QoSProfile(depth=1, durability=DurabilityPolicy.TRANSIENT_LOCAL,
                            reliability=ReliabilityPolicy.RELIABLE)
        self.markers = self.create_publisher(MarkerArray, '/speed_zone_markers', latched)
        self.status = self.create_publisher(String, '/speed_zones/state', latched)
        self.create_subscription(OccupancyGrid, '/speed_filter_mask', self.on_mask, latched)
        self.create_subscription(SpeedLimit, '/speed_limit', self.on_limit, 10)
        self.grid = None
        self.regions = []
        self.limit = None
        self.create_timer(1.0, self.publish)

    def on_mask(self, msg):
        self.grid = msg
        self.regions = speed_mask_regions(msg.info.width, msg.info.height, msg.data)
        self.publish()

    def on_limit(self, msg):
        if math.isfinite(msg.speed_limit) and msg.speed_limit >= 0:
            self.limit = {'speed_limit': msg.speed_limit, 'percentage': msg.percentage}
            self.publish()

    def publish(self):
        state = String()
        state.data = json.dumps({'mask_ready': self.grid is not None,
                                 'regions': len(self.regions), 'limit': self.limit})
        self.status.publish(state)
        if self.grid is None:
            return
        now = self.get_clock().now().to_msg()
        output = MarkerArray()
        clear = Marker()
        clear.action = Marker.DELETEALL
        output.markers.append(clear)
        origin = self.grid.info.origin
        yaw = 2 * math.atan2(origin.orientation.z, origin.orientation.w)
        co, si = math.cos(yaw), math.sin(yaw)
        res = self.grid.info.resolution
        for index, (limit, cells) in enumerate(self.regions):
            squares = Marker()
            squares.header.frame_id = self.grid.header.frame_id or 'map'
            squares.header.stamp = now
            squares.ns, squares.id = 'speed_zone_fill', index
            squares.type, squares.action = Marker.CUBE_LIST, Marker.ADD
            squares.pose = deepcopy(origin)
            squares.pose.position.z = 0.025
            squares.scale.x = squares.scale.y = res
            squares.scale.z = 0.015
            squares.color.r, squares.color.g, squares.color.b, squares.color.a = 1.0, 0.65, 0.05, 0.4
            squares.points = [Point(x=(x+0.5)*res, y=(y+0.5)*res, z=0.0) for x, y in cells]
            output.markers.append(squares)
            # Anchor the label on a real cell, including non-convex/overlap regions.
            cx = sum(x for x, _ in cells) / len(cells)
            cy = sum(y for _, y in cells) / len(cells)
            x, y = min(cells, key=lambda p: (p[0]-cx)**2 + (p[1]-cy)**2)
            x, y = (x+0.5)*res, (y+0.5)*res
            label = Marker()
            label.header = squares.header
            label.ns, label.id = 'speed_zone_label', index
            label.type, label.action = Marker.TEXT_VIEW_FACING, Marker.ADD
            label.pose.position.x = origin.position.x + co*x - si*y
            label.pose.position.y = origin.position.y + si*x + co*y
            label.pose.position.z = 0.15
            label.pose.orientation.w = 1.0
            label.scale.z = 0.12
            label.color.r, label.color.g, label.color.b, label.color.a = 1.0, 0.8, 0.25, 1.0
            label.text = f'<= {limit:.2f} m/s'
            output.markers.append(label)
        self.markers.publish(output)


def main():
    rclpy.init()
    node = SpeedZoneVisualizer()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        node.destroy_node()
        if rclpy.ok():
            rclpy.shutdown()


if __name__ == '__main__':
    main()
