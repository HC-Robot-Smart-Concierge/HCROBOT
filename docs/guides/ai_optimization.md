# HUONG DAN TOI UU TOC DO PHAN HOI CHO HE THONG AI (HC-ROBOT)

Tai lieu nay phan tich nguyen nhan gay tre (latency) trong he thong hien tai va huong dan cac giai phap ky thuat de giam thoi gian phan hoi giong noi tu 5 - 8 giay xuong duoi 1 giay, dua tren nguyen ly Streaming Pipeline cua cac he thong toc do cao nhu Xiaozhi ESP32.

---

## 1. PHAN TICH NGUYEN NHAN HE THONG BI CHAM (ROOT CAUSE ANALYSIS)

### 1.1. Hien trang he thong HC-Robot
He thong hien tai dang van hanh theo mo hinh **Chan tuan tu (Sequential Blocking)**:
1. Client cho nguoi dung dut loi hoan toan (VAD timeout 1.2s - 2.0s).
2. Gui toan bo doan van ban (Full Text) len Backend qua HTTP REST.
3. Backend chay RAG: Nao vector embedding bang model `bge-m3` vao ChromaDB (0.3s - 0.6s).
4. Goi Ollama: Cho Ollama sinh ra toan bo cau tra loi (Full String) moi tiep tuc (1.5s - 3.0s).
5. Goi EdgeTTS: Gui toan bo van ban len server Microsoft de render file MP3 hoan chinh (1.5s - 2.5s).
6. Ma hoa file MP3 sang Base64 va tra ve qua JSON response.
7. Client nhan toan bo chuoi Base64, decode va phat am thanh.

Tong thoi gian cho doi (End-to-End Latency): **4.5s den 8.0s**.

### 1.2. Mo hinh Xiaozhi ESP32 (Chuan can dat toi)
Xiaozhi ESP32 khong chay AI tren chip ma hoat dong nhu mot Audio Streaming Client chuyen dung:
- Mic thu am va nen Opus frame 60ms day lien tuc qua WebSocket/UDP len Cloud.
- Cloud ASR nhan dien theo thoi gian thuc voi VAD ngat cau cuc nhanh (200ms - 300ms).
- Cloud LLM hoac LLM manh sinh token theo stream (TTFT ~200ms).
- **Chunked TTS**: Vua sinh duoc 3 - 5 tu dau tien (hoac gap dau phay) la day ngay sang TTS stream de tao audio frame.
- Loa ESP32 phat am thanh ngay lap tuc sau khoang 700ms - 900ms tinh tu luc nguoi dung dut loi.

---

## 2. KIEN TRUC MUC TIEU (TARGET STREAMING PIPELINE)

Chuyen doi toan bo luong xu ly sang kien truc **Pipelining song song**:

```
[Nguoi dung noi]
       |
       v (VAD phat hien ngat loi trong 400ms)
[Client gui text/audio qua WebSocket]
       |
       v
[Backend goi Ollama Stream (stream=True)]
       |
       |--> Token 1, 2, 3...
       v
[Bo tach cau (Sentence/Clause Chunker)]
       |
       |--> Menh de dau tien: "Da em chao quy khach,"
       v
[TTS Service render ngay Chunk Audio 1]
       |
       v
[Client nhan chunk audio va PHAT LOA NGAY LAP TUC (< 1 giay)]
       |
       +--> Trong luc loa dang phat, Ollama tiep tuc sinh cac menh de tiep theo.
```

---

## 3. CAC BUOC TRIEN KHAI CHI TIET

### Buoc 1: Cau hinh Ollama Server tren Laptop

1. **Mo ket noi mang LAN (Expose to Network):**
   - Tren giao dien Ollama Settings: Bat switch `Expose Ollama to the network`.
   - Hoac tren bien moi truong Windows (System Environment Variables):
     - `OLLAMA_HOST=0.0.0.0:11434`
     - `OLLAMA_ORIGINS=*`
   - Muc dich: Cho phep Raspberry Pi 5 va thiet bi di dong trong mang LAN goi truc tiep vao Ollama tren Laptop.

2. **Giu model thuong truc tren RAM/VRAM:**
   - Trong code backend, truyen tham so `keep_alive=-1` de model khong bi giai phong sau 5 phut khong dung, tranh mat 2 - 4 giay load lai model o luot hoi tiep theo.

3. **Gioi han do dai sinh cau (num_predict):**
   - Doi voi bot giong noi, cau tra loi chi nen tu 20 - 35 tu.
   - Thiet lap `num_predict=40` de CPU/GPU dung sinh tu ngay khi du y, khong sinh lan man lam cham he thong.

---

### Buoc 2: Chuyen doi Ollama Service sang che do Streaming

Trong file `backend/app/services/ai/ollama_service.py`, thay the loi goi dong bo bang Async Generator:

