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


def _zone_service(tmp_path: Path) -> Ros2RuntimeService:
    """Map 4 x 2 m, 0.1 m/o, goc (0, 0)."""
    service = Ros2RuntimeService(project_root=tmp_path)
    service.maps_dir.mkdir(parents=True)
    _write_pgm(service.maps_dir / "zmap.pgm", 40, 20, bytes([254] * 800))
    (service.maps_dir / "zmap.yaml").write_text(
        "image: zmap.pgm\nresolution: 0.1\norigin: [0.0, 0.0, 0.0]\n", encoding="utf-8"
    )
    return service


def _mask_value(pgm: Path, x: float, y: float, res: float = 0.1) -> int:
    magic, size, _maxval, pixels = pgm.read_bytes().split(b"\n", 3)
    assert magic == b"P5"
    width, height = (int(v) for v in size.split())
    gx, gy = int(x / res), int(y / res)
    return pixels[(height - 1 - gy) * width + gx]  # PGM hang 0 = dinh anh


def test_speed_mask_encodes_limit_and_keeps_slowest_overlap(tmp_path: Path):
    service = _zone_service(tmp_path)
    zones = [
        {"type": "SPEED_ZONE", "x": 1.0, "y": 1.0, "width": 0.6, "height": 0.6, "speed_limit": 0.12},
        {"type": "SPEED_ZONE", "x": 1.5, "y": 1.0, "width": 0.6, "height": 0.6, "speed_limit": 0.30},
        {"type": "KEEP_OUT", "x": 3.0, "y": 1.0, "width": 0.4, "height": 0.4, "speed_limit": 0.0},
        {"type": "NO_STOP", "x": 3.0, "y": 0.5, "width": 0.4, "height": 0.4, "speed_limit": 0.15},
    ]
    result = service.write_speed_mask("zmap", zones, robot_radius=0.0)
    mask_yaml, mask_pgm = service.speed_mask_paths("zmap")

    assert result["speed_zones"] == 2
    # raw: gia tri o = diem anh (0..100) -> SpeedFilter: speed = 0.0 + 0.01 * gia tri (m/s), 0 = khong gioi han
    assert "mode: raw" in mask_yaml.read_text(encoding="utf-8")
    assert _mask_value(mask_pgm, 0.85, 1.0) == 12
    assert _mask_value(mask_pgm, 1.65, 1.0) == 30
    assert _mask_value(mask_pgm, 1.25, 1.0) == 12  # chong nhau -> lay vung cham hon
    assert _mask_value(mask_pgm, 3.05, 1.05) == 0  # KEEP_OUT/NO_STOP khong nam trong mask toc do
    assert _mask_value(mask_pgm, 0.25, 0.25) == 0


def test_speed_mask_skips_non_positive_limit_and_caps_at_one_mps(tmp_path: Path):
    service = _zone_service(tmp_path)
    zones = [
        {"type": "SPEED_ZONE", "x": 1.0, "y": 1.0, "width": 0.6, "height": 0.6, "speed_limit": 0.0},
        {"type": "SPEED_ZONE", "x": 3.0, "y": 1.0, "width": 0.6, "height": 0.6, "speed_limit": 2.5},
    ]
    result = service.write_speed_mask("zmap", zones, robot_radius=0.0)
    _, mask_pgm = service.speed_mask_paths("zmap")
    assert result["speed_zones"] == 1
    assert _mask_value(mask_pgm, 1.0, 1.0) == 0
    assert _mask_value(mask_pgm, 3.0, 1.0) == 100


def test_write_zone_masks_writes_keepout_and_speed_masks(tmp_path: Path):
    service = _zone_service(tmp_path)
    zones = [
        {"type": "KEEP_OUT", "x": 3.0, "y": 1.0, "width": 0.4, "height": 0.4},
        {"type": "SPEED_ZONE", "x": 1.0, "y": 1.0, "width": 0.6, "height": 0.6, "speed_limit": 0.12},
    ]
    result = service.write_zone_masks("zmap", zones)
    assert result["keepout_zones"] == 1 and result["speed_zones"] == 1
    for yaml_path, pgm_path in (service.keepout_mask_paths("zmap"), service.speed_mask_paths("zmap")):
        assert yaml_path.is_file() and pgm_path.is_file()
    assert _mask_value(service.keepout_mask_paths("zmap")[1], 3.0, 1.0) == 0  # keepout = den


def test_reload_zone_masks_loads_both_masks_when_navigation_runs(tmp_path: Path, monkeypatch):
    service = _zone_service(tmp_path)
    service.write_zone_masks("zmap", [])
    ran = []

    def fake_run(command, **kwargs):
        ran.append(command[-1])

        class R:
            returncode, stderr = 0, ""
            stdout = "##filter_mask_server\nresponse: result=0\n##speed_mask_server\nresponse: result=0\n"

        return R()

    monkeypatch.setattr(service, "_detect_mode", lambda: "NAVIGATION")
    monkeypatch.setattr("app.services.hardware.ros2_runtime_service.subprocess.run", fake_run)
    assert service.reload_zone_masks("zmap") == {"keepout": True, "speed": True}
    assert "/filter_mask_server/load_map" in ran[0] and "/speed_mask_server/load_map" in ran[0]

    monkeypatch.setattr(service, "_detect_mode", lambda: "MAPPING")
    assert service.reload_zone_masks("zmap") == {"keepout": False, "speed": False}


