# Raspberry Pi 5 + ESP32 + L298N + 4 HC-SR04 + MPU-9250/6500

## 1. Architecture

- Raspberry Pi 5 là controller chính: nhận lệnh lái, đọc khoảng cách JSON qua USB Serial, áp dụng fail-safe và điều khiển L298N.
- ESP32 đọc tuần tự bốn HC-SR04 và đọc MPU-9250/6500 qua I2C, sau đó gửi một JSON object trên mỗi dòng.
- ESP32 không điều khiển ENA/ENB hoặc motor. Raspberry Pi không đo pulse ECHO.

## 2. GPIO conflict check

| Controller | Chức năng | GPIO |
| --- | --- | --- |
| Raspberry Pi | L298N IN1, IN2, IN3, IN4 | BCM 17, 27, 22, 23 |
| ESP32 | FRONT TRIG/ECHO | 18 / 34 |
| ESP32 | REAR TRIG/ECHO | 19 / 35 |
| ESP32 | LEFT TRIG/ECHO | 21 / 32 |
| ESP32 | RIGHT TRIG/ECHO | 22 / 33 |
| ESP32 | MPU SDA / SCL | 25 / 26 |

Không có conflict: I2C MPU dùng GPIO25/26, tách khỏi GPIO21/22 đang trigger LEFT/RIGHT. GPIO22 của Pi và GPIO22 của ESP32 thuộc hai chip độc lập. GPIO34/35 ESP32 là input-only và chỉ được dùng cho ECHO. GPIO1/3 UART0 của ESP32 không bị sử dụng nên USB-UART/REPL vẫn hoạt động.

MPU dùng `VCC=3.3V`, GND chung, `AD0=GND` (địa chỉ `0x68`) và `NCS=3.3V` để giữ giao tiếp I2C. Không cấp 5V cho MPU.

Lưu ý điện áp có lý do kỹ thuật: divider 1kΩ phía trên và 2.2kΩ xuống GND cho điện áp danh định `5 × 2.2 / (1 + 2.2) = 3.44V`. Mức này cao hơn rail 3.3V danh định và có ít margin khi tính sai số điện trở/xung nhiễu. Wiring hiện tại không bị thay đổi trong code, nhưng phương án bền hơn là 1kΩ + 2kΩ (3.33V) hoặc 1.2kΩ + 2.2kΩ (3.24V), mỗi ECHO một divider riêng.

## 3. Flash MicroPython, không dùng Arduino IDE

Tải bản stable `ESP32_GENERIC` từ <https://micropython.org/download/ESP32_GENERIC/>. ESP32-D0WD-V3 / ESP-WROOM-32 dùng generic `.bin`, không dùng firmware C3/S3.

```bash
python3 -m pip install --user esptool mpremote
python3 -m serial.tools.list_ports

# Thay PORT và FIRMWARE.bin bằng giá trị thực tế
esptool --chip esp32 --port PORT erase_flash
esptool --chip esp32 --port PORT --baud 460800 write_flash 0x1000 FIRMWARE.bin
```

Nếu flash lỗi ở 460800, bỏ `--baud 460800`; nếu board không tự vào bootloader, giữ nút BOOT trong lúc bắt đầu lệnh.

Upload ba module cảm biến:

```bash
cd ~/HCROBOT/robot
mpremote connect PORT fs cp esp32/mpu.py :mpu.py
mpremote connect PORT fs cp esp32/ultrasonic.py :ultrasonic.py
```

Sau khi test xong, cài tự chạy:

```bash
mpremote connect PORT fs cp esp32/main.py :main.py
mpremote connect PORT reset
```

Đóng `mpremote`/REPL trước khi Raspberry Pi mở cùng cổng Serial.

## 4. ESP32 MicroPython

Firmware mới gồm [`esp32/main.py`](esp32/main.py), [`esp32/mpu.py`](esp32/mpu.py) và [`esp32/ultrasonic.py`](esp32/ultrasonic.py). File `esp32_ultrasonic.py` được giữ làm firmware ultrasonic-only cũ. Các đặc điểm:

