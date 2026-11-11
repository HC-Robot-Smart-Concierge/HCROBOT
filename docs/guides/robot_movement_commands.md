# BẢNG TRA CỨU LỆNH ĐIỀU KHIỂN DI CHUYỂN, QUÉT MAP VÀ TỰ HÀNH (HC-ROBOT)

> **Tài liệu liên quan:**
> - Kiến trúc hệ thống: [[../02-Architecture|Tổng Quan Kiến Trúc Hệ Thống (02-Architecture.md)]]
> - Bản đồ mã nguồn: [[../01-File-Map|Bản Đồ Kiểm Kê Mã Nguồn (01-File-Map.md)]]
> - Đặc tả phần cứng & ROS 2: [[hardware_architecture|Đặc Tả Phần Cứng & ROS 2 Edge]]
> - Điều hướng bản đồ tĩnh: [[static-map-navigation|Hướng Dẫn Điều Hướng Bản Đồ Tĩnh]]

---

## 1. BẢNG ĐỐI CHIẾU NÚT FRONTEND VÀ LỆNH TERMINAL TƯƠNG ĐƯƠNG

Tất cả các lệnh bên dưới được thực thi từ PowerShell tại thư mục gốc của dự án (`F:\DoAn\HC-Robot`).

| Nút trên Frontend (Menu COMMANDS) | Hành vi kỹ thuật Frontend / Backend | Lệnh Terminal tương đương |
| :--- | :--- | :--- |
| **1. Start Mapping** | Bật SLAM Toolbox, Foxglove Bridge (:8765), Rosbridge (:9090) và kết nối LiDAR Pi 5 | `wsl -d Ubuntu-24.04 bash robot/ros2_configs/start_wsl_slam.sh` |
| **Mở Foxglove** | Mở Web Viewer kết nối vào Foxglove Bridge cổng 8765 | `Start-Process "https://app.foxglove.dev/~/view?ds=foxglove-websocket&ds.url=ws%3A%2F%2F127.0.0.1%3A8765"` |
| **Scan Entire Room (SLAM)** | Xe tự động chạy tìm đường biên (Frontier Exploration + Nav2) để phủ kín phòng | `wsl -d Ubuntu-24.04 env EXPLORE=1 EXPLORE_SAVE=ten_map PI5_IP=100.99.72.51 bash robot/ros2_configs/start_wsl_slam.sh` |
| **Stop Exploration** | Dừng xe tự hành quét phòng (giữ nguyên SLAM để lưu map) | `wsl -d Ubuntu-24.04 -- bash -lc "pkill -f 'frontier_explorer.py'; pkill -f 'navigation_launch.py'; true"` |
| **Lock Base Map** | Khóa bản đồ cơ sở, ngừng cập nhật điểm laser mới | `wsl -d Ubuntu-24.04 bash robot/ros2_configs/save_ros2_map.sh <ten_map> --pause-only` |
| **2. Save, Lock & Navigate** | Lưu map thành file `.yaml`, `.pgm`, khóa mapping và chuyển sang Navigation | `wsl -d Ubuntu-24.04 bash robot/ros2_configs/save_ros2_map.sh <ten_map>` |
| **3. Start Navigation** | Nạp bản đồ tĩnh đã lưu, chạy AMCL định vị và Nav2 tự hành | `wsl -d Ubuntu-24.04 bash robot/ros2_configs/start_wsl_navigation.sh <ten_map>` |
| **Reset Map** | Xóa sạch lưới SLAM đang quét dở và đặt lại vị trí robot về gốc `(0, 0)` | `wsl -d Ubuntu-24.04 -- bash -lc "source /opt/ros/jazzy/setup.bash && ros2 service call /slam_toolbox/reset slam_toolbox/srv/Reset {}"` |
| **Reconnect** | Kết nối lại cổng Rosbridge WebSocket 9090 | `wsl -d Ubuntu-24.04 ss -tulpn \| findstr 9090` |
| **E-STOP (Dừng Khẩn Cấp)** | Gửi gói tin ngắt motor khẩn cấp tức thì tới Pi 5 | `python -c "import socket; s=socket.socket(socket.AF_INET, socket.SOCK_DGRAM); s.sendto(b'stop', ('100.99.72.51', 9999))"` |

---

## 2. CHI TIẾT CÁC NHÓM LỆNH THAO TÁC

### 2.1. Nhóm Quét Bản Đồ (Mapping / SLAM)

