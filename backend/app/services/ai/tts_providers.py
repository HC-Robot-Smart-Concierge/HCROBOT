"""TTS text normalization and HTTP/EdgeTTS synthesis provider helpers."""

import asyncio
import base64
import logging
import re
import socket
from typing import Any, Optional, Tuple

from app.core.config import settings

logger = logging.getLogger(__name__)

# Ép buộc sử dụng IPv4 cho các endpoint của Microsoft EdgeTTS để triệt tiêu độ trễ 10s - 20s
# do Windows/Tailscale thử kết nối địa chỉ IPv6 không phản hồi trước khi fallback IPv4.
_orig_getaddrinfo = socket.getaddrinfo


def _edge_ipv4_getaddrinfo(host, port, family=0, type=0, proto=0, flags=0):
    if host and ("speech.platform.bing.com" in str(host) or "msedge.net" in str(host)):
        family = socket.AF_INET
    return _orig_getaddrinfo(host, port, family, type, proto, flags)


socket.getaddrinfo = _edge_ipv4_getaddrinfo


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


async def _collect_edge_audio(communicate: Any) -> bytes:
    """Drain audio chunks from an EdgeTTS Communicate stream."""
    audio_bytes = b""
    async for chunk in communicate.stream():
        if chunk.get("type") == "audio":
            audio_bytes += chunk.get("data", b"")
    return audio_bytes


def split_text_for_edge_tts(text: str, max_chars: int = 140) -> list[str]:
    """Split long TTS text into short sentence-aligned chunks to avoid EdgeTTS NoAudioReceived."""
    clean = (text or "").strip()
    if not clean:
        return []
    if len(clean) <= max_chars:
        return [clean]

    raw_parts = re.split(r"(?<=[.!?])\s+", clean)
    pieces: list[str] = []
    for part in raw_parts:
        part = part.strip()
        if not part:
            continue
        if len(part) <= max_chars:
            pieces.append(part)
            continue
        sub_parts = re.split(r"(?<=[,;:])\s+", part)
        for sub in sub_parts:
            sub = sub.strip()
            if not sub:
                continue
            if len(sub) <= max_chars:
                pieces.append(sub)
                continue
            words = sub.split(" ")
            current = ""
            for w in words:
                candidate = f"{current} {w}".strip() if current else w
                if len(candidate) <= max_chars:
                    current = candidate
                else:
                    if current:
                        pieces.append(current)
                    current = w
            if current:
                pieces.append(current)

    chunks: list[str] = []
    current_chunk = ""
    for piece in pieces:
        candidate = f"{current_chunk} {piece}".strip() if current_chunk else piece
        if len(candidate) <= max_chars:
            current_chunk = candidate
        else:
            if current_chunk:
                chunks.append(current_chunk)
            current_chunk = piece
    if current_chunk:
        chunks.append(current_chunk)
    return chunks or [clean]


async def synthesize_edge_tts_detailed(
    text: str,
    voice: str,
    *,
    rate: Optional[str] = None,
    default_volume: str = "+0%",
    attempt_timeout: Optional[float] = None,
) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """Synthesize MP3 audio via EdgeTTS Neural with bounded per-attempt timeout and same-voice retry."""
    clean_text = clean_text_for_tts(text)
    if not clean_text:
        return None, "TTS_INPUT_EMPTY", "Cleaned text is empty"

    selected_rate = rate or getattr(settings, "TTS_RATE", "+0%")
    if not re.match(r"^[+-]\d+%$", str(selected_rate)):
        selected_rate = "+0%"
    # Luôn dùng +0% khi gọi EdgeTTS để tránh lỗi NoAudioReceived; khuếch đại âm lượng được xử lý qua GainNode ở frontend.
    selected_volume = "+0%"
    per_attempt_timeout = max(0.02, float(attempt_timeout)) if attempt_timeout is not None else 16.0

    try:
        import edge_tts as _edge_tts
        import aiohttp as _aiohttp
        import socket as _socket
    except ImportError:
        logger.info("[TTSService] edge_tts library not installed.")
        return None, "TTS_PROVIDER_ERROR", "edge_tts library not installed"

    last_err_code = "TTS_AUDIO_EMPTY"
    last_err_detail = f"EdgeTTS returned 0 bytes for voice={voice}"

    max_attempts = 2
    per_attempt_timeout = max(0.02, float(attempt_timeout)) if attempt_timeout is not None else 16.0

    chunks = split_text_for_edge_tts(clean_text, max_chars=140)

    for attempt in range(max_attempts):
        current_voice = voice
        if attempt > 0:
            logger.info(f"[TTSService] EdgeTTS attempt {attempt + 1}: Retrying same voice {current_voice}")

        try:
            if len(chunks) == 1:
                communicate = _edge_tts.Communicate(
                    chunks[0],
                    current_voice,
                    rate=selected_rate,
                    volume=selected_volume,
                )
                audio_bytes = await asyncio.wait_for(
                    _collect_edge_audio(communicate),
                    timeout=per_attempt_timeout,
                )
            else:
                async def _synth_all_chunks() -> bytes:
                    tasks = [
                        _collect_edge_audio(
                            _edge_tts.Communicate(
                                chunk,
                                current_voice,
                                rate=selected_rate,
                                volume=selected_volume,
                            )
                        )
                        for chunk in chunks
                    ]
                    results = await asyncio.gather(*tasks)
                    return b"".join(results)

                audio_bytes = await asyncio.wait_for(
                    _synth_all_chunks(),
                    timeout=per_attempt_timeout,
                )
            if audio_bytes and len(audio_bytes) > 100:
                return base64.b64encode(audio_bytes).decode("utf-8"), None, None
            last_err_code = "TTS_AUDIO_EMPTY"
            last_err_detail = f"EdgeTTS returned {len(audio_bytes)} bytes (voice={current_voice}, attempt={attempt + 1})"
        except asyncio.CancelledError:
            raise
        except asyncio.TimeoutError:
            last_err_code = "TTS_TIMEOUT"
            last_err_detail = f"EdgeTTS attempt {attempt + 1} timed out after {per_attempt_timeout:.1f}s (voice={current_voice})"
            logger.warning(f"[TTSService] {last_err_detail}")
        except Exception as e:
            last_err_code = "TTS_PROVIDER_ERROR"
            last_err_detail = f"{type(e).__name__}: {e} (voice={current_voice}, attempt={attempt + 1})"
            logger.warning(f"[TTSService] EdgeTTS attempt {attempt + 1} error: {last_err_detail}")
        if attempt < max_attempts - 1:
            await asyncio.sleep(0.3 * (attempt + 1))

    return None, last_err_code, last_err_detail


