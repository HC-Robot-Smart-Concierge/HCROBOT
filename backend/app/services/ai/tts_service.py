import asyncio
import base64
import hashlib
import logging
import os
import re
from typing import Optional, Tuple, Dict

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


class TTSService:
    """
    AI Voice Concierge Speech Synthesis Service.
    Supports EdgeTTS Neural, ElevenLabs, and OpenAI TTS with multi-tier Audio Caching (Memory + Disk).
    """

    def __init__(self):
        self.default_vi_voice = "vi-VN-HoaiMyNeural"
        self.default_en_voice = "en-US-JennyNeural"
        self.current_rate: float = 1.0
        self.current_rate_str: str = "+0%"
        
        # 1. Memory LRU/Cache
        self._memory_cache: Dict[str, str] = {}
        
        # 2. Disk Cache Directory: backend/static/audio_cache
        current_dir = os.path.dirname(os.path.abspath(__file__))
        self._cache_dir = os.path.join(current_dir, "..", "..", "..", "static", "audio_cache")
        try:
            os.makedirs(self._cache_dir, exist_ok=True)
        except Exception as e:
            logger.warning(f"[TTSService] Cannot create audio_cache dir: {e}")

    @staticmethod
    def clean_text_for_tts(text: str) -> str:
        """
        Chuẩn hóa văn bản trước khi đưa vào EdgeTTS:
        - Loại bỏ markdown, icon, ngoặc
        - Xóa gạch đầu dòng danh sách (*, -, •)
        - Thay thế dấu hai chấm (:), dấu chấm phẩy (;) thành dấu phẩy (,) để giọng đọc êm ái, KHÔNG ngắt nghỉ khựng 1 giây
        - Rút gọn nhiều dấu chấm (...) thành (.)
        - Gộp khoảng trắng và ngắt dòng
        """
        if not text:
            return ""
        t = re.sub(r'[*#_`\[\]()~]', '', text)
        t = re.sub(r'[\U00010000-\U0010ffff]', '', t)
        t = re.sub(r'^[\s*•\-–—]+\s*', '', t, flags=re.MULTILINE)
        t = re.sub(r':\s*', ', ', t)
        t = re.sub(r'\s*;\s*', ', ', t)
        t = re.sub(r'\.{2,}', '.', t)
        t = re.sub(r'!{2,}', '!', t)
        t = re.sub(r'\?{2,}', '?', t)
        t = re.sub(r'\s+', ' ', t).strip()
        return t

    @staticmethod
    def rate_float_to_percentage(rate: float) -> str:
        """Chuyển đổi tốc độ float (0.5 - 2.0) sang chuỗi phần trăm EdgeTTS (+10%, -15%, +0%)"""
        clamped = max(0.5, min(2.0, float(rate)))
        diff = round((clamped - 1.0) * 100)
        return f"+{diff}%" if diff >= 0 else f"{diff}%"

    def get_voice_settings(self) -> dict:
        """Lấy cấu hình giọng nói và tốc độ hiện tại của robot"""
        rate = getattr(self, "current_rate", 1.0)
        return {
            "speech_rate": rate,
            "rate_percentage": self.rate_float_to_percentage(rate),
            "vi_voice": self.default_vi_voice,
            "en_voice": self.default_en_voice,
        }

    def update_voice_settings(
        self,
        speech_rate: float = 1.0,
        vi_voice: Optional[str] = None,
        en_voice: Optional[str] = None,
    ) -> dict:
        """Cập nhật tốc độ đọc và giọng nói của robot trên toàn hệ thống"""
        clamped_rate = max(0.5, min(2.0, float(speech_rate)))
        self.current_rate = clamped_rate
        rate_str = self.rate_float_to_percentage(clamped_rate)
        self.current_rate_str = rate_str
        settings.TTS_RATE = rate_str
        if vi_voice:
            self.default_vi_voice = vi_voice
        if en_voice:
            self.default_en_voice = en_voice
        logger.info(f"[TTSService] Cập nhật cấu hình giọng nói AI: rate={clamped_rate} ({rate_str}), vi_voice={self.default_vi_voice}")
        return self.get_voice_settings()

    @staticmethod
    def is_vietnamese(text: str) -> bool:
        """Kiểm tra câu chữ có phải tiếng Việt không."""
        if not text:
            return True
        if re.search(r'[àáảãạâầấẩẫậăằắẳẵặèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]', text, re.IGNORECASE):
            return True
        vi_words = [r'\bdạ\b', r'\bem\b', r'\banh\b', r'\bchị\b', r'\bquý khách\b', r'\bphòng\b', r'\bkhách sạn\b', r'\bạ\b']
        return any(re.search(w, text, re.IGNORECASE) for w in vi_words)

    def _get_cache_key(self, text: str, provider: str, voice: str, rate: str = "+0%") -> str:
        clean = text.strip()
        raw = f"{provider}:{voice}:{rate}:{clean}"
        return hashlib.md5(raw.encode("utf-8")).hexdigest()

    def _get_from_cache(self, cache_key: str) -> Optional[str]:
        # 1. Kiểm tra RAM cache trước (< 0.1ms)
        if cache_key in self._memory_cache:
            return self._memory_cache[cache_key]
        
        # 2. Kiểm tra Disk cache (< 2ms)
        disk_path = os.path.join(self._cache_dir, f"{cache_key}.mp3")
        if os.path.isfile(disk_path):
            try:
                with open(disk_path, "rb") as f:
                    data = f.read()
                    b64 = base64.b64encode(data).decode("utf-8")
                    self._memory_cache[cache_key] = b64
                    return b64
            except Exception as e:
                logger.warning(f"[TTSService] Failed to read disk cache: {e}")
        return None

    def _save_to_cache(self, cache_key: str, audio_b64: str):
        self._memory_cache[cache_key] = audio_b64
        # Lưu vào Disk cache chạy nhanh
        disk_path = os.path.join(self._cache_dir, f"{cache_key}.mp3")
        try:
            with open(disk_path, "wb") as f:
                f.write(base64.b64decode(audio_b64))
        except Exception as e:
            logger.warning(f"[TTSService] Failed to write disk cache: {e}")

    async def synthesize(
        self,
        text: str,
        provider: Optional[str] = None,
        voice: Optional[str] = None,
        language: Optional[str] = None,
        rate: Optional[str] = None,
    ) -> Tuple[str, str, str]:
        """
        Tổng hợp giọng đọc từ văn bản kèm bộ đệm âm thanh siêu tốc.
        Trả về: (audio_base64, mime_type, provider_used)
        """
        clean_text = self.clean_text_for_tts(text)
        if not clean_text:
            return "", "audio/mp3", "none"

        selected_provider = (provider or settings.TTS_PROVIDER or "edge").lower()
        target_rate = rate or getattr(self, "current_rate_str", getattr(settings, "TTS_RATE", "+0%"))
        if language and any(en in language.lower() for en in ["en", "english"]):
            target_voice = voice or self.default_en_voice
        elif language and any(vi in language.lower() for vi in ["vi", "vietnamese"]):
            target_voice = voice or self.default_vi_voice
        else:
            is_vi = self.is_vietnamese(clean_text)
            target_voice = (voice or self.default_vi_voice) if is_vi else (voice or self.default_en_voice)

        # 0. KIỂM TRA AUDIO CACHE TRƯỚC (< 1ms)
        cache_key = self._get_cache_key(clean_text, selected_provider, target_voice, target_rate)
        cached_audio = self._get_from_cache(cache_key)
        if cached_audio:
            logger.info(f"[TTSService Cache Hit] Phục vụ âm thanh từ bộ nhớ đệm (0ms) cho text: '{clean_text[:25]}...'")
            return cached_audio, "audio/mp3", f"{selected_provider}_cached"

        # 1. Thử nghiệm provider ElevenLabs
        if selected_provider == "elevenlabs" and settings.ELEVENLABS_API_KEY:
            try:
                audio_b64 = await self._synthesize_elevenlabs(clean_text, voice)
                if audio_b64:
                    self._save_to_cache(cache_key, audio_b64)
                    return audio_b64, "audio/mp3", "elevenlabs"
            except Exception as e:
                logger.warning(f"[TTSService] ElevenLabs synthesis failed: {e}. Fallback to EdgeTTS.")

        # 2. Thử nghiệm provider OpenAI TTS
        if selected_provider == "openai" and settings.OPENAI_API_KEY:
            try:
                audio_b64 = await self._synthesize_openai(clean_text, voice)
                if audio_b64:
                    self._save_to_cache(cache_key, audio_b64)
                    return audio_b64, "audio/mp3", "openai"
            except Exception as e:
                logger.warning(f"[TTSService] OpenAI TTS synthesis failed: {e}. Fallback to EdgeTTS.")

        # 3. Mặc định dùng EdgeTTS Neural (Siêu tự nhiên & Miễn phí)
        try:
            audio_b64 = await asyncio.wait_for(
                self._synthesize_edge_tts(clean_text, target_voice, target_rate),
                timeout=1.5
            )
            if audio_b64:
                self._save_to_cache(cache_key, audio_b64)
                return audio_b64, "audio/mp3", "edge"
        except asyncio.TimeoutError:
            logger.info(f"[TTSService] EdgeTTS timed out (>1.5s) for text, background caching triggered. Returning browser fallback.")
            asyncio.create_task(self._background_cache_edge_tts(clean_text, target_voice, target_rate, cache_key))
        except Exception as e:
            logger.warning(f"[TTSService] EdgeTTS synthesis failed: {e}")

        # 4. Fallback cuối cùng: Trả về empty để Frontend dùng Web Speech API thiết bị
        return "", "audio/mp3", "browser"

    async def _background_cache_edge_tts(self, clean_text: str, voice: str, rate: str, cache_key: str):
        """Tải âm thanh EdgeTTS trong tiến trình ngầm để lưu cache cho các lần trò chuyện sau."""
        try:
            audio_b64 = await self._synthesize_edge_tts(clean_text, voice, rate)
            if audio_b64:
                self._save_to_cache(cache_key, audio_b64)
                logger.info(f"[TTSService] Background cached audio for: '{clean_text[:30]}...'")
        except Exception as e:
            logger.debug(f"[TTSService] Background caching failed: {e}")

    async def _synthesize_edge_tts(self, text: str, voice: str, rate: Optional[str] = None) -> Optional[str]:
        """EdgeTTS Neural Engine sinh âm thanh trực tiếp."""
        clean_text = self.clean_text_for_tts(text)
        if not clean_text:
            return None

        selected_rate = rate or getattr(settings, "TTS_RATE", "+0%")
        try:
            import edge_tts
            communicate = edge_tts.Communicate(clean_text, voice, rate=selected_rate)
            audio_bytes = b""
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    audio_bytes += chunk["data"]
            if audio_bytes and len(audio_bytes) > 100:
                return base64.b64encode(audio_bytes).decode("utf-8")
        except ImportError:
            logger.info("[TTSService] edge_tts library not installed.")
            return None
        except Exception as e:
            logger.warning(f"[TTSService] EdgeTTS synthesis error: {e}")
            return None
        return None

    async def synthesize_chunk(self, text: str, voice: str = None, language: str = None) -> bytes:
        """
        Tổng hợp giọng nói cho đoạn text ngắn (1 mệnh đề) → trả raw audio bytes.
        Tối ưu cho Streaming Pipeline: không encode Base64, gửi thẳng qua WebSocket Binary Frame.
        """
        clean_text = self.clean_text_for_tts(text)
        if not clean_text:
            return b""

        try:
            import edge_tts
            if language and any(en in language.lower() for en in ["en", "english"]):
                target_voice = voice or self.default_en_voice
            elif language and any(vi in language.lower() for vi in ["vi", "vietnamese"]):
                target_voice = voice or self.default_vi_voice
            else:
                is_vi = self.is_vietnamese(clean_text)
                target_voice = (voice or self.default_vi_voice) if is_vi else (voice or self.default_en_voice)

            cache_key = self._get_cache_key(clean_text, "edge_chunk", target_voice)
            if cache_key in self._memory_cache:
                return base64.b64decode(self._memory_cache[cache_key])

            disk_path = os.path.join(self._cache_dir, f"{cache_key}.mp3")
            if os.path.isfile(disk_path):
                with open(disk_path, "rb") as f:
                    data = f.read()
                    self._memory_cache[cache_key] = base64.b64encode(data).decode("utf-8")
                    return data

            chunk_rate = getattr(settings, "TTS_RATE", "+0%")
            communicate = edge_tts.Communicate(clean_text, target_voice, rate=chunk_rate)
            audio_bytes = b""
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    audio_bytes += chunk["data"]

            if audio_bytes:
                self._memory_cache[cache_key] = base64.b64encode(audio_bytes).decode("utf-8")
                try:
                    with open(disk_path, "wb") as f:
                        f.write(audio_bytes)
                except Exception:
                    pass

            return audio_bytes
        except Exception as e:
            logger.warning(f"[TTSService] synthesize_chunk error: {e}")
            return b""

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

    async def warm_up_common_phrases(self):
        """Pre-cache câu đệm và câu chào phổ biến để phản hồi tức thì 0ms."""
        common_phrases = [
            ("Dạ đợi em một tí nhé ạ.", "vi-VN", "vi-VN-HoaiMyNeural"),
            ("Please wait a moment.", "en-US", "en-US-JennyNeural"),
            ("Dạ đợi em một tí ạ.", "vi-VN", "vi-VN-HoaiMyNeural"),
        ]
        for phrase, lang, voice in common_phrases:
            try:
                cache_key = self._get_cache_key(phrase, "edge", voice, "+0%")
                if not self._get_from_cache(cache_key):
                    await self.synthesize(phrase, provider="edge", language=lang, voice=voice)
                    logger.info(f"[TTSService] Pre-cached filler phrase: '{phrase}'")
            except Exception as e:
                logger.debug(f"[TTSService] Warmup skip for '{phrase}': {e}")


# Singleton Instance
tts_service = TTSService()