- Dùng `machine.Pin` và `machine.time_pulse_us` với timeout 30ms.
- Đọc FRONT → REAR → LEFT → RIGHT, nghỉ 18ms giữa sensor để giảm cross-talk.
- Median trượt ba mẫu hợp lệ gần nhất.
- Timeout/out-of-range xuất `null`; loop tiếp tục chạy.
- I2C dùng SDA=25, SCL=26; tự dò MPU tại `0x68/0x69` và đọc `WHO_AM_I`.
- MPU cấu hình accel ±4g, gyro ±500dps, hiệu chuẩn gyro lúc startup và xuất yaw rate từ trục Z robot.
- MPU mất kết nối không làm dừng ultrasonic; các trường MPU chuyển thành `null`.
- Xuất JSON Lines khoảng 5–8 packet hoàn chỉnh/giây.

## 5. Raspberry Pi Serial reader

Code đầy đủ ở [`ultrasonic_serial.py`](ultrasonic_serial.py). Reader chạy nền, tự tìm Espressif/CP210x/CH340/FTDI hoặc `/dev/ttyUSB*`, `/dev/ttyACM*`, tự reconnect và bỏ packet lỗi mà không crash.

Packet hợp lệ:

```json
{"front":42.3,"rear":105.1,"left":31.8,"right":78.4,"mpu_available":true,"accel":{"x":0.01,"y":-0.02,"z":0.99},"gyro":{"x":0.3,"y":-0.1,"z":12.4},"yaw_rate_dps":12.4}
```

`ultrasonic_serial.py` vẫn giữ API khoảng cách cũ cho obstacle safety, đồng thời expose `snapshot.accel`, `snapshot.gyro`, `snapshot.yaw_rate_dps` và `snapshot.mpu_available` cho ROS 2 sau này.

## 6. L298N motor controller

Code đầy đủ ở [`motor_controller.py`](motor_controller.py). Mapping cố định mặc định:

- Trái/channel A: GPIO17→IN1, GPIO27→IN2.
- Phải/channel B: GPIO22→IN3, GPIO23→IN4.
- `forward()`, `backward()`, `turn_left()`, `turn_right()`, `stop()` chỉ ghi digital direction. Không PWM vì ENA/ENB vẫn có jumper.
- Xoay trái dùng trái lùi/phải tiến; xoay phải dùng trái tiến/phải lùi.
- Robot hiện tại có cả hai phía motor ngược với đầu được đánh dấu FRONT, nên `invert_left_direction` và `invert_right_direction` trong `settings.yaml` được bật. W đi về FRONT, S đi về REAR; fail-safe vẫn kiểm tra đúng sensor theo hướng thực tế.

Nếu thay đổi cách lắp motor, có thể bật/tắt hai tùy chọn đảo chiều độc lập cho từng bên; không đổi GPIO sensor.

## 7. Main + obstacle safety

Code tích hợp đầy đủ ở [`main.py`](main.py), logic fail-safe ở [`obstacle_safety.py`](obstacle_safety.py).

- Forward kiểm tra FRONT; backward kiểm tra REAR. Khi quay, code kiểm tra cảm biến bên quay và cả FRONT/REAR vì đầu và đuôi xe quét theo vòng cung.
- Ngưỡng mặc định đã bù quán tính: FRONT/REAR 65cm, LEFT/RIGHT 25cm; khoảng trống FRONT/REAR khi quay là 25cm.
- Cho phép giữ số đo hợp lệ gần nhất qua đúng một packet `null`, tối đa 0.2s. Hai packet `null` liên tiếp, packet quá 0.4s hoặc khoảng cách chạm ngưỡng đều dừng motor.
- Sau một lần bị safety chặn, hướng đó chỉ mở khóa khi có ba packet hợp lệ liên tiếp cao hơn ngưỡng dừng 10cm. Robot không tự chạy lại; người điều khiển phải bấm lệnh mới.
- Trong lúc motor đang chạy, safety được kiểm tra liên tục, không chỉ lúc bấm phím.
- `--motor-only` là chế độ test chủ động bỏ qua sensor và có cảnh báo rõ ràng.

