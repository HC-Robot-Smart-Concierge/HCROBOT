# HC-Robot Review 2 — Architectural & Code Validation Review for UML Activity Diagrams

- **Project Code:** `FA26SE905`
- **Project Name:** Intelligent Hotel Concierge Robot (`HC-Robot`)
- **Team:** `GFA26SE136`
- **Repository:** `HC-Robot-Smart-Concierge/HCROBOT`
- **Baseline Git Tag:** `review-2` (`f3f1b68a63c7785ef07c8c10f4403126b9b201c1`)
- **Reference Specification:** BM01 – Design Brief, Review 2, Version 2.0 (Dated `09/11/2026`)

---

## 1. Executive Summary

This report documents the architectural analysis and source code verification performed at Git tag `review-2` to produce the five official UML Activity Diagrams in `docs/review-2/activity/`:

1. [`WF-01_Admin_Configuration.puml`](./WF-01_Admin_Configuration.puml) — Feature `F-01` (`DS-01`, `DS-02`)
2. [`WF-02_Guest_Information_Recommendation.puml`](./WF-02_Guest_Information_Recommendation.puml) — Feature `F-02` (`DS-03`, `DS-04`)
3. [`WF-03_Guest_Service_Request_Handling.puml`](./WF-03_Guest_Service_Request_Handling.puml) — Feature `F-03` (`DS-05`, `DS-06`)
4. [`WF-04_Robot_Human_Handoff.puml`](./WF-04_Robot_Human_Handoff.puml) — Feature `F-04` (`DS-07`, `DS-08`)
5. [`WF-05_Robot_Monitoring_Incident_Handling.puml`](./WF-05_Robot_Monitoring_Incident_Handling.puml) — Features `F-05`, `F-06` (`DS-09`, `DS-10`)

In accordance with Review 2 governance, each diagram models the **authoritative BM01 business workflow**, while this review explicitly records all **verified implementation evidence**, **cross-document conflicts (`BM01` vs. `SRS` vs. `SDD`)**, and **design-to-implementation gaps** found in the repository at `review-2`.

---

## 2. Per-Workflow Source Code Validation & Gap Analysis

### 2.1 WF-01: Admin Configuration (`F-01` | `DS-01`, `DS-02`)

#### Verified Implementation Evidence
- **Authentication (`AdminSession = AUTHENTICATED`):**
  - `POST /api/v1/auth/login` (`backend/app/api/v1/endpoints/auth.py:30-79`) verifies email/password via `verify_password`, checks `account.is_active`, issues a signed JWT (`create_access_token`), and writes an `AuditLog` entry with `action="LOGIN"`.
- **Configuration & Knowledge Base Management (`DS-01`):**
  - **Knowledge Files (`.md`):** `GET/PUT/POST/DELETE /api/v1/rag/files` and `POST /api/v1/rag/upload-file` (`backend/app/api/v1/endpoints/rag.py:86-222`) manage Markdown documents inside `OBSIDIAN_VAULT_DIR` (`./knowledge_vault`).
  - **Synchronization to Robot (`KnowledgeBase.status: DRAFT -> PUBLISHED`, `Robot configuration = SYNCED`):** `POST /api/v1/rag/reindex` (`backend/app/api/v1/endpoints/rag.py:224-258`) runs `obsidian_service.sync_vault_to_chroma()`, which parses YAML frontmatter, splits H1/H2/H3 sections (`chunk_markdown` in `obsidian_service.py:52`), and upserts embeddings into ChromaDB collection `concierge_kb`.
  - **FAQs / Dialogue Scenarios:** `backend/app/api/v1/endpoints/scenarios.py` persists `DialogueScenario` records (`dialogue_scenarios` table) and calls `scenario_service.initialize_cache()` so the robot's Tier-1 in-memory Fast-Path cache updates immediately.
  - **Promotions / Advertisements & Robot Voice/Expression Settings:** `backend/app/api/v1/endpoints/advertisements.py` manages `Advertisement` records (`is_active` toggle) and `POST /api/v1/ai/voice-settings` (`backend/app/api/v1/endpoints/ai.py:648`) updates robot voice/expression parameters.
- **Exception Handling (`DS-02` — Unsupported or Corrupted Document):**
  - `POST /api/v1/rag/upload-file` (`backend/app/api/v1/endpoints/rag.py:164-175`) strictly validates `ext = os.path.splitext(file.filename)[1].lower()` against `.md`. Non-Markdown files (e.g., `.exe`, `.pdf`, `.docx`) or invalid UTF-8 payloads raise `HTTPException(status_code=400)` **before** touching the Obsidian Vault or ChromaDB, leaving the existing published knowledge base intact.
