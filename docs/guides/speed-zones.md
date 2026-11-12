# Vùng giới hạn tốc độ

## Sử dụng

1. Sau khi cập nhật code, khởi động lại Navigation một lần và tải lại frontend.
2. Trong Physical Map, mở **Vùng → Tốc Độ**, kéo một hình chữ nhật.
3. Chọn vùng, nhập tốc độ tối đa theo m/s, nhấn Enter hoặc rời ô nhập rồi bấm
   **Lưu**. Giá trị hợp lệ: 0.01–1.00 m/s, độ phân giải 0.01 m/s. Vùng mới mặc định
   0.18 m/s. Các vùng chồng nhau áp dụng mức thấp nhất.
4. Vùng hiện màu vàng/cam, nhãn luôn có `≤ … m/s`, kể cả khi vùng có tên riêng.
   Phần telemetry hiển thị giới hạn Nav2 đã phát và tốc độ odometry đo được.
5. Trong Foxglove, chọn frame `map` và bật `/speed_zone_markers` ở panel 3D.
   Marker màu vàng và nhãn m/s được tạo từ **mask Nav2 đã nạp**, không từ hình vẽ
   chưa lưu trên frontend. Có thể xem thêm `/speed_filter_mask`, `/speed_limit`,
   và `/speed_zones/state`.

Sau lần khởi động lại đầu tiên để nạp node mới, lưu/chỉnh/xóa vùng sẽ nạp lại mask
khi Navigation đang chạy. Xóa vùng cuối cùng tạo mask toàn 0 và xóa các marker cũ.
Nếu ROS chưa chạy, vùng được lưu cho lần bật Navigation tiếp theo.

## Xe thật và mô phỏng

Nav2 SpeedFilter xét **tâm robot** trong mask. Mã hóa mask raw: `18` tương ứng
`0.18 m/s` (`type=2`, `base=0`, `multiplier=0.01`); `0` là bỏ giới hạn vùng và
trở lại giới hạn bình thường của controller.
[Tài liệu SpeedFilter của Nav2 Jazzy](https://docs.nav2.org/jazzy/configuration_and_development/configuration_guide/core_servers/costmap_2d/costmap_filters/speed_filter/).

Bridge xe thật đọc `/speed_limit` và giới hạn PWM sau khi chuyển đổi lệnh Nav2,
để sàn PWM không tự nâng tốc độ vượt mức đặt. Với cấu hình hiện tại, sàn chạy thẳng
35% × 0.0048 m/s/% tương đương khoảng **0.168 m/s**. Đặt 0.12 m/s sẽ làm bridge
gửi **stop**, thay vì tự chạy ở sàn motor. Giao diện cảnh báo khi nhận trạng thái
`speed_limit_below_motor_floor`. Khi cua, nếu không thể giữ tỷ lệ tốc độ hai bánh
mà vẫn đạt sàn motor và giới hạn vùng, bridge cũng dừng. Xoay tại chỗ không có
vận tốc tịnh tiến nên không bị giới hạn bởi phần cap PWM này.

Đây là giới hạn **lệnh PWM dựa trên hệ số hiệu chỉnh**, chưa phải điều khiển tốc độ
vòng kín bằng encoder. Tốc độ thật phụ thuộc pin, tải và mặt sàn; cần xác minh trên
xe trước khi kết luận giới hạn vận tốc thực tế. Mô phỏng tiếp tục dùng SpeedFilter
của Nav2, không đi qua bridge PWM. Điều khiển trực tiếp Pi ngoài ROS2 không đi qua
giới hạn này.

## Kiểm chứng

- Frontend: kiểm tra giá trị nhập, nhãn tốc độ, trạng thái thiếu dữ liệu và mất cập nhật.
- Backend: kiểm tra mask, vùng chồng nhau, không làm tròn tốc độ lên, chặn giá trị
  không hữu hạn và không hợp lệ.
- Bridge: kiểm tra cả tiến/lùi, sàn PWM, phục hồi khi ra vùng và gọi xử lý Twist thật.
- Test tích hợp chạy MapServer + SpeedFilter + visualizer trong ROS domain 88 riêng:
  nạp mask raw `18`, vào vùng nhận `0.18 m/s`, ra vùng nhận `0`, xóa vùng nhận `0`
  và marker DELETEALL. Không khởi động bridge motor hoặc gửi lệnh xe thật.

```bash
source /opt/ros/jazzy/setup.bash
ROS_DOMAIN_ID=88 HCROBOT_RUN_SPEED_SMOKE=1 \
  python3 -m unittest discover -s robot/tests -p test_speed_filter_smoke.py -v
python3 -m unittest discover -s robot/tests -p test_speed_zones.py -v
```

Xe thật chưa được thử cho thay đổi này vì Pi hiện chưa bật. Vùng cấm dừng không
thay đổi trong phần triển khai này.
