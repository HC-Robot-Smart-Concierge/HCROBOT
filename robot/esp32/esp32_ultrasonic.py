"""MicroPython firmware: đọc tuần tự 4 HC-SR04 và gửi JSON Lines qua USB Serial.

Wiring ESP32 classic / ESP-WROOM-32:
    FRONT TRIG=GPIO18, ECHO=GPIO34
    REAR  TRIG=GPIO19, ECHO=GPIO35
    LEFT  TRIG=GPIO21, ECHO=GPIO32
    RIGHT TRIG=GPIO22, ECHO=GPIO33

Mỗi ECHO phải đi qua voltage divider trước khi vào ESP32.
Copy file này lên ESP32 với tên ``main.py`` để tự chạy sau khi boot.
"""

try:
    import ujson as json
except ImportError:
    import json

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
UPDATE_PERIOD_MS = 125  # mục tiêu tối đa 8 packet hoàn chỉnh/giây
MEDIAN_WINDOW = 3
DEBUG = False


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
        """Đo một lần; trả về None nếu timeout hoặc ngoài dải HC-SR04."""
        self.trigger.value(0)
        time.sleep_us(2)
        self.trigger.value(1)
        time.sleep_us(10)
        self.trigger.value(0)

        try:
            duration_us = time_pulse_us(self.echo, 1, ECHO_TIMEOUT_US)
        except OSError:
            return None

        # MicroPython trả -2 khi chờ cạnh lên timeout, -1 khi pulse bị timeout.
        if duration_us < 0:
            return None

        distance_cm = duration_us / 58.0
        if not MIN_DISTANCE_CM <= distance_cm <= MAX_DISTANCE_CM:
            return None
        return distance_cm

    def read_filtered_cm(self):
        """Median trượt ba reading hợp lệ gần nhất; lỗi hiện tại vẫn báo None."""
        current = self.read_once_cm()
        if current is None:
            return None

        self.history.append(current)
        if len(self.history) > MEDIAN_WINDOW:
            self.history.pop(0)
        return round(median(self.history), 1)


def run():
    sensors = [HCSR04(*config) for config in SENSOR_PINS]
    time.sleep_ms(100)

    if DEBUG:
        print("# HC-SR04 ready; output format: JSON Lines")

    while True:
        cycle_started = time.ticks_ms()
        packet = {}

        # Đọc đúng thứ tự và không bao giờ trigger đồng thời để giảm cross-talk.
        for sensor in sensors:
            value = sensor.read_filtered_cm()
            packet[sensor.name] = value
            if DEBUG and value is None:
                print("# WARN {} timeout/out-of-range".format(sensor.name))
            time.sleep_ms(SENSOR_GAP_MS)

        print(json.dumps(packet))

        elapsed_ms = time.ticks_diff(time.ticks_ms(), cycle_started)
        remaining_ms = UPDATE_PERIOD_MS - elapsed_ms
        if remaining_ms > 0:
            time.sleep_ms(remaining_ms)


def test_sensor(name, trigger_pin, echo_pin, samples=10):
    """Helper dùng từ mpremote để test riêng một sensor trước khi chạy cả hệ."""
    sensor = HCSR04(name, trigger_pin, echo_pin)
    for _ in range(samples):
        print("{}: {} cm".format(name, sensor.read_filtered_cm()))
        time.sleep_ms(100)


def test_all(cycles=20):
    """Helper test bốn sensor tuần tự nhưng chưa cài firmware thành main.py."""
    sensors = [HCSR04(*config) for config in SENSOR_PINS]
    for _ in range(cycles):
        packet = {}
        for sensor in sensors:
            packet[sensor.name] = sensor.read_filtered_cm()
            time.sleep_ms(SENSOR_GAP_MS)
        print(json.dumps(packet))
        time.sleep_ms(40)


if __name__ == "__main__":
    try:
        run()
    except KeyboardInterrupt:
        # Cho phép Ctrl+C trong mpremote REPL để debug mà không in traceback dài.
        print("# Ultrasonic loop stopped")
