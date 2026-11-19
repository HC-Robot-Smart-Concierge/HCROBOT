	# Kien Truc Xu Ly Giong Noi va Hoi Thoai Khi Wi-Fi Yeu Hoac Mat Mang (Offline-First Voice Architecture)

## 1. Phan Tich Diem Nghen Ky Thuat (Bottlenecks)

Chu trinh dam thoai AI tieu chuan gom 3 mat xich:
1. **STT (Speech-to-Text):** Chuyen giong noi cua khach sang van ban.
2. **LLM / NLU (Natural Language Understanding):** Phan tich y dinh va sinh cau tra loi.
3. **TTS (Text-to-Speech):** Chuyen van ban thanh am thanh de phat ra loa.

Khi xay ra su co mang (Packet Loss, Ping cao > 1000ms hoac mat Internet hoan toan):
- **Nguyen nhan tre chinh:** Backend cho API Cloud (EdgeTTS / Google TTS) het thoi han timeout (mac dinh 8s - 12s) moi bao loi hoac chuyen fallback, lam Robot bi dung hinh (frozen).
- **Nghen bang thong am thanh:** Du lieu am thanh Base64 hoac MP3 Stream truyen qua ket noi yeu bi ngat quang, gay giat tieng hoac mat tieng.

---

## 2. Cac Giai Phap Ky Thuat Cu The

### 2.1. Multi-Tier Pre-generation & Audio Asset Caching (Sinh Truoc va Luu Dem Da Tang)

Khoang 70% - 80% cau thoai trong nghiep vu Robot khach san la cac mau cau co dinh. Khong can thiet phai goi Cloud TTS cho nhom cau nay.

- **Co che Hash Key:**
  - Khoa dinh danh am thanh: `MD5(clean_text + voice_id + rate + volume)`.
- **He thong luu tru da tang (3-Level Cache):**
  - **Level 1 (Memory Cache):** Luu truc tiep chuoi Base64 tren RAM (Backend Python Dictionary va Client JavaScript Map), truy xuat < 0.1ms.
  - **Level 2 (Client IndexedDB / Disk):** Luu file `.mp3` tai o dia robot (`backend/static/audio_cache`) hoac co so du lieu trinh duyet (IndexedDB) tren man hinh Kiosk.
  - **Level 3 (Database Asset Store):** Luu tru metadata va du lieu audio trong SQLite / PostgreSQL de tu dong dong bo xuong client khi khoi dong ung dung.
- **Phan loai noi dung can Pre-generate:**
  - Cau chao hoi, tam biet, cam on, xin loi.
  - Thong bao dieu huong, ban do (dang di chuyen, nhuong duong, da toi noi).
  - Phan hoi tu he thong kich ban FSM (xac nhan don don phong, nuoc uong, bao hong...).
  - Toan bo danh muc FAQ khach san dang Fast-Path.

### 2.2. Aggressive Timeout & Circuit Breaker (Cat Nguong Timeout Nhanh)

Chuyen tu chien luoc cho doi sang chien luoc that bai nhanh (Fail-Fast):

- **Giam nguong Timeout:**
  - Ha timeout yeu cau EdgeTTS tu `8.0s - 12.0s` xuong toi da **`1.5s - 2.0s`**.
  - Thiet lap `AbortController` (Frontend) va `asyncio.wait_for(timeout=2.0)` (Backend).
- **Circuit Breaker Pattern:**
  - Neu co 3 yeu cau TTS Cloud lien tiep bi timeout hoac loi mang, Circuit Breaker chuyen sang trang thai `OPEN` trong vong 30 - 60 giay.
  - Trong thoi gian nay, toan bo yeu cau sinh giong noi se di thang vao Engine Offline cuc bo, khong gui request ra Internet de tranh lang phi thoi gian cho.

### 2.3. On-Device Local TTS Engine (Dong Co TTS Chay Cuc Bo Tren Robot)

Giai quyet cac cau thoai do LLM sinh ra tu do (dynamic prompt) khi khong co Internet:

