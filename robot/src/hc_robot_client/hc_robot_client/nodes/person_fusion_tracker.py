#!/usr/bin/env python3
"""
ROS 2 Person Fusion Tracker Node — HC-Robot (Raspberry Pi 5)
Tầng Dung Hợp Cảm Biến & Theo Dõi (Sensor Fusion & Tracking Layer):
- Lắng nghe /robot/person_detections (BBox & góc quan sát FOV từ YOLO).
- Lắng nghe /scan (sensor_msgs/msg/LaserScan từ RPLiDAR 360°).
- Chiếu góc [theta_min, theta_max] của từng người lên các tia laser tương ứng.
- Trích xuất cự ly vật lý mét thực tế d (loại bỏ phông nền/tường).
- Vận hành Máy Trạng Thái Cự Ly có trễ (Distance State Machine with Hysteresis):
    FAR (d > 2.5m) <--> APPROACHING (1.5m < d <= 2.5m) <--> NEAR (0.8m < d <= 1.5m) <--> TOO_CLOSE (d <= 0.8m).
- Xuất bản:
    + /robot/person_tracking: Danh sách đối tượng kèm cự ly mét, tọa độ robot frame (X, Y).
    + /robot/guest_events: Phát sự kiện cấp cao (GUEST_APPROACH, GUEST_DEPART, GUEST_TOO_CLOSE).
"""

import json
import math
import os
import sys
import time
from typing import Dict, List, Optional, Tuple

import yaml

try:
    import rclpy
    from rclpy.node import Node
    from std_msgs.msg import String
    from sensor_msgs.msg import LaserScan
except ImportError:
    rclpy = None
    Node = object
    String = None
    LaserScan = None


class DistanceState:
    FAR = "FAR"                  # d > 2.5m: Khách ở xa, tuần tra bình thường
    APPROACHING = "APPROACHING"  # 1.5m < d <= 2.5m: Khách đang tiến lại, giảm tốc độ
    NEAR = "NEAR"                # 0.8m < d <= 1.5m: Khách trong tầm tiếp đón, kích hoạt chào hỏi
    TOO_CLOSE = "TOO_CLOSE"      # d <= 0.8m: Khách quá gần, kích hoạt đệm an toàn


def extract_lidar_distance_for_sector(
    scan_msg,
    theta_min_rad: float,
    theta_max_rad: float,
    percentile: float = 15.0
) -> Optional[float]:
    """
    Trích xuất khoảng cách mét từ LaserScan trong dải góc quét [theta_min_rad, theta_max_rad].
    Lấy phân vị (percentile) thấp để loại trừ tường/vật cản phía sau khách.
    """
    if scan_msg is None or not hasattr(scan_msg, 'ranges') or not scan_msg.ranges:
        return None

    angle_min = scan_msg.angle_min
    angle_max = scan_msg.angle_max
    angle_increment = scan_msg.angle_increment
    range_min = getattr(scan_msg, 'range_min', 0.05)
    range_max = getattr(scan_msg, 'range_max', 12.0)
    ranges = scan_msg.ranges
    num_readings = len(ranges)

    if angle_increment <= 0 or num_readings == 0:
        return None

    # Lấy các tia laser nằm trong dải góc
    valid_distances = []

    for i in range(num_readings):
        beam_angle = angle_min + i * angle_increment
        # Chuẩn hóa góc về [-pi, pi]
        norm_beam_angle = math.atan2(math.sin(beam_angle), math.cos(beam_angle))

        if theta_min_rad <= norm_beam_angle <= theta_max_rad:
            r = ranges[i]
            if not math.isnan(r) and not math.isinf(r) and range_min <= r <= range_max:
                valid_distances.append(r)

    if not valid_distances:
        return None

    # Lọc phân vị thấp (15%) để lấy bề mặt người, loại bỏ hậu cảnh
    valid_distances.sort()
    idx = int(len(valid_distances) * (percentile / 100.0))
    idx = min(idx, len(valid_distances) - 1)
    return round(float(valid_distances[idx]), 3)