Ngưỡng nằm trong [`settings.yaml`](settings.yaml) và có thể override bằng CLI.

## 8. Package trên Raspberry Pi

```bash
sudo apt update
sudo apt install -y python3-pip python3-venv python3-lgpio python3-gpiozero python3-serial python3-yaml gpiod

cd ~/HCROBOT/robot
python3 -m venv --system-site-packages .venv
source .venv/bin/activate
python3 -m pip install -r requirements.txt

bash scripts/setup_gpio_permissions.sh
sudo usermod -aG dialout "$USER"
sudo reboot
```

`gpio` cho `/dev/gpiochip*`; `dialout` cho `/dev/ttyUSB*`/`ttyACM*`.

## 9. Lệnh chạy

```bash
cd ~/HCROBOT/robot
source .venv/bin/activate

# Auto-detect ESP32
python3 main.py

# Hoặc ép cổng/ngưỡng
python3 main.py --port /dev/ttyUSB0 --front-stop 65 --rear-stop 65 \
  --left-stop 25 --right-stop 25 --sensor-timeout 0.4

# Xem toàn bộ packet debug
python3 main.py --debug

# Tự chạy tiến hoặc lùi và dừng hẳn khi gặp vật cản
python3 main.py --port /dev/ttyUSB0 --auto-drive forward
python3 main.py --port /dev/ttyUSB0 --auto-drive backward
```

## 10. Test theo từng stage

### a. I2C scan và WHO_AM_I

```bash
mpremote connect PORT exec "from machine import Pin,I2C; i=I2C(0,sda=Pin(25),scl=Pin(26),freq=400000); print([hex(a) for a in i.scan()])"
mpremote connect PORT exec "from machine import Pin,I2C; i=I2C(0,sda=Pin(25),scl=Pin(26),freq=400000); print('WHO_AM_I=',hex(i.readfrom_mem(0x68,0x75,1)[0]))"
```

Scan phải có `0x68` (AD0 nối GND). WHO_AM_I thường là `0x70` với MPU-6500, `0x71` với MPU-9250, `0x73` với MPU-9255; một số board tương thích báo `0x68`.

### b. Accel, gyro và yaw rate

Sau khi copy `mpu.py`, đặt robot nằm phẳng và đứng yên trong lúc calibration:

```bash
mpremote connect PORT exec "from machine import Pin,I2C; from mpu import detect_mpu; i=I2C(0,sda=Pin(25),scl=Pin(26),freq=400000); m=detect_mpu(i); print(m.device_name,hex(m.who_am_i)); m.calibrate_gyro(300,5); print(m.read_all())"
```

Khi nằm phẳng, accel Z gần `+1g` hoặc `-1g`, X/Y gần `0g`; gyro gần `0dps` sau calibration. Xoay robot trái/phải để kiểm tra `yaw_rate_dps` thay đổi rõ. Nếu trục không đúng quy ước X=right, Y=forward, Z=up, chỉ sửa `ROBOT_AXIS_MAP` trong `esp32/mpu.py`.

### c. Từng ultrasonic

Chưa copy firmware thành `main.py`. Test lần lượt và đưa vật phẳng trước từng sensor:

```bash
mpremote connect PORT exec "import ultrasonic as u; u.test_sensor('front',18,34)"
mpremote connect PORT exec "import ultrasonic as u; u.test_sensor('rear',19,35)"
mpremote connect PORT exec "import ultrasonic as u; u.test_sensor('left',21,32)"
mpremote connect PORT exec "import ultrasonic as u; u.test_sensor('right',22,33)"
```

### d. Cả bốn ultrasonic

```bash
mpremote connect PORT exec "import ultrasonic as u; u.test_all(30)"
```

Phải thấy 30 JSON lines; từng sensor lỗi là `null`, loop không dừng.

### e. Combined + USB Serial ESP32 → Pi

