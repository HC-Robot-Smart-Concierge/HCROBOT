"""MicroPython driver for the four sequential HC-SR04 sensors."""

import time
from machine import Pin, time_pulse_us


SENSOR_PINS = (
    ("front", 18, 34),
    ("rear", 19, 35),
    ("left", 21, 32),
    ("right", 22, 33),
)

MIN_DISTANCE_CM = 2.0
MAX_DISTANCE_CM = 400.0
ECHO_TIMEOUT_US = 30_000
SENSOR_GAP_MS = 18
MEDIAN_WINDOW = 3


def median(values):
    ordered = sorted(values)
    middle = len(ordered) // 2
    if len(ordered) % 2:
        return ordered[middle]
    return (ordered[middle - 1] + ordered[middle]) / 2


class HCSR04:
    def __init__(self, name, trigger_pin, echo_pin):
        self.name = name
        self.trigger = Pin(trigger_pin, Pin.OUT, value=0)
        self.echo = Pin(echo_pin, Pin.IN)
        self.history = []

    def read_once_cm(self):
        self.trigger.value(0)
        time.sleep_us(2)
        self.trigger.value(1)
        time.sleep_us(10)
        self.trigger.value(0)

        try:
            duration_us = time_pulse_us(self.echo, 1, ECHO_TIMEOUT_US)
        except OSError:
            return None

        if duration_us < 0:
            return None

        distance_cm = duration_us / 58.0
        if not MIN_DISTANCE_CM <= distance_cm <= MAX_DISTANCE_CM:
            return None
        return distance_cm

    def read_filtered_cm(self):
        current = self.read_once_cm()
        if current is None:
            return None

        self.history.append(current)
        if len(self.history) > MEDIAN_WINDOW:
            self.history.pop(0)
        return round(median(self.history), 1)


def create_sensors():
    return [HCSR04(*config) for config in SENSOR_PINS]


def read_ultrasonic_packet(sensors, gap_ms=SENSOR_GAP_MS):
    packet = {}
    for sensor in sensors:
        packet[sensor.name] = sensor.read_filtered_cm()
        time.sleep_ms(gap_ms)
    return packet


def test_sensor(name, trigger_pin, echo_pin, samples=10):
    sensor = HCSR04(name, trigger_pin, echo_pin)
    for _ in range(samples):
        print("{}: {} cm".format(name, sensor.read_filtered_cm()))
        time.sleep_ms(100)


def test_all(cycles=20):
    sensors = create_sensors()
    for _ in range(cycles):
        print(read_ultrasonic_packet(sensors))
        time.sleep_ms(40)
