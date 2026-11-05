"""Measured physical robot dimensions in metres (length x width, including wheels)."""

import math

BODY_LENGTH_M = 0.33
BODY_WIDTH_M = 0.17
HALF_LENGTH_M = BODY_LENGTH_M / 2
HALF_WIDTH_M = BODY_WIDTH_M / 2
LIDAR_X_M = 0.08
COLLISION_MARGIN_M = 0.04
TURN_CLEARANCE_RADIUS_M = math.ceil(
    math.hypot(HALF_LENGTH_M + COLLISION_MARGIN_M, HALF_WIDTH_M + COLLISION_MARGIN_M) * 100
) / 100
