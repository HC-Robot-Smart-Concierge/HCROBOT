# Thiết kế: Vừa đi tuyến vừa phát quảng cáo, dừng nói chuyện khi có người chắn đường

Ngày: 2026-11-23 · Trạng thái: đã triển khai, chưa thử trên xe thật · Liên quan: `2026-11-20-workflow-canvas-n8n-design.md`, commit đã revert `1ae7114`

## 1. Mục đích

Robot đi tuần theo tuyến và phát quảng cáo **cùng lúc**. Khi có người chắn đường, robot đứng lại, tắt quảng cáo và chuyển sang nói chuyện. Nói chuyện xong, robot đi tiếp từ đoạn đang dở và phát quảng cáo lại.

Workflow song song gồm **hai làn cố định và một nhánh ngắt**, admin thấy và nối dây trên canvas:

```
            ┌─ Làn Xe:        [Đi theo tuyến] → [Chờ] ─┐
▶ Bắt đầu ──┤                                          ├─► ■ Kết thúc
            └─ Làn Màn hình:  [Quảng cáo ↻] ───────────┘

⚡ Khi có người chắn đường (tạm dừng cả 2 làn)
   └─► [Chào khách] → [Nói chuyện] → ↩ Tiếp tục 2 làn
```

Làn Xe chạy trong ROS worker. Làn Màn hình và nhánh gặp khách chạy trên màn hình robot. Hai bên đồng bộ qua pha của lượt chạy (`MOVING`, `GUEST_HOLD`).

## 2. Mục tiêu / Không làm / Thất bại nếu

**Mục tiêu**
1. Trong lúc xe đi tuyến, màn hình robot phát quảng cáo toàn màn hình.
2. LiDAR phát hiện vật lạ chắn tuyến → xe dừng, lượt chạy vẫn sống, màn hình đổi sang nói chuyện.
3. Khách chào tạm biệt, hoặc không tương tác 20 giây → xe đi tiếp từ điểm tuyến chưa qua, quảng cáo phát lại.
4. Admin bật bằng **Thêm node → Chạy song song** trên canvas của từng workflow. Mặc định tắt.

**Không làm (đợt này)**
- Nhận diện người bằng YOLO trên Pi (người dùng tích hợp sau). Thiết kế chừa chỗ thay bộ phát hiện.
- Dùng camera để quyết định dừng xe.
- Di chuyển lại gần khách, bám theo khách.
- Nhánh pin yếu trên xe thật (vẫn bị chặn như hiện tại).
- Sửa code Pi, ESP32, bridge LiDAR, định vị, tham số Nav2 hoặc behavior tree.

**Thất bại nếu (dù chạy được)**
- Workflow cũ hoặc workflow chưa bật tính năng chạy khác đi.
- Dừng nói chuyện làm lượt chạy chuyển `FAILED`, hoặc xe chạy lại từ đầu tuyến.
- Xe tự chạy tiếp khi khách còn đang nói chuyện.
- Xe dừng vì tường hoặc vật có sẵn trên map.
- Nút **Dừng lượt chạy** không có tác dụng trong lúc xe đang giữ chỗ nói chuyện.
- Camera nhận nhầm người làm tắt quảng cáo hoặc bật micro khi xe đang chạy.

## 3. Ràng buộc từ hệ thống hiện có

- Xe dài 33 cm, rộng 17 cm. LiDAR nằm ở tâm, nên đầu xe cách LiDAR 16,5 cm (`robot_geometry.py`).
- **Sonar trên Pi chặn đi tới khi vật cách 25 cm** (`robot/settings.yaml`, `front_stop_cm: 25`). Xe không thể tự chạy tới mức 20 cm trước đầu xe.
- Nav2 tính lại đường 1 lần/giây và thấy vật cản tới 3 m (`physical_route.xml`, `nav2_params.yaml`). Nếu còn chỗ, nó **lách qua người** trước khi tới gần, nên không thể chỉ kiểm tra vùng ngay trước đầu xe hoặc đường hiện tại của Nav2.
- Khi bị chắn lâu, behavior tree xóa costmap và **lùi 15 cm**. Xe phải dừng trước khi tới bước này.
- `workflow_executor.py` chạy trong WSL trên laptop, không chạy trên Pi. Goal không `SUCCEEDED` hiện làm cả lượt `FAILED`.
- Bridge bỏ scan khi xe quay nhanh, nên bộ phát hiện phải chịu được việc thiếu scan.
- `event_branches` chỉ giữ `LOW_BATTERY` và bị chặn khi chạy xe thật, nên không dùng cho tính năng này.
- Camera kiosk có lớp dự phòng đếm màu da, dễ báo nhầm có người.
- File mới ≤ 500 dòng. Không commit, để thay đổi trong working tree.

## 4. Phương án đã cân nhắc

