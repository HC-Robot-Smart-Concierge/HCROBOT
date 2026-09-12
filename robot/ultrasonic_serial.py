"""Đọc JSON Lines ultrasonic + MPU từ ESP32 với reconnect và parse fail-safe."""

import argparse
from dataclasses import dataclass
import glob
import json
import logging
import math
import threading
import time
from typing import Dict, Optional


logger = logging.getLogger("UltrasonicSerial")
SENSOR_NAMES = ("front", "rear", "left", "right")
MIN_DISTANCE_CM = 2.0
MAX_DISTANCE_CM = 400.0
MAX_ACCEL_G = 32.0
MAX_GYRO_DPS = 4000.0

try:
    import serial
    from serial.tools import list_ports
except ImportError:
    serial = None
    list_ports = None


@dataclass(frozen=True)
class ParsedSensorPacket:
    distances: Dict[str, Optional[float]]
    mpu_available: bool = False
    accel: Optional[Dict[str, float]] = None
    gyro: Optional[Dict[str, float]] = None
    yaw_rate_dps: Optional[float] = None


def _decode_payload(raw_line):
    if isinstance(raw_line, bytes):
        try:
            raw_line = raw_line.decode("utf-8")
        except UnicodeDecodeError as exc:
            raise ValueError("packet không phải UTF-8") from exc

    line = raw_line.strip()
    if not line or line.startswith("#"):
        raise ValueError("dòng rỗng/debug")

    try:
        payload = json.loads(line)
    except json.JSONDecodeError as exc:
        raise ValueError("JSON không hợp lệ") from exc
    if not isinstance(payload, dict):
        raise ValueError("packet JSON phải là object")
    return payload


def _parse_distances(payload) -> Dict[str, Optional[float]]:
    """Validate ultrasonic fields without allowing one bad field to drop a packet."""
    distances = {}
    for name in SENSOR_NAMES:
        value = payload.get(name)
        if value is None or isinstance(value, bool) or not isinstance(value, (int, float)):
            distances[name] = None
            continue

        value = float(value)
        if not math.isfinite(value) or not MIN_DISTANCE_CM <= value <= MAX_DISTANCE_CM:
            distances[name] = None
            continue
        distances[name] = round(value, 1)
    return distances


def _parse_vector(value, max_abs):
    if not isinstance(value, dict):
        return None

    vector = {}
    for axis in ("x", "y", "z"):
        component = value.get(axis)
        if (
            component is None
            or isinstance(component, bool)
            or not isinstance(component, (int, float))
        ):
            return None
        component = float(component)
        if not math.isfinite(component) or abs(component) > max_abs:
            return None
        vector[axis] = component
    return vector


def _parse_scalar(value, max_abs):
    if value is None or isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    value = float(value)
    if not math.isfinite(value) or abs(value) > max_abs:
        return None
    return value


def parse_telemetry_packet(raw_line) -> ParsedSensorPacket:
    """Parse ultrasonic and optional MPU telemetry from one ESP32 JSON line."""
    payload = _decode_payload(raw_line)
    mpu_available = payload.get("mpu_available") is True
    accel = _parse_vector(payload.get("accel"), MAX_ACCEL_G) if mpu_available else None
    gyro = _parse_vector(payload.get("gyro"), MAX_GYRO_DPS) if mpu_available else None
    yaw_rate = (
        _parse_scalar(payload.get("yaw_rate_dps"), MAX_GYRO_DPS)
        if mpu_available
        else None
    )
    return ParsedSensorPacket(
        distances=_parse_distances(payload),
        mpu_available=mpu_available,
        accel=accel,
        gyro=gyro,
        yaw_rate_dps=yaw_rate,
    )


def parse_sensor_packet(raw_line) -> Dict[str, Optional[float]]:
    """Backward-compatible parser returning only the four ultrasonic fields."""
    return parse_telemetry_packet(raw_line).distances


