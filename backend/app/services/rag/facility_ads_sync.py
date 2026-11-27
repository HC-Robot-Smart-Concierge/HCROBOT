"""Synchronize facility-linked advertisements (bilingual VI/EN) with RAG knowledge vault files."""

import logging
import os
import re
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.advertisement import Advertisement
from app.services.cache.knowledge_revision import invalidate_knowledge_answers

logger = logging.getLogger(__name__)

_START_MARKER = "<!-- FACILITY_ADS_SYNC_START -->"
_END_MARKER = "<!-- FACILITY_ADS_SYNC_END -->"

HOTEL_FACILITIES_CATALOG: Dict[str, Dict[str, str]] = {
    "sky_bar": {
        "name_vi": "Sky Lounge Bar",
        "name_en": "Sky Lounge Bar",
        "floor_vi": "Tầng 6, mở cửa từ 16 giờ 30 đến 1 giờ sáng",
        "floor_en": "6th Floor (16:30 - 01:00 AM)",
    },
    "rooftop_coffee": {
        "name_vi": "Rooftop Coffee & View",
        "name_en": "Rooftop Coffee with City View",
        "floor_vi": "Tầng 6, mở cửa từ 7 giờ đến 23 giờ",
        "floor_en": "6th Floor (07:00 - 23:00)",
    },
    "spa": {
        "name_vi": "Thảo Mộc Spa & Massage",
        "name_en": "Thao Moc Herbal Spa & Massage",
        "floor_vi": "Tầng 5, mở cửa từ 9 giờ đến 22 giờ",
        "floor_en": "5th Floor (09:00 - 22:00)",
    },
    "infinity_pool": {
        "name_vi": "Hồ Bơi Vô Cực",
        "name_en": "Infinity Swimming Pool",
        "floor_vi": "Tầng 5, mở cửa từ 6 giờ đến 22 giờ",
        "floor_en": "5th Floor (06:00 - 22:00)",
    },
    "gym": {
        "name_vi": "Phòng Tập Gym",
        "name_en": "24/7 Fitness & Gym Center",
        "floor_vi": "Tầng 5, mở cửa 24 giờ mỗi ngày",
        "floor_en": "5th Floor (Open 24/7)",
    },
    "karaoke": {
        "name_vi": "Phòng VIP Karaoke",
        "name_en": "VIP Karaoke Rooms",
        "floor_vi": "Tầng 6, mở cửa từ 14 giờ đến 0 giờ đêm",
        "floor_en": "6th Floor (14:00 - 00:00)",
    },
    "gift_shop": {
        "name_vi": "Cửa Hàng Lưu Niệm",
        "name_en": "Aurora Gift Shop",
        "floor_vi": "Tầng 6, mở cửa từ 8 giờ đến 22 giờ",
        "floor_en": "6th Floor (08:00 - 22:00)",
    },
    "room_service": {
        "name_vi": "Ẩm Thực Tận Phòng",
        "name_en": "24/7 In-Room Dining",
        "floor_vi": "Phục vụ 24 giờ mỗi ngày tại phòng",
        "floor_en": "24/7 In-Room Service",
    },
}

_FACILITY_QUERY_KEYWORDS: Dict[str, List[str]] = {
    "sky_bar": ["sky bar", "sky lounge", "quầy bar", "quay bar", "bar", "bia", "rượu", "ruou", "cocktail", "mocktail", "beer", "wine", "happy hour", "đồ uống có cồn"],
    "rooftop_coffee": ["rooftop coffee", "cà phê", "ca phe", "cafe", "coffee", "trà", "bánh ngọt", "pastry"],
    "spa": ["spa", "thảo mộc", "thao moc", "massage", "mát xa", "xông hơi", "xong hoi", "trị liệu", "tri lieu"],
    "infinity_pool": ["hồ bơi", "ho boi", "bể bơi", "be boi", "pool", "swimming"],
    "gym": ["gym", "fitness", "tập thể hình", "tap the hinh"],
    "karaoke": ["karaoke", "hát", "hat"],
    "gift_shop": ["lưu niệm", "luu niem", "gift shop", "souvenir", "quà tặng"],
}

