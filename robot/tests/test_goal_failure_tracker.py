import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "ros2_configs"))

from frontier_logic import GoalFailureTracker  # noqa: E402


def test_goal_is_retried_before_giving_up():
    t = GoalFailureTracker(max_failures=3)
    assert t.record_failure((0.12, 0.82)) is False  # lan 1: thu lai
    assert t.record_failure((0.12, 0.82)) is False  # lan 2: thu lai
    assert t.record_failure((0.12, 0.82)) is True   # lan 3: bo


def test_nearby_goals_count_as_same_place():
    # Frontier dich nhe khi map lon dan van la cung mot cho
    t = GoalFailureTracker(max_failures=2, radius=0.4)
    assert t.record_failure((1.00, 1.00)) is False
    assert t.record_failure((1.15, 0.90)) is True


def test_far_goals_are_counted_separately():
    t = GoalFailureTracker(max_failures=2, radius=0.4)
    assert t.record_failure((0.0, 0.0)) is False
    assert t.record_failure((3.0, 0.0)) is False
    assert t.record_failure((0.1, 0.0)) is True
