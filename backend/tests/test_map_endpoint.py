import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_get_current_map():
    """Test lấy thông tin bản đồ LiDAR Occupancy Grid hiện tại qua API /api/v1/map/current"""
    response = client.get("/api/v1/map/current")
    assert response.status_code == 200
    data = response.json()
    assert "metadata" in data
    assert data["metadata"]["width"] == 200
    assert data["metadata"]["height"] == 200
    assert "robot_pose" in data
    assert "waypoints" in data
    assert isinstance(data["grid_data"], list)
    assert len(data["grid_data"]) == 40000


def test_get_waypoints():
    """Test lấy danh sách các vị trí waypoint qua API /api/v1/map/waypoints"""
    response = client.get("/api/v1/map/waypoints")
    assert response.status_code == 200
    waypoints = response.json()
    assert isinstance(waypoints, list)


def test_navigate_to_target():
    """Test gửi mục tiêu di chuyển qua API POST /api/v1/map/navigate"""
    payload = {
        "target_x": 3.5,
        "target_y": -1.2,
        "target_yaw": 90.0
    }
    response = client.post("/api/v1/map/navigate", json=payload)
    assert response.status_code == 200
    res_data = response.json()
    assert res_data["status"] == "SUCCESS"
    assert res_data["target_x"] == 3.5
    assert res_data["target_y"] == -1.2
