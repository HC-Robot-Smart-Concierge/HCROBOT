"""Bounded odometry breadcrumbs and reverse-only escape, independent of ROS.

Distances use the current 32 x 16 cm body and laser offset in lidar.xacro.
Unknown scan sectors are not evidence of free space.
"""

import math
from dataclasses import dataclass


def angle_error(target, current):
    return (target - current + math.pi) % (2 * math.pi) - math.pi


def body_scan(angle_min, angle_increment, ranges, range_min, range_max):
    """Return body-frame hits and whether all 24 angular sectors have observations.

    Positive infinity is a valid no-return ray; NaN, zero, and out-of-range finite
    measurements do not establish coverage. Hits outside max range are omitted.
    """
    sectors, points = set(), []
    for i, distance in enumerate(ranges):
        if math.isnan(distance) or distance < range_min:
            continue
        if not math.isinf(distance) and distance > range_max:
            continue
        angle = angle_min + i * angle_increment
        sectors.add(int((angle % (2 * math.pi)) / (2 * math.pi) * 24) % 24)
        if math.isfinite(distance):
            points.append((0.08 + distance * math.cos(angle), distance * math.sin(angle)))
    return points, len(sectors) == 24


def turn_clear(points, coverage, radius=0.40):
    return coverage and all(math.hypot(x, y) > radius for x, y in points)


def reverse_clear(points, coverage, distance=0.12, side_margin=0.04):
    """Conservative swept rectangle, including rear corners and both flanks."""
    return coverage and not any(
        -0.16 - distance <= x <= 0.16 and abs(y) <= 0.08 + side_margin
        for x, y in points
    )


@dataclass(frozen=True)
class Breadcrumb:
    pose: tuple
    wide: bool


class RetreatTrail:
    def __init__(self, spacing=0.08, max_length=8.0):
        self.spacing = spacing
        self.max_length = max_length
        self.points = []

    def record(self, pose, wide):
        if pose is None:
            self.points.clear()
            return
        if self.points:
            last = self.points[-1].pose
            distance = math.hypot(pose[0] - last[0], pose[1] - last[1])
            # Odom reset/jump invalidates the history; never connect it across a jump.
            if distance > 0.5:
                self.points.clear()
            elif distance < self.spacing:
                # Do not turn an old safe anchor into a new location as the robot drifts.
                self.points[-1] = Breadcrumb(last, self.points[-1].wide and bool(wide))
                return
        self.points.append(Breadcrumb(tuple(pose), bool(wide)))
        length = 0.0
        for i in range(len(self.points) - 1, 0, -1):
            a, b = self.points[i].pose, self.points[i - 1].pose
            length += math.hypot(a[0] - b[0], a[1] - b[1])
            if length > self.max_length:
                self.points = self.points[i:]
                break

    def route(self, pose):
        """Most recent wide anchor, with every intervening breadcrumb in reverse order."""
        if pose is None or len(self.points) < 2:
            return []
        if math.hypot(pose[0] - self.points[-1].pose[0],
                      pose[1] - self.points[-1].pose[1]) > 0.5:
            return []
        for i in range(len(self.points) - 1, -1, -1):
            p = self.points[i]
            if p.wide and math.hypot(pose[0] - p.pose[0], pose[1] - p.pose[1]) >= 0.20:
                return [p.pose for p in reversed(self.points[i:])]
        return []


class ReverseFollower:
    def __init__(self, route, speed=0.08):
        self.route = list(route)
        self.speed = min(0.10, max(0.04, speed))

    def command(self, pose):
        """Return (vx, wz, reason). Never spin or drive forward to regain a lost path."""
        while self.route and math.hypot(self.route[0][0] - pose[0],
                                        self.route[0][1] - pose[1]) < 0.06:
            self.route.pop(0)
        if not self.route:
            return 0.0, 0.0, "arrived"
        dx, dy = self.route[0][0] - pose[0], self.route[0][1] - pose[1]
        distance = math.hypot(dx, dy)
        error = angle_error(math.atan2(-dy, -dx), pose[2])
        if abs(error) > 0.60 or distance > 0.30:
            return 0.0, 0.0, "path_lost"
        # Reverse pure pursuit; keep radius >= 0.5 m so the bridge never turns this
        # into an in-place rotation. A sharp corner requires stopping for assistance.
        wz = max(-self.speed * 2, min(self.speed * 2,
                 2 * self.speed * math.sin(error) / max(distance, 0.10)))
        return -self.speed, wz, "moving"
