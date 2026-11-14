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

