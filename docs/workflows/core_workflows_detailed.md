# CORE WORKFLOWS · MULTI-STEP VISUAL ICON FLOWS (CHI TIET)

> Tai lieu dac ta 6 Core Workflows cua he thong HC-Robot duoi dang chuoi buoc truc quan mo rong (Granular Multi-Step Icon Flows), di qua day du cac khau ky thuat tu Sensor -> Frontend -> Backend -> Hardware Controller.

---

## 1. WF-01: Admin Configuration & Knowledge Synchronization Flow

<svg viewBox="0 0 1040 500" width="100%" height="auto" xmlns="http://www.w3.org/2000/svg" style="background:#F7F4EE; border-radius:18px; border:1.5px solid #E2DBD0; font-family:'Plus Jakarta Sans', -apple-system, sans-serif;">
  <!-- Header -->
  <text x="40" y="42" font-size="22" font-weight="900" fill="#1F2937">Core WorkFlows:</text>
  <text x="40" y="70" font-size="16" font-weight="600" fill="#4B5563">WF-01: Admin Configuration, RAG Ingestion &amp; Zero-Downtime Deployment</text>

  <!-- Step 1: Admin Login -->
  <g transform="translate(40, 115)">
    <rect width="90" height="70" rx="12" fill="#FFFFFF" stroke="#DCD5C6" stroke-width="1.5"/>
    <rect x="25" y="24" width="40" height="30" rx="4" fill="none" stroke="#1F2937" stroke-width="2.5"/>
    <path d="M35 24 V15 A10 10 0 0 1 55 15 V24" fill="none" stroke="#1F2937" stroke-width="2.5"/>
    <circle cx="45" cy="38" r="3" fill="#1F2937"/>
    <text x="45" y="92" text-anchor="middle" font-size="11" font-weight="700" fill="#1F2937">1. Admin Login</text>
    <text x="45" y="106" text-anchor="middle" font-size="9" font-weight="600" fill="#6B7280">JWT AUTH TOKEN</text>
  </g>

  <!-- Arrow 1 -> 2 -->
  <line x1="130" y1="150" x2="165" y2="150" stroke="#1F2937" stroke-width="2.2"/>
  <polygon points="161,146 169,150 161,154" fill="#1F2937"/>

  <!-- Step 2: Open Admin Portal -->
  <g transform="translate(175, 115)">
    <rect width="90" height="70" rx="12" fill="#FFFFFF" stroke="#DCD5C6" stroke-width="1.5"/>
    <rect x="20" y="18" width="50" height="34" rx="3" fill="none" stroke="#1F2937" stroke-width="2.2"/>
    <line x1="20" y1="28" x2="70" y2="28" stroke="#1F2937" stroke-width="1.8"/>
    <circle cx="26" cy="23" r="1.5" fill="#1F2937"/>
    <circle cx="31" cy="23" r="1.5" fill="#1F2937"/>
    <circle cx="36" cy="23" r="1.5" fill="#1F2937"/>
    <text x="45" y="92" text-anchor="middle" font-size="11" font-weight="700" fill="#1F2937">2. Admin Portal</text>
    <text x="45" y="106" text-anchor="middle" font-size="9" font-weight="600" fill="#6B7280">/admin DASHBOARD</text>
  </g>

  <!-- Fork Arrows to 3 parallel channels -->
  <line x1="265" y1="150" x2="295" y2="150" stroke="#1F2937" stroke-width="2.2"/>
  <line x1="295" y1="150" x2="295" y2="230" stroke="#1F2937" stroke-width="2.2"/>
  <line x1="295" y1="230" x2="295" y2="310" stroke="#1F2937" stroke-width="2.2"/>
  <line x1="295" y1="150" x2="330" y2="150" stroke="#1F2937" stroke-width="2.2"/>
  <polygon points="326,146 334,150 326,154" fill="#1F2937"/>
  <line x1="295" y1="230" x2="330" y2="230" stroke="#1F2937" stroke-width="2.2"/>
  <polygon points="326,226 334,230 326,234" fill="#1F2937"/>
  <line x1="295" y1="310" x2="330" y2="310" stroke="#1F2937" stroke-width="2.2"/>
  <polygon points="326,306 334,310 326,314" fill="#1F2937"/>

  <!-- Channel A: Knowledge Upload & Embedding -->
  <g transform="translate(340, 115)">
    <rect width="90" height="70" rx="12" fill="#FFFFFF" stroke="#DCD5C6" stroke-width="1.5"/>
    <path d="M30 18 H50 L60 28 V52 H30 Z" fill="none" stroke="#1F2937" stroke-width="2"/>
    <polyline points="50,18 50,28 60,28" fill="none" stroke="#1F2937" stroke-width="2"/>
    <path d="M45 44 V33 M39 39 L45 33 L51 39" stroke="#2563EB" stroke-width="2" stroke-linecap="round"/>
    <text x="45" y="92" text-anchor="middle" font-size="11" font-weight="700" fill="#1F2937">3A. Upload Docs</text>
    <text x="45" y="106" text-anchor="middle" font-size="9" font-weight="600" fill="#2563EB">.PDF / .DOCX RAG</text>
  </g>

  <line x1="430" y1="150" x2="465" y2="150" stroke="#1F2937" stroke-width="2.2"/>
  <polygon points="461,146 469,150 461,154" fill="#1F2937"/>

  <!-- Step 4A: Chunk & Vectorize -->
  <g transform="translate(475, 115)">
    <rect width="90" height="70" rx="12" fill="#FFFFFF" stroke="#DCD5C6" stroke-width="1.5"/>
    <ellipse cx="45" cy="25" rx="18" ry="6" fill="none" stroke="#1F2937" stroke-width="2"/>
    <path d="M27 25 V45 C27 48 45 51 63 45 V25" fill="none" stroke="#1F2937" stroke-width="2"/>
    <path d="M27 35 C27 38 45 41 63 35" fill="none" stroke="#1F2937" stroke-width="2"/>
    <text x="45" y="92" text-anchor="middle" font-size="11" font-weight="700" fill="#1F2937">4A. Chunk &amp; Vector</text>
    <text x="45" y="106" text-anchor="middle" font-size="9" font-weight="600" fill="#6B7280">ChromaDB Store</text>
  </g>

  <!-- Channel B: Stepflow & Scenarios -->
  <g transform="translate(340, 195)">
    <rect width="90" height="70" rx="12" fill="#FFFFFF" stroke="#DCD5C6" stroke-width="1.5"/>
    <rect x="25" y="22" width="16" height="12" rx="2" fill="none" stroke="#1F2937" stroke-width="2"/>
    <rect x="49" y="36" width="16" height="12" rx="2" fill="none" stroke="#1F2937" stroke-width="2"/>
    <path d="M33 34 V42 H49" fill="none" stroke="#1F2937" stroke-width="2"/>
    <text x="45" y="92" text-anchor="middle" font-size="11" font-weight="700" fill="#1F2937">3B. Stepflow Edit</text>
    <text x="45" y="106" text-anchor="middle" font-size="9" font-weight="600" fill="#6B7280">8 ACTION BLOCKS</text>
  </g>

  <!-- Channel C: RobotFace Expressions & Promos -->
  <g transform="translate(340, 275)">
    <rect width="90" height="70" rx="12" fill="#FFFFFF" stroke="#DCD5C6" stroke-width="1.5"/>
    <circle cx="45" cy="35" r="14" fill="none" stroke="#8B5CF6" stroke-width="2"/>
    <circle cx="40" cy="32" r="2" fill="#8B5CF6"/>
    <circle cx="50" cy="32" r="2" fill="#8B5CF6"/>
    <path d="M39 40 Q45 46 51 40" fill="none" stroke="#8B5CF6" stroke-width="2" stroke-linecap="round"/>
    <text x="45" y="92" text-anchor="middle" font-size="11" font-weight="700" fill="#1F2937">3C. Face &amp; Promos</text>
    <text x="45" y="106" text-anchor="middle" font-size="9" font-weight="600" fill="#8B5CF6">RobotFace &amp; ADS</text>
  </g>

  <!-- Converge lines to Step 5: Save & Commit -->
  <line x1="565" y1="150" x2="600" y2="150" stroke="#1F2937" stroke-width="2.2"/>
  <line x1="430" y1="230" x2="600" y2="230" stroke="#1F2937" stroke-width="2.2"/>
  <line x1="430" y1="310" x2="600" y2="310" stroke="#1F2937" stroke-width="2.2"/>
  <line x1="600" y1="150" x2="600" y2="310" stroke="#1F2937" stroke-width="2.2"/>
  <line x1="600" y1="230" x2="635" y2="230" stroke="#1F2937" stroke-width="2.2"/>
  <polygon points="631,226 639,230 631,234" fill="#1F2937"/>

  <!-- Step 5: Database Commit -->
  <g transform="translate(645, 195)">
    <rect width="90" height="70" rx="12" fill="#FFFFFF" stroke="#DCD5C6" stroke-width="1.5"/>
    <rect x="25" y="20" width="40" height="30" rx="3" fill="none" stroke="#1F2937" stroke-width="2"/>
    <path d="M33 20 V16 H57 V20" fill="none" stroke="#1F2937" stroke-width="2"/>
    <line x1="31" y1="35" x2="59" y2="35" stroke="#1F2937" stroke-width="2"/>
    <text x="45" y="92" text-anchor="middle" font-size="11" font-weight="700" fill="#1F2937">5. Save Database</text>
    <text x="45" y="106" text-anchor="middle" font-size="9" font-weight="600" fill="#6B7280">SQLITE / POSTGRES</text>
  </g>

  <!-- Arrow 5 -> 6 -->
  <line x1="735" y1="230" x2="770" y2="230" stroke="#1F2937" stroke-width="2.2"/>
  <polygon points="766,226 774,230 766,234" fill="#1F2937"/>

  <!-- Step 6: WebSocket Sync Event -->
  <g transform="translate(780, 195)">
    <rect width="90" height="70" rx="12" fill="#FFFFFF" stroke="#DCD5C6" stroke-width="1.5"/>
    <path d="M45 20 A15 15 0 0 1 60 35" fill="none" stroke="#1F2937" stroke-width="2.5" stroke-linecap="round"/>
    <polygon points="60,26 64,36 54,36" fill="#1F2937"/>
    <path d="M45 50 A15 15 0 0 1 30 35" fill="none" stroke="#1F2937" stroke-width="2.5" stroke-linecap="round"/>
    <polygon points="30,44 26,34 36,34" fill="#1F2937"/>
    <text x="45" y="92" text-anchor="middle" font-size="11" font-weight="700" fill="#1F2937">6. WS Broadcast</text>
    <text x="45" y="106" text-anchor="middle" font-size="9" font-weight="600" fill="#6B7280">SYSTEM_SYNC</text>
  </g>

  <!-- Arrow 6 -> 7 -->
  <line x1="870" y1="230" x2="905" y2="230" stroke="#1F2937" stroke-width="2.2"/>
  <polygon points="901,226 909,230 901,234" fill="#1F2937"/>

  <!-- Step 7: Kiosk Hot-Reload & Verified -->
  <g transform="translate(915, 195)">
    <rect width="90" height="70" rx="12" fill="#FFFFFF" stroke="#10b981" stroke-width="2"/>
    <rect x="22" y="18" width="46" height="32" rx="3" fill="none" stroke="#1F2937" stroke-width="2"/>
    <line x1="33" y1="50" x2="57" y2="50" stroke="#1F2937" stroke-width="2"/>
    <line x1="45" y1="50" x2="45" y2="55" stroke="#1F2937" stroke-width="2"/>
    <polyline points="32,32 40,40 56,24" fill="none" stroke="#10b981" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="45" y="92" text-anchor="middle" font-size="11" font-weight="700" fill="#1F2937">7. Robot Hot Reload</text>
    <text x="45" y="106" text-anchor="middle" font-size="9" font-weight="600" fill="#10b981">DEPLOYED (&lt; 3s)</text>
  </g>
