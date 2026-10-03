"""ESP32 MicroPython Production Firmware:
- 4x Independent L298N Motor Control (PWM + Direction)
- 4x Independent Quadrature Motor Encoders (Ticks + Direction + RPM)
- 4x Sequential HC-SR04 Ultrasonic Sensors
- 1x MPU-9250 / MPU-6500 IMU (I2C)
- Safety Watchdog: Auto-stops motors if Pi communication is lost
- Bidirectional Non-blocking Serial Protocol (JSON Lines Telemetry + Commands)
"""

try:
    import ujson as json
except ImportError:
    import json

import sys
import time
import uselect
from machine import I2C, Pin

from encoder import EncoderManager, QuadratureEncoder
from motor import DCMotor, FourWheelDrive
from mpu import ROBOT_AXIS_MAP, detect_mpu
from ultrasonic import create_sensors, read_ultrasonic_packet

# ==============================================================================
# 1. GPIO PIN DEFINITIONS & HARDWARE ASSIGNMENTS
# ==============================================================================

# --- EXISTING OCCUPIED HARDWARE (DO NOT MODIFY OR REASSIGN) ---
# Ultrasonic (HC-SR04):
#   FRONT: Trig=GPIO18, Echo=GPIO34 (Input only)
#   REAR:  Trig=GPIO19, Echo=GPIO35 (Input only)
#   LEFT:  Trig=GPIO21, Echo=GPIO32
#   RIGHT: Trig=GPIO22, Echo=GPIO33
# MPU-9250 / 6500:
#   I2C SDA=GPIO25, SCL=GPIO26
I2C_ID = 0
I2C_SDA_PIN = 25
I2C_SCL_PIN = 26
I2C_FREQUENCY_HZ = 400_000
I2C_FALLBACK_FREQUENCY_HZ = 100_000

# --- MOTOR CONTROLLER MODE ---
# L298N IN1/IN2/IN3/IN4 are plugged directly into Raspberry Pi GPIO.
# Set ENABLE_ESP32_MOTOR_OUTPUT = False so ESP32 does NOT claim or interfere with any motor pins.
ENABLE_ESP32_MOTOR_OUTPUT = False

MOTOR_CONFIG = {
    "m1": {"in1": None, "in2": None, "en": None, "invert": False},
    "m2": {"in1": None, "in2": None, "en": None, "invert": False},
    "m3": {"in1": None, "in2": None, "en": None, "invert": False},
    "m4": {"in1": None, "in2": None, "en": None, "invert": False},
}

# --- EXACT PHYSICAL ENCODER CONFIGURATION (JGA25-370 Quadrature A/B) ---
# Motor 1: Phase A = GPIO 4,  Phase B = GPIO 5
# Motor 2: Phase A = GPIO 13, Phase B = GPIO 14
# Motor 3: Phase A = GPIO 16, Phase B = GPIO 17
# Motor 4: Phase A = GPIO 23, Phase B = GPIO 27
DEFAULT_ENCODER_CPR = 330.0  # <--- USER CONFIGURABLE: Enter actual CPR here

ENCODER_CONFIG = {
    # Motor 1 Encoder (Left) - Inverted to match forward convention
    "m1": {"pin_a": 4,  "pin_b": 5,  "cpr": DEFAULT_ENCODER_CPR, "invert": True},
    # Motor 2 Encoder (Left) - Inverted to match forward convention
    "m2": {"pin_a": 13, "pin_b": 14, "cpr": DEFAULT_ENCODER_CPR, "invert": True},
    # Motor 3 Encoder (Right)
    "m3": {"pin_a": 16, "pin_b": 17, "cpr": DEFAULT_ENCODER_CPR, "invert": False},
    # Motor 4 Encoder (Right)
    "m4": {"pin_a": 23, "pin_b": 27, "cpr": DEFAULT_ENCODER_CPR, "invert": False},
}

# ==============================================================================
# 2. SYSTEM PARAMETERS
# ==============================================================================
DEBUG = False  # Set to True for verbose periodic console debug logs
COMMAND_TIMEOUT_MS = 1000  # Safety watchdog: Stop motors if no command within 1.0s
UPDATE_PERIOD_MS = 50      # Telemetry rate: 20 Hz (50ms per packet, phản xạ tức thì)
GYRO_CALIBRATION_SAMPLES = 300
GYRO_CALIBRATION_DELAY_MS = 5
MPU_RETRY_MS = 5_000
MPU_FAILURE_LIMIT = 3


