import logging
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends, status, WebSocket, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.ai import (
    ChatRequest,
    ChatResponse,
    IntentRequest,
    IntentResponse,
    SessionResetRequest,
    TTSRequest,
    TTSResponse,
    VoiceSettingsRequest,
    VoiceSettingsResponse,
    FeedbackCreate,
    FeedbackResponse,
    QuickTranslateRequest,
    QuickTranslateResponse,
)

# AI Sub-services
from app.services.ai.ai_chat_service import process_chat_request, generate_chat_stream
from app.services.ai.ai_ticket_service import (
    auto_create_ticket,
    background_extract_and_create_ticket,
)
from app.services.ai.feedback_service import submit_guest_feedback, get_feedbacks
from app.services.ai.websocket_pipeline import handle_pipecat_websocket
from app.services.ai.session_manager import session_manager
from app.services.ai.stt_service import transcribe_audio_wav
from app.services.ai.tts_service import tts_service
from app.services.ai.ollama_service import ollama_service
from app.services.ai.translation_service import translation_service

logger = logging.getLogger(__name__)
router = APIRouter()


# -----------------------------------------------------------------------------
# 1. Hội thoại thông minh (Chat & Streaming)
# -----------------------------------------------------------------------------
@router.post("/chat", response_model=ChatResponse, summary="Sinh câu trả lời hội thoại cho Concierge Robot")
async def chat_with_robot(request: ChatRequest, db: AsyncSession = Depends(get_db)):
    """
    Endpoint nhận prompt từ Robot/User (kèm session_id để duy trì bộ nhớ đa lượt) và sinh câu trả lời hội thoại nhanh chóng.
    Điều phối luồng qua AIChatService (LangGraph Harness, Session Memory, TTS, Auto Ticket/Live Call).
    """
    try:
        return await process_chat_request(db=db, request=request)
    except Exception as e:
        logger.error(f"[AIChat Error] {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e),
        )


@router.post("/chat/stream", summary="Streaming câu trả lời hội thoại từ Ollama LLM qua Server-Sent Events (SSE)")
async def chat_stream_endpoint(request: ChatRequest):
    """
    Endpoint streaming tokens trực tiếp từ LangGraph Harness & Ollama LLM về client theo thời gian thực.
    Tích hợp Fast-Path (<1ms) và Service FSM (<2ms) kết hợp duy trì bộ nhớ đa lượt Session Memory.
    """
    return StreamingResponse(generate_chat_stream(request), media_type="text/event-stream")


# -----------------------------------------------------------------------------
# 2. Xử lý Giọng nói (STT & TTS)
# -----------------------------------------------------------------------------
@router.post("/stt/transcribe", summary="Nhận diện giọng nói từ file âm thanh WAV")
async def transcribe_speech_endpoint(
    file: UploadFile = File(...),
    language: str = Form("vi"),
):
    """
    Endpoint nhận file âm thanh WAV từ frontend và trả về văn bản tiếng Việt/tiếng Anh.
    """
    try:
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="File âm thanh rỗng")

        text = transcribe_audio_wav(content, language=language)
        return {"success": True, "text": text, "language": language}
    except Exception as e:
        logger.error(f"[STT Endpoint Error] {e}")
        return {"success": False, "text": "", "error": str(e)}


@router.post(
    "/translate",
    response_model=QuickTranslateResponse,
    summary="Phiên dịch nhanh câu nói trực tiếp trong cuộc gọi Video Call (Anh - Việt)",
)
async def quick_translate_endpoint(request: QuickTranslateRequest):
    """
    Endpoint phiên dịch câu thoại thời gian thực cho WebRTC Video Call:
    - Tự động nhận diện tiếng Anh / tiếng Việt.
    - Bypass (không dịch) nếu khách và nhân viên cùng nói tiếng Việt (0ms).
    - Tự động dịch song ngữ 2 chiều: Khách nói tiếng Anh -> Dịch cho nhân viên đọc tiếng Việt; Nhân viên nói tiếng Việt -> Dịch cho khách đọc tiếng Anh.
    """
    result = await translation_service.translate(
        text=request.text,
        source_lang=request.source_lang or "auto",
        target_lang=request.target_lang or "vi",
        sender_role=request.sender_role or "guest",
    )
    return QuickTranslateResponse(**result)


