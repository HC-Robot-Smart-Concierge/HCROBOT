# Tổng kết Maintenance và ngôn ngữ robot — 11/11/2026

## 1. Trạng thái bàn giao

- Repository: `D:\do_an_fptu\HCROBOT`.
- Nhánh đang làm: `maintenance-ticket-grouping`.
- Commit `3445829`: chống tạo phiếu trùng, gộp triệu chứng theo thiết bị và sắp xếp hàng đợi Maintenance; đã đẩy lên origin.
- HEAD khi viết tài liệu: `810fc92`. Commit này còn bao gồm các chỉnh sửa Bellman, FloorMap và xóa các file test trước đó.
- Phần sửa ngôn ngữ đã commit ở `a630cf0`.
- Phần sửa nhận diện báo triệu chứng bằng giọng nói (mục 2b) và tài liệu này đang ở working tree, chưa commit/push.
- Không tạo file test mới. Phần nghiệm thu UI bằng giọng nói và trên iPhone X để người dùng thực hiện.

## 2. Lỗi nói tiếng Việt nhưng menu hiện tiếng Anh

### Nguyên nhân

`RobotScreenPage` lưu ngôn ngữ của cuộc hội thoại trong state `language`, cập nhật từ `detected_language` của phản hồi AI hoặc nút đổi ngôn ngữ trên robot.

Trong khi đó, `RobotMaintenanceMenuScreen` lại đọc `LanguageContext` của trang quản trị. Context này dùng `aurora_language` và mặc định là `EN`. Vì vậy, robot có thể đang nói tiếng Việt nhưng danh mục báo hỏng vẫn lấy tên và mô tả tiếng Anh.

Một số nhãn như “Kỹ Thuật”, “Về Robot”, số phòng và đơn vị thời gian còn cố định bằng tiếng Việt, làm màn hình hiển thị lẫn hai ngôn ngữ.

### Đã sửa

- `RobotScreenPage` truyền `language={language}` vào menu báo hỏng.
- `RobotMaintenanceMenuScreen` nhận ngôn ngữ qua prop, bỏ phụ thuộc vào ngôn ngữ trang quản trị.
- Tên danh mục, tên sự cố, mô tả, nút chọn và thông báo dùng ngôn ngữ của phiên robot.
- Bổ sung hiển thị song ngữ cho nhãn kỹ thuật, nút về robot, nhãn số phòng, tooltip đóng/làm mới và đơn vị thời gian trong menu.
- Khi component được dùng riêng mà không truyền ngôn ngữ, mặc định vẫn là English.
- Không thay đổi `aurora_language` hoặc cấu hình ngôn ngữ của Admin/Staff khi khách nói tiếng Việt.

### Các file sửa trong lần này

| File | Nội dung |
|---|---|
| `frontend/src/pages/robot/RobotScreenPage.jsx` | Truyền ngôn ngữ cuộc hội thoại vào menu Maintenance |
| `frontend/src/components/robot/RobotMaintenanceMenuScreen.jsx` | Dùng ngôn ngữ nhận từ robot; hoàn thiện các nhãn song ngữ trong menu |

## 2b. Báo thêm triệu chứng bằng giọng nói bị trả lời giới thiệu thiết bị

### Nguyên nhân

Khi phòng đã xác thực và đang có phiếu điều hòa, khách nói “điều hòa phòng tôi còn bị chảy nước nữa” thì robot trả lời kịch bản Fast-Path `scn-air-conditioner` (vị trí bảng điều khiển). Bộ lọc chỉ bỏ qua Fast-Path khi câu có động từ yêu cầu như “sửa/cần/muốn/xin”. Câu chỉ mô tả triệu chứng không có các từ này nên khớp từ khóa “điều hòa” của kịch bản giới thiệu.

### Đã sửa

- `maintenance_request_service.py`: thêm `is_fault_report()` = có tên thiết bị (dùng chung `DEVICE_PATTERNS`) và có triệu chứng (chảy nước, rò rỉ, không mát, không lên, kêu to, chập chờn, tắc, yếu, leaking, not working…).
- `ollama_service.py`: câu báo hỏng bỏ qua Fast-Path, áp dụng cho cả `/chat` và `/chat/stream`.
- `concierge_graph.py`: câu báo hỏng được phân loại `maintenance`, kể cả khi có từ như “nước” vốn thuộc room service.
- `ai_chat_service.py`: câu báo hỏng không dùng Redis cache.
- Câu hỏi thông tin như “điều hòa”, “chỉnh điều hòa thế nào”, “wifi password là gì” vẫn trả lời bằng Fast-Path như cũ.

