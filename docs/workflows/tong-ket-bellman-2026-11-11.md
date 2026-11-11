# Tổng kết yêu cầu Bellman — 11/11/2026

## 1. Trạng thái bàn giao

- Nhánh: `feature/bellman-requests`, tạo từ `development` (`0cf6cf4`).
- Toàn bộ thay đổi đang ở working tree, chưa commit/push.
- Không tạo file test mới trong repo. Phần nghiệm thu bằng giọng nói và trên iPhone X để người dùng thực hiện (mục 6).

## 2. Khách có thể yêu cầu Bellman những gì

| Mã dịch vụ | Tên hiển thị | Ví dụ câu nói |
|---|---|---|
| `luggage_delivery` | Mang hành lý lên phòng | “Mang hành lý lên phòng giúp tôi”, “bring my luggage to my room” |
| `luggage_pickup` | Lấy hành lý xuống sảnh | “Tôi trả phòng, lấy hành lý xuống sảnh”, “pick up my bags” |
| `luggage_storage` | Gửi giữ hành lý | “Tôi muốn gửi hành lý”, “store my luggage” |
| `luggage_retrieval` | Lấy lại hành lý đã gửi | “Lấy lại hành lý đã gửi”, “my stored luggage” |
| `room_move` | Chuyển đồ sang phòng mới | “Chuyển hành lý sang phòng mới giúp tôi” |

- Taxi vẫn là luồng riêng như trước.
- Chỉ nói “tôi muốn chuyển phòng” (đổi phòng) vẫn do Lễ tân trả lời; Bellman chỉ chuyển đồ. Phiếu `room_move` được báo cho cả Bell Services và Lễ tân, lời nhắn cho khách nói Lễ tân sẽ xác nhận phòng mới.
- Yêu cầu chung chung (“tôi cần hỗ trợ hành lý”, “menu hành lý”) hoặc khi chưa biết phòng: robot mở menu Hành lý & Bellman để khách chọn.

## 3. Lỗi đã tìm thấy và sửa

| Lỗi | Hậu quả | Đã sửa |
|---|---|---|
| PIN/NFC lưu phiếu với `DEP-BELLMAN`/`ST-BELLMAN`, DB chỉ có `DEP-BELL` | Yêu cầu Bellman qua PIN lỗi khóa ngoại, không lưu được | Dùng `DEP-BELL`/`ST-BELL`, thông báo tới “Bell Services” |
| Luồng PIN bằng giọng nói luôn gửi `skip_ticket_creation` (mặc định của `RoomPinModal` từ `fdfb332`) | Khách nói yêu cầu, nhập PIN xong không có phiếu nào | Bật tạo phiếu cho action `bellman` |
| Phiên AI mất xác thực nhưng màn hình còn phòng đã xác thực | Yêu cầu Bellman thành phiếu cuộc gọi video Concierge `CCG-` | Gửi thẳng tới API Bellman |
| Regex động từ yêu cầu trong `concierge_graph.py` và `ai_chat_service.py` có ký tự backspace thật (`\x08`) thay cho `\b` | Regex không bao giờ khớp; yêu cầu dịch vụ khi đã biết phòng dễ rơi vào câu trả lời soạn sẵn | Thay bằng `\b` |
| Bộ phân loại so khớp chuỗi con cả từ khóa ngắn | “c**huy**ển” → hủy dịch vụ, “c**hu**yển”/“n**hư**”/“k**hu**”/“t**hu**ê” → báo hỏng, “xe l**ăn**” → gọi món, “**tui** muốn ăn cơm” → Bellman | Từ khóa ≤ 3 ký tự chỉ khớp nguyên từ (`contains_keyword`); bỏ `huy`, `tui`, `túi`, `mang đồ`, `chuyển phòng` khỏi danh sách |
| “menu hành lý” chứa từ “menu” của FAQ | Bị trả lời như câu hỏi thông tin | Từ khóa menu Bellman được ưu tiên |
| Dashboard Bell hiển thị dữ liệu mẫu khi chưa có phiếu; `createBellRequest` trả phiếu giả khi lỗi mạng | Nhân viên thấy yêu cầu không có thật; khách được báo đã gửi dù thất bại | Bỏ dữ liệu mẫu; API ném lỗi khi thất bại |
| Luồng `/chat/stream` dùng action của bộ phân loại thay vì của FSM | Vẫn tạo phiếu khi FSM đã mở menu | Dùng action của FSM |
| Tra cứu tiến độ chỉ biết đồ ăn, dịch vụ phòng, sửa chữa, taxi | “Hành lí tôi đem lên chưa” trả lời bằng đơn món gần nhất (“đơn món của phòng 301 đã được hủy”) | Câu hỏi có từ hành lý được đánh dấu `bellman` và trả lời theo phiếu Bellman của phòng; thêm cách viết “hành lí” và các câu hỏi tiếng Anh (“arrived yet”, “where are my bags”) |

