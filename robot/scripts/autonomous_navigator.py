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
import heapq
import subprocess
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
        "name": "Khu Vực Quầy Lễ Tân Nội Bộ (Cấm Vào)",
        "type": "KEEP_OUT",
        "x": 11.44,
        "y": 6.4,
        "width": 2.80,
        "height": 3.60,
        "speed_limit": 0.0,
        "description": "Khu vực quầy lễ tân nội bộ, robot tuyệt đối không đi vào.",
    },
    {
        "id": "zone-speed-frontdesk",
        "name": "Khu Vực Quầy Tiếp Tân (Giới Hạn Tốc Độ)",
        "type": "SPEED_ZONE",
        "x": 11.44,
        "y": 2.8,
        "width": 4.80,
        "height": 2.40,
        "speed_limit": 0.20,
        "description": "Khu vực đón tiếp đông khách, tự động giới hạn tốc độ tối đa 0.20 m/s.",
    },
    {
        "id": "zone-nostop-doorway",
        "name": "Cửa Thông Sảnh Chính (Cấm Dừng)",
        "type": "NO_STOP",
        "x": 12.84,
        "y": 9.8,
        "width": 2.40,
        "height": 2.80,
        "speed_limit": 0.30,
        "description": "Nút thắt lưu thông chính giữa 2 gian sảnh, robot chỉ được phép đi qua, cấm dừng đỗ.",
    },
]

# Sơ đồ Mặt Bằng Sảnh Tầng Trệt (Ground Floor - Lobby Arena 9.80m x 6.30m)
# Robot xuất phát và túc trực tại Khu vực Phía Bắc của Lobby (3.6, 4.8)
WAYPOINTS = [
    (7.2, 9.6, "1. Vị Trí Chờ Robot Sảnh (Phía Bắc)", "PARK", "ROBOT_STANDBY"),
    (6.0, 9.6, "2. Trạm Sạc Robot Sảnh", "CHARGER", "CHARGER_STATION"),
    (3.6, 7.2, "3. Khu Sofa Khách Chờ Sảnh (Lobby Lounge)", "WAYPOINT", "LOBBY_LOUNGE"),
    (8.4, 2.0, "4. Cửa Chính Ra Vào Sảnh (Main Entrance)", "WAYPOINT", "MAIN_ENTRANCE"),
    (11.44, 2.8, "5. Trước Quầy Tiếp Tân (Front Desk)", "WAYPOINT", "FRONT_DESK"),
    (11.44, 6.4, "6. Trước Phòng Nội Bộ (Staff Only)", "WAYPOINT", "STAFF_ONLY"),
    (15.6, 6.96, "7. Cụm Thang Máy Tầng 1 (Elevator)", "WAYPOINT", "ELEVATOR"),
    (15.2, 2.4, "8. Khu Vệ Sinh Sảnh (Restrooms)", "WAYPOINT", "RESTROOMS"),
    (16.0, 4.8, "9. Lối Thoát Hiểm Khẩn Cấp (Emergency Exit)", "WAYPOINT", "STAIRS"),
]

# Tọa độ xuất phát ban đầu tại Phía Bắc Lobby (3.6m, 4.8m, Yaw: -90° quay mũi xuống Nam)
SPAWN_X = 7.2
SPAWN_Y = 9.6
SPAWN_YAW = -math.pi / 2