# ==============================================================================
# 3. MPU I2C DRIVER HELPER
# ==============================================================================
def create_i2c(frequency=I2C_FREQUENCY_HZ):
    return I2C(
        I2C_ID,
        sda=Pin(I2C_SDA_PIN),
        scl=Pin(I2C_SCL_PIN),
        freq=frequency,
    )


def start_mpu(i2c):
    try:
        mpu = detect_mpu(i2c, axis_map=ROBOT_AXIS_MAP)
        if mpu is None:
            return None
        mpu.calibrate_gyro(
            samples=GYRO_CALIBRATION_SAMPLES,
            delay_ms=GYRO_CALIBRATION_DELAY_MS,
        )
        return mpu
    except Exception as exc:
        print("# WARN MPU init error:", exc)
        return None


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
        except Exception as exc:
            print("# WARN I2C init failed:", exc)
    return last_i2c, None


# ==============================================================================
# 4. HARDWARE INITIALIZATION
# ==============================================================================
def init_motors():
    """Initialize all 4 DC Motors with safety stop on startup."""
    if not ENABLE_ESP32_MOTOR_OUTPUT:
        print("# Note: ESP32 motor outputs disabled (L298N driven by Raspberry Pi)")
        return None

    m1 = DCMotor(MOTOR_CONFIG["m1"]["in1"], MOTOR_CONFIG["m1"]["in2"], MOTOR_CONFIG["m1"]["en"], invert=MOTOR_CONFIG["m1"]["invert"])
    m2 = DCMotor(MOTOR_CONFIG["m2"]["in1"], MOTOR_CONFIG["m2"]["in2"], MOTOR_CONFIG["m2"]["en"], invert=MOTOR_CONFIG["m2"]["invert"])
    m3 = DCMotor(MOTOR_CONFIG["m3"]["in1"], MOTOR_CONFIG["m3"]["in2"], MOTOR_CONFIG["m3"]["en"], invert=MOTOR_CONFIG["m3"]["invert"])
    m4 = DCMotor(MOTOR_CONFIG["m4"]["in1"], MOTOR_CONFIG["m4"]["in2"], MOTOR_CONFIG["m4"]["en"], invert=MOTOR_CONFIG["m4"]["invert"])
    drive = FourWheelDrive(m1, m2, m3, m4)
    drive.stopAll()
    return drive


def init_encoders():
    """Initialize all 4 Quadrature Encoders."""
    e1 = QuadratureEncoder(ENCODER_CONFIG["m1"]["pin_a"], ENCODER_CONFIG["m1"]["pin_b"], ENCODER_CONFIG["m1"]["cpr"], ENCODER_CONFIG["m1"]["invert"])
    e2 = QuadratureEncoder(ENCODER_CONFIG["m2"]["pin_a"], ENCODER_CONFIG["m2"]["pin_b"], ENCODER_CONFIG["m2"]["cpr"], ENCODER_CONFIG["m2"]["invert"])
    e3 = QuadratureEncoder(ENCODER_CONFIG["m3"]["pin_a"], ENCODER_CONFIG["m3"]["pin_b"], ENCODER_CONFIG["m3"]["cpr"], ENCODER_CONFIG["m3"]["invert"])
    e4 = QuadratureEncoder(ENCODER_CONFIG["m4"]["pin_a"], ENCODER_CONFIG["m4"]["pin_b"], ENCODER_CONFIG["m4"]["cpr"], ENCODER_CONFIG["m4"]["invert"])
    return EncoderManager(e1, e2, e3, e4)