Sau khi copy firmware thành `main.py` và reset ESP32:

```bash
python3 -m serial.tools.list_ports -v
python3 ultrasonic_serial.py --port auto --debug
```

### f. Motor không sensor

Kê bốn bánh khỏi mặt đất, tháo tải nguy hiểm và chuẩn bị nhấn Space/X:

```bash
python3 main.py --motor-only
```

Xác nhận W/S/A/D đúng chiều. Nếu sai một bên, ngắt nguồn motor trước khi đảo hai dây OUT của bên đó.

Chạy ngay một hướng, không cần bấm WASD và không mở ESP32 Serial:

```bash
# Tự dừng sau 10 giây
python3 main.py --drive-test forward

# Chạy liên tục cho tới khi nhấn Ctrl+C
python3 main.py --drive-test forward --drive-test-seconds 0
```

`--drive-test` bỏ qua toàn bộ obstacle safety, vì vậy chỉ dùng khi đã kê bánh khỏi mặt đất.

### g. Tự chạy tiến/lùi tới vật cản

Chế độ này không cần bấm W/S. Robot đếm ngược ba giây rồi chạy theo hướng đã chọn.
`forward` dùng FRONT và `backward` dùng REAR; cả hai dừng mặc định ở 65cm.
Sensor lỗi hoặc mất Serial cũng làm robot dừng. Robot không tự chạy lại.

```bash
python3 main.py --port /dev/ttyUSB0 --auto-drive forward
python3 main.py --port /dev/ttyUSB0 --auto-drive backward
```

### h. Sensor tự stop motor

Test logic với motor giả trước:

```bash
python3 main.py --mock --port auto --debug
```

Sau đó test motor thật khi bánh vẫn được kê:

```bash
python3 main.py --port auto --debug
```

Bấm W rồi đưa vật vào FRONT tới 65cm: phải có `SAFETY STOP FORWARD`. Lặp với S/REAR cũng ở 65cm và A/D ở 25cm. Khi đang chạy, rút USB ESP32: motor phải dừng sau tối đa khoảng 0.4s cộng thời gian một vòng kiểm tra.

## 11. Logging/debug

- `DIST cm`: snapshot khoảng cách mới nhất.
- `IMU`: accel theo đơn vị g, gyro/yaw rate theo deg/s trong robot frame.
- `SAFETY ALLOW`: hướng được phép chạy.
- `SAFETY BLOCK`: lệnh bị chặn trước khi motor chạy.
- `SAFETY STOP`: motor đang chạy bị dừng do vật cản, `null`, packet stale hoặc mất Serial.
- `Bỏ qua Serial packet lỗi`: dòng không phải JSON bị bỏ qua.
- `Mất kết nối ESP32 ... sẽ thử lại`: reader tự reconnect, motor giữ trạng thái fail-safe STOP.

## 12. Lỗi MPU thường gặp

- I2C scan trả `[]`: kiểm tra VCC=3.3V, GND chung, SDA=GPIO25, SCL=GPIO26 và pull-up trên breakout.
- Scan ra `0x69` thay vì `0x68`: AD0 đang HIGH; driver vẫn tự nhận `0x69`.
- Có `0x68` nhưng WHO_AM_I không được hỗ trợ: xem log `MPU probe failed`; kiểm tra đúng module hoặc chip clone.
- Gyro không gần 0 khi đứng yên: reset ESP32 và giữ robot hoàn toàn đứng yên khoảng hai giây lúc hiện `Keep robot still`.
- Xoay trái/phải nhưng `gyro.z` không đổi đúng: chỉnh duy nhất `ROBOT_AXIS_MAP` trong `esp32/mpu.py` theo chiều in trên breakout.
- MPU tạm mất I2C: packet chuyển `mpu_available=false`; ultrasonic vẫn chạy và firmware thử kết nối MPU lại sau 5 giây.
- `device or resource busy` trên Pi: dừng `mpremote` trước khi chạy `ultrasonic_serial.py` hoặc `main.py`.
