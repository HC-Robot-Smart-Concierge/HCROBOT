import asyncio
import base64
import hashlib
import logging
import os
import re
from typing import Optional, Tuple, Dict, Any

from app.core.config import settings
from app.services.ai.tts_providers_mixin import TTSProvidersMixin

logger = logging.getLogger(__name__)


class TTSService(TTSProvidersMixin):
    """
    AI Voice Concierge Speech Synthesis Service.
    Supports EdgeTTS Neural, ElevenLabs, OpenAI TTS, and Google TTS fallback
    with multi-tier Audio Caching (Memory + Disk) and structured error codes.
    """

    def __init__(self):
        self.default_vi_voice = "vi-VN-HoaiMyNeural"
        self.default_en_voice = "en-US-JennyNeural"
        self.current_rate: float = 1.0
        self.current_rate_str: str = "+0%"

        # 1. Memory LRU/Cache
        self._memory_cache: Dict[str, str] = {}
        self._inflight_tasks: Dict[str, asyncio.Task] = {}

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
        clamped = max(0.5, min(2.0, rate))
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
        clamped_rate = max(0.5, min(2.0, speech_rate))
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

    def _resolve_voice_and_lang(self, clean_text: str, language: Optional[str], voice: Optional[str]) -> Tuple[str, str]:
        """Xác định cặp (target_voice, lang_short) phù hợp với ngôn ngữ đích và văn bản."""
        lang_norm = (language or "").strip().lower()
        if any(en in lang_norm for en in ["en", "english"]):
            lang_short = "en"
            target_voice = voice or self.default_en_voice
        elif any(vi in lang_norm for vi in ["vi", "vietnamese"]):
            lang_short = "vi"
            target_voice = voice or self.default_vi_voice
        else:
            is_vi = self.is_vietnamese(clean_text)
            lang_short = "vi" if is_vi else "en"
            target_voice = (voice or self.default_vi_voice) if is_vi else (voice or self.default_en_voice)
        return target_voice, lang_short

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
                    if data and len(data) > 100:
                        b64 = base64.b64encode(data).decode("utf-8")
                        self._memory_cache[cache_key] = b64
                        return b64
            except Exception as e:
                logger.warning(f"[TTSService] Failed to read disk cache: {e}")
        return None

    def _save_to_cache(self, cache_key: str, audio_b64: str):
        if not audio_b64:
            return
        self._memory_cache[cache_key] = audio_b64
        disk_path = os.path.join(self._cache_dir, f"{cache_key}.mp3")
        try:
            with open(disk_path, "wb") as f:
                f.write(base64.b64decode(audio_b64))
        except Exception as e:
            logger.warning(f"[TTSService] Failed to write disk cache: {e}")

    async def synthesize_with_details(
        self,
        text: str,
        provider: Optional[str] = None,
        voice: Optional[str] = None,
        language: Optional[str] = None,
        rate: Optional[str] = None,
        timeout: float = 6.0,
        allow_fallback: bool = True,
    ) -> Dict[str, Any]:
        """
        Tổng hợp giọng đọc kèm mã lỗi chuẩn hóa để phục vụ chẩn đoán cuộc gọi.
        Mã lỗi chuẩn hóa:
        - TTS_INPUT_EMPTY: Văn bản rỗng sau khi làm sạch.
        - TTS_TIMEOUT: Quá thời gian chờ provider phản hồi.
        - TTS_PROVIDER_ERROR: Lỗi từ thư viện/API TTS (NoAudioReceived, kết nối, HTTP error).
        - TTS_AUDIO_EMPTY: Provider hoàn tất nhưng trả về 0 byte âm thanh.
        """
        clean_text = self.clean_text_for_tts(text)
        if not clean_text:
            logger.warning("[TTSService] TTS_INPUT_EMPTY: Input text is empty after cleaning")
            return {
                "audio_base64": "",
                "mime_type": "audio/mp3",
                "provider_used": "none",
                "error_code": "TTS_INPUT_EMPTY",
                "error_detail": "Input text is empty after cleaning",
            }

        selected_provider = (provider or settings.TTS_PROVIDER or "edge").lower()
        target_rate = rate or getattr(self, "current_rate_str", getattr(settings, "TTS_RATE", "+0%"))
        target_voice, lang_short = self._resolve_voice_and_lang(clean_text, language, voice)

        # 0. KIỂM TRA AUDIO CACHE TRƯỚC (< 1ms)
        cache_key = self._get_cache_key(clean_text, selected_provider, target_voice, target_rate)
        cached_audio = self._get_from_cache(cache_key)
        if cached_audio:
            logger.info(f"[TTSService Cache Hit] len={len(clean_text)} voice={target_voice}")
            return {
                "audio_base64": cached_audio,
                "mime_type": "audio/mp3",
                "provider_used": f"{selected_provider}_cached",
                "error_code": None,
                "error_detail": None,
            }

        last_error_code: Optional[str] = None
        last_error_detail: Optional[str] = None

        # 1. Thử nghiệm provider ElevenLabs
        if selected_provider == "elevenlabs" and settings.ELEVENLABS_API_KEY:
            try:
                audio_b64 = await self._synthesize_elevenlabs(clean_text, voice)
                if audio_b64:
                    self._save_to_cache(cache_key, audio_b64)
                    return {
                        "audio_base64": audio_b64,
                        "mime_type": "audio/mp3",
                        "provider_used": "elevenlabs",
                        "error_code": None,
                        "error_detail": None,
                    }
                last_error_code = "TTS_AUDIO_EMPTY"
                last_error_detail = "ElevenLabs returned empty audio"
            except Exception as e:
                last_error_code = "TTS_PROVIDER_ERROR"
                last_error_detail = f"ElevenLabs error: {e}"
                logger.warning(f"[TTSService] ElevenLabs synthesis failed: {e}. Fallback to EdgeTTS.")

        # 2. Thử nghiệm provider OpenAI TTS
        if selected_provider == "openai" and settings.OPENAI_API_KEY:
            try:
                audio_b64 = await self._synthesize_openai(clean_text, voice)
                if audio_b64:
                    self._save_to_cache(cache_key, audio_b64)
                    return {
                        "audio_base64": audio_b64,
                        "mime_type": "audio/mp3",
                        "provider_used": "openai",
                        "error_code": None,
                        "error_detail": None,
                    }
                last_error_code = "TTS_AUDIO_EMPTY"
                last_error_detail = "OpenAI TTS returned empty audio"
            except Exception as e:
                last_error_code = "TTS_PROVIDER_ERROR"
                last_error_detail = f"OpenAI TTS error: {e}"
                logger.warning(f"[TTSService] OpenAI TTS synthesis failed: {e}. Fallback to EdgeTTS.")

        # 3. Mặc định dùng EdgeTTS Neural (Single-flight deduplication)
        try:
            inflight = self._inflight_tasks.get(cache_key)
            if inflight is None or inflight.done():
                inflight = asyncio.create_task(
                    self._synthesize_and_cache_edge_tts_detailed(clean_text, target_voice, target_rate, cache_key)
                )
                self._inflight_tasks[cache_key] = inflight

            edge_b64, edge_err_code, edge_err_detail = await asyncio.wait_for(
                asyncio.shield(inflight), timeout=timeout
            )
            if edge_b64:
                return {
                    "audio_base64": edge_b64,
                    "mime_type": "audio/mp3",
                    "provider_used": "edge",
                    "error_code": None,
                    "error_detail": None,
                }
            last_error_code = edge_err_code or "TTS_AUDIO_EMPTY"
            last_error_detail = edge_err_detail or f"EdgeTTS returned no audio for voice={target_voice}"
        except asyncio.TimeoutError:
            last_error_code = "TTS_TIMEOUT"
            last_error_detail = f"EdgeTTS timed out after {timeout}s (voice={target_voice})"
            logger.warning(f"[TTSService] {last_error_code}: {last_error_detail} len={len(clean_text)}")
        except Exception as e:
            last_error_code = "TTS_PROVIDER_ERROR"
            last_error_detail = f"EdgeTTS exception: {type(e).__name__}: {e}"
            logger.warning(f"[TTSService] {last_error_code}: {last_error_detail}")

        # 4. Dự phòng nhanh qua Google Translate TTS HTTP endpoint khi EdgeTTS lỗi/timeout
        if allow_fallback:
            try:
                g_b64 = await self._synthesize_google_tts(clean_text, lang_short)
                if g_b64:
                    self._save_to_cache(cache_key, g_b64)
                    logger.info(
                        f"[TTSService] Google TTS fallback succeeded after {last_error_code} "
                        f"(lang={lang_short}, len={len(clean_text)})"
                    )
                    return {
                        "audio_base64": g_b64,
                        "mime_type": "audio/mp3",
                        "provider_used": "google_fallback",
                        "error_code": None,
                        "error_detail": None,
                    }
            except Exception as fallback_err:
                logger.warning(f"[TTSService] Google TTS fallback failed: {fallback_err}")

        # 5. Trả về mã lỗi chuẩn hóa khi toàn bộ provider không tạo được audio
        final_error_code = last_error_code or "TTS_AUDIO_EMPTY"
        final_error_detail = last_error_detail or "TTS synthesis produced empty audio"
        logger.warning(f"[TTSService] Synthesis failed: code={final_error_code} detail={final_error_detail}")
        return {
            "audio_base64": "",
            "mime_type": "audio/mp3",
            "provider_used": "browser",
            "error_code": final_error_code,
            "error_detail": final_error_detail,
        }

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
        res = await self.synthesize_with_details(
            text=text,
            provider=provider,
            voice=voice,
            language=language,
            rate=rate,
        )
        return res["audio_base64"], res["mime_type"], res["provider_used"]


# Singleton Instance
tts_service = TTSService()
