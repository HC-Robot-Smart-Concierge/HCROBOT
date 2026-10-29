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


def transcribe_audio_wav(wav_bytes: bytes, language: str = "auto") -> str:
    """
    Nhan dien giong noi tu file WAV bytes.
    Ho tro co che song ngu (Bilingual) tu dong phan loai English / Vietnamese.

    Chien luoc toi uu:
    1. is_auto (language='auto' / None / 'bilingual'):
       - Goi truc tiep Faster Whisper voi language=None de tu dong nhan dien ngon ngu am thanh (~99% do chinh xac, toc do ~0.7-1.0s).
       - Fallback sang Google Speech API (thu vi-VN roi en-US) neu Whisper gap su co.
    2. Chi dinh ngon ngu cu the ('vi' hoac 'en'):
       - Thu nhanh Google Speech API truoc (timeout 2.0s).
       - Fallback sang Faster Whisper voi dung ngon ngu do.
    """
    if not wav_bytes or len(wav_bytes) < 2000:
        return ""

    is_auto = not language or language.lower() in ("auto", "bilingual", "all", "none")

    # --- 1. Che do Song ngu Tu dong (Auto Detect) ---
    if is_auto:
        try:
            model = get_whisper_model()
            if model:
                bio_whisper = io.BytesIO(wav_bytes)
                segments, info = model.transcribe(
                    bio_whisper,
                    language=None,
                    beam_size=2,
                    vad_filter=True,
                    vad_parameters=dict(min_silence_duration_ms=400),
                )
                results = [seg.text.strip() for seg in segments if seg.text.strip()]
                full_text = " ".join(results).strip()
                if full_text:
                    logger.info(
                        f"[STT Service - Whisper Auto] Detected language='{info.language}' "
                        f"prob={info.language_probability:.2f}: '{full_text}'"
                    )
                    return full_text
                else:
                    logger.info("[STT Service - Whisper Auto] Audio analyzed but no clear speech words recognized.")
        except Exception as e_wh:
            logger.error(f"[STT Service - Whisper Auto] Error: {e_wh}")

        # Fallback sang Google Speech API neu Whisper khong nhan duoc
        for fallback_lang in ["vi-VN", "en-US"]:
            try:
                import speech_recognition as sr
                recognizer = sr.Recognizer()
                bio = io.BytesIO(wav_bytes)
                with sr.AudioFile(bio) as source:
                    audio_data = recognizer.record(source)
                text = recognizer.recognize_google(audio_data, language=fallback_lang)
                if text and text.strip():
                    logger.info(f"[STT Service - Google Fallback {fallback_lang}]: '{text.strip()}'")
                    return text.strip()
            except Exception:
                continue

        return ""

    # --- 2. Che do Ngon ngu Co dinh ('vi' hoac 'en') ---
    lang_code = "vi-VN" if language.lower().startswith("vi") else "en-US"
    whisper_lang = "vi" if language.lower().startswith("vi") else "en"

    # Thu nhanh Google Speech API truoc
    try:
        import speech_recognition as sr
        from concurrent.futures import ThreadPoolExecutor, TimeoutError

        recognizer = sr.Recognizer()
        bio = io.BytesIO(wav_bytes)
        with sr.AudioFile(bio) as source:
            audio_data = recognizer.record(source)

            def _google_call():
                return recognizer.recognize_google(audio_data, language=lang_code)

            with ThreadPoolExecutor(max_workers=1) as executor:
                future = executor.submit(_google_call)
                try:
                    text = future.result(timeout=2.0)
                    if text and text.strip():
                        logger.info(f"[STT Service - Google] Transcribed: '{text.strip()}'")
                        return text.strip()
                except TimeoutError:
                    logger.warning("[STT Service - Google] Timeout sau 2.0s, fallback sang faster_whisper offline...")
    except Exception as e_sr:
        e_type = type(e_sr).__name__
        if "UnknownValueError" in e_type:
            logger.info("[STT Service - Google] No speech detected in audio, falling back to faster_whisper...")
        else:
            logger.warning(f"[STT Service - Google] Unavailable ({e_type}: {e_sr}), falling back to faster_whisper...")

    # Fallback sang Faster Whisper offline voi ngon ngu da chon
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
