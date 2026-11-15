"""
Default Seed Definitions for the Standard Core Workflows (WF01-WF08 from Stepflow.md, WF09 dinner demo, WF10 low-battery routine)
Tất cả các workflow và điểm di chuyển (MOVE) đều diễn ra tại Sảnh Chính (Ground Floor - Lobby).
Phù hợp 100% với sơ đồ kiến trúc mặt bằng sảnh khách sạn.
"""

import copy
from typing import Any, Dict, Optional

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


CORE_WORKFLOWS = [
    {
        "id": "wf-01-welcome",
        "name": "Workflow 1: Đón tiếp và Chào mừng khách tại Cửa Sảnh",
        "description": "Robot từ trạm chờ di chuyển ra Cửa chính đón khách mới vào sảnh, chào hỏi và mở menu.",
        "trigger_type": "AUTO_DETECT",
        "is_active": True,
        "steps": [
            {
                "step_id": "wf1-step-1",
                "type": "MOVE",
                "title": "1. Di chuyển ra Cửa chính đón khách",
                "params": {
                    "target_type": "LOCATION",
                    **_move_target("MAIN_ENTRANCE"),
                    "speed": 0.35
                }
            },
            {
                "step_id": "wf1-step-2",
                "type": "GREET",
                "title": "2. Chào đón khách niềm nở",
                "params": {
                    "template_id": "TPL_WELCOME",
                    "language": "vi",
                    "expression": "SMILE",
                    "greeting_text": "Dạ em chào quý khách! Chào mừng quý khách đến với khách sạn Aurora."
                }
            },
            {
                "step_id": "wf1-step-3",
                "type": "SHOW",
                "title": "3. Mở màn hình chọn ngôn ngữ",
                "params": {
                    "screen_type": "LANGUAGE_SELECT",
                    "content_id": "UI_LANG",
                    "timeout": 10
                }
            },
            {
                "step_id": "wf1-step-4",
                "type": "COMMUNICATE",
                "title": "4. Giao tiếp & xác nhận yêu cầu / ngôn ngữ",
                "params": {
                    "input_source": "BOTH",
                    "silence_timeout_sec": 30,
                    "output_var": "selected_lang",
                    "initial_prompt": "Dạ em chào quý khách! Quý khách cần em hỗ trợ thông tin hay dịch vụ gì ạ?"
                }
            },
            {
                "step_id": "wf1-step-5",
                "type": "SHOW",
                "title": "5. Bật thực đơn tiện ích sảnh & dịch vụ",
                "params": {
                    "screen_type": "MENU",
                    "content_id": "UI_MAIN_MENU",
                    "timeout": 30
                }
            }
        ]
    },
    {
        "id": "wf-02-recommend",
        "name": "Workflow 2: Gợi ý và Tư vấn tiện ích khách sạn tại Sảnh",
        "description": "Tư vấn dịch vụ ẩm thực, nhà hàng, hồ bơi và điểm tham quan cho khách ngồi tại sảnh.",
        "trigger_type": "GUEST_TAP",
        "is_active": True,
        "steps": [
            {
                "step_id": "wf2-step-1",
                "type": "SHOW",
                "title": "1. Hiển thị danh mục dịch vụ & ẩm thực",
                "params": {
                    "screen_type": "MENU",
                    "content_id": "UI_CATEGORIES",
                    "timeout": 20
                }
            },
            {
                "step_id": "wf2-step-2",
                "type": "COMMUNICATE",
                "title": "2. Đối thoại & lắng nghe sở thích ẩm thực / giải trí",
                "params": {
                    "input_source": "BOTH",
                    "silence_timeout_sec": 30,
                    "output_var": "guest_choice",
                    "initial_prompt": "Dạ em có thể tư vấn nhà hàng, quán bar hoặc hồ bơi cho quý khách, quý khách thích phong cách ẩm thực nào ạ?"
                }
            },
            {
                "step_id": "wf2-step-3",
                "type": "RECOMMEND",
                "title": "3. Gợi ý thông minh theo nhu cầu",
                "params": {
                    "category": "DINING",
                    "limit": 3,
                    "filter": {"type": "restaurant"},
                    "highlight_item": "Set Trà Chiều Sảnh & Buffet Hải Sản Tầng 2"
                }
            },
            {
                "step_id": "wf2-step-4",
                "type": "SHOW",
                "title": "4. Chiếu danh sách gợi ý nổi bật",
                "params": {
                    "screen_type": "MENU",
                    "content_id": "UI_RECOMMEND_LIST",
                    "timeout": 45
                }
            },
            {
                "step_id": "wf2-step-5",
                "type": "COMMUNICATE",
                "title": "5. Hướng dẫn & giải đáp thắc mắc thêm",
                "params": {
                    "initial_prompt": "Quý khách có thể sử dụng cụm thang máy ngay phía sau quầy lễ tân để lên nhà hàng Tầng 2 thưởng thức ẩm thực ạ. Quý khách có cần em hỗ trợ thêm gì không ạ?",
                    "silence_timeout_sec": 30,
                    "language": "vi-VN"
                }
            }
        ]
    },
    {
        "id": "wf-03-room-service",
        "name": "Workflow 3: Đặt dịch vụ buồng phòng & Gọi taxi đón tại Sảnh",
        "description": "Tiếp nhận yêu cầu dọn phòng, xin thêm đồ dùng hoặc đặt xe taxi đón tại cửa sảnh.",
        "trigger_type": "GUEST_TAP",
        "is_active": True,
        "steps": [
            {
                "step_id": "wf3-step-1",
                "type": "SHOW",
                "title": "1. Bật biểu mẫu tiếp nhận dịch vụ sảnh",
                "params": {
                    "screen_type": "MENU",
                    "content_id": "UI_SERVICE_FORM",
                    "next_step_id": "wf3-step-3",
                    "timeout": 30
                }
            },
            {
                "step_id": "wf3-step-2",
                "type": "COMMUNICATE",
                "title": "2. Đối thoại ghi nhận dịch vụ buồng phòng & số phòng",
                "params": {
                    "input_source": "BOTH",
                    "silence_timeout_sec": 30,
                    "output_var": "request_data",
                    "initial_prompt": "Dạ quý khách cần dọn phòng hay đặt xe taxi ạ? Vui lòng cho em biết số phòng của mình nhé!"
                }
            },
            {
                "step_id": "wf3-step-3",
                "type": "CREATE_REQUEST",
                "title": "3. Xác nhận và gửi yêu cầu tới bộ phận phụ trách",
                "params": {
                    "service_type": "HOUSEKEEPING",
                    "room_source": "verified_guest",
                    "urgency": "NORMAL",
                    "target_department": "Housekeeping"
                }
            },
            {
                "step_id": "wf3-step-4",
                "type": "COMMUNICATE",
                "title": "4. Xác nhận yêu cầu & giải đáp thêm",
                "params": {
                    "initial_prompt": "Yêu cầu của quý khách đã được chuyển tới nhân viên trực sảnh. Chúng em sẽ phục vụ trong ít phút. Quý khách cần hỗ trợ thêm gì không ạ?",
                    "silence_timeout_sec": 30,
                    "language": "vi-VN"
                }
            },
            {
                "step_id": "wf3-step-5",
                "type": "SHOW",
                "title": "5. Màn hình xác nhận thành công",
                "params": {
                    "screen_type": "MENU",
                    "content_id": "UI_CONFIRMATION",
                    "timeout": 10
                }
            }
        ]
    },
    {
        "id": "wf-04-call-staff",
        "name": "Workflow 4: Hướng dẫn và Kết nối Lễ Tân tại Quầy (Front Desk)",
        "description": "Dẫn khách từ khu sofa qua Quầy Lễ Tân (Front Desk) khi khách cần gặp nhân viên trực tiếp.",
        "trigger_type": "MANUAL",
        "is_active": True,
        "steps": [
            {
                "step_id": "wf4-step-1",
                "type": "COMMUNICATE",
                "title": "1. Thông báo hướng dẫn & giải đáp tới quầy lễ tân",
                "params": {
                    "initial_prompt": "Em sẽ dẫn quý khách qua Quầy Lễ Tân ngay bên cạnh để nhân viên trực tiếp hỗ trợ ạ. Xin mời quý khách đi cùng em!",
                    "silence_timeout_sec": 30,
                    "language": "vi-VN"
                }
            },
            {
                "step_id": "wf4-step-2",
                "type": "MOVE",
                "title": "2. Dẫn khách tới Quầy Lễ Tân (Front Desk)",
                "params": {
                    "target_type": "LOCATION",
                    **_move_target("FRONT_DESK"),
                    "speed": 0.3
                }
            },
            {
                "step_id": "wf4-step-3",
                "type": "CREATE_REQUEST",
                "title": "3. Phát cảnh báo chuông trực quầy",
                "params": {
                    "service_type": "CALL_STAFF",
                    "room_number": "FRONT_DESK",
                    "note": "Khách cần trợ giúp trực tiếp tại Quầy Lễ Tân",
                    "urgency": "HIGH",
                    "target_department": "Reception"
                }
            },
            {
                "step_id": "wf4-step-4",
                "type": "SHOW",
                "title": "4. Màn hình kết nối nhân viên trực quầy",
                "params": {
                    "screen_type": "MENU",
                    "content_id": "UI_WAITING_STAFF",
                    "timeout": 60
                }
            }
        ]
    },
    {
        "id": "wf-05-feedback",
        "name": "Workflow 5: Đánh giá dịch vụ và Robot về Trạm Chờ Sảnh",
        "description": "Lấy đánh giá hài lòng từ khách và đưa robot quay về vị trí trực tại trạm chờ Sofa sảnh.",
        "trigger_type": "MANUAL",
        "is_active": True,
        "steps": [
            {
                "step_id": "wf5-step-1",
                "type": "SHOW",
                "title": "1. Hiện giao diện chấm điểm 5 sao",
                "params": {
                    "screen_type": "MENU",
                    "content_id": "UI_RATING",
                    "timeout": 15
                }
            },
            {
                "step_id": "wf5-step-2",
                "type": "FEEDBACK",
                "title": "2. Thu thập điểm hài lòng từ khách",
                "params": {
                    "scale": 5,
                    "timeout": 15,
                    "output_var": "score",
                    "question_text": "Quý khách có hài lòng với sự hỗ trợ của Robot tại Sảnh không?"
                }
            },
            {
                "step_id": "wf5-step-3",
                "type": "COMMUNICATE",
                "title": "3. Cảm ơn và lắng nghe phản hồi thêm",
                "params": {
                    "initial_prompt": "Cảm ơn quý khách đã đánh giá! Chúc quý khách một ngày thật tuyệt vời tại Aurora! Quý khách có điều gì cần góp ý thêm không ạ?",
                    "silence_timeout_sec": 30,
                    "language": "vi-VN"
                }
            },
            {
                "step_id": "wf5-step-4",
                "type": "MOVE",
                "title": "4. Robot trở về Vị Trí Chờ Sảnh",
                "params": {
                    "target_type": "STANDBY",
                    **_move_target("ROBOT_STANDBY"),
                    "speed": 0.4
                }
            }
        ]
    },
    {
        "id": "wf-06-idle-promo",
        "name": "Workflow 6: Tuần tra sảnh và Chiếu quảng cáo sự kiện",
        "description": "Robot tuần tra ra khu vực trung tâm sảnh phát poster khuyến mãi lúc vắng khách.",
        "trigger_type": "SCHEDULE",
        "is_active": True,
        "steps": [
            {
                "step_id": "wf6-step-1",
                "type": "MOVE",
                "title": "1. Di chuyển ra Trung Tâm Sảnh đón tiếp",
                "params": {
                    "target_type": "LOCATION",
                    **_move_target("CENTRAL_LOBBY"),
                    "speed": 0.35
                }
            },
            {
                "step_id": "wf6-step-2",
                "type": "SHOW",
                "title": "2. Chiếu poster khuyến mại & ẩm thực",
                "params": {
                    "screen_type": "SLIDE",
                    "content_id": "PROMO_SUMMER",
                    "timeout": 60,
                    "display_banner": "Ưu Đãi Mùa Hè: Giảm 20% Spa & Ẩm Thực Tối Tầng 2"
                }
            }
        ]
    },
]

from .default_workflows_extra import build_extra_workflows

CORE_WORKFLOWS.extend(build_extra_workflows(_move_target))
