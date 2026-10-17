import asyncio
import json
import logging
import re
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.ai import ChatRequest, ChatResponse
from app.services.ai.session_manager import session_manager
from app.services.ai.concierge_graph import concierge_graph, intent_router_node, service_fsm_node, retrieval_node
from app.services.ai.tts_service import tts_service
from app.services.ai.ollama_service import ollama_service
from app.services.ai.ai_ticket_service import create_live_call_session, background_extract_and_create_ticket
from app.core.config import settings

logger = logging.getLogger(__name__)


def _detect_destination_poi(prompt: str, reply: str) -> str | None:
    """Nhận diện mã điểm đến POI để đồng bộ bản đồ 8 tầng."""
    p_lower = prompt.lower()
    
    # Nếu khách hỏi đường tới các địa điểm bên ngoài khách sạn -> Tuyệt đối KHÔNG bật bản đồ trong nhà
    external_places = [
        "sân bay", "airport", "nội bài", "tân sơn nhất", "ga tàu", "ga hà nội",
        "bến xe", "bãi biển", "ra biển", "chợ", "chợ đêm", "bến thành",
        "phố cổ", "hồ gươm", "trung tâm thương mại", "vincom", "bệnh viện",
        "bảo tàng", "ngoài khách sạn", "địa điểm du lịch", "tour", "bắt taxi", "bắt xe", "grab"
    ]
    if any(k in p_lower for k in external_places):
        return None

    # 1. Nhận diện các phòng Tầng 4 (401 -> 409)
    room_4xx_match = re.search(r'\b(?:phòng|p\.?|phong)?\s*(40[1-9])\b', p_lower)
    if room_4xx_match:
        return f"room_{room_4xx_match.group(1)}"

    # 2. Nhận diện các phòng Tầng 3 (301 -> 309)
    room_3xx_match = re.search(r'\b(?:phòng|p\.?|phong)?\s*(30[1-9])\b', p_lower)
    if room_3xx_match:
        return f"room_{room_3xx_match.group(1)}"

    # 3. Khu vực Tầng 2 (Bếp, Nhận món, Kho, Sơ chế, WC)
    if any(k in p_lower for k in ["nhà bếp", "nha bep", "khu bếp", "bếp chính", "kitchen"]):
        return "kitchen"
    if any(k in p_lower for k in ["sơ chế", "so che", "chuẩn bị món", "preparation"]):
        return "preparation_area"
    if any(k in p_lower for k in ["kho hàng", "kho hang", "kho nguyên liệu", "kho thực phẩm", "warehouse"]):
        return "warehouse"
    if any(k in p_lower for k in ["vệ sinh tầng 2", "wc tầng 2", "toilet tầng 2", "restroom tầng 2"]):
        return "restroom_f2"
    if any(k in p_lower for k in ["nhà hàng", "nha hang", "buffet", "ăn sáng", "quầy nhận món", "pickup"]):
        return "restaurant"

    # 4. Tiện ích Tầng 5 & Tầng 6
    if any(k in p_lower for k in ["hồ bơi", "ho boi", "bể bơi", "pool", "bơi"]):
        return "infinity_pool"
    if any(k in p_lower for k in ["rooftop", "cafe", "cà phê", "coffee"]):
        return "rooftop_coffee"
    if any(k in p_lower for k in ["quầy bar", "quay bar", "sky bar", "sky lounge", "uống rượu"]):
        return "bar"
    if any(k in p_lower for k in ["karaoke", "hát karaoke", "phòng hát"]):
        return "karaoke"
    if any(k in p_lower for k in ["gym", "thể hình", "the hinh", "fitness", "tập gym"]):
        return "gym"
    if any(k in p_lower for k in ["spa", "massage", "xông hơi", "mát xa"]):
        return "spa"
    if any(k in p_lower for k in ["lưu niệm", "gift shop", "cửa hàng quà"]):
        return "gift_shop"
    if any(k in p_lower for k in ["thay đồ", "locker", "tủ đồ"]):
        return "locker_room"

    # 5. Tiện ích Tầng Trệt & Bãi xe
    if any(k in p_lower for k in ["lễ tân", "tiếp tân", "quầy lễ tân", "bàn lễ tân", "front desk", "check-in", "check in"]):
        return "front_desk"
    if any(k in p_lower for k in ["vệ sinh tầng trệt", "vệ sinh ở sảnh", "wc ở sảnh", "toilet sảnh"]):
        return "restroom_ground"
    if any(k in p_lower for k in ["xe máy", "gửi xe máy", "bãi xe máy", "xe đạp", "hầm b1"]):
        return "parking_bike"
    if any(k in p_lower for k in ["đỗ ô tô", "bãi ô tô", "bãi xe ô tô", "hầm b2", "xe hơi"]):
        return "parking_car"
    if any(k in p_lower for k in ["bãi xe", "đỗ xe", "gửi xe", "parking"]):
        return "parking_car"

    return None


