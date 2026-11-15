"""Map PGM/JSON conversion and Nav2 zone mask helpers for Ros2RuntimeService."""

from __future__ import annotations

import json
import logging
import math
from datetime import datetime
from pathlib import Path

from app.services.zone_geometry import zone_points, points_bounds, distance_to_polygon

logger = logging.getLogger(__name__)

# Vung ve tren Web -> mask Nav2: phan CAM HAN / GIOI HAN TOC DO chi rong hon hinh ve vai cm
# (sai so dinh vi + lam tron o 5 cm). Truoc day noi 16 cm moi phia - nguoi dung thay "luu rong hon".
ZONE_HARD_MARGIN_M = 0.05
# Dai chi phi mem quanh vung cam (thay inflation, xem _keepout_value): ngay sat mep 99 trong
# KEEPOUT_NEAR_M (~nua be ngang xe 8.5 cm), giam dan, het hieu luc sau KEEPOUT_SOFT_BAND_M.
KEEPOUT_NEAR_M = 0.08
KEEPOUT_SOFT_BAND_M = 0.25
KEEPOUT_SOFT_DECAY = 8.0  # 1/m


class Ros2RuntimeError(RuntimeError):
    """Raised when the local ROS 2 runtime cannot complete an operation."""


class Ros2MapMaskMixin:
    """Mixin providing PGM stats/JSON export and Nav2 keepout/speed mask generation."""

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
        points = zone_points(zone)
        min_x, min_y, max_x, max_y = points_bounds(points)
        x0 = max(0, math.floor((min_x - reach_m - ox) / res))
        x1 = min(width - 1, math.floor((max_x + reach_m - ox) / res))
        y0 = max(0, math.floor((min_y - reach_m - oy) / res))
        y1 = min(height - 1, math.floor((max_y + reach_m - oy) / res))
        for gy in range(y0, y1 + 1):
            wy = oy + (gy + 0.5) * res
            row = (height - 1 - gy) * width  # PGM rows run top to bottom.
            for gx in range(x0, x1 + 1):
                wx = ox + (gx + 0.5) * res
                d = distance_to_polygon(wx, wy, points)
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
