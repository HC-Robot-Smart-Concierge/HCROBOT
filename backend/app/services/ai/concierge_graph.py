"""
Concierge Graph: LangGraph-powered Agent Harness for HCRobot Concierge.
Quản lý luồng xử lý (Control Flow), FSM State Machine và tối ưu hóa độ trễ phản hồi của Qwen 3B.
"""

import asyncio
import logging
from typing import Dict, Any, List, Optional, TypedDict

from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver

from app.services.ai.ollama_service import ollama_service
from app.core.config import settings

logger = logging.getLogger(__name__)


class ConciergeState(TypedDict):
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
    intent_category: str       # 'fast_path' | 'faq' | 'service' | 'chitchat'
    action: Optional[str]      # 'room_service' | 'housekeeping' | 'bellman' | 'maintenance' | 'restaurant' | 'faq'
    items: Optional[str]
    rag_context: Optional[str]
    missing_room_number: bool
    ticket_code: Optional[str]
    trigger_video_call: Optional[bool]
    response: str


# ============================================================================
# 1. GRAPH NODES (Các mắt xích xử lý trong Harness)
# ============================================================================

async def fast_path_node(state: ConciergeState) -> Dict[str, Any]:
    """
    Node 1: Fast-Path Rule Engine.
    Kiểm tra nhanh các câu hỏi thường gặp, lời chào, pass wifi.
    Nếu khớp -> Độ trễ < 1ms, tiêu thụ 0 token, không gọi ChromaDB và LLM.
    """
    prompt = state.get("prompt", "")
    language = state.get("language")

    fast_hit = ollama_service.check_fast_path(prompt, language)
    if fast_hit:
        reply, lang_name, lang_code = fast_hit
        logger.info(f"[Harness FastPath] Matched! Bypassing ChromaDB & LLM for prompt: '{prompt[:30]}...'")
        return {
            "fast_path_hit": True,
            "response": reply,
            "lang_name": lang_name,
            "lang_code": lang_code,
            "intent_category": "fast_path",
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
    Phân loại ý định khách hàng tức thì không gọi LLM blocking 5s.
    """
    import re
    prompt = state.get("prompt", "")
    # Làm sạch wake-up word Rora ở đầu câu (nếu khách nói kèm mệnh lệnh)
    clean_prompt = re.sub(r'^(?:hey rora|chào rora|chao rora|rora ơi|rora oi|hello rora|hi rora|rora)[\,\.\!\s]*', '', prompt, flags=re.IGNORECASE).strip() or prompt
    prompt_lower = clean_prompt.lower().strip()

    # 1. Bóc tách nhanh số phòng nếu có
    room_match = re.search(r'(?:phòng|p\.|p|phong)\s*([0-9]{3,4})|^(?:tôi ở|ở)\s*([0-9]{3,4})$', clean_prompt, re.IGNORECASE)
    extracted_room = (room_match.group(1) or room_match.group(2)) if room_match else None
    
    current_room = state.get("room_number")
    if extracted_room:
        current_room = extracted_room

    # 2. Heuristic nhận diện dịch vụ khách sạn (< 0.1ms)
    SERVICE_KEYWORDS = {
        "housekeeping": ["khăn", "dọn phòng", "gối", "chăn", "nệm", "dọn dẹp", "dọn vệ sinh", "vệ sinh phòng", "làm vệ sinh", "towel", "clean room", "cleaning"],
        "room_service": ["cơm", "nước", "ăn", "uống", "đồ ăn", "trà", "cà phê", "pizza", "phở", "bánh", "food", "drink"],
        "bellman": ["hành lý", "vali", "túi", "chuyển phòng", "mang đồ", "xách đồ", "luggage", "bag"],
        "maintenance": ["hỏng", "sửa", "điều hòa", "bóng đèn", "nước rò", "máy lạnh", "tủ lạnh", "kẹt", "fix", "repair"],
        "restaurant": ["đặt bàn", "bàn ăn", "nhà hàng", "table", "restaurant"],
        "taxi": ["taxi", "đặt xe", "gọi xe", "sân bay", "cab", "ride", "xe đón"],
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
        "reception": ["lễ tân", "check out", "check in", "đổi phòng", "trả phòng", "front desk", "reception"],
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

    if action:
        category = "service"
    elif is_asking_info:
        category = "faq"
        action = "faq"
    elif extracted_room and not action:
        action = "provide_room_number"
        category = "service"
    else:
        category = "chitchat"
        action = "chitchat"

    logger.info(f"[Harness FastRouter] category='{category}', action='{action}', room='{current_room}'")
    return {
        "intent_category": category,
        "action": action,
        "items": prompt,
        "room_number": current_room,
    }


async def retrieval_node(state: ConciergeState) -> Dict[str, Any]:
    """
    Node 3: Context Retrieval & Pruning (Tối ưu hóa Context cho Qwen 3B).
    Chỉ kích hoạt khi category == 'faq'. Rút gọn context tối đa (< 100 từ) để Qwen 3B sinh từ tức thì.
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
            n_results=1  # CHỈ LẤY ĐÚNG 1 CHUNK LIÊN QUAN NHẤT ĐỂ GIẢM ĐỘ TRỄ CHO 3B
        )
        if results and results.get("documents") and results["documents"][0]:
            raw_chunk = results["documents"][0][0]
            # Prune/Cắt gọt context tối đa 1200 ký tự (~250 words) để giữ trọn vẹn thông tin bảng/mục cho 3B
            rag_context = raw_chunk[:1200].strip()
            logger.info(f"[Harness Retrieval] Pruned context to {len(rag_context)} chars for rapid 3B generation.")
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

    # Trường hợp đặc biệt: Khách yêu cầu Live Video Call với Concierge / Nhân viên
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

    # Kiểm tra thiếu số phòng (Missing Room Number Slot)
    if not current_room:
        if lang_code == "en-US":
            ask_reply = f"Certainly! I would be glad to help with {action}. Could you please tell me your room number?"
        else:
            action_vn_map = {
                "room_service": "đồ ăn và thức uống",
                "housekeeping": "dọn phòng và tiện ích buồng phòng",
                "bellman": "hỗ trợ hành lý",
                "maintenance": "kỹ thuật bảo trì",
                "restaurant": "đặt bàn nhà hàng",
                "taxi": "đặt xe taxi và di chuyển",
                "concierge": "kết nối tổng đài Concierge",
                "reception": "dịch vụ lễ tân tiền sảnh",
            }
            action_vn = action_vn_map.get(action, "dịch vụ")
            ask_reply = f"Dạ em sẽ hỗ trợ {action_vn} cho quý khách ngay ạ! Quý khách vui lòng cho em xin số phòng của mình là bao nhiêu ạ?"

        return {
            "missing_room_number": True,
            "response": ask_reply,
        }

    # Đã có đủ số phòng
    if lang_code == "en-US":
        confirm_reply = f"Rora has noted your request for Room {current_room}. Our team will attend to it shortly!"
    else:
        confirm_reply = f"Dạ Rora đã ghi nhận yêu cầu cho Phòng {current_room} rồi ạ! Bộ phận chuyên trách sẽ hỗ trợ quý khách ngay."

    return {
        "missing_room_number": False,
        "response": confirm_reply,
    }