## 4. Thay đổi chính

**Backend**

- `backend/app/services/bell_request_service.py` (mới): danh mục 5 dịch vụ, nhận diện dịch vụ từ câu nói, tạo phiếu dùng chung cho giọng nói, PIN/NFC và menu. Khóa theo phòng; phòng đã có yêu cầu cùng dịch vụ đang mở thì trả lại phiếu đó (`duplicate`).
- `operations/bell_services.py`: `POST /bell-services/requests` nhận `service_key` (mã dịch vụ hoặc `auto`); không có `service_key` (nhân viên tạo nhanh) giữ cách cũ. Thêm `GET /bell-services/rooms/{room}/status`.
- `operations/reception.py`: nhánh Bellman của PIN/NFC dùng service mới.
- `ai/ai_chat_service.py`, `ai/ai_ticket_service.py`: tạo phiếu Bellman trước khi trả lời để robot đọc đúng mã phiếu hoặc báo yêu cầu đã tồn tại.
- `ai/concierge_graph.py`, `ai/constants.py`, `ai/ollama_service.py`: từ khóa, mở menu `open_bellman_menu`, sửa các lỗi nhận diện ở mục 3.
- `models/support_request.py`, `schemas/operations.py`: trường `bell_service`, `duplicate`, schema tiến độ theo phòng.

**Frontend**

- `components/robot/RobotBellmanMenuScreen.jsx` (mới): menu chạm theo mẫu menu Báo hỏng: chọn dịch vụ, số kiện (1/2/3/4+), thời gian (ngay/15/30 phút), chọn phòng, xác thực PIN/NFC, xem tiến độ. Song ngữ theo ngôn ngữ robot.
- `pages/robot/RobotScreenPage.jsx`, `components/robot/MobileRobotScreen.jsx`: mở menu từ giọng nói và từ menu nhanh; xử lý kết quả Bellman; không bật chỉ đường khi câu có “lên phòng”.
- `pages/dashboard/BellServicesDashboard.jsx`: dữ liệu thật, tự tải lại mỗi 15 giây, nút Làm mới, yêu cầu đang mở xếp trước theo thứ tự cũ nhất, tiêu đề theo tên dịch vụ (dịch theo ngôn ngữ nhân viên).

## 5. Những kiểm tra đã thực hiện

- Nhận diện trong bộ nhớ: 19 câu Bellman/không phải Bellman đều đúng; bộ 19 câu báo hỏng của Maintenance vẫn đúng.
- Câu hỏi tiến độ hành lý (Việt/Anh, “hành lí”/“hành lý”) đều vào nhánh `bellman`; câu hỏi đồ ăn và khăn tắm vẫn vào nhánh cũ. Câu trả lời đúng cho phòng chưa có phiếu và cho phiếu đang chờ / đang xử lý / đã hoàn tất (transaction rollback).
- So sánh quy tắc từ khóa cũ/mới trên 57 câu dịch vụ thường gặp: 5 câu đổi kết quả, cả 5 là sửa nhận nhầm cũ; 52 câu giữ nguyên.
- Gọi HTTP thật tới PostgreSQL trong một transaction rồi rollback: tạo từ menu, gửi lặp (trả phiếu cũ), `auto` nhận diện dịch vụ, yêu cầu nhân viên giữ cách cũ, tiến độ theo phòng, dashboard, PIN với `bellman` tạo phiếu và lần lặp trả phiếu cũ. Sau kiểm tra DB có 0 phiếu Bellman.
- `npm run build` thành công; render menu (Việt/Anh) và dashboard trong bộ nhớ.
- Chưa nghiệm thu bằng microphone hoặc Safari trên iPhone thật.