- **Automated Tests Found:**
  - `backend/tests/test_auth_api.py`, `backend/tests/test_rag_api.py`, `backend/tests/test_scenarios_api.py`, `backend/tests/test_advertisements_api.py`, `frontend/src/utils/__tests__/markdownTableHelper.test.js`.

#### Identified Discrepancies / Notes
- **Conceptual vs. Physical `KnowledgeBase.status` (`DRAFT -> PUBLISHED`):**
  - Unlike `DialogueScenario` and `Advertisement` (which are stored in PostgreSQL tables), Markdown knowledge files are stored on the filesystem (`./knowledge_vault`) and indexed in ChromaDB (`./chroma_db`). There is no SQL table named `KnowledgeBase` with a literal `status` column; instead, saving/editing a `.md` file in the vault represents the staged (`DRAFT`) state, and executing `/api/v1/rag/reindex` promotes the chunks into the active ChromaDB vector collection (`PUBLISHED`).

---

### 2.2 WF-02: Guest Information & Recommendation (`F-02` | `DS-03`, `DS-04`)

#### Verified Implementation Evidence
- **Guest Detection, Greeting & Language Selection (`DS-03`):**
  - `frontend/src/pages/robot/RobotScreenPage.jsx` transitions the robot kiosk from standby (`IDLE` / `RT-01 Sleeping`) to active interaction (`INTERACTING` / `RT-02..RT-05`) upon camera person detection (`person_detection_node.py` / `personDetector.js`) or touchscreen tap.
  - Supports bilingual switching (`vi-VN` and `en-US`) via language selector and automatic language detection (`detect_language` in `gemini_service.py` / `ollama_service.py`).
- **Multi-Turn Hybrid AI & Wayfinding Response:**
  - `POST /api/v1/ai/chat` and `/api/v1/ai/ws/pipecat` (`backend/app/api/v1/endpoints/ai.py`) execute the 3-tier pipeline in `ai_chat_service.py` and `concierge_graph.py`:
    1. Tier-1 RAM Fast-Path (`scenario_service.py`) for instant $<50\text{ ms}$ responses.
    2. Tier-2 Cloud LLM (`Groq` / `Gemini`) + ChromaDB RAG context.
    3. Tier-3 Local `Ollama` fallback + deterministic hotel factsheet harness.
  - Wayfinding queries render `FloorMap.jsx` with 2-segment elevator routing and a mobile QR link (`/map.html`).
- **Feedback Recording:**
  - `POST /api/v1/ai/feedback` (`backend/app/api/v1/endpoints/ai.py:678-700`) persists `Feedback(session_id, rating, comment)` into the `feedbacks` table (`backend/app/models/feedback.py`).
- **Automated Tests Found:**
  - `backend/tests/test_ai_chat_api.py`, `backend/tests/test_feedback_api.py`, `backend/tests/test_fast_path_identity.py`, `backend/tests/test_poi_detection.py`, `frontend/src/components/robot/__tests__/SpeechSilenceDuration.test.jsx`, `frontend/src/components/robot/__tests__/ConversationLanguageSwitch.test.jsx`.

#### Identified Discrepancies & Design-to-Implementation Gaps
1. **Inactivity Timeout Duration Conflict (`15s` vs. `30s` vs. `45s`):**
   - **BM01 Appendix A2 (`DS-04`):** Specifies a **15-second** inactivity timeout when a guest walks away mid-conversation.
   - **Frontend Implementation (`RobotScreenPage.jsx:257`):** Defines `CONVERSATION_IDLE_TIMEOUT_MS = 30000` (**30 seconds**) for returning to the idle screensaver (`resetConversationState`), and `followUpTimerRef` (`RobotScreenPage.jsx:2303`) uses **8 seconds** (`8000 ms`) after TTS playback finishes before opening the quick feedback modal.
   - **SRS Section 3.3.1 (`BR-GI-04`) & Section 3.6.9 (`BR-SS-02`):** Specify **45 seconds** for kiosk inactivity reset and **90 seconds** (`session_manager.py:21` `SESSION_TIMEOUT_SECONDS = 300`) for backend session expiration.
2. **Feedback Modal Auto-Submit Behavior on Walk-Away (`DS-04`):**
   - **BM01 Requirement:** Do not force a feedback rating to exist when the guest leaves without submitting one.
   - **Current Code (`frontend/src/components/robot/RobotQuickFeedbackModal.jsx:62-75`):** When the 8-second countdown reaches `0`, the timer callback executes `onSubmit?.(rating)` with the default `rating = 5` (`useState(5)`) instead of dismissing without saving, whereas clicking the `X` close button (`onClose`) skips submission. To strictly satisfy `DS-04`, timeout expiration on `RobotQuickFeedbackModal` should call `onClose()` rather than `onSubmit(rating)`.

