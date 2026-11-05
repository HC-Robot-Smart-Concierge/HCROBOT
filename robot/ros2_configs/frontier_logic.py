"""Tìm và chọn frontier trên OccupancyGrid (không phụ thuộc ROS để test được).

Frontier = ô TRỐNG (0) có ít nhất một ô kề 4 hướng CHƯA BIẾT (-1). Các ô frontier
liền nhau (8 hướng) gom thành cụm; cụm quá nhỏ (nhiễu) bị bỏ. Đích của mỗi cụm là
ô frontier gần tâm cụm nhất (luôn là ô trống => Nav2 lập đường tới được).
"""

from __future__ import annotations

import math
from collections import deque
from dataclasses import dataclass
from typing import Iterable, List, Optional, Sequence, Tuple

Point = Tuple[float, float]


@dataclass(frozen=True)
class Frontier:
    goal: Point          # điểm đích (m, khung map)
    size: int            # số ô trong cụm
    centroid: Point


def find_frontiers(
    data: Sequence[int],
    width: int,
    height: int,
    resolution: float,
    origin: Point,
    min_cluster_cells: int = 8,
) -> List[Frontier]:
    def is_frontier(i: int) -> bool:
        if data[i] != 0:
            return False
        x, y = i % width, i // width
        return (
            (x > 0 and data[i - 1] == -1)
            or (x < width - 1 and data[i + 1] == -1)
            or (y > 0 and data[i - width] == -1)
            or (y < height - 1 and data[i + width] == -1)
        )

    seen = bytearray(width * height)
    frontiers: List[Frontier] = []
    ox, oy = origin
    for start in range(width * height):
        if seen[start] or not is_frontier(start):
            continue
        cluster = []
        queue = deque([start])
        seen[start] = 1
        while queue:
            i = queue.popleft()
            cluster.append(i)
            cx, cy = i % width, i // width
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    nx, ny = cx + dx, cy + dy
                    if (dx or dy) and 0 <= nx < width and 0 <= ny < height:
                        j = ny * width + nx
                        if not seen[j] and is_frontier(j):
                            seen[j] = 1
                            queue.append(j)
        if len(cluster) < min_cluster_cells:
            continue
        mx = sum(i % width for i in cluster) / len(cluster)
        my = sum(i // width for i in cluster) / len(cluster)
        best = min(cluster, key=lambda i: (i % width - mx) ** 2 + (i // width - my) ** 2)
        frontiers.append(Frontier(
            goal=(ox + (best % width + 0.5) * resolution, oy + (best // width + 0.5) * resolution),
            size=len(cluster),
            centroid=(ox + (mx + 0.5) * resolution, oy + (my + 0.5) * resolution),
        ))
    return frontiers


def choose_frontier(
    frontiers: Iterable[Frontier],
    robot: Point,
    blacklist: Iterable[Point] = (),
    blacklist_radius: float = 0.4,
    min_distance: float = 0.3,
    size_weight: float = 0.02,
) -> Optional[Frontier]:
    """Chọn cụm có chi phí nhỏ nhất: khoảng cách - size_weight * số ô.

    Bỏ cụm gần điểm đã thất bại / đã thăm (blacklist) và cụm sát robot
    (tới nơi mà vẫn còn => thường là vùng LiDAR không thấy được, vd. kính).
    """
    blacklist = list(blacklist)
    best = None
    best_cost = math.inf
    for f in frontiers:
        dist = math.hypot(f.goal[0] - robot[0], f.goal[1] - robot[1])
        if dist < min_distance:
            continue
        if any(math.hypot(f.goal[0] - bx, f.goal[1] - by) < blacklist_radius for bx, by in blacklist):
            continue
        cost = dist - size_weight * f.size
        if cost < best_cost:
            best, best_cost = f, cost
    return best


def safe_goal(
    data: Sequence[int],
    width: int,
    height: int,
    resolution: float,
    origin: Point,
    goal: Point,
    robot: Point,
    clearance_m: float = 0.22,
    search_radius_m: float = 1.0,
    occupied_threshold: int = 50,
) -> Optional[Point]:
    """Dời đích frontier tới ô TRỐNG gần nhất cách mọi ô tường > clearance_m.

    Frontier hay nằm sát tường; Nav2 (footprint + padding) coi đó là va chạm, còn Pi
    chặn xoay khi hông < 12 cm => xe đứng chờ recovery. Ô chưa biết không tính là tường.
    Hoà khoảng cách thì ưu tiên ô gần robot. Không có ô nào => None (bỏ frontier).
    """
    ox, oy = origin
    gx = int((goal[0] - ox) / resolution)
    gy = int((goal[1] - oy) / resolution)
    rx = (robot[0] - ox) / resolution
    ry = (robot[1] - oy) / resolution
    search = int(math.ceil(search_radius_m / resolution))
    clear = clearance_m / resolution
    clear_cells = int(math.ceil(clear))

    def is_safe(cx: int, cy: int) -> bool:
        if data[cy * width + cx] != 0:
            return False
        for dy in range(-clear_cells, clear_cells + 1):
            ny = cy + dy
            if not 0 <= ny < height:
                continue
            for dx in range(-clear_cells, clear_cells + 1):
                nx = cx + dx
                if (0 <= nx < width and dx * dx + dy * dy <= clear * clear
                        and data[ny * width + nx] >= occupied_threshold):
                    return False
        return True

    best = None
    best_key = None
    for cy in range(max(0, gy - search), min(height, gy + search + 1)):
        for cx in range(max(0, gx - search), min(width, gx + search + 1)):
            d2 = (cx - gx) ** 2 + (cy - gy) ** 2
            if d2 > search * search:
                continue
            key = (d2, (cx - rx) ** 2 + (cy - ry) ** 2)
            if best_key is not None and key >= best_key:
                continue
            if is_safe(cx, cy):
                best, best_key = (cx, cy), key
    if best is None:
        return None
    return (ox + (best[0] + 0.5) * resolution, oy + (best[1] + 0.5) * resolution)


def frontier_still_open(frontiers: Iterable[Frontier], target: Point, radius: float = 0.6) -> bool:
    """Frontier đang nhắm còn tồn tại không (còn cụm nào gần nó)?

    LiDAR quét xa vài mét nên vùng chưa biết thường lộ ra trước khi xe tới nơi;
    lúc đó nên đổi sang frontier khác ngay thay vì chạy nốt tới đích cũ.
    """
    for f in frontiers:
        for px, py in (f.goal, f.centroid):
            if math.hypot(px - target[0], py - target[1]) <= radius:
                return True
    return False


class GoalFailureTracker:
    """Đếm số lần Nav2 thất bại tại mỗi chỗ; chỉ bỏ hẳn chỗ đó sau `max_failures` lần.

    Xe thật hay có lỗi tạm thời (TF trễ, costmap chưa kịp cập nhật) khiến Nav2 huỷ
    đích ngay. Bỏ chỗ đó từ lần đầu thì map mới bắt đầu (1 cụm frontier) sẽ báo
    "khám phá xong" sau vài giây mà xe chưa nhúc nhích.
    """

    def __init__(self, max_failures: int = 3, radius: float = 0.4):
        self.max_failures = max(1, int(max_failures))
        self.radius = float(radius)
        self._spots: List[List] = []  # [[x, y, so_lan], ...]

    def record_failure(self, goal: Point) -> bool:
        """Ghi một lần thất bại; True nếu đã đủ số lần => nên bỏ chỗ này."""
        for spot in self._spots:
            if math.hypot(goal[0] - spot[0], goal[1] - spot[1]) <= self.radius:
                spot[2] += 1
                return spot[2] >= self.max_failures
        self._spots.append([goal[0], goal[1], 1])
        return self.max_failures <= 1