# ==============================================================================
# 5. NON-BLOCKING SERIAL COMMAND PARSER
# ==============================================================================
class SerialCommandParser:
    """Non-blocking stream parser reading commands from Raspberry Pi."""

    def __init__(self, drive):
        self.drive = drive
        self.poll = uselect.poll()
        self.poll.register(sys.stdin, uselect.POLLIN)
        self.buffer = ""
        self.debug_mode = DEBUG

    def check_commands(self) -> bool:
        """Polls serial input. Returns True if a valid motor command was executed."""
        command_received = False

        while self.poll.poll(0):
            char = sys.stdin.read(1)
            if not char:
                break
            if char in ("\n", "\r"):
                line = self.buffer.strip()
                self.buffer = ""
                if line:
                    if self._execute_line(line):
                        command_received = True
            else:
                self.buffer += char
                if len(self.buffer) > 128:  # Overflow guard
                    self.buffer = ""

        return command_received

    def _execute_line(self, line: str) -> bool:
        upper = line.upper()

        if upper == "STOP":
            if self.drive:
                self.drive.stopAll()
            if self.debug_mode:
                print("# [RECV] STOP -> All motors stopped")
            return True

        if upper.startswith("DEBUG:"):
            val = upper.split(":")[1].strip()
            self.debug_mode = (val in ("1", "TRUE", "ON"))
            print("# Debug mode set to:", self.debug_mode)
            return False

        # Protocol: M:s1,s2,s3,s4
        if upper.startswith("M:"):
            parts = line[2:].split(",")
            if len(parts) == 4:
                try:
                    s1 = int(parts[0].strip())
                    s2 = int(parts[1].strip())
                    s3 = int(parts[2].strip())
                    s4 = int(parts[3].strip())
                    if self.drive:
                        self.drive.setAllSpeeds(s1, s2, s3, s4)
                    if self.debug_mode:
                        print("# [RECV] M: {}, {}, {}, {}".format(s1, s2, s3, s4))
                    return True
                except ValueError:
                    if self.debug_mode:
                        print("# [WARN] Bad M command syntax:", line)
            return False

        # Protocol: M1:speed, M2:speed, etc.
        for motor_id in (1, 2, 3, 4):
            prefix = "M{}:".format(motor_id)
            if upper.startswith(prefix):
                try:
                    speed = int(line[len(prefix):].strip())
                    if self.drive:
                        self.drive.setMotorSpeed(motor_id, speed)
                    if self.debug_mode:
                        print("# [RECV] M{}: {}".format(motor_id, speed))
                    return True
                except ValueError:
                    pass

        return False


# ==============================================================================
# 6. MAIN SYSTEM LOOP
# ==============================================================================
def run():
    print("# ESP32 4-Wheel Robot Firmware Starting...")

    # Hardware init
    drive = init_motors()
    encoders = init_encoders()
    sensors = create_sensors()
    time.sleep_ms(50)

    i2c, mpu = initialize_mpu_bus()
    cmd_parser = SerialCommandParser(drive)

    last_command_time = time.ticks_ms()
    last_retry_ms = time.ticks_ms()
    failure_count = 0
    motors_active = False

    print("# System initialized. Motors STOPPED until command received.")

    while True:
        cycle_started = time.ticks_ms()

        # 1. Process incoming commands from Raspberry Pi (non-blocking)
        received = cmd_parser.check_commands()
        if received:
            last_command_time = cycle_started
            motors_active = True

        # 2. Safety Watchdog Check
        if motors_active and time.ticks_diff(cycle_started, last_command_time) >= COMMAND_TIMEOUT_MS:
            if drive:
                drive.stopAll()
            motors_active = False
            if cmd_parser.debug_mode:
                print("# [WATCHDOG] Communication timeout! Motors STOPPED.")

        # 3. Update Encoder RPM and Ticks
        encoders.updateAll()

        # 4. Read Ultrasonic Sensors
        packet = read_ultrasonic_packet(sensors)
        packet.update(empty_mpu_payload())

        # 5. Read MPU-9250 / 6500 IMU
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
                if failure_count >= MPU_FAILURE_LIMIT:
                    mpu = None
                    last_retry_ms = time.ticks_ms()
        elif time.ticks_diff(time.ticks_ms(), last_retry_ms) >= MPU_RETRY_MS:
            last_retry_ms = time.ticks_ms()
            i2c, mpu = initialize_mpu_bus()
            failure_count = 0

        # 6. Attach Encoder Telemetry to Output Packet
        packet["encoders"] = encoders.getAllSnapshot()

        # 7. Transmit JSON Line to Raspberry Pi (Clean high-speed telemetry)
        print(json.dumps(packet))

        # 9. Maintain update cycle rate
        elapsed_ms = time.ticks_diff(time.ticks_ms(), cycle_started)
        remaining_ms = UPDATE_PERIOD_MS - elapsed_ms
        if remaining_ms > 0:
            time.sleep_ms(remaining_ms)


if __name__ == "__main__":
    try:
        run()
    except KeyboardInterrupt:
        print("# Firmware stopped safely.")
