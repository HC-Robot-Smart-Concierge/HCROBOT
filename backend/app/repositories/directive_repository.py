from typing import Optional, List, Sequence
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, or_

from app.models.directive import ManagementDirective
from app.repositories.base import BaseRepository


class DirectiveRepository(BaseRepository[ManagementDirective]):
    """
    Repository for Management Directives (chỉ thị vận hành).
    """

    def __init__(self, db: AsyncSession):
        super().__init__(db, ManagementDirective)

    async def list_by_department(self, department: Optional[str] = None) -> Sequence[ManagementDirective]:
        """Fetch all directives, optionally filtered by department."""
        stmt = select(ManagementDirective).order_by(desc(ManagementDirective.created_at))
        if department:
            stmt = stmt.where(ManagementDirective.department.ilike(f"%{department.strip()}%"))
        res = await self.db.execute(stmt)
        return res.scalars().all()

    async def get_by_id_or_code(self, identifier: str) -> Optional[ManagementDirective]:
        """Fetch directive by ID or code (e.g. DIR-101, REQ-DIR-101)."""
        target = identifier.strip()
        clean = target.replace("REQ-", "").strip()
        stmt = select(ManagementDirective).where(
            or_(
                ManagementDirective.id == target,
                ManagementDirective.code == target,
                ManagementDirective.id == clean,
                ManagementDirective.code == clean,
            )
        )
        res = await self.db.execute(stmt)
        return res.scalar_one_or_none()
