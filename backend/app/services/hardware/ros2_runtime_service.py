"""Control the local WSL2 ROS 2 mapping/navigation runtime from the web API."""

from __future__ import annotations

import logging
import os
import re
import shutil
import socket
import subprocess
import threading
import time
from datetime import datetime
from pathlib import Path
from typing import Optional

from .ros2_map_utils import (
    KEEPOUT_NEAR_M,
    KEEPOUT_SOFT_BAND_M,
    KEEPOUT_SOFT_DECAY,
    ZONE_HARD_MARGIN_M,
    Ros2RuntimeError,
    build_keepout_pixels,
    build_speed_pixels,
    export_pgm_to_json,
    keepout_value,
    load_map_grid,
    read_pgm_stats,
    write_mask_files,
    zone_cells,
)

logger = logging.getLogger(__name__)

# Tu quet: SLAM active + cho cam bien (toi 30 lan) + /map + Nav2 + dem nguoc 10 s ~ 1-2 phut.
EXPLORE_START_GUARD_SEC = 150.0

__all__ = [
    "EXPLORE_START_GUARD_SEC",
    "KEEPOUT_NEAR_M",
    "KEEPOUT_SOFT_BAND_M",
    "KEEPOUT_SOFT_DECAY",
    "ZONE_HARD_MARGIN_M",
    "Ros2RuntimeError",
    "Ros2RuntimeService",
    "ros2_runtime_service",
]


