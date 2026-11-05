# Lùi ra khỏi khu hẹp khi tự quét map

Áp dụng cho luồng ROS 2 `frontier_explorer.py`, được chạy qua Web Admin
`/api/v1/map/ros2/start_explore` hoặc `EXPLORE=1 bash robot/ros2_configs/start_wsl_slam.sh`.
Khởi động lại phiên tự quét để nạp code mới. Không cần thay cấu hình Pi hay lidar.xacro.

Robot ghi các mốc odom cách nhau khoảng 8 cm và đánh dấu vị trí có đủ khoảng trống
để xoay. Sau khi quét ở khu hẹp, hoặc khi Nav2 thất bại/kẹt, robot chờ action Nav2
kết thúc rồi lùi qua các mốc theo thứ tự ngược về vị trí rộng gần nhất. Robot chỉ
hiệu chỉnh hướng nhẹ trong lúc lùi, không xoay tại chỗ để tìm lại đường. Bộ bám
đường chiếu vị trí lên đoạn đường cũ và ngắm trước 20 cm theo chiều lùi, tránh
nhầm mốc vừa đi quá thành đích nằm trước mũi xe. Lệch đường quá 12 cm, sai hướng
trên khoảng 34 độ hoặc nhảy tiến trình quá 30 cm trong một lần cập nhật vẫn bị dừng.

Đường cũ chỉ là đường tham chiếu: LiDAR hiện tại vẫn phải xác nhận vùng thân xe,
hai góc sau và đoạn sắp lùi không có vật cản. Sonar/Pi tiếp tục áp dụng phanh sẵn có.
LiDAR phải có dữ liệu ở cả 24 vùng góc quanh xe; vùng thiếu số đo không coi là trống.
Hình học dùng thân xe 32 x 16 cm và LiDAR lệch trước tâm xe 8 cm, khớp lidar.xacro.

Các tham số ROS của explorer:

| Tham số | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `retreat_speed` | 0.08 m/s | Vận tốc lùi yêu cầu, giới hạn 0.04–0.10 m/s |
| `retreat_turn_radius_m` | 0.40 m | Bán kính vùng trống quanh tâm xe để đánh dấu chỗ xoay |
| `retreat_history_m` | 8.0 m | Độ dài lịch sử đường đi tối đa |
| `retreat_scan_timeout_sec` | 0.8 s | Tuổi tối đa của scan, xét cả thời điểm nhận và timestamp |

Bridge vẫn áp dụng sàn PWM để thắng ma sát; vận tốc thực tế phụ thuộc motor và tải,
không nhất thiết bằng vận tốc yêu cầu. Odom quá 1 giây không được dùng để tự lùi.

Nếu mất dữ liệu, không còn mốc rộng trong lịch sử, gặp vật cản mới, cua quá gắt,
lệch đường hoặc lùi không tiến triển trong 5 giây, robot dừng tự hành và in lý do.
Kiểm tra, lái tay ra chỗ rộng rồi khởi động lại tự quét. Giới hạn mỗi lần lùi là 120 giây.
Nút dừng qua `/robot/nav_cancel` dừng cả explorer và chế độ lùi; nút dừng tự quét
của Web cũng tắt explorer như trước.

Log bình thường: `Lùi theo ... mốc đường cũ tới chỗ đủ rộng` rồi
`Đã lùi ra chỗ đủ rộng, tiếp tục chọn frontier`.
Log cần kiểm tra: `Tạm dừng tự hành: ...`.
Lỗi lệch đường ghi thêm độ lệch ngang hoặc góc/hướng tới mốc ngắm để chẩn đoán.
Khi `slam:=true`, launch tắt keepout filter vì chưa chọn map tĩnh/mask vùng cấm;
chế độ navigation với map tĩnh vẫn giữ bộ lọc vùng cấm.

Kiểm thử logic không cần ROS:

```powershell
python -m unittest discover -s robot/tests -p test_retreat_logic.py
python -m unittest discover -s robot/tests -p test_frontier_recovery.py
```

Chưa xác minh trên phần cứng thật. Lần thử đầu nên bắt đầu từ chỗ rộng, vào một
lối thẳng ngắn rồi theo dõi xe lùi về mốc rộng và phản ứng khi chặn đường phía sau.
