# 📝 Báo Cáo Chi Tiết: Các Hạng Mục Đã Xử Lý & Nâng Cấp Hệ Thống Simulator

> **Dự án**: HCROBOT — Hotel Concierge Robot  
> **Thời gian cập nhật**: 14/11/2026  
> **Tập tin can thiệp chính**: `frontend/src/pages/admin/tabs/workflow/WorkflowSimulatorStudio.jsx`

---

## 1. Tổng Quan Công Việc Đã Thực Hiện

Trong phiên làm việc này, hệ thống đã giải quyết dứt điểm 2 bài toán lớn trong giao diện Sa bàn Mô phỏng Workflow (`WorkflowSimulatorStudio`):
1. **Khắc phục lỗi tê liệt tương tác 3 vùng chức năng (No-Go, Speed Zone, No-Stop)**: Người dùng trước đó không thể click, kéo thả, di chuyển hay đặt lại vị trí 3 vùng trên sa bàn; khi click vào vùng bị văng lỗi điều hướng robot nhầm.
2. **Đồng bộ 100% tính năng Đa giác (Polygon Zone) từ Physical Map sang Simulator**: Cho phép vẽ đa giác với HUD nổi cố định, xem lại các đỉnh, kéo thả đỉnh nắn hình, click cạnh để chèn đỉnh mới, xóa đỉnh bằng phím `Delete`/`Backspace` hoặc nút trên màn hình, và phím tắt `Esc` hủy thao tác.

---

## 2. Vấn Đề 1: Khắc Phục Lỗi Tương Tác & Di Chuyển 3 Vùng Trên Sa Bàn

### 2.1. Phân tích nguyên nhân gốc rễ (Root Cause)
* **Khóa CSS `pointer-events-none`**: Thẻ `<g data-zone="true">` bao bọc vùng trước đây bị gán cứng `className="pointer-events-none"` nếu chưa mở menu cấu hình bật công tắc sửa thủ công.
* **Xuyên click xuống sàn nhà (Click-through)**: Khi người dùng click chuột lên vùng để chọn hoặc dời chỗ, sự kiện chuột bị xuyên qua lớp vùng và rơi thẳng xuống sàn bản đồ SVG (`handleMapClick`).
* **Văng cảnh báo điều hướng nhầm**: Bản đồ hiểu nhầm người dùng đang muốn điều khiển Robot chạy đến tọa độ đó. Do tọa độ click rơi vào vùng `KEEP_OUT` (Quầy lễ tân), hệ thống kích hoạt cảnh báo đỏ:  
  `"Vị trí (...) thuộc Vùng cấm vào 'Phòng Nội Bộ Quầy Lễ Tân (Khu Vực Cấm Vào)'. Robot không được phép di chuyển vào đây!"` đồng thời vẽ mũi tên `"ĐIỀU HƯỚNG"` nhầm.
* **Chặn kéo thả**: Hàm `handleZonePointerDown` và `handleZoneClick` có điều kiện guard `if (!isZoneEditMode && selectedZone?.id !== zone.id) return;` ngăn cản mọi thao tác trực tiếp.

### 2.2. Giải pháp kỹ thuật đã áp dụng
1. **Khai thông Pointer Events**:
   * Chuyển trạng thái thẻ vùng sang `pointer-events-auto` và con trỏ `cursor-pointer` / `cursor-grab`.
   * Thêm `style={{ pointerEvents: 'all' }}` cho hình dạng đáy vùng để mọi cú click vào vùng mờ/trong suốt đều được nhận diện 100%.
2. **Chọn & Kéo thả trực tiếp tự do**:
   * Khi nhấn chuột xuống vùng (`handleZonePointerDown`), hệ thống lập tức gán `selectedZone`, kích hoạt chế độ sửa và sẵn sàng kéo thả di chuyển vị trí ngay lập tức (hoạt động mượt mà như các Điểm mốc / Endpoints).
3. **Chặn triệt để sự kiện xuyên sàn**:
   * Trong `handleMapClick`, kiểm tra `e.target?.closest('[data-zone]')` để loại bỏ hoàn toàn việc phát lệnh điều hướng robot khi thao tác với vùng.
4. **Thêm nút Đặt Lại Nhanh (`RotateCcw`)**:
   * Trên thanh công cụ nổi phía dưới, nếu vùng đang chọn là 1 trong 3 vùng mặc định ban đầu (`SIMULATOR_HOTEL_ZONES`), xuất hiện nút icon xoay tròn để khôi phục nhanh tọa độ chuẩn về sảnh 10m x 6m chỉ với 1 click.

