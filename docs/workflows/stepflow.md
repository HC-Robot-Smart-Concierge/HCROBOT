**STEPS**

###

| **STT** | **Tên Step** | **Giải thích** | **Nhiệm vụ chính của Robot** |
| --- | --- | --- | --- |
| **1** | **MOVE** | Robot đi từ điểm A điểm B | • Đi lại gần khách khi phát hiện khách đứng ở sảnh.  • Trở về vị trí quy định. |
| **2** | **GREET** | Robot chào và bắt đầu làm quen | • Chủ động chào khách bằng tiếng anh giọng nói kèm biểu cảm cười/nhấp nháy đèn. |
| **3** | **SPEAK** | Robot nói thông tin ra loa | • Đọc câu trả lời hoặc hướng dẫn đường đi cho khách.  • Xác nhận lại: "Tôi đã ghi nhận yêu cầu của bạn" hay "Vui lòng chờ giây lát". |
| **4** | **SHOW** | Bật nội dung lên màn hình cảm ứng, quảng cáo, thông tin khách sạn | • Hiện thực đơn dịch vụ, ảnh nhà hàng, bản đồ khu tiện ích.  • Chiếu poster/slide quảng cáo khuyến mãi. |
| **5** | **LISTEN** | Chờ khách nói hoặc bấm chọn | • Thu âm giọng nói của khách để phân tích ngôn ngữ, câu hỏi (hỏi vị trí, dịch vụ...).  • Chờ khách chạm tay chọn một nút trên màn hình. |
| **6** | **RECOMMEND** | Robot gợi ý theo nhu cầu của khách | • Gợi ý menu món ăn, dịch vụ trong khách sạn. |
| **7** | **CREATE\_REQUEST** | Gửi việc về cho các bộ phận khách sạn | • Tạo phiếu gọi dịch vụ của khách sạn như dọn phòng, gọi taxi, gọi nhân viên |
| **8** | **FEEDBACK** | Thu thập nhận xét trước khi kết thúc | • Hiện màn hình chấm sao (1 - 5 sao) để khách đánh giá mức độ hài lòng về robot. |

Dưới đây là phần mô tả chi tiết từng Step dưới dạng đoạn văn hoàn chỉnh, văn phong rõ ràng, chuyên nghiệp nhưng dễ hiểu, rất thích hợp để bạn đưa vào tài liệu đặc tả chức năng (SRS) hoặc báo cáo đồ án Capstone:

### **1. Step MOVE (Di chuyển vị trí)**

* **Giải thích chi tiết:** Bước này chịu trách nhiệm điều khiển khả năng di chuyển tự hành và định vị của robot trong không gian tiền sảnh khách sạn. Robot sử dụng bản đồ đã dựng sẵn cùng cảm biến tránh chướng ngại vật để di chuyển an toàn giữa các vị trí định danh.
* **Nhiệm vụ cụ thể:** Khi hệ thống phát hiện có khách bước vào khu vực tiếp đón, robot kích hoạt lệnh di chuyển nhẹ nhàng lại gần vị trí của khách với cự ly an toàn để bắt đầu phục vụ. Khi hoàn thành phiên tương tác hoặc khi pin yếu/ở trạng thái rảnh, robot sẽ tự động kích hoạt lệnh quay trở về trạm chờ ban đầu hoặc dock sạc.

### **2. Step GREET (Chào hỏi và khởi tạo tương tác)**

* **Giải thích chi tiết:** Đây là bước mở đầu nhằm tạo sự thiện cảm và thu hút sự chú ý của khách hàng. Bước này kết hợp giữa hành vi giọng nói, hiệu ứng âm thanh và tín hiệu thị giác để mang lại trải nghiệm tiếp cận thân thiện, hiếu khách.
* **Nhiệm vụ cụ thể:** Robot chủ động phát lời chào bằng tiếng Anh (hoặc ngôn ngữ mặc định) kèm theo biểu cảm khuôn mặt mỉm cười hiển thị trên màn hình và nhấp nháy đèn báo trạng thái. Đồng thời, bước này cũng nhắc khách lựa chọn ngôn ngữ giao tiếp ưa thích trên màn hình cảm ứng để bắt đầu phiên hỗ trợ.

