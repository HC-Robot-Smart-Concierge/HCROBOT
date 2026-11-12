import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from httpx import AsyncClient, ASGITransport, Response
from app.main import app
from app.core.database import init_db


@pytest.mark.asyncio
async def test_camera_health_offline():
    await init_db()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        with patch("app.api.v1.endpoints.operations.robot_control.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.get.side_effect = Exception("Connection refused")
            mock_client.__aenter__.return_value = mock_client
            mock_client.__aexit__.return_value = None
            mock_client_cls.return_value = mock_client

            res = await ac.get("/api/v1/operations/robot/camera/health?target_ip=127.0.0.1&port=9999")
            assert res.status_code == 200
            data = res.json()
            assert data["online"] is False
            assert "error" in data


@pytest.mark.asyncio
async def test_camera_health_online():
    await init_db()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        with patch("app.api.v1.endpoints.operations.robot_control.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_resp = MagicMock()
            mock_resp.status_code = 200
            mock_resp.json.return_value = {"status": "ok", "fps": 30}
            mock_client.get.return_value = mock_resp
            mock_client.__aenter__.return_value = mock_client
            mock_client.__aexit__.return_value = None
            mock_client_cls.return_value = mock_client

            res = await ac.get("/api/v1/operations/robot/camera/health?target_ip=100.99.72.51&port=8554")
            assert res.status_code == 200
            data = res.json()
            assert data["online"] is True
            assert data["details"]["status"] == "ok"


@pytest.mark.asyncio
async def test_camera_stream_endpoint():
    await init_db()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/api/v1/operations/robot/camera/stream?target_ip=127.0.0.1&port=9999")
        assert res.status_code == 200
        assert "multipart/x-mixed-replace" in res.headers["content-type"]