```python
async def generate_response_stream(
    self,
    prompt: str,
    rag_context: Optional[str] = None,
    chat_history: Optional[List[Dict[str, str]]] = None,
):
    messages = [{"role": "system", "content": "..."}]
    if chat_history:
        messages.extend(chat_history)
    messages.append({"role": "user", "content": prompt})

    # Bat stream=True de nhan token theo thoi gian thuc
    response_stream = await self._client.chat(
        model=self.model,
        messages=messages,
        stream=True,
        options={
            "temperature": 0.5,
            "num_predict": 40,
            "num_ctx": 1024,
            "num_thread": 8,
        },
        keep_alive=-1
    )

    async for chunk in response_stream:
        token = chunk.get("message", {}).get("content", "")
        if token:
            yield token
```

---

### Buoc 3: Bo cat cau va tong hop giong noi tuc thi (Chunked TTS)

Thay vi doi Ollama sinh xong 100% van ban moi gui cho EdgeTTS, he thong gom cac tu theo tung menh de ngan nho bo tach regex:

1. **Quy tac ngat menh de:**
   - Cac ky tu ngat: `[.,!?:;\n]` hoac khi bo dem dat tu 5 den 8 tu.
2. **Logic bo dem (Buffer Pipeline):**

```python
import re

CLAUSE_DELIMITERS = re.compile(r"([,.;:!?\n]+)")

async def stream_text_to_audio_chunks(token_stream):
    buffer = ""
    async for token in token_stream:
        buffer += token
        parts = CLAUSE_DELIMITERS.split(buffer)
        
        # Neu co it nhat mot menh de hoan chinh
        if len(parts) > 1:
            clause = (parts[0] + parts[1]).strip()
            buffer = "".join(parts[2:]) # Giu lai phan chua ket thuc
            
            if clause:
                # Goi TTS tao audio cho rieng menh de nay
                audio_bytes = await tts_service.synthesize_raw(clause)
                yield audio_bytes

    # Xu ly phan con lai cuoi cung neu con sot
    if buffer.strip():
        audio_bytes = await tts_service.synthesize_raw(buffer.strip())
        yield audio_bytes
```

---

### Buoc 4: Loai bo Base64 MP3, chuyen sang WebSocket Audio Stream

1. **Khong dung Base64 qua HTTP REST:**
   - Base64 lam phinh to dung luong them 33%.
   - Giao thuc HTTP bat buoc phai dong goi toan bo noi dung trong 1 response, khong stream duoc am thanh da tang.
2. **Su dung kenh WebSocket co san (`/ws/pipecat`):**
   - Backend sinh xong chunk am thanh nao lap tuc day xuong WebSocket duoi dang Binary Frame.
   - Trinh duyet tren dien thoai dung `AudioContext` / `Web Audio API` de nap buffer va phat ghep noi tiep (Queue Audio Buffers). Nguoi dung se nghe thay tieng noi ngay lap tuc sau 600ms - 800ms.

---

### Buoc 5: Toi uu VAD va Speech-To-Text o phia Client (Dien thoai/Web)

Trinh duyet mac dinh thuong cho khoang lang 1.5s - 2.0s moi coi la nguoi dung da ngat cau.

1. **Neu dung Web Speech API:**
   - Thiet lap che do `interimResults = true`.
   - Dung bo dem thoi gian chu dong (Manual Silence Timer): Neu sau khi co am thanh ma 400ms khong co tu moi nao xuat hien, client chu dong ngat mic va gui noi dung di ngay.
2. **Neu dung ghi am audio:**
   - Su dung thu vien VAD nhe phia client nhu `silero-vad` (WASM) chay truc tiep trong trinh duyet voi nguong cat am 300ms - 400ms.

---

### Buoc 6: Bo dem Fast-Path va Toi uu RAG

1. **Fast-Path Caching (Da co san trong `ollama_service.py`):**
   - Cac cau chao hoi, cam on, hoi gio can duoc phan hoi trong 0.1ms bo qua LLM va RAG.
2. **Embedding Cache cho RAG:**
   - Luu cache ket qua embedding cua cac cau hoi thuong gap vao RAM thay vi moi lan deu goi `bge-m3` de embed lai cau hoi.

---

## 4. BANG DANH GIA HIEN TRANG VA SAU TOI UU

| Tieu chi | He thong hien tai | Sau khi ap dung Streaming |
| :--- | :--- | :--- |
| STT / VAD | Cho 1.5s - 2.0s | Giam con 300ms - 400ms |
| LLM Response | Cho toan bo cau (1.5s - 2.5s) | Stream token dau (200ms - 300ms) |
| TTS Audio | Cho render ca file MP3 (1.5s - 2.0s) | Chunked TTS menh de dau (150ms - 250ms) |
| Giao thuc truyen | HTTP JSON Base64 | WebSocket Binary Audio Stream |
| **Tong do tre cam nhan (TTFA)** | **5.5s - 8.0s** | **0.7s - 0.95s** |
