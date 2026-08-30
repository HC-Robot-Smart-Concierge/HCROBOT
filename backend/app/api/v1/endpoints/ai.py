import logging
import asyncio
import random
from fastapi import APIRouter, HTTPException, Depends, status, WebSocket, WebSocketDisconnect
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
)
from app.services.ai.ollama_service import ollama_service
from app.services.ai.session_manager import session_manager
from app.services.ai.tts_service import tts_service
from app.services.ai.pipecat_service import pipecat_service
from app.core.config import settings
from app.models import (
    RoomServiceOrder,
    HousekeepingRequest,
    BellRequest,
    MaintenanceRequest,
    RestaurantPreOrder,
)

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/chat", response_model=ChatResponse, summary="Sinh câu trả lời hội thoại cho Concierge Robot")
async def chat_with_robot(request: ChatRequest, db: AsyncSession = Depends(get_db)):
    """
    Endpoint nhận prompt từ Robot/User (kèm session_id để duy trì bộ nhớ đa lượt) và sinh câu trả lời bằng Ollama LLM.
    """
    try:
        sid = request.session_id or "default_session"
        rag_ctx = request.rag_context

        # Cập nhật số phòng nếu truyền trực tiếp
        if request.room_number:
            session_manager.set_room_number(sid, request.room_number)

        current_room = session_manager.get_room_number(sid)
        history = session_manager.get_history(sid)

        # Nếu chưa truyền RAG context -> Tự động tìm kiếm tài liệu liên quan trong ChromaDB
        if not rag_ctx:
            try:
                from app.db.chroma import get_concierge_collection
                collection = get_concierge_collection("concierge_kb")
                results = await asyncio.to_thread(
                    collection.query,
                    query_texts=[request.prompt],
                    n_results=3
                )
                if results and results.get("documents") and results["documents"][0]:
                    rag_ctx = "\n---\n".join(results["documents"][0])
            except Exception as ex:
                logger.warning(f"Không thể truy vấn RAG context từ ChromaDB: {ex}")

        # Sinh câu trả lời qua Ollama kèm lịch sử phiên & số phòng đã lưu
        reply, detected_lang, lang_code = await ollama_service.generate_response(
            prompt=request.prompt,
            rag_context=rag_ctx,
            language=request.language or "auto",
            emotion=request.emotion or "neutral",
            chat_history=history,
            stored_room_number=current_room,
        )

        # Thêm lượt nói vào bộ nhớ phiên & Lưu bền vững vào PostgreSQL Database (bảng chat_sessions & chat_messages)
        session_manager.add_turn(sid, "user", request.prompt)
        session_manager.add_turn(sid, "assistant", reply)
        await session_manager.save_turn_to_db(db, sid, "user", request.prompt, language=lang_code, room_number=current_room)
        await session_manager.save_turn_to_db(db, sid, "assistant", reply, language=lang_code, room_number=current_room)

        return ChatResponse(
            response=reply,
            model_used=settings.OLLAMA_MODEL,
            detected_language=detected_lang,
            lang_code=lang_code,
            session_id=sid,
            current_room_number=current_room,
            missing_room_number=False,
        )

    except Exception as e:
        logger.error(f"[AIChat Error] {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e)
        )


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

        # 2. Xử lý trường hợp khách cung cấp số phòng để hoàn tất đơn hàng dở dang (Pending Intent)
        pending = session_manager.get_pending_intent(sid)
        if (speech_room or action == "provide_room_number") and current_room and pending:
            p_action = pending.get("action", "room_service")
            p_items = pending.get("items") or "Dịch vụ yêu cầu"
            
            # Tự động tạo ticket vào PostgreSQL CSDL
            created_ticket_code = await _auto_create_ticket(db, p_action, current_room, p_items)
            session_manager.set_pending_intent(sid, None)

            suggested = f"Dạ em đã ghi nhận yêu cầu '{p_items}' cho Phòng {current_room} rồi ạ. Nhân viên sẽ hỗ trợ quý khách ngay!"
            
            return IntentResponse(
                action=p_action,
                room_number=current_room,
                items=p_items,
                missing_room_number=False,
                suggested_reply=suggested,
                session_id=sid,
                raw_output={"status": "completed_pending_order", "ticket_code": created_ticket_code}
            )

        # 3. Các hành động dịch vụ cần số phòng: room_service, housekeeping, bellman, maintenance, restaurant
        SERVICE_ACTIONS = ["room_service", "housekeeping", "bellman", "maintenance", "restaurant"]
        
        if action in SERVICE_ACTIONS:
            # Nếu chưa có số phòng trong lượt nói và cũng chưa lưu trong Session -> Chủ động hỏi
            if not current_room:
                session_manager.set_pending_intent(sid, {"action": action, "items": items})
                suggested_question = f"Dạ em sẽ hỗ trợ {action} ngay! Quý khách vui lòng cho em xin số phòng của mình là bao nhiêu ạ?"
                
                return IntentResponse(
                    action="ask_room_number",
                    room_number=None,
                    items=items,
                    missing_room_number=True,
                    suggested_reply=suggested_question,
                    session_id=sid,
                    raw_output=intent_data
                )

            # Đã có số phòng -> Tự động tạo Ticket vào CSDL
            created_ticket_code = await _auto_create_ticket(db, action, current_room, items)
            confirm_msg = f"Dạ em đã ghi nhận yêu cầu dịch vụ cho Phòng {current_room} rồi ạ!"

            return IntentResponse(
                action=action,
                room_number=current_room,
                items=items,
                missing_room_number=False,
                suggested_reply=confirm_msg,
                session_id=sid,
                raw_output={"status": "ticket_created", "ticket_code": created_ticket_code}
            )

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


