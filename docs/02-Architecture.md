# TỔNG QUAN KIẾN TRÚC HỆ THỐNG HC-ROBOT (ARCHITECTURE)

> **Mục đích:** Đặc tả kiến trúc tổng thể, mô hình phân tầng, các luồng dữ liệu thời gian thực và cơ chế chịu lỗi của hệ thống Robot Trợ lý Dịch vụ Khách sạn (HC-Robot).
> **Ngày cập nhật đối chiếu:** 06/11/2026.
> **Tài liệu tham chiếu liên quan:**
> - Bản đồ file: [[01-File-Map|Bản đồ source code (File Map)]]
> - Báo cáo tối ưu hội thoại: [[ROBOT_CONVERSATION_FLOW_REPORT|Báo cáo Hội thoại Voice Pipeline]]
> - Đặc tả LangGraph: [[guides/langgraph_harness|LangGraph Agent Harness]]
> - Đặc tả phần cứng & ROS 2: [[guides/hardware_architecture|Đặc Tả Phần Cứng & ROS 2 Edge]]
> - Luồng Video Call 2 chiều: [[guides/video_call_flow|Luồng Phiên dịch Video Call (Staff ⇄ Robot)]] (Chi tiết mã nguồn: [video-call-flow.md](../frontend/src/docs/video-call-flow.md))
> - Quy chuẩn 7 Stepflows: [[workflows/stepflow|Kịch bản Stepflow Robot]]

---

## 1. Sơ Đồ Kiến Trúc Phân Tầng Tổng Thể

Hệ thống HC-Robot được thiết kế theo mô hình 4 tầng phân tán, kết nối qua mạng cục bộ LAN / VPN Tailscale:

```mermaid
graph TD
    subgraph TIER1["TẦNG 1: HARDWARE & EDGE (ROS 2 / ESP32)"]
        ESP32["ESP32 DevKitC (4 Encoders + 4 HC-SR04 + MPU-9250)"]
        LiDAR["RPLiDAR A1 (Quét laser 360° /scan)"]
        Camera["USB HD Camera (YOLOv8n Perception)"]
        PiNodes["Raspberry Pi 5 (odom_encoder, safety_controller, motor_driver)"]
        L298N["L298N Driver + 4x Motors (JGA25-370)"]
        Nav2["Nav2 Navigation Stack (DWB Controller, Costmaps)"]
        SLAM["SLAM Toolbox (Bản đồ sảnh 2D)"]

        ESP32 -- "Serial JSON (115200)" --> PiNodes
        LiDAR --> PiNodes
        Camera --> PiNodes
        LiDAR --> SLAM
        SLAM --> Nav2
        PiNodes -- "Lệnh lái an toàn" --> L298N
        PiNodes -- "Odometry /odom" --> Nav2
    end

    subgraph TIER2["TẦNG 2: CENTRAL BACKEND (FASTAPI & AI ENGINE)"]
        API["FastAPI REST & WebSocket Gateway (/api/v1)"]
        LangGraph["LangGraph Harness (concierge_graph.py)"]
        LLMCascade["4-Tier LLM Cascade (Groq -> Gemini -> Ollama -> Factsheet)"]
        TTSEngine["TTS Service (EdgeTTS Hoài My + Multi-tier Audio Cache)"]
        STTEngine["STT Service (Faster Whisper + Google Bilingual Audio)"]
        TransService["Translation Service (Google Translate HTTP Client)"]
        VideoHub["VideoCallManager Signaling WebSocket Hub"]
        NotifHub["NotificationManager WebSocket Hub"]
        Postgres[(PostgreSQL DB - SQLAlchemy 2.0)]
        Redis[(Redis Cache)]

        API --> LangGraph
        LangGraph --> LLMCascade
        API --> TTSEngine
        API --> STTEngine
        API --> TransService
        API --> VideoHub
        API --> NotifHub
        API --> Postgres
        API --> Redis
    end

    subgraph TIER3["TẦNG 3: ROBOT KIOSK INTERFACE (TOUCH & VOICE)"]
        KioskPage["RobotScreenPage.jsx (Desktop Kiosk) / MobileRobotScreen.jsx"]
        STTHook["useSpeechRecognition.js (VAD 1800ms)"]
        TTSHook["useSpeechSynthesis.js (Audio Base64 Preload)"]
        EarconUtil["audioFeedback.js (Web Audio Synthesizer Earcons)"]
        FloorMapUI["FloorMap.jsx (Bản đồ sảnh & Waypoints)"]
        SecretExit["Secret Multi-Tap Gesture Exit (5 lần / 2s)"]

        KioskPage --> STTHook
        KioskPage --> TTSHook
        KioskPage --> EarconUtil
        KioskPage --> FloorMapUI
        KioskPage --> SecretExit
    end

    subgraph TIER4["TẦNG 4: OPERATIONS & CONCIERGE DASHBOARDS"]
        ConciergeUI["ConciergeDashboard.jsx (Bàn trực tổng đài)"]
        VideoModal["MessengerVideoCallModal.jsx (WebRTC 2-Way Video Call)"]
        AdminUI["AdminPortalPage.jsx (Bản đồ, Kịch bản, RAG, Quảng cáo)"]
        DeptDashboards["Department Dashboards (Lễ tân, Buồng phòng, Bếp, Taxi, Bảo trì)"]

        ConciergeUI --> VideoModal
        AdminUI --> DeptDashboards
    end

    TIER3 -- "HTTP /chat (Text + Audio Base64)" --> API
    TIER3 -- "ROSBridge WebSocket (Waypoints/Teleop)" --> Nav2
    TIER4 -- "WebRTC P2P Media Stream (Video/Audio)" <--> TIER3
    TIER4 -- "WebSocket Signaling & Subtitles" <--> VideoHub
    TIER4 -- "WebSocket Department Notifications" <--> NotifHub
    TIER4 -- "REST CRUD & Dispatching" --> API
```