---

### 2.3 WF-03: Guest Service Request Handling (`F-03` | `DS-05`, `DS-06`)

#### Verified Implementation Evidence
- **Service Request Creation & Classification (`DS-05`):**
  - Guests can submit Room Service orders (`POST /api/v1/operations/room-service/orders` via `RobotRoomServiceScreen.jsx` + `RoomPinModal.jsx`), Taxi bookings (`POST /api/v1/operations/taxi/bookings` via `RobotTaxiModal.jsx`), Housekeeping requests (`POST /api/v1/operations/housekeeping/requests`), Maintenance requests, or voice-extracted AI tickets (`concierge_graph.py`).
  - Tickets are stored in `support_requests` (`backend/app/models/support_request.py`) and broadcast in real time over WebSocket to department dashboards (`StaffRequestsPage.jsx`, `KitchenDashboard.jsx`).
- **Department Staff & Head Lead Roles:**
  - Department staff claim and update task progress via `PATCH /api/v1/operations/tasks/{ticket_id}` (`backend/app/api/v1/endpoints/operations/admin_ops.py:390-565`).
  - Head Lead / Manager can issue dispatch overrides (`POST /api/v1/operations/admin/dispatch` in `admin_ops.py:568`) or management directives (`POST /api/v1/operations/directives` in `admin_ops.py:628`).
- **Automated Tests Found:**
  - `backend/tests/test_operations_api.py`, `backend/tests/test_room_service_api.py`, `frontend/src/components/robot/__tests__/RobotRoomServiceScreen.test.jsx`, `frontend/src/components/robot/__tests__/RobotTaxiModal.test.jsx`, `frontend/src/pages/staff/__tests__/KitchenThreeStepsWorkflow.test.jsx`.

#### Identified Discrepancies & Design-to-Implementation Gaps
1. **Entity State Naming (`NEW / ASSIGNED / IN_PROGRESS / COMPLETED / SCHEDULED` vs. Database Strings):**
   - **BM01 Appendix A1:** Defines `SupportRequest.status` values `NEW`, `ASSIGNED`, `IN_PROGRESS`, `COMPLETED`, and (for `DS-06`) `SCHEDULED`.
   - **Database Implementation (`backend/app/models/support_request.py:39`, `admin_ops.py:390-565`):** Uses string values `"Pending"` (covering both initial creation `NEW` and department routing `ASSIGNED` via `department_id`), `"In Progress"` (when `assigned_staff_name` is set, or F&B sub-statuses `"Sent to Kitchen"`, `"Cooking"`, `"Ready"`, `"Delivering"`), `"Completed"` / `"Delivered"`, and `"Cancelled"`.
2. **Missing `SCHEDULED` Database State & Automated Off-Hours Gate (`DS-06`):**
   - **`SCHEDULED` State Verification:** `SCHEDULED` is **not** implemented as an enum or status value in `SupportRequest` (`support_request.py:39`).
   - **Off-Hours Check Verification:** Backend endpoints (`housekeeping.py`, `room_service.py`, `taxi.py`) do not enforce an automated operating-hours validation gate that switches tickets to `SCHEDULED`. Instead, time preferences are stored as free-text in `description` or JSON in `extra_data` while `SupportRequest.status` remains `"Pending"`.
3. **Conditional Participation of `Head Lead`:**
   - Standard service requests are fulfilled end-to-end by `Department Staff` without requiring mandatory `Head Lead` sign-off on every ticket. `Head Lead` participates conditionally when a ticket requires priority dispatch override, crosses the 5-minute unacknowledged escalation threshold (`SRS BR-ST-01`), or requires supervisor confirmation. `WF-03_Guest_Service_Request_Handling.puml` models this accurately with explicit conditional decision nodes.

---

### 2.4 WF-04: Robot-to-Human Handoff (`F-04` | `DS-07`, `DS-08`)

#### Verified Implementation Evidence
- **Guest-Initiated Escalation & WebRTC Signaling (`DS-07`):**
  - Guest taps the "Call Staff" button on `RobotScreenPage.jsx` or speaks an escalation phrase matched by `concierge_graph.py:1043,4083` (`trigger_video_call = True`).
  - `POST /api/v1/operations/concierge/live-calls` (`backend/app/api/v1/endpoints/operations/concierge.py:67-147`) creates a `SupportRequest` (`status="Pending"`, `request_code="CCG-xxxx"`) and a `HumanSupportSession` (`status="Active"`, `session_code="LIVE-xxxx"`), and broadcasts a `NEW_LIVE_CALL` notification to `ConciergeDashboard.jsx`.
  - Two-way WebRTC video/audio signaling runs over `/api/v1/operations/concierge/ws/video/{session_id}` managed by `VideoCallManager` (`backend/app/services/video_call_manager.py`).
