import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.database import init_db


@pytest.mark.asyncio
async def test_map_endpoints():
    """Test lấy thông tin bản đồ LiDAR, waypoints và gửi mục tiêu di chuyển qua API /api/v1/map."""
    await init_db()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Test get current map
        response = await client.get("/api/v1/map/current")
        assert response.status_code == 200
        data = response.json()
        assert "metadata" in data
        assert data["metadata"]["width"] > 0
        assert data["metadata"]["height"] > 0
        assert "robot_pose" in data
        assert "waypoints" in data
        assert isinstance(data["grid_data"], list)
        assert len(data["grid_data"]) == data["metadata"]["width"] * data["metadata"]["height"]

        # 2. Test get waypoints
        response = await client.get("/api/v1/map/waypoints")
        assert response.status_code == 200
        waypoints = response.json()
        assert isinstance(waypoints, list)

        # 3. Test navigate to target
        payload = {
            "target_x": 3.5,
            "target_y": -1.2,
            "target_yaw": 90.0,
        }
        response = await client.post("/api/v1/map/navigate", json=payload)
        assert response.status_code == 200
        res_data = response.json()
        assert res_data["status"] == "SUCCESS"
        assert res_data["target_x"] == 3.5
        assert res_data["target_y"] == -1.2


@pytest.mark.asyncio
async def test_map_local_storage_and_saved_maps():
    """Test lưu bản đồ vào file máy tính và đọc danh sách qua API /api/v1/map/list_saved_maps (không qua CSDL)."""
    await init_db()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Save Map to local storage file
        save_res = await client.post("/api/v1/map/save_map?map_id=test_local_admin_map&name=Test_Local_Admin_Map&floor=Tang_1")
        assert save_res.status_code == 200
        save_data = save_res.json()
        assert save_data["status"] == "SUCCESS"
        assert save_data["map_id"] == "test_local_admin_map"

        # 2. Get list of saved maps on disk
        list_res = await client.get("/api/v1/map/list_saved_maps")
        assert list_res.status_code == 200
        list_data = list_res.json()
        assert list_data["status"] == "SUCCESS"
        assert isinstance(list_data["maps"], list)
        assert any(m["map_id"] == "test_local_admin_map" or m["name"] == "test_local_admin_map" for m in list_data["maps"])

        # 3. Delete saved map from disk
        del_res = await client.delete("/api/v1/map/saved/test_local_admin_map")
        assert del_res.status_code == 200
        del_data = del_res.json()
        assert del_data["status"] == "SUCCESS"


@pytest.mark.asyncio
async def test_download_map_file():
    """Test API tải file bản đồ SLAM (ZIP package và YAML)."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Download zip for existing map
        res = await client.get("/api/v1/map/download/map_2026_10_15_8373?format=zip")
        assert res.status_code == 200
        assert "application/zip" in res.headers["content-type"]
        assert "attachment" in res.headers["content-disposition"]
        assert len(res.content) > 0

        # 2. Download yaml directly
        res_yaml = await client.get("/api/v1/map/download/map_2026_10_15_8373?format=yaml")
        assert res_yaml.status_code == 200
        assert "yaml" in res_yaml.headers["content-type"] or "text" in res_yaml.headers["content-type"]


@pytest.mark.asyncio
async def test_hotel_zone_rules_and_navigation_rejection():
    """Test các ràng buộc an toàn của Hotel Zones: cấm vào (KEEP_OUT) và cấm dừng (NO_STOP)."""
    await init_db()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Đảm bảo danh sách Vùng Chức Năng (Zones) trả về đầy đủ
        zones_res = await client.get("/api/v1/map/zones")
        assert zones_res.status_code == 200
        zones = zones_res.json()
        assert len(zones) >= 3
        zone_types = [z["type"] for z in zones]
        assert "KEEP_OUT" in zone_types
        assert "SPEED_ZONE" in zone_types
        assert "NO_STOP" in zone_types

        # 2. Test từ chối điều hướng vào vùng cấm (KEEP_OUT: x=8.8, y=1.5)
        nav_keepout = await client.post(
            "/api/v1/map/navigate",
            json={"target_x": 8.8, "target_y": 1.5, "target_yaw": 0.0},
        )
        assert nav_keepout.status_code == 200
        keepout_data = nav_keepout.json()
        assert keepout_data["status"] == "REJECTED"
        assert "Khu vực cấm vào" in keepout_data["message"]

        # 3. Test từ chối điều hướng kết thúc tại vùng cấm dừng (NO_STOP: x=4.4, y=2.85)
        nav_nostop = await client.post(
            "/api/v1/map/navigate",
            json={"target_x": 4.4, "target_y": 2.85, "target_yaw": 0.0},
        )
        assert nav_nostop.status_code == 200
        nostop_data = nav_nostop.json()
        assert nostop_data["status"] == "REJECTED"
        assert "Khu vực cấm dừng" in nostop_data["message"]

        # 4. Test từ chối tạo waypoint trong vùng KEEP_OUT
        wp_keepout = await client.post(
            "/api/v1/map/waypoints",
            json={
                "id": "wp_test_invalid_keepout",
                "name": "Điểm Test Cấm",
                "type": "NORMAL",
                "x": 8.8,
                "y": 1.5,
                "yaw": 0.0,
                "floor": "Sảnh Tầng 1",
            },
        )
        assert wp_keepout.status_code == 400
        assert "Khu vực cấm vào" in wp_keepout.json()["detail"]

        # 5. Test từ chối tạo PARKING_SPOT trong vùng NO_STOP
        wp_nostop = await client.post(
            "/api/v1/map/waypoints",
            json={
                "id": "wp_test_invalid_nostop",
                "name": "Bãi đỗ cấm",
                "type": "PARKING_SPOT",
                "x": 4.4,
                "y": 2.85,
                "yaw": 0.0,
                "floor": "Sảnh Tầng 1",
            },
        )
        assert wp_nostop.status_code == 400
        assert "Khu vực cấm dừng" in wp_nostop.json()["detail"]

