# BẢN ĐỒ KIỂM KÊ SOURCE CODE DỰ ÁN HC-ROBOT (FILE MAP)

> **Mục đích:** Bảng tra cứu toàn diện cấu trúc source code dự án HC-Robot, xác định trách nhiệm, thành phần chính, quan hệ sử dụng, liên kết tài liệu kỹ thuật và mức độ xác minh thực tế đối chiếu từ mã nguồn.
> **Ngày rà soát đối chiếu:** 11/11/2026.
> **Quy ước mức xác minh:**
> - `[Đã đối chiếu code]`: Đã đọc nội dung code, xác minh symbol, tham số và quan hệ gọi thực tế trong workspace.
> - `[Đã kiểm tra bằng test]`: Đã xác minh qua test tự động (Vitest/Pytest) hoặc log chạy thực tế.
> - `[Chưa xác minh]`: Module ngoại vi, phần cứng ROS 2/ESP32 thực tế hoặc dịch vụ phụ thuộc môi trường bên ngoài chưa kiểm thử trực tiếp trong phiên.

---

## 1. Backend Core & Configuration (FastAPI Server)

| Đường dẫn | Trách nhiệm | Thành phần chính | Nơi sử dụng | Note liên quan | Mức xác minh |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `backend/app/main.py` | Khởi tạo ứng dụng FastAPI, quản lý vòng đời (lifespan), mount static files, đăng ký middleware và router | `app`, `lifespan()`, `health_check()` | Entry point khi chạy Uvicorn | [Kiến trúc](02-Architecture.md) | `[Đã đối chiếu code]` |
| `backend/app/core/config.py` | Cấu hình toàn bộ biến môi trường hệ thống (Pydantic BaseSettings) | `Settings`, `settings` (LLM, DB, Redis, Cloudinary, JWT) | Toàn bộ backend services & endpoints | [Kiến trúc](02-Architecture.md) | `[Đã đối chiếu code]` |
| `backend/app/core/database.py` | Quản lý kết nối cơ sở dữ liệu PostgreSQL qua SQLAlchemy 2.0 AsyncEngine | `engine`, `AsyncSessionLocal`, `Base`, `init_db()`, `get_db()` | Các repositories và lifespan startup | [Alembic Guide](guides/alembic_guide.md) | `[Đã đối chiếu code]` |
| `backend/app/core/security.py` | Xác thực mật khẩu và sinh mã JWT | `verify_password()`, `get_password_hash()`, `create_access_token()`, `decode_access_token()` | `auth.py`, `middlewares/security.py` | [Kiến trúc](02-Architecture.md) | `[Đã đối chiếu code]` |
| `backend/app/api/v1/router.py` | Gom toàn bộ endpoint routers của API v1 kèm response schemas chuẩn hóa | `api_router` (auth, ai, scenarios, map, workflows, rag, operations, logs, advertisements) | `main.py` (`/api/v1`) | [Kiến trúc](02-Architecture.md) | `[Đã đối chiếu code]` |
| `backend/app/interceptors/route_interceptor.py` | AOP Interceptor bọc các API routes để log thời gian xử lý và bắt lỗi chuẩn hóa | `RouteInterceptor`, `AOPRoute` | `api/v1/router.py` | [Kiến trúc](02-Architecture.md) | `[Đã đối chiếu code]` |
| `backend/app/middlewares/correlation_id.py` | Gán Correlation ID (`X-Correlation-ID`) cho từng HTTP request để truy vết phân tán | `CorrelationIdMiddleware` | `middlewares/__init__.py` | [Kiến trúc](02-Architecture.md) | `[Đã đối chiếu code]` |
| `backend/app/middlewares/error_handler.py` | Bắt lỗi ngoại lệ toàn cục và trả về JSON chuẩn HTTP 400/404/500 | `global_error_handler()`, `AppException` | `middlewares/__init__.py` | [Kiến trúc](02-Architecture.md) | `[Đã đối chiếu code]` |
| `backend/app/middlewares/logging_middleware.py` | Ghi log thời gian phản hồi (latency), IP client, status code của từng request | `LoggingMiddleware` | `middlewares/__init__.py` | [Kiến trúc](02-Architecture.md) | `[Đã đối chiếu code]` |
| `backend/app/middlewares/security.py` | Bổ sung các header bảo mật HTTP (X-Frame-Options, CSP, HSTS) | `SecurityHeadersMiddleware` | `middlewares/__init__.py` | [Kiến trúc](02-Architecture.md) | `[Đã đối chiếu code]` |

---

## 2. Backend AI & Voice Pipeline Engine