### **3. Step SPEAK (Phát âm thanh / Đọc thông báo)**

* **Giải thích chi tiết:** Bước này đóng vai trò xuất phản hồi dạng âm thanh (sử dụng công nghệ Text-to-Speech - TTS). Robot chuyển đổi các câu trả lời dạng văn bản từ hệ thống thành giọng nói tự nhiên, rõ ràng thông qua hệ thống loa tích hợp.
* **Nhiệm vụ cụ thể:** Robot dùng giọng nói để giải đáp thắc mắc, hướng dẫn đường đi tới các khu vực trong khách sạn hoặc thông báo trạng thái tức thời cho khách (chẳng hạn như: *"Tôi đã ghi nhận yêu cầu của bạn"* hoặc *"Vui lòng chờ nhân viên lễ tân trong giây lát"*).

### **4. Step SHOW (Hiển thị nội dung trên màn hình)**

* **Giải thích chi tiết:** Đây là bước tương tác thị giác, điều khiển giao diện hiển thị trên màn hình cảm ứng của robot để cung cấp thông tin trực quan cho khách hàng hoặc phục vụ mục đích tiếp thị của khách sạn.
* **Nhiệm vụ cụ thể:** Trong quá trình hỗ trợ, màn hình sẽ hiển thị thực đơn dịch vụ, hình ảnh chi tiết về các nhà hàng, hồ bơi hoặc bản đồ khu tiện ích. Khi robot ở chế độ rảnh rỗi (idle), bước này sẽ tự động chạy slide ảnh, poster hoặc video quảng bá các chương trình ưu đãi, khuyến mãi của khách sạn.

### **5. Step LISTEN (Lắng nghe và ghi nhận phản hồi)**

* **Giải thích chi tiết:** Bước này đảm nhận việc thu thập dữ liệu đầu vào từ khách hàng thông qua hai kênh chính là âm thanh (micro) và cảm ứng (màn hình). Hệ thống sẽ lắng nghe hoặc tạm dừng workflow trong một khoảng thời gian chờ (timeout) để khách đưa ra lựa chọn.
* **Nhiệm vụ cụ thể:** Robot thu âm giọng nói của khách rồi chuyển thành văn bản (Speech-to-Text) để phân tích ý định (hỏi tiện ích, tìm phòng, tra cứu dịch vụ). Song song đó, bước này cũng cho phép khách thao tác trực tiếp bằng cách chạm/nhấn vào các nút tùy chọn trên giao diện cảm ứng.

### **6. Step RECOMMEND (Đưa ra gợi ý thông minh)**

* **Giải thích chi tiết:** Bước này xử lý logic gợi ý tự động dựa trên hồ sơ, ngữ cảnh hoặc nhu cầu hiện tại của khách hàng. Hệ thống đóng vai trò như một nhân viên hướng dẫn (concierge) chuyên nghiệp giúp nâng cao trải nghiệm lưu trú.
* **Nhiệm vụ cụ thể:** Dựa vào sở thích ăn uống hoặc khung giờ cụ thể, robot sẽ chủ động đề xuất thực đơn món ăn nổi bật, danh sách các dịch vụ chăm sóc sức khỏe/spa tại khách sạn, hoặc đưa ra các gợi ý về điểm tham quan, ăn uống và vui chơi hấp dẫn quanh khu vực lân cận.

### **7. Step CREATE\_REQUEST (Khởi tạo và gửi yêu cầu dịch vụ)**

