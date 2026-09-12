"""MicroPython driver for the MPU-6500/MPU-9250 accel and gyro block.

The output frame used by this project is:
    robot X = right, robot Y = forward, robot Z = up.

ROBOT_AXIS_MAP is the only place that must be changed if the breakout board is
mounted with different printed axis directions.  Each item is
``(sensor_axis_index, sign)`` where indexes 0/1/2 mean sensor X/Y/Z.
"""

import time


MPU_ADDRESSES = (0x68, 0x69)

REG_SMPLRT_DIV = 0x19
REG_CONFIG = 0x1A
REG_GYRO_CONFIG = 0x1B
REG_ACCEL_CONFIG = 0x1C
REG_ACCEL_CONFIG_2 = 0x1D
REG_ACCEL_XOUT_H = 0x3B
REG_PWR_MGMT_1 = 0x6B
REG_PWR_MGMT_2 = 0x6C
REG_WHO_AM_I = 0x75

# Full-scale settings used below: accel +/-4 g, gyro +/-500 degrees/second.
ACCEL_FS_CONFIG = 0x08
GYRO_FS_CONFIG = 0x08
ACCEL_LSB_PER_G = 8192.0
GYRO_LSB_PER_DPS = 65.5

WHO_AM_I_NAMES = {
    0x68: "MPU-6050/compatible clone",
    0x70: "MPU-6500",
    0x71: "MPU-9250",
    0x73: "MPU-9255",
}

# Default identity mapping. It is correct only when the board's printed axes
# point +X right, +Y forward, +Z up. Examples:
#   Swap X/Y:       ((1, +1), (0, +1), (2, +1))
#   Reverse Y axis: ((0, +1), (1, -1), (2, +1))
ROBOT_AXIS_MAP = ((0, +1), (1, +1), (2, +1))


def _sleep_ms(delay_ms):
    if hasattr(time, "sleep_ms"):
        time.sleep_ms(delay_ms)
    else:  # Allows the pure driver logic to be tested with CPython.
        time.sleep(delay_ms / 1000.0)


def _int16(msb, lsb):
    value = (msb << 8) | lsb
    return value - 65536 if value & 0x8000 else value


def _map_vector(vector, axis_map=ROBOT_AXIS_MAP):
    if len(axis_map) != 3:
        raise ValueError("axis_map must contain exactly three axes")
    indexes = [entry[0] for entry in axis_map]
    if sorted(indexes) != [0, 1, 2]:
        raise ValueError("axis_map must use sensor axes 0, 1 and 2 exactly once")
    return tuple(vector[index] * sign for index, sign in axis_map)


def map_mpu_to_robot_frame(ax, ay, az, gx, gy, gz, axis_map=ROBOT_AXIS_MAP):
    """Map accel and gyro from the breakout frame to the robot frame."""
    robot_accel = _map_vector((ax, ay, az), axis_map)
    robot_gyro = _map_vector((gx, gy, gz), axis_map)
    return robot_accel + robot_gyro


def scan_mpu_addresses(i2c):
    """Return detected MPU addresses (AD0 low=0x68, AD0 high=0x69)."""
    addresses = i2c.scan()
    return [address for address in MPU_ADDRESSES if address in addresses]


