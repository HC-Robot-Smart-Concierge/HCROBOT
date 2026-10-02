# HƯỚNG DẪN VẬN HÀNH HỆ THỐNG ROS 2 PHÂN TÁN (PI 5 & LAPTOP)

Hệ thống phân tán gồm 3 thành phần liên kết qua **Tailscale VPN** bằng **CycloneDDS Unicast**:
- **Raspberry Pi 5 (`100.99.72.51`):** Chạy RPLiDAR A1M8, phát TF `base_link -> laser`, nhận `/cmd_vel` điều khiển Motor.
- **Laptop WSL2 (`100.92.82.61`):** Chạy SLAM Toolbox, Nav2, Explore_lite, và Rosbridge WebSocket port `9090`.
- **Web Frontend (`React`):** Kết nối tới `ws://100.92.82.61:9090` để hiển thị `/map` và điều khiển xe.

---

## 1. Cấu hình trên Raspberry Pi 5 (`100.99.72.51`)

1. SSH vào Pi 5:
   ```bash
   ssh phuc@100.99.72.51
   ```
2. Chạy script cài đặt tự động:
   ```bash
   cd ~/HCROBOT/robot/ros2_configs
   chmod +x setup_pi_ros2.sh
   ./setup_pi_ros2.sh
   source ~/.bashrc
   ```
3. Bật luồng LiDAR & TF trên Pi 5:
   ```bash
   ./launch_rplidar_tf.sh
   ```

---

## 2. Cấu hình trên Laptop WSL2 (`Ubuntu 24.04`)

1. Mở terminal Ubuntu WSL trên Laptop:
   ```bash
   cd /mnt/f/DoAn/HC-Robot/robot/ros2_configs
   chmod +x setup_laptop_ros2.sh
   ./setup_laptop_ros2.sh
   source ~/.bashrc
   ```
2. Khởi chạy toàn bộ stack SLAM + Rosbridge trên Laptop:
   ```bash
   ~/ros2_configs/start_laptop_stack.sh
   ```
3. (Tùy chọn) Mở RViz2 trực quan hóa trên màn hình Laptop:
   ```bash
   rviz2
   ```

---

## 3. Kiểm tra kết nối 2 máy qua Tailscale

Từ terminal WSL2 trên Laptop:
- Kiểm tra danh sách topic từ Pi 5:
  ```bash
  ros2 topic list
  ```
  *(Sẽ thấy `/scan`, `/tf`, `/tf_static` xuất hiện từ Pi 5!)*
- Xem trực tiếp tia quét LiDAR:
  ```bash
  ros2 topic echo /scan
  ```
