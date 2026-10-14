import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.database import init_db
from app.api.v1.endpoints.default_workflows import CORE_WORKFLOWS


@pytest.mark.asyncio
async def test_lobby_workflows_definition():
    """Kiểm tra toàn bộ 8 workflows mặc định đều diễn ra tại Sảnh Ground Floor."""
    assert len(CORE_WORKFLOWS) == 8

    # Danh sách các khu vực hợp lệ tại Sảnh
    valid_lobby_locations = {
        "MAIN_ENTRANCE",
        "FRONT_DESK",
        "ELEVATOR",
        "RESTROOMS",
        "DOCK_LOBBY",
        "LOBBY_LOUNGE",
        "CENTRAL_LOBBY",
        "ZONE_LOBBY",
    }

    for wf in CORE_WORKFLOWS:
        assert "steps" in wf
        assert len(wf["steps"]) >= 2

        for step in wf["steps"]:
            if step["type"] == "MOVE":
                params = step.get("params", {})
                target_val = params.get("target_value")
                assert target_val in valid_lobby_locations

                # Tọa độ X và Y phải nằm trong sa bàn Sảnh Ground Floor (10m x 6m)
                target_x = float(params.get("target_x", 0.0))
                target_y = float(params.get("target_y", 0.0))
                assert 0.0 <= target_x <= 10.0
                assert 0.0 <= target_y <= 6.0


@pytest.mark.asyncio
async def test_lobby_workflows_api_endpoints():
    """Kiểm tra API /api/v1/workflows trả về đầy đủ 8 kịch bản sảnh."""
    await init_db()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/v1/workflows")
        assert res.status_code == 200
        workflows = res.json()
        assert isinstance(workflows, list)
        assert len(workflows) >= 8

        # Kiểm tra workflow wf-01 đón tiếp tại Cửa Chính Sảnh
        wf1 = next((w for w in workflows if w["id"] == "wf-01-welcome"), None)
        assert wf1 is not None
        assert any(s["type"] == "MOVE" and s.get("params", {}).get("target_value") == "MAIN_ENTRANCE" for s in wf1["steps"])