| Đường dẫn | Trách nhiệm | Thành phần chính | Nơi sử dụng | Note liên quan | Mức xác minh |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `backend/app/services/ai/ai_chat_service.py` | Điều phối hội thoại AI Concierge qua 4 tầng LLM cascade và tích hợp TTS trực tiếp | `process_chat_request()`, fallback cascade: Groq $\rightarrow$ Gemini $\rightarrow$ Ollama $\rightarrow$ Factsheet | `api/v1/endpoints/ai.py` (`/chat`) | [Tối ưu AI](guides/ai_optimization.md) | `[Đã đối chiếu code]` |
| `backend/app/services/ai/concierge_graph.py` | LangGraph StateGraph harness bọc ngoài model: Fast-path $\rightarrow$ Intent Router $\rightarrow$ Service FSM / Retrieval / Generator | `build_concierge_graph()`, `fast_path_node`, `intent_router_node`, `service_fsm_node`, `generator_node` | `ai_chat_service.py` | [LangGraph Harness](guides/langgraph_harness.md) | `[Đã đối chiếu code]` |
| `backend/app/services/ai/tts_service.py` | Tổng hợp giọng nói EdgeTTS (`vi-VN-HoaiMyNeural`, `en-US-JennyNeural`), bộ đệm đa tầng (RAM LRU + Disk Cache) và Google TTS fallback | `TTSService`, `synthesize()`, `_synthesize_edge_tts_detailed()`, `warm_up_common_phrases()` | `ai_chat_service.py`, `ai.py` (`/tts`), video call | [Tối ưu AI](guides/ai_optimization.md) | `[Đã đối chiếu code]` |
| `backend/app/services/ai/stt_service.py` | Nhận diện giọng nói từ file audio WAV: tự động chọn Faster Whisper hoặc Google Bilingual STT kèm chấm điểm độ tự tin âm học | `STTService`, `transcribe_audio_wav_detailed()`, `_transcribe_google_bilingual()` | `api/v1/endpoints/ai.py` (`/stt/transcribe`) | [Luồng Video Call](guides/video_call_flow.md) | `[Đã đối chiếu code]` |
| `backend/app/services/ai/translation_service.py` | Dịch thuật hai chiều đa ngữ (Google Translate HTTP client) kèm bộ đệm dịch thuật và chống đóng event loop | `TranslationService`, `translate_text()`, `close()` | `MessengerVideoCallModal.jsx`, video call websocket | [Luồng Video Call](guides/video_call_flow.md) | `[Đã đối chiếu code]` |
| `backend/app/services/ai/constants.py` | Single Source of Truth (SSOT) cho toàn bộ từ khóa phân loại kịch bản dịch vụ (`SERVICE_KEYWORDS`), Regex FSM và cấu hình AI | `SERVICE_KEYWORDS`, `FALLBACK_CATALOG_DATA` | `scenario_service.py`, `concierge_graph.py`, `ai_ticket_service.py` | [Kiến trúc](02-Architecture.md) | `[Đã đối chiếu code]`, `[Đã kiểm tra bằng test]` |
| `backend/app/services/ai/ollama_service.py` | Quản lý kết nối và gọi local LLM Ollama (`qwen2.5:3b`, `llama3.2:3b`) qua HTTP REST | `OllamaService`, `generate()`, `chat()` | `concierge_graph.py`, `ai_chat_service.py` | [Tối ưu AI](guides/ai_optimization.md) | `[Đã đối chiếu code]` |
| `backend/app/services/ai/session_manager.py` | Quản lý phiên hội thoại của khách, lưu lịch sử, nhận diện số phòng và mã PIN bảo mật | `session_manager`, `extract_room_number()`, `is_valid_hotel_room()` | `concierge_graph.py`, `ai_chat_service.py` | [Vòng đời Hội thoại](guides/robot_feedback_architecture.md) | `[Đã đối chiếu code]` |
| `backend/app/services/ai/scenario_service.py` | Quản lý kịch bản Fast-Path và khớp từ khóa bằng Regex / bộ nhớ đệm | `scenario_service`, `initialize_cache()`, `match_fast_path()` | `concierge_graph.py`, lifespan startup | [LangGraph Harness](guides/langgraph_harness.md) | `[Đã đối chiếu code]` |
| `backend/app/services/ai/feedback_service.py` | Tiếp nhận đánh giá 1-5 sao của khách sau phiên phục vụ, cảnh báo khi đánh giá $\le 3$ sao | `FeedbackService`, `submit_feedback()` | `api/v1/endpoints/ai.py` (`/feedback`) | [Vòng đời Hội thoại](guides/robot_feedback_architecture.md) | `[Đã đối chiếu code]` |

---

## 3. Backend Realtime WebSockets & Media Services

| Đường dẫn | Trách nhiệm | Thành phần chính | Nơi sử dụng | Note liên quan | Mức xác minh |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `backend/app/services/video_call_manager.py` | Signaling Hub cho WebRTC Video Call hai chiều giữa Robot Kiosk và Nhân viên Concierge; chuẩn hóa alias định danh phòng gọi | `VideoCallManager`, `connect()`, `disconnect()`, `forward_signaling_message()`, `register_alias()` | `api/v1/endpoints/operations/concierge.py` | [Luồng Video Call](guides/video_call_flow.md) | `[Đã đối chiếu code]` |
| `backend/app/services/notification_manager.py` | Quản lý kết nối WebSocket thông báo nghiệp vụ thời gian thực cho từng phòng ban | `NotificationManager`, `connect()`, `disconnect()`, `broadcast_to_department()` | `api/v1/endpoints/operations/notifications.py` | [Kiến trúc](02-Architecture.md) | `[Đã đối chiếu code]` |
| `backend/app/services/cloudinary_service.py` | Tải video ghi hình cuộc gọi và file media quảng cáo lên Cloudinary, có fallback lưu local | `CloudinaryService`, `upload_video_recording()`, `upload_ad_media()` | `concierge.py`, `advertisements.py` | [Kiến trúc](02-Architecture.md) | `[Đã đối chiếu code]` |
| `backend/app/services/cache/redis_service.py` | Bộ đệm Redis dùng cho cache dữ liệu API và rate-limiting | `RedisService`, `get()`, `set()`, `close()` | `main.py` lifespan, caching layers | [Kiến trúc](02-Architecture.md) | `[Đã đối chiếu code]` |
| `backend/app/services/rag/room_sync_service.py` | Đồng bộ danh sách phòng và tiện ích từ database vào cơ sở tri thức RAG | `sync_rooms_with_rag()` | `main.py` lifespan startup | [Kiến trúc](02-Architecture.md) | `[Đã đối chiếu code]` |

