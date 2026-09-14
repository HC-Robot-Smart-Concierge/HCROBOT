"""
Unit tests for Perception, Sensor Fusion, and Safety Controller modules.
Tests cover:
1. Camera FOV & bearing angle calculation (REP-103 convention)
2. LiDAR ray projection & percentile distance extraction
3. Distance State Machine with Hysteresis & Debouncing
4. Safety Controller collision corridor clearance checks
5. Explicit VisionMode state handling
"""

import math
import sys
import os
import pytest

# Thêm đường dẫn package vào sys.path để import trực tiếp
CURR_DIR = os.path.dirname(os.path.abspath(__file__))
CLIENT_PKG_PATH = os.path.abspath(os.path.join(CURR_DIR, "../src/hc_robot_client"))
if CLIENT_PKG_PATH not in sys.path:
    sys.path.insert(0, CLIENT_PKG_PATH)

from hc_robot_client.nodes.person_detection_node import (
    compute_bearing_and_fov,
    VisionMode
)
from hc_robot_client.nodes.person_fusion_tracker import (
    extract_lidar_distance_for_sector,
    DistanceStateMachine,
    DistanceState
)
from hc_robot_client.nodes.safety_controller_node import (
    check_lidar_corridor_clearance
)


class MockLaserScan:
    """Mock LaserScan object mimicking sensor_msgs/msg/LaserScan."""

    def __init__(self, ranges, angle_min=-math.pi, angle_max=math.pi, range_min=0.05, range_max=12.0):
        self.ranges = ranges
        self.angle_min = angle_min
        self.angle_max = angle_max
        self.range_min = range_min
        self.range_max = range_max
        num_rays = len(ranges)
        self.angle_increment = (angle_max - angle_min) / max(1, num_rays)


class TestCameraPerceptionMath:
    """Kiểm tra toán học tính góc lệch tâm và góc mở FOV từ BBox."""

    def test_person_at_camera_center(self):
        # Frame 640x480, người ở chính giữa (x=270, width=100 -> center=320)
        bbox = {"x": 270, "y": 100, "width": 100, "height": 300}
        bearing_deg, sector = compute_bearing_and_fov(bbox, frame_width=640, hfov_deg=70.0)

        assert abs(bearing_deg) < 0.1  # Gần như 0 độ
        assert sector[0] < 0.0 < sector[1]  # Bao trùm qua tâm
        assert abs(sector[0] + sector[1]) < 0.5  # Đối xứng qua tâm

    def test_person_on_right_side(self):
        # BBox lệch về bên phải ảnh (x > 320 -> norm > 0 -> bearing < 0 trong REP-103)
        bbox = {"x": 480, "y": 100, "width": 100, "height": 300}
        bearing_deg, sector = compute_bearing_and_fov(bbox, frame_width=640, hfov_deg=70.0)

        assert bearing_deg < 0.0  # Bên phải là góc âm
        assert sector[0] <= sector[1]
        assert sector[1] < 0.0  # Toàn bộ BBox nằm bên phải trục giữa

    def test_person_on_left_side(self):
        # BBox lệch về bên trái ảnh (x < 320 -> norm < 0 -> bearing > 0 trong REP-103)
        bbox = {"x": 60, "y": 100, "width": 100, "height": 300}
        bearing_deg, sector = compute_bearing_and_fov(bbox, frame_width=640, hfov_deg=70.0)

        assert bearing_deg > 0.0  # Bên trái là góc dương
        assert sector[0] <= sector[1]
        assert sector[0] > 0.0  # Toàn bộ BBox nằm bên trái trục giữa

    def test_invalid_frame_width(self):
        bbox = {"x": 0, "y": 0, "width": 10, "height": 10}
        bearing_deg, sector = compute_bearing_and_fov(bbox, frame_width=0, hfov_deg=70.0)
        assert bearing_deg == 0.0
        assert sector == [0.0, 0.0]


class TestLiDARProjectionAndDistanceExtraction:
    """Kiểm tra trích xuất cự ly mét từ LaserScan kết hợp góc nhìn camera."""

    def test_extract_distance_filters_background_wall(self):
        # Tạo 360 tia laser (-pi đến +pi, mỗi tia 1 độ)
        # Tại góc thẳng phía trước (khoảng -10 độ đến +10 độ), có người ở cự ly 1.25m,
        # và một số tia lọt ra bức tường phía sau ở cự ly 4.5m.
        num_rays = 360
        ranges = [5.0] * num_rays

        # Tâm phía trước là index 180 (angle = 0.0 rad)
        # Mô phỏng người đứng ở index 175 đến 185
        for idx in range(175, 185):
            ranges[idx] = 1.25
        # 2 tia bị lọt ra bức tường phía sau (4.5m)
        ranges[176] = 4.5
        ranges[184] = 4.5

        scan = MockLaserScan(ranges)

        # Góc quét của người là [-0.2 rad, +0.2 rad] (~ -11 độ đến +11 độ)
        extracted_dist = extract_lidar_distance_for_sector(
            scan, theta_min_rad=-0.2, theta_max_rad=0.2, percentile=15.0
        )

        assert extracted_dist is not None
        # Phải bắt trúng người (1.25m), không bị bức tường 4.5m làm sai lệch
        assert abs(extracted_dist - 1.25) < 0.05

    def test_extract_distance_no_scan(self):
        dist = extract_lidar_distance_for_sector(None, -0.1, 0.1)
        assert dist is None

    def test_extract_distance_out_of_range(self):
        # Toàn bộ tia là inf hoặc ngoài range
        scan = MockLaserScan([float('inf')] * 360)
        dist = extract_lidar_distance_for_sector(scan, -0.1, 0.1)
        assert dist is None