</svg>

---

## 2. WF-02: Guest Welcome, Voice Interaction & Smart Recommendation Flow

<svg viewBox="0 0 1040 500" width="100%" height="auto" xmlns="http://www.w3.org/2000/svg" style="background:#F7F4EE; border-radius:18px; border:1.5px solid #E2DBD0; font-family:'Plus Jakarta Sans', -apple-system, sans-serif;">
  <text x="40" y="42" font-size="22" font-weight="900" fill="#1F2937">Core WorkFlows:</text>
  <text x="40" y="70" font-size="16" font-weight="600" fill="#4B5563">WF-02: Human Approach, Bilingual Voice Dialogue &amp; Smart Amenity Recommendation</text>

  <!-- Step 1: Detect Approach -->
  <g transform="translate(40, 115)">
    <rect width="90" height="70" rx="12" fill="#FFFFFF" stroke="#DCD5C6" stroke-width="1.5"/>
    <circle cx="45" cy="24" r="8" fill="none" stroke="#1F2937" stroke-width="2"/>
    <path d="M28 46 C28 36 36 35 45 35 C54 35 62 36 62 46" fill="none" stroke="#1F2937" stroke-width="2"/>
    <path d="M64 18 A12 12 0 0 1 64 30" fill="none" stroke="#2563EB" stroke-width="2" stroke-linecap="round"/>
    <text x="45" y="92" text-anchor="middle" font-size="11" font-weight="700" fill="#1F2937">1. Detect Guest</text>
    <text x="45" y="106" text-anchor="middle" font-size="9" font-weight="600" fill="#2563EB">YOLOv8 + LIDAR</text>
  </g>

  <!-- Arrow 1 -> 2 -->
  <line x1="130" y1="150" x2="165" y2="150" stroke="#1F2937" stroke-width="2.2"/>
  <polygon points="161,146 169,150 161,154" fill="#1F2937"/>

  <!-- Step 2: Step MOVE to Guest -->
  <g transform="translate(175, 115)">
    <rect width="90" height="70" rx="12" fill="#FFFFFF" stroke="#DCD5C6" stroke-width="1.5"/>
    <circle cx="45" cy="35" r="16" fill="none" stroke="#1F2937" stroke-width="2"/>
    <line x1="45" y1="19" x2="45" y2="51" stroke="#1F2937" stroke-width="2"/>
    <line x1="29" y1="35" x2="61" y2="35" stroke="#1F2937" stroke-width="2"/>
    <polygon points="56,24 64,35 56,46" fill="#1F2937"/>
    <text x="45" y="92" text-anchor="middle" font-size="11" font-weight="700" fill="#1F2937">2. Step MOVE</text>
    <text x="45" y="106" text-anchor="middle" font-size="9" font-weight="600" fill="#6B7280">APPROACH GUEST</text>
  </g>

  <!-- Arrow 2 -> 3 -->
  <line x1="265" y1="150" x2="300" y2="150" stroke="#1F2937" stroke-width="2.2"/>
  <polygon points="296,146 304,150 296,154" fill="#1F2937"/>

  <!-- Step 3: Step GREET & Language -->
  <g transform="translate(310, 115)">
    <rect width="90" height="70" rx="12" fill="#FFFFFF" stroke="#DCD5C6" stroke-width="1.5"/>
    <circle cx="45" cy="35" r="16" fill="none" stroke="#1F2937" stroke-width="2"/>
    <circle cx="39" cy="31" r="2" fill="#1F2937"/>
    <circle cx="51" cy="31" r="2" fill="#1F2937"/>
    <path d="M38 39 Q45 46 52 39" fill="none" stroke="#1F2937" stroke-width="2" stroke-linecap="round"/>
    <text x="45" y="92" text-anchor="middle" font-size="11" font-weight="700" fill="#1F2937">3. Step GREET</text>
    <text x="45" y="106" text-anchor="middle" font-size="9" font-weight="600" fill="#6B7280">VI / EN PROMPT</text>
  </g>

  <!-- Arrow 3 -> 4 -->
  <line x1="400" y1="150" x2="435" y2="150" stroke="#1F2937" stroke-width="2.2"/>
  <polygon points="431,146 439,150 431,154" fill="#1F2937"/>

  <!-- Step 4: Web Audio VAD -->
  <g transform="translate(445, 115)">
    <rect width="90" height="70" rx="12" fill="#FFFFFF" stroke="#DCD5C6" stroke-width="1.5"/>
    <line x1="25" y1="35" x2="30" y2="35" stroke="#2563EB" stroke-width="2"/>
    <line x1="33" y1="26" x2="33" y2="44" stroke="#2563EB" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="40" y1="20" x2="40" y2="50" stroke="#2563EB" stroke-width="3" stroke-linecap="round"/>
    <line x1="47" y1="23" x2="47" y2="47" stroke="#2563EB" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="54" y1="28" x2="54" y2="42" stroke="#2563EB" stroke-width="2" stroke-linecap="round"/>
    <line x1="60" y1="35" x2="65" y2="35" stroke="#2563EB" stroke-width="2"/>
    <text x="45" y="92" text-anchor="middle" font-size="11" font-weight="700" fill="#1F2937">4. Audio VAD</text>
    <text x="45" y="106" text-anchor="middle" font-size="9" font-weight="600" fill="#2563EB">1800ms SILENCE</text>
  </g>

  <!-- Arrow 4 -> 5 -->
  <line x1="535" y1="150" x2="570" y2="150" stroke="#1F2937" stroke-width="2.2"/>
  <polygon points="566,146 574,150 566,154" fill="#1F2937"/>

  <!-- Step 5: Speech-to-Text (STT) -->
  <g transform="translate(580, 115)">
    <rect width="90" height="70" rx="12" fill="#FFFFFF" stroke="#DCD5C6" stroke-width="1.5"/>
    <rect x="37" y="20" width="16" height="22" rx="8" fill="none" stroke="#1F2937" stroke-width="2"/>
    <path d="M30 30 A15 15 0 0 0 60 30" fill="none" stroke="#1F2937" stroke-width="2" stroke-linecap="round"/>
    <line x1="45" y1="45" x2="45" y2="52" stroke="#1F2937" stroke-width="2"/>
    <text x="45" y="92" text-anchor="middle" font-size="11" font-weight="700" fill="#1F2937">5. Bilingual STT</text>
    <text x="45" y="106" text-anchor="middle" font-size="9" font-weight="600" fill="#6B7280">WHISPER / GOOGLE</text>
  </g>

  <!-- Arrow 5 -> Downward Loop to AI Engines -->
  <line x1="670" y1="150" x2="710" y2="150" stroke="#1F2937" stroke-width="2.2"/>
  <line x1="710" y1="150" x2="710" y2="280" stroke="#1F2937" stroke-width="2.2"/>
  <line x1="710" y1="280" x2="675" y2="280" stroke="#1F2937" stroke-width="2.2"/>
  <polygon points="679,276 671,280 679,284" fill="#1F2937"/>

  <!-- Step 6: Multi-Tier Hybrid LLM (Groq / Gemini / RAG) -->
  <g transform="translate(580, 245)">
    <rect width="90" height="70" rx="12" fill="#FFFFFF" stroke="#8B5CF6" stroke-width="2"/>
    <circle cx="45" cy="35" r="16" fill="none" stroke="#8B5CF6" stroke-width="2"/>
    <circle cx="37" cy="31" r="3" fill="#8B5CF6"/>
    <circle cx="53" cy="31" r="3" fill="#8B5CF6"/>
    <circle cx="45" cy="43" r="3" fill="#8B5CF6"/>
    <line x1="37" y1="31" x2="45" y2="43" stroke="#8B5CF6" stroke-width="1.5"/>
    <line x1="53" y1="31" x2="45" y2="43" stroke="#8B5CF6" stroke-width="1.5"/>
    <text x="45" y="92" text-anchor="middle" font-size="11" font-weight="700" fill="#1F2937">6. Hybrid AI LLM</text>
    <text x="45" y="106" text-anchor="middle" font-size="9" font-weight="600" fill="#8B5CF6">GROQ / GEMINI RAG</text>
  </g>

  <!-- Arrow 6 -> 7 (Going left) -->
  <line x1="580" y1="280" x2="540" y2="280" stroke="#1F2937" stroke-width="2.2"/>
  <polygon points="544,276 536,280 544,284" fill="#1F2937"/>

  <!-- Step 7: EdgeTTS Synthesis -->
  <g transform="translate(445, 245)">
    <rect width="90" height="70" rx="12" fill="#FFFFFF" stroke="#DCD5C6" stroke-width="1.5"/>
    <polygon points="32,28 38,28 48,20 48,50 38,42 32,42" fill="none" stroke="#1F2937" stroke-width="2"/>
    <path d="M54 28 A8 8 0 0 1 54 42" fill="none" stroke="#1F2937" stroke-width="2" stroke-linecap="round"/>
    <path d="M59 22 A16 16 0 0 1 59 48" fill="none" stroke="#1F2937" stroke-width="2" stroke-linecap="round"/>
    <text x="45" y="92" text-anchor="middle" font-size="11" font-weight="700" fill="#1F2937">7. EdgeTTS Audio</text>
    <text x="45" y="106" text-anchor="middle" font-size="9" font-weight="600" fill="#6B7280">HOAI MY / JENNY</text>
  </g>

  <!-- Arrow 7 -> 8 (Going left) -->
  <line x1="445" y1="280" x2="405" y2="280" stroke="#1F2937" stroke-width="2.2"/>
  <polygon points="409,276 401,280 409,284" fill="#1F2937"/>

  <!-- Step 8: Recommendation Screen & Audio Out -->
  <g transform="translate(310, 245)">
    <rect width="90" height="70" rx="12" fill="#FFFFFF" stroke="#DCD5C6" stroke-width="1.5"/>
    <rect x="25" y="20" width="40" height="30" rx="3" fill="none" stroke="#1F2937" stroke-width="2"/>
    <polygon points="45,26 47,33 54,33 49,38 51,45 45,41 39,45 41,38 36,33 43,33" fill="#d97706"/>
    <text x="45" y="92" text-anchor="middle" font-size="11" font-weight="700" fill="#1F2937">8. Recommend</text>
    <text x="45" y="106" text-anchor="middle" font-size="9" font-weight="600" fill="#d97706">SHOW MENU &amp; TTS</text>
  </g>

  <!-- Arrow 8 -> 9 (Going left) -->
  <line x1="310" y1="280" x2="270" y2="280" stroke="#1F2937" stroke-width="2.2"/>
  <polygon points="274,276 266,280 274,284" fill="#1F2937"/>

  <!-- Step 9: 5-Star Feedback Survey -->
  <g transform="translate(175, 245)">
    <rect width="90" height="70" rx="12" fill="#FFFFFF" stroke="#10b981" stroke-width="1.8"/>
    <path d="M30 46 V32 M30 32 L40 22 C42 20 45 21 45 24 L43 32 H56 C59 32 60 35 58 38 L54 46 H30 Z" fill="none" stroke="#10b981" stroke-width="2"/>
    <text x="45" y="92" text-anchor="middle" font-size="11" font-weight="700" fill="#1F2937">9. Star Rating</text>
    <text x="45" y="106" text-anchor="middle" font-size="9" font-weight="600" fill="#10b981">1-5 STAR SURVEY</text>
  </g>

  <!-- Arrow 9 -> 10 -->
  <line x1="175" y1="280" x2="135" y2="280" stroke="#1F2937" stroke-width="2.2"/>
  <polygon points="139,276 131,280 139,284" fill="#1F2937"/>

  <!-- Step 10: Auto-Reset Standby -->
  <g transform="translate(40, 245)">
    <rect width="90" height="70" rx="12" fill="#FFFFFF" stroke="#DCD5C6" stroke-width="1.5"/>
    <path d="M30 46 V32 L45 20 L60 32 V46 H50 V36 H40 V46 Z" fill="none" stroke="#1F2937" stroke-width="2"/>
    <text x="45" y="92" text-anchor="middle" font-size="11" font-weight="700" fill="#1F2937">10. Standby</text>
    <text x="45" y="106" text-anchor="middle" font-size="9" font-weight="600" fill="#6B7280">15s TIMEOUT IDLE</text>
  </g>
