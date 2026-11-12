# HC-ROBOT (FA26SE905) · SYSTEM ARCHITECTURE & WORKFLOW DIAGRAMS (REVIEW 2)

> **Document purpose:** Complete technical diagrams (Mermaid & PlantUML) corresponding to the Key Design Decisions (D1–D5) and Core Workflows (WF-01–WF-05) in `SWP490_FA26SE905_R2_DesignBrief.md`.

---

## 1. Decision D1: Multi-Tier Hybrid AI Voice Pipeline (FR-AI-01 / Architecture Fig 2.1)

### 1.1. Mermaid Diagram

```mermaid
flowchart TD
    Guest(["Guest Voice Input"]) --> VAD["Web Audio VAD & Silence Detection"]
    VAD --> STT["Azure / Whisper STT Engine"]
    STT --> QueryNorm["Query Normalization & Intent Routing"]
    QueryNorm --> CacheCheck{"Pre-cached Local<br/>Factsheet Hit?"}
    CacheCheck -- Yes --> QuickResp["Instant Local Facts / Map Data (< 0.3s)"]
    CacheCheck -- No --> Tier1["Tier 1: Groq Cloud LLM (Llama 3.3 70B Fast Path)"]
    Tier1 -- Success --> RAGMerge["Merge with ChromaDB RAG Context"]
    Tier1 -- Timeout > 2s --> Tier2["Tier 2: Gemini Flash LLM Fallback"]
    Tier2 -- Success --> RAGMerge
    Tier2 -- Offline --> RuleFallback["Rule-Based Fallback Generator"]
    RAGMerge --> TextOutput["Final Answer Text"]
    RuleFallback --> TextOutput
    QuickResp --> TextOutput
    TextOutput --> TTS["Microsoft EdgeTTS (HoaiMy / Jenny)"]
    TTS --> AudioStream["MP3 Base64 Streaming Chunk"]
    AudioStream --> AudioContext["Browser Web Audio API & Subtitle Sync"]
    AudioContext --> Speaker(["Robot Speaker & Kiosk Screen"])
```

### 1.2. PlantUML Diagram

```plantuml
@startuml
title Decision D1: Multi-Tier Hybrid AI Voice Pipeline (FR-AI-01)
skinparam component {
  BackgroundColor White
  BorderColor #14233A
  FontColor #14233A
}

actor "Hotel Guest" as Guest
component "Web Audio VAD\n& Earcon Chime" as VAD
component "STT Engine\n(Whisper / Azure)" as STT
component "FastAPI AI Engine\n(ai_chat_service.py)" as Backend
database "ChromaDB\nVector Store" as RAG
cloud "Groq Cloud LLM\n(Tier 1 Fast Path)" as Groq
cloud "Gemini Flash API\n(Tier 2 Fallback)" as Gemini
component "EdgeTTS Audio Engine\n(Neural Voices)" as TTS
component "Kiosk Web Audio API\n& Subtitle Sync" as Kiosk

Guest -> VAD : Speaks inquiry
VAD -> STT : Audio buffer streaming
STT -> Backend : Transcribed query string

Backend -> RAG : Query hotel semantic factsheet
RAG -> Backend : Context chunks

alt Fast Path (Tier 1 Groq)
    Backend -> Groq : Prompt + Context (Streaming)
    Groq -> Backend : AI response (< 800 ms)
else Timeout > 2s or Rate Limit
    Backend -> Gemini : Fallback prompt
    Gemini -> Backend : AI response
else Offline Network
    Backend -> Backend : Local rule factsheet fallback
end

Backend -> TTS : Synthesize voice (HoaiMy / Jenny)
TTS -> Backend : Base64 MP3 stream
Backend -> Kiosk : Payload {reply, audio_base64}
Kiosk -> Guest : Play audio + display subtitles synchronously

@enduml
```

---

## 2. Decision D2: Multi-Tier Battery Buffer & Auto-Docking (FR-PWR-02 / Battery State Machine)

### 2.1. Mermaid Diagram

