"""Service extracting structured hotel facilities and facts directly from the Markdown Knowledge Vault."""

import logging
import os
import re
from typing import Any, Dict, List, Optional, Tuple

from app.core.config import settings

logger = logging.getLogger(__name__)

_FACILITY_CACHE: Dict[str, Tuple[float, Dict[str, Any]]] = {}

# Map facility keywords (lowercase, diacritic-tolerant substrings) -> FloorMap key, icon_key, category, menu flag
_FACILITY_RULES: List[Dict[str, Any]] = [
    {
        "tokens": ["hồ bơi", "ho boi", "infinity pool", "swimming pool"],
        "key": "infinity_pool",
        "icon_key": "waves",
        "cat_vi": "Thư giãn",
        "cat_en": "Wellness",
        "has_menu_action": False,
        "navigable": True,
    },
    {
        "tokens": ["thay đồ", "locker", "tủ đồ", "showers"],
        "key": "infinity_pool",
        "icon_key": "sparkles",
        "cat_vi": "Thư giãn",
        "cat_en": "Wellness",
        "has_menu_action": False,
        "navigable": True,
    },
    {
        "tokens": ["spa", "massage", "thảo mộc"],
        "key": "spa",
        "icon_key": "sparkles",
        "cat_vi": "Thư giãn",
        "cat_en": "Wellness",
        "has_menu_action": False,
        "navigable": True,
    },
    {
        "tokens": ["gym", "fitness", "thể hình"],
        "key": "gym",
        "icon_key": "dumbbell",
        "cat_vi": "Thể thao",
        "cat_en": "Fitness",
        "has_menu_action": False,
        "navigable": True,
    },
    {
        "tokens": ["bếp trung tâm", "central culinary", "room service", "gọi món tận phòng", "ẩm thực", "nhà hàng"],
        "key": "restaurant",
        "icon_key": "utensils",
        "cat_vi": "Ẩm thực",
        "cat_en": "Dining",
        "has_menu_action": True,
        "navigable": True,
    },
    {
        "tokens": ["rooftop coffee", "cafe", "cà phê"],
        "key": "rooftop_coffee",
        "icon_key": "coffee",
        "cat_vi": "Ẩm thực",
        "cat_en": "Dining",
        "has_menu_action": False,
        "navigable": True,
    },
    {
        "tokens": ["sky lounge", "lounge bar", "quầy bar"],
        "key": "bar",
        "icon_key": "wine",
        "cat_vi": "Giải trí",
        "cat_en": "Entertainment",
        "has_menu_action": False,
        "navigable": True,
    },
    {
        "tokens": ["karaoke"],
        "key": "karaoke",
        "icon_key": "mic",
        "cat_vi": "Giải trí",
        "cat_en": "Entertainment",
        "has_menu_action": False,
        "navigable": True,
    },
    {
        "tokens": ["lưu niệm", "gift shop"],
        "key": "gift_shop",
        "icon_key": "shopping-bag",
        "cat_vi": "Dịch vụ",
        "cat_en": "Services",
        "has_menu_action": False,
        "navigable": True,
    },
    {
        "tokens": ["lễ tân", "sảnh chính", "front desk", "reception", "main lobby"],
        "key": "front_desk",
        "icon_key": "bell",
        "cat_vi": "Dịch vụ",
        "cat_en": "Services",
        "has_menu_action": False,
        "navigable": True,
    },
    {
        "tokens": ["ô tô", "car parking", "b2"],
        "key": "parking_car",
        "icon_key": "car",
        "cat_vi": "Dịch vụ",
        "cat_en": "Services",
        "has_menu_action": False,
        "navigable": True,
    },
    {
        "tokens": ["xe máy", "xe đạp", "motorbike", "bike parking", "b1"],
        "key": "parking_bike",
        "icon_key": "car",
        "cat_vi": "Dịch vụ",
        "cat_en": "Services",
        "has_menu_action": False,
        "navigable": True,
    },
]

_GUEST_ROOM_ROW_PATTERN = re.compile(
    r"(phòng nghỉ|guest rooms?|deluxe guest rooms|standard guest rooms|\b301\s*[-–]\s*310\b|\b401\s*[-–]\s*410\b)",
    re.IGNORECASE,
)


