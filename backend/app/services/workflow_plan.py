"""Validate a physical execution snapshot before reserving a robot."""
import math
from app.schemas.workflow import WorkflowExecutionConfig
from app.services.workflow_routes import resolve_route_steps


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
    maps = set()
    for step in steps:
        kind, p = step.get("type"), step.get("params") or {}
        if kind not in {"MOVE", "WAIT"}:
            raise ValueError(f"Chế độ xe thật hiện hỗ trợ MOVE, FOLLOW_ROUTE và WAIT; chưa hỗ trợ {kind}.")
        if p.get("next_step_id") not in (None, "", "END", *ids):
            raise ValueError("Bước tiếp theo không tồn tại.")
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