```mermaid
stateDiagram-v2
    [*] --> STATE_OK: Battery > 20% (Normal Operation)
    STATE_OK --> STATE_LOW_WARNING: Battery <= 20% (Warning Buffer)
    state STATE_LOW_WARNING {
        [*] --> FINISH_ACTIVE_TASK: Reject new guests
        FINISH_ACTIVE_TASK --> SHOW_LOW_BANNER: Display warning banner
        SHOW_LOW_BANNER --> PREPARE_DOCK: Polite voice farewell
    }
    STATE_LOW_WARNING --> STATE_CRITICAL_CUTOFF: Battery <= 10% (Emergency Buffer)
    STATE_OK --> STATE_CRITICAL_CUTOFF: Sudden drop <= 10%
    state STATE_CRITICAL_CUTOFF {
        [*] --> EMERGENCY_ABORT: Hard task abort
        EMERGENCY_ABORT --> SHOW_CRITICAL_MODAL: Alert modal & Voice apology
        SHOW_CRITICAL_MODAL --> DISPATCH_URGENT_TICKET: Alert maintenance staff
    }
    PREPARE_DOCK --> NAVIGATING_TO_DOCK: Normal route
    STATE_CRITICAL_CUTOFF --> NAVIGATING_TO_DOCK: Priority route
    NAVIGATING_TO_DOCK --> WAITING_FOR_STAFF_PLUG: Arrived at dock
    state WAITING_FOR_STAFF_PLUG {
        [*] --> CHARGING_STATUS_SCREEN: "Waiting for staff plug"
        CHARGING_STATUS_SCREEN --> BATTERY_CHARGING: Staff connects charger
    }
    state BATTERY_CHARGING {
        [*] --> HYSTERESIS_CHECK
        HYSTERESIS_CHECK --> HYSTERESIS_CHECK: Battery < 80% (Unavailable)
    }
    BATTERY_CHARGING --> STATE_OK: Battery >= 80% (Resume)
```

### 2.2. PlantUML Diagram

```plantuml
@startuml
title Decision D2: Multi-Tier Battery Buffer State Machine (FR-PWR-02)
skinparam state {
  BackgroundColor White
  BorderColor #14233A
  FontColor #14233A
  ArrowColor #14233A
}

[*] --> STATE_OK : Battery > 20%

STATE_OK --> STATE_LOW_WARNING : Battery <= 20% (Warning Buffer)
state STATE_LOW_WARNING {
  [*] --> DRAIN_TASK : Finish current guest interaction
  DRAIN_TASK --> SHOW_BANNER : Persistent top warning notice
  SHOW_BANNER --> BLOCK_NEW : Block new sessions
}

STATE_LOW_WARNING --> STATE_CRITICAL : Battery <= 10% (Critical Cut-off)
STATE_OK --> STATE_CRITICAL : Sudden drop <= 10%
state STATE_CRITICAL {
  [*] --> ABORT : Abort task immediately
  ABORT --> MODAL_APOLOGY : Fullscreen alert & TTS apology
  MODAL_APOLOGY --> ALERT_MAINT : Dispatch urgent ticket
}

BLOCK_NEW --> NAV_TO_DOCK : Normal docking route
ALERT_MAINT --> NAV_TO_DOCK : Emergency route

state NAV_TO_DOCK {
  [*] --> DRIVING_TO_DOCK
  DRIVING_TO_DOCK --> ARRIVED_DOCK
}

NAV_TO_DOCK --> WAITING_PLUG : Dock reached
state WAITING_PLUG {
  [*] --> SCREEN_WAITING : Kiosk: "Waiting for staff to plug in"
  SCREEN_WAITING --> CHARGING : Staff plugs in power
}

state CHARGING {
  [*] --> CHARGING_LOOP
  CHARGING_LOOP --> CHARGING_LOOP : Battery < 80% (Hysteresis Guard)
}

CHARGING --> STATE_OK : Battery >= 80% (Resume Standby)

@enduml
```

---

## 3. Decision D3: Real-Time Fleet Telemetry & Sensor Health (FR-MON-01 / Telemetry Flowchart)

### 3.1. Mermaid Diagram

```mermaid
flowchart TD
    subgraph SENSORS["Hardware Sensor Bus"]
        LiDAR["RPLiDAR A1/A2 (360° Scans)"]
        Encoders["Wheel Encoders (Odometry)"]
        Ultrasonic["HC-SR04 (Safety Clearances)"]
    end

    subgraph PI5["Edge Controller: Raspberry Pi 5 (ROS2)"]
        OdomNode["ros2_control & Odometry Pub"]
        Watchdog{"Watchdog Monitor:<br/>LiDAR packets in 1.0s?"}
        EMG_Stop["Clamp PWM = 0<br/>EMERGENCY_STOP"]
        PacketBuilder["Assemble Telemetry Packet:<br/>pose(x,y,yaw), speed, battery, health"]
    end

    subgraph BACKEND["FastAPI Gateway (map.py)"]
        WSHub["WebSocket Hub (/ws/map)<br/>2 Hz Broadcast"]
    end

    subgraph ADMIN_UI["Admin Portal (AdminPhysicalMapTab.jsx)"]
        MapCanvas["2D Live Map & Scan Points"]
        HealthPills["Hardware Indicators (Green/Red)"]
        AlertModal["Red Alert Banner & Warning Chime"]
    end

    LiDAR --> Watchdog
    Encoders --> OdomNode
    Ultrasonic --> PacketBuilder
    Watchdog -- Yes --> PacketBuilder
    Watchdog -- Timeout > 1s --> EMG_Stop --> PacketBuilder
    OdomNode --> PacketBuilder
    PacketBuilder --> WSHub
    WSHub --> MapCanvas
    WSHub --> HealthPills
    WSHub -- On Sensor Disconnect --> AlertModal
```

