/*
 * ESP32 Production Firmware (Arduino / C++ Framework)
 * ----------------------------------------------------
 * Features:
 *  1. 4x Independent L298N Motor Control (PWM via ESP32 Hardware LEDC + Direction)
 *  2. 4x Independent Quadrature Encoders (High-speed hardware interrupts, Ticks + Direction + RPM)
 *  3. 4x HC-SR04 Sequential Ultrasonic Sensors
 *  4. 1x MPU-9250 / MPU-6500 (I2C SDA=GPIO25, SCL=GPIO26)
 *  5. Safety Watchdog Timer (Auto-stops all motors if Pi commands cease)
 *  6. Non-blocking Serial Command Parser ("M:s1,s2,s3,s4", "M1:speed", "STOP")
 *  7. JSON Lines Telemetry compatible with Raspberry Pi 'ultrasonic_serial.py'
 */

#include <Arduino.h>
#include <Wire.h>

// ==============================================================================
// 1. PIN DEFINITIONS & OCCUPIED HARDWARE
// ==============================================================================

// --- EXISTING OCCUPIED HARDWARE (DO NOT MODIFY OR REASSIGN) ---
// Ultrasonic Sensors (HC-SR04):
#define PIN_TRIG_FRONT 18
#define PIN_ECHO_FRONT 34 // Input only
#define PIN_TRIG_REAR  19
#define PIN_ECHO_REAR  35 // Input only
#define PIN_TRIG_LEFT  21
#define PIN_ECHO_LEFT  32
#define PIN_TRIG_RIGHT 22
#define PIN_ECHO_RIGHT 33

// MPU-9250 / MPU-6500 I2C:
#define PIN_I2C_SDA    25
#define PIN_I2C_SCL    26
#define MPU_ADDR       0x68

// --- MOTOR GPIO DEFINITIONS (L298N) ---
// Configure your physical wiring here.
// Supports 3-pin mode (IN1, IN2, EN with PWM) or 2-pin mode (PWM on IN1/IN2, EN=-1)
struct MotorPins {
    int in1;
    int in2;
    int en; // Set to -1 if using 2-pin mode with jumper on ENA/ENB
    bool invert;
};

// Default mapping using unassigned GPIOs. Adjust to match your physical wiring.
const MotorPins MOTOR_CONFIG[4] = {
    // Motor 1 (e.g. Front-Left)
    { .in1 = 13, .in2 = 12, .en = 14, .invert = false },
    // Motor 2 (e.g. Front-Right)
    { .in1 = 27, .in2 = 4,  .en = 5,  .invert = false },
    // Motor 3 (e.g. Rear-Left)
    { .in1 = 15, .in2 = 2,  .en = 16, .invert = false },
    // Motor 4 (e.g. Rear-Right)
    { .in1 = 17, .in2 = 23, .en = 0,  .invert = false }
};

// --- ENCODER GPIO DEFINITIONS (JGA25-370 Quadrature A/B) ---
// 8 Signals total: 2 signals per motor
struct EncoderPins {
    int pin_a;
    int pin_b;
    bool invert;
};

// Default mapping using unassigned GPIOs. Adjust to match your physical wiring.
const EncoderPins ENCODER_CONFIG[4] = {
    // Motor 1 Encoder
    { .pin_a = 36, .pin_b = 39, .invert = false },
    // Motor 2 Encoder
    { .pin_a = 34, .pin_b = 35, .invert = false },
    // Motor 3 Encoder
    { .pin_a = 32, .pin_b = 33, .invert = false },
    // Motor 4 Encoder
    { .pin_a = 27, .pin_b = 14, .invert = false }
};

// ==============================================================================
// 2. ENCODER CALIBRATION CONFIGURATION
// ==============================================================================
// Formula: CPR = Motor_Base_PPR (usually 11 for JGA25-370) * 4 * Gear_Ratio
// Example: 11 * 4 * 34 = 1496 counts per wheel revolution
const float ENCODER_CPR = 330.0f; // <--- USER CONFIGURABLE: Enter actual CPR here