| Phương án | Đánh đổi | Chọn |
|---|---|---|
| **A. Chỉ LiDAR, so với tuyến đã vẽ và map tĩnh** | Không cần camera, không thêm tải cho Pi. Không phân biệt được người với vali hoặc ghế mới đặt | **Người dùng chọn** |
| B. LiDAR + camera trên màn hình | Ít dừng nhầm hơn, nhưng phụ thuộc trình duyệt và thêm độ trễ | |
| C. YOLO + fusion trên Pi | Chính xác nhất, nhưng node chưa được khởi động và thêm tải cho Pi | Đợt sau |

Về cách biểu diễn luồng, người dùng chọn **2 làn + 1 nhánh ngắt** thay vì công tắc bật/tắt (không thấy được luồng) hoặc số nhánh song song tùy ý (robot chỉ có một bộ điều hướng, một màn hình, một micro nên các nhánh sẽ tranh thiết bị).

## 5. Thiết kế

### 5.1 Trạng thái

| Pha | Xe | Màn hình | Chuyển sang |
|---|---|---|---|
| `MOVING` | Đi tuyến | Quảng cáo, camera không mở hội thoại | `GUEST_HOLD` khi LiDAR báo chắn đường hoặc khách chạm màn hình |
| `GUEST_HOLD` | Đứng yên, đã hủy goal | Nói chuyện | `MOVING` khi khách tạm biệt, hết 20 giây không tương tác, hoặc hết thời gian tối đa |

### 5.2 Phát hiện chắn đường (`robot/ros2_configs/route_block_logic.py`, logic thuần, không import ROS)

Một tia LiDAR được tính là **điểm chắn** khi thỏa cả bốn điều kiện:
1. Cách đường đã vẽ (phần tuyến chưa đi) **≤ 20 cm**.
2. Cách đầu xe **≤ 60 cm** (≤ 76,5 cm tính từ LiDAR).
3. Nằm trong hình nón ±60° phía trước xe.
4. Cách mọi ô vật cản của map tĩnh `/map` **> 15 cm**.

Báo chắn đường khi có **≥ 3 tia liền nhau** là điểm chắn, duy trì **≥ 0,5 giây**. Scan cũ hơn 0,5 giây thì bỏ qua và xóa bộ đếm.

Ước tính xe dừng cách người khoảng 45 cm: 0,5 giây xác nhận + khoảng 0,3 giây dừng, ở 0,15 m/s. Khoảng này nằm ngoài ngưỡng sonar 25 cm, nên sonar vẫn là lớp phanh cuối. Cần đo lại trên xe thật. Các ngưỡng là hằng số đầu file. Ngưỡng cách đầu xe không nên dưới 40 cm.

Điểm nối để đợt sau thêm YOLO: `RouteBlockDetector.update(blocked, now) -> bool`, trong đó `blocked` hiện lấy từ `scan_blocks_route()`.

### 5.3 Bộ thực thi (`workflow_executor.py` + `workflow_guest_hold.py` mới)

- LiDAR chỉ áp dụng cho bước **Đi theo tuyến** khi `parallel.enabled`. Đăng ký `/scan` và `/map` chỉ khi bật.
- Khi báo chắn đường hoặc màn hình báo `ENGAGED`: hủy đúng goal của lượt, ghi `GUEST_HOLD`, đứng chờ.
- Trong lúc giữ: tiếp tục kiểm tra hủy lượt và lease. Lỗi định vị thoáng qua không làm hỏng lượt, nhưng phải sẵn sàng lại mới được đi tiếp.
- Kết thúc giữ: ghi `GUEST_RESUME`, chạy lại tuyến từ điểm chưa qua với deadline mới. Nếu điểm kế tiếp đã nằm trong vùng dung sai thì coi là đã tới.
- Sau khi đi tiếp, **LiDAR bỏ qua chắn đường 30 giây** để Nav2 lách qua nếu khách vẫn đứng đó. Khách chạm màn hình vẫn dừng được xe trong thời gian này.

### 5.4 Backend

- `WorkflowExecutionConfig.parallel`: `enabled`, `screen_step_id`, `guest_step_id`, `no_interaction_sec` (20, từ 5 đến 120), `max_hold_sec` (600, từ 30 đến 1800), `cooldown_sec` (30, từ 0 đến 300). Workflow cũ có giá trị `null`.
- `workflow_lanes.py` tách 3 làn theo dây nối và kiểm tra loại bước. Làn Xe bắt đầu từ bước đầu tiên, chỉ làn này được gửi xuống ROS worker. Khi lưu bản nháp được phép chưa nối đủ, khi chạy thì phải đủ.
- `POST /workflows/runs/guest` nhận `REQUEST` (khách chạm màn hình), `ENGAGED` hoặc `DONE`, ghi vào control file ngay. Xóa trạng thái khách khi đọc được `GUEST_RESUME`, để `DONE` cũ không nhả nhầm lần giữ sau.
- Gửi `ROBOT_RUN_STATUS` qua WebSocket khi đổi pha và mỗi 10 giây.

### 5.5 Màn hình robot

