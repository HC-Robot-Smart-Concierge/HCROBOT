# Lịch chạy workflow và tuyến trên xe thật

## Cách dùng

1. Workflow: tạo workflow, thêm bước **Đi theo tuyến**. Có thể chưa chọn tuyến
   và lưu trước: workflow được lưu như bản nháp tạm tắt. Nút **Tạo workflow
   chạy tuyến** tạo sẵn bước tuyến và Chờ để cấu hình.
2. Physical Map: mở map cần dùng → **Tuyến đường** → chọn **Workflow cần cấu
   hình tuyến** và **Bước nhận tham số tuyến**. Vẽ ít nhất hai điểm hoặc chọn
   tuyến đã lưu của map hiện tại, rồi bấm **Lưu tuyến & gán vào bước**.
   Chọn workflow tự tạo một bản tuyến mới cho bước nếu bước chưa có tuyến
   trên map hiện tại. Nếu bước đã gán tuyến ở map khác, giao diện thông báo
   việc thay tham số; không tự ghép hai map vào một lượt chạy.
3. Lặp lại cho các bước tuyến còn thiếu. Quay về Workflow, đặt **Lịch chạy**,
   chọn **Điều khiển xe thật**, số vòng/nghỉ và giờ/ngày/múi giờ nếu cần.
   Bật workflow sau khi hoàn tất. Gán tuyến trên Map không tự bật bản nháp.
4. Bật Navigation đúng map và định vị xe. Backend không tự bật Navigation,
   không tự đặt vị trí đầu và không chuyển map.
5. **Chạy xe thật** tạo một lượt chạy; xem tiến độ/lỗi ở **Lượt chạy xe thật**.
   **Dừng lượt chạy** yêu cầu robot hủy goal; trạng thái giữ **Đang dừng**
   đến khi bộ thực thi thoát. Kiosk không cần mở cho tuyến xe thật chạy.

Tuyến là tham số `route_id` và `map_id` của đúng bước được chọn. API gán tuyến
chỉ sửa tham số đó, giữ các bước khác, số vòng, nhánh và lịch. Chọn bước được
giữ khi đóng popup để vẽ điểm rồi mở lại. Nếu tham số tuyến bị đổi bởi phiên
khác trong lúc đang vẽ, API trả 409 để tránh ghi đè. Có thể tiếp tục dùng
thư viện tuyến và cấu hình trực tiếp trong builder như trước.

Muốn quay về, thêm điểm đầu vào cuối tuyến. Đường nối trên giao diện là thứ
tự ghé điểm; Nav2 lập đường tránh vật cản giữa các điểm. Một workflow xe thật
hiện dùng một map; mọi bước tuyến của nó phải gắn cùng map trước khi bật.

Khởi động lại backend sau khi cập nhật để nạp scheduler và tạo bảng mới.
`init_db()` tạo `workflow_runs`; cũng có migration Alembic `c93d28e215fa`
cho môi trường quản lý schema bằng migration. Không tự chạy seed hoặc xóa dữ liệu.
Backend cần chạy trên máy nối được ROS của robot: Windows dùng WSL distro
đã cấu hình trong `ros2_runtime_service`; Linux dùng ROS Jazzy cùng máy.
Cùng ROS_DOMAIN_ID=0 với stack đang chạy.

Kiểm tra module ROS mà không khởi động node/motor:

```bash
bash robot/ros2_configs/run_workflow.sh --check
```

## Phạm vi hỗ trợ

- Xe thật: `MOVE`, `FOLLOW_ROUTE` và `WAIT`, trên robot `RC-001`.
- Bước tuyến được mở thành các goal có tọa độ map; chạy đúng thứ tự,
  chỉ chuyển bước khi action Nav2 của chính goal đó báo `SUCCEEDED`.
- `next_step_id` cho phép chuyển đến ID bước hoặc `END`. Giới hạn 10000
  lần chuyển trong một vòng để phát hiện nhánh lặp sai cấu hình.
- Hỗ trợ số vòng hữu hạn hoặc liên tục; thời gian nghỉ chỉ giữa các vòng.
- Vận tốc lấy từ cấu hình Nav2 và vùng giảm tốc, chưa áp dụng `speed` riêng
  của từng bước hay `speed_factor` khác 1. Không phát PWM trực tiếp.
- Giao tiếp, chào, nói, lựa chọn khách, hiển thị và tạo yêu cầu vẫn dùng chế độ
  **Màn hình Robot**. Chế độ này không di chuyển xe; lịch vẫn chỉ dự kiến,
  chưa thực thi lặp/scheduler kiosk. Không âm thầm bỏ qua bước chưa hỗ trợ
  khi chọn xe thật: API từ chối cấu hình đó.
- Workflow cũ mặc định **Màn hình Robot**, không tự chuyển sang xe thật.

## Chạy song song: vừa đi tuyến vừa quảng cáo

Trong sơ đồ workflow xe thật, chọn **Thêm node → Chạy song song**. Sơ đồ có thêm:

- **Làn Xe**: các bước nối từ Bắt đầu, nhận Di chuyển, Đi theo tuyến và Chờ.
- **Làn Màn hình**: chạy cùng lúc, lặp đến khi Làn Xe xong, nhận Hiển thị, Phát lời và Chờ.
- **Khi có người chắn đường**: xe dừng, quảng cáo tạm dừng, màn hình chạy các bước nói chuyện.
  Xong nhánh, xe đi tiếp từ điểm tuyến chưa qua và quảng cáo phát lại.

