"""Control the local WSL2 ROS 2 mapping/navigation runtime from the web API."""

from __future__ import annotations

import json
import logging
import math
import os
import re
import socket
import subprocess
import threading
import time
from datetime import datetime
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# Vung ve tren Web -> mask Nav2: phan CAM HAN / GIOI HAN TOC DO chi rong hon hinh ve vai cm
# (sai so dinh vi + lam tron o 5 cm). Truoc day noi 16 cm moi phia - nguoi dung thay "luu rong hon".
ZONE_HARD_MARGIN_M = 0.05
# Dai chi phi mem quanh vung cam (thay inflation, xem _keepout_value): ngay sat mep 99 trong
# KEEPOUT_NEAR_M (~nua be ngang xe 8.5 cm), giam dan, het hieu luc sau KEEPOUT_SOFT_BAND_M.
KEEPOUT_NEAR_M = 0.08
KEEPOUT_SOFT_BAND_M = 0.25
KEEPOUT_SOFT_DECAY = 8.0  # 1/m
# Tu quet: SLAM active + cho cam bien (toi 30 lan) + /map + Nav2 + dem nguoc 10 s ~ 1-2 phut.
EXPLORE_START_GUARD_SEC = 150.0


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
        # "Bắt đầu quét map" phải là một phiên SLAM mới. Không đi qua wrapper
        # reconnect vì wrapper cố ý giữ pose graph cũ khi phát hiện MAPPING đang chạy.
        pid = self._spawn(
            "start_wsl_slam.sh",
            log_prefix="foxglove-mapping-web",
        )
        self._last_mode = "MAPPING"
        self._last_map = None
        return {
            "status": "STARTING",
            "mode": "MAPPING",
            "pid": pid,
            "message": "Đang khởi động Slam Toolbox và Foxglove để quét bản đồ realtime.",
        }

    def start_exploration(self, raw_name: str, auto_save: bool = True) -> dict:
        """Xe THẬT tự đi quét map: SLAM + Nav2 + frontier explorer (start_wsl_slam.sh EXPLORE=1).

        Script tự kiểm tra Pi/LiDAR/encoder trước (không đạt thì xe đứng yên), đếm
        ngược 10 s rồi mới cho xe chạy; quét xong tự lưu map nếu có tên.
        """
        safe_name = self.normalize_map_name(raw_name) if auto_save else ""
        # Bam lan 2 luc script con khoi dong (SLAM + kiem tra cam bien ~1-2 phut, xe chua chay):
        # KHONG chay them script - buoc dau script moi tat tien trinh cua script cu, hai ben
        # tat cheo nhau va xe khong bao gio chay (09/11). Qua cua so nay thi cho bat lai.
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
        target = (os.getenv("PI5_IP", "100.99.72.51"), int(os.getenv("PI5_PORT", "9999")))
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
        """Dừng xe tự quét: tắt explorer + Nav2 (ngừng /cmd_vel) rồi gửi stop tới Pi.

        GIỮ SLAM + bridge chạy để map đang quét dở vẫn còn và lưu được.
        """
        self._explore_launch = None  # da dung: lan bam "Quet" sau phai bat moi
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
        if len(pixels) != width * height:
            raise Ros2RuntimeError("File PGM bị thiếu dữ liệu pixel.")
        # PGM: hàng 0 là đỉnh ảnh. OccupancyGrid/Web JSON: hàng 0 là đáy (origin_y),
        # nên duyệt hàng ảnh từ dưới lên (giống convert_ros2_map_to_web.py).
        grid_data = []
        for row in range(height - 1, -1, -1):
            for val in pixels[row * width:(row + 1) * width]:
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
            except Exception as exc:
                # YAML/PGM đã lưu xong; JSON chỉ là bản phụ cho Web, không làm hỏng lần lưu.
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
        # Thu muc con rieng de mask khong lan vao danh sach map (/map/layouts quet *.yaml).
        mask_dir = self.maps_dir / "keepout"
        return mask_dir / f"{safe_name}.yaml", mask_dir / f"{safe_name}.pgm"

    def speed_mask_paths(self, safe_name: str) -> tuple[Path, Path]:
        mask_dir = self.maps_dir / "speed"
        return mask_dir / f"{safe_name}.yaml", mask_dir / f"{safe_name}.pgm"

    def _map_grid(self, safe_name: str) -> tuple[int, int, float, float, float]:
        """(rong, cao, do phan giai, goc x, goc y) cua map da luu - mask phai trung khit map."""
        import yaml

        map_yaml = self.maps_dir / f"{safe_name}.yaml"
        if not map_yaml.is_file():
            raise Ros2RuntimeError(f"Chưa có bản đồ '{safe_name}'.")
        meta = yaml.safe_load(map_yaml.read_text(encoding="utf-8")) or {}
        stats = self._read_pgm_stats(map_yaml.parent / str(meta.get("image", f"{safe_name}.pgm")))
        origin = meta.get("origin") or [0.0, 0.0, 0.0]
        return (stats["width"], stats["height"], float(meta.get("resolution", 0.05)),
                float(origin[0]), float(origin[1]))

    @staticmethod
    def _zone_cells(zone: dict, reach_m: float, grid: tuple[int, int, float, float, float]):
        """(chi so diem anh PGM, khoang cach m tu TAM o toi vung ve) cho moi o cach vung <= reach_m.

        Xet tam o (khong phai "o cham vao vung") => lam tron chi lech +-nua o, khong nuot them ca o.
        """
        width, height, res, ox, oy = grid
        half_w = float(zone.get("width") or 0.0) / 2.0
        half_h = float(zone.get("height") or 0.0) / 2.0
        zx, zy = float(zone.get("x") or 0.0), float(zone.get("y") or 0.0)
        angle = math.radians(float(zone.get("yaw") or 0.0))
        co, si = math.cos(angle), math.sin(angle)
        extent_x = abs(co) * half_w + abs(si) * half_h
        extent_y = abs(si) * half_w + abs(co) * half_h
        x0 = max(0, math.floor((zx - extent_x - reach_m - ox) / res))
        x1 = min(width - 1, math.floor((zx + extent_x + reach_m - ox) / res))
        y0 = max(0, math.floor((zy - extent_y - reach_m - oy) / res))
        y1 = min(height - 1, math.floor((zy + extent_y + reach_m - oy) / res))
        for gy in range(y0, y1 + 1):
            wy = oy + (gy + 0.5) * res - zy
            row = (height - 1 - gy) * width  # PGM: hang 0 la dinh anh (y lon nhat)
            for gx in range(x0, x1 + 1):
                wx = ox + (gx + 0.5) * res - zx
                local_x, local_y = wx * co + wy * si, -wx * si + wy * co
                d = math.hypot(max(abs(local_x) - half_w, 0.0), max(abs(local_y) - half_h, 0.0))
                if d <= reach_m + 1e-9:
                    yield row + gx, d

    @staticmethod
    def _keepout_value(distance_m: float, margin_m: float) -> int:
        """Gia tri mask (raw) theo khoang cach toi vung ve: 100 = cam han, 1..99 = chi phi mem, 0 = tu do.

        KeepoutFilter KHONG duoc lop inflation boc quanh nhu tuong (filter chay sau inflation), nen
        neu chi co phan cam han thi planner lap duong sat mep vung roi DWB (xet ca than xe) ket.
        Dai mem nay thay inflation: sat mep 99 (~nua be ngang xe), roi giam dan; xe van di qua duoc.
        Do tren Nav2 Jazzy 08/11: mask 100 -> costmap 100 (lethal), 99 -> 97, 75 -> 74, 50 -> 49.
        """
        if distance_m <= margin_m:
            return 100
        s = distance_m - margin_m
        if s <= KEEPOUT_NEAR_M:
            return 99
        if s <= KEEPOUT_SOFT_BAND_M:
            return max(1, round(99 * math.exp(-KEEPOUT_SOFT_DECAY * (s - KEEPOUT_NEAR_M))))
        return 0

    @staticmethod
    def _write_mask(paths: tuple[Path, Path], grid: tuple[int, int, float, float, float],
                    pixels: bytearray, mode: str) -> None:
        width, height, res, ox, oy = grid
        mask_yaml, mask_pgm = paths
        mask_yaml.parent.mkdir(parents=True, exist_ok=True)
        mask_pgm.write_bytes(f"P5\n{width} {height}\n255\n".encode("ascii") + bytes(pixels))
        mask_yaml.write_text(
            f"image: {mask_pgm.name}\nmode: {mode}\nresolution: {res}\n"
            f"origin: [{ox}, {oy}, 0.0]\nnegate: 0\noccupied_thresh: 0.65\nfree_thresh: 0.25\n",
            encoding="utf-8",
        )

    def write_keepout_mask(self, raw_name: str, zones: list[dict], margin_m: float = ZONE_HARD_MARGIN_M) -> dict:
        """
        Tao mask Keepout Filter cho Nav2 tu cac vung KEEP_OUT cua map (cung kich thuoc/goc voi map),
        mode raw (gia tri o = diem anh 0..100). Vung ve + margin_m = 100 (cam han: planner khong lap
        duong vao, endpoint bi tu choi); ngoai do la dai chi phi mem (_keepout_value). Chong nhau: lay max.
        """
        safe_name = self.normalize_map_name(raw_name)
        grid = self._map_grid(safe_name)
        pixels = bytearray(grid[0] * grid[1])
        keepout = [z for z in zones if str(z.get("type", "")).upper() == "KEEP_OUT"]
        reach = margin_m + KEEPOUT_SOFT_BAND_M
        for z in keepout:
            for i, d in self._zone_cells(z, reach, grid):
                value = self._keepout_value(d, margin_m)
                if value > pixels[i]:
                    pixels[i] = value

        paths = self.keepout_mask_paths(safe_name)
        self._write_mask(paths, grid, pixels, "raw")
        logger.info("Keepout mask '%s': %d vùng KEEP_OUT", safe_name, len(keepout))
        return {"map_name": safe_name, "keepout_zones": len(keepout), "mask_yaml": str(paths[0])}

    def write_speed_mask(self, raw_name: str, zones: list[dict], margin_m: float = ZONE_HARD_MARGIN_M) -> dict:
        """
        Tao mask Speed Filter cho Nav2 tu cac vung SPEED_ZONE (mode raw: gia tri o = diem anh 0..100).
        speed_filter_info_server (nav2/zone_filter_params.yaml): type 2, base 0.0, multiplier 0.01
        => toc do toi da = gia tri / 100 m/s; 0 = khong gioi han. Vung chong nhau lay gioi han cham hon.
        Chi noi rong margin_m (vai cm) cho sai so dinh vi: SpeedFilter xet tam xe.
        """
        safe_name = self.normalize_map_name(raw_name)
        grid = self._map_grid(safe_name)
        pixels = bytearray(grid[0] * grid[1])
        count = 0
        for z in zones:
            if str(z.get("type", "")).upper() != "SPEED_ZONE":
                continue
            try:
                limit = float(z.get("speed_limit") or 0.0)
            except (TypeError, ValueError):
                limit = 0.0
            if limit <= 0.0:
                logger.warning("Bỏ vùng giới hạn tốc độ '%s': speed_limit=%r không hợp lệ",
                               z.get("name") or z.get("id"), z.get("speed_limit"))
                continue
            value = max(1, min(100, round(limit * 100)))
            count += 1
            for i, _d in self._zone_cells(z, margin_m, grid):
                if pixels[i] == 0 or value < pixels[i]:
                    pixels[i] = value

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