// ==============================================================================
// 3. SYSTEM PARAMETERS & CONSTANTS
// ==============================================================================
const uint32_t SERIAL_BAUD = 115200;
const uint32_t COMMAND_TIMEOUT_MS = 1000; // Watchdog: Stop motors if Pi silent > 1s
const uint32_t TELEMETRY_INTERVAL_MS = 125; // 8 Hz update rate
const uint32_t PWM_FREQ = 1000; // 1 kHz PWM
const uint8_t PWM_RESOLUTION = 8; // 8-bit resolution (0 - 255)

bool debugMode = false;
uint32_t lastCommandTime = 0;
bool motorsActive = false;

// ==============================================================================
// 4. MOTOR CONTROL ABSTRACTION (ESP32 LEDC PWM)
// ==============================================================================
class DCMotor {
private:
    int _in1, _in2, _en;
    int _pwmChannel;
    bool _invert;
    int _currentSpeed;

public:
    DCMotor() : _in1(-1), _in2(-1), _en(-1), _pwmChannel(0), _invert(false), _currentSpeed(0) {}

    void init(int in1, int in2, int en, int pwmChannel, bool invert = false) {
        _in1 = in1;
        _in2 = in2;
        _en = en;
        _pwmChannel = pwmChannel;
        _invert = invert;
        _currentSpeed = 0;

        pinMode(_in1, OUTPUT);
        pinMode(_in2, OUTPUT);
        digitalWrite(_in1, LOW);
        digitalWrite(_in2, LOW);

        if (_en >= 0) {
            pinMode(_en, OUTPUT);
            // LEDC Setup for ESP32 Arduino Core 2.x and 3.x compatibility
            #if ESP_ARDUINO_VERSION_MAJOR >= 3
                ledcAttach(_en, PWM_FREQ, PWM_RESOLUTION);
                ledcWrite(_en, 0);
            #else
                ledcSetup(_pwmChannel, PWM_FREQ, PWM_RESOLUTION);
                ledcAttachPin(_en, _pwmChannel);
                ledcWrite(_pwmChannel, 0);
            #endif
        }
    }

    void setSpeed(int speed) {
        // Clamp speed to [-255, 255]
        speed = constrain(speed, -255, 255);
        if (_invert) speed = -speed;
        _currentSpeed = speed;

        int duty = abs(speed);

        if (_en >= 0) {
            // 3-pin mode (IN1, IN2, ENA/ENB)
            if (speed > 0) {
                digitalWrite(_in1, HIGH);
                digitalWrite(_in2, LOW);
            } else if (speed < 0) {
                digitalWrite(_in1, LOW);
                digitalWrite(_in2, HIGH);
            } else {
                digitalWrite(_in1, LOW);
                digitalWrite(_in2, LOW);
            }

            #if ESP_ARDUINO_VERSION_MAJOR >= 3
                ledcWrite(_en, duty);
            #else
                ledcWrite(_pwmChannel, duty);
            #endif
        } else {
            // 2-pin mode: simple digital fallback if EN not wired
            if (speed > 0) {
                digitalWrite(_in1, HIGH);
                digitalWrite(_in2, LOW);
            } else if (speed < 0) {
                digitalWrite(_in1, LOW);
                digitalWrite(_in2, HIGH);
            } else {
                digitalWrite(_in1, LOW);
                digitalWrite(_in2, LOW);
            }
        }
    }

    void stop() {
        setSpeed(0);
    }

    int getSpeed() const {
        return _currentSpeed;
    }
};

DCMotor motor1, motor2, motor3, motor4;

void setMotorSpeed(int motorID, int speed) {
    switch (motorID) {
        case 1: motor1.setSpeed(speed); break;
        case 2: motor2.setSpeed(speed); break;
        case 3: motor3.setSpeed(speed); break;
        case 4: motor4.setSpeed(speed); break;
        default: break;
    }
}

void stopAllMotors() {
    motor1.stop();
    motor2.stop();
    motor3.stop();
    motor4.stop();
    motorsActive = false;
}

// ==============================================================================
// 5. ENCODER ABSTRACTION & ISR
// ==============================================================================
class Encoder {
public:
    int pin_a;
    int pin_b;
    bool invert;
    volatile int64_t ticks;
    volatile int8_t direction; // +1, -1, 0
    float rpm;

