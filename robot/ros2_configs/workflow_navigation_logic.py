"""Pure readiness checks shared by the physical workflow worker and its tests."""
import math


def route_segment_end(steps, start):
    """Group only MOVE points from the same FOLLOW_ROUTE occurrence, never plain MOVE/WAIT."""
    params = steps[start].get('params') or {}
    source = params.get('source_route_step_id') or params.get('source_route_id')
    if steps[start]['type'] != 'MOVE' or not source:
        return start
    end = start
    while end < len(steps):
        step, p = steps[end], steps[end].get('params') or {}
        if step['type'] != 'MOVE' or (p.get('source_route_step_id') or p.get('source_route_id')) != source:
            break
        end += 1
        if p.get('next_step_id'):
            break
    return end


def route_pose_targets(steps):
    """Intermediate poses point along the route; only its final pose keeps endpoint yaw."""
    targets = [dict(step['params']) for step in steps]
    for index, target in enumerate(targets[:-1]):
        for following in targets[index + 1:]:
            dx = following['target_x'] - target['target_x']
            dy = following['target_y'] - target['target_y']
            if math.hypot(dx, dy) > 1e-6:
                target['target_yaw'] = math.atan2(dy, dx)
                break
    return targets


def route_window_end(targets, start, robot, clearance=0.35):
    """Avoid a final pose already encountered earlier in a closed/repeated route.

    Nav2's Jazzy goal checker only knows the final XY/yaw, not route progress.
    Extend this window before its end is reached, using action preemption.
    """
    for end in range(len(targets), start, -1):
        last = targets[end - 1]
        x, y = last['target_x'], last['target_y']
        if math.hypot(x - robot[0], y - robot[1]) <= clearance:
            continue
        if all(math.hypot(x - p['target_x'], y - p['target_y']) > clearance
               for p in targets[start:end - 1]):
            return end
    return start


def readiness_issue(localization, loc_at, health, health_at, map_id, now):
    """('NAVIGATION'|'SAFETY', message) or None. Only localization may be retried."""
    if not loc_at or now - loc_at > 3:
        return 'NAVIGATION', 'Không có trạng thái định vị mới.'
    if localization.get('map') != map_id:
        return 'SAFETY', 'Map đang định vị không khớp map của workflow.'
    if localization.get('state') != 'LOCALIZED':
        return 'NAVIGATION', localization.get('reason') or 'Robot chưa định vị hoặc đã mất định vị.'
    if not health_at or now - health_at > 3:
        return 'SAFETY', 'Mất dữ liệu sức khỏe robot.'
    if not health.get('pi_ws_connected') or not health.get('lidar_live'):
        return 'SAFETY', 'Pi hoặc LiDAR không sẵn sàng.'
    if health.get('encoder_valid') is not True:
        return 'SAFETY', health.get('encoder_fault') or 'Encoder chưa được xác nhận hợp lệ.'
    age = health.get('last_encoder_age_sec')
    # 1.0 s: ride out a short ESP32 -> Pi -> WebSocket hiccup; the Pi itself already stops
    # the motors when ESP32 data is older than 0.8 s.
    if not isinstance(age, (int, float)) or not math.isfinite(age) or not 0 <= age <= 1.0:
        return 'SAFETY', 'Dữ liệu encoder đã cũ.'
    return None


def readiness_reason(localization, loc_at, health, health_at, map_id, now):
    issue = readiness_issue(localization, loc_at, health, health_at, map_id, now)
    return issue[1] if issue else None


def step_error_policy(params):
    """A step's on_error with defaults; no on_error keeps the old stop-on-first-error behavior."""
    raw = (params or {}).get('on_error') or {}
    return {
        'retry_count': int(raw.get('retry_count', 0) or 0),
        'retry_wait_sec': int(raw.get('retry_wait_sec', 5) or 5),
        'action': raw.get('action') or 'STOP',
        'next_step_id': raw.get('next_step_id') or None,
    }


def low_battery_branch(config):
    return next((b for b in (config or {}).get('event_branches') or [] if b.get('event') == 'LOW_BATTERY'), None)


def low_battery_percent(control, branch, now, max_age_sec=10.0):
    """Percent that must trigger the branch, or None for no branch, unknown or stale readings."""
    if not branch:
        return None
    percent, at = control.get('battery_percent'), control.get('battery_at')
    if isinstance(percent, bool) or not isinstance(percent, (int, float)) or not math.isfinite(percent):
        return None
    if not isinstance(at, (int, float)) or now - at > max_age_sec:
        return None
    return percent if percent < branch.get('threshold_percent', 20) else None


def goal_cell_allowed(grid, x, y):
    info = grid.info
    q = info.origin.orientation
    yaw = math.atan2(2 * (q.w * q.z + q.x * q.y), 1 - 2 * (q.y*q.y + q.z*q.z))
    dx, dy = x - info.origin.position.x, y - info.origin.position.y
    gx = math.floor((math.cos(yaw)*dx + math.sin(yaw)*dy) / info.resolution)
    gy = math.floor((-math.sin(yaw)*dx + math.cos(yaw)*dy) / info.resolution)
    if not 0 <= gx < info.width or not 0 <= gy < info.height:
        return False
    return 0 <= grid.data[gy * info.width + gx] < 100


def guest_branch(config):
    return next((b for b in (config or {}).get('event_branches') or [] if b.get('event') == 'GUEST_DETECTED'), None)


def guest_hold_active(control, branch, now, cooldown_until):
    """The kiosk asked to hold (renewed hold time still in the future) outside the cooldown."""
    if not branch or now < cooldown_until:
        return False
    until = control.get('guest_hold_until')
    return isinstance(until, (int, float)) and not isinstance(until, bool) and now < until