---

## 4. Backend Endpoints (API v1)

| Đường dẫn | Trách nhiệm | Thành phần chính | Nơi sử dụng | Note liên quan | Mức xác minh |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `backend/app/api/v1/endpoints/ai.py` | Endpoints xử lý hội thoại AI (`/chat`, `/chat/stream`), tổng hợp giọng nói (`/tts`), nhận diện âm thanh (`/stt/transcribe`) và gửi đánh giá (`/feedback`) | `chat()`, `chat_stream()`, `text_to_speech()`, `transcribe_stt()`, `submit_feedback()` | Kiosk Robot, Mobile Screen, Video Call Modal | [Luồng Video Call](guides/video_call_flow.md) | `[Đã đối chiếu code]` |
| `backend/app/api/v1/endpoints/operations/concierge.py` | Quản lý yêu cầu hỗ trợ nhân viên, điều phối phiên Live Support và **WebSocket Signaling WebRTC Video Call** | `create_concierge_live_request()`, `video_call_signaling_endpoint()` (`/concierge/ws/video-call/{session_id}`) | `ConciergeDashboard.jsx`, `MessengerVideoCallModal.jsx` | [Luồng Video Call](guides/video_call_flow.md) | `[Đã đối chiếu code]` |
| `backend/app/api/v1/endpoints/operations/notifications.py` | Endpoint REST và WebSocket phát thông báo tới các phòng ban | `get_notifications()`, `notification_ws_endpoint()` (`/ws/notifications/{department}`) | `AuroraHeader.jsx`, `NotificationCenterModal.jsx` | [Kiến trúc](02-Architecture.md) | `[Đã đối chiếu code]` |
| `backend/app/api/v1/endpoints/operations/reception.py` | Tiếp nhận và quản lý các yêu cầu của bộ phận Lễ tân (Check-in, Check-out, Hỗ trợ thủ tục) | `create_reception_request()`, `get_reception_requests()` | `ReceptionDashboard.jsx` | [Stepflow](workflows/stepflow.md) | `[Đã đối chiếu code]` |
| `backend/app/api/v1/endpoints/operations/housekeeping.py` | Quản lý phiếu dọn phòng, giặt ủi, cấp thêm đồ dùng buồng phòng | `create_housekeeping_request()`, `get_housekeeping_requests()` | `HousekeepingDashboard.jsx` | [Stepflow](workflows/stepflow.md) | `[Đã đối chiếu code]` |
| `backend/app/api/v1/endpoints/operations/room_service.py` | Tiếp nhận đơn đặt đồ ăn, vật phẩm về phòng; xác thực phòng qua số phòng và mã PIN | `create_room_service_order()`, `get_room_service_orders()` | `RoomServiceDashboard.jsx`, `RobotRoomServiceScreen.jsx` | [Stepflow](workflows/stepflow.md) | `[Đã đối chiếu code]` |
| `backend/app/api/v1/endpoints/operations/kitchen.py` | Quản lý menu món ăn nhà hàng và trạng thái chế biến của Bếp | `get_kitchen_orders()`, `update_order_status()`, menu CRUD | `KitchenDashboard.jsx`, `KitchenMenuManagementPage.jsx` | [Stepflow](workflows/stepflow.md) | `[Đã đối chiếu code]` |
| `backend/app/api/v1/endpoints/operations/taxi.py` | Tiếp nhận và điều phối yêu cầu gọi xe taxi từ Robot Kiosk hoặc Lễ tân | `book_taxi()`, `get_taxi_requests()`, `update_taxi_status()` | `TaxiDashboard.jsx`, `RobotTaxiModal.jsx` | [Stepflow](workflows/stepflow.md) | `[Đã đối chiếu code]` |
| `backend/app/api/v1/endpoints/operations/bell_services.py` | Quản lý hỗ trợ hành lý, gửi đồ tiền sảnh | `create_bell_request()`, `get_bell_requests()` | `BellServicesDashboard.jsx` | [Stepflow](workflows/stepflow.md) | `[Đã đối chiếu code]` |
| `backend/app/api/v1/endpoints/operations/maintenance.py` | Quản lý sửa chữa cơ sở vật chất, sự cố kỹ thuật phòng; CRUD danh mục sự cố kỹ thuật (`/maintenance/catalog`) và tra cứu tiến độ bảo mật bằng Room PIN | `create_maintenance_request()`, `get_maintenance_requests()`, `get_maintenance_catalog()`, `create_maintenance_catalog_item()` | `MaintenanceDashboard.jsx`, `RobotMaintenanceMenuScreen.jsx` | [Stepflow](workflows/stepflow.md) | `[Đã đối chiếu code]`, `[Đã kiểm tra bằng test]` |
| `backend/app/api/v1/endpoints/operations/robot_control.py` | Quản lý lệnh điều khiển robot, trạng thái pin, vị trí và chế độ hoạt động | `get_robot_status()`, `send_robot_command()` | `RobotManualControls.jsx`, `AdminPortalPage.jsx` | [Kiến trúc](02-Architecture.md) | `[Đã đối chiếu code]` |
| `backend/app/api/v1/endpoints/workflows.py` | Quản lý kịch bản Stepflow (CRUD) và chạy thử nghiệm Simulator | `get_all_workflows()`, `create_or_save_workflow()`, `execute_workflow()` | `AdminPortalPage.jsx` (Scenarios Tab) | [Stepflow](workflows/stepflow.md) | `[Đã đối chiếu code]` |
| `backend/app/api/v1/endpoints/map.py` | Quản lý bản đồ LiDAR 2D, danh sách Waypoints / POIs định vị (Lobby, Reception, Elevator, Restroom, Sofa,...) | `get_map_data()`, `save_map()`, `get_waypoints()`, `save_waypoint()` | `FloorMap.jsx`, `LidarCanvas.jsx` | [Điều hướng Bản đồ](guides/static-map-navigation.md) | `[Đã đối chiếu code]` |
| `backend/app/api/v1/endpoints/advertisements.py` | Quản lý danh sách banner và video quảng cáo phát trên màn hình Robot Kiosk | `get_advertisements()`, `create_advertisement()`, `update_ad_status()` | `RobotAdPlayer.jsx`, `AdminPortalPage.jsx` | [Kiến trúc](02-Architecture.md) | `[Đã đối chiếu code]` |
| `backend/app/api/v1/endpoints/auth.py` | Xác thực đăng nhập nhân viên/admin, cấp JWT Access Token và Refresh Token | `login_for_access_token()`, `refresh_token()`, `get_current_user()` | `LoginPage.jsx`, `authApi.js` | [Kiến trúc](02-Architecture.md) | `[Đã đối chiếu code]` |
| `backend/app/api/v1/endpoints/logs.py` | Truy vấn audit log và nhật ký hệ thống | `get_audit_logs()`, `get_system_logs()` | `AdminPortalPage.jsx` (Logs Tab) | [Kiến trúc](02-Architecture.md) | `[Đã đối chiếu code]` |
| `backend/app/api/v1/endpoints/rag.py` | Upload, nạp và tìm kiếm tri thức khách sạn (RAG Knowledge Base) | `upload_knowledge()`, `query_rag()` | `KnowledgeTableEditor.jsx` | [Kiến trúc](02-Architecture.md) | `[Đã đối chiếu code]` |

