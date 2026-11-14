"""Test the real executor logic with fake action futures; never start ROS/motors."""
import ast
import json
import math
from pathlib import Path
import sys
from types import SimpleNamespace as NS
from unittest.mock import Mock

import pytest

CONFIG = Path(__file__).resolve().parents[1] / 'ros2_configs'
sys.path.insert(0, str(CONFIG))
from workflow_navigation_logic import goal_cell_allowed


class Future:
    def __init__(self, result): self.value = result
    def done(self): return True
    def result(self): return self.value


@pytest.fixture
def worker(tmp_path):
    tree = ast.parse((CONFIG / 'workflow_executor.py').read_text(encoding='utf-8'))
    nodes = [n for n in tree.body if isinstance(n, ast.ClassDef)]
    for n in nodes:
        if n.name == 'Executor':
            n.body = [method for method in n.body if getattr(method, 'name', None) != '__init__']
    clock = NS(value=100.0)
    def spin(*args, **kwargs): clock.value += .1
    def goal():
        return NS(pose=NS(header=NS(), pose=NS(position=NS(), orientation=NS())))
    env = {'Node': object, 'time': NS(monotonic=lambda: clock.value, time=lambda: clock.value),
           'rclpy': NS(spin_once=spin), 'json': json, 'math': math, 'Empty': object,
           'NavigateToPose': NS(Goal=goal), 'GoalStatus': NS(STATUS_SUCCEEDED=4),
           'goal_cell_allowed': goal_cell_allowed}
    exec(compile(ast.Module(body=nodes, type_ignores=[]), 'executor', 'exec'), env)
    worker = env['Executor']()
    worker.control = tmp_path / 'control.json'
    worker.control.write_text(json.dumps({'cancel': False, 'expires_at': 200}))
    worker.interrupted = False
    worker.round = worker.index = 0
    worker.statuses, worker.finished_goal_ids = [], set()
    worker.active_goals = 0
    worker.goal = worker.goal_future = None
    worker.emit = Mock()
    worker.reason = Mock(return_value=None)
    worker.check_control = Mock(wraps=worker.check_control)
    worker.spin_checked = Mock(side_effect=lambda: spin())
    origin = NS(position=NS(x=0, y=0), orientation=NS(x=0, y=0, z=0, w=1))
    worker.costmap = NS(info=NS(width=4, height=4, resolution=1, origin=origin), data=[0]*16)
    worker.costmap_at = 100
    worker.get_clock = lambda: NS(now=lambda: NS(to_msg=lambda: NS(sec=100, nanosec=0)))
    handle = NS(accepted=True, goal_id=NS(uuid=[1]*16),
                get_result_async=Mock(return_value=Future(NS(status=4))),
                cancel_goal_async=Mock(return_value=Future(None)))
    worker.client = NS(send_goal_async=Mock(return_value=Future(handle)), server_is_ready=lambda: True)
    worker.stop_pub = NS(publish=Mock())
    worker.handle, worker.clock = handle, clock
    worker.cancel_exception = env['RunCancelled']
    return worker


def test_move_waits_for_its_action_result_and_does_not_accept_a_failed_goal(worker):
    worker.handle.get_result_async.return_value = Future(NS(status=6))  # aborted
    with pytest.raises(RuntimeError, match='status=6'):
        worker.move({'target_x': 1, 'target_y': 1})
    worker.emit.assert_not_called()
    worker.stop_owned_goal()
    worker.handle.cancel_goal_async.assert_called_once()
    worker.stop_pub.publish.assert_called()


def test_succeeded_goal_can_be_followed_by_another_without_stale_status_blocking(worker):
    status = NS(status=2, goal_info=NS(goal_id=worker.handle.goal_id))
    worker.statuses = [status]  # old status update for our own goal
    worker.move({'target_x': 1, 'target_y': 1})
    assert worker.active_goals == 0
    assert worker.goal is None
    worker.move({'target_x': 2, 'target_y': 1})
    assert worker.client.send_goal_async.call_count == 2


def test_external_goal_and_blocked_cell_are_rejected_without_sending(worker):
    worker.active_goals = 1
    with pytest.raises(RuntimeError):
        worker.move({'target_x': 1, 'target_y': 1})
    worker.active_goals = 0
    worker.costmap.data[5] = 100
    with pytest.raises(RuntimeError):
        worker.move({'target_x': 1, 'target_y': 1})
    worker.client.send_goal_async.assert_not_called()


def test_expired_lease_and_cancel_file_stop_execution(worker):
    worker.clock.value = 201
    with pytest.raises(RuntimeError, match='lease'):
        worker.check_control()
    worker.control.write_text('{"cancel":true,"expires_at":300}')
    with pytest.raises(worker.cancel_exception):
        worker.check_control()


def test_repeats_apply_to_whole_workflow_and_interval_only_between_rounds(worker):
    worker.plan = {'steps': [
        {'step_id': 'a', 'type': 'MOVE', 'params': {'target_x': 1, 'target_y': 1}},
        {'step_id': 'b', 'type': 'WAIT', 'params': {'duration_sec': 2}},
    ], 'config': {'repeat_mode': 'COUNT', 'repeat_count': 2, 'interval_seconds': 4}}
    worker.move = Mock()
    worker.wait = Mock()
    worker.execute()
    assert worker.move.call_count == 2
    assert [c.args[0] for c in worker.wait.call_args_list] == [2, 4, 2]
    assert [c.args[0] for c in worker.emit.call_args_list].count('STEP_COMPLETED') == 4
    assert worker.emit.call_args.args[0] == 'COMPLETED'


def test_navigation_error_never_advances_or_emits_completed(worker):
    worker.plan = {'steps': [
        {'step_id': 'a', 'type': 'MOVE', 'params': {}},
        {'step_id': 'b', 'type': 'WAIT', 'params': {'duration_sec': 2}},
    ], 'config': {'repeat_mode': 'COUNT', 'repeat_count': 1, 'interval_seconds': 0}}
    worker.move = Mock(side_effect=RuntimeError('LOCALIZATION_LOST'))
    worker.wait = Mock()
    with pytest.raises(RuntimeError, match='LOCALIZATION_LOST'):
        worker.execute()
    worker.wait.assert_not_called()
    assert 'STEP_COMPLETED' not in [c.args[0] for c in worker.emit.call_args_list]
    assert 'COMPLETED' not in [c.args[0] for c in worker.emit.call_args_list]
