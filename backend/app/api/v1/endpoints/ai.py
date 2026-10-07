import json
import logging
import asyncio
import time
import random
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, HTTPException, Depends, status, WebSocket, WebSocketDisconnect, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from app.services.ai.stt_service import transcribe_audio_wav

from app.core.database import get_db
from app.schemas.ai import (
    ChatRequest,
    ChatResponse,
    IntentRequest,
    IntentResponse,
    SessionResetRequest,
    TTSRequest,
    TTSResponse,
    FeedbackCreate,
    FeedbackResponse,
)
from app.services.ai.ollama_service import ollama_service
from app.services.ai.session_manager import session_manager
from app.services.ai.tts_service import tts_service
from app.services.ai.pipecat_service import pipecat_service
from app.services.ai.concierge_graph import concierge_graph
from app.core.config import settings
from app.models import (
    RoomServiceOrder,
    SupportRequest,
    Feedback,
)
from app.api.v1.endpoints.operations import create_department_notification

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/chat", response_model=ChatResponse, summary="Sinh câu trả lời hội thoại cho Concierge Robot")
async def chat_with_robot(request: ChatRequest, db: AsyncSession = Depends(get_db)):
    """
    Endpoint nhận prompt từ Robot/User (kèm session_id để duy trì bộ nhớ đa lượt) và sinh câu trả lời hội thoại nhanh chóng.
    Đã gỡ bỏ RAG, BGE-M3 và logic tự động phân chia / gửi ticket để tập trung tối đa vào giao tiếp tự nhiên.
    """
    try:
        sid = request.session_id or "default_session"

        # Cập nhật số phòng nếu truyền trực tiếp
        if request.room_number:
            session_manager.set_room_number(sid, request.room_number)

        current_room = session_manager.get_room_number(sid)
        history = session_manager.get_history(sid)

        # Điều phối hội thoại trực tiếp qua LangGraph Harness (Fast-Path <1ms -> Direct Generator)
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

        # TTS DECOUPLED: Chạy TTS nhanh cho reply ngắn (<50 ký tự), còn lại frontend dùng WebSpeech
        audio_b64 = None
        mime_type = "audio/mp3"
        if len(reply) < 50:
            try:
                audio_b64, mime_type, _ = await asyncio.wait_for(
                    tts_service.synthesize(reply, provider="edge", language=lang_code),
                    timeout=2.0
                )
            except Exception as e_tts:
                logger.warning(f"[AIChat] TTS short-reply timeout, fallback to WebSpeech: {e_tts}")
                audio_b64, mime_type = None, "audio/mp3"

        return ChatResponse(
            response=reply,
            model_used=settings.OLLAMA_MODEL,
            detected_language=detected_lang,
            lang_code=lang_code,
            session_id=sid,
            current_room_number=current_room,
            missing_room_number=False,
            audio_base64=audio_b64,
            mime_type=mime_type or "audio/mp3",
        )

    except Exception as e:
        logger.error(f"[AIChat Error] {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e)
        )


@router.post("/chat/stream", summary="Streaming câu trả lời hội thoại từ Ollama LLM qua Server-Sent Events (SSE)")
async def chat_stream_endpoint(request: ChatRequest):
    """
    Endpoint streaming tokens trực tiếp từ Qwen LLM về client theo thời gian thực.
    Continuous Token Streaming kết hợp duy trì bộ nhớ đa lượt Session Memory.
    """
    async def event_generator():
        try:
            sid = request.session_id or "default_session"
            if request.room_number:
                session_manager.set_room_number(sid, request.room_number)
            current_room = session_manager.get_room_number(sid)
            history = session_manager.get_history(sid)

            # 0. INSTANT ACK (<5ms) — Frontend biết kết nối sống ngay lập tức
            yield f"data: {json.dumps({'event': 'ack', 'status': 'connected'}, ensure_ascii=False)}\n\n"

            # 1. Stream Ollama tokens trực tiếp liên tục từ Qwen 3B
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

            # Lưu lại lịch sử lượt nói vào bộ nhớ RAM của phiên để duy trì ngữ cảnh
            session_manager.add_turn(sid, "user", request.prompt, language=final_lang_code)
            session_manager.add_turn(sid, "assistant", full_text, language=final_lang_code, intent_action="conversation")

            yield f"data: {json.dumps({'event': 'done', 'full_text': full_text, 'lang_code': final_lang_code, 'room_number': current_room}, ensure_ascii=False)}\n\n"
        except Exception as e:
            logger.error(f"[AIChatStream Error] {e}")
            yield f"data: {json.dumps({'event': 'error', 'message': str(e)}, ensure_ascii=False)}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.post("/stt/transcribe", summary="Nhận diện giọng nói từ file âm thanh WAV")
