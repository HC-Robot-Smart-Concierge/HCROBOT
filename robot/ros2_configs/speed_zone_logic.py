"""Geometry and motor-command limits for Nav2 speed zones (no ROS dependency)."""
import math


def limit_wheel_pwm(left, right, limit_mps, mps_per_pct, min_pwm):
    """Preserve curvature; never let the motor floor override a linear speed cap.

    PWM-to-speed conversion is calibrated open-loop, not measured speed control.
    A cap below the usable motor floor stops translation. Pure spins are unchanged.
    None means unrestricted; zero here means stop (ROS's zero is converted to None).
    """
    if limit_mps is None:
        return left, right
    if not math.isfinite(limit_mps) or limit_mps < 0 or mps_per_pct <= 0:
        return 0, 0
    center_speed = abs(left + right) * 0.5 * mps_per_pct
    if center_speed <= limit_mps or center_speed == 0:
        return left, right
    scale = limit_mps / center_speed
    scaled = tuple(int(math.copysign(math.floor(abs(v) * scale + 1e-9), v)) for v in (left, right))
    # With opposite wheel signs, integer rounding can increase the residual
    # translation. Do not allow that rounding to violate a very small cap.
    if abs(sum(scaled)) * 0.5 * mps_per_pct > limit_mps + 1e-12:
        return 0, 0
    if any(v != 0 and abs(s) < min_pwm for v, s in zip((left, right), scaled)):
        return 0, 0
    return scaled


def speed_mask_regions(width, height, data):
    """4-connected equal-speed regions in ROS grid order; 0/-1 are not zones."""
    if width <= 0 or height <= 0 or len(data) != width * height:
        return []
    pending = {i for i, value in enumerate(data) if 1 <= value <= 100}
    regions = []
    for first in range(width * height):
        if first not in pending:
            continue
        value = data[first]
        pending.remove(first)
        cells, stack = [], [first]
        while stack:
            i = stack.pop()
            x, y = i % width, i // width
            cells.append((x, y))
            for nx, ny in ((x-1, y), (x+1, y), (x, y-1), (x, y+1)):
                j = ny * width + nx
                if 0 <= nx < width and 0 <= ny < height and j in pending and data[j] == value:
                    pending.remove(j)
                    stack.append(j)
        regions.append((value / 100.0, cells))
    return regions