_DETAIL_INTENT_KEYWORDS = [
    "có gì", "co gi", "gồm gì", "gom gi", "những gì", "nhung gi", "món gì", "mon gi",
    "bia", "rượu", "ruou", "cocktail", "đồ uống", "do uong", "uống gì", "uong gi",
    "khuyến mãi", "khuyen mai", "ưu đãi", "uu dai", "giảm giá", "giam gia",
    "quảng cáo", "quang cao", "dịch vụ gì", "dich vu gi", "chi tiết", "chi tiet",
    "menu", "giá", "gia", "happy hour", "what", "drink", "drinks", "beer", "wine",
    "offer", "offers", "promo", "promotion", "discount", "serve", "special",
]

_ACTIVE_FACILITY_ADS_CACHE: List[Dict[str, Any]] = []


def set_facility_ads_cache(ads: List[Any]) -> None:
    """Refresh in-memory facility ads cache used by Fast-Path."""
    global _ACTIVE_FACILITY_ADS_CACHE
    cached: List[Dict[str, Any]] = []
    for ad in ads:
        if not getattr(ad, "is_active", True):
            continue
        cached.append({
            "id": getattr(ad, "id", ""),
            "title": getattr(ad, "title", "") or "",
            "title_en": getattr(ad, "title_en", None) or "",
            "description": getattr(ad, "description", None) or "",
            "description_en": getattr(ad, "description_en", None) or "",
            "facility_key": getattr(ad, "facility_key", None) or "",
            "media_type": getattr(ad, "media_type", None) or "IMAGE",
            "media_url": getattr(ad, "media_url", None) or "",
            "thumbnail_url": getattr(ad, "thumbnail_url", None) or "",
        })
    _ACTIVE_FACILITY_ADS_CACHE = cached


def match_facility_ads_fast_path(
    prompt: str, lang_code: str = "vi-VN"
) -> Optional[Tuple[str, str, str, Optional[str], Optional[Dict[str, Any]]]]:
    """Return <1ms Fast-Path answer from synced facility ads when guest asks about offerings/promotions."""
    if not prompt or not _ACTIVE_FACILITY_ADS_CACHE:
        return None
    p_lower = prompt.lower().strip()
    is_direction_query = any(
        kw in p_lower
        for kw in [
            "ở đâu", "o dau", "chỉ đường", "chi duong", "dẫn đường", "dan duong",
            "đường đi", "duong di", "đường đến", "duong den", "lối đi", "loi di",
            "tầng mấy", "tang may", "where is", "where's", "directions", "way to",
        ]
    )
    if is_direction_query:
        return None
    if not any(kw in p_lower for kw in _DETAIL_INTENT_KEYWORDS):
        return None

    matched_fac_key = None
    for fac_key, kws in _FACILITY_QUERY_KEYWORDS.items():
        if any(re.search(rf"(?<!\w){re.escape(k)}(?!\w)", p_lower) for k in kws):
            matched_fac_key = fac_key
            break
    if not matched_fac_key:
        return None

    matching_ads = [ad for ad in _ACTIVE_FACILITY_ADS_CACHE if ad.get("facility_key") == matched_fac_key]
    if not matching_ads:
        return None

    is_en = lang_code == "en-US"
    lang_name = "English" if is_en else "Tiếng Việt"
    fac = HOTEL_FACILITIES_CATALOG.get(matched_fac_key, {})
    fac_name = fac.get("name_en" if is_en else "name_vi") or matched_fac_key
    floor_info = fac.get("floor_en" if is_en else "floor_vi") or ""

    parts: List[str] = []
    seen_time_note = False
    for ad in matching_ads[:2]:
        t = (ad["title_en"] or ad["title"]) if is_en else ad["title"]
        d = (ad["description_en"] or ad["description"]) if is_en else ad["description"]
        if d:
            if seen_time_note:
                d = re.sub(
                    r",?\s*(?:tại\s+[^.,]*?Tầng\s*\d+[^.,]*|từ\s+\d{1,2}\s+giờ[^.,]*|on\s+the\s+\d+(?:st|nd|rd|th)\s+Floor[^.,]*|\(\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}[^)]*\))",
                    "",
                    d,
                    flags=re.IGNORECASE,
                ).strip(" ,.")
                if d and not d.endswith("."):
                    d += "."
            if re.search(r"(?:giờ|\d{1,2}:\d{2}|24/7)", d, re.IGNORECASE):
                seen_time_note = True
        segment = f"{t}. {d}".strip() if d else t
        if segment:
            parts.append(segment)

    if not parts:
        return None

    details_text = " ".join(parts)
    has_hours_in_details = bool(re.search(r"(?:giờ|\d{1,2}:\d{2}|24/7)", details_text, re.IGNORECASE))
    loc_suffix = "" if (has_hours_in_details or not floor_info) else f" ({floor_info})"
    if is_en:
        reply = f"At {fac_name}{loc_suffix}, we currently feature: {details_text}"
    else:
        reply = f"Dạ tại {fac_name}{loc_suffix} hiện đang có: {details_text}"

    primary_ad = matching_ads[0]
    ad_payload = (
        {
            "id": primary_ad["id"],
            "title": primary_ad["title"],
            "title_en": primary_ad["title_en"],
            "description": primary_ad["description"],
            "description_en": primary_ad["description_en"],
            "facility_key": matched_fac_key,
            "media_type": primary_ad.get("media_type") or "IMAGE",
            "media_url": primary_ad.get("media_url") or "",
            "thumbnail_url": primary_ad.get("thumbnail_url") or "",
        }
        if primary_ad.get("media_url")
        else None
    )
    return reply, lang_name, lang_code, "conversation", {
        "eye_expression": "happy",
        "facility_key": matched_fac_key,
        "advertisement": ad_payload,
    }