async def transcribe_speech_endpoint(
    file: UploadFile = File(...),
    language: str = Form("vi")
):
    """
    Endpoint nhận file âm thanh WAV từ frontend và trả về văn bản tiếng Việt/tiếng Anh.
    Giải quyết triệt để 100% vấn đề trình duyệt không nhận diện được tiếng nói.
    """
    try:
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="File âm thanh rỗng")

        text = transcribe_audio_wav(content, language=language)
        return {
            "success": True,
            "text": text,
            "language": language
        }
    except Exception as e:
        logger.error(f"[STT Endpoint Error] {e}")
        return {
            "success": False,
            "text": "",
            "error": str(e)
        }


@router.post("/intent", response_model=IntentResponse, summary="Phân tích ý định & bóc tách JSON yêu cầu dịch vụ (kèm Slot-Filling Số Phòng)")
async def extract_service_intent(request: IntentRequest, db: AsyncSession = Depends(get_db)):
    """
    Endpoint nhận văn bản giọng nói (STT) và bóc tách thông tin dịch vụ.
    Tự động ghi nhớ số phòng theo Session và chủ động hỏi số phòng nếu chưa có.
    """
    try:
        sid = request.session_id or "default_session"

        # Cập nhật số phòng nếu truyền trực tiếp
        if request.room_number:
            session_manager.set_room_number(sid, request.room_number)

        intent_data = await ollama_service.extract_intent(user_speech=request.user_speech)
        action = intent_data.get("action", "unknown")
        speech_room = intent_data.get("room_number")
        items = intent_data.get("items") or request.user_speech

        # 1. Nếu câu nói của khách có chứa số phòng -> Ghi đè vào Session Memory
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
            raw_output=intent_data
        )

    except Exception as e:
        logger.error(f"[AIIntent Error] {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/session/reset", summary="Reset bộ nhớ phiên & Đóng gói lưu CSDL một lần duy nhất")
async def reset_session_memory(request: SessionResetRequest, db: AsyncSession = Depends(get_db)):
    """
    Đóng gói toàn bộ lịch sử hội thoại trong RAM lưu xuống PostgreSQL 1 lần duy nhất, sau đó xóa sạch bộ nhớ phiên.
    """
    await session_manager.flush_session_to_db(db, request.session_id)
    session_manager.reset_session(request.session_id)
    return {"success": True, "message": f"Session '{request.session_id}' flushed to DB and reset successfully."}


@router.post("/session/flush", summary="Đóng gói và lưu toàn bộ phiên hội thoại vào CSDL (End-of-Session Bulk Persistence)")
async def flush_session_endpoint(request: SessionResetRequest, db: AsyncSession = Depends(get_db)):
    """
    Chủ động đóng gói toàn bộ hội thoại trong RAM của session và lưu xuống PostgreSQL một lần duy nhất.
    """
    saved = await session_manager.flush_session_to_db(db, request.session_id)
    return {"success": True, "saved": saved, "session_id": request.session_id}


@router.post("/tts", response_model=TTSResponse, summary="Chuyển văn bản thành âm thanh thoại MP3 (EdgeTTS / ElevenLabs / OpenAI TTS)")
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
            detail=str(e)
        )


