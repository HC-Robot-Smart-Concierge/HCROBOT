import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.database import init_db


@pytest.mark.asyncio
async def test_map_endpoints():
    """Test lấy thông tin bản đồ LiDAR, waypoints và gửi mục tiêu di chuyển qua API /api/v1/map."""
    await init_db()
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # 1. Test get current map
            response = await client.get("/api/v1/map/current")
            assert response.status_code == 200
            data = response.json()
            assert "metadata" in data
            assert data["metadata"]["width"] == 200
            assert data["metadata"]["height"] == 200
            assert "robot_pose" in data
            assert "waypoints" in data
            assert isinstance(data["grid_data"], list)
            assert len(data["grid_data"]) == 40000

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
    finally:
        from app.core.database import engine
        await engine.dispose()
