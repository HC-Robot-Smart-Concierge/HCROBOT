"""SSE streaming chat pipeline and voice ticket submission helpers."""

import asyncio
import json
import logging
import re
from typing import AsyncGenerator

from app.schemas.ai import ChatRequest
from app.services.ai.ai_poi_detector import _detect_destination_poi
from app.services.ai.ai_suggested_prompts import get_dynamic_suggested_prompts
from app.services.ai.ai_ticket_service import (
    background_extract_and_create_ticket,
    create_bell_voice_ticket,
    create_maintenance_voice_ticket,
)
from app.services.ai.concierge_graph import intent_router_node, retrieval_node, service_fsm_node
from app.services.ai.ollama_service import ollama_service
from app.services.ai.session_manager import (
    extract_room_number,
    is_valid_hotel_room,
    session_manager,
)
from app.services.ai.tts_service import tts_service
from app.services.bell_request_service import bell_request_message
from app.services.maintenance_request_service import (
    duplicate_maintenance_message,
    merged_maintenance_message,
)

logger = logging.getLogger(__name__)


async def _submit_maintenance_for_chat(db, room_number, items, english):
    try:
        code, created, merged = await create_maintenance_voice_ticket(db, room_number, items)
        if merged:
            return code, merged_maintenance_message(code, english)
        return code, None if created else duplicate_maintenance_message(code, english)
    except Exception:
        await db.rollback()
        logger.exception("[AIChatService] Maintenance request was not saved")
        return None, (
            "I couldn't submit your maintenance request. Please try again."
            if english else "Em chưa gửi được yêu cầu bảo trì. Quý khách vui lòng thử lại."
        )


async def _submit_bell_for_chat(db, room_number, items, english):
    """Create the Bellman ticket before replying, so the guest hears the real ticket code."""
    try:
        request, created = await create_bell_voice_ticket(db, room_number, items)
        if (request.extra_data or {}).get("request_type") == "lost_found":
            msg = (
                f"Your lost & found report for Room {room_number} has been sent to Bell Services (ticket #{request.ticket_code}). Our team is checking and will contact you shortly."
                if english else
                f"Dạ Rora đã tiếp nhận báo cáo đồ thất lạc của Phòng {room_number} và chuyển tới bộ phận Bellman / Lost & Found, mã phiếu #{request.ticket_code}. Nhân viên đang kiểm tra và sẽ liên hệ quý khách ngay ạ."
            )
            return request.ticket_code, msg
        return request.ticket_code, bell_request_message(request, created, english)
    except Exception:
        await db.rollback()
        logger.exception("[AIChatService] Bellman request was not saved")
        return None, (
            "I couldn't submit your luggage request. Please try again."
            if english else "Em chưa gửi được yêu cầu hành lý. Quý khách vui lòng thử lại."
        )


