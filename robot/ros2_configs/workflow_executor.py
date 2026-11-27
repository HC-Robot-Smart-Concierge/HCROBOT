#!/usr/bin/env python3
"""Execute one validated workflow snapshot using correlated Nav2 action results.

Backend renews a 10 s lease in a control file. Missing lease, cancellation,
lost localization, stale sensors, rejection, or timeout stops this run.
"""
import json
import math
import os
from pathlib import Path
import signal
import sys
import time

import rclpy
from rclpy.node import Node
from rclpy.action import ActionClient
from rclpy.qos import QoSProfile, DurabilityPolicy, ReliabilityPolicy, qos_profile_sensor_data
from action_msgs.msg import GoalStatus, GoalStatusArray
from nav2_msgs.action import FollowPath, NavigateToPose, NavigateThroughPoses
from geometry_msgs.msg import PoseStamped
from nav_msgs.msg import OccupancyGrid, Path as RosPath
from sensor_msgs.msg import LaserScan
from std_msgs.msg import Empty, String
from tf2_ros import Buffer, TransformListener
from drawn_route import advance, densify, reached_end, samples_ahead
from workflow_guest_hold import GuestHoldMixin
from workflow_navigation_logic import (
    ReadinessDebouncer, readiness_reason, goal_cell_allowed, route_segment_end, route_pose_targets, route_window_end,
)

# 'drawn' (default): track exactly the polyline the admin drew, controller only, wait on
# obstacles. 'planner': the previous NavigateThroughPoses behaviour (Nav2 picks the path).
ROUTE_MODE = os.getenv('HCROBOT_ROUTE_MODE', 'drawn').strip().lower()
BLOCKED_WAIT_SEC = float(os.getenv('HCROBOT_ROUTE_BLOCKED_WAIT_SEC', '20'))
LEAD_IN_MAX_M = 1.5          # straight, collision-checked hop onto the route; else Nav2 plans it
# Regulated Pure Pursuit, defined in nav2_params.yaml for drawn routes only.
DRAWN_ROUTE_CONTROLLER = os.getenv('HCROBOT_DRAWN_ROUTE_CONTROLLER', 'FollowDrawnPath')
INVALID_CONTROLLER = 101     # nav2_msgs/action/FollowPath result error_code
MAX_ABORTS_WITHOUT_PROGRESS = 3


class RunCancelled(Exception):
    pass


