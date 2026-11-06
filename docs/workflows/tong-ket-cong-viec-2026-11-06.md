# Tổng kết công việc ngày 06/11/2026

Nhánh `lobby-map-doors`, tính từ commit `fe3f6a3`. Trạng thái chi tiết, luồng demo và cách nghiệm thu trên UI nằm ở [ban-giao-mo-phong-sanh.md](ban-giao-mo-phong-sanh.md).

## Tóm tắt

- **Đích di chuyển đã khớp bản đồ sảnh mới.** Cả workflow mẫu lẫn các bản đã lưu trong DB đều được sửa.
- **Workflow có bước chờ khách chọn và rẽ nhánh.** Bước mới tên `CHOICE`. Studio và màn hình robot dùng chung một quy tắc chọn bước kế tiếp.
- **Có kịch bản demo WF09 cho tình huống khách hỏi chỗ ăn tối.** WF09 đã chạy thử thành công trong Studio.
- **Robot tự về trạm sạc khi pin yếu bằng kịch bản WF10.** Phần này chưa được chạy thử trên UI.

| Commit | Nội dung |
|---|---|
| `5db5332` | Đưa đích di chuyển của workflow về waypoint của bản đồ mới |
| `f5865fb` | Thêm bước `CHOICE` và quy tắc rẽ nhánh dùng chung |
| `b171848` | Thêm kịch bản demo WF09 |
| `8d21fc5` | Cập nhật tài liệu bàn giao sau phần rẽ nhánh và demo |
| `7f1f066` | Thêm cơ chế pin yếu và kịch bản WF10 |
| `dd41e9a` | Bổ sung phần pin yếu vào tài liệu bàn giao |
| `ac8d27c` | Ghi thay đổi marker trạm sạc trong file world. Commit này nằm ngoài các phần việc trên. |

## 1. Đích di chuyển khớp bản đồ sảnh mới

Trước đây workflow mẫu vẫn dùng tọa độ của sảnh cũ 10 × 6 m. Các bản đã lưu trong DB giữ nguyên tọa độ cũ, vì backend chỉ thêm workflow còn thiếu chứ không cập nhật bản đã có.

| Workflow | Tọa độ cũ | Tọa độ mới |
|---|---|---|
| WF01 · Đón khách | `(5.20, 1.00)` | Cửa trước `(0.90, 6.25)` |
| WF04 · Gặp lễ tân | `(6.40, 2.00)` | Trước quầy `(11.44, 2.80)` |
| WF05, WF07 · Về trạm | `(3.20, 2.80)` | Vị trí chờ `(7.20, 9.60)` |
| WF06 · Tuần tra | `(4.80, 2.50)` | Tâm sảnh `(8.40, 6.40)` |
| WF07 · Thang máy | `(7.70, 4.20)` | Thang máy `(15.60, 6.96)` |
| Đón Khách & Hướng Dẫn Dịch Vụ Sảnh Chính | `(0, 0)` | Trước quầy `(11.44, 2.80)`, vì tên đích đã lưu là "Quầy Lễ Tân" |

Cách làm:

- **Một bảng waypoint ở backend.** `LOBBY_WAYPOINTS` trong `backend/app/api/v1/endpoints/default_workflows.py` khớp với waypoint trên web và trong bộ điều hướng ROS.
- **Nâng cấp bản đã lưu.** Lần đầu danh sách workflow được tải sau khi backend khởi động, hàm `upgrade_legacy_move_step` chuyển các bước MOVE còn giữ đúng tọa độ mẫu cũ sang waypoint mới. Hàm này cũng xử lý điểm `(0, 0)`. Bước nào người dùng đã chỉnh sang tọa độ khác thì được giữ nguyên.
- **Web dùng cùng quy tắc.** Hàm `resolveMoveTarget` trong `workflowSimulatorUtils.js` nhận ra tọa độ mẫu cũ, phòng khi bản đã lưu chưa được nâng cấp.

## 2. Bước CHOICE và rẽ nhánh

Trước đây cả Studio và màn hình robot chỉ chạy bước kế tiếp theo thứ tự.

**Cách hoạt động:**

