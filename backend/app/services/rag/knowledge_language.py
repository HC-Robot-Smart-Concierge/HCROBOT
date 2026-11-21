"""Language labels shared by the Knowledge editor, indexing and retrieval."""

import re
import unicodedata
from typing import Any, Dict, Optional


def normalize_knowledge_language(language: Optional[str]) -> Optional[str]:
    value = str(language or "").strip().lower().replace("_", "-")
    if value in ("vi", "vn", "vietnamese", "tiếng việt", "tieng viet") or value.startswith("vi-"):
        return "vi"
    if value in ("en", "english", "tiếng anh", "tieng anh") or value.startswith("en-"):
        return "en"
    return None


def document_language(filename: str, metadata: Dict[str, Any], content: str = "") -> str:
    explicit = normalize_knowledge_language(metadata.get("language"))
    if explicit:
        return explicit
    stem = str(filename or "").lower().replace("\\", "/").rsplit("/", 1)[-1].rsplit(".", 1)[0]
    if re.search(r"(?:^|[_-])vi$", stem):
        return "vi"
    if re.search(r"(?:^|[_-])(?:en|rag)$", stem):
        return "en"
    sample = unicodedata.normalize("NFC", content or "").lower()
    vi_chars = set("àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ")
    return "vi" if any(char in vi_chars for char in sample) else "en"