* **Giải thích chi tiết:** Đây là bước kết nối giữa robot và hệ thống quản lý nội bộ của khách sạn. Khi khách có nhu cầu phát sinh, robot sẽ đóng gói thông tin thành một phiếu dịch vụ (ticket) và đồng bộ về hệ thống backend để các phòng ban xử lý.
* **Nhiệm vụ cụ thể:** Robot thu thập số phòng cùng chi tiết yêu cầu, sau đó tạo phiếu công việc gửi tới bộ phận buồng phòng (housekeeping) để dọn phòng, giao thêm khăn/nước uống, hoặc hỗ trợ đặt taxi đưa đón sân bay. Ngoài ra, bước này cũng hỗ trợ phát cảnh báo gọi nhân viên trực tiếp khi khách cần sự trợ giúp đặc biệt.

### **8. Step FEEDBACK (Thu thập đánh giá chất lượng)**

* **Giải thích chi tiết:** Bước này được thiết kế nhằm khép lại quy trình hỗ trợ và đo lường mức độ hài lòng của khách đối với trải nghiệm tương tác với robot, phục vụ cho việc thống kê và cải thiện chất lượng dịch vụ của khách sạn.
* **Nhiệm vụ cụ thể:** Trước khi kết thúc phiên, màn hình robot sẽ hiện giao diện khảo sát nhanh với thang điểm từ 1 đến 5 sao kèm câu cảm ơn. Khách hàng chỉ cần chạm nhanh vào số sao để chấm điểm mức độ hỗ trợ của robot, dữ liệu này sẽ được lưu trữ tự động vào hệ thống báo cáo của người quản trị (Admin).

**Params**

| **Tên Step** | **Tham số (params)** | **Kiểu dữ liệu** | **Mô tả ngắn** |
| --- | --- | --- | --- |
| **MOVE** | target\_type  target\_value  speed | enum  string  string | Đích đến ("LOCATION", "GUEST", "STANDBY")  ID trạm hoặc tên vị trí  Tốc độ ("NORMAL", "CAUTIOUS") |
| **GREET** | template\_id  language  expression | string  string  string | ID câu chào mẫu  Mã ngôn ngữ ("en", "vi", "auto")  Biểu cảm ("SMILE", "WAVE") |
| **SPEAK** | text  language  speed | string  string  float | Câu cần nói ra loa  Mã giọng đọc ("vi-VN", "en-US")  Tốc độ đọc (mặc định: 1.0) |
| **SHOW** | screen\_type  content\_id  timeout | string  string  int | Loại màn hình ("MENU", "MAP", "SLIDE")  ID giao diện hoặc file ảnh/video  Thời gian hiển thị (giây) |
| **LISTEN** | input\_source  timeout  output\_var | string  int  string | Kênh nhận ("VOICE", "TOUCH", "BOTH")  Thời gian chờ phản hồi (giây)  Biến lưu kết quả |
| **RECOMMEND** | category  limit  filter | string  int  object | Nhóm gợi ý ("DINING", "AMENITIES")  Số lượng kết quả cần lấy  Điều kiện lọc phụ (JSON) |
| **CREATE\_REQUEST** | service\_type  room\_number  note  urgency | string  string  string  string | Dịch vụ ("HOUSEKEEPING", "TAXI")  Số phòng của khách  Ghi chú chi tiết yêu cầu  Độ ưu tiên ("LOW", "NORMAL", "HIGH") |
| **FEEDBACK** | scale  timeout  output\_var | int  int  string | Thang điểm tối đa (mặc định: 5)  Thời gian chờ chấm điểm (giây)  Biến lưu số sao đánh giá |

**Workflows**

**Workflow 1: Đón tiếp và Chào mừng khách chủ động**

