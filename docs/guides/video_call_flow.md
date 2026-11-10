# LUỒNG PHIÊN DỊCH VÀ PHÁT ÂM THANH VIDEO CALL (STAFF ⇄ ROBOT)

> **Ghi chú điều hướng Obsidian:**
> Tài liệu kỹ thuật chi tiết của hệ thống Video Call được duy trì đồng bộ cùng mã nguồn giao diện tại:
> 📄 **[frontend/src/docs/video-call-flow.md](../../frontend/src/docs/video-call-flow.md)**

---

## 1. TỔNG QUAN HỆ THỐNG PHIÊN DỊCH VIDEO CALL

Hệ thống cung cấp kết nối video call thời gian thực hai chiều giữa **Robot Kiosk** (Khách hàng) và **Concierge Dashboard** (Nhân viên tổng đài) qua giao thức WebRTC (P2P), tích hợp công nghệ AI nhận diện giọng nói (STT), dịch thuật tức thì và tổng hợp giọng nói (TTS) đọc to bản dịch ở phía nhận.

### Kiến trúc các thành phần:
- **Signaling Hub:** WebSocket endpoint `/api/v1/operations/concierge/ws/video-call/{session_id}` quản lý bởi `VideoCallManager` (`backend/app/services/video_call_manager.py`).
- **Giao diện cuộc gọi:** `MessengerVideoCallModal.jsx` (`frontend/src/components/video/MessengerVideoCallModal.jsx`) chuẩn UI Messenger/FaceTime.
- **Thu âm STT độc lập:** **Call Audio Stream STT Adapter** đọc trực tiếp luồng PCM 16kHz WAV từ WebRTC Audio Track và gửi về `/api/v1/ai/stt/transcribe`.
- **Nhận diện ngôn ngữ âm học:** `STTService._transcribe_google_bilingual()` chấm điểm độ tự tin âm học song song `vi-VN` và `en-US`.
- **Dịch thuật:** `TranslationService.translate_text()` qua Google Translate HTTP client.
- **Tổng hợp giọng đọc:** `TTSService` với EdgeTTS (`vi-VN-HoaiMyNeural` cho Staff và `en-US-JennyNeural` cho Robot).

---

## 2. MA TRẬN XỬ LÝ NGÔN NGỮ

| Người nói | Chế độ | Ngôn ngữ phát hiện | Ngôn ngữ đích | Hành vi xử lý | Giọng đọc TTS phía nhận |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Guest (Robot)** | `EN ⇄ VI` | `en` | `vi` (Staff) | Dịch `EN → VI` (`needsTranslation: true`) | `vi-VN-HoaiMyNeural` (tại Staff) |
| **Guest (Robot)** | `EN ⇄ VI` | `vi` | `vi` (Staff) | Giữ nguyên gốc, không dịch vòng, không gọi TTS | Không phát TTS |
| **Staff** | `EN ⇄ VI` | `vi` | `en` (Guest) | Dịch `VI → EN` (`needsTranslation: true`) | `en-US-JennyNeural` (tại Robot) |
| **Staff** | `EN ⇄ VI` | `en` | `en` (Guest) | Giữ nguyên gốc, không dịch vòng, không gọi TTS | Không phát TTS |

---

## 3. CHUỖI TRUY VẾT BƯỚC LOG (END-TO-END TRACE)

```text
STT_STARTED -> STT_RESULT -> COMMITTED -> TRANSLATE_REQUEST -> TRANSLATED 
    -> SUBTITLE_SENT -> SUBTITLE_RECEIVED 
    -> TTS_REQUEST -> TTS_READY -> AUDIO_RECEIVED -> PLAY_STARTED -> PLAY_ENDED
```

*Xem tài liệu chi tiết đầy đủ với nhật ký kiểm thử và phân loại mã lỗi tại:* **[frontend/src/docs/video-call-flow.md](../../frontend/src/docs/video-call-flow.md)**.

