"""Choose one response language per turn, including code-switched VI/EN speech."""

import re
import unicodedata
from typing import Optional, Tuple


def language_pair(language: Optional[str]) -> Tuple[str, str]:
    return ("English", "en-US") if str(language or "").lower().startswith(("en", "english")) else ("Tiếng Việt", "vi-VN")


def _fold(text: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", text.lower().replace("đ", "d")) if unicodedata.category(c) != "Mn")


_VI_GRAMMAR = set("toi minh muon can giup cho xin vui long khong duoc voi cua quy khach chung chungtoi ban em anh chi nhe nhe a oi vang cam on chao dau nao bao nhieu lam sao phong".split())
_VI_SERVICES = set("sua dieu hoa don dep nuoc khan tam le tan hanh ly giat ui may lanh goi xe dat mon an sang hong khong mat bao tri phong dich vu".split())
_EN_GRAMMAR = set("i you we they my your our the is are was were do does can could would should please need want where what when why how have has me thank thanks hello".split())


def detect_turn_language(text: str, preferred_language: Optional[str] = None) -> Tuple[str, str]:
    """Grammar outweighs borrowed service names; ties/short neutral replies keep context.

    This is a deterministic routing policy, not a translation or a second STT pass.
    Never discard one language's words from the guest's request.
    """
    folded = _fold(text or "").strip()
    # Only explicit language commands override the input's dominant language.
    if re.fullmatch(r"(?:please )?(?:speak|use|switch to|respond in|talk to me in) (?:in )?english[.!?]*", folded) or re.fullmatch(r"(?:hay |vui long )?(?:noi|dung|chuyen sang|tra loi bang) (?:bang )?tieng anh(?: nhe| di)?[.!?]*", folded):
        return language_pair("en")
    if re.fullmatch(r"(?:please )?(?:speak|use|switch to|respond in|talk to me in) (?:in )?vietnamese[.!?]*", folded) or re.fullmatch(r"(?:hay |vui long )?(?:noi|dung|chuyen sang|tra loi bang) (?:bang )?tieng viet(?: nhe| di)?[.!?]*", folded):
        return language_pair("vi")
    original_words = re.findall(r"[^\W\d_]+", (text or "").lower())
    words = [_fold(word) for word in original_words]
    vi = sum(2 for word in words if word in _VI_GRAMMAR)
    en = sum(2 for raw, word in zip(original_words, words) if raw == word and word in _EN_GRAMMAR)
    # Accent marks in a place/person name alone must not turn an English sentence Vietnamese.
    vi += sum(1 for raw, word in zip(original_words, words) if raw != word and word in _VI_GRAMMAR)
    vi += sum(1 for word in words if word in _VI_SERVICES)
    if re.search(r"\b(cho toi|toi muon|toi can|giup toi|o dau|bao nhieu|cam on|xin chao)\b", folded):
        vi += 4
    if re.search(r"\b(can you|could you|i need|i want|i would like|where is|where are|how do|thank you)\b", folded):
        en += 4
    if abs(vi - en) <= 1:
        # A sentence containing only neutral loan words/numbers is intentionally ambiguous.
        return language_pair(preferred_language)
    return language_pair("en" if en > vi else "vi")


def select_turn_language(prompt: str, language: Optional[str], preferred_language: Optional[str] = None) -> Tuple[str, str]:
    if language and language.lower() not in ("auto", "bilingual", ""):
        return language_pair(language)
    return detect_turn_language(prompt, preferred_language)
