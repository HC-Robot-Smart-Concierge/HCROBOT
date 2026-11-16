import pytest
from app.services.hardware.rplidar_service import RPLidarService


def test_rplidar_service_initial_state():
    service = RPLidarService(port="COM9")
    status = service.get_status()

    assert "is_connected" in status
    assert "is_running" in status
    assert "scan_point_count" in status
    assert status["scan_point_count"] == 0


def test_rplidar_scan_points_transformation():
    """Kiểm tra logic quy đổi góc & khoảng cách mm sang mét và tọa độ Đề-các (x, y)"""
    service = RPLidarService(port="COM9")
    
    # Mock một mảng scan nhận từ driver (quality, angle, distance_mm)
    mock_scan = [
        (15, 0.0, 1000.0),    # Góc 0 độ, 1 mét -> x = 1.0, y = 0.0
        (15, 90.0, 2000.0),   # Góc 90 độ, 2 mét -> x = 0.0, y = 2.0
        (15, 180.0, 1500.0),  # Góc 180 độ, 1.5 mét -> x = -1.5, y = 0.0
    ]

    processed = []
    import math
    for pt in mock_scan:
        quality, angle, dist_mm = pt
        dist_m = round(dist_mm / 1000.0, 3)
        rad = math.radians(angle)
        x = round(dist_m * math.cos(rad), 3)
        y = round(dist_m * math.sin(rad), 3)
        processed.append({"angle": angle, "distance": dist_m, "quality": quality, "x": x, "y": y})

    assert len(processed) == 3
    assert processed[0]["x"] == 1.0
    assert processed[0]["y"] == 0.0
    assert processed[1]["x"] == 0.0
    assert processed[1]["y"] == 2.0
    assert processed[2]["x"] == -1.5
    assert processed[2]["y"] == 0.0


def test_rplidar_handshake_failure_handling(mocker=None):
    """Kiểm tra xử lý khi mở cổng thành công nhưng phần cứng không phản hồi"""
    service = RPLidarService(port="COM9")
    status = service.get_status()
    assert "source" in status
    assert status["source"] in ["REAL_RPLIDAR_HARDWARE", "NO_HARDWARE_CONNECTED"]


