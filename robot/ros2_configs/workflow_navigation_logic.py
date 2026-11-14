"""Pure readiness checks shared by the physical workflow worker and its tests."""
import math


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
