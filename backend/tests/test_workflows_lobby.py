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
    """Kiểm tra toàn bộ workflows mặc định đều diễn ra tại Sảnh Ground Floor."""
    assert len(CORE_WORKFLOWS) == 9

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


FLOW_END = "END"


def _next_index(steps, index, outcome=None):
    """Mirror of resolveNextStepIndex in frontend/src/utils/workflowFlow.js."""
    step = steps[index]
    params = step.get("params", {})

    def follow(target):
        if target in (None, ""):
            return index + 1 if index + 1 < len(steps) else -1
        if target == FLOW_END:
            return -1
        return next((i for i, s in enumerate(steps) if s["step_id"] == target), -1)

    if step["type"] != "CHOICE":
        return follow(params.get("next_step_id"))
    kind, option_id = outcome if outcome else ("DONE", None)
    if kind == "CHOSEN":
        option = next((o for o in params.get("options", []) if o.get("id") == option_id), None)
        if option:
            return follow(option.get("next_step_id"))
    cancel = params.get("cancel_next_step_id", FLOW_END)
    if kind == "CANCEL":
        return follow(cancel)
    return follow(params.get("timeout_next_step_id", cancel))


def _walk(steps, choices):
    """Run a workflow, answering CHOICE steps from choices (step_id -> outcome)."""
    path, index = [], 0
    while index >= 0 and len(path) < 50:
        step = steps[index]
        path.append(step["step_id"])
        index = _next_index(steps, index, choices.get(step["step_id"]))
    return path


def test_core_workflow_links_point_at_existing_steps():
    for wf in CORE_WORKFLOWS:
        ids = {s["step_id"] for s in wf["steps"]}
        for step in wf["steps"]:
            params = step.get("params", {})
            targets = [params.get("next_step_id")]
            if step["type"] == "CHOICE":
                assert params.get("options"), f"{step['step_id']} cần ít nhất một lựa chọn"
                targets += [params.get("timeout_next_step_id"), params.get("cancel_next_step_id")]
                targets += [o.get("next_step_id") for o in params["options"]]
            for target in targets:
                assert target in (None, "", FLOW_END) or target in ids, f"{step['step_id']} trỏ tới {target}"


def test_dinner_demo_branches_rejoin_and_return_once():
    wf = next(w for w in CORE_WORKFLOWS if w["id"] == "wf-09-dinner-guide")
    steps = wf["steps"]
    done = {"wf9-anything-else": ("CHOSEN", "done")}

    via_map = _walk(steps, {"wf9-route-choice": ("CHOSEN", "map"), **done})
    assert "wf9-show-map" in via_map
    assert "wf9-guide-move" not in via_map  # robot đứng tại chỗ khi khách xem bản đồ

    via_guide = _walk(steps, {"wf9-route-choice": ("CHOSEN", "guide"), **done})
    assert "wf9-show-map" not in via_guide
    assert via_guide.index("wf9-guide-move") < via_guide.index("wf9-anything-else")

    no_answer = _walk(steps, {})
    cancelled = _walk(steps, {"wf9-route-choice": ("CANCEL", None), "wf9-anything-else": ("CANCEL", None)})
    for path in (via_map, via_guide, no_answer, cancelled):
        assert path[0] == "wf9-move-entrance"
        assert path[-3:] == ["wf9-feedback", "wf9-goodbye", "wf9-return"]
        moves = [sid for sid in path if next(s for s in steps if s["step_id"] == sid)["type"] == "MOVE"]
        assert moves.count("wf9-return") == 1

    ask_more = _walk(steps, {"wf9-route-choice": ("CHOSEN", "map")})
    assert ask_more.count("wf9-anything-else") == 1  # hết giờ ở bước hỏi thêm thì sang đánh giá
    looped = _walk(steps, {"wf9-route-choice": ("CHOSEN", "map"), "wf9-anything-else": ("CHOSEN", "more")})
    assert "wf9-free-talk" in looped and looped.count("wf9-anything-else") > 1


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
