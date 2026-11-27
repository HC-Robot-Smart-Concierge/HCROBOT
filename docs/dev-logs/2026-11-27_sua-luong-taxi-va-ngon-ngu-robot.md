# Bàn giao: yêu cầu nhờ Concierge đặt xe và ngôn ngữ hội thoại robot

## Cập nhật mới nhất — 2026-11-27

**Phần này thay thế luồng hỏi điểm đến và xác nhận chuyến đi trong bản ghi cũ bên dưới.**

- Nhánh đang làm: `main`. HEAD lúc bắt đầu lần cập nhật này: `985651d`.
- Đã sửa code, build và kiểm tra bằng dữ liệu giả lập; chưa commit/push thay đổi của lần cập nhật này.
- Yêu cầu: khách chỉ nhờ Concierge đặt xe, cung cấp số người hoặc số chỗ và ghi chú. Không bắt chọn điểm đón, điểm đến, không tự đặt giá trị mặc định, không hỏi lại số điện thoại.

### Luồng hiện tại

1. Robot giữ bước xác thực số phòng/PIN đang có. Phòng đã xác thực không phải nhập lại cho cùng phiên.
2. Khách vẫn có thể chọn tự gọi taxi hoặc nhờ nhân viên đặt xe.
3. Khi nhờ nhân viên, robot hỏi: “Quý khách cần đặt xe cho bao nhiêu người hoặc cần xe mấy chỗ ạ?”. Nếu khách đã nói thông tin này trong yêu cầu ban đầu thì không hỏi lại.
4. Robot hỏi thêm về hành lý/yêu cầu khác. Khách có thể nói ghi chú, nói không có gì thêm hoặc bấm gửi. Không còn màn hình chọn địa điểm và kiểm tra chuyến đi.
5. Khi khách nói “đừng gửi”, “chưa gửi”, “do not send”, yêu cầu chưa được gửi. Khi nói hủy thì đóng luồng. Nếu chỉ trả lời “có” ở bước ghi chú, robot hỏi nội dung ghi chú trước.
6. Backend tạo yêu cầu `booking_mode=assistance`, lấy tên và điện thoại khách/máy nhánh từ phòng đang có khách. Chỉ lưu số khách, xe và ghi chú đã cung cấp; không suy ra số khách từ số chỗ.
7. Concierge xem phòng, thông tin liên hệ, số khách/xe, ghi chú rồi **Nhận yêu cầu → Thành công**. Form tạo yêu cầu thủ công cũng dùng các trường này.

Ví dụ: “xe 7 chỗ” chỉ lưu xe 7 chỗ, số khách để chưa xác định; “2 người lớn và 3 trẻ em” là 5 khách; “4 people including 2 children” là 4 khách. Nếu khách chỉ cần nhân viên tư vấn, có thể nói chưa biết số khách/loại xe. Điểm đến hoặc giờ đón khách tự nói vẫn có thể nằm trong ghi chú, không phải trường bắt buộc.

### File thay đổi trong lần này

| File | Nội dung |
| --- | --- |
| `frontend/src/utils/taxiAssistance.js` | Nhận diện số người/số chỗ Việt–Anh, phản hồi gửi/hủy/chờ, tạo payload hỗ trợ đặt xe. |
| `frontend/src/components/robot/RobotTaxiModal.jsx` | Bỏ biểu mẫu điểm đến và bước kiểm tra; hội thoại hỏi nhu cầu/ghi chú, có nhập chữ dự phòng. |
| `frontend/src/pages/robot/RobotScreenPage.jsx` | Giữ câu yêu cầu ban đầu qua bước xác thực và chọn cách đặt xe; dùng phòng đã xác thực khi gửi. |
| `frontend/src/components/dashboard/concierge/ConciergeTaxiBookingModal.jsx` | Form tạo yêu cầu theo phòng, số khách, xe và ghi chú; không mặc định số khách/xe. |
| `frontend/src/pages/dashboard/ConciergeDashboard.jsx` | Hiển thị nhu cầu và liên hệ phòng, gửi đúng ghi chú; nhãn taxi Việt–Anh. |
| `backend/app/schemas/operations_admin_guest.py` | Schema hỗ trợ assistance không cần thông tin chuyến đi; số khách/xe có thể để trống. |
| `backend/app/api/v1/endpoints/operations/taxi.py` | Đọc thông tin phòng, lưu nhu cầu vào yêu cầu taxi hiện có, gửi thông báo Concierge; bỏ dữ liệu chuyến đi tự điền. |

Không cần migration. Yêu cầu taxi cũ vẫn giữ dữ liệu/ghi chú đã lưu trước đây; không tự sửa lịch sử hoặc tạo yêu cầu thật để kiểm tra.