@router.post("/tts", response_model=TTSResponse, summary="Chuyển văn bản thành âm thanh thoại MP3")
async def synthesize_voice_speech(request: TTSRequest):
    """
    Endpoint nhận văn bản và tổng hợp giọng thoại MP3 mã hóa Base64 siêu mượt.
    Tự động fallback giữa ElevenLabs -> OpenAI -> EdgeTTS Neural -> Browser Web Speech.
    """
    try:
        audio_b64, mime, provider_used = await tts_service.synthesize(
            text=request.text,
            provider=request.provider,
            voice=request.voice,
            language=request.language,
            rate=request.rate,
        )
        return TTSResponse(
            audio_base64=audio_b64,
            mime_type=mime,
            provider_used=provider_used,
        )
    except Exception as e:
        logger.error(f"[TTS Endpoint Error] {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.get("/voice-settings", response_model=VoiceSettingsResponse, summary="Lấy cấu hình tốc độ và giọng nói AI của Robot")
async def get_robot_voice_settings():
    """Lấy tốc độ phát âm thanh và giọng nói hiện tại của hệ thống Concierge Robot."""
    return tts_service.get_voice_settings()


@router.post("/voice-settings", response_model=VoiceSettingsResponse, summary="Admin cập nhật tốc độ và giọng nói AI của Robot")
async def update_robot_voice_settings(req: VoiceSettingsRequest):
    """Admin điều chỉnh tốc độ nói (0.5x - 2.0x) và giọng đọc của Robot trên toàn hệ thống."""
    return tts_service.update_voice_settings(
        speech_rate=req.speech_rate,
        vi_voice=req.vi_voice,
        en_voice=req.en_voice,
    )


@router.websocket("/ws/pipecat")
async def pipecat_audio_websocket(websocket: WebSocket, session_id: str = "pipecat_kiosk"):
    """
    Unified WebSocket Streaming Pipeline — STT Streaming + LLM Token Stream + TTS Audio Chunks.
    """
    await handle_pipecat_websocket(websocket, session_id)


# -----------------------------------------------------------------------------
# 3. Phân tích Ý định & Quản lý Phiên hội thoại (Intent & Session Memory)
# -----------------------------------------------------------------------------
@router.post("/intent", response_model=IntentResponse, summary="Phân tích ý định & bóc tách JSON yêu cầu dịch vụ")
async def extract_service_intent(request: IntentRequest, db: AsyncSession = Depends(get_db)):
    """
    Endpoint nhận văn bản giọng nói (STT) và bóc tách thông tin dịch vụ.
    Tự động ghi nhớ số phòng theo Session và chủ động hỏi số phòng nếu chưa có.
    """
    try:
        sid = request.session_id or "default_session"

        if request.room_number:
            session_manager.set_room_number(sid, request.room_number)

        intent_data = await ollama_service.extract_intent(user_speech=request.user_speech)
        action = intent_data.get("action", "unknown")
        speech_room = intent_data.get("room_number")
        items = intent_data.get("items") or request.user_speech

        if speech_room:
            session_manager.set_room_number(sid, speech_room)

        current_room = session_manager.get_room_number(sid)

        return IntentResponse(
            action=action,
            room_number=current_room,
            items=items,
            missing_room_number=False,
            suggested_reply=None,
            session_id=sid,
            raw_output=intent_data,
        )
    except Exception as e:
        logger.error(f"[AIIntent Error] {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.post("/session/reset", summary="Reset bộ nhớ phiên & Đóng gói lưu CSDL một lần duy nhất")
async def reset_session_memory(request: SessionResetRequest, db: AsyncSession = Depends(get_db)):
    """
    Đóng gói toàn bộ lịch sử hội thoại trong RAM lưu xuống PostgreSQL 1 lần duy nhất, sau đó xóa sạch bộ nhớ phiên.
    """
    await session_manager.flush_session_to_db(db, request.session_id)
    session_manager.reset_session(request.session_id)
    return {"success": True, "message": f"Session '{request.session_id}' flushed to DB and reset successfully."}


@router.post("/session/flush", summary="Đóng gói và lưu toàn bộ phiên hội thoại vào CSDL")
async def flush_session_endpoint(request: SessionResetRequest, db: AsyncSession = Depends(get_db)):
    """
    Chủ động đóng gói toàn bộ hội thoại trong RAM của session và lưu xuống PostgreSQL một lần duy nhất.
    """
    saved = await session_manager.flush_session_to_db(db, request.session_id)
    return {"success": True, "saved": saved, "session_id": request.session_id}


@router.get("/sessions", summary="Xem danh sách các phiên hội thoại đã lưu")
async def get_all_chat_sessions(db: AsyncSession = Depends(get_db)):
    """Lấy danh sách các phiên hội thoại (Chat Sessions) đã lưu trong PostgreSQL."""
    try:
        return await session_manager.get_all_db_sessions(db)
    except Exception as e:
        logger.error(f"[GetSessions Error] {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sessions/{session_id}/messages", summary="Xem chi tiết tin nhắn của một phiên hội thoại")
async def get_session_messages(session_id: str, db: AsyncSession = Depends(get_db)):
    """Lấy chi tiết danh sách tin nhắn hội thoại của một phiên từ PostgreSQL."""
    try:
        return await session_manager.get_db_session_messages(db, session_id)
    except Exception as e:
        logger.error(f"[GetMessages Error] {e}")
        raise HTTPException(status_code=500, detail=str(e))


# -----------------------------------------------------------------------------
# 4. Đánh giá & Phản hồi Dịch vụ (Feedback & Service Recovery)
# -----------------------------------------------------------------------------
@router.post("/feedback", response_model=FeedbackResponse, status_code=status.HTTP_201_CREATED, summary="Gửi phản hồi và đánh giá dịch vụ từ khách")
async def submit_feedback(fb_in: FeedbackCreate, db: AsyncSession = Depends(get_db)):
    """
    Lưu đánh giá của khách hàng và tự động kích hoạt cảnh báo khẩn cấp (Urgent Alert) tới Concierge và Lễ tân nếu rating <= 3.
    """
    return await submit_guest_feedback(db=db, fb_in=fb_in)


@router.get("/feedback", response_model=List[FeedbackResponse], summary="Xem danh sách phản hồi và đánh giá của khách hàng")
async def get_all_feedbacks(
    category: Optional[str] = None,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    """Lấy danh sách đánh giá của khách hàng."""
    return await get_feedbacks(db=db, category=category, limit=limit)


# -----------------------------------------------------------------------------
# Backward Compatibility Aliases
# -----------------------------------------------------------------------------
_auto_create_ticket = auto_create_ticket
_background_extract_and_create_ticket = background_extract_and_create_ticket
