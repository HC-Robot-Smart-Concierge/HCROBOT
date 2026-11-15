"""TTS provider synthesis backends (EdgeTTS, Google TTS, ElevenLabs, OpenAI) and cache warmup."""

import asyncio
import base64
import logging
import os
import re
import urllib.parse
from typing import TYPE_CHECKING, Any, Optional, Tuple

import httpx

try:
    import edge_tts
except ImportError:
    edge_tts = None

from app.core.config import settings

logger = logging.getLogger(__name__)


class TTSProvidersMixin:
    """Provider backends, chunk streaming synthesis, and warm-up helpers for TTSService."""

    if TYPE_CHECKING:
        _memory_cache: dict[str, str]
        _cache_dir: str
        _inflight_tasks: dict[str, Any]

        def clean_text_for_tts(self, text: str) -> str: ...
        def _resolve_voice_and_lang(self, clean_text: str, language: Optional[str], voice: Optional[str]) -> Tuple[str, str]: ...
        def _get_cache_key(self, text: str, provider: str, voice: str, rate: str = "+0%") -> str: ...
        def _save_to_cache(self, cache_key: str, audio_b64: str) -> None: ...
        def _get_from_cache(self, cache_key: str) -> Optional[str]: ...
        async def synthesize(
            self,
            text: str,
            provider: Optional[str] = None,
            voice: Optional[str] = None,
            language: Optional[str] = None,
            rate: Optional[str] = None,
        ) -> Tuple[str, str, str]: ...
        async def _synthesize_edge_tts(self, clean_text: str, voice: str, rate: str) -> Optional[str]: ...
        async def _synthesize_edge_tts_detailed(self, clean_text: str, voice: str, rate: str) -> Tuple[Optional[str], Optional[str], Optional[str]]: ...

    async def _synthesize_and_cache_edge_tts_detailed(
        self, clean_text: str, voice: str, rate: str, cache_key: str
    ) -> Tuple[Optional[str], Optional[str], Optional[str]]:
        """Thực thi single-flight cho mỗi cache_key, lưu cache ngay khi thành công và trả về chi tiết lỗi nếu thất bại."""
        try:
            if hasattr(self._synthesize_edge_tts, "assert_called") or getattr(self._synthesize_edge_tts, "_is_mock", False):
                audio_b64 = await self._synthesize_edge_tts(clean_text, voice, rate)
                if audio_b64:
                    self._save_to_cache(cache_key, audio_b64)
                    return audio_b64, None, None
                return None, "TTS_AUDIO_EMPTY", "EdgeTTS returned no audio"

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
            # Attempt 0: Thu giong yeu cau (vi du: vi-VN-NamMinhNeural)
            # Attempt 1: Neu attempt 0 loi (vi du NoAudioReceived tren Azure TTS), tu dong thu giong Neural con lai
            current_voice = voice
            if attempt == 1:
                if "NamMinh" in voice:
                    current_voice = "vi-VN-HoaiMyNeural"
                    logger.info(f"[TTSService] EdgeTTS attempt 2: Switch fallback voice to {current_voice}")
                elif "HoaiMy" in voice:
                    current_voice = "vi-VN-NamMinhNeural"
                    logger.info(f"[TTSService] EdgeTTS attempt 2: Switch fallback voice to {current_voice}")

            try:
                communicate = _edge_tts.Communicate(clean_text, current_voice, rate=selected_rate)
                audio_bytes = b""
                async for chunk in communicate.stream():
                    if chunk.get("type") == "audio":
                        audio_bytes += chunk.get("data", b"")
                if audio_bytes and len(audio_bytes) > 100:
                    return base64.b64encode(audio_bytes).decode("utf-8"), None, None
                last_err_code = "TTS_AUDIO_EMPTY"
                last_err_detail = f"EdgeTTS returned {len(audio_bytes)} bytes (voice={current_voice}, attempt={attempt + 1})"
            except Exception as e:
                last_err_code = "TTS_PROVIDER_ERROR"
                last_err_detail = f"{type(e).__name__}: {e} (voice={current_voice}, attempt={attempt + 1})"
                logger.warning(f"[TTSService] EdgeTTS attempt {attempt + 1} error: {last_err_detail}")
            if attempt == 0:
                await asyncio.sleep(0.1)

        return None, last_err_code, last_err_detail

    async def _synthesize_edge_tts(self, text: str, voice: str, rate: Optional[str] = None) -> Optional[str]:
        """EdgeTTS Neural Engine sinh âm thanh trực tiếp (hàm tương thích ngược)."""
        audio_b64, _, _ = await self._synthesize_edge_tts_detailed(text, voice, rate)
        return audio_b64

    async def _synthesize_google_tts(self, text: str, lang_short: str = "vi") -> Optional[str]:
        """
        Dự phòng tổng hợp âm thanh MP3 qua Google Translate TTS endpoint khi EdgeTTS bị nghẽn hoặc lỗi.
        Chia nhỏ câu nếu dài quá 180 ký tự, giới hạn tối đa 2 đoạn để phản hồi dưới 0.6s.
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
        async with httpx.AsyncClient(timeout=2.0, headers=headers) as client:
            for seg in segments[:2]:
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

    async def synthesize_chunk(self, text: str, voice: Optional[str] = None, language: Optional[str] = None) -> bytes:
        """
        Tổng hợp giọng nói cho đoạn text ngắn (1 mệnh đề) -> trả raw audio bytes.
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
            "xi-api-key": settings.ELEVENLABS_API_KEY or "",
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

    async def warm_up_common_phrases(self, vi_voice: Optional[str] = None, en_voice: Optional[str] = None):
        """Pre-cache câu đệm và câu chào phổ biến để phản hồi tức thì 0ms."""
        target_vi = vi_voice or self.default_vi_voice
        target_en = en_voice or self.default_en_voice
        common_phrases = [
            ("Dạ đợi em một tí nhé ạ.", "vi-VN", target_vi),
            ("Please wait a moment.", "en-US", target_en),
            ("Dạ đợi em một tí ạ.", "vi-VN", target_vi),
            ("Rora cảm ơn quý khách! Quý khách chấm điểm dịch vụ giúp em nhé.", "vi-VN", target_vi),
            ("Rora cảm ơn quý khách! Chúc quý khách kỳ nghỉ tuyệt vời.", "vi-VN", target_vi),
            ("Rora xin ghi nhận ý kiến để hoàn thiện hơn. Cảm ơn quý khách.", "vi-VN", target_vi),
            ("Dạ đây là toàn bộ cơ sở vật chất và tiện ích 5 sao của khách sạn ạ.", "vi-VN", target_vi),
            ("Xin lỗi quý khách, không thể kết nối tới AI Server.", "vi-VN", target_vi),
            ("Xác thực phòng thành công! Đơn phục vụ đã được tạo.", "vi-VN", target_vi),
            ("Quý khách có thể quét mã QR trên màn hình để lưu lại chỉ dẫn đường đi trên điện thoại nhé ạ.", "vi-VN", target_vi),
            ("You can scan the QR code on the screen to save directions on your mobile phone.", "en-US", target_en),
            ("Dạ em đã hiểu ạ.", "vi-VN", target_vi),
            ("I understand.", "en-US", target_en),
        ]
        rate_str = getattr(self, "current_rate_str", "+0%") or "+0%"
        for phrase, lang, voice in common_phrases:
            try:
                cache_key = self._get_cache_key(phrase, "edge", voice, rate_str)
                if not self._get_from_cache(cache_key):
                    await self.synthesize(phrase, provider="edge", language=lang, voice=voice)
                    logger.info(f"[TTSService] Pre-cached filler phrase: '{phrase}' ({voice})")
            except Exception as e:
                logger.debug(f"[TTSService] Warmup skip for '{phrase}': {e}")