---

## 5. Frontend Robot Kiosk & Voice Interaction

| Đường dẫn | Trách nhiệm | Thành phần chính | Nơi sử dụng | Note liên quan | Mức xác minh |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `frontend/src/pages/robot/RobotScreenPage.jsx` | Trang Kiosk chính của Robot trên màn hình cảm ứng: VAD 1800ms, điều hướng trạng thái (Sleep $\rightarrow$ Awake $\rightarrow$ Listening $\rightarrow$ Thinking $\rightarrow$ Speaking), phát Audio Base64 trực tiếp, mở modal dịch vụ và cử chỉ thoát bảo mật Secret Multi-Tap | `RobotScreenPage`, `handleStartTalk()`, `handleGuestApproached()`, `speak()`, `silenceTimeoutMs: 1800` | Đường dẫn `/robot` trên Kiosk Desktop | [Thoát Kiosk](guides/kiosk_security_exit.md) | `[Đã đối chiếu code]`, `[Đã kiểm tra bằng test]` |
| `frontend/src/components/robot/MobileRobotScreen.jsx` | Giao diện Robot responsive tối ưu cho điện thoại di động: Dock micro, giải mã Web Audio khi có chạm (User Gesture), chạm ngắt lời (Barge-In) | `MobileRobotScreen`, `handleTouchToSpeak()`, `handleBargeIn()` | `RobotScreenPage.jsx` (khi `isMobileViewport === true`) | [Tối ưu AI](guides/ai_optimization.md) | `[Đã đối chiếu code]` |
| `frontend/src/components/robot/RobotFace.jsx` | Hiển thị khuôn mặt biểu cảm động của Robot (sleeping, smiling, thinking, listening, speaking) bằng CSS animations | `RobotFace` | `RobotScreenPage.jsx`, `MobileRobotScreen.jsx` | [Tối ưu AI](guides/ai_optimization.md) | `[Đã đối chiếu code]` |
| `frontend/src/components/robot/FloorMap.jsx` | Hiển thị sơ đồ mặt bằng sảnh 2D trực quan, đánh dấu vị trí Robot và các điểm đến (Waypoints/POIs) kèm chỉ đường | `FloorMap`, `renderWaypoints()` | `RobotScreenPage.jsx` | [Điều hướng Bản đồ](guides/static-map-navigation.md) | `[Đã đối chiếu code]` |
| `frontend/src/hooks/useSpeechRecognition.js` | Quản lý nhận diện giọng nói qua Web Speech API: phát hiện khoảng lặng VAD **1800ms** (`SPEECH_FINAL_SILENCE_MS = 1800`), chống ngắt sớm, tự động khôi phục khi bị hủy | `useSpeechRecognition`, `startListening()`, `stopListening()`, `interimTranscript` | `RobotScreenPage.jsx` | [LangGraph Harness](guides/langgraph_harness.md) | `[Đã đối chiếu code]`, `[Đã kiểm tra bằng test]` |
| `frontend/src/hooks/useSpeechSynthesis.js` | Quản lý phát âm thanh: ưu tiên phát file audio base64 nạp sẵn từ `/chat`, fallback gọi `/api/v1/ai/tts`, và fallback cuối cùng qua Web Speech API | `useSpeechSynthesis`, `speak()`, `cancelSpeech()`, `isPlaying` | `RobotScreenPage.jsx` | [Tối ưu AI](guides/ai_optimization.md) | `[Đã đối chiếu code]` |
| `frontend/src/utils/audioFeedback.js` | Bộ phát âm thanh phản hồi tổng hợp thời gian thực qua Web Audio API (earcons: beep, listen_start, listen_end, success, error) không phụ thuộc file MP3 ngoài | `playEarcon()`, `playAudioBlob()` | `RobotScreenPage.jsx`, `MobileRobotScreen.jsx` | [Tối ưu AI](guides/ai_optimization.md) | `[Đã đối chiếu code]`, `[Đã kiểm tra bằng test]` |
| `frontend/src/components/robot/RoomPickerModal.jsx` | Modal chọn số phòng và xác thực mã PIN phòng (thay thế hoàn toàn cho quét thẻ NFC cũ) | `RoomPickerModal` | `RobotScreenPage.jsx`, `RobotRoomServiceScreen.jsx` | [Stepflow](workflows/stepflow.md) | `[Đã đối chiếu code]` |
| `frontend/src/components/robot/RobotTaxiModal.jsx` | Modal đặt xe taxi cho khách trực tiếp trên màn hình Robot (chọn loại xe, điểm đến, thời gian đón) | `RobotTaxiModal` | `RobotScreenPage.jsx` | [Stepflow](workflows/stepflow.md) | `[Đã đối chiếu code]` |
| `frontend/src/components/robot/RobotFoodMenuScreen.jsx` | Màn hình xem thực đơn món ăn nhà hàng và gửi đơn hàng về Bếp | `RobotFoodMenuScreen` | `RobotScreenPage.jsx` | [Stepflow](workflows/stepflow.md) | `[Đã đối chiếu code]` |
| `frontend/src/components/robot/RobotMaintenanceMenuScreen.jsx` | Màn hình tiếp nhận sự cố kỹ thuật và báo hỏng trên Robot Kiosk/Mobile: thiết kế Touch-First không cần bàn phím, chọn phòng qua `RoomPickerModal`, xác thực mã PIN và lưu session tự động | `RobotMaintenanceMenuScreen`, `FALLBACK_MAINTENANCE_CATALOG`, `MAINTENANCE_CATEGORIES` | `RobotScreenPage.jsx`, `MobileRobotScreen.jsx` | [Stepflow](workflows/stepflow.md) | `[Đã đối chiếu code]`, `[Đã kiểm tra bằng test]` |
| `frontend/src/components/robot/RobotAdPlayer.jsx` | Trình phát video/ảnh quảng cáo tự động khi Robot ở trạng thái chờ rảnh rỗi (idle) | `RobotAdPlayer` | `RobotScreenPage.jsx` | [Kiến trúc](02-Architecture.md) | `[Đã đối chiếu code]` |
| `frontend/src/components/robot/RobotQuickFeedbackModal.jsx` | Modal đánh giá 5 sao tức thì (3 giây) khi kết thúc phiên phục vụ | `RobotQuickFeedbackModal` | `RobotScreenPage.jsx` | [Vòng đời Hội thoại](guides/robot_feedback_architecture.md) | `[Đã đối chiếu code]` |

