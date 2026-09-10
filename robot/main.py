"""Điều khiển WASD tích hợp ESP32 ultrasonic fail-safe cho HCROBOT."""

import argparse
import logging
import time

from motor_controller import MotorController, get_char, load_config, run_wasd_controller
from obstacle_safety import ObstacleSafetyController
from ultrasonic_serial import UltrasonicSerialReader


logger = logging.getLogger("RobotMain")


def _value(cli_value, config, key, default):
    return cli_value if cli_value is not None else config.get(key, default)


def _print_controls(port, thresholds, stale_timeout, turn_clearance):
    print("\n" + "=" * 68)
    print(" HCROBOT: MOTOR + 4 HC-SR04 QUA ESP32 USB SERIAL")
    print("=" * 68)
    print(" [W/↑] tiến   [S/↓] lùi   [A/←] trái   [D/→] phải")
    print(" [X/Space] dừng            [Q] thoát")
    print(f" Serial: {port} | stale timeout: {stale_timeout:.2f}s")
    print(
        " Ngưỡng: front={forward:.1f} rear={backward:.1f} "
        "left={left:.1f} right={right:.1f} cm".format(**thresholds)
    )
    print(f" Khi quay: kiểm tra bên quay + front/rear > {turn_clearance:.1f}cm")
    print(" Mất Serial hoặc sensor lỗi liên tiếp => STOP; hết vật cản phải bấm lệnh lại")
    print("=" * 68 + "\n")


def build_argument_parser():
    parser = argparse.ArgumentParser(
        description="Điều khiển motor L298N với ultrasonic fail-safe từ ESP32"
    )
    parser.add_argument("--port", help="Cổng ESP32, ví dụ /dev/ttyUSB0; mặc định auto")
    parser.add_argument("--baud", type=int, help="Baud rate ESP32")
    parser.add_argument("--front-stop", type=float, help="Ngưỡng dừng phía trước (cm)")
    parser.add_argument("--rear-stop", type=float, help="Ngưỡng dừng phía sau (cm)")
    parser.add_argument("--left-stop", type=float, help="Ngưỡng chặn xoay trái (cm)")
    parser.add_argument("--right-stop", type=float, help="Ngưỡng chặn xoay phải (cm)")
    parser.add_argument("--sensor-timeout", type=float, help="Tuổi packet tối đa (giây)")
    parser.add_argument(
        "--null-grace",
        type=float,
        help="Thời gian giữ 1 số đo trước khi null (giây)",
    )
    parser.add_argument(
        "--turn-clearance",
        type=float,
        help="Khoảng trống front/rear khi quay (cm)",
    )
    parser.add_argument(
        "--resume-margin",
        type=float,
        help="Biên mở khóa cao hơn ngưỡng dừng (cm)",
    )
    parser.add_argument(
        "--resume-packets",
        type=int,
        help="Số packet sạch liên tiếp để mở khóa",
    )
    parser.add_argument("--gpio-chip", type=int, help="Ép gpiochip; thường tự phát hiện")
    parser.add_argument("--mock", action="store_true", help="Giả lập motor nhưng vẫn đọc sensor")
    parser.add_argument(
        "--motor-only",
        action="store_true",
        help="Test motor không dùng sensor (không có obstacle fail-safe)",
    )
    parser.add_argument("--debug", action="store_true", help="Bật log từng packet")
    return parser


