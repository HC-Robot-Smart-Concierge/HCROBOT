from datetime import datetime, timedelta, timezone

import pytest
from pydantic import ValidationError
from sqlalchemy import create_engine, select

from app.schemas.workflow import WorkflowCreate, WorkflowExecutionConfig, WorkflowResponse
from app.services.workflow_schedule import preview_schedule


def test_weekly_preview_converts_local_day_and_skips_elapsed_slot():
    config = WorkflowExecutionConfig(schedules=[{"time": "00:15", "days": [0]}])
    now = datetime(2026, 11, 8, 17, 0, tzinfo=timezone.utc)  # Monday 00:00 in Vietnam
    dates = preview_schedule(config, now)
    assert dates[0] == datetime(2026, 11, 8, 17, 15, tzinfo=timezone.utc)
    assert len(dates) == 5
    assert dates[1] - dates[0] == timedelta(days=7)
    assert preview_schedule(config, dates[0])[0] == dates[1]


def test_disabled_schedules_and_equivalent_timezones_do_not_duplicate_preview():
    config = WorkflowExecutionConfig(schedules=[
        {"time": "08:00", "days": [0], "enabled": False},
        {"time": "08:00", "days": [1], "timezone": "Asia/Ho_Chi_Minh"},
        {"time": "01:00", "days": [1], "timezone": "UTC"},
    ])
    dates = preview_schedule(config, datetime(2026, 11, 9, tzinfo=timezone.utc))
    assert dates[0] == datetime(2026, 11, 10, 1, tzinfo=timezone.utc)
    assert len(set(dates)) == 5


@pytest.mark.parametrize("patch", [
    {"repeat_count": 0}, {"repeat_count": 1.5}, {"repeat_count": True},
    {"interval_seconds": -1}, {"repeat_mode": "OTHER"},
    {"schedules": [{"time": "24:00"}]},
    {"schedules": [{"days": []}]},
    {"schedules": [{"days": [7]}]},
    {"schedules": [{"timezone": "Invalid/Timezone"}]},
    {"schedules": [{"time": "08:00"}, {"time": "08:00"}]},
])
def test_invalid_execution_config_rejected(patch):
    with pytest.raises(ValidationError):
        WorkflowExecutionConfig(**patch)


def test_schedule_is_metadata_and_legacy_workflow_remains_readable():
    saved = WorkflowCreate(name="Patrol", trigger_type="SCHEDULE", steps=[
        {"step_id": "move-a", "type": "MOVE", "title": "A", "params": {"target_x": 1}},
    ], execution_config={"repeat_mode": "CONTINUOUS", "interval_seconds": 30,
                         "schedules": [{"time": "08:00", "days": [0, 2]}]})
    assert [s.type for s in saved.steps] == ["MOVE"]
    legacy = WorkflowResponse(id="old", name="Old", trigger_type="SCHEDULE", execution_config={})
    assert legacy.execution_config.repeat_count == 1
    with pytest.raises(ValidationError):
        WorkflowCreate(name="Missing schedule", trigger_type="SCHEDULE")


def test_execution_config_round_trips_through_json_column():
    from app.models.workflow import RobotWorkflow
    config = WorkflowExecutionConfig(repeat_count=3, schedules=[{"time": "09:30", "days": [0, 4]}], route={
        "map_id": "map_kho", "points": [
            {"id": "a", "name": "Dock", "endpoint_id": "dock", "x": -1, "y": 2, "yaw": 1.57},
            {"id": "b", "name": "Intermediate", "x": 2.5, "y": -0.3},
        ],
    })
    engine = create_engine("sqlite://")
    table = RobotWorkflow.__table__
    table.create(engine)
    with engine.begin() as connection:
        connection.execute(table.insert().values(id="test", name="Test", steps=[], execution_config=config.model_dump()))
        stored = connection.execute(select(table.c.execution_config)).scalar_one()
    assert WorkflowExecutionConfig.model_validate(stored) == config
    engine.dispose()


