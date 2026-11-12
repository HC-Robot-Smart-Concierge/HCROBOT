import re
from datetime import datetime, timezone

from app.services.bell_request_service import bell_status_reply, classify_bell_request, is_bell_inquiry
from app.services.maintenance_request_service import is_fault_report







"""







Concierge Graph: LangGraph-powered Agent Harness for HCRobot Concierge.







Quản lý luồng xử lý tinh gọn (Fast-Path -> Direct Conversational Generator).







Đã gỡ bỏ hoàn toàn RAG (ChromaDB/BGE-M3) và bộ định tuyến bóc tách vé dịch vụ (Ticket Dispatching).







"""























import logging







from typing import Dict, Any, List, Optional, cast







from typing_extensions import TypedDict















from langgraph.graph import StateGraph, START, END







from langgraph.graph.state import CompiledStateGraph







from langgraph.checkpoint.memory import MemorySaver















from app.services.ai.session_manager import session_manager, extract_room_number
from app.services.ai.constants import (
    SERVICE_KEYWORDS,
    MAINTENANCE_MENU_TRIGGER_KEYWORDS,
    BELLMAN_MENU_TRIGGER_KEYWORDS,
    is_lost_found_text,
    MAINTENANCE_REGEX,
    HOUSEKEEPING_REGEX,
    ROOM_SERVICE_FOOD_REGEX,
    contains_keyword,
)







from app.services.ai.ollama_service import ollama_service















logger = logging.getLogger(__name__)























class ConciergeState(TypedDict, total=False):







    """







    Trạng thái hội thoại trung tâm (Central Agent State) do LangGraph Harness quản lý.







    """







    session_id: str







    prompt: str
    current_query: Optional[str]







    language: Optional[str]







    lang_name: str







    lang_code: str







    emotion: Optional[str]







    room_number: Optional[str]







    chat_history: List[Dict[str, str]]







    fast_path_hit: bool







    intent_category: str       # 'fast_path' | 'conversation'







    action: Optional[str]







    items: Optional[str]







    rag_context: Optional[str]







    missing_room_number: bool







    ticket_code: Optional[str]







    trigger_video_call: Optional[bool]







    destination_key: Optional[str]







    response: str







    require_room_pin: Optional[bool]







    target_room_number: Optional[str]







    pending_service_action: Optional[str]







    pending_service_items: Optional[str]







    status_query_type: Optional[str]







    query_type: Optional[str]







    is_room_authenticated: Optional[bool]
    trigger_menu: Optional[str]























# ============================================================================







# 1. GRAPH NODES (Các mắt xích xử lý trong Harness)







# ============================================================================















