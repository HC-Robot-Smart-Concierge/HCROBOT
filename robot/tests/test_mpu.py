import os
import sys
from unittest.mock import patch


sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from esp32.mpu import (  # noqa: E402
    MPU6500,
    REG_ACCEL_XOUT_H,
    REG_WHO_AM_I,
    detect_mpu,
    map_mpu_to_robot_frame,
    scan_mpu_addresses,
)


def _be16(value):
    if value < 0:
        value += 65536
    return bytes(((value >> 8) & 0xFF, value & 0xFF))


class FakeI2C:
    def __init__(self, who_am_i=0x71, sample=None, addresses=None):
        self.who_am_i = who_am_i
        self.sample = sample or (b"\x00" * 14)
        self.addresses = [0x68] if addresses is None else addresses
        self.writes = []

    def scan(self):
        return list(self.addresses)

    def readfrom_mem(self, address, register, length):
        if register == REG_WHO_AM_I:
            return bytes((self.who_am_i,))
        if register == REG_ACCEL_XOUT_H:
            return self.sample
        raise AssertionError("unexpected register 0x{:02X}".format(register))

    def writeto_mem(self, address, register, data):
        self.writes.append((address, register, bytes(data)))


def test_scan_only_returns_mpu_addresses():
    i2c = FakeI2C(addresses=[0x0C, 0x68, 0x76])
    assert scan_mpu_addresses(i2c) == [0x68]


def test_detect_and_initialize_mpu9250():
    i2c = FakeI2C(who_am_i=0x71)
    with patch("esp32.mpu._sleep_ms"):
        mpu = detect_mpu(i2c)

    assert mpu is not None
    assert mpu.device_name == "MPU-9250"
    assert mpu.has_magnetometer is True
    assert mpu.who_am_i == 0x71
    assert len(i2c.writes) == 8


def test_read_all_scales_bias_corrects_and_exposes_yaw_rate():
    sample = b"".join(
        (
            _be16(8192),   # accel X = 1 g
            _be16(-4096),  # accel Y = -0.5 g
            _be16(8192),   # accel Z = 1 g
            _be16(0),      # temperature
            _be16(655),    # gyro X = 10 dps
            _be16(-3275),  # gyro Y = -50 dps
            _be16(1310),   # gyro Z = 20 dps
        )
    )
    mpu = MPU6500(FakeI2C(sample=sample))
    mpu.gyro_bias = (1.0, -2.0, 5.0)

    reading = mpu.read_all()

    assert reading["accel"] == {"x": 1.0, "y": -0.5, "z": 1.0}
    assert reading["gyro"] == {"x": 9.0, "y": -48.0, "z": 15.0}
    assert reading["yaw_rate_dps"] == 15.0


def test_axis_mapping_is_shared_by_accel_and_gyro():
    mapped = map_mpu_to_robot_frame(
        1,
        2,
        3,
        10,
        20,
        30,
        axis_map=((1, 1), (0, -1), (2, 1)),
    )
    assert mapped == (2, -1, 3, 20, -10, 30)
