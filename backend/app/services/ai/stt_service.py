import io
import wave
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Lazy loaded whisper model to save RAM until first use
_whisper_model = None

def get_whisper_model():
    global _whisper_model
    if _whisper_model is None:
        try:
            import faster_whisper
            logger.info("[STT Service] Loading faster_whisper tiny model on CPU...")
            _whisper_model = faster_whisper.WhisperModel("tiny", device="cpu", compute_type="int8")
            logger.info("[STT Service] faster_whisper tiny model loaded successfully.")
        except Exception as e:
            logger.error(f"[STT Service] Failed to load faster_whisper: {e}")
            return None
    return _whisper_model


def transcribe_audio_wav(wav_bytes: bytes, language: str = "vi") -> str:
    """
    Nhận diện giọng nói từ file WAV bytes.
    Chiến lược kép (Dual-Engine Fallback):
    1. Ưu tiên speech_recognition (Google Speech API chuẩn): Cực nhanh, độ chính xác cao.
    2. Fallback sang faster_whisper (Offline 100% trên máy tính): Hoạt động kể cả khi mất mạng.
    """
    if not wav_bytes or len(wav_bytes) < 100:
        return ""

    lang_code = "vi-VN" if language.startswith("vi") else "en-US"
    whisper_lang = "vi" if language.startswith("vi") else "en"

    # 1. Thử qua speech_recognition trước
    try:
        import speech_recognition as sr
        recognizer = sr.Recognizer()
        bio = io.BytesIO(wav_bytes)
        with sr.AudioFile(bio) as source:
            audio_data = recognizer.record(source)
            text = recognizer.recognize_google(audio_data, language=lang_code)
            if text and text.strip():
                logger.info(f"[STT Service - Google] Transcribed: '{text.strip()}'")
                return text.strip()
    except Exception as e_sr:
        logger.warning(f"[STT Service] speech_recognition failed or offline ({e_sr}), switching to faster_whisper...")

    # 2. Fallback sang faster_whisper offline
    try:
        model = get_whisper_model()
        if model:
            bio_whisper = io.BytesIO(wav_bytes)
            segments, info = model.transcribe(bio_whisper, language=whisper_lang, beam_size=1)
            results = [seg.text.strip() for seg in segments if seg.text.strip()]
            full_text = " ".join(results).strip()
            if full_text:
                logger.info(f"[STT Service - Whisper] Transcribed: '{full_text}'")
                return full_text
    except Exception as e_wh:
        logger.error(f"[STT Service] faster_whisper failed: {e_wh}")

    return ""