class TestDistanceStateMachineWithHysteresis:
    """Kiểm tra máy trạng thái cự ly 4 cấp, bộ đệm debounce và biên trễ chống chớp tắt."""

    def test_state_transitions_closer(self):
        sm = DistanceStateMachine(
            approach_dist=2.5,
            near_dist=1.5,
            too_close_dist=0.8,
            hysteresis_margin=0.15
        )
        assert sm.current_state == DistanceState.FAR

        # Cự ly 2.0m (APPROACHING) - cần 2 frame debounce
        sm.update(2.0)
        assert sm.current_state == DistanceState.FAR  # Frame 1: pending
        sm.update(2.0)
        assert sm.current_state == DistanceState.APPROACHING  # Frame 2: confirm

        # Cự ly 1.2m (NEAR) - cần 2 frame debounce
        sm.update(1.2)
        sm.update(1.2)
        assert sm.current_state == DistanceState.NEAR

        # Cự ly 0.6m (TOO_CLOSE)
        sm.update(0.6)
        sm.update(0.6)
        assert sm.current_state == DistanceState.TOO_CLOSE

    def test_hysteresis_prevents_flickering(self):
        sm = DistanceStateMachine(
            approach_dist=2.5,
            near_dist=1.5,
            too_close_dist=0.8,
            hysteresis_margin=0.15
        )
        # Đưa vào NEAR (1.2m)
        sm.update(1.2)
        sm.update(1.2)
        assert sm.current_state == DistanceState.NEAR

        # Khách hơi dịch lùi ra 1.55m (vẫn < near_dist + margin = 1.5 + 0.15 = 1.65m)
        # Máy trạng thái KHÔNG được vội vã nhảy về APPROACHING!
        sm.update(1.55)
        sm.update(1.55)
        assert sm.current_state == DistanceState.NEAR

        # Khi lùi hẳn ra 1.70m (> 1.65m) -> Chuyển sang APPROACHING
        sm.update(1.70)
        sm.update(1.70)
        assert sm.current_state == DistanceState.APPROACHING


class TestSafetyCorridorCheck:
    """Kiểm tra trọng tài an toàn cục bộ (Local Safety Corridor Clearance)."""

    def test_emergency_stop_when_obstacle_too_close(self):
        # Tạo scan có vật cản ở ngay trước mũi xe (khoảng cách 0.35m <= 0.50m)
        ranges = [3.0] * 360
        # Tâm phía trước là index 180 (angle = 0 rad)
        ranges[180] = 0.35

        scan = MockLaserScan(ranges)
        status, dist, reason = check_lidar_corridor_clearance(
            scan, front_cone_rad=0.61, emergency_stop_m=0.50, warning_m=0.80
        )

        assert status == "EMERGENCY_STOP"
        assert dist == 0.35
        assert "OBSTACLE_FRONT" in reason

    def test_slowdown_in_warning_zone(self):
        ranges = [3.0] * 360
        ranges[180] = 0.65  # Giữa 0.50m và 0.80m

        scan = MockLaserScan(ranges)
        status, dist, reason = check_lidar_corridor_clearance(
            scan, front_cone_rad=0.61, emergency_stop_m=0.50, warning_m=0.80
        )

        assert status == "SLOWDOWN"
        assert dist == 0.65

    def test_safe_when_corridor_is_clear(self):
        ranges = [2.5] * 360
        scan = MockLaserScan(ranges)
        status, dist, reason = check_lidar_corridor_clearance(
            scan, front_cone_rad=0.61, emergency_stop_m=0.50, warning_m=0.80
        )

        assert status == "SAFE"
        assert dist >= 2.0
        assert reason == "CLEAR"


class TestExplicitVisionMode:
    """Kiểm tra các giá trị của máy trạng thái thị giác tường minh."""

    def test_vision_modes(self):
        assert VisionMode.YOLO.value == "YOLO"
        assert VisionMode.DEGRADED.value == "DEGRADED"
        assert VisionMode.FAILED.value == "FAILED"
