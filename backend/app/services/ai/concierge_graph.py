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

    fast_hit = ollama_service.check_fast_path_full(prompt, language)
    if fast_hit:
        reply, lang_name, lang_code, action_type, action_payload = fast_hit
        dest_key = action_payload.get("destination_key") if isinstance(action_payload, dict) else None
        is_vc = bool(action_type == "trigger_video_call")
        logger.info(f"[Harness FastPath] Matched dynamic scenario! Fast response in <1ms for: '{prompt[:30]}...'")
        return {
            "fast_path_hit": True,
            "response": reply,
            "lang_name": lang_name,
            "lang_code": lang_code,
            "intent_category": "fast_path",
            "action": action_type or "fast_path",
            "destination_key": dest_key,
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

    # 2. Heuristic nhận diện dịch vụ khách sạn (< 0.1ms)
    SERVICE_KEYWORDS = {
        "housekeeping": [
            "khăn", "khan", "dọn phòng", "don phong", "gối", "goi", "chăn", "chan", 
            "nệm", "nem", "dọn dẹp", "dọn vệ sinh", "vệ sinh phòng", "làm vệ sinh", 
            "towel", "clean room", "cleaning", "bàn ủi", "máy sấy", "dao cạo", "kem đánh răng", 
            "bàn chải", "dầu gội", "sữa tắm", "giấy vệ sinh", "nước suối trong phòng"
        ],
        "room_service": [
            "cơm", "com", "nước", "nuoc", "ăn", "an", "uống", "uong", "đồ ăn", "do an", 
            "trà", "tra", "cà phê", "ca phe", "pizza", "phở", "pho", "bánh", "banh", 
            "food", "drink", "bữa sáng", "gọi món", "đặt món", "thực đơn", "menu", "nước ngọt", "bia", "trái cây"
        ],
        "bellman": [
            "hành lý", "hanh ly", "vali", "túi", "tui", "chuyển phòng", "chuyen phong", 
            "mang đồ", "xách đồ", "luggage", "bag", "mang hành lý", "gửi hành lý"
        ],
        "maintenance": [
            "hỏng", "hong", "sửa", "sua", "điều hòa", "dieu hoa", "bóng đèn", "bong den", 
            "nước rò", "nuoc ro", "máy lạnh", "may lanh", "tủ lạnh", "tu lanh", "kẹt", "ket", 
            "fix", "repair", "vòi sen", "vòi nước", "bồn cầu", "tắc", "mất điện", "không lạnh", "cháy bóng"
        ],
        "restaurant": ["đặt bàn", "dat ban", "bàn ăn", "ban an", "nhà hàng", "table", "restaurant"],
        "taxi": ["taxi", "đặt xe", "dat xe", "gọi xe", "goi xe", "sân bay", "cab", "ride", "xe đón", "grab"],
        "concierge": [
            "concierge", "gặp người", "trợ giúp trực tiếp", "nhân viên hỗ trợ", 
            "live call", "video call", "tổng đài", "gọi cho nhân viên", 
            "gọi nhân viên", "gặp nhân viên", "kết nối nhân viên", "nói chuyện với nhân viên",
            "cho tôi gặp nhân viên", "gặp người thật", "nói chuyện với người thật", "kết nối người thật",
            "gọi tổng đài", "gọi hỗ trợ", "hỗ trợ viên", "gọi video",
            "gọi cho lễ tân", "gặp trực tiếp", "kết nối trực tiếp", "human support",
            "nhân viên tư vấn", "cho tôi gặp lễ tân", "gặp trực ban", "gọi trực ban", "gọi can thiệp",
            "call staff", "call human", "talk to human", "speak to human", 
            "connect staff", "video call support", "talk to staff", "call receptionist",
            "human agent", "live agent", "talk to a person", "speak to a person", "live support"
        ],
        "reception": [
            "lễ tân", "check out", "checkout", "check in", "checkin", 
            "đổi phòng", "doi phong", "trả phòng", "tra phong", "front desk", "reception",
            "gia hạn phòng", "thẻ phòng", "mất chìa khóa", "khóa phòng"
        ],
    }

    # 3. Phân loại Category & FAQ / Facility Keywords
    faq_keywords = [
        "ở đâu", "mấy giờ", "bao nhiêu", "giá", "thế nào", "có không", 
        "where", "when", "how", "what", "giờ nào", "tầng mấy", "bao xa", 
        "chỉ đường", "đường nào", "hướng nào", "đi vệ sinh", "nhà vệ sinh", 
        "toilet", "wc", "restroom", "washroom", "phòng vệ sinh"
    ]
    is_asking_info = any(kw in prompt_lower for kw in faq_keywords)

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
    Chỉ kích hoạt khi category == 'faq'. Rút gọn context tối đa để LLM sinh từ tức thì.
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
            n_results=1
        )
        if results and results.get("documents") and results["documents"][0]:
            raw_chunk = results["documents"][0][0]
            rag_context = raw_chunk[:1200].strip()
            logger.info(f"[Harness Retrieval] Pruned context to {len(rag_context)} chars for rapid generation.")
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
    }
    DEPT_MAP_EN = {
        "housekeeping": "Housekeeping Department",
        "room_service": "Food & Beverage (Room Service)",
        "bellman": "Bell Services Department",
        "maintenance": "Maintenance & Engineering",
        "restaurant": "Restaurant & F&B Department",
        "taxi": "Transportation & Taxi Desk",
        "reception": "Front Desk & Reception",
    }
    dept_name = (DEPT_MAP_EN if lang_code == "en-US" else DEPT_MAP_VI).get(action, "chuyên trách")

    if lang_code == "en-US":
        confirm_reply = f"Rora has noted your request for Room {current_room}! The {dept_name} will attend to it right away."
    else:
        confirm_reply = f"Dạ Rora đã ghi nhận yêu cầu cho Phòng {current_room} rồi ạ! Bộ phận {dept_name} sẽ tiếp nhận và hỗ trợ quý khách ngay."

    return {
        "missing_room_number": False,
        "room_number": current_room,
        "response": confirm_reply,
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
    rag_context = state.get("rag_context")

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
    """Điều hướng theo kết quả phân loại ý định."""
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
