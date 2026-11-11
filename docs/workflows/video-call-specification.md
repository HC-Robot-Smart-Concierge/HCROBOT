# TÀI LIỆU KỸ THUẬT: VIDEO CALL (ROBOT-TO-HUMAN ESCALATION & AUTO-TRANSLATION)

> **Mã quy trình (Workflow):** `WF-04` (Robot-to-Human Handoff & Remote Assistance)  
> **Phiên bản:** v2.3.0  
> **Cập nhật ngày:** 11/11/2026  
> **Phân hệ phụ trách:** Frontend (Kiosk/Dashboard/Admin), Backend (FastAPI WebRTC Signaling, Cloudinary Storage & AI Auto-Translate)

---

## 1. TỔNG QUAN VÀ LUỒNG NGHIỆP VỤ (OVERVIEW)

Tính năng **Video Call** cung cấp kênh giao tiếp âm thanh và hình ảnh 2 chiều theo thời gian thực (Real-time WebRTC 2-Way Call) giữa khách lưu trú tại **Robot Kiosk** và nhân viên lễ tân tại **Concierge Dashboard**.

### Luồng nghiệp vụ cốt lõi:
1. **Kích hoạt (Trigger):**
   - Khách bấm nút *"Gọi nhân viên lễ tân"* trên màn hình Kiosk.
   - Hoặc khách phát biểu bằng giọng nói: *"Gọi nhân viên giúp tôi"* / *"Please call staff"*. AI LangGraph (`concierge_graph.py`) nhận diện ý định và trả cờ `trigger_video_call: true`.
2. **Bắt tay & Kết nối (Signaling & WebRTC Peer Connection):**
   - Kiosk và Dashboard kết nối vào phòng gọi chung qua WebSocket Signaling Hub tại `/api/v1/operations/concierge/ws/video-call/{session_id}` (`video_call_manager.py`).
   - Trao đổi SDP Offer, Answer và ICE Candidates (hỗ trợ cả P2P Direct trong mạng LAN và mDNS De-anonymization qua Server LAN IP).
3. **Phiên dịch Song ngữ Trực tiếp (Live Auto-Translation & TTS):**
   - Tự động nhận diện giọng nói (STT) và phân tách ngôn ngữ nguồn (Source Language) theo từng câu.
   - Phiên dịch 2 chiều Anh - Việt (`translation_service.py`):
     - Khách nói tiếng Anh $\rightarrow$ Phụ đề tiếng Việt gửi tới Dashboard nhân viên.
     - Nhân viên nói tiếng Việt $\rightarrow$ Dịch sang tiếng Anh, hiển thị phụ đề và loa Kiosk phát âm thanh đọc tiếng Anh bằng Edge TTS (`en-US-JennyNeural`).
4. **Lưu trữ Bản ghi Cuộc gọi Bất đồng bộ (Async Cloudinary Recording):**
   - Ghi hình video bằng `MediaRecorder` với bitrate tối ưu `600 Kbps`.
   - Khi kết thúc cuộc gọi: Đóng giao diện tức thì, gửi file video và phụ đề về Backend tiếp nhận (`HTTP 202 Accepted`).
   - Tác vụ nền (`BackgroundTasks`) tải video lên **Cloudinary Cloud Storage** (tự động fallback sang **Local Storage** nếu mạng ngoài gặp sự cố).

---

## 2. KIẾN TRÚC VÀ CÁC THÀNH PHẦN (COMPONENTS)

