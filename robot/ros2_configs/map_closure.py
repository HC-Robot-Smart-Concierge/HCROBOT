"""Is the scanned room closed? This is what "scan finished" means for HC-Robot.

Flood-fill from the robot through every cell that is not wall; unknown cells are
passable. A gap in the walls lets the fill reach the map border = the map leaks.
Gaps narrower than max_gap_m are sealed first: the sparse RPLiDAR A1 leaves 1-2 cell
holes in real walls, and the robot cannot pass them anyway. Each opening found is
reported, sealed, and the fill repeated, so one call lists separate openings.
Pure Python (no ROS) so it is unit-testable.
"""

import math
from collections import deque
from dataclasses import dataclass, field
from typing import List, Optional, Sequence, Tuple

Point = Tuple[float, float]
OCCUPIED = 65  # same as Nav2 occupied_thresh 0.65


@dataclass(frozen=True)
class Closure:
    closed: bool
    leaks: List[Point] = field(default_factory=list)  # map-frame metres, at each opening


def _walls(data, width, height, gap_cells):
    wall = bytearray(width * height)
    for i, v in enumerate(data):
        if v < OCCUPIED:
            continue
        cx, cy = i % width, i // width
        for y in range(max(0, cy - gap_cells), min(height, cy + gap_cells + 1)):
            row = y * width
            for x in range(max(0, cx - gap_cells), min(width, cx + gap_cells + 1)):
                wall[row + x] = 1
    return wall


def _start_cell(wall, width, height, cx, cy, radius_cells):
    """Robot cell, or the nearest non-wall cell (the robot may sit inside the dilation)."""
    best = None
    for r in range(radius_cells + 1):
        for y in range(cy - r, cy + r + 1):
            for x in range(cx - r, cx + r + 1):
                if 0 <= x < width and 0 <= y < height and not wall[y * width + x]:
                    d = (x - cx) ** 2 + (y - cy) ** 2
                    if best is None or d < best[0]:
                        best = (d, y * width + x)
        if best is not None:
            return best[1]
    return None


def _escape_path(wall, width, height, start):
    """BFS from start through non-wall cells; path to the first border cell, or None."""
    parent = {start: -1}
    queue = deque([start])
    while queue:
        i = queue.popleft()
        x, y = i % width, i // width
        if x == 0 or y == 0 or x == width - 1 or y == height - 1:
            path = []
            while i != -1:
                path.append(i)
                i = parent[i]
            return path  # border ... start
        for j in (i - 1 if x > 0 else -1, i + 1 if x < width - 1 else -1,
                  i - width if y > 0 else -1, i + width if y < height - 1 else -1):
            if j >= 0 and j not in parent and not wall[j]:
                parent[j] = i
                queue.append(j)
    return None


def map_closure(
    data: Sequence[int],
    width: int,
    height: int,
    resolution: float,
    origin: Point,
    robot: Point,
    max_gap_m: float = 0.10,
    max_leaks: int = 5,
    seal_radius_m: float = 0.35,
    merge_m: float = 1.0,
    max_iterations: int = 40,
) -> Optional[Closure]:
    """Closure of the room around `robot`; None if the robot is off the map / boxed in."""
    ox, oy = origin
    cx, cy = int((robot[0] - ox) / resolution), int((robot[1] - oy) / resolution)
    if not (0 <= cx < width and 0 <= cy < height):
        return None
    gap_cells = max(0, math.ceil(max_gap_m / 2.0 / resolution - 1e-9))
    wall = _walls(data, width, height, gap_cells)
    start = _start_cell(wall, width, height, cx, cy, math.ceil(0.5 / resolution))
    if start is None:
        return None
    seal = math.ceil(seal_radius_m / resolution)
    leaks: List[Point] = []
    for _ in range(max_iterations):
        if len(leaks) >= max_leaks:
            break
        path = _escape_path(wall, width, height, start)
        if path is None:
            break
        # Outermost known-free cell on the way out = the opening in the wall.
        gate = next((i for i in path if 0 <= data[i] < OCCUPIED), path[-1])
        gx, gy = gate % width, gate // width
        point = (ox + (gx + 0.5) * resolution, oy + (gy + 0.5) * resolution)
        # A wide doorway needs several seals; report it once.
        if all(math.hypot(point[0] - lx, point[1] - ly) > merge_m for lx, ly in leaks):
            leaks.append(point)
        for y in range(max(0, gy - seal), min(height, gy + seal + 1)):
            for x in range(max(0, gx - seal), min(width, gx + seal + 1)):
                if (x - gx) ** 2 + (y - gy) ** 2 <= seal * seal and y * width + x != start:
                    wall[y * width + x] = 1
    return Closure(closed=not leaks, leaks=leaks)