### Kiểm tra đã thực hiện

- `npm run build --prefix frontend`: thành công sau chỉnh sửa cuối.
- `git diff --check`: thành công.
- Node inline: số người/số chỗ, người lớn/trẻ em/em bé, câu nói lẫn Việt–Anh, không lấy số phòng/hành lý/giờ thành số khách, không nhầm “một người” thành lựa chọn một.
- Giả lập React hooks và API: hỏi nhu cầu → ghi chú → gửi, câu không liên quan không bị dùng làm điểm đến, giữ ngôn ngữ Việt/Anh, chờ/hủy, lỗi API và gửi lại. Không tạo ticket thật.
- Python inline với repository/room/notification được mock: lưu nhu cầu, lấy liên hệ phòng, từ chối phòng chưa nhận khách, không điền dữ liệu giả. Schema backend đang chạy đã nhận cập nhật.
- Không tạo file test. Chưa kiểm tra microphone/TTS và toàn bộ vòng tương tác trên Safari/iPhone thật.

### Cách test UI trên iPhone

1. Tải lại trang robot. Nói “Tôi muốn nhờ đặt xe”, xác thực phòng nếu được hỏi, rồi chọn “nhờ nhân viên đặt xe”.
2. Nói “xe 7 chỗ”, sau đó “có 2 vali lớn, cần xe lúc 7 giờ”. Mong đợi gửi một yêu cầu; không xuất hiện danh sách điểm đến hoặc video call.
3. Mở Concierge → Taxi Dispatch. Kiểm tra đúng phòng, xe 7 chỗ, số khách chưa xác định, ghi chú 2 vali/7 giờ và số liên hệ phòng. Nhận yêu cầu, sau đó đánh dấu thành công khi nhân viên đã gọi xe.
4. Thử yêu cầu mới “đặt xe cho 2 người lớn và 3 trẻ em”. Robot phải nhận 5 khách, hỏi ghi chú. Nói “không có gì thêm” để gửi.
5. Thử “đừng gửi”/“hủy” trước khi gửi: không được tạo yêu cầu. Thử “nhờ nhân viên đặt xe cho một người”: không được mở danh bạ tự gọi chỉ vì có từ “một”.
6. Bắt đầu hội thoại tiếng Anh: “Please arrange a seven-seater taxi”, rồi “two large bags”. Lời nhắc/nhãn phải theo tiếng Anh; thử “do not send” trước khi gửi.
7. Nếu cần dùng bàn phím, mở “Nhập thay vì nói”. Thử cả form tạo yêu cầu của Concierge với số khách/xe để trống và ghi chú tự do.

Các bước gửi yêu cầu trong hướng dẫn này sẽ tạo dữ liệu thật khi bạn tự thực hiện. Hai file `knowledge_vault/hotel_facilities_floor_layout_*.md` có thay đổi ngoài phạm vi trong lúc làm việc; đã giữ nguyên, không đưa vào phần sửa taxi.

---

## Bản ghi trước: sửa video call chen ngang và ngôn ngữ (lịch sử)

Thông tin commit, trạng thái công việc và hướng dẫn hỏi điểm đến dưới đây là bản ghi của lần sửa trước, không phải luồng hiện tại.

- Ngày thực hiện: 2026-11-27 (Asia/Bangkok).
- Người thực hiện: Codex, theo yêu cầu của chủ dự án.
- Phân hệ liên quan: Frontend Kiosk, AI Core, xác thực phòng.
- Workspace: `D:\do_an_fptu\HCROBOT`.
- Nhánh Git: `main`; HEAD khi thực hiện: `2732023`.
- Trạng thái: đã sửa code và kiểm tra cục bộ; **chưa commit, chưa push**. Cần chủ dự án thử giọng nói trực tiếp trên iPhone.

## 1. Vấn Đề Kỹ Thuật (Problem Statement)

Khách yêu cầu đặt taxi, robot hỏi số phòng; khi khách trả lời số phòng thì có lúc màn hình tự chuyển sang video call với Concierge. Khi thử lại, lời nói và các lựa chọn taxi còn trộn tiếng Việt với tiếng Anh.

Các điểm đã xác định trong code:

