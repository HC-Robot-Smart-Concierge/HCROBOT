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