### 3.2. PlantUML Diagram

```plantuml
@startuml
title Decision D3: Real-Time Fleet Telemetry & Sensor Health (FR-MON-01)
skinparam participant {
  BackgroundColor White
  BorderColor #14233A
  FontColor #14233A
}
skinparam sequence {
  ArrowColor #14233A
  LifeLineBorderColor #14233A
}

actor "Operations Staff" as Admin
boundary "Admin Physical Map Tab" as Portal
control "WebSocket Hub (/ws/map)" as WSHub
control "Backend Fleet Service" as Backend
entity "Raspberry Pi 5 (ROS2)" as Pi5
entity "Hardware Bus (LiDAR / Ultrasonic)" as Sensors

Sensors -> Pi5 : Laser scan packets (/scan) & Ultrasonic distance
Pi5 -> Pi5 : Calculate Odometry & SLAM Pose (x, y, yaw)
Pi5 -> Backend : UDP/HTTP Telemetry Packet (Pose, Battery, Device Info)
Backend -> WSHub : Format telemetry_update payload
WSHub -> Portal : WebSocket frame (pose, battery, velocities, scan points)
Portal -> Admin : Live map marker update & hardware indicators (Green)

opt Exception: LiDAR Sensor Disconnection
    Sensors -[#Red]->x Pi5 : Hardware cable disconnected / COM timeout (> 1.0s)
    Pi5 -> Pi5 : Trigger watchdog -> Clamp motor PWM = 0 (EMERGENCY_STOP)
    Pi5 -> Backend : Status update: WAITING_FOR_HARDWARE (COM9 Lost)
    Backend -> WSHub : Anomaly alert broadcast
    WSHub -> Portal : Push critical status frame
    Portal -> Admin : Display Red Alert badge & audio warning on portal
end

@enduml
```

---

## 4. Decision D4: Standardized Core Workflows (WF-01..WF-05)

### 4.1. WF-01: Admin Configuration

```mermaid
flowchart LR
    Login["Admin Login"] --> Update["Update knowledge, FAQ,<br/>promotions, expressions"]
    Update --> Sync["Synchronize to Robot"]
    Sync --> Verify["Verify deployment on robot"]
```

```plantuml
@startuml
title WF-01: Admin Configuration
skinparam activity {
  BackgroundColor White
  BorderColor #14233A
  FontColor #14233A
  ArrowColor #14233A
}

(*) --> "Admin Login"
--> "Update knowledge, FAQ, promotions, expressions"
--> "Synchronize to Robot"
--> "Verify deployment on robot"
--> (*)

@enduml
```

### 4.2. WF-02: Guest Information & Recommendation

```mermaid
flowchart LR
    Detect["Detect guest"] --> Greet["Greet & Select language"]
    Greet --> QA["Q&A & Service recommendation"]
    QA --> Feedback["Collect guest rating/feedback"]
```

```plantuml
@startuml
title WF-02: Guest Information & Recommendation
skinparam activity {
  BackgroundColor White
  BorderColor #14233A
  FontColor #14233A
  ArrowColor #14233A
}

(*) --> "Detect guest"
--> "Greet & Select language"
--> "Q&A & Service recommendation"
--> "Collect guest rating/feedback"
--> (*)

@enduml
```

### 4.3. WF-03: Guest Service Request Handling

```mermaid
flowchart LR
    Req["Guest submits request"] --> Route["Classify & Route to department"]
    Route --> Process["Staff receives & processes"]
    Process --> Status["Update status to guest"]
```

```plantuml
@startuml
title WF-03: Guest Service Request Handling
skinparam activity {
  BackgroundColor White
  BorderColor #14233A
  FontColor #14233A
  ArrowColor #14233A
}

(*) --> "Guest submits request"
--> "Classify & Route to department"
--> "Staff receives & processes"
--> "Update status to guest"
--> (*)

@enduml
```

### 4.4. WF-04: Robot-to-Human Handoff

```mermaid
flowchart LR
    Ask["Guest requests assistance<br/>OR bad expression"] --> Alert["Notify staff"]
    Alert --> Pick["Staff answers call"]
    Pick --> Call["Communicate with translation (EN-VN)"]
    Call --> End["End session"]
```

