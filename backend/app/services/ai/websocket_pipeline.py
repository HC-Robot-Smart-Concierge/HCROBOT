import logging
import asyncio
import time
from typing import Optional
from fastapi import WebSocket, WebSocketDisconnect

from app.services.ai.pipecat_service import pipecat_service
from app.core.config import settings

logger = logging.getLogger(__name__)


async def handle_pipecat_websocket(websocket: WebSocket, session_id: str = "pipecat_kiosk"):
    """
    Unified WebSocket Streaming Pipeline — STT Streaming + LLM Token Stream + TTS Audio Chunks.
    
    Events:
    - event="stt_interim": Client gửi interim transcript -> Server echo lại để hiển thị UI
    - event="stt_final": Client gửi final transcript -> Server trigger full AI pipeline streaming
    - event="speech_stream": Client gửi text trực tiếp (bypass STT) -> Server trigger full AI pipeline streaming
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

        # Nếu đang có một luồng pipeline khác đang phát âm thanh cho session này, lập tức hủy luồng cũ
        if active_pipeline_task and not active_pipeline_task.done():
            active_pipeline_task.cancel()
            pipecat_service.handle_barge_in(session_id)
            logger.info(f"[Pipecat WS] Cancelled previous pipeline task to prevent overlapping voices for '{session_id}'")

        active_pipeline_task = asyncio.create_task(_trigger_streaming_pipeline(clean_text, room, lang))

    async def _trigger_streaming_pipeline(text: str, room: Optional[str], lang: str):
        """Helper: Chạy full streaming pipeline và gửi kết quả qua WebSocket."""
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
        Server-side VAD: Chờ đủ thời gian im lặng mới chốt câu và chạy pipeline.
        Tránh cắt ngang khi khách dừng lại lấy hơi hoặc đang nghĩ dở câu.
        """
        vad_ms = max(getattr(settings, "VAD_SILENCE_MS", 500) / 1000.0, 0.4)
        await asyncio.sleep(vad_ms)

        final_text = pipecat_service.get_stt_text(session_id)
        if final_text and final_text.strip():
            clean = final_text.strip()
            # Tránh kích hoạt nếu câu chỉ có 1 từ đệm ngắn chưa có nghĩa
            if len(clean.split()) < 2 and len(clean) < 6:
                logger.info(f"[Pipecat WS VAD] Skipped incomplete fragment '{clean}', waiting for more speech")
                return

            pipecat_service.clear_stt_buffer(session_id)

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

                    await websocket.send_json({
                        "event": "stt_interim_echo",
                        "session_id": session_id,
                        "text": text,
                    })

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
