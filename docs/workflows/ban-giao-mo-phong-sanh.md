# Bàn giao bản đồ sảnh và kịch bản phục vụ khách

Ngày 06/11/2026 · Nhánh `lobby-map-doors` · Commit bản đồ `2694dad`

Web và Gazebo đã dùng chung mặt bằng sảnh có cửa trước và cửa sau. **Việc tiếp theo là sửa các đích di chuyển cũ, sau đó làm một lượt phục vụ hoàn chỉnh cho tình huống khách hỏi chỗ ăn tối.** Phần rẽ nhánh theo lựa chọn của khách đang ở mức đề xuất.

## Đã hoàn thành

| Hạng mục | Kết quả |
|---|---|
| Giao diện đã làm ở các nhánh trước | Robot Control có một không gian chung cho Control & SLAM và Live Camera, dùng chung bảng điều khiển. Room Service, Reception và Maintenance dùng khung giao diện theo Admin, có sidebar thu gọn và Settings đổi Anh–Việt. Tiếng Anh là mặc định. Room Service đã bỏ mục Housekeeping riêng, khối Low Stock và hai subtab dư. |
| Bản đồ web trên nhánh hiện tại | Đã dùng đúng ảnh mặt bằng người dùng cung cấp cho sảnh tầng trệt. Trong Workflow Studio, ảnh nền, vị trí robot, đường đi, waypoint và vùng điều khiển dùng cùng hệ tọa độ. Đã đối chiếu ảnh do web trả về với file gốc. |
| Sa bàn Gazebo | Sảnh rộng 19,60 × 12,60 m. Cửa trước ở giữa tường trái tại `(0.00, 6.25)`. Cửa sau ở tường phải, giữa lối thoát hiểm và WC, tại `(19.60, 3.53)`. Đã mở khoảng trống trên tường và hình va chạm. Điểm robot đứng đón khách nằm phía trong cửa trước tại `(0.90, 6.25)`. |
| Kiểm tra tích hợp | Frontend đã build thành công. Gazebo đã nạp đúng hai cửa. Web và bộ điều hướng ROS tính ra cùng tuyến giữa hai cửa. Đã đọc được bản quét LiDAR 360 tia qua rosbridge ở cổng 9090. Việc cho robot chạy hết từng hành trình và quan sát trên UI vẫn cần thực hiện. |

## Kết quả đối chiếu kịch bản

Tài liệu đăng ký đề tài *Intelligent Hotel Concierge Robot*, mục 3.1, yêu cầu khách có thể chọn ngôn ngữ, hỏi và nhận tư vấn, gửi yêu cầu, theo dõi tiến độ, nhờ nhân viên và đánh giá sau tương tác. Vì vậy, tiêu chí của demo là **khách nhận được kết quả và nhân viên thấy đúng yêu cầu**. Số bước chỉ giúp ước lượng độ dài của kịch bản.

Tại thời điểm kiểm tra, API `GET /api/v1/workflows` trả về **10 workflow, tổng cộng 44 bước**. Chỉ WF06 đang bật. Các tọa độ dưới đây tính bằng mét, theo thứ tự `(x, y)`.

| Workflow | Bước | Kết quả kiểm tra |
|---|---:|---|
| WF01 · Đón khách | 5 | Bản mẫu cũ lưu `(5.20, 1.00)`. Studio đã nhận diện bước mẫu này và đưa robot tới điểm đón mới `(0.90, 6.25)`. |
| WF02 · Tư vấn tiện ích | 5 | Có phần hỏi nhu cầu và gợi ý. Đây là điểm phù hợp để khách chọn xem bản đồ, được dẫn đường hoặc gặp nhân viên. |
| WF03 · Dọn phòng hoặc gọi taxi | 5 | Lời thoại cho khách chọn hai dịch vụ, nhưng bước tạo phiếu đang cố định phòng `304`, loại `HOUSEKEEPING` và bộ phận Housekeeping. |
| WF04 · Gặp lễ tân | 4 | Đi tới `(6.40, 2.00)`, trong khi điểm trước quầy trên bản đồ là `(11.44, 2.80)`. Lệch 5,10 m. |
| WF05 · Đánh giá và về trạm | 4 | Điểm về trạm đang là `(3.20, 2.80)`. Điểm chờ chuẩn là `(7.20, 9.60)`. Lệch 7,89 m. |
| WF06 · Tuần tra và quảng cáo | 2 | Đích hiện tại `(4.80, 2.50)` lệch 5,31 m so với tâm sảnh `(8.40, 6.40)`. Hai bước di chuyển và hiển thị phù hợp cho chế độ rảnh. |
| WF07 · Dẫn tới thang máy | 5 | Đích `(7.70, 4.20)` lệch 8,37 m so với thang máy `(15.60, 6.96)`. Bước về trạm cũng dùng tọa độ cũ như WF05. |
| WF08 · Báo thức | 5 | Có bước tạo yêu cầu báo thức cho Reception, nhưng số phòng đang cố định là `304`. Cần đối chiếu phòng và giờ khách thực sự chọn với phiếu nhân viên nhận. |
| Đón Khách & Hướng Dẫn Dịch Vụ Sảnh Chính | 8 | Bước tiến lại gần khách đang trỏ tới `(0, 0)`, ngay góc tường. Cần chọn lại điểm tiếp cận. |
| Kịch bản phục vụ khách mới | 1 | Hiện chỉ có bước chào. Có thể dùng làm đoạn mở đầu cho một lượt phục vụ. |