---

## 2. Luồng Xử Lý Hội Thoại Giọng Nói Tại Robot Kiosk (Voice Interaction Flow)

Luồng tương tác chính giữa khách hàng và Robot tại tiền sảnh được tối ưu hóa theo mô hình phản hồi tức thì:

```mermaid
sequenceDiagram
    autonumber
    actor Guest as Khách Hàng (Sảnh)
    participant Kiosk as RobotScreenPage.jsx
    participant AudioUtil as audioFeedback.js (Earcons)
    participant STT as useSpeechRecognition (VAD 1800ms)
    participant Backend as FastAPI /api/v1/ai/chat
    participant Graph as LangGraph Harness
    participant LLM as LLM Cascade (Groq Cloud)
    participant TTS as EdgeTTS + Audio Cache
    participant Speaker as Loa Robot (Web Audio API)

    Guest->>Kiosk: Bước lại gần robot (Camera AI / Chạm)
    Kiosk->>AudioUtil: playEarcon('listen_start')
    AudioUtil-->>Guest: Âm thanh 'bính boong' báo hiệu mở mic
    Kiosk->>STT: Bật micro lắng nghe khách
    Guest->>STT: Nói: "Cho tôi hỏi mật khẩu wifi của khách sạn"
    Note over STT: VAD đếm khoảng lặng 1800ms sau từ cuối cùng
    STT-->>Kiosk: Commit transcript hoàn chỉnh
    Kiosk->>AudioUtil: playEarcon('listen_end')
    Kiosk->>Backend: POST /api/v1/ai/chat { message: "...", session_id: "..." }
    
    Backend->>Graph: Chuyển message vào LangGraph StateGraph
    Note over Graph: Node fast_path khớp Regex Wifi (1.07 ms)
    Graph-->>Backend: Fast-path trả về câu trả lời định sẵn
    
    Backend->>TTS: Tổng hợp giọng nói Hoài My Neural
    Note over TTS: Trúng Disk Cache (backend/static/audio_cache/) trong 0.6 ms!
    TTS-->>Backend: Trả về audio_base64
    
    Backend-->>Kiosk: HTTP 200 { response: "Mật khẩu wifi...", audio_base64: "..." }
    Kiosk->>Speaker: Giải mã Base64 -> Phát tức thì qua AudioContext
    Speaker-->>Guest: Robot trả lời bằng giọng Hoài My tự nhiên
    Note over Kiosk: Bật phụ đề đồng bộ với âm thanh phát
```