def _upsert_marked_section(file_path: str, section_body: str) -> bool:
    if not os.path.exists(file_path):
        return False
    with open(file_path, "r", encoding="utf-8", errors="replace") as f:
        original = f.read()

    block = f"{_START_MARKER}\n{section_body.strip()}\n{_END_MARKER}"
    pattern = re.compile(
        rf"{re.escape(_START_MARKER)}.*?{re.escape(_END_MARKER)}",
        re.DOTALL,
    )
    if pattern.search(original):
        updated = pattern.sub(block, original)
    else:
        updated = original.rstrip() + "\n\n---\n\n" + block + "\n"

    if updated != original:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(updated)
        return True
    return False


def build_facility_ads_markdown(ads: List[Advertisement], lang: str = "vi") -> str:
    """Build bilingual markdown section summarizing active facility promotions for RAG."""
    is_en = lang == "en"
    heading = (
        "## 13. Featured Facility Promotions & Detailed Offerings (Synced from Admin)"
        if is_en
        else "## 13. Quảng Cáo & Chi Tiết Dịch Vụ Cơ Sở Vật Chất Nổi Bật (Đồng Bộ Từ Admin)"
    )
    lines = [heading, ""]

    active_ads = [ad for ad in ads if getattr(ad, "is_active", True)]
    if not active_ads:
        lines.append(
            "- No active facility promotions are currently scheduled."
            if is_en
            else "- Hiện chưa có chương trình quảng cáo dịch vụ cơ sở vật chất nào đang bật."
        )
        return "\n".join(lines)

    for ad in active_ads:
        fac = HOTEL_FACILITIES_CATALOG.get(ad.facility_key or "", {})
        fac_name = fac.get("name_en" if is_en else "name_vi") or (
            "General Hotel Service" if is_en else "Dịch vụ chung khách sạn"
        )
        floor_info = fac.get("floor_en" if is_en else "floor_vi") or ""
        title = (ad.title_en or ad.title) if is_en else ad.title
        desc = (ad.description_en or ad.description or "") if is_en else (ad.description or "")

        loc_part = f" ({floor_info})" if floor_info else ""
        lines.append(f"- **{fac_name}{loc_part} — {title}:**")
        if desc.strip():
            lines.append(f"  - {'Details' if is_en else 'Chi tiết'}: {desc.strip()}")
        if ad.target_gender != "ALL" or ad.target_age_group != "ALL":
            lines.append(
                f"  - {'Target Audience' if is_en else 'Đối tượng gợi ý'}: "
                f"gender={ad.target_gender}, age_group={ad.target_age_group}"
            )

    return "\n".join(lines)


