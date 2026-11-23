"""Invalidate answer caches after Knowledge edits without touching guest sessions."""

import os
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Optional
from uuid import uuid4

from app.core.config import settings


def _revision_path() -> Path:
    # Runtime data beside Chroma, shared by backend workers and excluded from Git.
    return Path(settings.resolved_chroma_dir) / "knowledge_revision.txt"


def get_knowledge_revision() -> Optional[str]:
    try:
        return _revision_path().read_text(encoding="utf-8").strip() or None
    except FileNotFoundError:
        # A new namespace also makes pre-language-filter cache entries obsolete.
        return "language-filter-v1"
    except OSError:
        # Fail closed: do not serve cached answers if freshness cannot be checked.
        return None


def invalidate_knowledge_answers() -> str:
    path = _revision_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    revision = uuid4().hex
    with NamedTemporaryFile(mode="w", encoding="utf-8", dir=path.parent, delete=False) as temp:
        temp.write(revision)
        temp_path = temp.name
    try:
        os.replace(temp_path, path)
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)
    return revision
