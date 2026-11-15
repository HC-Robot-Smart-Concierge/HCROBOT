"""Fast-path routing node for sub-millisecond concierge replies."""

import logging
import re
from typing import Any, Dict

from app.services.ai.concierge_state import ConciergeState
from app.services.ai.constants import SERVICE_KEYWORDS
from app.services.ai.ollama_service import ollama_service
from app.services.ai.session_manager import session_manager

logger = logging.getLogger(__name__)


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
    has_explicit_kb_ctx = bool((state.get("rag_context") or "").strip())
    fast_hit = None if has_explicit_kb_ctx else ollama_service.check_fast_path_full(prompt, language)
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
