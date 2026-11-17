import datetime
import logging
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.scenario import DialogueScenario
from app.schemas.scenario import DialogueScenarioCreate, DialogueScenarioUpdate
from app.services.ai.scenario_matcher import (
    format_hotel_facts_prompt,
    match_fast_path_scenarios,
)
from app.services.ai.scenario_seed_data import DEFAULT_SEED_SCENARIOS

logger = logging.getLogger(__name__)


def _scenario_to_cache_dict(record: DialogueScenario, include_flags: bool = True) -> Dict[str, Any]:
    """Convert DialogueScenario ORM model to RAM cache dictionary."""
    data: Dict[str, Any] = {
        "id": record.id,
        "title": record.title,
        "category": record.category,
        "match_keywords": record.match_keywords or [],
        "match_type": record.match_type,
        "response_vi": record.response_vi,
        "response_en": record.response_en,
        "action_type": record.action_type,
        "action_payload": record.action_payload,
        "is_fast_path": record.is_fast_path,
        "is_active": record.is_active,
        "priority": record.priority,
    }
    if include_flags:
        data["is_system"] = getattr(record, "is_system", False)
        data["is_custom_edited"] = getattr(record, "is_custom_edited", False)
    return data


def _build_orm_from_seed(seed: Dict[str, Any], is_system: bool = False) -> DialogueScenario:
    """Create a DialogueScenario ORM instance from a seed scenario dictionary."""
    kwargs: Dict[str, Any] = {
        "id": seed["id"],
        "title": seed["title"],
        "category": seed.get("category", "service"),
        "match_keywords": seed.get("match_keywords", []),
        "match_type": seed.get("match_type", "keyword"),
        "response_vi": seed.get("response_vi", ""),
        "response_en": seed.get("response_en"),
        "action_type": seed.get("action_type", "none"),
        "action_payload": seed.get("action_payload"),
        "is_fast_path": seed.get("is_fast_path", True),
        "is_active": seed.get("is_active", True),
        "priority": seed.get("priority", 0),
    }
    if is_system:
        kwargs["is_system"] = True
        kwargs["is_custom_edited"] = False
    return DialogueScenario(**kwargs)


def _sync_system_record(existing: DialogueScenario, seed: Dict[str, Any]) -> bool:
    """Synchronize an unmodified system scenario record with code SSOT; return True if modified."""
    changed = False
    if not getattr(existing, "is_system", False):
        existing.is_system = True
        changed = True
    if getattr(existing, "is_custom_edited", False):
        return changed

    for field, default in (
        ("priority", 0),
        ("action_type", "none"),
        ("action_payload", None),
        ("response_vi", ""),
        ("response_en", None),
    ):
        target_val = seed.get(field, default)
        if getattr(existing, field) != target_val:
            setattr(existing, field, target_val)
            changed = True

    seed_kws = seed.get("match_keywords") or []
    if set(existing.match_keywords or []) != set(seed_kws):
        existing.match_keywords = seed.get("match_keywords", [])
        changed = True
    return changed