class Executor(GuestHoldMixin, Node):
    def __init__(self, plan, control, events):
        super().__init__('workflow_executor')
        self.plan, self.control = plan, control
        self.setup_guest_hold(plan)
        self.events = open(events, 'a', encoding='utf-8')
        self.localization, self.health = {}, {}
        self.loc_at = self.health_at = self.costmap_at = 0
        # Lỗi encoder/định vị thoáng qua không hủy cả tuyến dài (workflow_navigation_logic).
        self.readiness = ReadinessDebouncer()
        self.costmap = None
        self.goal = None
        self.goal_future = None
        self.active_goals = 0
        self.statuses = []
        self.statuses_by_action = {}
        self.route_context = None
        self.route_sequence = 0
        self.finished_goal_ids = set()
        self.interrupted = False
        self.round = self.index = 0
        latched = QoSProfile(depth=1, reliability=ReliabilityPolicy.RELIABLE,
                            durability=DurabilityPolicy.TRANSIENT_LOCAL)
        self.create_subscription(String, '/localization/state', self.on_localization, latched)
        self.create_subscription(String, '/robot/sensor_health', self.on_health, 10)
        self.create_subscription(OccupancyGrid, '/global_costmap/costmap', self.on_costmap, latched)
        self.create_subscription(GoalStatusArray, '/navigate_to_pose/_action/status', self.on_status, latched)
        self.create_subscription(GoalStatusArray, '/navigate_through_poses/_action/status',
                                 lambda msg: self.on_status(msg, 'route'), latched)
        if self.parallel:
            self.create_subscription(LaserScan, '/scan', self.on_scan, qos_profile_sensor_data)
            self.create_subscription(OccupancyGrid, '/map', self.on_static_map, latched)
            self.create_subscription(String, '/robot/person_detections', self.on_person_detections, 10)
        self.stop_pub = self.create_publisher(Empty, '/robot/nav_cancel', 10)
        self.client = ActionClient(self, NavigateToPose, '/navigate_to_pose')
        self.route_client = ActionClient(self, NavigateThroughPoses, '/navigate_through_poses')
        self.follow_client = ActionClient(self, FollowPath, '/follow_path')
        self.tf_buffer = Buffer()
        self.tf_listener = TransformListener(self.tf_buffer, self)
        signal.signal(signal.SIGTERM, lambda *_: setattr(self, 'interrupted', True))
        signal.signal(signal.SIGINT, lambda *_: setattr(self, 'interrupted', True))

    def on_status(self, msg, action='pose'):
        if not hasattr(self, 'statuses_by_action'):
            self.statuses_by_action = {}
        self.statuses_by_action[action] = msg.status_list
        self.statuses = [status for values in self.statuses_by_action.values() for status in values]
        self._refresh_active_goals()

    def _refresh_active_goals(self):
        self.active_goals = sum(s.status in (1, 2) and bytes(s.goal_info.goal_id.uuid) not in self.finished_goal_ids
                                for s in self.statuses)

    def on_localization(self, msg):
        try:
            self.localization = json.loads(msg.data)
            self.loc_at = time.monotonic()
        except ValueError:
            pass

    def on_health(self, msg):
        try:
            self.health = json.loads(msg.data)
            self.health_at = time.monotonic()
        except ValueError:
            pass

    def on_costmap(self, msg):
        if msg.header.frame_id.lstrip('/') == 'map':
            self.costmap, self.costmap_at = msg, time.monotonic()

    def emit(self, kind, message=None):
        self.events.write(json.dumps(dict(type=kind, message=message, step_index=self.index,
                                         round_index=self.round, at=time.time()), ensure_ascii=False) + '\n')
        self.events.flush()

    def check_control(self):
        if self.interrupted:
            raise RunCancelled('Đã nhận yêu cầu dừng.')
        try:
            control = json.loads(self.control.read_text(encoding='utf-8'))
        except (OSError, ValueError) as exc:
            raise RuntimeError('Mất kênh điều khiển backend.') from exc
        self.last_control = control
        if control.get('cancel'):
            if control.get('stop_reason'):
                raise RuntimeError(control['stop_reason'])
            raise RunCancelled('Admin đã dừng lượt chạy.')
        if control.get('expires_at', 0) < time.time():
            raise RuntimeError('Quá hạn tín hiệu duy trì lượt chạy (lease): backend chưa gia hạn kịp.')

    def reason(self):
        return readiness_reason(self.localization, self.loc_at, self.health, self.health_at,
                                self.plan['map_id'], time.monotonic())

    def spin_idle(self):
        rclpy.spin_once(self, timeout_sec=0.1)

    def _scan_poses(self):
        """(x, y, yaw) of the laser, and of base_link, in the map frame."""
        poses = []
        for frame in ('laser_frame', 'base_link'):
            transform = self.tf_buffer.lookup_transform('map', frame, rclpy.time.Time()).transform
            q = transform.rotation
            yaw = math.atan2(2 * (q.w * q.z + q.x * q.y), 1 - 2 * (q.y * q.y + q.z * q.z))
            poses.append((transform.translation.x, transform.translation.y, yaw))
        return poses

    def spin_checked(self):
        rclpy.spin_once(self, timeout_sec=0.1)
        self.check_control()
        self.check_guest_interrupt()
        raw = self.reason()
        if raw and self.readiness.since is None:
            self.get_logger().warn(
                f'Xe tạm chưa sẵn sàng: {raw} (chờ tối đa {self.readiness.grace_sec:.0f} s rồi mới hủy lượt)')
        reason = self.readiness.update(raw, time.monotonic())
        if reason:
            raise RuntimeError(reason)

    def wait(self, seconds):
        until = time.monotonic() + seconds
        while time.monotonic() < until:
            self.spin_checked()

    def future_result(self, future, deadline):
        while not future.done():
            self.spin_checked()
            if time.monotonic() >= deadline:
                raise TimeoutError('Quá thời gian chờ Nav2.')
        return future.result()

    def _required_navigation_clients(self):
        clients = {}
        for step in self.plan['steps']:
            if step['type'] != 'MOVE':
                continue
            params = step.get('params') or {}
            if (params.get('source_route_step_id') or params.get('source_route_id')) and ROUTE_MODE == 'drawn':
                clients['/follow_path'] = self.follow_client
                clients['/navigate_to_pose'] = self.client  # only for a long hop onto the route
            elif params.get('source_route_step_id') or params.get('source_route_id'):
                clients['/navigate_through_poses'] = self.route_client
            else:
                clients['/navigate_to_pose'] = self.client
        return clients

    def _wait_navigation_ready(self, timeout_sec=15.0):
        """ROS discovers each action independently; wait for those used by this plan."""
        clients = self._required_navigation_clients()
        deadline = time.monotonic() + timeout_sec
        while True:
            rclpy.spin_once(self, timeout_sec=0.1)
            self.check_control()
            reason = self.reason()
            unavailable = [name for name, client in clients.items() if not client.server_is_ready()]
            if not reason and unavailable:
                reason = f"Chưa kết nối được Nav2 {', '.join(unavailable)}."
            if not reason and (self.costmap is None or time.monotonic() - self.costmap_at > 3):
                reason = 'Chưa có costmap Nav2 mới.'
            if not reason and ('/navigate_through_poses' in clients or '/follow_path' in clients):
                try:
                    self._route_robot_xy()
                except RuntimeError as exc:
                    reason = str(exc)
            if not reason:
                return
            if time.monotonic() >= deadline:
                raise RuntimeError(f'Chưa thể bắt đầu sau {timeout_sec:.0f} giây: {reason}')

    def move(self, params):
        if self.active_goals:
            raise RuntimeError('Nav2 đang có goal khác; không ghi đè nhiệm vụ đang chạy.')
        if self.costmap is None or time.monotonic() - self.costmap_at > 3:
            raise RuntimeError('Chưa có costmap Nav2 mới.')
        if not goal_cell_allowed(self.costmap, params['target_x'], params['target_y']):
            raise RuntimeError('Điểm đến ngoài map, chưa biết hoặc nằm trong vật cản/vùng cấm.')
        goal = NavigateToPose.Goal()
        goal.pose.header.frame_id = 'map'
        goal.pose.header.stamp = self.get_clock().now().to_msg()
        goal.pose.pose.position.x = float(params['target_x'])
        goal.pose.pose.position.y = float(params['target_y'])
        yaw = float(params.get('target_yaw', 0))
        goal.pose.pose.orientation.z = math.sin(yaw / 2)
        goal.pose.pose.orientation.w = math.cos(yaw / 2)
        deadline = time.monotonic() + params.get('timeout_sec', 120)
        self.goal_future = self.client.send_goal_async(goal)
        self.goal = self.future_result(self.goal_future, deadline)
        if not self.goal.accepted:
            self.goal = self.goal_future = None
            raise RuntimeError('Nav2 từ chối goal.')
        result = self.future_result(self.goal.get_result_async(), deadline)
        if result.status != GoalStatus.STATUS_SUCCEEDED:
            raise RuntimeError(f'Nav2 không hoàn thành goal (status={result.status}).')
        self.finished_goal_ids.add(bytes(self.goal.goal_id.uuid))
        self._refresh_active_goals()
        self.goal = self.goal_future = None
        # Drain the action status update before the next step's busy check.
        for _ in range(5):
            self.spin_checked()

    def _on_route_feedback(self, msg, sequence):
        context = self.route_context
        if context is None or context['sequence'] != sequence:
            return
        remaining = msg.feedback.number_of_poses_remaining
        count = context['window_end'] - context['window_start']
        if not 0 <= remaining <= count:
            return
        # Feedback can confirm intermediate passage, never final success.
        passed = context['window_start'] + min(count - remaining, count - 1)
        self._advance_route_progress(passed)
        if context['window_end'] < len(context['steps']) and remaining <= 1:
            position = msg.feedback.current_pose.pose.position
            end = route_window_end(context['targets'], passed, (position.x, position.y))
            if end > context['window_end']:
                context['extension'] = (passed, end)

    def _advance_route_progress(self, passed):
        context = self.route_context
        passed = min(passed, len(context['steps']) - 1)
        while context['completed'] < passed:
            self.index = context['start'] + context['completed']
            self.emit('STEP_COMPLETED')
            context['completed'] += 1
            self.index = context['start'] + context['completed']
            self.emit('STEP_STARTED', context['steps'][context['completed']].get('title'))

    def _route_robot_xy(self):
        try:
            transform = self.tf_buffer.lookup_transform('map', 'base_link', rclpy.time.Time())
            return transform.transform.translation.x, transform.transform.translation.y
        except Exception as exc:
            raise RuntimeError('Chưa có vị trí robot trên map để bắt đầu tuyến.') from exc

    def _send_route_window(self, start, end, deadline):
        context = self.route_context
        goal = NavigateThroughPoses.Goal()
        goal.behavior_tree = str(Path(__file__).resolve().parent / 'nav2' / 'physical_route.xml')
        for target in context['targets'][start:end]:
            pose = PoseStamped()
            pose.header.frame_id = 'map'
            pose.header.stamp = self.get_clock().now().to_msg()
            pose.pose.position.x = float(target['target_x'])
            pose.pose.position.y = float(target['target_y'])
            yaw = float(target.get('target_yaw', 0))
            pose.pose.orientation.z, pose.pose.orientation.w = math.sin(yaw / 2), math.cos(yaw / 2)
            goal.poses.append(pose)
        self.route_sequence += 1
        sequence = self.route_sequence
        context.update(sequence=sequence, window_start=start, window_end=end, extension=None)
        previous = self.goal
        self.goal_future = self.route_client.send_goal_async(
            goal, feedback_callback=lambda msg: self._on_route_feedback(msg, sequence))
        replacement = self.future_result(self.goal_future, deadline)
        if not replacement.accepted:
            raise RuntimeError('Nav2 từ chối tuyến.')
        self.goal = replacement
        if previous is not None:
            self.finished_goal_ids.add(bytes(previous.goal_id.uuid))
        return self.goal.get_result_async()

    def follow_route(self, steps):
        """Drive a FOLLOW_ROUTE stretch. GuestHoldMixin.run_route resumes it with the steps
        not yet passed, so both modes report progress through _advance_route_progress."""
        if ROUTE_MODE == 'planner':
            return self._follow_route_planner(steps)
        return self._follow_drawn_route(steps)

    def _follow_drawn_route(self, steps):
        """Track the admin-drawn polyline with the controller only (no global planner).

        An obstacle on the line stops the robot: it waits up to BLOCKED_WAIT_SEC for the
        line ahead to clear, then continues on the same line. It never detours.
        """
        if self.active_goals:
            raise RuntimeError('Nav2 đang có goal khác; không ghi đè nhiệm vụ đang chạy.')
        self._wait_action_server(self.follow_client, '/follow_path')
        if self.costmap is None or time.monotonic() - self.costmap_at > 3:
            raise RuntimeError('Chưa có costmap Nav2 mới.')
        targets = route_pose_targets(steps)
        for target in targets:
            if not goal_cell_allowed(self.costmap, target['target_x'], target['target_y']):
                raise RuntimeError('Điểm tuyến ngoài map, chưa biết hoặc nằm trong vật cản/vùng cấm.')
        context = dict(start=self.index, steps=steps, targets=targets, completed=0)
        self.route_context = context
        deadline = time.monotonic() + sum(target.get('timeout_sec', 120) for target in targets)
        try:
            start = self._route_robot_xy()
            hop = densify(targets[:1], start=start)
            if (math.hypot(targets[0]['target_x'] - start[0], targets[0]['target_y'] - start[1]) > LEAD_IN_MAX_M
                    or not all(goal_cell_allowed(self.costmap, x, y) for x, y, _, _ in hop)):
                # Getting onto the drawn route is the only leg Nav2 may plan.
                self.get_logger().info('Robot xa điểm đầu tuyến: để Nav2 đưa tới điểm đầu, rồi bám đúng đường vẽ')
                first = targets[0]
                self.move(dict(target_x=first['target_x'], target_y=first['target_y'],
                               target_yaw=first.get('target_yaw', 0), timeout_sec=first.get('timeout_sec', 120)))
                start = None
            samples = densify(targets, start=start)
            progress, aborts, abort_progress = 0, 0, -1
            while True:
                future = self._send_follow_path(samples[min(progress, len(samples) - 2):], deadline)
                while not future.done():
                    self.spin_checked()
                    progress = advance(samples, self._route_robot_xy(), progress)
                    if samples[progress][3] >= 0:
                        self._advance_route_progress(samples[progress][3])
                    if time.monotonic() >= deadline:
                        raise TimeoutError('Quá thời gian chờ hoàn thành tuyến.')
                result = future.result()
                if self.goal is not None:
                    self.finished_goal_ids.add(bytes(self.goal.goal_id.uuid))
                self.goal = self.goal_future = None
                self._refresh_active_goals()
                if result.status == GoalStatus.STATUS_SUCCEEDED and reached_end(samples, self._route_robot_xy()):
                    break
                if getattr(result.result, 'error_code', 0) == INVALID_CONTROLLER:
                    raise RuntimeError(f'Navigation chưa nạp bộ điều khiển {DRAWN_ROUTE_CONTROLLER} '
                                       '(bám đường vẽ). Tắt rồi bật lại Navigation trên web.')
                if result.status == GoalStatus.STATUS_CANCELED:
                    # Web E-stop / bridge encoder fault / cancel-all: never drive on by ourselves.
                    raise RuntimeError('Tuyến bị dừng từ bên ngoài (dừng khẩn cấp, lỗi encoder hoặc lệnh dừng).')
                aborts = aborts + 1 if progress == abort_progress else 1
                abort_progress = progress
                if aborts > MAX_ABORTS_WITHOUT_PROGRESS:
                    raise RuntimeError('Không đi tiếp được trên đường vẽ sau nhiều lần thử '
                                       '(vật cản sát xe, Pi chặn lệnh hoặc encoder).')
                self._wait_drawn_path_clear(samples, progress, deadline)
            self._advance_route_progress(len(steps) - 1)
        finally:
            self.route_context = None

    def _wait_action_server(self, client, name):
        deadline = time.monotonic() + 5.0
        while not client.server_is_ready():
            self.spin_checked()
            if time.monotonic() >= deadline:
                raise RuntimeError(f'Không kết nối được Nav2 {name} sau 5 giây. Kiểm tra Navigation.')

    def _send_follow_path(self, samples, deadline):
        goal = FollowPath.Goal()
        goal.controller_id = DRAWN_ROUTE_CONTROLLER
        path = RosPath()
        path.header.frame_id = 'map'
        path.header.stamp = self.get_clock().now().to_msg()
        for x, y, yaw, _ in samples:
            pose = PoseStamped()
            pose.header = path.header
            pose.pose.position.x, pose.pose.position.y = float(x), float(y)
            pose.pose.orientation.z, pose.pose.orientation.w = math.sin(yaw / 2), math.cos(yaw / 2)
            path.poses.append(pose)
        goal.path = path
        self.goal_future = self.follow_client.send_goal_async(goal)
        handle = self.future_result(self.goal_future, deadline)
        if not handle.accepted:
            self.goal = self.goal_future = None
            raise RuntimeError('Nav2 từ chối đường vẽ (controller /follow_path).')
        self.goal = handle
        return handle.get_result_async()

    def _wait_drawn_path_clear(self, samples, progress, deadline):
        """Stopped on the drawn line: hold until the next stretch is free, then resume on it."""
        since = time.monotonic()
        self.emit('STEP_RETRY', f'Đường vẽ phía trước bị chắn hoặc xe chưa đi được: dừng chờ tối đa '
                                f'{BLOCKED_WAIT_SEC:.0f} giây rồi đi tiếp đúng đường vẽ.')
        while True:
            self.spin_checked()
            now = time.monotonic()
            ahead = samples_ahead(samples, progress)
            clear = (self.costmap is not None and now - self.costmap_at <= 3
                     and all(goal_cell_allowed(self.costmap, x, y) for x, y, _, _ in ahead))
            if clear and now - since >= 1.0:
                return
            if now - since >= BLOCKED_WAIT_SEC:
                raise RuntimeError(f'Đường vẽ bị chắn quá {BLOCKED_WAIT_SEC:.0f} giây; '
                                   'robot không tự đi vòng. Dọn đường rồi chạy lại.')
            if now >= deadline:
                raise TimeoutError('Quá thời gian chờ hoàn thành tuyến.')

    def _follow_route_planner(self, steps):
        if self.active_goals:
            raise RuntimeError('Nav2 đang có goal khác; không ghi đè nhiệm vụ đang chạy.')
        if not self.route_client.server_is_ready():
            deadline = time.monotonic() + 5.0
            while not self.route_client.server_is_ready():
                self.spin_checked()
                if time.monotonic() >= deadline:
                    raise RuntimeError('Không kết nối được Nav2 /navigate_through_poses sau 5 giây. Kiểm tra Navigation.')
        if self.costmap is None or time.monotonic() - self.costmap_at > 3:
            raise RuntimeError('Chưa có costmap Nav2 mới.')
        targets = route_pose_targets(steps)
        for target in targets:
            if not goal_cell_allowed(self.costmap, target['target_x'], target['target_y']):
                raise RuntimeError('Điểm tuyến ngoài map, chưa biết hoặc nằm trong vật cản/vùng cấm.')
        end = route_window_end(targets, 0, self._route_robot_xy())
        if not end:
            raise RuntimeError('Các điểm tuyến quá gần vị trí hiện tại để phân biệt chặng đi; giãn các điểm trên map.')
        context = dict(start=self.index, steps=steps, targets=targets, completed=0)
        self.route_context = context
        deadline = time.monotonic() + sum(target.get('timeout_sec', 120) for target in targets)
        try:
            future = self._send_route_window(0, end, deadline)
            while True:
                if context['extension']:
                    # Same action server + BT: replace its remaining goals while
                    # FollowPath is still running, without a stop at the window end.
                    start, end = context['extension']
                    future = self._send_route_window(start, end, deadline)
                if future.done():
                    result = future.result()
                    if result.status != GoalStatus.STATUS_SUCCEEDED:
                        detail = getattr(getattr(result, 'result', None), 'error_msg', '')
                        raise RuntimeError(f'Nav2 không hoàn thành tuyến (status={result.status}). {detail}'.strip())
                    if context['window_end'] == len(steps):
                        break
                    # A short window may finish before a feedback update permits
                    # extension. Continue the remaining route, never call it done.
                    start = context['window_end']
                    self._advance_route_progress(start)
                    end = route_window_end(targets, start, self._route_robot_xy())
                    if end == start:
                        raise RuntimeError('Các điểm còn lại quá gần để phân biệt tiến trình của tuyến.')
                    future = self._send_route_window(start, end, deadline)
                self.spin_checked()
                if time.monotonic() >= deadline:
                    raise TimeoutError('Quá thời gian chờ Nav2 hoàn thành tuyến.')
            self._advance_route_progress(len(steps) - 1)
            self.finished_goal_ids.add(bytes(self.goal.goal_id.uuid))
            self._refresh_active_goals()
            self.goal = self.goal_future = None
        finally:
            self.route_context = None

    def stop_owned_goal(self):
        if self.goal is not None or self.goal_future is not None:
            # Brake immediately; do not wait on an unresponsive action server.
            self.stop_pub.publish(Empty())
        # A cancel can arrive while the action server is accepting our goal.
        # Wait briefly for its handle, then cancel that exact goal UUID.
        handles = [self.goal] if self.goal is not None else []
        if self.goal_future is not None:
            until = time.monotonic() + 3
            while not self.goal_future.done() and time.monotonic() < until:
                rclpy.spin_once(self, timeout_sec=0.1)
            if self.goal_future.done():
                try:
                    accepted = self.goal_future.result()
                except Exception:
                    accepted = None  # still cancel any previously accepted window
                if accepted is not None and all(accepted is not handle for handle in handles):
                    handles.append(accepted)
        for handle in handles:
            if not handle.accepted:
                continue
            future = handle.cancel_goal_async()
            self.stop_pub.publish(Empty())
            until = time.monotonic() + 3
            while not future.done() and time.monotonic() < until:
                rclpy.spin_once(self, timeout_sec=0.1)

    def execute(self):
        # Collect real readiness data before sending any action.
        self._wait_navigation_ready()
        config, steps = self.plan['config'], self.plan['steps']
        ids = {step['step_id']: i for i, step in enumerate(steps)}
        self.emit('STARTED')
        while config['repeat_mode'] == 'CONTINUOUS' or self.round < config['repeat_count']:
            self.index = 0
            visits = 0
            while self.index < len(steps):
                self.run_guarded(self.spin_checked)
                visits += 1
                if visits > 10000:
                    raise RuntimeError('Vượt 10000 lần chuyển bước trong một vòng; kiểm tra nhánh lặp.')
                step = steps[self.index]
                self.emit('STEP_STARTED', step.get('title'))
                if step['type'] == 'MOVE':
                    end = route_segment_end(steps, self.index)
                    if end > self.index:
                        self.run_route(steps, end)
                        self.index = end - 1
                        step = steps[self.index]
                    else:
                        self.run_guarded(lambda: self.move(step['params']))
                elif step['type'] == 'WAIT':
                    self.run_guarded(lambda: self.wait(step['params'].get('duration_sec', 5)))
                else:
                    raise RuntimeError(f"Loại bước chưa được hỗ trợ: {step['type']}")
                self.emit('STEP_COMPLETED')
                next_id = step.get('params', {}).get('next_step_id')
                self.index = len(steps) if next_id == 'END' else ids[next_id] if next_id else self.index + 1
            self.round += 1
            self.emit('ROUND_COMPLETED')
            if config['repeat_mode'] == 'CONTINUOUS' or self.round < config['repeat_count']:
                self.run_guarded(lambda: self.wait(config['interval_seconds']))
        self.emit('COMPLETED')


def main():
    request, control, events = map(Path, sys.argv[1:4])
    plan = json.loads(request.read_text(encoding='utf-8'))
    rclpy.init()
    node = Executor(plan, control, events)
    try:
        node.execute()
    except RunCancelled as exc:
        node.stop_owned_goal()
        node.emit('CANCELLED', str(exc))
    except Exception as exc:
        node.stop_owned_goal()
        node.emit('FAILED', str(exc))
    finally:
        node.events.close()
        node.destroy_node()
        rclpy.shutdown()


if __name__ == '__main__':
    main()
