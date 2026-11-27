"""Follow the admin's drawn route exactly: dense path samples + monotonic progress (no ROS).

The planner-based route (NavigateThroughPoses + ComputePathThroughPoses) let Nav2 pick
its own path between route points, cutting corners or detouring. Here the route is the
straight segments the admin drew, sampled every few centimetres and handed to the
controller as-is; the executor waits when an obstacle sits on it instead of re-routing.
"""

import math

SPACING_M = 0.05


def densify(targets, spacing=SPACING_M, start=None):
    """Samples [(x, y, yaw, reached)] along the drawn segments.

    targets: route points (dicts with target_x/target_y, optional target_yaw on the last).
    reached: index of the last route point at or behind the sample (-1 on a lead-in
    segment from `start`, the robot position, to the first point).
    """
    points = [(float(t['target_x']), float(t['target_y'])) for t in targets]
    samples = []
    if start is not None and math.hypot(points[0][0] - start[0], points[0][1] - start[1]) > spacing:
        samples.append([float(start[0]), float(start[1]), None, -1])
        _segment(samples, points[0], spacing, reached_on_way=-1, reached_at_end=0)
    else:
        samples.append([points[0][0], points[0][1], None, 0])
    for i in range(1, len(points)):
        _segment(samples, points[i], spacing, reached_on_way=i - 1, reached_at_end=i)
    # Heading: along the next segment; the last sample keeps the endpoint yaw if given.
    for i in range(len(samples)):
        if samples[i][2] is None:
            nxt = next((s for s in samples[i + 1:] if (s[0], s[1]) != (samples[i][0], samples[i][1])), None)
            samples[i][2] = math.atan2(nxt[1] - samples[i][1], nxt[0] - samples[i][0]) if nxt else (
                samples[i - 1][2] if i else 0.0)
    last_yaw = targets[-1].get('target_yaw')
    if last_yaw is not None:
        samples[-1][2] = float(last_yaw)
    return [tuple(s) for s in samples]


def _segment(samples, end, spacing, reached_on_way, reached_at_end):
    x0, y0 = samples[-1][0], samples[-1][1]
    dx, dy = end[0] - x0, end[1] - y0
    length = math.hypot(dx, dy)
    if length < 1e-6:
        samples[-1][3] = reached_at_end
        return
    yaw = math.atan2(dy, dx)
    if samples[-1][2] is None:
        samples[-1][2] = yaw
    n = max(1, math.ceil(length / spacing))
    for k in range(1, n + 1):
        samples.append([x0 + dx * k / n, y0 + dy * k / n, yaw, reached_at_end if k == n else reached_on_way])


def advance(samples, robot, current, lookahead=40, max_offset=0.5):
    """Progress index: nearest sample ahead within `lookahead` samples (~2 m).

    Never moves backwards and never jumps to a later pass of a looping route.
    """
    best, best_d = current, math.inf
    for i in range(current, min(len(samples), current + lookahead + 1)):
        d = math.hypot(samples[i][0] - robot[0], samples[i][1] - robot[1])
        if d < best_d:
            best, best_d = i, d
    return best if best_d <= max_offset else current


def samples_ahead(samples, current, near_m=0.25, far_m=0.75):
    """Path samples between near_m and far_m along the path ahead of `current`."""
    out, travelled = [], 0.0
    for i in range(current + 1, len(samples)):
        travelled += math.hypot(samples[i][0] - samples[i - 1][0], samples[i][1] - samples[i - 1][1])
        if travelled > far_m:
            break
        if travelled >= near_m:
            out.append(samples[i])
    return out


def reached_end(samples, robot, tolerance=0.30):
    x, y = samples[-1][0], samples[-1][1]
    return math.hypot(x - robot[0], y - robot[1]) <= tolerance
