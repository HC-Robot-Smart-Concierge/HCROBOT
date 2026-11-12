"""
Lap duong di A* tren occupancy grid cho che do tu hanh cua Pi (khong dung Nav2).

- Tuong / vat can tren map (100) duoc noi rong theo ban kinh robot + le an toan.
- O chua biet (-1) coi la khong di duoc (ngoai pham vi da quet).
- Vung KEEP_OUT tu Web Admin coi la vat can (noi rong them ban kinh robot).
- Duong di duoc rut gon bang line-of-sight de robot chi phai re o cac goc that.
"""

from __future__ import annotations

import heapq
import math
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

try:
    from .zone_geometry import distance_to_zone, zone_points, points_bounds
except ImportError:  # Direct script execution on the Pi.
    from zone_geometry import distance_to_zone, zone_points, points_bounds

Point = Tuple[float, float]

ROBOT_RADIUS_M = 0.16
INFLATE_MARGIN_M = 0.08
PLAN_RESOLUTION_M = 0.05


def point_in_zone(x: float, y: float, zone: Dict, margin: float = 0.0) -> bool:
    """Polygon or rotated rectangle in map metres, with optional robot clearance."""
    if zone.get("vertices") is not None:
        return distance_to_zone(x, y, zone) <= margin + 1e-9
    half_w = float(zone.get("width") or 0.0) / 2.0 + margin
    half_h = float(zone.get("height") or 0.0) / 2.0 + margin
    zx = float(zone.get("x") or 0.0)
    zy = float(zone.get("y") or 0.0)
    angle = math.radians(float(zone.get("yaw") or 0.0))
    dx, dy = x - zx, y - zy
    local_x = dx * math.cos(angle) + dy * math.sin(angle)
    local_y = -dx * math.sin(angle) + dy * math.cos(angle)
    return abs(local_x) <= half_w + 1e-9 and abs(local_y) <= half_h + 1e-9


def zones_of_type(zones: Iterable[Dict], *types: str) -> List[Dict]:
    wanted = {t.upper() for t in types}
    return [z for z in zones if str(z.get("type", "")).upper() in wanted]