---

## 3. Vấn Đề 2: Đồng Bộ Hoàn Thiện Tính Năng Polygon Zone (Đa Giác)

Toàn bộ logic xử lý hình học đa giác từ `AdminPhysicalMapTab.jsx` đã được tích hợp đầy đủ vào `WorkflowSimulatorStudio.jsx`.

### 3.1. Thanh điều khiển nổi khi vẽ (Drawing HUD Banner)
* **Vị trí**: Ghim cố định tại mép trên trung tâm bản đồ sa bàn khi đang ở chế độ vẽ (`zoneDrawType !== null`), không bao giờ bị ẩn hoặc đóng mất.
* **Thông tin hiển thị**:
  * Tên và màu sắc nhận diện của loại vùng đang vẽ (Cấm vào: Đỏ, Giới hạn tốc độ: Cam, Cấm dừng: Hồng).
  * Bộ đếm số lượng đỉnh real-time: `X/64 đỉnh`.
* **Nút bấm thao tác ngay trên HUD**:
  * **`✓ Hoàn tất / Lưu`**: Sáng xanh nổi bật khi đã chấm đủ $\ge 3$ đỉnh. Bấm trực tiếp tại đây để chốt hình và tạo vùng đa giác ngay, không cần kéo chuột đi đâu.
  * **`Bỏ đỉnh cuối`**: Xóa nhanh điểm vừa chấm nhầm gần nhất (`vertices.slice(0, -1)`).
  * **`Hủy (Esc)`**: Hủy bỏ phiên vẽ ngay lập tức.
* **Phím tắt**: Nhấn phím **`Escape`** trên bàn phím tại bất kỳ lúc nào để thoát chế độ vẽ.

### 3.2. Xem lại & Nắn chỉnh đỉnh Polygon đã tạo
* **Hiển thị trực quan**: Khi click chọn vào một vùng Polygon trên sa bàn:
  * Toàn bộ các đỉnh (vertices) hiện lên dạng nốt tròn trắng viền xanh lơ (`#0891B2`).
  * Đỉnh đang được chọn chuyển sang màu vàng hổ phách nổi bật (`#FBBF24`).
* **Kéo thả đỉnh để đổi hình dạng (`ZONE_VERTEX`)**:
  * Nhấn giữ chuột vào bất kỳ đỉnh nào và kéo để di dời đỉnh đó, cập nhật đa giác theo thời gian thực (tọa độ giới hạn an toàn trong phạm vi sảnh).
* **Click cạnh để chèn đỉnh mới (`insertZoneVertex`)**:
  * Rê chuột dọc theo các cạnh của đa giác, hệ thống tự động tính toán hình chiếu vuông góc (`polygonEdgeAtPoint`).
  * Khi chuột ở gần cạnh, xuất hiện nốt xanh lơ cùng dấu `+` nhỏ. Click trực tiếp vào cạnh sẽ chèn 1 đỉnh mới ngay vị trí đó và cho phép kéo luôn.
* **Xóa đỉnh bằng phím bàn phím hoặc nút giao diện**:
  * **Phím tắt**: Chọn đỉnh rồi bấm phím **`Delete`** hoặc **`Backspace`** trên bàn phím để xóa.
  * **Nút bấm trên thanh nổi**: Nút đỏ **`Xóa đỉnh #...`** xuất hiện tại thanh công cụ phía dưới màn hình khi có đỉnh đang được chọn.
  * **Bảo vệ an toàn**: Tự động khóa không cho xóa nếu đa giác chỉ còn 3 đỉnh (đảm bảo tính hợp lệ hình học).
* **Di chuyển cả khối**: Nhấn giữ chuột vào thân vùng đa giác để kéo toàn bộ hình dạng đi vị trí khác (`translateZone`).

---

## 4. Tóm Tắt Các Thay Đổi Mã Nguồn