@pytest.mark.parametrize("route", [
    {"map_id": "lab", "points": []},
    {"map_id": "", "points": [{"id": "a", "name": "A", "x": 0, "y": 0}] * 2},
    {"map_id": "lab", "frame_id": "pixels", "points": [{"id": "a", "name": "A", "x": 0, "y": 0}] * 2},
    {"map_id": "lab", "points": [{"id": "a", "name": "A", "x": float('nan'), "y": 0}] * 2},
])
def test_invalid_physical_route_rejected(route):
    with pytest.raises(ValidationError):
        WorkflowExecutionConfig(route=route)


def test_map_specific_move_is_not_retargeted_to_stock_lobby():
    from app.api.v1.endpoints.default_workflows import upgrade_legacy_move_step
    step = {"type": "MOVE", "params": {"map_id": "map_kho", "target_waypoint_id": "FRONT_DESK", "target_x": 0, "target_y": 0}}
    assert upgrade_legacy_move_step(step) is None
    assert step["params"]["target_x"] == 0


@pytest.mark.asyncio
async def test_workflow_api_save_read_update_and_preview_without_dispatch():
    from fastapi import FastAPI
    from httpx import AsyncClient, ASGITransport
    from app.api.v1.endpoints.workflows import router, get_workflow_repository

    class MemoryRepository:
        def __init__(self):
            self.items = {}

        async def get_by_id(self, key):
            return self.items.get(key)

        async def create(self, item, autocommit=False):
            self.items[item.id] = item

        async def commit(self):
            pass

        async def refresh(self, item):
            pass

    repo = MemoryRepository()
    app = FastAPI()
    app.include_router(router, prefix="/workflows")
    app.dependency_overrides[get_workflow_repository] = lambda: repo
    payload = {"id": "patrol", "name": "Patrol", "trigger_type": "SCHEDULE", "steps": [
        {"step_id": "a", "type": "MOVE", "title": "A"}],
        "execution_config": {"repeat_count": 3, "schedules": [{"time": "08:00", "days": [0, 4]}]}}
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/workflows", json=payload)
        assert response.status_code == 200, response.text
        stored = await client.get("/workflows/patrol")
        assert stored.json()["execution_config"]["repeat_count"] == 3
        assert [s["type"] for s in stored.json()["steps"]] == ["MOVE"]
        updated = await client.put("/workflows/patrol", json={"execution_config": {
            "repeat_mode": "CONTINUOUS", "schedules": [{"time": "10:30", "days": [2]}]}})
        assert updated.status_code == 200, updated.text
        assert updated.json()["execution_config"]["repeat_mode"] == "CONTINUOUS"
        preview = await client.post("/workflows/schedule-preview", json={"execution_config": updated.json()["execution_config"]})
        assert preview.status_code == 200
        assert len(preview.json()["occurrences"]) == 5
        assert preview.json()["dispatch_enabled"] is False
        invalid = await client.put("/workflows/patrol", json={"execution_config": {"schedules": []}})
        assert invalid.status_code == 422


def test_migration_upgrades_existing_table_without_losing_rows():
    import importlib.util
    from pathlib import Path
    from alembic.migration import MigrationContext
    from alembic.operations import Operations
    from sqlalchemy import inspect, text

    path = Path(__file__).parents[1] / "alembic/versions/b82c17d104ef_workflow_execution_config.py"
    spec = importlib.util.spec_from_file_location("workflow_config_migration", path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    engine = create_engine("sqlite://")
    with engine.begin() as connection:
        connection.execute(text("CREATE TABLE robot_workflows (id TEXT PRIMARY KEY)"))
        connection.execute(text("INSERT INTO robot_workflows (id) VALUES ('legacy')"))
        migration.op = Operations(MigrationContext.configure(connection))
        migration.upgrade()
        migration.upgrade()  # Compatible with the additive startup patch.
        assert "execution_config" in {c["name"] for c in inspect(connection).get_columns("robot_workflows")}
        assert connection.execute(text("SELECT execution_config FROM robot_workflows WHERE id='legacy'")).scalar_one() == '{}'
    engine.dispose()
