#!/usr/bin/env python3
"""Execute one validated workflow snapshot using correlated Nav2 action results.

Backend renews a 10 s lease in a control file. Missing lease, cancellation,
lost localization, stale sensors, rejection, or timeout stops this run.
"""
import json
import math
from pathlib import Path
import signal
import sys
import time

import rclpy
from rclpy.node import Node
from rclpy.action import ActionClient
from rclpy.qos import QoSProfile, DurabilityPolicy, ReliabilityPolicy
from action_msgs.msg import GoalStatus, GoalStatusArray
from nav2_msgs.action import NavigateToPose
from nav_msgs.msg import OccupancyGrid
from std_msgs.msg import Empty, String
from workflow_navigation_logic import readiness_reason, goal_cell_allowed


class RunCancelled(Exception):
    pass


class Executor(Node):
    def __init__(self, plan, control, events):
        super().__init__('workflow_executor')
        self.plan, self.control = plan, control
        self.events = open(events, 'a', encoding='utf-8')
        self.localization, self.health = {}, {}
        self.loc_at = self.health_at = self.costmap_at = 0
        self.costmap = None
        self.goal = None
        self.goal_future = None
        self.active_goals = 0
        self.statuses = []
        self.finished_goal_ids = set()
        self.interrupted = False
        self.round = self.index = 0
        latched = QoSProfile(depth=1, reliability=ReliabilityPolicy.RELIABLE,
                            durability=DurabilityPolicy.TRANSIENT_LOCAL)
        self.create_subscription(String, '/localization/state', self.on_localization, latched)
        self.create_subscription(String, '/robot/sensor_health', self.on_health, 10)
        self.create_subscription(OccupancyGrid, '/global_costmap/costmap', self.on_costmap, latched)
        self.create_subscription(GoalStatusArray, '/navigate_to_pose/_action/status', self.on_status, latched)
        self.stop_pub = self.create_publisher(Empty, '/robot/nav_cancel', 10)
        self.client = ActionClient(self, NavigateToPose, '/navigate_to_pose')
        signal.signal(signal.SIGTERM, lambda *_: setattr(self, 'interrupted', True))
        signal.signal(signal.SIGINT, lambda *_: setattr(self, 'interrupted', True))

    def on_status(self, msg):
        self.statuses = msg.status_list
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
        if control.get('cancel'):
            raise RunCancelled('Admin đã dừng lượt chạy.')
        if control.get('expires_at', 0) < time.time():
            raise RuntimeError('Backend mất kết nối: lease của lượt chạy hết hạn.')

    def reason(self):
        return readiness_reason(self.localization, self.loc_at, self.health, self.health_at,
                                self.plan['map_id'], time.monotonic())

    def spin_checked(self):
        rclpy.spin_once(self, timeout_sec=0.1)
        self.check_control()
        reason = self.reason()
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
        self.on_status(type('Statuses', (), {'status_list': self.statuses})())
        self.goal = self.goal_future = None
        # Drain the action status update before the next step's busy check.
        for _ in range(5):
            self.spin_checked()

    def stop_owned_goal(self):
        if self.goal is not None or self.goal_future is not None:
            # Brake immediately; do not wait on an unresponsive action server.
            self.stop_pub.publish(Empty())
        # A cancel can arrive while the action server is accepting our goal.
        # Wait briefly for its handle, then cancel that exact goal UUID.
        if self.goal is None and self.goal_future is not None:
            until = time.monotonic() + 3
            while not self.goal_future.done() and time.monotonic() < until:
                rclpy.spin_once(self, timeout_sec=0.1)
            if self.goal_future.done():
                self.goal = self.goal_future.result()
        if self.goal is not None and self.goal.accepted:
            future = self.goal.cancel_goal_async()
            self.stop_pub.publish(Empty())
            until = time.monotonic() + 3
            while not future.done() and time.monotonic() < until:
                rclpy.spin_once(self, timeout_sec=0.1)

    def execute(self):
        # Collect real readiness data before sending any action.
        until = time.monotonic() + 8
        while time.monotonic() < until:
            rclpy.spin_once(self, timeout_sec=0.1)
            self.check_control()
            if not self.reason() and self.client.server_is_ready() and self.costmap is not None:
                break
        if self.reason():
            raise RuntimeError(self.reason())
        if not self.client.server_is_ready():
            raise RuntimeError('Nav2 action server chưa sẵn sàng.')
        config, steps = self.plan['config'], self.plan['steps']
        ids = {step['step_id']: i for i, step in enumerate(steps)}
        self.emit('STARTED')
        while config['repeat_mode'] == 'CONTINUOUS' or self.round < config['repeat_count']:
            self.index = 0
            visits = 0
            while self.index < len(steps):
                self.spin_checked()
                visits += 1
                if visits > 10000:
                    raise RuntimeError('Vượt 10000 lần chuyển bước trong một vòng; kiểm tra nhánh lặp.')
                step = steps[self.index]
                self.emit('STEP_STARTED', step.get('title'))
                if step['type'] == 'MOVE':
                    self.move(step['params'])
                elif step['type'] == 'WAIT':
                    self.wait(step['params'].get('duration_sec', 5))
                else:
                    raise RuntimeError(f"Loại bước chưa được hỗ trợ: {step['type']}")
                self.emit('STEP_COMPLETED')
                next_id = step.get('params', {}).get('next_step_id')
                self.index = len(steps) if next_id == 'END' else ids[next_id] if next_id else self.index + 1
            self.round += 1
            self.emit('ROUND_COMPLETED')
            if config['repeat_mode'] == 'CONTINUOUS' or self.round < config['repeat_count']:
                self.wait(config['interval_seconds'])
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
