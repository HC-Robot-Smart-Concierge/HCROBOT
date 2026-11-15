"""Deterministic intent classification node for concierge conversations."""

import logging
import re
from typing import Any, Dict

from app.services.ai.concierge_state import ConciergeState
from app.services.ai.constants import (
    BELLMAN_MENU_TRIGGER_KEYWORDS,
    SERVICE_KEYWORDS,
    contains_keyword,
)
from app.services.ai.session_manager import extract_room_number, session_manager
from app.services.bell_request_service import is_bell_inquiry
from app.services.maintenance_request_service import is_fault_report

logger = logging.getLogger(__name__)


async def intent_router_node(state: ConciergeState) -> Dict[str, Any]:
    """







    Node 2: Fast Intent Router & Slot Extractor (0ms).







    Phân loại ý định khách hàng tức thì, bóc tách số phòng và quản lý pending intent dịch vụ.







    """
    import re
    session_id = state.get("session_id") or "default_session"
    prompt = state.get("prompt", "")
    # Làm sạch wake-up word Rora ở đầu câu (nếu khách nói kèm mệnh lệnh)
    clean_prompt = re.sub(r'^(?:hey rora|chào rora|chao rora|rora ơi|rora oi|hello rora|hi rora|rora)[\,\.\!\s]*', '', prompt, flags=re.IGNORECASE).strip() or prompt
    prompt_lower = clean_prompt.lower().strip()
    # Kiểm tra xem session có pending_intent đang chờ số phòng không
    pending = session_manager.get_pending_intent(session_id)
    is_answering = bool(pending)
    # 1. Bóc tách nhanh số phòng linh hoạt
    extracted_room = extract_room_number(clean_prompt, is_answering_room=is_answering)
    current_room = state.get("room_number") or session_manager.get_room_number(session_id)
    if extracted_room:
        current_room = extracted_room
        session_manager.set_room_number(session_id, extracted_room)
    # 2. Heuristic nhận diện dịch vụ khách sạn (< 0.1ms) từ centralized constants
    # Ưu tiên số 1: Kiểm tra intent tra cứu tiến độ / trạng thái / lý do từ chối đơn món & dịch vụ
    query_status_kws = SERVICE_KEYWORDS.get("query_order_status", [])
    is_reject_inquiry = any(k in prompt_lower for k in [
        "từ chối", "tu choi", "bị từ chối", "bi tu choi",
        "bị hủy", "bi huy",
        "không nhận", "khong nhan",
        "rejected", "declined", "cancelled"
    ]) or (any(k in prompt_lower for k in [
        "tại sao", "tai sao", "sao lại", "sao lai", "vì sao", "vi sao", "lý do", "ly do", "sao không", "sao"
    ]) and any(k in prompt_lower for k in ["từ chối", "tu choi", "hủy", "huy", "không nhận", "khong nhan", "bỏ", "rejected", "declined", "cancelled"]))
    is_review_order = any(k in prompt_lower for k in [
        "xem lại", "xem lai", "cho tôi xem", "cho toi xem", "cho xem",
        "xem món", "xem mon", "xem đơn", "xem don", "xem đồ", "xem do",
        "món đồ đặc", "mon do dac", "món đồ đạc", "mon do dac",
        "món đã đặt", "mon da dat", "đơn đã đặt", "don da dat", "đồ đã đặt", "do da dat",
        "tôi đã đặt", "toi da dat", "tôi đã gọi", "toi da goi",
        "đã đặt những gì", "da dat nhung gi", "đã gọi những gì", "da goi nhung gi",
        "review order", "show order", "view order", "what did i order", "see what i ordered"
    ])
    is_explicit_order_intent = (not is_reject_inquiry) and (not is_review_order) and any(k in prompt_lower for k in [
        "đặt món", "dat mon", "gọi món", "goi mon", "order món", "order mon",
        "cho tôi gọi", "cho tôi đặt", "muốn gọi", "muốn đặt", "gọi đồ ăn", "đặt đồ ăn",
        "đặt dịch vụ", "dat dich vu", "đặt thêm dịch vụ", "dat them dich vu",
        "dịch vụ lên phòng", "dich vu len phong", "dịch vụ phòng", "dich vu phong",
        "muốn đặt dịch vụ", "muon dat dich vu", "muốn đặt thêm", "muon dat them",
        "thêm dịch vụ", "them dich vu", "yêu cầu dịch vụ"
    ])
    has_status_timing_kw = any(k in prompt_lower for k in [
        "xong chưa", "xong chua", "tới đâu", "toi dau", "đến đâu", "den dau",
        "tiến độ", "tien do", "trạng thái", "trang thai", "khi nào có", "bao giờ có",
        "chờ lâu", "đợi lâu", "nấu xong", "lam xong", "dọn xong", "don xong",
        "dọn tới", "don toi", "dọn đến", "don den",
        "tới phòng chưa", "toi phong chua", "đến phòng chưa", "den phong chua",
        "lên phòng chưa", "len phong chua", "đã lên phòng chưa", "da len phong chua",
        "tới chưa", "toi chua", "đến chưa", "den chua", "mang tới chưa", "mang toi chua",
        "giao tới chưa", "giao toi chua", "có chưa", "co chua", "đã có chưa", "da co chua",
        "đã tới", "da toi", "đã đến", "da den"
    ])
    is_chitchat_mood = bool(re.search(r'\b(tâm trạng|tam trang|cảm xúc|cam xuc|cảm thấy|cam thay|khỏe không|khoe khong|bạn tên là|em tên là|em mấy tuổi)\b', prompt_lower))
    is_query_status = not is_chitchat_mood and (is_reject_inquiry or is_review_order or any(k in prompt_lower for k in query_status_kws)) and (not is_explicit_order_intent or has_status_timing_kw or is_reject_inquiry or is_review_order)
    if is_query_status:
        # Tra cứu trạng thái đơn món & dịch vụ: TUYỆT ĐỐI không dùng số phòng cũ của khách trước
        action = "query_order_status"
        category = "service"
        prompt_inq_check = clean_prompt.lower()
        is_svc_inq_flag = bool(re.search(
            r'\b(dọn|don|dọn dẹp|vệ sinh|ve sinh|khăn|khan|khăn tắm|gối|goi|chăn|chan|buồng|buong|housekeeping|room service|dịch vụ|dich vu|giặt|giat|giặt ủi|massage|mát xa|mat xa|spa|nệm|nem|tiện ích|tien ich)\b',
            prompt_inq_check,
            re.IGNORECASE
        ))
        is_food_inq_flag = bool(re.search(
            r'\b(món|mon|món ăn|mon an|bếp|bep|nấu|nau|chế biến|đồ ăn|do an|cơm|com|phở|pho|pizza|thực đơn|thuc don|thức ăn|thuc an|đồ uống|do uong)\b',
            prompt_inq_check,
            re.IGNORECASE
        )) or bool(re.search(r'\b(ăn|uống|nước|thức uống)\b', prompt_inq_check, re.IGNORECASE))
        if is_bell_inquiry(prompt_inq_check):
            # "Hành lý tôi đem lên chưa" asks about a Bellman request, not the latest food order.
            detected_q_type = "bellman"
        elif is_svc_inq_flag and not is_food_inq_flag:
            detected_q_type = "service"
        elif is_food_inq_flag and not is_svc_inq_flag:
            detected_q_type = "food"
        else:
            detected_q_type = "general"
        if extracted_room:
            current_room = extracted_room
            session_manager.set_room_number(session_id, extracted_room)
            session_manager.clear_pending_intent(session_id)
        elif is_answering and pending and pending.get("action") == "query_order_status":
            current_room = extracted_room or current_room
            if current_room:
                session_manager.set_room_number(session_id, current_room)
            detected_q_type = pending.get("query_type") or detected_q_type
            session_manager.clear_pending_intent(session_id)
        elif current_room:
            # Đã có số phòng trong session (từ đặt món, chọn phòng hoặc chat trước đó) -> Tái sử dụng
            session_manager.clear_pending_intent(session_id)
        else:
            current_room = None
            session_manager.set_pending_intent(session_id, {
                "action": "query_order_status",
                "items": clean_prompt,
                "prompt": clean_prompt,
                "query_type": detected_q_type,
            })
        return {
            "intent_category": category,
            "action": action,
            "items": clean_prompt,
            "query_type": detected_q_type,
            "is_reject_inquiry": is_reject_inquiry,
            "room_number": current_room,
            "session_id": session_id,
        }
    # 3. Phân loại Category & FAQ / Facility / Nearby Exploration Keywords (KHÔNG BAO GIỜ HỎI SỐ PHÒNG NẾU LÀ CÂU HỎI THÔNG TIN)
    faq_keywords = [
        "ở đâu", "mấy giờ", "bao nhiêu", "giá", "thế nào", "có không", 
        "where", "when", "how", "what", "giờ nào", "tầng mấy", "bao xa", 
        "chỉ đường", "đường nào", "hướng nào", "đi vệ sinh", "nhà vệ sinh",
        "đi tới", "di toi", "đi đến", "di den", "tới", "đến", "dẫn đường", "dan duong",
        "lối đi", "loi di", "lối lên", "loi len", "lối xuống", "đường đến", "duong den",
        "đường đi", "duong di", "đường ra", "vị trí", "vi tri", "chỉ tôi", "dẫn tôi", "cách đi", "làm sao để đến", 
        "toilet", "wc", "restroom", "washroom", "phòng vệ sinh",
        "có món gì", "có những gì", "gồm những gì", "những món nào", "xem thực đơn", "xem menu",
        "thực đơn", "menu", "có dịch vụ gì", "chi phí thế nào", "bảng giá", "quy định", "chính sách",
        # Từ khóa khám phá xung quanh, ngoại khu, chợ đêm, danh thắng
        "gần đây", "xung quanh", "quanh đây", "gần khách sạn", "ngoại khu", "chợ đêm", "chợ", 
        "bãi biển", "biển", "tắm biển", "cầu rồng", "hội an", "bà nà", "ngũ hành sơn", "sơn trà",
        "có gì", "có gì chơi", "chơi gì", "ăn gì", "đi đâu", "tham quan", "du lịch", "địa điểm",
        "chỗ nào", "quán ăn", "quán hải sản", "ăn hải sản", "mua sắm", "check in", "checkin", "ngắm cảnh",
        "nearby", "around here", "night market", "attractions", "sightseeing", "places to visit", "beach"
    ]
    has_co_khong = bool(re.search(r"\bcó\b.+\bkhông\b", prompt_lower))
    is_asking_info = any(kw in prompt_lower for kw in faq_keywords) or has_co_khong
    action = None
    if not is_asking_info:
        SERVICE_INTENT_PRIORITY = [
            "cancel_service",
            "taxi",
            "restaurant",
            "concierge",
            "wake_up",
            "laundry",
            "maintenance",
            "bellman",
            "housekeeping",
            "room_service",
        ]
        for act in SERVICE_INTENT_PRIORITY:
            kws = SERVICE_KEYWORDS.get(act, [])
            if contains_keyword(prompt_lower, kws):
                action = act
                break
        # Device + symptom ("tivi không lên hình", "điều hòa chảy nước") is a repair even when
        # food/amenity words such as "nước" also match.
        if action in (None, "room_service", "housekeeping") and is_fault_report(clean_prompt):
            action = "maintenance"
    # "menu hành lý" contains the FAQ word "menu" but asks for the Bellman menu.
    if not action and any(k in prompt_lower for k in BELLMAN_MENU_TRIGGER_KEYWORDS):
        action = "bellman"
    items_text = clean_prompt
    if action:
        category = "service"
        # Nếu đã có số phòng thì xóa pending_intent cũ nếu có
        if current_room:
            session_manager.clear_pending_intent(session_id)
        else:
            # Chưa có số phòng -> Lưu pending_intent để chờ câu sau khách trả lời số phòng
            session_manager.set_pending_intent(session_id, {
                "action": action,
                "items": clean_prompt,
                "prompt": clean_prompt,
            })
    elif extracted_room and pending:
        # Khách vừa bổ sung số phòng cho yêu cầu đang chờ!
        action = pending.get("action")
        items_text = pending.get("items") or pending.get("prompt") or clean_prompt
        query_type_val = pending.get("query_type")
        category = "service"
        session_manager.clear_pending_intent(session_id)
        logger.info(f"[Harness FastRouter] Resolved pending intent '{action}' (type={query_type_val}) with room '{extracted_room}': {items_text}")
        return {
            "intent_category": category,
            "action": action,
            "items": items_text,
            "query_type": query_type_val,
            "room_number": current_room,
            "session_id": session_id,
        }
    elif is_asking_info:
        category = "faq"
        action = "faq"
    elif extracted_room and not action:
        # Khách chỉ nói số phòng, chưa có yêu cầu dịch vụ cụ thể
        action = "provide_room_number"
        category = "service"
    else:
        category = "chitchat"
        action = "chitchat"
    logger.info(f"[Harness FastRouter] session='{session_id}', category='{category}', action='{action}', room='{current_room}'")
    return {
        "intent_category": category,
        "action": action,
        "items": items_text,
        "room_number": current_room,
        "session_id": session_id,
    }