---

## 6. Frontend WebRTC Video Call & Real-time Translation

| Đường dẫn | Trách nhiệm | Thành phần chính | Nơi sử dụng | Note liên quan | Mức xác minh |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `frontend/src/components/video/MessengerVideoCallModal.jsx` | Modal gọi video call hai chiều WebRTC chuẩn Messenger: điều khiển Camera/Mic, chuyển tiếp SDP/ICE qua WebSocket, Call Audio Stream STT Adapter (16kHz PCM WAV), phát phụ đề song ngữ và phát giọng đọc EdgeTTS hai chiều | `MessengerVideoCallModal`, `initWebRTC()`, `sendSignaling()`, `processAudioQueue()`, `setupAudioStreamSTTAdapter()`, `advanceExpectedSeqOnFailure()` | `RobotScreenPage.jsx` (Guest), `ConciergeDashboard.jsx` (Staff) | [Luồng Video Call](guides/video_call_flow.md) | `[Đã đối chiếu code]`, `[Đã kiểm tra bằng test]` |
| `frontend/src/components/video/videoCallTranslationHelpers.js` | Hàm tiện ích chuẩn hóa mã ngôn ngữ, đánh giá nhu cầu dịch thuật (`evaluateTranslationNeed`), và kiểm tra chống commit trùng phụ đề | `normalizeLangCode()`, `evaluateTranslationNeed()`, `evaluateSpokenTextCommit()` | `MessengerVideoCallModal.jsx` | [Luồng Video Call](guides/video_call_flow.md) | `[Đã đối chiếu code]` |
| `frontend/src/components/video/IncomingCallModal.jsx` | Modal đổ chuông báo cuộc gọi video call đến kèm nút trả lời tức thì | `IncomingCallModal`, `handleAccept()`, `handleReject()` | `ConciergeDashboard.jsx` | [Luồng Video Call](guides/video_call_flow.md) | `[Đã đối chiếu code]` |

