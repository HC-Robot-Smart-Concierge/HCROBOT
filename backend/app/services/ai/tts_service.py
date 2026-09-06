import base64
import logging
import re
from typing import Optional, Tuple

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


class TTSService:
    """
    AI Voice Concierge Speech Synthesis Service.
    Supports EdgeTTS Neural, ElevenLabs, and OpenAI TTS with seamless fallback.
    """

    def __init__(self):
        self.default_vi_voice = "vi-VN-HoaiMyNeural"
        self.default_en_voice = "en-US-JennyNeural"

    @staticmethod
    def is_vietnamese(text: str) -> bool:
        """Kiểm tra câu chữ có phải tiếng Việt không."""
        if not text:
            return True
        if re.search(r'[àáảãạâầấẩẫậăằắẳẵặèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]', text, re.IGNORECASE):
            return True
        vi_words = [r'\bdạ\b', r'\bem\b', r'\banh\b', r'\bchị\b', r'\bquý khách\b', r'\bphòng\b', r'\bkhách sạn\b', r'\bạ\b']
        return any(re.search(w, text, re.IGNORECASE) for w in vi_words)

    async def synthesize(
        self,
        text: str,
        provider: Optional[str] = None,
        voice: Optional[str] = None,
        language: Optional[str] = None,
    ) -> Tuple[str, str, str]:
        """
        Tổng hợp giọng đọc từ văn bản.
        Trả về: (audio_base64, mime_type, provider_used)
        """
        if not text or not text.strip():
            return "", "audio/mp3", "none"

        selected_provider = (provider or settings.TTS_PROVIDER or "edge").lower()
        is_vi = self.is_vietnamese(text) or (language and "vi" in language.lower())

        # 1. Thử nghiệm provider ElevenLabs
        if selected_provider == "elevenlabs" and settings.ELEVENLABS_API_KEY:
            try:
                audio_b64 = await self._synthesize_elevenlabs(text, voice)
                if audio_b64:
                    return audio_b64, "audio/mp3", "elevenlabs"
            except Exception as e:
                logger.warning(f"[TTSService] ElevenLabs synthesis failed: {e}. Fallback to EdgeTTS.")

        # 2. Thử nghiệm provider OpenAI TTS
        if selected_provider == "openai" and settings.OPENAI_API_KEY:
            try:
                audio_b64 = await self._synthesize_openai(text, voice)
                if audio_b64:
                    return audio_b64, "audio/mp3", "openai"
            except Exception as e:
                logger.warning(f"[TTSService] OpenAI TTS synthesis failed: {e}. Fallback to EdgeTTS.")

        # 3. Mặc định dùng EdgeTTS Neural (Siêu tự nhiên & Miễn phí)
        try:
            target_voice = self.default_vi_voice if is_vi else (voice or self.default_en_voice)
            audio_b64 = await self._synthesize_edge_tts(text, target_voice)
            if audio_b64:
                return audio_b64, "audio/mp3", "edge"
        except Exception as e:
            logger.warning(f"[TTSService] EdgeTTS synthesis failed: {e}")

        # 4. Fallback cuối cùng: Trả về empty để Frontend dùng Web Speech API thiết bị
        return "", "audio/mp3", "browser"

    async def _synthesize_edge_tts(self, text: str, voice: str) -> Optional[str]:
        """EdgeTTS Neural Engine."""
        try:
            import edge_tts
            communicate = edge_tts.Communicate(text, voice)
            audio_bytes = b""
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    audio_bytes += chunk["data"]
            if audio_bytes:
                return base64.b64encode(audio_bytes).decode("utf-8")
        except ImportError:
            logger.info("[TTSService] edge_tts library not installed. Attempting HTTP endpoint synthesis.")
        except Exception as e:
            logger.warning(f"[TTSService] EdgeTTS error: {e}")
        return None

    async def _synthesize_elevenlabs(self, text: str, voice: Optional[str]) -> Optional[str]:
        """ElevenLabs Text-to-Speech API."""
        voice_id = voice or settings.ELEVENLABS_VOICE_ID or "21m00Tcm4TlvDq8ikWAM"
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
        headers = {
            "Accept": "audio/mpeg",
            "Content-Type": "application/json",
            "xi-api-key": settings.ELEVENLABS_API_KEY,
        }
        payload = {
            "text": text,
            "model_id": "eleven_multilingual_v2",
            "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
        }

        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(url, json=payload, headers=headers)
            if resp.status_code == 200:
                return base64.b64encode(resp.content).decode("utf-8")
            else:
                logger.error(f"[TTSService] ElevenLabs API error {resp.status_code}: {resp.text}")
        return None

    async def _synthesize_openai(self, text: str, voice: Optional[str]) -> Optional[str]:
        """OpenAI TTS API."""
        url = "https://api.openai.com/v1/audio/speech"
        headers = {
            "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": "tts-1",
            "input": text,
            "voice": voice or settings.OPENAI_TTS_VOICE or "alloy",
        }

        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(url, json=payload, headers=headers)
            if resp.status_code == 200:
                return base64.b64encode(resp.content).decode("utf-8")
            else:
                logger.error(f"[TTSService] OpenAI TTS API error {resp.status_code}: {resp.text}")
        return None


# Singleton Instance
tts_service = TTSService()