### 2.1. Frontend (`frontend/src/components/video/`):
- [`MessengerVideoCallModal.jsx`](file:///d:/FPT_Learning2026/FPT_Ky9/Đồ%20Án/repo/HCROBOT/frontend/src/components/video/MessengerVideoCallModal.jsx): Giao diện cuộc gọi dạng Messenger hiện đại, quản lý camera, mic, WebRTC peer connection, bộ thu âm audio và xử lý dập máy.
- [`videoCallTranslationHelpers.js`](file:///d:/FPT_Learning2026/FPT_Ky9/Đồ%20Án/repo/HCROBOT/frontend/src/components/video/videoCallTranslationHelpers.js):
  - `normalizeLanguageCode()`: Chuẩn hóa nhị phân mã ngôn ngữ (chỉ nhận diện `vi` hoặc `en`).
  - `evaluateSpokenTextCommit()`: Bộ lọc chống vọng âm (Echo Guard) và lọc bỏ chữ tượng hình CJK ngoại lai (`FOREIGN_SCRIPT_REJECTED`).
  - `advanceExpectedSeqOnFailure()`: Cơ chế tự phục hồi hàng đợi âm thanh khi TTS gặp lỗi.
  - `encodeWavBlobFromFloat32()`: Đóng gói PCM 16kHz mono phục vụ STT Audio Stream.
- [`frontend/src/pages/dashboard/ConciergeDashboard.jsx`](file:///d:/FPT_Learning2026/FPT_Ky9/Đồ%20Án/repo/HCROBOT/frontend/src/pages/dashboard/ConciergeDashboard.jsx):
  - Tiếp nhận cuộc gọi đến từ Kiosk.
  - Quản lý lịch sử bản ghi cuộc gọi với các trạng thái: `Đang lưu bản ghi...` (`saving`), `Xem Bản Ghi` (`ready`), và `Lưu thất bại` (`failed`).
- [`frontend/src/pages/admin/tabs/AdminVideoCallsTab.jsx`](file:///d:/FPT_Learning2026/FPT_Ky9/Đồ%20Án/repo/HCROBOT/frontend/src/pages/admin/tabs/AdminVideoCallsTab.jsx):
  - Tab "Theo dõi cuộc gọi" chuyên biệt dành cho Admin Portal (Google-style minimal layout).
  - 4 Cards chỉ số: Tổng cuộc gọi, Có thể xem, Đang lưu ngầm, Lưu thất bại.
  - Nút "Đồng bộ Cloudinary" tự động quét và map video có sẵn trên Cloud về CSDL.
  - Bộ lọc khoảng ngày (Từ ngày - Đến ngày), lọc trạng thái bản ghi và tìm kiếm phiên gọi.
  - Modal phát video tích hợp kèm thanh tua và liên kết CDN trực tiếp.

### 2.2. Backend (`backend/app/`):
- [`services/video_call_manager.py`](file:///d:/FPT_Learning2026/FPT_Ky9/Đồ%20Án/repo/HCROBOT/backend/app/services/video_call_manager.py): Signaling Hub quản lý danh sách phòng, alias tương đương (`ticket_code`, `req.id`), và phát hiện Server LAN IP.
- [`api/v1/endpoints/operations/concierge.py`](file:///d:/FPT_Learning2026/FPT_Ky9/Đồ%20Án/repo/HCROBOT/backend/app/api/v1/endpoints/operations/concierge.py):
  - WebSocket `/ws/video-call/{session_id}`: Trao đổi gói tin SDP/ICE, live subtitles, audio sync.
  - `POST /concierge/recordings/{session_id}`: Tiếp nhận file video bất đồng bộ (`HTTP 202 Accepted`), đẩy vào `BackgroundTasks`.
  - `POST /concierge/recordings/sync-cloudinary`: Quét và đồng bộ các video có sẵn trên Cloudinary về DB (Hướng 1).
  - `GET /concierge/video-calls/metrics`: API thống kê toàn cục 4 chỉ số video call cho Admin.
  - `GET /concierge/recordings/local/{filename}`: Phục vụ stream video từ thư mục `./uploaded_recordings/` khi chạy local fallback.
- [`services/cloudinary_service.py`](file:///d:/FPT_Learning2026/FPT_Ky9/Đồ%20Án/repo/HCROBOT/backend/app/services/cloudinary_service.py):
  - `upload_video_recording()`: Upload video lên Cloudinary folder `hcrobot/call_recordings`.
  - `list_video_recordings()`: Quét danh sách video đã lưu trên Cloudinary theo tiền tố thư mục.
  - Tự động sinh thumbnail `.jpg`.
  - Cơ chế tự động fallback `_save_locally()` khi Cloudinary hết quota hoặc mất mạng.
- [`services/ai/translation_service.py`](file:///d:/FPT_Learning2026/FPT_Ky9/Đồ%20Án/repo/HCROBOT/backend/app/services/ai/translation_service.py):
  - Nhận diện nhị phân ngôn ngữ (Binary Language Normalization).
  - Lọc bỏ transcript CJK (`CJK_AND_NON_LATIN_SCRIPT_REGEX`).
  - Google GTX API (truyền tường minh mã nguồn `vi` hoặc `en`).

---

## 3. CHECKLIST KIỂM THỬ KHI NÂNG VERSION (VERSION UPGRADE CHECKLIST)

Khi nâng cấp phiên bản hoặc merge code vào `development`, bắt buộc chạy lại bộ kiểm thử tự động sau:

```bash
# 1. Kiểm thử Frontend Video Call & Admin Tab (Vitest: 25 tests pass)
npm --prefix frontend test MessengerVideoCallModal AdminVideoCallsTab

# 2. Kiểm thử Backend (Pytest: 9 tests pass)
cd backend && .venv\Scripts\python -m pytest tests/test_video_call.py tests/test_translation_api.py
```

### Bảng đối chiếu các ca kiểm thử hồi quy:

| ID | Tình huống kiểm tra | Kết quả mong đợi |
| :--- | :--- | :--- |
| **TC-VC01** | Khách nói tiếng Anh: *"Where is the swimming pool?"* | Dịch sang tiếng Việt *"Hồ bơi ở đâu?"*, hiển thị phụ đề cho Staff. |
| **TC-VC02** | Nhân viên nói tiếng Việt: *"Dạ bể bơi ở tầng 3 ạ"* | Dịch sang tiếng Anh, loa Robot phát âm thanh TTS giọng `en-US-JennyNeural`. |
| **TC-VC03** | Khách nói tiếng Việt xen lẫn tiếng Anh: *"Phòng VIP 402 cần check in"* | Nhận diện đúng tiếng Việt, không bị cắt từ, không đổi mode phiên. |
| **TC-VC04** | Câu ngắn không dấu: *"phong 402"*, *"ho boi"* | Khớp từ điển `COMMON_VIETNAMESE_WORDS`, phân loại đúng `vi`. |
| **TC-VC05** | Mã lạ hoặc transcript dính chữ tượng hình (`ja/zh/ko/es`, `こんにちは`) | Bị chặn bởi `FOREIGN_SCRIPT_REJECTED`, không sinh lỗi âm thanh hoặc dịch bừa bãi. |
| **TC-VC06** | Kết thúc cuộc gọi khi mạng Cloudinary chậm | Modal đóng ngay lập tức, camera/mic tắt, video upload ngầm trong background task. |
| **TC-VC07** | Mất kết nối Internet khi lưu video | Tự động lưu vào local `./uploaded_recordings/`, Dashboard xem lại bình thường. |

---

## 4. HƯỚNG DẪN CẤU HÌNH & TRIỂN KHAI (CONFIGURATION GUIDE)

File cấu hình `.env` tại thư mục `backend/`:

```env
# 1. Cấu hình Cloudinary Video Storage (Tùy chọn, tự động fallback local nếu để trống)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
CLOUDINARY_FOLDER=hcrobot/call_recordings

# 2. Cấu hình AI Dịch thuật & TTS
AI_PROVIDER=ollama
EDGE_TTS_VOICE_VI=vi-VN-HoaiMyNeural
EDGE_TTS_VOICE_EN=en-US-JennyNeural
```

*(Ghi chú: Khi demo trong môi trường không có Internet, hệ thống sẽ tự động lưu video vào thư mục `backend/uploaded_recordings/` và mount endpoint `/api/v1/operations/concierge/recordings/local/{filename}` mà không phát sinh bất kỳ lỗi nào).*