@router.post("/session/reset", summary="Reset bộ nhớ phiên (Dùng cho nút Khách Mới / Đổi Phòng)")
async def reset_session_memory(request: SessionResetRequest):
    """
    Xóa sạch lịch sử hội thoại, số phòng và đơn hàng dở dang của session.
    """
    session_manager.reset_session(request.session_id)
    return {"success": True, "message": f"Session '{request.session_id}' reset successfully."}


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
    WebSocket Realtime Audio Streaming & Barge-in Interruption Endpoint (Pipecat Pipeline).
    Stream 16kHz PCM audio frames 2 chiều với độ trễ cực thấp (< 200ms).
    """
    await websocket.accept()
    pipecat_service.create_pipeline_session(session_id)
    logger.info(f"[Pipecat WS] WebSocket client connected: session_id='{session_id}'")

    try:
        while True:
            data = await websocket.receive_json()
            event_type = data.get("event")

            if event_type == "barge_in":
                # Sự kiện người dùng cất tiếng nói ngắt lời Robot -> Hủy luồng audio phát
                pipecat_service.handle_barge_in(session_id)
                await websocket.send_json({"event": "interrupted", "session_id": session_id})

            elif event_type == "speech":
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
    """Tự động chèn Ticket dịch vụ vào PostgreSQL Database tương ứng."""
    code = f"AUTO-{random.randint(1000, 9999)}"

    try:
        if action == "room_service":
            order = RoomServiceOrder(
                order_number=str(random.randint(1043, 9999)),
                room_number=room_number,
                is_vip=False,
                priority="normal",
                items=[{"name": items, "qty": 1}],
                note="Tạo tự động từ HCRobot Voice Concierge",
                status="Pending",
                progress=0,
            )
            db.add(order)
            await db.commit()
            return order.order_number

        elif action == "housekeeping":
            req = HousekeepingRequest(
                ticket_code=f"HK-{random.randint(1044, 9999)}",
                source="HCRobot Voice Concierge",
                priority="NORMAL",
                time_label="Recently",
                title=f"Khách phòng {room_number} yêu cầu: {items}",
                room_number=room_number,
                description=items,
                guest_name=f"Guest (Room {room_number})",
                status="Unassigned",
            )
            db.add(req)
            await db.commit()
            return req.ticket_code

        elif action == "bellman":
            req = BellRequest(
                ticket_code=f"BS-{random.randint(1044, 9999)}",
                title=f"Khách phòng {room_number} hỗ trợ hành lý: {items}",
                priority="NORMAL",
                is_urgent=False,
                location=f"Phòng {room_number}",
                guest_name=f"Guest (Room {room_number})",
                description=items,
                request_type="luggage",
                status="Pending",
            )
            db.add(req)
            await db.commit()
            return req.ticket_code

        elif action == "maintenance":
            req = MaintenanceRequest(
                ticket_code=f"MN-{random.randint(1044, 9999)}",
                title=f"Sự cố kỹ thuật Phòng {room_number}: {items}",
                category="general",
                priority="NORMAL",
                reported_time_label="Just Now",
                location=f"Phòng {room_number}",
                description=items,
                source="HCRobot Voice Concierge",
                status="Pending",
            )
            db.add(req)
            await db.commit()
            return req.ticket_code

    except Exception as e:
        logger.error(f"Lỗi khi tự động tạo ticket dịch vụ CSDL: {e}")
        await db.rollback()

    return code
