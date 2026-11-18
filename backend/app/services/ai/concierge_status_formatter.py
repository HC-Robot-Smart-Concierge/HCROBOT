"""Order & service status inquiry handler and bilingual reply formatting."""

import re
from datetime import datetime
from typing import Any, Dict, Optional

from app.services.ai.concierge_order_status import query_room_order_status_db
from app.services.ai.concierge_router_nodes import ConciergeState
from app.services.ai.constants import (
    HOUSEKEEPING_REGEX,
    MAINTENANCE_REGEX,
    ROOM_SERVICE_FOOD_REGEX,
)
from app.services.ai.session_manager import session_manager
from app.services.bell_request_service import bell_status_reply, is_bell_inquiry


def _build_missing_room_status_reply(
    is_en: bool, is_asking_maintenance: bool, is_asking_service: bool, is_asking_food: bool
) -> Dict[str, Any]:
    if is_en:
        if is_asking_maintenance:
            ask_reply, final_q_type = "Certainly! Could you please let me know your room number so I can check your maintenance and repair status right away?", "service"
        elif is_asking_service:
            ask_reply, final_q_type = "Certainly! Could you please let me know your room number so I can check your housekeeping and room service status right away?", "service"
        elif is_asking_food:
            ask_reply, final_q_type = "Certainly! Could you please let me know your room number so I can check your food order status right away?", "food"
        else:
            ask_reply, final_q_type = "Certainly! Could you please let me know your room number so I can check your order and room service status right away?", "general"
    else:
        if is_asking_maintenance:
            ask_reply, final_q_type = "Dạ quý khách cho Rora biết mình đang ở phòng bao nhiêu để em kiểm tra tiến độ sửa chữa và bảo trì giúp quý khách ngay ạ?", "service"
        elif is_asking_service:
            ask_reply, final_q_type = "Dạ quý khách cho Rora biết mình đang ở phòng bao nhiêu để em kiểm tra tiến độ dọn phòng và dịch vụ phòng giúp quý khách ngay ạ?", "service"
        elif is_asking_food:
            ask_reply, final_q_type = "Dạ quý khách cho Rora biết mình đang ở phòng bao nhiêu để em kiểm tra tiến độ đơn món ăn giúp quý khách ngay ạ?", "food"
        else:
            ask_reply, final_q_type = "Dạ quý khách cho Rora biết mình đang ở phòng bao nhiêu để em kiểm tra tiến độ đơn hàng và dịch vụ phòng giúp quý khách ngay ạ?", "general"
    return {
        "missing_room_number": True,
        "room_number": None,
        "response": ask_reply,
        "destination_key": None,
        "require_room_pin": False,
        "status_query_type": final_q_type,
    }


