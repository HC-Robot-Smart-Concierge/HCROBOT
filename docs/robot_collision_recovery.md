# Giảm va chạm và lùi thoát chỗ chật

## Hành vi mong đợi

Tự quét: đi chậm theo Nav2 → bị chặn/không tiến triển khoảng 3 giây → hủy và
chờ goal cũ kết thúc → kiểm tra LiDAR, odom, local costmap → lùi thẳng một đoạn
có giới hạn hoặc lùi theo đường đã đi → khi có đủ vùng quay mới đổi hướng.
Không chèn lệnh lùi vào khi goal Nav2 cũ vẫn chưa xác nhận dừng.

Đi endpoint/workflow trên map đã lưu: Nav2 có recovery BackUp trong
`physical_navigate.xml`; progress checker mới tính cả đi và quay, timeout 4 giây
thay vì giữ SimpleProgressChecker với thời gian 20 giây. Workflow tiếp tục
chờ kết quả action Nav2; nếu mất định vị hoặc lỗi thì dừng lượt chạy.

Lái tay: sonar vẫn chặn hướng có nguy cơ, không tự đảo chiều ngoài ý người lái.
Nếu mọi hướng đều chật hoặc dữ liệu mất thì phải dừng, không ép quay/lùi mù.

## Thay đổi

- Nav2 yêu cầu tối đa 0.15 m/s thay vì 0.20/0.25; gia tốc tiến 0.25 m/s²,
  giảm tốc cấu hình 0.5 m/s². Bridge mặc định trần PWM 43, hệ số PWM giữ
  0.0035 m/s/% từ cấu hình Navigation cũ, dùng đồng nhất khi tự quét.
  Đây là giới hạn lệnh theo mô hình open-loop, chưa phải tốc độ thực đo.
  Không tăng tốc lùi; giới hạn cũng áp dụng lệnh lùi qua bridge.
- DWB kiểm tra footprint cả lúc mapping, không chỉ BaseObstacle tại tâm.
- `PoseProgressChecker` của Nav2 tính cả translation và rotation, nên có thể
  phát hiện kẹt sớm hơn mà không coi mọi lần quay tại chỗ là đứng yên.
- Pi dừng theo sonar: trước 25 cm, sau 20 cm, hông khi quay/rẽ 16 cm,
  khoảng hở trước/sau khi quay 10 cm. Giá trị này là số đo từ sonar, không
  phải tọa độ tâm LiDAR. Mở lại sau 2 packet hợp lệ vượt ngưỡng 3 cm.
- Không tự bỏ qua sonar chưa có tín hiệu hoặc mất tín hiệu lâu. Một packet
  null chỉ được giữ tạm khi mẫu hợp lệ trước còn mới; null không mở khóa.
  Các lệnh cùng hướng cũng kiểm tra lại sensor trước khi tiếp tục.
- Scan trống ở một góc là NaN/unknown, không ghi thành inf rồi coi là đường
  trống. Giữ tia LiDAR từ 0.15 m, thay vì bỏ toàn bộ tia dưới 0.20 m.
- Recovery trước đây từ chối mọi chuyển động khi vật đã ở trong padding
  4 cm, kể cả lùi xa khỏi vật đó. Nay chỉ cho **đi thẳng** thoát padding khi
  khoảng cách tới từng vật không giảm; không áp dụng cho xoay/rẽ. Không
  cho phép vật đè vào thân thật hoặc khoảng hở không chứng minh được trên
  costmap. Đường lùi phía sau vẫn phải đủ trống, unknown vẫn chặn.
- Khi không quay/rẽ được theo đường lùi cũ, thử lùi thẳng có kiểm tra,
  giới hạn 15 cm/4 giây rồi tính lại. Không cố quay 180 độ ngay sát tường.

## Kích thước và điều kiện kiểm chứng

Người vận hành xác nhận rộng ngoài cùng 17 cm; giữ footprint hiện tại rộng
17 cm, chiều dài trong repo 33 cm (cần xác nhận cả phần nhô ra). Khoảng cách
tâm hai bên bánh phải đo riêng cho odom; 17 cm ngoài cùng không chứng minh
wheel base hoặc track hiệu dụng là 17 cm.

Cập nhật `robot/settings.yaml` và `obstacle_safety.py` trên Pi, khởi động lại
`main.py` khi xe đã dừng. Khởi động lại stack ROS Mapping/Navigation để nạp
params và bridge mới. Không chỉ reload frontend. Biến môi trường tốc độ cũ
có thể ghi đè mặc định mới; kiểm tra `/robot/sensor_health` và tham số Nav2.
Không tự khởi động phiên EXPLORE để kiểm tra cấu hình.

Test tự động dùng dữ liệu giả, không điều khiển motor. Trước khi tự quét
phải kiểm chứng trực tiếp: sensor trước chặn tiến, sau trống vẫn cho lùi,
sonar hỏng không bị tự bypass, vật chắn sau ngăn lùi, quay có đủ chỗ, và
đứng yên khi scan/odom/costmap bị mất. Sai odom, gá cảm biến, điểm mù LiDAR
hoặc footprint sai vẫn có thể gây va chạm; chưa thể cam kết không tông.

Tham chiếu: [Nav2 PoseProgressChecker](https://docs.nav2.org/rolling/configuration_and_development/configuration_guide/core_servers/controller_server/controller_server_plugins/pose_progress_checker/)
và [thông số RPLiDAR A1](https://www.slamtec.com/en/lidar/a1spec).