@dataclass(frozen=True)
class SensorSnapshot:
    distances: Dict[str, Optional[float]]
    received_at: float
    port: str
    sequence: int
    mpu_available: bool = False
    accel: Optional[Dict[str, float]] = None
    gyro: Optional[Dict[str, float]] = None
    yaw_rate_dps: Optional[float] = None

    def distance(self, direction: str) -> Optional[float]:
        return self.distances.get(direction)

    def age_seconds(self, now: Optional[float] = None) -> float:
        return (time.monotonic() if now is None else now) - self.received_at

    def as_dict(self):
        packet = dict(self.distances)
        packet.update(
            {
                "mpu_available": self.mpu_available,
                "accel": dict(self.accel) if self.accel is not None else None,
                "gyro": dict(self.gyro) if self.gyro is not None else None,
                "yaw_rate_dps": self.yaw_rate_dps,
            }
        )
        return packet


def _port_score(port_info) -> int:
    """Ưu tiên USB-UART thường gặp trên ESP32: Espressif, CP210x, CH340, FTDI."""
    vid = getattr(port_info, "vid", None)
    description = (getattr(port_info, "description", "") or "").lower()
    manufacturer = (getattr(port_info, "manufacturer", "") or "").lower()
    text = description + " " + manufacturer

    if vid == 0x303A or "espressif" in text:
        return 100
    if vid == 0x10C4 or "cp210" in text or "silicon labs" in text:
        return 90
    if vid == 0x1A86 or "ch340" in text or "wch" in text:
        return 80
    if vid == 0x0403 or "ftdi" in text:
        return 70
    if "usb serial" in text or "usb uart" in text:
        return 50
    return 0


def detect_esp32_port() -> Optional[str]:
    """Tự tìm cổng ESP32, sau đó fallback về ttyUSB/ttyACM đầu tiên."""
    if list_ports is not None:
        ports = list(list_ports.comports())
        if ports:
            ports.sort(key=lambda item: (-_port_score(item), item.device))
            if _port_score(ports[0]) > 0:
                return ports[0].device

    candidates = sorted(glob.glob("/dev/ttyUSB*") + glob.glob("/dev/ttyACM*"))
    return candidates[0] if candidates else None


