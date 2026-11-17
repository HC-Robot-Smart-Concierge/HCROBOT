"""Resolve reusable physical-map routes before workflow dispatch."""
from copy import deepcopy
from app.schemas.workflow import WorkflowRoute


def unconfigured_route_steps(steps):
    return [step for step in steps if step.get('type') == 'FOLLOW_ROUTE'
            and not (step.get('params') or {}).get('route_id')]


async def resolve_route_steps(steps, repo):
    result = []
    cache = {}
    for step in steps:
        if step.get("type") != "FOLLOW_ROUTE":
            result.append(deepcopy(step))
            continue
        params = step.get("params") or {}
        route_id = params.get("route_id")
        count = params.get("repeat_count", 1)
        if not isinstance(route_id, str) or not route_id.strip():
            raise ValueError("Chọn tuyến cho mỗi bước Đi theo tuyến")
        if type(count) is not int or not 1 <= count <= 100:
            raise ValueError("Số vòng của bước Đi theo tuyến phải từ 1 đến 100")
        if route_id not in cache:
            cache[route_id] = await repo.get_by_id(route_id)
        template = cache[route_id]
        if not template or not template.is_active or not (template.execution_config or {}).get("route"):
            raise ValueError(f"Tuyến {route_id} không còn khả dụng; chọn lại tuyến")
        route = WorkflowRoute.model_validate(template.execution_config["route"])
        if len(result) + count * len(route.points) > 2000:
            raise ValueError("Workflow sau khi mở tuyến vượt 2000 bước; giảm số vòng")
        for round_index in range(count):
            for index, point in enumerate(route.points):
                first = round_index == 0 and index == 0
                result.append({
                    "step_id": step["step_id"] if first else f"{step['step_id']}::{round_index}::{index}",
                    "type": "MOVE", "title": f"{template.name} · vòng {round_index + 1} · {point.name}",
                    "params": {
                        "source_route_id": route_id, "source_route_step_id": step["step_id"],
                        "map_id": route.map_id, "frame_id": "map",
                        "target_waypoint_id": point.endpoint_id, "target_value": point.endpoint_id or point.id,
                        "waypoint_name": point.name, "target_x": point.x, "target_y": point.y,
                        "target_yaw": point.yaw, "speed": 0.12, "timeout_sec": 120,
                    },
                })
        if params.get("next_step_id"):
            result[-1]["params"]["next_step_id"] = params["next_step_id"]
    if len(result) > 2000:
        raise ValueError("Workflow sau khi mở tuyến vượt 2000 bước; giảm số vòng")
    return result