---

## 7. Frontend Operations Portal & Staff Dashboards

| Đường dẫn | Trách nhiệm | Thành phần chính | Nơi sử dụng | Note liên quan | Mức xác minh |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `frontend/src/pages/admin/AdminPortalPage.jsx` | Trung tâm quản trị toàn diện: Tab Tổng quan, Tab Bản đồ/LiDAR Foxglove, Tab Tri thức RAG, Tab Stepflow Builder, Tab Quảng cáo, Tab Cấu hình phần cứng | `AdminPortalPage`, tab routing | Đường dẫn `/admin` | [Kiến trúc](02-Architecture.md), [Stepflow](workflows/stepflow.md) | `[Đã đối chiếu code]` |
| `frontend/src/pages/dashboard/ConciergeDashboard.jsx` | Bàn làm việc tổng đài viên Concierge: Tiếp nhận cuộc gọi video call khẩn cấp, tiếp nhận tin nhắn hỗ trợ, phân phối công việc cho các bộ phận | `ConciergeDashboard`, WebSocket notifications listener | Đường dẫn `/dashboard/concierge` | [Luồng Video Call](guides/video_call_flow.md) | `[Đã đối chiếu code]` |
| `frontend/src/pages/dashboard/ReceptionDashboard.jsx` | Dashboard bộ phận Lễ tân: Danh sách khách check-in/out, yêu cầu đón tiếp, xử lý số phòng | `ReceptionDashboard` | Đường dẫn `/dashboard/reception` | [Stepflow](workflows/stepflow.md) | `[Đã đối chiếu code]` |
| `frontend/src/pages/dashboard/HousekeepingDashboard.jsx` | Dashboard bộ phận Buồng phòng: Danh sách yêu cầu dọn phòng, giặt ủi, cấp khăn | `HousekeepingDashboard` | Đường dẫn `/dashboard/housekeeping` | [Stepflow](workflows/stepflow.md) | `[Đã đối chiếu code]` |
| `frontend/src/pages/dashboard/KitchenDashboard.jsx` | Dashboard bộ phận Bếp: Bảng KDS (Kitchen Display System) hiển thị các order món cần chế biến | `KitchenDashboard` | Đường dẫn `/dashboard/kitchen` | [Stepflow](workflows/stepflow.md) | `[Đã đối chiếu code]` |
| `frontend/src/pages/dashboard/RoomServiceDashboard.jsx` | Dashboard bộ phận Phục vụ phòng: Theo dõi tiến độ giao món/vật phẩm tới số phòng | `RoomServiceDashboard` | Đường dẫn `/dashboard/room-service` | [Stepflow](workflows/stepflow.md) | `[Đã đối chiếu code]` |
| `frontend/src/pages/dashboard/TaxiDashboard.jsx` | Dashboard bộ phận Vận chuyển: Quản lý danh sách đặt xe taxi, điều phối hãng xe | `TaxiDashboard` | Đường dẫn `/dashboard/taxi` | [Stepflow](workflows/stepflow.md) | `[Đã đối chiếu code]` |
| `frontend/src/pages/dashboard/BellServicesDashboard.jsx` | Dashboard bộ phận Hành lý: Tiếp nhận yêu cầu chuyển hành lý lên phòng hoặc gửi sảnh | `BellServicesDashboard` | Đường dẫn `/dashboard/bell-services` | [Stepflow](workflows/stepflow.md) | `[Đã đối chiếu code]` |
| `frontend/src/pages/dashboard/MaintenanceDashboard.jsx` | Dashboard bộ phận Kỹ thuật: Tiếp nhận và xử lý sự cố thiết bị phòng hoặc khu vực chung | `MaintenanceDashboard` | Đường dẫn `/dashboard/maintenance` | [Stepflow](workflows/stepflow.md) | `[Đã đối chiếu code]` |
| `frontend/src/components/dashboard/MaintenanceCatalogModal.jsx` | Modal quản lý danh mục sự cố kỹ thuật dành cho Admin và Trưởng bộ phận: Thêm/Sửa/Xóa hạng mục, mức ưu tiên và thời gian xử lý dự kiến | `MaintenanceCatalogModal` | `MaintenanceDashboard.jsx` | [Stepflow](workflows/stepflow.md) | `[Đã đối chiếu code]` |
| `frontend/src/pages/staff/RequestsPage.jsx` | Trang tổng hợp toàn bộ các yêu cầu dịch vụ của khách sạn với bộ lọc trạng thái và phòng ban | `RequestsPage` | Đường dẫn `/staff/requests` | [Kiến trúc](02-Architecture.md) | `[Đã đối chiếu code]` |