* Mục đích: Tự động tiếp cận khi thấy khách vào sảnh để chào hỏi và mở menu.
* Chuỗi Step:
  1. MOVE (target\_type: "GUEST", target\_value: "ZONE\_LOBBY", speed: "CAUTIOUS")
  2. GREET (template\_id: "TPL\_WELCOME", language: "en", expression: "SMILE")
  3. SHOW (screen\_type: "LANGUAGE\_SELECT", content\_id: "UI\_LANG", timeout: 10)
  4. LISTEN (input\_source: "TOUCH", timeout: 10, output\_var: "selected\_lang")
  5. SHOW (screen\_type: "MENU", content\_id: "UI\_MAIN\_MENU", timeout: 30)

**Workflow 2: Gợi ý và Tư vấn dịch vụ thông minh**

* Mục đích: Tra cứu, gợi ý tiện ích nội khu hoặc nhà hàng, điểm tham quan lân cận.
* Chuỗi Step:
  1. SHOW (screen\_type: "MENU", content\_id: "UI\_CATEGORIES", timeout: 20)
  2. LISTEN (input\_source: "BOTH", timeout: 15, output\_var: "guest\_choice")
  3. RECOMMEND (category: "DINING", limit: 3, filter: {"type": "restaurant"})
  4. SHOW (screen\_type: "MENU", content\_id: "UI\_RECOMMEND\_LIST", timeout: 45)
  5. SPEAK (text: "Dưới đây là các gợi ý nhà hàng nổi bật cho bạn.", language: "vi-VN", speed: 1.0)

**Workflow 3: Đặt dịch vụ buồng phòng / Gọi xe**

* Mục đích: Tạo phiếu yêu cầu dọn phòng, xin thêm đồ dùng hoặc đặt taxi.
* Chuỗi Step:
  1. SHOW (screen\_type: "MENU", content\_id: "UI\_SERVICE\_FORM", timeout: 30)
  2. LISTEN (input\_source: "BOTH", timeout: 30, output\_var: "request\_data")
  3. CREATE\_REQUEST (service\_type: "HOUSEKEEPING", room\_number: "402", note: "Them 2 chai nuoc", urgency: "NORMAL")
  4. SPEAK (text: "Yêu cầu của quý khách đã được gửi tới nhân viên.", language: "vi-VN", speed: 1.0)
  5. SHOW (screen\_type: "MENU", content\_id: "UI\_CONFIRMATION", timeout: 10)

**Workflow 4: Nhờ nhân viên hỗ trợ khẩn cấp (Call Staff)**

* Mục đích: Kết nối lễ tân khi robot không xử lý được hoặc khách cần người trực tiếp.
* Chuỗi Step:
  1. SPEAK (text: "Tôi đang kết nối bạn với lễ tân, vui lòng đợi giây lát.", language: "vi-VN", speed: 1.0)
  2. CREATE\_REQUEST (service\_type: "CALL\_STAFF", room\_number: "LOBBY", note: "Khach can tro giup tai quay", urgency: "HIGH")
  3. SHOW (screen\_type: "MENU", content\_id: "UI\_WAITING\_STAFF", timeout: 60)

**Workflow 5: Đánh giá và Kết thúc phiên**

* Mục đích: Lấy đánh giá hài lòng từ khách và đưa robot về trạm chờ.
* Chuỗi Step:
  1. SHOW (screen\_type: "MENU", content\_id: "UI\_RATING", timeout: 15)
  2. FEEDBACK (scale: 5, timeout: 15, output\_var: "score")
  3. SPEAK (text: "Cảm ơn bạn. Chúc bạn một ngày tốt lành!", language: "vi-VN", speed: 1.0)
  4. MOVE (target\_type: "STANDBY", target\_value: "DOCK\_01", speed: "NORMAL")

**Workflow 6: Chế độ rảnh và Chiếu quảng cáo**

* Mục đích: Di chuyển ra điểm đông người phát khuyến mãi lúc vắng khách.
* Chuỗi Step:
  1. MOVE (target\_type: "LOCATION", target\_value: "HOTSPOT\_LOBBY", speed: "NORMAL")
  2. SHOW (screen\_type: "SLIDE", content\_id: "PROMO\_SUMMER", timeout: 60)

