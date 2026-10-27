"""Control the local WSL2 ROS 2 mapping/navigation runtime from the web API."""

from __future__ import annotations

import os
import re
import socket
import subprocess
import threading
from datetime import datetime
from pathlib import Path
from typing import Optional


class Ros2RuntimeError(RuntimeError):
    """Raised when the local ROS 2 runtime cannot complete an operation."""


class Ros2RuntimeService:
    def __init__(self, project_root: Optional[Path] = None, distro: str = "Ubuntu-24.04"):
        self.project_root = (project_root or Path(__file__).resolve().parents[4]).resolve()
        self.distro = distro
        self.scripts_dir = self.project_root / "robot" / "ros2_configs"
        self.maps_dir = self.project_root / "robot" / "maps"
        self.runtime_dir = self.project_root / "output" / "runtime"
        self._lock = threading.Lock()
        self._launcher: Optional[subprocess.Popen] = None
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

    def _wsl_command(self, script_name: str, *args: str) -> list[str]:
        script_path = self.scripts_dir / script_name
        if not script_path.is_file():
            raise Ros2RuntimeError(f"Không tìm thấy script ROS 2: {script_path}")
        return [
            "wsl.exe",
            "-d",
            self.distro,
            "--",
            "bash",
            self._to_wsl_path(script_path),
            *args,
        ]

    def _spawn(self, script_name: str, *args: str, log_prefix: str) -> int:
        self.runtime_dir.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        stdout_path = self.runtime_dir / f"{log_prefix}-{timestamp}.out.log"
        stderr_path = self.runtime_dir / f"{log_prefix}-{timestamp}.err.log"
        command = self._wsl_command(script_name, *args)

        with self._lock:
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
        pid = self._spawn(
            "start_wsl_rviz_web.sh",
            "mapping",
            log_prefix="rviz-mapping-web",
        )
        self._last_mode = "MAPPING"
        self._last_map = None
        return {
            "status": "STARTING",
            "mode": "MAPPING",
            "pid": pid,
            "message": "Đang khởi động Slam Toolbox và RViz Web để quét bản đồ.",
        }

    @staticmethod
    def _read_pgm_stats(pgm_path: Path) -> dict:
        """Read a binary PGM and count real map cells without image dependencies."""
        raw = pgm_path.read_bytes()
        cursor = 0
        tokens: list[bytes] = []
        while len(tokens) < 4:
            while cursor < len(raw) and raw[cursor] in b" \t\r\n":
                cursor += 1
            if cursor < len(raw) and raw[cursor] == ord("#"):
                while cursor < len(raw) and raw[cursor] not in b"\r\n":
                    cursor += 1
                continue
            start = cursor
            while cursor < len(raw) and raw[cursor] not in b" \t\r\n":
                cursor += 1
            if start == cursor:
                raise Ros2RuntimeError("File PGM không có header hợp lệ.")
            tokens.append(raw[start:cursor])

        if tokens[0] != b"P5":
            raise Ros2RuntimeError("Map saver không tạo PGM binary P5 hợp lệ.")
        try:
            width, height, max_value = map(int, tokens[1:4])
        except ValueError as exc:
            raise Ros2RuntimeError("Kích thước PGM không hợp lệ.") from exc
        if width <= 0 or height <= 0 or max_value != 255:
            raise Ros2RuntimeError("Thông số PGM không hợp lệ.")

        # Header ends with one whitespace separator (or CRLF).
        if cursor < len(raw) and raw[cursor] == 13:
            cursor += 1
        if cursor < len(raw) and raw[cursor] == 10:
            cursor += 1
        elif cursor < len(raw) and raw[cursor] in b" \t":
            cursor += 1
        pixels = raw[cursor:cursor + width * height]
        if len(pixels) != width * height:
            raise Ros2RuntimeError("File PGM bị thiếu dữ liệu pixel.")

        # nav2_map_server uses 0=occupied, 254=free and 205=unknown.
        occupied = sum(value <= 100 for value in pixels)
        free = sum(value >= 250 for value in pixels)
        return {
            "width": width,
            "height": height,
            "occupied": occupied,
            "free": free,
            "known": occupied + free,
        }

    @staticmethod
    def _validate_map_stats(stats: dict) -> None:
        if stats["known"] < 1:
            raise Ros2RuntimeError(
                "Từ chối lưu vì bản đồ chưa nhận được dữ liệu tia quét nào."
            )

    def _export_pgm_to_json(self, pgm_path: Path, yaml_path: Path, safe_name: str) -> None:
        import yaml
        yaml_info = {}
        if yaml_path.is_file():
            try:
                yaml_info = yaml.safe_load(yaml_path.read_text(encoding="utf-8")) or {}
            except Exception:
                pass
        res = float(yaml_info.get("resolution", 0.05))
        origin = yaml_info.get("origin", [0.0, 0.0, 0.0])
        ox = float(origin[0]) if len(origin) > 0 else 0.0
        oy = float(origin[1]) if len(origin) > 1 else 0.0

        raw = pgm_path.read_bytes()
        cursor = 0
        tokens: list[bytes] = []
        while len(tokens) < 4:
            while cursor < len(raw) and raw[cursor] in b" \t\r\n":
                cursor += 1
            if cursor < len(raw) and raw[cursor] == ord("#"):
                while cursor < len(raw) and raw[cursor] not in b"\r\n":
                    cursor += 1
                continue
            start = cursor
            while cursor < len(raw) and raw[cursor] not in b" \t\r\n":
                cursor += 1
            if start == cursor:
                return
            tokens.append(raw[start:cursor])
        width, height = int(tokens[1]), int(tokens[2])
        if cursor < len(raw) and raw[cursor] in (10, 13):
            cursor += 1
        if cursor < len(raw) and raw[cursor] in (10, 13):
            cursor += 1
        pixels = raw[cursor:cursor + width * height]
        grid_data = []
        for val in pixels:
            if val <= 100:
                grid_data.append(100)
            elif val >= 250:
                grid_data.append(0)
            else:
                grid_data.append(-1)
        json_obj = {
            "name": safe_name,
            "width": width,
            "height": height,
            "resolution": res,
            "origin_x": ox,
            "origin_y": oy,
            "grid_data": grid_data,
            "saved_at": datetime.now().isoformat(),
        }
        json_bytes = json.dumps(json_obj).encode("utf-8")
        (self.maps_dir / f"{safe_name}.json").write_bytes(json_bytes)
        static_dir = self.project_root / "backend" / "static" / "maps"
        if static_dir.is_dir():
            (static_dir / f"{safe_name}.json").write_bytes(json_bytes)

    def save_map(self, raw_name: str) -> dict:
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
            yaml_text = re.sub(
                r"(?m)^image:\s*.*$",
                f"image: {safe_name}.pgm",
                yaml_text,
                count=1,
            )
            pending_yaml.write_text(yaml_text, encoding="utf-8")
            os.replace(pending_pgm, pgm_path)
            os.replace(pending_yaml, yaml_path)

            # Đồng bộ file sang backend/static/maps
            static_dir = self.project_root / "backend" / "static" / "maps"
            if static_dir.is_dir():
                try:
                    import shutil
                    shutil.copy2(pgm_path, static_dir / f"{safe_name}.pgm")
                    shutil.copy2(yaml_path, static_dir / f"{safe_name}.yaml")
                except Exception:
                    pass

            # Đồng bộ file .json cho Web Admin / Pi 5
            try:
                self._export_pgm_to_json(pgm_path, yaml_path, safe_name)
            except Exception:
                pass
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

    def start_navigation(self, raw_name: str) -> dict:
        safe_name = self.normalize_map_name(raw_name)
        yaml_path = self.maps_dir / f"{safe_name}.yaml"
        if not yaml_path.is_file():
            raise Ros2RuntimeError(f"Chưa có bản đồ '{safe_name}'. Hãy quét và lưu map trước.")

        pid = self._spawn(
            "start_wsl_rviz_web.sh",
            "navigation",
            safe_name,
            log_prefix="rviz-navigation-web",
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
            "if pgrep -f '[a]sync_slam_toolbox_node' >/dev/null; then echo MAPPING; "
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
            return detected if detected in {"MAPPING", "NAVIGATION"} else "OFFLINE"
        except (OSError, subprocess.TimeoutExpired):
            return "OFFLINE"

    def get_status(self) -> dict:
        rosbridge_online = self._port_open(9090)
        rviz_online = self._port_open(6080)
        mode = self._detect_mode() if rosbridge_online else "OFFLINE"
        if mode != "OFFLINE":
            self._last_mode = mode
        return {
            "status": "ONLINE" if rosbridge_online else "OFFLINE",
            "mode": mode,
            "active_map": self._last_map,
            "rosbridge_online": rosbridge_online,
            "rviz_online": rviz_online,
            "rosbridge_url": "ws://127.0.0.1:9090",
            "rviz_url": "http://127.0.0.1:6080/vnc.html?autoconnect=true&resize=scale",
        }


ros2_runtime_service = Ros2RuntimeService()