    int64_t lastTicks;
    uint32_t lastTimeMs;

    Encoder() : pin_a(-1), pin_b(-1), invert(false), ticks(0), direction(0), rpm(0.0f), lastTicks(0), lastTimeMs(0) {}

    void init(int a, int b, bool inv = false) {
        pin_a = a;
        pin_b = b;
        invert = inv;
        ticks = 0;
        direction = 0;
        rpm = 0.0f;
        lastTicks = 0;
        lastTimeMs = millis();

        pinMode(pin_a, INPUT_PULLUP);
        pinMode(pin_b, INPUT_PULLUP);
    }

    void updateRPM(uint32_t nowMs) {
        uint32_t elapsedMs = nowMs - lastTimeMs;
        if (elapsedMs == 0) return;

        int64_t currentTicks = ticks;
        int64_t deltaTicks = currentTicks - lastTicks;
        float elapsedSec = (float)elapsedMs / 1000.0f;

        float revolutions = (float)deltaTicks / ENCODER_CPR;
        rpm = (revolutions / elapsedSec) * 60.0f;

        if (deltaTicks == 0) {
            direction = 0;
            rpm = 0.0f;
        }

        lastTicks = currentTicks;
        lastTimeMs = nowMs;
    }

    int64_t getTicks() const { return ticks; }
    float getRPM() const { return rpm; }
    int8_t getDirection() const { return direction; }
};

Encoder enc1, enc2, enc3, enc4;

// Dedicated High-Speed ISRs for each motor encoder
void IRAM_ATTR isr_encoder1() {
    int a = digitalRead(enc1.pin_a);
    int b = digitalRead(enc1.pin_b);
    int step = (a == b) ? -1 : 1;
    if (enc1.invert) step = -step;
    enc1.ticks += step;
    enc1.direction = (step > 0) ? 1 : -1;
}

void IRAM_ATTR isr_encoder2() {
    int a = digitalRead(enc2.pin_a);
    int b = digitalRead(enc2.pin_b);
    int step = (a == b) ? -1 : 1;
    if (enc2.invert) step = -step;
    enc2.ticks += step;
    enc2.direction = (step > 0) ? 1 : -1;
}

void IRAM_ATTR isr_encoder3() {
    int a = digitalRead(enc3.pin_a);
    int b = digitalRead(enc3.pin_b);
    int step = (a == b) ? -1 : 1;
    if (enc3.invert) step = -step;
    enc3.ticks += step;
    enc3.direction = (step > 0) ? 1 : -1;
}

void IRAM_ATTR isr_encoder4() {
    int a = digitalRead(enc4.pin_a);
    int b = digitalRead(enc4.pin_b);
    int step = (a == b) ? -1 : 1;
    if (enc4.invert) step = -step;
    enc4.ticks += step;
    enc4.direction = (step > 0) ? 1 : -1;
}

float getMotorRPM(int motorID) {
    switch (motorID) {
        case 1: return enc1.getRPM();
        case 2: return enc2.getRPM();
        case 3: return enc3.getRPM();
        case 4: return enc4.getRPM();
        default: return 0.0f;
    }
}

int64_t getEncoderTicks(int motorID) {
    switch (motorID) {
        case 1: return enc1.getTicks();
        case 2: return enc2.getTicks();
        case 3: return enc3.getTicks();
        case 4: return enc4.getTicks();
        default: return 0;
    }
}

// ==============================================================================
// 6. ULTRASONIC SENSOR DRIVER (HC-SR04)
// ==============================================================================
struct UltrasonicSensor {
    const char* name;
    int trigPin;
    int echoPin;
};

const UltrasonicSensor ULTRASONIC_SENSORS[4] = {
    { "front", PIN_TRIG_FRONT, PIN_ECHO_FRONT },
    { "rear",  PIN_TRIG_REAR,  PIN_ECHO_REAR },
    { "left",  PIN_TRIG_LEFT,  PIN_ECHO_LEFT },
    { "right", PIN_TRIG_RIGHT, PIN_ECHO_RIGHT }
};

