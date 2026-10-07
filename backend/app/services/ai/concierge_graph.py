"""
Concierge Graph: LangGraph-powered Agent Harness for HCRobot Concierge.
Quản lý luồng xử lý tinh gọn (Fast-Path -> Direct Conversational Generator).
Đã gỡ bỏ hoàn toàn RAG (ChromaDB/BGE-M3) và bộ định tuyến bóc tách vé dịch vụ (Ticket Dispatching).
"""

import logging
from typing import Dict, Any, List, Optional, TypedDict

from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver

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
    response: str


# ============================================================================
# 1. GRAPH NODES (Các mắt xích xử lý trong Harness)
# ============================================================================

async def fast_path_node(state: ConciergeState) -> Dict[str, Any]:
    """
    Node 1: Fast-Path Rule Engine.
    Kiểm tra nhanh các câu hỏi thường gặp, lời chào, pass wifi, tiện ích cơ bản.
    Nếu khớp -> Độ trễ < 1ms, tiêu thụ 0 token, không gọi LLM.
    """
    prompt = state.get("prompt", "")
    language = state.get("language")

    fast_hit = ollama_service.check_fast_path(prompt, language)
    if fast_hit:
        reply, lang_name, lang_code = fast_hit
        logger.info(f"[Harness FastPath] Matched! Fast response in <1ms for: '{prompt[:30]}...'")
        return {
            "fast_path_hit": True,
            "response": reply,
            "lang_name": lang_name,
            "lang_code": lang_code,
            "intent_category": "fast_path",
            "action": "fast_path",
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
        "intent_category": "conversation",
        "action": "conversation",
        "missing_room_number": False,
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

    reply, detected_lang, final_code = await ollama_service.generate_response(
        prompt=prompt,
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
        "missing_room_number": False,
    }


# ============================================================================
# 2. CONDITIONAL ROUTERS (Bộ điều hướng luồng)
# ============================================================================

def route_after_fast_path(state: ConciergeState) -> str:
    """Nếu trúng Fast-Path thì dừng ngay (<1ms), ngược lại chuyển sang Generator sinh câu trả lời trực tiếp."""
    if state.get("fast_path_hit"):
        return END
    return "generator"


# ============================================================================
# 3. BUILD & COMPILE LANGGRAPH HARNESS
# ============================================================================

def build_concierge_graph() -> StateGraph:
    """Khởi tạo cấu trúc đồ thị trạng thái Agent hội thoại trực tiếp."""
    builder = StateGraph(ConciergeState)

    builder.add_node("fast_path", fast_path_node)
    builder.add_node("generator", generator_node)

    builder.add_edge(START, "fast_path")
    builder.add_conditional_edges(
        "fast_path",
        route_after_fast_path,
        {"generator": "generator", END: END}
    )
    builder.add_edge("generator", END)

    memory = MemorySaver()
    return builder.compile(checkpointer=memory)


# Khởi tạo Singleton Instance cho toàn backend
concierge_graph = build_concierge_graph()
