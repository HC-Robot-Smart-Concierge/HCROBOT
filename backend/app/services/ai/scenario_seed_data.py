"""Loader for default AI dialogue scenarios seed data."""

import json
from pathlib import Path
from typing import Any, Dict, List

from app.services.ai.constants import (
    FOOD_MENU_TRIGGER_KEYWORDS,
    MAINTENANCE_MENU_TRIGGER_KEYWORDS,
    ROOM_SERVICE_MENU_TRIGGER_KEYWORDS,
)

_KEYWORD_REFS: Dict[str, List[str]] = {
    "MAINTENANCE_MENU_TRIGGER_KEYWORDS": MAINTENANCE_MENU_TRIGGER_KEYWORDS,
    "ROOM_SERVICE_MENU_TRIGGER_KEYWORDS": ROOM_SERVICE_MENU_TRIGGER_KEYWORDS,
    "FOOD_MENU_TRIGGER_KEYWORDS": FOOD_MENU_TRIGGER_KEYWORDS,
}


def load_default_seed_scenarios() -> List[Dict[str, Any]]:
    """Load default fast-path scenarios from JSON and hydrate shared keyword lists."""
    data_path = Path(__file__).resolve().parent / "data" / "default_seed_scenarios.json"
    with data_path.open("r", encoding="utf-8") as f:
        raw_scenarios = json.load(f)

    hydrated: List[Dict[str, Any]] = []
    for raw in raw_scenarios:
        item: Dict[str, Any] = {}
        for key, val in raw.items():
            if key == "match_keywords_ref":
                item["match_keywords"] = list(_KEYWORD_REFS[val])
            else:
                item[key] = val
        hydrated.append(item)
    return hydrated


DEFAULT_SEED_SCENARIOS: List[Dict[str, Any]] = load_default_seed_scenarios()
