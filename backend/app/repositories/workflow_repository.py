from typing import Optional, List, Sequence, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.workflow import RobotWorkflow, RobotWaypoint
from app.repositories.base import BaseRepository


class WorkflowRepository(BaseRepository[RobotWorkflow]):
    """
    Repository for Robot Stepflow Workflows and Waypoints.
    """

    def __init__(self, db: AsyncSession):
        super().__init__(db, RobotWorkflow)

    async def list_workflows(self) -> Sequence[RobotWorkflow]:
        """Fetch all workflows ordered by ID."""
        stmt = select(RobotWorkflow).order_by(RobotWorkflow.id.asc())
        res = await self.db.execute(stmt)
        return res.scalars().all()

    async def get_by_id(self, workflow_id: str) -> Optional[RobotWorkflow]:
        """Fetch a single workflow by ID."""
        stmt = select(RobotWorkflow).where(RobotWorkflow.id == workflow_id)
        res = await self.db.execute(stmt)
        return res.scalar_one_or_none()

    async def has_any(self) -> bool:
        """Check if any workflow exists in database."""
        stmt = select(RobotWorkflow.id).limit(1)
        res = await self.db.execute(stmt)
        return res.scalar_one_or_none() is not None

    async def seed_defaults(self, core_workflows: List[Dict[str, Any]]) -> None:
        """Seeds default workflows if not already present."""
        for wf_data in core_workflows:
            existing = await self.get_by_id(wf_data["id"])
            if not existing:
                new_wf = RobotWorkflow(
                    id=wf_data["id"],
                    name=wf_data["name"],
                    description=wf_data["description"],
                    trigger_type=wf_data["trigger_type"],
                    is_active=wf_data["is_active"],
                    steps=wf_data["steps"],
                )
                self.db.add(new_wf)
        await self.db.commit()