#### Lệnh 1: Bật chế độ quét bản đồ thủ công (lái tay để quét)
```powershell
wsl -d Ubuntu-24.04 bash robot/ros2_configs/start_wsl_slam.sh
```
- **Tiến trình khởi chạy:** `robot_state_publisher`, `rosbridge_websocket` (:9090), `foxglove_bridge` (:8765), `lidar_ws_to_ros2.py`, `slam_toolbox` (online_async).
- **Trạng thái sẵn sàng:** Khi terminal xuất hiện dòng chữ `HE THONG SLAM DANG HOAT DONG TREN LAPTOP WSL2!`.

#### Lệnh 2: Bật chế độ xe tự hành khám phá và quét toàn bộ phòng (Frontier Exploration)
```powershell
wsl -d Ubuntu-24.04 env EXPLORE=1 EXPLORE_SAVE=phong_khach PI5_IP=100.99.72.51 bash robot/ros2_configs/start_wsl_slam.sh
```
- Robot đếm ngược 10 giây sau khi kiểm tra đủ cảm biến, sau đó tự tính toán đường biên chưa quét (frontiers) và tự lái xe đi vẽ bản đồ.
- Khi hoàn tất, hệ thống tự động lưu file `phong_khach.yaml` và `phong_khach.pgm`.

#### Lệnh 3: Xóa sạch dữ liệu SLAM để quét lại từ đầu
```powershell
wsl -d Ubuntu-24.04 -- bash -lc "source /opt/ros/jazzy/setup.bash && ros2 service call /slam_toolbox/reset slam_toolbox/srv/Reset {}"
```

---

### 2.2. Nhóm Lưu Và Quản Lý Bản Đồ (Map Management)

#### Lệnh 4: Lưu bản đồ và chuyển sang chế độ Navigation
```powershell
wsl -d Ubuntu-24.04 bash robot/ros2_configs/save_ros2_map.sh ten_map_moi
```
- Kết quả lưu vào thư mục `robot/maps/`:
  - `ten_map_moi.yaml`: Thông số độ phân giải (resolution), gốc tọa độ (origin), ngưỡng chiếm chỗ (occupied_thresh).
  - `ten_map_moi.pgm`: Ảnh nhị phân chứa vật cản (đen), vùng trống (trắng) và vùng chưa biết (xám).
  - `ten_map_moi.json`: Thông tin mở rộng cho Web Studio (kích thước pixel, metadata).

#### Lệnh 5: Lưu bản đồ tạm thời mà không thoát chế độ quét
```powershell
wsl -d Ubuntu-24.04 bash robot/ros2_configs/save_ros2_map.sh ten_map_moi --no-pause
```

---

### 2.3. Nhóm Điều Hướng Tự Hành (Autonomous Navigation)

#### Lệnh 6: Khởi động tự hành với bản đồ tĩnh
```powershell
wsl -d Ubuntu-24.04 bash robot/ros2_configs/start_wsl_navigation.sh phong_lam_viec
```
- **Tiến trình khởi chạy:** `map_server` (nạp file map), `amcl` (bộ lọc hạt định vị Adaptive Monte Carlo Localization), `nav2_planner`, `nav2_controller`, `bt_navigator` (Behavior Trees).
- **Lưu ý:** Chế độ này không chỉnh sửa bản đồ gốc, tia LaserScan chỉ dùng để xác định vị trí và tránh vật cản động.

#### Lệnh 7: Đặt vị trí khởi đầu cho Robot (2D Pose Estimate)
Khi robot không đứng đúng tọa độ ban đầu `(0, 0)`, phát topic `/initialpose` để AMCL hội tụ chùm hạt:
```powershell
wsl -d Ubuntu-24.04 -- bash -lc "source /opt/ros/jazzy/setup.bash && ros2 topic pub --once /initialpose geometry_msgs/msg/PoseWithCovarianceStamped '{header: {frame_id: \"map\"}, pose: {pose: {position: {x: 0.0, y: 0.0, z: 0.0}, orientation: {z: 0.0, w: 1.0}}}}'"
```

#### Lệnh 8: Gửi điểm đích cho Robot tự hành tới (Nav2 Goal Pose)
```powershell
wsl -d Ubuntu-24.04 -- bash -lc "source /opt/ros/jazzy/setup.bash && ros2 topic pub --once /goal_pose geometry_msgs/msg/PoseStamped '{header: {frame_id: \"map\"}, pose: {position: {x: 1.5, y: 2.0, z: 0.0}, orientation: {z: 0.0, w: 1.0}}}'"
```

---

### 2.4. Nhóm Điều Khiển Lái Xe Bằng Tay (Manual Teleoperation)

#### Lệnh 9: Lái xe bằng bàn phím WASD trong WSL2
```powershell
wsl -d Ubuntu-24.04 -- bash -lc "source /opt/ros/jazzy/setup.bash && python3 robot/ros2_configs/wasd_teleop.py"
```
- Phím điều khiển: `W` (tiến), `S` (lùi), `A` (quay trái tại chỗ), `D` (quay phải tại chỗ), `Space` (dừng).

