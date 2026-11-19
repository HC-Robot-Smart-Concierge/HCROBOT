import asyncio
import io
import logging
import os
import urllib.request
import wave
from pathlib import Path
from typing import Optional

from app.services.ai.tts_providers import clean_text_for_tts

logger = logging.getLogger(__name__)

_MODELS_DIR = Path(__file__).resolve().parent.parent.parent.parent / "models" / "piper"

_VI_MODEL_NAME = "vi_VN-25hours_single-low.onnx"
_VI_CONFIG_NAME = "vi_VN-25hours_single-low.onnx.json"
_EN_MODEL_NAME = "en_US-lessac-low.onnx"
_EN_CONFIG_NAME = "en_US-lessac-low.onnx.json"

_HF_BASE_URL = "https://huggingface.co/rhasspy/piper-voices/resolve/main"
_VI_URL_ONNX = f"{_HF_BASE_URL}/vi/vi_VN/25hours_single/low/{_VI_MODEL_NAME}"
_VI_URL_JSON = f"{_HF_BASE_URL}/vi/vi_VN/25hours_single/low/{_VI_CONFIG_NAME}"
_EN_URL_ONNX = f"{_HF_BASE_URL}/en/en_US/lessac/low/{_EN_MODEL_NAME}"
_EN_URL_JSON = f"{_HF_BASE_URL}/en/en_US/lessac/low/{_EN_CONFIG_NAME}"


class PiperTTSService:
    """Local Offline Neural Text-to-Speech Engine powered by Piper ONNX and LAME MP3 Encoder."""

    def __init__(self):
        self._models_dir = _MODELS_DIR
        self._vi_voice = None
        self._en_voice = None
        self._lock = asyncio.Lock()
        self._initialized = False

    def is_available(self) -> bool:
        """Check if piper and lameenc are installed, and model files exist."""
        try:
            import lameenc  # noqa: F401
            import piper  # noqa: F401

            vi_path = self._models_dir / _VI_MODEL_NAME
            en_path = self._models_dir / _EN_MODEL_NAME
            return vi_path.exists() and en_path.exists()
        except ImportError:
            return False

    def _ensure_models(self) -> bool:
        """Download offline Piper ONNX models if not present on disk."""
        self._models_dir.mkdir(parents=True, exist_ok=True)
        files_to_check = [
            (_VI_MODEL_NAME, _VI_URL_ONNX),
            (_VI_CONFIG_NAME, _VI_URL_JSON),
            (_EN_MODEL_NAME, _EN_URL_ONNX),
            (_EN_CONFIG_NAME, _EN_URL_JSON),
        ]
        for filename, url in files_to_check:
            dest = self._models_dir / filename
            if not dest.exists():
                try:
                    logger.info(f"[PiperTTS] Downloading offline voice model '{filename}' from HuggingFace...")
                    urllib.request.urlretrieve(url, str(dest))
                    logger.info(f"[PiperTTS] Successfully downloaded '{filename}' ({dest.stat().st_size} bytes)")
                except Exception as e:
                    logger.warning(f"[PiperTTS] Could not download voice model '{filename}': {e}")
                    return False
        return True

    def load_voices(self) -> bool:
        """Load Piper ONNX voices into RAM for instant local speech synthesis."""
        if self._initialized and self._vi_voice and self._en_voice:
            return True

        if not self._ensure_models():
            return False

        try:
            from piper import PiperVoice

            vi_path = self._models_dir / _VI_MODEL_NAME
            en_path = self._models_dir / _EN_MODEL_NAME

            if not self._vi_voice and vi_path.exists():
                logger.info("[PiperTTS] Loading Vietnamese Piper voice into RAM...")
                self._vi_voice = PiperVoice.load(str(vi_path))

            if not self._en_voice and en_path.exists():
                logger.info("[PiperTTS] Loading English Piper voice into RAM...")
                self._en_voice = PiperVoice.load(str(en_path))

            self._initialized = bool(self._vi_voice and self._en_voice)
            logger.info("[PiperTTS] Offline Neural Voice Engine initialized successfully.")
            return self._initialized
        except Exception as e:
            logger.error(f"[PiperTTS] Failed to initialize Piper voices: {e}")
            return False

    def _sync_synthesize_mp3(self, text: str, is_vi: bool = True) -> Optional[bytes]:
        """Synchronous synthesis and LAME MP3 encoding running in thread pool."""
        try:
            import lameenc

            voice = self._vi_voice if is_vi else self._en_voice
            if not voice:
                return None

            wav_io = io.BytesIO()
            with wave.open(wav_io, "wb") as wav_file:
                voice.synthesize_wav(text, wav_file)

            wav_io.seek(0)
            with wave.open(wav_io, "rb") as wav_read:
                sample_rate = wav_read.getframerate()
                channels = wav_read.getnchannels()
                pcm_data = wav_read.readframes(wav_read.getnframes())

            if not pcm_data:
                return None

            encoder = lameenc.Encoder()
            encoder.set_bit_rate(128)
            encoder.set_in_sample_rate(sample_rate)
            encoder.set_channels(channels)
            encoder.set_quality(2)
            mp3_bytes = encoder.encode(pcm_data) + encoder.flush()
            return mp3_bytes
        except Exception as e:
            logger.error(f"[PiperTTS] Error during offline synthesis: {e}")
            return None

    async def synthesize(self, text: str, is_vi: bool = True) -> Optional[str]:
        """Synthesize text to base64 MP3 offline without internet connection."""
        clean = clean_text_for_tts(text)
        if not clean:
            return None

        if not self._initialized:
            loaded = await asyncio.to_thread(self.load_voices)
            if not loaded:
                return None

        async with self._lock:
            mp3_bytes = await asyncio.to_thread(self._sync_synthesize_mp3, clean, is_vi)

        if mp3_bytes and len(mp3_bytes) > 100:
            import base64

            return base64.b64encode(mp3_bytes).decode("utf-8")
        return None


piper_service = PiperTTSService()