- **Giai phap tieu chuan phan cung nhung: Piper TTS (ONNX Runtime)**
  - Chay truc tiep tren CPU cua Robot (Mini PC Intel x86 hoac Raspberry Pi 5).
  - Ho tro model tieng Viet (`vi_VN-25hours-single`), dung luong model nho (~40MB - 80MB).
  - Toc do sinh am thanh: phan hoi tu 100ms - 250ms tren CPU, hoan toan khong phu thuoc Internet.
  - Dong goi duoi dang tien trinh Service chay tai cong Localhost de Backend FastAPI goi truc tiep qua socket noi bo.
- **Giai phap du phong trinh duyet: Web Speech API (Native OS Voices)**
  - Neu Backend Local TTS gap su co, Frontend Kiosk goi ham `window.speechSynthesis`.
  - Trinh duyet tan dung giong doc offline tich hop san cua he dieu hanh (Windows Speech API hoac Android TTS Engine).

### 2.4. Zero-Latency Filler Audio (Phat Cau Dem Tuc Thi)

Giai phap tam ly ky thuat giup triet tieu Perceived Latency (do tre cam nhan cua nguoi dung):

- Khi nhan duoc cau hoi, he thong lap tuc phat ngay mot cau dem am thanh co san tu Local Cache trong vong **< 50ms**:
  - Tieng Viet: *"Da, em dang kiem tra..."*, *"Da doi em mot chut nhe a."*
  - Tieng Anh: *"Please wait a moment..."*, *"Looking that up for you..."*
- Trong thoi gian cau dem dang phat (khoang 1.2s - 1.8s), he thong am tham xu ly:
  - Chay NLU / LLM de lay cau tra loi.
  - Tong hop am thanh cho cau tra loi chinh qua TTS Offline hoac Online.
- Khi cau dem vua dut, cau tra loi chinh da san sang trong bo dem (Buffer) de phat tiep, tao cam giac Robot phan xa tuc thi.

### 2.5. Streaming Audio Pipeline (Xu Ly Dong Theo Menh De)

Thay vi cho toan bo doan van ban dai sinh xong moi dua vao TTS:

- **Ngat cau theo dau cau (Punctuation Splitting):**
  - Cat cau theo dau cham (`.`), dau phay (`,`), cham phay (`;`), cham hoi (`?`).
- **Xu ly goi dau (Pipeline Concurrency):**
  - Ngay khi LLM sinh xong menh de dau tien (khoang 4 - 8 tu), gui ngay menh de nay vao Local TTS.
  - Audio chunk dau tien duoc gui ve Frontend qua WebSocket Binary Frame va phat ngay lap tuc.
  - Trong luc loa dang phat menh de 1, he thong tiep tuc sinh va tong hop menh de 2.
- Giam thoi gian cho am thanh dau tien (Time to First Audio - TTFA) tu `3.0s - 5.0s` xuong con **`< 500ms`**.

### 2.6. Dong Bo Toan Dien Cho Che Do Mat Mang Toan Phan (Full Offline Stack)

Khi khu vuc trien khai hoan toan khong co Wi-Fi, toan bo he thong chuyen sang che do On-Premise:
- **Offline STT:** Su dung `Whisper.cpp` (model `base` hoac `small` voi quantization Q5_K) hoac `Vosk-API` tieng Viet chay truc tiep tren may Robot.
- **Offline LLM:** Su dung `Ollama` voi cac mo hinh nén chay cuc bo nhu `Qwen2.5-3B-Instruct` hoac `Llama-3.2-3B`.
- **Offline TTS:** `Piper TTS` hoac Pre-rendered Audio Assets.

---

## 3. Quy Tac Uu Tien Dieu Phoi Luong (Priority Rules)

1. **Uu tien 1:** Kiem tra Local Cache (Memory / Disk / IndexedDB). Neu co: Phat ngay lap tuc (Do tre = 0ms).
2. **Uu tien 2:** Neu cau moi va co Internet: Gui Cloud EdgeTTS voi Timeout toi da 1.5s. Thanh cong thi ghi ngay vao Local Cache.
3. **Uu tien 3:** Neu mang yeu hoac qua 1.5s hoac mat Internet: Huy ket noi Cloud, chuyen ngay sang Engine cuc bo (Piper TTS noi bo hoac Web Speech API cua Kiosk).
4. **Luon luon:** Kich hoat cau dem Pre-cached neu thoi gian xu ly du kien cua pipeline vuot qua 300ms.
