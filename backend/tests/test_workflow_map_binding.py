"""Workflow-first setup: save a template, then assign map parameters to its steps."""
from copy import deepcopy

import pytest
from fastapi import FastAPI
from httpx import AsyncClient, ASGITransport
from app.api.v1.endpoints.workflows import router, get_workflow_repository
from app.models.workflow import RobotWorkflow


class MemoryRepository:
    def __init__(self): self.items = {}
    async def get_by_id(self, key): return self.items.get(key)
    async def get_for_update(self, key): return self.items.get(key)
    async def create(self, item, autocommit=False): self.items[item.id] = item
    async def commit(self): pass
    async def refresh(self, item): pass


def route(key, map_id):
    return RobotWorkflow(id=key, name=key, is_active=True, trigger_type='MANUAL', steps=[],
                         execution_config={'route': {'map_id': map_id, 'points': [
                             {'id': 'a', 'name': 'Start', 'x': 0, 'y': 0},
                             {'id': 'b', 'name': 'End', 'x': 1, 'y': 1},
                         ]}})


def template():
    return {'id': 'template', 'name': 'Morning patrol', 'description': 'Keep this description',
            'is_active': False, 'trigger_type': 'SCHEDULE',
            'execution_config': {'execution_mode': 'ROBOT', 'repeat_count': 3, 'interval_seconds': 10,
                                 'schedules': [{'time': '08:00', 'days': [0, 2]}]},
            'steps': [
                {'step_id': 'outbound', 'type': 'FOLLOW_ROUTE', 'title': 'Outbound',
                 'params': {'repeat_count': 2, 'next_step_id': 'pause'}},
                {'step_id': 'pause', 'type': 'WAIT', 'title': 'Wait', 'params': {'duration_sec': 12}},
                {'step_id': 'return', 'type': 'FOLLOW_ROUTE', 'title': 'Return', 'params': {'repeat_count': 1}},
            ]}


@pytest.fixture
def setup():
    repo = MemoryRepository()
    repo.items.update({'route-a': route('route-a', 'map_a'), 'route-b': route('route-b', 'map_b')})
    app = FastAPI()
    app.include_router(router, prefix='/workflows')
    app.dependency_overrides[get_workflow_repository] = lambda: repo
    return app, repo


@pytest.mark.asyncio
async def test_save_template_first_bind_each_step_then_activate(setup):
    app, repo = setup
    async with AsyncClient(transport=ASGITransport(app=app), base_url='http://test') as client:
        saved = await client.post('/workflows', json=template())
        assert saved.status_code == 200, saved.text
        assert saved.json()['is_active'] is False
        assert saved.json()['steps'][0]['params'].get('route_id') is None
        assert (await client.put('/workflows/template', json={'is_active': True})).status_code == 422
        assert (await client.post('/workflows/template/execute', json={})).status_code == 409

        first = await client.put('/workflows/template/steps/outbound/route', json={
            'route_id': 'route-a', 'map_id': 'map_a', 'expected_route_id': None})
        assert first.status_code == 200, first.text
        body = first.json()
        assert body['steps'][0]['params'] == {'repeat_count': 2, 'next_step_id': 'pause',
                                              'route_id': 'route-a', 'map_id': 'map_a'}
        assert body['steps'][1] == template()['steps'][1]
        assert body['steps'][2] == template()['steps'][2]
        assert body['execution_config']['repeat_count'] == 3
        assert body['execution_config']['schedules'][0]['days'] == [0, 2]
        assert body['description'] == 'Keep this description'
        assert body['is_active'] is False
        assert (await client.put('/workflows/template', json={'is_active': True})).status_code == 422

        second = await client.put('/workflows/template/steps/return/route', json={
            'route_id': 'route-a', 'map_id': 'map_a', 'expected_route_id': None})
        assert second.status_code == 200, second.text
        assert second.json()['is_active'] is False
        assert (await client.put('/workflows/template', json={'is_active': True})).status_code == 200


@pytest.mark.asyncio
async def test_binding_rejects_wrong_map_wrong_step_and_stale_assignment(setup):
    app, repo = setup
    async with AsyncClient(transport=ASGITransport(app=app), base_url='http://test') as client:
        await client.post('/workflows', json=template())
        for step_id, data in [
            ('outbound', {'route_id': 'route-a', 'map_id': 'map_b'}),
            ('pause', {'route_id': 'route-a', 'map_id': 'map_a'}),
            ('missing', {'route_id': 'route-a', 'map_id': 'map_a'}),
        ]:
            assert (await client.put(f'/workflows/template/steps/{step_id}/route', json=data)).status_code == 422
        data = {'route_id': 'route-a', 'map_id': 'map_a', 'expected_route_id': None}
        assert (await client.put('/workflows/template/steps/outbound/route', json=data)).status_code == 200
        assert (await client.put('/workflows/template/steps/outbound/route', json=data)).status_code == 409
        assert repo.items['template'].steps[0]['params']['route_id'] == 'route-a'


@pytest.mark.asyncio
async def test_complete_physical_workflow_cannot_span_two_maps(setup):
    app, repo = setup
    async with AsyncClient(transport=ASGITransport(app=app), base_url='http://test') as client:
        await client.post('/workflows', json=template())
        await client.put('/workflows/template/steps/outbound/route', json={'route_id': 'route-a', 'map_id': 'map_a'})
        before = deepcopy(repo.items['template'].steps)
        response = await client.put('/workflows/template/steps/return/route', json={'route_id': 'route-b', 'map_id': 'map_b'})
        assert response.status_code == 422
        assert repo.items['template'].steps == before


@pytest.mark.asyncio
async def test_active_template_is_rejected_but_disabled_schedule_can_be_drafted_without_slots(setup):
    app, repo = setup
    async with AsyncClient(transport=ASGITransport(app=app), base_url='http://test') as client:
        data = template()
        data['is_active'] = True
        assert (await client.post('/workflows', json=data)).status_code == 422
        data['is_active'] = False
        data['execution_config']['schedules'] = []
        assert (await client.post('/workflows', json=data)).status_code == 200
        assert (await client.put('/workflows/template', json={'is_active': True})).status_code == 422