### Điểm kỹ thuật cốt lõi:
1. **VAD Silence Duration (1800 ms):** Được cấu hình tại `SPEECH_FINAL_SILENCE_MS = 1800` trong `frontend/src/hooks/useSpeechRecognition.js` và `silenceTimeoutMs: 1800` trong `RobotScreenPage.jsx`. Con số này đã được kiểm nghiệm thực tế giúp triệt tiêu hoàn toàn hiện tượng cướp lời khi khách ngắt quãng suy nghĩ, đồng thời vẫn giữ được nhịp phản hồi tự nhiên.
2. **Single-Shot Payload:** `/api/v1/ai/chat` trả về đồng thời cả `response` (văn bản) và `audio_base64` (âm thanh). Frontend không cần gọi thêm request thứ hai lên `/tts`, tiết kiệm 250 - 400ms độ trễ mạng.
3. **Earcon Không Phụ Thuộc File Ngoại Vi:** `audioFeedback.js` sử dụng Web Audio API thuần (`OscillatorNode` và `GainNode`) để tự tổng hợp sóng âm âm học tần số chính xác (ví dụ `listen_start`: 587Hz $\rightarrow$ 880Hz), không bao giờ gặp lỗi 404 hoặc lag do tải file MP3.

---

## 3. Kiến Trúc Phiên Dịch Video Call Hai Chiều (Staff ⇄ Robot)

Khi khách cần hỗ trợ chuyên sâu, Robot Kiosk kết nối cuộc gọi video call WebRTC với Bàn trực Concierge:

```mermaid
sequenceDiagram
    autonumber
    actor Staff as Nhân Viên Concierge (Staff)
    participant ModalStaff as MessengerVideoCallModal.jsx (Staff)
    participant WSHub as VideoCallManager WebSocket Hub
    participant ModalRobot as MessengerVideoCallModal.jsx (Robot)
    actor Guest as Khách Hàng (Robot Kiosk)
    participant BackendAI as FastAPI AI (STT / Trans / TTS)

    Note over ModalStaff,ModalRobot: Cuộc gọi WebRTC P2P đã kết nối (Chế độ EN ⇄ VI)
    
    rect rgb(240, 248, 255)
    Note over Guest,ModalStaff: CHIỀU ROBOT → STAFF (Khách nói tiếng Anh)
    Guest->>ModalRobot: Khách nói: "Where is the swimming pool?"
    ModalRobot->>BackendAI: Call Audio Stream Adapter gửi WAV chunk -> /api/v1/ai/stt/transcribe
    BackendAI-->>ModalRobot: COMMITTED text="Where is the swimming pool?", lang="en"
    ModalRobot->>BackendAI: POST /api/v1/ai/translate (src='en', tgt='vi')
    BackendAI-->>ModalRobot: TRANSLATED text="Hồ bơi ở đâu vậy ạ?", needsTranslation=true
    ModalRobot->>WSHub: sendSignaling('live_subtitle', { text: "Hồ bơi...", original: "Where..." })
    WSHub->>ModalStaff: SUBTITLE_RECEIVED -> Hiển thị phụ đề tiếng Việt trên màn hình Staff
    ModalRobot->>BackendAI: POST /api/v1/ai/tts { text: "Hồ bơi...", voice: "vi-VN-HoaiMyNeural" }
    BackendAI-->>ModalRobot: TTS_READY (audio_base64)
    ModalRobot->>WSHub: sendSignaling('live_audio', { audio_base64, seq: 1 })
    WSHub->>ModalStaff: AUDIO_RECEIVED (seq: 1)
    ModalStaff->>ModalStaff: Audio Queue giải mã -> Phát giọng đọc tiếng Việt cho Staff nghe!
    end

    rect rgb(255, 245, 238)
    Note over Staff,ModalRobot: CHIỀU STAFF → ROBOT (Nhân viên nói tiếng Việt)
    Staff->>ModalStaff: Nhân viên trả lời: "Dạ, hồ bơi ở tầng 3 anh nhé"
    ModalStaff->>BackendAI: Call Audio Stream Adapter -> /api/v1/ai/stt/transcribe
    BackendAI-->>ModalStaff: COMMITTED text="Dạ hồ bơi ở tầng 3 anh nhé", lang="vi"
    ModalStaff->>BackendAI: POST /api/v1/ai/translate (src='vi', tgt='en')
    BackendAI-->>ModalStaff: TRANSLATED text="The swimming pool is on the 3rd floor, sir", needsTrans=true
    ModalStaff->>WSHub: sendSignaling('live_subtitle', { text: "The swimming pool...", original: "..." })
    WSHub->>ModalRobot: SUBTITLE_RECEIVED -> Hiển thị phụ đề tiếng Anh trên màn hình Robot
    ModalStaff->>BackendAI: POST /api/v1/ai/tts { text: "The swimming pool...", voice: "en-US-JennyNeural" }
    BackendAI-->>ModalStaff: TTS_READY (audio_base64)
    ModalStaff->>WSHub: sendSignaling('live_audio', { audio_base64, seq: 2 })
    WSHub->>ModalRobot: AUDIO_RECEIVED (seq: 2)
    ModalRobot->>ModalRobot: Audio Queue giải mã -> Loa Robot phát giọng đọc tiếng Anh cho Khách nghe!
    end
```

