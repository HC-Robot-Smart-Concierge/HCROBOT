#!/usr/bin/env python3
"""
Autonomous Navigation & Obstacle Avoidance Demo Node for HC-Robot
in Expanded 8m x 6m Hotel Lobby Arena.
Features:
- Closed-loop PID Waypoint navigation across 8x6m arena
- Real-time 360-degree LiDAR ray obstacle detection & reactive avoidance
- Terminal telemetry with laser ray distances
"""

import sys
import math
import time
import rclpy
from rclpy.node import Node
from geometry_msgs.msg import Twist, Point, PoseStamped, TransformStamped
from nav_msgs.msg import Odometry
from sensor_msgs.msg import LaserScan, JointState
from visualization_msgs.msg import Marker, MarkerArray
from tf2_ros import TransformBroadcaster

# 8x6m Arena Clear Perimeter Waypoints (in Odom Frame, Spawn at -3.0, 1.5, facing East)
# Tuyến đường hành lang mở bao quanh 6 trụ, cách xa mọi vật cản > 1m:
WAYPOINTS = [
    (2.5, 0.6, "1. Hành Lang Bắc (North Corridor)"),
    (5.5, 0.5, "2. Sảnh Đông Bắc (Northeast Corner)"),
    (6.0, -1.5, "3. Khu Vực Phía Đông (East Corridor)"),
    (5.5, -3.5, "4. Sảnh Đông Nam (Southeast Corner)"),
    (2.5, -3.8, "5. Hành Lang Nam (South Corridor)"),
    (0.2, -3.5, "6. Sảnh Tây Nam (Southwest Corner)"),
    (0.0, 0.0, "7. Trạm Sạc Ban Đầu (Docking Base)"),
]

