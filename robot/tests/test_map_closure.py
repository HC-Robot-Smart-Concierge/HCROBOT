"""'Scan finished' = closed wall contour (map_closure) + half-scan unstick coverage."""

import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "ros2_configs"))

from map_closure import map_closure  # noqa: E402
from retreat_logic import body_scan, travel_coverage  # noqa: E402

RES = 0.05
ROBOT = (1.5, 1.2)


def room(gaps=(), unknown=()):
    """60 x 50 cell map, walls on a 50 x 40 rectangle, outside unknown."""
    w, h = 60, 50
    data = [-1] * (w * h)
    for y in range(5, 45):
        for x in range(5, 55):
            data[y * w + x] = 100 if x in (5, 54) or y in (5, 44) else 0
    for x, y in gaps:
        data[y * w + x] = -1
    for x, y in unknown:
        data[y * w + x] = -1
    return data, w, h


def closure(**kw):
    data, w, h = room(**kw)
    return map_closure(data, w, h, RES, (0.0, 0.0), ROBOT)


def test_closed_room_is_finished():
    assert closure().closed


def test_single_missing_wall_cell_is_tolerated():
    assert closure(gaps=[(30, 5)]).closed


def test_wall_gap_is_reported_at_the_opening():
    c = closure(gaps=[(x, 5) for x in range(28, 34)])
    assert not c.closed and len(c.leaks) == 1
    x, y = c.leaks[0]
    assert 1.35 <= x <= 1.75 and 0.2 <= y <= 0.4


def test_gap_and_wide_doorway_are_two_leaks():
    c = closure(gaps=[(x, 5) for x in range(28, 34)] + [(54, y) for y in range(20, 40)])
    assert len(c.leaks) == 2


def test_unknown_pocket_inside_room_does_not_open_it():
    pocket = [(x, y) for y in range(20, 26) for x in range(20, 26)]
    assert closure(unknown=pocket).closed


def test_robot_off_map_gives_no_verdict():
    data, w, h = room()
    assert map_closure(data, w, h, RES, (0.0, 0.0), (99.0, 99.0)) is None


def _scan(hole=None, fill=1.0):
    ranges = [fill] * 360
    if hole:
        for d in range(*hole):
            ranges[d % 360] = float("nan")
    inc = 2 * math.pi / 360
    return 0.5 * inc, inc, ranges, 0.15, 12.0


def test_empty_front_sector_still_allows_reversing():
    scan = _scan(hole=(30, 45))
    assert not body_scan(*scan)[1]
    assert travel_coverage(*scan, "backward")
    assert not travel_coverage(*scan, "forward")


def test_empty_rear_sector_still_allows_forward():
    scan = _scan(hole=(165, 180))
    assert travel_coverage(*scan, "forward")
    assert not travel_coverage(*scan, "backward")


def test_flank_sector_belongs_to_the_half_it_faces():
    assert not travel_coverage(*_scan(hole=(75, 90)), "forward")
    assert not travel_coverage(*_scan(hole=(90, 105)), "backward")


def test_no_return_rays_count_as_observed():
    assert travel_coverage(*_scan(fill=float("inf")), "forward")
