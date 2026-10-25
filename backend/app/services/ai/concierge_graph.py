"""
Concierge Graph: LangGraph-powered Agent Harness for HCRobot Concierge.
Quản lý luồng xử lý tinh gọn (Fast-Path -> Direct Conversational Generator).
Đã gỡ bỏ hoàn toàn RAG (ChromaDB/BGE-M3) và bộ định tuyến bóc tách vé dịch vụ (Ticket Dispatching).
"""

import asyncio
import logging
from typing import Dict, Any, List, Optional, TypedDict

from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver

from app.services.ai.session_manager import session_manager, extract_room_number
from app.services.ai.ollama_service import ollama_service

logger = logging.getLogger(__name__)


class ConciergeState(TypedDict, total=False):
    """
    Trạng thái hội thoại trung tâm (Central Agent State) do LangGraph Harness quản lý.
    """
    session_id: str
    prompt: str
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

    # Nếu session đang chờ số phòng cho yêu cầu dịch vụ trước đó -> Bỏ qua fast-path để intent_router bóc tách số phòng
    pending = session_manager.get_pending_intent(session_id)
    if pending:
        logger.info(f"[Harness FastPath Bypass] Session '{session_id}' has pending intent '{pending.get('action')}', bypassing fast-path for: '{prompt}'")
        if not language or language.lower() in ["auto", ""]:
            lang_name, lang_code = ollama_service.detect_language(prompt)
        else:
            lang_name = language
            lang_code = "en-US" if language.lower() in ["english", "en"] else "vi-VN"
        return {
            "fast_path_hit": False,
            "lang_name": lang_name,
            "lang_code": lang_code,
        }

    fast_hit = ollama_service.check_fast_path_full(prompt, language)
    if fast_hit:
        if len(fast_hit) == 5:
            reply, lang_name, lang_code, action_type, action_payload = fast_hit
        elif len(fast_hit) == 4:
            reply, lang_name, lang_code, action_type = fast_hit
            action_payload = None
        else:
            reply, lang_name, lang_code = fast_hit[0], fast_hit[1], fast_hit[2]
            action_type, action_payload = None, None

        dest_key = action_payload.get("destination_key") if isinstance(action_payload, dict) else None
        eye_expr = action_payload.get("eye_expression") if isinstance(action_payload, dict) else None
        is_vc = bool(action_type == "trigger_video_call")
        logger.info(f"[Harness FastPath] Matched dynamic scenario! Fast response in <1ms for: '{prompt[:30]}...' (eye: {eye_expr})")
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
            "missing_room_number": False,
        }

    # Tự động nhận diện ngôn ngữ nếu chưa có
    if not language or language.lower() in ["auto", ""]:
        lang_name, lang_code = ollama_service.detect_language(prompt)
    else:
        lang_name = language
        lang_code = "en-US" if language.lower() in ["english", "en"] else "vi-VN"

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
    from app.services.ai.constants import SERVICE_KEYWORDS

    # 3. Phân loại Category & FAQ / Facility / Nearby Exploration Keywords (KHÔNG BAO GIỜ HỎI SỐ PHÒNG NẾU LÀ CÂU HỎI THÔNG TIN)
    faq_keywords = [
        "ở đâu", "mấy giờ", "bao nhiêu", "giá", "thế nào", "có không", 
        "where", "when", "how", "what", "giờ nào", "tầng mấy", "bao xa", 
        "chỉ đường", "đường nào", "hướng nào", "đi vệ sinh", "nhà vệ sinh", 
        "toilet", "wc", "restroom", "washroom", "phòng vệ sinh",
        "có món gì", "có những gì", "gồm những gì", "những món nào", "xem thực đơn", "xem menu",
        "thực đơn", "menu", "có dịch vụ gì", "chi phí thế nào", "bảng giá", "quy định", "chính sách",
        # Từ khóa khám phá xung quanh, ngoại khu, chợ đêm, danh thắng
        "gần đây", "xung quanh", "quanh đây", "gần khách sạn", "ngoại khu", "chợ đêm", "chợ", 
        "bãi biển", "biển", "tắm biển", "cầu rồng", "hội an", "bà nà", "ngũ hành sơn", "sơn trà",
        "có gì", "có gì chơi", "chơi gì", "ăn gì", "đi đâu", "tham quan", "du lịch", "địa điểm",
        "chỗ nào", "quán ăn", "hải sản", "mua sắm", "check in", "checkin", "ngắm cảnh",
        "nearby", "around here", "night market", "attractions", "sightseeing", "places to visit", "beach"
    ]
    has_co_khong = bool(re.search(r"\bcó\b.+\bkhông\b", prompt_lower))
    is_asking_info = any(kw in prompt_lower for kw in faq_keywords) or has_co_khong

    action = None
    if not is_asking_info:
        for act, kws in SERVICE_KEYWORDS.items():
            if any(k in prompt_lower for k in kws):
                action = act
                break

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
        category = "service"
        session_manager.clear_pending_intent(session_id)
        logger.info(f"[Harness FastRouter] Resolved pending intent '{action}' with room '{extracted_room}': {items_text}")
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
    Truy vấn ChromaDB Vector Store lấy ngữ cảnh tri thức phù hợp nhất (Top 2 chunks, tối đa 1200 ký tự).
    """
    # Nếu client đã gửi kèm rag_context sẵn thì giữ nguyên
    existing_ctx = state.get("rag_context")
    if existing_ctx:
        return {"rag_context": existing_ctx}

    prompt = state.get("prompt", "")
    rag_context = ""
    try:
        from app.services.rag.chroma import get_concierge_collection
        collection = get_concierge_collection("concierge_kb")
        results = await asyncio.to_thread(
            collection.query,
            query_texts=[prompt],
            n_results=4
        )
        if results and results.get("documents") and results["documents"][0]:
            docs = [d.strip() for d in results["documents"][0] if d and len(d.strip()) > 50]
            if docs:
                rag_context = "\n\n---\n\n".join(docs)[:1800].strip()
                logger.info(f"[Harness Retrieval] Retrieved {len(docs)} chunks ({len(rag_context)} chars) for rapid generation.")
    except Exception as ex:
        logger.warning(f"[Harness Retrieval Warning] Không thể truy vấn ChromaDB: {ex}")

    return {"rag_context": rag_context}


async def service_fsm_node(state: ConciergeState) -> Dict[str, Any]:
    """
    Node 4: Service FSM (Finite State Machine Slot-Filling).
    Xử lý nghiệp vụ yêu cầu dịch vụ khách sạn. Kiểm tra ràng buộc số phòng.
    """
    action = state.get("action") or "room_service"
    current_room = state.get("room_number")
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

    # Trường hợp 2: Khách chỉ cung cấp/giới thiệu số phòng (không có yêu cầu dịch vụ cụ thể)
    if action == "provide_room_number":
        if lang_code == "en-US":
            intro_reply = f"Hello guest from Room {current_room}! Rora has remembered your room number for our conversation session. How may I assist you today?"
        else:
            intro_reply = f"Dạ Rora xin chào quý khách ở Phòng {current_room} ạ! Rora đã ghi nhớ số phòng của quý khách cho phiên nói chuyện này rồi ạ. Em có thể hỗ trợ dịch vụ gì cho quý khách ạ?"

        return {
            "missing_room_number": False,
            "room_number": current_room,
            "response": intro_reply,
        }

    # Trường hợp 3: Yêu cầu dịch vụ liên quan phòng nhưng CHƯA CÓ SỐ PHÒNG -> Bắt buộc hỏi khách số phòng!
    if not current_room:
        if lang_code == "en-US":
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
            action_en = action_en_map.get(action, "this service")
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
            action_vn = action_vn_map.get(action, "dịch vụ")
            ask_reply = f"Dạ em sẽ hỗ trợ {action_vn} cho quý khách ngay ạ! Quý khách vui lòng cho em xin số phòng của mình là bao nhiêu ạ?"

        return {
            "missing_room_number": True,
            "room_number": None,
            "response": ask_reply,
        }

    # Trường hợp 4: Đã có đủ số phòng và có yêu cầu dịch vụ -> Xác nhận gửi tới đúng phòng ban kèm số phòng
    DEPT_MAP_VI = {
        "housekeeping": "Buồng phòng (Housekeeping)",
        "room_service": "Ẩm thực (F&B / Room Service)",
        "bellman": "Hành lý (Bell Services)",
        "maintenance": "Kỹ thuật & Bảo trì (Maintenance)",
        "restaurant": "Nhà hàng & Ẩm thực",
        "taxi": "Vận chuyển & Đặt xe (Taxi)",
        "reception": "Lễ tân (Reception)",
        "laundry": "Giặt ủi & Buồng phòng (Laundry)",
        "wake_up": "Lễ tân & Tổng đài (Reception Desk)",
        "cancel_service": "Điều phối dịch vụ (Operations Dispatch)",
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
    dept_name = (DEPT_MAP_EN if lang_code == "en-US" else DEPT_MAP_VI).get(action, "chuyên trách")

    if action == "cancel_service":
        if lang_code == "en-US":
            confirm_reply = f"Rora has received your cancellation request for Room {current_room}. The relevant department has been notified to cancel your request immediately!"
        else:
            confirm_reply = f"Dạ Rora đã tiếp nhận yêu cầu hủy dịch vụ cho Phòng {current_room} rồi ạ! Em đã gửi thông báo hủy tới các bộ phận liên quan ngay lập tức."
    elif lang_code == "en-US":
        confirm_reply = f"To confirm your request for Room {current_room}, please enter your 4-digit room PIN or the last 4 digits of your ID/Passport on the screen."
    else:
        confirm_reply = f"Dạ để xác nhận yêu cầu cho Phòng {current_room}, quý khách vui lòng nhập mã PIN phòng (hoặc 4 số cuối CCCD) trên màn hình cảm ứng nhé ạ."

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

def build_concierge_graph() -> StateGraph:
    """Khởi tạo cấu trúc đồ thị trạng thái Agent Harness."""
    builder = StateGraph(ConciergeState)

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