def _strip_md(text: str) -> str:
    if not text:
        return ""
    cleaned = re.sub(r"\*\*(.*?)\*\*", r"\1", text)
    cleaned = re.sub(r"`([^`]*)`", r"\1", cleaned)
    return re.sub(r"\s+", " ", cleaned).strip()


def _resolve_vault_file(lang: str = "vi", vault_dir: Optional[str] = None) -> Tuple[Optional[str], str]:
    target_dir = vault_dir or getattr(settings, "resolved_obsidian_vault_dir", settings.OBSIDIAN_VAULT_DIR)
    abs_dir = os.path.abspath(target_dir)
    is_en = (lang or "vi").lower().startswith("en")
    candidates = (
        ["hotel_facilities_floor_layout_rag.md", "hotel_facilities_floor_layout_vi.md"]
        if is_en
        else ["hotel_facilities_floor_layout_vi.md", "hotel_facilities_floor_layout_rag.md"]
    )
    for fname in candidates:
        fpath = os.path.join(abs_dir, fname)
        if os.path.isfile(fpath):
            return fpath, fname
    return None, candidates[0]


def _classify_facility(name: str, floor_level: str, is_en: bool) -> Dict[str, Any]:
    haystack = f"{name} {floor_level}".lower()
    for rule in _FACILITY_RULES:
        if any(tok in haystack for tok in rule["tokens"]):
            return {
                "key": rule["key"],
                "icon_key": rule["icon_key"],
                "category": rule["cat_en"] if is_en else rule["cat_vi"],
                "has_menu_action": rule["has_menu_action"],
                "navigable": rule["navigable"],
            }
    slug = re.sub(r"[^a-z0-9]+", "_", haystack).strip("_") or "facility"
    return {
        "key": slug,
        "icon_key": "building",
        "category": "Services" if is_en else "Dịch vụ",
        "has_menu_action": False,
        "navigable": False,
    }


def _parse_detail_blocks(raw_markdown: str) -> List[Dict[str, Any]]:
    """Parse `- **Heading:**` facility bullet blocks from floor sections in the KB markdown."""
    blocks: List[Dict[str, Any]] = []
    current_block: Optional[Dict[str, Any]] = None
    current_section_nav: str = ""

    for line in raw_markdown.splitlines():
        stripped = line.strip()
        if re.match(r"^##\s+\d+\.", stripped):
            current_block = None
            current_section_nav = ""
            continue
        if re.match(r"^###\s+(chỉ dẫn|navigation)", stripped, re.IGNORECASE):
            current_block = None
            continue
        if stripped.startswith("- ") and not line.startswith("  ") and not line.startswith("\t"):
            m = re.match(r"^-\s+\*\*(.+?)(?::)?\*\*:?\s*(.*)$", stripped)
            if m:
                title = _strip_md(m.group(1)).rstrip(":")
                inline_val = _strip_md(m.group(2))
                current_block = {
                    "title": title,
                    "title_lower": title.lower(),
                    "lines": [inline_val] if inline_val else [],
                    "attrs": {},
                    "section_nav": current_section_nav,
                }
                blocks.append(current_block)
                continue
        if (line.startswith("  -") or line.startswith("\t-")) and current_block is not None:
            sub = line.strip()[1:].strip()
            m_sub = re.match(r"^\*\*(.+?)(?::)?\*\*:?\s*(.*)$", sub)
            if m_sub:
                k = _strip_md(m_sub.group(1)).rstrip(":")
                v = _strip_md(m_sub.group(2))
                current_block["attrs"][k.lower()] = v
                current_block["lines"].append(f"{k}: {v}" if v else k)
            else:
                clean_sub = _strip_md(sub)
                if clean_sub:
                    current_block["lines"].append(clean_sub)
    return blocks


