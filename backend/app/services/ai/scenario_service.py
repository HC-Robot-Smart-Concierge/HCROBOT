"""Dialogue scenario service and in-memory fast-path cache."""

import logging
from typing import Any, Dict, List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.scenario import DialogueScenario
from app.services.ai.scenario_crud_mixin import ScenarioCrudMixin
from app.services.ai.scenario_matching_mixin import ScenarioMatchingMixin
from app.services.ai.scenario_seed_part1 import SEED_SCENARIOS_PART_1
from app.services.ai.scenario_seed_part2 import SEED_SCENARIOS_PART_2
from app.services.ai.scenario_seed_part3 import SEED_SCENARIOS_PART_3
from app.services.ai.scenario_seed_part4 import SEED_SCENARIOS_PART_4
from app.services.ai.scenario_seed_part5 import SEED_SCENARIOS_PART_5

logger = logging.getLogger(__name__)

# Danh muc kich ban mac dinh ban dau (Seed Scenarios)
DEFAULT_SEED_SCENARIOS: List[Dict[str, Any]] = [
    *SEED_SCENARIOS_PART_1,
    *SEED_SCENARIOS_PART_2,
    *SEED_SCENARIOS_PART_3,
    *SEED_SCENARIOS_PART_4,
    *SEED_SCENARIOS_PART_5,
]


