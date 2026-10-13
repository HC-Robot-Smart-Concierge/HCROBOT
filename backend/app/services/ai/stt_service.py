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
    Chiến lược tối ưu:
    1. Thử Google Speech API (với timeout ngắn 2.5s để không bị đơ nếu rớt mạng).
    2. Fallback sang Faster Whisper Offline (với bộ lọc VAD và beam search cho tiếng Việt).
    """
    # Nếu file âm thanh quá nhỏ (< 2000 bytes ~ 0.06s), bỏ qua không xử lý
    if not wav_bytes or len(wav_bytes) < 2000:
        return ""

    lang_code = "vi-VN" if language.startswith("vi") else "en-US"
    whisper_lang = "vi" if language.startswith("vi") else "en"

    # 1. Thử nhanh qua Google Speech API trước
    try:
        import speech_recognition as sr
        import socket
        recognizer = sr.Recognizer()
        bio = io.BytesIO(wav_bytes)
        with sr.AudioFile(bio) as source:
            audio_data = recognizer.record(source)
            
            # Đặt socket timeout tạm thời 2.5s để tránh bị treo server khi Google bị chặn
            orig_timeout = socket.getdefaulttimeout()
            socket.setdefaulttimeout(2.5)
            try:
                text = recognizer.recognize_google(audio_data, language=lang_code)
            finally:
                socket.setdefaulttimeout(orig_timeout)

            if text and text.strip():
                logger.info(f"[STT Service - Google] Transcribed: '{text.strip()}'")
                return text.strip()
    except Exception as e_sr:
        e_type = type(e_sr).__name__
        if "UnknownValueError" in e_type:
            logger.info("[STT Service - Google] No speech detected in audio, falling back to faster_whisper...")
        else:
            logger.warning(f"[STT Service - Google] Unavailable ({e_type}: {e_sr or 'timeout'}), falling back to faster_whisper...")

    # 2. Fallback sang faster_whisper offline 100% trên máy tính
    try:
        model = get_whisper_model()
        if model:
            bio_whisper = io.BytesIO(wav_bytes)
            segments, info = model.transcribe(
                bio_whisper,
                language=whisper_lang,
                beam_size=2,
                vad_filter=True,
                vad_parameters=dict(min_silence_duration_ms=400),
            )
            results = [seg.text.strip() for seg in segments if seg.text.strip()]
            full_text = " ".join(results).strip()
            if full_text:
                logger.info(f"[STT Service - Whisper] Transcribed: '{full_text}'")
                return full_text
            else:
                logger.info("[STT Service - Whisper] Audio analyzed but no clear speech words recognized.")
    except Exception as e_wh:
        logger.error(f"[STT Service] faster_whisper failed: {e_wh}")

    return ""
