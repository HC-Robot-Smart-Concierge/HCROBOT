import asyncio
import logging
import re
from typing import Any, Dict, Optional

from app.core.config import settings
from app.services.ai.ollama_service import ollama_service
from app.services.ai.tts_service import tts_service

logger = logging.getLogger(__name__)

# Regex tách mệnh đề cho Clause Chunker (dấu câu hoặc xuống dòng)
CLAUSE_DELIMITERS = re.compile(r"([,.;:!?\n]+)")


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
        }
        self.active_sessions[session_id] = session
        logger.info(f"[PipecatService] Created Pipecat pipeline session '{session_id}'")
        return session

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
        Streaming Pipeline Orchestrator tích hợp Intent Router + Service FSM + Ollama Stream.
        Xử lý 3 nhánh:
          - service: Intent Router → Service FSM (hỏi phòng / confirm + tạo ticket) → TTS chunk
          - faq: RAG Context → Ollama stream → Clause Chunker → TTS chunk
          - chitchat: Ollama stream → Clause Chunker → TTS chunk

        Yield format:
          {"type": "text", "text": "...", "lang_code": "..."} — Full text response (fast-path/service)
          {"type": "text_chunk", "text": "..."} — Một mệnh đề từ Ollama stream
          {"type": "audio_chunk", "data": bytes} — Raw MP3 audio bytes
          {"type": "done", "full_text": "...", "action": "...", "room_number": "..."} — Kết thúc
        """
        session = self.active_sessions.get(session_id) or self.create_pipeline_session(session_id)
        session["is_interrupted"] = False
        session["is_speaking"] = True

        try:
            # ================================================================
            # 1. FAST-PATH CHECK (< 1ms) — Chào hỏi, wifi, pass...
            # ================================================================
            fast_hit = ollama_service.check_fast_path(user_speech, language)
            if fast_hit:
                reply, lang_name, lang_code = fast_hit
                yield {"type": "text", "text": reply, "lang_code": lang_code}

                audio = await tts_service.synthesize_chunk(reply, language=lang_code)
                if audio:
                    yield {"type": "audio_chunk", "data": audio}

                yield {"type": "done", "full_text": reply, "action": "fast_path"}
                session["is_speaking"] = False
                return

            # ================================================================
            # 2. INTENT ROUTER (< 0.1ms) — Heuristic keyword matching
            # ================================================================
            clean_prompt = re.sub(
                r'^(?:hey rora|chào rora|chao rora|rora ơi|rora oi|hello rora|hi rora|rora)[,\.!\s]*',
                '', user_speech, flags=re.IGNORECASE
            ).strip() or user_speech
            prompt_lower = clean_prompt.lower().strip()

            # Bóc tách số phòng
            room_match = re.search(
                r'(?:phòng|p\.|p|phong)\s*([0-9]{3,4})|^(?:tôi ở|ở)\s*([0-9]{3,4})$',
                clean_prompt, re.IGNORECASE
            )
            extracted_room = (room_match.group(1) or room_match.group(2)) if room_match else None
            current_room = room_number or extracted_room

            SERVICE_KEYWORDS = {
                "housekeeping": ["khăn", "tắm", "dọn phòng", "gối", "chăn", "nệm", "dọn dẹp", "vệ sinh", "towel", "clean"],
                "room_service": ["cơm", "nước", "ăn", "uống", "đồ ăn", "trà", "cà phê", "pizza", "phở", "bánh", "food", "drink"],
                "bellman": ["hành lý", "vali", "túi", "chuyển phòng", "mang đồ", "xách đồ", "luggage", "bag"],
                "maintenance": ["hỏng", "sửa", "điều hòa", "bóng đèn", "nước rò", "máy lạnh", "tủ lạnh", "kẹt", "fix", "repair"],
                "restaurant": ["đặt bàn", "bàn ăn", "nhà hàng", "đặt món", "table", "restaurant"],
                "taxi": ["taxi", "đặt xe", "gọi xe", "sân bay", "cab", "ride", "xe đón"],
                "concierge": ["concierge", "gặp người", "trợ giúp trực tiếp", "nhân viên hỗ trợ", "live call", "video call", "tổng đài", "gọi video"],
                "reception": ["lễ tân", "check out", "check in", "đổi phòng", "trả phòng", "front desk", "reception"],
            }

            action = None
            for act, kws in SERVICE_KEYWORDS.items():
                if any(k in prompt_lower for k in kws):
                    action = act
                    break

            # Phân loại category
            if action:
                category = "service"
            elif extracted_room and not action:
                action = "provide_room_number"
                category = "service"
            else:
                faq_keywords = ["ở đâu", "mấy giờ", "bao nhiêu", "giá", "thế nào", "có không", "where", "when", "how", "what", "giờ nào", "tầng mấy", "bao xa"]
                if any(kw in prompt_lower for kw in faq_keywords):
                    category = "faq"
                    action = "faq"
                else:
                    category = "chitchat"
                    action = "chitchat"

            logger.info(f"[StreamPipeline] category='{category}', action='{action}', room='{current_room}'")

            # Detect language
            if not language or language.lower() in ["auto", ""]:
                lang_name, lang_code = ollama_service.detect_language(user_speech)
            else:
                lang_name = language
                lang_code = "en-US" if language.lower() in ["english", "en"] else "vi-VN"

            # ================================================================
            # 3A. SERVICE BRANCH — FSM Slot-Filling + Auto Ticket
            # ================================================================
            if category == "service":
                action_vn_map = {
                    "room_service": "đồ ăn và thức uống",
                    "housekeeping": "dọn phòng và tiện ích buồng phòng",
                    "bellman": "hỗ trợ hành lý",
                    "maintenance": "kỹ thuật bảo trì",
                    "restaurant": "đặt bàn nhà hàng",
                    "taxi": "đặt xe taxi và di chuyển",
                    "concierge": "kết nối tổng đài Concierge",
                    "reception": "dịch vụ lễ tân tiền sảnh",
                }

                if not current_room:
                    # Thiếu số phòng → Hỏi
                    action_vn = action_vn_map.get(action, "dịch vụ")
                    if lang_code == "en-US":
                        reply = f"Certainly! I would be glad to help with {action}. Could you please tell me your room number?"
                    else:
                        reply = f"Dạ em sẽ hỗ trợ {action_vn} cho quý khách ngay ạ! Quý khách vui lòng cho em xin số phòng của mình là bao nhiêu ạ?"

                    yield {"type": "text", "text": reply, "lang_code": lang_code, "missing_room": True, "action": action}
                    audio = await tts_service.synthesize_chunk(reply, language=lang_code)
                    if audio:
                        yield {"type": "audio_chunk", "data": audio}
                    yield {"type": "done", "full_text": reply, "action": action, "missing_room_number": True}
                else:
                    # Đủ số phòng → Confirm + Background Ticket
                    if lang_code == "en-US":
                        reply = f"Rora has noted your request for Room {current_room}. Our team will attend to it shortly!"
                    else:
                        reply = f"Dạ Rora đã ghi nhận yêu cầu cho Phòng {current_room} rồi ạ! Bộ phận chuyên trách sẽ hỗ trợ quý khách ngay."

                    yield {"type": "text", "text": reply, "lang_code": lang_code, "action": action, "room_number": current_room}
                    audio = await tts_service.synthesize_chunk(reply, language=lang_code)
                    if audio:
                        yield {"type": "audio_chunk", "data": audio}

                    # Tạo Ticket ngầm trong nền
                    try:
                        from app.core.database import AsyncSessionLocal
                        from app.api.v1.endpoints.ai import _auto_create_ticket
                        asyncio.create_task(self._background_create_ticket(action, current_room, user_speech))
                    except Exception as e_ticket:
                        logger.warning(f"[StreamPipeline] Background ticket error: {e_ticket}")

                    yield {"type": "done", "full_text": reply, "action": action, "room_number": current_room}

                session["is_speaking"] = False
                return

            # ================================================================
            # 3B. FAQ BRANCH — RAG Context + Ollama Stream
            # ================================================================
            rag_context = ""
            if category == "faq":
                try:
                    from app.services.rag.chroma import get_concierge_collection
                    collection = get_concierge_collection("concierge_kb")
                    results = await asyncio.to_thread(
                        collection.query,
                        query_texts=[user_speech],
                        n_results=1
                    )
                    if results and results.get("documents") and results["documents"][0]:
                        rag_context = results["documents"][0][0][:300].strip()
                except Exception:
                    pass

            # ================================================================
            # 3C. OLLAMA STREAM (faq + chitchat) → Clause Chunker → TTS
            # ================================================================
            buffer = ""
            full_reply = ""

            async for token in ollama_service.generate_response_stream(
                prompt=user_speech,
                rag_context=rag_context or None,
                language=language,
                stored_room_number=current_room,
            ):
                if session.get("is_interrupted"):
                    yield {"type": "interrupted", "full_text": full_reply}
                    session["is_speaking"] = False
                    return

                full_reply += token
                buffer += token

                # Clause Chunker: tách mệnh đề khi gặp dấu câu
                parts = CLAUSE_DELIMITERS.split(buffer)
                if len(parts) > 2:
                    clause = (parts[0] + parts[1]).strip()
                    buffer = "".join(parts[2:])

                    if clause and len(clause) > 3:
                        yield {"type": "text_chunk", "text": clause}

                        audio = await tts_service.synthesize_chunk(clause, language=lang_code)
                        if audio and not session.get("is_interrupted"):
                            yield {"type": "audio_chunk", "data": audio}

            # Flush phần text còn lại
            remaining = buffer.strip()
            if remaining and len(remaining) > 1:
                yield {"type": "text_chunk", "text": remaining}
                audio = await tts_service.synthesize_chunk(remaining, language=lang_code)
                if audio and not session.get("is_interrupted"):
                    yield {"type": "audio_chunk", "data": audio}

            _, final_lang_code = ollama_service.detect_language(full_reply)
            yield {"type": "done", "full_text": full_reply, "lang_code": final_lang_code, "action": action}

        except Exception as e:
            logger.error(f"[PipecatService StreamError] {e}")
            yield {"type": "error", "message": str(e)}
        finally:
            session["is_speaking"] = False

    async def _background_create_ticket(self, action: str, room_number: str, items: str):
        """Tạo ticket dịch vụ ngầm trong nền, không block streaming response."""
        try:
            from app.core.database import AsyncSessionLocal
            from app.api.v1.endpoints.ai import _auto_create_ticket
            async with AsyncSessionLocal() as bg_db:
                ticket_code = await _auto_create_ticket(bg_db, action, room_number, items)
                logger.info(f"[StreamPipeline] Auto-created ticket #{ticket_code} for {action} room {room_number}")
        except Exception as e:
            logger.warning(f"[StreamPipeline] Background ticket failed: {e}")

    def close_session(self, session_id: str):
        """Đóng phiên làm việc Pipecat."""
        if session_id in self.active_sessions:
            self.handle_barge_in(session_id)
            del self.active_sessions[session_id]
            logger.info(f"[PipecatService] Closed Pipecat pipeline session '{session_id}'")


# Singleton Instance
pipecat_service = PipecatPipelineService()

