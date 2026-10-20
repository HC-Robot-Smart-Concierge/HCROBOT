import asyncio
import os
import sys

# Ensure backend root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
sys.stdout.reconfigure(encoding='utf-8')

from app.core.database import AsyncSessionLocal
from app.models.workflow import RobotWorkflow
from sqlalchemy import select


async def inspect_workflows():
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(RobotWorkflow).order_by(RobotWorkflow.id))
        workflows = result.scalars().all()
        print(f"Total workflows in DB: {len(workflows)}")
        for wf in workflows:
            types = [s.get("type") for s in (wf.steps or [])]
            print(f"[{wf.id}] {wf.name} -> {types}")


if __name__ == "__main__":
    asyncio.run(inspect_workflows())