@router.websocket("/ws/pipecat")
async def pipecat_audio_websocket(websocket: WebSocket, session_id: str = "pipecat_kiosk"):
    """
    Unified WebSocket Streaming Pipeline — STT Streaming + LLM Token Stream + TTS Audio Chunks.
    Events:
    - event="stt_interim": Client gửi interim transcript → Server echo lại để hiển thị UI
    - event="stt_final":   Client gửi final transcript → Server trigger full AI pipeline streaming
    - event="speech_stream": Client gửi text trực tiếp (bypass STT) → Server trigger full AI pipeline streaming
    - event="speech": (Legacy) Chờ full response rồi trả JSON + Base64 audio
    - event="barge_in": Client yêu cầu dừng Robot đang nói
    """
    await websocket.accept()
    pipecat_service.create_pipeline_session(session_id)
    logger.info(f"[Pipecat WS] WebSocket client connected: session_id='{session_id}'")

    # Server-side VAD timer and active pipeline task references
    vad_timer_task: Optional[asyncio.Task] = None
    active_pipeline_task: Optional[asyncio.Task] = None
    last_processed_prompt: str = ""
    last_processed_timestamp: float = 0.0

    async def _safe_start_pipeline(text: str, room: Optional[str], lang: str):
        """Khởi chạy streaming pipeline an toàn: hủy task cũ nếu đang chạy và chống trùng lặp câu hỏi."""
        nonlocal active_pipeline_task, vad_timer_task, last_processed_prompt, last_processed_timestamp

        clean_text = text.strip()
        if not clean_text:
            return

        # Hủy VAD timer nếu còn pending
        if vad_timer_task and not vad_timer_task.done():
            vad_timer_task.cancel()

        # Chống gửi lặp câu cùng lúc (Deduplication within 1.5s)
        now = time.time()
        if (now - last_processed_timestamp < 1.5) and (clean_text.lower() == last_processed_prompt.lower()):
            logger.info(f"[Pipecat WS] Ignored duplicate prompt '{clean_text}' within {now - last_processed_timestamp:.2f}s")
            return

        last_processed_prompt = clean_text
        last_processed_timestamp = now

        # Nếu đang có một luồng pipeline khác đang phát âm thanh cho session này, lập tức hủy luồng cũ (tránh 2 giọng nói đè nhau)
        if active_pipeline_task and not active_pipeline_task.done():
            active_pipeline_task.cancel()
            pipecat_service.handle_barge_in(session_id)
            logger.info(f"[Pipecat WS] Cancelled previous pipeline task to prevent overlapping voices for '{session_id}'")

        active_pipeline_task = asyncio.create_task(_trigger_streaming_pipeline(clean_text, room, lang))

    async def _trigger_streaming_pipeline(text: str, room: Optional[str], lang: str):
        """Helper: chạy full streaming pipeline và gửi kết quả qua WebSocket."""
        try:
            async for chunk in pipecat_service.process_user_speech_stream(
                session_id, text, room_number=room, language=lang
            ):
                chunk_type = chunk.get("type")

                if chunk_type == "audio_chunk":
                    await websocket.send_bytes(chunk["data"])
                elif chunk_type == "token":
                    await websocket.send_json({
                        "event": "token",
                        "session_id": session_id,
                        "token": chunk.get("token", ""),
                    })
                elif chunk_type in ("text", "text_chunk"):
                    await websocket.send_json({
                        "event": chunk_type,
                        "session_id": session_id,
                        "text": chunk.get("text", ""),
                        "lang_code": chunk.get("lang_code", "vi-VN"),
                        "action": chunk.get("action"),
                        "missing_room": chunk.get("missing_room", False),
                        "room_number": chunk.get("room_number"),
                    })
                elif chunk_type == "done":
                    await websocket.send_json({
                        "event": "stream_done",
                        "session_id": session_id,
                        "full_text": chunk.get("full_text", ""),
                        "lang_code": chunk.get("lang_code", "vi-VN"),
                        "action": chunk.get("action"),
                        "room_number": chunk.get("room_number"),
                    })
                elif chunk_type == "interrupted":
                    await websocket.send_json({
                        "event": "interrupted",
                        "session_id": session_id,
                        "full_text": chunk.get("full_text", ""),
                    })
                elif chunk_type == "error":
                    await websocket.send_json({
                        "event": "error",
                        "session_id": session_id,
                        "message": chunk.get("message", ""),
                    })
        except (WebSocketDisconnect, RuntimeError):
            logger.info(f"[Pipecat WS] WebSocket client disconnected during stream for session '{session_id}'")
        except asyncio.CancelledError:
            logger.info(f"[Pipecat WS] Pipeline task was cancelled for session '{session_id}'")
        except Exception as e_pipe:
            logger.error(f"[Pipecat WS Pipeline Error] {e_pipe}")
            try:
                await websocket.send_json({
                    "event": "error",
                    "session_id": session_id,
                    "message": str(e_pipe),
                })
            except Exception:
                pass

    async def _vad_silence_handler(room: Optional[str], lang: str):
        """
        Server-side VAD: chờ đủ thời gian im lặng (1.5s) mới chốt câu và chạy pipeline.
        Tránh cắt ngang khi khách dừng lại lấy hơi hoặc đang nghĩ dở câu.
        """
        vad_ms = max(getattr(settings, "VAD_SILENCE_MS", 500) / 1000.0, 0.4)
        await asyncio.sleep(vad_ms)

        # Sau khi chờ im lặng, kiểm tra buffer còn text chưa xử lý
        final_text = pipecat_service.get_stt_text(session_id)
        if final_text and final_text.strip():
            clean = final_text.strip()
            # Tránh kích hoạt nếu câu chỉ có 1 từ đệm ngắn chưa có nghĩa (ví dụ: "ờ", "ừm", "cho")
            if len(clean.split()) < 2 and len(clean) < 6:
                logger.info(f"[Pipecat WS VAD] Skipped incomplete fragment '{clean}', waiting for more speech")
                return

            pipecat_service.clear_stt_buffer(session_id)

            # Gửi thông báo bắt đầu xử lý
            await websocket.send_json({
                "event": "stt_processing",
                "session_id": session_id,
                "text": clean,
            })

            await _safe_start_pipeline(clean, room, lang)

    try:
        while True:
            data = await websocket.receive_json()
            event_type = data.get("event")

            if event_type == "barge_in":
                if vad_timer_task and not vad_timer_task.done():
                    vad_timer_task.cancel()
                if active_pipeline_task and not active_pipeline_task.done():
                    active_pipeline_task.cancel()
                pipecat_service.handle_barge_in(session_id)
                pipecat_service.clear_stt_buffer(session_id)
                await websocket.send_json({"event": "interrupted", "session_id": session_id})

            elif event_type == "stt_interim":
                text = data.get("text", "")
                room = data.get("room_number")
                lang = data.get("language", "auto")

                if text.strip():
                    pipecat_service.update_stt_buffer(session_id, text, is_final=False)

                    # Echo interim text ngay cho UI hiển thị (< 1ms roundtrip)
                    await websocket.send_json({
                        "event": "stt_interim_echo",
                        "session_id": session_id,
                        "text": text,
                    })

                    # Reset VAD timer — mỗi interim mới reset lại đồng hồ
                    if vad_timer_task and not vad_timer_task.done():
                        vad_timer_task.cancel()
                    vad_timer_task = asyncio.create_task(
                        _vad_silence_handler(room, lang)
                    )

            elif event_type == "stt_final":
                text = data.get("text", "")
                room = data.get("room_number")
                lang = data.get("language", "auto")

                if vad_timer_task and not vad_timer_task.done():
                    vad_timer_task.cancel()

                if text.strip():
                    pipecat_service.update_stt_buffer(session_id, text, is_final=True)
                    pipecat_service.clear_stt_buffer(session_id)

                    await websocket.send_json({
                        "event": "stt_processing",
                        "session_id": session_id,
                        "text": text,
                    })

                    await _safe_start_pipeline(text, room, lang)

            elif event_type == "speech_stream":
                text = data.get("text", "")
                room = data.get("room_number")
                lang = data.get("language", "auto")

                if vad_timer_task and not vad_timer_task.done():
                    vad_timer_task.cancel()

                if text.strip():
                    pipecat_service.clear_stt_buffer(session_id)
                    await _safe_start_pipeline(text, room, lang)

            elif event_type == "speech":
                # Legacy mode (backward compatible)
                text = data.get("text", "")
                room = data.get("room_number")
                result = await pipecat_service.process_user_speech(session_id, text, room)
                await websocket.send_json({
                    "event": "audio_stream",
                    "session_id": session_id,
                    "payload": result
                })

    except WebSocketDisconnect:
        logger.info(f"[Pipecat WS] WebSocket disconnected for session '{session_id}'")
    except Exception as e:
        logger.error(f"[Pipecat WS Error] {e}")
    finally:
        if vad_timer_task and not vad_timer_task.done():
            vad_timer_task.cancel()
        if active_pipeline_task and not active_pipeline_task.done():
            active_pipeline_task.cancel()
        pipecat_service.close_session(session_id)


