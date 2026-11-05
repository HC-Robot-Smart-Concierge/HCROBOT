# Quét map một lần và chạy Navigation bằng map tĩnh

HC-Robot có hai chế độ tách biệt. Không chạy đồng thời hai chế độ này:

- `MAPPING`: Slam Toolbox nhận `/scan` và cập nhật `/map`. Chỉ dùng khi đang quét bản đồ mới.
- `NAVIGATION`: `map_server` nạp file YAML/PGM đã lưu; AMCL định vị robot trên map. `/scan` chỉ dùng cho định vị, costmap tránh vật cản và hiển thị, không sửa map gốc.

## 1. Quét một bản đồ mới

Chạy file sau ở thư mục gốc:

```powershell
.\quet_map_mot_lan.bat
```

Mở trình duyệt tại:

```text
http://localhost:6080/vnc.html?autoconnect=true&resize=scale
```

Điều khiển robot chậm, tránh quay hoặc tăng tốc đột ngột, và đi khép kín một vòng để Slam Toolbox có thể loop-close. Khi map đạt yêu cầu, lưu đúng một lần:

```powershell
wsl -d Ubuntu-24.04 bash /mnt/d/do_an_fptu/HCROBOT/robot/ros2_configs/save_ros2_map.sh ten_map
```

Lệnh lưu tạo `robot/maps/ten_map.yaml` và `robot/maps/ten_map.pgm`, rồi khóa phiên mapping.

## 2. Chạy tự hành bằng map đã lưu

Đóng cửa sổ mapping, rồi chạy:

```powershell
.\chay_navigation_map_tinh.bat ten_map
```

Nếu không truyền tên map, chương trình dùng `phong_lam_viec`:

```powershell
.\chay_navigation_map_tinh.bat
```

Trong RViz:

1. Nếu robot không đứng đúng tại gốc lúc đã lưu map, chọn **2D Pose Estimate** một lần để đặt vị trí và hướng ban đầu.
2. Chọn **Nav2 Goal** để gửi đích.
3. Các điểm LaserScan màu xám có thể di chuyển theo cảm biến; các tường đen của map tĩnh không được vẽ lại.

## 3. Dấu hiệu stack đang chạy đúng

Trong `NAVIGATION`:

- `/map` chỉ có một publisher là `map_server`.
- Có node `amcl`, `controller_server`, `planner_server` và `bt_navigator`.
- Không có `async_slam_toolbox_node`.
- `/scan` có subscriber là AMCL và các obstacle layer của costmap.
- `/odom` được tính từ encoder và hỗ trợ bằng yaw-rate IMU; mặc định không tích phân từ `/cmd_vel`.

## 4. Thông số cần hiệu chuẩn trên robot thật

Odometry mặc định dùng bán kính bánh `0.033 m`, khoảng cách hai bên bánh `0.22 m` và encoder `330 CPR`. Có thể chỉnh lúc chạy bằng các biến:

```bash
HCROBOT_WHEEL_BASE=0.22
HCROBOT_ENCODER_CPR=330
```

Nếu chiều tick bên trái/phải bị đảo, tick không tăng, hoặc kích thước cơ khí khác thực tế, cần sửa/hiệu chuẩn trước khi đánh giá chất lượng SLAM và navigation.

## Tài liệu đối chiếu

- HiWonder ROS 2 Mapping & Navigation: <https://wiki.hiwonder.com/projects/ROSOrin/en/jetson-nano-version/docs/14_ROS2_Mapping_%26_Navigation_Course.html>
- Nav2: Mapping and Localization: <https://docs.nav2.org/rolling/configuration_and_development/first_time_robot_setup_guide/sensors/mapping_localization/>
- Nav2 AMCL: <https://docs.nav2.org/rolling/configuration_and_development/configuration_guide/others/configuring_amcl/>
- Nav2 Map Server: <https://docs.nav2.org/rolling/configuration_and_development/configuration_guide/core_servers/map_server/configuring_map_server/>