async def process_chat_request(db: AsyncSession, request: ChatRequest) -> ChatResponse:
    """
    Điều phối luồng xử lý câu thoại của khách:
    1. Cập nhật Session Memory (Số phòng & Ngữ cảnh đa lượt).
    2. Chạy LangGraph Concierge Harness (Fast-Path hoặc Ollama Generator).
    3. Cập nhật lượt hội thoại vào Session Memory.
    4. Tổng hợp giọng đọc TTS (Hoài My - EdgeTTS).
    5. Xử lý tác vụ nghiệp vụ: Khởi tạo Live Video Call hoặc tạo Background Service Ticket.
    6. Nhận diện điểm đến POI cho bản đồ tương tác.
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
        "destination_key": None,
        "trigger_video_call": False,
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

    # Cập nhật số phòng mới nhất từ kết quả Graph hoặc Session Manager
    updated_room = graph_result.get("room_number") or session_manager.get_room_number(sid)
    if updated_room:
        session_manager.set_room_number(sid, updated_room)
        current_room = updated_room

    # Xử lý Intent phân loại tác vụ dịch vụ / cuộc gọi
    act = graph_result.get("action")
    items = graph_result.get("items") or request.prompt
    is_video_call = bool(graph_result.get("trigger_video_call") or act == "concierge")
    missing_room = bool(graph_result.get("missing_room_number", False))
    support_session_id = None
    call_ticket_code = None

    if is_video_call:
        support_session_id, call_ticket_code = await create_live_call_session(
            db, request.prompt, current_room
        )
    elif act and act not in ["chitchat", "conversation", "faq", "fast_path", "provide_room_number", "unknown"]:
        # CHỈ TẠO TICKET KHI ĐÃ CÓ ĐẦY ĐỦ SỐ PHÒNG CỦA KHÁCH
        if not missing_room and current_room:
            asyncio.create_task(
                background_extract_and_create_ticket(items, current_room, act, items)
            )
            logger.info(f"[AIChatService] Dispatched ticket creation for '{act}' (Room {current_room}): {items}")
        else:
            logger.info(f"[AIChatService] Service request '{act}' is waiting for room number from guest.")

    destination_key = graph_result.get("destination_key") or _detect_destination_poi(request.prompt, reply)

    return ChatResponse(
        response=reply,
        model_used=settings.active_llm_model,
        detected_language=detected_lang,
        lang_code=lang_code,
        session_id=sid,
        current_room_number=current_room,
        missing_room_number=missing_room,
        trigger_video_call=is_video_call,
        support_session_id=support_session_id,
        ticket_code=call_ticket_code,
        audio_base64=audio_b64,
        mime_type=mime_type or "audio/mp3",
        destination_key=destination_key,
    )


async def generate_chat_stream(request: ChatRequest) -> AsyncGenerator[str, None]:
    """
    Streaming tokens trực tiếp từ LangGraph Harness & Ollama LLM về client qua Server-Sent Events (SSE).
    Tích hợp Fast-Path (<1ms) và Service FSM (<2ms) kết hợp duy trì bộ nhớ đa lượt Session Memory.
    """
    try:
        sid = request.session_id or "default_session"
        if request.room_number:
            session_manager.set_room_number(sid, request.room_number)
        current_room = session_manager.get_room_number(sid)
        history = session_manager.get_history(sid)

        # 0. Instant ACK (< 5ms)
        yield f"data: {json.dumps({'event': 'ack', 'status': 'connected'}, ensure_ascii=False)}\n\n"

        # 1. KIỂM TRA HARNESS: MEGA FAST-PATH (< 1ms)
        fast_hit = ollama_service.check_fast_path(request.prompt, request.language)
        if fast_hit:
            reply, lang_name, lang_code = fast_hit
            logger.info(f"[AIChatStream Fast-Path] Trả lời tức thì <1ms cho: '{request.prompt[:30]}'")

            words = reply.split(" ")
            for i, w in enumerate(words):
                token_piece = w + (" " if i < len(words) - 1 else "")
                yield f"data: {json.dumps({'event': 'token', 'token': token_piece}, ensure_ascii=False)}\n\n"
                await asyncio.sleep(0.008)

            session_manager.add_turn(sid, "user", request.prompt, language=lang_code)
            session_manager.add_turn(sid, "assistant", reply, language=lang_code, intent_action="fast_path")
            done_payload = {
                "event": "done",
                "full_text": reply,
                "lang_code": lang_code,
                "room_number": current_room,
                "action": "fast_path",
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
            if effective_room:
                session_manager.set_room_number(sid, effective_room)
                current_room = effective_room

            fsm_state = await service_fsm_node({
                "action": action,
                "room_number": effective_room,
                "items": router_state.get("items"),
                "lang_code": "en-US" if request.language and "en" in request.language.lower() else "vi-VN",
            })

            fsm_reply = fsm_state.get("response", "")
            is_call = bool(fsm_state.get("trigger_video_call") or action == "concierge")
            missing_room = bool(fsm_state.get("missing_room_number", False))
            fsm_items = router_state.get("items") or request.prompt

            # CHỈ TẠO TICKET KHI ĐÃ CÓ ĐẦY ĐỦ SỐ PHÒNG
            if not is_call and not missing_room and effective_room and action not in ["provide_room_number", "unknown"]:
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
            session_manager.add_turn(sid, "assistant", fsm_reply, language=final_lang_code, intent_action=action)

            done_payload = {
                "event": "done",
                "full_text": fsm_reply,
                "lang_code": final_lang_code,
                "room_number": effective_room,
                "missing_room_number": missing_room,
                "action": action,
                "trigger_video_call": is_call,
            }
            yield f"data: {json.dumps(done_payload, ensure_ascii=False)}\n\n"
            return

        # 3. NẾU LÀ FAQ: TRUY VẤN VÀ CẮT GỌT RAG CONTEXT (HARNESS CONTEXT PRUNING)
        rag_context = request.rag_context
        if category == "faq" and not rag_context:
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
        ):
            full_text += token
            yield f"data: {json.dumps({'event': 'token', 'token': token}, ensure_ascii=False)}\n\n"

        _, final_lang_code = ollama_service.detect_language(full_text)

        session_manager.add_turn(sid, "user", request.prompt, language=final_lang_code)
        session_manager.add_turn(sid, "assistant", full_text, language=final_lang_code, intent_action="conversation")

        done_payload = {
            "event": "done",
            "full_text": full_text,
            "lang_code": final_lang_code,
            "room_number": current_room,
            "action": "conversation",
        }
        yield f"data: {json.dumps(done_payload, ensure_ascii=False)}\n\n"
    except Exception as e:
        logger.error(f"[AIChatStream Error] {e}")
        yield f"data: {json.dumps({'event': 'error', 'message': str(e)}, ensure_ascii=False)}\n\n"