class DistanceStateMachine:
    """
    Máy trạng thái cự ly có bộ trễ lọc nhiễu (Hysteresis) và bộ đệm (Debounce).
    """

    def __init__(
        self,
        approach_dist: float = 2.5,
        near_dist: float = 1.5,
        too_close_dist: float = 0.8,
        hysteresis_margin: float = 0.15
    ):
        self.approach_dist = approach_dist
        self.near_dist = near_dist
        self.too_close_dist = too_close_dist
        self.margin = hysteresis_margin
        self.current_state = DistanceState.FAR
        self.pending_state = None
        self.debounce_counter = 0
        self.required_debounce = 2  # Cần 2 frame liên tiếp để chuyển trạng thái

    def update(self, distance_m: Optional[float]) -> str:
        """Cập nhật trạng thái cự ly dựa trên khoảng cách mét thực tế."""
        if distance_m is None:
            return self.current_state

        target_state = self._calculate_target_state(distance_m)

        if target_state == self.current_state:
            self.pending_state = None
            self.debounce_counter = 0
        else:
            if target_state == self.pending_state:
                self.debounce_counter += 1
                if self.debounce_counter >= self.required_debounce:
                    self.current_state = target_state
                    self.pending_state = None
                    self.debounce_counter = 0
            else:
                self.pending_state = target_state
                self.debounce_counter = 1

        return self.current_state

    def _calculate_target_state(self, d: float) -> str:
        """Xác định trạng thái mục tiêu có tính biên trễ (Hysteresis)."""
        curr = self.current_state

        if curr == DistanceState.FAR:
            if d <= self.too_close_dist:
                return DistanceState.TOO_CLOSE
            if d <= self.near_dist:
                return DistanceState.NEAR
            if d <= self.approach_dist:
                return DistanceState.APPROACHING
            return DistanceState.FAR

        elif curr == DistanceState.APPROACHING:
            if d <= self.too_close_dist:
                return DistanceState.TOO_CLOSE
            if d <= self.near_dist:
                return DistanceState.NEAR
            if d > (self.approach_dist + self.margin):
                return DistanceState.FAR
            return DistanceState.APPROACHING

        elif curr == DistanceState.NEAR:
            if d <= self.too_close_dist:
                return DistanceState.TOO_CLOSE
            if d > (self.near_dist + self.margin):
                return DistanceState.APPROACHING
            return DistanceState.NEAR

        elif curr == DistanceState.TOO_CLOSE:
            if d > (self.too_close_dist + self.margin):
                return DistanceState.NEAR
            return DistanceState.TOO_CLOSE

        return DistanceState.FAR