@router.get("/sessions")
async def get_all_chat_sessions(db: AsyncSession = Depends(get_db)):
    """Lấy danh sách các phiên hội thoại (Chat Sessions) đã lưu trong PostgreSQL."""
    try:
        from app.models.chat_session import ChatSession
        from sqlalchemy.future import select

        result = await db.execute(select(ChatSession).order_by(ChatSession.updated_at.desc()))
        sessions = result.scalars().all()
        return [
            {
                "id": s.id,
                "room_number": s.room_number,
                "guest_name": s.guest_name,
                "is_active": s.is_active,
                "created_at": s.created_at.isoformat() if s.created_at else None,
                "updated_at": s.updated_at.isoformat() if s.updated_at else None,
            }
            for s in sessions
        ]
    except Exception as e:
        logger.error(f"[GetSessions Error] {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sessions/{session_id}/messages")
async def get_session_messages(session_id: str, db: AsyncSession = Depends(get_db)):
    """Lấy chi tiết danh sách tin nhắn hội thoại của một phiên từ PostgreSQL."""
    try:
        from app.models.chat_session import ChatMessage
        from sqlalchemy.future import select

        result = await db.execute(select(ChatMessage).where(ChatMessage.session_id == session_id).order_by(ChatMessage.id.asc()))
        messages = result.scalars().all()
        return [
            {
                "id": m.id,
                "session_id": m.session_id,
                "sender": m.sender,
                "text": m.text,
                "language": m.language,
                "intent_action": m.intent_action,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            }
            for m in messages
        ]
    except Exception as e:
        logger.error(f"[GetMessages Error] {e}")
        raise HTTPException(status_code=500, detail=str(e))


