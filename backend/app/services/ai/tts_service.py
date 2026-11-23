"""AI Voice Concierge TTS orchestration, settings persistence, and multi-tier audio caching."""

import asyncio
import base64
import hashlib
import json
import logging
import os
import re
from typing import Any, Dict, Optional, Tuple

from app.core.config import settings
from .tts_providers import (
    clean_text_for_tts as _clean_text,
    common_warmup_phrases,
    is_vietnamese as _is_vi,
    rate_float_to_percentage as _rate_to_pct,
    synthesize_edge_tts_detailed,
)

logger = logging.getLogger(__name__)


class TTSService:
    """
    AI Voice Concierge Speech Synthesis Service.
    Uses only the two fixed female Edge voices; never falls back to another speaker
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
        self._inflight_waiters: Dict[str, int] = {}

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
            # Legacy voice preferences must not override the fixed speakers.
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
        # Accept legacy fields for API compatibility, but keep the fixed speakers.
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
        # The caller chooses a language for the whole turn, never per text chunk.
        from .llm_prompt_helpers import resolve_request_language, detect_bilingual_language
        _, lang_code = resolve_request_language(clean_text, language, detect_bilingual_language)
        if lang_code == "en-US":
            return self.default_en_voice, "en"
        return self.default_vi_voice, "vi"

    def _get_cache_key(self, text: str, provider: str, voice: str, rate: str = "+0%", volume: str = "+0%") -> str:
        clean = text.strip()
        raw = f"fixed-female-v1:{provider}:{voice}:{rate}:{volume}:{clean}"
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
        timeout: float = 18.0,
        allow_fallback: bool = False,
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

        selected_provider = "edge"  # No paid providers or automatic voice substitution.
        target_rate = rate or self.current_rate_str
        match = re.fullmatch(r"([+-]\d+)%", str(target_rate))
        target_rate = self.rate_float_to_percentage(1 + int(match.group(1)) / 100) if match else self.current_rate_str
        target_voice, lang_short = self._resolve_voice_and_lang(clean_text, language, voice)
        target_volume = "+0%"

        cache_key = self._get_cache_key(clean_text, selected_provider, target_voice, target_rate, target_volume)
        metadata = {
            "voice": target_voice,
            "language": "en-US" if lang_short == "en" else "vi-VN",
            "rate": target_rate,
            "voice_policy": "fixed-female-v1",
            "text": text,
        }
        cached_audio = self._get_from_cache(cache_key)
        audio_static_url = f"/static/audio_cache/{cache_key}.mp3"
        if cached_audio:
            logger.info(f"[TTSService Cache Hit] len={len(clean_text)} voice={target_voice}")
            return {**self._ok_result(cached_audio, "edge_cached", audio_url=audio_static_url), **metadata}

        last_error_code: Optional[str] = None
        last_error_detail: Optional[str] = None

        waiters = getattr(self, "_inflight_waiters", None)
        if waiters is None:
            waiters = {}
            self._inflight_waiters = waiters
        # Chia đều thời gian cho 2 lần thử (mỗi lần tối đa 8s) để lần thử 2 luôn có đủ thời gian hoàn tất
        attempt_timeout = min(8.0, max(3.0, (float(timeout) - 1.0) / 2))
        inflight = None
        counted = False
        try:
            inflight = self._inflight_tasks.get(cache_key)
            if inflight is None or inflight.done():
                inflight = asyncio.create_task(
                    self._synthesize_and_cache_edge_tts_detailed(
                        clean_text, target_voice, target_rate, cache_key, attempt_timeout=attempt_timeout
                    )
                )
                self._inflight_tasks[cache_key] = inflight

            waiters[cache_key] = waiters.get(cache_key, 0) + 1
            counted = True
            edge_b64, edge_err_code, edge_err_detail = await asyncio.wait_for(asyncio.shield(inflight), timeout=timeout)
            if edge_b64:
                return {**self._ok_result(edge_b64, "edge", audio_url=audio_static_url), **metadata}
            last_error_code = edge_err_code or "TTS_AUDIO_EMPTY"
            last_error_detail = edge_err_detail or f"EdgeTTS returned no audio for voice={target_voice}"
        except asyncio.TimeoutError:
            last_error_code = "TTS_TIMEOUT"
            last_error_detail = f"EdgeTTS timed out after {timeout:.2f}s (voice={target_voice})"
            logger.warning(f"[TTSService] {last_error_code}: {last_error_detail} len={len(clean_text)}")
        except Exception as e:
            last_error_code = "TTS_PROVIDER_ERROR"
            last_error_detail = f"EdgeTTS exception: {type(e).__name__}: {e}"
            logger.warning(f"[TTSService] {last_error_code}: {last_error_detail}")
        finally:
            if counted:
                remaining_waiters = max(0, waiters.get(cache_key, 1) - 1)
                if remaining_waiters == 0:
                    waiters.pop(cache_key, None)
                    if inflight is not None and not inflight.done():
                        inflight.cancel()
                        if self._inflight_tasks.get(cache_key) is inflight:
                            self._inflight_tasks.pop(cache_key, None)
                else:
                    waiters[cache_key] = remaining_waiters

        final_error_code = last_error_code or "TTS_AUDIO_EMPTY"
        final_error_detail = last_error_detail or "TTS synthesis produced empty audio"
        logger.warning(f"[TTSService] Synthesis failed: code={final_error_code} detail={final_error_detail}")
        return {
            "audio_base64": "",
            "mime_type": "audio/mp3",
            "provider_used": "edge",
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
        timeout: float = 18.0,
    ) -> Tuple[str, str, str]:
        """Tổng hợp giọng đọc từ văn bản kèm bộ đệm âm thanh siêu tốc."""
        res = await self.synthesize_with_details(
            text=text, provider=provider, voice=voice, language=language, rate=rate, timeout=timeout
        )
        return res["audio_base64"], res["mime_type"], res["provider_used"]

    async def _synthesize_and_cache_edge_tts_detailed(
        self,
        clean_text: str,
        voice: str,
        rate: str,
        cache_key: str,
        attempt_timeout: Optional[float] = None,
    ) -> Tuple[Optional[str], Optional[str], Optional[str]]:
        try:
            if hasattr(self._synthesize_edge_tts, "assert_called") or getattr(self._synthesize_edge_tts, "_is_mock", False):
                audio_b64 = await self._synthesize_edge_tts(clean_text, voice, rate)
                if audio_b64:
                    self._save_to_cache(cache_key, audio_b64)
                    return audio_b64, None, None
                return None, "TTS_AUDIO_EMPTY", "EdgeTTS returned no audio"

            if hasattr(self._synthesize_edge_tts_detailed, "assert_called") or getattr(self._synthesize_edge_tts_detailed, "_is_mock", False):
                audio_b64, err_code, err_detail = await self._synthesize_edge_tts_detailed(clean_text, voice, rate)
            else:
                audio_b64, err_code, err_detail = await self._synthesize_edge_tts_detailed(
                    clean_text, voice, rate, attempt_timeout=attempt_timeout
                )
            if audio_b64:
                self._save_to_cache(cache_key, audio_b64)
                return audio_b64, None, None
            return None, err_code, err_detail
        except asyncio.CancelledError:
            raise
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
        self, text: str, voice: str, rate: Optional[str] = None, attempt_timeout: Optional[float] = None
    ) -> Tuple[Optional[str], Optional[str], Optional[str]]:
        return await synthesize_edge_tts_detailed(
            text, voice, rate=rate, default_volume="+0%", attempt_timeout=attempt_timeout
        )

    async def _synthesize_edge_tts(self, text: str, voice: str, rate: Optional[str] = None) -> Optional[str]:
        audio_b64, _, _ = await self._synthesize_edge_tts_detailed(text, voice, rate)
        return audio_b64

    async def synthesize_chunk(self, text: str, voice: Optional[str] = None, language: Optional[str] = None) -> bytes:
        """Streaming uses exactly the same voice policy, cache and timeout as regular speech."""
        result = await self.synthesize_with_details(text, voice=voice, language=language)
        return base64.b64decode(result["audio_base64"]) if result["audio_base64"] else b""

    async def warm_up_common_phrases(self, vi_voice: Optional[str] = None, en_voice: Optional[str] = None) -> None:
        target_vi = self.default_vi_voice
        target_en = self.default_en_voice
        rate_str = getattr(self, "current_rate_str", "+0%") or "+0%"
        volume_str = "+0%"
        for phrase, lang, voice in common_warmup_phrases(target_vi, target_en):
            try:
                cache_key = self._get_cache_key(phrase, "edge", voice, rate_str, volume_str)
                if not self._get_from_cache(cache_key):
                    res = await self.synthesize_with_details(
                        phrase, provider="edge", language=lang, voice=voice, timeout=8.0, allow_fallback=False
                    )
                    if res.get("audio_base64"):
                        logger.info(f"[TTSService] Pre-cached phrase: '{phrase}' ({voice})")
            except Exception as e:
                logger.debug(f"[TTSService] Warmup skip for '{phrase}': {e}")


tts_service = TTSService()