- Luồng hỗ trợ theo biểu cảm chạy song song với luồng taxi. Trước đây, một effect nghe transcript và coi việc xuất hiện các từ `có`, `gọi`, `nhân viên`, `help`, `call` là đồng ý gọi nhân viên. Câu như “tôi có phòng 301” có thể bị hiểu nhầm nếu hộp hỗ trợ đang mở.
- Luồng này chưa được chặn đầy đủ khi khách đang trả lời số phòng, nhập PIN hoặc đặt taxi.
- Callback taxi đọc biến `language` của render trước, trong khi phản hồi AI vừa cập nhật ngôn ngữ mới qua `languageRef`. Một số nơi còn dùng phép OR giữa ngôn ngữ cũ và mới.
- Nhiều lời nhắc và nhãn trong `RobotTaxiModal` viết cố định tiếng Việt; nhãn tiếng Việt lại chứa “Option”, “Concierge”, “hotline”. `RoomPinModal` cũng chưa nhận ngôn ngữ hội thoại.
- Modal taxi nhận cả transcript chưa xử lý. Việc diễn giải cùng một câu ở nhiều nơi có thể gây xử lý sớm hoặc sai bước. Câu “được rồi” còn có thể bị coi là đóng modal trước khi đến bước xác nhận.

Đây là các đường lỗi được xác định từ code. Chưa tái hiện trực tiếp đầy đủ lần video call mà người dùng gặp trên iPhone, nên không khẳng định mọi lần xảy ra đều có cùng nguyên nhân.

## 2. Các Phương Án Đã Xem Xét (Alternative Approaches)

- Chỉ sửa lời nhắc: không giải quyết việc luồng gọi nhân viên chen vào luồng taxi.
- Tắt toàn bộ tính năng gọi nhân viên: làm mất chức năng hỗ trợ khách đang có.
- Phương án đã áp dụng: để luồng dịch vụ đang hoạt động xử lý câu trả lời của chính nó; chặn hỗ trợ theo biểu cảm chen ngang; giữ gọi nhân viên khi khách chủ động yêu cầu; đồng bộ ngôn ngữ phần taxi và PIN.

## 3. Chi Tiết Triển Khai (Implementation Details)

| File | Thay đổi |
| --- | --- |
| `frontend/src/utils/robotConversationGuards.js` | Thêm kiểm tra phản hồi đồng ý/từ chối hỗ trợ; chặn mở video call từ phản hồi taxi hoặc khi taxi đang xử lý. |
| `frontend/src/pages/robot/RobotScreenPage.jsx` | Hủy bộ đếm/hộp hỗ trợ biểu cảm khi đang có tương tác dịch vụ; xử lý đồng ý gọi từ câu nói đã hoàn tất; giữ câu trả lời phòng/PIN trong luồng taxi; dùng ngôn ngữ mới nhất; truyền ngôn ngữ xuống PIN và chỉ chuyển câu nói đã xử lý tới modal taxi. |
| `frontend/src/components/robot/RobotTaxiModal.jsx` | Bổ sung tiếng Việt/Anh cho lời nhắc, hai lựa chọn, danh mục điểm đến, loại xe, xác nhận, kết quả và lỗi; hỗ trợ thêm cách nói lựa chọn/xe bằng tiếng Anh; phân biệt xác nhận với chỉnh sửa/phủ định. |
| `frontend/src/components/robot/RoomPinModal.jsx` | Nhận `language`, dịch màn hình PIN, chọn phòng, quên PIN, khóa tạm thời và thông báo xác thực/NFC. Mặc định tiếng Việt được giữ cho các nơi gọi cũ chưa truyền ngôn ngữ. |
| `backend/app/services/ai/concierge_graph.py` | Chuẩn hóa `taxi`, `book_taxi`, `taxi_booking`; trả rõ `trigger_video_call: false` tại bước hỏi phòng và xử lý taxi; sửa lời nhắc tiếng Việt. |

Luồng mong đợi sau thay đổi:

1. Khách yêu cầu đặt taxi; dùng ngôn ngữ đã nhận diện cho hội thoại.
2. Chưa có phiên phòng đã xác thực: hỏi số phòng, sau đó nhập PIN.
3. Có phiên phòng đã xác thực: chuyển đến hai lựa chọn, không hỏi lại PIN cho cùng phòng.
4. Lựa chọn một: mở số điện thoại các hãng taxi để khách tự liên hệ.
5. Lựa chọn hai: mở biểu mẫu đặt xe, hỏi điểm đến và loại xe; không mở video call.
6. Khách kiểm tra và xác nhận rồi mới gửi yêu cầu taxi đến nhân viên.

Tên điểm đến và mã loại xe trong payload được giữ để tương thích backend; chỉ phần hiển thị và lời nói được dịch. Khách nói tên điểm đến tiếng Anh trong câu tiếng Việt, ví dụ “Tôi muốn đi airport”, vẫn nhận lời nhắc tiếng Việt trong luồng đang dùng tiếng Việt. Không thêm nhà cung cấp TTS hoặc API key mới.

## 4. Kết Quả Kiểm Thử (Verification & Test Results)