class MPU6500:
    """Minimal common accel/gyro driver for MPU-6500 and MPU-9250."""

    def __init__(self, i2c, address=0x68, axis_map=ROBOT_AXIS_MAP):
        self.i2c = i2c
        self.address = address
        self.axis_map = axis_map
        self.who_am_i = None
        self.device_name = None
        self.has_magnetometer = False
        self.gyro_bias = (0.0, 0.0, 0.0)

    def _read(self, register, length=1):
        return self.i2c.readfrom_mem(self.address, register, length)

    def _write(self, register, value):
        self.i2c.writeto_mem(self.address, register, bytes((value,)))

    def read_who_am_i(self):
        return self._read(REG_WHO_AM_I, 1)[0]

    def initialize(self):
        self.who_am_i = self.read_who_am_i()
        if self.who_am_i not in WHO_AM_I_NAMES:
            raise RuntimeError(
                "Unsupported WHO_AM_I 0x{:02X}".format(self.who_am_i)
            )

        self.device_name = WHO_AM_I_NAMES[self.who_am_i]
        self.has_magnetometer = self.who_am_i in (0x71, 0x73)

        # PWR_MGMT_1: wake from sleep, then select PLL clock source.
        self._write(REG_PWR_MGMT_1, 0x00)
        _sleep_ms(100)
        self._write(REG_PWR_MGMT_1, 0x01)
        self._write(REG_PWR_MGMT_2, 0x00)

        # 1 kHz internal sample / (1 + 9) = 100 Hz register update.
        self._write(REG_SMPLRT_DIV, 9)
        # DLPF_CFG=3: moderate filtering for a wheeled robot.
        self._write(REG_CONFIG, 0x03)
        self._write(REG_GYRO_CONFIG, GYRO_FS_CONFIG)
        self._write(REG_ACCEL_CONFIG, ACCEL_FS_CONFIG)
        self._write(REG_ACCEL_CONFIG_2, 0x03)
        _sleep_ms(50)
        return self.who_am_i

    def _read_scaled_sensor_frame(self):
        # One burst keeps accel and gyro samples temporally aligned.
        data = self._read(REG_ACCEL_XOUT_H, 14)
        if len(data) != 14:
            raise OSError("MPU returned an incomplete sample")

        raw_ax = _int16(data[0], data[1])
        raw_ay = _int16(data[2], data[3])
        raw_az = _int16(data[4], data[5])
        raw_temp = _int16(data[6], data[7])
        raw_gx = _int16(data[8], data[9])
        raw_gy = _int16(data[10], data[11])
        raw_gz = _int16(data[12], data[13])

        accel = (
            raw_ax / ACCEL_LSB_PER_G,
            raw_ay / ACCEL_LSB_PER_G,
            raw_az / ACCEL_LSB_PER_G,
        )
        gyro = (
            raw_gx / GYRO_LSB_PER_DPS,
            raw_gy / GYRO_LSB_PER_DPS,
            raw_gz / GYRO_LSB_PER_DPS,
        )
        temperature_c = raw_temp / 333.87 + 21.0
        return accel, gyro, temperature_c

    def calibrate_gyro(self, samples=300, delay_ms=5):
        if samples <= 0:
            raise ValueError("samples must be positive")

        print("# Keep robot still: calibrating gyro...")
        sums = [0.0, 0.0, 0.0]
        for _ in range(samples):
            _accel, gyro, _temperature = self._read_scaled_sensor_frame()
            for axis in range(3):
                sums[axis] += gyro[axis]
            _sleep_ms(delay_ms)

        self.gyro_bias = tuple(value / samples for value in sums)
        print(
            "# Gyro bias dps: x={:.4f} y={:.4f} z={:.4f}".format(
                self.gyro_bias[0], self.gyro_bias[1], self.gyro_bias[2]
            )
        )
        return self.gyro_bias

    def read_accel(self):
        accel, _gyro, _temperature = self._read_scaled_sensor_frame()
        return _map_vector(accel, self.axis_map)

    def read_gyro(self):
        _accel, gyro, _temperature = self._read_scaled_sensor_frame()
        corrected = tuple(
            gyro[axis] - self.gyro_bias[axis] for axis in range(3)
        )
        return _map_vector(corrected, self.axis_map)

    def read_all(self):
        accel, gyro, temperature_c = self._read_scaled_sensor_frame()
        corrected_gyro = tuple(
            gyro[axis] - self.gyro_bias[axis] for axis in range(3)
        )
        values = map_mpu_to_robot_frame(
            accel[0],
            accel[1],
            accel[2],
            corrected_gyro[0],
            corrected_gyro[1],
            corrected_gyro[2],
            self.axis_map,
        )
        robot_accel = values[0:3]
        robot_gyro = values[3:6]
        return {
            "accel": {
                "x": round(robot_accel[0], 4),
                "y": round(robot_accel[1], 4),
                "z": round(robot_accel[2], 4),
            },
            "gyro": {
                "x": round(robot_gyro[0], 2),
                "y": round(robot_gyro[1], 2),
                "z": round(robot_gyro[2], 2),
            },
            "yaw_rate_dps": round(robot_gyro[2], 2),
            "temperature_c": round(temperature_c, 2),
        }


def detect_mpu(i2c, axis_map=ROBOT_AXIS_MAP):
    """Create and identify the first supported device at 0x68 or 0x69."""
    for address in scan_mpu_addresses(i2c):
        candidate = MPU6500(i2c, address=address, axis_map=axis_map)
        try:
            candidate.initialize()
            return candidate
        except (OSError, RuntimeError) as exc:
            print(
                "# WARN MPU probe failed at 0x{:02X}: {}".format(address, exc)
            )
            continue
    return None
