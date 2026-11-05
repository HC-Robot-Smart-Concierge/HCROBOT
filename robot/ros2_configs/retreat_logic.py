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
        self.progress = 0.0
        self.diagnostic = ""
        self.heading_error = 0.0
        self.aligning = False

    def _target(self, pose):
        """Project onto the ordered polyline, then aim 20 cm farther along it.

        Aiming at the nearest 8 cm breadcrumb amplifies a few cm of odom noise.
        Projection also handles passing a breadcrumb between control callbacks.
        Limit progress per callback so crossing paths cannot skip a loop/corner.
        """
        segments, total = [], 0.0
        for a, b in zip(self.route, self.route[1:]):
            length = math.hypot(b[0] - a[0], b[1] - a[1])
            if length < 1e-6:
                continue
            segments.append((a, b, total, length))
            total += length
        if not segments:
            return self.route[-1][:2], 0.0, 0.0
        closest = None
        for a, b, start, length in segments:
            if start > self.progress + 0.30 or start + length < self.progress - 0.08:
                continue
            t = max(0.0, min(1.0, ((pose[0] - a[0]) * (b[0] - a[0])
                                  + (pose[1] - a[1]) * (b[1] - a[1])) / length ** 2))
            along = start + t * length
            if not self.progress - 0.08 <= along <= self.progress + 0.30:
                continue
            x, y = a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])
            distance = math.hypot(pose[0] - x, pose[1] - y)
            if closest is None or distance < closest[0]:
                closest = (distance, along)
        if closest is None:
            return None, float("inf"), total - self.progress
        self.progress = max(self.progress, closest[1])
        target_s = min(total, self.progress + 0.20)
        for a, b, start, length in segments:
            if start + length >= target_s - 1e-9:
                t = min(1.0, max(0.0, (target_s - start) / length))
                return (a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])), closest[0], total - self.progress
        return self.route[-1][:2], closest[0], total - self.progress

    def command(self, pose):
        """Return a tracking/alignment request; the caller checks its swept footprint."""
        if not self.route:
            return 0.0, 0.0, "arrived"
        target, cross_track, remaining = self._target(pose)
        end_distance = math.hypot(self.route[-1][0] - pose[0], self.route[-1][1] - pose[1])
        if remaining <= 0.06 and end_distance < 0.08:
            return 0.0, 0.0, "arrived"
        if target is None or cross_track > 0.12:
            self.diagnostic = f"cách đường cũ {cross_track * 100:.1f} cm (giới hạn 12 cm)"
            return 0.0, 0.0, "path_lost"
        dx, dy = target[0] - pose[0], target[1] - pose[1]
        distance = math.hypot(dx, dy)
        error = angle_error(math.atan2(-dy, -dx), pose[2])
        self.heading_error = error
        if distance > 0.30:
            self.diagnostic = f"lệch hướng {math.degrees(error):+.1f}°, mốc ngắm cách {distance * 100:.1f} cm"
            return 0.0, 0.0, "path_lost"
        if abs(error) > 0.60:
            self.aligning = True
        if self.aligning and abs(error) > 0.15:
            self.diagnostic = f"chỉnh hướng {math.degrees(error):+.1f}° trước khi lùi"
            return 0.0, math.copysign(0.5, error), "align"
        self.aligning = False
        # Reverse pure pursuit; keep radius >= 0.5 m so the bridge never turns this
        # into an unexpected in-place rotation. Larger heading errors instead emit
        # an explicit alignment request for the caller's costmap collision checks.
        wz = max(-self.speed * 2, min(self.speed * 2,
                 2 * self.speed * math.sin(error) / max(distance, 0.10)))
        return -self.speed, wz, "moving"