## 6. Hướng dẫn người dùng test UI

Khởi động lại backend và tải lại trang robot trước khi test.

### Giọng nói

1. Chưa xác thực phòng, nói “Mang hành lý lên phòng giúp tôi”: robot mở menu Hành lý & Bellman.
2. Xác thực phòng 301 bằng PIN, nói “Mang hành lý lên phòng giúp tôi”: robot đọc mã phiếu `BS-…`; bản đồ chỉ đường không bật.
3. Nói lại câu trên: robot báo phòng đã có yêu cầu đang chờ, không tạo phiếu mới.
4. Nói “Chuyển hành lý sang phòng mới giúp tôi”: tạo phiếu chuyển đồ và nhắc Lễ tân sẽ xác nhận phòng mới. Nói “Tôi muốn chuyển phòng”: robot hướng dẫn liên hệ Lễ tân, không tạo phiếu Bellman.
5. Nói “Menu hành lý” hoặc “Tôi cần hỗ trợ hành lý”: mở menu.
6. Nói “Tui muốn ăn cơm”: phải ra luồng đồ ăn, không phải Bellman.
7. Sau bước 2, hỏi “Hành lí tôi đem lên chưa”: robot đọc trạng thái phiếu `BS-…` (đang chờ / nhân viên đang xử lý / đã hoàn tất), không nhắc tới đơn món. Hỏi “Món ăn của tôi tới chưa” vẫn trả lời theo đơn món.

### Menu chạm

1. Mở menu nhanh → “Hành lý & Bellman”. Kiểm tra 5 dịch vụ, lọc Hành lý / Chuyển phòng.
2. Chọn “Gửi giữ hành lý”, chọn 2 kiện, “Sau 15 phút”, chọn phòng, nhập PIN: robot đọc kết quả có mã phiếu.
3. Gửi lại cùng dịch vụ: hiện “Yêu cầu đã có sẵn” với mã phiếu cũ.
4. Bấm “Tiến độ”: thấy các yêu cầu của phòng và trạng thái.
5. Đổi robot sang English rồi mở lại menu: toàn bộ chữ trong menu bằng tiếng Anh.
6. Lặp lại trên iPhone X xoay ngang: cuộn danh sách, chọn số kiện/thời gian, đóng menu bình thường.

### Dashboard Bell Services

1. Đăng nhập tài khoản Bellman. Khi chưa có phiếu, danh sách trống (không còn dữ liệu mẫu).
2. Tạo yêu cầu từ robot: phiếu xuất hiện trong tối đa 15 giây hoặc khi bấm Làm mới, tiêu đề là tên dịch vụ.
3. Nhận rồi hoàn thành phiếu: trạng thái cập nhật; phiếu hoàn thành xuống cuối danh sách.

## 7. Giới hạn và việc cần tiếp tục

- Lỗi `skip_ticket_creation` ở luồng PIN bằng giọng nói vẫn còn với các bộ phận khác (Housekeeping, giặt ủi, Maintenance khi chưa xác thực): nhập PIN xong không tạo phiếu. Lần này chỉ bật cho Bellman; cần quyết định riêng cho các bộ phận còn lại.
- Phiếu `room_move` chưa gắn số phòng mới; Lễ tân xác nhận phòng mới ngoài hệ thống.
- Dịch vụ bưu phẩm/hàng giao và cho mượn xe đẩy, xe lăn, ô dù chưa nằm trong phạm vi.
- Sau khi nghiệm thu, commit/push nhánh `feature/bellman-requests` và tạo PR vào `development`.