async def fast_path_node(state: ConciergeState) -> Dict[str, Any]:







    """







    Node 1: Dynamic Fast-Path Rule Engine.







    Kiểm tra nhanh các câu hỏi thường gặp, lời chào, pass wifi, tiện ích từ RAM Cache (<1ms).







    Do Admin cấu hình động qua API Scenarios. Không gọi LLM.







    """







    prompt = state.get("prompt", "")







    language = state.get("language")







    session_id = state.get("session_id") or "default_session"

    # 0. Ưu tiên kiểm tra trực tiếp Fast-Path cho lệnh chuyển đổi ngôn ngữ giao tiếp
    early_fast_hit = ollama_service.check_fast_path_full(prompt, language)
    if early_fast_hit and early_fast_hit[3] == "switch_language":
        reply, lang_name, lang_code, action_type, action_payload = early_fast_hit
        session_manager.set_language(session_id, lang_name)
        logger.info(f"[Harness FastPath] Language switch command detected -> '{lang_name}' in <1ms")
        return {
            "fast_path_hit": True,
            "response": reply,
            "lang_name": lang_name,
            "lang_code": lang_code,
            "language": lang_name,
            "intent_category": "fast_path",
            "action": action_type,
            "destination_key": None,
            "trigger_video_call": False,
            "trigger_menu": None,
        }















    # Nếu session đang chờ số phòng cho yêu cầu dịch vụ trước đó -> Bỏ qua fast-path để intent_router bóc tách số phòng







    pending = session_manager.get_pending_intent(session_id)







    if pending:







        logger.info(f"[Harness FastPath Bypass] Session '{session_id}' has pending intent '{pending.get('action')}', bypassing fast-path for: '{prompt}'")







        if not language or language.lower() in ["auto", ""]:







            lang_name, lang_code = ollama_service.detect_language(prompt)







        else:







            lang_name = language







            lang_code = "en-US" if (language.lower().startswith("en") or "english" in language.lower()) else "vi-VN"







        return {







            "fast_path_hit": False,







            "lang_name": lang_name,







            "lang_code": lang_code,







        }















    # Nếu khách yêu cầu dịch vụ phòng thực tế (Actionable Service Request) -> Bỏ qua fast-path để intent_router & service_fsm xử lý







    prompt_lower_fp = prompt.lower()







    is_service_action = any(
        any(re.search(rf'\b{re.escape(k)}\b', prompt_lower_fp) for k in kws)
        for act, kws in SERVICE_KEYWORDS.items()
        if act not in ["chitchat", "faq"]
    )







    faq_kws_fp = [
        "ở đâu", "o dau", "mấy giờ", "may gio", "bao nhiêu", "bao nhieu", "giá", "gia", "thế nào", "the nao", "có không", "co khong",
        "where", "when", "how", "what", "giờ nào", "tầng mấy", "tang may", "bảng giá", "quy định", "chính sách",
        "đi tới", "di toi", "đi đến", "di den", "tới", "toi", "đến", "den", "chỉ đường", "chi duong",
        "dẫn đường", "dan duong", "hướng dẫn đường", "lối đi", "loi di", "lối lên", "loi len", "lối xuống", "loi xuong",
        "đường đến", "duong den", "đường đi", "duong di", "đường ra", "duong ra", "vị trí", "vi tri", "chỉ tôi", "chi toi",
        "dẫn tôi", "dan toi", "cách đi", "cach di", "làm sao để đến", "lam sao de den"
    ]







    is_asking_info_fp = any(k in prompt_lower_fp for k in faq_kws_fp)







    stored_room_fp = state.get("room_number") or session_manager.get_room_number(session_id)







    pending_fp = session_manager.get_pending_intent(session_id)















    is_actionable_call = bool(re.search(







        r'(cho (tôi|mình|em)|xin|lấy|mang|đem|gửi|thêm|mượn|cần|muốn|đặt|yêu cầu|order|bring|send|give me|need)\b',







        prompt_lower_fp,







        re.IGNORECASE







    )) or any(k in prompt_lower_fp for k in ['đặt dịch vụ', 'dat dich vu', 'dịch vụ lên phòng', 'dich vu len phong', 'thêm dịch vụ', 'them dich vu', 'dịch vụ phòng', 'dich vu phong', 'hỗ trợ hành lý', 'ho tro hanh ly', 'mang hành lý', 'gửi hành lý', 'xách đồ', 'chuyển phòng', 'báo mất đồ', 'bao mat do', 'đồ thất lạc', 'do that lac', 'thất lạc', 'that lac', 'mất đồ', 'mat do', 'quên đồ', 'quen do', 'rơi đồ', 'roi do', 'lost item', 'lost and found', 'luggage assistance'])















    query_status_kws_fp = SERVICE_KEYWORDS.get("query_order_status", [])



    is_reject_inquiry_fp = any(k in prompt_lower_fp for k in [



        "từ chối", "tu choi", "bị từ chối", "bi tu choi",



        "bị hủy", "bi huy",



        "không nhận", "khong nhan",



        "rejected", "declined", "cancelled",



        "lý do", "ly do", "tại sao", "tai sao", "vì sao", "vi sao", "sao lại"



    ]) and any(k in prompt_lower_fp for k in ["từ chối", "tu choi", "hủy", "huy", "không nhận", "khong nhan", "bỏ", "rejected", "declined", "cancelled"])



    is_query_status_fp = any(k in prompt_lower_fp for k in query_status_kws_fp) or is_reject_inquiry_fp







    # Bỏ qua Fast-Path nếu có pending intent, hoặc tra cứu tiến độ đơn món/dịch vụ, hoặc yêu cầu hành động dịch vụ



    if pending_fp or is_query_status_fp or is_reject_inquiry_fp or (is_service_action and not is_asking_info_fp and (is_actionable_call or not stored_room_fp)):







        if not language or language.lower() in ["auto", ""]:







            lang_name, lang_code = ollama_service.detect_language(prompt)







        else:







            lang_name = language







            lang_code = "en-US" if (language.lower().startswith("en") or "english" in language.lower()) else "vi-VN"







        return {







            "fast_path_hit": False,







            "lang_name": lang_name,







            "lang_code": lang_code,







        }















    fast_hit = ollama_service.check_fast_path_full(prompt, language)







    if fast_hit:







        reply = fast_hit[0]







        lang_name = fast_hit[1]







        lang_code = fast_hit[2]







        action_type = fast_hit[3] if len(fast_hit) > 3 else None







        action_payload = fast_hit[4] if len(fast_hit) > 4 else None















        dest_key = action_payload.get("destination_key") if isinstance(action_payload, dict) else None
        if action_payload and action_payload.get("invalid_room"):
            return {
                "fast_path_hit": True,
                "response": reply,
                "lang_name": lang_name,
                "lang_code": lang_code,
                "language": lang_name,
                "intent_category": "fast_path",
                "action": action_type or "conversation",
                "destination_key": None,
                "current_room": None,
                "trigger_video_call": False,
                "trigger_menu": None,
            }







        eye_expr = action_payload.get("eye_expression") if isinstance(action_payload, dict) else None







        is_vc = action_type in ["trigger_video_call", "call_reception"]



        trigger_menu = None



        if action_type == "open_food_menu":



            trigger_menu = "food_menu"



        elif action_type == "open_room_service_menu":

            trigger_menu = "room_service"

        elif action_type == "open_maintenance_menu":

            trigger_menu = "maintenance"

        elif action_type == "open_bellman_menu":

            trigger_menu = "bellman"

        elif isinstance(action_payload, dict) and action_payload.get("trigger_menu"):

            trigger_menu = action_payload.get("trigger_menu")

        elif action_type == "switch_language":

            session_manager.set_language(session_id, lang_name)







        logger.info(f"[Harness FastPath] Matched dynamic scenario! Fast response in <1ms for: '{prompt[:30]}...' (eye: {eye_expr}, action: {action_type})")







        return {







            "fast_path_hit": True,







            "response": reply,







            "lang_name": lang_name,







            "lang_code": lang_code,







            "intent_category": "fast_path",







            "action": action_type or "fast_path",







            "destination_key": dest_key,







            "eye_expression": eye_expr,







            "trigger_video_call": is_vc,







            "trigger_menu": trigger_menu,







            "missing_room_number": False,
            "room_number": (action_payload.get("target_room_number") if isinstance(action_payload, dict) else None) or state.get("room_number"),
            "target_room_number": (action_payload.get("target_room_number") if isinstance(action_payload, dict) else None) or state.get("room_number"),







        }















    # Tự động nhận diện ngôn ngữ nếu chưa có







    if not language or language.lower() in ["auto", ""]:







        lang_name, lang_code = ollama_service.detect_language(prompt)







    else:







        lang_name = language







        lang_code = "en-US" if (language.lower().startswith("en") or "english" in language.lower()) else "vi-VN"















    return {







        "fast_path_hit": False,







        "lang_name": lang_name,







        "lang_code": lang_code,







    }























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























async def retrieval_node(state: ConciergeState) -> Dict[str, Any]:







    """







    Node 3: Context Retrieval & Pruning (Tối ưu hóa Context cho LLM).







    Truy vấn ChromaDB Vector Store lấy ngữ cảnh tri thức phù hợp nhất bằng Hybrid Search.







    """







    # Nếu client đã gửi kèm rag_context sẵn thì giữ nguyên







    existing_ctx = state.get("rag_context")







    if existing_ctx:







        return {"rag_context": existing_ctx}















    prompt = state.get("prompt", "")







    rag_context = ""







    try:







        from app.services.rag.chroma import query_rag_context







        rag_context = await query_rag_context(prompt, n_results=4)







        if rag_context:







            logger.info(f"[Harness Retrieval] Retrieved {len(rag_context)} chars of RAG context via Hybrid Search.")







    except Exception as ex:







        logger.warning(f"[Harness Retrieval Warning] Không thể truy vấn ChromaDB: {ex}")















    return {"rag_context": rag_context}