| Thành phần | Tập tin can thiệp | Mô tả chi tiết |
|------------|-------------------|----------------|
| **Imports** | `WorkflowSimulatorStudio.jsx` | Thêm `removeZoneVertex`, `insertZoneVertex`, `polygonEdgeAtPoint`, `MAX_ZONE_VERTICES`, `MinusCircle`, `PlusCircle`. |
| **State** | `WorkflowSimulatorStudio.jsx` | Bổ sung `selectedZoneVertex`, `zoneEdgeHover`, `deleteZoneVertexRef`. |
| **Pointer Events** | `WorkflowSimulatorStudio.jsx` | Đổi `pointer-events-none` thành `pointer-events-auto` trên `<g data-zone="true">`; thêm `style={{ pointerEvents: 'all' }}`. |
| **Keyboard Listeners** | `WorkflowSimulatorStudio.jsx` | Lắng nghe sự kiện `Escape` (thoát vẽ) và `Delete` / `Backspace` (xóa đỉnh polygon). |
| **Edge Hover** | `WorkflowSimulatorStudio.jsx` | Bổ sung tính toán `polygonEdgeAtPoint` trong `handleSvgPointerMove` khi hover cạnh. |
| **Vertex Dragging** | `WorkflowSimulatorStudio.jsx` | Xử lý `dragState.type === 'ZONE_VERTEX'` cập nhật mượt mà mảng `vertices`. |
| **Drawing HUD** | `WorkflowSimulatorStudio.jsx` | Thêm banner cố định nổi góc trên sa bàn với nút Hoàn tất, Bỏ đỉnh cuối, Hủy. |
| **Floating Zone Bar** | `WorkflowSimulatorStudio.jsx` | Bổ sung hiển thị thông tin đa giác, nút Xóa đỉnh, nút Đặt lại vị trí mặc định. |

---

## 5. Kết Quả Kiểm Tra & Xác Nhận (Verification)

* **Vite Build**: Chạy lệnh build kiểm tra toàn bộ dự án:
  ```powershell
  cd d:\do_an_fptu\HCROBOT\frontend; npx vite build
  ```
  * Kết quả: `✓ built in 13.63s` — **Thành công 100% (Exit code 0, 0 lỗi cú pháp / 0 lỗi biên dịch)**.
* **Trải nghiệm UX**:
  * Thao tác chuột tự nhiên: Click là chọn, kéo là di chuyển.
  * Không còn xung đột giữa thao tác chỉnh sửa vùng và điều hướng robot.
  * Vẽ polygon nhanh chóng, có thể sửa đổi từng góc cạnh mà không cần phải vẽ lại từ đầu.

---

## 6. Bổ Sung Khách Giả Lập Trên Web — 14/11/2026

* Thêm biểu tượng **Guest 01 · Simulated**, đường đi minh họa, trạng thái và bong bóng hội thoại trên sa bàn; nhãn mới mặc định tiếng Anh, theo Settings khi chuyển tiếng Việt.
* Nhãn trên robot phân biệt màn hình chọn ngôn ngữ, menu, biểu mẫu dịch vụ, bản đồ, đánh giá và quảng cáo theo cấu hình bước `SHOW`; trạng thái khách dùng cùng cách phân loại. Sửa lỗi trước đây mọi bước `SHOW` đều bị ghi thành màn hình quảng cáo. Nhãn robot hỗ trợ EN/VI và phản ánh trạng thái Pause.
* Khách chờ ở cửa trong WF01; tiếp cận và tương tác theo các bước tư vấn, yêu cầu dịch vụ, đánh giá; đi theo dấu đường robot trong WF07 và rời phiên tại điểm đến khi robot quay về trạm.
* Thanh **Guest interaction** có **Guest arrives**, **Simulate reply**, **Guest leaves**. Trả lời chỉ minh họa hội thoại; gửi yêu cầu vẫn dùng form preview, không tạo phiếu thật từ lớp khách giả lập.
* WF06 tạm dừng tiến độ quảng cáo khi thêm khách và tiếp tục phần thời gian còn lại khi khách rời đi. Trạng thái trên robot đổi thành **Serving guest** trong lúc tạm dừng quảng cáo.
* Pause dừng chuyển động khách; Stop/Reset xóa khách. Chọn workflow hoặc bắt đầu lượt mới khởi tạo lại khách. Click biểu tượng khách không phát lệnh điều hướng.
* Các file mới: `simulatorGuestModel.js` (trạng thái và đường đi), `useSimulatedGuest.js` (vòng đời mô phỏng), `SimulatorGuest.jsx` (thanh điều khiển và biểu tượng). Tích hợp tại `WorkflowSimulatorStudio.jsx`; dùng cùng phép đổi tọa độ sa bàn và dữ liệu vật cản hiện có.
* Đã kiểm tra logic vòng đời, khoảng cách đi theo và render nhãn EN/VI bằng lệnh chạy trực tiếp trong bộ nhớ. Không tạo file test. Frontend build thành công; thao tác UI trực tiếp để người dùng kiểm tra.

### Cách kiểm tra UI