class AutonomousNavigator(Node):
    def __init__(self):
        super().__init__('autonomous_navigator')
        
        self.cmd_pub = self.create_publisher(Twist, '/cmd_vel', 10)
        self.joint_pub = self.create_publisher(JointState, '/joint_states', 10)
        self.tf_broadcaster = TransformBroadcaster(self)

        self.odom_sub = self.create_subscription(Odometry, '/odom', self.odom_callback, 10)
        self.scan_sub = self.create_subscription(LaserScan, '/scan', self.scan_callback, 10)
        # Điểm đến A -> B động từ RViz2 '2D Goal Pose' hoặc CLI / Web:
        self.goal_sub = self.create_subscription(PoseStamped, '/goal_pose', self.goal_callback, 10)
        
        # Robot position & orientation
        self.current_x = 0.0
        self.current_y = 0.0
        self.current_yaw = 0.0
        self.odom_received = False
        
        # Wheel rotation states for RViz2 RobotModel
        self.wheel_l_pos = 0.0
        self.wheel_r_pos = 0.0
        self.wheel_radius = 0.033
        
        # 360 LiDAR Sectors
        self.min_front_dist = 10.0
        self.min_left_dist = 10.0
        self.min_right_dist = 10.0
        self.lidar_ray_count = 0
        
        # Navigation state: "PATROL" (tuần tra khắp map) hoặc "POINT_TO_POINT" (đi từ A đến B chỉ định)
        self.mode = "PATROL"
        self.custom_goal = None  # (x, y, name)
        self.target_idx = 0
        self.pause_until = 0.0
        self.avoidance_dir = 0.0          # 1.0 (Trái) hoặc -1.0 (Phải)
        self.avoidance_locked_until = 0.0 # Khóa hướng né để chống đảo chiều giật lắc
        self.cmd_linear_x = 0.0           # Filtered smooth linear velocity
        self.cmd_angular_z = 0.0          # Filtered smooth angular velocity
        self.last_log_time = 0.0
        
        # Control Loop 20Hz (50ms)
        self.timer = self.create_timer(0.05, self.control_loop)
        
        self.get_logger().info("==========================================================")
        self.get_logger().info(" HC-ROBOT AUTONOMOUS LIDAR NAVIGATION (8m x 6m ARENA)   ")
        self.get_logger().info(" Ho tro: Tuan tra toan map + Dieu huong Diem A -> Diem B  ")
        self.get_logger().info("==========================================================")
        self.print_next_target()

    def goal_callback(self, msg: PoseStamped):
        """Tiếp nhận điểm đích A -> B từ RViz2 '2D Goal Pose' hoặc Web API."""
        gx = msg.pose.position.x
        gy = msg.pose.position.y
        self.custom_goal = (gx, gy, f"Mục tiêu A->B ({gx:.2f}, {gy:.2f})")
        self.mode = "POINT_TO_POINT"
        self.pause_until = 0.0
        self.get_logger().info(f"🎯 [NHẬN LỆNH A -> B] Chuyển chế độ điều hướng thẳng tới: X={gx:.2f}, Y={gy:.2f}")

    def print_next_target(self):
        if self.mode == "POINT_TO_POINT" and self.custom_goal:
            tx, ty, name = self.custom_goal
            self.get_logger().info(f">> [ĐÍCH ĐẾN A -> B]: {name}")
        else:
            tx, ty, name = WAYPOINTS[self.target_idx]
            self.get_logger().info(f">> [TUẦN TRA {self.target_idx + 1}/{len(WAYPOINTS)}] Đang hướng tới: {name} (X={tx:.2f}, Y={ty:.2f})")

    def publish_joint_states(self, linear_vel, angular_vel, dt=0.05):
        # Calculate differential wheel speeds
        wheel_sep = 0.297
        v_l = linear_vel - (angular_vel * wheel_sep / 2.0)
        v_r = linear_vel + (angular_vel * wheel_sep / 2.0)
        
        self.wheel_l_pos += (v_l / self.wheel_radius) * dt
        self.wheel_r_pos += (v_r / self.wheel_radius) * dt
        
        js = JointState()
        js.header.stamp = self.get_clock().now().to_msg()
        js.header.frame_id = 'base_link'
        js.name = ['left_wheel_joint', 'right_wheel_joint']
        js.position = [float(self.wheel_l_pos), float(self.wheel_r_pos)]
        js.velocity = [float(v_l / self.wheel_radius), float(v_r / self.wheel_radius)]
        self.joint_pub.publish(js)

    def odom_callback(self, msg: Odometry):
        self.current_x = msg.pose.pose.position.x
        self.current_y = msg.pose.pose.position.y
        
        q = msg.pose.pose.orientation
        siny_cosp = 2.0 * (q.w * q.z + q.x * q.y)
        cosy_cosp = 1.0 - 2.0 * (q.y * q.y + q.z * q.z)
        self.current_yaw = math.atan2(siny_cosp, cosy_cosp)
        self.odom_received = True

        # Broadcast odom -> base_link Transform with current monotonic ROS clock
        t = TransformStamped()
        t.header.stamp = self.get_clock().now().to_msg()
        t.header.frame_id = 'odom'
        t.child_frame_id = 'base_link'
        t.transform.translation.x = msg.pose.pose.position.x
        t.transform.translation.y = msg.pose.pose.position.y
        t.transform.translation.z = msg.pose.pose.position.z
        t.transform.rotation = msg.pose.pose.orientation
        self.tf_broadcaster.sendTransform(t)

    def scan_callback(self, msg: LaserScan):
        if not msg.ranges:
            return
            
        self.lidar_ray_count = len(msg.ranges)
        
        # 1. Compute sector distances by true geometric angle
        front_ranges = []
        left_ranges = []
        right_ranges = []

        for i, r in enumerate(msg.ranges):
            angle = msg.angle_min + i * msg.angle_increment
            norm_ang = math.atan2(math.sin(angle), math.cos(angle))
            deg = math.degrees(norm_ang)

            valid = (not math.isnan(r)) and (msg.range_min <= r <= msg.range_max)
            if valid:
                # Front sector: -40° to +40° (directly ahead)
                if -40.0 <= deg <= 40.0:
                    front_ranges.append(r)
                # Left sector: +40° to +90°
                elif 40.0 < deg <= 90.0:
                    left_ranges.append(r)
                # Right sector: -90° to -40°
                elif -90.0 <= deg < -40.0:
                    right_ranges.append(r)

        self.min_front_dist = min(front_ranges) if front_ranges else 10.0
        self.min_left_dist = min(left_ranges) if left_ranges else 10.0
        self.min_right_dist = min(right_ranges) if right_ranges else 10.0

    def control_loop(self):
        if not self.odom_received:
            self.publish_joint_states(0.0, 0.0)
            return

        cmd = Twist()
        if self.mode == "POINT_TO_POINT" and self.custom_goal:
            tx, ty, name = self.custom_goal
        else:
            tx, ty, name = WAYPOINTS[self.target_idx]
        
        dx = tx - self.current_x
        dy = ty - self.current_y
        dist_to_target = math.hypot(dx, dy)
        
        now = time.time()
        if now - self.last_log_time > 1.5:
            self.last_log_time = now
            self.get_logger().info(
                f"[{self.mode}] Mũi: {self.min_front_dist:.2f}m | Trái: {self.min_left_dist:.2f}m | Phải: {self.min_right_dist:.2f}m "
                f"-> Tại ({self.current_x:.2f}, {self.current_y:.2f}) -> Cách {name}: {dist_to_target:.2f}m"
            )

        # Check waypoint pause state (Non-blocking)
        if self.pause_until > 0.0:
            if now < self.pause_until:
                self.publish_stop()
                return
            else:
                self.pause_until = 0.0
                if self.mode == "PATROL":
                    self.target_idx = (self.target_idx + 1) % len(WAYPOINTS)
                    self.print_next_target()

        # 1. Waypoint reached check (< 0.35m)
        if dist_to_target < 0.35:
            if self.mode == "POINT_TO_POINT":
                self.get_logger().info(f"🎉 ==> ĐÃ ĐẾN NƠI THÀNH CÔNG: {name}! Dừng xe an toàn tại điểm B.")
                self.publish_stop()
                self.custom_goal = None
                self.mode = "PATROL"  # Quay về chế độ tuần tra sẵn sàng hoặc dừng
                self.pause_until = now + 3.0
                return
            else:
                self.get_logger().info(f"==> ĐÃ ĐẾN NƠI: {name}! Tạm dừng 2s tiếp nhận...")
                self.publish_stop()
                self.pause_until = now + 2.0
                return

        # 2. Smooth Tangential Guidance & Reactive Avoidance
        # Hướng mục tiêu cơ sở tới đích:
        target_yaw = math.atan2(dy, dx)
        d_safe = 0.65       # Vùng cảnh báo vật cản 65cm
        d_stop = 0.25       # Khoảng cách phanh dừng khẩn cấp 25cm

        # Kiểm tra vật cản phía trước và khóa hướng lách (chống đảo hướng liên tục):
        avoidance_offset = 0.0
        if self.min_front_dist < d_safe:
            if now > self.avoidance_locked_until:
                self.avoidance_dir = 1.0 if self.min_left_dist >= self.min_right_dist else -1.0
                self.avoidance_locked_until = now + 1.5  # Giữ hướng né ổn định trong 1.5s
            
            # Góc né mượt tỉ lệ thuận với độ gần của vật cản (tối đa né 75 độ):
            obstacle_urgency = max(0.0, min(1.0, (d_safe - self.min_front_dist) / (d_safe - d_stop)))
            avoidance_offset = self.avoidance_dir * (1.30 * obstacle_urgency)
        else:
            if now > self.avoidance_locked_until:
                self.avoidance_dir = 0.0

        # Phản xạ tránh va chạm nhẹ với hai bên hông:
        side_bias = 0.0
        if self.min_left_dist < 0.35:
            side_bias -= 0.35 * (0.35 - self.min_left_dist) / 0.35
        if self.min_right_dist < 0.35:
            side_bias += 0.35 * (0.35 - self.min_right_dist) / 0.35

        desired_yaw = target_yaw + avoidance_offset + side_bias
        angle_diff = desired_yaw - self.current_yaw
        angle_diff = math.atan2(math.sin(angle_diff), math.cos(angle_diff))

        # 3. Tính toán vận tốc mượt mà (Smooth Velocity Profile)
        if self.min_front_dist < d_stop:
            # Phanh dừng khẩn cấp trước vật cản quá gần, chỉ xoay mở góc né
            target_linear = 0.0
            turn_dir = self.avoidance_dir if self.avoidance_dir != 0.0 else (1.0 if angle_diff > 0 else -1.0)
            target_angular = 0.50 * turn_dir
        else:
            # Khi góc lệch quá lớn (> 55 độ): Giảm tốc độ tịnh tiến để xoay căn hướng trước
            if abs(angle_diff) > 0.95:
                heading_factor = 0.15
            else:
                heading_factor = max(0.20, math.cos(angle_diff))
            
            # Điều tiết tốc độ theo độ thông thoáng phía trước
            clearance_factor = max(0.25, min(1.0, (self.min_front_dist - d_stop) / (d_safe - d_stop)))
            target_linear = 0.22 * heading_factor * clearance_factor
            target_angular = max(min(1.10 * angle_diff, 0.60), -0.60)

        # Bộ lọc thông thấp (EMA) chống giật và bảo vệ vật lý robot
        alpha_lin = 0.25
        alpha_ang = 0.30
        self.cmd_linear_x = (1.0 - alpha_lin) * self.cmd_linear_x + alpha_lin * target_linear
        self.cmd_angular_z = (1.0 - alpha_ang) * self.cmd_angular_z + alpha_ang * target_angular

        cmd = Twist()
        cmd.linear.x = float(self.cmd_linear_x)
        cmd.angular.z = float(self.cmd_angular_z)

        self.cmd_pub.publish(cmd)
        self.publish_joint_states(cmd.linear.x, cmd.angular.z)

    def publish_stop(self):
        self.cmd_linear_x = 0.0
        self.cmd_angular_z = 0.0
        cmd = Twist()
        cmd.linear.x = 0.0
        cmd.angular.z = 0.0
        self.cmd_pub.publish(cmd)
        self.publish_joint_states(0.0, 0.0)

def main(args=None):
    rclpy.init(args=args)
    navigator = AutonomousNavigator()
    try:
        rclpy.spin(navigator)
    except KeyboardInterrupt:
        navigator.publish_stop()
    finally:
        navigator.destroy_node()
        rclpy.shutdown()

if __name__ == '__main__':
    main()

