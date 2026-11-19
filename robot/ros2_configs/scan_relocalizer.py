"""Local LiDAR re-localization: search around the current pose for where the scan fits the map.

AMCL tracks the pose but cannot pull itself back once the heading is off by tens of degrees
(no recovery particles, odometry trusted). This module searches a bounded window around the
current pose (coarse grid, then hill-climbing) with the same scan/map score the localization
manager already uses, and proposes a correction only when it is clearly better AND unique.
The window stays well inside +-180 deg, so a rectangular room's 180-degree twin is never taken.
"""
from dataclasses import dataclass
import math
from typing import Callable, List, Optional, Sequence, Tuple

Pose = Tuple[float, float, float]


@dataclass(frozen=True)
class Candidate:
    pose: Pose
    score: float   # fraction of beams ending near a wall
    weak: float    # second-worst of 8 sectors (low = slid along a wall / one side unmatched)


def _wrap(a: float) -> float:
    return math.atan2(math.sin(a), math.cos(a))


def compose(a: Pose, b: Pose) -> Pose:
    c, s = math.cos(a[2]), math.sin(a[2])
    return a[0] + c * b[0] - s * b[1], a[1] + s * b[0] + c * b[1], _wrap(a[2] + b[2])


def inverse(p: Pose) -> Pose:
    c, s = math.cos(p[2]), math.sin(p[2])
    return -(c * p[0] + s * p[1]), -(-s * p[0] + c * p[1]), _wrap(-p[2])


def base_from_laser(laser: Pose, laser_in_base: Pose) -> Pose:
    return compose(laser, inverse(laser_in_base))


def apply_correction(now: Pose, old: Pose, corrected: Pose) -> Pose:
    """Move `now` by the rigid correction that takes `old` (pose at scan time) to `corrected`."""
    return compose(compose(corrected, inverse(old)), now)


def _evaluate(score: Callable, pose: Pose) -> Candidate:
    m = score(pose)
    return Candidate(pose, m.score if m else 0.0, m.weak_sector if m else 0.0)


def _key(c: Candidate):
    return c.score, c.weak


def _distinct(a: Pose, b: Pose, xy: float, yaw: float) -> bool:
    return math.hypot(a[0] - b[0], a[1] - b[1]) > xy or abs(_wrap(a[2] - b[2])) > yaw


def _steps(half_range: float, step: float) -> List[float]:
    n = max(0, int(round(half_range / step)))
    return [i * step for i in range(-n, n + 1)]


def _climb(score: Callable, start: Candidate, step_xy: float, step_yaw: float) -> Candidate:
    best = start
    while step_xy >= 0.01 or step_yaw >= math.radians(0.5):
        x, y, yaw = best.pose
        moves = [(step_xy, 0, 0), (-step_xy, 0, 0), (0, step_xy, 0), (0, -step_xy, 0),
                 (0, 0, step_yaw), (0, 0, -step_yaw)]
        improved = max((_evaluate(score, (x + dx, y + dy, _wrap(yaw + dyaw))) for dx, dy, dyaw in moves), key=_key)
        if _key(improved) > _key(best):
            best = improved
        else:
            step_xy, step_yaw = step_xy / 2, step_yaw / 2
    return best


def search(score: Callable, center: Pose, xy_range: float, yaw_range_deg: float,
           keep: int = 4) -> List[Candidate]:
    """Best poses within +-xy_range (m) and +-yaw_range_deg around `center`, best first.

    `score(pose)` returns a localization_logic.ScanMatch (or None) for a LASER pose.
    """
    step_xy = max(0.05, xy_range / 3.0)
    step_yaw = math.radians(max(3.0, yaw_range_deg / 10.0))
    grid = [_evaluate(score, (center[0] + dx, center[1] + dy, _wrap(center[2] + dyaw)))
            for dyaw in _steps(math.radians(yaw_range_deg), step_yaw)
            for dx in _steps(xy_range, step_xy)
            for dy in _steps(xy_range, step_xy)]
    grid.sort(key=_key, reverse=True)
    seeds: List[Candidate] = []
    for c in grid:
        if all(_distinct(c.pose, s.pose, step_xy * 1.5, step_yaw * 1.5) for s in seeds):
            seeds.append(c)
        if len(seeds) >= keep:
            break
    refined = sorted((_climb(score, s, step_xy / 2, step_yaw / 2) for s in seeds), key=_key, reverse=True)
    return refined


def choose_correction(current: Optional[object], candidates: Sequence[Candidate],
                      min_score: float = 0.85, min_gain: float = 0.10, min_weak: float = 0.45,
                      margin: float = 0.03, distinct_xy: float = 0.25,
                      distinct_yaw: float = math.radians(20)) -> Optional[Candidate]:
    """The best candidate if it is clearly good, clearly better than now, and unique; else None.

    `current` is the ScanMatch/Candidate at the pose AMCL believes (None = unknown).
    """
    if not candidates:
        return None
    best = candidates[0]
    if best.score < min_score or best.weak < min_weak:
        return None
    current_score = getattr(current, 'score', 0.0) if current is not None else 0.0
    if best.score - current_score < min_gain:
        return None
    for other in candidates[1:]:
        if _distinct(best.pose, other.pose, distinct_xy, distinct_yaw) and other.score >= best.score - margin:
            return None  # two different places fit about as well: do not guess
    return best
