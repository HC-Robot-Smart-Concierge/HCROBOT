import json
import math
import time
from typing import Dict, Optional

import rclpy
from rclpy.node import Node
from nav_msgs.msg import Odometry
from geometry_msgs.msg import TransformStamped, Quaternion
from std_msgs.msg import String
from tf2_ros import TransformBroadcaster


def euler_to_quaternion(yaw: float) -> Quaternion:
    """Convert yaw (radians) to ROS geometry_msgs/Quaternion."""
    q = Quaternion()
    q.x = 0.0
    q.y = 0.0
    q.z = math.sin(yaw / 2.0)
    q.w = math.cos(yaw / 2.0)
    return q


class OdomEncoderNode(Node):
    """
    ROS 2 Node that computes Differential-Drive Odometry from ESP32 4-Wheel Encoders
    and broadcasts /odom and TF (odom -> base_footprint) for SLAM and Nav2.
    """

    def __init__(self):
        super().__init__('odom_encoder_node')

        # Declare kinematic parameters
        self.declare_parameter('wheel_radius', 0.033)   # 33mm radius (66mm diameter)
        self.declare_parameter('wheel_base', 0.22)     # 220mm track width
        self.declare_parameter('encoder_cpr', 330.0)   # JGA25-370 CPR
        self.declare_parameter('odom_frame', 'odom')
        self.declare_parameter('base_frame', 'base_footprint')
        self.declare_parameter('publish_rate_hz', 20.0)

        self.wheel_radius = self.get_parameter('wheel_radius').value
        self.wheel_base = self.get_parameter('wheel_base').value
        self.encoder_cpr = self.get_parameter('encoder_cpr').value
        self.odom_frame = self.get_parameter('odom_frame').value
        self.base_frame = self.get_parameter('base_frame').value
        publish_rate = self.get_parameter('publish_rate_hz').value

        # Robot Pose state
        self.x = 0.0
        self.y = 0.0
        self.yaw = 0.0
        self.vx = 0.0
        self.vtheta = 0.0

        # Previous encoder state
        self.prev_left_ticks = 0
        self.prev_right_ticks = 0
        self.has_prev_ticks = False
        self.last_time = self.get_clock().now()

        # Cached encoder telemetry for frontend
        self.latest_telemetry: Dict = {
            "m1": {"ticks": 0, "rpm": 0.0, "dir": 0},
            "m2": {"ticks": 0, "rpm": 0.0, "dir": 0},
            "m3": {"ticks": 0, "rpm": 0.0, "dir": 0},
            "m4": {"ticks": 0, "rpm": 0.0, "dir": 0},
            "yaw_rate_dps": 0.0,
            "linear_velocity": 0.0,
            "angular_velocity": 0.0,
        }

        # Publishers
        self.odom_pub = self.create_publisher(Odometry, '/odom', 10)
        self.telemetry_pub = self.create_publisher(String, '/robot/encoder_telemetry', 10)
        self.tf_broadcaster = TransformBroadcaster(self)

        # Subscriber: Listen to raw telemetry from serial bridge
        self.serial_sub = self.create_subscription(
            String,
            '/robot/raw_esp32_telemetry',
            self.on_raw_telemetry,
            10
        )

        # Periodic timer for status broadcast
        self.timer = self.create_timer(1.0 / publish_rate, self.publish_odometry)

        self.get_logger().info(
            f"OdomEncoderNode initialized. CPR={self.encoder_cpr}, "
            f"Radius={self.wheel_radius}m, Track={self.wheel_base}m"
        )

    def on_raw_telemetry(self, msg: String):
        """Parse incoming JSON Lines packet from ESP32."""
        try:
            payload = json.loads(msg.data)
            encoders = payload.get("encoders")
            if encoders:
                self.update_from_encoders(encoders, payload.get("yaw_rate_dps", 0.0))
        except Exception as e:
            self.get_logger().warn(f"Telemetry parse error: {e}")

    def update_from_encoders(self, encoders: Dict, yaw_rate_dps: float = 0.0):
        """Update kinematic pose from 4-motor encoder ticks."""
        current_time = self.get_clock().now()
        dt = (current_time - self.last_time).nanoseconds / 1e9

        if dt <= 0.0:
            return

        # Motors 1 & 2 are Left side; Motors 3 & 4 are Right side
        m1 = encoders.get("m1", {})
        m2 = encoders.get("m2", {})
        m3 = encoders.get("m3", {})
        m4 = encoders.get("m4", {})

        left_ticks = (m1.get("ticks", 0) + m2.get("ticks", 0)) / 2.0
        right_ticks = (m3.get("ticks", 0) + m4.get("ticks", 0)) / 2.0

        if not self.has_prev_ticks:
            self.prev_left_ticks = left_ticks
            self.prev_right_ticks = right_ticks
            self.has_prev_ticks = True
            self.last_time = current_time
            return

        delta_left_ticks = left_ticks - self.prev_left_ticks
        delta_right_ticks = right_ticks - self.prev_right_ticks

        self.prev_left_ticks = left_ticks
        self.prev_right_ticks = right_ticks
        self.last_time = current_time

        # Distance per tick = (2 * pi * r) / CPR
        dist_per_tick = (2.0 * math.pi * self.wheel_radius) / self.encoder_cpr
        delta_left_m = delta_left_ticks * dist_per_tick
        delta_right_m = delta_right_ticks * dist_per_tick

        delta_s = (delta_right_m + delta_left_m) / 2.0
        delta_theta = (delta_right_m - delta_left_m) / self.wheel_base

        # Fuse with gyro yaw rate if active
        if abs(yaw_rate_dps) > 0.5:
            gyro_delta_theta = math.radians(yaw_rate_dps) * dt
            delta_theta = 0.7 * gyro_delta_theta + 0.3 * delta_theta

        # Integrate pose
        mid_yaw = self.yaw + (delta_theta / 2.0)
        self.x += delta_s * math.cos(mid_yaw)
        self.y += delta_s * math.sin(mid_yaw)
        self.yaw += delta_theta
        self.yaw = math.atan2(math.sin(self.yaw), math.cos(self.yaw))

        # Velocities
        self.vx = delta_s / dt
        self.vtheta = delta_theta / dt

        # Update cached telemetry
        self.latest_telemetry = {
            "m1": m1,
            "m2": m2,
            "m3": m3,
            "m4": m4,
            "yaw_rate_dps": yaw_rate_dps,
            "linear_velocity": round(self.vx, 3),
            "angular_velocity": round(self.vtheta, 3),
            "x": round(self.x, 3),
            "y": round(self.y, 3),
            "yaw_deg": round(math.degrees(self.yaw), 1),
        }

    def publish_odometry(self):
        """Publish ROS 2 Odometry message and TF transformation."""
        now = self.get_clock().now()
        q = euler_to_quaternion(self.yaw)

        # 1. Odometry Message
        odom = Odometry()
        odom.header.stamp = now.to_msg()
        odom.header.frame_id = self.odom_frame
        odom.child_frame_id = self.base_frame

        odom.pose.pose.position.x = self.x
        odom.pose.pose.position.y = self.y
        odom.pose.pose.position.z = 0.0
        odom.pose.pose.orientation = q

        # Pose Covariance matrix (6x6)
        odom.pose.covariance[0] = 0.01  # x
        odom.pose.covariance[7] = 0.01  # y
        odom.pose.covariance[35] = 0.05 # yaw

        # Twist
        odom.twist.twist.linear.x = self.vx
        odom.twist.twist.linear.y = 0.0
        odom.twist.twist.angular.z = self.vtheta
        odom.twist.covariance[0] = 0.02
        odom.twist.covariance[35] = 0.05

        self.odom_pub.publish(odom)

        # 2. TF Transform (odom -> base_footprint)
        t = TransformStamped()
        t.header.stamp = now.to_msg()
        t.header.frame_id = self.odom_frame
        t.child_frame_id = self.base_frame
        t.transform.translation.x = self.x
        t.transform.translation.y = self.y
        t.transform.translation.z = 0.0
        t.transform.rotation = q

        self.tf_broadcaster.sendTransform(t)

        # 3. Publish Telemetry String for Frontend
        telemetry_msg = String()
        telemetry_msg.data = json.dumps(self.latest_telemetry)
        self.telemetry_pub.publish(telemetry_msg)


def main(args=None):
    rclpy.init(args=args)
    node = OdomEncoderNode()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        node.destroy_node()
        rclpy.shutdown()


if __name__ == '__main__':
    main()