async def _auto_create_ticket(db: AsyncSession, action: str, room_number: str, items: str) -> str:
    """Tự động chèn Ticket dịch vụ vào PostgreSQL Database tương ứng (SupportRequest / RoomServiceOrder) và gửi Notification cho Lễ tân / Staff."""
    code = f"AUTO-{random.randint(1000, 99999)}"
    rm = room_number or "402"

    try:
        if action in ["room_service", "restaurant"]:
            order = RoomServiceOrder(
                order_number=str(random.randint(1043, 9999)),
                room_number=rm,
                items=[{"name": items, "qty": 1}],
                note="Yêu cầu gửi từ HCRobot Concierge AI Chat",
                status="Pending",
                progress=0,
            )
            db.add(order)
            await create_department_notification(
                db=db,
                department="F&B",
                title=f"Robot AI: Yêu cầu F&B mới từ Phòng {rm}",
                description=f"{items}",
                request_id=order.id,
                request_type="room_service",
                type="Request",
            )
            await create_department_notification(
                db=db,
                department="Reception",
                title=f"Robot AI: Đơn F&B mới từ Khách Phòng {rm}",
                description=f"Robot đã tiếp nhận đơn #{order.order_number}: {items}",
                request_id=order.id,
                request_type="room_service",
                type="Request",
            )
            await db.commit()
            return order.order_number

        elif action == "housekeeping":
            ticket_code = f"HK-{random.randint(1000, 99999)}"
            req = SupportRequest(
                ticket_code=ticket_code,
                source="HCRobot Concierge AI Chat",
                title=f"Yêu cầu Buồng phòng (Phòng {rm}): {items}",
                room_number=rm,
                description=items,
                guest_name=f"Guest (Room {rm})",
                department_id="DEP-HOUSEKEEPING",
                service_type_id="ST-HOUSEKEEPING",
                priority="NORMAL",
                status="Unassigned",
            )
            db.add(req)
            await create_department_notification(
                db=db,
                department="Housekeeping",
                title=f"Robot AI: Yêu cầu Buồng phòng mới #{ticket_code}",
                description=f"Phòng {rm}: {items}",
                request_id=req.id,
                request_type="housekeeping",
                type="Request",
            )
            await create_department_notification(
                db=db,
                department="Reception",
                title=f"Robot AI: Yêu cầu Buồng phòng từ Khách Phòng {rm}",
                description=f"Phiếu #{ticket_code}: {items}",
                request_id=req.id,
                request_type="housekeeping",
                type="Request",
            )
            await db.commit()
            return ticket_code

        elif action == "bellman":
            ticket_code = f"BS-{random.randint(1000, 99999)}"
            req = SupportRequest(
                ticket_code=ticket_code,
                source="HCRobot Concierge AI Chat",
                title=f"Khách phòng {rm} hỗ trợ hành lý: {items}",
                room_number=rm,
                guest_name=f"Guest (Room {rm})",
                description=items,
                department_id="DEP-BELL",
                service_type_id="ST-BELL",
                priority="NORMAL",
                status="Pending",
            )
            db.add(req)
            await create_department_notification(
                db=db,
                department="Bell Services",
                title=f"Robot AI: Yêu cầu Hành lý mới #{ticket_code}",
                description=f"Phòng {rm}: {items}",
                request_id=req.id,
                request_type="bell_service",
                type="Request",
            )
            await create_department_notification(
                db=db,
                department="Reception",
                title=f"Robot AI: Yêu cầu Bellman từ Khách Phòng {rm}",
                description=f"Phiếu #{ticket_code}: {items}",
                request_id=req.id,
                request_type="bell_service",
                type="Request",
            )
            await db.commit()
            return ticket_code

        elif action == "maintenance":
            ticket_code = f"MN-{random.randint(1000, 99999)}"
            req = SupportRequest(
                ticket_code=ticket_code,
                source="HCRobot Concierge AI Chat",
                title=f"Sự cố kỹ thuật Phòng {rm}: {items}",
                room_number=rm,
                description=items,
                guest_name=f"Guest (Room {rm})",
                department_id="DEP-MAINTENANCE",
                service_type_id="ST-MAINTENANCE",
                priority="HIGH",
                status="Pending",
            )
            db.add(req)
            await create_department_notification(
                db=db,
                department="Maintenance",
                title=f"Robot AI: Yêu cầu Kỹ thuật mới #{ticket_code}",
                description=f"Phòng {rm}: {items}",
                request_id=req.id,
                request_type="maintenance",
                type="Request",
            )
            await create_department_notification(
                db=db,
                department="Reception",
                title=f"Robot AI: Yêu cầu Bảo trì từ Khách Phòng {rm}",
                description=f"Phiếu #{ticket_code}: {items}",
                request_id=req.id,
                request_type="maintenance",
                type="Request",
            )
            await db.commit()
            return ticket_code

        elif action == "taxi":
            ticket_code = f"TX-{random.randint(1000, 99999)}"
            req = SupportRequest(
                ticket_code=ticket_code,
                source="HCRobot Concierge AI Chat",
                title=f"Yêu cầu Đặt xe từ Phòng {rm}: {items}",
                room_number=rm,
                description=items,
                guest_name=f"Guest (Room {rm})",
                department_id="DEP-TAXI",
                service_type_id="ST-TAXI",
                priority="NORMAL",
                status="Pending",
            )
            db.add(req)
            await create_department_notification(
                db=db,
                department="Taxi",
                title=f"Robot AI: Yêu cầu Đặt xe mới #{ticket_code}",
                description=f"Phòng {rm}: {items}",
                request_id=req.id,
                request_type="taxi",
                type="Request",
            )
            await create_department_notification(
                db=db,
                department="Reception",
                title=f"Robot AI: Yêu cầu Taxi từ Khách Phòng {rm}",
                description=f"Phiếu #{ticket_code}: {items}",
                request_id=req.id,
                request_type="taxi",
                type="Request",
            )
            await db.commit()
            return ticket_code

        elif action in ["concierge", "live_support", "video_call", "emergency"]:
            ticket_code = f"CCG-{random.randint(1000, 99999)}"
            req = SupportRequest(
                ticket_code=ticket_code,
                source="Robot Voice Assistant",
                title=f"Yêu cầu Hỗ trợ Concierge trực tuyến (Phòng {rm}): {items}",
                room_number=rm,
                description=items or "Yêu cầu kết nối Live Call với Concierge từ Robot",
                guest_name=f"Guest (Room {rm})",
                department_id="DEP-CONCIERGE",
                service_type_id="ST-CONCIERGE",
                priority="HIGH",
                status="Pending",
            )
            db.add(req)
            await create_department_notification(
                db=db,
                department="Concierge",
                title=f"Robot AI: Cuộc gọi hỗ trợ Concierge #{ticket_code}",
                description=f"Phòng {rm} cần trợ giúp: {items}",
                request_id=req.id,
                request_type="concierge",
                type="LiveAssistance",
            )
            await create_department_notification(
                db=db,
                department="Reception",
                title=f"Robot AI: Yêu cầu Concierge từ Khách Phòng {rm}",
                description=f"Phiếu #{ticket_code}: {items}",
                request_id=req.id,
                request_type="concierge",
                type="Request",
            )
            await db.commit()
            return ticket_code

        else:
            # Default Reception & General Service Request
            ticket_code = f"REC-{random.randint(1000, 99999)}"
            req = SupportRequest(
                ticket_code=ticket_code,
                source="HCRobot Concierge AI Chat",
                title=f"Yêu cầu Lễ tân từ Phòng {rm}: {items}",
                room_number=rm,
                description=items,
                guest_name=f"Guest (Room {rm})",
                department_id="DEP-RECEPTION",
                service_type_id="ST-RECEPTION",
                priority="NORMAL",
                status="Pending",
            )
            db.add(req)
            await create_department_notification(
                db=db,
                department="Reception",
                title=f"Robot AI: Yêu cầu Lễ tân mới #{ticket_code}",
                description=f"Phòng {rm}: {items}",
                request_id=req.id,
                request_type="reception",
                type="Request",
            )
            await db.commit()
            return ticket_code

    except Exception as e:
        logger.error(f"Lỗi khi tự động tạo ticket dịch vụ CSDL: {e}")
        await db.rollback()

    return code


