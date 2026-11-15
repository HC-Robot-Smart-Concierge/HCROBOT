"""Database CRUD and hotel-facts prompt helpers for ScenarioService."""

import datetime
import logging
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.scenario import DialogueScenario
from app.schemas.scenario import DialogueScenarioCreate, DialogueScenarioUpdate

logger = logging.getLogger(__name__)


class ScenarioCrudMixin:
    """Provides CRUD operations and hotel facts summary generation."""

    def get_hotel_facts_prompt(self, lang_code: str = "vi-VN") -> str:
        """

        Sinh prompt thong tin tien ich dong tu In-Memory Cache de nhồi vao System Prompt cua Ollama.

        Khong can hardcode trong code Python.

        """
        is_en = (lang_code == "en-US")
        active_facts = []
        sorted_scenarios = sorted(self._cache, key=lambda s: s.get("priority", 0), reverse=True)
        for scn in sorted_scenarios:
            if not scn.get("is_active", True):
                continue
            cat = scn.get("category", "")
            if cat in ["facility", "faq"]:
                resp = scn.get("response_en") if is_en and scn.get("response_en") else scn.get("response_vi")
                title = scn.get("title")
                if resp:
                    active_facts.append(f"- {title}: {resp}")
                    if len(active_facts) >= 12:  # Giữ top 12 thông tin cốt lõi để tránh tràn TPM token quota
                        break
        if not active_facts:
            return ""
        header = "HOTEL AMENITIES & FACTS (CONFIGURED BY ADMIN):\n" if is_en else "THÔNG TIN TIỆN ÍCH KHÁCH SẠN (DO ADMIN THIẾT LẬP):\n"
        return header + "\n".join(active_facts)

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
                    (DialogueScenario.title.ilike(kw)) |
                    (DialogueScenario.response_vi.ilike(kw))
                )
            result = await db.execute(stmt)
            return list(result.scalars().all())
        except Exception as e:
            logger.error(f"[ScenarioService list_scenarios Error] {e}")
            raise

    async def get_scenario(self, db: AsyncSession, scenario_id: str) -> Optional[DialogueScenario]:
        """Lay chi tiet mot kich ban theo ID."""
        try:
            stmt = select(DialogueScenario).where(DialogueScenario.id == scenario_id)
            result = await db.execute(stmt)
            return result.scalar_one_or_none()
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
            # Đồng bộ ngay lập tức vào In-Memory RAM Cache
            self._cache.append({
                "id": item.id,
                "title": item.title,
                "category": item.category,
                "match_keywords": item.match_keywords or [],
                "match_type": item.match_type,
                "response_vi": item.response_vi,
                "response_en": item.response_en,
                "action_type": item.action_type,
                "action_payload": item.action_payload,
                "is_fast_path": item.is_fast_path,
                "is_active": item.is_active,
                "priority": item.priority,
            })
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
            # Đồng bộ trực tiếp vào In-Memory Cache tức thì (<0.1ms)
            for entry in self._cache:
                if entry.get("id") == scenario_id:
                    for k, v in update_dict.items():
                        entry[k] = v
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
            # Xóa trực tiếp khỏi In-Memory Cache tức thì (<0.1ms)
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