- **Live Bilingual Translation (`EN <-> VN`) & Recording Upload:**
  - During the call, `MessengerVideoCallModal.jsx` and `callAudioStreamStt.js` stream audio segments to `/api/v1/ai/stt/transcribe`, translate text via `/api/v1/ai/translate` (`translation_service.py`), broadcast `live_subtitle` events, and synthesize translated speech via `/api/v1/ai/tts` (`live_audio`).
  - Upon call termination, `POST /api/v1/operations/concierge/upload-recording` uploads the `.webm` recording via `cloudinary_service.py`, updates `HumanSupportSession.status = "Resolved"`, and sets `SupportRequest.status = "Completed"`.
- **Automated Tests Found:**
  - `backend/tests/test_video_call.py`, `backend/tests/test_translation_api.py`, `frontend/src/components/video/MessengerVideoCallModal.test.jsx`, `frontend/src/pages/dashboard/__tests__/ConciergeTaxiReceiveCallWorkflow.test.jsx`.

#### Identified Discrepancies & Design-to-Implementation Gaps
1. **CRITICAL GAP — Absent Automatic Negative Expression Escalation (`DS-08`):**
   - **BM01 Design (`WF-04` / `DS-08`):** Specifies that when the robot camera detects a negative or frustrated guest facial expression (`attitude = Frustrated / Negative`), the robot automatically initiates human handoff (`ChatSession.status: AI_ACTIVE -> ESCALATED_HUMAN`).
   - **Actual Code at `review-2`:**
     - In `frontend/src/pages/robot/RobotScreenPage.jsx:402`, `const [guestEmotion, setGuestEmotion] = useState('neutral')` is initialized to `'neutral'`, and `setGuestEmotion` is never updated by any camera facial-expression detector (`personDetector.js` only performs person bounding-box presence detection).
     - In `backend/app/services/ai/concierge_graph.py:6928,7000`, the `emotion` parameter passed in `ChatRequest` is only injected as a tone hint into the LLM prompt (`ollama_service.generate_response(..., emotion=emotion)`). **It never sets `trigger_video_call = True`.**
     - Therefore, `DS-08` (expression-triggered automatic escalation) is modeled in `WF-04_Robot_Human_Handoff.puml` as an alternative entry condition converging into the escalation workflow, with an explicit UML note flagging the design-to-implementation gap.

---

### 2.5 WF-05: Robot Monitoring & Incident Handling (`F-05`, `F-06` | `DS-09`, `DS-10`)

#### Verified Implementation Evidence
- **Telemetry Streaming & Map Visualization (`DS-09`):**
  - `robot/ros2_ws/src/hc_robot_client/hc_robot_client/nodes/telemetry_node.py` and `backend/app/api/v1/endpoints/map.py` (`/api/v1/map/ws`) stream robot pose (`x, y, theta/yaw`), LiDAR 360° scan points (`rplidar_service.py`), and status to `AdminLidarPage.jsx` and `rosbridgeService.js`.
- **Branch A — Sensor / LiDAR Failure (`DS-10`):**
  - `robot/ros2_ws/src/hc_robot_client/hc_robot_client/nodes/safety_controller_node.py` monitors `/scan` (LiDAR) and `/ultrasonic/front` at `20 Hz`. If sensor data times out (`> 1.0s`, `SENSOR_TIMEOUT_SEC = 1.0`) or an obstacle violates `EMERGENCY_STOP_DIST = 0.35m`, it publishes zero velocity (`linear.x = 0.0, angular.z = 0.0`) to `/cmd_vel` and publishes `"EMERGENCY_STOP"` on `/safety_status`.