</svg>

---

## 3. WF-03: Guest Service Request Handling & Department Dispatch Flow (Re Nhanh PIN vs. No-PIN)

<svg viewBox="0 0 1060 560" width="100%" height="auto" xmlns="http://www.w3.org/2000/svg" style="background:#F7F4EE; border-radius:18px; border:1.5px solid #E2DBD0; font-family:'Plus Jakarta Sans', -apple-system, sans-serif;">
  <text x="40" y="42" font-size="22" font-weight="900" fill="#1F2937">Core WorkFlows:</text>
  <text x="40" y="70" font-size="16" font-weight="600" fill="#4B5563">WF-03: Service Request Handling — PIN Required vs. No-PIN Routing Flow</text>

  <!-- Step 1: Select Service (Common Start) -->
  <g transform="translate(35, 230)">
    <rect width="95" height="74" rx="14" fill="#FFFFFF" stroke="#DCD5C6" stroke-width="1.5"/>
    <path d="M25 45 H70 M30 45 A18 18 0 0 1 65 45" fill="none" stroke="#1F2937" stroke-width="2.2"/>
    <circle cx="47" cy="27" r="2.5" fill="#1F2937"/>
    <text x="47" y="95" text-anchor="middle" font-size="11" font-weight="700" fill="#1F2937">1. Select Service</text>
    <text x="47" y="109" text-anchor="middle" font-size="9" font-weight="600" fill="#6B7280">MENU OR VOICE</text>
  </g>

  <!-- Fork Arrows (Center to Top & Bottom) -->
  <line x1="130" y1="267" x2="160" y2="267" stroke="#1F2937" stroke-width="2.5"/>
  <line x1="160" y1="152" x2="160" y2="412" stroke="#1F2937" stroke-width="2.5"/>
  
  <!-- Arrow going Up to PIN Required Branch -->
  <line x1="160" y1="152" x2="185" y2="152" stroke="#1F2937" stroke-width="2.5"/>
  <polygon points="181,147 191,152 181,157" fill="#1F2937"/>

  <!-- Arrow going Down to No-PIN Branch -->
  <line x1="160" y1="412" x2="185" y2="412" stroke="#1F2937" stroke-width="2.5"/>
  <polygon points="181,407 191,412 181,417" fill="#1F2937"/>

  <!-- ==================== TOP BRANCH: REQUIRES ROOM PIN ==================== -->
  <!-- Top Branch Badge -->
  <g transform="translate(195, 88)">
    <rect width="470" height="22" rx="6" fill="#FEF3C7" stroke="#F59E0B" stroke-width="1"/>
    <text x="12" y="15" font-size="10" font-weight="800" fill="#B45309">CO HOI MA PIN: Room Service, Taxi Booking, Maintenance, Bellman Services</text>
  </g>

  <!-- Step 2A: Room Picker Modal -->
  <g transform="translate(195, 117)">
    <rect width="90" height="70" rx="12" fill="#FFFFFF" stroke="#DCD5C6" stroke-width="1.5"/>
    <rect x="25" y="20" width="40" height="30" rx="3" fill="none" stroke="#1F2937" stroke-width="2"/>
    <circle cx="34" cy="35" r="2" fill="#1F2937"/>
    <line x1="45" y1="20" x2="45" y2="50" stroke="#1F2937" stroke-width="1.5"/>
    <text x="45" y="92" text-anchor="middle" font-size="11" font-weight="700" fill="#1F2937">2A. Room Picker</text>
    <text x="45" y="106" text-anchor="middle" font-size="9" font-weight="600" fill="#10b981">TOUCH-FIRST GRID</text>
  </g>

  <line x1="285" y1="152" x2="315" y2="152" stroke="#1F2937" stroke-width="2.2"/>
  <polygon points="311,148 319,152 311,156" fill="#1F2937"/>

  <!-- Step 3A: Room PIN Modal -->
  <g transform="translate(325, 117)">
    <rect width="90" height="70" rx="12" fill="#FFFFFF" stroke="#DCD5C6" stroke-width="1.5"/>
    <rect x="25" y="20" width="40" height="30" rx="4" fill="none" stroke="#1F2937" stroke-width="2"/>
    <circle cx="33" cy="28" r="2" fill="#1F2937"/>
    <circle cx="45" cy="28" r="2" fill="#1F2937"/>
    <circle cx="57" cy="28" r="2" fill="#1F2937"/>
    <circle cx="33" cy="38" r="2" fill="#1F2937"/>
    <circle cx="45" cy="38" r="2" fill="#1F2937"/>
    <circle cx="57" cy="38" r="2" fill="#1F2937"/>
    <text x="45" y="92" text-anchor="middle" font-size="11" font-weight="700" fill="#1F2937">3A. Room PIN</text>
    <text x="45" y="106" text-anchor="middle" font-size="9" font-weight="600" fill="#10b981">10-KEYPAD PIN</text>
  </g>

  <line x1="415" y1="152" x2="445" y2="152" stroke="#1F2937" stroke-width="2.2"/>
  <polygon points="441,148 449,152 441,156" fill="#1F2937"/>

  <!-- Step 4A: Room Session Authenticated -->
  <g transform="translate(455, 117)">
    <rect width="90" height="70" rx="12" fill="#FFFFFF" stroke="#10b981" stroke-width="1.8"/>
    <circle cx="45" cy="35" r="15" fill="none" stroke="#10b981" stroke-width="2"/>
    <polyline points="37,35 43,41 53,29" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="45" y="92" text-anchor="middle" font-size="11" font-weight="700" fill="#1F2937">4A. Session Auth</text>
    <text x="45" y="106" text-anchor="middle" font-size="9" font-weight="600" fill="#10b981">ROOM PIN OK</text>
  </g>

  <line x1="545" y1="152" x2="575" y2="152" stroke="#1F2937" stroke-width="2.2"/>
  <polygon points="571,148 579,152 571,156" fill="#1F2937"/>

  <!-- Step 5A: 4 Department Services -->
  <g transform="translate(585, 117)">
    <rect width="145" height="70" rx="12" fill="#FFFFFF" stroke="#DCD5C6" stroke-width="1.5"/>
    <path d="M18 36 H38 M21 36 A8 8 0 0 1 35 36" fill="none" stroke="#1F2937" stroke-width="1.5"/>
    <rect x="48" y="27" width="22" height="9" rx="2" fill="none" stroke="#1F2937" stroke-width="1.5"/>
    <circle cx="53" cy="37" r="1.5" fill="#1F2937"/><circle cx="65" cy="37" r="1.5" fill="#1F2937"/>
    <path d="M83 38 L93 28 M93 28 L97 32" stroke="#1F2937" stroke-width="1.5" stroke-linecap="round"/>
    <rect x="110" y="26" width="18" height="13" rx="2" fill="none" stroke="#1F2937" stroke-width="1.5"/>
    <path d="M116 26 V22 H122 V26" fill="none" stroke="#1F2937" stroke-width="1.5"/>
    <circle cx="114" cy="40" r="1.5" fill="#1F2937"/><circle cx="124" cy="40" r="1.5" fill="#1F2937"/>
    <text x="72" y="92" text-anchor="middle" font-size="11" font-weight="700" fill="#1F2937">5A. 4 Dept Services</text>
    <text x="72" y="106" text-anchor="middle" font-size="9" font-weight="600" fill="#6B7280">ROOM · TAXI · FIX · BELL</text>
  </g>

  <line x1="730" y1="152" x2="760" y2="152" stroke="#1F2937" stroke-width="2.2"/>
  <polygon points="756,148 764,152 756,156" fill="#1F2937"/>

  <!-- Step 6A: Ticket Dispatch -->
  <g transform="translate(770, 117)">
    <rect width="105" height="70" rx="12" fill="#FFFFFF" stroke="#DCD5C6" stroke-width="1.5"/>
    <rect x="30" y="18" width="45" height="34" rx="3" fill="none" stroke="#1F2937" stroke-width="2"/>
    <path d="M42 18 V14 H63 V18" fill="none" stroke="#1F2937" stroke-width="1.8"/>
    <line x1="38" y1="28" x2="67" y2="28" stroke="#2563EB" stroke-width="2"/>
    <line x1="38" y1="36" x2="58" y2="36" stroke="#2563EB" stroke-width="2"/>
    <text x="52" y="92" text-anchor="middle" font-size="11" font-weight="700" fill="#1F2937">6A. Ticket Dispatch</text>
    <text x="52" y="106" text-anchor="middle" font-size="9" font-weight="600" fill="#2563EB">STATUS: NEW &gt; ACTIVE</text>
  </g>

  <line x1="875" y1="152" x2="905" y2="152" stroke="#1F2937" stroke-width="2.2"/>
  <polygon points="901,148 909,152 901,156" fill="#1F2937"/>

  <!-- Step 7A: Staff Complete & Notify -->
  <g transform="translate(915, 117)">
    <rect width="105" height="70" rx="12" fill="#FFFFFF" stroke="#10b981" stroke-width="2"/>
    <circle cx="52" cy="35" r="16" fill="none" stroke="#10b981" stroke-width="2"/>
    <polyline points="44,35 50,41 60,29" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="52" y="92" text-anchor="middle" font-size="11" font-weight="700" fill="#1F2937">7A. Fulfill &amp; Notify</text>
    <text x="52" y="106" text-anchor="middle" font-size="9" font-weight="600" fill="#10b981">STATUS: COMPLETED</text>
  </g>

  <!-- ==================== BOTTOM BRANCH: NO PIN REQUIRED ==================== -->
  <!-- Bottom Branch Badge -->
  <g transform="translate(195, 345)">
    <rect width="470" height="22" rx="6" fill="#E0F2FE" stroke="#0284C7" stroke-width="1"/>
    <text x="12" y="15" font-size="10" font-weight="800" fill="#0369A1">KHONG CAN MA PIN: Recommendation Service &amp; Hotel Information</text>
  </g>

  <!-- Step 2B: Direct Public Access -->
  <g transform="translate(195, 375)">
    <rect width="90" height="70" rx="12" fill="#FFFFFF" stroke="#DCD5C6" stroke-width="1.5"/>
    <rect x="30" y="28" width="30" height="22" rx="3" fill="none" stroke="#1F2937" stroke-width="2"/>
    <path d="M38 28 V20 A7 7 0 0 1 52 20" fill="none" stroke="#10b981" stroke-width="2.2"/>
    <text x="45" y="92" text-anchor="middle" font-size="11" font-weight="700" fill="#1F2937">2B. Direct Access</text>
    <text x="45" y="106" text-anchor="middle" font-size="9" font-weight="600" fill="#10b981">NO PIN NEEDED</text>
  </g>

  <line x1="285" y1="410" x2="320" y2="410" stroke="#1F2937" stroke-width="2.2"/>
  <polygon points="316,406 324,410 316,414" fill="#1F2937"/>

  <!-- Step 3B: Recommendation & Info Selection -->
  <g transform="translate(330, 375)">
    <rect width="145" height="70" rx="12" fill="#FFFFFF" stroke="#DCD5C6" stroke-width="1.5"/>
    <polygon points="40,22 42,28 48,28 43,32 45,38 40,34 35,38 37,32 32,28 38,28" fill="#d97706"/>
    <circle cx="105" cy="30" r="10" fill="none" stroke="#0284C7" stroke-width="2"/>
    <line x1="105" y1="28" x2="105" y2="35" stroke="#0284C7" stroke-width="2"/>
    <circle cx="105" cy="24" r="1" fill="#0284C7"/>
    <text x="72" y="92" text-anchor="middle" font-size="11" font-weight="700" fill="#1F2937">3B. Choose Category</text>
    <text x="72" y="106" text-anchor="middle" font-size="9" font-weight="600" fill="#0284C7">RECOMMEND / INFO</text>
  </g>

  <line x1="475" y1="410" x2="510" y2="410" stroke="#1F2937" stroke-width="2.2"/>
  <polygon points="506,406 514,410 506,414" fill="#1F2937"/>

  <!-- Step 4B: Instant RAG Search -->
  <g transform="translate(520, 375)">
    <rect width="140" height="70" rx="12" fill="#FFFFFF" stroke="#DCD5C6" stroke-width="1.5"/>
    <ellipse cx="70" cy="24" rx="16" ry="5" fill="none" stroke="#1F2937" stroke-width="1.8"/>
    <path d="M54 24 V42 C54 45 70 47 86 42 V24" fill="none" stroke="#1F2937" stroke-width="1.8"/>
    <path d="M54 33 C54 36 70 38 86 33" fill="none" stroke="#1F2937" stroke-width="1.8"/>
    <text x="70" y="92" text-anchor="middle" font-size="11" font-weight="700" fill="#1F2937">4B. Instant RAG Search</text>
    <text x="70" y="106" text-anchor="middle" font-size="9" font-weight="600" fill="#6B7280">FACTSHEET &lt; 300ms</text>
  </g>

  <line x1="660" y1="410" x2="695" y2="410" stroke="#1F2937" stroke-width="2.2"/>
  <polygon points="691,406 699,410 691,414" fill="#1F2937"/>

  <!-- Step 5B: Display Cards & EdgeTTS -->
  <g transform="translate(705, 375)">
    <rect width="135" height="70" rx="12" fill="#FFFFFF" stroke="#DCD5C6" stroke-width="1.5"/>
    <rect x="25" y="20" width="36" height="26" rx="3" fill="none" stroke="#1F2937" stroke-width="2"/>
    <polygon points="80,26 84,26 90,20 90,42 84,36 80,36" fill="none" stroke="#1F2937" stroke-width="1.8"/>
    <path d="M94,26 A6 6 0 0 1 94,36" fill="none" stroke="#1F2937" stroke-width="1.8" stroke-linecap="round"/>
    <text x="67" y="92" text-anchor="middle" font-size="11" font-weight="700" fill="#1F2937">5B. Display &amp; Voice</text>
    <text x="67" y="106" text-anchor="middle" font-size="9" font-weight="600" fill="#6B7280">UI CARDS &amp; EDGETTS</text>
  </g>

  <line x1="840" y1="410" x2="875" y2="410" stroke="#1F2937" stroke-width="2.2"/>
  <polygon points="871,406 879,410 871,414" fill="#1F2937"/>

  <!-- Step 6B: Direct Fulfillment (Zero Ticket Overhead) -->
  <g transform="translate(885, 375)">
    <rect width="135" height="70" rx="12" fill="#FFFFFF" stroke="#10b981" stroke-width="2"/>
    <polyline points="48,34 56,42 74,24" fill="none" stroke="#10b981" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="67" y="92" text-anchor="middle" font-size="11" font-weight="700" fill="#1F2937">6B. Instant Fulfillment</text>
    <text x="67" y="106" text-anchor="middle" font-size="9" font-weight="600" fill="#10b981">ZERO TICKET OVERHEAD</text>
  </g>
