#!/usr/bin/env python3
"""
ROS 2 Safety Controller Node — HC-Robot (Raspberry Pi 5)
Tầng Trọng Tài An Toàn Cục Bộ (Local-First Safety Arbitration Layer):
- Chạy 100% nội tại trên Raspberry Pi 5 (Zero Network Latency, không phụ thuộc Wi-Fi).
- Lắng nghe lệnh vận tốc điều hướng từ /cmd_vel_in hoặc /cmd_vel_nav.
- Lắng nghe dữ liệu quét vật cản 360° từ /scan (RPLiDAR).
- Kiểm tra hành lang va chạm (Collision Corridor):
    + Nếu cự ly phía trước <= emergency_stop_dist (0.50m) -> PHANH KHẨN CẤP (linear.x = 0, angular.z = 0).
    + Nếu cự ly phía trước <= warning_dist (0.80m) -> GIẢM TỐC AN TOÀN.
    + Nếu thông thoáng -> Cho phép chuyển tiếp lệnh vận tốc.
- Xuất bản:
    + /cmd_vel: Lệnh vận tốc đã được kiểm duyệt an toàn, gửi trực tiếp tới motor_driver_node.
    + /robot/safety_state: Thông báo trạng thái an toàn (SAFE, SLOWDOWN, EMERGENCY_STOP).
"""

import json
import math
import os
import sys
import time
from typing import Optional, Tuple

import yaml

try:
    import rclpy
    from rclpy.node import Node
    from geometry_msgs.msg import Twist
    from sensor_msgs.msg import LaserScan
    from std_msgs.msg import String
except ImportError:
    rclpy = None
    Node = object
    Twist = None
    LaserScan = None
    String = None


def check_lidar_corridor_clearance(
    scan_msg,
    front_cone_rad: float = 0.61,  # ~35 độ mỗi bên
    emergency_stop_m: float = 0.50,
    warning_m: float = 0.80
) -> Tuple[str, float, str]:
    """
    Kiểm tra vật cản trong hành lang phía trước của xe từ LaserScan.
    Returns:
        (status, min_distance_m, reason)
        status in ["SAFE", "SLOWDOWN", "EMERGENCY_STOP"]
    """
    if scan_msg is None or not hasattr(scan_msg, 'ranges') or not scan_msg.ranges:
        return "SAFE", 99.0, "NO_SCAN_DATA"

    angle_min = scan_msg.angle_min
    angle_increment = scan_msg.angle_increment
    range_min = getattr(scan_msg, 'range_min', 0.05)
    range_max = getattr(scan_msg, 'range_max', 12.0)
    ranges = scan_msg.ranges
    num_readings = len(ranges)

    if angle_increment <= 0 or num_readings == 0:
        return "SAFE", 99.0, "INVALID_SCAN"

    min_front_dist = 99.0

    for i in range(num_readings):
        beam_angle = angle_min + i * angle_increment
        # Chuẩn hóa về [-pi, pi]
        norm_angle = math.atan2(math.sin(beam_angle), math.cos(beam_angle))

        # Kiểm tra hình nón phía trước: [-front_cone_rad, +front_cone_rad]
        if -front_cone_rad <= norm_angle <= front_cone_rad:
            r = ranges[i]
            if not math.isnan(r) and not math.isinf(r) and range_min <= r <= range_max:
                if r < min_front_dist:
                    min_front_dist = r

    if min_front_dist <= emergency_stop_m:
        return "EMERGENCY_STOP", round(min_front_dist, 3), f"OBSTACLE_FRONT_{int(min_front_dist*100)}CM"
    elif min_front_dist <= warning_m:
        return "SLOWDOWN", round(min_front_dist, 3), f"WARNING_FRONT_{int(min_front_dist*100)}CM"
    
    return "SAFE", round(min_front_dist, 3), "CLEAR"


