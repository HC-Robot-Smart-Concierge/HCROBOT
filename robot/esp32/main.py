"""ESP32 MicroPython entry point: four HC-SR04 sensors plus MPU-6500/9250."""

try:
    import ujson as json
except ImportError:
    import json

import time
from machine import I2C, Pin

from mpu import ROBOT_AXIS_MAP, detect_mpu
from ultrasonic import create_sensors, read_ultrasonic_packet


I2C_ID = 0
I2C_SDA_PIN = 25
I2C_SCL_PIN = 26
I2C_FREQUENCY_HZ = 400_000
I2C_FALLBACK_FREQUENCY_HZ = 100_000

GYRO_CALIBRATION_SAMPLES = 300
GYRO_CALIBRATION_DELAY_MS = 5
MPU_RETRY_MS = 5_000
MPU_FAILURE_LIMIT = 3
UPDATE_PERIOD_MS = 125


def create_i2c(frequency=I2C_FREQUENCY_HZ):
    return I2C(
        I2C_ID,
        sda=Pin(I2C_SDA_PIN),
        scl=Pin(I2C_SCL_PIN),
        freq=frequency,
    )


def scan_i2c(i2c):
    addresses = i2c.scan()
    print("# I2C scan: {}".format(["0x{:02X}".format(a) for a in addresses]))
    return addresses


def start_mpu(i2c):
    scan_i2c(i2c)
    mpu = detect_mpu(i2c, axis_map=ROBOT_AXIS_MAP)
    if mpu is None:
        print("# WARN MPU not found at 0x68 or 0x69; ultrasonic remains active")
        return None

    print(
        "# MPU detected: {} address=0x{:02X} WHO_AM_I=0x{:02X} magnetometer={}".format(
            mpu.device_name,
            mpu.address,
            mpu.who_am_i,
            mpu.has_magnetometer,
        )
    )
    mpu.calibrate_gyro(
        samples=GYRO_CALIBRATION_SAMPLES,
        delay_ms=GYRO_CALIBRATION_DELAY_MS,
    )
    return mpu


def empty_mpu_payload():
    return {
        "mpu_available": False,
        "accel": None,
        "gyro": None,
        "yaw_rate_dps": None,
    }


def initialize_mpu_bus():
    last_i2c = None
    for frequency in (I2C_FREQUENCY_HZ, I2C_FALLBACK_FREQUENCY_HZ):
        try:
            last_i2c = create_i2c(frequency)
            mpu = start_mpu(last_i2c)
            if mpu is not None:
                return last_i2c, mpu
            if frequency == I2C_FREQUENCY_HZ:
                print("# MPU absent at 400kHz; retrying I2C at 100kHz")
        except Exception as exc:
            print(
                "# WARN MPU startup at {}Hz failed: {}".format(frequency, exc)
            )
    return last_i2c, None


def run():
    sensors = create_sensors()
    time.sleep_ms(100)

    i2c, mpu = initialize_mpu_bus()

    failure_count = 0
    last_retry_ms = time.ticks_ms()

    while True:
        cycle_started = time.ticks_ms()
        packet = read_ultrasonic_packet(sensors)
        packet.update(empty_mpu_payload())

        if mpu is not None:
            try:
                reading = mpu.read_all()
                packet["mpu_available"] = True
                packet["accel"] = reading["accel"]
                packet["gyro"] = reading["gyro"]
                packet["yaw_rate_dps"] = reading["yaw_rate_dps"]
                failure_count = 0
            except (OSError, RuntimeError, ValueError) as exc:
                failure_count += 1
                print("# WARN MPU read failed ({}/{}): {}".format(
                    failure_count, MPU_FAILURE_LIMIT, exc
                ))
                if failure_count >= MPU_FAILURE_LIMIT:
                    mpu = None
                    last_retry_ms = time.ticks_ms()

        elif time.ticks_diff(time.ticks_ms(), last_retry_ms) >= MPU_RETRY_MS:
            last_retry_ms = time.ticks_ms()
            i2c, mpu = initialize_mpu_bus()
            failure_count = 0

        print(json.dumps(packet))

        elapsed_ms = time.ticks_diff(time.ticks_ms(), cycle_started)
        remaining_ms = UPDATE_PERIOD_MS - elapsed_ms
        if remaining_ms > 0:
            time.sleep_ms(remaining_ms)


if __name__ == "__main__":
    try:
        run()
    except KeyboardInterrupt:
        print("# Sensor loop stopped")