async def generator_node(state: ConciergeState) -> Dict[str, Any]:
    """
    Node 5: Qwen 3B Generator Node.
    Chạy suy luận ngôn ngữ tự nhiên với tham số tối ưu (Fast Time-to-First-Token).
    """
    prompt = state.get("prompt", "")
    rag_ctx = state.get("rag_context")
    lang_code = state.get("lang_code", "vi-VN")
    lang_name = state.get("lang_name", "Tiếng Việt")
    emotion = state.get("emotion")
    history = state.get("chat_history") or []
    current_room = state.get("room_number")

    reply, detected_lang, final_code = await ollama_service.generate_response(
        prompt=prompt,
        rag_context=rag_ctx,
        language=lang_code,
        emotion=emotion,
        chat_history=history,
        stored_room_number=current_room,
    )

    return {
        "response": reply,
        "lang_name": detected_lang,
        "lang_code": final_code,
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

    # Thêm các Node
    builder.add_node("fast_path", fast_path_node)
    builder.add_node("intent_router", intent_router_node)
    builder.add_node("retrieval", retrieval_node)
    builder.add_node("service_fsm", service_fsm_node)
    builder.add_node("generator", generator_node)

    # Thêm các Cạnh (Edges & Conditional Edges)
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

    # Compile đồ thị kèm In-Memory Checkpointer quản lý State phiên hội thoại
    memory = MemorySaver()
    return builder.compile(checkpointer=memory)


# Khởi tạo Singleton Instance cho toàn backend
concierge_graph = build_concierge_graph()