async def handle_order_status_inquiry(
    state: ConciergeState,
    session_id: str,
    current_room: Optional[str],
    items: str,
    lang_code: str,
    is_en: bool,
) -> Dict[str, Any]:
    """Handle query_order_status inquiries for Bellman, Housekeeping, Maintenance, Taxi, and F&B orders."""
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
        return _build_missing_room_status_reply(
            is_en=is_en,
            is_asking_maintenance=is_asking_maintenance,
            is_asking_service=is_asking_service,
            is_asking_food=is_asking_food,
        )

    is_reject_inquiry = bool(state.get("is_reject_inquiry"))
    if not is_reject_inquiry:
        clean_p = (state.get("prompt") or "").lower()
        is_reject_inquiry = any(k in clean_p for k in [
            "từ chối", "tu choi", "bị từ chối", "bi tu choi",
            "bị hủy", "bi huy",
            "không nhận", "khong nhan",
            "rejected", "declined", "cancelled"
        ]) or (any(k in clean_p for k in ["tại sao", "tai sao", "sao lại", "sao lai", "vì sao", "vi sao", "lý do", "ly do", "sao không", "sao"]) and any(k in clean_p for k in ["từ chối", "tu choi", "hủy", "huy", "không nhận", "khong nhan", "bỏ", "rejected", "declined", "cancelled"]))
    room_info = await query_room_order_status_db(current_room, is_en=is_en, is_reject_inquiry=is_reject_inquiry)
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
    STATUS_VN_MAP = {
        "pending": "đang chờ tiếp nhận",
        "waiting": "đang chờ xử lý",
        "unassigned": "đang chờ phân công",
        "sent to kitchen": "đã chuyển tới nhà bếp và đang chờ chế biến",
        "cooking": "đang được các đầu bếp trực tiếp chế biến trong bếp, sắp hoàn tất",
        "in preparation": "đang được chế biến",
        "in progress": "đang được thực hiện",
        "assigned": "đã phân công nhân viên",
        "ready": "đã làm xong, đang chuẩn bị mang lên phòng",
        "food ready": "đã nấu xong, đang chuẩn bị mang lên phòng",
        "delivering": "đang trên đường giao lên phòng",
        "driver assigned": "đã có tài xế nhận cuốc và đang chuẩn bị đón quý khách",
        "on the way": "xe taxi đang trên đường di chuyển đến sảnh đón quý khách",
        "completed": "đã hoàn thành và giao thành công lên phòng",
        "delivered": "đã giao thành công lên phòng",
        "done": "đã hoàn tất thành công",
        "cancelled": "đã được hủy",
        "rejected": "tạm thời chưa thể phục vụ",
    }
    STATUS_EN_MAP = {
        "pending": "pending in queue",
        "waiting": "waiting to be processed",
        "unassigned": "waiting for staff assignment",
        "sent to kitchen": "sent to the kitchen and queued for preparation",
        "cooking": "being freshly prepared by our chefs in the kitchen",
        "in preparation": "in preparation",
        "in progress": "in progress",
        "assigned": "assigned to staff",
        "ready": "ready and waiting for delivery",
        "food ready": "finished and ready for delivery",
        "delivering": "out for delivery to your room right now",
        "completed": "delivered successfully",
        "delivered": "delivered successfully",
        "done": "completed",
        "cancelled": "cancelled",
        "rejected": "declined",
    }

    def _reject_suffix(raw_rej: str) -> str:
        if is_reject_inquiry and not raw_rej:
            return " without a specific reason noted" if is_en else " nhưng nhân viên chưa ghi chú lý do cụ thể ạ"
        if not raw_rej:
            return ""
        return f" with reason: '{raw_rej}'" if is_en else f' với lý do: "{raw_rej}"'

    if is_service_mode:
        if target_ord:
            st = (target_ord.get("status") or "").lower().strip()
            st_norm = st.replace("sent_to_kitchen", "sent to kitchen").replace("in_progress", "in progress")
            items_summary = target_ord.get("items_summary", "")
            items_desc = f" ({items_summary})" if items_summary else ""
            raw_rej = (target_ord.get("reject_reason") or target_ord.get("note") or "").strip()
            is_maintenance_item = bool(
                is_maintenance_inquiry
                or matched_by_maintenance
                or "mn-" in str(target_ord.get("order_number") or "").lower()
                or "mn-" in str(target_ord.get("ticket_code") or "").lower()
                or any(k in str(items_summary).lower() for k in ["sửa", "bảo trì", "kỹ thuật", "điều hòa", "máy lạnh", "nước", "điện", "khóa", "maintenance", "repair"])
            )

            is_taxi_item = bool(
                is_taxi_inquiry
                or matched_by_taxi
                or "taxi" in str(items_summary).lower()
                or "tx-" in str(target_ord.get("order_number") or "").lower()
                or "tx-" in str(target_ord.get("ticket_code") or "").lower()
                or "taxi" in str(target_ord.get("title") or "").lower()
            )

            if is_maintenance_item:
                if is_en:
                    st_mnt = {"assigned": "in progress", "success": "completed", "done": "completed"}.get(st_norm, st_norm)
                    mnt_st_map_en = {
                        "pending": f"Your maintenance request for Room {current_room}{items_desc} has been received and is queued for our Technical Team.",
                        "waiting": f"Your maintenance request for Room {current_room}{items_desc} is waiting to be processed by our Technical Team.",
                        "unassigned": f"Your maintenance request for Room {current_room}{items_desc} is waiting for technician assignment.",
                        "in progress": f"Our Maintenance technician has been dispatched and is currently handling the repair for Room {current_room}{items_desc}.",
                        "completed": f"The maintenance and repair for Room {current_room}{items_desc} has been successfully completed by our Technical Team!",
                        "cancelled": f"Your maintenance request for Room {current_room}{items_desc} was cancelled.",
                        "rejected": f"Your maintenance request for Room {current_room}{items_desc} could not be fulfilled at this time.",
                    }
                    status_reply = mnt_st_map_en.get(st_mnt, f"Your maintenance request for Room {current_room}{items_desc} is currently {st}.")
                else:
                    st_mnt = {"assigned": "in progress", "success": "completed"}.get(st_norm, st_norm)
                    mnt_st_map_vn = {
                        "pending": f"Dạ yêu cầu bảo trì sửa chữa của phòng {current_room}{items_desc} đã được tiếp nhận và đang chờ đội kỹ thuật phân công nhân viên lên xử lý ạ.",
                        "waiting": f"Dạ yêu cầu bảo trì sửa chữa của phòng {current_room}{items_desc} đang chờ kỹ thuật viên tiếp nhận xử lý ạ.",
                        "unassigned": f"Dạ yêu cầu bảo trì của phòng {current_room}{items_desc} đang chờ kỹ thuật viên tiếp nhận xử lý ạ.",
                        "in progress": f"Dạ kỹ thuật viên đã tiếp nhận và đang tiến hành kiểm tra, sửa chữa cho phòng {current_room}{items_desc} rồi ạ.",
                        "completed": f"Dạ sự cố kỹ thuật của phòng {current_room}{items_desc} đã được nhân viên kỹ thuật hoàn tất sửa chữa thành công rồi ạ!",
                        "done": f"Dạ sự cố kỹ thuật của phòng {current_room}{items_desc} đã được hoàn tất sửa chữa thành công rồi ạ!",
                        "cancelled": f"Dạ yêu cầu bảo trì của phòng {current_room}{items_desc} đã được hủy rồi ạ.",
                        "rejected": f"Dạ yêu cầu bảo trì của phòng {current_room}{items_desc} tạm thời chưa được đáp ứng. Quý khách vui lòng liên hệ Lễ tân nhé ạ.",
                    }
                    status_reply = mnt_st_map_vn.get(st_mnt, f"Dạ yêu cầu bảo trì của phòng {current_room}{items_desc} hiện đang ở trạng thái: {st} ạ.")
            elif is_taxi_item:
                st_taxi = {"đang gọi": "calling", "in progress": "calling", "success": "completed", "thành công": "completed"}.get(st_norm, st_norm)
                if is_en:
                    taxi_st_map_en = {
                        "pending": f"Your taxi request for Room {current_room} has been received and is waiting for Concierge to call the taxi.",
                        "waiting": f"Your taxi request for Room {current_room} is waiting for Concierge to call.",
                        "unassigned": f"Your taxi request for Room {current_room} is waiting for Concierge to call.",
                        "calling": f"Our Concierge team has received your request and is currently calling a taxi for Room {current_room}. Please wait a moment.",
                        "driver assigned": f"Our Concierge team has contacted the taxi company and a driver is on the way for Room {current_room}.",
                        "on the way": f"The taxi is on the way to the lobby entrance for Room {current_room}.",
                        "completed": f"Our Concierge team has successfully arranged a taxi for Room {current_room}. Please head to the main lobby to meet your ride!",
                        "done": f"Our Concierge team has successfully arranged a taxi for Room {current_room}.",
                        "cancelled": f"Your taxi request for Room {current_room} was cancelled.",
                        "rejected": f"Your taxi request for Room {current_room} could not be fulfilled at this time.",
                    }
                    status_reply = taxi_st_map_en.get(st_taxi, f"Your taxi request for Room {current_room} is currently {st}.")
                else:
                    taxi_st_map_vn = {
                        "pending": f"Dạ yêu cầu gọi xe taxi của phòng {current_room} đang chờ nhân viên Concierge tiếp nhận để gọi xe cho quý khách ạ.",
                        "waiting": f"Dạ yêu cầu gọi xe taxi của phòng {current_room} đang chờ Concierge gọi xe ạ.",
                        "unassigned": f"Dạ yêu cầu gọi xe taxi của phòng {current_room} đang chờ nhân viên tiếp nhận gọi xe ạ.",
                        "calling": f"Dạ bộ phận Concierge đã tiếp nhận yêu cầu và đang gọi xe taxi cho phòng {current_room} rồi ạ. Quý khách vui lòng đợi trong giây lát ạ.",
                        "driver assigned": f"Dạ Concierge đã liên hệ xong hãng xe và tài xế đang chuẩn bị đón phòng {current_room} ạ.",
                        "on the way": f"Dạ xe taxi đang di chuyển đến sảnh đón phòng {current_room} rồi ạ.",
                        "completed": f"Dạ bộ phận Concierge đã gọi xe taxi thành công cho phòng {current_room} rồi ạ. Quý khách vui lòng chuẩn bị ra sảnh đón xe nhé!",
                        "done": f"Dạ bộ phận Concierge đã gọi xe taxi thành công cho phòng {current_room} rồi ạ.",
                        "cancelled": f"Dạ yêu cầu gọi xe taxi của phòng {current_room} đã được hủy rồi ạ.",
                        "rejected": f"Dạ yêu cầu gọi xe taxi của phòng {current_room} tạm thời chưa được đáp ứng. Quý khách vui lòng liên hệ quầy Concierge nhé ạ.",
                    }
                    status_reply = taxi_st_map_vn.get(st_taxi, f"Dạ yêu cầu gọi xe của phòng {current_room} hiện đang ở trạng thái: {st} ạ.")
            elif is_en:
                rej_en = _reject_suffix(raw_rej)
                svc_map = {
                    "pending": f"Your room service request for Room {current_room}{items_desc} has been received and is queued for Housekeeping service.",
                    "waiting": f"Your room service request for Room {current_room}{items_desc} is waiting to be processed.",
                    "unassigned": f"Your room service request for Room {current_room}{items_desc} is waiting for staff assignment.",
                    "sent to kitchen": f"Your request for Room {current_room}{items_desc} has been forwarded and is queued for service.",
                    "cooking": f"Our housekeeping staff is currently preparing items and servicing Room {current_room}{items_desc}.",
                    "in progress": f"Our housekeeping staff is currently servicing Room {current_room}{items_desc}.",
                    "assigned": f"Our housekeeping staff has been assigned and is on the way to Room {current_room}{items_desc}.",
                    "ready": f"Your requested items for Room {current_room}{items_desc} are prepared and being delivered.",
                    "delivering": f"Our room service staff is on the way to Room {current_room}{items_desc} right now!",
                    "completed": f"Your room service request for Room {current_room}{items_desc} has been completed successfully. Have a wonderful stay!",
                    "delivered": f"Your room service request for Room {current_room}{items_desc} has been delivered successfully. Have a wonderful stay!",
                    "done": f"Your room service request for Room {current_room}{items_desc} has been completed successfully.",
                    "cancelled": f"Your room service request for Room {current_room} was cancelled{rej_en}.",
                    "rejected": f"Your room service request for Room {current_room}{items_desc} was declined{rej_en}. Please contact the front desk for assistance.",
                }
                st_en = STATUS_EN_MAP.get(st_norm, st)
                status_reply = svc_map.get(st_norm, f"Your room service request for Room {current_room}{items_desc} is currently {st_en}.")
            else:
                rej_vn = _reject_suffix(raw_rej)
                svc_map = {
                    "pending": f"Dạ yêu cầu phục vụ phòng của phòng {current_room}{items_desc} đã được tiếp nhận và đang trong hàng đợi xử lý của bộ phận buồng phòng ạ.",
                    "waiting": f"Dạ yêu cầu phục vụ phòng của phòng {current_room}{items_desc} đang chờ nhân viên tiếp nhận xử lý ạ.",
                    "unassigned": f"Dạ yêu cầu phục vụ phòng của phòng {current_room}{items_desc} đang chờ phân công nhân viên phụ trách ạ.",
                    "sent to kitchen": f"Dạ yêu cầu phục vụ phòng của phòng {current_room}{items_desc} đã được chuyển tới bộ phận chuyên trách xử lý ạ.",
                    "cooking": f"Dạ nhân viên buồng phòng đang tiến hành chuẩn bị đồ và xử lý yêu cầu dọn phòng {items_desc} cho phòng {current_room} rồi ạ, sắp hoàn tất rồi ạ.",
                    "in progress": f"Dạ nhân viên buồng phòng đang trực tiếp dọn dẹp và phục vụ yêu cầu {items_desc} tại phòng {current_room} rồi ạ.",
                    "assigned": f"Dạ nhân viên buồng phòng chuyên trách đã tiếp nhận yêu cầu {items_desc} cho phòng {current_room} và đang chuẩn bị thực hiện ạ.",
                    "ready": f"Dạ các vật dụng yêu cầu cho phòng {current_room}{items_desc} đã được chuẩn bị xong, đang chuẩn bị mang lên phòng ạ.",
                    "delivering": f"Dạ nhân viên phục vụ phòng đang mang đồ di chuyển lên phòng {current_room} cho quý khách rồi ạ!",
                    "completed": f"Dạ yêu cầu phục vụ phòng {items_desc} của phòng {current_room} đã được hoàn tất thành công rồi ạ. Chúc quý khách có thời gian nghỉ dưỡng thoải mái!",
                    "done": f"Dạ yêu cầu phục vụ phòng {items_desc} của phòng {current_room} đã hoàn tất thành công rồi ạ.",
                    "cancelled": f"Dạ yêu cầu dịch vụ phòng của phòng {current_room} đã được hủy{rej_vn} rồi ạ.",
                    "rejected": f"Dạ yêu cầu phục vụ phòng {items_desc} của phòng {current_room} đã bị từ chối{rej_vn}. Quý khách vui lòng liên hệ quầy Lễ tân hoặc chọn tiện ích khác để được hỗ trợ nhé ạ.",
                }
                st_svc_vn = "completed" if st_norm == "delivered" else st_norm
                st_vn = STATUS_VN_MAP.get(st_norm, st)
                status_reply = svc_map.get(st_svc_vn, f"Dạ yêu cầu dịch vụ của phòng {current_room}{items_desc} hiện {st_vn} ạ.")
        else:
            if is_reject_inquiry:
                status_reply = (
                    f"I checked and there are currently no declined room service requests for Room {current_room}."
                    if is_en else
                    f"Dạ em kiểm tra thấy hiện tại phòng {current_room} không có yêu cầu phục vụ phòng nào bị từ chối ạ."
                )
            else:
                status_reply = (
                    f"I checked and there are currently no active housekeeping or room service requests for Room {current_room}. Would you like to request amenities from our Utilities menu?"
                    if is_en else
                    f"Dạ em kiểm tra thấy hiện tại phòng {current_room} không có yêu cầu dọn phòng hoặc dịch vụ phòng nào đang chờ xử lý ạ. Quý khách có thể yêu cầu dọn phòng hoặc thêm khăn tắm trong menu Tiện ích nhé ạ!"
                )
    elif target_ord:
        st = (target_ord.get("status") or "").lower().strip()
        st_norm = st.replace("sent_to_kitchen", "sent to kitchen").replace("in_progress", "in progress")
        st_food = "completed" if st_norm == "delivered" else st_norm
        items_summary = target_ord.get("items_summary", "")
        items_desc = f" ({items_summary})" if items_summary else ""
        raw_rej = (target_ord.get("reject_reason") or target_ord.get("note") or "").strip()
        if is_en:
            rej_en = _reject_suffix(raw_rej)
            ord_map = {
                "pending": f"Your food order for Room {current_room}{items_desc} has been received by the kitchen and is in the queue.",
                "waiting": f"Your food order for Room {current_room}{items_desc} is waiting to be processed by the kitchen.",
                "sent to kitchen": f"Your food order for Room {current_room}{items_desc} has been sent to the kitchen and the chefs are preparing to cook.",
                "cooking": f"The chefs are currently preparing your food order for Room {current_room}{items_desc} in the kitchen.",
                "in preparation": f"The kitchen is currently preparing your food order for Room {current_room}{items_desc}.",
                "in progress": f"The kitchen is currently working on your food order for Room {current_room}{items_desc}.",
                "ready": f"Your food order for Room {current_room}{items_desc} has been finished by the kitchen and is waiting for delivery.",
                "food ready": f"Your food order for Room {current_room}{items_desc} is ready and waiting for delivery.",
                "delivering": f"Your food order for Room {current_room}{items_desc} is on its way to your room right now!",
                "completed": f"Your food order for Room {current_room}{items_desc} has been delivered successfully. Enjoy your meal!",
                "done": f"Your food order for Room {current_room}{items_desc} has been completed successfully.",
                "cancelled": f"Your food order for Room {current_room} was cancelled{rej_en}.",
                "rejected": f"Your food order for Room {current_room}{items_desc} was declined by the kitchen{rej_en}. Would you like to select another dish from our menu?",
            }
            st_en = STATUS_EN_MAP.get(st_norm, st)
            status_reply = ord_map.get(st_food, f"Your food order for Room {current_room}{items_desc} is currently {st_en}.")
        else:
            rej_vn = _reject_suffix(raw_rej)
            ord_map = {
                "pending": f"Dạ đơn món của phòng {current_room}{items_desc} đã được nhà bếp tiếp nhận và đang xếp hàng chờ nấu ạ.",
                "waiting": f"Dạ đơn món của phòng {current_room}{items_desc} đang chờ nhà bếp xử lý ạ.",
                "sent to kitchen": f"Dạ đơn món của phòng {current_room}{items_desc} đã được chuyển tới nhà bếp và các đầu bếp đang chuẩn bị chế biến ạ.",
                "cooking": f"Dạ món ăn của phòng {current_room}{items_desc} hiện đang được các đầu bếp trực tiếp chế biến trong bếp, sắp xong rồi ạ.",
                "in preparation": f"Dạ món ăn của phòng {current_room}{items_desc} hiện đang được chế biến trong bếp, sắp xong rồi ạ.",
                "in progress": f"Dạ món ăn của phòng {current_room}{items_desc} hiện đang được thực hiện trong nhà bếp ạ.",
                "ready": f"Dạ món ăn của phòng {current_room}{items_desc} đã được nhà bếp làm xong, đang chuẩn bị giao lên phòng cho quý khách rồi ạ.",
                "food ready": f"Dạ món ăn của phòng {current_room}{items_desc} đã được nấu xong, đang chuẩn bị giao lên phòng cho quý khách rồi ạ.",
                "delivering": f"Dạ món ăn của phòng {current_room}{items_desc} đang trên đường được giao lên phòng cho quý khách rồi ạ!",
                "completed": f"Dạ đơn món của phòng {current_room}{items_desc} đã hoàn thành và được giao thành công lên phòng rồi ạ. Chúc quý khách ngon miệng!",
                "done": f"Dạ đơn món của phòng {current_room}{items_desc} đã hoàn tất thành công rồi ạ.",
                "cancelled": f"Dạ đơn món của phòng {current_room} đã được hủy{rej_vn} rồi ạ.",
                "rejected": f"Dạ đơn món của phòng {current_room}{items_desc} đã bị nhà bếp từ chối{rej_vn}. Quý khách có muốn chọn món khác trên màn hình để đặt không ạ?",
            }
            st_vn = STATUS_VN_MAP.get(st_norm, st)
            status_reply = ord_map.get(st_food, f"Dạ đơn đặt món của phòng {current_room}{items_desc} hiện {st_vn} ạ.")
    else:
        if is_reject_inquiry:
            status_reply = (
                f"I checked and there are currently no declined kitchen orders for Room {current_room}."
                if is_en else
                f"Dạ em kiểm tra thấy hiện tại phòng {current_room} không có đơn đặt món nào bị nhà bếp từ chối cả ạ."
            )
        else:
            status_reply = (
                f"I checked and there are currently no active kitchen orders for Room {current_room}. Would you like to order something from our menu?"
                if is_en else
                f"Dạ em kiểm tra thấy hiện tại phòng {current_room} không có đơn đặt món nào trong nhà bếp ạ. Quý khách có muốn chọn món trên màn hình để đặt không ạ?"
            )
    # Giữ lại room_number trong session để phục vụ xuyên suốt phiên của khách hiện tại
    if current_room:
        session_manager.set_room_number(session_id, current_room)

    return {
        "missing_room_number": False,
        "room_number": current_room,
        "response": status_reply,
        "destination_key": None,
        "require_room_pin": False,
    }