class PlanGrid:
    """Luoi lap duong (do phan giai ~5cm) da danh dau o bi chan."""

    def __init__(
        self,
        grid: Sequence[int],
        width: int,
        height: int,
        resolution: float,
        origin_x: float,
        origin_y: float,
        keepout_zones: Iterable[Dict] = (),
        robot_radius: float = ROBOT_RADIUS_M,
        inflate_margin: float = INFLATE_MARGIN_M,
        plan_resolution: float = PLAN_RESOLUTION_M,
    ):
        factor = max(1, int(round(plan_resolution / resolution)))
        self.res = resolution * factor
        self.origin_x = origin_x
        self.origin_y = origin_y
        self.w = (width + factor - 1) // factor
        self.h = (height + factor - 1) // factor

        # Gop o goc vao o lap duong: co vat can -> OCC, co o trong -> FREE, con lai UNKNOWN.
        occ = bytearray(self.w * self.h)
        free = bytearray(self.w * self.h)
        for gy in range(height):
            row = gy * width
            prow = (gy // factor) * self.w
            for gx in range(width):
                v = grid[row + gx]
                if v == 100:
                    occ[prow + gx // factor] = 1
                elif v == 0:
                    free[prow + gx // factor] = 1

        blocked = bytearray(self.w * self.h)
        for i in range(self.w * self.h):
            if not free[i] or occ[i]:
                blocked[i] = 1  # o chua biet hoac vat can

        # Noi rong vat can theo ban kinh robot (chi tuong that, khong noi vung chua biet).
        r = int(math.ceil((robot_radius + inflate_margin) / self.res))
        disk = [(dx, dy) for dy in range(-r, r + 1) for dx in range(-r, r + 1) if dx * dx + dy * dy <= r * r]
        for i in range(self.w * self.h):
            if occ[i]:
                cx, cy = i % self.w, i // self.w
                for dx, dy in disk:
                    nx, ny = cx + dx, cy + dy
                    if 0 <= nx < self.w and 0 <= ny < self.h:
                        blocked[ny * self.w + nx] = 1

        # Vung cam: robot (tam) khong duoc vao vung noi rong them ban kinh robot.
        for zone in keepout_zones:
            if zone.get("vertices") is not None:
                min_x, min_y, max_x, max_y = points_bounds(zone_points(zone))
                x0, y0 = self.to_cell(min_x - robot_radius, min_y - robot_radius)
                x1, y1 = self.to_cell(max_x + robot_radius, max_y + robot_radius)
            else:
                half_w = float(zone.get("width") or 0.0) / 2.0 + robot_radius
                half_h = float(zone.get("height") or 0.0) / 2.0 + robot_radius
                zx, zy = float(zone.get("x") or 0.0), float(zone.get("y") or 0.0)
                angle = math.radians(float(zone.get("yaw") or 0.0))
                extent_x = abs(math.cos(angle)) * half_w + abs(math.sin(angle)) * half_h
                extent_y = abs(math.sin(angle)) * half_w + abs(math.cos(angle)) * half_h
                x0, y0 = self.to_cell(zx - extent_x, zy - extent_y)
                x1, y1 = self.to_cell(zx + extent_x, zy + extent_y)
            for cy in range(max(0, y0), min(self.h, y1 + 1)):
                wy = self.cell_center_y(cy)
                for cx in range(max(0, x0), min(self.w, x1 + 1)):
                    if point_in_zone(self.cell_center_x(cx), wy, zone, margin=robot_radius):
                        blocked[cy * self.w + cx] = 1

        self.blocked = blocked

    # ── Chuyen doi toa do ──────────────────────────────────────────────
    def cell_center_x(self, cx: int) -> float:
        return self.origin_x + (cx + 0.5) * self.res

    def cell_center_y(self, cy: int) -> float:
        return self.origin_y + (cy + 0.5) * self.res

    def to_cell(self, x: float, y: float) -> Tuple[int, int]:
        return int((x - self.origin_x) / self.res), int((y - self.origin_y) / self.res)

    def in_bounds(self, cx: int, cy: int) -> bool:
        return 0 <= cx < self.w and 0 <= cy < self.h

    def is_free(self, cx: int, cy: int) -> bool:
        return self.in_bounds(cx, cy) and not self.blocked[cy * self.w + cx]

    def nearest_free(self, cx: int, cy: int, max_radius_m: float) -> Optional[Tuple[int, int]]:
        """O trong gan nhat (theo vong vuong) trong ban kinh cho phep."""
        if self.is_free(cx, cy):
            return cx, cy
        max_r = int(math.ceil(max_radius_m / self.res))
        best = None
        for r in range(1, max_r + 1):
            for dy in range(-r, r + 1):
                for dx in range(-r, r + 1):
                    if max(abs(dx), abs(dy)) != r:
                        continue
                    nx, ny = cx + dx, cy + dy
                    if self.is_free(nx, ny):
                        d = dx * dx + dy * dy
                        if best is None or d < best[0]:
                            best = (d, nx, ny)
            if best is not None:
                return best[1], best[2]
        return None

    def line_of_sight(self, a: Tuple[int, int], b: Tuple[int, int]) -> bool:
        x0, y0 = a
        x1, y1 = b
        dx, dy = abs(x1 - x0), abs(y1 - y0)
        sx = 1 if x0 < x1 else -1
        sy = 1 if y0 < y1 else -1
        err = dx - dy
        while True:
            if not self.is_free(x0, y0):
                return False
            if (x0, y0) == (x1, y1):
                return True
            e2 = 2 * err
            if e2 > -dy:
                err -= dy
                x0 += sx
            if e2 < dx:
                err += dx
                y0 += sy


def _astar(pg: PlanGrid, start: Tuple[int, int], goal: Tuple[int, int]) -> Optional[List[Tuple[int, int]]]:
    w = pg.w
    s_idx = start[1] * w + start[0]
    g_idx = goal[1] * w + goal[0]
    gx, gy = goal
    g_cost = {s_idx: 0.0}
    came = {}
    heap = [(0.0, s_idx)]
    closed = bytearray(pg.w * pg.h)
    steps = ((1, 0, 1.0), (-1, 0, 1.0), (0, 1, 1.0), (0, -1, 1.0),
             (1, 1, 1.4142), (1, -1, 1.4142), (-1, 1, 1.4142), (-1, -1, 1.4142))
    while heap:
        _, idx = heapq.heappop(heap)
        if closed[idx]:
            continue
        if idx == g_idx:
            path = [idx]
            while idx in came:
                idx = came[idx]
                path.append(idx)
            path.reverse()
            return [(i % w, i // w) for i in path]
        closed[idx] = 1
        cx, cy = idx % w, idx // w
        base = g_cost[idx]
        for dx, dy, cost in steps:
            nx, ny = cx + dx, cy + dy
            if not pg.is_free(nx, ny):
                continue
            # Khong cat cheo qua goc vat can
            if dx and dy and (not pg.is_free(cx + dx, cy) or not pg.is_free(cx, cy + dy)):
                continue
            n_idx = ny * w + nx
            if closed[n_idx]:
                continue
            ng = base + cost
            if ng < g_cost.get(n_idx, float("inf")):
                g_cost[n_idx] = ng
                came[n_idx] = idx
                ddx, ddy = abs(nx - gx), abs(ny - gy)
                h = (ddx + ddy) + (1.4142 - 2.0) * min(ddx, ddy)
                heapq.heappush(heap, (ng + h, n_idx))
    return None


def _simplify(pg: PlanGrid, cells: List[Tuple[int, int]]) -> List[Tuple[int, int]]:
    if len(cells) <= 2:
        return cells
    out = [cells[0]]
    anchor = 0
    while anchor < len(cells) - 1:
        nxt = anchor + 1
        for j in range(len(cells) - 1, anchor, -1):
            if pg.line_of_sight(cells[anchor], cells[j]):
                nxt = j
                break
        out.append(cells[nxt])
        anchor = nxt
    return out


def plan_path(pg: PlanGrid, start: Point, goal: Point) -> Tuple[Optional[List[Point]], str]:
    """
    Tra ve (danh sach diem trung gian ket thuc tai dich, thong bao).
    Danh sach None nghia la khong co duong di.
    """
    s_cell = pg.nearest_free(*pg.to_cell(*start), max_radius_m=0.6)
    if s_cell is None:
        return None, "Vị trí robot hiện tại nằm trong vật cản/ngoài bản đồ. Hãy đặt lại vị trí ban đầu."
    raw_goal = pg.to_cell(*goal)
    g_cell = pg.nearest_free(*raw_goal, max_radius_m=0.35)
    if g_cell is None:
        return None, "Điểm đích nằm trên vật cản hoặc ngoài vùng đã quét."

    cells = _astar(pg, s_cell, g_cell)
    if cells is None:
        return None, "Không tìm được đường đi tới đích (bị tường/vùng cấm chặn)."

    simplified = _simplify(pg, cells)
    points = [(pg.cell_center_x(cx), pg.cell_center_y(cy)) for cx, cy in simplified[1:]]
    if g_cell == raw_goal:
        points = points[:-1] + [goal] if points else [goal]
    if not points:
        points = [goal]
    return points, "OK"