### Kiểm tra trong bộ nhớ

11 câu báo hỏng tiếng Việt/English đều vào `maintenance`; 8 câu không phải báo hỏng (kể cả “phòng có tivi hông”, “đồ ăn không nóng”) không bị nhận nhầm. Câu “điều hòa phòng tôi còn bị chảy nước nữa” nhận đúng thiết bị `air_conditioner` nên được gộp vào phiếu điều hòa đang mở. Không ghi DB, không tạo file test trong repo.

## 3. Chống spam phiếu Maintenance đã hoàn thành trước đó

| Tình huống | Cách xử lý |
|---|---|
| Cùng phòng, lặp lại cùng sự cố khi phiếu còn mở | Trả lại mã phiếu đang có; không tạo phiếu hoặc thông báo mới |
| Cùng phòng, thêm triệu chứng khác của cùng loại thiết bị | Bổ sung mô tả vào phiếu đang mở; thông báo nội dung bổ sung |
| Khác thiết bị, dù cùng danh mục lớn | Tạo phiếu riêng; ví dụ Wi-Fi và TV, vòi nước và thoát nước |
| Khác phòng | Tạo phiếu riêng |
| Phiếu trước đã hoàn thành, hủy hoặc từ chối | Cho phép tạo phiếu mới |

Khi bổ sung triệu chứng, hệ thống giữ nguyên trạng thái, kỹ thuật viên, mức ưu tiên và thời điểm tạo phiếu. Quy tắc dùng chung cho danh mục trên robot, PIN/NFC và yêu cầu qua giọng nói. Khóa giao dịch theo phòng bảo vệ trường hợp nhiều yêu cầu đến đồng thời.

Các file chính:

- `backend/app/services/maintenance_request_service.py`: nhận diện thiết bị, tìm phiếu mở, chống trùng và gộp triệu chứng.
- `backend/app/api/v1/endpoints/operations/maintenance.py`: API tạo phiếu, hàng đợi, tra cứu và đổi độ khẩn.
- `backend/app/api/v1/endpoints/operations/reception.py`: áp dụng cho luồng xác thực PIN/NFC.
- `backend/app/services/ai/ai_ticket_service.py`, `ai_chat_service.py`: áp dụng cho yêu cầu giọng nói và phản hồi đúng kết quả lưu phiếu.
- `frontend/src/pages/dashboard/MaintenanceDashboard.jsx`: hiển thị hàng đợi và thao tác của nhân viên.

## 4. Quy tắc ưu tiên hiện đã triển khai

1. Phiếu đang mở được xếp trước lịch sử phiếu đã đóng.
2. Trong các phiếu đang mở, phiếu được nhân viên đánh dấu **Urgent** đứng trước.
3. Trong cùng mức ưu tiên, phiếu được tạo sớm hơn đứng trước.
4. Gửi lại hoặc bổ sung triệu chứng không đổi thời điểm tạo, nên không chen lên đầu hàng.
5. Chỉ tài khoản Maintenance/Admin được đổi độ khẩn qua API; khách không tự đặt độ khẩn khi tạo phiếu.

Dashboard có nút đánh dấu/bỏ khẩn cấp, nút làm mới và tự tải lại dữ liệu sau mỗi 15 giây khi lần tải trước hoàn tất. Các phiếu đang mở không bị mất khỏi danh sách vì giới hạn 100 phiếu lịch sử.

Đây là thứ tự hàng đợi của bộ phận Maintenance. Phần này không triển khai cơ chế tự ngắt hoặc đổi thứ tự các workflow di chuyển của robot.

## 5. Những kiểm tra đã thực hiện

### Phần ngôn ngữ lần này

- Build frontend bằng `npm run build`: thành công.
- Kiểm tra render 8 tổ hợp: ngôn ngữ portal `EN`/`VI` kết hợp ngôn ngữ robot `English`/`EN`/`Tiếng Việt`/`VI`.
- Xác nhận tên sự cố, nút về robot và nhãn số phòng theo ngôn ngữ robot, kể cả khi portal dùng ngôn ngữ ngược lại.
- Xác nhận trang robot truyền state ngôn ngữ vào menu.
- Các kiểm tra chạy trong bộ nhớ, không lưu file test và không gửi yêu cầu dịch vụ thật.
- Chưa nghiệm thu bằng microphone hoặc Safari trên iPhone thật.

