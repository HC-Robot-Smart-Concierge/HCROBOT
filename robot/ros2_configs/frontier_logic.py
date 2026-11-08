"""Tìm và chọn frontier trên OccupancyGrid (không phụ thuộc ROS để test được).

Frontier = ô TRỐNG (0) có ít nhất một ô kề 4 hướng CHƯA BIẾT (-1). Các ô frontier
liền nhau (8 hướng) gom thành cụm; cụm quá nhỏ (nhiễu) bị bỏ. Đích của mỗi cụm là
ô frontier gần tâm cụm nhất (luôn là ô trống => Nav2 lập đường tới được).
Cụm quá lớn (vd. tia LiDAR thưa bao quanh xe đứng yên) được chia theo ô vuông
split_tile_m: tâm cụm hình vành khăn nằm ngay tại xe => đích sát xe bị bỏ.
"""

from __future__ import annotations

import math
from collections import deque
from dataclasses import dataclass
from typing import Iterable, List, Optional, Sequence, Tuple

Point = Tuple[float, float]


@dataclass(frozen=True)
class Frontier:
    goal: Point          # điểm đích (m, khung map)
    size: int            # số ô trong cụm
    centroid: Point


def find_frontiers(
    data: Sequence[int],
    width: int,
    height: int,
    resolution: float,
    origin: Point,
    min_cluster_cells: int = 8,
    split_cluster_cells: int = 150,
    split_tile_m: float = 1.0,
) -> List[Frontier]:
    def is_frontier(i: int) -> bool:
        if data[i] != 0:
            return False
        x, y = i % width, i // width
        return (
            (x > 0 and data[i - 1] == -1)
            or (x < width - 1 and data[i + 1] == -1)
            or (y > 0 and data[i - width] == -1)
            or (y < height - 1 and data[i + width] == -1)
        )

    seen = bytearray(width * height)
    frontiers: List[Frontier] = []
    ox, oy = origin
    for start in range(width * height):
        if seen[start] or not is_frontier(start):
            continue
        cluster = []
        queue = deque([start])
        seen[start] = 1
        while queue:
            i = queue.popleft()
            cluster.append(i)
            cx, cy = i % width, i // width
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    nx, ny = cx + dx, cy + dy
                    if (dx or dy) and 0 <= nx < width and 0 <= ny < height:
                        j = ny * width + nx
                        if not seen[j] and is_frontier(j):
                            seen[j] = 1
                            queue.append(j)
        if len(cluster) < min_cluster_cells:
            continue
        if len(cluster) > split_cluster_cells:
            tile = max(1, round(split_tile_m / resolution))
            tiles = {}
            for i in cluster:
                tiles.setdefault(((i % width) // tile, (i // width) // tile), []).append(i)
            parts = [p for p in tiles.values() if len(p) >= min_cluster_cells]
        else:
            parts = [cluster]
        for part in parts:
            mx = sum(i % width for i in part) / len(part)
            my = sum(i // width for i in part) / len(part)
            best = min(part, key=lambda i: (i % width - mx) ** 2 + (i // width - my) ** 2)
            frontiers.append(Frontier(
                goal=(ox + (best % width + 0.5) * resolution, oy + (best // width + 0.5) * resolution),
                size=len(part),
                centroid=(ox + (mx + 0.5) * resolution, oy + (my + 0.5) * resolution),
            ))
    return frontiers


def exploration_result(visited: int, stuck_count: int, frontiers: Sequence[Frontier],
                       stopped: bool = False) -> dict:
    """Ket qua cuoi phien tu quet (phat /explore/status cho Web hien popup luu map).

    DONE: da toi it nhat 1 frontier. FAILED: chua toi duoc frontier nao (Nav2/TF/motor
    loi, map gan nhu chua quet). STOPPED: bi dung giua chung (/robot/nav_cancel).
    """
    left = len(frontiers)
    if stopped:
        state, message = "STOPPED", f"Đã dừng tự quét theo yêu cầu (đã thăm {visited} chỗ)."
    elif visited == 0:
        state = "FAILED"
        message = (f"Robot chưa tới được điểm khám phá nào ({left} cụm còn lại): "
                   "kiểm tra Nav2/motor, map có thể chưa đầy đủ.")
    else:
        state = "DONE"
        message = f"Đã quét xong: thăm {visited} chỗ, thoát kẹt {stuck_count} lần"
        message += f", còn {left} chỗ không tới được." if left else "."
    return {"state": state, "visited": visited, "stuck": stuck_count, "frontiers_left": left, "message": message}


def choose_frontier(
    frontiers: Iterable[Frontier],
    robot: Point,
    blacklist: Iterable[Point] = (),
    blacklist_radius: float = 0.4,
    min_distance: float = 0.3,
    size_weight: float = 0.02,
) -> Optional[Frontier]:
    """Chọn cụm có chi phí nhỏ nhất: khoảng cách - size_weight * số ô.

    Bỏ cụm gần điểm đã thất bại / đã thăm (blacklist) và cụm sát robot
    (tới nơi mà vẫn còn => thường là vùng LiDAR không thấy được, vd. kính).
    """
    blacklist = list(blacklist)
    best = None
    best_cost = math.inf
    for f in frontiers:
        dist = math.hypot(f.goal[0] - robot[0], f.goal[1] - robot[1])
        if dist < min_distance:
            continue
        if any(math.hypot(f.goal[0] - bx, f.goal[1] - by) < blacklist_radius for bx, by in blacklist):
            continue
        cost = dist - size_weight * f.size
        if cost < best_cost:
            best, best_cost = f, cost
    return best


def safe_goal(
    data: Sequence[int],
    width: int,
    height: int,
    resolution: float,
    origin: Point,
    goal: Point,
    robot: Point,
    clearance_m: float = 0.22,
    search_radius_m: float = 1.0,
    occupied_threshold: int = 50,
) -> Optional[Point]:
    """Dời đích frontier tới ô TRỐNG gần nhất cách mọi ô tường > clearance_m.

    Frontier hay nằm sát tường; Nav2 (footprint + padding) coi đó là va chạm, còn Pi
    chặn xoay khi hông < 12 cm => xe đứng chờ recovery. Ô chưa biết không tính là tường.
    Hoà khoảng cách thì ưu tiên ô gần robot. Không có ô nào => None (bỏ frontier).
    """
    ox, oy = origin
    gx = int((goal[0] - ox) / resolution)
    gy = int((goal[1] - oy) / resolution)
    rx = (robot[0] - ox) / resolution
    ry = (robot[1] - oy) / resolution
    search = int(math.ceil(search_radius_m / resolution))
    clear = clearance_m / resolution
    clear_cells = int(math.ceil(clear))

    def is_safe(cx: int, cy: int) -> bool:
        if data[cy * width + cx] != 0:
            return False
        for dy in range(-clear_cells, clear_cells + 1):
            ny = cy + dy
            if not 0 <= ny < height:
                continue
            for dx in range(-clear_cells, clear_cells + 1):
                nx = cx + dx
                if (0 <= nx < width and dx * dx + dy * dy <= clear * clear
                        and data[ny * width + nx] >= occupied_threshold):
                    return False
        return True

    # Xét ứng viên theo thứ tự (gần frontier nhất, rồi gần robot nhất); dừng ở ô an toàn đầu tiên.
    cands = []
    for cy in range(max(0, gy - search), min(height, gy + search + 1)):
        for cx in range(max(0, gx - search), min(width, gx + search + 1)):
            d2 = (cx - gx) ** 2 + (cy - gy) ** 2
            if d2 > search * search or data[cy * width + cx] != 0:
                continue
            cands.append((d2, (cx - rx) ** 2 + (cy - ry) ** 2, cx, cy))
    cands.sort()
    for _d2, _dr, cx, cy in cands:
        if is_safe(cx, cy):
            return (ox + (cx + 0.5) * resolution, oy + (cy + 0.5) * resolution)
    return None


def frontier_still_open(frontiers: Iterable[Frontier], target: Point, radius: float = 0.6) -> bool:
    """Frontier đang nhắm còn tồn tại không (còn cụm nào gần nó)?

    LiDAR quét xa vài mét nên vùng chưa biết thường lộ ra trước khi xe tới nơi;
    lúc đó nên đổi sang frontier khác ngay thay vì chạy nốt tới đích cũ.
    """
    for f in frontiers:
        for px, py in (f.goal, f.centroid):
            if math.hypot(px - target[0], py - target[1]) <= radius:
                return True
    return False


class GoalFailureTracker:
    """Đếm số lần Nav2 thất bại tại mỗi chỗ; chỉ bỏ hẳn chỗ đó sau `max_failures` lần.

    Xe thật hay có lỗi tạm thời (TF trễ, costmap chưa kịp cập nhật) khiến Nav2 huỷ
    đích ngay. Bỏ chỗ đó từ lần đầu thì map mới bắt đầu (1 cụm frontier) sẽ báo
    "khám phá xong" sau vài giây mà xe chưa nhúc nhích.
    """

    def __init__(self, max_failures: int = 3, radius: float = 0.4):
        self.max_failures = max(1, int(max_failures))
        self.radius = float(radius)
        self._spots: List[List] = []  # [[x, y, so_lan], ...]

    def record_failure(self, goal: Point) -> bool:
        """Ghi một lần thất bại; True nếu đã đủ số lần => nên bỏ chỗ này."""
        for spot in self._spots:
            if math.hypot(goal[0] - spot[0], goal[1] - spot[1]) <= self.radius:
                spot[2] += 1
                return spot[2] >= self.max_failures
        self._spots.append([goal[0], goal[1], 1])
        return self.max_failures <= 1


class FrontierMemory:
    """Nhớ các chỗ frontier đã nhắm.

    - done: frontier đã biến mất (quét xong) => không nhắm lại (retry_round mở lại, phòng
      SLAM cập nhật làm nó hiện lại).
    - blind: đã ĐỨNG Ở CHỖ NHÌN TỐT NHẤT (đích an toàn) mà frontier vẫn còn => điểm mù
      LiDAR (kính, đồ màu đen, gầm tủ) hoặc khe xe không vào được => bỏ hẳn. Không lao
      thẳng vào ô frontier nữa: ô đó thường sát vật cản, Pi chặn và xe kẹt ở đó.
    - given_up: thất bại đủ max_attempts lần (Nav2 không tới được / xe kẹt).
    """

    def __init__(self, max_attempts: int = 2, radius: float = 0.4):
        self.max_attempts = max(1, int(max_attempts))
        self.radius = float(radius)
        self.done: List[Point] = []
        self.blind: List[Point] = []
        self.given_up: List[Point] = []
        self._attempts = GoalFailureTracker(self.max_attempts, self.radius)

    def blacklist(self) -> List[Point]:
        return self.done + self.blind + self.given_up

    def mark_done(self, spot: Point) -> None:
        self.done.append(spot)

    def mark_blind(self, spot: Point) -> None:
        self.blind.append(spot)

    def give_up(self, spot: Point) -> None:
        self.given_up.append(spot)

    def record_failure(self, spot: Point) -> bool:
        """Ghi một lần thất bại. True nếu vừa bỏ chỗ này (đủ max_attempts)."""
        if self._attempts.record_failure(spot):
            self.given_up.append(spot)
            return True
        return False

    def retry_round(self) -> int:
        """Hết chỗ để đi mà vẫn còn frontier: mở lại done + given_up (xe đã đổi vị trí,
        map đã thêm chi tiết). Giữ blind. Trả về số chỗ được mở lại."""
        n = len(self.done) + len(self.given_up)
        self.done = []
        self.given_up = []
        self._attempts = GoalFailureTracker(self.max_attempts, self.radius)
        return n


def _yaw_diff(a: float, b: float) -> float:
    return abs((a - b + math.pi) % (2.0 * math.pi) - math.pi)


class MotionWatchdog:
    """Phát hiện xe đứng yên khi đang có đích (Pi chặn lệnh, kẹt bánh...).

    Tính cả XOAY là có tiến triển (khác progress checker của Nav2 chỉ tính quãng
    đường) để không báo kẹt oan lúc RotationShim đang xoay chậm theo xung.
    Dùng pose odom (encoder/IMU), không dùng map: SLAM chỉnh map->odom làm pose map
    nhảy dù xe đứng yên.
    """

    def __init__(self, timeout_sec: float = 8.0, min_move_m: float = 0.05, min_turn_rad: float = 0.15):
        self.timeout_sec = float(timeout_sec)
        self.min_move_m = float(min_move_m)
        self.min_turn_rad = float(min_turn_rad)
        self._mark = None  # (t, x, y, yaw)

    def reset(self, now: float, pose: Optional[Tuple[float, float, float]]) -> None:
        self._mark = None if pose is None else (now, pose[0], pose[1], pose[2])

    def stuck_for(self, now: float, pose: Optional[Tuple[float, float, float]]) -> float:
        """Số giây đã đứng yên (0 nếu vừa có tiến triển). Cập nhật mốc khi xe nhúc nhích."""
        if pose is None:
            return 0.0
        if self._mark is None:
            self.reset(now, pose)
            return 0.0
        t0, x0, y0, yaw0 = self._mark
        if (math.hypot(pose[0] - x0, pose[1] - y0) >= self.min_move_m
                or _yaw_diff(pose[2], yaw0) >= self.min_turn_rad):
            self.reset(now, pose)
            return 0.0
        return now - t0

    def is_stuck(self, now: float, pose: Optional[Tuple[float, float, float]]) -> bool:
        return self.stuck_for(now, pose) >= self.timeout_sec


def choose_unstick_direction(
    front_cm: Optional[float],
    rear_cm: Optional[float],
    min_front_cm: float = 35.0,
    min_rear_cm: float = 30.0,
) -> Optional[str]:
    """Thoát kẹt: chạy THẲNG ra phía thoáng hơn (tiến/lùi không cần hông trống như xoay).

    Khoảng hở tính từ mép xe (None = LiDAR không thấy gì phía đó => coi là rất thoáng).
    Trả về "forward" / "backward" / None (kẹt cả hai đầu: để Nav2/người xử lý).
    """
    front = 999.0 if front_cm is None else front_cm
    rear = 999.0 if rear_cm is None else rear_cm
    if front >= min_front_cm and front >= rear:
        return "forward"
    if rear >= min_rear_cm:
        return "backward"
    if front >= min_front_cm:
        return "forward"
    return None


def scan_to_points(angle_min: float, angle_increment: float, ranges: Sequence[float],
                   range_min: float = 0.05, range_max: float = 12.0) -> List[dict]:
    """LaserScan -> [{'angle': độ CCW (0 = trước), 'distance': m}] (bỏ inf/NaN/ngoài tầm)."""
    pts = []
    for i, r in enumerate(ranges):
        if r is None or not math.isfinite(r) or r < range_min or r > range_max:
            continue
        pts.append({"angle": math.degrees(angle_min + i * angle_increment) % 360.0, "distance": float(r)})
    return pts
