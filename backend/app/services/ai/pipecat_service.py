import asyncio
import logging
import re
from typing import Any, Dict, Optional

from app.core.config import settings
from app.services.ai.ollama_service import ollama_service
from app.services.ai.session_manager import session_manager
from app.services.ai.tts_service import tts_service

logger = logging.getLogger(__name__)

# Regex tách câu hoàn chỉnh cho Sentence Chunker (chỉ ngắt ở .!?\n, giữ nguyên dấu phẩy để giọng nói không bị khựng)
SENTENCE_DELIMITERS = re.compile(r"([.!?\n]+)")


class PipecatPipelineService:
    """
    Pipecat Real-time Conversational Voice Pipeline Manager.
    Handles 16kHz PCM audio streaming, VAD state, and instant Barge-in interruption.
    """

    def __init__(self):
        self.sample_rate = settings.PIPECAT_SAMPLE_RATE or 16000
        self.active_sessions: Dict[str, Dict[str, Any]] = {}

    def create_pipeline_session(self, session_id: str) -> Dict[str, Any]:
        """Khởi tạo phiên làm việc Pipecat Audio Stream hai chiều."""
        session = {
            "session_id": session_id,
            "is_speaking": False,
            "is_interrupted": False,
            "current_tts_task": None,
            # STT Streaming State
            "stt_buffer": "",
            "stt_last_update": 0.0,
            "stt_final_received": False,
            "stt_vad_task": None,
        }
        self.active_sessions[session_id] = session
        logger.info(f"[PipecatService] Created Pipecat pipeline session '{session_id}'")
        return session

    def update_stt_buffer(self, session_id: str, text: str, is_final: bool = False):
        """
        Cập nhật STT buffer khi nhận interim/final text từ client.
        """
        import time
        session = self.active_sessions.get(session_id)
        if not session:
            session = self.create_pipeline_session(session_id)

        session["stt_buffer"] = text
        session["stt_last_update"] = time.time()
        session["stt_final_received"] = is_final

    def get_stt_text(self, session_id: str) -> str:
        """Lấy text STT hiện tại từ buffer."""
        session = self.active_sessions.get(session_id)
        if session:
            return session.get("stt_buffer", "")
        return ""

    def clear_stt_buffer(self, session_id: str):
        """Xóa STT buffer sau khi đã xử lý."""
        session = self.active_sessions.get(session_id)
        if session:
            session["stt_buffer"] = ""
            session["stt_final_received"] = False
            session["stt_last_update"] = 0.0

    def handle_barge_in(self, session_id: str):
        """
        Xử lý sự kiện Barge-in: Khi người dùng nói xen vào lúc Robot đang trả lời,
        lập tức dừng phát luồng audio TTS hiện tại.
        """
        session = self.active_sessions.get(session_id)
        if session:
            session["is_interrupted"] = True
            session["is_speaking"] = False
            task = session.get("current_tts_task")
            if task and not task.done():
                task.cancel()
                logger.info(f"[PipecatService] Barge-in triggered! Cancelled TTS audio stream for session '{session_id}'")

    def is_session_interrupted(self, session_id: str) -> bool:
        """Kiểm tra xem phiên có đang bị ngắt lời (Barge-in) không."""
        session = self.active_sessions.get(session_id)
        return bool(session and session.get("is_interrupted"))

    async def process_user_speech(
        self,
        session_id: str,
        user_speech: str,
        room_number: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Xử lý câu nói của người dùng qua Pipecat Frame Pipeline và trả về luồng âm thanh TTS.
        (Phương thức cũ — giữ nguyên backward compatible)
        """
        session = self.active_sessions.get(session_id) or self.create_pipeline_session(session_id)
        session["is_interrupted"] = False
        session["is_speaking"] = True

        try:
            reply, lang_name, lang_code = await ollama_service.generate_response(
                prompt=user_speech,
                language="auto",
                stored_room_number=room_number,
            )

            if session["is_interrupted"]:
                return {"interrupted": True, "reply": reply, "audio_b64": "", "provider": "barge_in"}

            audio_b64, mime, provider_used = await tts_service.synthesize(
                text=reply,
                language=lang_code,
            )

            session["is_speaking"] = False
            return {
                "interrupted": False,
                "reply": reply,
                "audio_b64": audio_b64,
                "mime_type": mime,
                "provider_used": provider_used,
                "lang_code": lang_code,
            }

        except Exception as e:
            session["is_speaking"] = False
            logger.error(f"[PipecatService Error] {e}")
            return {
                "interrupted": False,
                "reply": "Xin lỗi quý khách, hệ thống đang bận.",
                "audio_b64": "",
                "mime_type": "audio/mp3",
                "provider_used": "browser",
                "error": str(e),
            }

    async def process_user_speech_stream(
        self,
        session_id: str,
        user_speech: str,
        room_number: Optional[str] = None,
        language: str = "auto",
    ):
        """
        Direct Realtime Conversational Voice Pipeline:
        Fast-Path Check (<1ms) -> Direct Ollama Streaming -> Clause Chunker -> Edge-TTS Audio Chunks.
        Loại bỏ hoàn toàn RAG (ChromaDB/BGE-M3) và bộ lọc phân loại tạo ticket để tập trung tối đa
        vào phản xạ hội thoại giọng nói tự nhiên, tốc độ cao (TTFT < 200ms, TTFA < 600ms).

        Yield format:
          {"type": "text", "text": "...", "lang_code": "..."} — Fast-path response
          {"type": "token", "token": "..."} — Từng token từ LLM stream thời gian thực
          {"type": "text_chunk", "text": "..."} — Một mệnh đề từ Clause Chunker
          {"type": "audio_chunk", "data": bytes} — Raw MP3 audio bytes phát ra loa
          {"type": "done", "full_text": "...", "lang_code": "..."} — Kết thúc lượt thoại
        """
        session = self.active_sessions.get(session_id) or self.create_pipeline_session(session_id)
        session["is_interrupted"] = False
        session["is_speaking"] = True

        try:
            # 1. Nhận diện ngôn ngữ
            if not language or language.lower() in ["auto", ""]:
                lang_name, lang_code = ollama_service.detect_language(user_speech)
            else:
                lang_name = language
                lang_code = "en-US" if (language.lower().startswith("en") or "english" in language.lower()) else "vi-VN"

            # 2. Lấy bộ nhớ hội thoại và số phòng từ session_manager để giao tiếp tự nhiên đa lượt
            from app.services.ai.session_manager import extract_room_number
            extracted_room = extract_room_number(user_speech, is_answering_room=True)
            if extracted_room:
                session_manager.set_room_number(session_id, extracted_room)
            elif room_number:
                session_manager.set_room_number(session_id, room_number)
            current_room = session_manager.get_room_number(session_id)
            history = session_manager.get_history(session_id)

            # 2.5. REDIS CLOUD FAST CACHE CHECK (< 5ms)
            from app.services.cache.redis_service import redis_service
            cached_data = await redis_service.get_ai_cache(user_speech, language=lang_code)
            if cached_data and cached_data.get("full_text"):
                cached_text = cached_data["full_text"]
                cached_lang = cached_data.get("lang_code", lang_code)
                cached_dest = cached_data.get("destination_key")
                cached_vcall = cached_data.get("trigger_video_call", False)

                yield {"type": "token", "token": cached_text, "lang_code": cached_lang}

                parts = SENTENCE_DELIMITERS.split(cached_text)
                sub_buf = ""
                for part in parts:
                    sub_buf += part
                    if SENTENCE_DELIMITERS.search(part):
                        clause = sub_buf.strip()
                        sub_buf = ""
                        if clause:
                            yield {"type": "text_chunk", "text": clause, "lang_code": cached_lang}
                            try:
                                audio_bytes = await tts_service.synthesize_chunk(clause, language=cached_lang)
                                if audio_bytes and not session.get("is_interrupted"):
                                    yield {"type": "audio_chunk", "data": audio_bytes}
                            except Exception as e_tts:
                                logger.warning(f"[PipecatService TTS cache chunk error]: {e_tts}")

                if sub_buf.strip():
                    rem = sub_buf.strip()
                    yield {"type": "text_chunk", "text": rem, "lang_code": cached_lang}
                    try:
                        audio_bytes = await tts_service.synthesize_chunk(rem, language=cached_lang)
                        if audio_bytes and not session.get("is_interrupted"):
                            yield {"type": "audio_chunk", "data": audio_bytes}
                    except Exception as e_tts:
                        logger.warning(f"[PipecatService TTS cache chunk error]: {e_tts}")

                session_manager.add_turn(session_id, "user", user_speech, language=lang_code)
                session_manager.add_turn(session_id, "assistant", cached_text, language=cached_lang, intent_action="conversation")

                yield {
                    "type": "done",
                    "full_text": cached_text,
                    "lang_code": cached_lang,
                    "action": "conversation",
                    "room_number": current_room,
                    "destination_key": cached_dest,
                    "trigger_video_call": cached_vcall,
                }
                session["is_speaking"] = False
                return

            # 3. DIRECT OLLAMA QWEN STREAMING → Token-by-Token + Clause Chunker
            buffer = ""
            full_reply = ""

            async for token in ollama_service.generate_response_stream(
                prompt=user_speech,
                language=lang_code,
                chat_history=history,
                stored_room_number=current_room,
            ):
                if self.is_session_interrupted(session_id):
                    session["is_speaking"] = False
                    yield {"type": "interrupted", "full_text": full_reply}
                    return

                full_reply += token
                buffer += token

                # Yield token tức thì để UI hiển thị chữ chạy thời gian thực (Continuous Token Streaming)
                yield {"type": "token", "token": token, "lang_code": lang_code}

                # Sentence Chunker: tách câu khi gặp dấu chấm, chấm than, hỏi chấm (.!?\n)
                parts = SENTENCE_DELIMITERS.split(buffer)
                if len(parts) > 2:
                    clause = (parts[0] + parts[1]).strip()
                    if clause and len(clause) >= 15:
                        buffer = "".join(parts[2:])
                        yield {"type": "text_chunk", "text": clause, "lang_code": lang_code}
                        try:
                            audio_bytes = await tts_service.synthesize_chunk(clause, language=lang_code)
                            if audio_bytes and not session.get("is_interrupted"):
                                yield {"type": "audio_chunk", "data": audio_bytes}
                        except Exception as e_tts:
                            logger.warning(f"[PipecatService TTS chunk error]: {e_tts}")

            # Flush phần text còn lại chưa kết thúc bằng dấu ngắt câu
            remaining = buffer.strip()
            if remaining and len(remaining) > 0 and not session.get("is_interrupted"):
                yield {"type": "text_chunk", "text": remaining, "lang_code": lang_code}
                try:
                    audio_bytes = await tts_service.synthesize_chunk(remaining, language=lang_code)
                    if audio_bytes and not session.get("is_interrupted"):
                        yield {"type": "audio_chunk", "data": audio_bytes}
                except Exception as e_tts:
                    logger.warning(f"[PipecatService TTS chunk error]: {e_tts}")

            _, final_lang_code = ollama_service.detect_language(full_reply)

            # Lưu lại lịch sử lượt nói vào bộ nhớ RAM của phiên để duy trì ngữ cảnh
            session_manager.add_turn(session_id, "user", user_speech, language=lang_code)
            session_manager.add_turn(session_id, "assistant", full_reply, language=final_lang_code, intent_action="conversation")

            from app.services.ai.scenario_service import scenario_service
            from app.services.ai.ai_chat_service import _detect_destination_poi
            sc_match = scenario_service.match_fast_path(user_speech)
            dest_key = None
            if sc_match and len(sc_match) >= 5 and isinstance(sc_match[4], dict):
                dest_key = sc_match[4].get("destination_key")
            if not dest_key:
                dest_key = _detect_destination_poi(user_speech, full_reply)
            is_video_call = any(k in user_speech.lower() for k in [
                "gặp người", "trợ giúp trực tiếp", "nhân viên hỗ trợ", "live call", "video call",
                "tổng đài", "gọi cho nhân viên", "gọi nhân viên", "gặp nhân viên", "kết nối nhân viên",
                "call staff", "call human", "talk to human", "speak to human"
            ])

            # Tự động lưu vào Redis Cloud Cache để tăng tốc các lượt gọi sau
            try:
                await redis_service.set_ai_cache(
                    user_speech,
                    final_lang_code,
                    {
                        "full_text": full_reply,
                        "lang_code": final_lang_code,
                        "action": "conversation",
                        "destination_key": dest_key,
                        "trigger_video_call": is_video_call,
                    }
                )
            except Exception:
                pass

            yield {
                "type": "done",
                "full_text": full_reply,
                "lang_code": final_lang_code,
                "action": "conversation",
                "room_number": current_room,
                "destination_key": dest_key,
                "trigger_video_call": is_video_call,
            }

        except Exception as e:
            logger.error(f"[PipecatService StreamError] {e}")
            yield {"type": "error", "message": str(e)}
        finally:
            session["is_speaking"] = False

    def close_session(self, session_id: str):
        """Đóng phiên làm việc Pipecat."""
        if session_id in self.active_sessions:
            self.handle_barge_in(session_id)
            del self.active_sessions[session_id]
            logger.info(f"[PipecatService] Closed Pipecat pipeline session '{session_id}'")


# Singleton Instance
pipecat_service = PipecatPipelineService()

