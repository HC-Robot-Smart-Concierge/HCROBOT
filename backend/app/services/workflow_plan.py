"""Validate a physical execution snapshot before reserving a robot."""
import math
from app.schemas.workflow import WorkflowExecutionConfig
from app.services.workflow_routes import resolve_route_steps

ERROR_ACTIONS = {"STOP", "CONTINUE", "ERROR_BRANCH"}
CHARGER_TYPES = {"charger", "dock"}


def _is_int(value, low, high):
    return type(value) is int and low <= value <= high


def _check_error_policy(step, ids):
    policy = (step.get("params") or {}).get("on_error")
    if policy is None:
        return
    bad = ValueError(f"Cài đặt khi lỗi của bước {step.get('title') or step.get('step_id')} không hợp lệ.")
    if not isinstance(policy, dict):
        raise bad
    if not _is_int(policy.get("retry_count", 0), 0, 5) or not _is_int(policy.get("retry_wait_sec", 5), 1, 60):
        raise bad
    action = policy.get("action", "STOP")
    if action not in ERROR_ACTIONS:
        raise bad
    if action == "ERROR_BRANCH" and policy.get("next_step_id") not in ("END", *ids):
        raise ValueError("Nhánh trỏ tới bước không tồn tại.")
    params = step.get("params") or {}
    own = {step.get("step_id"), params.get("source_route_step_id")}
    if action == "ERROR_BRANCH" and policy.get("next_step_id") in own:
        # Would resend goals back-to-back with no wait; retries are the bounded way to repeat.
        raise ValueError("Nhánh lỗi không được quay lại chính bước bị lỗi; dùng Thử lại.")


def _is_charger_move(step):
    params = step.get("params") or {}
    return step.get("type") == "MOVE" and params.get("target_type") == "CHARGER" and params.get("target_x") is None


async def _fill_charger_targets(steps, map_id, repo):
    from app.repositories.map_repository import MapRepository
    endpoints = await MapRepository(repo.db).list_waypoints(map_id)
    charger = next((ep for ep in endpoints if str(ep.type or "").lower() in CHARGER_TYPES), None)
    if charger is None:
        raise ValueError("Map chưa có điểm Trạm sạc.")
    for step in steps:
        if _is_charger_move(step):
            step["params"].update(map_id=map_id, frame_id="map", target_x=charger.x, target_y=charger.y,
                                  target_yaw=charger.yaw or 0.0, waypoint_name=charger.name)


async def physical_plan(workflow, repo):
    config = WorkflowExecutionConfig.model_validate(workflow.execution_config or {})
    if config.execution_mode != "ROBOT":
        raise ValueError("Chọn chế độ Điều khiển xe thật trong cấu hình workflow.")
    if not workflow.is_active:
        raise ValueError("Workflow đang tắt.")
    steps = await resolve_route_steps(workflow.steps or [], repo)
    if not steps:
        raise ValueError("Workflow cần ít nhất một bước.")
    ids = [s.get("step_id") for s in steps]
    if any(not isinstance(i, str) or not i for i in ids) or len(set(ids)) != len(ids):
        raise ValueError("ID của các bước phải khác nhau và không được trống.")
    for branch in config.event_branches:
        if branch.next_step_id is not None and branch.next_step_id not in ("END", *ids):
            raise ValueError("Nhánh trỏ tới bước không tồn tại.")
    maps = {s["params"]["map_id"] for s in steps if s.get("type") == "MOVE" and not _is_charger_move(s)
            and isinstance((s.get("params") or {}).get("map_id"), str) and s["params"]["map_id"].strip()}
    if any(_is_charger_move(s) for s in steps):
        if len(maps) != 1:
            raise ValueError("Một lượt chạy xe thật cần các điểm đến trên cùng một map.")
        await _fill_charger_targets(steps, next(iter(maps)), repo)
    maps = set()
    for step in steps:
        kind, p = step.get("type"), step.get("params") or {}
        if kind not in {"MOVE", "WAIT"}:
            raise ValueError(f"Chế độ xe thật hiện hỗ trợ MOVE, FOLLOW_ROUTE và WAIT; chưa hỗ trợ {kind}.")
        if p.get("next_step_id") not in (None, "", "END", *ids):
            raise ValueError("Bước tiếp theo không tồn tại.")
        _check_error_policy(step, ids)
        if kind == "MOVE":
            if not isinstance(p.get("map_id"), str) or not p["map_id"].strip():
                raise ValueError("Bước MOVE cần map_id. Hãy chọn tuyến từ Physical Map.")
            if p.get("frame_id", "map") != "map":
                raise ValueError("Điểm đến phải thuộc hệ tọa độ map.")
            for key in ("target_x", "target_y", "target_yaw"):
                value = p.get(key, 0 if key == "target_yaw" else None)
                if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
                    raise ValueError(f"Tọa độ {key} không hợp lệ.")
            maps.add(p["map_id"])
        key = "timeout_sec" if kind == "MOVE" else "duration_sec"
        value = p.get(key, 120 if kind == "MOVE" else 5)
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or not 0 < value <= 3600:
            raise ValueError(f"{key} phải lớn hơn 0 và không quá 3600 giây.")
    if len(maps) != 1:
        raise ValueError("Một lượt chạy xe thật cần các điểm đến trên cùng một map.")
    return {"steps": steps, "map_id": maps.pop(), "config": config.model_dump()}
