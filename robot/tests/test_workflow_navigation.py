import sys
from pathlib import Path
from types import SimpleNamespace as NS
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'ros2_configs'))
from workflow_navigation_logic import readiness_reason, goal_cell_allowed, route_segment_end, route_pose_targets, route_window_end


def test_route_grouping_respects_distinct_step_occurrences_and_branch_boundaries():
    def move(group, **extra):
        return {'type': 'MOVE', 'params': {'source_route_id': 'same-route', 'source_route_step_id': group, **extra}}
    steps = [move('a'), move('a'), move('b'), move('b', next_step_id='END'), move('b')]
    assert route_segment_end(steps, 0) == 2
    assert route_segment_end(steps, 2) == 4
    assert route_segment_end([{'type': 'MOVE', 'params': {}}], 0) == 0
    assert route_segment_end([{'type': 'WAIT', 'params': {}}], 0) == 0


def test_closed_route_keeps_return_leg_and_tangents_without_mutating_saved_yaws():
    points = [(0, 0), (1, 0), (1, 1), (0, 0)]
    steps = [{'params': dict(target_x=x, target_y=y, target_yaw=.5)} for x, y in points]
    targets = route_pose_targets(steps)
    assert [(p['target_x'], p['target_y']) for p in targets] == points
    assert targets[0]['target_yaw'] == 0
    assert targets[1]['target_yaw'] == pytest.approx(1.5707963267948966)
    assert targets[-1]['target_yaw'] == .5
    assert all(step['params']['target_yaw'] == .5 for step in steps)


def test_route_windows_do_not_accept_coincident_loop_finish_early():
    targets = [dict(target_x=x, target_y=y) for x, y in [(0, 0), (1, 0), (1, 1), (0, 0)] * 2]
    assert route_window_end(targets, 0, (0, 0)) == 3
    # Near point B, extend through C to A, rather than finishing the first window at C.
    assert route_window_end(targets[:4], 2, (1, 0)) == 4
    assert route_window_end([targets[0], targets[0]], 0, (0, 0)) == 0


def test_ready_requires_matching_map_fresh_localization_and_measured_encoders():
    loc = {'state': 'LOCALIZED', 'map': 'room'}
    health = {'pi_ws_connected': True, 'lidar_live': True, 'encoder_valid': True, 'last_encoder_age_sec': .1}
    assert readiness_reason(loc, 10, health, 10, 'room', 11) is None
    assert readiness_reason(loc, 10, health, 10, 'other', 11)
    assert readiness_reason(loc, 10, health, 10, 'room', 14)
    assert readiness_reason({**loc, 'state': 'LOCALIZATION_LOST'}, 10, health, 10, 'room', 11)
    for patch in ({'encoder_valid': False}, {'last_encoder_age_sec': 2},
                  {'lidar_live': False}, {'pi_ws_connected': False}):
        assert readiness_reason(loc, 10, {**health, **patch}, 10, 'room', 11)


def test_goal_cannot_be_outside_unknown_or_lethal_costmap_cell():
    origin = NS(position=NS(x=0, y=0), orientation=NS(x=0, y=0, z=0, w=1))
    grid = NS(info=NS(width=2, height=2, resolution=1, origin=origin), data=[0, -1, 100, 99])
    assert goal_cell_allowed(grid, .5, .5)
    assert goal_cell_allowed(grid, 1.5, 1.5)
    for x, y in [(1.5, .5), (.5, 1.5), (-.01, .5), (2, .5)]:
        assert not goal_cell_allowed(grid, x, y)
