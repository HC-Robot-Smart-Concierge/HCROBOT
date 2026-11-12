# Chạy world và map đã quét trong Gazebo + Foxglove

Cập nhật ngày 08/11/2026. Môi trường: ROS 2 Jazzy trong WSL Ubuntu-24.04.

## 1. Phân biệt world và map

| File | Chức năng |
| --- | --- |
| `robot/worlds/explore_room.world` | Phòng 3D, tường, vật cản và robot trong Gazebo |
| `robot/maps/explore_room.yaml` | Thông số bản đồ SLAM đã lưu |
| `robot/maps/explore_room.pgm` | Ảnh bản đồ được YAML tham chiếu |

Gazebo mở `.world`. Foxglove kết nối ROS để xem `/map`, `/scan` và đường đi;
không mở trực tiếp `.world`. Giữ hai file YAML và PGM cùng nhau.

## 2. Mở Gazebo cùng map đã quét để robot chạy

Mở WSL từ PowerShell Windows:

```powershell
wsl -d Ubuntu-24.04
```

Sau đó chạy **trong WSL**:

```bash
cd "/mnt/d/FPT MATERIALS/9th Semeter (Final)/HCROBOT"

WORLD="$PWD/robot/worlds/explore_room.world" \
MAP=explore_room GZ_GUI=1 \
bash robot/ros2_configs/start_sim_foxglove.sh
```

Lệnh này mở Gazebo, nạp map đã lưu, bật AMCL, Nav2 và Foxglove bridge tại cổng
`8765`. Chế độ `MAP=explore_room` không chạy SLAM quét mới.
Chờ terminal báo `MO PHONG SAN SANG`, rồi giữ terminal mở trong lúc sử dụng.
Nhấn `Ctrl+C` trong terminal đó để dừng mô phỏng.

Script dừng stack xe thật và mô phỏng cũ khi khởi động; mỗi lần chỉ chạy một phiên.
Muốn chạy không có cửa sổ Gazebo, đổi `GZ_GUI=1` thành `GZ_GUI=0`.
Nếu Gazebo lỗi hiển thị, thêm `GZ_SOFTWARE=1` trước `bash` để thử vẽ bằng CPU;
chế độ này có thể chậm hơn.

## 3. Kết nối và hiển thị trên Foxglove

1. Mở <https://app.foxglove.dev> hoặc Foxglove Desktop.
2. Chọn **Open connection → Foxglove WebSocket**.
3. Nhập `ws://localhost:8765` hoặc `ws://127.0.0.1:8765`, rồi kết nối.
4. Chọn **Layouts → Import from file**, nhập file
   `frontend/public/foxglove/hcrobot-sim-mapping-layout.json`, hoặc tự thêm panel **3D**.
5. Trong cài đặt panel **3D**, chọn **Fixed frame = `map`**.

| Topic / lớp nên bật | Hiển thị |
| --- | --- |
| `/map` | Bản đồ đã lưu |
| `/scan` | LiDAR của robot Gazebo |
| `/plan` | Đường Nav2 tính tới đích |
| `/global_costmap/costmap` | Costmap toàn cục |
| `/local_costmap/costmap` | Costmap quanh robot |
| Transforms, frame `base_link` | Vị trí robot |

Chỉ mở trang Foxglove không tự khởi động ROS hay nạp map; lệnh mục 2 phải đang chạy.

## 4. Chỉ điểm để robot di chuyển

Trong **cài đặt panel 3D → Publish**, đặt đúng các topic:

| Công cụ | Topic | Công dụng |
| --- | --- | --- |
| **2D Pose / Publish Pose** | `/goal_pose` | Gửi vị trí và hướng đích cho Nav2 |
| **2D Pose Estimate** | `/initialpose` | Đặt lại vị trí hiện tại của robot cho AMCL |
| **2D Point / Publish Point** | `/clicked_point` | Gửi một điểm; stack này không dùng làm đích di chuyển |

Thao tác gửi đích:

1. Nhấp chuột phải hoặc nhấn giữ nút **Publish** trên thanh công cụ bên phải
   khung bản đồ, chọn **2D Pose / Publish Pose**.
2. Bấm nút Publish để kích hoạt công cụ nếu chưa được bật.
3. Bấm giữ chuột trái tại vùng trống muốn tới, kéo chọn hướng mũi tên,
   rồi thả chuột để gửi đích.
4. Quan sát `/plan` và robot trong Gazebo. Khi thử lần đầu, chọn điểm cách robot
   khoảng 1–2 m trong cùng phòng, tránh tường và vật cản.

Copy và dán `/goal_pose` để tránh bộ gõ tiếng Việt làm đổi tên topic.
Không đặt **Pose Estimate** thành `/goal_pose`: công cụ này gửi
`PoseWithCovarianceStamped`, trong khi đích Nav2 cần `PoseStamped`.
Nếu bridge báo `incompatible type`, sửa lại các topic theo bảng rồi nhấn `F5`
để kết nối lại.