Trong Studio, bước `MOVE` có thể gửi đích tới Gazebo khi kết nối ROS. Các bước `CREATE_REQUEST` và `FEEDBACK` trong phần mô phỏng chuyển tiếp bằng bộ đếm thời gian. Muốn xác nhận nghiệp vụ, cần nhìn thấy phiếu hoặc đánh giá đã lưu ở màn hình tương ứng.

## Thứ tự làm tiếp

1. **Sửa đích di chuyển.** Đồng bộ điểm lễ tân, thang máy, tâm sảnh và trạm chờ cho cả bản mẫu lẫn bản cũ đã lưu. Phân biệt tọa độ mẫu cũ với waypoint người dùng đã chỉnh. Với kịch bản đang trỏ tới góc tường, chọn điểm tiếp cận phù hợp trên sa bàn.
2. **Thêm bước chờ lựa chọn và rẽ nhánh.** Studio và màn hình robot hiện chủ yếu chạy bước kế tiếp theo thứ tự. Cần dùng cùng quyết định trên cả hai màn hình, xử lý trường hợp khách hủy hoặc hết thời gian chờ và tiếp tục hỗ trợ các workflow tuần tự hiện có.
3. **Làm demo đầu tiên từ WF01 + WF02 + WF07 + WF05.** Robot đón khách ở cửa trước → khách chọn ngôn ngữ và hỏi chỗ ăn tối → robot gợi ý nhà hàng → khách chọn **Xem bản đồ** hoặc **Dẫn tới thang máy**. Nhánh xem bản đồ hiển thị sơ đồ tại chỗ. Nhánh dẫn đường chờ robot đến nơi. Hai nhánh cùng quay về phần hỏi khách còn cần gì, đánh giá và trở về trạm một lần khi kết thúc.
4. **Làm luồng yêu cầu dịch vụ từ WF03 và WF08.** Thu loại dịch vụ, số phòng và thông tin riêng như giờ báo thức hoặc điểm đón taxi. Cho khách xác nhận, tạo một phiếu qua API nghiệp vụ, chuyển đúng bộ phận và cho khách tra lại trạng thái sau khi nhân viên cập nhật.
5. **Làm luồng gặp nhân viên từ WF01 + WF04 + WF05.** Khi khách yêu cầu hỗ trợ, xác nhận nhu cầu, chuyển nội dung cho lễ tân và chờ nhân viên tiếp nhận. Dùng phần kết thúc chung để khách đánh giá sau khi được hỗ trợ.
6. **Hoàn thiện chế độ rảnh WF06.** Cho phép tạm dừng quảng cáo khi bắt đầu phục vụ khách và tiếp tục sau khi phiên kết thúc.

## Cách nghiệm thu trên UI

Mở Gazebo bằng [open_gazebo.bat](../../open_gazebo.bat). Khi backend và frontend đã chạy, vào **Admin → Robot Control → Workflow Step Management → Giả lập**. Thực hiện các kiểm tra dưới đây trực tiếp trên UI.

- **Kiểm tra được ngay:** So sánh hai cửa trên web và trong Gazebo. Chọn một đích gần mỗi cửa và quan sát robot đi đúng lối, tránh tường. Thử riêng WF01 để kiểm tra robot dừng phía trong cửa trước.
- **Sau khi sửa tọa độ:** Chạy WF04 và WF07. Quan sát robot dừng trước quầy lễ tân hoặc trước thang máy thật trên sa bàn. Kiểm tra cả hành trình về trạm.
- **Sau khi thêm rẽ nhánh:** Chạy tình huống ăn tối hai lượt. Lượt đầu chọn xem bản đồ và kiểm tra robot đứng tại chỗ. Lượt sau chọn dẫn đường và kiểm tra robot chỉ báo đã đến khi Gazebo xác nhận tới đích.
- **Sau khi nối nghiệp vụ:** Dùng số phòng thử khác 304. Gửi yêu cầu từ kiosk, mở đúng màn hình nhân viên để tiếp nhận, đổi trạng thái, rồi quay lại kiosk tra cứu. Với đánh giá, kiểm tra kết quả đã lưu sau khi kết thúc phiên.

## Điểm bắt đầu trong mã nguồn

- [Workflow mẫu của backend](../../backend/app/api/v1/endpoints/default_workflows.py) và [định nghĩa waypoint cùng hàm xác định đích trên web](../../frontend/src/pages/admin/tabs/workflow/workflowSimulatorUtils.js).
- [Bộ chạy trong Studio](../../frontend/src/pages/admin/tabs/workflow/WorkflowSimulatorStudio.jsx) và [bộ chạy trên màn hình robot](../../frontend/src/hooks/useWorkflowRunner.js).
- [Sa bàn Gazebo](../../robot/worlds/hotel_room.world) và [bộ điều hướng mô phỏng](../../robot/scripts/autonomous_navigator.py).

Khi bàn giao, file world có một thay đổi cục bộ do hệ thống đồng bộ tọa độ điểm sạc. Thay đổi này nằm ngoài commit bản đồ; cần đối chiếu với waypoint đang dùng trước khi đưa vào commit tiếp theo.