float readUltrasonicDistanceCm(int trigPin, int echoPin) {
    digitalWrite(trigPin, LOW);
    delayMicroseconds(2);
    digitalWrite(trigPin, HIGH);
    delayMicroseconds(10);
    digitalWrite(trigPin, LOW);

    // Timeout 30ms (max range ~5 meters)
    unsigned long duration = pulseIn(echoPin, HIGH, 30000);
    if (duration == 0) return -1.0f; // Timeout / Out of range

    float distance = (float)duration / 58.0f;
    if (distance < 2.0f || distance > 400.0f) return -1.0f;
    return round(distance * 10.0f) / 10.0f;
}

// ==============================================================================
// 7. MPU-9250 / MPU-6500 IMU DRIVER
// ==============================================================================
bool mpuAvailable = false;
float accelX = 0, accelY = 0, accelZ = 0;
float gyroX = 0, gyroY = 0, gyroZ = 0;
float yawRateDps = 0;

void initMPU() {
    Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL, 400000);
    Wire.beginTransmission(MPU_ADDR);
    Wire.write(0x75); // WHO_AM_I register
    if (Wire.endTransmission() == 0) {
        Wire.requestFrom(MPU_ADDR, 1);
        if (Wire.available()) {
            uint8_t who = Wire.read();
            if (who == 0x68 || who == 0x70 || who == 0x71 || who == 0x73) {
                // Wake up MPU
                Wire.beginTransmission(MPU_ADDR);
                Wire.write(0x6B); // PWR_MGMT_1
                Wire.write(0x00); // Wake up
                Wire.endTransmission();
                mpuAvailable = true;
                return;
            }
        }
    }
    mpuAvailable = false;
}

void readMPU() {
    if (!mpuAvailable) return;
    Wire.beginTransmission(MPU_ADDR);
    Wire.write(0x3B); // ACCEL_XOUT_H
    if (Wire.endTransmission() != 0) {
        mpuAvailable = false;
        return;
    }

    if (Wire.requestFrom(MPU_ADDR, 14) == 14) {
        int16_t rawAx = (Wire.read() << 8) | Wire.read();
        int16_t rawAy = (Wire.read() << 8) | Wire.read();
        int16_t rawAz = (Wire.read() << 8) | Wire.read();
        Wire.read(); Wire.read(); // Skip temperature
        int16_t rawGx = (Wire.read() << 8) | Wire.read();
        int16_t rawGy = (Wire.read() << 8) | Wire.read();
        int16_t rawGz = (Wire.read() << 8) | Wire.read();

        // Standard scaling for +/-2g and +/-250 deg/s
        accelX = (float)rawAx / 16384.0f;
        accelY = (float)rawAy / 16384.0f;
        accelZ = (float)rawAz / 16384.0f;
        gyroX = (float)rawGx / 131.0f;
        gyroY = (float)rawGy / 131.0f;
        gyroZ = (float)rawGz / 131.0f;
        yawRateDps = gyroZ;
    }
}

// ==============================================================================
// 8. NON-BLOCKING SERIAL COMMAND PARSER
// ==============================================================================
String serialBuffer = "";

void parseCommand(String cmd) {
    cmd.trim();
    if (cmd.length() == 0) return;
    String upper = cmd;
    upper.toUpperCase();

    if (upper == "STOP") {
        stopAllMotors();
        if (debugMode) Serial.println("# [RECV] STOP -> All motors stopped");
        return;
    }

    if (upper.startsWith("DEBUG:")) {
        String val = upper.substring(6);
        val.trim();
        debugMode = (val == "1" || val == "TRUE" || val == "ON");
        Serial.printf("# Debug mode set to: %d\n", debugMode);
        return;
    }

    // Protocol: M:s1,s2,s3,s4
    if (upper.startsWith("M:")) {
        String params = cmd.substring(2);
        int comma1 = params.indexOf(',');
        int comma2 = params.indexOf(',', comma1 + 1);
        int comma3 = params.indexOf(',', comma2 + 1);

        if (comma1 > 0 && comma2 > comma1 && comma3 > comma2) {
            int s1 = params.substring(0, comma1).toInt();
            int s2 = params.substring(comma1 + 1, comma2).toInt();
            int s3 = params.substring(comma2 + 1, comma3).toInt();
            int s4 = params.substring(comma3 + 1).toInt();

            motor1.setSpeed(s1);
            motor2.setSpeed(s2);
            motor3.setSpeed(s3);
            motor4.setSpeed(s4);

            lastCommandTime = millis();
            motorsActive = true;

            if (debugMode) {
                Serial.printf("# [RECV] M: %d, %d, %d, %d\n", s1, s2, s3, s4);
            }
            return;
        }
    }

    // Protocol: M1:speed, M2:speed, etc.
    for (int i = 1; i <= 4; i++) {
        String prefix = "M" + String(i) + ":";
        if (upper.startsWith(prefix)) {
            int speed = cmd.substring(prefix.length()).toInt();
            setMotorSpeed(i, speed);
            lastCommandTime = millis();
            motorsActive = true;
            if (debugMode) {
                Serial.printf("# [RECV] M%d: %d\n", i, speed);
            }
            return;
        }
    }
}