async def generate_chat_stream(request: ChatRequest) -> AsyncGenerator[str, None]:
    """
    Streaming tokens trực tiếp từ LangGraph Harness & Ollama LLM về client qua Server-Sent Events (SSE).
    Tích hợp Fast-Path (<1ms) và Service FSM (<2ms) kết hợp duy trì bộ nhớ đa lượt Session Memory.
    """
    try:
        sid = request.session_id or "default_session"
        extracted_from_prompt = extract_room_number(request.prompt)
        if request.room_number:
            session_manager.set_room_number(sid, request.room_number)
        elif extracted_from_prompt:
            session_manager.set_room_number(sid, extracted_from_prompt)
        current_room = session_manager.get_room_number(sid)
        history = session_manager.get_history(sid)

        # 0. Instant ACK (< 5ms)
        yield f"data: {json.dumps({'event': 'ack', 'status': 'connected'}, ensure_ascii=False)}\n\n"

        # 1. KIỂM TRA HARNESS: MEGA FAST-PATH (< 1ms)
        # Bỏ qua Fast-Path tĩnh nếu câu hỏi mang tính yêu cầu dịch vụ / đồ dùng buồng phòng
        prompt_l = request.prompt.lower()
        is_action_svc = bool(re.search(
            r'(cho (tôi|mình|em)|xin|lấy|mang|đem|gửi|thêm|mượn|cần|muốn|đặt|yêu cầu|order|bring|send|give me|need)\b',
            prompt_l,
            re.IGNORECASE
        )) and any(k in prompt_l for k in ["khăn", "khan", "gối", "chăn", "nệm", "dép", "bàn chải", "dầu gội", "sữa tắm", "massage", "giặt ủi", "dọn phòng", "món", "cơm", "nước", "đồ ăn"])
        fast_hit = None if is_action_svc else ollama_service.check_fast_path_full(request.prompt, request.language)
        if fast_hit:
            reply, _lang_name, lang_code, act_type, act_payload = fast_hit
            dest_key = act_payload.get("destination_key") if isinstance(act_payload, dict) else None
            if not dest_key and act_type != "none":
                dest_key = _detect_destination_poi(request.prompt, reply, current_room, session_id=sid)
            logger.info(f"[AIChatStream Fast-Path] Trả lời tức thì <1ms cho: '{request.prompt[:30]}' (dest: {dest_key})")

            words = reply.split(" ")
            for i, w in enumerate(words):
                token_piece = w + (" " if i < len(words) - 1 else "")
                yield f"data: {json.dumps({'event': 'token', 'token': token_piece}, ensure_ascii=False)}\n\n"
                await asyncio.sleep(0.008)

            session_manager.add_turn(sid, "user", request.prompt, language=lang_code)
            session_manager.add_turn(sid, "assistant", reply, language=lang_code, intent_action=act_type or "fast_path")
            suggested = get_dynamic_suggested_prompts(
                prompt=request.prompt,
                reply=reply,
                action=act_type or "fast_path",
                destination_key=dest_key,
                lang_code=lang_code,
                age_group=request.age_group,
                gender=request.gender,
            )
            if dest_key:
                session_manager.set_active_topic(sid, topic=dest_key, destination_key=dest_key)

            try:
                audio_b64, mime_type, _ = await asyncio.wait_for(
                    tts_service.synthesize(reply, provider="edge", language=lang_code),
                    timeout=2.5
                )
            except Exception:
                audio_b64, mime_type = None, "audio/mp3"

            done_payload = {
                "event": "done",
                "full_text": reply,
                "lang_code": lang_code,
                "room_number": current_room,
                "action": act_type or "fast_path",
                "destination_key": dest_key,
                "suggested_prompts": suggested,
                "audio_base64": audio_b64,
                "mime_type": mime_type or "audio/mp3",
            }
            yield f"data: {json.dumps(done_payload, ensure_ascii=False)}\n\n"
            return

        # 2. KIỂM TRA HARNESS: INTENT ROUTER & SERVICE FSM (< 2ms)
        router_state = await intent_router_node({
            "prompt": request.prompt,
            "room_number": current_room,
            "session_id": sid,
        })
        category = router_state.get("intent_category", "chitchat")
        action = router_state.get("action", "conversation")

        if category == "service":
            effective_room = router_state.get("room_number") or current_room
            if effective_room and is_valid_hotel_room(effective_room):
                session_manager.set_room_number(sid, effective_room)
                current_room = effective_room

            fsm_state = await service_fsm_node({
                "action": action,
                "session_id": sid,
                "is_room_authenticated": session_manager.is_room_authenticated(sid, effective_room),
                "room_number": effective_room,
                "items": router_state.get("items"),
                "lang_code": "en-US" if request.language and "en" in request.language.lower() else "vi-VN",
            })

            fsm_reply = fsm_state.get("response", "")
            is_call = bool(fsm_state.get("trigger_video_call") or action == "concierge")
            missing_room = bool(fsm_state.get("missing_room_number", False))
            fsm_items = router_state.get("items") or request.prompt

            # CHỈ TẠO TICKET KHI ĐÃ CÓ ĐẦY ĐỦ SỐ PHÒNG
            ticket_code = None
            fsm_action = fsm_state.get("action") or action  # e.g. the FSM opened a menu instead
            if not is_call and not missing_room and not fsm_state.get("require_room_pin") and effective_room and fsm_action not in ["provide_room_number", "unknown", "chitchat", "conversation", "faq", "fast_path", "query_order_status", "taxi", "book_taxi", "taxi_booking", "open_food_menu", "open_room_service_menu", "open_maintenance_menu", "open_bellman_menu"]:
                if action == "maintenance":
                    from app.core.database import AsyncSessionLocal
                    async with AsyncSessionLocal() as ticket_db:
                        ticket_code, notice = await _submit_maintenance_for_chat(
                            ticket_db, effective_room, fsm_items, bool(request.language and "en" in request.language.lower()),
                        )
                    if notice:
                        fsm_reply = notice
                elif action == "bellman":
                    from app.core.database import AsyncSessionLocal
                    async with AsyncSessionLocal() as ticket_db:
                        ticket_code, fsm_reply = await _submit_bell_for_chat(
                            ticket_db, effective_room, fsm_items, bool(request.language and "en" in request.language.lower()),
                        )
                else:
                    asyncio.create_task(
                        background_extract_and_create_ticket(fsm_items, effective_room, action, fsm_items)
                    )
                logger.info(f"[AIChatStream] Dispatched ticket creation for '{action}' (Room {effective_room}): {fsm_items}")

            logger.info(f"[AIChatStream FSM] Trả lời FSM tức thì <2ms cho action: '{action}'")

            words = fsm_reply.split(" ")
            for i, w in enumerate(words):
                token_piece = w + (" " if i < len(words) - 1 else "")
                yield f"data: {json.dumps({'event': 'token', 'token': token_piece}, ensure_ascii=False)}\n\n"
                await asyncio.sleep(0.008)

            _, final_lang_code = ollama_service.detect_language(fsm_reply)
            session_manager.add_turn(sid, "user", request.prompt, language=final_lang_code)
            session_manager.add_turn(sid, "assistant", fsm_reply, language=final_lang_code, intent_action=fsm_action)

            response_room = fsm_state.get("room_number")
            valid_response_room = response_room if is_valid_hotel_room(response_room) else (current_room if is_valid_hotel_room(current_room) else None)
            done_payload = {
                "event": "done",
                "full_text": fsm_reply,
                "ticket_code": ticket_code,
                "require_room_pin": bool(fsm_state.get("require_room_pin")),
                "target_room_number": fsm_state.get("target_room_number"),
                "pending_service_action": fsm_state.get("pending_service_action"),
                "pending_service_items": fsm_state.get("pending_service_items"),
                "lang_code": final_lang_code,
                "room_number": valid_response_room,
                "missing_room_number": missing_room,
                "action": fsm_action,
                "trigger_menu": fsm_state.get("trigger_menu"),
                "trigger_video_call": is_call,
            }
            yield f"data: {json.dumps(done_payload, ensure_ascii=False)}\n\n"
            return

        # 3. TRUY VẤN VÀ CẮT GỌT RAG CONTEXT TỪ KNOWLEDGE BASE CHO CÂU HỎI THÔNG TIN
        rag_context = request.rag_context
        if category in ("faq", "conversation", "chitchat") and not rag_context and len(request.prompt.strip()) > 3:
            try:
                retrieval_res = await retrieval_node({"prompt": request.prompt})
                rag_context = retrieval_res.get("rag_context", "")
            except Exception as ex_rag:
                logger.warning(f"[AIChatStream] Retrieval error: {ex_rag}")

        # 4. TRÒ CHUYỆN TỰ DO: STREAM OLLAMA TOKENS TỪ LLM
        full_text = ""
        async for token in ollama_service.generate_response_stream(
            prompt=request.prompt,
            rag_context=rag_context,
            language=request.language,
            emotion=request.emotion,
            chat_history=history,
            stored_room_number=current_room,
            age_group=request.age_group,
            gender=request.gender,
        ):
            full_text += token
            yield f"data: {json.dumps({'event': 'token', 'token': token}, ensure_ascii=False)}\n\n"

        _, final_lang_code = ollama_service.detect_language(full_text)

        session_manager.add_turn(sid, "user", request.prompt, language=final_lang_code)
        session_manager.add_turn(sid, "assistant", full_text, language=final_lang_code, intent_action="conversation")

        dest_key = _detect_destination_poi(request.prompt, full_text, current_room, session_id=sid)
        suggested = get_dynamic_suggested_prompts(
            prompt=request.prompt,
            reply=full_text,
            action="conversation",
            destination_key=dest_key,
            lang_code=final_lang_code,
            age_group=request.age_group,
            gender=request.gender,
        )
        if dest_key:
            session_manager.set_active_topic(sid, topic=dest_key, destination_key=dest_key)

        done_payload = {
            "event": "done",
            "full_text": full_text,
            "lang_code": final_lang_code,
            "room_number": current_room,
            "action": "conversation",
            "destination_key": dest_key,
            "suggested_prompts": suggested,
        }
        yield f"data: {json.dumps(done_payload, ensure_ascii=False)}\n\n"
    except Exception as e:
        logger.error(f"[AIChatStream Error] {e}")
        yield f"data: {json.dumps({'event': 'error', 'message': str(e)}, ensure_ascii=False)}\n\n"
