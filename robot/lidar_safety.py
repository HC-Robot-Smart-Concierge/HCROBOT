"""LiDAR clearances for the Pi emergency-brake layer (obstacle_safety.py).

Sonar sees a narrow cone and reads null or too far on angled/soft surfaces, so the
brake also checks every fresh LiDAR ray against the real body (33 x 17 cm, LiDAR
at the body centre). Angles follow lidar_service: CCW, 0 = nose, 90 = left.
"""

import math

try:
    from ros2_configs.robot_geometry import COLLISION_MARGIN_M, HALF_LENGTH_M, HALF_WIDTH_M
except ImportError:  # same measured values as ros2_configs/robot_geometry.py
    HALF_LENGTH_M, HALF_WIDTH_M, COLLISION_MARGIN_M = 0.165, 0.085, 0.04

ZONES = ("front", "rear", "left", "right", "turn")


def body_clearances_cm(
    angle_distances,
    angle_timestamps,
    now,
    max_age=0.6,
    half_length=HALF_LENGTH_M,
    half_width=HALF_WIDTH_M,
    margin=COLLISION_MARGIN_M,
):
    """Smallest gap (cm) from the body edge to a fresh LiDAR point, per zone.

    front/rear: points in the straight-driving corridor (body width + margin).
    left/right: points beside the body (body length + margin).
    turn: gap to the circle the body corners sweep when turning in place.
    A zone with no fresh point is None (nothing seen there = clear).
    """
    corner_radius = math.hypot(half_length, half_width)
    best = dict.fromkeys(ZONES)

    def keep(zone, gap_m):
        gap_cm = max(0.0, gap_m) * 100.0
        if best[zone] is None or gap_cm < best[zone]:
            best[zone] = gap_cm

    for deg in range(min(len(angle_distances), len(angle_timestamps))):
        if now - angle_timestamps[deg] > max_age:
            continue
        d = angle_distances[deg]
        if not d or d <= 0:
            continue
        a = math.radians(deg)
        x, y = d * math.cos(a), d * math.sin(a)
        if abs(x) <= half_length and abs(y) <= half_width:
            continue  # the robot's own body/cable
        if abs(y) <= half_width + margin:
            if x > half_length:
                keep("front", x - half_length)
            elif x < -half_length:
                keep("rear", -x - half_length)
        if abs(x) <= half_length + margin:
            if y > half_width:
                keep("left", y - half_width)
            elif y < -half_width:
                keep("right", -y - half_width)
        keep("turn", d - corner_radius)
    return best
