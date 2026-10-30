import asyncio
import base64
import hashlib
import logging
import os
import re
import urllib.parse
from typing import Optional, Tuple, Dict, Any

import httpx

try:
    import edge_tts
except ImportError:
    edge_tts = None

from app.core.config import settings

logger = logging.getLogger(__name__)


class TTSService:
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
        t = re.sub(r'[*#_`\[\]()~]', '', str(text))
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

    async def _synthesize_and_cache_edge_tts_detailed(
        self, clean_text: str, voice: str, rate: str, cache_key: str
    ) -> Tuple[Optional[str], Optional[str], Optional[str]]:
        """Thực thi single-flight cho mỗi cache_key, lưu cache ngay khi thành công và trả về chi tiết lỗi nếu thất bại."""
        try:
            audio_b64, err_code, err_detail = await self._synthesize_edge_tts_detailed(clean_text, voice, rate)
            if audio_b64:
                self._save_to_cache(cache_key, audio_b64)
                return audio_b64, None, None
            return None, err_code, err_detail
        except Exception as e:
            logger.debug(f"[TTSService] EdgeTTS single-flight task exception: {e}")
            return None, "TTS_PROVIDER_ERROR", f"{type(e).__name__}: {e}"
        finally:
            if self._inflight_tasks.get(cache_key) is asyncio.current_task():
                self._inflight_tasks.pop(cache_key, None)

    async def _synthesize_and_cache_edge_tts(
        self, clean_text: str, voice: str, rate: str, cache_key: str
    ) -> Optional[str]:
        """Tương thích ngược cho các hàm gọi cũ."""
        audio_b64, _, _ = await self._synthesize_and_cache_edge_tts_detailed(clean_text, voice, rate, cache_key)
        return audio_b64

    async def _synthesize_edge_tts_detailed(
        self, text: str, voice: str, rate: Optional[str] = None
    ) -> Tuple[Optional[str], Optional[str], Optional[str]]:
        """EdgeTTS Neural Engine sinh âm thanh kèm phân loại lỗi chính xác và 1 lần retry ngắn."""
        clean_text = self.clean_text_for_tts(text)
        if not clean_text:
            return None, "TTS_INPUT_EMPTY", "Cleaned text is empty"

        selected_rate = rate or getattr(settings, "TTS_RATE", "+0%")
        if not re.match(r'^[+-]\d+%$', str(selected_rate)):
            selected_rate = "+0%"

        try:
            import edge_tts as _edge_tts
        except ImportError:
            logger.info("[TTSService] edge_tts library not installed.")
            return None, "TTS_PROVIDER_ERROR", "edge_tts library not installed"

        last_err_code = "TTS_AUDIO_EMPTY"
        last_err_detail = f"EdgeTTS returned 0 bytes for voice={voice}"

        for attempt in range(2):
            try:
                communicate = _edge_tts.Communicate(clean_text, voice, rate=selected_rate)
                audio_bytes = b""
                async for chunk in communicate.stream():
                    if chunk.get("type") == "audio":
                        audio_bytes += chunk.get("data", b"")
                if audio_bytes and len(audio_bytes) > 100:
                    return base64.b64encode(audio_bytes).decode("utf-8"), None, None
                last_err_code = "TTS_AUDIO_EMPTY"
                last_err_detail = f"EdgeTTS returned {len(audio_bytes)} bytes (voice={voice}, attempt={attempt + 1})"
            except Exception as e:
                last_err_code = "TTS_PROVIDER_ERROR"
                last_err_detail = f"{type(e).__name__}: {e} (voice={voice}, attempt={attempt + 1})"
                logger.warning(f"[TTSService] EdgeTTS attempt {attempt + 1} error: {last_err_detail}")
            if attempt == 0:
                await asyncio.sleep(0.2)

        return None, last_err_code, last_err_detail

    async def _synthesize_edge_tts(self, text: str, voice: str, rate: Optional[str] = None) -> Optional[str]:
        """EdgeTTS Neural Engine sinh âm thanh trực tiếp (hàm tương thích ngược)."""
        audio_b64, _, _ = await self._synthesize_edge_tts_detailed(text, voice, rate)
        return audio_b64

    async def _synthesize_google_tts(self, text: str, lang_short: str = "vi") -> Optional[str]:
        """
        Dự phòng tổng hợp âm thanh MP3 qua Google Translate TTS endpoint khi EdgeTTS bị nghẽn hoặc lỗi.
        Chia nhỏ câu nếu dài quá 180 ký tự.
        """
        clean = self.clean_text_for_tts(text)
        if not clean:
            return None
        tl = "en" if lang_short.startswith("en") else "vi"
        # Cắt đoạn tối đa 180 ký tự theo khoảng trắng
        words = clean.split(" ")
        segments = []
        current = ""
        for w in words:
            if len(current) + len(w) + 1 <= 180:
                current = f"{current} {w}".strip()
            else:
                if current:
                    segments.append(current)
                current = w[:180]
        if current:
            segments.append(current)

        combined_bytes = b""
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
        async with httpx.AsyncClient(timeout=3.0, headers=headers) as client:
            for seg in segments[:4]:
                q = urllib.parse.quote(seg)
                url = f"https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl={tl}&q={q}"
                resp = await client.get(url)
                if resp.status_code == 200 and resp.content and len(resp.content) > 100:
                    combined_bytes += resp.content
                else:
                    return None
        if combined_bytes and len(combined_bytes) > 100:
            return base64.b64encode(combined_bytes).decode("utf-8")
        return None

    async def synthesize_chunk(self, text: str, voice: str = None, language: str = None) -> bytes:
        """
        Tổng hợp giọng nói cho đoạn text ngắn (1 mệnh đề) → trả raw audio bytes.
        Tối ưu cho Streaming Pipeline: không encode Base64, gửi thẳng qua WebSocket Binary Frame.
        """
        clean_text = self.clean_text_for_tts(text)
        if not clean_text:
            return b""

        if edge_tts is None:
            return b""

        try:
            target_voice, _ = self._resolve_voice_and_lang(clean_text, language, voice)

            cache_key = self._get_cache_key(clean_text, "edge_chunk", target_voice)
            if cache_key in self._memory_cache:
                return base64.b64decode(self._memory_cache[cache_key])

            # Kiểm tra Redis Cloud Cache trước (< 5ms)
            try:
                from app.services.cache.redis_service import redis_service
                redis_audio = await redis_service.get_tts_audio(cache_key)
                if redis_audio and len(redis_audio) > 0:
                    self._memory_cache[cache_key] = base64.b64encode(redis_audio).decode("utf-8")
                    return redis_audio
            except Exception:
                pass

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
                # Lưu đồng thời lên Redis Cloud Cache
                try:
                    from app.services.cache.redis_service import redis_service
                    await redis_service.set_tts_audio(cache_key, audio_bytes)
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
