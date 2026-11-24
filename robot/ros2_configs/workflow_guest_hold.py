"""Stop for a guest and resume the same route point. Mixed into the workflow Executor.

The host provides: emit, check_control, last_control, spin_idle, stop_owned_goal, follow_route,
_refresh_active_goals, _route_robot_xy, _wait_navigation_ready, readiness, index, goal,
goal_future and finished_goal_ids. This module imports no ROS package.
"""
import json
import math
import time

from route_block_logic import RouteBlockDetector, StaticMap, blocking_bearings_deg, route_ahead
from route_person_gate import PersonGate
from workflow_navigation_logic import route_pose_targets

REACHED_CLEARANCE_M = 0.35
CANCEL_SETTLE_SEC = 1.0
# A DONE written for the previous hold is cleared by the backend within about a second.
IGNORE_DONE_SEC = 2.0


class GuestHold(Exception):
    """Someone blocks the route or touched the screen: stop, talk, then resume the same step."""


class GuestHoldMixin:
    def setup_guest_hold(self, plan):
        config = (plan.get('config') or {}).get('parallel') or {}
        self.parallel = config if config.get('enabled') else None
        self.guest_holding = self.route_blocked = False
        self.guest_cooldown_until = 0.0
        self.guest_seq_seen = 0
        self.guest_route = None
        self.static_map = None
        self.block_detector = RouteBlockDetector()
        self.person_gate = PersonGate()
        self.vision_live = None
        self.last_control = {}

    def on_person_detections(self, msg):
        try:
            payload = json.loads(msg.data)
        except (TypeError, ValueError):
            payload = None
        self.person_gate.update(payload, time.monotonic())

    def _report_vision(self, now):
        """Write one run-log line whenever the stop decision changes source."""
        live = self.person_gate.available(now)
        if live != self.vision_live:
            self.vision_live = live
            self.emit('VISION_STATUS', 'YOLO đang xác nhận người' if live else 'Không có YOLO: tạm dùng chỉ LiDAR')

    def on_static_map(self, msg):
        info = msg.info
        q = info.origin.orientation
        yaw = math.atan2(2 * (q.w * q.z + q.x * q.y), 1 - 2 * (q.y * q.y + q.z * q.z))
        self.static_map = StaticMap(info.width, info.height, info.resolution,
                                    info.origin.position.x, info.origin.position.y, yaw, msg.data)

    def on_scan(self, msg):
        now = time.monotonic()
        if (self.guest_route is None or self.goal is None or self.guest_holding or self.static_map is None
                or now < self.guest_cooldown_until):
            self.block_detector.reset()
            return
        try:
            laser, base = self._scan_poses()
        except Exception:
            self.block_detector.reset()  # no pose: never decide from a stale position
            return
        self._report_vision(now)
        first, targets = self.guest_route
        route = route_ahead(targets, self.index - first, base[:2])
        bearings = blocking_bearings_deg(msg, laser, base[2], route, self.static_map) if route else []
        blocked = bool(bearings) and self.person_gate.confirms(bearings, now)
        if self.block_detector.update(blocked, now):
            self.route_blocked = True

    def check_guest_interrupt(self):
        if not self.parallel or self.guest_holding:
            return
        sequence = self.last_control.get('guest_request_seq') or 0
        if sequence > self.guest_seq_seen:
            self.guest_seq_seen = sequence
            raise GuestHold('Khách chạm màn hình')
        if self.route_blocked:
            self.route_blocked = False
            if time.monotonic() >= self.guest_cooldown_until:
                raise GuestHold('Có người chắn đường')

    def run_guarded(self, action):
        """Run a step action; after a guest hold, run it again from the start."""
        while True:
            try:
                return action()
            except GuestHold as hold:
                self._pause_for_guest(str(hold))

    def run_route(self, steps, end):
        """Drive steps[index:end]; a guest hold resumes at the first point not yet passed."""
        first = self.index
        self.guest_route = (first, route_pose_targets(steps[first:end])) if self.parallel else None
        resumed = False
        try:
            while True:
                try:
                    if resumed and self._skip_reached_points(steps, end):
                        return
                    self.follow_route(steps[self.index:end])
                    return
                except GuestHold as hold:
                    self._pause_for_guest(str(hold))
                    resumed = True
        finally:
            # A block confirmed at the very end of the route must not stop the next step.
            self.guest_route = None
            self.route_blocked = False
            self.block_detector.reset()

    def _skip_reached_points(self, steps, end):
        """True when the last point is already within reach, so the route is complete."""
        x, y = self._route_robot_xy()
        while True:
            params = steps[self.index]['params']
            if math.hypot(params['target_x'] - x, params['target_y'] - y) > REACHED_CLEARANCE_M:
                return False
            if self.index == end - 1:
                return True
            self.emit('STEP_COMPLETED')
            self.index += 1
            self.emit('STEP_STARTED', steps[self.index].get('title'))

    def _pause_for_guest(self, cause):
        self.guest_holding = True  # before the goal stops, so a new scan cannot queue another hold
        try:
            self._abandon_goal()
            reason = self._hold_for_guest(cause)
        finally:
            self.guest_holding = self.route_blocked = False
            self.block_detector.reset()
            self.guest_cooldown_until = time.monotonic() + self.parallel.get('cooldown_sec', 30)
        self.guest_seq_seen = max(self.guest_seq_seen, self.last_control.get('guest_request_seq') or 0)
        self.emit('GUEST_RESUME', reason)
        self.readiness.update(None, time.monotonic())
        self._wait_navigation_ready()

    def _abandon_goal(self):
        had_goal = self.goal is not None or self.goal_future is not None
        future = self.goal_future
        self.stop_owned_goal()
        handles = [self.goal]
        if future is not None and future.done():
            try:
                handles.append(future.result())
            except Exception:
                pass
        for handle in handles:
            if handle is not None and getattr(handle, 'accepted', False):
                self.finished_goal_ids.add(bytes(handle.goal_id.uuid))
        self.goal = self.goal_future = None
        self._refresh_active_goals()
        if had_goal:
            # stop_owned_goal also broadcasts a cancel-all; it must land before the next goal.
            until = time.monotonic() + CANCEL_SETTLE_SEC
            while time.monotonic() < until:
                self.spin_idle()
                self.check_control()

    def _hold_for_guest(self, cause):
        """Stand still while the screen renews the hold. Cancel and lease checks still apply."""
        limit = self.parallel.get('max_hold_sec', 600)
        idle = self.parallel.get('no_interaction_sec', 20)
        self.emit('GUEST_HOLD', cause)
        started = time.monotonic()
        first_deadline = time.time() + idle
        while True:
            self.spin_idle()
            self.check_control()
            elapsed = time.monotonic() - started
            if self.last_control.get('guest_done') and elapsed >= IGNORE_DONE_SEC:
                return 'Kết thúc trò chuyện'
            renewed = self.last_control.get('guest_hold_until')
            renewed = renewed if isinstance(renewed, (int, float)) and not isinstance(renewed, bool) else 0
            if time.time() >= max(first_deadline, renewed):
                return f'Hết {idle} giây không tương tác'
            if elapsed >= limit:
                return f'Hết thời gian giữ tối đa {limit} giây'