Lái tay robot giả lập bằng panel **Teleop**, topic `/cmd_vel`.
Tránh dùng Teleop đồng thời khi Nav2 đang đi tới đích.

## 5. Chỉ xem map, không chạy Gazebo

Từ thư mục gốc dự án trong WSL, dùng lệnh này thay cho lệnh mục 2:

```bash
bash robot/ros2_configs/view_map_foxglove.sh explore_room
```

Kết nối Foxglove như mục 3. Chế độ này dùng robot giả đứng yên: có thể xem map,
costmap và thử tính đường, nhưng robot không di chuyển. Muốn robot chạy trong
mô phỏng, dùng mục 2.

## 6. Quét lại world và lưu map mới

Dừng phiên cũ bằng `Ctrl+C`, rồi chạy từ thư mục gốc dự án trong WSL:

```bash
WORLD="$PWD/robot/worlds/explore_room.world" \
GZ_GUI=1 EXPLORE=1 EXPLORE_SAVE=explore_room \
bash robot/ros2_configs/start_sim_foxglove.sh
```

Chế độ này bật SLAM và tự khám phá; explorer tự lưu khi kết thúc thành công.
Không đặt đồng thời `MAP=...` và `EXPLORE=1`. Khi lưu sẽ ghi đè
`explore_room.yaml` và `.pgm`; sao lưu trước hoặc đổi `EXPLORE_SAVE` để giữ map cũ.

Lưu thủ công kết quả đang quét bằng terminal WSL thứ hai:

```bash
cd "/mnt/d/FPT MATERIALS/9th Semeter (Final)/HCROBOT"
bash robot/ros2_configs/save_ros2_map.sh explore_room --no-pause
```

Chờ báo lưu thành công, kiểm tra đủ hai file:

```bash
ls -lh robot/maps/explore_room.yaml robot/maps/explore_room.pgm
```

Sau đó dừng phiên quét và chạy lại mục 2 để điều hướng trên map đã lưu.
Map phải được quét từ đúng world đang mở. Nếu đổi bố trí tường/vật cản của world,
cần kiểm tra lại sự phù hợp của map.

## 7. Xử lý lỗi thường gặp

| Hiện tượng | Kiểm tra / xử lý |
| --- | --- |
| Không kết nối được Foxglove | Giữ terminal mục 2 chạy, chờ mô phỏng sẵn sàng, dùng đúng cổng `8765` |
| Không thấy bản đồ | Chọn Fixed frame `map`, bật `/map`, kiểm tra YAML/PGM tồn tại |
| Publish Point nhưng robot không đi | Chọn **2D Pose**, topic `/goal_pose` theo mục 4 |
| Có đường đi nhưng robot đứng yên | Kiểm tra có đang chạy `view_map_foxglove.sh` không; chuyển sang lệnh mục 2 |
| Robot quay qua lại khi gần đích | Khởi động lại bằng script hiện tại để nạp cấu hình căn hướng đích cho Gazebo; thử một điểm trống xa hơn |
| LiDAR lệch tường trên map | Kiểm tra đúng cặp world/map; dùng **2D Pose Estimate → `/initialpose`** khi cần chỉnh định vị |
| Explorer dừng trước khi tự lưu | Xem lỗi LiDAR/costmap; có thể lưu thủ công bằng mục 6, nhưng vẫn còn vùng chưa quét |

Kiểm tra ROS trong terminal WSL thứ hai:

```bash
source /opt/ros/jazzy/setup.bash
export ROS_DOMAIN_ID=0
ros2 lifecycle get /bt_navigator
ros2 topic info /goal_pose --verbose
ros2 topic echo /cmd_vel
```

`bt_navigator` cần ở trạng thái `active`; `/goal_pose` cần có subscriber
`bt_navigator`. Dùng `Ctrl+C` để dừng riêng lệnh xem `/cmd_vel`.

Chế độ nạp map trong Gazebo áp dụng `nav2/sim_navigation_overrides.yaml` với
`FollowPath.rotate_to_goal_heading: true` để xử lý quay qua lại khi gần đích.
Đã kiểm tra trực tiếp: gửi đích tọa độ map `(1.0, 0.4)`, robot tiến khoảng
0,61 m và Nav2 báo thành công.

## 8. Thông tin map hiện có

Lượt quét ngày 07/11/2026 đã lưu map 160 × 120 ô, độ phân giải 0,05 m/ô
(8 × 6 m). Robot đã qua 9 vị trí; tự hành dừng khi LiDAR thiếu đủ 24 vùng góc
lúc sát vật cản. Bản đồ được lưu thủ công sau đó, còn 471/19200 ô chưa biết
(khoảng 2,5%, gồm bên trong vật cản và vùng khuất).

Log phiên quét đã thực hiện:

- `output/runtime/explore-room-rescan.log`
- `output/runtime/explore-room-rescan.err.log`

Các lần chạy thủ công sau này xem log ngay trong terminal đang chạy script.