- **Bước `CHOICE`** hiện các nút lựa chọn và nghe khách nói. Khi khách chạm nút, hoặc nói từ khóa khớp đúng một lựa chọn, robot chuyển tới bước của lựa chọn đó.
- **Hết giờ và hủy có nhánh riêng.** Thời gian chờ mặc định là 30 giây. Khi hết giờ, robot theo `timeout_next_step_id`. Khi khách bấm Hủy hoặc nói "hủy bỏ", "không cần nữa", robot theo `cancel_next_step_id`. Nếu không đặt hai trường này, phiên kết thúc.
- **Mọi bước có thể đặt `next_step_id`** để các nhánh nhập lại với nhau. Để trống nghĩa là sang bước kế tiếp theo thứ tự. Giá trị `END` kết thúc phiên. Nếu trỏ tới bước không tồn tại, phiên cũng kết thúc, và Studio cảnh báo trước khi chạy.
- **Workflow cũ không đổi cách chạy**, vì không dùng các trường mới này.

Ví dụ tham số của một bước `CHOICE`:

```json
{
  "prompt": "Quý khách muốn xem bản đồ hay để em dẫn tới thang máy ạ?",
  "timeout_sec": 30,
  "options": [
    { "id": "map", "label": "Xem bản đồ", "keywords": ["bản đồ", "map"], "next_step_id": "wf9-show-map" },
    { "id": "guide", "label": "Dẫn tới thang máy", "keywords": ["dẫn đường", "thang máy"], "next_step_id": "wf9-guide-move" }
  ],
  "timeout_next_step_id": "wf9-anything-else",
  "cancel_next_step_id": "wf9-anything-else"
}
```

**Phần dùng chung giữa hai màn hình:**

- `frontend/src/utils/workflowFlow.js`: hàm `resolveNextStepIndex` chọn bước kế tiếp, và hàm `matchChoiceFromSpeech` khớp lời khách nói với lựa chọn.
- `frontend/src/pages/admin/tabs/workflow/KioskChoicePrompt.jsx`: khung lựa chọn hiển thị trên cả hai màn hình.

**Thay đổi theo từng màn hình:**

- **Studio.** Khung lựa chọn hiện trên sa bàn. Thanh tiến trình đánh dấu các bước đã thực sự chạy, nên bước của nhánh bị bỏ qua không bị tô là đã chạy.
- **Màn hình robot.** Bộ chạy `useWorkflowRunner` được viết lại để dùng quy tắc chung. Màn hình robot nay nhận lệnh `WORKFLOW_DISPATCH` khi bấm "Phát kịch bản xuống Robot" trong Studio. Trước đây màn hình robot không có cách nào để khởi động workflow. Màn hình robot cũng đọc lời thuyết minh của bước SHOW và lời phát khi di chuyển của bước MOVE, giống Studio.
- **Trình soạn workflow.** Trình soạn sửa được lựa chọn, từ khóa và bước đích của `CHOICE`, cùng ô "Sau bước này" cho mọi bước. Đã sửa thêm một lỗi có sẵn: khi chọn đích cho bước MOVE, trước đây chỉ thay đổi cuối cùng được lưu.

## 3. Demo WF09: khách hỏi chỗ ăn tối

WF09 có 15 bước, ghép từ WF01, WF02, WF07 và WF05. Diễn biến:

1. Robot ra cửa trước đón khách, mời chọn ngôn ngữ và hỏi nhu cầu.
2. Robot gợi ý nhà hàng Tầng 2.
3. Khách chọn **Xem bản đồ** hoặc **Dẫn tới thang máy**. Ở nhánh bản đồ, robot đứng yên và hiện đường đi. Ở nhánh dẫn đường, robot đi tới thang máy và chỉ sang bước sau khi Gazebo báo đã tới nơi.
4. Hai nhánh cùng quay về bước hỏi khách còn cần gì. Khách chọn **Hỏi thêm** thì robot trò chuyện tiếp rồi hỏi lại.
5. Khách đánh giá, robot chào và về vị trí chờ một lần.

Nếu khách không chọn hoặc bấm Hủy ở bước chọn đường, robot chuyển thẳng sang bước hỏi thêm. WF09 được tạo ở trạng thái tắt, để danh sách workflow đang bật không thay đổi.

## 4. Pin yếu và về trạm sạc

Giả định đã thống nhất:

- Robot không có mạch đo pin. Một số phần trăm ước lượng đại diện cho cả pin động cơ và pin Pi 5, vì hai bộ có cùng dung lượng và được sạc cùng lúc.
- Nhân viên cắm sạc tay. Điểm trạm sạc vẫn hiện trên map.

