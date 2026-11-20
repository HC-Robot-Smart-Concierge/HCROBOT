"""Thoát kẹt khi một sonar trên Pi trả null (vd vật cản nằm chéo, sóng dội đi hướng khác).

Null = "không biết", không phải "trống": KHÔNG nới an toàn của Pi. Chỉ chọn chuyển động mà
Pi vẫn kiểm tra được bằng sonar còn đo được (obstacle_safety.classify_wheel_motion):
- hai bánh cùng tiến (thẳng hoặc lượn) = "forward": Pi chỉ xét sonar TRƯỚC;
- hai bánh cùng lùi = "backward": Pi chỉ xét sonar SAU;
- quay tại chỗ cần đủ 4 sonar => không bao giờ dùng khi có sonar null.
Lượn thì Pi không xét hông, nên ở đây tự kiểm tra hông bằng LiDAR (đuôi/đầu xe quét ra
hai bên khi lượn). Mọi lệnh vẫn đi qua khóa an toàn của Pi như bình thường.
"""
from dataclasses import dataclass
from typing import Dict, List, Optional

SENSORS = ("front", "rear", "left", "right")
SONAR_FRESH_SEC = 3.0


@dataclass(frozen=True)
class EscapeMove:
    vx: float
    wz: float
    label: str
    travel: str  # "front" | "rear": phía xe đi tới


def pi_sonar_snapshot(pi_status: Optional[dict], age_sec: Optional[float],
                      max_age: float = SONAR_FRESH_SEC) -> Optional[dict]:
    """Số đo sonar + ngưỡng từ gói pi_status còn mới (None nếu cũ/thiếu)."""
    if not isinstance(pi_status, dict) or age_sec is None or not 0 <= age_sec <= max_age:
        return None
    sonar, thresholds = pi_status.get("sonar"), pi_status.get("thresholds")
    if not isinstance(sonar, dict) or not isinstance(thresholds, dict):
        return None
    return {"sonar": sonar, "thresholds": thresholds}


def null_sonars(sonar: Dict[str, Optional[float]]) -> tuple:
    return tuple(s for s in SENSORS if s in sonar and sonar[s] is None)


def _sonar_clear(sonar, thresholds, sensor, key, margin_cm):
    value, need = sonar.get(sensor), thresholds.get(key)
    return value is not None and need is not None and value > float(need) + margin_cm


def _gap_ok(lidar_cm, side, need_cm):
    value = lidar_cm.get(side)
    return value is not None and value >= need_cm


def plan_sonar_escape(sonar: Dict[str, Optional[float]], thresholds: Dict[str, float],
                      lidar_cm: Dict[str, Optional[float]], *, speed: float = 0.12,
                      arc_wz: float = 0.3, margin_cm: float = 3.0, front_gap_cm: float = 28.0,
                      rear_gap_cm: float = 23.0, swing_margin_cm: float = 8.0) -> List[EscapeMove]:
    """Các chuyển động thoát kẹt khả thi, theo thứ tự ưu tiên. [] = không có (hoặc không có sonar null).

    wz > 0 khi tiến = lượn trái; khi lùi, wz < 0 làm xe dạt sang trái (rời xa vật bên phải).
    """
    nulls = null_sonars(sonar)
    if not nulls:
        return []
    side_nulls = [s for s in ("left", "right") if s in nulls]
    forward = [EscapeMove(speed, 0.0, "tiến thẳng", "front")]
    backward = [EscapeMove(-speed, 0.0, "lùi thẳng", "rear")]
    if len(side_nulls) == 1:
        away = 1.0 if side_nulls[0] == "right" else -1.0  # +1: dạt sang trái
        to = "trái" if away > 0 else "phải"
        forward.insert(0, EscapeMove(speed, away * arc_wz, f"lượn tiến sang {to}", "front"))
        backward.insert(0, EscapeMove(-speed, -away * arc_wz, f"lượn lùi dạt sang {to}", "rear"))
    elif not side_nulls:
        # Sonar trước/sau null: lượn về phía hông LiDAR thấy rộng hơn, rồi thẳng, rồi phía kia.
        left, right = lidar_cm.get("left") or 0.0, lidar_cm.get("right") or 0.0
        open_sign = 1.0 if left >= right else -1.0

        def arcs(sign):
            to = "trái" if sign > 0 else "phải"
            return (EscapeMove(speed, sign * arc_wz, f"lượn tiến sang {to}", "front"),
                    EscapeMove(-speed, -sign * arc_wz, f"lượn lùi dạt sang {to}", "rear"))

        (f_open, b_open), (f_other, b_other) = arcs(open_sign), arcs(-open_sign)
        forward = [f_open, forward[0], f_other]
        backward = [b_open, backward[0], b_other]
    candidates = (forward + backward) if "front" not in nulls else (backward + forward)

    side_need = max(float(thresholds.get("left", 16)), float(thresholds.get("right", 16))) + swing_margin_cm
    moves = []
    for move in candidates:
        if move.travel == "front":
            ok = (_sonar_clear(sonar, thresholds, "front", "forward", margin_cm)
                  and _gap_ok(lidar_cm, "front", front_gap_cm))
        else:
            ok = (_sonar_clear(sonar, thresholds, "rear", "backward", margin_cm)
                  and _gap_ok(lidar_cm, "rear", rear_gap_cm))
        if ok and move.wz != 0.0:
            # Lượn: một đầu xe quét sang mỗi bên hông -> cả hai hông phải đủ rộng theo LiDAR.
            ok = _gap_ok(lidar_cm, "left", side_need) and _gap_ok(lidar_cm, "right", side_need)
        if ok:
            moves.append(move)
    return moves
