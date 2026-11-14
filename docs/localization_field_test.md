# Kiểm tra định vị khi xe di chuyển

## Phạm vi bản sửa

- `localization_manager.py`: so scan với TF đúng timestamp của scan thay vì TF mới nhất. Scan cũ, timestamp bằng 0, thiếu TF lịch sử hoặc thiếu tia hợp lệ có lý do chẩn đoán trong `/localization/state`.
- `localization_logic.py`: dữ liệu thiếu kéo dài không còn giữ trạng thái LOCALIZED; dùng thời gian chờ `lost_sec` đang có để tránh phản ứng với một khoảng gián đoạn ngắn. Khi chuyển sang LOST, manager yêu cầu hủy goal và dừng xe. Việc dừng motor phải kiểm chứng trên xe thật.
- Chưa hiệu chỉnh đường kính bánh, CPR, khoảng cách bánh, gyro sign, tốc độ hoặc AMCL bằng phỏng đoán. Chưa khẳng định đã giải quyết trượt định vị thực tế.

## Thu dữ liệu

### Quan sát quãng đường ngày 2026-11-14

Người vận hành xác nhận xe tiến quá vạch rồi lùi về vạch cách điểm đầu 1.20 m.
Odom đọc trực tiếp sau khi dừng: x=0.612770571 m, y=-0.016479072 m;
độ dịch chuyển so với gốc là 0.612992115 m. Không có mẫu odom trước khi chạy
được lưu, nên chưa đủ cơ sở kết luận sai số tỷ lệ hay sửa CPR.
Hệ số bù 1.958 đề xuất trước đó đã được bỏ khỏi code. Odom dùng trực tiếp
tick, bán kính bánh và CPR, không nhân hệ số quãng đường.
`/robot/sensor_health` có radius, wheel base và CPR để kiểm tra cấu hình
hiệu lực. Cần ghi odom đầu/cuối và tick trong một lượt đo tiếp theo,
kiểm tra mất mẫu, reset tick và cách đếm xung trước khi kết luận nguyên nhân.

Chạy trên **WSL/Linux đang chạy ROS 2 Navigation**, cùng ROS_DOMAIN_ID. Cần `ros2 bag` và quyền đọc topic. Khởi động lại Navigation sau khi cập nhật code. Không khởi động đồng thời SLAM và AMCL cho cùng `map -> odom`.

Từ thư mục gốc dự án:

```bash
bash robot/ros2_configs/capture_localization.sh 60
```

Script chỉ đọc, không đặt vị trí, không gửi lệnh xe. Nó thu tham số hiệu lực và rosbag, in đường dẫn `/tmp/hcrobot-localization-....tar.gz` khi xong. Đợi dòng `Recording ... seconds now` rồi mới thử. Giữ log terminal Navigation nếu node chết hoặc script báo lỗi. Trên WSL mở `/tmp` qua `explorer.exe /tmp` để lấy file.

Thực hiện từng bài riêng, đặt vị trí ban đầu đúng và xác nhận LOCALIZED trước bài thử. Người vận hành giám sát, sẵn nút dừng; dừng bài nếu scan lệch rõ. Dùng điều khiển tay sẵn có ở tốc độ thấp mà motor vẫn chạy đều.

1. **Đứng yên**: ghi 30–60 giây; xem scan và pose có trôi không.
2. **Đi thẳng**: đánh dấu đầu/cuối cách nhau 1 m; chạy chậm, đo quãng đường thật, ghi hướng tiến và thời gian. Không bế/đẩy xe khi đang ghi.
3. **Quay**: quay trái chậm 90°, dừng vài giây, rồi quay phải về hướng ban đầu. Đo góc thật bằng vạch sàn hoặc vật chuẩn; không dùng góc trên UI làm giá trị thật.

Gửi ba file và số đo tương ứng, hoặc bắt đầu bằng bài hay gây lỗi nhất. Rosbag có scan, map và log vận hành; không cần gửi `.env`, mật khẩu hay khóa SSH.

## Thông tin cần kèm

- Mất định vị khi đứng yên, đi thẳng, quay, hay sau bao lâu; ảnh/video scan lệch map có thời điểm lỗi.
- Tên map; Pi và laptop nối Wi-Fi LAN hay Tailscale; ROS chạy trên WSL hay Pi.
- LiDAR, encoder, IMU đang dùng; có thay firmware hoặc đổi chiều lắp cảm biến không.
- Đường kính bánh người vận hành cung cấp là 6.5 cm; radius mặc định 0.0325 m trên Pi và ROS bridge (`HCROBOT_WHEEL_RADIUS`, mét). Người vận hành sau đó xác nhận **17 cm là bề rộng ngoài cùng**, không phải số đo tâm bánh. Footprint giữ rộng 0.17 m. `HCROBOT_WHEEL_BASE` hiện mặc định 0.17 m từ lượt trao đổi trước, cần đo lại tâm trái–phải trước khi coi đó là cấu hình odom chính xác. Khoảng cách 11.5 cm là trước–sau. CPR mặc định vẫn 330, chưa xác nhận. Track hiệu dụng skid-steer phải kiểm chứng bằng phép quay, không suy ra chỉ từ chiều rộng ngoài.
- Các biến `HCROBOT_ENCODER_*`, `HCROBOT_WHEEL_RADIUS`, `HCROBOT_GYRO_SIGN`, `HCROBOT_WHEEL_BASE`, `HCROBOT_EFFECTIVE_TRACK` nếu bạn đã đặt. Chỉ gửi các giá trị này, không gửi toàn bộ môi trường.

### Cách đo khi chưa biết đọc odom

Không cần tự tính odom: ghi rosbag theo hướng dẫn ở trên, người phân tích sẽ lấy odom trước/sau. Người vận hành chỉ cần cung cấp số đo vật lý độc lập:

- Dán băng keo đánh dấu một điểm trên thân xe và vị trí của điểm đó trên sàn; đặt một vạch đích cách 1 m theo hướng tiến.
- Chạy tay thẳng chậm rồi dừng khi điểm đánh dấu trên thân gần vạch đích. Đo lại khoảng dịch chuyển thật và ghi lại (không bắt buộc đúng 1.000 m).
- Không dùng endpoint trên map làm chuẩn 1 m, vì tọa độ map là đại lượng đang cần kiểm tra.
- Với bài quay, đánh dấu hướng thân ban đầu và một hướng vuông góc trên sàn; quay tay chậm đến gần 90 độ, ghi góc thật nếu đo được. Giữ cùng vị trí đầu cho từng bài sau khi đặt lại định vị.
- Để đo khoảng cách trái–phải: nhìn xe từ trên xuống, đo ngang từ tâm bánh trái đến tâm bánh phải trên cùng một trục; không đo theo chiều dọc trước–sau.

## Thứ tự xử lý sau khi có log

1. So timestamp và độ liên tục `/scan`, `/odom`, TF; xác định scan có bị bỏ liên tục khi quay hay không.
2. So quãng đường/góc odom với số đo thật; hiệu chỉnh bánh/encoder/gyro theo số đo.
3. Kiểm tra TF lắp LiDAR và nguồn phát `map -> odom`; kiểm tra chất lượng map.
4. Sau khi dữ liệu đầu vào đúng mới chỉnh AMCL, tốc độ và xung quay; chạy lại cùng ba bài để đối chiếu.

Không tăng tolerance hoặc hạ ngưỡng khớp chỉ để UI báo xanh. Nếu chỉ mất định vị khi quay, cần phân biệt scan biến dạng, scan bị bỏ, gyro sai dấu/scale và dữ liệu trễ trước khi đổi thông số.