class ScenarioService(ScenarioMatchingMixin, ScenarioCrudMixin):
    """
    Service quan ly kich ban hoi thoai dong va Fast-Path In-Memory Cache.
    Giup giam do tre ve < 1ms ma khong can hardcode cac chuoi van ban trong code Python.
    """

    def __init__(self):
        # In-Memory Cache de doi soat trong RAM (< 0.1ms)
        self._cache: List[Dict[str, Any]] = [dict(s) for s in DEFAULT_SEED_SCENARIOS]
        self._cache.sort(key=lambda x: x.get("priority", 0), reverse=True)
        self._is_initialized_from_db: bool = False

    def reload_cache_sync(self, scenarios_data: List[Dict[str, Any]]):
        """Cap nhat In-Memory Cache ngay lap tuc."""
        self._cache = scenarios_data
        self._cache.sort(key=lambda x: x.get("priority", 0), reverse=True)
        logger.info(f"[ScenarioService] Da cap nhat In-Memory Cache voi {len(self._cache)} kich ban.")

    async def initialize_cache(self, db: AsyncSession, force_reseed: bool = False):
        """

        Khởi tạo In-Memory Cache từ PostgreSQL.

        Chỉ tự động seed dữ liệu mẫu khi cơ sở dữ liệu trống hoàn toàn (0 records) hoặc khi force_reseed=True.

        Bảo lưu 100% mọi chỉnh sửa, tạo mới hoặc xóa kịch bản của Admin trong Database.

        """
        try:
            stmt = select(DialogueScenario)
            result = await db.execute(stmt)
            records = list(result.scalars().all())
            # NẾU DATABASE TRỐNG HOÀN TOÀN: MỚI TIẾN HÀNH SEED DỮ LIỆU BAN ĐẦU
            if len(records) == 0 or force_reseed:
                logger.info("[ScenarioService] Database kịch bản trống hoặc force_reseed. Tiến hành seed dữ liệu mẫu...")
                existing_map = {r.id: r for r in records}
                for s_data in DEFAULT_SEED_SCENARIOS:
                    sid = s_data["id"]
                    if sid not in existing_map:
                        item = DialogueScenario(
                            id=s_data["id"],
                            title=s_data["title"],
                            category=s_data["category"],
                            match_keywords=s_data["match_keywords"],
                            match_type=s_data["match_type"],
                            response_vi=s_data["response_vi"],
                            response_en=s_data.get("response_en"),
                            action_type=s_data.get("action_type", "none"),
                            action_payload=s_data.get("action_payload"),
                            is_fast_path=s_data.get("is_fast_path", True),
                            is_active=s_data.get("is_active", True),
                            priority=s_data.get("priority", 0),
                        )
                        db.add(item)
                await db.commit()
                result = await db.execute(select(DialogueScenario))
                records = list(result.scalars().all())
            # Đồng bộ và chuẩn hóa từ khóa các kịch bản mặc định nếu trong DB cũ còn chứa từ khóa bẫy
            who_are_you_keywords = [
                "bạn là ai", "ban la ai", "em là ai", "em la ai", "mày là ai", "may la ai",
                "rora là ai", "rora la ai", "robot là ai", "robot la ai",
                "who are you", "what is your name", "who is rora", "what are you",
                "tên bạn là gì", "ten ban la gi", "tên em là gì", "ten em la gi",
                "bạn tên gì", "ban ten gi", "em tên gì", "em ten gi",
                "giới thiệu bản thân", "gioi thieu ban than",
                "giới thiệu về bản thân", "gioi thieu ve ban than",
                "giới thiệu về bạn", "gioi thieu ve ban",
                "giới thiệu về em", "gioi thieu ve em",
                "giới thiệu về mình", "gioi thieu ve minh",
                "bạn giới thiệu bản thân được không", "ban gioi thieu ban than duoc khong",
                "bạn có thể giới thiệu bản thân", "ban co the gioi thieu ban than",
                "bạn có thể giới thiệu về bản thân", "ban co the gioi thieu ve ban than",
                "bạn có thể giới thiệu bản thân được không", "ban co the gioi thieu ban than duoc khong",
                "bạn có thể giới thiệu về bản thân được không", "ban co the gioi thieu ve ban than duoc khong",
                "tự giới thiệu", "tu gioi thieu", "giới thiệu rora", "gioi thieu rora",
                "introduce yourself", "tell me about yourself", "can you introduce yourself"
            ]
            records_by_id: Dict[Any, DialogueScenario] = {r.id: r for r in records}
            has_db_updates = False

            # B. Phân định quyền giữa Database và Code (System vs Custom Scenarios):

            # 1. Kịch bản hệ thống trong code chưa có trong DB -> Tự động nạp mới với is_system=True, is_custom_edited=False

            # 2. Kịch bản đã có trong DB nhưng CHƯA bị Admin sửa tay (is_custom_edited=False) -> Đồng bộ cập nhật từ code

            # 3. Kịch bản đã bị Admin chỉnh sửa tay (is_custom_edited=True) -> Tuyệt đối bảo tồn cấu hình Admin, KHÔNG ghi đè!
            for seed in DEFAULT_SEED_SCENARIOS:
                seed_id = seed["id"]
                existing = records_by_id.get(seed_id)
                if not existing:
                    new_item = DialogueScenario(
                        id=seed_id,
                        title=seed["title"],
                        category=seed.get("category", "service"),
                        match_keywords=seed.get("match_keywords", []),
                        match_type=seed.get("match_type", "keyword"),
                        response_vi=seed.get("response_vi", ""),
                        response_en=seed.get("response_en"),
                        action_type=seed.get("action_type", "none"),
                        action_payload=seed.get("action_payload"),
                        is_fast_path=seed.get("is_fast_path", True),
                        is_active=seed.get("is_active", True),
                        is_system=True,
                        is_custom_edited=False,
                        priority=seed.get("priority", 0),
                    )
                    db.add(new_item)
                    records.append(new_item)
                    records_by_id[seed_id] = new_item
                    has_db_updates = True
                else:
                    if not getattr(existing, "is_system", False):
                        existing.is_system = True
                        has_db_updates = True
                    # Admin đã tùy biến qua UI -> Giữ nguyên cấu hình của Admin
                    if getattr(existing, "is_custom_edited", False):
                        continue
                    # Kịch bản hệ thống chuẩn chưa bị sửa tay -> Đồng bộ định kỳ với SSOT trong code
                    needs_update = False
                    if existing.priority != seed.get("priority", 0):
                        existing.priority = seed.get("priority", 0)
                        needs_update = True
                    if existing.action_type != seed.get("action_type", "none"):
                        existing.action_type = seed.get("action_type", "none")
                        needs_update = True
                    if existing.action_payload != seed.get("action_payload"):
                        existing.action_payload = seed.get("action_payload")
                        needs_update = True
                    if set(existing.match_keywords or []) != set(seed.get("match_keywords") or []):
                        existing.match_keywords = seed.get("match_keywords", [])
                        needs_update = True
                    if existing.response_vi != seed.get("response_vi", ""):
                        existing.response_vi = seed.get("response_vi", "")
                        needs_update = True
                    if existing.response_en != seed.get("response_en"):
                        existing.response_en = seed.get("response_en")
                        needs_update = True
                    if needs_update:
                        has_db_updates = True
            # Dọn dẹp kịch bản scn-lost-keycard nếu còn kích hoạt
            for r in records:
                if r.id == "scn-lost-keycard" and (r.is_active or r.is_fast_path):
                    r.is_active = False
                    r.is_fast_path = False
                    has_db_updates = True
            if has_db_updates:
                try:
                    await db.commit()
                except Exception as e_commit:
                    logger.warning(f"[ScenarioService] Error committing synchronized scenarios to DB: {e_commit}")
            cache_list = []
            for r in records:
                if r.is_active and r.id != "scn-lost-keycard":
                    cache_list.append({
                        "id": r.id,
                        "title": r.title,
                        "category": r.category,
                        "match_keywords": r.match_keywords or [],
                        "match_type": r.match_type,
                        "response_vi": r.response_vi,
                        "response_en": r.response_en,
                        "action_type": r.action_type,
                        "action_payload": r.action_payload,
                        "is_fast_path": r.is_fast_path,
                        "is_active": r.is_active,
                        "is_system": getattr(r, "is_system", False),
                        "is_custom_edited": getattr(r, "is_custom_edited", False),
                        "priority": r.priority,
                    })
            self.reload_cache_sync(cache_list)
            self._is_initialized_from_db = True
            logger.info(f"[ScenarioService] Đồng bộ thành công {len(cache_list)} kịch bản từ Database vào RAM Cache.")
        except Exception as e:
            logger.warning(f"[ScenarioService Warning] Khong the doc kich ban tu DB: {e}. Su dung seed cache.")


# Singleton instance cho toan ung dung
scenario_service = ScenarioService()