</svg>

---

## 4. WF-04: Robot-to-Human Handoff Flow (Chuan Kien Truc Nhu Trong Hinh)

<svg viewBox="0 0 1040 500" width="100%" height="auto" xmlns="http://www.w3.org/2000/svg" style="background:#F7F4EE; border-radius:18px; border:1.5px solid #E2DBD0; font-family:'Plus Jakarta Sans', -apple-system, sans-serif;">
  <text x="40" y="42" font-size="22" font-weight="900" fill="#1F2937">Core WorkFlows:</text>
  <text x="40" y="70" font-size="16" font-weight="600" fill="#4B5563">Robot-to-Human Handoff Flow (Live Screen WebRTC Call &amp; Real-time Translation)</text>

  <!-- Step 1: Normal Communicate -->
  <g transform="translate(40, 160)">
    <rect width="100" height="76" rx="14" fill="#FFFFFF" stroke="#DCD5C6" stroke-width="1.5"/>
    <path d="M28 22 H64 A4 4 0 0 1 68 26 V44 A4 4 0 0 1 64 48 H40 L30 56 V48 H28 A4 4 0 0 1 24 44 V26 A4 4 0 0 1 28 22 Z" fill="#1F2937"/>
    <text x="50" y="98" text-anchor="middle" font-size="12" font-weight="700" fill="#1F2937">Normal Communicate</text>
    <text x="50" y="112" text-anchor="middle" font-size="10" font-weight="600" fill="#6B7280" letter-spacing="1">COMMUNICATE</text>
  </g>

  <!-- Fork Arrows from Step 1 -->
  <line x1="140" y1="198" x2="180" y2="198" stroke="#1F2937" stroke-width="2.5"/>
  <line x1="180" y1="135" x2="180" y2="265" stroke="#1F2937" stroke-width="2.5"/>
  <line x1="180" y1="135" x2="225" y2="135" stroke="#1F2937" stroke-width="2.5"/>
  <polygon points="221,130 231,135 221,140" fill="#1F2937"/>
  <line x1="180" y1="265" x2="225" y2="265" stroke="#1F2937" stroke-width="2.5"/>
  <polygon points="221,260 231,265 221,270" fill="#1F2937"/>

  <!-- Branch 1: Guest request to talk to staff -->
  <g transform="translate(240, 95)">
    <rect width="140" height="76" rx="14" fill="#FFFFFF" stroke="#DCD5C6" stroke-width="1.5"/>
    <path d="M35 38 L45 38 L60 50 L60 26 L45 38 L35 38 Z" fill="#1F2937"/>
    <path d="M68 30 A8 8 0 0 1 68 46" fill="none" stroke="#1F2937" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M74 24 A15 15 0 0 1 74 52" fill="none" stroke="#1F2937" stroke-width="2.5" stroke-linecap="round"/>
    <text x="70" y="98" text-anchor="middle" font-size="11" font-weight="700" fill="#1F2937">Guest request to</text>
    <text x="70" y="112" text-anchor="middle" font-size="11" font-weight="700" fill="#1F2937">talk to staff</text>
  </g>

  <!-- Branch 2: Robot detect guest's bad expression -->
  <g transform="translate(240, 225)">
    <rect width="140" height="76" rx="14" fill="#FFFFFF" stroke="#DCD5C6" stroke-width="1.5"/>
    <!-- Expressive Robot Eyes Box with Purple Border -->
    <rect x="25" y="16" width="90" height="44" rx="8" fill="#FFFFFF" stroke="#8B5CF6" stroke-width="2.5"/>
    <ellipse cx="50" cy="38" rx="10" ry="13" fill="none" stroke="#1F2937" stroke-width="2"/>
    <circle cx="52" cy="40" r="5" fill="#1F2937"/>
    <circle cx="50" cy="36" r="1.5" fill="#FFFFFF"/>
    <ellipse cx="80" cy="38" rx="10" ry="13" fill="none" stroke="#1F2937" stroke-width="2"/>
    <circle cx="78" cy="40" r="5" fill="#1F2937"/>
    <circle cx="80" cy="36" r="1.5" fill="#FFFFFF"/>
    <path d="M40 24 Q50 20 56 24" fill="none" stroke="#8B5CF6" stroke-width="2"/>
    <path d="M90 24 Q80 20 74 24" fill="none" stroke="#8B5CF6" stroke-width="2"/>
    <text x="70" y="98" text-anchor="middle" font-size="11" font-weight="700" fill="#1F2937">Robot detect guest's</text>
    <text x="70" y="112" text-anchor="middle" font-size="11" font-weight="700" fill="#1F2937">bad expression</text>
  </g>

  <!-- Converging arrows from branches -->
  <line x1="380" y1="135" x2="425" y2="135" stroke="#1F2937" stroke-width="2.5"/>
  <line x1="380" y1="265" x2="425" y2="265" stroke="#1F2937" stroke-width="2.5"/>
  <line x1="425" y1="135" x2="425" y2="265" stroke="#1F2937" stroke-width="2.5"/>
  <line x1="425" y1="198" x2="480" y2="198" stroke="#1F2937" stroke-width="2.5"/>
  <polygon points="476,193 486,198 476,203" fill="#1F2937"/>

  <!-- Step 3: Robot alert staff -->
  <g transform="translate(495, 160)">
    <rect width="110" height="76" rx="14" fill="#FFFFFF" stroke="#DCD5C6" stroke-width="1.5"/>
    <path d="M55 24 A12 12 0 0 0 43 36 C43 43 39 46 39 46 L71 46 C71 46 67 43 67 36 A12 12 0 0 0 55 24 Z" fill="none" stroke="#1F2937" stroke-width="2.5"/>
    <path d="M51 50 A4 4 0 0 0 59 50" fill="none" stroke="#1F2937" stroke-width="2.5"/>
    <circle cx="55" cy="21" r="2.5" fill="#1F2937"/>
    <line x1="33" y1="28" x2="36" y2="31" stroke="#1F2937" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="77" y1="28" x2="74" y2="31" stroke="#1F2937" stroke-width="2.5" stroke-linecap="round"/>
    <text x="55" y="98" text-anchor="middle" font-size="12" font-weight="700" fill="#1F2937">Robot alert staff</text>
    <text x="55" y="112" text-anchor="middle" font-size="10" font-weight="600" fill="#6B7280">WS call_request</text>
  </g>

  <!-- Arrow from Step 3 to Step 4 -->
  <line x1="605" y1="198" x2="665" y2="198" stroke="#1F2937" stroke-width="2.5"/>
  <polygon points="661,193 671,198 661,203" fill="#1F2937"/>

  <!-- Step 4: Wait for staff to pick up the call -->
  <g transform="translate(680, 160)">
    <rect width="130" height="76" rx="14" fill="#FFFFFF" stroke="#DCD5C6" stroke-width="1.5"/>
    <polygon points="45 25, 75 25, 60 41, 75 57, 45 57, 60 41" fill="none" stroke="#1F2937" stroke-width="2.5"/>
    <line x1="40" y1="25" x2="80" y2="25" stroke="#1F2937" stroke-width="3"/>
    <line x1="40" y1="57" x2="80" y2="57" stroke="#1F2937" stroke-width="3"/>
    <text x="65" y="98" text-anchor="middle" font-size="11" font-weight="700" fill="#1F2937">Wait for staff to</text>
    <text x="65" y="112" text-anchor="middle" font-size="11" font-weight="700" fill="#1F2937">pick up the call</text>
  </g>

  <!-- Arrow DOWN from Step 4 to Step 5 -->
  <line x1="745" y1="236" x2="745" y2="340" stroke="#1F2937" stroke-width="2.5"/>
  <polygon points="740,336 745,346 750,336" fill="#1F2937"/>

  <!-- Step 5: Communicate through robot's screen -->
  <g transform="translate(660, 350)">
    <rect width="170" height="76" rx="14" fill="#FFFFFF" stroke="#DCD5C6" stroke-width="1.5"/>
    <path d="M30 26 H48 A3 3 0 0 1 51 29 V39 A3 3 0 0 1 48 42 H38 L32 48 V42 H30 A3 3 0 0 1 27 39 V29 A3 3 0 0 1 30 26 Z" fill="#1F2937"/>
    <rect x="65" y="24" width="36" height="26" rx="5" fill="none" stroke="#2563EB" stroke-width="2.5"/>
    <line x1="83" y1="16" x2="83" y2="24" stroke="#2563EB" stroke-width="2"/>
    <circle cx="83" cy="15" r="2" fill="#2563EB"/>
    <circle cx="75" cy="34" r="2.5" fill="#2563EB"/>
    <circle cx="91" cy="34" r="2.5" fill="#2563EB"/>
    <line x1="75" y1="42" x2="91" y2="42" stroke="#2563EB" stroke-width="2" stroke-linecap="round"/>
    <text x="85" y="98" text-anchor="middle" font-size="11" font-weight="700" fill="#1F2937">Communicate</text>
    <text x="85" y="112" text-anchor="middle" font-size="11" font-weight="700" fill="#1F2937">through robot's screen</text>
  </g>

  <!-- Arrow LEFT from Step 5 to Step 6 -->
  <line x1="660" y1="388" x2="550" y2="388" stroke="#1F2937" stroke-width="2.5"/>
  <polygon points="554,383 544,388 554,393" fill="#1F2937"/>

  <!-- Step 6: Translate when speaking (English, VN) -->
  <g transform="translate(370, 350)">
    <rect width="165" height="76" rx="14" fill="#FFFFFF" stroke="#4F46E5" stroke-width="2"/>
    <text x="50" y="46" font-size="34" font-weight="900" font-family="'Times New Roman', serif" fill="#1F2937">文</text>
    <text x="75" y="50" font-size="28" font-weight="800" font-family="sans-serif" fill="#4F46E5">A</text>
    <path d="M95 32 L105 32 M101 28 L105 32 L101 36" stroke="#4F46E5" stroke-width="2" stroke-linecap="round"/>
    <path d="M105 44 L95 44 M99 40 L95 44 L99 48" stroke="#1F2937" stroke-width="2" stroke-linecap="round"/>
    <text x="82" y="98" text-anchor="middle" font-size="11" font-weight="700" fill="#1F2937">Translate when speaking</text>
    <text x="82" y="112" text-anchor="middle" font-size="10" font-weight="700" fill="#4F46E5">(English, VN)</text>
  </g>