| Mức pin | Robot làm gì |
|---|---|
| Từ 20% | Không nhận khách mới, phục vụ xong khách hiện tại rồi về trạm sạc |
| Từ 10% | Dừng phiên ngay, báo khách rồi về trạm sạc |
| Đạt 80% | Nhận khách trở lại |

**Cách hoạt động:**

- **WF10 là kịch bản về sạc.** Kịch bản có `trigger_type` là `LOW_BATTERY` và gồm hai bước: đi tới trạm sạc, rồi báo nhân viên. Bước MOVE loại `CHARGER` đi tới điểm trạm sạc đang hiện trên map. Nếu map không có điểm nào như vậy, robot đi tới `(6.00, 9.60)`.
- **Màn hình robot** đọc phần trăm pin ước lượng từ Pi 5 mỗi 15 giây. Khi pin yếu, màn hình không mở phiên mới mà báo khách tới quầy lễ tân. Khách đang trò chuyện vẫn được nói tiếp cho tới khi phiên kết thúc. Khi WF10 kết thúc, màn hình tạo một phiếu Maintenance thật tên "Robot cần cắm sạc".
- **Studio** có thanh kéo Pin giả lập trong Tùy chọn mô phỏng, vì Gazebo không mô phỏng pin. Studio chỉ hiện thông báo, không gửi phiếu.
- **Khi chưa đọc được pin**, robot giữ nguyên trạng thái trước đó.
- **Sau khi sạc**, nhân viên nhập lại phần trăm pin trong Robot Control. Cách khác là cấp nguồn lại cho Pi, khi đó bộ ước lượng coi pin là đầy.

Quy tắc nằm trong `frontend/src/utils/batteryPolicy.js`. Cả ba mốc 20%, 10% và 80% được khai báo ở đầu file này. Hook `frontend/src/hooks/useLowBatteryGuard.js` áp dụng quy tắc trên từng màn hình.

## Kiểm tra đã chạy

| Kiểm tra | Kết quả |
|---|---|
| Test backend `tests/test_workflows_lobby.py` và `tests/test_communicate_step_and_workflow.py` | 10 qua |
| Toàn bộ test frontend | 219 qua |
| Build frontend | Thành công |
| Chạy quy tắc rẽ nhánh trên WF09 lấy từ API | Bốn trường hợp chọn bản đồ, dẫn đường, hết giờ và hủy đều đi đúng |
| Tìm đường trên web tới các đích mới và tới trạm sạc | Đều có đường đi |
| Chạy WF09 trong Studio | Thành công khi chạy trên máy có UI |
| Chạy phần pin yếu trên UI | Chưa chạy |

Test `tests/test_waypoint_gazebo_sync.py` không được chạy, vì test này ghi đè file world thật.

## Việc còn lại và vấn đề đã biết

- **Waypoint trong DB là dữ liệu thử nghiệm.** Điểm trạm sạc trên map hiện là "Trạm Sạc #2" tại `(3.95, 6.60)`, nên WF10 đưa robot tới đó. Backend ghi waypoint vào marker Gazebo theo thứ tự chứ không theo loại điểm, nên marker trạm sạc trong Gazebo đang ở `(2.33, 5.96)`.
- **Bước MOVE trên màn hình robot vẫn chờ theo thời gian.** Màn hình robot chưa nhận tín hiệu tới đích. Vì vậy phiếu gọi nhân viên cắm sạc được gửi khi hết thời gian chờ của bước.
- **Luồng đặt taxi trên màn hình robot có lỗi có sẵn.** Khi khách chưa có phiên phòng, code gọi `setPinModalNote` nhưng hàm này chưa được khai báo trong `RobotScreenPage.jsx`.
- **WF03 và WF08 vẫn cố định phòng `304`.** Hai workflow này thuộc phần việc làm luồng yêu cầu dịch vụ.
- **Chưa làm** luồng gặp nhân viên, và chức năng tạm dừng quảng cáo của WF06 khi có khách.
- **Đề xuất chưa làm: tách workflow thành hai tầng.** Tầng kịch bản phục vụ đi trọn một nhu cầu của khách. Tầng khối dùng lại gồm các đoạn như đón khách, gợi ý, dẫn đường. Kịch bản phục vụ sẽ gọi khối qua một loại bước mới, thay vì chép từng bước như WF09 đang làm.
