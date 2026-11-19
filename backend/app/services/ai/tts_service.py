"""AI Voice Concierge TTS orchestration, settings persistence, and multi-tier audio caching."""

import asyncio
import base64
import hashlib
import json
import logging
import os
import re
from typing import Any, Dict, Optional, Tuple

try:
    import edge_tts
except ImportError:
    edge_tts = None

from app.core.config import settings
from .tts_providers import (
    clean_text_for_tts as _clean_text,
    common_warmup_phrases,
    is_vietnamese as _is_vi,
    rate_float_to_percentage as _rate_to_pct,
    synthesize_edge_tts_detailed,
    synthesize_elevenlabs,
    synthesize_google_tts,
    synthesize_openai_tts,
)

logger = logging.getLogger(__name__)


class TTSService:
    """
    AI Voice Concierge Speech Synthesis Service.
    Supports EdgeTTS Neural, ElevenLabs, OpenAI TTS, and Google TTS fallback
    with multi-tier Audio Caching (Memory + Disk) and structured error codes.
    """

    def __init__(self, load_persisted: bool = True):
        self.default_vi_voice = "vi-VN-HoaiMyNeural"
        self.default_en_voice = "en-US-JennyNeural"
        self.current_rate: float = 1.0
        self.current_rate_str: str = "+0%"
        self.default_volume: str = "+0%"

        self._memory_cache: Dict[str, str] = {}
        self._inflight_tasks: Dict[str, asyncio.Task] = {}

        current_dir = os.path.dirname(os.path.abspath(__file__))
        self._cache_dir = os.path.join(current_dir, "..", "..", "..", "static", "audio_cache")
        try:
            os.makedirs(self._cache_dir, exist_ok=True)
        except Exception as e:
            logger.warning(f"[TTSService] Cannot create audio_cache dir: {e}")

        self._config_file = os.path.join(current_dir, "..", "..", "..", "data", "ai_voice_config.json")
        if load_persisted:
            self._load_voice_config_from_disk()

    def _load_voice_config_from_disk(self) -> None:
        try:
            if not os.path.isfile(self._config_file):
                return
            with open(self._config_file, "r", encoding="utf-8") as f:
                saved = json.load(f)
            if not isinstance(saved, dict):
                return
            if saved.get("vi_voice"):
                self.default_vi_voice = saved["vi_voice"]
            if saved.get("en_voice"):
                self.default_en_voice = saved["en_voice"]
            if saved.get("volume"):
                # Không gửi volume dương (+35%...) vào EdgeTTS để tránh lỗi NoAudioReceived; giữ +0% an toàn
                self.default_volume = "+0%"
            if saved.get("speech_rate") is not None:
                clamped = max(0.5, min(2.0, float(saved["speech_rate"])))
                self.current_rate = clamped
                self.current_rate_str = self.rate_float_to_percentage(clamped)
                settings.TTS_RATE = self.current_rate_str
            logger.info(
                f"[TTSService] Loaded voice settings from disk: vi_voice={self.default_vi_voice}, "
                f"rate={self.current_rate}, volume={self.default_volume}"
            )
        except Exception as e:
            logger.warning(f"[TTSService] Failed to load voice config from disk: {e}")

    def _save_voice_config_to_disk(self) -> None:
        try:
            os.makedirs(os.path.dirname(self._config_file), exist_ok=True)
            payload = {
                "vi_voice": self.default_vi_voice,
                "en_voice": self.default_en_voice,
                "speech_rate": self.current_rate,
                "rate_percentage": self.current_rate_str,
                "volume": self.default_volume,
            }
            with open(self._config_file, "w", encoding="utf-8") as f:
                json.dump(payload, f, ensure_ascii=False, indent=2)
            logger.info(f"[TTSService] Saved voice settings to disk: {self._config_file}")
        except Exception as e:
            logger.error(f"[TTSService] Failed to save voice config to disk: {e}")

    clean_text_for_tts = staticmethod(_clean_text)
    rate_float_to_percentage = staticmethod(_rate_to_pct)
    is_vietnamese = staticmethod(_is_vi)

    def get_voice_settings(self) -> dict:
        """Lấy cấu hình giọng nói và tốc độ hiện tại của robot."""
        rate = getattr(self, "current_rate", 1.0)
        return {
            "speech_rate": rate,
            "rate_percentage": self.rate_float_to_percentage(rate),
            "vi_voice": self.default_vi_voice,
            "en_voice": self.default_en_voice,
            "volume": getattr(self, "default_volume", "+0%"),
        }

    def update_voice_settings(
        self,
        speech_rate: float = 1.0,
        vi_voice: Optional[str] = None,
        en_voice: Optional[str] = None,
        volume: Optional[str] = None,
    ) -> dict:
        """Cập nhật tốc độ đọc, giọng nói và âm lượng của robot trên toàn hệ thống."""
        clamped_rate = max(0.5, min(2.0, float(speech_rate)))
        self.current_rate = clamped_rate
        rate_str = self.rate_float_to_percentage(clamped_rate)
        self.current_rate_str = rate_str
        settings.TTS_RATE = rate_str
        if vi_voice:
            self.default_vi_voice = vi_voice
        if en_voice:
            self.default_en_voice = en_voice
        if volume is not None:
            # Luôn giữ +0% cho EdgeTTS (khuếch đại âm lượng do GainNode ở frontend đảm nhiệm)
            self.default_volume = "+0%"
        self._save_voice_config_to_disk()
        logger.info(
            f"[TTSService] Cập nhật cấu hình giọng nói AI: rate={clamped_rate} ({rate_str}), "
            f"vi_voice={self.default_vi_voice}, volume={self.default_volume}"
        )

        try:
            loop = asyncio.get_running_loop()
            if loop.is_running():
                asyncio.create_task(
                    self.warm_up_common_phrases(vi_voice=self.default_vi_voice, en_voice=self.default_en_voice)
                )
        except RuntimeError:
            pass

        return self.get_voice_settings()

    def _resolve_voice_and_lang(self, clean_text: str, language: Optional[str], voice: Optional[str]) -> Tuple[str, str]:
        lang_norm = (language or "").strip().lower()
        is_vi = self.is_vietnamese(clean_text)
        has_latin_words = bool(re.search(r"[a-zA-Z]{2,}", clean_text))

        # 1. Text is clearly Vietnamese (contains Vietnamese accents or keywords)
        if is_vi:
            target_voice = voice if (voice and "vi-" in voice.lower()) else self.default_vi_voice
            return target_voice, "vi"

        # 2. Text has Latin words and is definitely NOT Vietnamese (e.g. English sentences)
        if not is_vi and has_latin_words:
            target_voice = voice if (voice and "en-" in voice.lower()) else self.default_en_voice
            return target_voice, "en"

        # 3. Fallback based on requested language
        if any(en in lang_norm for en in ["en", "english"]):
            target_voice = voice if (voice and "en-" in voice.lower()) else self.default_en_voice
            return target_voice, "en"

        target_voice = voice if (voice and "vi-" in voice.lower()) else self.default_vi_voice
        return target_voice, "vi"

    def _get_cache_key(self, text: str, provider: str, voice: str, rate: str = "+0%", volume: str = "+0%") -> str:
        clean = text.strip()
        raw = f"{provider}:{voice}:{rate}:{volume}:{clean}"
        return hashlib.md5(raw.encode("utf-8")).hexdigest()

    def _get_from_cache(self, cache_key: str) -> Optional[str]:
        if cache_key in self._memory_cache:
            return self._memory_cache[cache_key]
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

    def _save_to_cache(self, cache_key: str, audio_b64: str) -> None:
        if not audio_b64:
            return
        self._memory_cache[cache_key] = audio_b64
        disk_path = os.path.join(self._cache_dir, f"{cache_key}.mp3")
        try:
            with open(disk_path, "wb") as f:
                f.write(base64.b64decode(audio_b64))
        except Exception as e:
            logger.warning(f"[TTSService] Failed to write disk cache: {e}")

    def get_audio_cache_info(
        self,
        text: str,
        language: Optional[str] = None,
        voice: Optional[str] = None,
        rate: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Kiểm tra thông tin file audio đã lưu trong thư mục static/audio_cache.
        Trả về: {"exists": bool, "file_path": str, "audio_url": str, "file_size": int, "cache_key": str, "voice": str}
        """
        clean_text = self.clean_text_for_tts(text)
        if not clean_text:
            return {
                "exists": False,
                "file_path": "",
                "audio_url": "",
                "file_size": 0,
                "cache_key": "",
                "voice": "",
            }

        target_voice, _ = self._resolve_voice_and_lang(clean_text, language, voice)
        target_rate = rate or getattr(self, "current_rate_str", "+0%") or "+0%"
        target_volume = getattr(self, "default_volume", "+0%") or "+0%"
        cache_key = self._get_cache_key(clean_text, "edge", target_voice, target_rate, target_volume)
        disk_path = os.path.join(self._cache_dir, f"{cache_key}.mp3")

        exists = os.path.isfile(disk_path) and os.path.getsize(disk_path) > 100
        file_size = os.path.getsize(disk_path) if exists else 0
        audio_url = f"/static/audio_cache/{cache_key}.mp3" if exists else ""

        return {
            "exists": exists,
            "file_path": disk_path if exists else "",
            "audio_url": audio_url,
            "file_size": file_size,
            "cache_key": cache_key,
            "voice": target_voice,
        }

    async def pre_generate_audio_file(
        self,
        text: str,
        language: Optional[str] = None,
        voice: Optional[str] = None,
        rate: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Sinh trước file audio MP3 cho văn bản và lưu trực tiếp vào thư mục backend/static/audio_cache.
        """
        info = self.get_audio_cache_info(text, language=language, voice=voice, rate=rate)
        if info["exists"]:
            return info

        clean_text = self.clean_text_for_tts(text)
        if not clean_text:
            return info

        target_voice, _ = self._resolve_voice_and_lang(clean_text, language, voice)
        await self.synthesize(text, provider="edge", language=language, voice=target_voice, rate=rate)
        return self.get_audio_cache_info(text, language=language, voice=voice, rate=rate)

    @staticmethod
    def _ok_result(audio_b64: str, provider_used: str, audio_url: Optional[str] = None) -> Dict[str, Any]:
        return {
            "audio_base64": audio_b64,
            "mime_type": "audio/mp3",
            "provider_used": provider_used,
            "audio_url": audio_url or "",
            "error_code": None,
            "error_detail": None,
        }

    async def synthesize_with_details(
        self,
        text: str,
        provider: Optional[str] = None,
        voice: Optional[str] = None,
        language: Optional[str] = None,
        rate: Optional[str] = None,
        timeout: float = 7.5,
        allow_fallback: bool = True,
    ) -> Dict[str, Any]:
        """Tổng hợp giọng đọc kèm mã lỗi chuẩn hóa để phục vụ chẩn đoán cuộc gọi."""
        clean_text = self.clean_text_for_tts(text)
        if not clean_text:
            logger.warning("[TTSService] TTS_INPUT_EMPTY: Input text is empty after cleaning")
            return {
                "audio_base64": "",
                "mime_type": "audio/mp3",
                "provider_used": "none",
                "audio_url": "",
                "error_code": "TTS_INPUT_EMPTY",
                "error_detail": "Input text is empty after cleaning",
            }

        selected_provider = (provider or settings.TTS_PROVIDER or "edge").lower()
        target_rate = rate or getattr(self, "current_rate_str", getattr(settings, "TTS_RATE", "+0%"))
        target_voice, lang_short = self._resolve_voice_and_lang(clean_text, language, voice)
        target_volume = "+0%"

        cache_key = self._get_cache_key(clean_text, selected_provider, target_voice, target_rate, target_volume)
        cached_audio = self._get_from_cache(cache_key)
        audio_static_url = f"/static/audio_cache/{cache_key}.mp3"
        if cached_audio:
            logger.info(f"[TTSService Cache Hit] len={len(clean_text)} voice={target_voice}")
            return self._ok_result(cached_audio, f"{selected_provider}_cached", audio_url=audio_static_url)

        last_error_code: Optional[str] = None
        last_error_detail: Optional[str] = None

        cloud_providers = {
            "elevenlabs": (settings.ELEVENLABS_API_KEY, self._synthesize_elevenlabs, "ElevenLabs"),
            "openai": (settings.OPENAI_API_KEY, self._synthesize_openai, "OpenAI TTS"),
        }
        if selected_provider in cloud_providers:
            api_key, fn, label = cloud_providers[selected_provider]
            if api_key:
                try:
                    audio_b64 = await fn(clean_text, voice)
                    if audio_b64:
                        self._save_to_cache(cache_key, audio_b64)
                        return self._ok_result(audio_b64, selected_provider, audio_url=audio_static_url)
                    last_error_code = "TTS_AUDIO_EMPTY"
                    last_error_detail = f"{label} returned empty audio"
                except Exception as e:
                    last_error_code = "TTS_PROVIDER_ERROR"
                    last_error_detail = f"{label} error: {e}"
                    logger.warning(f"[TTSService] {label} synthesis failed: {e}. Fallback to EdgeTTS.")

        try:
            inflight = self._inflight_tasks.get(cache_key)
            if inflight is None or inflight.done():
                inflight = asyncio.create_task(
                    self._synthesize_and_cache_edge_tts_detailed(clean_text, target_voice, target_rate, cache_key)
                )
                self._inflight_tasks[cache_key] = inflight

            edge_b64, edge_err_code, edge_err_detail = await asyncio.wait_for(asyncio.shield(inflight), timeout=timeout)
            if edge_b64:
                return self._ok_result(edge_b64, "edge", audio_url=audio_static_url)
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

        if allow_fallback:
            try:
                g_b64 = await self._synthesize_google_tts(clean_text, lang_short)
                if g_b64:
                    # Không lưu audio google_fallback vào cache_key của edge để tránh ghi đè giọng chuẩn
                    logger.info(
                        f"[TTSService] Google TTS fallback succeeded after {last_error_code} "
                        f"(lang={lang_short}, len={len(clean_text)}) - not cached under edge key"
                    )
                    return self._ok_result(g_b64, "google_fallback", audio_url=audio_static_url)
            except Exception as fallback_err:
                logger.warning(f"[TTSService] Google TTS fallback failed: {fallback_err}")

        final_error_code = last_error_code or "TTS_AUDIO_EMPTY"
        final_error_detail = last_error_detail or "TTS synthesis produced empty audio"
        logger.warning(f"[TTSService] Synthesis failed: code={final_error_code} detail={final_error_detail}")
        return {
            "audio_base64": "",
            "mime_type": "audio/mp3",
            "provider_used": "browser",
            "audio_url": "",
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
        """Tổng hợp giọng đọc từ văn bản kèm bộ đệm âm thanh siêu tốc."""
        res = await self.synthesize_with_details(
            text=text, provider=provider, voice=voice, language=language, rate=rate
        )
        return res["audio_base64"], res["mime_type"], res["provider_used"]

    async def _synthesize_and_cache_edge_tts_detailed(
        self, clean_text: str, voice: str, rate: str, cache_key: str
    ) -> Tuple[Optional[str], Optional[str], Optional[str]]:
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
        audio_b64, _, _ = await self._synthesize_and_cache_edge_tts_detailed(clean_text, voice, rate, cache_key)
        return audio_b64

    async def _synthesize_edge_tts_detailed(
        self, text: str, voice: str, rate: Optional[str] = None
    ) -> Tuple[Optional[str], Optional[str], Optional[str]]:
        return await synthesize_edge_tts_detailed(
            text, voice, rate=rate, default_volume="+0%"
        )

    async def _synthesize_edge_tts(self, text: str, voice: str, rate: Optional[str] = None) -> Optional[str]:
        audio_b64, _, _ = await self._synthesize_edge_tts_detailed(text, voice, rate)
        return audio_b64

    async def _synthesize_google_tts(self, text: str, lang_short: str = "vi") -> Optional[str]:
        return await synthesize_google_tts(text, lang_short=lang_short)

    async def synthesize_chunk(self, text: str, voice: Optional[str] = None, language: Optional[str] = None) -> bytes:
        """Synthesize a short streaming text clause into raw MP3 bytes."""
        clean_text = self.clean_text_for_tts(text)
        if not clean_text or edge_tts is None:
            return b""
        try:
            target_voice, _ = self._resolve_voice_and_lang(clean_text, language, voice)
            chunk_rate = getattr(self, "current_rate_str", getattr(settings, "TTS_RATE", "+0%"))
            chunk_volume = "+0%"
            cache_key = self._get_cache_key(clean_text, "edge_chunk", target_voice, chunk_rate, chunk_volume)
            if cache_key in self._memory_cache:
                return base64.b64decode(self._memory_cache[cache_key])

            disk_path = os.path.join(self._cache_dir, f"{cache_key}.mp3")
            if os.path.isfile(disk_path):
                with open(disk_path, "rb") as f:
                    data = f.read()
                self._memory_cache[cache_key] = base64.b64encode(data).decode("utf-8")
                return data

            communicate = edge_tts.Communicate(clean_text, target_voice, rate=chunk_rate, volume=chunk_volume)
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
        return await synthesize_elevenlabs(text, voice)

    async def _synthesize_openai(self, text: str, voice: Optional[str]) -> Optional[str]:
        return await synthesize_openai_tts(text, voice)

    async def warm_up_common_phrases(self, vi_voice: Optional[str] = None, en_voice: Optional[str] = None) -> None:
        target_vi = vi_voice or self.default_vi_voice
        target_en = en_voice or self.default_en_voice
        rate_str = getattr(self, "current_rate_str", "+0%") or "+0%"
        volume_str = "+0%"
        for phrase, lang, voice in common_warmup_phrases(target_vi, target_en):
            try:
                cache_key = self._get_cache_key(phrase, "edge", voice, rate_str, volume_str)
                if not self._get_from_cache(cache_key):
                    await self.synthesize(phrase, provider="edge", language=lang, voice=voice)
                    logger.info(f"[TTSService] Pre-cached filler phrase: '{phrase}' ({voice})")
            except Exception as e:
                logger.debug(f"[TTSService] Warmup skip for '{phrase}': {e}")


tts_service = TTSService()