```plantuml
@startuml
title WF-04: Robot-to-Human Handoff
skinparam activity {
  BackgroundColor White
  BorderColor #14233A
  FontColor #14233A
  ArrowColor #14233A
}

(*) --> "Guest requests assistance / bad expression"
--> "Notify staff"
--> "Staff answers call"
--> "Communicate with translation (EN-VN)"
--> "End session"
--> (*)

@enduml
```

### 4.5. WF-05: Robot Monitoring & Incident Handling

```mermaid
flowchart LR
    Monitor["Monitor telemetry & status"] --> Anomaly["Detect anomaly<br/>(Battery / LiDAR disconnect)"]
    Anomaly --> Warn["Alert staff"]
    Warn --> Resolve["Staff handles incident"]
    Resolve --> Log["Update status & log history"]
```

```plantuml
@startuml
title WF-05: Robot Monitoring & Incident Handling
skinparam activity {
  BackgroundColor White
  BorderColor #14233A
  FontColor #14233A
  ArrowColor #14233A
}

(*) --> "Monitor telemetry & status"
--> "Detect anomaly (Battery / LiDAR disconnect)"
--> "Alert staff"
--> "Staff handles incident"
--> "Update status & log history"
--> (*)

@enduml
```

---

## 5. Decision D5: Robot-to-Human WebRTC Video & Translation Architecture (FR-CALL-01)

### 5.1. Mermaid Diagram

```mermaid
sequenceDiagram
    autonumber
    actor Guest as Hotel Guest
    participant Kiosk as Robot Kiosk UI (MessengerVideoCallModal.jsx)
    participant WSHub as VideoCallManager WebSocket Hub
    participant StaffDesk as Front Desk Screen (Receptionist Portal)
    actor Staff as Front Desk Staff

    Guest->>Kiosk: Taps "Call Front Desk" OR Bad expression detected
    Kiosk->>WSHub: send call_request {robot_id: "RC-001", location: "Lobby"}
    WSHub->>StaffDesk: Trigger incoming video call ring with chime
    Staff->>StaffDesk: Click "Accept Video Call"
    StaffDesk->>WSHub: send call_accepted
    WSHub->>Kiosk: Initialize WebRTC PeerConnection (SDP Offer/Answer)
    Kiosk<<->>StaffDesk: P2P WebRTC Media Stream (Video 720p + Audio)
    Guest->>Kiosk: Speaks in English: "Can I request late checkout tomorrow?"
    Kiosk->>StaffDesk: Push Translated Subtitle: "Khách hỏi thủ tục trả phòng trễ."
    Staff->>StaffDesk: Speaks in Vietnamese: "Dạ được ạ, miễn phí đến 14h chiều."
    StaffDesk->>Kiosk: Push Subtitle & EdgeTTS: "Yes, late checkout is free until 2:00 PM."
    Kiosk->>Guest: Voice audio playback + English subtitles displayed
    Staff->>StaffDesk: Click "End Call" -> Record resolved ticket
    StaffDesk->>WSHub: Terminate WebRTC session
```

### 5.2. PlantUML Diagram

```plantuml
@startuml
title Decision D5: Robot-to-Human Video Call & Translation (FR-CALL-01)
skinparam participant {
  BackgroundColor White
  BorderColor #14233A
  FontColor #14233A
}
skinparam sequence {
  ArrowColor #14233A
  LifeLineBorderColor #14233A
}

actor "International Guest" as Guest
boundary "Robot Kiosk UI" as Kiosk
control "WebRTC Signaling Hub\n(VideoCallManager)" as Signaling
boundary "Staff Web Portal" as StaffPortal
actor "Receptionist" as Staff

Guest -> Kiosk : Request staff / Bad expression detected
Kiosk -> Signaling : WS call_request {robot_id, location}
Signaling -> StaffPortal : Incoming video call popup & ring chime

Staff -> StaffPortal : Click "Accept"
StaffPortal -> Signaling : call_accepted
Signaling -> Kiosk : SDP Offer / Answer exchange
Kiosk <-> StaffPortal : WebRTC PeerConnection (Video 720p + Audio)

== Live Bilingual Translation Stream ==
Guest -> Kiosk : Speaks foreign language (English)
Kiosk -> StaffPortal : Render translated Vietnamese subtitles
Staff -> StaffPortal : Replies in Vietnamese
StaffPortal -> Kiosk : Render translated English subtitles & EdgeTTS audio

Staff -> StaffPortal : Click "End Call"
StaffPortal -> Kiosk : Close WebRTC session
Kiosk -> Guest : "Thank you! Have a great stay."

@enduml
```
