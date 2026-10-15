import asyncio
import json
import logging
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.ai import ChatRequest, ChatResponse
from app.services.ai.session_manager import session_manager
from app.services.ai.concierge_graph import concierge_graph
from app.services.ai.tts_service import tts_service
from app.services.ai.ollama_service import ollama_service
from app.services.ai.ai_ticket_service import create_live_call_session, background_extract_and_create_ticket
from app.core.config import settings

logger = logging.getLogger(__name__)


async def process_chat_request(db: AsyncSession, request: ChatRequest) -> ChatResponse:
    """
    Điều phối luồng xử lý câu thoại của khách:
    1. Cập nhật Session Memory (Số phòng & Ngữ cảnh đa lượt).
    2. Chạy LangGraph Concierge Harness (Fast-Path hoặc Ollama Generator).
    3. Cập nhật lượt hội thoại vào Session Memory.
    4. Tổng hợp giọng đọc TTS (Hoài My - EdgeTTS).
    5. Xử lý tác vụ nghiệp vụ: Khởi tạo Live Video Call hoặc tạo Background Service Ticket.
    """
    sid = request.session_id or "default_session"

    # Cập nhật số phòng nếu truyền trực tiếp
    if request.room_number:
        session_manager.set_room_number(sid, request.room_number)

    current_room = session_manager.get_room_number(sid)
    history = session_manager.get_history(sid)

    # Điều phối hội thoại trực tiếp qua LangGraph Harness
    initial_state = {
        "session_id": sid,
        "prompt": request.prompt,
        "language": request.language,
        "emotion": request.emotion,
        "room_number": current_room,
        "chat_history": history,
    }
    graph_config = {"configurable": {"thread_id": sid}}
    graph_result = await concierge_graph.ainvoke(initial_state, config=graph_config)

    reply = graph_result.get("response", "")
    detected_lang = graph_result.get("lang_name", "Tiếng Việt")
    lang_code = graph_result.get("lang_code", "vi-VN")
    act = graph_result.get("action", "conversation")

    # Thêm lượt nói vào bộ nhớ RAM của phiên để duy trì ngữ cảnh nhiều lượt
    session_manager.add_turn(sid, "user", request.prompt, language=lang_code)
    session_manager.add_turn(sid, "assistant", reply, language=lang_code, intent_action=act)

    # Lấy audio_base64 từ TTS Service (EdgeTTS với fallback)
    try:
        audio_b64, mime_type, _ = await asyncio.wait_for(
            tts_service.synthesize(reply, provider="edge", language=lang_code),
            timeout=12.0
        )
    except Exception as e_tts:
        logger.warning(f"[AIChatService] TTS online timeout/error, fallback to frontend WebSpeech: {e_tts}")
        audio_b64, mime_type = None, "audio/mp3"

    # Xử lý Intent phân loại tác vụ dịch vụ / cuộc gọi
    act = graph_result.get("action")
    items = graph_result.get("items")
    is_video_call = bool(graph_result.get("trigger_video_call") or act == "concierge")
    support_session_id = None
    call_ticket_code = None

    if is_video_call:
        support_session_id, call_ticket_code = await create_live_call_session(
            db, request.prompt, current_room
        )
    else:
        # Tự động tạo ticket dịch vụ trong nền tận dụng intent từ LangGraph
        asyncio.create_task(
            background_extract_and_create_ticket(request.prompt, current_room, act, items)
        )

    return ChatResponse(
        response=reply,
        model_used=settings.OLLAMA_MODEL,
        detected_language=detected_lang,
        lang_code=lang_code,
        session_id=sid,
        current_room_number=current_room,
        missing_room_number=bool(graph_result.get("missing_room_number", False)),
        trigger_video_call=is_video_call,
        support_session_id=support_session_id,
        ticket_code=call_ticket_code,
        audio_base64=audio_b64,
        mime_type=mime_type or "audio/mp3",
    )


async def generate_chat_stream(request: ChatRequest) -> AsyncGenerator[str, None]:
    """
    Streaming tokens trực tiếp từ Ollama Qwen 3B về client qua Server-Sent Events (SSE).
    """
    try:
        sid = request.session_id or "default_session"
        if request.room_number:
            session_manager.set_room_number(sid, request.room_number)
        current_room = session_manager.get_room_number(sid)
        history = session_manager.get_history(sid)

        # 0. Instant ACK (< 5ms)
        yield f"data: {json.dumps({'event': 'ack', 'status': 'connected'}, ensure_ascii=False)}\n\n"

        # 1. Stream Ollama tokens
        full_text = ""
        async for token in ollama_service.generate_response_stream(
            prompt=request.prompt,
            language=request.language,
            emotion=request.emotion,
            chat_history=history,
            stored_room_number=current_room,
        ):
            full_text += token
            yield f"data: {json.dumps({'event': 'token', 'token': token}, ensure_ascii=False)}\n\n"

        _, final_lang_code = ollama_service.detect_language(full_text)

        # Lưu lại lịch sử lượt nói vào bộ nhớ RAM
        session_manager.add_turn(sid, "user", request.prompt, language=final_lang_code)
        session_manager.add_turn(sid, "assistant", full_text, language=final_lang_code, intent_action="conversation")

        yield f"data: {json.dumps({'event': 'done', 'full_text': full_text, 'lang_code': final_lang_code, 'room_number': current_room}, ensure_ascii=False)}\n\n"
    except Exception as e:
        logger.error(f"[AIChatStream Error] {e}")
        yield f"data: {json.dumps({'event': 'error', 'message': str(e)}, ensure_ascii=False)}\n\n"