class Ros2RuntimeService:
    def __init__(self, project_root: Optional[Path] = None, distro: str = "Ubuntu-24.04"):
        self.project_root = (project_root or Path(__file__).resolve().parents[4]).resolve()
        self.distro = distro
        self.scripts_dir = self.project_root / "robot" / "ros2_configs"
        self.maps_dir = self.project_root / "robot" / "maps"
        self.runtime_dir = self.project_root / "output" / "runtime"
        self._lock = threading.Lock()
        self._launcher: Optional[subprocess.Popen] = None
        # (tien trinh, time.monotonic() luc bam) cua lan bat tu quet gan nhat - chan bam trung
        self._explore_launch: Optional[tuple[subprocess.Popen, float]] = None
        self._last_mode = "OFFLINE"
        self._last_map: Optional[str] = None

    @staticmethod
    def normalize_map_name(raw_name: str) -> str:
        safe_name = re.sub(r"[^A-Za-z0-9_-]+", "_", (raw_name or "").strip()).strip("_")
        if not safe_name:
            raise Ros2RuntimeError("Tên bản đồ không hợp lệ.")
        return safe_name[:80]

    @staticmethod
    def _to_wsl_path(path: Path) -> str:
        resolved = path.resolve()
        posix = resolved.as_posix()
        if len(posix) >= 3 and posix[1:3] == ":/":
            return f"/mnt/{posix[0].lower()}/{posix[3:]}"
        return posix

    @staticmethod
    def _port_open(port: int) -> bool:
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=0.35):
                return True
        except OSError:
            return False

    @property
    def _creation_flags(self) -> int:
        return int(getattr(subprocess, "CREATE_NO_WINDOW", 0)) | int(
            getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)
        )

    def _wsl_command(self, script_name: str, *args: str, env: Optional[dict] = None) -> list[str]:
        script_path = self.scripts_dir / script_name
        if not script_path.is_file():
            raise Ros2RuntimeError(f"Không tìm thấy script ROS 2: {script_path}")
        # Biến môi trường Windows không tự sang WSL: truyền qua `env K=V bash script`.
        env_prefix = ["env", *(f"{k}={v}" for k, v in env.items())] if env else []
        return [
            "wsl.exe",
            "-d",
            self.distro,
            "--",
            *env_prefix,
            "bash",
            self._to_wsl_path(script_path),
            *args,
        ]

    def _spawn(self, script_name: str, *args: str, log_prefix: str, env: Optional[dict] = None) -> int:
        self.runtime_dir.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        stdout_path = self.runtime_dir / f"{log_prefix}-{timestamp}.out.log"
        stderr_path = self.runtime_dir / f"{log_prefix}-{timestamp}.err.log"
        command = self._wsl_command(script_name, *args, env=env)

        with self._lock:
            self._explore_launch = None  # script moi (map/nav/quet) thay the phien tu quet cu
            stdout_handle = open(stdout_path, "a", encoding="utf-8")
            stderr_handle = open(stderr_path, "a", encoding="utf-8")
            try:
                self._launcher = subprocess.Popen(
                    command,
                    cwd=str(self.project_root),
                    stdin=subprocess.DEVNULL,
                    stdout=stdout_handle,
                    stderr=stderr_handle,
                    creationflags=self._creation_flags,
                )
            except OSError as exc:
                raise Ros2RuntimeError(f"Không thể khởi động WSL2: {exc}") from exc
            finally:
                stdout_handle.close()
                stderr_handle.close()

        return int(self._launcher.pid)

    def start_mapping(self) -> dict:
        pid = self._spawn("start_wsl_slam.sh", log_prefix="foxglove-mapping-web")
        self._last_mode = "MAPPING"
        self._last_map = None
        return {
            "status": "STARTING",
            "mode": "MAPPING",
            "pid": pid,
            "message": "Đang khởi động Slam Toolbox và Foxglove để quét bản đồ realtime.",
        }

    def start_exploration(self, raw_name: str, auto_save: bool = True) -> dict:
        """Xe THẬT tự đi quét map: SLAM + Nav2 + frontier explorer (start_wsl_slam.sh EXPLORE=1)."""
        safe_name = self.normalize_map_name(raw_name) if auto_save else ""
        launch = self._explore_launch
        if launch is not None:
            proc, started_at = launch
            elapsed = time.monotonic() - started_at
            if proc.poll() is None and elapsed < EXPLORE_START_GUARD_SEC:
                return {
                    "status": "ALREADY_STARTING",
                    "mode": "EXPLORING",
                    "map_name": self._last_map,
                    "pid": proc.pid,
                    "message": (
                        f"Robot đang khởi động tự quét từ lần bấm trước ({elapsed:.0f} s trước): bật SLAM, "
                        "kiểm tra Pi/LiDAR/encoder rồi đếm ngược 10 s. Không khởi động lại - chờ thêm."
                    ),
                }
        env = {"EXPLORE": "1", "EXPLORE_SAVE": safe_name}
        if os.getenv("PI5_IP"):
            env["PI5_IP"] = os.environ["PI5_IP"]
        pid = self._spawn("start_wsl_slam.sh", log_prefix="explore-web", env=env)
        if self._launcher is not None:
            self._explore_launch = (self._launcher, time.monotonic())
        self._last_mode = "EXPLORING"
        self._last_map = safe_name or None
        return {
            "status": "STARTING",
            "mode": "EXPLORING",
            "map_name": safe_name or None,
            "pid": pid,
            "message": (
                "Đang bật SLAM + Nav2. Kiểm tra cảm biến xong, robot sẽ TỰ CHẠY sau khoảng 10 giây "
                "đếm ngược. Bấm Dừng Quét hoặc E-STOP để dừng."
            ),
        }

    def _send_udp_stop(self, repeats: int = 5) -> None:
        """Gửi thẳng 'stop' tới main.py trên Pi (UDP 9999), không phụ thuộc bridge ROS."""
        target = (os.getenv("PI5_IP", "100.93.152.7"), int(os.getenv("PI5_PORT", "9999")))
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            for _ in range(repeats):
                try:
                    sock.sendto(b"stop", target)
                except OSError as exc:
                    logger.warning("Không gửi được UDP stop tới %s: %s", target, exc)
                time.sleep(0.1)
        finally:
            sock.close()

    def stop_exploration(self) -> dict:
        """Dừng xe tự quét: tắt explorer + Nav2 (ngừng /cmd_vel) rồi gửi stop tới Pi."""
        self._explore_launch = None
        kill_cmd = (
            "pkill -f '[f]rontier_explorer.py'; "
            "pkill -f '[n]avigation_launch.py'; "
            "killall -q controller_server planner_server behavior_server bt_navigator "
            "waypoint_follower lifecycle_manager; true"
        )
        try:
            subprocess.run(
                ["wsl.exe", "-d", self.distro, "--", "bash", "-lc", kill_cmd],
                capture_output=True,
                text=True,
                timeout=15,
                creationflags=self._creation_flags,
            )
        except (OSError, subprocess.TimeoutExpired) as exc:
            logger.warning("Không tắt được explorer/Nav2 trong WSL: %s", exc)
        finally:
            self._send_udp_stop()
        self._last_mode = "MAPPING"
        return {
            "status": "STOPPED",
            "mode": "MAPPING",
            "message": "Đã dừng tự quét, robot đứng yên. SLAM vẫn chạy: có thể lưu map hoặc lái tay tiếp.",
        }

    _read_pgm_stats = staticmethod(read_pgm_stats)
    _zone_cells = staticmethod(zone_cells)
    _keepout_value = staticmethod(keepout_value)
    _write_mask = staticmethod(write_mask_files)

    @staticmethod
    def _validate_map_stats(stats: dict) -> None:
        if stats["known"] < 1:
            raise Ros2RuntimeError("Từ chối lưu vì bản đồ chưa nhận được dữ liệu tia quét nào.")

    def _export_pgm_to_json(self, pgm_path: Path, yaml_path: Path, safe_name: str) -> None:
        export_pgm_to_json(pgm_path, yaml_path, safe_name, self.maps_dir, self.project_root)

    def save_map(self, raw_name: str) -> dict:
        current_mode = self._detect_mode()
        if current_mode != "MAPPING":
            if current_mode == "NAVIGATION":
                raise Ros2RuntimeError(
                    "Đang ở NAVIGATION: /map là file tĩnh do map_server phát nên không thể ghi thêm layout. "
                    "Hãy bấm '1. Bắt Đầu Quét Map', lái robot quét đủ khu vực, rồi mới '2. Lưu & Khóa'."
                )
            raise Ros2RuntimeError(
                "SLAM Toolbox chưa chạy ở chế độ MAPPING. Hãy bấm '1. Bắt Đầu Quét Map' trước khi lưu."
            )
        safe_name = self.normalize_map_name(raw_name)
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S%f")
        pending_name = f"pending_{safe_name}_{timestamp}"
        command = self._wsl_command("save_ros2_map.sh", pending_name, "--no-pause")
        try:
            completed = subprocess.run(
                command,
                cwd=str(self.project_root),
                capture_output=True,
                text=True,
                timeout=60,
                creationflags=self._creation_flags,
            )
        except subprocess.TimeoutExpired as exc:
            raise Ros2RuntimeError("Lưu map quá thời gian chờ 60 giây.") from exc
        except OSError as exc:
            raise Ros2RuntimeError(f"Không thể gọi WSL2 để lưu map: {exc}") from exc

        pending_yaml = self.maps_dir / f"{pending_name}.yaml"
        pending_pgm = self.maps_dir / f"{pending_name}.pgm"
        yaml_path = self.maps_dir / f"{safe_name}.yaml"
        pgm_path = self.maps_dir / f"{safe_name}.pgm"
        if completed.returncode != 0 or not pending_yaml.is_file() or not pending_pgm.is_file():
            pending_yaml.unlink(missing_ok=True)
            pending_pgm.unlink(missing_ok=True)
            details = (completed.stderr or completed.stdout or "Không có log lỗi").strip()
            raise Ros2RuntimeError(f"Không lưu được map ROS 2: {details[-800:]}")

        try:
            map_stats = self._read_pgm_stats(pending_pgm)
            self._validate_map_stats(map_stats)
            yaml_text = pending_yaml.read_text(encoding="utf-8")
            yaml_text = re.sub(r"(?m)^image:\s*.*$", f"image: {safe_name}.pgm", yaml_text, count=1)
            pending_yaml.write_text(yaml_text, encoding="utf-8")
            os.replace(pending_pgm, pgm_path)
            os.replace(pending_yaml, yaml_path)

            static_dir = self.project_root / "backend" / "static" / "maps"
            if static_dir.is_dir():
                try:
                    shutil.copy2(pgm_path, static_dir / f"{safe_name}.pgm")
                    shutil.copy2(yaml_path, static_dir / f"{safe_name}.yaml")
                except Exception:
                    pass

            try:
                self._export_pgm_to_json(pgm_path, yaml_path, safe_name)
            except Exception as exc:
                logger.warning("Không xuất được JSON cho map '%s': %s", safe_name, exc)
        except Exception:
            pending_yaml.unlink(missing_ok=True)
            pending_pgm.unlink(missing_ok=True)
            raise

        self._last_map = safe_name
        return {
            "status": "SUCCESS",
            "mode": "VALIDATED",
            "map_name": safe_name,
            "yaml_path": str(yaml_path),
            "pgm_path": str(pgm_path),
            "map_stats": map_stats,
            "message": f"Đã lưu và xác thực bản đồ '{safe_name}', sẵn sàng chuyển sang Navigation.",
        }

    def keepout_mask_paths(self, safe_name: str) -> tuple[Path, Path]:
        mask_dir = self.maps_dir / "keepout"
        return mask_dir / f"{safe_name}.yaml", mask_dir / f"{safe_name}.pgm"

    def speed_mask_paths(self, safe_name: str) -> tuple[Path, Path]:
        mask_dir = self.maps_dir / "speed"
        return mask_dir / f"{safe_name}.yaml", mask_dir / f"{safe_name}.pgm"

    def _map_grid(self, safe_name: str) -> tuple[int, int, float, float, float]:
        """(rong, cao, do phan giai, goc x, goc y) cua map da luu - mask phai trung khit map."""
        return load_map_grid(self.maps_dir / f"{safe_name}.yaml", f"{safe_name}.pgm")

    def write_keepout_mask(self, raw_name: str, zones: list[dict], margin_m: float = ZONE_HARD_MARGIN_M) -> dict:
        """Tao mask Keepout Filter cho Nav2 tu cac vung KEEP_OUT cua map."""
        safe_name = self.normalize_map_name(raw_name)
        grid = self._map_grid(safe_name)
        pixels, count = build_keepout_pixels(zones, grid, margin_m)
        paths = self.keepout_mask_paths(safe_name)
        self._write_mask(paths, grid, pixels, "raw")
        logger.info("Keepout mask '%s': %d vùng KEEP_OUT", safe_name, count)
        return {"map_name": safe_name, "keepout_zones": count, "mask_yaml": str(paths[0])}

    def write_speed_mask(self, raw_name: str, zones: list[dict], margin_m: float = ZONE_HARD_MARGIN_M) -> dict:
        """Tao mask Speed Filter cho Nav2 tu cac vung SPEED_ZONE."""
        safe_name = self.normalize_map_name(raw_name)
        grid = self._map_grid(safe_name)
        pixels, count = build_speed_pixels(zones, grid, margin_m)
        paths = self.speed_mask_paths(safe_name)
        self._write_mask(paths, grid, pixels, "raw")
        logger.info("Speed mask '%s': %d vùng SPEED_ZONE", safe_name, count)
        return {"map_name": safe_name, "speed_zones": count, "speed_mask_yaml": str(paths[0])}

    def write_zone_masks(self, raw_name: str, zones: list[dict]) -> dict:
        """Ghi ca mask vung cam (KEEP_OUT) va mask gioi han toc do (SPEED_ZONE) cho Nav2."""
        return {**self.write_keepout_mask(raw_name, zones), **self.write_speed_mask(raw_name, zones)}

    def reload_zone_masks(self, raw_name: str) -> dict:
        """Nav2 dang chay thi nap lai cac mask ngay (khong can khoi dong lai Navigation)."""
        safe_name = self.normalize_map_name(raw_name)
        servers = {
            "keepout": ("filter_mask_server", self.keepout_mask_paths(safe_name)[0]),
            "speed": ("speed_mask_server", self.speed_mask_paths(safe_name)[0]),
        }
        reloaded = {key: False for key in servers}
        if self._detect_mode() != "NAVIGATION":
            return reloaded
        calls = [
            f"echo '##{server}'; timeout 10 ros2 service call /{server}/load_map nav2_msgs/srv/LoadMap "
            f"\"{{map_url: '{self._to_wsl_path(mask_yaml)}'}}\""
            for server, mask_yaml in servers.values() if mask_yaml.is_file()
        ]
        if not calls:
            return reloaded
        command = [
            "wsl.exe", "-d", self.distro, "--", "bash", "-lc",
            "source /opt/ros/jazzy/setup.bash; " + "; ".join(calls),
        ]
        try:
            result = subprocess.run(
                command, capture_output=True, text=True, timeout=30, creationflags=self._creation_flags
            )
        except (OSError, subprocess.TimeoutExpired) as exc:
            logger.warning("Không nạp lại được mask vùng: %s", exc)
            return reloaded
        sections = {}
        for chunk in result.stdout.split("##")[1:]:
            name, _, body = chunk.partition("\n")
            sections[name.strip()] = "result=0" in body.replace(" ", "")
        return {key: sections.get(server, False) for key, (server, _) in servers.items()}

    def start_navigation(self, raw_name: str, zones: Optional[list[dict]] = None,
                         pi_ip: Optional[str] = None) -> dict:
        safe_name = self.normalize_map_name(raw_name)
        yaml_path = self.maps_dir / f"{safe_name}.yaml"
        if not yaml_path.is_file():
            raise Ros2RuntimeError(f"Chưa có bản đồ '{safe_name}'. Hãy quét và lưu map trước.")
        if zones is not None:
            self.write_zone_masks(safe_name, zones)

        env = {"PI5_IP": pi_ip or os.environ["PI5_IP"]} if pi_ip or os.getenv("PI5_IP") else None
        pid = self._spawn(
            "start_wsl_foxglove.sh",
            "navigation",
            safe_name,
            log_prefix="foxglove-navigation-web",
            env=env,
        )
        self._last_mode = "NAVIGATION"
        self._last_map = safe_name
        return {
            "status": "STARTING",
            "mode": "NAVIGATION",
            "map_name": safe_name,
            "pid": pid,
            "message": f"Đang nạp static map '{safe_name}' bằng Map Server + AMCL + Nav2.",
        }

    def _detect_mode(self) -> str:
        command = [
            "wsl.exe",
            "-d",
            self.distro,
            "--",
            "bash",
            "-lc",
            "if pgrep -f '[f]rontier_explorer.py' >/dev/null; then echo EXPLORING; "
            "elif pgrep -f '[a]sync_slam_toolbox_node' >/dev/null; then echo MAPPING; "
            "elif pgrep -f '[m]ap_server' >/dev/null && pgrep -f '[a]mcl' >/dev/null; then echo NAVIGATION; "
            "else echo OFFLINE; fi",
        ]
        try:
            result = subprocess.run(
                command,
                capture_output=True,
                text=True,
                timeout=3,
                creationflags=self._creation_flags,
            )
            detected = result.stdout.strip().splitlines()[-1] if result.stdout.strip() else "OFFLINE"
            return detected if detected in {"MAPPING", "EXPLORING", "NAVIGATION"} else "OFFLINE"
        except (OSError, subprocess.TimeoutExpired):
            return "OFFLINE"

    def get_status(self) -> dict:
        rosbridge_online = self._port_open(9090)
        foxglove_online = self._port_open(8765)
        mode = self._detect_mode() if rosbridge_online else "OFFLINE"
        if mode != "OFFLINE":
            self._last_mode = mode
        if rosbridge_online and foxglove_online:
            status = "ONLINE"
        elif rosbridge_online or foxglove_online:
            status = "STARTING"
        else:
            status = "OFFLINE"
        return {
            "status": status,
            "mode": mode,
            "active_map": self._last_map,
            "rosbridge_online": rosbridge_online,
            "foxglove_online": foxglove_online,
            "rosbridge_url": "ws://127.0.0.1:9090",
            "foxglove_ws_url": "ws://127.0.0.1:8765",
            "foxglove_web_url": (
                "https://app.foxglove.dev/~/view?ds=foxglove-websocket&"
                "ds.url=ws%3A%2F%2F127.0.0.1%3A8765"
            ),
        }


ros2_runtime_service = Ros2RuntimeService()