def escape_ssml_text(text: str) -> str:
    """Escape special XML characters for SSML payload."""
    if not text:
        return ""
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&apos;")
    )


async def synthesize_azure_speech_detailed(
    text: str,
    voice: str,
    *,
    rate: Optional[str] = None,
    api_key: Optional[str] = None,
    region: Optional[str] = None,
    timeout: float = 6.0,
) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """
    Synthesize speech via Microsoft Azure Speech Services REST API.
    Uses the exact same neural voice (vi-VN-HoaiMyNeural / en-US-JennyNeural)
    hosted on Microsoft's paid infrastructure in Singapore (southeastasia) for 300ms - 800ms latency.
    """
    key = api_key or getattr(settings, "AZURE_SPEECH_KEY", None)
    if not key or not str(key).strip():
        return None, "AZURE_NOT_CONFIGURED", "AZURE_SPEECH_KEY is not configured"

    clean_text = clean_text_for_tts(text)
    if not clean_text:
        return None, "TTS_INPUT_EMPTY", "Cleaned text is empty"

    reg = region or getattr(settings, "AZURE_SPEECH_REGION", "southeastasia") or "southeastasia"
    selected_rate = rate or getattr(settings, "TTS_RATE", "+0%")
    if not re.match(r"^[+-]\d+%$", str(selected_rate)):
        selected_rate = "+0%"

    parts = voice.split("-")
    lang = f"{parts[0]}-{parts[1]}" if len(parts) >= 2 else "vi-VN"

    escaped_text = escape_ssml_text(clean_text)
    ssml = (
        f"<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='{lang}'>"
        f"<voice name='{voice}'>"
        f"<prosody rate='{selected_rate}'>{escaped_text}</prosody>"
        f"</voice></speak>"
    )

    url = f"https://{reg}.tts.speech.microsoft.com/cognitiveservices/v1"
    headers = {
        "Ocp-Apim-Subscription-Key": str(key).strip(),
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "audio-16khz-128kbitrate-mono-mp3",
        "User-Agent": "HC-Robot-Concierge",
    }

    try:
        import httpx
        async with httpx.AsyncClient(timeout=float(timeout)) as client:
            resp = await client.post(url, headers=headers, content=ssml.encode("utf-8"))
            if resp.status_code == 200:
                audio_bytes = resp.content
                if audio_bytes and len(audio_bytes) > 100:
                    return base64.b64encode(audio_bytes).decode("utf-8"), None, None
                return None, "TTS_AUDIO_EMPTY", f"Azure Speech returned {len(audio_bytes)} bytes"
            error_detail = f"Azure Speech HTTP {resp.status_code}: {resp.text[:200]}"
            logger.warning(f"[TTSService] {error_detail}")
            return None, "AZURE_PROVIDER_ERROR", error_detail
    except asyncio.CancelledError:
        raise
    except Exception as e:
        if type(e).__name__ in ("TimeoutException", "ReadTimeout", "ConnectTimeout"):
            err_msg = f"Azure Speech timed out after {timeout:.1f}s (region={reg}, voice={voice})"
            logger.warning(f"[TTSService] {err_msg}")
            return None, "TTS_TIMEOUT", err_msg
        err_msg = f"Azure Speech exception: {type(e).__name__}: {e}"
        logger.warning(f"[TTSService] {err_msg}")
        return None, "TTS_PROVIDER_ERROR", err_msg


def common_warmup_phrases(target_vi: str, target_en: str):
    return [
        ("Dạ đợi em một tí nhé ạ.", "vi-VN", target_vi),
        ("Please wait a moment.", "en-US", target_en),
        ("Dạ đợi em một tí ạ.", "vi-VN", target_vi),
        ("Dạ vâng, em có thể hỗ trợ gì thêm cho quý khách ạ?", "vi-VN", target_vi),
        ("Quý khách có muốn em hỗ trợ gì thêm không ạ?", "vi-VN", target_vi),
        ("Would you like any further assistance?", "en-US", target_en),
        ("Dạ em có thể hỗ trợ thêm gì cho quý khách nữa không ạ?", "vi-VN", target_vi),
        ("Quý khách có cần em hỗ trợ thêm gì cho quý khách nữa không ạ?", "vi-VN", target_vi),
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
