import asyncio
import logging
import re
import time
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.ai import ChatRequest, ChatResponse
from langchain_core.runnables import RunnableConfig
from app.services.ai.session_manager import session_manager, extract_room_number, is_valid_hotel_room
from app.services.ai.concierge_graph import concierge_graph
from app.services.ai.tts_service import tts_service
from app.services.ai.ollama_service import ollama_service
from app.services.ai.ai_ticket_service import create_live_call_session, background_extract_and_create_ticket
from app.services.ai.ai_chat_helpers import (
    _detect_destination_poi,
    _submit_bell_for_chat,
    _submit_maintenance_for_chat,
)
from app.services.ai.ai_chat_stream_service import generate_chat_stream as generate_chat_stream
from app.services.maintenance_request_service import is_fault_report
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
    6. Nhận diện điểm đến POI cho bản đồ tương tác.
    """
    sid = request.session_id or "default_session"

    # Cập nhật số phòng nếu truyền trực tiếp hoặc bóc tách từ câu nói
    extracted_from_prompt = extract_room_number(request.prompt)
    if request.room_number and is_valid_hotel_room(request.room_number):
        session_manager.set_room_number(sid, request.room_number)
    elif extracted_from_prompt and is_valid_hotel_room(extracted_from_prompt):
        session_manager.set_room_number(sid, extracted_from_prompt)

    current_room = session_manager.get_room_number(sid)
    history = session_manager.get_history(sid)

    # 0. REDIS CLOUD FAST AI CACHE CHECK (< 5ms)
    # Bỏ qua Redis Cache nếu:
    # 1. Session đang có pending_intent chờ khách bổ sung số phòng
    # 2. Câu hỏi kiểm tra tiến độ/trạng thái đơn món (cần dữ liệu DB thời gian thực của bếp)
    # 3. Yêu cầu dịch vụ cụ thể hoặc câu nói có số phòng hoặc mở menu
    from app.services.ai.constants import SERVICE_KEYWORDS
    prompt_lower_req = (request.prompt or "").lower()
    is_status_query_req = any(k in prompt_lower_req for k in SERVICE_KEYWORDS.get("query_order_status", []))
    pending_intent_exist = bool(session_manager.get_pending_intent(sid))
    has_room_in_prompt = bool(extracted_from_prompt or request.room_number)
    is_actionable_service = any(
        any(re.search(rf'\b{re.escape(k)}\b', prompt_lower_req) for k in kws)
        for act_key, kws in SERVICE_KEYWORDS.items()
        if act_key not in ["chitchat", "faq"]
    ) or is_fault_report(request.prompt)
    is_menu_action = any(k in prompt_lower_req for k in ["menu", "thực đơn", "thuc don", "đặt món", "gọi món", "order", "đồ ăn", "thức ăn", "dịch vụ phòng", "room service"])

    from app.services.cache.redis_service import redis_service
    cached_ai = None
    if not request.rag_context and not pending_intent_exist and not is_status_query_req and not has_room_in_prompt and not is_actionable_service and not is_menu_action:
        cached_ai = await redis_service.get_ai_cache(request.prompt, request.language or "vi")
    if cached_ai and cached_ai.get("full_text"):
        reply = cached_ai["full_text"]
        if not request.language or request.language.lower() in ("auto", "bilingual"):
            detected_lang, lang_code = ollama_service.detect_language(request.prompt)
        else:
            detected_lang = cached_ai.get("detected_language") or ("English" if "en" in (request.language or "").lower() else "Tiếng Việt")
            lang_code = cached_ai.get("lang_code") or ("en-US" if detected_lang == "English" else "vi-VN")
        act = cached_ai.get("action", "conversation")
        dest_key = cached_ai.get("destination_key")

        # Đảm bảo không bị mất destination_key nếu cache cũ lưu None
        if not dest_key:
            from app.services.ai.scenario_service import scenario_service
            sc_match = scenario_service.match_fast_path(request.prompt, lang_code=lang_code)
            if sc_match and len(sc_match) >= 5:
                if sc_match[3] == "none":
                    dest_key = None
                elif isinstance(sc_match[4], dict):
                    dest_key = sc_match[4].get("destination_key")
            if not dest_key and (not sc_match or sc_match[3] != "none"):
                dest_key = _detect_destination_poi(request.prompt, reply, current_room)

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
            current_room_number=(current_room if is_valid_hotel_room(current_room) else None),
            destination_key=dest_key,
            trigger_video_call=False,
            ticket_created=False,
            audio_base64=audio_b64,
            mime_type=mime_type or "audio/mp3",
        )

    # Điều phối hội thoại trực tiếp qua LangGraph Harness
    if not request.language or request.language.lower() in ["auto", "bilingual", ""]:
        cur_lang_name, cur_lang_code = ollama_service.detect_language(request.prompt)
    else:
        cur_lang_name = request.language
        cur_lang_code = "en-US" if (request.language.lower().startswith("en") or "english" in request.language.lower()) else "vi-VN"

    initial_state = {
        "session_id": sid,
        "prompt": request.prompt,
        "rag_context": request.rag_context,
        "language": request.language,
        "lang_name": cur_lang_name,
        "lang_code": cur_lang_code,
        "emotion": request.emotion,
        "room_number": current_room,
        "is_room_authenticated": bool(current_room and session_manager.is_room_authenticated(sid, current_room)),
        "chat_history": history,
        "destination_key": None,
        "trigger_video_call": False,
    }
    t_start = time.perf_counter()
    graph_config: RunnableConfig = {"configurable": {"thread_id": sid}}
    graph_result = await concierge_graph.ainvoke(initial_state, config=graph_config)
    t_graph = time.perf_counter()

    reply = graph_result.get("response", "")
    detected_lang = graph_result.get("lang_name", "Tiếng Việt")
    lang_code = graph_result.get("lang_code", "vi-VN")
    act = graph_result.get("action", "conversation")

    # Thêm lượt nói vào bộ nhớ RAM của phiên để duy trì ngữ cảnh nhiều lượt
    session_manager.add_turn(sid, "user", request.prompt, language=lang_code)
    session_manager.add_turn(sid, "assistant", reply, language=lang_code, intent_action=act)
    if act == "switch_language":
        session_manager.set_language(sid, detected_lang)

    # Lấy audio_base64 từ TTS Service (EdgeTTS với fallback sang Google TTS / WebSpeech)
    try:
        audio_b64, mime_type, _ = await asyncio.wait_for(
            tts_service.synthesize(reply, provider="edge", language=lang_code),
            timeout=5.0
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
    status_q_type = graph_result.get("status_query_type")
    support_session_id = None
    call_ticket_code = None

    emotion_lower = (request.emotion or "").strip().lower()
    if emotion_lower in ["unhappy", "annoyed", "angry", "upset", "frustrated", "khó chịu", "kho chiu"]:
        alert_loc = current_room or "Main Lobby Kiosk"
        asyncio.create_task(
            background_extract_and_create_ticket(
                request.prompt,
                alert_loc,
                "emotion_alert",
                f"Khách có biểu cảm khó chịu ({request.emotion}) khi giao tiếp tại Kiosk: {request.prompt}",
            )
        )

    if is_video_call:
        support_session_id, call_ticket_code = await create_live_call_session(
            db, request.prompt, current_room
        )
    elif require_pin:
        # Tạm dừng tạo ticket tự động - chờ khách bấm xác thực PIN trên màn hình Kiosk
        logger.info(f"[AIChatService] Service request '{act}' for Room {target_room} requires Touch PIN verification.")
    elif act and act not in ["chitchat", "conversation", "faq", "fast_path", "provide_room_number", "query_order_status", "unknown", "taxi", "book_taxi", "taxi_booking", "open_food_menu", "open_room_service_menu", "open_maintenance_menu", "open_bellman_menu"]:
        # Chỉ tạo ticket khi đã có số phòng và không cần PIN
        if not missing_room and current_room:
            if act == "maintenance":
                call_ticket_code, notice = await _submit_maintenance_for_chat(db, current_room, items, lang_code.startswith("en"))
                if notice:
                    reply = notice
                    audio_b64 = None  # Do not play the earlier "new ticket" response.
            elif act == "bellman":
                call_ticket_code, reply = await _submit_bell_for_chat(db, current_room, items, lang_code.startswith("en"))
                audio_b64 = None  # The reply now carries the real ticket code.
            else:
                asyncio.create_task(
                    background_extract_and_create_ticket(items, current_room, act, items)
                )
            logger.info(f"[AIChatService] Dispatched ticket creation for '{act}' (Room {current_room}): {items}")
        else:
            logger.info(f"[AIChatService] Service request '{act}' is waiting for room number from guest.")

    fast_hit_matched = graph_result.get("fast_path_hit")
    fast_action = graph_result.get("action")
    if fast_hit_matched and fast_action == "none":
        destination_key = None
    elif act == "query_order_status":
        destination_key = None
    else:
        destination_key = graph_result.get("destination_key") or _detect_destination_poi(request.prompt, reply, current_room)
    if destination_key and destination_key.startswith("room_"):
        r_part = destination_key.replace("room_", "")
        if not is_valid_hotel_room(r_part):
            destination_key = None
    eye_expression = graph_result.get("eye_expression")

    # Lưu kết quả vào Redis Cache (bỏ qua nếu là câu hỏi tra cứu trạng thái đơn món, yêu cầu dịch vụ hoặc có số phòng)
    if act not in ["query_order_status", "open_food_menu", "open_room_service_menu", "open_maintenance_menu", "open_bellman_menu", "room_service", "housekeeping", "laundry", "maintenance", "bellman"] and not has_room_in_prompt and not is_menu_action:
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
        action=act,
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
        status_query_type=status_q_type,
        trigger_menu=graph_result.get("trigger_menu"),
    )