### Cơ chế chống treo và phục hồi hàng đợi âm thanh:
1. **Call Audio Stream STT Adapter:** Đọc 16kHz PCM WAV trực tiếp từ `localStreamRef` bằng Web Audio ScriptProcessor/AudioWorklet và gửi về backend. Cơ chế này hoạt động độc lập hoàn toàn với `webkitSpeechRecognition`, khắc phục triệt để lỗi trình duyệt tự hủy STT khi chạy 2 tab hoặc WebRTC microphone lock.
2. **Playback Watchdog (`playbackWatchdogRef`):** Đặt timeout 400ms khi gọi `AudioContext.resume()`. Nếu sau thời gian quy định không nhận được callback `onended`, watchdog sẽ tự động giải phóng cờ `isAiSpeakingRef`, chống kẹt hàng đợi phát âm thanh.
3. **Bỏ qua tuần tự lỗi (`advanceExpectedSeqOnFailure`):** Khi một gói âm thanh TTS bị lỗi (`live_audio_status: { status: 'failed', seq }`), phía nhận lập tức đẩy con trỏ `expectedPlaySeqRef` tiến lên 1 bước, không bắt các câu nói kế tiếp phải chờ 1.2s timeout.

---

## 4. Mô Hình Điều Phối Nghiệp Vụ Khách Sạn (Operations & Stepflows)

Mọi yêu cầu dịch vụ phát sinh từ hội thoại AI hoặc thao tác bấm chọn trên Kiosk Robot được chuyển hóa thành các phiếu nghiệp vụ (Department Tickets) theo vòng đời thống nhất:

```mermaid
stateDiagram-v2
    [*] --> PENDING: Khởi tạo từ Kiosk (Voice/Touch)
    PENDING --> IN_PROGRESS: Nhân viên phòng ban Nhận việc (Assign)
    IN_PROGRESS --> COMPLETED: Hoàn tất phục vụ
    IN_PROGRESS --> CANCELLED: Hủy bỏ hoặc Từ chối kèm lý do
    COMPLETED --> [*]
    CANCELLED --> [*]
```