**Workflow 7: Chỉ đường và Dẫn khách đến tiện ích**

Mục đích: Hướng dẫn đường đi trên bản đồ và robot trực tiếp di chuyển dẫn khách đến khu vực tiện ích (nhà hàng, thang máy, spa).

* Chuỗi Step:
  1. SHOW (screen\_type: "MAP", content\_id: "MAP\_LOBBY\_FLOOR1", timeout: 15)
  2. SPEAK (text: "Tôi sẽ dẫn bạn đến nhà hàng tầng 1, vui lòng đi theo tôi.", language: "vi-VN", speed: 1.0)
  3. MOVE (target\_type: "LOCATION", target\_value: "RESTAURANT\_GATE", speed: "CAUTIOUS")
  4. SPEAK (text: "Chúng ta đã đến nơi. Chúc bạn có bữa ăn ngon miệng!", language: "vi-VN", speed: 1.0)
  5. MOVE (target\_type: "STANDBY", target\_value: "DOCK\_01", speed: "NORMAL")

**Workflow 8: Đặt lịch báo thức phòng (mở rộng)**

* Mục đích: Tiếp nhận cài đặt hẹn giờ gọi dậy buổi sáng của khách lưu trú và đồng bộ vào hệ thống khách sạn.
* Chuỗi Step:
  1. SHOW (screen\_type: "MENU", content\_id: "UI\_WAKEUP\_FORM", timeout: 20)
  2. LISTEN (input\_source: "BOTH", timeout: 20, output\_var: "wakeup\_time")
  3. CREATE\_REQUEST (service\_type: "WAKEUP\_CALL", room\_number: "305", note: "Goi bao thuc luc 06:30 sang", urgency: "NORMAL")
  4. SPEAK (text: "Đã cài đặt báo thức lúc 6 giờ 30 sáng cho phòng 305.", language: "vi-VN", speed: 1.0)
  5. SHOW (screen\_type: "MENU", content\_id: "UI\_CONFIRMATION", timeout: 10)

**Workflow 9: Cầu nối dịch thuật trực tiếp Khách - Lễ tân**

* Mục đích: Hỗ trợ phiên dịch hai chiều giữa khách quốc tế không thạo tiếng và nhân viên lễ tân.
* Chuỗi Step:
  1. SPEAK (text: "Tôi sẽ làm phiên dịch viên hỗ trợ bạn và lễ tân.", language: "vi-VN", speed: 1.0)
  2. SHOW (screen\_type: "MENU", content\_id: "UI\_TRANSLATE\_MODE", timeout: 60)
  3. LISTEN (input\_source: "VOICE", timeout: 15, output\_var: "guest\_speech")
  4. SPEAK (text: "Khách hỏi thủ tục trả phòng trễ.", language: "vi-VN", speed: 1.0)
  5. LISTEN (input\_source: "VOICE", timeout: 15, output\_var: "staff\_speech")
  6. SPEAK (text: "Late check-out is available until 2 PM with a small fee.", language: "en-US", speed: 1.0)

**Workflow 10: Tự động sạc pin khi mức pin thấp (Low Battery Auto-Docking Workflow) (mở rộng)**

* Mục đích: Đảm bảo an toàn vận hành, phát thông báo dừng phục vụ và tự hành về trạm sạc khi phát hiện pin yếu.
* Chuỗi Step:
  1. SHOW (screen\_type: "MENU", content\_id: "UI\_BATTERY\_LOW", timeout: 5)
  2. SPEAK (text: "Mức pin hiện tại đang thấp, robot xin phép trở về trạm sạc tự động.", language: "vi-VN", speed: 1.0)
  3. MOVE (target\_type: "STANDBY", target\_value: "CHARGING\_DOCK", speed: "NORMAL")
  4. SHOW (screen\_type: "SLIDE", content\_id: "CHARGING\_STATUS", timeout: 60)