def main(argv=None):
    args = build_argument_parser().parse_args(argv)
    logging.getLogger().setLevel(logging.DEBUG if args.debug else logging.INFO)

    config = load_config()
    robot_cfg = config.get("robot", {})
    gpio_cfg = robot_cfg.get("gpio", {})
    serial_cfg = robot_cfg.get("ultrasonic_serial", {})
    safety_cfg = robot_cfg.get("safety", {})

    motor = MotorController(
        left_forward_pin=gpio_cfg.get("left_forward", 17),
        left_backward_pin=gpio_cfg.get("left_backward", 27),
        right_forward_pin=gpio_cfg.get("right_forward", 22),
        right_backward_pin=gpio_cfg.get("right_backward", 23),
        force_mock=args.mock,
        gpio_chip=_value(args.gpio_chip, gpio_cfg, "chip", None),
    )

    if motor.is_mock and not args.mock:
        logger.error(
            "Không có GPIO thật; hủy chạy motor. Dùng --mock chỉ khi muốn giả lập."
        )
        motor.cleanup()
        return 2

    if args.motor_only:
        logger.warning(
            "MOTOR-ONLY: ultrasonic fail-safe đã bị tắt. Hãy kê bánh khỏi mặt đất khi test."
        )
        run_wasd_controller(motor)
        return 0

    port = _value(args.port, serial_cfg, "port", "auto")
    baudrate = int(_value(args.baud, serial_cfg, "baudrate", 115200))
    stale_timeout = float(
        _value(args.sensor_timeout, safety_cfg, "stale_timeout_seconds", 0.4)
    )
    thresholds = {
        "forward": float(_value(args.front_stop, safety_cfg, "front_stop_cm", 35.0)),
        "backward": float(_value(args.rear_stop, safety_cfg, "rear_stop_cm", 30.0)),
        "left": float(_value(args.left_stop, safety_cfg, "left_stop_cm", 25.0)),
        "right": float(_value(args.right_stop, safety_cfg, "right_stop_cm", 25.0)),
    }
    invalid_grace = float(
        _value(args.null_grace, safety_cfg, "invalid_grace_seconds", 0.2)
    )
    allowed_null_packets = int(safety_cfg.get("allowed_null_packets", 1))
    resume_margin = float(
        _value(args.resume_margin, safety_cfg, "resume_margin_cm", 10.0)
    )
    resume_packets = int(
        _value(args.resume_packets, safety_cfg, "resume_valid_packets", 3)
    )
    turn_clearance = float(
        _value(args.turn_clearance, safety_cfg, "turn_clearance_cm", 25.0)
    )

    reader = UltrasonicSerialReader(port=port, baudrate=baudrate)
    safety = ObstacleSafetyController(
        motor=motor,
        sensor_reader=reader,
        thresholds_cm=thresholds,
        stale_timeout=stale_timeout,
        invalid_grace=invalid_grace,
        allowed_null_packets=allowed_null_packets,
        resume_margin_cm=resume_margin,
        resume_valid_packets=resume_packets,
        turn_clearance_cm=turn_clearance,
    )

    try:
        reader.start()
    except RuntimeError as exc:
        logger.error("Không khởi động được Serial reader: %s", exc)
        motor.cleanup()
        return 3

    if reader.wait_for_packet(timeout=3.0):
        logger.info("Đã nhận packet ultrasonic đầu tiên; khóa fail-safe sẵn sàng.")
    else:
        logger.warning(
            "Chưa nhận được packet sau 3 giây; mọi lệnh chạy bị khóa cho tới khi có dữ liệu."
        )

    _print_controls(port, thresholds, stale_timeout, turn_clearance)
    key_to_motion = {
        "w": "forward",
        "s": "backward",
        "a": "left",
        "d": "right",
    }
    last_status_at = 0.0
    last_status_sequence = 0

    try:
        while True:
            safety.enforce()

            snapshot = reader.latest()
            now = time.monotonic()
            if (
                snapshot
                and snapshot.sequence != last_status_sequence
                and now - last_status_at >= 1.0
            ):
                last_status_at = now
                last_status_sequence = snapshot.sequence
                logger.info(
                    "DIST cm: front=%s rear=%s left=%s right=%s age=%.2fs",
                    snapshot.distance("front"),
                    snapshot.distance("rear"),
                    snapshot.distance("left"),
                    snapshot.distance("right"),
                    snapshot.age_seconds(now),
                )

            char = get_char()
            if not char:
                time.sleep(0.01)
                continue
            key = char.lower()
            if key in key_to_motion:
                safety.command(key_to_motion[key])
            elif key in ("x", " ", "\r", "\n"):
                safety.stop()
            elif key == "q" or char == "\x03":
                logger.info("Nhận lệnh thoát")
                break
    except KeyboardInterrupt:
        logger.info("Đã ngắt bằng Ctrl+C")
    finally:
        safety.stop()
        reader.stop()
        motor.cleanup()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