class ScenarioService:
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
            records = list((await db.execute(select(DialogueScenario))).scalars().all())

            if len(records) == 0 or force_reseed:
                logger.info("[ScenarioService] Database kịch bản trống hoặc force_reseed. Tiến hành seed dữ liệu mẫu...")
                existing_map = {r.id: r for r in records}
                for s_data in DEFAULT_SEED_SCENARIOS:
                    if s_data["id"] not in existing_map:
                        db.add(_build_orm_from_seed(s_data))
                await db.commit()
                records = list((await db.execute(select(DialogueScenario))).scalars().all())

            records_by_id = {r.id: r for r in records}
            has_db_updates = False

            for seed in DEFAULT_SEED_SCENARIOS:
                existing = records_by_id.get(seed["id"])
                if not existing:
                    new_item = _build_orm_from_seed(seed, is_system=True)
                    db.add(new_item)
                    records.append(new_item)
                    records_by_id[seed["id"]] = new_item
                    has_db_updates = True
                elif _sync_system_record(existing, seed):
                    has_db_updates = True

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

            cache_list = [
                _scenario_to_cache_dict(r, include_flags=True)
                for r in records
                if r.is_active and r.id != "scn-lost-keycard"
            ]
            self.reload_cache_sync(cache_list)
            self._is_initialized_from_db = True
            logger.info(f"[ScenarioService] Đồng bộ thành công {len(cache_list)} kịch bản từ Database vào RAM Cache.")
        except Exception as e:
            logger.warning(f"[ScenarioService Warning] Khong the doc kich ban tu DB: {e}. Su dung seed cache.")

    def match_fast_path(
        self, prompt: str, lang_code: str = "vi-VN"
    ) -> Optional[Tuple[str, str, str, str, Optional[Dict[str, Any]]]]:
        """
        Doi soat nhanh (<1ms) cau hoi cua khach voi danh sach kich ban trong In-Memory RAM.
        Tra ve: (response_text, lang_name, lang_code, action_type, action_payload) neu khop.
        """
        return match_fast_path_scenarios(self._cache, prompt, lang_code)

    def get_hotel_facts_prompt(self, lang_code: str = "vi-VN") -> str:
        """
        Sinh prompt thong tin tien ich dong tu In-Memory Cache de nhồi vao System Prompt cua Ollama.
        Khong can hardcode trong code Python.
        """
        return format_hotel_facts_prompt(self._cache, lang_code)

    # ------------------------------------------------------------------------
    # DATABASE CRUD OPERATIONS
    # ------------------------------------------------------------------------
    async def list_scenarios(
        self,
        db: AsyncSession,
        category: Optional[str] = None,
        is_active: Optional[bool] = None,
        search: Optional[str] = None,
    ) -> List[DialogueScenario]:
        """Lay danh sach tat ca kich ban tu co so du lieu."""
        try:
            stmt = select(DialogueScenario).order_by(DialogueScenario.priority.desc(), DialogueScenario.created_at.desc())
            if category and category.lower() != "all":
                stmt = stmt.where(DialogueScenario.category == category)
            if is_active is not None:
                stmt = stmt.where(DialogueScenario.is_active == is_active)
            if search and search.strip():
                kw = f"%{search.strip()}%"
                stmt = stmt.where(
                    (DialogueScenario.title.ilike(kw)) | (DialogueScenario.response_vi.ilike(kw))
                )
            return list((await db.execute(stmt)).scalars().all())
        except Exception as e:
            logger.error(f"[ScenarioService list_scenarios Error] {e}")
            raise

    async def get_scenario(self, db: AsyncSession, scenario_id: str) -> Optional[DialogueScenario]:
        """Lay chi tiet mot kich ban theo ID."""
        try:
            stmt = select(DialogueScenario).where(DialogueScenario.id == scenario_id)
            return (await db.execute(stmt)).scalar_one_or_none()
        except Exception as e:
            logger.error(f"[ScenarioService get_scenario Error] {e}")
            raise

    async def create_scenario(self, db: AsyncSession, data: DialogueScenarioCreate) -> DialogueScenario:
        """Tao kich ban moi va cap nhat In-Memory Cache."""
        try:
            item = DialogueScenario(
                title=data.title,
                category=data.category,
                match_keywords=data.match_keywords,
                match_type=data.match_type,
                response_vi=data.response_vi,
                response_en=data.response_en,
                action_type=data.action_type,
                action_payload=data.action_payload,
                is_fast_path=data.is_fast_path,
                is_active=data.is_active,
                is_system=False,
                is_custom_edited=True,
                priority=data.priority,
            )
            db.add(item)
            await db.commit()
            await db.refresh(item)

            self._cache.append(_scenario_to_cache_dict(item, include_flags=False))
            self._cache.sort(key=lambda x: x.get("priority", 0), reverse=True)
            return item
        except Exception as e:
            await db.rollback()
            logger.error(f"[ScenarioService create_scenario Error] {e}")
            raise

    async def update_scenario(
        self, db: AsyncSession, scenario_id: str, data: DialogueScenarioUpdate
    ) -> Optional[DialogueScenario]:
        """Cap nhat kich ban va reload In-Memory Cache."""
        try:
            item = await self.get_scenario(db, scenario_id)
            if not item:
                return None

            update_dict = data.model_dump(exclude_unset=True)
            # Admin chinh sua qua UI -> Danh dau is_custom_edited = True de initialize_cache khong bao gio tu y ghi de
            update_dict["is_custom_edited"] = True
            for k, v in update_dict.items():
                setattr(item, k, v)
            item.updated_at = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)

            await db.commit()
            await db.refresh(item)

            for entry in self._cache:
                if entry.get("id") == scenario_id:
                    entry.update(update_dict)
                    break
            self._cache.sort(key=lambda x: x.get("priority", 0), reverse=True)
            return item
        except Exception as e:
            await db.rollback()
            logger.error(f"[ScenarioService update_scenario Error] {e}")
            raise

    async def delete_scenario(self, db: AsyncSession, scenario_id: str) -> bool:
        """Xoa kich ban khoi DB va reload In-Memory Cache."""
        try:
            item = await self.get_scenario(db, scenario_id)
            if not item:
                return False

            await db.delete(item)
            await db.commit()
            self._cache = [e for e in self._cache if e.get("id") != scenario_id]

            try:
                await self.initialize_cache(db)
            except Exception:
                pass
            return True
        except Exception as e:
            await db.rollback()
            logger.error(f"[ScenarioService delete_scenario Error] {e}")
            raise


# Singleton instance cho toan ung dung
scenario_service = ScenarioService()