1. Mở **Workflow Step Management → Simulation**, chạy WF01: khách xuất hiện ở cửa và chờ robot chào; bấm **Simulate reply** khi khách đang tương tác để thấy phản hồi minh họa.
2. Chạy WF07: quan sát khách đi theo đường robot vừa đi, rồi rời tương tác khi robot quay về trạm.
3. Chạy WF06 tới bước quảng cáo, bấm **Guest arrives**: tiến độ tạm dừng; bấm **Guest leaves**: tiến độ tiếp tục từ phần đã chạy.
4. Thử Pause/Resume, Stop/Reset, đổi workflow và đổi Settings EN/VI; kiểm tra khách không bị giữ lại từ lượt trước và nhãn mới đổi đúng ngôn ngữ.

Khách này chỉ là lớp trực quan trên web; chưa tạo mô hình người hoặc vật cản cho LiDAR trong Gazebo.

## 7. Sửa Chuyển Động Khách Trong WF09 — 15/11/2026

* Nguyên nhân: bước ra cửa đón khách của WF09 được nhận diện là chờ, nhưng điểm chờ chỉ lấy theo đích robot cho WF01. Khách của WF09 đi tới điểm `(8.4, 9.6)` gần vị trí xuất phát của robot rồi quay lại cửa khi chuyển sang chào hỏi.
* Sửa điểm chờ theo đích của bước đón khách, dùng chung cho WF01, WF09 và workflow sao chép; không phụ thuộc mã WF01.
* Giữ điểm gặp ổn định khi chuyển giữa chào hỏi, chọn ngôn ngữ, menu và lựa chọn. Giữ đường đi còn lại khi khách đang theo kịp robot, kể cả khi workflow chuyển sang màn hình thông báo hoặc hỏi thêm.
* Kiểm tra logic trực tiếp bằng định nghĩa WF09 hiện tại: đón khách, chuyển các bước tương tác, nhánh bản đồ, vòng hỏi thêm, nhánh dẫn đường và quay về trạm. Không tạo file test.
* Kiểm tra UI: Stop/Reset rồi chạy lại WF09. Khách phải chờ gần cửa khi robot tới đón; chọn **Show me the map** thì khách đứng tại chỗ, chọn **Walk me there** thì khách mới đi theo robot.


## 8. Tách Chế Độ Sa Bàn Và Kiểm Tra Quy Tắc Vùng — 15/11/2026

### Thao tác trên UI

- Mặc định **Robot control / Điều khiển robot**: click sàn hoặc endpoint để điều hướng; không chọn, kéo hoặc xóa vùng/đỉnh. Icon trên vùng cũng không mở trình sửa.
- **Edit zones / endpoints / Sửa zone / endpoint**: chọn và kéo đối tượng, thêm/xóa đỉnh, vẽ polygon, sửa và lưu cấu hình. Click sàn trong chế độ này không gửi goal.
- Không chuyển sang Edit khi workflow đang chạy, đang Pause hoặc robot còn lộ trình di chuyển. Bấm Stop trước; chạy workflow tự chuyển về Control và xóa lựa chọn/draft đang vẽ.
- **Show zones / Hiện vùng** chỉ đổi lớp hiển thị; ẩn vùng không vô hiệu hóa quy tắc.
- Polygon tự cắt, vùng kéo ra ngoài sảnh và endpoint kéo vào KEEP_OUT/NO_STOP bị từ chối. Lỗi lưu vùng giữ trạng thái chưa lưu và báo lỗi thật.

### Quy định và lỗi đã sửa

| Vùng | Quy định | Xử lý hiện tại |
|---|---|---|
| KEEP_OUT | Không đi vào, không đặt đích/endpoint trong vùng | Web kiểm tra toàn bộ đoạn đường, có khoảng cách đệm 0.2 m; tìm đường vòng theo lưới 0.2 m, báo không có đường nếu bị chặn. Trước đây chỉ kiểm tra vài waypoint nên bỏ sót đoạn cắt qua vùng. |
| SPEED_ZONE | Tốc độ không vượt giới hạn khi đi trong vùng | Animation web dùng quãng đường/tốc độ thật thay cho thời lượng cố định 2.5–12 giây. Tách đường tại biên vùng, lấy giới hạn thấp nhất khi chồng vùng, kể cả chồng NO_STOP. HUD hiển thị m/s; 1x/2x/4x là tốc độ đồng hồ mô phỏng. |
| NO_STOP | Được đi qua, không chọn đích/endpoint hoặc thực hiện bước chờ trong vùng | Chọn điểm bên ngoài vùng để đi xuyên. Không tự sửa đích sang tọa độ suy đoán. Stop/Pause luôn được ưu tiên; không ép robot chạy khi người vận hành yêu cầu dừng. |

