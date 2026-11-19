"""Test the real executor logic with fake action futures; never start ROS/motors."""
import json
import math
from types import SimpleNamespace as NS
from unittest.mock import Mock

import pytest

from conftest import Future, route_steps
from workflow_navigation_logic import route_segment_end, route_window_end


def test_route_uses_one_through_poses_action_without_stop_or_individual_move(worker):
    worker.plan = {'steps': route_steps(), 'config': {'repeat_mode': 'COUNT', 'repeat_count': 1, 'interval_seconds': 0}}
    worker.execute()
    worker.client.send_goal_async.assert_not_called()
    worker.route_client.send_goal_async.assert_called_once()
    goal = worker.route_client.send_goal_async.call_args.args[0]
    assert [(p.pose.position.x, p.pose.position.y) for p in goal.poses] == [(1, 1), (2, 1), (2, 2)]
    assert goal.poses[0].pose.orientation.z == pytest.approx(0)
    assert goal.poses[1].pose.orientation.z == pytest.approx(math.sin(math.pi / 4))
    assert goal.poses[-1].pose.orientation.z == pytest.approx(math.sin(.7 / 2))
    assert goal.behavior_tree.endswith('physical_route.xml')
    worker.stop_pub.publish.assert_not_called()
    assert [c.args[0] for c in worker.emit.call_args_list].count('STEP_COMPLETED') == 3


def test_startup_waits_for_route_discovery_without_requiring_single_pose_server(worker):
    worker.plan = {'steps': route_steps(), 'config': {'repeat_mode': 'COUNT', 'repeat_count': 1, 'interval_seconds': 0}}
    worker.client.server_is_ready = lambda: False
    worker.route_client.server_is_ready = lambda: worker.clock.value >= 100.6
    worker.execute()
    assert worker.clock.value >= 100.6
    worker.route_client.send_goal_async.assert_called_once()
    worker.client.send_goal_async.assert_not_called()


def test_startup_reports_missing_route_service_only_after_waiting_and_sends_no_goal(worker):
    worker.plan = {'steps': route_steps(), 'config': {'repeat_mode': 'COUNT', 'repeat_count': 1, 'interval_seconds': 0}}
    worker.route_client.server_is_ready = lambda: False
    with pytest.raises(RuntimeError, match='/navigate_through_poses'):
        worker.execute()
    assert worker.clock.value >= 115
    assert 'STARTED' not in [c.args[0] for c in worker.emit.call_args_list]
    worker.route_client.send_goal_async.assert_not_called()


def test_route_startup_waits_for_tf_before_reporting_started(worker):
    worker.plan = {'steps': route_steps(), 'config': {'repeat_mode': 'COUNT', 'repeat_count': 1, 'interval_seconds': 0}}
    def pose():
        if worker.clock.value < 100.6:
            raise RuntimeError('Chưa có vị trí robot trên map để bắt đầu tuyến.')
        return 0, 0
    worker._route_robot_xy.side_effect = pose
    worker.execute()
    assert worker.clock.value >= 100.6
    worker.route_client.send_goal_async.assert_called_once()


def test_cancel_during_route_discovery_is_obeyed_before_any_motion(worker):
    worker.plan = {'steps': route_steps()}
    worker.route_client.server_is_ready = lambda: False
    worker.control.write_text('{"cancel":true,"expires_at":300}')
    with pytest.raises(worker.cancel_exception):
        worker.execute()
    worker.route_client.send_goal_async.assert_not_called()


def test_route_feedback_tracks_intermediates_but_failure_never_completes_final_point(worker):
    def sent(goal, feedback_callback):
        feedback_callback(NS(feedback=NS(number_of_poses_remaining=2)))
        feedback_callback(NS(feedback=NS(number_of_poses_remaining=1)))
        feedback_callback(NS(feedback=NS(number_of_poses_remaining=0)))
        return Future(worker.handle)
    worker.route_client.send_goal_async.side_effect = sent
    worker.handle.get_result_async.return_value = Future(NS(status=6))
    with pytest.raises(RuntimeError, match='tuyến'):
        worker.follow_route(route_steps())
    assert [c.args[0] for c in worker.emit.call_args_list].count('STEP_COMPLETED') == 2
    assert worker.index == 2
    worker.stop_owned_goal()
    worker.handle.cancel_goal_async.assert_called_once()
    worker.stop_pub.publish.assert_called()


