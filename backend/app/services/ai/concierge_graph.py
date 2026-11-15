"""
Concierge Graph: LangGraph-powered Agent Harness for HCRobot Concierge.
Quan ly luong xu ly tinh gon (Fast-Path -> Direct Conversational Generator).
"""

from datetime import datetime, timezone
import logging
import re
from typing import Any, Dict, List, Optional, cast

from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.graph.state import CompiledStateGraph

from app.services.ai.concierge_fast_path_node import fast_path_node
from app.services.ai.concierge_fsm_node import service_fsm_node
from app.services.ai.concierge_intent_router_node import intent_router_node
from app.services.ai.concierge_order_status_db import query_room_order_status_db
from app.services.ai.concierge_state import ConciergeState
from app.services.ai.constants import (
    BELLMAN_MENU_TRIGGER_KEYWORDS,
    HOUSEKEEPING_REGEX,
    MAINTENANCE_MENU_TRIGGER_KEYWORDS,
    MAINTENANCE_REGEX,
    ROOM_SERVICE_FOOD_REGEX,
    SERVICE_KEYWORDS,
    contains_keyword,
    is_lost_found_text,
)
from app.services.ai.ollama_service import ollama_service
from app.services.ai.session_manager import extract_room_number, session_manager
from app.services.bell_request_service import bell_status_reply, classify_bell_request, is_bell_inquiry
from app.services.maintenance_request_service import is_fault_report

logger = logging.getLogger(__name__)


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


concierge_graph: CompiledStateGraph = build_concierge_graph()
