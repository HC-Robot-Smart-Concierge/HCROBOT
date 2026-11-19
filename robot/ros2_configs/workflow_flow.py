"""Per-step error policies and the low-battery branch for the workflow executor.

The host (Executor) provides move, follow_route, wait, emit, spin_checked,
stop_owned_goal, _monotonic, index, goal, goal_future and finished_goal_ids.
"""
from workflow_navigation_logic import route_segment_end, step_error_policy

LOW_BATTERY_DONE = 'Dừng tuyến do pin yếu ({percent}%) — đã về trạm sạc.'


class SafetyStop(RuntimeError):
    """Never retried: cancel, lost backend control, unsafe hardware or a foreign Nav2 goal."""


class NavigationError(RuntimeError):
    """Transient navigation failure; the step's on_error policy decides what happens."""


class GuestHold(Exception):
    """The kiosk is talking to a guest: stop, wait for the conversation, resume the same step."""


class LowBattery(Exception):
    def __init__(self, percent):
        super().__init__(f'Pin {round(percent)}%')
        self.percent = percent


class FlowPolicyMixin:
    def _run_flow(self, steps, ids):
        """Run from self.index until END or the end of the list, applying each step's on_error."""
        visits = 0
        while self.index < len(steps):
            visits += 1
            if visits > 10000:
                raise RuntimeError('Vượt 10000 lần chuyển bước trong một vòng; kiểm tra nhánh lặp.')
            self.emit('STEP_STARTED', steps[self.index].get('title'))
            self.index = self._run_step_with_policy(steps, ids)

    @staticmethod
    def _follow_link(step, steps, ids, index):
        next_id = (step.get('params') or {}).get('next_step_id')
        return len(steps) if next_id == 'END' else ids[next_id] if next_id else index + 1

    def _run_once(self, steps, end):
        step = steps[self.index]
        if step['type'] == 'MOVE':
            if end > self.index:
                self.follow_route(steps[self.index:end])
                self.index = end - 1
            else:
                self.move(step['params'])
        elif step['type'] == 'WAIT':
            self.wait(step['params'].get('duration_sec', 5))
        else:
            raise RuntimeError(f"Loại bước chưa được hỗ trợ: {step['type']}")

    def _run_step_with_policy(self, steps, ids):
        """Run steps[self.index] (a whole route segment for MOVE) and return the next index."""
        start = self.index
        policy = step_error_policy(steps[start].get('params'))
        end = route_segment_end(steps, start)
        attempt = 0
        while True:
            try:
                try:
                    # Readiness gates every attempt: a lost localization is a failed attempt
                    # under the step's policy and no goal is sent while it lasts.
                    self.spin_checked()
                    self._run_once(steps, end)
                    self.emit('STEP_COMPLETED')
                    return self._follow_link(steps[self.index], steps, ids, self.index)
                except NavigationError as exc:
                    self._abandon_goal()
                    if attempt < policy['retry_count']:
                        attempt += 1
                        self.emit('STEP_RETRY', f"Thử lại {attempt}/{policy['retry_count']}: {exc}")
                        self._retry_wait(policy['retry_wait_sec'])
                        continue
                    if policy['action'] == 'CONTINUE':
                        self.emit('STEP_FAILED_HANDLED', f'Bỏ qua: {exc}')
                        if self.index + 1 < end:
                            # Skip only the failed route point; the rest of the route continues.
                            self.index += 1
                            attempt = 0
                            continue
                        return self._follow_link(steps[self.index], steps, ids, self.index)
                    if policy['action'] == 'ERROR_BRANCH':
                        self.emit('STEP_FAILED_HANDLED', f'Đi nhánh lỗi: {exc}')
                        target = policy['next_step_id']
                        return len(steps) if target == 'END' else ids[target]
                    raise
            except GuestHold:
                # Not a failed attempt: hold, then run the same step again from self.index
                # (for a route: the first point not yet passed).
                self._abandon_goal()
                self._hold_for_guest()

    def _abandon_goal(self):
        """Stop the failed goal and forget it, so the next attempt is not blocked as busy."""
        had_goal = self.goal is not None or self.goal_future is not None
        self.stop_owned_goal()
        if self.goal is not None:
            self.finished_goal_ids.add(bytes(self.goal.goal_id.uuid))
        self.goal = self.goal_future = None
        self._refresh_active_goals()
        if had_goal:
            # stop_owned_goal also broadcasts a cancel-all; let it reach Nav2 before
            # the next goal (retry, error branch or charger) is sent.
            self._settle_after_cancel()

    def _retry_wait(self, seconds):
        """Wait between attempts; lost localization may recover, safety and battery still stop."""
        until = self._monotonic() + seconds
        while self._monotonic() < until:
            try:
                self.spin_checked()
            except NavigationError:
                pass

    def _hold_for_guest(self):
        """Wait while the kiosk keeps renewing guest_hold_until, at most max_duration_sec."""
        branch = self.guest_branch or {}
        limit = branch.get('max_duration_sec', 180)
        self.emit('GUEST_HOLD', 'Dừng chờ khách')
        started = self._monotonic()
        try:
            while True:
                try:
                    self.spin_checked()
                except NavigationError:
                    pass  # standing still; localization may recover before the robot moves again
                until = self.last_control.get('guest_hold_until')
                if isinstance(until, bool) or not isinstance(until, (int, float)):
                    reason = 'Khách đã đi'
                    break
                if self._wall() >= until:
                    reason = f"Hết {branch.get('idle_timeout_sec', 20)} s không tương tác"
                    break
                if self._monotonic() - started >= limit:
                    reason = f'Hết thời gian tối đa {limit} s'
                    break
        finally:
            self.guest_holding = False
            self.guest_cooldown_until = self._wall() + branch.get('cooldown_sec', 60)
        self.emit('GUEST_RESUME', reason)

    def _wait_between_rounds(self, seconds):
        try:
            self.wait(seconds)
        except GuestHold:
            self._abandon_goal()
            self._hold_for_guest()

    def _run_battery_branch(self, steps, ids, percent):
        """Low battery wins over the current step: cancel it, run the branch, end the run."""
        self.in_battery_branch = True  # no guest holds on the way to the charger
        self._abandon_goal()
        branch = self.battery_branch
        self.emit('EVENT_TRIGGERED', f"Pin {round(percent)}% < {branch.get('threshold_percent', 20)}%")
        target = branch.get('next_step_id')
        self.index = len(steps) if target == 'END' else ids[target]
        self._run_flow(steps, ids)
        self.emit('COMPLETED', LOW_BATTERY_DONE.format(percent=round(percent)))
