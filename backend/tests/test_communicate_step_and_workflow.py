import pytest
from app.schemas.workflow import WorkflowStepItem
from app.api.v1.endpoints.default_workflows import CORE_WORKFLOWS
from app.core.database import AsyncSessionLocal
from app.models.workflow import RobotWorkflow
from sqlalchemy import select


def test_communicate_schema_validation():
    """Verify that WorkflowStepItem validates COMMUNICATE step type."""
    step = WorkflowStepItem(
        step_id="step-test-comm",
        type="COMMUNICATE",
        title="Đối thoại thông minh 2 chiều với khách",
        params={
            "initial_prompt": "Dạ em chào quý khách! Em có thể giúp gì ạ?",
            "silence_timeout_sec": 30,
            "input_source": "BOTH",
            "ai_agent_enabled": True
        }
    )
    assert step.type == "COMMUNICATE"
    assert step.params["silence_timeout_sec"] == 30
    assert step.params["input_source"] == "BOTH"


def test_core_workflows_use_communicate():
    """Verify default core workflows in code define COMMUNICATE with 30s silence timeout."""
    communicate_found = False
    for wf in CORE_WORKFLOWS:
        for s in wf.get("steps", []):
            stype = s.get("type")
            # Must not contain old LISTEN or SPEAK
            assert stype not in ["LISTEN", "SPEAK"], f"Found obsolete step {stype} in {wf['id']}"
            if stype == "COMMUNICATE":
                communicate_found = True
                params = s.get("params", {})
                assert params.get("silence_timeout_sec") == 30, f"Silence timeout must be 30s in {wf['id']}"
    assert communicate_found, "At least one COMMUNICATE step must exist in core workflows"


@pytest.mark.asyncio
async def test_database_workflows_are_migrated():
    """Verify that all workflows in the PostgreSQL database are migrated to COMMUNICATE."""
    async with AsyncSessionLocal() as session:
        res = await session.execute(select(RobotWorkflow))
        workflows = res.scalars().all()
        assert len(workflows) > 0, "Database must have workflows"

        for wf in workflows:
            steps = wf.steps or []
            types = [s.get("type") for s in steps]
            # No workflow in DB should have raw LISTEN or SPEAK
            assert "LISTEN" not in types, f"Workflow '{wf.id}' still has LISTEN step in DB"
            assert "SPEAK" not in types, f"Workflow '{wf.id}' still has SPEAK step in DB"

            # Workflows that have conversational interactions must have COMMUNICATE
            if wf.id in ["wf-01-welcome", "wf-02-recommend", "wf-03-room-service", "wf-04-call-staff", "wf-07-guide-tour", "wf-08-wakeup"]:
                assert "COMMUNICATE" in types, f"Workflow '{wf.id}' should have COMMUNICATE step"
                comm_steps = [s for s in steps if s.get("type") == "COMMUNICATE"]
                for cs in comm_steps:
                    assert cs.get("params", {}).get("silence_timeout_sec") == 30, f"Silence timeout should be 30s in {wf.id}"