class SafetyControllerNode(Node if Node is not object else object):
    """
    ROS 2 Safety Controller Node kiểm duyệt lệnh vận tốc cục bộ.
    """

    def __init__(self):
        if Node is not object:
            super().__init__('safety_controller_node')

        self.config_path = self._get_config_path()
        self.config = self._load_config()

        # Cấu hình Safety
        safety_cfg = self.config.get('safety', {})
        self.emergency_stop_dist = float(safety_cfg.get('emergency_stop_distance_m', 0.50))
        self.warning_dist = float(safety_cfg.get('warning_distance_m', 0.80))
        self.front_cone_deg = float(safety_cfg.get('front_cone_deg', 35.0))
        self.front_cone_rad = math.radians(self.front_cone_deg)

        # Cấu hình Topics
        topics_cfg = self.config.get('topics', {})
        self.cmd_vel_in_topic = topics_cfg.get('cmd_vel_in', '/cmd_vel_in')
        self.cmd_vel_out_topic = topics_cfg.get('cmd_vel', '/cmd_vel')
        self.scan_topic = topics_cfg.get('lidar_scan', '/scan')
        self.safety_state_topic = topics_cfg.get('safety_state', '/robot/safety_state')

        self.latest_scan = None
        self.last_cmd_time = 0.0
        self.current_safety_status = "SAFE"
        self.min_front_dist = 99.0

        # ROS 2 Subscribers & Publishers
        if Node is not object:
            self.cmd_vel_sub = self.create_subscription(
                Twist, self.cmd_vel_in_topic, self.on_cmd_vel_in, 10
            )
            self.scan_sub = self.create_subscription(
                LaserScan, self.scan_topic, self.on_scan_received, 10
            )
            self.cmd_vel_pub = self.create_publisher(Twist, self.cmd_vel_out_topic, 10)
            self.safety_pub = self.create_publisher(String, self.safety_state_topic, 10)

            # Heartbeat timer chạy 20Hz (50ms) đảm bảo phanh an toàn liên tục
            self.timer = self.create_timer(0.05, self.safety_watchdog_loop)
            self._log_info(
                f"SafetyControllerNode đã khởi động. Lắng nghe '{self.cmd_vel_in_topic}', lọc an toàn ra '{self.cmd_vel_out_topic}'"
            )

    def _log_info(self, msg: str):
        if Node is not object and hasattr(self, 'get_logger'):
            self.get_logger().info(msg)
        else:
            print(f"[INFO] {msg}")

    def _log_warn(self, msg: str):
        if Node is not object and hasattr(self, 'get_logger'):
            self.get_logger().warn(msg)
        else:
            print(f"[WARN] {msg}")

    def _get_config_path(self) -> str:
        try:
            from ament_index_python.packages import get_package_share_directory
            share_config = os.path.join(get_package_share_directory('hc_robot_client'), 'config', 'settings.yaml')
            if os.path.exists(share_config):
                return share_config
        except Exception:
            pass

        curr_dir = os.path.dirname(os.path.abspath(__file__))
        candidates = [
            os.path.abspath(os.path.join(curr_dir, '../../../../config/settings.yaml')),
            os.path.abspath(os.path.join(curr_dir, '../../../../../robot/config/settings.yaml')),
            os.path.abspath(os.path.join(curr_dir, '../../../../../config/settings.yaml')),
        ]
        for path in candidates:
            if os.path.exists(path):
                return path
        return candidates[0]

    def _load_config(self) -> dict:
        if os.path.exists(self.config_path):
            try:
                with open(self.config_path, 'r', encoding='utf-8') as f:
                    return yaml.safe_load(f) or {}
            except Exception as e:
                print(f"[ERROR] Lỗi đọc settings.yaml: {e}")
        return {}

    def on_scan_received(self, msg: LaserScan):
        self.latest_scan = msg

    def on_cmd_vel_in(self, msg: Twist):
        """Xử lý lệnh vận tốc đầu vào và kiểm duyệt an toàn lập tức."""
        self.last_cmd_time = time.time()
        safe_msg, status, dist, reason = self.evaluate_and_arbitrate(msg)
        self.current_safety_status = status
        self.min_front_dist = dist

        if Node is not object and hasattr(self, 'cmd_vel_pub'):
            self.cmd_vel_pub.publish(safe_msg)

    def evaluate_and_arbitrate(self, in_twist: Twist) -> Tuple[Twist, str, float, str]:
        """
        Kiểm tra tính an toàn của lệnh Twist.
        Nếu xe đang tiến (linear.x > 0) và có vật cản phía trước -> Phanh hoặc giảm tốc.
        """
        out_twist = Twist()
        out_twist.linear.x = in_twist.linear.x
        out_twist.linear.y = in_twist.linear.y
        out_twist.linear.z = in_twist.linear.z
        out_twist.angular.x = in_twist.angular.x
        out_twist.angular.y = in_twist.angular.y
        out_twist.angular.z = in_twist.angular.z

        # Nếu xe đứng yên hoặc lùi, tạm thời cho phép
        if in_twist.linear.x <= 0.0:
            return out_twist, "SAFE", self.min_front_dist, "IDLE_OR_REVERSE"

        # Đang tiến phía trước -> Kiểm tra LiDAR hành lang
        status, dist, reason = check_lidar_corridor_clearance(
            self.latest_scan,
            front_cone_rad=self.front_cone_rad,
            emergency_stop_m=self.emergency_stop_dist,
            warning_m=self.warning_dist
        )

        if status == "EMERGENCY_STOP":
            # PHANH KHẨN CẤP
            out_twist.linear.x = 0.0
            out_twist.angular.z = 0.0
            self._log_warn(f"EMERGENCY STOP KÍCH HOẠT: {reason} (Vật cản: {dist}m)")
        elif status == "SLOWDOWN":
            # GIẢM TỐC TỐI ĐA 0.15 m/s
            out_twist.linear.x = min(in_twist.linear.x, 0.15)

        return out_twist, status, dist, reason

    def safety_watchdog_loop(self):
        """Watchdog định kỳ phát trạng thái an toàn /robot/safety_state."""
        # Cập nhật cự ly vật cản phía trước liên tục
        status, dist, reason = check_lidar_corridor_clearance(
            self.latest_scan,
            front_cone_rad=self.front_cone_rad,
            emergency_stop_m=self.emergency_stop_dist,
            warning_m=self.warning_dist
        )
        self.current_safety_status = status
        self.min_front_dist = dist

        payload = {
            "timestamp": time.time(),
            "safety_state": status,
            "min_front_dist_m": dist if dist < 90.0 else None,
            "reason": reason
        }

        if Node is not object and hasattr(self, 'safety_pub'):
            msg = String()
            msg.data = json.dumps(payload)
            self.safety_pub.publish(msg)


def main(args=None):
    if rclpy is None:
        print("rclpy chưa được cài đặt trong môi trường này.")
        return

    rclpy.init(args=args)
    node = SafetyControllerNode()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        node.destroy_node()
        rclpy.shutdown()


if __name__ == '__main__':
    main()