### Phần phiếu và hàng đợi ở lần trước

Đã kiểm tra qua bảng tạm PostgreSQL và API: gộp điều hòa, gửi lặp song ngữ, phân biệt thiết bị/phòng, bảo toàn người nhận và thời gian tạo, luồng PIN/NFC/voice, mở phiếu mới sau khi đóng, phân quyền đổi độ khẩn, thứ tự FIFO và khóa đồng thời. Các kiểm tra này không tạo phiếu thử trong bảng dữ liệu nghiệp vụ thật.

## 6. Hướng dẫn người dùng test UI

### Ngôn ngữ

1. Tải lại trang robot để nhận code mới. Giữ Settings của portal ở English.
2. Nói: **“Tôi cần sửa điều hòa”** hoặc **“Cho tôi xem danh mục báo hỏng”**.
3. Khi menu mở, kiểm tra tên danh mục, tên sự cố và nút thao tác đều bằng tiếng Việt, ví dụ “Điều Hòa”, “Điều hòa không mát”, “Báo sửa”.
4. Chọn một sự cố; kiểm tra phần xác nhận, thời gian hỗ trợ và thông báo gửi phiếu dùng tiếng Việt.
5. Quay về robot, chọn English rồi mở lại menu. Tên sự cố và các nút của menu phải chuyển sang tiếng Anh.
6. Đổi portal sang tiếng Việt, chọn English trên robot và mở menu lại: menu vẫn phải theo robot.
7. Lặp lại trên iPhone X xoay ngang. Kiểm tra có thể cuộn danh mục, chọn phòng và đóng menu bình thường.

### Phiếu sửa chữa

1. Chọn một phòng đã xác thực, báo “Điều hòa không mát”. Ghi lại mã phiếu.
2. Báo thêm “Điều hòa chảy nước” trong cùng phòng: phải bổ sung vào cùng mã phiếu, có đủ hai mô tả.
3. Nói với robot “Điều hòa phòng tôi còn bị chảy nước nữa”: robot phải báo đã bổ sung vào phiếu đang mở, không giới thiệu bảng điều khiển điều hòa.
4. Gửi lại sự cố vừa chọn: không thêm phiếu và không thêm thông báo trùng.
5. Báo lỗi Wi-Fi rồi lỗi TV: phải là hai phiếu khác nhau.
6. Trên Dashboard Maintenance, đánh dấu một phiếu đang chờ là khẩn cấp: phiếu lên nhóm ưu tiên. Bỏ khẩn cấp: phiếu trở về vị trí theo thời gian tạo.
7. Hoàn thành phiếu điều hòa, sau đó báo hỏng lại: phải được tạo phiếu mới.

## 7. Giới hạn và việc cần tiếp tục

- Các phiếu trùng đã tồn tại từ trước không tự động bị xóa hay hợp nhất lịch sử.
- Theo thiết kế, mỗi phòng chỉ có 1 điều hòa và 1 TV, nên nhận diện theo loại thiết bị là đủ cho hai thiết bị này. Đèn, ổ cắm, vòi nước, thoát nước có thể có nhiều cái trong phòng nhưng được gộp chung theo loại: triệu chứng khác nhau vào cùng một phiếu để kỹ thuật viên xử lý trong một lượt; chọn lại đúng cùng một sự cố trong danh mục được coi là gửi lặp.
- Nội dung tự do không nhận diện rõ một thiết bị duy nhất chỉ áp dụng chống trùng theo nội dung; tránh gộp nhầm nhiều thiết bị.
- `RoomPinModal` và `RoomPickerModal` còn có nhãn tiếng Việt cố định. Nếu cần toàn bộ luồng xác thực/chọn phòng bằng English, cần rà soát riêng các component dùng chung này. Lần sửa này xử lý nguồn ngôn ngữ và các nhãn của menu Maintenance.
- Cần người dùng nghiệm thu giọng nói tiếng Việt và thao tác thật trên iPhone X theo mục 6.
- Câu báo hỏng kèm từ hỏi đường/thông tin (ví dụ có “đến”, “thế nào”) vẫn bị bộ phân loại coi là câu hỏi FAQ và trả lời bằng LLM, không tạo phiếu.
- Sau khi nghiệm thu, commit/push phần sửa nhận diện báo triệu chứng và tài liệu trên nhánh `maintenance-ticket-grouping`.
