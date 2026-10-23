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
import json
import urllib.request
import threading
import rclpy
from rclpy.node import Node
from std_msgs.msg import String
from geometry_msgs.msg import Twist, Point, PoseStamped, TransformStamped
from nav_msgs.msg import Odometry
from sensor_msgs.msg import LaserScan, JointState
from visualization_msgs.msg import Marker, MarkerArray
from tf2_ros import TransformBroadcaster

# Danh sách Vùng Chức Năng Mặc Định chuẩn Hotel Concierge Lobby Arena (10m x 6m)
DEFAULT_HOTEL_ZONES = [
    {
        "id": "zone-keepout-staff",
        "name": "Khu Vực Staff Only (Cấm Vào)",
        "type": "KEEP_OUT",
        "x": 8.8,
        "y": 1.5,
        "width": 1.5,
        "height": 2.8,
        "speed_limit": 0.0,
        "description": "Khu vực kỹ thuật & phòng nhân viên nội bộ, robot tuyệt đối không đi vào.",
    },
    {
        "id": "zone-speed-frontdesk",
        "name": "Khu Vực Quầy Tiếp Tân (Giới Hạn Tốc Độ)",
        "type": "SPEED_ZONE",
        "x": 5.2,
        "y": 2.2,
        "width": 2.6,
        "height": 2.0,
        "speed_limit": 0.20,
        "description": "Khu vực đón tiếp đông khách, tự động giới hạn tốc độ tối đa 0.20 m/s.",
    },
    {
        "id": "zone-nostop-doorway",
        "name": "Cửa Thông Sảnh Chính (Cấm Dừng)",
        "type": "NO_STOP",
        "x": 4.4,
        "y": 2.85,
        "width": 1.4,
        "height": 1.6,
        "speed_limit": 0.30,
        "description": "Nút thắt lưu thông chính giữa 2 gian sảnh, robot chỉ được phép đi qua, cấm dừng đỗ.",
    },
]

# Sơ đồ Mặt Bằng Sảnh Tầng Trệt (Ground Floor - Lobby Arena)
# Không có trạm sạc robot, robot xuất phát và túc trực tại góc trên bên phải của Lobby (3.7, 5.0)
WAYPOINTS = [
    (3.7, 5.0, "1. Vị Trí Chờ Robot (Góc Trên Bên Phải Lobby)"),
    (2.0, 2.8, "2. Khu Sofa Khách Chờ Sảnh (Lobby Lounge)"),
    (5.2, 1.0, "3. Cửa Chính Ra Vào Sảnh (Main Entrance)"),
    (5.2, 2.0, "4. Trước Quầy Tiếp Tân (Front Desk)"),
    (7.8, 4.5, "5. Cụm Thang Máy Tầng 1 (Elevator)"),
    (6.6, 4.5, "6. Khu Vệ Sinh Sảnh (Restrooms)"),
    (7.85, 2.7, "7. Trước Phòng Nhân Viên (Staff Only)"),
    (3.7, 5.0, "8. Vị Trí Chờ Robot (Góc Trên Bên Phải Lobby)"),
]

# Tọa độ xuất phát ban đầu tại Góc Trên Bên Phải Lobby (3.7m, 5.0m, Yaw: -90° quay mũi xuống Nam)
SPAWN_X = 3.7
SPAWN_Y = 5.0
SPAWN_YAW = -math.pi / 2  # -1.5707963267948966 rad