async def sync_facility_ads_to_rag(
    db: AsyncSession, vault_dir: Optional[str] = None
) -> Dict[str, Any]:
    """Query active advertisements and sync bilingual sections to RAG markdown files."""
    stmt = (
        select(Advertisement)
        .where(Advertisement.is_active == True)
        .order_by(desc(Advertisement.priority), desc(Advertisement.created_at))
    )
    result = await db.execute(stmt)
    ads = list(result.scalars().all())
    set_facility_ads_cache(ads)

    base_dir = vault_dir or getattr(
        settings, "resolved_obsidian_vault_dir", settings.OBSIDIAN_VAULT_DIR
    )
    vi_path = os.path.join(base_dir, "hotel_facilities_floor_layout_vi.md")
    en_path = os.path.join(base_dir, "hotel_facilities_floor_layout_rag.md")

    vi_changed = _upsert_marked_section(vi_path, build_facility_ads_markdown(ads, "vi"))
    en_changed = _upsert_marked_section(en_path, build_facility_ads_markdown(ads, "en"))

    if vi_changed or en_changed:
        invalidate_knowledge_answers()
        logger.info(
            "[FacilityAdsSync] Synced %d active ads to RAG vault (vi=%s, en=%s)",
            len(ads),
            vi_changed,
            en_changed,
        )

    return {"active_ads_count": len(ads), "vi_updated": vi_changed, "en_updated": en_changed}


async def seed_default_facility_ads_if_empty(db: AsyncSession) -> int:
    """Seed starter bilingual facility ads (e.g. Sky Lounge Bar beers/wines, Spa) when empty."""
    existing = await db.execute(select(Advertisement.id).limit(1))
    if existing.first() is not None:
        return 0

    starter_ads = [
        Advertisement(
            id="AD-SKYBAR01",
            title="Sky Lounge Bar — Bia Thủ Công & Rượu Vang Nhập Khẩu",
            title_en="Sky Lounge Bar — Craft Beers & Imported Fine Wines",
            description=(
                "Thưởng thức bia thủ công 7 Bridges IPA, Pasteur Street Jasmine IPA, "
                "rượu vang đỏ Chile Montes Alpha Cabernet Sauvignon, vang trắng Pháp Chablis "
                "cùng cocktail đặc trưng tại Tầng 6 (16:30 - 01:00). Giảm 20% khung giờ Happy Hour 17:00 - 19:00."
            ),
            description_en=(
                "Enjoy 7 Bridges IPA & Pasteur Street Jasmine craft beers, "
                "Chilean Montes Alpha Cabernet Sauvignon red wine, French Chablis white wine, "
                "and signature cocktails on the 6th Floor (16:30 - 01:00 AM). 20% off during Happy Hour 17:00 - 19:00."
            ),
            facility_key="sky_bar",
            target_gender="ALL",
            target_age_group="young_adult",
            media_type="IMAGE",
            media_url="/images/robot/standby-poster.jpg",
            thumbnail_url="/images/robot/standby-poster.jpg",
            storage_provider="local",
            duration_seconds=12,
            priority=9,
            is_active=True,
            display_location="ALL",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        ),
        Advertisement(
            id="AD-SPA00001",
            title="Thảo Mộc Spa — Trị Liệu Đá Nóng & Giảm 15% Khách Lưu Trú",
            title_en="Thao Moc Herbal Spa — Hot Stone Therapy (15% In-House Discount)",
            description=(
                "Trải nghiệm xông hơi đá muối Himalaya, massage body đá nóng 90 phút và "
                "chăm sóc da mặt thảo dược tại Tầng 5 (09:00 - 22:00). Ưu đãi giảm 15% cho khách đang lưu trú."
            ),
            description_en=(
                "Experience Himalayan salt sauna, 90-minute hot stone body massage, and "
                "herbal facial therapy on the 5th Floor (09:00 - 22:00). Exclusive 15% discount for staying guests."
            ),
            facility_key="spa",
            target_gender="female",
            target_age_group="ALL",
            media_type="IMAGE",
            media_url="/images/robot/standby-poster.jpg",
            thumbnail_url="/images/robot/standby-poster.jpg",
            storage_provider="local",
            duration_seconds=12,
            priority=8,
            is_active=True,
            display_location="ALL",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        ),
    ]
    db.add_all(starter_ads)
    await db.commit()
    logger.info("[FacilityAdsSync] Seeded %d starter bilingual facility ads.", len(starter_ads))
    return len(starter_ads)
