import asyncio
import logging
from typing import Any, Dict, Optional

from app.core.config import settings
from app.services.ai.ollama_service import ollama_service
from app.services.ai.tts_service import tts_service

logger = logging.getLogger(__name__)


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
        """
        session = self.active_sessions.get(session_id) or self.create_pipeline_session(session_id)
        session["is_interrupted"] = False
        session["is_speaking"] = True

        try:
            # 1. Gọi Ollama RAG LLM
            reply, lang_name, lang_code = await ollama_service.generate_response(
                prompt=user_speech,
                language="auto",
                stored_room_number=room_number,
            )

            if session["is_interrupted"]:
                return {"interrupted": True, "reply": reply, "audio_b64": "", "provider": "barge_in"}

            # 2. Sinh giọng thoại MP3 qua TTSService
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

    def close_session(self, session_id: str):
        """Đóng phiên làm việc Pipecat."""
        if session_id in self.active_sessions:
            self.handle_barge_in(session_id)
            del self.active_sessions[session_id]
            logger.info(f"[PipecatService] Closed Pipecat pipeline session '{session_id}'")


# Singleton Instance
pipecat_service = PipecatPipelineService()
