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


def readiness_reason(localization, loc_at, health, health_at, map_id, now):
    if not loc_at or now - loc_at > 3:
        return 'Không có trạng thái định vị mới.'
    if localization.get('map') != map_id:
        return 'Map đang định vị không khớp map của workflow.'
    if localization.get('state') != 'LOCALIZED':
        return localization.get('reason') or 'Robot chưa định vị hoặc đã mất định vị.'
    if not health_at or now - health_at > 3:
        return 'Mất dữ liệu sức khỏe robot.'
    if not health.get('pi_ws_connected') or not health.get('lidar_live'):
        return 'Pi hoặc LiDAR không sẵn sàng.'
    if health.get('encoder_valid') is not True:
        return health.get('encoder_fault') or 'Encoder chưa được xác nhận hợp lệ.'
    age = health.get('last_encoder_age_sec')
    if not isinstance(age, (int, float)) or not math.isfinite(age) or not 0 <= age <= 0.5:
        return 'Dữ liệu encoder đã cũ.'
    return None


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
