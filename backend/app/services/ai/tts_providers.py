"""TTS text normalization and HTTP/EdgeTTS synthesis provider helpers."""

import asyncio
import base64
import logging
import re
import urllib.parse
from typing import Any, Dict, Optional, Tuple

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


def clean_text_for_tts(text: str) -> str:
    """Strip markdown/emoji and normalize punctuation so speech sounds natural."""
    if not text:
        return ""
    t = re.sub(r"[*#_`\[\]()~]", "", text)
    t = re.sub(r"[\U00010000-\U0010ffff]", "", t)
    t = re.sub(r"^[\s*•\-–—]+\s*", "", t, flags=re.MULTILINE)
    t = re.sub(r":\s*", ", ", t)
    t = re.sub(r"\s*;\s*", ", ", t)
    t = re.sub(r"\.{2,}", ".", t)
    t = re.sub(r"!{2,}", "!", t)
    t = re.sub(r"\?{2,}", "?", t)
    return re.sub(r"\s+", " ", t).strip()


def rate_float_to_percentage(rate: float) -> str:
    """Convert float speech rate (0.5 - 2.0) into EdgeTTS percentage string."""
    clamped = max(0.5, min(2.0, float(rate)))
    diff = round((clamped - 1.0) * 100)
    return f"+{diff}%" if diff >= 0 else f"{diff}%"


def is_vietnamese(text: str) -> bool:
    """Check whether input text appears to be Vietnamese."""
    if not text:
        return True
    if re.search(
        r"[àáảãạâầấẩẫậăằắẳẵặèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]",
        text,
        re.IGNORECASE,
    ):
        return True
    vi_words = [
        r"\bdạ\b", r"\bem\b", r"\banh\b", r"\bchị\b",
        r"\bquý khách\b", r"\bphòng\b", r"\bkhách sạn\b", r"\bạ\b",
    ]
    return any(re.search(w, text, re.IGNORECASE) for w in vi_words)


async def synthesize_edge_tts_detailed(
    text: str,
    voice: str,
    *,
    rate: Optional[str] = None,
    default_volume: str = "+0%",
) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """Synthesize MP3 audio via EdgeTTS Neural with same-voice retry and classified error codes."""
    clean_text = clean_text_for_tts(text)
    if not clean_text:
        return None, "TTS_INPUT_EMPTY", "Cleaned text is empty"

    selected_rate = rate or getattr(settings, "TTS_RATE", "+0%")
    if not re.match(r"^[+-]\d+%$", str(selected_rate)):
        selected_rate = "+0%"
    # Luôn dùng +0% khi gọi EdgeTTS để tránh lỗi NoAudioReceived; khuếch đại âm lượng được xử lý qua GainNode ở frontend.
    selected_volume = "+0%"

    try:
        import edge_tts as _edge_tts
    except ImportError:
        logger.info("[TTSService] edge_tts library not installed.")
        return None, "TTS_PROVIDER_ERROR", "edge_tts library not installed"

    last_err_code = "TTS_AUDIO_EMPTY"
    last_err_detail = f"EdgeTTS returned 0 bytes for voice={voice}"

    for attempt in range(2):
        current_voice = voice
        if attempt == 1:
            logger.info(f"[TTSService] EdgeTTS attempt 2: Retrying same voice {current_voice}")

        try:
            communicate = _edge_tts.Communicate(
                clean_text, current_voice, rate=selected_rate, volume=selected_volume
            )
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


async def synthesize_google_tts(text: str, lang_short: str = "vi") -> Optional[str]:
    """Synthesize MP3 fallback audio via Google Translate TTS HTTP endpoint."""
    clean = clean_text_for_tts(text)
    if not clean:
        return None
    tl = "en" if lang_short.startswith("en") else "vi"
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
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
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


async def _post_tts_audio(
    url: str,
    headers: Dict[str, str],
    payload: Dict[str, Any],
    provider_label: str,
) -> Optional[str]:
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(url, json=payload, headers=headers)
        if resp.status_code == 200:
            return base64.b64encode(resp.content).decode("utf-8")
        logger.error(f"[TTSService] {provider_label} API error {resp.status_code}: {resp.text}")
    return None


async def synthesize_elevenlabs(text: str, voice: Optional[str]) -> Optional[str]:
    api_key = settings.ELEVENLABS_API_KEY
    if not api_key:
        return None
    voice_id = voice or settings.ELEVENLABS_VOICE_ID or "21m00Tcm4TlvDq8ikWAM"
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
    headers = {
        "Accept": "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": api_key,
    }
    payload = {
        "text": text,
        "model_id": "eleven_multilingual_v2",
        "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
    }
    return await _post_tts_audio(url, headers, payload, "ElevenLabs")


async def synthesize_openai_tts(text: str, voice: Optional[str]) -> Optional[str]:
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
    return await _post_tts_audio(url, headers, payload, "OpenAI TTS")


def common_warmup_phrases(target_vi: str, target_en: str):
    return [
        ("Dạ đợi em một tí nhé ạ.", "vi-VN", target_vi),
        ("Please wait a moment.", "en-US", target_en),
        ("Dạ đợi em một tí ạ.", "vi-VN", target_vi),
        ("Dạ vâng, em có thể hỗ trợ gì thêm cho quý khách ạ?", "vi-VN", target_vi),
        ("You are welcome! How may I assist you further?", "en-US", target_en),
        ("Dạ vâng, Rora rất vui được hỗ trợ quý khách! Quý khách dành chút thời gian đánh giá dịch vụ giúp em nhé ạ.", "vi-VN", target_vi),
        ("Rora is delighted to assist you! Please take a quick moment to rate our service.", "en-US", target_en),
        ("Dạ, đây là danh bạ hotline các hãng taxi uy tín tại Đà Nẵng ạ.", "vi-VN", target_vi),
        ("Dạ em đã hủy yêu cầu đặt xe. Quý khách cần em hỗ trợ gì thêm không ạ?", "vi-VN", target_vi),
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