- Vite production build: thành công với `npm run build --prefix frontend` sau các chỉnh sửa cuối.
- `git diff --check`: thành công.
- Kiểm tra backend bằng Python inline, session trong bộ nhớ, truy vấn tình trạng phòng được mock: 10 ca luồng taxi/room/PIN và gọi nhân viên rõ ràng đã qua. Sau khi chuẩn hóa alias, kiểm tra thêm cả ba alias taxi ở hai ngôn ngữ cũng đã qua.
- Kiểm tra frontend bằng Node inline với React hooks/API giả lập: luồng hai lựa chọn, điểm đến, loại xe, sửa thông tin, xác nhận, thành công và màn hình PIN bằng Việt/Anh đã qua.
- Kiểm tra bổ sung: `one`/`two`, `option one`/`option two`; “đúng rồi”, “được rồi”, “confirm”; từ chối xác nhận “đừng xác nhận”, “do not confirm”, “not correct”; điểm đến trộn Việt–Anh giữ ngôn ngữ phản hồi đã qua.
- Không tạo file test. Không tạo ticket thật hoặc thực hiện cuộc gọi thật trong các kiểm tra.
- Tại thời điểm kiểm tra: backend port `8000` đang chạy Python với `--reload`; frontend port `3000` đang có tiến trình Node lắng nghe.
- Chưa kiểm tra trực tiếp microphone, âm thanh phát lại và toàn bộ tương tác trên Safari/iPhone. Kiểm tra giả lập không thay thế kiểm tra thiết bị thật.

## 5. Lưu Ý & Công Việc Kế Tiếp (Caveats & Next Steps)

### Test UI trên điện thoại

1. Tải lại trang robot để nhận code mới; bắt đầu bằng phiên chưa xác thực phòng.
2. Nói “Tôi muốn đặt taxi”. Khi được hỏi, trả lời số phòng hợp lệ đang có khách, ví dụ “tôi có phòng 301”. Mong đợi mở PIN, không có video call.
3. Nhập PIN đúng. Kiểm tra robot nói hai lựa chọn hoàn toàn bằng tiếng Việt.
4. Chọn “lựa chọn hai” hoặc “nhờ nhân viên đặt xe”. Mong đợi hỏi điểm đến, không gọi video.
5. Trả lời “Tôi muốn đi airport”, rồi chọn loại xe. Mong đợi lời nhắc và màn hình vẫn là tiếng Việt.
6. Ở bước kiểm tra, thử “không đúng, sửa lại”. Không được gửi yêu cầu. Nhập lại thông tin, rồi nói “đúng rồi” hoặc “được rồi” để xác nhận. Bước xác nhận thật sẽ tạo yêu cầu taxi; chỉ thực hiện khi muốn tạo dữ liệu thử.
7. Thử lựa chọn một: mở danh bạ số điện thoại, đóng bằng “cảm ơn”. Không tự tạo ticket taxi.
8. Bắt đầu phiên mới bằng “I would like to book a taxi”, thực hiện lại bằng tiếng Anh. Kiểm tra PIN, điểm đến, loại xe và xác nhận đều là tiếng Anh.
9. Thử “do not confirm” hoặc “not correct” tại bước kiểm tra: không được gửi yêu cầu.
10. Ngoài luồng taxi, chủ động yêu cầu gặp nhân viên để kiểm tra tính năng gọi hỗ trợ vẫn còn. Đây là cuộc gọi thật nếu xác nhận thực hiện.

### Khi tiếp tục làm việc

- Xem `git status` trước; các thay đổi hiện nằm trực tiếp trên `main`, chưa có commit mới cho lần sửa này. Không bỏ các thay đổi chưa commit.
- Nếu vẫn xuất hiện video call ngoài ý muốn, ghi lại câu nói chính xác, bước đang đứng, ngôn ngữ và có hộp hỏi hỗ trợ biểu cảm hay không; đối chiếu `action`, `pending_service_action`, `trigger_video_call` trong phản hồi `/ai/chat`. Không lưu PIN, token hoặc thông tin bí mật vào báo cáo.
- Kiểm tra riêng phiên phòng đã xác thực, đổi phòng và hủy giữa chừng trên thiết bị thật.
- Khi được yêu cầu commit/push, kiểm tra diff, tạo nhánh theo tên người dùng yêu cầu và chỉ đưa các thay đổi liên quan vào commit. Chưa merge hay push thay đổi này.
- Giữ yêu cầu của người dùng: không để lại file test; hướng dẫn kiểm tra UI là đủ cho bàn giao thiết bị.

File này ghi lại trạng thái công việc, không phải chỉ báo quota. Agent không đọc được phần trăm quota tài khoản.
