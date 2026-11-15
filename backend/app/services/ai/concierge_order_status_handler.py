"""Order status inquiry handler extracted from service_fsm_node."""

import datetime
import re
from typing import Any, Dict, Optional

from app.services.ai.concierge_order_status_formatter import format_order_status_reply
from app.services.ai.concierge_state import ConciergeState
from app.services.ai.constants import (
    HOUSEKEEPING_REGEX,
    MAINTENANCE_REGEX,
    ROOM_SERVICE_FOOD_REGEX,
)
from app.services.bell_request_service import bell_status_reply, is_bell_inquiry


async def handle_query_order_status(
    state: ConciergeState,
    session_id: str,
    current_room: Optional[str],
    items: Any,
    is_en: bool,
) -> Dict[str, Any]:
    """Resolve room order, taxi, or maintenance status and format response."""
    inquiry_text = f"{items or ''} {state.get('prompt') or state.get('current_query') or ''}".lower().strip()
    query_type_state = state.get("query_type")
    # Sử dụng Word Boundary Regex để tránh substring matching tai hại (ví dụ: 'an' nằm trong 'mang', 'bàn', 'thanh')
    is_svc_regex = bool(HOUSEKEEPING_REGEX.search(inquiry_text))
    is_food_regex = bool(ROOM_SERVICE_FOOD_REGEX.search(inquiry_text)) or bool(re.search(r'\b(ăn|uống|thức uống)\b', inquiry_text, re.IGNORECASE))
    is_mnt_regex = bool(MAINTENANCE_REGEX.search(inquiry_text))
    is_asking_maintenance = (query_type_state == "maintenance") or (is_mnt_regex and not is_food_regex)
    is_asking_service = (query_type_state == "service") or (is_svc_regex and not is_food_regex and not is_mnt_regex)
    is_asking_food = (query_type_state == "food") or (is_food_regex and not is_svc_regex and not is_mnt_regex)
    # Bellman progress ("hành lý tôi đem lên chưa") reads the room's DEP-BELL requests;
    # the generic path below only knows food, housekeeping, repair and taxi orders.
    if query_type_state == "bellman" or is_bell_inquiry(inquiry_text):
        if not current_room:
            bell_ask = (
                "Could you tell me your room number so I can check your luggage request?"
                if is_en else
                "Dạ quý khách cho Rora biết mình đang ở phòng bao nhiêu để em kiểm tra yêu cầu hành lý giúp quý khách nhé ạ?"
            )
            return {
                "missing_room_number": True,
                "room_number": None,
                "response": bell_ask,
                "destination_key": None,
                "require_room_pin": False,
                "status_query_type": "bellman",
            }
        from app.core.database import AsyncSessionLocal
        async with AsyncSessionLocal() as bell_db:
            bell_reply = await bell_status_reply(bell_db, current_room, english=is_en)
        return {
            "missing_room_number": False,
            "room_number": current_room,
            "response": bell_reply,
            "destination_key": None,
            "require_room_pin": False,
            "status_query_type": "bellman",
        }
    if not current_room:
        if is_en:
            if is_asking_maintenance:
                ask_reply = "Certainly! Could you please let me know your room number so I can check your maintenance and repair status right away?"
                final_q_type = "service"
            elif is_asking_service:
                ask_reply = "Certainly! Could you please let me know your room number so I can check your housekeeping and room service status right away?"
                final_q_type = "service"
            elif is_asking_food:
                ask_reply = "Certainly! Could you please let me know your room number so I can check your food order status right away?"
                final_q_type = "food"
            else:
                ask_reply = "Certainly! Could you please let me know your room number so I can check your order and room service status right away?"
                final_q_type = "general"
        else:
            if is_asking_maintenance:
                ask_reply = "Dạ quý khách cho Rora biết mình đang ở phòng bao nhiêu để em kiểm tra tiến độ sửa chữa và bảo trì giúp quý khách ngay ạ?"
                final_q_type = "service"
            elif is_asking_service:
                ask_reply = "Dạ quý khách cho Rora biết mình đang ở phòng bao nhiêu để em kiểm tra tiến độ dọn phòng và dịch vụ phòng giúp quý khách ngay ạ?"
                final_q_type = "service"
            elif is_asking_food:
                ask_reply = "Dạ quý khách cho Rora biết mình đang ở phòng bao nhiêu để em kiểm tra tiến độ đơn món ăn giúp quý khách ngay ạ?"
                final_q_type = "food"
            else:
                ask_reply = "Dạ quý khách cho Rora biết mình đang ở phòng bao nhiêu để em kiểm tra tiến độ đơn hàng và dịch vụ phòng giúp quý khách ngay ạ?"
                final_q_type = "general"
        return {
            "missing_room_number": True,
            "room_number": None,
            "response": ask_reply,
            "destination_key": None,
            "require_room_pin": False,
            "status_query_type": final_q_type,
        }
    is_reject_inquiry = bool(state.get("is_reject_inquiry"))
    if not is_reject_inquiry:
        clean_p = (state.get("prompt") or "").lower()
        is_reject_inquiry = any(k in clean_p for k in [
            "từ chối", "tu choi", "bị từ chối", "bi tu choi",
            "bị hủy", "bi huy",
            "không nhận", "khong nhan",
            "rejected", "declined", "cancelled"
        ]) or (any(k in clean_p for k in ["tại sao", "tai sao", "sao lại", "sao lai", "vì sao", "vi sao", "lý do", "ly do", "sao không", "sao"]) and any(k in clean_p for k in ["từ chối", "tu choi", "hủy", "huy", "không nhận", "khong nhan", "bỏ", "rejected", "declined", "cancelled"]))
    from app.services.ai import concierge_graph as _cg
    room_info = await _cg.query_room_order_status_db(current_room, is_en=is_en, is_reject_inquiry=is_reject_inquiry)
    if not room_info.get("exists"):
        return {
            "missing_room_number": False,
            "room_number": current_room,
            "response": room_info.get("message", f"Dạ phòng {current_room} không tồn tại trên hệ thống khách sạn ạ."),
            "destination_key": None,
            "require_room_pin": False,
        }
    if not room_info.get("is_occupied"):
        return {
            "missing_room_number": False,
            "room_number": current_room,
            "response": f"Dạ phòng {current_room} hiện chưa có khách làm thủ tục nhận phòng trên hệ thống ạ.",
            "destination_key": None,
            "require_room_pin": False,
        }
    latest_ord = room_info.get("latest_order")
    latest_food = room_info.get("latest_food_order")
    latest_service = room_info.get("latest_service_order")
    target_ord = None
    is_service_mode = False
    # Ưu tiên khớp đúng món ăn khách hỏi đích danh trong câu thoại
    inquiry_lower = inquiry_text.lower()
    matched_by_dish = None
    for f_cand in (room_info.get("food_orders") or []):
        f_sum = (f_cand.get("items_summary") or "").lower()
        if f_sum:
            tokens = [tk.strip() for tk in re.split(r"[,;|\n]", f_sum) if len(tk.strip()) >= 3]
            clean_tokens = [re.sub(r"^\d+\s*x\s*", "", tk).strip() for tk in tokens]
            if any(tk in inquiry_lower for tk in clean_tokens if len(tk) >= 3):
                matched_by_dish = f_cand
                break
        if "sake" in f_sum and "sake" in inquiry_lower:
            matched_by_dish = f_cand
            break
    is_taxi_inquiry = bool(re.search(r'\b(taxi|xe|đưa đón|dua don|chuyến xe|cuốc xe|chuyen xe|cuoc xe)\b', inquiry_text, re.IGNORECASE))
    matched_by_taxi = None
    if is_taxi_inquiry:
        for s_cand in (room_info.get("service_orders") or []):
            s_sum = (s_cand.get("items_summary") or "").lower()
            s_num = (s_cand.get("order_number") or "").lower()
            if "taxi" in s_sum or "tx-" in s_num or "xe" in s_sum:
                matched_by_taxi = s_cand
                break
    is_maintenance_inquiry = bool(re.search(r'\b(sửa|sua|sửa chữa|sua chua|bảo trì|bao tri|hỏng|hong|hư|hu|kỹ thuật|ky thuat|điều hòa|dieu hoa|máy lạnh|may lanh|vòi nước|voi nuoc|thợ|tho|cửa|khoá|khóa|điện|mất điện|maintenance|repair|fix)\b', inquiry_text, re.IGNORECASE))
    matched_by_maintenance = None
    if is_maintenance_inquiry:
        for s_cand in (room_info.get("service_orders") or []):
            s_sum = (s_cand.get("items_summary") or "").lower()
            s_num = (s_cand.get("order_number") or "").lower()
            if "mn-" in s_num or any(k in s_sum for k in ["sửa", "sua", "bảo trì", "bao tri", "kỹ thuật", "điều hòa", "máy lạnh", "nước", "điện", "khóa", "maintenance"]):
                matched_by_maintenance = s_cand
                break
    if is_reject_inquiry:
        rej_food = next((f for f in (room_info.get("food_orders") or []) if (f.get("status") or "").lower() in ("rejected", "cancelled")), None)
        rej_svc = next((s for s in (room_info.get("service_orders") or []) if (s.get("status") or "").lower() in ("rejected", "cancelled")), None)
        if rej_food or rej_svc:
            target_ord = rej_food or rej_svc
            is_service_mode = bool(not rej_food and rej_svc)
    if target_ord is not None:
        pass
    elif matched_by_maintenance:
        target_ord = matched_by_maintenance
        is_service_mode = True
    elif matched_by_taxi:
        target_ord = matched_by_taxi
        is_service_mode = True
    elif matched_by_dish:
        target_ord = matched_by_dish
        is_service_mode = False
    elif is_asking_service:
        target_ord = latest_service
        is_service_mode = True
    elif is_asking_food:
        target_ord = latest_food
        is_service_mode = False
    else:
        # Câu hỏi chung (không chỉ rõ món hay dịch vụ buồng phòng):
        # Nếu 1 bên đang ACTIVE và bên kia đã COMPLETED -> Ưu tiên bên ACTIVE!
        ACTIVE_SET = {
            "pending", "waiting", "unassigned", "chờ tiếp nhận", "chờ xử lý",
            "calling", "đang gọi", "driver assigned", "on the way",
            "sent to kitchen", "sent_to_kitchen", "đã chuyển bếp",
            "cooking", "in preparation", "in_progress", "in progress", "bếp đang nấu", "đang xử lý",
            "ready", "food ready", "món đã nấu xong", "sẵn sàng",
            "delivering", "in transit", "đang giao", "đang giao phòng", "đang mang lên"
        }
        food_is_active = bool(latest_food and (latest_food.get("status") or "").lower().strip() in ACTIVE_SET)
        svc_is_active = bool(latest_service and (latest_service.get("status") or "").lower().strip() in ACTIVE_SET)
        if food_is_active and not svc_is_active:
            target_ord = latest_food
            is_service_mode = False
        elif svc_is_active and not food_is_active:
            target_ord = latest_service
            is_service_mode = True
        elif food_is_active and svc_is_active:
            t_f = (latest_food.get("created_at") if latest_food else None) or datetime.min
            t_s = (latest_service.get("created_at") if latest_service else None) or datetime.min
            if t_f >= t_s:
                target_ord = latest_food
                is_service_mode = False
            else:
                target_ord = latest_service
                is_service_mode = True
        else:
            target_ord = latest_food or latest_service or latest_ord
            is_service_mode = bool(target_ord and target_ord.get("is_service_request"))
    return format_order_status_reply(
        target_ord=target_ord,
        is_service_mode=is_service_mode,
        current_room=current_room,
        session_id=session_id,
        is_en=is_en,
        is_reject_inquiry=is_reject_inquiry,
        is_taxi_inquiry=is_taxi_inquiry,
        matched_by_taxi=matched_by_taxi,
        is_maintenance_inquiry=is_maintenance_inquiry,
        matched_by_maintenance=matched_by_maintenance,
    )