- Nhận `ROBOT_RUN_STATUS`. Pha `MOVING`: mở `RobotAdPlayer`, bỏ qua sự kiện camera để không mở hội thoại hoặc micro.
- Pha `GUEST_HOLD`: đóng quảng cáo, chạy nhánh gặp khách. Bước `COMMUNICATE` của nhánh này được chuyển sang luồng hội thoại AI có sẵn, vì bộ chạy workflow thường chỉ mở mic chứ không gọi AI.
- Trong lúc nói chuyện, cứ 3 giây báo `ENGAGED` nếu robot đang nói, đang xử lý, khách đang nói, đang gọi video, hoặc vừa có tương tác.
- Khách nói lời tạm biệt → báo `DONE`. Khi pha về `MOVING`: dọn phiên như luồng hết giờ hiện có (đóng modal, lưu session, xóa phòng) rồi phát quảng cáo.
- Chạm quảng cáo khi xe đang chạy → báo `ENGAGED`, xe dừng và mở nói chuyện.
- Trạng thái lượt chạy cũ quá 25 giây → màn hình về hành vi kiosk bình thường.

### 5.6 Admin

Trên canvas chế độ xe thật: **Thêm node → Chạy song song** tạo sẵn node Làn Màn hình (bước phát quảng cáo) và node Khi có người chắn đường (Chào khách → Nói chuyện). Chọn một trong hai node để chỉnh thời gian hoặc tắt chạy song song.

### 5.7 Quan hệ với `1ae7114`

**Dựa theo ý tưởng và viết lại gọn:** giữ xe chờ khách, `report_guest`, trạng thái `ROBOT_RUN_STATUS`, `robotRunApi.js`, phần `onRobotRunStatus` của `useNotificationWebSocket.js`.

**Không lấy:** thay đổi ở ESP32, bridge LiDAR, encoder, định vị, retreat, quét map, tham số Nav2, nhánh pin yếu, chính sách lỗi từng bước.

Khác với bản cũ: **xe tự quyết định dừng bằng LiDAR**, còn màn hình chỉ giữ và kết thúc cuộc trò chuyện.

## 6. Trường hợp biên

| Tình huống | Hành vi |
|---|---|
| Vali/ghế chắn tuyến | Xe dừng, màn hình mời nói chuyện, sau 20 giây đi tiếp và Nav2 lách qua |
| Người đi ngang nhanh | Không đủ 0,5 giây, xe không dừng |
| Người đứng sau xe | Ngoài hình nón phía trước, không dừng |
| Màn hình tắt hoặc mất mạng | Xe dừng khi chắn đường, sau 20 giây tự đi tiếp |
| Khách nói quá lâu | Xe giữ tối đa 10 phút |
| Admin dừng lượt khi đang giữ | Lượt chuyển `CANCELLED`, màn hình về bình thường |
| Mất lease backend khi đang giữ | Lượt dừng theo cơ chế an toàn hiện có |
| Lối đi hẹp, người không tránh sau khi nói xong | Nav2 xử lý như vật cản hiện tại, có thể báo lỗi tuyến |

## 7. Kiểm thử

- **Robot (pytest, Nav2 giả):** từng điều kiện của điểm chắn, tường trên map không kích hoạt, scan cũ, cooldown, giữ rồi đi tiếp đúng điểm, hủy khi đang giữ, tính năng tắt thì hành vi không đổi. `robot/tests/` đang bị gitignore; test mới là `test_parallel_guest_hold.py`, chạy với `--noconftest` vì `conftest.py` còn import code đã revert.
- **Backend:** tách làn, lưu/đọc `parallel`, giới hạn giá trị, `report_guest`, chuyển pha, `DONE` cũ không nhả lần giữ mới.
- **Frontend (Vitest):** quảng cáo theo pha, camera bị bỏ qua khi `MOVING`, báo `ENGAGED`/`DONE`, trạng thái cũ.
- **Xe thật, có người giám sát:** người đứng giữa tuyến ở sảnh rộng và lối hẹp, đi ngang, đi dọc tường, đặt vali, nói chuyện rồi tạm biệt, im lặng, tắt màn hình khi đang giữ, dừng lượt khi đang giữ. Đo khoảng cách dừng thực tế.

## 8. Quyết định

**Người dùng đã chọn:** chỉ dùng LiDAR đợt này, YOLO trên Pi tích hợp sau, camera quay về hướng xe chạy.

**Claude đề xuất (người dùng có thể sửa):**
1. Giữ 20 cm làm **độ lệch khỏi tuyến**, và dừng khi vật cách đầu xe **60 cm**, vì 20 cm trước đầu xe nằm trong vùng sonar chặn và Nav2 sẽ lách trước khi tới đó.
2. Hết 20 giây không tương tác thì đi tiếp, tối đa giữ 10 phút, bỏ qua LiDAR 30 giây sau khi đi tiếp.
3. Chạm màn hình khi xe đang chạy cũng dừng xe để nói chuyện.
4. Video quảng cáo giữ tắt tiếng mặc định như hiện tại.
5. Chỉ áp dụng cho bước Đi theo tuyến, không áp dụng cho `MOVE` đơn lẻ.

## 9. Để lại cho người làm

Cách tách code từ `1ae7114`, tên hàm phụ, cách tính khoảng cách điểm đến tuyến, câu chào và nhãn tiếng Việt, kiểu hiển thị công tắc.