@router.post("/feedback", response_model=FeedbackResponse, status_code=status.HTTP_201_CREATED, summary="Gửi phản hồi và đánh giá dịch vụ từ khách")
async def submit_feedback(fb_in: FeedbackCreate, db: AsyncSession = Depends(get_db)):
    """Lưu đánh giá và nhận xét của khách hàng vào bảng feedbacks trong cơ sở dữ liệu."""
    new_fb = Feedback(
        chat_session_id=fb_in.chat_session_id,
        rating=fb_in.rating,
        category=fb_in.category,
        comment=fb_in.comment,
        guest_name=fb_in.guest_name,
        room_number=fb_in.room_number,
    )
    db.add(new_fb)
    await db.commit()
    await db.refresh(new_fb)
    return new_fb


@router.get("/feedback", response_model=List[FeedbackResponse], summary="Xem danh sách phản hồi và đánh giá của khách hàng")
async def get_all_feedbacks(
    category: Optional[str] = None,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    """Lấy danh sách đánh giá của khách hàng."""
    from sqlalchemy.future import select
    stmt = select(Feedback).order_by(Feedback.created_at.desc()).limit(limit)
    if category:
        stmt = stmt.where(Feedback.category == category)
    res = await db.execute(stmt)
    return res.scalars().all()


async def _background_save_chat(session_id: str, user_turn: str, ai_turn: str, lang_code: str, room_number: Optional[str]):
    """Lưu lượt hội thoại vào PostgreSQL trong nền, không chặn thời gian phản hồi của Robot."""
    try:
        from app.core.database import AsyncSessionLocal
        async with AsyncSessionLocal() as bg_db:
            await session_manager.save_turn_to_db(bg_db, session_id, "user", user_turn, language=lang_code, room_number=room_number)
            await session_manager.save_turn_to_db(bg_db, session_id, "assistant", ai_turn, language=lang_code, room_number=room_number)
    except Exception as e:
        logger.warning(f"[AIChat Background Save Error] {e}")
