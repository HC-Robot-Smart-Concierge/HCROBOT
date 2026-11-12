"""Zone edits round-trip through the API and an isolated in-memory database."""
import importlib.util
import math
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session
from alembic.migration import MigrationContext
from alembic.operations import Operations

from app.api.v1.endpoints import map as map_endpoint
from app.main import app
from app.models.map import Zone, Endpoint
from app.repositories import get_map_repository
from app.repositories.map_repository import MapRepository
from app.schemas.map import ZoneSchema
from app.services.hardware.ros2_runtime_service import Ros2RuntimeService


@pytest.fixture
def zone_repository():
    engine = create_engine("sqlite://")
    Zone.__table__.create(engine)
    Endpoint.__table__.create(engine)
    with Session(engine) as session:
        class AsyncAdapter:
            async def execute(self, statement): return session.execute(statement)
            async def commit(self): session.commit()
            async def refresh(self, obj): session.refresh(obj)
            def add(self, obj): session.add(obj)
        repo = MapRepository(AsyncAdapter())
        previous = dict(app.dependency_overrides)
        app.dependency_overrides[get_map_repository] = lambda: repo
        try:
            yield repo, session
        finally:
            app.dependency_overrides.clear()
            app.dependency_overrides.update(previous)
    engine.dispose()


@pytest.mark.asyncio
async def test_resize_and_rotation_survive_save_update_and_reload(zone_repository):
    body = dict(id="rotated", name="Vùng đã vẽ", type="KEEP_OUT", map_id="editing-test",
                x=2, y=1, width=1.6, height=.4, yaw=450)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        created = await client.post("/api/v1/map/zones", json=body)
        assert created.status_code == 200, created.text
        assert created.json()["yaw"] == 90
        edited = await client.put("/api/v1/map/zones/rotated", json={**body, "yaw": 37, "width": 2.3, "height": .6})
        assert edited.status_code == 200, edited.text
        zones = (await client.get("/api/v1/map/zones", params={"map_id": "editing-test"})).json()
    assert len(zones) == 1
    assert (zones[0]["yaw"], zones[0]["width"], zones[0]["height"]) == (37, 2.3, .6)
    _, session = zone_repository
    session.expire_all()
    saved = session.get(Zone, "rotated")
    assert saved.yaw == 37 and saved.width == 2.3 and saved.height == .6


@pytest.mark.asyncio
async def test_endpoint_conflicts_follow_rotated_body_not_old_bounds(zone_repository):
    _, session = zone_repository
    body = dict(id="rotated", name="Cấm vào", type="KEEP_OUT", map_id="editing-test",
                x=2, y=1, width=1.6, height=.4, yaw=90)
    endpoint = Endpoint(id="ep", name="Endpoint", map_id="editing-test", x=2, y=1.65)
    session.add(endpoint)
    session.commit()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        blocked = await client.post("/api/v1/map/zones", json=body)
        assert blocked.status_code == 400
        endpoint.x, endpoint.y = 2.65, 1
        session.commit()
        assert (await client.post("/api/v1/map/zones", json=body)).status_code == 200


@pytest.mark.parametrize("yaw", [0, 37, 90, -145])
def test_point_membership_uses_local_axes(yaw):
    zone = ZoneSchema(id="z", name="zone", x=2, y=1, width=2, height=.4, yaw=yaw)
    angle = math.radians(yaw)
    assert map_endpoint.is_point_in_zone(2 + .8 * math.cos(angle), 1 + .8 * math.sin(angle), zone)
    assert not map_endpoint.is_point_in_zone(2 - .5 * math.sin(angle), 1 + .5 * math.cos(angle), zone)


def test_nav2_raster_covers_rotated_extensions_and_excludes_old_horizontal_body():
    zone = dict(x=2, y=1, width=1.6, height=.4, yaw=90)
    grid = (40, 20, .1, 0, 0)
    cells = dict(Ros2RuntimeService._zone_cells(zone, 0, grid))
    def pixel(x, y): return (19 - int(y / .1)) * 40 + int(x / .1)
    assert pixel(2.05, 1.65) in cells
    assert pixel(2.65, 1.05) not in cells
    # Euclidean soft margin follows the rotated edge too.
    expanded = dict(Ros2RuntimeService._zone_cells(zone, .2, grid))
    assert expanded[pixel(2.35, 1.05)] == pytest.approx(.15)


def test_old_zones_default_to_zero_and_invalid_rotation_is_rejected():
    assert ZoneSchema(id="old", name="old").yaw == 0
    with pytest.raises(ValueError):
        ZoneSchema(id="invalid", name="invalid", yaw=float("nan"))


@pytest.mark.parametrize("yaw", [45, 90])
def test_generated_keepout_and_speed_masks_follow_zone_rotation(tmp_path, yaw):
    service = Ros2RuntimeService(project_root=tmp_path)
    service.maps_dir.mkdir(parents=True)
    (service.maps_dir / "rotated.pgm").write_bytes(b"P5\n80 40\n255\n" + bytes([254] * 3200))
    (service.maps_dir / "rotated.yaml").write_text("image: rotated.pgm\nresolution: 0.05\norigin: [0, 0, 0]\n")
    geometry = dict(x=2, y=1, width=1.6, height=.4, yaw=yaw)
    result = service.write_zone_masks("rotated", [{**geometry, "type": "KEEP_OUT"},
        {**geometry, "type": "SPEED_ZONE", "speed_limit": .12}])
    keepout = Path(result["mask_yaml"]).with_suffix(".pgm").read_bytes().split(b"\n", 3)[3]
    speed = Path(result["speed_mask_yaml"]).with_suffix(".pgm").read_bytes().split(b"\n", 3)[3]
    def pixel(x, y): return (39 - int(y / .05)) * 80 + int(x / .05)
    angle = math.radians(yaw)
    inside = pixel(2 + .65 * math.cos(angle), 1 + .65 * math.sin(angle))
    assert keepout[inside] == 100
    assert speed[inside] == 12
    old_horizontal = pixel(2.65, 1.05)
    assert keepout[old_horizontal] < 100
    assert speed[old_horizontal] == 0


def test_migration_preserves_old_zone_and_can_follow_startup_patch(monkeypatch):
    path = Path(__file__).parents[1] / "alembic/versions/a71f06e923c4_add_zone_yaw.py"
    spec = importlib.util.spec_from_file_location("zone_yaw_migration", path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    engine = create_engine("sqlite://")
    with engine.begin() as conn:
        conn.execute(text("CREATE TABLE zones (id TEXT PRIMARY KEY, name TEXT)"))
        conn.execute(text("INSERT INTO zones VALUES ('old', 'Existing zone')"))
        monkeypatch.setattr(migration, "op", Operations(MigrationContext.configure(conn)))
        migration.upgrade()
        migration.upgrade()  # column may already exist after application startup
        assert conn.execute(text("SELECT name, yaw FROM zones")).one() == ("Existing zone", 0)
    engine.dispose()