async def query_room_order_status_db(room_num: str, is_en: bool = False, is_reject_inquiry: bool = False) -> Dict[str, Any]:







    """Helper truy vấn CSDL trạng thái phòng và đơn hàng F&B / dịch vụ gần nhất."""







    import re







    from sqlalchemy import select, desc, or_







    from sqlalchemy.orm import selectinload







    from app.core.database import AsyncSessionLocal







    from app.models.hotel import Room







    from app.models.room_service import RoomServiceOrder







    from app.models.support_request import SupportRequest















    clean_room = re.sub(r'[^0-9A-Za-z]', '', room_num).strip()







    if not clean_room:







        return {"exists": False, "is_occupied": False, "message": "Số phòng không hợp lệ."}















    try:







        async with AsyncSessionLocal() as db:







            stmt = select(Room).where((Room.room_number == clean_room) | (Room.id == clean_room))







            res = await db.execute(stmt)







            room = res.scalars().first()















            if not room:







                msg = f"Room {clean_room} does not exist in the hotel system." if is_en else f"Dạ phòng {clean_room} không tồn tại trên hệ thống khách sạn ạ."







                return {"exists": False, "is_occupied": False, "message": msg}















            if room.status != "OCCUPIED":







                msg = (







                    f"Room {room.room_number} is currently not checked in. Please visit the Front Desk reception to complete check-in before ordering services."







                    if is_en else







                    f"Dạ phòng {room.room_number} hiện chưa làm thủ tục nhận phòng. Quý khách vui lòng qua quầy Lễ tân để check-in rồi mới được đặt món nhé ạ."







                )







                return {







                    "exists": True,







                    "is_occupied": False,







                    "room_number": room.room_number,







                    "destination_key": "front_desk",







                    "message": msg,







                }















            # Tạo danh sách các biến thể số phòng để query linh hoạt



            room_clean_num = clean_room



            room_actual_num = room.room_number or clean_room



            room_variants = {



                room_actual_num,



                room_clean_num,



                f"Room {room_clean_num}",



                f"ROOM {room_clean_num}",



                f"Phòng {room_clean_num}",



                f"PHÒNG {room_clean_num}",



            }



            if room.id:



                room_variants.add(room.id)







            # Các trạng thái đang hoạt động (chưa hoàn tất/hủy)



            ACTIVE_STATUS_SET = {
                "pending", "waiting", "unassigned", "chờ tiếp nhận", "chờ xử lý",
                "calling", "đang gọi", "driver assigned", "on the way",
                "sent to kitchen", "sent_to_kitchen", "đã chuyển bếp",
                "cooking", "in preparation", "in_progress", "in progress", "bếp đang nấu", "đang xử lý",
                "ready", "food ready", "món đã nấu xong", "sẵn sàng",
                "delivering", "in transit", "đang giao", "đang giao phòng", "đang mang lên"
            }







            # Tìm danh sách đơn RoomServiceOrder



            stmt_order = (



                select(RoomServiceOrder)



                .options(selectinload(RoomServiceOrder.order_items))



                .where(



                    or_(



                        RoomServiceOrder.room_number.in_(room_variants),



                        RoomServiceOrder.room_number.ilike(f"%{room_clean_num}%"),



                        (RoomServiceOrder.room_id == room.id) if room.id else (RoomServiceOrder.room_id == -1),



                    )



                )



                .order_by(desc(RoomServiceOrder.created_at))



                .limit(10)



            )



            res_order = await db.execute(stmt_order)



            recent_orders = res_order.scalars().all()







            # Tìm danh sách yêu cầu SupportRequest



            stmt_req = (



                select(SupportRequest)



                .where(



                    or_(



                        SupportRequest.room_number.in_(room_variants),



                        SupportRequest.room_number.ilike(f"%{room_clean_num}%"),



                        (SupportRequest.room_id == room.id) if room.id else (SupportRequest.room_id == -1),



                    )



                )



                .order_by(desc(SupportRequest.created_at))



                .limit(10)



            )



            res_req = await db.execute(stmt_req)



            recent_requests = res_req.scalars().all()







            food_orders_list: List[Dict[str, Any]] = []



            service_orders_list: List[Dict[str, Any]] = []







            for ord_item in recent_orders:
                items_summary = ""
                if ord_item.order_items:
                    items_summary = ", ".join([f"{it.quantity}x {it.item_name}" for it in ord_item.order_items if it.item_name])
                elif (ord_item.status or "").lower().strip() in ["rejected", "cancelled"]:
                    items_summary = ""
                elif ord_item.note:
                    items_summary = ord_item.note

                cur_status = ord_item.status or "Pending"
                reject_reason = ord_item.note or ""

                # Đồng bộ trạng thái nếu SupportRequest liên kết đã hoàn tất, hủy hoặc từ chối
                matching_req = next(
                    (
                        r for r in recent_requests
                        if (ord_item.support_request_id and r.id == ord_item.support_request_id)
                        or (r.id == ord_item.id)
                        or (r.ticket_code and ord_item.order_number and ord_item.order_number in r.ticket_code)
                    ),
                    None
                )
                if matching_req and matching_req.status:
                    req_st = matching_req.status.strip()
                    req_st_lower = req_st.lower()
                    cur_st_lower = cur_status.lower()
                    if cur_st_lower in ("pending", "waiting", "unassigned") and req_st_lower not in ("pending", "waiting", "unassigned"):
                        cur_status = req_st
                        if req_st_lower in ("rejected", "cancelled"):
                            reject_reason = (
                                (matching_req.extra_data or {}).get("reject_reason")
                                or (matching_req.extra_data or {}).get("reason")
                                or matching_req.description
                                or reject_reason
                            )
                        try:
                            if ord_item.status != req_st:
                                ord_item.status = req_st
                                ord_item.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
                        except Exception:
                            pass

                # Lọc đơn chờ quá hạn (> 12 giờ): đơn pending từ hôm qua xem như hết hạn/hủy
                now_utc = datetime.now(timezone.utc).replace(tzinfo=None)
                if ord_item.created_at and (now_utc - ord_item.created_at).total_seconds() > 12 * 3600:
                    if cur_status.lower() in ("pending", "waiting", "unassigned"):
                        cur_status = "Cancelled"

                data_entry = {
                    "order_number": ord_item.order_number,
                    "status": cur_status,
                    "created_at": ord_item.created_at,
                    "items_summary": items_summary,
                    "is_service_request": ord_item.is_service_request,
                    "progress": ord_item.progress or 0,
                    "note": ord_item.note or "",
                    "reject_reason": reject_reason,
                    "source_id": ord_item.id,
                }

                if ord_item.is_service_request:



                    service_orders_list.append(data_entry)



                else:



                    food_orders_list.append(data_entry)







            # Phân loại thêm từ SupportRequest nếu đơn tạo qua AI Chat hoặc kênh ngoài



            for req_item in recent_requests:



                t_code = req_item.ticket_code or req_item.id or ""



                # Bỏ qua nếu đã có trong danh sách từ RoomServiceOrder



                if any(t_code and (t_code in (fo.get("order_number") or "") or (fo.get("order_number") or "") in t_code or t_code == fo.get("source_id")) for fo in food_orders_list):



                    continue



                if any(t_code and (t_code in (so.get("order_number") or "") or (so.get("order_number") or "") in t_code or t_code == so.get("source_id")) for so in service_orders_list):



                    continue







                items_summary = req_item.title or ""



                if req_item.items and isinstance(cast(Any, req_item.items), list):



                    it_names = [f"{it.get('qty', 1)}x {it.get('name', '')}" for it in req_item.items if isinstance(cast(Any, it), dict) and it.get('name')]



                    if it_names:



                        items_summary = ", ".join(it_names)







                sr_reject = (



                    (req_item.extra_data or {}).get("reject_reason")



                    or (req_item.extra_data or {}).get("reason")



                    or req_item.description



                    or ""



                )



                sr_entry = {



                    "order_number": req_item.ticket_code,



                    "status": req_item.status or "Pending",



                    "created_at": req_item.created_at,



                    "items_summary": items_summary,



                    "progress": req_item.progress or 0,



                    "note": req_item.description or "",



                    "reject_reason": sr_reject,



                    "source_id": req_item.id,



                }







                dep_up = (req_item.department_id or "").upper()



                svc_up = (req_item.service_type_id or "").upper()



                tit_low = (req_item.title or "").lower()







                is_food_sr = False



                if any(k in dep_up for k in ["ROOMSERVICE", "F&B", "FB", "KITCHEN"]):



                    if not any(k in tit_low for k in ["dọn", "vệ sinh", "khăn", "gối", "chăn", "buồng"]):



                        is_food_sr = True



                elif any(k in svc_up for k in ["ROOM-SERVICE", "FOOD", "RESTAURANT"]):



                    is_food_sr = True



                elif req_item.items and len(req_item.items) > 0 and not any(k in tit_low for k in ["dọn", "vệ sinh"]):



                    is_food_sr = True







                if is_food_sr:



                    sr_entry["is_service_request"] = False



                    food_orders_list.append(sr_entry)



                else:



                    sr_entry["is_service_request"] = True



                    service_orders_list.append(sr_entry)







            # TÁCH ĐƠN ĐANG ACTIVE, ĐƠN REJECTED VÀ ĐƠN ĐÃ HOÀN THÀNH / HỦY



            REJECT_STATUS_SET = {"rejected", "cancelled", "declined", "từ chối", "đã hủy"}



            rejected_food = [f for f in food_orders_list if (f.get("status") or "").lower().strip() in REJECT_STATUS_SET]



            rejected_service = [s for s in service_orders_list if (s.get("status") or "").lower().strip() in REJECT_STATUS_SET]



            all_rejected = rejected_food + rejected_service



            all_rejected.sort(key=lambda x: x.get("created_at") or datetime.min, reverse=True)



            latest_rejected_data = all_rejected[0] if all_rejected else None



            latest_rejected_food = rejected_food[0] if rejected_food else None



            latest_rejected_service = rejected_service[0] if rejected_service else None







            active_food = [f for f in food_orders_list if (f.get("status") or "").lower().strip() in ACTIVE_STATUS_SET]



            completed_food = [f for f in food_orders_list if (f.get("status") or "").lower().strip() not in ACTIVE_STATUS_SET]



            active_service = [s for s in service_orders_list if (s.get("status") or "").lower().strip() in ACTIVE_STATUS_SET]



            completed_service = [s for s in service_orders_list if (s.get("status") or "").lower().strip() not in ACTIVE_STATUS_SET]







            # Nếu hỏi lý do từ chối: ưu tiên đơn bị từ chối gần nhất



            if is_reject_inquiry and latest_rejected_data:



                latest_food_data = latest_rejected_food if latest_rejected_food else (active_food[0] if active_food else (completed_food[0] if completed_food else None))



                latest_service_data = latest_rejected_service if latest_rejected_service else (active_service[0] if active_service else (completed_service[0] if completed_service else None))



                order_data = latest_rejected_data



            else:



                if active_food and completed_food:
                    t_act = active_food[0].get("created_at") or datetime.min
                    t_comp = completed_food[0].get("created_at") or datetime.min
                    # Nếu đơn active mới hơn hoặc bằng đơn hoàn tất -> báo đơn active
                    # Nếu đơn hoàn tất được tạo sau đơn active (khách vừa hoàn tất đơn mới) -> báo đơn hoàn tất mới nhất
                    latest_food_data = active_food[0] if t_act >= t_comp else completed_food[0]
                else:
                    latest_food_data = active_food[0] if active_food else (completed_food[0] if completed_food else None)

                if active_service and completed_service:
                    t_act_s = active_service[0].get("created_at") or datetime.min
                    t_comp_s = completed_service[0].get("created_at") or datetime.min
                    latest_service_data = active_service[0] if t_act_s >= t_comp_s else completed_service[0]
                else:
                    latest_service_data = active_service[0] if active_service else (completed_service[0] if completed_service else None)

                all_active = active_food + active_service
                all_active.sort(key=lambda x: x.get("created_at") or datetime.min, reverse=True)

                all_any = food_orders_list + service_orders_list
                all_any.sort(key=lambda x: x.get("created_at") or datetime.min, reverse=True)

                if all_active and all_any:
                    t_act_all = all_active[0].get("created_at") or datetime.min
                    t_any_all = all_any[0].get("created_at") or datetime.min
                    order_data = all_active[0] if t_act_all >= t_any_all else all_any[0]
                else:
                    order_data = all_active[0] if all_active else (all_any[0] if all_any else None)

            req_data = recent_requests[0] if recent_requests else None







            return {



                "exists": True,



                "is_occupied": True,



                "room_number": room.room_number,



                "latest_order": order_data,



                "latest_food_order": latest_food_data,



                "latest_service_order": latest_service_data,



                "latest_rejected_order": latest_rejected_data,



                "latest_rejected_food": latest_rejected_food,



                "latest_rejected_service": latest_rejected_service,
                "food_orders": food_orders_list,
                "service_orders": service_orders_list,



                "latest_request": req_data,



            }



    except Exception as ex:







        logger.warning(f"[ConciergeGraph] DB query error for room {clean_room}: {ex}")







        return {"exists": True, "is_occupied": True, "room_number": clean_room, "latest_order": None, "latest_request": None}















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















    # Trường hợp 2: Khách hỏi kiểm tra tiến độ / trạng thái món hoặc dịch vụ (KHÔNG CẦN PIN, KHÔNG MỞ MAP)







    if action == "query_order_status":







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







            "sent_to_kitchen": "đã chuyển tới nhà bếp và đang chờ chế biến",







            "cooking": "đang được các đầu bếp trực tiếp chế biến trong bếp, sắp hoàn tất",







            "in preparation": "đang được chế biến",







            "in progress": "đang được thực hiện",







            "in_progress": "đang được thực hiện",







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







            "sent_to_kitchen": "sent to the kitchen and queued for preparation",







            "cooking": "being freshly prepared by our chefs in the kitchen",







            "in preparation": "in preparation",







            "in progress": "in progress",







            "in_progress": "in progress",







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

        if is_service_mode:
            if target_ord:
                st = (target_ord.get("status") or "").lower().strip()
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
                        mnt_st_map_en = {
                            "pending": f"Your maintenance request for Room {current_room}{items_desc} has been received and is queued for our Technical Team.",
                            "waiting": f"Your maintenance request for Room {current_room}{items_desc} is waiting to be processed by our Technical Team.",
                            "unassigned": f"Your maintenance request for Room {current_room}{items_desc} is waiting for technician assignment.",
                            "in progress": f"Our Maintenance technician has been dispatched and is currently handling the repair for Room {current_room}{items_desc}.",
                            "in_progress": f"Our Maintenance technician has been dispatched and is currently handling the repair for Room {current_room}{items_desc}.",
                            "assigned": f"Our Maintenance technician has been dispatched and is currently handling the repair for Room {current_room}{items_desc}.",
                            "completed": f"The maintenance and repair for Room {current_room}{items_desc} has been successfully completed by our Technical Team!",
                            "success": f"The maintenance and repair for Room {current_room}{items_desc} has been successfully completed by our Technical Team!",
                            "done": f"The maintenance and repair for Room {current_room}{items_desc} has been successfully completed by our Technical Team!",
                            "cancelled": f"Your maintenance request for Room {current_room}{items_desc} was cancelled.",
                            "rejected": f"Your maintenance request for Room {current_room}{items_desc} could not be fulfilled at this time.",
                        }
                        status_reply = mnt_st_map_en.get(st, f"Your maintenance request for Room {current_room}{items_desc} is currently {st}.")
                    else:
                        mnt_st_map_vn = {
                            "pending": f"Dạ yêu cầu bảo trì sửa chữa của phòng {current_room}{items_desc} đã được tiếp nhận và đang chờ đội kỹ thuật phân công nhân viên lên xử lý ạ.",
                            "waiting": f"Dạ yêu cầu bảo trì sửa chữa của phòng {current_room}{items_desc} đang chờ kỹ thuật viên tiếp nhận xử lý ạ.",
                            "unassigned": f"Dạ yêu cầu bảo trì của phòng {current_room}{items_desc} đang chờ kỹ thuật viên tiếp nhận xử lý ạ.",
                            "in progress": f"Dạ kỹ thuật viên đã tiếp nhận và đang tiến hành kiểm tra, sửa chữa cho phòng {current_room}{items_desc} rồi ạ.",
                            "in_progress": f"Dạ kỹ thuật viên đã tiếp nhận và đang tiến hành kiểm tra, sửa chữa cho phòng {current_room}{items_desc} rồi ạ.",
                            "assigned": f"Dạ kỹ thuật viên đã tiếp nhận và đang tiến hành kiểm tra, sửa chữa cho phòng {current_room}{items_desc} rồi ạ.",
                            "completed": f"Dạ sự cố kỹ thuật của phòng {current_room}{items_desc} đã được nhân viên kỹ thuật hoàn tất sửa chữa thành công rồi ạ!",
                            "success": f"Dạ sự cố kỹ thuật của phòng {current_room}{items_desc} đã được nhân viên kỹ thuật hoàn tất sửa chữa thành công rồi ạ!",
                            "done": f"Dạ sự cố kỹ thuật của phòng {current_room}{items_desc} đã được hoàn tất sửa chữa thành công rồi ạ!",
                            "cancelled": f"Dạ yêu cầu bảo trì của phòng {current_room}{items_desc} đã được hủy rồi ạ.",
                            "rejected": f"Dạ yêu cầu bảo trì của phòng {current_room}{items_desc} tạm thời chưa được đáp ứng. Quý khách vui lòng liên hệ Lễ tân nhé ạ.",
                        }
                        status_reply = mnt_st_map_vn.get(st, f"Dạ yêu cầu bảo trì của phòng {current_room}{items_desc} hiện đang ở trạng thái: {st} ạ.")
                elif is_taxi_item:
                    if is_en:
                        taxi_st_map_en = {
                            "pending": f"Your taxi request for Room {current_room} has been received and is waiting for Concierge to call the taxi.",
                            "waiting": f"Your taxi request for Room {current_room} is waiting for Concierge to call.",
                            "unassigned": f"Your taxi request for Room {current_room} is waiting for Concierge to call.",
                            "calling": f"Our Concierge team has received your request and is currently calling a taxi for Room {current_room}. Please wait a moment.",
                            "đang gọi": f"Our Concierge team has received your request and is currently calling a taxi for Room {current_room}. Please wait a moment.",
                            "in progress": f"Our Concierge team has received your request and is currently calling a taxi for Room {current_room}. Please wait a moment.",
                            "in_progress": f"Our Concierge team has received your request and is currently calling a taxi for Room {current_room}. Please wait a moment.",
                            "driver assigned": f"Our Concierge team has contacted the taxi company and a driver is on the way for Room {current_room}.",
                            "on the way": f"The taxi is on the way to the lobby entrance for Room {current_room}.",
                            "completed": f"Our Concierge team has successfully arranged a taxi for Room {current_room}. Please head to the main lobby to meet your ride!",
                            "success": f"Our Concierge team has successfully arranged a taxi for Room {current_room}. Please head to the main lobby to meet your ride!",
                            "thành công": f"Our Concierge team has successfully arranged a taxi for Room {current_room}. Please head to the main lobby to meet your ride!",
                            "done": f"Our Concierge team has successfully arranged a taxi for Room {current_room}.",
                            "cancelled": f"Your taxi request for Room {current_room} was cancelled.",
                            "rejected": f"Your taxi request for Room {current_room} could not be fulfilled at this time.",
                        }
                        status_reply = taxi_st_map_en.get(st, f"Your taxi request for Room {current_room} is currently {st}.")
                    else:
                        taxi_st_map_vn = {
                            "pending": f"Dạ yêu cầu gọi xe taxi của phòng {current_room} đang chờ nhân viên Concierge tiếp nhận để gọi xe cho quý khách ạ.",
                            "waiting": f"Dạ yêu cầu gọi xe taxi của phòng {current_room} đang chờ Concierge gọi xe ạ.",
                            "unassigned": f"Dạ yêu cầu gọi xe taxi của phòng {current_room} đang chờ nhân viên tiếp nhận gọi xe ạ.",
                            "calling": f"Dạ bộ phận Concierge đã tiếp nhận yêu cầu và đang gọi xe taxi cho phòng {current_room} rồi ạ. Quý khách vui lòng đợi trong giây lát ạ.",
                            "đang gọi": f"Dạ bộ phận Concierge đã tiếp nhận yêu cầu và đang gọi xe taxi cho phòng {current_room} rồi ạ. Quý khách vui lòng đợi trong giây lát ạ.",
                            "in progress": f"Dạ bộ phận Concierge đã tiếp nhận yêu cầu và đang gọi xe taxi cho phòng {current_room} rồi ạ. Quý khách vui lòng đợi trong giây lát ạ.",
                            "in_progress": f"Dạ bộ phận Concierge đã tiếp nhận yêu cầu và đang gọi xe taxi cho phòng {current_room} rồi ạ. Quý khách vui lòng đợi trong giây lát ạ.",
                            "driver assigned": f"Dạ Concierge đã liên hệ xong hãng xe và tài xế đang chuẩn bị đón phòng {current_room} ạ.",
                            "on the way": f"Dạ xe taxi đang di chuyển đến sảnh đón phòng {current_room} rồi ạ.",
                            "completed": f"Dạ bộ phận Concierge đã gọi xe taxi thành công cho phòng {current_room} rồi ạ. Quý khách vui lòng chuẩn bị ra sảnh đón xe nhé!",
                            "success": f"Dạ bộ phận Concierge đã gọi xe taxi thành công cho phòng {current_room} rồi ạ. Quý khách vui lòng chuẩn bị ra sảnh đón xe nhé!",
                            "thành công": f"Dạ bộ phận Concierge đã gọi xe taxi thành công cho phòng {current_room} rồi ạ. Quý khách vui lòng chuẩn bị ra sảnh đón xe nhé!",
                            "done": f"Dạ bộ phận Concierge đã gọi xe taxi thành công cho phòng {current_room} rồi ạ.",
                            "cancelled": f"Dạ yêu cầu gọi xe taxi của phòng {current_room} đã được hủy rồi ạ.",
                            "rejected": f"Dạ yêu cầu gọi xe taxi của phòng {current_room} tạm thời chưa được đáp ứng. Quý khách vui lòng liên hệ quầy Concierge nhé ạ.",
                        }
                        status_reply = taxi_st_map_vn.get(st, f"Dạ yêu cầu gọi xe của phòng {current_room} hiện đang ở trạng thái: {st} ạ.")
                elif is_en:

                    if is_reject_inquiry and not raw_rej:

                        rej_en = " without a specific reason noted"

                    else:

                        rej_en = f" with reason: '{raw_rej}'" if raw_rej else ""

                    svc_map = {

                        "pending": f"Your room service request for Room {current_room}{items_desc} has been received and is queued for Housekeeping service.",

                        "waiting": f"Your room service request for Room {current_room}{items_desc} is waiting to be processed.",

                        "unassigned": f"Your room service request for Room {current_room}{items_desc} is waiting for staff assignment.",

                        "sent to kitchen": f"Your request for Room {current_room}{items_desc} has been forwarded and is queued for service.",

                        "sent_to_kitchen": f"Your request for Room {current_room}{items_desc} has been forwarded and is queued for service.",

                        "cooking": f"Our housekeeping staff is currently preparing items and servicing Room {current_room}{items_desc}.",

                        "in progress": f"Our housekeeping staff is currently servicing Room {current_room}{items_desc}.",

                        "in_progress": f"Our housekeeping staff is currently servicing Room {current_room}{items_desc}.",

                        "assigned": f"Our housekeeping staff has been assigned and is on the way to Room {current_room}{items_desc}.",

                        "ready": f"Your requested items for Room {current_room}{items_desc} are prepared and being delivered.",

                        "delivering": f"Our room service staff is on the way to Room {current_room}{items_desc} right now!",

                        "completed": f"Your room service request for Room {current_room}{items_desc} has been completed successfully. Have a wonderful stay!",

                        "delivered": f"Your room service request for Room {current_room}{items_desc} has been delivered successfully. Have a wonderful stay!",

                        "done": f"Your room service request for Room {current_room}{items_desc} has been completed successfully.",

                        "cancelled": f"Your room service request for Room {current_room} was cancelled{rej_en}.",

                        "rejected": f"Your room service request for Room {current_room}{items_desc} was declined{rej_en}. Please contact the front desk for assistance.",

                    }

                    st_en = STATUS_EN_MAP.get(st, st)

                    status_reply = svc_map.get(st, f"Your room service request for Room {current_room}{items_desc} is currently {st_en}.")

                else:

                    if is_reject_inquiry and not raw_rej:

                        rej_vn = " nhưng nhân viên chưa ghi chú lý do cụ thể ạ"

                    else:

                        rej_vn = f' với lý do: "{raw_rej}"' if raw_rej else ""

                    svc_map = {

                        "pending": f"Dạ yêu cầu phục vụ phòng của phòng {current_room}{items_desc} đã được tiếp nhận và đang trong hàng đợi xử lý của bộ phận buồng phòng ạ.",

                        "waiting": f"Dạ yêu cầu phục vụ phòng của phòng {current_room}{items_desc} đang chờ nhân viên tiếp nhận xử lý ạ.",

                        "unassigned": f"Dạ yêu cầu phục vụ phòng của phòng {current_room}{items_desc} đang chờ phân công nhân viên phụ trách ạ.",

                        "sent to kitchen": f"Dạ yêu cầu phục vụ phòng của phòng {current_room}{items_desc} đã được chuyển tới bộ phận chuyên trách xử lý ạ.",

                        "sent_to_kitchen": f"Dạ yêu cầu phục vụ phòng của phòng {current_room}{items_desc} đã được chuyển tới bộ phận chuyên trách xử lý ạ.",

                        "cooking": f"Dạ nhân viên buồng phòng đang tiến hành chuẩn bị đồ và xử lý yêu cầu dọn phòng {items_desc} cho phòng {current_room} rồi ạ, sắp hoàn tất rồi ạ.",

                        "in progress": f"Dạ nhân viên buồng phòng đang trực tiếp dọn dẹp và phục vụ yêu cầu {items_desc} tại phòng {current_room} rồi ạ.",

                        "in_progress": f"Dạ nhân viên buồng phòng đang trực tiếp dọn dẹp và phục vụ yêu cầu {items_desc} tại phòng {current_room} rồi ạ.",

                        "assigned": f"Dạ nhân viên buồng phòng chuyên trách đã tiếp nhận yêu cầu {items_desc} cho phòng {current_room} và đang chuẩn bị thực hiện ạ.",

                        "ready": f"Dạ các vật dụng yêu cầu cho phòng {current_room}{items_desc} đã được chuẩn bị xong, đang chuẩn bị mang lên phòng ạ.",

                        "delivering": f"Dạ nhân viên phục vụ phòng đang mang đồ di chuyển lên phòng {current_room} cho quý khách rồi ạ!",

                        "completed": f"Dạ yêu cầu phục vụ phòng {items_desc} của phòng {current_room} đã được hoàn tất thành công rồi ạ. Chúc quý khách có thời gian nghỉ dưỡng thoải mái!",

                        "delivered": f"Dạ yêu cầu phục vụ phòng {items_desc} của phòng {current_room} đã được hoàn tất thành công rồi ạ. Chúc quý khách có thời gian nghỉ dưỡng thoải mái!",

                        "done": f"Dạ yêu cầu phục vụ phòng {items_desc} của phòng {current_room} đã hoàn tất thành công rồi ạ.",

                        "cancelled": f"Dạ yêu cầu dịch vụ phòng của phòng {current_room} đã được hủy{rej_vn} rồi ạ.",

                        "rejected": f"Dạ yêu cầu phục vụ phòng {items_desc} của phòng {current_room} đã bị từ chối{rej_vn}. Quý khách vui lòng liên hệ quầy Lễ tân hoặc chọn tiện ích khác để được hỗ trợ nhé ạ.",

                    }

                    st_vn = STATUS_VN_MAP.get(st, st)

                    status_reply = svc_map.get(st, f"Dạ yêu cầu dịch vụ của phòng {current_room}{items_desc} hiện {st_vn} ạ.")

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

            items_summary = target_ord.get("items_summary", "")

            items_desc = f" ({items_summary})" if items_summary else ""

            raw_rej = (target_ord.get("reject_reason") or target_ord.get("note") or "").strip()



            if is_en:

                if is_reject_inquiry and not raw_rej:

                    rej_en = " without a specific reason noted"

                else:

                    rej_en = f" with reason: '{raw_rej}'" if raw_rej else ""

                ord_map = {

                    "pending": f"Your food order for Room {current_room}{items_desc} has been received by the kitchen and is in the queue.",

                    "waiting": f"Your food order for Room {current_room}{items_desc} is waiting to be processed by the kitchen.",

                    "sent to kitchen": f"Your food order for Room {current_room}{items_desc} has been sent to the kitchen and the chefs are preparing to cook.",

                    "sent_to_kitchen": f"Your food order for Room {current_room}{items_desc} has been sent to the kitchen and the chefs are preparing to cook.",

                    "cooking": f"The chefs are currently preparing your food order for Room {current_room}{items_desc} in the kitchen.",

                    "in preparation": f"The kitchen is currently preparing your food order for Room {current_room}{items_desc}.",

                    "in progress": f"The kitchen is currently working on your food order for Room {current_room}{items_desc}.",

                    "in_progress": f"The kitchen is currently working on your food order for Room {current_room}{items_desc}.",

                    "ready": f"Your food order for Room {current_room}{items_desc} has been finished by the kitchen and is waiting for delivery.",

                    "food ready": f"Your food order for Room {current_room}{items_desc} is ready and waiting for delivery.",

                    "delivering": f"Your food order for Room {current_room}{items_desc} is on its way to your room right now!",

                    "completed": f"Your food order for Room {current_room}{items_desc} has been delivered successfully. Enjoy your meal!",

                    "delivered": f"Your food order for Room {current_room}{items_desc} has been delivered successfully. Enjoy your meal!",

                    "done": f"Your food order for Room {current_room}{items_desc} has been completed successfully.",

                    "cancelled": f"Your food order for Room {current_room} was cancelled{rej_en}.",

                    "rejected": f"Your food order for Room {current_room}{items_desc} was declined by the kitchen{rej_en}. Would you like to select another dish from our menu?",

                }

                st_en = STATUS_EN_MAP.get(st, st)

                status_reply = ord_map.get(st, f"Your food order for Room {current_room}{items_desc} is currently {st_en}.")

            else:

                if is_reject_inquiry and not raw_rej:

                    rej_vn = " nhưng nhân viên chưa ghi chú lý do cụ thể ạ"

                else:

                        rej_vn = f' với lý do: "{raw_rej}"' if raw_rej else ""

                ord_map = {

                    "pending": f"Dạ đơn món của phòng {current_room}{items_desc} đã được nhà bếp tiếp nhận và đang xếp hàng chờ nấu ạ.",

                    "waiting": f"Dạ đơn món của phòng {current_room}{items_desc} đang chờ nhà bếp xử lý ạ.",

                    "sent to kitchen": f"Dạ đơn món của phòng {current_room}{items_desc} đã được chuyển tới nhà bếp và các đầu bếp đang chuẩn bị chế biến ạ.",

                    "sent_to_kitchen": f"Dạ đơn món của phòng {current_room}{items_desc} đã được chuyển tới nhà bếp và các đầu bếp đang chuẩn bị chế biến ạ.",

                    "cooking": f"Dạ món ăn của phòng {current_room}{items_desc} hiện đang được các đầu bếp trực tiếp chế biến trong bếp, sắp xong rồi ạ.",

                    "in preparation": f"Dạ món ăn của phòng {current_room}{items_desc} hiện đang được chế biến trong bếp, sắp xong rồi ạ.",

                    "in progress": f"Dạ món ăn của phòng {current_room}{items_desc} hiện đang được thực hiện trong nhà bếp ạ.",

                    "in_progress": f"Dạ món ăn của phòng {current_room}{items_desc} hiện đang được thực hiện trong nhà bếp ạ.",

                    "ready": f"Dạ món ăn của phòng {current_room}{items_desc} đã được nhà bếp làm xong, đang chuẩn bị giao lên phòng cho quý khách rồi ạ.",

                    "food ready": f"Dạ món ăn của phòng {current_room}{items_desc} đã được nấu xong, đang chuẩn bị giao lên phòng cho quý khách rồi ạ.",

                    "delivering": f"Dạ món ăn của phòng {current_room}{items_desc} đang trên đường được giao lên phòng cho quý khách rồi ạ!",

                    "completed": f"Dạ đơn món của phòng {current_room}{items_desc} đã hoàn thành và được giao thành công lên phòng rồi ạ. Chúc quý khách ngon miệng!",

                    "delivered": f"Dạ đơn món của phòng {current_room}{items_desc} đã hoàn thành và được giao thành công lên phòng rồi ạ. Chúc quý khách ngon miệng!",

                    "done": f"Dạ đơn món của phòng {current_room}{items_desc} đã hoàn tất thành công rồi ạ.",

                    "cancelled": f"Dạ đơn món của phòng {current_room} đã được hủy{rej_vn} rồi ạ.",

                    "rejected": f"Dạ đơn món của phòng {current_room}{items_desc} đã bị nhà bếp từ chối{rej_vn}. Quý khách có muốn chọn món khác trên màn hình để đặt không ạ?",

                }

                st_vn = STATUS_VN_MAP.get(st, st)

                status_reply = ord_map.get(st, f"Dạ đơn đặt món của phòng {current_room}{items_desc} hiện {st_vn} ạ.")

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

    # 3. Kiểm tra yêu cầu mở menu / danh mục Báo hỏng & Sửa chữa kỹ thuật (Maintenance & Repair Menu)
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







        room_check = await query_room_order_status_db(current_room or "", is_en=is_en)







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







    room_check_order = await query_room_order_status_db(current_room, is_en=is_en)







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























