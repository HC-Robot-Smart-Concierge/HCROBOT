"""Đổi lệnh vận tốc Twist (Nav2 /cmd_vel) sang % PWM có dấu cho hai bên bánh.

Động học vi sai: v_trái = vx - wz*track/2, v_phải = vx + wz*track/2.
PWM tỉ lệ tuyến tính với tốc độ bánh (mps_per_pct), có sàn PWM để motor
thắng ma sát tĩnh (xoay tại chỗ cần sàn cao hơn vì lốp skid-steer trượt ngang),
và trần PWM; vượt trần thì co cả hai bên cùng tỉ lệ để giữ nguyên độ cong.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Tuple


@dataclass(frozen=True)
class DiffDriveConfig:
    track_m: float = 0.297          # track hiệu dụng (HCROBOT_EFFECTIVE_TRACK)
    mps_per_pct: float = 0.0048     # 1% PWM ~ 0.0048 m/s (100% ~ 0.48 m/s)
    min_pwm: int = 22               # sàn khi hai bên cùng chiều / một bên đứng
    spin_min_pwm: int = 38          # sàn khi hai bên ngược chiều (xoay tại chỗ)
    max_pwm: int = 50               # trần an toàn
    deadband_mps: float = 0.02      # tốc độ bánh nhỏ hơn => bên đó dừng


def twist_to_wheel_pwm(vx: float, wz: float, cfg: DiffDriveConfig) -> Tuple[int, int]:
    """Trả về (trái %, phải %) có dấu; (0, 0) nghĩa là dừng."""
    half = cfg.track_m / 2.0
    v_left = vx - wz * half
    v_right = vx + wz * half

    left = v_left / cfg.mps_per_pct
    right = v_right / cfg.mps_per_pct

    # Vượt trần: co hai bên cùng tỉ lệ để giữ hướng cong Nav2 yêu cầu.
    peak = max(abs(left), abs(right))
    if peak > cfg.max_pwm:
        scale = cfg.max_pwm / peak
        left *= scale
        right *= scale
        v_left *= scale
        v_right *= scale

    spinning = (v_left > cfg.deadband_mps and v_right < -cfg.deadband_mps) or (
        v_left < -cfg.deadband_mps and v_right > cfg.deadband_mps
    )
    floor = cfg.spin_min_pwm if spinning else cfg.min_pwm

    def _side(pct: float, v: float) -> int:
        if abs(v) < cfg.deadband_mps:
            return 0
        mag = min(cfg.max_pwm, max(floor, abs(pct)))
        return int(round(mag)) if pct > 0 else -int(round(mag))

    return _side(left, v_left), _side(right, v_right)
