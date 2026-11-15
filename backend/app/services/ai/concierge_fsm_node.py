"""Service Finite-State Machine (FSM) node for HCRobot Concierge."""

from typing import Any, Dict

from app.services.ai.concierge_order_status_handler import handle_query_order_status
from app.services.ai.concierge_state import ConciergeState
from app.services.ai.constants import (
    BELLMAN_MENU_TRIGGER_KEYWORDS,
    MAINTENANCE_MENU_TRIGGER_KEYWORDS,
    contains_keyword,
    is_lost_found_text,
)
from app.services.ai.session_manager import session_manager
from app.services.bell_request_service import classify_bell_request


async def service_fsm_node(state: ConciergeState) -> Dict[str, Any]:
    """
    Node 4: Service FSM (Finite State Machine Slot-Filling).
    Xử lý nghiệp vụ yêu cầu dịch vụ khách sạn. Kiểm tra ràng buộc số phòng.
    """
    session_id = state.get("session_id") or "default_session"
    action = state.get("action") or "room_service"
    current_room = state.get("room_number") or session_manager.get_room_number(session_id)
    items = state.get("items") or "dịch vụ"
    lang_code = state.get("lang_code", "vi-VN")
    # Trường hợp 1: Khách yêu cầu Live Video Call với Concierge / Nhân viên
    if action == "concierge":
        effective_room = current_room or "Main Lobby Kiosk"
        if lang_code == "en-US":
            call_reply = "Certainly! I am connecting you to a live Concierge specialist via video call right away, please hold on for a moment!"
        else:
            call_reply = "Dạ em đang kết nối cuộc gọi video trực tiếp tới nhân viên Concierge cho quý khách ngay đây ạ, quý khách vui lòng đợi trong giây lát!"
        return {
            "missing_room_number": False,
            "room_number": effective_room,
            "response": call_reply,
            "trigger_video_call": True,
        }
    is_en = (lang_code == "en-US")
    if action == "query_order_status":
        return await handle_query_order_status(state, session_id, current_room, items, is_en)
    user_p_text = (state.get("prompt") or state.get("current_query") or "").lower()
    is_general_mnt_menu_request = contains_keyword(user_p_text, MAINTENANCE_MENU_TRIGGER_KEYWORDS) or \
                                  (action == "maintenance" and contains_keyword((items or "").lower(), MAINTENANCE_MENU_TRIGGER_KEYWORDS))
    if action == "maintenance" and is_general_mnt_menu_request:
        if lang_code == "en-US":
            mnt_reply = f"Certainly! I have opened our Maintenance & Repair menu on screen{f' for Room {current_room}' if current_room else ''}. Please select the issue you are experiencing or track your repair progress!"
        else:
            mnt_reply = f"Dạ em đã mở danh mục Báo hỏng & Sửa chữa trên màn hình{f' cho Phòng {current_room}' if current_room else ''} rồi ạ. Quý khách chạm chọn sự cố hoặc tra cứu tiến độ nhé ạ!"
        return {
            "missing_room_number": False,
            "room_number": current_room,
            "target_room_number": current_room,
            "response": mnt_reply,
            "trigger_menu": "maintenance",
            "action": "open_maintenance_menu",
            "require_room_pin": False,
        }
    # 3b. Bellman: a generic luggage request ("tôi cần hỗ trợ hành lý") or an unknown room opens the
    # touch menu, where the guest picks the service and verifies the room with PIN/NFC. A specific
    # request for a known room ("mang hành lý lên phòng") falls through and becomes a ticket.
    bell_text = user_p_text or (items or "").lower()  # the stream endpoint passes only "items"
    if action == "bellman" and not is_lost_found_text(bell_text) and (
        not current_room
        or any(k in bell_text for k in BELLMAN_MENU_TRIGGER_KEYWORDS)
        or not classify_bell_request(bell_text)
    ):
        session_manager.clear_pending_intent(session_id)  # The menu collects the room itself.
        room_part_en = f" for Room {current_room}" if current_room else ""
        room_part_vi = f" cho Phòng {current_room}" if current_room else ""
        bell_reply = (
            f"I have opened the Luggage & Bell Services menu{room_part_en}. Please choose the service you need."
            if lang_code == "en-US" else
            f"Dạ em đã mở danh mục Hành lý & Bellman{room_part_vi} trên màn hình. Quý khách chạm chọn dịch vụ cần hỗ trợ nhé ạ!"
        )
        return {
            "missing_room_number": False,
            "room_number": current_room,
            "target_room_number": current_room,
            "response": bell_reply,
            "trigger_menu": "bellman",
            "action": "open_bellman_menu",
            "require_room_pin": False,
        }
    # Trường hợp 3: Khách chỉ cung cấp/giới thiệu số phòng (không có yêu cầu dịch vụ cụ thể)
    if action == "provide_room_number":
        # Kiểm tra check-in ngay khi khách giới thiệu phòng
        from app.services.ai import concierge_graph as _cg
        room_check = await _cg.query_room_order_status_db(current_room or "", is_en=is_en)
        if not room_check.get("is_occupied"):
            return {
                "missing_room_number": False,
                "room_number": current_room,
                "response": room_check.get("message", "Phòng chưa check-in. Quý khách vui lòng qua quầy lễ tân ạ."),
                "destination_key": room_check.get("destination_key", "front_desk"),
            }
        if is_en:
            intro_reply = f"Hello guest from Room {current_room}! Rora has remembered your room number. How may I assist you today?"
        else:
            intro_reply = f"Dạ Rora xin chào quý khách ở Phòng {current_room} ạ! Rora đã ghi nhớ số phòng của quý khách rồi ạ. Em có thể hỗ trợ dịch vụ gì cho quý khách ạ?"
        return {
            "missing_room_number": False,
            "room_number": current_room,
            "response": intro_reply,
        }
    # Trường hợp 4: Yêu cầu dịch vụ liên quan phòng nhưng CHƯA CÓ SỐ PHÒNG -> Bắt buộc hỏi khách số phòng!
    if not current_room:
        if action == "maintenance":
            if is_en:
                mnt_ask_reply = "I have opened the Maintenance & Repair menu on screen for you. Please select the issue you are experiencing and enter your room number!"
            else:
                mnt_ask_reply = "Dạ em đã mở danh mục Báo hỏng & Sửa chữa trên màn hình rồi ạ. Quý khách vui lòng chạm chọn sự cố và nhập số phòng của mình nhé ạ!"
            return {
                "missing_room_number": True,
                "room_number": None,
                "target_room_number": None,
                "response": mnt_ask_reply,
                "trigger_menu": "maintenance",
                "action": "open_maintenance_menu",
                "require_room_pin": False,
            }
        if is_en:
            action_en_map = {
                "room_service": "room service and dining",
                "housekeeping": "housekeeping services",
                "bellman": "luggage assistance",
                "maintenance": "maintenance support",
                "restaurant": "restaurant reservation",
                "taxi": "taxi booking",
                "reception": "front desk services",
                "laundry": "laundry and dry cleaning services",
                "wake_up": "wake-up call scheduling",
                "cancel_service": "cancelling your request",
            }
            action_en = "lost and found item report" if (action == "bellman" and any(k in (items or "").lower() for k in ["thất lạc", "that lac", "mất đồ", "mat do", "quên đồ", "quen do", "rơi đồ", "roi do", "lost", "missing", "forgot"])) else action_en_map.get(action, "this service")
            ask_reply = f"Certainly! I would be glad to help you with {action_en}. Could you please let me know your room number?"
        else:
            action_vn_map = {
                "room_service": "đồ ăn, thức uống và phục vụ phòng",
                "housekeeping": "dọn phòng và tiện ích buồng phòng",
                "bellman": "hỗ trợ hành lý",
                "maintenance": "bộ phận kỹ thuật sửa chữa",
                "restaurant": "đặt bàn nhà hàng",
                "taxi": "đặt xe taxi và di chuyển",
                "reception": "dịch vụ lễ tân tiền sảnh",
                "laundry": "dịch vụ giặt ủi buồng phòng",
                "wake_up": "đặt lịch báo thức",
                "cancel_service": "hủy yêu cầu dịch vụ",
            }
            action_vn = "báo cáo và tìm kiếm đồ thất lạc" if (action == "bellman" and any(k in (items or "").lower() for k in ["thất lạc", "that lac", "mất đồ", "mat do", "quên đồ", "quen do", "rơi đồ", "roi do", "lost", "missing", "forgot"])) else action_vn_map.get(action, "dịch vụ")
            ask_reply = f"Dạ em sẽ hỗ trợ {action_vn} cho quý khách ngay ạ! Quý khách vui lòng cho em xin số phòng của mình là bao nhiêu ạ?"
        return {
            "missing_room_number": True,
            "room_number": None,
            "response": ask_reply,
        }
    # 1. Kiểm tra yêu cầu mở menu thực đơn món ăn / ẩm thực nhà bếp (Food & Dining Menu)
    is_general_food_menu_request = any(k in (items or "").lower() for k in [
        "thực đơn", "thuc don", "menu món", "menu do an", "menu đồ ăn",
        "đặt món", "dat mon", "gọi món", "goi mon", "chọn món", "chon mon",
        "món ăn", "mon an", "đồ ăn", "do an", "menu ẩm thực", "menu nhà bếp", "dining menu"
    ])
    if action == "room_service" and is_general_food_menu_request:
        if lang_code == "en-US":
            food_reply = f"Certainly! I have opened our In-Room Dining Menu on screen for Room {current_room}. Please browse and choose your favorite dishes and drinks!"
        else:
            food_reply = f"Dạ em đã mở Thực đơn chọn món trên màn hình cho Phòng {current_room} rồi ạ. Quý khách chạm chọn món ăn và đồ uống yêu thích nhé ạ!"
        return {
            "missing_room_number": False,
            "room_number": current_room,
            "target_room_number": current_room,
            "response": food_reply,
            "trigger_menu": "food_menu",
            "action": "open_food_menu",
            "require_room_pin": False,
        }
    # 2. Kiểm tra yêu cầu mở menu / tiện ích & dịch vụ buồng phòng tổng quát (Room Service & Amenities)
    is_general_svc_menu_request = any(k in (items or "").lower() for k in [
        "đặt dịch vụ", "dat dich vu", "dịch vụ lên phòng", "dich vu len phong",
        "đặt thêm dịch vụ", "dat them dich vu", "thêm dịch vụ", "them dich vu",
        "dịch vụ phòng", "dich vu phong", "tiện ích phòng", "room service"
    ])
    if action in ["room_service", "housekeeping", "laundry"] and is_general_svc_menu_request:
        if lang_code == "en-US":
            svc_reply = f"Certainly! I have opened our Room Service menu on screen for Room {current_room}. Please browse and choose your favorite items!"
        else:
            svc_reply = f"Dạ em đã mở danh mục Dịch vụ phòng trên màn hình cho Phòng {current_room} rồi ạ. Quý khách chạm chọn khăn tắm, massage spa hoặc giặt ủi nhé ạ!"
        return {
            "missing_room_number": False,
            "room_number": current_room,
            "target_room_number": current_room,
            "response": svc_reply,
            "trigger_menu": "room_service",
            "action": "open_room_service_menu",
            "require_room_pin": False,
        }
    # Kiểm tra phòng đã check-in chưa trước khi cho phép đặt dịch vụ
    from app.services.ai import concierge_graph as _cg
    room_check_order = await _cg.query_room_order_status_db(current_room, is_en=is_en)
    if not room_check_order.get("is_occupied"):
        return {
            "missing_room_number": False,
            "room_number": current_room,
            "response": room_check_order.get("message", "Phòng chưa check-in. Quý khách vui lòng qua quầy lễ tân ạ."),
            "destination_key": room_check_order.get("destination_key", "front_desk"),
        }
    # Trường hợp 4: Đã có đủ số phòng và có yêu cầu dịch vụ -> Xác nhận gửi tới đúng phòng ban kèm số phòng
    DEPT_MAP_VI = {
        "housekeeping": "buồng phòng và dọn dẹp",
        "room_service": "ẩm thực và đồ ăn",
        "bellman": "hành lý",
        "maintenance": "kỹ thuật và sửa chữa",
        "restaurant": "đặt bàn nhà hàng",
        "taxi": "đặt xe taxi",
        "reception": "lễ tân",
        "laundry": "giặt ủi",
        "wake_up": "báo thức",
        "cancel_service": "hủy yêu cầu dịch vụ",
    }
    DEPT_MAP_EN = {
        "housekeeping": "Housekeeping Department",
        "room_service": "Food & Beverage (Room Service)",
        "bellman": "Bell Services Department",
        "maintenance": "Maintenance & Engineering",
        "restaurant": "Restaurant & F&B Department",
        "taxi": "Transportation & Taxi Desk",
        "reception": "Front Desk & Reception",
        "laundry": "Laundry & Housekeeping Department",
        "wake_up": "Front Desk & Telephone Operator",
        "cancel_service": "Operations & Service Dispatch",
    }
    dept_name = ("Lost & Found / Bell Services Department" if lang_code == "en-US" else "báo cáo đồ thất lạc và hỗ trợ tiền sảnh") if (action == "bellman" and any(k in (items or "").lower() for k in ["thất lạc", "that lac", "mất đồ", "mat do", "quên đồ", "quen do", "rơi đồ", "roi do", "lost", "missing", "forgot"])) else (DEPT_MAP_EN if lang_code == "en-US" else DEPT_MAP_VI).get(action, "chuyên trách")
    is_authenticated = bool(state.get("is_room_authenticated", False))
    if action == "cancel_service":
        if lang_code == "en-US":
            confirm_reply = f"Rora has received your cancellation request for Room {current_room}. The relevant department has been notified to cancel your request immediately!"
        else:
            confirm_reply = f"Dạ Rora đã tiếp nhận yêu cầu hủy dịch vụ cho Phòng {current_room} rồi ạ! Em đã gửi thông báo tới các bộ phận liên quan ngay lập tức."
        return {
            "missing_room_number": False,
            "room_number": current_room,
            "response": confirm_reply,
            "require_room_pin": False,
            "target_room_number": current_room,
            "pending_service_action": action,
            "pending_service_items": items,
        }
    elif is_authenticated:
        # Phiên đã được xác thực mã PIN phòng trước đó -> Tiếp nhận ngay, không bắt nhập lại PIN
        if action in ["taxi", "book_taxi"]:
            if lang_code == "en-US":
                confirm_reply = f"Room {current_room}. Would you like our partner taxi hotlines to book directly, or would you like Concierge to arrange a taxi for you?"
            else:
                confirm_reply = f"Dạ phòng {current_room}. Quý khách muốn tự gọi xe taxi theo số điện thoại đối tác hay nhờ bộ phận Concierge đặt xe giùm quý khách ạ?"
            return {
                "missing_room_number": False,
                "room_number": current_room,
                "response": confirm_reply,
                "require_room_pin": False,
                "target_room_number": current_room,
                "pending_service_action": "book_taxi",
                "action": "book_taxi",
                "pending_service_items": items,
            }
        else:
            if lang_code == "en-US":
                confirm_reply = f"Rora has received your {dept_name} request for Room {current_room} and notified the team immediately!"
            else:
                confirm_reply = f"Dạ Rora đã tiếp nhận yêu cầu {dept_name} cho Phòng {current_room} rồi ạ! Em đã gửi thông báo tới các bộ phận liên quan ngay lập tức."
            return {
                "missing_room_number": False,
                "room_number": current_room,
                "response": confirm_reply,
                "require_room_pin": False,
                "target_room_number": current_room,
                "pending_service_action": action,
                "pending_service_items": items,
            }
    elif action in ["taxi", "book_taxi"]:
        if lang_code == "en-US":
            confirm_reply = f"To assist with taxi booking for Room {current_room}, please enter your 4-digit room PIN on the touchscreen."
        else:
            confirm_reply = f"Dạ để hỗ trợ đặt xe taxi cho Phòng {current_room}, quý khách vui lòng nhập mã PIN phòng gồm 4 số trên màn hình cảm ứng nhé ạ."
        return {
            "missing_room_number": False,
            "room_number": current_room,
            "response": confirm_reply,
            "require_room_pin": True,
            "target_room_number": current_room,
            "pending_service_action": "book_taxi",
            "action": "book_taxi",
            "pending_service_items": items,
        }
    elif lang_code == "en-US":
        confirm_reply = f"To confirm your {dept_name} request for Room {current_room}, please enter your 4-digit room PIN on the touchscreen."
    else:
        confirm_reply = f"Dạ để xác nhận yêu cầu {dept_name} cho Phòng {current_room}, quý khách vui lòng nhập mã PIN phòng gồm 4 số trên màn hình cảm ứng nhé ạ."
    return {
        "missing_room_number": False,
        "room_number": current_room,
        "response": confirm_reply,
        "require_room_pin": True,
        "target_room_number": current_room,
        "pending_service_action": action,
        "pending_service_items": items,
    }
