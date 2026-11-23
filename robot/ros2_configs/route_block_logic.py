"""Pure LiDAR check: is something that is not on the saved map standing on the drawn route?

Compared with the route drawn by the admin, not with Nav2's current path: Nav2 replans
around a person, so its own path stops looking blocked before the robot gets close.
A later YOLO check can replace or confirm this by feeding RouteBlockDetector.update().
"""
import math

from robot_geometry import HALF_LENGTH_M

CORRIDOR_HALF_WIDTH_M = 0.20
MAX_AHEAD_OF_NOSE_M = 0.60
FRONT_CONE_RAD = math.radians(60)
MAP_CLEARANCE_M = 0.15
MIN_BLOCKING_BEAMS = 3
# /scan bins can be empty (sparse RPLiDAR), so one missing bin does not split an object.
MAX_BEAM_GAP = 1
CONFIRM_SEC = 0.5
MAX_SCAN_GAP_SEC = 0.5
ROUTE_LOOKAHEAD_M = 1.5
OCCUPIED_THRESHOLD = 65


def distance_to_segment(px, py, ax, ay, bx, by):
    dx, dy = bx - ax, by - ay
    length_sq = dx * dx + dy * dy
    if length_sq <= 1e-12:
        return math.hypot(px - ax, py - ay)
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / length_sq))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def distance_to_polyline(px, py, points):
    if not points:
        return math.inf
    if len(points) == 1:
        return math.hypot(px - points[0][0], py - points[0][1])
    return min(distance_to_segment(px, py, *points[i], *points[i + 1]) for i in range(len(points) - 1))


def route_ahead(targets, index, robot_xy, lookahead=ROUTE_LOOKAHEAD_M):
    """The drawn segment being driven plus the next points, up to lookahead metres past it."""
    if not 0 <= index < len(targets):
        return []
    xy = lambda target: (float(target['target_x']), float(target['target_y']))
    points = [xy(targets[index - 1]) if index > 0 else (float(robot_xy[0]), float(robot_xy[1])), xy(targets[index])]
    travelled = 0.0
    for target in targets[index + 1:]:
        if travelled >= lookahead:
            break
        point = xy(target)
        travelled += math.hypot(point[0] - points[-1][0], point[1] - points[-1][1])
        points.append(point)
    return points


class StaticMap:
    """The saved map. Unknown or off-map cells count as static so they never stop the robot."""

    def __init__(self, width, height, resolution, origin_x, origin_y, origin_yaw, data):
        self.width, self.height, self.resolution = width, height, resolution
        self.origin_x, self.origin_y = origin_x, origin_y
        self.cos, self.sin = math.cos(origin_yaw), math.sin(origin_yaw)
        self.data = data
        radius = max(1, math.ceil(MAP_CLEARANCE_M / resolution))
        self.offsets = [(dx, dy) for dx in range(-radius, radius + 1) for dy in range(-radius, radius + 1)
                        if math.hypot(dx, dy) * resolution <= MAP_CLEARANCE_M]

    def _cell(self, x, y):
        dx, dy = x - self.origin_x, y - self.origin_y
        return (math.floor((self.cos * dx + self.sin * dy) / self.resolution),
                math.floor((-self.sin * dx + self.cos * dy) / self.resolution))

    def is_static(self, x, y):
        gx, gy = self._cell(x, y)
        if not (0 <= gx < self.width and 0 <= gy < self.height) or self.data[gy * self.width + gx] < 0:
            return True
        for dx, dy in self.offsets:
            cx, cy = gx + dx, gy + dy
            if 0 <= cx < self.width and 0 <= cy < self.height and self.data[cy * self.width + cx] >= OCCUPIED_THRESHOLD:
                return True
        return False


def blocking_beams(scan, laser_pose, base_yaw, route, static_map):
    """Indexes of beams that hit a new object on the route, in front of the robot's nose."""
    laser_x, laser_y, laser_yaw = laser_pose
    limit = HALF_LENGTH_M + MAX_AHEAD_OF_NOSE_M
    hits = []
    for i, distance in enumerate(scan.ranges):
        if not math.isfinite(distance) or distance < scan.range_min or distance > min(limit, scan.range_max):
            continue
        world = laser_yaw + scan.angle_min + i * scan.angle_increment
        bearing = math.atan2(math.sin(world - base_yaw), math.cos(world - base_yaw))
        if abs(bearing) > FRONT_CONE_RAD or distance * math.cos(bearing) < HALF_LENGTH_M:
            continue
        x, y = laser_x + distance * math.cos(world), laser_y + distance * math.sin(world)
        if distance_to_polyline(x, y, route) <= CORRIDOR_HALF_WIDTH_M and not static_map.is_static(x, y):
            hits.append(i)
    return hits


def largest_object(indexes, beam_count, max_gap=MAX_BEAM_GAP):
    """Beams in the biggest group of neighbouring hits; the scan wraps around at 360 degrees."""
    if not indexes:
        return 0
    ordered = sorted(indexes)
    groups = [1]
    for previous, current in zip(ordered, ordered[1:]):
        if current - previous <= max_gap + 1:
            groups[-1] += 1
        else:
            groups.append(1)
    if len(groups) > 1 and ordered[0] + beam_count - ordered[-1] <= max_gap + 1:
        groups[0] += groups.pop()
    return max(groups)


class RouteBlockDetector:
    """True once the route stays blocked for confirm_sec without a gap in the scans."""

    def __init__(self, confirm_sec=CONFIRM_SEC, max_gap_sec=MAX_SCAN_GAP_SEC):
        self.confirm_sec, self.max_gap_sec = confirm_sec, max_gap_sec
        self.reset()

    def reset(self):
        self.since = self.last = None

    def update(self, blocked, now):
        if self.last is not None and now - self.last > self.max_gap_sec:
            self.since = None
        self.last = now
        if not blocked:
            self.since = None
            return False
        if self.since is None:
            self.since = now
        return now - self.since >= self.confirm_sec


def scan_blocks_route(scan, laser_pose, base_yaw, route, static_map):
    hits = blocking_beams(scan, laser_pose, base_yaw, route, static_map)
    return largest_object(hits, len(scan.ranges)) >= MIN_BLOCKING_BEAMS
