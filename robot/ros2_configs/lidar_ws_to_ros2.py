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
from rclpy.qos import DurabilityPolicy, HistoryPolicy, QoSProfile, ReliabilityPolicy
from sensor_msgs.msg import LaserScan, JointState
from nav_msgs.msg import Odometry, Path
from geometry_msgs.msg import TransformStamped, PoseStamped, Twist
from std_msgs.msg import Empty, String
from visualization_msgs.msg import Marker, MarkerArray
from slam_toolbox.srv import Reset, SaveMap, Pause
from nav2_msgs.action import NavigateToPose
from rclpy.action import ActionClient
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
        self.joint_pub_ = self.create_publisher(JointState, '/joint_states', 10)
        self.encoder_telemetry_pub = self.create_publisher(String, '/robot/encoder_telemetry', 10)
        self.sensor_health_pub = self.create_publisher(String, '/robot/sensor_health', 10)
        self.foxglove_marker_pub = self.create_publisher(
            MarkerArray,
            '/foxglove/robot_marker',
            10,
        )
        model_qos = QoSProfile(
            history=HistoryPolicy.KEEP_LAST,
            depth=1,
            reliability=ReliabilityPolicy.RELIABLE,
            durability=DurabilityPolicy.TRANSIENT_LOCAL,
        )
        self.foxglove_model_pub = self.create_publisher(
            String,
            '/foxglove/robot_description',
            model_qos,
        )
        self.foxglove_model_xml = self._load_foxglove_robot_description()
        self.foxglove_model_timer = self.create_timer(2.0, self.publish_foxglove_robot_description)
        self.foxglove_marker_timer = self.create_timer(0.5, self.publish_foxglove_robot_marker)
        self.wheel_l_pos = 0.0
        self.wheel_r_pos = 0.0
        self.wheel_radius = 0.033
        self.wheel_sep = float(os.getenv("HCROBOT_WHEEL_BASE", "0.297"))
        self.encoder_cpr = float(os.getenv("HCROBOT_ENCODER_CPR", "330.0"))
        # M3 (P-TRƯỚC) đang ngược dấu so với bánh trái khi đi thẳng. Đặt -1 để đảo.
        # Nếu đã đảo trên ESP32 firmware, set HCROBOT_ENCODER_M3_SIGN=1.
        self.encoder_m3_sign = float(os.getenv("HCROBOT_ENCODER_M3_SIGN", "-1"))
        self.scan_count = 0
        self.last_scan_time = 0.0
        self.last_scan_points = 0
        self.pi_ws_connected = False
        self.encoder_packets = 0
        self.encoder_motion_detected = False
        self.last_encoder_publish_time = 0.0
        self.robot_mode = os.getenv("HCROBOT_MODE", "MAPPING").strip().upper()
        if self.robot_mode not in ("MAPPING", "NAVIGATION"):
            self.robot_mode = "MAPPING"

        # Lắng nghe topic /cmd_vel để điều khiển xe và di chuyển robot trên RViz
        self.cmd_vel_sub = self.create_subscription(
            Twist,
            '/cmd_vel',
            self.on_cmd_vel_received,
            10
        )

        # Lắng nghe topic /robot/reset_map để reset sạch SLAM và đưa robot về (0,0)
        self.reset_sub = self.create_subscription(
            Empty,
            '/robot/reset_map',
            self.on_reset_map_received,
            10
        )

        # Lắng nghe topic /robot/save_map để lưu bản đồ SLAM Toolbox đồng bộ
        self.save_map_sub = self.create_subscription(
            String,
            '/robot/save_map',
            self.on_save_map_received,
            10
        )

        # Lắng nghe topic /goal_pose từ RViz2 (2D Goal Pose) hoặc Web Admin
        self.goal_sub = self.create_subscription(
            PoseStamped,
            '/goal_pose',
            self.on_goal_pose_received,
            10
        )

        # Service Clients kết nối tới SLAM Toolbox
        self.slam_reset_client = self.create_client(Reset, '/slam_toolbox/reset')
        self.slam_save_client = self.create_client(SaveMap, '/slam_toolbox/save_map')
        self.slam_pause_client = self.create_client(Pause, '/slam_toolbox/pause_new_measurements')
        self.is_mapping_paused = False

        # Lắng nghe topic /robot/pause_map để tạm dừng/tiếp tục quét (Khóa bản đồ gốc)
        self.pause_sub = self.create_subscription(
            Empty,
            '/robot/pause_map',
            self.on_pause_map_received,
            10
        )
        self.map_status_pub = self.create_publisher(String, '/robot/mapping_status', 10)
        self.status_timer = self.create_timer(1.0, self.publish_map_status)
        self.sensor_health_timer = self.create_timer(1.0, self.publish_sensor_health)

        # Lưu trạng thái vị trí robot và quỹ đạo đường đi
        self.current_pose = {'x': 0.0, 'y': 0.0, 'yaw': 0.0}
        self.last_recorded_pose = {'x': 0.0, 'y': 0.0, 'yaw': 0.0}
        self.trajectory_path = Path()
        self.trajectory_path.header.frame_id = 'odom'

        # Động học Kinematics phục vụ Dead Reckoning theo thời gian thực (30Hz)
        self.current_vx = 0.0
        self.current_wz = 0.0
        self.measured_vx = 0.0
        self.measured_wz = 0.0
        self.last_cmd_time = time.monotonic()
        self.last_kinematics_time = time.monotonic()
        self.last_encoder_time = 0.0
        self.prev_left_ticks = 0.0
        self.prev_right_ticks = 0.0
        self.prev_motor_ticks = None
        self.has_prev_encoder_ticks = False
        self.allow_cmd_vel_odom = os.getenv("HCROBOT_ALLOW_CMD_VEL_ODOM", "0") == "1"
        self.last_sent_udp_motion = "stop"
        self.last_sent_teleop_pwm = None
        self.teleop_pwm_forward = int(os.getenv("HCROBOT_TELEOP_PWM", "50"))
        self.teleop_pwm_turn = int(os.getenv("HCROBOT_TELEOP_TURN_PWM", "50"))
        self._locked_yaw_deg = None

        # Cấu hình UDP gửi lệnh sang Pi 5
        self.pi5_ip = os.getenv("PI5_IP", "100.99.72.51")
        self.pi5_port = int(os.getenv("PI5_PORT", "9999"))
        self.udp_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self.nav2_client = ActionClient(self, NavigateToPose, '/navigate_to_pose')

        # Timer 30Hz tính toán di chuyển Dead Reckoning
        self.kinematics_timer = self.create_timer(1.0 / 30.0, self.update_kinematics)

        # Broadcast static transform base_link -> laser & laser_frame
        self.broadcast_static_laser_tf()

        # Khởi động UDP listener nhận tín hiệu từ main.py trên Pi 5 (port 9998)
        self.start_pi5_telemetry_udp_server()

        self.get_logger().info(
            f"🚀 LidarWsToRos2Bridge san sang - mode={self.robot_mode}, "
            f"odom={'encoder/IMU' if not self.allow_cmd_vel_odom else 'encoder + cmd_vel fallback'}"
        )

    def _load_foxglove_robot_description(self):
        model_path = os.path.abspath(
            os.path.join(os.path.dirname(__file__), '..', 'description', 'foxglove_robot.urdf')
        )
        try:
            with open(model_path, 'r', encoding='utf-8') as model_file:
                return model_file.read()
        except OSError as exc:
            self.get_logger().error(f"Khong doc duoc model Foxglove {model_path}: {exc}")
            return ''

    def publish_foxglove_robot_description(self):
        """Publish a stable, lightweight model that follows the real base_link TF."""
        if not self.foxglove_model_xml:
            return
        msg = String()
        msg.data = self.foxglove_model_xml
        self.foxglove_model_pub.publish(msg)

    def publish_foxglove_robot_marker(self):
        """Publish a small top-down robot icon without Foxglove's URDF scaling path."""
        now = self.get_clock().now().to_msg()
        marker_array = MarkerArray()

        def cube(marker_id, name, xyz, scale, rgba):
            marker = Marker()
            marker.header.frame_id = 'base_link'
            marker.header.stamp = now
            marker.ns = 'hcrobot_2d'
            marker.id = marker_id
            marker.type = Marker.CUBE
            marker.action = Marker.ADD
            marker.pose.position.x = float(xyz[0])
            marker.pose.position.y = float(xyz[1])
            marker.pose.position.z = float(xyz[2])
            marker.pose.orientation.w = 1.0
            marker.scale.x = float(scale[0])
            marker.scale.y = float(scale[1])
            marker.scale.z = float(scale[2])
            marker.color.r = float(rgba[0])
            marker.color.g = float(rgba[1])
            marker.color.b = float(rgba[2])
            marker.color.a = float(rgba[3])
            marker.frame_locked = True
            marker.text = name
            return marker

        marker_array.markers = [
            cube(0, 'body', (0.0, 0.0, 0.08), (0.40, 0.30, 0.16), (1.0, 0.30, 0.05, 1.0)),
            cube(1, 'front', (0.225, 0.0, 0.09), (0.05, 0.14, 0.06), (0.90, 0.05, 0.05, 1.0)),
            cube(2, 'lidar', (0.08, 0.0, 0.19), (0.08, 0.08, 0.04), (0.05, 0.05, 0.05, 1.0)),
        ]
        self.foxglove_marker_pub.publish(marker_array)

    def publish_map_status(self):
        status_msg = String()
        if self.robot_mode == "NAVIGATION":
            status_msg.data = "NAVIGATION"
        else:
            status_msg.data = "PAUSED" if self.is_mapping_paused else "MAPPING"
        self.map_status_pub.publish(status_msg)

    def publish_sensor_health(self):
        """Publish truthful end-to-end mapping health, not just socket state."""
        now = time.monotonic()
        scan_age = None if self.last_scan_time <= 0.0 else max(0.0, now - self.last_scan_time)
        lidar_live = scan_age is not None and scan_age < 1.5 and self.last_scan_points > 0
        reasons = []
        if not self.pi_ws_connected:
            reasons.append("PI_WEBSOCKET_OFFLINE")
        if not lidar_live:
            reasons.append("NO_LIDAR_SCAN")
        if self.encoder_packets == 0:
            reasons.append("NO_ENCODER_TELEMETRY")
        elif not self.encoder_motion_detected:
            reasons.append("NO_ODOMETRY_MOTION")

        msg = String()
        msg.data = json.dumps({
            "pi_ws_connected": self.pi_ws_connected,
            "lidar_live": lidar_live,
            "last_scan_age_sec": None if scan_age is None else round(scan_age, 2),
            "scan_points": self.last_scan_points,
            "scan_packets": self.scan_count,
            "encoder_packets": self.encoder_packets,
            "encoder_motion_detected": self.encoder_motion_detected,
            "ready_for_static_capture": lidar_live,
            "ready_for_mobile_mapping": lidar_live and self.encoder_motion_detected,
            "reasons": reasons,
        })
        self.sensor_health_pub.publish(msg)

    def on_reset_map_received(self, msg=None):
        """Reset sạch toàn bộ bản đồ SLAM, xóa vết đường đi và đưa robot về (0,0)."""
        self.get_logger().info("🧹 Đã nhận lệnh Reset Bản đồ: Đang xóa sạch SLAM Toolbox và đưa Robot về gốc (0,0)...")
        self.current_pose = {'x': 0.0, 'y': 0.0, 'yaw': 0.0}
        self.last_recorded_pose = {'x': 0.0, 'y': 0.0, 'yaw': 0.0}
        self.current_vx = 0.0
        self.current_wz = 0.0
        self._locked_yaw_deg = None
        self.encoder_motion_detected = False
        self.has_prev_encoder_ticks = False
        self.prev_motor_ticks = None
        self.last_cmd_time = time.monotonic()
        self._send_udp_to_pi5("stop")

        # Xóa sạch quỹ đạo đường đi màu vàng
        self.trajectory_path = Path()
        self.trajectory_path.header.frame_id = 'odom'
        self.trajectory_path.header.stamp = self.get_clock().now().to_msg()
        self.path_pub_.publish(self.trajectory_path)

        # Gọi service của SLAM Toolbox để xóa sạch dữ liệu OccupancyGrid & Scan Matcher
        if self.slam_reset_client.service_is_ready():
            req = Reset.Request()
            req.pause_new_measurements = False
            self.slam_reset_client.call_async(req)
            self.get_logger().info("✅ Đã gọi /slam_toolbox/reset thành công!")
        else:
            self.get_logger().warn("⚠️ Service /slam_toolbox/reset chưa sẵn sàng lúc này!")

        # Đồng bộ ngay TF odom -> base_link về (0, 0, 0)
        now = self.get_clock().now().to_msg()
        self._record_and_publish_state(now, 0.0, 0.0, 0.0, vx=0.0, wz=0.0, broadcast_tf=True)

    def on_save_map_received(self, msg: String):
        """Lưu bản đồ SLAM Toolbox ra file .yaml và .pgm đồng bộ với Web Admin."""
        raw_name = msg.data.strip() if msg and msg.data else "slam_map"
        safe_name = "".join(c for c in raw_name if c.isalnum() or c in ("_", "-")).strip() or "slam_map"
        map_dir = os.getenv(
            "HCROBOT_MAP_DIR",
            os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "maps")),
        )
        os.makedirs(map_dir, exist_ok=True)
        map_full_path = os.path.join(map_dir, safe_name)
        self.get_logger().info(f"💾 Đang lưu bản đồ SLAM Toolbox đồng bộ: {map_full_path}.(yaml/pgm)...")

        if self.slam_save_client.service_is_ready():
            req = SaveMap.Request()
            req.name.data = map_full_path
            future = self.slam_save_client.call_async(req)
            future.add_done_callback(lambda f: self._on_map_saved(f, map_full_path))
        else:
            self.get_logger().warn("⚠️ Service /slam_toolbox/save_map chưa sẵn sàng!")

    def _on_map_saved(self, future, map_full_path):
        try:
            future.result()
            self.get_logger().info(f"✅ Đã lưu thành công bản đồ SLAM Toolbox: {map_full_path}")
        except Exception as exc:
            self.get_logger().error(f"❌ Lưu bản đồ thất bại: {exc}")
            return

        # Dong bang SLAM ngay sau khi save. De tu hanh, khoi dong stack
        # NAVIGATION de map_server + AMCL thay the SLAM Toolbox.
        if not self.is_mapping_paused and self.slam_pause_client.service_is_ready():
            self.slam_pause_client.call_async(Pause.Request())
            self.is_mapping_paused = True
            self.publish_map_status()

    def on_pause_map_received(self, msg: Empty = None):
        """Khóa bản đồ gốc hoặc tiếp tục quét: gọi /slam_toolbox/pause_new_measurements."""
        if self.slam_pause_client.service_is_ready():
            req = Pause.Request()
            future = self.slam_pause_client.call_async(req)
            self.is_mapping_paused = not self.is_mapping_paused
            status_str = "PAUSED" if self.is_mapping_paused else "MAPPING"
            self.get_logger().info(f"🔒 Trạng thái bản đồ SLAM Toolbox: {status_str}")
            status_msg = String()
            status_msg.data = status_str
            self.map_status_pub.publish(status_msg)
        else:
            self.get_logger().warn("⚠️ Service /slam_toolbox/pause_new_measurements chưa sẵn sàng!")

    def on_goal_pose_received(self, msg: PoseStamped):
        """Nhận mục tiêu điều hướng từ 2D Goal Pose (RViz2) hoặc Web Admin và kích hoạt tự hành."""
        tx = float(msg.pose.position.x)
        ty = float(msg.pose.position.y)
        self.get_logger().info(f"🎯 [NAV2 GOAL] Nhận mục tiêu tự hành mới: X={tx:.2f}m, Y={ty:.2f}m")

        if self.robot_mode != "NAVIGATION":
            self.get_logger().warn("⚠️ Bỏ qua goal: hãy lưu map và chạy chế độ NAVIGATION trước.")
            return

        goal = NavigateToPose.Goal()
        goal.pose = msg
        goal.pose.header.frame_id = 'map'
        goal.pose.header.stamp = self.get_clock().now().to_msg()

        if self.nav2_client.wait_for_server(timeout_sec=0.5):
            send_future = self.nav2_client.send_goal_async(goal)
            send_future.add_done_callback(self._on_nav2_goal_response)
            return

        self.get_logger().warn("⚠️ Nav2 action server chưa sẵn sàng; không gửi lệnh chuyển động thay thế để tránh xung đột bộ điều khiển.")

    def _on_nav2_goal_response(self, future):
        goal_handle = future.result()
        if not goal_handle.accepted:
            self.get_logger().warn("⚠️ Nav2 từ chối mục tiêu.")
            return
        self.get_logger().info("✅ Nav2 đã nhận mục tiêu; planner đang tính đường trên static map.")
        goal_handle.get_result_async().add_done_callback(self._on_nav2_result)

    def _on_nav2_result(self, future):
        try:
            status = future.result().status
            self.get_logger().info(f"🏁 Nav2 kết thúc mục tiêu, status={status}")
        except Exception as exc:
            self.get_logger().warn(f"⚠️ Không đọc được kết quả Nav2: {exc}")


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
        # Nếu đang có vận tốc di chuyển (Dead Reckoning từ cmd_vel hoặc telemetry UDP),
        # giữ nguyên odometry mượt để tránh bị giật góc đột ngột làm sai lệch Scan Matching của SLAM
        if abs(self.current_vx) > 0.001 or abs(self.current_wz) > 0.001:
            return

        target_x = float(pose_dict.get('x', 0.0))
        target_y = float(pose_dict.get('y', 0.0))
        target_yaw = float(pose_dict.get('yaw', 0.0))

        # Lọc mượt góc xoay: Đảm bảo TF theo kịp chuyển động thực tế của robot, tránh trễ pha gây xoay map
        d_yaw = (target_yaw - self.current_pose['yaw'] + 540.0) % 360.0 - 180.0
        max_yaw_step = 10.0
        if abs(d_yaw) > max_yaw_step:
            yaw_deg = (self.current_pose['yaw'] + (max_yaw_step if d_yaw > 0 else -max_yaw_step)) % 360.0
        else:
            yaw_deg = target_yaw

        # Lọc mượt tọa độ X, Y: Giới hạn tối đa 8cm/frame
        dx = target_x - self.current_pose['x']
        dy = target_y - self.current_pose['y']
        max_pos_step = 0.08
        dist = math.hypot(dx, dy)
        if dist > max_pos_step:
            ratio = max_pos_step / dist
            px = self.current_pose['x'] + dx * ratio
            py = self.current_pose['y'] + dy * ratio
        else:
            px = target_x
            py = target_y

        self.current_pose = {'x': px, 'y': py, 'yaw': yaw_deg}
        now = self.get_clock().now().to_msg()
        self._record_and_publish_state(now, px, py, yaw_deg, broadcast_tf=True)

    def update_from_encoder_telemetry(self, encoders, yaw_rate_dps=0.0):
        """Tinh odom tu encoder that; khong suy dien quang duong tu /cmd_vel."""
        if not isinstance(encoders, dict):
            return

        self.encoder_packets += 1
        now_mono = time.monotonic()
        if now_mono - self.last_encoder_publish_time >= 0.1:
            telemetry = dict(encoders)
            telemetry["yaw_rate_dps"] = yaw_rate_dps
            telemetry_msg = String()
            telemetry_msg.data = json.dumps(telemetry)
            self.encoder_telemetry_pub.publish(telemetry_msg)
            self.last_encoder_publish_time = now_mono

        try:
            m1 = encoders.get("m1", {})
            m2 = encoders.get("m2", {})
            m3 = encoders.get("m3", {})
            m4 = encoders.get("m4", {})
            motor_ticks = {
                "m1": float(m1.get("ticks", 0)),
                "m2": float(m2.get("ticks", 0)),
                "m3": float(m3.get("ticks", 0)),
                "m4": float(m4.get("ticks", 0)),
            }
            left_ticks = (float(m1.get("ticks", 0)) + float(m2.get("ticks", 0))) / 2.0
            right_ticks = (
                self.encoder_m3_sign * float(m3.get("ticks", 0)) + float(m4.get("ticks", 0))
            ) / 2.0
        except (TypeError, ValueError):
            return

        if not self.has_prev_encoder_ticks:
            self.prev_left_ticks = left_ticks
            self.prev_right_ticks = right_ticks
            self.has_prev_encoder_ticks = True
            self.prev_motor_ticks = motor_ticks
            self.last_encoder_time = now_mono
            return

        dt = now_mono - self.last_encoder_time
        self.last_encoder_time = now_mono
        if dt <= 0.0 or dt > 1.0:
            self.prev_left_ticks = left_ticks
            self.prev_right_ticks = right_ticks
            self.prev_motor_ticks = motor_ticks
            return

        delta_left_ticks = left_ticks - self.prev_left_ticks
        delta_right_ticks = right_ticks - self.prev_right_ticks
        self.prev_left_ticks = left_ticks
        self.prev_right_ticks = right_ticks
        previous_motor_ticks = self.prev_motor_ticks or motor_ticks
        motor_deltas = {
            name: motor_ticks[name] - previous_motor_ticks.get(name, motor_ticks[name])
            for name in motor_ticks
        }
        self.prev_motor_ticks = motor_ticks
        if abs(delta_left_ticks) >= 1.0 or abs(delta_right_ticks) >= 1.0:
            self.encoder_motion_detected = True

        # Bo qua packet reset/wrap bat thuong thay vi keo map di mot quang lon.
        max_ticks_per_packet = self.encoder_cpr * 2.0
        if abs(delta_left_ticks) > max_ticks_per_packet or abs(delta_right_ticks) > max_ticks_per_packet:
            self.get_logger().warn("Encoder jump/reset detected; bỏ qua một mẫu odometry.")
            return

        distance_per_tick = (2.0 * math.pi * self.wheel_radius) / self.encoder_cpr
        # M1/M2 là cặp encoder đang đồng nhất trên robot thật. M3/M4 hiện lệch
        # hàng nghìn tick, nên không được phép kéo pose/map sang một quỹ đạo giả.
        left_reliable_ticks = (motor_deltas["m1"] + motor_deltas["m2"]) / 2.0
        motion = self.last_sent_udp_motion
        linear_sign = -1.0 if motion.startswith("backward") else 1.0
        is_linear_motion = motion.startswith("forward") or motion.startswith("backward")
        is_turn_motion = motion in (
            "left", "right", "forward_left", "forward_right",
            "backward_left", "backward_right",
        )

        delta_s = linear_sign * abs(left_reliable_ticks) * distance_per_tick if is_linear_motion else 0.0
        delta_yaw = 0.0
        try:
            gyro_rate = float(yaw_rate_dps or 0.0)
        except (TypeError, ValueError):
            gyro_rate = 0.0

        if is_turn_motion:
            self._locked_yaw_deg = None
            turn_sign = 1.0 if self.current_wz > 0.0 or motion == "left" else -1.0
            if abs(gyro_rate) > 0.5:
                delta_yaw = turn_sign * abs(math.radians(gyro_rate)) * dt
            else:
                # Fallback chỉ dùng độ lớn cặp encoder tốt, hướng lấy từ lệnh.
                wheel_arc = abs(left_reliable_ticks) * distance_per_tick
                delta_yaw = turn_sign * wheel_arc / max(self.wheel_sep / 2.0, 0.01)
            yaw_rad_new = math.radians(self.current_pose['yaw']) + delta_yaw
            self.current_pose['yaw'] = math.degrees(
                math.atan2(math.sin(yaw_rad_new), math.cos(yaw_rad_new))
            )
        elif is_linear_motion:
            if self._locked_yaw_deg is None:
                self._locked_yaw_deg = self.current_pose['yaw']
            self.current_pose['yaw'] = self._locked_yaw_deg
        else:
            # Không có lệnh chuyển động thì bỏ qua tick rung/nhiễu.
            delta_s = 0.0
            delta_yaw = 0.0

        yaw_rad = math.radians(self.current_pose['yaw'])
        self.current_pose['x'] += delta_s * math.cos(yaw_rad)
        self.current_pose['y'] += delta_s * math.sin(yaw_rad)
        self.measured_vx = delta_s / dt
        self.measured_wz = delta_yaw / dt

        now = self.get_clock().now().to_msg()
        self._record_and_publish_state(
            now,
            self.current_pose['x'],
            self.current_pose['y'],
            self.current_pose['yaw'],
            vx=self.measured_vx,
            wz=self.measured_wz,
            broadcast_tf=True,
        )

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

        if motion != "stop":
            pwm = self.teleop_pwm_turn if motion in ("left", "right") else self.teleop_pwm_forward
            pwm = max(20, min(50, pwm))
            self._send_udp_speed(pwm)
        self._send_udp_to_pi5(motion)

    def _is_straight_command(self) -> bool:
        motion = self.last_sent_udp_motion
        if motion.startswith("speed:"):
            return False
        if motion in ("forward", "backward"):
            return True
        return abs(self.current_vx) > 0.05 and abs(self.current_wz) < 0.2

    def _send_udp_speed(self, pwm: int):
        if pwm == self.last_sent_teleop_pwm:
            return
        self.last_sent_teleop_pwm = pwm
        try:
            self.udp_sock.sendto(f"speed:{pwm}".encode("utf-8"), (self.pi5_ip, self.pi5_port))
        except Exception as e:
            self.get_logger().debug(f"Loi gui UDP speed Pi 5: {e}")

    def _send_udp_to_pi5(self, motion: str):
        if motion.startswith("speed:"):
            self._send_udp_speed(int(motion.split(":", 1)[1]))
            return
        now = time.monotonic()
        should_send = (
            motion != self.last_sent_udp_motion
            or (motion != "stop" and (now - getattr(self, "_last_udp_send_time", 0.0) >= 0.1))
        )
        if should_send:
            self.last_sent_udp_motion = motion
            self._last_udp_send_time = now
            try:
                self.udp_sock.sendto(motion.encode("utf-8"), (self.pi5_ip, self.pi5_port))
            except Exception as e:
                self.get_logger().debug(f"Loi gui UDP Pi 5: {e}")

    def update_kinematics(self):
        now_mono = time.monotonic()
        dt = now_mono - self.last_kinematics_time
        self.last_kinematics_time = now_mono

        # Nếu quá 0.80s không có lệnh điều khiển tiếp, tự động phanh dừng an toàn
        if now_mono - self.last_cmd_time > 0.80:
            if self.current_vx != 0.0 or self.current_wz != 0.0:
                self.current_vx = 0.0
                self.current_wz = 0.0
                self._send_udp_to_pi5("stop")

        encoder_is_fresh = self.has_prev_encoder_ticks and (now_mono - self.last_encoder_time) < 0.5

        # Fallback nay mac dinh TAT. cmd_vel la lenh mong muon, khong phai
        # chuyen dong da do; dung no lam odom chinh la nguyen nhan map bi chong.
        if self.allow_cmd_vel_odom and not encoder_is_fresh and (
            abs(self.current_vx) > 0.001 or abs(self.current_wz) > 0.001
        ):
            yaw_deg = self.current_pose['yaw'] + math.degrees(self.current_wz * dt)
            self.current_pose['yaw'] = yaw_deg % 360.0

            yaw_rad = math.radians(self.current_pose['yaw'])
            self.current_pose['x'] += self.current_vx * math.cos(yaw_rad) * dt
            self.current_pose['y'] += self.current_vx * math.sin(yaw_rad) * dt

        if not encoder_is_fresh:
            self.measured_vx = self.current_vx if self.allow_cmd_vel_odom else 0.0
            self.measured_wz = self.current_wz if self.allow_cmd_vel_odom else 0.0

        # Khi LiDAR/SLAM chưa publish map->odom, phát TF identity để RobotModel không biến mất.
        scan_stale = self.last_scan_time <= 0.0 or (now_mono - self.last_scan_time) > 1.5
        if scan_stale:
            map_odom = TransformStamped()
            map_odom.header.stamp = self.get_clock().now().to_msg()
            map_odom.header.frame_id = "map"
            map_odom.child_frame_id = "odom"
            map_odom.transform.rotation.w = 1.0
            self.tf_broadcaster.sendTransform(map_odom)

        # Luôn phát /odom và TF odom -> base_link đều đặn 30Hz để robot model di chuyển mượt mà trên RViz2
        now = self.get_clock().now().to_msg()
        self._record_and_publish_state(
            now,
            self.current_pose['x'],
            self.current_pose['y'],
            self.current_pose['yaw'],
            vx=self.measured_vx,
            wz=self.measured_wz,
            broadcast_tf=True
        )

        # Tính toán góc quay và phát /joint_states để bánh xe xoay tròn trên RViz2
        v_l = self.measured_vx - (self.measured_wz * self.wheel_sep / 2.0)
        v_r = self.measured_vx + (self.measured_wz * self.wheel_sep / 2.0)
        self.wheel_l_pos += (v_l / self.wheel_radius) * dt
        self.wheel_r_pos += (v_r / self.wheel_radius) * dt

        js = JointState()
        js.header.stamp = now
        js.header.frame_id = 'base_link'
        js.name = ['left_wheel_joint', 'right_wheel_joint']
        js.position = [float(self.wheel_l_pos), float(self.wheel_r_pos)]
        js.velocity = [float(v_l / self.wheel_radius), float(v_r / self.wheel_radius)]
        self.joint_pub_.publish(js)

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
                        self.last_sent_udp_motion = cmd
                        self.last_cmd_time = time.monotonic()
                except socket.timeout:
                    pass
                except Exception:
                    pass
            sock.close()

        t = threading.Thread(target=udp_listener_worker, daemon=True)
        t.start()

    @staticmethod
    def _ray_box_dist(px, py, ray_angle_rad, xmin=-1.5, xmax=1.5, ymin=-2.5, ymax=2.5):
        dx = math.cos(ray_angle_rad)
        dy = math.sin(ray_angle_rad)
        candidates = []
        if dx > 1e-6:
            t = (xmax - px) / dx
            if t > 0 and (ymin - 0.08) <= (py + t * dy) <= (ymax + 0.08):
                candidates.append(t)
        elif dx < -1e-6:
            t = (xmin - px) / dx
            if t > 0 and (ymin - 0.08) <= (py + t * dy) <= (ymax + 0.08):
                candidates.append(t)
        if dy > 1e-6:
            t = (ymax - py) / dy
            if t > 0 and (xmin - 0.08) <= (px + t * dx) <= (xmax + 0.08):
                candidates.append(t)
        elif dy < -1e-6:
            t = (ymin - py) / dy
            if t > 0 and (xmin - 0.08) <= (px + t * dx) <= (xmax + 0.08):
                candidates.append(t)
        return min(candidates) if candidates else None

    def publish_scan(self, points):
        if not points:
            return

        now = self.get_clock().now().to_msg()
        self.scan_count += 1
        self.last_scan_time = time.monotonic()
        self.last_scan_points = len(points)
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
        msg.range_min = 0.20
        msg.range_max = 12.0

        ranges = [float('inf')] * num_bins
        intensities = [0.0] * num_bins

        for pt in points:
            angle_deg = pt.get('angle', 0.0) % 360.0
            dist = pt.get('distance', 0.0)
            quality = pt.get('quality', 0)

            if msg.range_min <= dist <= msg.range_max:
                # angle_deg nhận được đã chuẩn hóa CCW theo chuẩn ROS REP-103:
                # 0° -> Tiến (+X), 90° -> Trái (+Y), 180° -> Lùi (-X), 270° -> Phải (-Y)
                bin_idx = int(angle_deg) % num_bins
                # Giu khoang cach nho nhat neu co nhieu diem trong 1 bin
                if dist < ranges[bin_idx]:
                    ranges[bin_idx] = float(dist)
                    intensities[bin_idx] = float(quality)

        # Gắn tường bao cố định chỉ khi người dùng bật HCROBOT_FIXED_LAYOUT_3X5=1
        fixed_3x5 = os.getenv("HCROBOT_FIXED_LAYOUT_3X5", "0") == "1"
        rx = self.current_pose['x']
        ry = self.current_pose['y']
        ryaw_rad = math.radians(self.current_pose['yaw'])
        xmin = float(os.getenv("HCROBOT_ROOM_X_MIN", "-1.5"))
        xmax = float(os.getenv("HCROBOT_ROOM_X_MAX", "1.5"))
        ymin = float(os.getenv("HCROBOT_ROOM_Y_MIN", "-2.5"))
        ymax = float(os.getenv("HCROBOT_ROOM_Y_MAX", "2.5"))
        in_room = (xmin - 0.2 <= rx <= xmax + 0.2 and ymin - 0.2 <= ry <= ymax + 0.2) if fixed_3x5 else False

        if in_room:
            for b in range(num_bins):
                ray_angle = (ryaw_rad + (b * msg.angle_increment)) % (2.0 * math.pi)
                d_wall = self._ray_box_dist(rx, ry, ray_angle, xmin, xmax, ymin, ymax)
                if d_wall is not None:
                    if ranges[b] > d_wall:
                        ranges[b] = float(d_wall)
                        intensities[b] = 100.0
                    elif ranges[b] > (d_wall + 0.15):
                        ranges[b] = float(d_wall)
                        intensities[b] = 100.0

        msg.ranges = ranges
        msg.intensities = intensities

        # Đồng bộ hóa tức thời TF odom -> base_link đúng với timestamp của LaserScan
        self._record_and_publish_state(
            now,
            self.current_pose['x'],
            self.current_pose['y'],
            self.current_pose['yaw'],
            vx=self.measured_vx,
            wz=self.measured_wz,
            broadcast_tf=True
        )

        self.publisher_.publish(msg)


async def ws_loop(node: LidarWsToRos2Bridge, ws_url="ws://100.99.72.51:8000/api/v1/map/ws"):
    while rclpy.ok():
        try:
            async with websockets.connect(ws_url, ping_interval=10, ping_timeout=5) as ws:
                node.pi_ws_connected = True
                node.get_logger().info("✅ Da ket noi thanh cong toi WebSocket LiDAR Pi 5!")
                async for msg_str in ws:
                    if not rclpy.ok():
                        break
                    try:
                        data = json.loads(msg_str)
                        node.update_from_encoder_telemetry(
                            data.get("encoders"),
                            data.get("yaw_rate_dps", 0.0),
                        )
                        # Bỏ qua robot_pose noi suy tren Pi 5; odom phai den tu
                        # encoder/IMU de scan matching khong keo xeo static map.
                        points = data.get("scan_points", [])
                        if points:
                            node.publish_scan(points)
                    except Exception as e:
                        node.get_logger().warn(f"Loi parse frame: {e}")
        except Exception as e:
            node.pi_ws_connected = False
            node.get_logger().warn(f"Mat ket noi WS toi Pi 5 ({e}), se thu lai sau 2s...")
            await asyncio.sleep(2.0)
        finally:
            node.pi_ws_connected = False


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