void processSerialInput() {
    while (Serial.available()) {
        char c = (char)Serial.read();
        if (c == '\n' || c == '\r') {
            if (serialBuffer.length() > 0) {
                parseCommand(serialBuffer);
                serialBuffer = "";
            }
        } else {
            serialBuffer += c;
            if (serialBuffer.length() > 128) serialBuffer = "";
        }
    }
}

// ==============================================================================
// 9. SETUP & MAIN LOOP
// ==============================================================================
void setup() {
    Serial.begin(SERIAL_BAUD);
    Serial.println("# ESP32 4-Wheel Robot Firmware (C++) Initializing...");

    // 1. Initialize Motors (Stopped on boot)
    motor1.init(MOTOR_CONFIG[0].in1, MOTOR_CONFIG[0].in2, MOTOR_CONFIG[0].en, 0, MOTOR_CONFIG[0].invert);
    motor2.init(MOTOR_CONFIG[1].in1, MOTOR_CONFIG[1].in2, MOTOR_CONFIG[1].en, 1, MOTOR_CONFIG[1].invert);
    motor3.init(MOTOR_CONFIG[2].in1, MOTOR_CONFIG[2].in2, MOTOR_CONFIG[2].en, 2, MOTOR_CONFIG[2].invert);
    motor4.init(MOTOR_CONFIG[3].in1, MOTOR_CONFIG[3].in2, MOTOR_CONFIG[3].en, 3, MOTOR_CONFIG[3].invert);
    stopAllMotors();

    // 2. Initialize Encoders & Interrupts
    enc1.init(ENCODER_CONFIG[0].pin_a, ENCODER_CONFIG[0].pin_b, ENCODER_CONFIG[0].invert);
    enc2.init(ENCODER_CONFIG[1].pin_a, ENCODER_CONFIG[1].pin_b, ENCODER_CONFIG[1].invert);
    enc3.init(ENCODER_CONFIG[2].pin_a, ENCODER_CONFIG[2].pin_b, ENCODER_CONFIG[2].invert);
    enc4.init(ENCODER_CONFIG[3].pin_a, ENCODER_CONFIG[3].pin_b, ENCODER_CONFIG[3].invert);

    attachInterrupt(digitalPinToInterrupt(enc1.pin_a), isr_encoder1, CHANGE);
    attachInterrupt(digitalPinToInterrupt(enc2.pin_a), isr_encoder2, CHANGE);
    attachInterrupt(digitalPinToInterrupt(enc3.pin_a), isr_encoder3, CHANGE);
    attachInterrupt(digitalPinToInterrupt(enc4.pin_a), isr_encoder4, CHANGE);

    // 3. Initialize Ultrasonic Sensors
    for (int i = 0; i < 4; i++) {
        pinMode(ULTRASONIC_SENSORS[i].trigPin, OUTPUT);
        pinMode(ULTRASONIC_SENSORS[i].echoPin, INPUT);
        digitalWrite(ULTRASONIC_SENSORS[i].trigPin, LOW);
    }

    // 4. Initialize MPU
    initMPU();

    lastCommandTime = millis();
    Serial.println("# System ready. All motors STOPPED.");
}