def _fake_scripts(tmp_path: Path) -> Ros2RuntimeService:
    service = Ros2RuntimeService(project_root=tmp_path)
    service.scripts_dir.mkdir(parents=True)
    (service.scripts_dir / "start_wsl_slam.sh").write_text("#!/bin/bash\n", encoding="utf-8")
    return service


def test_start_exploration_launches_slam_script_with_explore_env(tmp_path: Path, monkeypatch):
    service = _fake_scripts(tmp_path)
    launched = {}

    class FakePopen:
        pid = 4242

        def __init__(self, command, **kwargs):
            launched["command"] = command

    monkeypatch.setattr("app.services.hardware.ros2_runtime_service.subprocess.Popen", FakePopen)

    result = service.start_exploration("Phòng khách")

    cmd = launched["command"]
    assert cmd[:4] == ["wsl.exe", "-d", "Ubuntu-24.04", "--"]
    assert cmd[4] == "env" and "EXPLORE=1" in cmd and "EXPLORE_SAVE=Ph_ng_kh_ch" in cmd
    assert cmd[-1].endswith("/robot/ros2_configs/start_wsl_slam.sh")
    assert result["mode"] == "EXPLORING" and result["map_name"] == "Ph_ng_kh_ch"


def test_start_exploration_without_auto_save_passes_empty_save_name(tmp_path: Path, monkeypatch):
    service = _fake_scripts(tmp_path)
    launched = {}

    class FakePopen:
        pid = 1

        def __init__(self, command, **kwargs):
            launched["command"] = command

    monkeypatch.setattr("app.services.hardware.ros2_runtime_service.subprocess.Popen", FakePopen)
    service.start_exploration("ignored", auto_save=False)
    assert "EXPLORE_SAVE=" in launched["command"]


def test_navigation_forwards_selected_pi_to_motor_bridge(tmp_path: Path, monkeypatch):
    service = Ros2RuntimeService(project_root=tmp_path)
    service.maps_dir.mkdir(parents=True)
    (service.maps_dir / "phong_test.yaml").write_text("image: phong_test.pgm\n", encoding="utf-8")
    calls = []
    monkeypatch.setattr(service, "_spawn", lambda *args, **kwargs: calls.append((args, kwargs)) or 123)
    result = service.start_navigation("phong_test", pi_ip="100.99.72.51")
    assert result["mode"] == "NAVIGATION" and result["map_name"] == "phong_test"
    assert calls[0][0] == ("start_wsl_foxglove.sh", "navigation", "phong_test")
    assert calls[0][1]["env"] == {"PI5_IP": "100.99.72.51"}


def test_navigation_request_validates_pi_address():
    from pydantic import ValidationError
    assert str(map_endpoint.Ros2MapRequest(name="phong_test", pi_ip="100.99.72.51").pi_ip) == "100.99.72.51"
    with pytest.raises(ValidationError):
        map_endpoint.Ros2MapRequest(name="phong_test", pi_ip="100.99.72.51; reboot")


def test_stop_exploration_kills_explorer_and_nav2_but_keeps_slam_and_stops_motors(tmp_path: Path, monkeypatch):
    service = _fake_scripts(tmp_path)
    ran, sent = [], []

    def fake_run(command, **kwargs):
        ran.append(command)

        class R:
            returncode, stdout, stderr = 0, "", ""

        return R()

    class FakeSock:
        def __init__(self, *a, **k):
            pass

        def sendto(self, data, addr):
            sent.append((data, addr))

        def close(self):
            pass

    monkeypatch.setattr("app.services.hardware.ros2_runtime_service.subprocess.run", fake_run)
    monkeypatch.setattr("app.services.hardware.ros2_runtime_service.socket.socket", FakeSock)
    monkeypatch.setattr("app.services.hardware.ros2_runtime_service.time.sleep", lambda s: None)
    monkeypatch.setenv("PI5_IP", "10.0.0.7")

    result = service.stop_exploration()

    shell = ran[0][-1]
    assert "rontier_explorer.py" in shell and "controller_server" in shell  # '[f]rontier...' cho pkill
    assert "slam_toolbox" not in shell  # giu SLAM de con luu duoc map
    assert sent and all(d == b"stop" and a == ("10.0.0.7", 9999) for d, a in sent)
    assert result["mode"] == "MAPPING"


@pytest.mark.asyncio
async def test_ros2_explore_endpoints(monkeypatch):
    service = map_endpoint.ros2_runtime_service
    monkeypatch.setattr(
        service,
        "start_exploration",
        lambda name, auto_save=True: {"status": "STARTING", "mode": "EXPLORING", "map_name": name,
                                      "auto_save": auto_save},
    )
    monkeypatch.setattr(service, "stop_exploration", lambda: {"status": "STOPPED", "mode": "MAPPING"})

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/v1/map/ros2/start_explore", json={"name": "phong_a", "auto_save": False})
        assert res.status_code == 200
        assert res.json() == {"status": "STARTING", "mode": "EXPLORING", "map_name": "phong_a", "auto_save": False}

        res = await client.post("/api/v1/map/ros2/stop_explore")
        assert res.status_code == 200 and res.json()["status"] == "STOPPED"


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
        lambda name, zones=None: {"status": "STARTING", "mode": "NAVIGATION", "map_name": name},
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
