"""ESP32 MicroPython L298N Motor Control Abstraction for 4 independent DC motors.

Supports both 3-pin mode (IN1, IN2 + ENA/ENB hardware PWM) and
2-pin mode (PWM directly on IN1/IN2 with jumper on ENA/ENB).
"""

from machine import Pin, PWM


class DCMotor:
    """Controls a single DC motor via L298N H-Bridge with hardware PWM."""

    def __init__(self, in1_pin: int, in2_pin: int, en_pin: int = None, pwm_freq: int = 1000, invert: bool = False):
        self.in1 = Pin(in1_pin, Pin.OUT, value=0)
        self.in2 = Pin(in2_pin, Pin.OUT, value=0)
        self.en_pin_num = en_pin
        self.pwm_freq = pwm_freq
        self.invert = bool(invert)
        self.current_speed = 0

        if en_pin is not None:
            # 3-pin mode: ENA/ENB receives hardware PWM, IN1/IN2 set direction
            self.pwm = PWM(Pin(en_pin), freq=pwm_freq, duty_u16=0)
            self._mode = "3pin"
        else:
            # 2-pin mode: PWM created dynamically on active directional pin
            self.pwm_in1 = PWM(self.in1, freq=pwm_freq, duty_u16=0)
            self.pwm_in2 = PWM(self.in2, freq=pwm_freq, duty_u16=0)
            self._mode = "2pin"

    def setSpeed(self, speed: int):
        """Set motor speed from -255 (full reverse) to +255 (full forward). 0 = Stop."""
        # Clamp to valid range [-255, 255]
        speed = max(-255, min(255, int(speed)))

        if self.invert:
            speed = -speed

        self.current_speed = speed
        abs_speed = abs(speed)
        # Convert 0-255 scale to 16-bit PWM duty cycle (0 - 65535)
        duty = int((abs_speed / 255.0) * 65535)

        if self._mode == "3pin":
            if speed > 0:
                self.in1.value(1)
                self.in2.value(0)
                self.pwm.duty_u16(duty)
            elif speed < 0:
                self.in1.value(0)
                self.in2.value(1)
                self.pwm.duty_u16(duty)
            else:
                self.in1.value(0)
                self.in2.value(0)
                self.pwm.duty_u16(0)
        else:
            # 2-pin mode
            if speed > 0:
                self.pwm_in2.duty_u16(0)
                self.pwm_in1.duty_u16(duty)
            elif speed < 0:
                self.pwm_in1.duty_u16(0)
                self.pwm_in2.duty_u16(duty)
            else:
                self.pwm_in1.duty_u16(0)
                self.pwm_in2.duty_u16(0)

    def stop(self):
        """Stop motor immediately."""
        self.setSpeed(0)

    @property
    def speed(self) -> int:
        return self.current_speed


class FourWheelDrive:
    """Abstraction for 4 independently controlled motors (M1, M2, M3, M4)."""

    def __init__(self, m1: DCMotor, m2: DCMotor, m3: DCMotor, m4: DCMotor):
        self.motors = {
            1: m1,
            2: m2,
            3: m3,
            4: m4,
        }
        self.motor1 = m1
        self.motor2 = m2
        self.motor3 = m3
        self.motor4 = m4
        self.stopAll()

    def setMotorSpeed(self, motor_id: int, speed: int):
        """Set speed for a specific motor (1, 2, 3, or 4)."""
        if motor_id in self.motors:
            self.motors[motor_id].setSpeed(speed)

    def setAllSpeeds(self, s1: int, s2: int, s3: int, s4: int):
        """Set speeds for all 4 motors simultaneously."""
        self.motor1.setSpeed(s1)
        self.motor2.setSpeed(s2)
        self.motor3.setSpeed(s3)
        self.motor4.setSpeed(s4)

    def stopAll(self):
        """Emergency / safety stop for all 4 motors."""
        for m in self.motors.values():
            m.stop()

    def getMotorSpeed(self, motor_id: int) -> int:
        motor = self.motors.get(motor_id)
        return motor.speed if motor else 0