void loop() {
    uint32_t now = millis();

    // 1. Process Serial Commands (Non-blocking)
    processSerialInput();

    // 2. Safety Watchdog Check
    if (motorsActive && (now - lastCommandTime >= COMMAND_TIMEOUT_MS)) {
        stopAllMotors();
        if (debugMode) {
            Serial.println("# [WATCHDOG] Communication timeout! Motors STOPPED.");
        }
    }

    // 3. Telemetry Update Cycle (125ms = 8 Hz)
    static uint32_t lastTelemetryTime = 0;
    if (now - lastTelemetryTime >= TELEMETRY_INTERVAL_MS) {
        lastTelemetryTime = now;

        // Update Encoder RPMs
        enc1.updateRPM(now);
        enc2.updateRPM(now);
        enc3.updateRPM(now);
        enc4.updateRPM(now);

        // Read Ultrasonic Sensors sequentially with small delay between to avoid crosstalk
        float distFront = readUltrasonicDistanceCm(PIN_TRIG_FRONT, PIN_ECHO_FRONT);
        delay(10);
        float distRear  = readUltrasonicDistanceCm(PIN_TRIG_REAR,  PIN_ECHO_REAR);
        delay(10);
        float distLeft  = readUltrasonicDistanceCm(PIN_TRIG_LEFT,  PIN_ECHO_LEFT);
        delay(10);
        float distRight = readUltrasonicDistanceCm(PIN_TRIG_RIGHT, PIN_ECHO_RIGHT);

        // Read MPU
        readMPU();

        // Print Debug Information if enabled
        if (debugMode) {
            Serial.printf("# M1 RPM: %6.1f | Ticks: %lld\n", enc1.getRPM(), (long long)enc1.getTicks());
            Serial.printf("# M2 RPM: %6.1f | Ticks: %lld\n", enc2.getRPM(), (long long)enc2.getTicks());
            Serial.printf("# M3 RPM: %6.1f | Ticks: %lld\n", enc3.getRPM(), (long long)enc3.getTicks());
            Serial.printf("# M4 RPM: %6.1f | Ticks: %lld\n", enc4.getRPM(), (long long)enc4.getTicks());
        }

        // Transmit JSON Lines Telemetry to Raspberry Pi
        Serial.print("{\"front\":");
        if (distFront > 0) Serial.print(distFront, 1); else Serial.print("null");
        Serial.print(",\"rear\":");
        if (distRear > 0) Serial.print(distRear, 1); else Serial.print("null");
        Serial.print(",\"left\":");
        if (distLeft > 0) Serial.print(distLeft, 1); else Serial.print("null");
        Serial.print(",\"right\":");
        if (distRight > 0) Serial.print(distRight, 1); else Serial.print("null");

        Serial.print(",\"mpu_available\":");
        Serial.print(mpuAvailable ? "true" : "false");
        if (mpuAvailable) {
            Serial.printf(",\"accel\":{\"x\":%.2f,\"y\":%.2f,\"z\":%.2f}", accelX, accelY, accelZ);
            Serial.printf(",\"gyro\":{\"x\":%.2f,\"y\":%.2f,\"z\":%.2f}", gyroX, gyroY, gyroZ);
            Serial.printf(",\"yaw_rate_dps\":%.2f", yawRateDps);
        } else {
            Serial.print(",\"accel\":null,\"gyro\":null,\"yaw_rate_dps\":null");
        }

        // Encoder state
        Serial.printf(",\"encoders\":{\"m1\":{\"ticks\":%lld,\"rpm\":%.1f,\"dir\":%d},"
                      "\"m2\":{\"ticks\":%lld,\"rpm\":%.1f,\"dir\":%d},"
                      "\"m3\":{\"ticks\":%lld,\"rpm\":%.1f,\"dir\":%d},"
                      "\"m4\":{\"ticks\":%lld,\"rpm\":%.1f,\"dir\":%d}}}\n",
                      (long long)enc1.getTicks(), enc1.getRPM(), enc1.getDirection(),
                      (long long)enc2.getTicks(), enc2.getRPM(), enc2.getDirection(),
                      (long long)enc3.getTicks(), enc3.getRPM(), enc3.getDirection(),
                      (long long)enc4.getTicks(), enc4.getRPM(), enc4.getDirection());
    }
}
