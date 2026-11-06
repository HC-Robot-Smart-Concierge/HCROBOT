import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.database import init_db
from app.api.v1.endpoints.default_workflows import (
    CORE_WORKFLOWS,
    LOBBY_WAYPOINTS,
    upgrade_legacy_move_step,
)


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
        "ROBOT_STANDBY",
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

                # Tọa độ phải nằm trong sa bàn Sảnh 19.60m x 12.60m và trùng waypoint chuẩn
                target_x = float(params.get("target_x", 0.0))
                target_y = float(params.get("target_y", 0.0))
                assert 0.0 < target_x < 19.60
                assert 0.0 < target_y < 12.60
                wp = LOBBY_WAYPOINTS[target_val]
                assert (target_x, target_y) == (wp["x"], wp["y"]), f"{step['step_id']} lệch waypoint {target_val}"


def test_upgrade_moves_untouched_legacy_targets():
    """Bản lưu cũ còn giữ tọa độ mẫu của sảnh 10m x 6m được chuyển sang waypoint hiện tại."""
    old_return = {
        "step_id": "wf5-step-4",
        "type": "MOVE",
        "title": "4. Robot trở về Trạm Chờ Sofa Sảnh",
        "params": {"target_type": "STANDBY", "target_value": "DOCK_LOBBY",
                   "waypoint_name": "Trạm Sạc Robot Sảnh", "target_x": 3.2, "target_y": 2.8, "speed": 0.4},
    }
    upgraded = upgrade_legacy_move_step(old_return)
    assert upgraded["params"]["target_value"] == "ROBOT_STANDBY"
    assert (upgraded["params"]["target_x"], upgraded["params"]["target_y"]) == (7.2, 9.6)
    assert upgraded["params"]["speed"] == 0.4
    assert upgraded["title"] == old_return["title"]
    assert old_return["params"]["target_x"] == 3.2  # bản gốc không bị sửa tại chỗ

    corner = {"type": "MOVE", "params": {"target_waypoint_id": "wp-reception", "target_x": 0.0, "target_y": 0.0}}
    fixed = upgrade_legacy_move_step(corner)["params"]
    assert fixed["target_waypoint_id"] == "FRONT_DESK"
    assert (fixed["target_x"], fixed["target_y"]) == (11.44, 2.8)


def test_upgrade_keeps_user_edited_targets():
    """Waypoint người dùng đã chỉnh hoặc điểm tự tạo được giữ nguyên."""
    edited = {"type": "MOVE", "params": {"target_value": "FRONT_DESK", "target_x": 11.0, "target_y": 3.1}}
    custom = {"type": "MOVE", "params": {"target_waypoint_id": "wp-mw38j638-nhza", "target_x": 0.0, "target_y": 0.0}}
    current = {"type": "MOVE", "params": {"target_value": "ELEVATOR", "target_x": 15.6, "target_y": 6.96}}
    assert upgrade_legacy_move_step(edited) is None
    assert upgrade_legacy_move_step(custom) is None
    assert upgrade_legacy_move_step(current) is None
    assert upgrade_legacy_move_step({"type": "GREET", "params": {}}) is None


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
