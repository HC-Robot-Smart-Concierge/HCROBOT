from typing import Optional, List, Sequence
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, desc, func

from app.models.notification import Notification
from app.repositories.base import BaseRepository


class NotificationRepository(BaseRepository[Notification]):
    """
    Repository for managing in-app notifications and real-time alerts.
    """

    def __init__(self, db: AsyncSession):
        super().__init__(db, Notification)

    @staticmethod
    def _get_department_aliases(department: str) -> List[str]:
        dep_clean = department.strip().lower()
        aliases = [dep_clean]
        if "f&b" in dep_clean or "room" in dep_clean or "ẩm thực" in dep_clean:
            aliases.extend(["f&b", "room service", "room_service", "ẩm thực & f&b"])
        elif "housekeeping" in dep_clean or "buồng" in dep_clean:
            aliases.extend(["housekeeping", "buồng phòng"])
        elif "bell" in dep_clean or "hành lý" in dep_clean:
            aliases.extend(["bell services", "bellman", "bell_services", "vận chuyển hành lý"])
        elif "maint" in dep_clean or "kỹ thuật" in dep_clean or "bảo trì" in dep_clean:
            aliases.extend(["maintenance", "kỹ thuật & bảo trì", "kỹ thuật"])
        elif "reception" in dep_clean or "lễ tân" in dep_clean or "front" in dep_clean:
            aliases.extend(["reception", "lễ tân", "front desk"])
        elif "taxi" in dep_clean or "vận chuyển" in dep_clean:
            aliases.extend(["taxi", "đặt xe & vận chuyển", "transportation"])
        elif "concierge" in dep_clean or "trợ lý" in dep_clean:
            aliases.extend(["concierge", "trợ lý concierge", "live support"])
        return aliases

    async def list_notifications(
        self,
        department: Optional[str] = None,
        limit: int = 50,
    ) -> Sequence[Notification]:
        """Fetch notifications filtered by department alias and global ('All') notices."""
        stmt = select(Notification)
        if department and department.strip().lower() not in [
            "all",
            "admin",
            "executive",
            "operations admin",
            "toàn bộ",
        ]:
            aliases = self._get_department_aliases(department)
            stmt = stmt.where(
                (func.lower(Notification.department).in_(aliases))
                | (Notification.department == "All")
            )

        stmt = stmt.order_by(desc(Notification.created_at)).limit(limit)
        res = await self.db.execute(stmt)
        return res.scalars().all()

    async def toggle_read(self, notification_id: str) -> Optional[Notification]:
        """Toggles the read status of a notification."""
        notif = await self.get_by_id(notification_id)
        if not notif:
            return None
        notif.is_read = not notif.is_read
        await self.db.commit()
        await self.db.refresh(notif)
        return notif

    async def mark_all_read(self, department: Optional[str] = None) -> int:
        """Marks all notifications for a department or all departments as read."""
        stmt = update(Notification).values(is_read=True)
        if department and department.strip().lower() not in [
            "all",
            "admin",
            "executive",
            "operations admin",
            "toàn bộ",
        ]:
            aliases = self._get_department_aliases(department)
            stmt = stmt.where(
                (func.lower(Notification.department).in_(aliases))
                | (Notification.department == "All")
            )

        res = await self.db.execute(stmt)
        await self.db.commit()
        return res.rowcount or 0
