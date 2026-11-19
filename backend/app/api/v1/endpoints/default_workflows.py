"""
Default Seed Definitions for the Standard Core Workflows (WF01-WF08 from Stepflow.md, WF09 dinner demo, WF10 low-battery routine)
Tất cả các workflow và điểm di chuyển (MOVE) đều diễn ra tại Sảnh Chính (Ground Floor - Lobby).
Phù hợp 100% với sơ đồ kiến trúc mặt bằng sảnh khách sạn.
"""

import copy
import json
from pathlib import Path
from typing import Any, Dict, List, Optional

# Lobby destinations in metres on the 19.60 x 12.60 m Gazebo/web map.
# Keep in sync with GAZEBO_LOBBY_WAYPOINTS in the web simulator utils and
# WAYPOINTS in robot/scripts/autonomous_navigator.py.
LOBBY_WAYPOINTS: Dict[str, Dict[str, Any]] = {
    "MAIN_ENTRANCE": {"x": 0.90, "y": 6.25, "name": "Cửa Chính Ra Vào Sảnh (Main Entrance)"},
    "FRONT_DESK": {"x": 11.44, "y": 2.80, "name": "Trước Quầy Lễ Tân (Front Desk)"},
    "ELEVATOR": {"x": 15.60, "y": 6.96, "name": "Cụm Thang Máy Tầng 1 (Elevator)"},
    "CENTRAL_LOBBY": {"x": 8.40, "y": 6.40, "name": "Khu Vực Trung Tâm Sảnh"},
    "ROBOT_STANDBY": {"x": 7.20, "y": 9.60, "name": "Vị Trí Chờ Robot Sảnh"},
    "CHARGER_STATION": {"x": 6.00, "y": 9.60, "name": "Trạm Sạc Robot Sảnh"},
}

# Targets written by earlier stock templates for the old 10 x 6 m lobby.
# A saved MOVE step that still holds one of these exact points was never
# re-targeted by a user, so it can be moved onto today's waypoint.
# (0, 0) is treated as an unset placeholder for every known key.
_LEGACY_TARGET_ALIASES = {
    "DOCK_LOBBY": "ROBOT_STANDBY",
    "DOCK_01": "ROBOT_STANDBY",
    "wp-reception": "FRONT_DESK",
}
_LEGACY_TARGET_POINTS = {
    "MAIN_ENTRANCE": [(5.2, 1.0)],
    "FRONT_DESK": [(6.4, 2.0), (5.2, 2.0)],
    "ELEVATOR": [(7.7, 4.2), (7.8, 4.5)],
    "CENTRAL_LOBBY": [(4.8, 2.5)],
    "ROBOT_STANDBY": [(3.2, 2.8)],
}


def _move_target(key: str) -> Dict[str, Any]:
    wp = LOBBY_WAYPOINTS[key]
    return {"target_value": key, "waypoint_name": wp["name"], "target_x": wp["x"], "target_y": wp["y"]}


def upgrade_legacy_move_step(step: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Return a re-targeted copy of a MOVE step that still points at an old stock
    coordinate, or None when the step should be left as it is."""
    if not isinstance(step, dict) or step.get("type") != "MOVE":
        return None
    params = step.get("params") or {}
    raw_key = params.get("target_waypoint_id") or params.get("target_value")
    key = _LEGACY_TARGET_ALIASES.get(raw_key, raw_key)
    if key not in LOBBY_WAYPOINTS:
        return None
    try:
        x, y = float(params.get("target_x")), float(params.get("target_y"))
    except (TypeError, ValueError):
        return None
    old_points = _LEGACY_TARGET_POINTS.get(key, []) + [(0.0, 0.0)]
    if not any(abs(x - ox) < 0.005 and abs(y - oy) < 0.005 for ox, oy in old_points):
        return None

    upgraded = copy.deepcopy(step)
    new_params = upgraded.setdefault("params", {})
    new_params.update(_move_target(key))
    if params.get("target_waypoint_id"):
        new_params["target_waypoint_id"] = key
    return upgraded


def upgrade_guest_service_steps(workflow_id, steps):
    """Update old guest-service templates without changing their custom links or other workflows."""
    templates = {
        "wf-03-room-service": ("wf3", "UI_SERVICE_FORM", "Khách đăng ký dọn phòng và chuẩn bị xe taxi tại sảnh"),
        "wf-08-wakeup": ("wf8", "UI_WAKEUP_FORM", "Gọi báo thức lúc 06:30 sáng cho khách"),
    }
    if workflow_id not in templates:
        return steps
    prefix, form_id, old_note = templates[workflow_id]
    form_step, ask_step, send_step = (f"{prefix}-step-{n}" for n in (1, 2, 3))
    original_sequence = [(s.get("step_id"), s.get("type")) for s in steps[:3]] == [
        (form_step, "SHOW"), (ask_step, "COMMUNICATE"), (send_step, "CREATE_REQUEST")
    ]
    result = []
    for step in steps:
        params = dict(step.get("params") or {})
        if step.get("step_id") == send_step and step.get("type") == "CREATE_REQUEST":
            if params.get("room_number") == "304":
                params.pop("room_number")
                params["room_source"] = "verified_guest"
            if params.get("note") == old_note:
                params.pop("note")
        if original_sequence and step.get("step_id") == form_step and params.get("content_id") == form_id:
            # The verified form already collected the room and service details.
            if steps[1].get("params", {}).get("output_var") in ("request_data", "wakeup_time"):
                params.setdefault("next_step_id", send_step)
        result.append({**step, "params": params} if params != (step.get("params") or {}) else step)
    return result


def _hydrate_move_step(step: Dict[str, Any]) -> Dict[str, Any]:
    """Resolve _move_target_key placeholders against LOBBY_WAYPOINTS SSOT."""
    params = step.get("params")
    if not isinstance(params, dict) or "_move_target_key" not in params:
        return step
    hydrated_params: Dict[str, Any] = {}
    for key, val in params.items():
        if key == "_move_target_key":
            hydrated_params.update(_move_target(val))
        else:
            hydrated_params[key] = val
    return {**step, "params": hydrated_params}


def _load_core_workflows() -> List[Dict[str, Any]]:
    data_path = Path(__file__).resolve().parent / "data" / "default_workflows.json"
    with data_path.open("r", encoding="utf-8") as f:
        workflows = json.load(f)
    for wf in workflows:
        wf["steps"] = [_hydrate_move_step(step) for step in wf.get("steps", [])]
    return workflows


CORE_WORKFLOWS = _load_core_workflows()
