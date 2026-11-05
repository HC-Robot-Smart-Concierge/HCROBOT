# Costmap và thoát khe khi tự quét trên xe thật

Áp dụng cho luồng ROS 2 `frontier_explorer.py`, được chạy qua Web Admin
`/api/v1/map/ros2/start_explore` hoặc `EXPLORE=1 bash robot/ros2_configs/start_wsl_slam.sh`.
Nav2/SLAM/costmap chạy trên laptop WSL, Pi 5 nhận lệnh motor qua UDP và giữ sonar/watchdog.
Khởi động lại Nav2 và explorer để nạp code lẫn cấu hình mới; không cần cài ROS lên Pi.

Mapping dùng thân xe đo thực tế 33 × 17 cm (kể cả bánh), với đệm 4 cm, thêm critic `ObstacleFootprint` để
kiểm tra cả hình chữ nhật khi Nav2 chạy. Cấu hình navigation với map tĩnh giữ nguyên.

Robot ghi các mốc odom cách nhau khoảng 8 cm và đánh dấu vị trí có đủ khoảng trống
để xoay. Sau khi quét ở khu hẹp, hoặc khi Nav2 thất bại/kẹt, robot chờ action Nav2
kết thúc rồi lùi qua các mốc theo thứ tự ngược về vị trí rộng gần nhất. Robot được
quay tại chỗ, rẽ cung lùi hoặc cung tiến để chỉnh hướng nếu vùng quét vừa. Bộ bám
đường chiếu vị trí lên đoạn đường cũ và ngắm trước 20 cm theo chiều lùi, tránh
nhầm mốc vừa đi quá thành đích nằm trước mũi xe. Góc lệch lớn (như 43,7°) yêu cầu
chỉnh hướng thay vì khóa tự hành. Lệch đường quá 12 cm hoặc nhảy tiến trình quá
30 cm thì giao lại Nav2 chọn đường khác.

Đường cũ chỉ là đường tham chiếu: cả LiDAR và `/local_costmap/costmap` phải xác nhận
toàn bộ vùng thân xe quét qua khi quay/tiến/lùi không có vật cản. Costmap mới trong
1,5 giây; ô chưa biết hoặc vật cản dưới vùng quét không cho phép phát lệnh. Chi phí
inflation 1..99 vẫn là chi phí ưu tiên, không cộng thành vật cản vật lý lần thứ hai.
Kiểm tra chuyển động tính cả sàn PWM thực tế. Sonar/Pi tiếp tục áp dụng phanh sẵn có.
LiDAR phải có dữ liệu ở cả 24 vùng góc quanh xe; vùng thiếu số đo không coi là trống.
Hình học thân xe tập trung ở `robot/ros2_configs/robot_geometry.py` (nửa dài 0.165 m,
nửa rộng 0.085 m). Footprint Nav2 đồng bộ các góc này; LiDAR vẫn lệch trước tâm xe
8 cm theo lidar.xacro, không suy ra lại vị trí cảm biến từ số đo thân xe.

Các tham số ROS của explorer:

| Tham số | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `retreat_speed` | 0.08 m/s | Vận tốc lùi yêu cầu, giới hạn 0.04–0.10 m/s |
| `goal_clearance_m` | 0.25 m | Khoảng hở khi chọn chỗ quét |
| `retreat_turn_radius_m` | 0.25 m | Bán kính vùng trống quanh tâm xe để đánh dấu chỗ xoay |
| `retreat_history_m` | 8.0 m | Độ dài lịch sử đường đi tối đa |
| `retreat_scan_timeout_sec` | 0.8 s | Tuổi tối đa của scan, xét cả thời điểm nhận và timestamp |

Bridge vẫn áp dụng sàn PWM để thắng ma sát; vận tốc thực tế phụ thuộc motor và tải,
không nhất thiết bằng vận tốc yêu cầu. Odom quá 1 giây không được dùng để tự lùi.

Nếu vùng quay/rẽ bị chặn, xe dừng ngắn rồi chọn đường/đích khác, không khóa cả lượt
quét. Quay/lùi không tiến triển cũng giao lại Nav2. Nếu thiếu LiDAR, odom hoặc
costmap liên tục 5 giây thì dừng tự hành và in lý do. Giới hạn mỗi lần thoát là 120 giây.
Nút dừng qua `/robot/nav_cancel` dừng cả explorer và chế độ lùi; nút dừng tự quét
của Web cũng tắt explorer như trước.

Log bình thường: `Thoát theo ... mốc đường cũ` / `chỉnh hướng ...` rồi
`Đã lùi ra chỗ đủ rộng, tiếp tục chọn frontier`.
Log cần kiểm tra: `Tạm dừng tự hành: ...`.
Lỗi lệch đường ghi thêm độ lệch ngang hoặc góc/hướng tới mốc ngắm để chẩn đoán.
Khi `slam:=true`, launch tắt keepout filter vì chưa chọn map tĩnh/mask vùng cấm;
chế độ navigation với map tĩnh vẫn giữ bộ lọc vùng cấm.

Kiểm thử logic không cần ROS:

```powershell
python -m unittest discover -s robot/tests -p test_retreat_logic.py
python -m unittest discover -s robot/tests -p test_recovery_costmap.py
python -m unittest discover -s robot/tests -p test_frontier_recovery.py
```

Không bảo đảm vào mọi khe: lối đi phải vừa thân xe và vùng quét khi quay. Vùng
chưa vào được vẫn có thể quét từ ngoài bằng LiDAR.