class AutonomousNavigator(Node):
    def __init__(self):
        super().__init__('autonomous_navigator')
        
        self.cmd_pub = self.create_publisher(Twist, '/cmd_vel', 10)
        self.joint_pub = self.create_publisher(JointState, '/joint_states', 10)
        self.status_pub = self.create_publisher(String, '/goal_reached', 10)
        self.pose_pub = self.create_publisher(PoseStamped, '/robot_pose', 10)
        self.tf_broadcaster = TransformBroadcaster(self)

        self.odom_sub = self.create_subscription(Odometry, '/odom', self.odom_callback, 10)
        self.scan_sub = self.create_subscription(LaserScan, '/scan', self.scan_callback, 10)
        # Điểm đến A -> B động từ RViz2 '2D Goal Pose' hoặc CLI / Web:
        self.goal_sub = self.create_subscription(PoseStamped, '/goal_pose', self.goal_callback, 10)
        # Lenh chuyen mode: "PATROL", "STANDBY", "STOP"
        self.mode_sub = self.create_subscription(String, '/nav_mode', self.nav_mode_callback, 10)

        # Quản lý Vùng Chức Năng (Keep-out, Speed Limit, No-Stop)
        self.zones = [dict(z) for z in DEFAULT_HOTEL_ZONES]
        self.zone_sub = self.create_subscription(String, '/hotel_zones', self.zones_callback, 10)
        self.zone_telemetry_pub = self.create_publisher(String, '/zone_telemetry', 10)
        self.zone_marker_pub = self.create_publisher(MarkerArray, '/zone_markers', 10)
        self.last_zone_telemetry_time = 0.0
        self.last_speed_zone_log_id = None
        self.no_stop_stop_detected = 0.0
        self.zone_violation_msg = None
        self.clearing_no_stop = False
        self.marker_timer = self.create_timer(1.0, self.publish_zone_markers)
        self.fetch_backend_zones_async()
        
        # Robot position & orientation (Khoi tao tai Goc Tren Ben Phai Lobby: 3.7, 5.0, -90°)
        self.current_x = SPAWN_X
        self.current_y = SPAWN_Y
        self.current_yaw = SPAWN_YAW
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
        
        # Navigation state: "STANDBY" (túc trực chờ lệnh từ Web/Kiosk) hoặc "POINT_TO_POINT" hoặc "PATROL"
        self.mode = "STANDBY"
        self.standby_stopped = False
        self.custom_goal = None  # (x, y, name)
        self.sub_waypoints = []  # Danh sach diem trung gian ne tuong
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
        self.get_logger().info(" HC-ROBOT AUTONOMOUS LIDAR NAVIGATION (10m x 6m LOBBY)   ")
        self.get_logger().info(" Standby tai Goc Tren Ben Phai Lobby (X=3.70, Y=5.00)     ")
        self.get_logger().info(" Tích hợp Zone: Keep-out, Speed Limit, No-Stop trực tiếp ")
        self.get_logger().info("==========================================================")

    def is_inside_zone(self, x, y, zone):
        half_w = float(zone.get('width', 2.0) or 2.0) / 2.0
        half_h = float(zone.get('height', 2.0) or 2.0) / 2.0
        zx = float(zone.get('x', 0.0) or 0.0)
        zy = float(zone.get('y', 0.0) or 0.0)
        return (zx - half_w) <= x <= (zx + half_w) and (zy - half_h) <= y <= (zy + half_h)

    def get_zone_proximity(self, x, y, zone):
        half_w = float(zone.get('width', 2.0) or 2.0) / 2.0
        half_h = float(zone.get('height', 2.0) or 2.0) / 2.0
        zx = float(zone.get('x', 0.0) or 0.0)
        zy = float(zone.get('y', 0.0) or 0.0)
        dx = max(0.0, abs(x - zx) - half_w)
        dy = max(0.0, abs(y - zy) - half_h)
        return math.hypot(dx, dy)

    def get_active_zone(self, x, y):
        priority = {'KEEP_OUT': 3, 'NO_STOP': 2, 'SPEED_ZONE': 1, 'SLOW_SPEED': 1}
        matching = []
        for z in self.zones:
            if self.is_inside_zone(x, y, z):
                matching.append(z)
        if not matching:
            return None
        matching.sort(key=lambda z: priority.get(z.get('type', ''), 0), reverse=True)
        return matching[0]

    def zones_callback(self, msg: String):
        try:
            data = json.loads(msg.data)
            if isinstance(data, list):
                self.zones = data
                self.get_logger().info(f"[ĐỒNG BỘ ZONES] Nhận {len(self.zones)} vùng chức năng từ Web!")
                self.publish_zone_markers()
        except Exception as e:
            self.get_logger().error(f"Lỗi khi giải mã /hotel_zones: {e}")

    def fetch_backend_zones_async(self):
        def _fetch():
            try:
                req = urllib.request.Request("http://127.0.0.1:8000/api/v1/map/zones", headers={'User-Agent': 'HC-Robot-Nav'})
                with urllib.request.urlopen(req, timeout=2.0) as resp:
                    if resp.status == 200:
                        data = json.loads(resp.read().decode('utf-8'))
                        if isinstance(data, list) and len(data) > 0:
                            self.zones = data
                            self.get_logger().info(f"[ZONES CSDL] Đã tải thành công {len(self.zones)} vùng từ Backend!")
                            self.publish_zone_markers()
            except Exception:
                pass
        t = threading.Thread(target=_fetch, daemon=True)
        t.start()

    def publish_zone_markers(self):
        if not self.zones:
            return
        now_msg = self.get_clock().now().to_msg()
        ma = MarkerArray()

        for idx, z in enumerate(self.zones):
            z_type = z.get('type', 'KEEP_OUT')
            zx = float(z.get('x', 0.0) or 0.0)
            zy = float(z.get('y', 0.0) or 0.0)
            zw = float(z.get('width', 2.0) or 2.0)
            zh = float(z.get('height', 2.0) or 2.0)
            name = z.get('name', f"Zone-{idx}")

            box = Marker()
            box.header.stamp = now_msg
            box.header.frame_id = 'map'
            box.ns = 'hotel_zones_box'
            box.id = idx * 2
            box.type = Marker.CUBE
            box.action = Marker.ADD
            box.pose.position.x = zx
            box.pose.position.y = zy
            box.pose.position.z = 0.5
            box.pose.orientation.w = 1.0
            box.scale.x = zw
            box.scale.y = zh
            box.scale.z = 1.0

            if z_type == 'KEEP_OUT':
                box.color.r, box.color.g, box.color.b, box.color.a = 0.90, 0.15, 0.15, 0.35
            elif z_type in ('SPEED_ZONE', 'SLOW_SPEED'):
                box.color.r, box.color.g, box.color.b, box.color.a = 0.95, 0.65, 0.05, 0.30
            elif z_type == 'NO_STOP':
                box.color.r, box.color.g, box.color.b, box.color.a = 0.88, 0.12, 0.45, 0.35
            else:
                box.color.r, box.color.g, box.color.b, box.color.a = 0.30, 0.45, 0.90, 0.25
            ma.markers.append(box)

            txt = Marker()
            txt.header.stamp = now_msg
            txt.header.frame_id = 'map'
            txt.ns = 'hotel_zones_text'
            txt.id = idx * 2 + 1
            txt.type = Marker.TEXT_VIEW_FACING
            txt.action = Marker.ADD
            txt.pose.position.x = zx
            txt.pose.position.y = zy
            txt.pose.position.z = 1.15
            txt.pose.orientation.w = 1.0
            txt.scale.z = 0.28
            txt.color.r, txt.color.g, txt.color.b, txt.color.a = 1.0, 1.0, 1.0, 0.95

            if z_type == 'KEEP_OUT':
                txt.text = f"[CẤM VÀO] {name}"
            elif z_type in ('SPEED_ZONE', 'SLOW_SPEED'):
                txt.text = f"[TỐC ĐỘ {z.get('speed_limit', 0.2)}m/s] {name}"
            elif z_type == 'NO_STOP':
                txt.text = f"[CẤM DỪNG] {name}"
            else:
                txt.text = name
            ma.markers.append(txt)

        self.zone_marker_pub.publish(ma)

    def get_lobby_base_path(self, start_x, start_y, target_x, target_y):
        """Sinh chuoi waypoint co ban ne vach ngan x=4.4m va quay tiep tan."""
        pts = []
        from_is_left = start_x < 4.4
        to_is_left = target_x < 4.4

        if from_is_left and not to_is_left:
            # Gian Trai -> Gian Phai: Phai qua Cua Thong Sanh o tam (4.4, 2.85)
            if abs(start_y - 2.85) > 0.3 or start_x < 3.6:
                pts.append((3.8, 2.85, "Cửa Thông Sảnh (Tây)"))
            pts.append((4.4, 2.85, "Cửa Thông Sảnh (Tâm)"))
            pts.append((5.1, 2.85, "Cửa Thông Sảnh (Đông)"))
            if target_y < 2.0:
                pts.append((5.2, 1.8, "Hành lang Nam"))
            elif target_y > 3.6:
                pts.append((5.2, 4.0, "Hành lang Bắc"))
        elif not from_is_left and to_is_left:
            # Gian Phai -> Gian Trai
            if start_y < 2.0:
                pts.append((5.2, 1.8, "Hành lang Nam"))
            elif start_y > 3.6:
                pts.append((5.2, 4.0, "Hành lang Bắc"))
            pts.append((5.1, 2.85, "Cửa Thông Sảnh (Đông)"))
            pts.append((4.4, 2.85, "Cửa Thông Sảnh (Tâm)"))
            pts.append((3.8, 2.85, "Cửa Thông Sảnh (Tây)"))
        elif not from_is_left and not to_is_left:
            # Cung o Gian Phai: Kiem tra vuong Quay Front Desk theo 2 truc
            crosses_y = (start_y < 2.3 and target_y > 3.5) or (start_y > 3.5 and target_y < 2.3)
            min_x = min(start_x, target_x)
            max_x = max(start_x, target_x)
            crosses_x = min_x < 5.6 and max_x > 6.8 and (start_y < 2.65 or target_y < 2.65)

            if crosses_x:
                if start_x < target_x:
                    if start_y < 2.7:
                        pts.append((5.2, 2.85, "Hành lang Bắc Quầy"))
                else:
                    if target_y < 2.7:
                        pts.append((5.2, 2.85, "Hành lang Bắc Quầy"))
            elif crosses_y:
                pts.append((5.2, 2.5 if start_y < 2.3 else 3.5, "Né Quầy Tiếp Tân"))
                pts.append((5.2, 3.5 if start_y < 2.3 else 2.5, "Hành lang Quầy"))
        else:
            # Cung o Gian Trai: Tranh sofa sat tuong tay (x <= 1.5)
            if start_x < 1.8 or target_x < 1.8:
                pts.append((2.6, (start_y + target_y) / 2.0, "Hành lang Sofa"))

        return pts

    def calculate_safe_path(self, start_x, start_y, target_x, target_y):
        """Sinh chuoi waypoint trung gian ne vach ngan x=4.4m, quay le tan va tuong Staff Only."""
        pts = []
        is_inside_staff = lambda x, y: x >= 8.2 and y <= 3.05
        from_staff = is_inside_staff(start_x, start_y)
        to_staff = is_inside_staff(target_x, target_y)

        staff_approach = (7.85, 2.7, "Hành lang trước Cửa Staff Only")
        staff_door = (8.35, 2.65, "Tâm Cửa Phòng Staff Only")

        if not from_staff and to_staff:
            pts.extend(self.get_lobby_base_path(start_x, start_y, staff_approach[0], staff_approach[1]))
            pts.append(staff_approach)
            pts.append(staff_door)
        elif from_staff and not to_staff:
            pts.append(staff_door)
            pts.append(staff_approach)
            pts.extend(self.get_lobby_base_path(staff_approach[0], staff_approach[1], target_x, target_y))
        elif from_staff and to_staff:
            pass
        else:
            pts.extend(self.get_lobby_base_path(start_x, start_y, target_x, target_y))

        pts.append((target_x, target_y, f"Đích đến ({target_x:.2f}, {target_y:.2f})"))
        return pts

    def goal_callback(self, msg: PoseStamped):
        """Tiếp nhận điểm đích A -> B từ RViz2 '2D Goal Pose' hoặc Web API."""
        gx = msg.pose.position.x
        gy = msg.pose.position.y

        # Kiểm tra mục tiêu có vi phạm Vùng Chức Năng không:
        for z in self.zones:
            if z.get('type') == 'KEEP_OUT' and self.is_inside_zone(gx, gy, z):
                self.get_logger().error(f"[VÙNG CẤM] Điểm đến ({gx:.2f}, {gy:.2f}) nằm trong Keep-out Zone '{z.get('name')}'! Từ chối mục tiêu.")
                status_msg = String()
                status_msg.data = f"REJECTED:KEEP_OUT:{z.get('name')}"
                self.status_pub.publish(status_msg)
                return
            if z.get('type') == 'NO_STOP' and self.is_inside_zone(gx, gy, z):
                self.get_logger().warn(f"[VÙNG CẤM DỪNG] Điểm đến ({gx:.2f}, {gy:.2f}) nằm trong No-Stop Zone '{z.get('name')}'! Không thể đặt đích dừng tại đây.")
                status_msg = String()
                status_msg.data = f"REJECTED:NO_STOP:{z.get('name')}"
                self.status_pub.publish(status_msg)
                return

        self.sub_waypoints = self.calculate_safe_path(self.current_x, self.current_y, gx, gy)
        self.custom_goal = self.sub_waypoints[0]
        self.mode = "POINT_TO_POINT"
        self.standby_stopped = False
        self.pause_until = 0.0
        self.get_logger().info(
            f"[NHẬN LỆNH A -> B] Sinh lộ trình {len(self.sub_waypoints)} điểm né tường tới: X={gx:.2f}, Y={gy:.2f}"
        )
        self.print_next_target()

    def nav_mode_callback(self, msg: String):
        """Tiếp nhận lệnh chuyển đổi chế độ từ Web API: PATROL / STANDBY / STOP."""
        cmd = msg.data.strip().upper()
        if cmd == "PATROL":
            self.mode = "PATROL"
            self.standby_stopped = False
            self.get_logger().info("[MODE] Chuyển sang chế độ TUẦN TRA (PATROL)")
            self.print_next_target()
        elif cmd in ("STANDBY", "STOP"):
            self.mode = "STANDBY"
            self.sub_waypoints = []
            self.custom_goal = None
            self.publish_stop()
            self.standby_stopped = True
            self.get_logger().info("[MODE] Chuyển sang chế độ DỪNG (STANDBY)")

    def print_next_target(self):
        if self.mode == "POINT_TO_POINT" and self.custom_goal:
            tx, ty, name = self.custom_goal
            self.get_logger().info(f">> [ĐÍCH ĐẾN A -> B]: {name}")
        elif self.mode == "PATROL":
            tx, ty, name = WAYPOINTS[self.target_idx]
            self.get_logger().info(f">> [TUẦN TRA {self.target_idx + 1}/{len(WAYPOINTS)}] Đang hướng tới: {name} (X={tx:.2f}, Y={ty:.2f})")
        else:
            self.get_logger().info(f">> [STANDBY]: Túc trực tại ({self.current_x:.2f}, {self.current_y:.2f})")

    def publish_joint_states(self, linear_vel, angular_vel, dt=0.05):
        wheel_sep = 0.22
        v_l = linear_vel - (angular_vel * wheel_sep / 2.0)
        v_r = linear_vel + (angular_vel * wheel_sep / 2.0)
        
        self.wheel_l_pos += (v_l / self.wheel_radius) * dt
        self.wheel_r_pos += (v_r / self.wheel_radius) * dt
        
        js = JointState()
        js.header.stamp = self.get_clock().now().to_msg()
        js.header.frame_id = 'base_link'
        js.name = [
            'front_left_wheel_joint', 'rear_left_wheel_joint',
            'front_right_wheel_joint', 'rear_right_wheel_joint',
            'left_wheel_joint', 'right_wheel_joint'
        ]
        js.position = [
            float(self.wheel_l_pos), float(self.wheel_l_pos),
            float(self.wheel_r_pos), float(self.wheel_r_pos),
            float(self.wheel_l_pos), float(self.wheel_r_pos)
        ]
        js.velocity = [
            float(v_l / self.wheel_radius), float(v_l / self.wheel_radius),
            float(v_r / self.wheel_radius), float(v_r / self.wheel_radius),
            float(v_l / self.wheel_radius), float(v_r / self.wheel_radius)
        ]
        self.joint_pub.publish(js)

    def odom_callback(self, msg: Odometry):
        local_x = msg.pose.pose.position.x
        local_y = msg.pose.pose.position.y

        cos_yaw0 = math.cos(SPAWN_YAW)
        sin_yaw0 = math.sin(SPAWN_YAW)

        world_dx = local_x * cos_yaw0 - local_y * sin_yaw0
        world_dy = local_x * sin_yaw0 + local_y * cos_yaw0

        self.current_x = SPAWN_X + world_dx
        self.current_y = SPAWN_Y + world_dy

        q = msg.pose.pose.orientation
        siny_cosp = 2.0 * (q.w * q.z + q.x * q.y)
        cosy_cosp = 1.0 - 2.0 * (q.y * q.y + q.z * q.z)
        odom_yaw = math.atan2(siny_cosp, cosy_cosp)
        total_yaw = SPAWN_YAW + odom_yaw
        self.current_yaw = math.atan2(math.sin(total_yaw), math.cos(total_yaw))
        self.odom_received = True

        now_msg = self.get_clock().now().to_msg()

        world_pose = PoseStamped()
        world_pose.header.stamp = now_msg
        world_pose.header.frame_id = 'map'
        world_pose.pose.position.x = float(self.current_x)
        world_pose.pose.position.y = float(self.current_y)
        world_pose.pose.position.z = float(msg.pose.pose.position.z)
        world_pose.pose.orientation.x = 0.0
        world_pose.pose.orientation.y = 0.0
        world_pose.pose.orientation.z = math.sin(self.current_yaw / 2.0)
        world_pose.pose.orientation.w = math.cos(self.current_yaw / 2.0)
        self.pose_pub.publish(world_pose)

        t_map = TransformStamped()
        t_map.header.stamp = now_msg
        t_map.header.frame_id = 'map'
        t_map.child_frame_id = 'odom'
        t_map.transform.translation.x = float(SPAWN_X)
        t_map.transform.translation.y = float(SPAWN_Y)
        t_map.transform.translation.z = 0.0
        t_map.transform.rotation.x = 0.0
        t_map.transform.rotation.y = 0.0
        t_map.transform.rotation.z = math.sin(SPAWN_YAW / 2.0)
        t_map.transform.rotation.w = math.cos(SPAWN_YAW / 2.0)
        self.tf_broadcaster.sendTransform(t_map)

        t = TransformStamped()
        t.header.stamp = now_msg
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
        front_ranges = []
        left_ranges = []
        right_ranges = []

        for i, r in enumerate(msg.ranges):
            angle = msg.angle_min + i * msg.angle_increment
            norm_ang = math.atan2(math.sin(angle), math.cos(angle))
            deg = math.degrees(norm_ang)

            valid = (not math.isnan(r)) and (msg.range_min <= r <= msg.range_max)
            if valid:
                if -40.0 <= deg <= 40.0:
                    front_ranges.append(r)
                elif 40.0 < deg <= 90.0:
                    left_ranges.append(r)
                elif -90.0 <= deg < -40.0:
                    right_ranges.append(r)

        self.min_front_dist = min(front_ranges) if front_ranges else 10.0
        self.min_left_dist = min(left_ranges) if left_ranges else 10.0
        self.min_right_dist = min(right_ranges) if right_ranges else 10.0

    def control_loop(self):
        if not self.odom_received:
            self.publish_joint_states(0.0, 0.0)
            return

        now = time.time()
        active_zone = self.get_active_zone(self.current_x, self.current_y)

        # Định kỳ publish telemetry vùng (2Hz)
        if now - self.last_zone_telemetry_time > 0.5:
            self.last_zone_telemetry_time = now
            z_tel = {
                "in_zone": active_zone is not None,
                "zone_id": active_zone.get("id") if active_zone else None,
                "zone_name": active_zone.get("name") if active_zone else None,
                "zone_type": active_zone.get("type") if active_zone else None,
                "speed_limit": float(active_zone.get("speed_limit") or 0.20) if active_zone and active_zone.get("type") in ("SPEED_ZONE", "SLOW_SPEED") else None,
                "violation": self.zone_violation_msg,
            }
            tel_msg = String()
            tel_msg.data = json.dumps(z_tel)
            self.zone_telemetry_pub.publish(tel_msg)

        # 1. Xử lý chế độ STANDBY
        if self.mode == "STANDBY":
            # Nếu đang nằm trong NO_STOP zone, robot không được dừng lại hẳn mà phải tự động di chuyển thoát khỏi vùng
            if active_zone and active_zone.get("type") == "NO_STOP":
                if not self.clearing_no_stop:
                    self.clearing_no_stop = True
                    self.get_logger().warn(
                        f"[NO-STOP ZONE] Robot nhận lệnh dừng nhưng đang ở trong '{active_zone.get('name')}'. Tự động di chuyển thoát khỏi vùng cấm dừng..."
                    )
                cmd = Twist()
                cmd.linear.x = 0.18
                cmd.angular.z = 0.0
                self.cmd_pub.publish(cmd)
                self.publish_joint_states(cmd.linear.x, cmd.angular.z)
                return
            else:
                self.clearing_no_stop = False
                if not self.standby_stopped:
                    self.publish_stop()
                    self.standby_stopped = True
                if now - self.last_log_time > 4.0:
                    self.last_log_time = now
                    self.get_logger().info(f"[STANDBY] Sẵn sàng tại ({self.current_x:.2f}, {self.current_y:.2f})")
                return

        cmd = Twist()
        if self.mode == "POINT_TO_POINT" and self.custom_goal:
            tx, ty, name = self.custom_goal
        else:
            tx, ty, name = WAYPOINTS[self.target_idx]
        
        dx = tx - self.current_x
        dy = ty - self.current_y
        dist_to_target = math.hypot(dx, dy)
        
        if now - self.last_log_time > 1.5:
            self.last_log_time = now
            zone_tag = f" | [Zone: {active_zone['name']}]" if active_zone else ""
            self.get_logger().info(
                f"[{self.mode}] Mũi: {self.min_front_dist:.2f}m | Trái: {self.min_left_dist:.2f}m | Phải: {self.min_right_dist:.2f}m "
                f"-> Tại ({self.current_x:.2f}, {self.current_y:.2f}){zone_tag} -> Cách {name}: {dist_to_target:.2f}m"
            )

        # 2. Xử lý Pause tại Waypoint: Tuyệt đối không dừng nếu đang trong NO_STOP zone
        if self.pause_until > 0.0:
            if active_zone and active_zone.get("type") == "NO_STOP":
                self.get_logger().warn(
                    f"[NO-STOP ZONE] Bỏ qua thời gian tạm dừng vì đang trong '{active_zone.get('name')}', tiếp tục di chuyển!"
                )
                self.pause_until = 0.0
            elif now < self.pause_until:
                self.publish_stop()
                return
            else:
                self.pause_until = 0.0
                if self.mode == "PATROL":
                    self.target_idx = (self.target_idx + 1) % len(WAYPOINTS)
                    self.print_next_target()

        # 3. Đã tới đích (< 0.35m)
        if dist_to_target < 0.35:
            if self.mode == "POINT_TO_POINT":
                if len(self.sub_waypoints) > 1:
                    self.get_logger().info(f"==> Đã qua điểm trung gian: {name}, tiếp tục hành trình...")
                    self.sub_waypoints.pop(0)
                    self.custom_goal = self.sub_waypoints[0]
                    self.print_next_target()
                    return
                else:
                    self.get_logger().info(f"[SUCCESS] ĐÃ ĐẾN NƠI: {name}! Dừng xe an toàn tại điểm B.")
                    self.publish_stop()
                    self.standby_stopped = True
                    status_msg = String()
                    status_msg.data = f"REACHED:{tx:.2f},{ty:.2f}:{name}"
                    self.status_pub.publish(status_msg)
                    self.custom_goal = None
                    self.sub_waypoints = []
                    self.mode = "STANDBY"
                    self.pause_until = 0.0
                    return
            else:
                self.get_logger().info(f"==> ĐÃ ĐẾN NƠI: {name}! Tạm dừng 2s tiếp nhận...")
                self.publish_stop()
                self.pause_until = now + 2.0
                return

        # 4. Điều hướng mục tiêu cơ bản
        target_yaw = math.atan2(dy, dx)
        d_safe = 0.65       # Vùng cảnh báo vật cản 65cm
        d_stop = 0.25       # Khoảng cách phanh dừng khẩn cấp 25cm

        # Kiểm tra vật cản phía trước bằng LiDAR
        avoidance_offset = 0.0
        if self.min_front_dist < d_safe:
            if now > self.avoidance_locked_until:
                self.avoidance_dir = 1.0 if self.min_left_dist >= self.min_right_dist else -1.0
                self.avoidance_locked_until = now + 1.5
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

        # Lực đẩy ảo tránh xâm nhập Keep-out Zone
        keepout_bias = 0.0
        for z in self.zones:
            if z.get('type') == 'KEEP_OUT':
                prox = self.get_zone_proximity(self.current_x, self.current_y, z)
                if prox < 0.45:
                    zx = float(z.get('x', 0.0) or 0.0)
                    zy = float(z.get('y', 0.0) or 0.0)
                    angle_to_zone = math.atan2(zy - self.current_y, zx - self.current_x)
                    repulse_yaw = angle_to_zone + math.pi
                    ang_diff_rep = math.atan2(math.sin(repulse_yaw - self.current_yaw), math.cos(repulse_yaw - self.current_yaw))
                    rep_urgency = (0.45 - prox) / 0.45
                    keepout_bias += math.copysign(1.25 * rep_urgency, ang_diff_rep)

        desired_yaw = target_yaw + avoidance_offset + side_bias + keepout_bias
        angle_diff = desired_yaw - self.current_yaw
        angle_diff = math.atan2(math.sin(angle_diff), math.cos(angle_diff))

        # 5. Áp dụng Giới Hạn Tốc Độ (Speed Zone)
        max_allowed_linear = 0.38
        if active_zone and active_zone.get('type') in ('SPEED_ZONE', 'SLOW_SPEED'):
            zone_limit = float(active_zone.get('speed_limit') or 0.20)
            max_allowed_linear = min(max_allowed_linear, zone_limit)
            if self.last_speed_zone_log_id != active_zone.get('id'):
                self.last_speed_zone_log_id = active_zone.get('id')
                self.get_logger().info(f"[SPEED ZONE] Đi vào '{active_zone.get('name')}': Giới hạn tốc độ {zone_limit:.2f} m/s")
        else:
            if self.last_speed_zone_log_id is not None:
                self.get_logger().info(f"[NORMAL ZONE] Đã ra khỏi khu vực giới hạn tốc độ, khôi phục tốc độ {max_allowed_linear:.2f} m/s")
                self.last_speed_zone_log_id = None

        # 6. Tính toán vận tốc mượt mà (Smooth Velocity Profile)
        # Nếu robot xâm nhập sâu vào Keep-out Zone -> Lùi xe thoát ngay lập tức
        is_in_keepout = active_zone and active_zone.get('type') == 'KEEP_OUT'
        if is_in_keepout:
            self.get_logger().error(f"[XÂM NHẬP VÙNG CẤM] Robot đang ở trong '{active_zone.get('name')}', kích hoạt lùi khẩn cấp!")
            target_linear = -0.10
            target_angular = 0.60
        elif self.min_front_dist < d_stop:
            target_linear = 0.0
            turn_dir = self.avoidance_dir if self.avoidance_dir != 0.0 else (1.0 if angle_diff > 0 else -1.0)
            target_angular = 0.50 * turn_dir
        else:
            if abs(angle_diff) > 0.95:
                heading_factor = 0.15
            else:
                heading_factor = max(0.20, math.cos(angle_diff))
            
            clearance_factor = max(0.25, min(1.0, (self.min_front_dist - d_stop) / (d_safe - d_stop)))
            target_linear = max_allowed_linear * heading_factor * clearance_factor
            target_angular = max(min(1.35 * angle_diff, 0.85), -0.85)

        # 7. Phát hiện sự cố dừng trong No-Stop Zone
        if active_zone and active_zone.get('type') == 'NO_STOP':
            if abs(self.cmd_linear_x) < 0.03 and self.min_front_dist > 0.40:
                if self.no_stop_stop_detected == 0.0:
                    self.no_stop_stop_detected = now
                elif now - self.no_stop_stop_detected > 2.0:
                    self.zone_violation_msg = f"Cảnh báo: Robot dừng trong No-Stop Zone '{active_zone.get('name')}'"
                    if now - self.last_log_time > 2.0:
                        self.get_logger().warn(f"[VI PHẠM NO-STOP] {self.zone_violation_msg}")
            else:
                self.no_stop_stop_detected = 0.0
                self.zone_violation_msg = None
        else:
            self.no_stop_stop_detected = 0.0
            self.zone_violation_msg = None

        # Bộ lọc thông thấp (EMA) chống giật và bảo vệ vật lý robot
        alpha_lin = 0.35
        alpha_ang = 0.40
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

