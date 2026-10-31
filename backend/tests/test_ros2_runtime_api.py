from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from app.api.v1.endpoints import map as map_endpoint
from app.main import app
from app.services.hardware.ros2_runtime_service import Ros2RuntimeError, Ros2RuntimeService


def test_runtime_service_normalizes_map_names(tmp_path: Path):
    service = Ros2RuntimeService(project_root=tmp_path)
    assert service.normalize_map_name(" Phòng lab A ") == "Ph_ng_lab_A"
    assert service.normalize_map_name("floor-1_map") == "floor-1_map"
    with pytest.raises(Ros2RuntimeError):
        service.normalize_map_name("***")


def _write_pgm(path: Path, width: int, height: int, pixels: bytes):
    path.write_bytes(f"P5\n# test map\n{width} {height}\n255\n".encode("ascii") + pixels)


def test_runtime_service_accepts_non_empty_ros_map(tmp_path: Path):
    pgm_path = tmp_path / "valid.pgm"
    pixels = bytes([0] * 10 + [254] * 190 + [205] * 25)
    _write_pgm(pgm_path, 15, 15, pixels)

    stats = Ros2RuntimeService._read_pgm_stats(pgm_path)
    Ros2RuntimeService._validate_map_stats(stats)

    assert stats == {"width": 15, "height": 15, "occupied": 10, "free": 190, "known": 200}


def test_runtime_service_rejects_empty_ros_map(tmp_path: Path):
    pgm_path = tmp_path / "empty.pgm"
    _write_pgm(pgm_path, 20, 20, bytes([205] * 400))

    stats = Ros2RuntimeService._read_pgm_stats(pgm_path)
    with pytest.raises(Ros2RuntimeError, match="Từ chối lưu"):
        Ros2RuntimeService._validate_map_stats(stats)


def test_export_pgm_to_json_uses_bottom_row_as_origin(tmp_path: Path):
    """PGM hàng 0 là đỉnh ảnh; JSON grid_data hàng 0 phải là đáy (origin_y)."""
    import json

    service = Ros2RuntimeService(project_root=tmp_path)
    service.maps_dir.mkdir(parents=True)
    pgm_path = service.maps_dir / "flip.pgm"
    yaml_path = service.maps_dir / "flip.yaml"
    # 2x2: hàng trên cùng của ảnh là vật cản, hàng dưới là vùng trống.
    _write_pgm(pgm_path, 2, 2, bytes([0, 0, 254, 254]))
    yaml_path.write_text("image: flip.pgm\nresolution: 0.05\norigin: [-1.0, -2.0, 0.0]\n", encoding="utf-8")

    service._export_pgm_to_json(pgm_path, yaml_path, "flip")

    data = json.loads((service.maps_dir / "flip.json").read_text(encoding="utf-8"))
    assert data["grid_data"] == [0, 0, 100, 100]
    assert (data["origin_x"], data["origin_y"], data["resolution"]) == (-1.0, -2.0, 0.05)


@pytest.mark.asyncio
async def test_ros2_runtime_web_endpoints(monkeypatch):
    service = map_endpoint.ros2_runtime_service
    monkeypatch.setattr(
        service,
        "get_status",
        lambda: {
            "status": "ONLINE",
            "mode": "MAPPING",
            "rosbridge_online": True,
            "foxglove_online": True,
        },
    )
    monkeypatch.setattr(
        service,
        "start_mapping",
        lambda: {"status": "STARTING", "mode": "MAPPING", "pid": 123},
    )
    monkeypatch.setattr(
        service,
        "save_map",
        lambda name: {"status": "SUCCESS", "mode": "PAUSED", "map_name": name},
    )
    monkeypatch.setattr(
        service,
        "start_navigation",
        lambda name: {"status": "STARTING", "mode": "NAVIGATION", "map_name": name},
    )

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        status_response = await client.get("/api/v1/map/ros2/runtime")
        assert status_response.status_code == 200
        assert status_response.json()["mode"] == "MAPPING"

        mapping_response = await client.post("/api/v1/map/ros2/start_mapping")
        assert mapping_response.status_code == 200
        assert mapping_response.json()["mode"] == "MAPPING"

        save_response = await client.post("/api/v1/map/ros2/save", json={"name": "floor_1"})
        assert save_response.status_code == 200
        assert save_response.json()["map_name"] == "floor_1"

        navigation_response = await client.post(
            "/api/v1/map/ros2/start_navigation",
            json={"name": "floor_1"},
        )
        assert navigation_response.status_code == 200
        assert navigation_response.json()["mode"] == "NAVIGATION"