# Danh sach toan bo 9 Model Marker chuan trong Gazebo
ALL_GAZEBO_MARKERS = [
    'wp_marker_standby',
    'wp_marker_charger',
    'wp_marker_frontdesk',
    'wp_marker_entrance',
    'wp_marker_elevator',
    'wp_marker_restrooms',
    'wp_marker_emergency',
    'wp_marker_lounge',
    'wp_marker_staff',
]


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
        self.waypoint_marker_pub = self.create_publisher(MarkerArray, '/waypoint_markers', 10)
        self.waypoint_sub = self.create_subscription(String, '/hotel_waypoints', self.waypoints_callback, 10)
        self.last_zone_telemetry_time = 0.0
        self.last_speed_zone_log_id = None
        self.no_stop_stop_detected = 0.0
        self.zone_violation_msg = None
        self.clearing_no_stop = False
        self.marker_timer = self.create_timer(1.0, self.publish_all_markers)
        self.fetch_backend_zones_async()
        self.fetch_backend_waypoints_async()
        
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

    def fetch_backend_waypoints_async(self):
        def _fetch():
            try:
                req = urllib.request.Request("http://127.0.0.1:8000/api/v1/map/waypoints", headers={'User-Agent': 'HC-Robot-Nav'})
                with urllib.request.urlopen(req, timeout=2.0) as resp:
                    if resp.status == 200:
                        data = json.loads(resp.read().decode('utf-8'))
                        if isinstance(data, list) and len(data) > 0:
                            msg = String()
                            msg.data = json.dumps(data)
                            self.waypoints_callback(msg)
                            self.get_logger().info(f"[WAYPOINTS CSDL] Đã tải và đồng bộ thành công {len(data)} điểm mốc từ Backend!")
            except Exception:
                pass
        t = threading.Thread(target=_fetch, daemon=True)
        t.start()

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

    def publish_waypoint_markers(self):
        if not WAYPOINTS:
            return
        now_msg = self.get_clock().now().to_msg()
        ma = MarkerArray()

        for idx, wp in enumerate(WAYPOINTS):
            wx = float(wp[0])
            wy = float(wp[1])
            name = str(wp[2])
            wp_type = (wp[3] if len(wp) > 3 else "WAYPOINT").upper()

            # Cylinder ground beacon
            disk = Marker()
            disk.header.stamp = now_msg
            disk.header.frame_id = 'map'
            disk.ns = 'hotel_waypoint_disk'
            disk.id = idx * 2
            disk.type = Marker.CYLINDER
            disk.action = Marker.ADD
            disk.pose.position.x = wx
            disk.pose.position.y = wy
            disk.pose.position.z = 0.02
            disk.pose.orientation.w = 1.0
            disk.scale.x = 0.50
            disk.scale.y = 0.50
            disk.scale.z = 0.04

            # Cung loai thi cung mau:
            # - CHARGER: Xanh ngoc / La nhat (Mint Green)
            # - PARK: Diem cho sanh -> Xanh duong nhat (Light Blue)
            # - WAYPOINT: End thuong -> Xam nhat (Light Gray)
            if wp_type in ("CHARGER", "DOCKING_TARGET"):
                disk.color.r, disk.color.g, disk.color.b, disk.color.a = 0.20, 0.83, 0.60, 0.85
            elif wp_type in ("PARK", "PARKING_SPOT"):
                disk.color.r, disk.color.g, disk.color.b, disk.color.a = 0.38, 0.65, 0.98, 0.85
            else:
                disk.color.r, disk.color.g, disk.color.b, disk.color.a = 0.58, 0.64, 0.72, 0.85
            ma.markers.append(disk)

            # Floating text
            txt = Marker()
            txt.header.stamp = now_msg
            txt.header.frame_id = 'map'
            txt.ns = 'hotel_waypoint_text'
            txt.id = idx * 2 + 1
            txt.type = Marker.TEXT_VIEW_FACING
            txt.action = Marker.ADD
            txt.pose.position.x = wx
            txt.pose.position.y = wy
            txt.pose.position.z = 0.60
            txt.pose.orientation.w = 1.0
            txt.scale.z = 0.25
            txt.color.r, txt.color.g, txt.color.b, txt.color.a = 1.0, 1.0, 1.0, 0.95
            txt.text = f"[{wp_type}] {name}" if wp_type in ("CHARGER", "PARK") else name
            ma.markers.append(txt)

        self.waypoint_marker_pub.publish(ma)

    def get_gazebo_model_name(self, wp_id, name, wp_type):
        """Map tu ID / Ten sang ten Model trong file hotel_room.world de set_pose."""
        id_str = str(wp_id or "").lower()
        name_str = str(name or "").lower()
        type_str = str(wp_type or "").upper()

        # 1. Charger / Tram sac
        if 'charger' in id_str or 'sạc' in name_str or 'sac' in name_str or 'charger' in name_str or 'dock' in name_str or type_str in ('CHARGER', 'DOCKING_TARGET'):
            return 'wp_marker_charger'
        # 2. Lounge / Sofa / Khach cho (Uu tien truoc Standby vi Sofa khach cho co chu 'cho')
        if 'lounge' in id_str or 'sofa' in name_str or 'sofa' in id_str or 'lounge' in name_str or 'khách chờ' in name_str or 'khach cho' in name_str:
            return 'wp_marker_lounge'
        # 3. Reception / Le tan
        if 'front_desk' in id_str or 'lễ tân' in name_str or 'le tan' in name_str or 'tiếp tân' in name_str or 'tiep tan' in name_str or 'front desk' in name_str or 'reception' in name_str:
            return 'wp_marker_frontdesk'
        # 4. Entrance / Cua chinh / Cua ra vao
        if 'entrance' in id_str or 'cửa' in name_str or 'cua' in name_str or 'door' in name_str or 'gate' in name_str or 'main' in name_str:
            return 'wp_marker_entrance'
        # 5. Elevator / Thang may
        if 'elevator' in id_str or 'thang máy' in name_str or 'thang may' in name_str or 'lift' in name_str:
            return 'wp_marker_elevator'
        # 6. Restrooms / WC / Toilet
        if 'restroom' in id_str or 'wc' in name_str or 'vệ sinh' in name_str or 've sinh' in name_str or 'toilet' in name_str or 'toilet' in id_str:
            return 'wp_marker_restrooms'
        # 7. Emergency Exit / Thoat hiem
        if 'stair' in id_str or 'emergency' in id_str or 'thoát hiểm' in name_str or 'thoat hiem' in name_str:
            return 'wp_marker_emergency'
        # 8. Staff / Phong noi bo
        if 'staff' in id_str or 'nội bộ' in name_str or 'noi bo' in name_str:
            return 'wp_marker_staff'
        # 9. Standby / Diem cho / Park
        if 'standby' in id_str or 'chờ' in name_str or 'cho' in name_str or 'đỗ' in name_str or 'do' in name_str or 'standby' in name_str or 'park' in id_str or tp_s in ('PARK', 'PARKING_SPOT'):
            return 'wp_marker_standby'

        return None

    def sync_gazebo_marker_pose(self, model_name, x, y, z=0.01):
        """Goi truc tiep dich vu Gazebo set_pose de di chuyen model tren sa ban 3D."""
        if not model_name:
            return
        
        req_str = f'name: "{model_name}", position: {{x: {x:.2f}, y: {y:.2f}, z: {z:.2f}}}'
        bash_cmd = (
            "source /opt/ros/jazzy/setup.bash && "
            "export GZ_CONFIG_PATH=/opt/ros/jazzy/opt/gz_sim_vendor/share/gz:/opt/ros/jazzy/opt/gz_gui_vendor/share/gz:/opt/ros/jazzy/opt/gz_msgs_vendor/share/gz:/opt/ros/jazzy/opt/gz_transport_vendor/share/gz:/opt/ros/jazzy/opt/gz_plugin_vendor/share/gz:/opt/ros/jazzy/opt/sdformat_vendor/share/gz:/opt/ros/jazzy/opt/gz_fuel_tools_vendor/share/gz && "
            f"gz service -s /world/hotel_lobby_world/set_pose --reqtype gz.msgs.Pose --reptype gz.msgs.Boolean --timeout 2000 --req '{req_str}'"
        )
        try:
            res = subprocess.run(["bash", "-c", bash_cmd], capture_output=True, text=True, timeout=3)
            if res.returncode == 0:
                self.get_logger().info(f"[GAZEBO POSE] Da cap nhat '{model_name}' -> ({x:.2f}, {y:.2f}, {z:.2f})")
            else:
                self.get_logger().debug(f"[GAZEBO POSE] set_pose res: {res.stderr.strip() or res.stdout.strip()}")
        except Exception as e:
            self.get_logger().debug(f"[GAZEBO POSE] Exception: {e}")

    def waypoints_callback(self, msg):
        """Dong bo danh sach Waypoints / Endpoints tu Web sang Gazebo va bo dieu huong PID."""
        try:
            data = json.loads(msg.data)
            if not isinstance(data, list):
                return
            self.get_logger().info(f"[DONG BO WAYPOINTS] Nhan {len(data)} diem moc tu Web Admin!")

            new_waypoints = []
            active_models = set()
            for item in data:
                x = float(item.get('x', 0.0))
                y = float(item.get('y', 0.0))
                name = str(item.get('name', 'Waypoint'))
                wp_type = (item.get('type') or 'WAYPOINT').upper()
                wp_id = str(item.get('id', ''))
                new_waypoints.append((x, y, name, wp_type, wp_id))

                # Cap nhat vi tri 3D beacon trong Gazebo thoi gian thuc tren mat san
                model_name = self.get_gazebo_model_name(wp_id, name, wp_type)
                if model_name:
                    active_models.add(model_name)
                    self.sync_gazebo_marker_pose(model_name, x, y, z=0.01)

            # An tat ca cac model marker khong co tren Web (dua xuong z = -10.0m)
            for m in ALL_GAZEBO_MARKERS:
                if m not in active_models:
                    self.sync_gazebo_marker_pose(m, 0.0, 0.0, z=-10.0)

            global WAYPOINTS
            WAYPOINTS = new_waypoints
            self.publish_waypoint_markers()
        except Exception as e:
            self.get_logger().error(f"[DONG BO WAYPOINTS] Loi phan tich json: {e}")

    def publish_all_markers(self):
        self.publish_zone_markers()
        self.publish_waypoint_markers()

    def calculate_safe_path(self, start_x, start_y, target_x, target_y):
        """Sinh chuoi waypoint toi uu ne vat can trong sanh 19.60m x 12.60m bang Roadmap + Shortcut Smoothing."""
        start = (float(start_x), float(start_y))
        goal = (float(target_x), float(target_y))

        obstacles = [
            (9.70, 13.10, 4.00, 8.65, "RECEPTION"),
            (5.60, 7.45, 5.35, 7.15, "PLANT_POT"),
            (12.50, 12.85, 11.00, 12.60, "PART_TOP"),
            (12.60, 12.95, 0.00, 1.45, "PART_BOT"),
            (0.00, 2.30, 8.30, 12.60, "SOFA_TL"),
            (0.00, 4.70, 0.00, 1.60, "SOFA_BL"),
            (15.30, 19.60, 7.60, 10.00, "SOFA_TR"),
            (17.80, 19.60, 4.80, 7.80, "ELEV_EXIT"),
            (17.80, 19.60, 0.00, 3.55, "WC_EAST"),
            (15.30, 18.00, 0.00, 1.90, "WC_SOUTH"),
        ]

        def ccw(A, B, C):
            return (C[1] - A[1]) * (B[0] - A[0]) > (B[1] - A[1]) * (C[0] - A[0])

        def seg_intersect(A, B, C, D):
            return ccw(A, C, D) != ccw(B, C, D) and ccw(A, B, C) != ccw(A, B, D)

        def is_line_clear(p1, p2, ignore_rec=False):
            for minX, maxX, minY, maxY, name in obstacles:
                if ignore_rec and name == "RECEPTION":
                    continue
                tl, tr, bl, br = (minX, maxY), (maxX, maxY), (minX, minY), (maxX, minY)
                if (seg_intersect(p1, p2, tl, tr) or
                    seg_intersect(p1, p2, tr, br) or
                    seg_intersect(p1, p2, br, bl) or
                    seg_intersect(p1, p2, bl, tl)):
                    return False
            return True

        nav_nodes = {
            'W_NORTH':     (7.20,  9.60,  "Hành lang Bắc Tây (Standby)"),
            'W_NORTH_L':   (4.80,  9.60,  "Hành lang Tây Bắc"),
            'W_MID_L':     (4.20,  7.20,  "Khu Sofa Khách Chờ Sảnh"),
            'W_MID_POT_W': (4.60,  5.50,  "Hành lang Tây né Cây cảnh"),
            'W_SOUTH_L':   (4.80,  3.20,  "Hành lang Tây Nam"),
            'W_SOUTH':     (7.60,  2.60,  "Hành lang Nam Tây"),
            'C_NORTH_DOOR':(12.84, 9.80,  "Cửa Thông Sảnh Bắc"),
            'C_SOUTH_DOOR':(12.84, 2.60,  "Hành lang Sảnh Nam"),
            'C_FRONT_DESK':(11.44, 2.80,  "Trước Quầy Lễ Tân"),
            'C_STAFF_DOOR':(11.44, 4.20,  "Cửa Phòng Nội Bộ"),
            'C_STAFF_IN':  (11.44, 6.40,  "Phòng Nội Bộ Quầy Lễ Tân"),
            'E_NORTH':     (15.50, 9.80,  "Hành lang Bắc Đông"),
            'E_MID':       (15.60, 6.50,  "Hành lang Cụm Thang Máy"),
            'E_SOUTH':     (15.50, 2.60,  "Hành lang Nhà Vệ Sinh"),
        }

        nav_edges = [
            ('W_NORTH', 'W_NORTH_L'),
            ('W_NORTH_L', 'W_MID_L'),
            ('W_MID_L', 'W_MID_POT_W'),
            ('W_MID_POT_W', 'W_SOUTH_L'),
            ('W_SOUTH_L', 'W_SOUTH'),
            ('W_NORTH', 'C_NORTH_DOOR'),
            ('W_SOUTH', 'C_FRONT_DESK'),
            ('W_SOUTH', 'C_SOUTH_DOOR'),
            ('C_FRONT_DESK', 'C_SOUTH_DOOR'),
            ('C_FRONT_DESK', 'C_STAFF_DOOR'),
            ('C_STAFF_DOOR', 'C_STAFF_IN'),
            ('C_NORTH_DOOR', 'E_NORTH'),
            ('C_SOUTH_DOOR', 'E_SOUTH'),
            ('E_NORTH', 'E_MID'),
            ('E_MID', 'E_SOUTH'),
        ]

        is_inside_staff = lambda p: 10.04 <= p[0] <= 12.82 and 4.40 <= p[1] <= 8.40
        from_staff = is_inside_staff(start)
        to_staff = is_inside_staff(goal)

        staff_approach = (11.44, 2.80, "Trước Quầy Lễ Tân")
        staff_door = (11.44, 4.20, "Cửa Phòng Nội Bộ")

        def find_raw_path(p_start, p_goal, ignore_rec=False):
            if is_line_clear(p_start, p_goal, ignore_rec):
                return [(p_start[0], p_start[1], "Xuất phát"), (p_goal[0], p_goal[1], "Mục tiêu")]

            node_keys = list(nav_nodes.keys())
            start_edges = []
            goal_edges = []
            for k in node_keys:
                pos = (nav_nodes[k][0], nav_nodes[k][1])
                if is_line_clear(p_start, pos, ignore_rec):
                    start_edges.append((k, math.hypot(p_start[0] - pos[0], p_start[1] - pos[1])))
                if is_line_clear(p_goal, pos, ignore_rec):
                    goal_edges.append((k, math.hypot(p_goal[0] - pos[0], p_goal[1] - pos[1])))

            if not start_edges:
                closest_k = min(node_keys, key=lambda k: math.hypot(p_start[0] - nav_nodes[k][0], p_start[1] - nav_nodes[k][1]))
                start_edges.append((closest_k, math.hypot(p_start[0] - nav_nodes[closest_k][0], p_start[1] - nav_nodes[closest_k][1])))
            if not goal_edges:
                closest_k = min(node_keys, key=lambda k: math.hypot(p_goal[0] - nav_nodes[k][0], p_goal[1] - nav_nodes[k][1]))
                goal_edges.append((closest_k, math.hypot(p_goal[0] - nav_nodes[closest_k][0], p_goal[1] - nav_nodes[closest_k][1])))

            adj = {k: [] for k in node_keys}
            for u, v in nav_edges:
                d = math.hypot(nav_nodes[u][0] - nav_nodes[v][0], nav_nodes[u][1] - nav_nodes[v][1])
                adj[u].append((v, d))
                adj[v].append((u, d))

            adj['START'] = start_edges
            adj['GOAL'] = []
            for ge_node, ge_dist in goal_edges:
                adj[ge_node].append(('GOAL', ge_dist))

            all_n = ['START', 'GOAL'] + node_keys
            dist = {k: float('inf') for k in all_n}
            prev = {k: None for k in all_n}
            dist['START'] = 0.0
            pq = [(0.0, 'START')]

            while pq:
                d, u = heapq.heappop(pq)
                if d > dist[u]:
                    continue
                if u == 'GOAL':
                    break
                for v, weight in adj.get(u, []):
                    if dist[u] + weight < dist[v]:
                        dist[v] = dist[u] + weight
                        prev[v] = u
                        heapq.heappush(pq, (dist[v], v))

            curr = 'GOAL'
            path_keys = []
            while curr:
                path_keys.append(curr)
                curr = prev.get(curr)
            path_keys.reverse()

            if not path_keys or path_keys[0] != 'START':
                return [(p_start[0], p_start[1], "Xuất phát"), (p_goal[0], p_goal[1], "Mục tiêu")]

            raw_pts = []
            for k in path_keys:
                if k == 'START':
                    raw_pts.append((p_start[0], p_start[1], "Xuất phát"))
                elif k == 'GOAL':
                    raw_pts.append((p_goal[0], p_goal[1], "Mục tiêu"))
                else:
                    raw_pts.append(nav_nodes[k])

            # String-pulling smoothing
            if len(raw_pts) <= 2:
                return raw_pts
            smoothed = [raw_pts[0]]
            i = 0
            while i < len(raw_pts) - 1:
                furthest = i + 1
                for j in range(len(raw_pts) - 1, i + 1, -1):
                    if is_line_clear((smoothed[-1][0], smoothed[-1][1]), (raw_pts[j][0], raw_pts[j][1]), ignore_rec):
                        furthest = j
                        break
                smoothed.append(raw_pts[furthest])
                i = furthest

            return smoothed

        if not from_staff and to_staff:
            approach_route = find_raw_path(start, (staff_approach[0], staff_approach[1]), False)
            pts = approach_route + [staff_door, (goal[0], goal[1], f"Mục tiêu ({goal[0]:.2f}, {goal[1]:.2f})")]
        elif from_staff and not to_staff:
            leave_route = find_raw_path((staff_approach[0], staff_approach[1]), goal, False)
            pts = [(start[0], start[1], "Xuất phát"), staff_door, staff_approach] + leave_route[1:]
        elif from_staff and to_staff:
            pts = [(start[0], start[1], "Xuất phát"), (goal[0], goal[1], f"Mục tiêu ({goal[0]:.2f}, {goal[1]:.2f})")]
        else:
            pts = find_raw_path(start, goal, False)

        # Deduplicate
        filtered = [pts[0]]
        for i in range(1, len(pts)):
            prev = filtered[-1]
            cur = pts[i]
            if math.hypot(cur[0] - prev[0], cur[1] - prev[1]) > 0.15:
                filtered.append(cur)

        if math.hypot(filtered[-1][0] - goal[0], filtered[-1][1] - goal[1]) > 0.05:
            filtered.append((goal[0], goal[1], f"Đích đến ({goal[0]:.2f}, {goal[1]:.2f})"))

        return filtered

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
            tx, ty, name = WAYPOINTS[self.target_idx][:3]
            self.get_logger().info(f">> [TUẦN TRA {self.target_idx + 1}/{len(WAYPOINTS)}] Đang hướng tới: {name} (X={tx:.2f}, Y={ty:.2f})")
        else:
            self.get_logger().info(f">> [STANDBY]: Túc trực tại ({self.current_x:.2f}, {self.current_y:.2f})")

    def publish_joint_states(self, linear_vel, angular_vel, dt=0.05):
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

            # Loc bo tia phan xa tu chinh than xe / camera mount cua robot (ban kinh ~0.22m)
            valid = (not math.isnan(r)) and (r > 0.22) and (r <= msg.range_max)
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
            tx, ty, name = WAYPOINTS[self.target_idx][:3]
        
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

        # Kiểm tra vật cản phía trước bằng LiDAR (co deadband chong dao huong giat lac)
        avoidance_offset = 0.0
        if self.min_front_dist < d_safe:
            if now > self.avoidance_locked_until:
                # Chi dao huong khi do chenh lech khoang trong trai/phai vuot qua 0.15m
                if abs(self.min_left_dist - self.min_right_dist) > 0.15:
                    self.avoidance_dir = 1.0 if self.min_left_dist > self.min_right_dist else -1.0
                elif self.avoidance_dir == 0.0:
                    self.avoidance_dir = 1.0 if angle_diff >= 0 else -1.0
                self.avoidance_locked_until = now + 2.0
            obstacle_urgency = max(0.0, min(1.0, (d_safe - self.min_front_dist) / (d_safe - d_stop)))
            avoidance_offset = self.avoidance_dir * (1.10 * obstacle_urgency)
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

        # 5. Áp dụng Giới Hạn Tốc Độ (Speed Zone) - Tốc độ an toàn giúp LiDAR quét nét ổn định
        max_allowed_linear = 0.22
        if active_zone and active_zone.get('type') in ('SPEED_ZONE', 'SLOW_SPEED'):
            zone_limit = float(active_zone.get('speed_limit') or 0.15)
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