- **Branch B — Multi-Tier Battery Management (`20% / 10% / 80%` Policy):**
  - `frontend/src/utils/batteryPolicy.js` implements the exact three-threshold state machine required by BM01 Decision `D2` and Feature `F-06`:
    - `BATTERY_LOW_PERCENT = 20`: Enters `BATTERY_MODE.LOW` (Warning buffer). Blocks new guest sessions (`state.startRequested`), displays warning banner (`describeBatteryStatus`), waits if `isServingGuest == true` (`GUARD_ACTION.NONE`), and once free initiates `wf-10-low-battery` (`MOVE` to `CHARGER_STATION`).
    - `BATTERY_CRITICAL_PERCENT = 10`: Enters `BATTERY_MODE.CRITICAL` (Critical cut-off). Immediately interrupts active guest tasks (`GUARD_ACTION.INTERRUPT_AND_START`), plays voice apology (`LOW_BATTERY_GUEST_NOTICE`), and initiates emergency docking to `CHARGER_STATION`.
    - Upon arrival at `CHARGER_STATION` (`GUARD_ACTION.ARRIVED`), sets `waitingForCharge = true` and dispatches a `ROBOT_CHARGING` support request to Maintenance.
    - `BATTERY_RESUME_PERCENT = 80`: Enforces hysteresis in `nextBatteryMode()` so the robot remains in low-battery/charging mode until battery reaches $\ge 80\%$, after which it clears `waitingForCharge` and returns to `BATTERY_MODE.OK` (`IDLE`).
- **Automated Tests Found:**
  - `frontend/src/utils/__tests__/batteryPolicy.test.js` (comprehensive unit tests verifying `20%`, `10%`, `80%` hysteresis, guest interruption vs. safe task completion, and arrival at `CHARGER_STATION`), `frontend/src/services/rosbridgeService.test.js`, `backend/tests/test_map_api.py`.

#### Identified Discrepancies & Design-to-Implementation Gaps
1. **Backend Telemetry Battery Hardcoding (`BM01 Known Gap G-01`):**
   - While `frontend/src/utils/batteryPolicy.js` and `robot/scripts/pi_battery_estimator.py` implement the battery policy and voltage estimation, `backend/app/api/v1/endpoints/map.py:985` still hardcodes `"battery": 98` in the backend WebSocket telemetry broadcast, and `backend/app/api/v1/endpoints/operations/robot_control.py:18` (`GET /api/v1/operations/robots/fleet`) is a stub returning `[]`.
2. **`IncidentLog` Model Representation:**
   - BM01 refers to `IncidentLog.status: LOGGED -> RESOLVED`. In the backend SQLAlchemy schema (`backend/app/models/`), there is no table named `incident_logs`. Instead, incident persistence is split across:
     - `LogEvent` (`log_events` table in `backend/app/models/logging.py:11`), which records immutable system/hardware events (`category="ROBOT"`, `level="ERROR" | "CRITICAL"`),
     - `Notification` (`notifications` table in `backend/app/models/notification.py`), and
     - `SupportRequest` (`support_requests` table with `service_type="ROBOT_CHARGING"` / `department="Maintenance"`), which tracks lifecycle resolution from `"Pending"` (`LOGGED`) to `"Completed"` (`RESOLVED`).
3. **`Robot.status` Enum Naming Variance (`EMERGENCY_STOP` vs. `ERROR`):**
   - `safety_controller_node.py:182` and BM01 use `EMERGENCY_STOP`, whereas the comment on `Robot.status` in `backend/app/models/robot.py:20` lists `'IDLE', 'NAVIGATING', 'INTERACTING', 'CHARGING', 'ERROR', 'OFFLINE'`.

---

## 3. UML Activity Diagram Compliance Verification

All five `.puml` diagrams in `docs/review-2/activity/` have been verified against Section 4 of the specification:

- **Modern PlantUML Activity Syntax (`activity-diagram-beta`):** Uses `start`, `stop`, `|Swimlane|`, `:Action;`, `if (...) then (...) else (...) endif`, `repeat ... repeat while (...)`, and `fork ... fork again ... end fork`. Zero sequence-diagram arrows (`->`) or state-machine transitions outside activity control flow.
- **Swimlane Responsibility Alignment:** Every action is placed in the exact actor swimlane responsible for executing it (`Hotel Admin`, `Backend`, `Robot`, `Hotel Guest`, `Concierge Robot`, `Department Staff`, `Head Lead`, `Front Desk Staff`, `Operations Staff`, `Maintenance`).
- **Explicit Guard Conditions & Merged Paths:** Every decision diamond and loop has a clear, domain-specific guard question and labeled outgoing branches (`Yes / No` with scenario IDs `DS-01`–`DS-10`).
- **Distinct Safety Branches in `WF-05`:** Sensor/LiDAR failure (`Branch A` $\rightarrow$ `EMERGENCY_STOP`) and Multi-Tier Battery Management (`Branch B` $\rightarrow$ `20% Warning Buffer` vs. `10% Critical Cut-off` $\rightarrow$ `CHARGING` $\rightarrow$ `80% Recovery Threshold`) are modeled as separate, non-conflated decision branches inside a terminating telemetry loop.

