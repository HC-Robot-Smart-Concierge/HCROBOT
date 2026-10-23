import os
import math
import time
import json
import socket
import asyncio
import threading
import urllib.request
import websockets

import rclpy
from rclpy.node import Node
from sensor_msgs.msg import LaserScan, JointState
from nav_msgs.msg import Odometry, Path
from geometry_msgs.msg import TransformStamped, PoseStamped, Twist
from std_msgs.msg import Empty, String
from slam_toolbox.srv import Reset, SaveMap
from tf2_ros import TransformBroadcaster
from tf2_ros.static_transform_broadcaster import StaticTransformBroadcaster


class LidarWsToRos2Bridge(Node):
    def __init__(self):
        super().__init__('lidar_ws_to_ros2_bridge')
        self.publisher_ = self.create_publisher(LaserScan, '/scan', 10)
        self.odom_pub_ = self.create_publisher(Odometry, '/odom', 10)
        self.path_pub_ = self.create_publisher(Path, '/robot_path', 10)
        self.plan_pub_ = self.create_publisher(Path, '/plan', 10)
        self.static_tf_broadcaster = StaticTransformBroadcaster(self)
        self.tf_broadcaster = TransformBroadcaster(self)
        self.joint_pub_ = self.create_publisher(JointState, '/joint_states', 10)
        self.wheel_l_pos = 0.0
        self.wheel_r_pos = 0.0
        self.wheel_radius = 0.033
        self.wheel_sep = 0.297
        self.scan_count = 0

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

    def on_reset_map_received(self, msg=None):
        """Reset sạch toàn bộ bản đồ SLAM, xóa vết đường đi và đưa robot về (0,0)."""
        self.get_logger().info("🧹 Đã nhận lệnh Reset Bản đồ: Đang xóa sạch SLAM Toolbox và đưa Robot về gốc (0,0)...")
        self.current_pose = {'x': 0.0, 'y': 0.0, 'yaw': 0.0}
        self.last_recorded_pose = {'x': 0.0, 'y': 0.0, 'yaw': 0.0}
        self.current_vx = 0.0
        self.current_wz = 0.0
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
        map_dir = "/mnt/f/DoAn/HC-Robot/robot/maps"
        os.makedirs(map_dir, exist_ok=True)
        map_full_path = os.path.join(map_dir, safe_name)
        self.get_logger().info(f"💾 Đang lưu bản đồ SLAM Toolbox đồng bộ: {map_full_path}.(yaml/pgm)...")

        if self.slam_save_client.service_is_ready():
            req = SaveMap.Request()
            req.name.data = map_full_path
            future = self.slam_save_client.call_async(req)
            future.add_done_callback(
                lambda f: self.get_logger().info(f"✅ Đã lưu thành công bản đồ SLAM Toolbox: {map_full_path}")
            )
        else:
            self.get_logger().warn("⚠️ Service /slam_toolbox/save_map chưa sẵn sàng!")

    def on_goal_pose_received(self, msg: PoseStamped):
        """Nhận mục tiêu điều hướng từ 2D Goal Pose (RViz2) hoặc Web Admin và kích hoạt tự hành."""
        tx = float(msg.pose.position.x)
        ty = float(msg.pose.position.y)
        self.get_logger().info(f"🎯 [NAV2 GOAL] Nhận mục tiêu tự hành mới: X={tx:.2f}m, Y={ty:.2f}m")

        # 1. Xuất vệt đường đi toàn cục (Global Plan) lên topic /plan để RViz2 hiển thị đường dẫn màu xanh
        plan_msg = Path()
        plan_msg.header.stamp = self.get_clock().now().to_msg()
        plan_msg.header.frame_id = 'map'

        # Điểm xuất phát: vị trí robot hiện tại
        start_pose = PoseStamped()
        start_pose.header = plan_msg.header
        start_pose.pose.position.x = float(self.current_pose.get('x', 0.0))
        start_pose.pose.position.y = float(self.current_pose.get('y', 0.0))
        start_pose.pose.orientation.w = 1.0
        plan_msg.poses.append(start_pose)

        # Điểm đích: tọa độ goal
        end_pose = PoseStamped()
        end_pose.header = plan_msg.header
        end_pose.pose = msg.pose
        plan_msg.poses.append(end_pose)

        self.plan_pub_.publish(plan_msg)

        # 2. Gửi lệnh tự hành né vật cản tới Pi 5 bất đồng bộ
        def _send_goal():
            try:
                url = f"http://{self.pi5_ip}:8000/api/v1/map/navigate"
                payload = json.dumps({"target_x": tx, "target_y": ty}).encode('utf-8')
                req = urllib.request.Request(
                    url,
                    data=payload,
                    headers={"Content-Type": "application/json", "User-Agent": "ROS2-Nav2-Bridge"},
                    method="POST"
                )
                with urllib.request.urlopen(req, timeout=3.0) as resp:
                    res_data = json.loads(resp.read().decode('utf-8'))
                    self.get_logger().info(f"🚗 Pi 5 đã nhận lệnh tự hành: {res_data.get('message', 'OK')}")
            except Exception as e:
                self.get_logger().warn(f"⚠️ Không thể gửi Nav2 Goal tới Pi 5 ({url}): {e}")

        threading.Thread(target=_send_goal, daemon=True).start()


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

        # Luôn phát /odom và TF odom -> base_link đều đặn 30Hz để robot model di chuyển mượt mà trên RViz2
        now = self.get_clock().now().to_msg()
        self._record_and_publish_state(
            now,
            self.current_pose['x'],
            self.current_pose['y'],
            self.current_pose['yaw'],
            vx=self.current_vx,
            wz=self.current_wz,
            broadcast_tf=True
        )

        # Tính toán góc quay và phát /joint_states để bánh xe xoay tròn trên RViz2
        v_l = self.current_vx - (self.current_wz * self.wheel_sep / 2.0)
        v_r = self.current_vx + (self.current_wz * self.wheel_sep / 2.0)
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

        msg.ranges = ranges
        msg.intensities = intensities

        # Đồng bộ hóa tức thời TF odom -> base_link đúng với timestamp của LaserScan
        self._record_and_publish_state(
            now,
            self.current_pose['x'],
            self.current_pose['y'],
            self.current_pose['yaw'],
            vx=self.current_vx,
            wz=self.current_wz,
            broadcast_tf=True
        )

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
