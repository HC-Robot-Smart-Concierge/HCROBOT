from typing import Optional, Sequence, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.models.logging import AuditLog
from app.repositories.base import BaseRepository


class AuditLogRepository(BaseRepository[AuditLog]):
    """
    Repository for Security and Operational Audit Logs.
    """

    def __init__(self, db: AsyncSession):
        super().__init__(db, AuditLog)

    async def query_audit_trail(
        self,
        page: int = 1,
        limit: int = 50,
        action: Optional[str] = None,
        actor_id: Optional[str] = None,
        resource_type: Optional[str] = None,
    ) -> Tuple[int, Sequence[AuditLog]]:
        """Paginated search for AuditLog entries."""
        query = select(AuditLog)
        if action:
            query = query.where(AuditLog.action == action.upper())
        if actor_id:
            query = query.where(AuditLog.actor_id == actor_id)
        if resource_type:
            query = query.where(AuditLog.resource_type == resource_type.upper())

        count_res = await self.db.execute(select(func.count()).select_from(query.subquery()))
        total = count_res.scalar_one()

        paged_query = query.order_by(AuditLog.timestamp.desc()).offset((page - 1) * limit).limit(limit)
        items_res = await self.db.execute(paged_query)
        items = items_res.scalars().all()

        return total, items
