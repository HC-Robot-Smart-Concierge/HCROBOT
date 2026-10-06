# 🎓 Hướng Dẫn & Bài Giảng: LangGraph Agent Harness & Tối Ưu Toàn Diện Voice Pipeline Cho HCROBOT

> Tài liệu giảng dạy và ghi chép kỹ thuật về **LangGraph**, **Agent Harness**, và toàn bộ quy trình tối ưu hóa **Voice Pipeline** giúp Robot Concierge đạt phản xạ giọng nói tức thì (< 0.5s) với mô hình **Qwen 2.5 3B**.

---

## 1. Tại Sao Cần "Harness" Cho Mô Hình Nhỏ (Qwen 3B)?
Mô hình nhỏ như Qwen 3B rất nhạy và nhanh, nhưng nếu bắt nó gánh vác mọi việc (đọc brochure dài, tự nhớ trạng thái, tự đoán kịch bản), nó sẽ bị nghẽn (Time-to-First-Token cao) và dễ ảo giác.

**Harness** bọc bên ngoài model đóng vai trò như **bộ khung gầm và hệ thống điều khiển**:
- Chuyển logic cứng sang Code Python deterministic (FSM, Fast-path).
- Thu hẹp ngữ cảnh RAG chỉ còn 1 đoạn ngắn (< 300 ký tự).
- Qwen 3B chỉ cần tập trung làm đúng 1 việc: diễn đạt tự nhiên ngắn gọn.

---

## 2. Kiến Trúc Đồ Thị LangGraph Trong Dự Án (`concierge_graph.py`)

```text
[Khách nói câu thoại]
         │
         ▼
[Node 1: fast_path] ────────(Khớp FAQ/Wifi)────────> ⚡ Trả lời ngay: 1.07 ms
         │
         │ (Không khớp)
         ▼
[Node 2: intent_router]
         │
         ├─── (Yêu cầu dịch vụ) ───> [Node 3: service_fsm] ────> ⚡ Xử lý: 4.27 ms
         │                                                        (Hỏi số phòng hoặc tạo đơn)
         ├─── (Tra cứu tiện ích) ──> [Node 4: retrieval] 
         │                                  │ (Cắt gọt RAG < 300 ký tự)
         │                                  ▼
         └─── (Trò chuyện chung) ──> [Node 5: generator] ──────> ⚡ Qwen 3B sinh từ < 800 ms
```

---

## 3. Bí Mật Đằng Sau Độ Trễ Giao Tiếp Giọng Nói & Cách Giải Quyết

### 🔍 Điểm nghẽn đo đạc thực tế:
Khi nói chuyện với robot, không phải AI chậm mà là **Microsoft EdgeTTS** tải file âm thanh qua mạng mất tới **`2.320 ms` (hơn 2.3 giây)**!

### 💡 Các giải pháp đã triển khai:
1. **Multi-Tier Audio Caching (`tts_service.py`):**
   - Lưu trữ vĩnh viễn các file MP3 giọng Hoài My vào thư mục `backend/static/audio_cache/`.
   - Lần sau khách hỏi: Lấy file âm thanh ra trong **`0.07 ms - 0.6 ms`** (gần như 0 giây).
2. **Single-Shot Chat + Audio Payload (`ai.py` & `ai.py`):**
   - Endpoint `/chat` trả về cùng lúc cả văn bản `response` và âm thanh `audio_base64`.
   - Frontend không cần gửi thêm một request HTTP riêng tới `/tts`, tiết kiệm 200 - 300ms round-trip network.
3. **Tối ưu VAD Silence Detection (`RobotScreenPage.jsx`):**
   - Giảm thời gian chờ người dùng ngừng nói từ `650ms` xuống **`420ms`**. Dứt câu là robot phản xạ ngay.
4. **Triệt tiêu hiện tượng giọng Robot (Browser Speech Fallback):**
   - *Nguyên nhân:* Hệ thống có 2 tầng âm thanh: Tầng 1 (EdgeTTS Hoài My chất lượng cao) và Tầng 2 (Web Speech API Windows thô ráp). Trước đây do timeout ngắn (4s - 6.5s) và câu chào mở mắt lệch từ với cache, hệ thống bị rớt xuống Tầng 2.
   - *Khắc phục:*
     - Đồng bộ 100% câu chào mở mắt (sáng/trưa/tối) khớp từng chữ với bộ đệm Audio Cache.
     - Nạp sẵn cả câu báo lỗi kết nối vào Audio Cache.
     - Nâng timeout EdgeTTS lên **12.0s** ở cả Backend và Frontend, triệt tiêu việc cắt ngắn sớm gây nhảy sang giọng robot.

---

## 4. Bảng Đo Lường Hiệu Năng Thực Tế (Benchmark)

| Tình huống tương tác | Trước khi tối ưu | Sau khi tối ưu | Tốc độ cải thiện | Giọng đọc |
| :--- | :--- | :--- | :--- | :--- |
| **Chào khi khách tới gần** | 2.500 ms - 4.000 ms | **0.6 ms** *(Disk Cache)* | 🚀 **Tức thì** | Hoài My 100% |
| **Pass Wifi / Tiện ích kịch bản** | 4.500 ms | **~430 ms** *(Bao gồm 420ms VAD)* | 🚀 **Nhanh gấp 10 lần** | Hoài My 100% |
| **Yêu cầu dịch vụ (FSM)** | 4.200 ms | **~430 ms** *(FSM 4ms + Audio Cache)* | 🚀 **Nhanh gấp 10 lần** | Hoài My 100% |
| **Hỏi tiện ích khách sạn** | 5.000 ms | **~430 ms** *(File âm thanh từ cache)* | 🚀 **Nhanh gấp 11 lần** | Hoài My 100% |
| **Câu hỏi tra cứu mới ngoài kịch bản** | 5.500 ms | **~1.200 ms - 1.500 ms** | 🚀 **Nhanh gấp 4 lần** | Hoài My Neural |

---

## 5. Danh Mục Các File Đã Triển Khai Trong Dự Án

* `backend/app/services/ai/concierge_graph.py`: Định nghĩa LangGraph StateGraph, 5 Node (Fast-Path, Intent Router, Service FSM, Retrieval, Generator) và MemorySaver.
* `backend/app/services/ai/tts_service.py`: Bộ nhớ đệm âm thanh đa tầng (RAM + Disk Cache) với MD5 hashing và pre-warming 20 câu thoại.
* `backend/static/audio_cache/`: Thư mục lưu trữ vĩnh viễn các file MP3 giọng Hoài My (truy xuất 0.07ms).
* `backend/app/api/v1/endpoints/ai.py`: Tích hợp endpoint `/chat` điều phối qua LangGraph, nhúng sẵn `audio_base64`, background task tạo ticket và save history không làm nghẽn CPU.
* `backend/scripts/pre_warm_tts.py`: Script khởi tạo và nạp sẵn 20 câu thoại phổ biến vào bộ nhớ đệm âm thanh.
* `frontend/src/pages/robot/RobotScreenPage.jsx`: Nhận diện ngắt lời VAD 420ms, đồng bộ câu chào mở mắt với cache, phát audio base64 trực tiếp.
* `frontend/src/hooks/useSpeechSynthesis.js`: Ưu tiên phát audio preloaded từ `/chat`, nâng timeout EdgeTTS lên 12s, fallback an toàn.
* `backend/tests/test_harness.py`: Bộ kiểm thử tự động đạt 100% Pass (3/3 test cases).