### Các phòng ban nghiệp vụ tích hợp:
- **Lễ tân (Reception):** Nhận diện thủ tục nhận/trả phòng, giải đáp quy định lưu trú.
- **Buồng phòng (Housekeeping):** Dọn phòng, bổ sung khăn tắm, nước uống, đồ amenities.
- **Bếp & Nhà hàng (Kitchen & F&B):** Tiếp nhận order món từ `RobotFoodMenuScreen.jsx`, chuyển thẳng vào KDS Bếp (`KitchenDashboard.jsx`).
- **Phục vụ phòng (Room Service):** Xác thực số phòng và mã PIN khách hàng qua `RoomPickerModal.jsx` (đã bỏ cơ chế quẹt thẻ NFC cũ), chuyển yêu cầu giao đồ ăn/dụng cụ lên phòng.
- **Vận chuyển & Đặt xe (Taxi Services):** Hỗ trợ khách đặt taxi 4 chỗ/7 chỗ, ước tính thời gian đón và hãng xe đối tác.
- **Hành lý (Bell Services):** Hỗ trợ mang vác hành lý lên phòng hoặc gửi đồ tại sảnh.
- **Kỹ thuật & Bảo trì (Maintenance):** Báo hỏng điều hòa, bóng đèn, khóa cửa phòng.

### 8 Khối lệnh Stepflow cốt lõi (Workflow Builder):
1. **MOVE:** Điều khiển Robot tự hành tới điểm đích (Waypoints: Lobby, Reception, Restroom, Sofa,...) bằng ROS 2 Nav2.
2. **GREET:** Chào mừng khách kèm biểu cảm cười trên `RobotFace.jsx` và nhấp nháy đèn trạng thái.
3. **SPEAK:** Phát câu thông báo hoặc giải đáp ra loa bằng EdgeTTS Hoài My.
4. **SHOW:** Hiển thị giao diện menu món ăn, bản đồ tiện ích hoặc slide quảng cáo khuyến mãi.
5. **LISTEN:** Mở micro thu âm câu trả lời của khách (kèm VAD 1800ms).
6. **RECOMMEND:** Đề xuất thông minh món ăn hoặc dịch vụ phù hợp với khung giờ.
7. **CREATE_REQUEST:** Tự động đóng gói phiếu dịch vụ gửi về phòng ban tương ứng qua WebSocket.
8. **FEEDBACK:** Bật modal 5 sao thu thập mức độ hài lòng của khách trong 3 giây.

---

## 5. Cơ Chế Chịu Lỗi & Chiến Lược Dự Phòng (Resilience & Fallback Strategy)

Hệ thống HC-Robot được trang bị các lớp phòng vệ (Graceful Degradation) đảm bảo robot không bao giờ rơi vào trạng thái "chết lặng" khi gặp sự cố mạng hoặc phần cứng:

| Thành phần | Mức ưu tiên 1 (Chính) | Mức ưu tiên 2 (Dự phòng 1) | Mức ưu tiên 3 (Dự phòng 2) | Mức ưu tiên 4 (Cứu cánh cuối cùng) |
| :--- | :--- | :--- | :--- | :--- |
| **LLM Inference** | **Groq Cloud** (`llama-3.3-70b-versatile` / `llama-3.1-8b-instant`) | **Google Gemini Flash** (`gemini-1.5-flash`) | **Ollama Local** (`qwen2.5:3b` trên NUC) | **Factsheet tĩnh** (Đọc từ điển câu trả lời cứng trong file MD) |
| **Text-to-Speech (TTS)** | **EdgeTTS Hoài My** (`vi-VN-HoaiMyNeural` tải từ đám mây) | **Multi-tier Audio Cache** (File MP3 có sẵn trên ổ cứng máy chủ) | **Google Translate TTS HTTP** | **Web Speech API** (Bộ đọc giọng nói tích hợp sẵn trong trình duyệt) |
| **Speech-to-Text (STT)** | **Web Speech API** (`webkitSpeechRecognition`) | **Call Audio Stream STT Adapter** (16kHz PCM WAV qua `/stt/transcribe`) | **Google Bilingual STT** (Chấm điểm độ tự tin âm học song song EN/VI) | **Màn hình cảm ứng** (Khách bấm nút chọn trực tiếp) |
| **Định vị & Bản đồ** | **LiDAR SLAM 2D + Nav2** (Tự hành thông minh) | **Waypoint tĩnh** (Di chuyển theo các điểm mốc đã lưu sẵn) | **Teleop Web Control** (Nhân viên lái thủ công từ xa qua phím mũi tên) | **Đứng yên tại trạm chào** |