async def generator_node(state: ConciergeState) -> Dict[str, Any]:







    """







    Node 2: Conversational Generator Node.







    Chạy suy luận ngôn ngữ tự nhiên tức thì với Qwen 3B, không phụ thuộc RAG hay ticket router.







    """







    prompt = state.get("prompt", "")







    lang_code = state.get("lang_code", "vi-VN")







    emotion = state.get("emotion")







    history = state.get("chat_history") or []







    current_room = state.get("room_number")







    rag_context = state.get("rag_context") or ""















    reply, detected_lang, final_code = await ollama_service.generate_response(







        prompt=prompt,







        rag_context=rag_context,







        language=lang_code,







        emotion=emotion,







        chat_history=history,







        stored_room_number=current_room,







    )















    return {







        "response": reply,







        "lang_name": detected_lang,







        "lang_code": final_code,







        "action": "conversation",







        "intent_category": "conversation",







        "destination_key": None,







        "trigger_video_call": False,







        "missing_room_number": False,







    }























# ============================================================================







# 2. CONDITIONAL ROUTERS (Bộ điều hướng luồng)







# ============================================================================















def route_after_fast_path(state: ConciergeState) -> str:







    """Nếu trúng Fast-Path thì dừng ngay (<1ms), ngược lại chuyển sang Router."""







    if state.get("fast_path_hit"):







        return END







    return "intent_router"























