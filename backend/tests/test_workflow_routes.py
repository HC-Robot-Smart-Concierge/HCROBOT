from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.services.workflow_routes import resolve_route_steps


def template():
    return SimpleNamespace(id="route-1", name="Lobby", is_active=True, execution_config={"route": {
        "map_id": "map_kho", "frame_id": "map", "points": [
            {"id": "a", "name": "Dock", "x": -1, "y": 2, "yaw": 1.57},
            {"id": "b", "name": "Door", "x": 3, "y": 4},
        ],
    }})


@pytest.mark.asyncio
async def test_route_reference_expands_only_the_route_and_preserves_branch_targets():
    repo = SimpleNamespace(get_by_id=AsyncMock(return_value=template()))
    source = [
        {"step_id": "greet", "type": "GREET", "params": {}},
        {"step_id": "patrol", "type": "FOLLOW_ROUTE", "params": {"route_id": "route-1", "repeat_count": 2, "next_step_id": "bye"}},
        {"step_id": "bye", "type": "SPEAK", "params": {}},
    ]
    steps = await resolve_route_steps(source, repo)
    assert [s["type"] for s in steps] == ["GREET", "MOVE", "MOVE", "MOVE", "MOVE", "SPEAK"]
    assert steps[1]["step_id"] == "patrol"
    assert len({s["step_id"] for s in steps}) == 6
    assert [s["params"]["target_x"] for s in steps[1:5]] == [-1, 3, -1, 3]
    assert steps[4]["params"]["next_step_id"] == "bye"
    assert "next_step_id" not in steps[1]["params"]
    assert steps[1]["params"]["map_id"] == "map_kho"
    assert source[1]["type"] == "FOLLOW_ROUTE"


@pytest.mark.asyncio
@pytest.mark.parametrize("count", [0, 101, 1.5, True, "2"])
async def test_invalid_route_repeat_rejected(count):
    with pytest.raises(ValueError):
        await resolve_route_steps([{"step_id": "a", "type": "FOLLOW_ROUTE", "params": {"route_id": "route-1", "repeat_count": count}}], SimpleNamespace())


@pytest.mark.asyncio
async def test_missing_disabled_and_oversized_routes_rejected():
    step = {"step_id": "a", "type": "FOLLOW_ROUTE", "params": {"route_id": "route-1"}}
    repo = SimpleNamespace(get_by_id=AsyncMock(return_value=None))
    with pytest.raises(ValueError, match="không còn khả dụng"):
        await resolve_route_steps([step], repo)
    route = template()
    route.is_active = False
    repo.get_by_id.return_value = route
    with pytest.raises(ValueError):
        await resolve_route_steps([step], repo)
    route.is_active = True
    step["params"]["repeat_count"] = 100
    with pytest.raises(ValueError, match="2000"):
        await resolve_route_steps([step] * 11, repo)


@pytest.mark.asyncio
async def test_api_validates_references_and_guards_in_use_route_deletion():
    from fastapi import FastAPI
    from httpx import AsyncClient, ASGITransport
    from app.api.v1.endpoints.workflows import router, get_workflow_repository

    route = template()
    flow = SimpleNamespace(id="workflow", name="Patrol", steps=[{"type": "FOLLOW_ROUTE", "params": {"route_id": "route-1"}}])
    repo = SimpleNamespace(get_by_id=AsyncMock(return_value=route), list_workflows=AsyncMock(return_value=[flow, route]))
    app = FastAPI()
    app.include_router(router, prefix="/workflows")
    app.dependency_overrides[get_workflow_repository] = lambda: repo
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.delete("/workflows/route-1")
        assert response.status_code == 409
        repo.get_by_id.return_value = None
        response = await client.post("/workflows", json={"name": "Invalid", "steps": [
            {"step_id": "a", "type": "FOLLOW_ROUTE", "title": "Route", "params": {"route_id": "missing"}},
        ]})
        assert response.status_code == 422