def _match_detail_block(name: str, blocks: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    name_low = name.lower()
    best_block: Optional[Dict[str, Any]] = None
    best_score = 0

    name_tokens = [t for t in re.findall(r"[\w]+", name_low, flags=re.UNICODE) if len(t) >= 3]
    for block in blocks:
        title_low = block["title_lower"]
        if name_low in title_low or title_low in name_low:
            return block
        score = sum(1 for tok in name_tokens if tok in title_low)
        if score > best_score:
            best_score = score
            best_block = block
    return best_block if best_score >= 1 else None


def _parse_master_table_rows(raw_markdown: str) -> List[Dict[str, str]]:
    rows: List[Dict[str, str]] = []
    in_table = False

    for line in raw_markdown.splitlines():
        s = line.strip()
        if s.startswith("## 10."):
            in_table = True
            continue
        if in_table and s.startswith("## "):
            break
        if not in_table or not s.startswith("|"):
            continue
        if re.match(r"^\|\s*[-:]+", s):
            continue

        cells = [_strip_md(c) for c in s.strip("|").split("|")]
        if len(cells) < 3:
            continue
        header_low = cells[0].lower()
        if header_low in ("tầng", "floor", "tầng / khu vực"):
            continue

        floor_level = cells[0]
        name = cells[1]
        hours = cells[2] if len(cells) > 2 else ""
        pricing = cells[3] if len(cells) > 3 else ""
        transit = cells[4] if len(cells) > 4 else ""

        if _GUEST_ROOM_ROW_PATTERN.search(name):
            continue

        rows.append(
            {
                "floor_level": floor_level,
                "name": name,
                "hours": hours,
                "pricing": pricing,
                "transit": transit,
            }
        )
    return rows


def _build_facility_item(row: Dict[str, str], block: Optional[Dict[str, Any]], is_en: bool, source_file: str) -> Dict[str, Any]:
    name = row["name"]
    floor_level = row["floor_level"].upper() if not is_en else row["floor_level"]
    hours = row["hours"]
    pricing = row["pricing"]
    transit = row["transit"]

    meta = _classify_facility(name, floor_level, is_en)
    attrs = block.get("attrs", {}) if block else {}
    lines = block.get("lines", []) if block else []

    highlights: List[str] = []
    for k, v in attrs.items():
        if any(skip in k for skip in ("vị trí", "location", "thời gian", "operating hours", "giờ", "chi phí", "pricing", "cách di chuyển", "navigation")):
            continue
        if v:
            highlights.append(v)

    if not highlights:
        if pricing:
            highlights.append(pricing)
        if hours:
            highlights.append(f"{'Operating hours' if is_en else 'Giờ phục vụ'}: {hours}")
        if transit:
            highlights.append(transit)

    is_kitchen_room_service = meta["key"] == "restaurant"
    if is_kitchen_room_service:
        if is_en:
            summary = (
                "Aurora Grand Hotel does not operate a walk-in restaurant or breakfast buffet. "
                "Instead, all meals and beverages are prepared fresh in the Level 2 Central Kitchen and "
                "delivered directly to guest rooms 24/7 via Room Service."
            )
            desc = "No on-site restaurant/buffet — 24/7 In-Room Dining (Room Service) delivered straight to your room."
            if not transit:
                transit = "Browse the digital food menu on the robot/room screen or scan the in-room QR code to order 24/7."
        else:
            summary = (
                "Khách sạn Aurora Grand hiện không có nhà hàng ăn tại chỗ và không phục vụ buffet sáng. "
                "Thay vào đó, khách sạn phục vụ ẩm thực gọi món tận phòng 24/7 (Room Service), "
                "chế biến tại Bếp Trung Tâm Tầng 2 và giao trực tiếp lên phòng."
            )
            desc = "Không có nhà hàng/buffet tại chỗ — phục vụ gọi món tận phòng 24/7 (Room Service)."
            if not transit:
                transit = "Quý khách xem thực đơn điện tử trên màn hình robot hoặc quét mã QR tại phòng để đặt món 24/7 (khu bếp Tầng 2 là khu vực nội bộ Staff Only)."
    else:
        desc_parts = [p for p in [pricing, transit] if p]
        desc = " · ".join(desc_parts) if desc_parts else f"{floor_level} · {hours}"
        if lines:
            detail_snippet = "; ".join(lines[:3])
            summary = (
                f"{name} is located at {floor_level} ({hours}). {detail_snippet}."
                if is_en
                else f"{name} nằm tại {row['floor_level']} ({hours}). {detail_snippet}."
            )
        else:
            summary = (
                f"{name} is located at {floor_level}, open {hours}. {pricing}. {transit}".strip()
                if is_en
                else f"{name} tọa lạc tại {row['floor_level']}, hoạt động {hours}. {pricing}. {transit}".strip()
            )

    kb_context_lines = [
        f"{name} ({row['floor_level']})",
        f"- {'Hours' if is_en else 'Giờ hoạt động'}: {hours}",
        f"- {'Pricing/Policy' if is_en else 'Chi phí / Chính sách'}: {pricing}",
        f"- {'Directions' if is_en else 'Hướng dẫn di chuyển'}: {transit}" if transit else "",
        *[f"- {ln}" for ln in lines[:4]],
    ]
    kb_context = "\n".join(line for line in kb_context_lines if line)

    return {
        "key": meta["key"],
        "name": name,
        "floor_level": floor_level,
        "category": meta["category"],
        "icon_key": meta["icon_key"],
        "hours": hours,
        "desc": desc,
        "has_menu_action": meta["has_menu_action"],
        "navigable": meta["navigable"],
        "source_file": source_file,
        "kb_context": kb_context,
        "knowledge": {
            "pricing": pricing or ("Hotel standard" if is_en else "Tiêu chuẩn khách sạn"),
            "summary": summary,
            "highlights": highlights[:3],
            "transit_hint": transit or (f"Take Elevator A to {row['floor_level']}." if is_en else f"Đi Thang máy A tới {row['floor_level']}."),
        },
    }


def get_facilities_from_kb(lang: str = "vi", vault_dir: Optional[str] = None) -> Dict[str, Any]:
    """Load and parse hotel facilities directly from the Markdown Knowledge Vault (cached by file mtime)."""
    is_en = (lang or "vi").lower().startswith("en")
    fpath, fname = _resolve_vault_file(lang=lang, vault_dir=vault_dir)
    if not fpath:
        return {
            "total": 0,
            "source_file": fname,
            "language": "en" if is_en else "vi",
            "categories": ["All"] if is_en else ["Tất cả"],
            "facilities": [],
        }

    mtime = os.path.getmtime(fpath)
    cache_key = f"{fpath}:{is_en}"
    cached = _FACILITY_CACHE.get(cache_key)
    if cached and cached[0] == mtime:
        return cached[1]

    with open(fpath, "r", encoding="utf-8", errors="replace") as f:
        raw_md = f.read()

    rows = _parse_master_table_rows(raw_md)
    blocks = _parse_detail_blocks(raw_md)

    facilities: List[Dict[str, Any]] = []
    seen_categories: List[str] = ["All"] if is_en else ["Tất cả"]

    for row in rows:
        block = _match_detail_block(row["name"], blocks)
        item = _build_facility_item(row, block, is_en=is_en, source_file=fname)
        facilities.append(item)
        if item["category"] not in seen_categories:
            seen_categories.append(item["category"])

    result = {
        "total": len(facilities),
        "source_file": fname,
        "language": "en" if is_en else "vi",
        "categories": seen_categories,
        "facilities": facilities,
    }
    _FACILITY_CACHE[cache_key] = (mtime, result)
    return result


def get_kb_facts_prompt(lang_code: str = "vi-VN", vault_dir: Optional[str] = None) -> str:
    """Build concise, authoritative hotel facts from the Markdown Knowledge Base for LLM system prompts."""
    is_en = lang_code == "en-US"
    try:
        data = get_facilities_from_kb(lang="en" if is_en else "vi", vault_dir=vault_dir)
    except Exception as exc:
        logger.warning(f"[FacilitiesKB] Failed to load KB facts: {exc}")
        return ""

    facilities = data.get("facilities") or []
    if not facilities:
        return ""

    lines = [
        "AUTHORITATIVE HOTEL KNOWLEDGE BASE (FROM MARKDOWN VAULT):"
        if is_en
        else "DỮ LIỆU TRI THỨC CHÍNH THỨC TỪ KNOWLEDGE BASE (.MD):"
    ]
    for fac in facilities:
        lines.append(
            f"- {fac['name']} ({fac['floor_level']}): {fac['hours']} | {fac['knowledge']['pricing']} | {fac['knowledge']['transit_hint']}"
        )
    return "\n".join(lines)