</svg>

---

## 5. WF-05: Autonomous Navigation & Waypoint Escort Flow

<svg viewBox="0 0 1040 500" width="100%" height="auto" xmlns="http://www.w3.org/2000/svg" style="background:#F7F4EE; border-radius:18px; border:1.5px solid #E2DBD0; font-family:'Plus Jakarta Sans', -apple-system, sans-serif;">
  <text x="40" y="42" font-size="22" font-weight="900" fill="#1F2937">Core WorkFlows:</text>
  <text x="40" y="70" font-size="16" font-weight="600" fill="#4B5563">WF-05: Waypoint Escort, Nav2 Trajectory, LiDAR Obstacle Avoidance &amp; Standby Return</text>

  <!-- Step 1: Guest Asks for Escort -->
  <g transform="translate(40, 115)">
    <rect width="90" height="70" rx="12" fill="#FFFFFF" stroke="#DCD5C6" stroke-width="1.5"/>
    <circle cx="45" cy="28" r="10" fill="none" stroke="#1F2937" stroke-width="2"/>
    <circle cx="45" cy="28" r="4" fill="#1F2937"/>
    <path d="M45 38 L45 52 M37 52 H53" stroke="#1F2937" stroke-width="2.2" stroke-linecap="round"/>
    <text x="45" y="92" text-anchor="middle" font-size="11" font-weight="700" fill="#1F2937">1. Ask Escort</text>
    <text x="45" y="106" text-anchor="middle" font-size="9" font-weight="600" fill="#6B7280">"DAN TOI THANG MAY"</text>
  </g>

  <!-- Arrow 1 -> 2 -->
  <line x1="130" y1="150" x2="165" y2="150" stroke="#1F2937" stroke-width="2.2"/>
  <polygon points="161,146 169,150 161,154" fill="#1F2937"/>

  <!-- Step 2: Waypoint Lookup & Announce -->
  <g transform="translate(175, 115)">
    <rect width="90" height="70" rx="12" fill="#FFFFFF" stroke="#DCD5C6" stroke-width="1.5"/>
    <polygon points="32,28 38,28 48,20 48,50 38,42 32,42" fill="none" stroke="#1F2937" stroke-width="2"/>
    <path d="M54 28 A8 8 0 0 1 54 42" fill="none" stroke="#1F2937" stroke-width="2" stroke-linecap="round"/>
    <text x="45" y="92" text-anchor="middle" font-size="11" font-weight="700" fill="#1F2937">2. Speak &amp; Map</text>
    <text x="45" y="106" text-anchor="middle" font-size="9" font-weight="600" fill="#6B7280">"DI CUNG TOI"</text>
  </g>

  <!-- Arrow 2 -> 3 -->
  <line x1="265" y1="150" x2="300" y2="150" stroke="#1F2937" stroke-width="2.2"/>
  <polygon points="296,146 304,150 296,154" fill="#1F2937"/>

  <!-- Step 3: Nav2 Action Server Goal -->
  <g transform="translate(310, 115)">
    <rect width="90" height="70" rx="12" fill="#FFFFFF" stroke="#DCD5C6" stroke-width="1.5"/>
    <rect x="25" y="20" width="40" height="30" rx="4" fill="none" stroke="#1F2937" stroke-width="2"/>
    <path d="M35 35 Q45 25 55 35" fill="none" stroke="#2563EB" stroke-width="2.5"/>
    <polygon points="53,28 58,36 50,37" fill="#2563EB"/>
    <text x="45" y="92" text-anchor="middle" font-size="11" font-weight="700" fill="#1F2937">3. Nav2 Goal</text>
    <text x="45" y="106" text-anchor="middle" font-size="9" font-weight="600" fill="#2563EB">NavigateToPose</text>
  </g>

  <!-- Arrow 3 -> 4 -->
  <line x1="400" y1="150" x2="435" y2="150" stroke="#1F2937" stroke-width="2.2"/>
  <polygon points="431,146 439,150 431,154" fill="#1F2937"/>

  <!-- Step 4: Motor Driver & Safe Velocity -->
  <g transform="translate(445, 115)">
    <rect width="90" height="70" rx="12" fill="#FFFFFF" stroke="#DCD5C6" stroke-width="1.5"/>
    <circle cx="45" cy="35" r="16" fill="none" stroke="#1F2937" stroke-width="2"/>
    <circle cx="45" cy="35" r="6" fill="#1F2937"/>
    <text x="45" y="92" text-anchor="middle" font-size="11" font-weight="700" fill="#1F2937">4. cmd_vel Drive</text>
    <text x="45" y="106" text-anchor="middle" font-size="9" font-weight="600" fill="#6B7280">SPEED: 0.35 M/S</text>
  </g>

  <!-- Arrow 4 -> 5 -->
  <line x1="535" y1="150" x2="570" y2="150" stroke="#1F2937" stroke-width="2.2"/>
  <polygon points="566,146 574,150 566,154" fill="#1F2937"/>

  <!-- Step 5: 360 LiDAR & Ultrasonic Scanning -->
  <g transform="translate(580, 115)">
    <rect width="90" height="70" rx="12" fill="#FFFFFF" stroke="#DCD5C6" stroke-width="1.5"/>
    <circle cx="45" cy="35" r="16" fill="none" stroke="#1F2937" stroke-width="2"/>
    <line x1="45" y1="35" x2="57" y2="23" stroke="#dc2626" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M45 19 A16 16 0 0 1 61 35" fill="none" stroke="#dc2626" stroke-width="2" stroke-linecap="round"/>
    <text x="45" y="92" text-anchor="middle" font-size="11" font-weight="700" fill="#1F2937">5. LiDAR Scan</text>
    <text x="45" y="106" text-anchor="middle" font-size="9" font-weight="600" fill="#dc2626">360° RPLIDAR A1</text>
  </g>

  <!-- Fork lines to Obstacle / Clear paths -->
  <line x1="670" y1="150" x2="710" y2="150" stroke="#1F2937" stroke-width="2.2"/>
  <line x1="710" y1="150" x2="710" y2="210" stroke="#1F2937" stroke-width="2.2"/>
  <line x1="710" y1="210" x2="710" y2="280" stroke="#1F2937" stroke-width="2.2"/>
  <line x1="710" y1="210" x2="745" y2="210" stroke="#1F2937" stroke-width="2.2"/>
  <polygon points="741,206 749,210 741,214" fill="#1F2937"/>
  <line x1="710" y1="280" x2="745" y2="280" stroke="#1F2937" stroke-width="2.2"/>
  <polygon points="741,276 749,280 741,284" fill="#1F2937"/>

  <!-- Branch 6A: Dynamic Obstacle Detected -->
  <g transform="translate(755, 175)">
    <rect width="110" height="70" rx="12" fill="#FFFFFF" stroke="#dc2626" stroke-width="1.8"/>
    <polygon points="45,18 60,46 30,46" fill="none" stroke="#dc2626" stroke-width="2.2"/>
    <line x1="45" y1="28" x2="45" y2="38" stroke="#dc2626" stroke-width="2" stroke-linecap="round"/>
    <circle cx="45" cy="42" r="1" fill="#dc2626"/>
    <text x="55" y="92" text-anchor="middle" font-size="11" font-weight="700" fill="#dc2626">6A. Obstacle &lt;0.35m</text>
    <text x="55" y="106" text-anchor="middle" font-size="9" font-weight="600" fill="#dc2626">STOP / RETREAT</text>
  </g>

  <!-- Branch 6B: Clear Path -->
  <g transform="translate(755, 255)">
    <rect width="110" height="70" rx="12" fill="#FFFFFF" stroke="#10b981" stroke-width="1.8"/>
    <line x1="30" y1="35" x2="70" y2="35" stroke="#10b981" stroke-width="3" stroke-linecap="round"/>
    <polyline points="60,25 70,35 60,45" fill="none" stroke="#10b981" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="55" y="92" text-anchor="middle" font-size="11" font-weight="700" fill="#10b981">6B. Clear Path</text>
    <text x="55" y="106" text-anchor="middle" font-size="9" font-weight="600" fill="#10b981">NOMINAL DRIVE</text>
  </g>

  <!-- Converge lines to Step 7: Arrived -->
  <line x1="865" y1="210" x2="895" y2="210" stroke="#1F2937" stroke-width="2.2"/>
  <line x1="865" y1="280" x2="895" y2="280" stroke="#1F2937" stroke-width="2.2"/>
  <line x1="895" y1="210" x2="895" y2="280" stroke="#1F2937" stroke-width="2.2"/>
  <line x1="895" y1="245" x2="925" y2="245" stroke="#1F2937" stroke-width="2.2"/>
  <polygon points="921,241 929,245 921,249" fill="#1F2937"/>

  <!-- Step 7: Arrive & Farewell -->
  <g transform="translate(935, 210)">
    <rect width="90" height="70" rx="12" fill="#FFFFFF" stroke="#10b981" stroke-width="2"/>
    <path d="M35 48 V20 H65 L58 30 L65 40 H35" fill="none" stroke="#10b981" stroke-width="2.2"/>
    <text x="45" y="92" text-anchor="middle" font-size="11" font-weight="700" fill="#1F2937">7. Arrived Goal</text>
    <text x="45" y="106" text-anchor="middle" font-size="9" font-weight="600" fill="#10b981">DIST &lt; 0.25M</text>
  </g>