- Hình học polygon lõm và chữ nhật xoay được dùng khi kiểm tra đường đi; hình chữ nhật xoay và tay nắm resize được hiển thị theo cùng góc.
- `robot/scripts/autonomous_navigator.py` (được `launch_gazebo.sh` và `launch_autonomous_demo.sh` khởi chạy): giới hạn tốc độ được tính độc lập với nhãn vùng ưu tiên, lấy mức thấp nhất; giới hạn cả lệnh sau bộ lọc làm mượt. STOP/STANDBY không còn tự chạy 0.18 m/s trong NO_STOP. Không kết thúc goal ở trong NO_STOP chỉ vì đã lọt vào bán kính tới đích; tuần tra bỏ bước chờ ở vùng này.
- Nút Stop/Pause của simulator gửi `/nav_mode: STOP` cho navigator demo cùng lệnh vận tốc 0. Khi đang nối Gazebo, Stop không đặt lại tọa độ web giả; vị trí lấy từ telemetry.
- Backend đã có kiểm tra goal/endpoint KEEP_OUT và NO_STOP. Nav2 có KeepoutFilter và SpeedFilter, mask polygon và lấy giới hạn tốc độ thấp nhất; **NO_STOP là quy tắc đích/chờ, không phải một Nav2 costmap filter riêng**.
- `start_sim_foxglove.sh` với bản đồ đã lưu dùng Nav2 và mask theo map. Không đồng nhất chế độ này với navigator demo nhận `/hotel_zones`; cần đúng map và lưu/tải mask trước khi kiểm tra Nav2.

### Kiểm tra đã thực hiện và giới hạn

- Chạy trực tiếp trong bộ nhớ, không tạo file test: 9 nhóm kiểm tra đường cắt KEEP_OUT, đường bị chặn hoàn toàn, endpoint mặc định hợp lệ, polygon lõm, tốc độ/thời gian, vùng chồng nhau, vùng rất mỏng, chữ nhật xoay, NO_STOP và biên bản đồ.
- Thực thi các handler tương tác thật trong bộ nhớ: Control khóa edit, click Edit không phát goal, khóa chuyển mode khi chạy, xóa draft khi đổi mode. Kiểm tra polygon thêm/xóa đỉnh tiếp tục dùng hình học chung.
- Python: kiểm tra giới hạn tốc độ chồng vùng; thực thi nhánh STANDBY của `control_loop` khi ở NO_STOP; chạy các hàm sinh mask backend với đầu ra giữ trong bộ nhớ để kiểm tra polygon và speed overlap. Không ghi bản đồ, không gửi ROS goal, không tạo ticket.
- Frontend build thành công. Chưa chạy robot/Gazebo thực tế hoặc thao tác UI trực tiếp trong lượt sửa này; cần khởi động lại navigator demo để Python mới có hiệu lực. Chưa commit/push phần sửa này.

### Các bước người dùng kiểm tra UI

1. Mở Workflow Step Management → Simulation, chọn **Robot control**. Click một điểm trống rồi click vùng: robot điều hướng hoặc báo vi phạm; không hiện tay nắm sửa.
2. Bấm Stop → **Edit zones / endpoints**. Kéo endpoint, kéo đỉnh, click cạnh thêm đỉnh, chọn đỉnh rồi Delete; robot không di chuyển.
3. Vẽ KEEP_OUT chắn giữa hai điểm trống, lưu rồi về Control: robot phải đi vòng; nếu chắn hết đường thì phải báo không có lộ trình.
4. Vẽ SPEED_ZONE 0.10 m/s cắt đường đi, để 1x: khi qua vùng, tốc độ trên HUD không vượt 0.10. Chồng thêm vùng 0.05: phần giao áp dụng 0.05. Tắt Show zones rồi thử lại vẫn phải có hiệu lực.
5. Vẽ NO_STOP tại đoạn trống không chứa endpoint. Click trong vùng phải bị từ chối; chọn đích ngoài phía bên kia thì robot đi xuyên. Stop/Pause phải dừng, không tự chạy tiếp.
6. Với Gazebo demo đã khởi động lại: bật kết nối ROS, lưu zones, lặp lại bước 3–5 và đối chiếu chuyển động/telemetry. Với Nav2 bản đồ đã lưu, kiểm tra mask của đúng map riêng.