#### Lệnh 10: Gửi trực tiếp lệnh vận tốc qua ROS 2 topic `/cmd_vel`
- **Tiến thẳng với vận tốc 0.1 m/s:**
```powershell
wsl -d Ubuntu-24.04 -- bash -lc "source /opt/ros/jazzy/setup.bash && ros2 topic pub --rate 10 /cmd_vel geometry_msgs/msg/Twist '{linear: {x: 0.1, y: 0.0, z: 0.0}, angular: {x: 0.0, y: 0.0, z: 0.0}}'"
```
- **Quay trái tại chỗ với tốc độ 0.3 rad/s:**
```powershell
wsl -d Ubuntu-24.04 -- bash -lc "source /opt/ros/jazzy/setup.bash && ros2 topic pub --rate 10 /cmd_vel geometry_msgs/msg/Twist '{linear: {x: 0.0, y: 0.0, z: 0.0}, angular: {x: 0.0, y: 0.0, z: 0.3}}'"
```

#### Lệnh 11: Lái xe cấp thấp bằng giao thức UDP Socket (Bỏ qua ROS 2)
Gửi thẳng gói tin text tới `main.py` trên Raspberry Pi 5 (cổng 9999):
- Tiến: `python -c "import socket; s=socket.socket(socket.AF_INET, socket.SOCK_DGRAM); s.sendto(b'drive:30:30', ('100.99.72.51', 9999))"`
- Lùi: `python -c "import socket; s=socket.socket(socket.AF_INET, socket.SOCK_DGRAM); s.sendto(b'drive:-30:-30', ('100.99.72.51', 9999))"`
- Dừng: `python -c "import socket; s=socket.socket(socket.AF_INET, socket.SOCK_DGRAM); s.sendto(b'stop', ('100.99.72.51', 9999))"`

---

### 2.5. Nhóm An Toàn, Vùng Cấm & Giám Sát

#### Lệnh 12: Dừng khẩn cấp toàn hệ thống (E-STOP)
Gửi liên tiếp tín hiệu dừng tới cổng UDP của Pi 5:
```powershell
python -c "import socket, time; s=socket.socket(socket.AF_INET, socket.SOCK_DGRAM); [s.sendto(b'stop', ('100.99.72.51', 9999)) or time.sleep(0.05) for _ in range(5)]"
```

#### Lệnh 13: Cập nhật vùng cấm (Keepout Zones) từ CSDL lên Nav2 Costmap
```powershell
curl -X POST http://localhost:8000/api/v1/map/ros2/keepout_mask/phong_lam_viec
```

#### Lệnh 14: Kiểm tra tần số xuất bản dữ liệu LiDAR
```powershell
wsl -d Ubuntu-24.04 -- bash -lc "source /opt/ros/jazzy/setup.bash && ros2 topic hz /scan"
```
- Tần số tiêu chuẩn: 6.5 Hz - 8.0 Hz.

---

## 3. CÁC THAM SỐ CẤU HÌNH ĐIỀU KHIỂN QUAN TRỌNG

| Biến môi trường / Tham số | Giá trị mặc định | Vị trí cấu hình | Ý nghĩa kỹ thuật |
| :--- | :--- | :--- | :--- |
| `HCROBOT_TELEOP_PWM` | `30` | `start_wsl_slam.sh` | PWM công suất động cơ khi chạy thẳng (chống trượt bánh) |
| `HCROBOT_TELEOP_TURN_PWM` | `38` | `start_wsl_slam.sh` | PWM công suất khi xoay tại chỗ |
| `HCROBOT_TURN_PULSE_ON_SEC` | `0.20` | `start_wsl_slam.sh` | Thời gian phát xung xoay (0.2 giây) |
| `HCROBOT_TURN_PULSE_OFF_SEC` | `0.50` | `start_wsl_slam.sh` | Thời gian nghỉ giữa các xung xoay (0.5 giây) giúp LiDAR không bị mờ quét |
| `HCROBOT_SCAN_MAX_TURN_DPS` | `15` | `start_wsl_slam.sh` | Giới hạn tốc độ quay tối đa (15 độ/giây) |
| `UDP_WATCHDOG_TIMEOUT` | `0.5` | `robot/main.py` | Ngắt động cơ tự động sau 500ms nếu mất tín hiệu truyền thông |
| `ULTRASONIC_BRAKE_DIST` | `0.35` | `robot/main.py` | Khoảng cách phanh an toàn vật lý từ 4 cảm biến siêu âm (mét) |
