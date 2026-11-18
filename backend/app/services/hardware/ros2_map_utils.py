"""PGM parsing, grid JSON export, and Nav2 keepout/speed mask geometry helpers."""

from __future__ import annotations

import json
import logging
import math
from datetime import datetime
from pathlib import Path

from app.services.zone_geometry import distance_to_polygon, points_bounds, zone_points

logger = logging.getLogger(__name__)

# Vung ve tren Web -> mask Nav2: phan CAM HAN / GIOI HAN TOC DO chi rong hon hinh ve vai cm
# (sai so dinh vi + lam tron o 5 cm).
ZONE_HARD_MARGIN_M = 0.05
# Dai chi phi mem quanh vung cam (thay inflation, xem keepout_value): ngay sat mep 99 trong
# KEEPOUT_NEAR_M (~nua be ngang xe 8.5 cm), giam dan, het hieu luc sau KEEPOUT_SOFT_BAND_M.
KEEPOUT_NEAR_M = 0.08
KEEPOUT_SOFT_BAND_M = 0.25
KEEPOUT_SOFT_DECAY = 8.0  # 1/m


class Ros2RuntimeError(RuntimeError):
    """Raised when the local ROS 2 runtime cannot complete an operation."""


def parse_pgm_pixels(pgm_path: Path) -> tuple[int, int, int, bytes]:
    """Read a binary P5 PGM header and exact pixel buffer without external image libs."""
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

    if cursor < len(raw) and raw[cursor] == 13:
        cursor += 1
    if cursor < len(raw) and raw[cursor] == 10:
        cursor += 1
    elif cursor < len(raw) and raw[cursor] in b" \t":
        cursor += 1

    pixels = raw[cursor:cursor + width * height]
    if len(pixels) != width * height:
        raise Ros2RuntimeError("File PGM bị thiếu dữ liệu pixel.")
    return width, height, max_value, pixels


def read_pgm_stats(pgm_path: Path) -> dict:
    """Count occupied and free cells inside a binary P5 PGM map file."""
    width, height, _, pixels = parse_pgm_pixels(pgm_path)
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


def export_pgm_to_json(pgm_path: Path, yaml_path: Path, safe_name: str, maps_dir: Path, project_root: Path) -> None:
    """Convert ROS 2 PGM + YAML map artifacts into Web Admin JSON grid format."""
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

    width, height, _, pixels = parse_pgm_pixels(pgm_path)
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
    (maps_dir / f"{safe_name}.json").write_bytes(json_bytes)
    static_dir = project_root / "backend" / "static" / "maps"
    if static_dir.is_dir():
        (static_dir / f"{safe_name}.json").write_bytes(json_bytes)


def zone_cells(zone: dict, reach_m: float, grid: tuple[int, int, float, float, float]):
    """Yield (pixel_index, distance_m) for map cells within reach_m of the zone polygon."""
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


def keepout_value(distance_m: float, margin_m: float) -> int:
    """Compute raw Keepout mask cost value (100=lethal, 1..99=soft skirt, 0=free)."""
    if distance_m <= margin_m:
        return 100
    s = distance_m - margin_m
    if s <= KEEPOUT_NEAR_M:
        return 99
    if s <= KEEPOUT_SOFT_BAND_M:
        return max(1, round(99 * math.exp(-KEEPOUT_SOFT_DECAY * (s - KEEPOUT_NEAR_M))))
    return 0


def write_mask_files(
    paths: tuple[Path, Path],
    grid: tuple[int, int, float, float, float],
    pixels: bytearray,
    mode: str,
) -> None:
    """Write Nav2 filter mask PGM and YAML metadata files."""
    width, height, res, ox, oy = grid
    mask_yaml, mask_pgm = paths
    mask_yaml.parent.mkdir(parents=True, exist_ok=True)
    mask_pgm.write_bytes(f"P5\n{width} {height}\n255\n".encode("ascii") + bytes(pixels))
    mask_yaml.write_text(
        f"image: {mask_pgm.name}\nmode: {mode}\nresolution: {res}\n"
        f"origin: [{ox}, {oy}, 0.0]\nnegate: 0\noccupied_thresh: 0.65\nfree_thresh: 0.25\n",
        encoding="utf-8",
    )


def load_map_grid(map_yaml: Path, default_pgm_name: str) -> tuple[int, int, float, float, float]:
    """Read (width, height, resolution, origin_x, origin_y) from a saved Nav2 YAML+PGM pair."""
    import yaml

    if not map_yaml.is_file():
        raise Ros2RuntimeError(f"Chưa có bản đồ '{map_yaml.stem}'.")
    meta = yaml.safe_load(map_yaml.read_text(encoding="utf-8")) or {}
    stats = read_pgm_stats(map_yaml.parent / str(meta.get("image", default_pgm_name)))
    origin = meta.get("origin") or [0.0, 0.0, 0.0]
    return (
        stats["width"],
        stats["height"],
        float(meta.get("resolution", 0.05)),
        float(origin[0]),
        float(origin[1]),
    )


def build_keepout_pixels(
    zones: list[dict],
    grid: tuple[int, int, float, float, float],
    margin_m: float = ZONE_HARD_MARGIN_M,
) -> tuple[bytearray, int]:
    """Rasterize KEEP_OUT polygons plus soft deceleration skirt into raw filter pixels."""
    pixels = bytearray(grid[0] * grid[1])
    keepout = [z for z in zones if str(z.get("type", "")).upper() == "KEEP_OUT"]
    reach = margin_m + KEEPOUT_SOFT_BAND_M
    for z in keepout:
        for i, d in zone_cells(z, reach, grid):
            value = keepout_value(d, margin_m)
            if value > pixels[i]:
                pixels[i] = value
    return pixels, len(keepout)


def build_speed_pixels(
    zones: list[dict],
    grid: tuple[int, int, float, float, float],
    margin_m: float = ZONE_HARD_MARGIN_M,
) -> tuple[bytearray, int]:
    """Rasterize SPEED_ZONE polygons into raw Speed Filter pixels (1..100 => m/s * 100)."""
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
            logger.warning(
                "Bỏ vùng giới hạn tốc độ '%s': speed_limit=%r không hợp lệ",
                z.get("name") or z.get("id"),
                z.get("speed_limit"),
            )
            continue
        value = max(1, min(100, round(limit * 100)))
        count += 1
        for i, _d in zone_cells(z, margin_m, grid):
            if pixels[i] == 0 or value < pixels[i]:
                pixels[i] = value
    return pixels, count