def route_after_intent(state: ConciergeState) -> str:







    """Điều hướng theo kết quả phân loại ý định: Dịch vụ -> service_fsm, FAQ -> retrieval, Chitchat -> generator."""







    category = state.get("intent_category", "chitchat")







    if category == "service":







        return "service_fsm"







    elif category == "faq":







        return "retrieval"







    else:







        return "generator"























# ============================================================================







# 3. BUILD & COMPILE LANGGRAPH HARNESS







# ============================================================================















def build_concierge_graph() -> CompiledStateGraph:







    """Khởi tạo cấu trúc đồ thị trạng thái Agent Harness."""







    builder = StateGraph(cast(Any, ConciergeState))















    builder.add_node("fast_path", fast_path_node)







    builder.add_node("intent_router", intent_router_node)







    builder.add_node("retrieval", retrieval_node)







    builder.add_node("service_fsm", service_fsm_node)







    builder.add_node("generator", generator_node)















    builder.add_edge(START, "fast_path")







    builder.add_conditional_edges(







        "fast_path",







        route_after_fast_path,







        {"intent_router": "intent_router", END: END}







    )







    builder.add_conditional_edges(







        "intent_router",







        route_after_intent,







        {







            "service_fsm": "service_fsm",







            "retrieval": "retrieval",







            "generator": "generator",







        }







    )







    builder.add_edge("retrieval", "generator")







    builder.add_edge("generator", END)







    builder.add_edge("service_fsm", END)















    memory = MemorySaver()







    return builder.compile(checkpointer=memory)























# Khởi tạo Singleton Instance cho toàn backend







concierge_graph = build_concierge_graph()