</svg>

---

## 6. WF-06: Fleet Telemetry Monitoring, Hardware Incident & Auto-Docking Flow

<svg viewBox="0 0 1040 500" width="100%" height="auto" xmlns="http://www.w3.org/2000/svg" style="background:#F7F4EE; border-radius:18px; border:1.5px solid #E2DBD0; font-family:'Plus Jakarta Sans', -apple-system, sans-serif;">
  <text x="40" y="42" font-size="22" font-weight="900" fill="#1F2937">Core WorkFlows:</text>
  <text x="40" y="70" font-size="16" font-weight="600" fill="#4B5563">WF-06: 2 Hz Telemetry Stream, Watchdog Anomaly Recovery &amp; Dual-Threshold Docking</text>

  <!-- Step 1: 2 Hz Telemetry Stream -->
  <g transform="translate(40, 115)">
    <rect width="90" height="70" rx="12" fill="#FFFFFF" stroke="#DCD5C6" stroke-width="1.5"/>
    <polyline points="20,35 30,35 36,22 44,48 52,24 58,35 70,35" fill="none" stroke="#1F2937" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="45" y="92" text-anchor="middle" font-size="11" font-weight="700" fill="#1F2937">1. 2 Hz Stream</text>
    <text x="45" y="106" text-anchor="middle" font-size="9" font-weight="600" fill="#6B7280">POSE / SPEED / PWR</text>
  </g>

  <!-- Arrow 1 -> 2 -->
  <line x1="130" y1="150" x2="165" y2="150" stroke="#1F2937" stroke-width="2.2"/>
  <polygon points="161,146 169,150 161,154" fill="#1F2937"/>

  <!-- Step 2: Admin Physical Map Tab -->
  <g transform="translate(175, 115)">
    <rect width="90" height="70" rx="12" fill="#FFFFFF" stroke="#DCD5C6" stroke-width="1.5"/>
    <rect x="25" y="20" width="40" height="30" rx="3" fill="none" stroke="#1F2937" stroke-width="2"/>
    <circle cx="45" cy="35" r="5" fill="#10b981"/>
    <line x1="45" y1="20" x2="45" y2="50" stroke="#1F2937" stroke-width="1.5"/>
    <line x1="25" y1="35" x2="65" y2="35" stroke="#1F2937" stroke-width="1.5"/>
    <text x="45" y="92" text-anchor="middle" font-size="11" font-weight="700" fill="#1F2937">2. Admin Map</text>
    <text x="45" y="106" text-anchor="middle" font-size="9" font-weight="600" fill="#10b981">CANVAS TRACKING</text>
  </g>

  <!-- Fork lines to 2 Anomaly Detection Branches -->
  <line x1="265" y1="150" x2="305" y2="150" stroke="#1F2937" stroke-width="2.2"/>
  <line x1="305" y1="150" x2="305" y2="230" stroke="#1F2937" stroke-width="2.2"/>
  <line x1="305" y1="150" x2="340" y2="150" stroke="#1F2937" stroke-width="2.2"/>
  <polygon points="336,146 344,150 336,154" fill="#1F2937"/>
  <line x1="305" y1="230" x2="340" y2="230" stroke="#1F2937" stroke-width="2.2"/>
  <polygon points="336,226 344,230 336,234" fill="#1F2937"/>

  <!-- Anomaly Branch 1: LiDAR Serial COM Timeout -->
  <g transform="translate(350, 115)">
    <rect width="110" height="70" rx="12" fill="#FFFFFF" stroke="#dc2626" stroke-width="1.8"/>
    <polygon points="45,18 65,18 75,28 75,44 65,54 45,54 35,44 35,28" fill="none" stroke="#dc2626" stroke-width="2"/>
    <line x1="55" y1="27" x2="55" y2="38" stroke="#dc2626" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="55" cy="45" r="1.5" fill="#dc2626"/>
    <text x="55" y="92" text-anchor="middle" font-size="11" font-weight="700" fill="#dc2626">3A. LiDAR Drop</text>
    <text x="55" y="106" text-anchor="middle" font-size="9" font-weight="600" fill="#dc2626">TIMEOUT &gt; 1.0s</text>
  </g>

  <!-- Arrow 3A -> 4A (Emergency Stop) -->
  <line x1="460" y1="150" x2="495" y2="150" stroke="#1F2937" stroke-width="2.2"/>
  <polygon points="491,146 499,150 491,154" fill="#1F2937"/>

  <!-- Step 4A: Hardware Watchdog Clamp PWM=0 -->
  <g transform="translate(505, 115)">
    <rect width="110" height="70" rx="12" fill="#FFFFFF" stroke="#dc2626" stroke-width="1.8"/>
    <rect x="35" y="24" width="40" height="24" rx="4" fill="#dc2626"/>
    <text x="55" y="40" text-anchor="middle" font-size="9" font-weight="800" fill="#FFFFFF">STOP</text>
    <text x="55" y="92" text-anchor="middle" font-size="11" font-weight="700" fill="#dc2626">4A. Clamp PWM=0</text>
    <text x="55" y="106" text-anchor="middle" font-size="9" font-weight="600" fill="#dc2626">EMERGENCY_STOP</text>
  </g>

  <!-- Anomaly Branch 2: Dual Battery Threshold Buffer -->
  <g transform="translate(350, 195)">
    <rect width="110" height="70" rx="12" fill="#FFFFFF" stroke="#d97706" stroke-width="1.8"/>
    <rect x="35" y="24" width="36" height="22" rx="3" fill="none" stroke="#d97706" stroke-width="2"/>
    <line x1="71" y1="30" x2="71" y2="40" stroke="#d97706" stroke-width="2.5" stroke-linecap="round"/>
    <rect x="39" y="28" width="10" height="14" fill="#d97706"/>
    <text x="55" y="92" text-anchor="middle" font-size="11" font-weight="700" fill="#d97706">3B. Battery &lt;= 20%</text>
    <text x="55" y="106" text-anchor="middle" font-size="9" font-weight="600" fill="#d97706">WARNING BUFFER</text>
  </g>

  <!-- Arrow 3B -> 4B -->
  <line x1="460" y1="230" x2="495" y2="230" stroke="#1F2937" stroke-width="2.2"/>
  <polygon points="491,226 499,230 491,234" fill="#1F2937"/>

  <!-- Step 4B: Block New Tasks & Apology TTS -->
  <g transform="translate(505, 195)">
    <rect width="110" height="70" rx="12" fill="#FFFFFF" stroke="#d97706" stroke-width="1.8"/>
    <circle cx="55" cy="35" r="14" fill="none" stroke="#d97706" stroke-width="2"/>
    <line x1="45" y1="25" x2="65" y2="45" stroke="#d97706" stroke-width="2"/>
    <text x="55" y="92" text-anchor="middle" font-size="11" font-weight="700" fill="#d97706">4B. Drain &amp; Block</text>
    <text x="55" y="106" text-anchor="middle" font-size="9" font-weight="600" fill="#d97706">YELLOW BANNER</text>
  </g>

  <!-- Converge lines to Step 5: Auto-Dock Navigation -->
  <line x1="615" y1="150" x2="650" y2="150" stroke="#1F2937" stroke-width="2.2"/>
  <line x1="615" y1="230" x2="650" y2="230" stroke="#1F2937" stroke-width="2.2"/>
  <line x1="650" y1="150" x2="650" y2="230" stroke="#1F2937" stroke-width="2.2"/>
  <line x1="650" y1="190" x2="685" y2="190" stroke="#1F2937" stroke-width="2.2"/>
  <polygon points="681,186 689,190 681,194" fill="#1F2937"/>

  <!-- Step 5: Route to Dock -->
  <g transform="translate(695, 155)">
    <rect width="90" height="70" rx="12" fill="#FFFFFF" stroke="#DCD5C6" stroke-width="1.5"/>
    <circle cx="45" cy="35" r="16" fill="none" stroke="#1F2937" stroke-width="2"/>
    <polyline points="37,35 45,27 53,35" fill="none" stroke="#1F2937" stroke-width="2"/>
    <line x1="45" y1="27" x2="45" y2="45" stroke="#1F2937" stroke-width="2"/>
    <text x="45" y="92" text-anchor="middle" font-size="11" font-weight="700" fill="#1F2937">5. Nav to Dock</text>
    <text x="45" y="106" text-anchor="middle" font-size="9" font-weight="600" fill="#6B7280">CHARGER_STATION</text>
  </g>

  <!-- Arrow 5 -> 6 -->
  <line x1="785" y1="190" x2="820" y2="190" stroke="#1F2937" stroke-width="2.2"/>
  <polygon points="816,186 824,190 816,194" fill="#1F2937"/>

  <!-- Step 6: Await Staff Plug -->
  <g transform="translate(830, 155)">
    <rect width="90" height="70" rx="12" fill="#FFFFFF" stroke="#DCD5C6" stroke-width="1.5"/>
    <rect x="30" y="24" width="30" height="22" rx="3" fill="none" stroke="#1F2937" stroke-width="2"/>
    <line x1="38" y1="16" x2="38" y2="24" stroke="#1F2937" stroke-width="2"/>
    <line x1="52" y1="16" x2="52" y2="24" stroke="#1F2937" stroke-width="2"/>
    <text x="45" y="92" text-anchor="middle" font-size="11" font-weight="700" fill="#1F2937">6. Await Plug</text>
    <text x="45" y="106" text-anchor="middle" font-size="9" font-weight="600" fill="#6B7280">STAFF PLUGS IN</text>
  </g>

  <!-- Arrow 6 -> 7 -->
  <line x1="920" y1="190" x2="955" y2="190" stroke="#1F2937" stroke-width="2.2"/>
  <polygon points="951,186 959,190 951,194" fill="#1F2937"/>

  <!-- Step 7: Hysteresis Guard Recharge >= 80% -->
  <g transform="translate(965, 155)">
    <rect width="90" height="70" rx="12" fill="#FFFFFF" stroke="#10b981" stroke-width="2"/>
    <polygon points="46,18 36,34 44,34 41,48 53,30 45,30" fill="none" stroke="#10b981" stroke-width="2.2" stroke-linejoin="round"/>
    <text x="45" y="92" text-anchor="middle" font-size="11" font-weight="700" fill="#1F2937">7. Recharge Loop</text>
    <text x="45" y="106" text-anchor="middle" font-size="9" font-weight="600" fill="#10b981">RESUME &gt;= 80%</text>
  </g>
</svg>
