import sys
from pathlib import Path
from types import SimpleNamespace as NS
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'ros2_configs'))
from workflow_navigation_logic import readiness_reason, goal_cell_allowed


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