class PersonFusionTrackerNode(Node if Node is not object else object):
    """
    ROS 2 Node dung hợp LaserScan và Camera Detection để định vị và theo dõi người.
    """

    def __init__(self):
        if Node is not object:
            super().__init__('person_fusion_tracker')

        self.config_path = self._get_config_path()
        self.config = self._load_config()

        # Cấu hình Fusion
        fusion_cfg = self.config.get('fusion', {})
        self.approach_dist = float(fusion_cfg.get('approach_distance_m', 2.5))
        self.near_dist = float(fusion_cfg.get('near_distance_m', 1.5))
        self.too_close_dist = float(fusion_cfg.get('too_close_distance_m', 0.8))
        self.margin = float(fusion_cfg.get('hysteresis_margin_m', 0.15))
        self.corridor_half_w = float(fusion_cfg.get('corridor_half_width_m', 0.35))
        self.leave_timeout_s = float(fusion_cfg.get('guest_leave_timeout_s', 2.0))

        # Cấu hình Topics
        topics_cfg = self.config.get('topics', {})
        self.detections_sub_topic = topics_cfg.get('person_detections', '/robot/person_detections')
        self.scan_sub_topic = topics_cfg.get('lidar_scan', '/scan')
        self.tracking_pub_topic = topics_cfg.get('person_tracking', '/robot/person_tracking')
        self.events_pub_topic = topics_cfg.get('guest_events', '/robot/guest_events')

        # Dữ liệu nội bộ
        self.latest_scan = None
        self.last_person_seen_time = 0.0
        self.guest_present = False
        self.state_machines: Dict[int, DistanceStateMachine] = {}

        # ROS 2 Subscribers & Publishers
        if Node is not object:
            self.detections_sub = self.create_subscription(
                String, self.detections_sub_topic, self.on_detections_received, 10
            )
            self.scan_sub = self.create_subscription(
                LaserScan, self.scan_sub_topic, self.on_scan_received, 10
            )
            self.tracking_pub = self.create_publisher(String, self.tracking_pub_topic, 10)
            self.events_pub = self.create_publisher(String, self.events_pub_topic, 10)

            # Timer kiểm tra timeout rời đi (2.0s leave timeout)
            self.check_timer = self.create_timer(0.2, self.check_leave_timeout)
            self._log_info(
                f"PersonFusionTrackerNode đã khởi chạy. Lắng nghe '{self.detections_sub_topic}' + '{self.scan_sub_topic}'"
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
        """Lưu trữ LaserScan mới nhất từ RPLiDAR."""
        self.latest_scan = msg

    def on_detections_received(self, msg: String):
        """Callback xử lý tin nhắn từ YOLO Detection Node."""
        try:
            payload = json.loads(msg.data)
        except Exception as e:
            self._log_warn(f"Lỗi parse JSON detections: {e}")
            return

        now = time.time()
        persons = payload.get('persons', [])
        mode = payload.get('mode', 'YOLO')

        # Nếu Mode là FAILED -> không thực hiện tracking giả
        if mode == "FAILED":
            self._log_warn("Vision Mode = FAILED. Tạm dừng Person Tracking.")
            return

        tracked_persons = []
        highest_priority_event = None

        if persons:
            self.last_person_seen_time = now

        for p in persons:
            p_id = p.get('id', 1)
            bearing_deg = float(p.get('bearing_deg', 0.0))
            fov_sector_deg = p.get('fov_sector_deg', [bearing_deg - 5.0, bearing_deg + 5.0])

            # Chuyển đổi độ sang radian
            theta_min_rad = math.radians(fov_sector_deg[0])
            theta_max_rad = math.radians(fov_sector_deg[1])
            bearing_rad = math.radians(bearing_deg)

            # Dung hợp với LaserScan để lấy cự ly mét
            dist_m = extract_lidar_distance_for_sector(
                self.latest_scan, theta_min_rad, theta_max_rad
            )

            dist_source = "lidar_fused" if dist_m is not None else "unavailable"

            # Cập nhật Distance State Machine
            if p_id not in self.state_machines:
                self.state_machines[p_id] = DistanceStateMachine(
                    approach_dist=self.approach_dist,
                    near_dist=self.near_dist,
                    too_close_dist=self.too_close_dist,
                    hysteresis_margin=self.margin
                )
            
            sm = self.state_machines[p_id]
            old_state = sm.current_state
            new_state = sm.update(dist_m)

            # Tính tọa độ trong hệ quy chiếu Robot (X hướng thẳng, Y hướng trái)
            pos_x = None
            pos_y = None
            in_corridor = False
            if dist_m is not None:
                pos_x = round(dist_m * math.cos(bearing_rad), 3)
                pos_y = round(dist_m * math.sin(bearing_rad), 3)
                in_corridor = abs(pos_y) <= self.corridor_half_w

            tracked_persons.append({
                "id": p_id,
                "confidence": p.get('confidence', 0.0),
                "bearing_deg": bearing_deg,
                "distance_m": dist_m,
                "distance_source": dist_source,
                "distance_state": new_state,
                "position_robot_frame": {"x": pos_x, "y": pos_y} if dist_m else None,
                "in_corridor": in_corridor
            })

            # Phát hiện sự kiện chuyển trạng thái
            if new_state == DistanceState.NEAR and old_state != DistanceState.NEAR:
                highest_priority_event = {
                    "event": "GUEST_APPROACH",
                    "distance_state": DistanceState.NEAR,
                    "distance_m": dist_m,
                    "bearing_deg": bearing_deg
                }
            elif new_state == DistanceState.TOO_CLOSE and old_state != DistanceState.TOO_CLOSE:
                highest_priority_event = {
                    "event": "GUEST_TOO_CLOSE",
                    "distance_state": DistanceState.TOO_CLOSE,
                    "distance_m": dist_m,
                    "bearing_deg": bearing_deg
                }

        # Xuất bản /robot/person_tracking
        tracking_payload = {
            "timestamp": now,
            "tracked_count": len(tracked_persons),
            "tracked_persons": tracked_persons
        }
        if Node is not object and hasattr(self, 'tracking_pub'):
            t_msg = String()
            t_msg.data = json.dumps(tracking_payload)
            self.tracking_pub.publish(t_msg)

        # Xuất bản sự kiện nếu có
        if highest_priority_event:
            self.guest_present = True
            self._publish_event(highest_priority_event)

    def check_leave_timeout(self):
        """Kiểm tra thời gian không thấy người để phát sự kiện GUEST_DEPART sau 2.0s."""
        if not self.guest_present:
            return

        now = time.time()
        if (now - self.last_person_seen_time) >= self.leave_timeout_s:
            self.guest_present = False
            self.state_machines.clear()
            self._log_info("Không phát hiện người trong > 2.0 giây. Phát GUEST_DEPART.")
            self._publish_event({
                "event": "GUEST_DEPART",
                "reason": "TIMEOUT_2_SECONDS",
                "timestamp": now
            })

    def _publish_event(self, event_data: dict):
        if Node is not object and hasattr(self, 'events_pub'):
            e_msg = String()
            e_msg.data = json.dumps(event_data)
            self.events_pub.publish(e_msg)


def main(args=None):
    if rclpy is None:
        print("rclpy chưa được cài đặt trong môi trường này.")
        return

    rclpy.init(args=args)
    node = PersonFusionTrackerNode()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        node.destroy_node()
        rclpy.shutdown()


if __name__ == '__main__':
    main()