Xe coi là bị chắn khi LiDAR thấy vật **không có trên map**, lệch khỏi tuyến đã vẽ tối đa
20 cm, cách đầu xe tối đa 60 cm và tồn tại ít nhất 0,5 giây. Khách chạm quảng cáo cũng làm
xe dừng. Cuộc trò chuyện kết thúc khi khách tạm biệt hoặc 20 giây không tương tác; xe giữ
tối đa 10 phút. Sau khi đi tiếp, LiDAR bỏ qua chắn đường 30 giây để Nav2 lách qua.

Khi `/robot/person_detections` đang có dữ liệu, xe chỉ dừng nếu YOLO thấy người ở cùng hướng
với vật LiDAR phát hiện. Nếu YOLO không chạy hoặc báo `FAILED`, xe tạm dùng chỉ LiDAR nên vali
hoặc ghế mới đặt trên tuyến cũng làm xe dừng; log lượt chạy ghi `VISION_STATUS` khi đổi nguồn.
Nếu màn hình robot tắt, xe vẫn dừng khi bị chắn rồi tự đi tiếp sau 20 giây.

YOLO chạy trên Pi bằng `robot/scripts/person_vision.py`, đọc ảnh từ luồng camera cổng 8554
nên không tranh USB camera với `main.py`. Cầu nối `lidar_ws_to_ros2.py` trên laptop nhận kết
quả qua UDP 9997 rồi publish `/robot/person_detections`. Cài một lần khi Pi online:

```bash
bash robot/scripts/deploy_pi.sh                       # trên laptop
bash ~/HCROBOT/robot/scripts/setup_person_vision.sh   # trên Pi
```

Sau đó khởi động lại `main.py` trên Pi, rồi Navigation và backend trên laptop. Không cần nạp
ESP32. Cần thử một người đứng lệch trái và lệch phải để xác nhận ảnh camera không bị lật.

## Thực thi và phục hồi

- Lịch tuần được kiểm tra mỗi giây khi backend chạy. Ngày theo thứ Hai=0.
  Khóa slot theo workflow + phút UTC chống phát trùng khi có nhiều dòng lịch
  hoặc backend khởi động lại trong cùng phút. Không chạy bù lịch quá hạn.
- Khi robot bận, lịch được ghi `SKIPPED`; không xếp một lượt chạy bất ngờ
  sau khi robot rảnh. Run thủ công lúc bận trả lỗi 409.
- Lượt chạy lưu snapshot của tuyến/steps và config, nên sửa workflow sau đó
  không thay đổi lượt đang chạy. Tắt/xóa workflow ngăn lịch tương lai;
  muốn dừng lượt hiện tại phải bấm **Dừng lượt chạy**.
- Database giữ robot bằng một cột reservation unique. Một worker claim run
  bằng cập nhật có điều kiện; lịch và reservation dùng unique constraints.
- Trước mỗi goal: kiểm tra đúng map, `LOCALIZED`, dữ liệu sức khỏe mới,
  LiDAR/Pi online, encoder hợp lệ, không có goal Nav2 khác và costmap mới.
  Điểm đích không được ngoài costmap, chưa biết, hoặc lethal.
- API kiểm tra endpoint trong KEEP_OUT/NO_STOP tại lúc tạo lượt; Nav2 dùng
  mask/costmap cập nhật trong khi xe chạy. Cần bật stack zone filters như
  Navigation hiện tại để áp dụng keepout và vùng giảm tốc dọc đường.
- Mất định vị, thiếu dữ liệu, quá thời gian, bị hủy hoặc Nav2 từ chối:
  yêu cầu dừng và đánh dấu thất bại; không báo hoàn thành chỉ vì hết timer.
- Backend gia hạn lease file mỗi giây, hiệu lực 10 giây. ROS worker kiểm tra
  mỗi vòng spin (khoảng 0.1 giây), gửi hủy goal và dừng khi lease hết hạn.
  Run của worker không còn heartbeat được đóng FAILED sau 25 giây;
  không tự tiếp tục nhiệm vụ cũ. Cần kiểm chứng thời gian dừng trên xe thật.
- Log riêng ở `output/runtime/workflow-runs/`; database giữ 100 sự kiện gần
  nhất mỗi lượt. API trả tối đa 50 lượt gần nhất. Cần quản lý dung lượng log
  khi chạy liên tục lâu dài.

## Kiểm chứng trước khi dùng lịch thực tế

Các test tự động dùng action giả và SQLite, không phát lệnh xe. Đã kiểm tra
slot tuần, reservation, cancel, worker crash, các bước lỗi, số vòng/nghỉ và
chuyển bước theo action result. Vẫn phải thử tuyến ngắn dưới giám sát trên
xe thật: tới đích, hủy trong khi chạy, mất định vị, mất backend và vùng cấm.
Độ ổn định định vị/odom cần giải quyết riêng; workflow không sửa được sai số
cảm biến. Chưa triển khai trình kéo dây canvas kiểu n8n mới; dùng builder
và thứ tự/nhánh bước hiện có.
