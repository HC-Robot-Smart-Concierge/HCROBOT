import asyncio
import json
import logging
import re
import time
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


def _detect_destination_poi(prompt: str, reply: str = "") -> str | None:
    """
    Nhận diện mã điểm đến POI để đồng bộ bản đồ 8 tầng.
    Chỉ kích hoạt khi câu hỏi của người dùng (prompt) thực sự có ý định hỏi đường/vị trí.
    Tuyệt đối không tự tiện bật bản đồ khi người dùng chỉ hỏi thông tin dịch vụ thông thường
    mà câu trả lời của AI có nhắc đến quầy lễ tân hoặc tiện ích.
    """
    p_lower = (prompt or "").lower().strip()
    r_lower = (reply or "").lower().strip()
    combined = f"{p_lower} {r_lower}".strip()

    # Nếu khách hỏi đường tới các địa điểm bên ngoài khách sạn -> Tuyệt đối KHÔNG bật bản đồ trong nhà
    external_places = [
        "sân bay", "airport", "nội bài", "tân sơn nhất", "ga tàu", "ga hà nội",
        "bến xe", "bãi biển", "ra biển", "chợ", "chợ đêm", "bến thành",
        "phố cổ", "hồ gươm", "trung tâm thương mại", "vincom", "bệnh viện",
        "bảo tàng", "ngoài khách sạn", "địa điểm du lịch", "tour", "bắt taxi", "bắt xe", "grab"
    ]
    if any(k in p_lower for k in external_places):
        return None

    # Danh mục từ khóa biểu thị ý định hỏi đường / điều hướng / tìm vị trí
    nav_intent_phrases = [
        "ở đâu", "o dau", "chỗ nào", "cho nao", "nơi nào", "noi nao",
        "tầng mấy", "tang may", "ở tầng", "o tang", "hướng nào", "huong nao",
        "đường đi", "duong di", "đường đến", "duong den", "đường ra", "duong ra",
        "chỉ đường", "chi duong", "dẫn đường", "dan duong", "hướng dẫn đường",
        "lối đi", "loi di", "lối lên", "loi len", "lối xuống", "loi xuong",
        "làm sao để đến", "lam sao de den", "cách đi", "cach di", "cách đến", "cach den",
        "đi đến", "di den", "đi tới", "di toi", "đi ra", "di ra", "đi lên", "di len", "đi xuống", "di xuong",
        "dẫn tôi", "dan toi", "dắt tôi", "cho tôi đến", "cho toi den",
        "tôi muốn đến", "toi muon den", "tôi muốn đi", "toi muon di",
        "đưa tôi", "dua toi", "tìm đường", "tim duong", "vị trí", "vi tri", "chỉ tôi", "chi toi",
        "where is", "where are", "where's", "which floor", "how to get", "how do i get",
        "way to", "directions to", "show me the way", "take me to", "lead me to", "navigate to"
    ]

    # Danh mục cụm từ đi tới địa điểm trực tiếp (dù không có chữ 'ở đâu')
    direct_loc_phrases = [
        "đi vệ sinh", "di ve sinh", "đi toilet", "di toilet", "đi wc", "di wc",
        "ra lễ tân", "ra quầy", "lên hồ bơi", "ra hồ bơi", "xuống bãi xe",
        "vào thang máy", "lên phòng gym", "đi massage", "đi spa"
    ]

    # Kiểm tra xem câu hỏi có chứa số phòng cụ thể cần tìm (3xx hoặc 4xx)
    room_4xx_match = re.search(r'\b(?:phòng|p\.?|phong)?\s*(40[1-9])\b', p_lower)
    room_3xx_match = re.search(r'\b(?:phòng|p\.?|phong)?\s*(30[1-9])\b', p_lower)

    # Khách nói cộc lốc tên địa điểm (<= 3 từ) hoặc có ý định hỏi đường rõ ràng
    p_words = p_lower.split()
    is_short_location_utterance = len(p_words) <= 3 and any(
        k in p_lower for k in [
            "toilet", "vệ sinh", "wc", "hồ bơi", "pool", "gym", "spa",
            "nhà hàng", "búp phê", "buffet", "lễ tân", "reception", "bãi xe"
        ]
    )

    has_nav_intent = (
        bool(room_4xx_match or room_3xx_match) or
        any(k in p_lower for k in nav_intent_phrases) or
        any(k in p_lower for k in direct_loc_phrases) or
        is_short_location_utterance
    )

    # NẾU KHÔNG CÓ Ý ĐỊNH HỎI ĐƯỜNG -> TUYỆT ĐỐI KHÔNG BẬT BẢN ĐỒ CHỈ ĐƯỜNG
    if not has_nav_intent:
        return None

    # 1. Nhận diện các phòng Tầng 4 (401 -> 409)
    if room_4xx_match:
        return f"room_{room_4xx_match.group(1)}"
    room_4xx_comb = re.search(r'\b(?:phòng|p\.?|phong)?\s*(40[1-9])\b', combined)
    if room_4xx_comb:
        return f"room_{room_4xx_comb.group(1)}"

    # 2. Nhận diện các phòng Tầng 3 (301 -> 309)
    if room_3xx_match:
        return f"room_{room_3xx_match.group(1)}"
    room_3xx_comb = re.search(r'\b(?:phòng|p\.?|phong)?\s*(30[1-9])\b', combined)
    if room_3xx_comb:
        return f"room_{room_3xx_comb.group(1)}"

    # 3. Khu vực Vệ Sinh (Toilet / WC / Restroom toàn khách sạn)
    if any(k in combined for k in [
        "vệ sinh", "ve sinh", "toilet", "wc", "restroom", "washroom",
        "nhà vệ sinh", "nha ve sinh", "phòng vệ sinh", "phong ve sinh",
        "đi vệ sinh", "di ve sinh", "đi toilet"
    ]):
        if any(f in combined for f in ["tầng 2", "tang 2", "nhà hàng", "bếp", "kho"]):
            return "restroom_f2"
        if any(f in combined for f in ["sảnh", "tầng 1", "trệt", "lễ tân", "ground"]):
            return "restroom_ground"
        return "restroom_ground"

    # 4. Khu vực Tầng 2 (Bếp, Nhận món, Kho, Sơ chế, Nhà hàng)
    if any(k in combined for k in ["nhà bếp", "nha bep", "khu bếp", "bếp chính", "kitchen"]):
        return "kitchen"
    if any(k in combined for k in ["sơ chế", "so che", "chuẩn bị món", "preparation"]):
        return "preparation_area"
    if any(k in combined for k in ["kho hàng", "kho hang", "kho nguyên liệu", "kho thực phẩm", "warehouse"]):
        return "warehouse"
    if any(k in combined for k in ["nhà hàng", "nha hang", "buffet", "ăn sáng", "quầy nhận món", "pickup"]):
        return "restaurant"

    # 5. Tiện ích Tầng 5 & Tầng 6
    if any(k in combined for k in ["hồ bơi", "ho boi", "bể bơi", "pool", "bơi"]):
        return "infinity_pool"
    if any(k in combined for k in ["rooftop", "cafe", "cà phê", "coffee"]):
        return "rooftop_coffee"
    if any(k in combined for k in ["quầy bar", "quay bar", "sky bar", "sky lounge", "uống rượu"]):
        return "bar"
    if any(k in combined for k in ["karaoke", "hát karaoke", "phòng hát"]):
        return "karaoke"
    if any(k in combined for k in ["gym", "thể hình", "the hinh", "fitness", "tập gym"]):
        return "gym"
    if any(k in combined for k in ["spa", "massage", "xông hơi", "mát xa"]):
        return "spa"
    if any(k in combined for k in ["lưu niệm", "gift shop", "cửa hàng quà"]):
        return "gift_shop"
    if any(k in combined for k in ["thay đồ", "locker", "tủ đồ"]):
        return "locker_room"

    # 6. Tiện ích Tầng Trệt & Bãi xe
    if any(k in combined for k in ["lễ tân", "tiếp tân", "quầy lễ tân", "bàn lễ tân", "front desk", "check-in", "check in"]):
        return "front_desk"
    if any(k in combined for k in ["xe máy", "gửi xe máy", "bãi xe máy", "xe đạp", "hầm b1"]):
        return "parking_bike"
    if any(k in combined for k in ["đỗ ô tô", "bãi ô tô", "bãi xe ô tô", "hầm b2", "xe hơi"]):
        return "parking_car"
    if any(k in combined for k in ["bãi xe", "đỗ xe", "gửi xe", "parking"]):
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

    # 0. REDIS CLOUD FAST AI CACHE CHECK (< 5ms)
    from app.services.cache.redis_service import redis_service
    cached_ai = await redis_service.get_ai_cache(request.prompt, request.language or "vi")
    if cached_ai and cached_ai.get("full_text"):
        reply = cached_ai["full_text"]
        detected_lang = cached_ai.get("detected_language") or ("English" if "en" in (request.language or "").lower() else "Tiếng Việt")
        lang_code = cached_ai.get("lang_code") or ("en-US" if detected_lang == "English" else "vi-VN")
        act = cached_ai.get("action", "conversation")
        dest_key = cached_ai.get("destination_key")

        session_manager.add_turn(sid, "user", request.prompt, language=lang_code)
        session_manager.add_turn(sid, "assistant", reply, language=lang_code, intent_action=act)

        try:
            audio_b64, mime_type, _ = await asyncio.wait_for(
                tts_service.synthesize(reply, provider="edge", language=lang_code),
                timeout=12.0
            )
        except Exception:
            audio_b64, mime_type = None, "audio/mp3"

        return ChatResponse(
            response=reply,
            model_used="redis_cloud_cache",
            detected_language=detected_lang,
            lang_code=lang_code,
            action=act,
            session_id=sid,
            current_room_number=current_room,
            destination_key=dest_key,
            trigger_video_call=False,
            ticket_created=False,
            audio_base64=audio_b64,
            mime_type=mime_type or "audio/mp3",
        )

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
    t_start = time.perf_counter()
    graph_config = {"configurable": {"thread_id": sid}}
    graph_result = await concierge_graph.ainvoke(initial_state, config=graph_config)
    t_graph = time.perf_counter()

    reply = graph_result.get("response", "")
    detected_lang = graph_result.get("lang_name", "Tiếng Việt")
    lang_code = graph_result.get("lang_code", "vi-VN")
    act = graph_result.get("action", "conversation")

    # Thêm lượt nói vào bộ nhớ RAM của phiên để duy trì ngữ cảnh nhiều lượt
    session_manager.add_turn(sid, "user", request.prompt, language=lang_code)
    session_manager.add_turn(sid, "assistant", reply, language=lang_code, intent_action=act)

    # Lấy audio_base64 từ TTS Service (EdgeTTS với fallback sang WebSpeech nếu quá 3.5s)
    try:
        audio_b64, mime_type, _ = await asyncio.wait_for(
            tts_service.synthesize(reply, provider="edge", language=lang_code),
            timeout=1.8
        )
    except Exception as e_tts:
        logger.warning(f"[AIChatService] TTS online timeout/error, fallback to frontend WebSpeech: {e_tts}")
        audio_b64, mime_type = None, "audio/mp3"
    t_tts = time.perf_counter()
    clean_p = request.prompt.encode('ascii', errors='replace').decode('ascii')
    print(f"\n[TIMING BENCHMARK] prompt='{clean_p}' | Graph: {t_graph - t_start:.3f}s | TTS: {t_tts - t_graph:.3f}s | Total: {t_tts - t_start:.3f}s\n", flush=True)

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
    require_pin = bool(graph_result.get("require_room_pin", False))
    target_room = graph_result.get("target_room_number") or current_room
    pending_act = graph_result.get("pending_service_action") or act
    pending_items = graph_result.get("pending_service_items") or items
    support_session_id = None
    call_ticket_code = None

    if is_video_call:
        support_session_id, call_ticket_code = await create_live_call_session(
            db, request.prompt, current_room
        )
    elif require_pin:
        # Tạm dừng tạo ticket tự động - chờ khách bấm xác thực PIN trên màn hình Kiosk
        logger.info(f"[AIChatService] Service request '{act}' for Room {target_room} requires Touch PIN verification.")
    elif act and act not in ["chitchat", "conversation", "faq", "fast_path", "provide_room_number", "unknown"]:
        # Chỉ tạo ticket khi đã có số phòng và không cần PIN
        if not missing_room and current_room:
            asyncio.create_task(
                background_extract_and_create_ticket(items, current_room, act, items)
            )
            logger.info(f"[AIChatService] Dispatched ticket creation for '{act}' (Room {current_room}): {items}")
        else:
            logger.info(f"[AIChatService] Service request '{act}' is waiting for room number from guest.")

    destination_key = graph_result.get("destination_key") or _detect_destination_poi(request.prompt, reply)
    eye_expression = graph_result.get("eye_expression")

    # Lưu kết quả vào Redis Cache
    try:
        await redis_service.set_ai_cache(
            request.prompt,
            lang_code,
            {
                "full_text": reply,
                "detected_language": detected_lang,
                "lang_code": lang_code,
                "action": act,
                "destination_key": destination_key,
                "trigger_video_call": is_video_call,
            }
        )
    except Exception:
        pass

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
        eye_expression=eye_expression,
        require_room_pin=require_pin,
        target_room_number=target_room,
        pending_service_action=pending_act,
        pending_service_items=pending_items,
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