---

## 8. Frontend Utility Helpers

| Đường dẫn | Trách nhiệm | Thành phần chính | Nơi sử dụng | Note liên quan | Mức xác minh |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `frontend/src/utils/numberInputHelper.js` | Chuẩn hóa dữ liệu số (giá tiền, số điện thoại, số lượng) và chặn nhập ký tự lạ | `formatNumber()`, `sanitizeNumericInput()` | Form đặt xe, form thanh toán | [Stepflow](workflows/stepflow.md) | `[Đã đối chiếu code]`, `[Đã kiểm tra bằng test]` |
| `frontend/src/utils/roomHelper.js` | Kiểm tra tính hợp lệ của số phòng khách sạn dựa trên danh sách tầng và phòng hoạt động | `isValidRoom()`, `getRoomFloor()` | `RoomPickerModal.jsx`, `RobotScreenPage.jsx` | [Stepflow](workflows/stepflow.md) | `[Đã đối chiếu code]`, `[Đã kiểm tra bằng test]` |
| `frontend/src/utils/markdownTableHelper.js` | Phân tích cú pháp và dựng bảng Markdown chuẩn hiển thị trong Modal tri thức hoặc tin nhắn | `parseMarkdownTable()`, `renderMarkdownTable()` | `KnowledgeTableEditor.jsx` | [Kiến trúc](02-Architecture.md) | `[Đã đối chiếu code]`, `[Đã kiểm tra bằng test]` |
| `frontend/src/utils/slamTeleop.js` | Điều khiển di chuyển robot thủ công từ giao diện web qua ROSBridge WebSocket | `sendTwistCommand()` | `RobotManualControls.jsx` | [Lệnh Di Chuyển](guides/robot_movement_commands.md), [Distributed ROS 2](guides/distributed_ros2.md) | `[Đã đối chiếu code]` |

---

## 9. Hardware & ROS 2 Edge Systems (Đã đối chiếu & xác minh phần cứng)