class UltrasonicSerialReader:
    """Reader tương thích cũ, nay expose cả khoảng cách và dữ liệu IMU."""

    def __init__(self, port="auto", baudrate=115200, reconnect_delay=1.0):
        self.configured_port = port or "auto"
        self.baudrate = int(baudrate)
        self.reconnect_delay = float(reconnect_delay)
        self._snapshot = None
        self._connection = None
        self._sequence = 0
        self._lock = threading.Lock()
        self._stop_event = threading.Event()
        self._thread = None
        self._last_warning_at = {}

    @property
    def connected(self) -> bool:
        with self._lock:
            return self._connection is not None

    def latest(self) -> Optional[SensorSnapshot]:
        with self._lock:
            snapshot = self._snapshot
            if snapshot is None:
                return None
            return SensorSnapshot(
                distances=dict(snapshot.distances),
                received_at=snapshot.received_at,
                port=snapshot.port,
                sequence=snapshot.sequence,
                mpu_available=snapshot.mpu_available,
                accel=dict(snapshot.accel) if snapshot.accel is not None else None,
                gyro=dict(snapshot.gyro) if snapshot.gyro is not None else None,
                yaw_rate_dps=snapshot.yaw_rate_dps,
            )

    def start(self):
        if serial is None:
            raise RuntimeError("Thiếu pyserial. Cài bằng: python3 -m pip install pyserial")
        if self._thread and self._thread.is_alive():
            return
        self._stop_event.clear()
        self._thread = threading.Thread(
            target=self._run,
            name="ultrasonic-serial",
            daemon=True,
        )
        self._thread.start()

    def stop(self):
        self._stop_event.set()
        with self._lock:
            connection = self._connection
        if connection is not None:
            try:
                connection.close()
            except Exception:
                pass
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=2.0)

    def wait_for_packet(self, timeout=3.0) -> bool:
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline and not self._stop_event.is_set():
            if self.latest() is not None:
                return True
            time.sleep(0.05)
        return self.latest() is not None

    def _selected_port(self) -> Optional[str]:
        if str(self.configured_port).lower() != "auto":
            return str(self.configured_port)
        return detect_esp32_port()

    def _warn_throttled(self, key, message, interval=5.0):
        now = time.monotonic()
        if now - self._last_warning_at.get(key, 0.0) >= interval:
            logger.warning(message)
            self._last_warning_at[key] = now

    def _run(self):
        while not self._stop_event.is_set():
            port = self._selected_port()
            if not port:
                self._warn_throttled(
                    "no-port",
                    "Không tìm thấy ESP32 (/dev/ttyUSB* hoặc /dev/ttyACM*); motor bị khóa fail-safe.",
                )
                self._stop_event.wait(self.reconnect_delay)
                continue

            connection = None
            try:
                connection = serial.Serial(
                    port=port,
                    baudrate=self.baudrate,
                    timeout=0.5,
                )
                with self._lock:
                    self._connection = connection
                logger.info("Đã kết nối ESP32 tại %s @ %d baud", port, self.baudrate)

                while not self._stop_event.is_set():
                    raw_line = connection.readline(512)
                    if not raw_line:
                        continue
                    try:
                        packet = parse_telemetry_packet(raw_line)
                    except ValueError as exc:
                        # REPL/debug lines hoặc packet hỏng không làm chết reader.
                        self._warn_throttled(
                            "bad-packet",
                            f"Bỏ qua Serial packet lỗi: {exc}; raw={raw_line[:120]!r}",
                            interval=2.0,
                        )
                        continue

                    with self._lock:
                        self._sequence += 1
                        self._snapshot = SensorSnapshot(
                            distances=packet.distances,
                            received_at=time.monotonic(),
                            port=port,
                            sequence=self._sequence,
                            mpu_available=packet.mpu_available,
                            accel=packet.accel,
                            gyro=packet.gyro,
                            yaw_rate_dps=packet.yaw_rate_dps,
                        )
                    logger.debug(
                        "Sensor #%d: ultrasonic=%s mpu_available=%s accel=%s gyro=%s yaw_rate_dps=%s",
                        self._sequence,
                        packet.distances,
                        packet.mpu_available,
                        packet.accel,
                        packet.gyro,
                        packet.yaw_rate_dps,
                    )
            except Exception as exc:
                if not self._stop_event.is_set():
                    self._warn_throttled(
                        "serial-error",
                        f"Mất kết nối ESP32 tại {port}: {exc}; sẽ thử lại.",
                        interval=1.0,
                    )
            finally:
                with self._lock:
                    if self._connection is connection:
                        self._connection = None
                if connection is not None:
                    try:
                        connection.close()
                    except Exception:
                        pass

            self._stop_event.wait(self.reconnect_delay)


def main():
    parser = argparse.ArgumentParser(description="Xem JSON ultrasonic + MPU từ ESP32")
    parser.add_argument("--port", default="auto")
    parser.add_argument("--baud", type=int, default=115200)
    parser.add_argument("--debug", action="store_true")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.debug else logging.INFO,
        format="[%(asctime)s] [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
    )
    reader = UltrasonicSerialReader(args.port, args.baud)
    reader.start()
    last_sequence = 0
    try:
        while True:
            snapshot = reader.latest()
            if snapshot and snapshot.sequence != last_sequence:
                last_sequence = snapshot.sequence
                print(json.dumps(snapshot.as_dict(), ensure_ascii=False))
            time.sleep(0.02)
    except KeyboardInterrupt:
        logger.info("Dừng chương trình đọc ultrasonic")
    finally:
        reader.stop()


if __name__ == "__main__":
    main()
