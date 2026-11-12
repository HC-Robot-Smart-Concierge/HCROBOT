"""Zone geometry shared by the API, Nav2 masks and Pi navigation.

Vertices are ordered absolute map coordinates (metres). None means a legacy
rectangle with centre x/y, local width/height and counterclockwise yaw in degrees.
Simple concave polygons are supported; holes and crossing edges are not.
"""
import math

EPS = 1e-9
MAX_VERTICES = 64


def field(obj, key, default=None):
    return obj.get(key, default) if isinstance(obj, dict) else getattr(obj, key, default)


def cross(a, b, c):
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])


def segment_distance(x, y, a, b):
    dx, dy = b[0] - a[0], b[1] - a[1]
    length2 = dx * dx + dy * dy
    t = max(0.0, min(1.0, ((x - a[0]) * dx + (y - a[1]) * dy) / length2)) if length2 else 0.0
    return math.hypot(x - a[0] - t * dx, y - a[1] - t * dy)


def segments_intersect(a, b, c, d):
    ab_c, ab_d, cd_a, cd_b = cross(a, b, c), cross(a, b, d), cross(c, d, a), cross(c, d, b)
    if ((ab_c > EPS and ab_d < -EPS) or (ab_c < -EPS and ab_d > EPS)) and \
            ((cd_a > EPS and cd_b < -EPS) or (cd_a < -EPS and cd_b > EPS)):
        return True
    return any(abs(turn) <= EPS and segment_distance(*p, u, v) <= EPS for turn, p, u, v in (
        (ab_c, c, a, b), (ab_d, d, a, b), (cd_a, a, c, d), (cd_b, b, c, d)))


def validate_vertices(vertices):
    """Return normalized vertices, or raise ValueError (never fall back to a box)."""
    if not isinstance(vertices, (list, tuple)) or not 3 <= len(vertices) <= MAX_VERTICES:
        raise ValueError('Polygon needs 3 to 64 vertices.')
    try:
        points = [(float(field(p, 'x')), float(field(p, 'y'))) for p in vertices]
    except (TypeError, ValueError, OverflowError) as exc:
        raise ValueError('Polygon coordinates must be finite numbers.') from exc
    if not all(math.isfinite(x) and math.isfinite(y) for x, y in points):
        raise ValueError('Polygon coordinates must be finite numbers.')
    n = len(points)
    for i, a in enumerate(points):
        b, c = points[(i + 1) % n], points[(i + 2) % n]
        if math.dist(a, b) <= EPS:
            raise ValueError('Polygon vertices must be distinct.')
        # Adjacent edges may be collinear, but must not double back over each other.
        if abs(cross(a, b, c)) <= EPS and (a[0] - b[0]) * (c[0] - b[0]) + (a[1] - b[1]) * (c[1] - b[1]) > EPS:
            raise ValueError('Polygon edges must not overlap.')
        for j in range(i + 1, n):
            if j == i + 1 or (i == 0 and j == n - 1):
                continue
            if segments_intersect(a, b, points[j], points[(j + 1) % n]):
                raise ValueError('Polygon edges must not cross or touch each other.')
    area2 = sum(cross(points[0], points[i], points[i + 1]) for i in range(1, n - 1))
    if abs(area2) < 0.02:
        raise ValueError('Polygon area must be at least 0.01 square metres.')
    return [{'x': x, 'y': y} for x, y in points]


def zone_points(zone):
    vertices = field(zone, 'vertices')
    if vertices is not None:
        return [(float(field(p, 'x')), float(field(p, 'y'))) for p in vertices]
    x, y = float(field(zone, 'x', 0) or 0), float(field(zone, 'y', 0) or 0)
    w, h = float(field(zone, 'width', 0) or 0) / 2, float(field(zone, 'height', 0) or 0) / 2
    angle = math.radians(float(field(zone, 'yaw', 0) or 0))
    co, si = math.cos(angle), math.sin(angle)
    return [(x + u * co - v * si, y + u * si + v * co) for u, v in ((-w, -h), (w, -h), (w, h), (-w, h))]


def points_bounds(points):
    return min(x for x, _ in points), min(y for _, y in points), max(x for x, _ in points), max(y for _, y in points)


def polygon_geometry(vertices):
    vertices = validate_vertices(vertices)
    x0, y0, x1, y1 = points_bounds([(p['x'], p['y']) for p in vertices])
    return dict(vertices=vertices, x=(x0 + x1) / 2, y=(y0 + y1) / 2, width=x1 - x0, height=y1 - y0, yaw=0.0)


def point_in_polygon(x, y, points):
    inside = False
    for i, a in enumerate(points):
        b = points[(i + 1) % len(points)]
        if segment_distance(x, y, a, b) <= EPS:
            return True  # Edges are part of the zone.
        if (a[1] > y) != (b[1] > y) and x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]:
            inside = not inside
    return inside


def distance_to_polygon(x, y, points):
    if point_in_polygon(x, y, points):
        return 0.0
    return min(segment_distance(x, y, a, points[(i + 1) % len(points)]) for i, a in enumerate(points))


def point_in_zone(x, y, zone):
    return point_in_polygon(x, y, zone_points(zone))


def distance_to_zone(x, y, zone):
    return distance_to_polygon(x, y, zone_points(zone))