| Đường dẫn | Trách nhiệm | Thành phần chính | Nơi sử dụng | Note liên quan | Mức xác minh |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `robot/esp32/main.py` | Firmware MicroPython trung tâm trên ESP32: đọc 4 Quadrature Encoders, 4 cảm biến siêu âm HC-SR04, IMU MPU-9250 qua I2C và xuất JSON Lines Serial 115200 baud | `main()`, `EncoderManager`, `create_sensors()`, `detect_mpu()`, safety watchdog | Nạp trên bo mạch ESP32 DevKitC | [Kiến Trúc Phần Cứng](guides/hardware_architecture.md), [Cảm biến Siêu âm](guides/ultrasonic_setup.md) | `[Đã đối chiếu code & sơ đồ phần cứng]` |
| `robot/src/hc_robot_client/hc_robot_client/nodes/odom_encoder_node.py` | ROS 2 Node tính toán Odometry vi sai từ số xung Encoder ESP32, phát topic `/odom` và broadcast TF `odom` $\rightarrow$ `base_footprint` | `OdomEncoderNode`, `euler_to_quaternion()`, `wheel_radius: 0.033`, `wheel_base: 0.22`, `cpr: 330.0` | Chạy trên Raspberry Pi 5 | [Kiến Trúc Phần Cứng](guides/hardware_architecture.md) | `[Đã đối chiếu code & sơ đồ phần cứng]` |
| `robot/src/hc_robot_client/hc_robot_client/nodes/safety_controller_node.py` | Tầng trọng tài an toàn cục bộ (Zero Latency) trên Pi 5: quét hành lang va chạm phía trước từ `/scan` (LiDAR), tự động phanh khẩn cấp $\le 0.50$m hoặc giảm tốc $\le 0.80$m | `SafetyControllerNode`, `check_lidar_corridor_clearance()`, xuất `/cmd_vel` và `/robot/safety_state` | Chạy trên Raspberry Pi 5 | [Kiến Trúc Phần Cứng](guides/hardware_architecture.md) | `[Đã đối chiếu code & sơ đồ phần cứng]` |
| `robot/src/hc_robot_client/hc_robot_client/nodes/motor_driver_node.py` | Nhận lệnh vận tốc an toàn từ `/cmd_vel`, điều khiển các chân GPIO BCM 17, 27, 22, 23 trên Pi 5 tới mạch công suất L298N | `MotorDriverNode`, `MotorController` | Chạy trên Raspberry Pi 5 | [Kiến Trúc Phần Cứng](guides/hardware_architecture.md) | `[Đã đối chiếu code & sơ đồ phần cứng]` |
| `robot/src/hc_robot_client/hc_robot_client/nodes/person_detection_node.py` | Nhận thức thị giác thuần túy: đọc frame camera (Picamera2/V4L2), phát hiện người bằng YOLOv8n, tính góc nhìn FOV và xuất `/robot/person_detections` | `PersonDetectionNode`, `VisionMode`, `compute_bearing_and_fov()` | Chạy trên Raspberry Pi 5 | [Kiến Trúc Phần Cứng](guides/hardware_architecture.md) | `[Đã đối chiếu code & sơ đồ phần cứng]` |
| `robot/src/hc_robot_client/hc_robot_client/nodes/person_fusion_tracker.py` | Dung hợp dữ liệu BBox camera với chùm tia LiDAR `/scan`, duy trì máy trạng thái cự ly khách và phát sự kiện `GUEST_APPROACH` | `PersonFusionTrackerNode`, `DistanceState` (FAR, APPROACHING, NEAR, TOO_CLOSE) | Chạy trên Raspberry Pi 5 | [Kiến Trúc Phần Cứng](guides/hardware_architecture.md) | `[Đã đối chiếu code & sơ đồ phần cứng]` |
| `robot/src/hc_robot_client/hc_robot_client/nodes/telemetry_node.py` | Phát định kỳ Heartbeat (mỗi 10s) và trạng thái robot từ Pi 5 về Backend Server qua REST | `TelemetryNode`, `send_heartbeat()` | Chạy trên Raspberry Pi 5 | [Kiến Trúc Phần Cứng](guides/hardware_architecture.md) | `[Đã đối chiếu code & sơ đồ phần cứng]` |
| `robot/src/hc_robot_client/hc_robot_client/nodes/ai_bridge_node.py` | Cầu nối ROS 2 trung gian nhận chuỗi nhận diện `/speech/text` và gửi phản hồi `/robot/speech_reply` | `AIBridgeNode`, `on_speech_received()` | Chạy trên Raspberry Pi 5 | [Kiến Trúc Phần Cứng](guides/hardware_architecture.md) | `[Đã đối chiếu code & sơ đồ phần cứng]` |
| `robot/ros2_configs/cyclonedds_pi.xml` & `cyclonedds_laptop.xml` | Cấu hình mạng phân tán CycloneDDS unicast kết nối giữa Laptop NUC và Raspberry Pi 5 qua VPN Tailscale (tắt Multicast) | Unicast peer discovery (`100.99.72.51`, `100.92.82.61`) | Chạy trên Laptop & Raspberry Pi 5 | [Distributed ROS 2](guides/distributed_ros2.md) | `[Đã đối chiếu code & sơ đồ phần cứng]` |
| `robot/description/robot_core.xacro` & `robot.urdf` | Mô hình hình học vật lý của robot (URDF/Xacro): chassis, wheels, caster, lidar, camera joints | URDF model, mesh & collision properties | Rviz2, Gazebo, Nav2 | [Kiến Trúc Phần Cứng](guides/hardware_architecture.md) | `[Đã đối chiếu code & sơ đồ phần cứng]` |
| `robot/scripts/autonomous_navigator.py` | Điều hướng tự hành tích hợp các vùng chức năng tiền sảnh (Keep-out zone quầy lễ tân, Speed zone 0.2m/s) | `AutonomousNavigator`, PID waypoint navigation, reactive avoidance | Chạy trên Laptop / Pi 5 | [Kiến Trúc Phần Cứng](guides/hardware_architecture.md) | `[Đã đối chiếu code & sơ đồ phần cứng]` |
| `frontend/worker.js` & `worker.js` | Cloudflare Workers Edge Gateway: phục vụ Vite static assets, proxy `/api/*`, `/static/*` và chuyển tiếp WebSocket sang Tailscale Funnel | `export default { fetch }` | Cloudflare Workers Edge | [Kiến Trúc Hybrid](guides/tailscale_hybrid_deployment_pi5_guide.md) | `[Đã đối chiếu code]` |
| `robot/scripts/camera_stream.py` | WebRTC P2P (aiortc) & MJPEG fallback Streamer: capture trực tiếp V4L2 USB camera/Picamera2, phát SDP Answer Vanilla ICE | `RobotVideoTrack`, `CameraBroadcaster`, `handle_offer` | Chạy trên Pi 5 (`:8554`) | [Kiến Trúc Hybrid](guides/tailscale_hybrid_deployment_pi5_guide.md) | `[Đã đối chiếu code]` |

---

## 10. Danh Mục Thư Mục Loại Trừ Khỏi Kiểm Kê Chi Tiết
Các nhóm thư mục sau không được kiểm kê từng file riêng lẻ theo quy chuẩn tài liệu:
1. `node_modules/`, `dist/`, `.vite/` (Frontend build & dependencies).
2. `venv/`, `__pycache__/`, `.pytest_cache/` (Python virtual environment & compilation artifacts).
3. `backend/static/audio_cache/` (Thư mục cache file âm thanh tự sinh, truy xuất bằng MD5 hash).
4. `docs/hardware-evidence/` (Hình ảnh đấu dây và thiết kế cơ khí).
5. `.git/`, `.agents/` (Git metadata và Agent runtime skills).
