"""Exact drawn-route following: samples stay on the admin's segments, progress is monotonic."""

import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "ros2_configs"))

from drawn_route import advance, densify, reached_end, samples_ahead  # noqa: E402


def pts(*xy, last_yaw=None):
    out = [dict(target_x=x, target_y=y) for x, y in xy]
    if last_yaw is not None:
        out[-1]["target_yaw"] = last_yaw
    return out


L_ROUTE = pts((0, 0), (1, 0), (1, 1))  # an L: right 1 m, then up 1 m


def test_samples_lie_on_the_drawn_segments_not_a_shortcut():
    samples = densify(L_ROUTE)
    for x, y, _, _ in samples:
        on_first = abs(y) < 1e-9 and -1e-9 <= x <= 1 + 1e-9
        on_second = abs(x - 1) < 1e-9 and -1e-9 <= y <= 1 + 1e-9
        assert on_first or on_second  # never cuts the corner from (0,0) to (1,1)
    gaps = [math.hypot(b[0] - a[0], b[1] - a[1]) for a, b in zip(samples, samples[1:])]
    assert max(gaps) <= 0.05 + 1e-9


def test_heading_follows_each_segment_and_endpoint_yaw_is_kept():
    samples = densify(pts((0, 0), (1, 0), (1, 1), last_yaw=math.pi))
    assert samples[0][2] == 0.0
    # Samples 0-20 are the first metre (heading east), 21-40 the second (heading north).
    assert abs(samples[15][2] - 0.0) < 1e-9
    assert abs(samples[30][2] - math.pi / 2) < 1e-9
    assert samples[-1][2] == math.pi


def test_reached_index_marks_route_points_passed():
    samples = densify(L_ROUTE)
    assert samples[0][3] == 0
    assert samples[10][3] == 0          # on the way to point 1
    assert samples[20][3] == 1          # exactly at the corner (1, 0)
    assert samples[-1][3] == 2


def test_lead_in_from_robot_is_not_counted_as_route_progress():
    samples = densify(L_ROUTE, start=(-0.5, 0))
    assert samples[0][:2] == (-0.5, 0.0) and samples[0][3] == -1
    assert all(s[3] == -1 for s in samples[:10])
    assert samples[10][3] == 0


def test_progress_is_monotonic_and_does_not_jump_to_a_later_pass_of_a_loop():
    loop = densify(pts((0, 0), (2, 0), (2, 0.3), (0, 0.3), (0, 0.05)))  # back near the start
    p = advance(loop, (0.5, 0.0), 0)
    assert abs(loop[p][0] - 0.5) < 0.05 and loop[p][1] == 0.0
    # Robot slightly behind its last progress: never go backwards.
    assert advance(loop, (0.3, 0.0), p) == p
    # Near the start again early in the run: must not jump to the end of the loop.
    assert advance(loop, (0.0, 0.05), 0) < 5


def test_far_from_the_line_keeps_last_progress():
    samples = densify(L_ROUTE)
    assert advance(samples, (0.5, 2.0), 3) == 3


def test_samples_ahead_window_and_end_check():
    samples = densify(L_ROUTE)
    ahead = samples_ahead(samples, 0)
    assert ahead and all(0.25 - 1e-9 <= s[0] <= 0.75 + 1e-9 for s in ahead)
    assert reached_end(samples, (1.0, 0.8))
    assert not reached_end(samples, (1.0, 0.5))
