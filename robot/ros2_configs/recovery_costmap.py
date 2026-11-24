"""Swept body checks for real-robot recovery commands (no ROS dependency)."""

import math
from dataclasses import dataclass
from robot_geometry import HALF_LENGTH_M, HALF_WIDTH_M, COLLISION_MARGIN_M


@dataclass
class CostmapGrid:
    width: int
    height: int
    resolution: float
    origin: tuple  # x, y, yaw, in costmap frame
    data: object


def motion_samples(pose, vx, wz, duration, step=0.05):
    steps = max(1, int(math.ceil(duration / step)),
                int(math.ceil(abs(vx) * duration / 0.015)),
                int(math.ceil(abs(wz) * duration / 0.035)))
    for i in range(steps + 1):
        t = duration * i / steps
        angle = pose[2] + wz * t
        if abs(wz) < 1e-6:
            x = pose[0] + vx * math.cos(pose[2]) * t
            y = pose[1] + vx * math.sin(pose[2]) * t
        else:
            x = pose[0] + vx / wz * (math.sin(angle) - math.sin(pose[2]))
            y = pose[1] - vx / wz * (math.cos(angle) - math.cos(pose[2]))
        yield x, y, angle


def body_clearance(point, pose):
    """Signed clearance to the real body, using the conservative box metric."""
    dx, dy = point[0] - pose[0], point[1] - pose[1]
    c, s = math.cos(pose[2]), math.sin(pose[2])
    return max(abs(c * dx + s * dy) - HALF_LENGTH_M,
               abs(-s * dx + c * dy) - HALF_WIDTH_M)


def margin_escape_allowed(initial, current, margin, vx, wz, enabled):
    # Only straight movement, never rotation/arcs or actual body contact. An
    # obstacle already in the padding may stay equally distant or move away;
    # obstacles initially outside the padding must retain the full margin.
    return (enabled and abs(vx) > 1e-6 and abs(wz) < 1e-6 and initial > 0.005
            and current + 1e-9 >= min(margin, initial))


def scan_sweep_clear(points, coverage, vx, wz, duration, margin=COLLISION_MARGIN_M,
                     allow_margin_escape=False):
    if not coverage:
        return False
    for x, y, yaw in motion_samples((0.0, 0.0, 0.0), vx, wz, duration):
        c, s = math.cos(yaw), math.sin(yaw)
        for px, py in points:
            dx, dy = px - x, py - y
            if abs(c * dx + s * dy) <= HALF_LENGTH_M + margin and abs(-s * dx + c * dy) <= HALF_WIDTH_M + margin:
                if not margin_escape_allowed(body_clearance((px, py), (0, 0, 0)),
                                             body_clearance((px, py), (x, y, yaw)), margin,
                                             vx, wz, allow_margin_escape):
                    return False
    return True


def grid_sweep_clear(grid, pose, vx, wz, duration, margin=COLLISION_MARGIN_M,
                     allow_margin_escape=False):
    """Reject unknown/lethal cells under the whole body at every sampled pose.

    Nav2's OccupancyGrid encodes lethal obstacles as 100; 1..99 is soft inflation
    cost. Inflation is not counted as a second physical obstacle around the body.
    Expand cell centres by half their diagonal to avoid missing corner contacts.
    """
    if (grid.resolution <= 0 or grid.width <= 0 or grid.height <= 0
            or len(grid.data) != grid.width * grid.height):
        return False
    ox, oy, origin_yaw = grid.origin
    co, so = math.cos(origin_yaw), math.sin(origin_yaw)
    initial_pose = (co * (pose[0] - ox) + so * (pose[1] - oy),
                    -so * (pose[0] - ox) + co * (pose[1] - oy), pose[2] - origin_yaw)
    cell_margin = grid.resolution / math.sqrt(2)
    half_x, half_y = HALF_LENGTH_M + margin, HALF_WIDTH_M + margin
    for x, y, yaw in motion_samples(pose, vx, wz, duration):
        gx = co * (x - ox) + so * (y - oy)
        gy = -so * (x - ox) + co * (y - oy)
        c, s = math.cos(yaw - origin_yaw), math.sin(yaw - origin_yaw)
        extent_x = abs(c) * half_x + abs(s) * half_y + cell_margin
        extent_y = abs(s) * half_x + abs(c) * half_y + cell_margin
        min_x = math.floor((gx - extent_x) / grid.resolution)
        max_x = math.floor((gx + extent_x) / grid.resolution)
        min_y = math.floor((gy - extent_y) / grid.resolution)
        max_y = math.floor((gy + extent_y) / grid.resolution)
        if min_x < 0 or min_y < 0 or max_x >= grid.width or max_y >= grid.height:
            return False
        for cy in range(min_y, max_y + 1):
            dy = (cy + 0.5) * grid.resolution - gy
            for cx in range(min_x, max_x + 1):
                value = grid.data[cy * grid.width + cx]
                if 0 <= value < 100:
                    continue
                dx = (cx + 0.5) * grid.resolution - gx
                if (abs(c * dx + s * dy) <= half_x + cell_margin
                        and abs(-s * dx + c * dy) <= half_y + cell_margin):
                    point = ((cx + 0.5) * grid.resolution, (cy + 0.5) * grid.resolution)
                    # Unknown cells are never treated as free escape space.
                    if value < 0 or not margin_escape_allowed(
                        body_clearance(point, initial_pose) - cell_margin,
                        body_clearance(point, (gx, gy, yaw - origin_yaw)) - cell_margin,
                        margin, vx, wz, allow_margin_escape,
                    ):
                        return False
    return True