def test_route_does_not_merge_across_wait_or_independent_move(worker):
    steps = route_steps()
    steps += [{'step_id': 'pause', 'type': 'WAIT', 'params': {'duration_sec': 2}},
              {'step_id': 'dock', 'type': 'MOVE', 'params': {'target_x': 0, 'target_y': 0}}]
    worker.plan = {'steps': steps, 'config': {'repeat_mode': 'COUNT', 'repeat_count': 1, 'interval_seconds': 0}}
    worker.wait = Mock()
    worker.execute()
    worker.route_client.send_goal_async.assert_called_once()
    worker.client.send_goal_async.assert_called_once()
    worker.wait.assert_called_once_with(2)


def test_invalid_route_point_rejected_before_any_goal_is_sent(worker):
    worker.costmap.data[10] = 100
    with pytest.raises(RuntimeError, match='Điểm tuyến'):
        worker.follow_route(route_steps())
    worker.route_client.send_goal_async.assert_not_called()


def test_pose_status_cannot_hide_active_route_goal(worker):
    status = NS(status=2, goal_info=NS(goal_id=worker.handle.goal_id))
    worker.on_status(NS(status_list=[status]), 'route')
    worker.on_status(NS(status_list=[]))
    assert worker.active_goals == 1


def test_route_cancelled_while_waiting_for_acceptance_cancels_exact_handle(worker):
    worker.route_client.send_goal_async.return_value = Future(worker.handle)
    worker.future_result = Mock(side_effect=worker.cancel_exception('stop'))
    with pytest.raises(worker.cancel_exception):
        worker.follow_route(route_steps())
    worker.stop_owned_goal()
    worker.handle.cancel_goal_async.assert_called_once()
    assert worker.goal_future is not None


def test_closed_loop_extends_before_intermediate_goal_without_a_stop(worker):
    points = [(0, 0), (1, 0), (1, 1), (0, 0)]
    steps = [{'step_id': str(i), 'type': 'MOVE', 'params': {
        'source_route_id': 'loop', 'target_x': x, 'target_y': y,
    }} for i, (x, y) in enumerate(points)]
    def send(goal, feedback_callback):
        if worker.route_client.send_goal_async.call_count == 1:
            assert len(goal.poses) == 3  # never put the coincident finish in the initial window
            feedback_callback(NS(feedback=NS(number_of_poses_remaining=1,
                                            current_pose=NS(pose=NS(position=NS(x=1, y=0))))))
            result = NS(done=lambda: False)  # controller is still following the first window
            handle = NS(accepted=True, goal_id=NS(uuid=[2]*16), get_result_async=lambda: result)
            return Future(handle)
        assert [(p.pose.position.x, p.pose.position.y) for p in goal.poses] == [(1, 1), (0, 0)]
        return Future(worker.handle)
    worker.route_client.send_goal_async.side_effect = send
    worker.follow_route(steps)
    assert worker.route_client.send_goal_async.call_count == 2
    worker.stop_pub.publish.assert_not_called()
    worker.client.send_goal_async.assert_not_called()
    assert worker.index == 3


def test_cancel_during_route_extension_cancels_previous_and_new_handle(worker):
    previous = NS(accepted=True, goal_id=NS(uuid=[2]*16), cancel_goal_async=Mock(return_value=Future(None)))
    worker.goal = previous
    worker.goal_future = Future(worker.handle)
    worker.stop_owned_goal()
    previous.cancel_goal_async.assert_called_once()
    worker.handle.cancel_goal_async.assert_called_once()


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


def test_database_authorization_timeout_reports_actual_reason_instead_of_admin_stop(worker):
    worker.control.write_text(json.dumps({'cancel': True, 'expires_at': 200,
                                          'stop_reason': 'Backend không xác nhận được quyền quản lý lượt chạy trong 20 giây.'}))
    with pytest.raises(RuntimeError, match='quyền quản lý'):
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
