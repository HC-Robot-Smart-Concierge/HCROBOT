# TÀI LIỆU LUỒNG PHIÊN DỊCH VÀ PHÁT ÂM THANH VIDEO CALL (STAFF ⇄ ROBOT)

> **QUY TẮC CHO CÁC LẦN SỬA SAU:**
> Đọc tài liệu này trước để nắm luồng. Sau đó đối chiếu git diff, các commit liên quan và những đoạn code sắp sửa. Không cần rà soát lại toàn bộ dự án nếu không có dấu hiệu ảnh hưởng rộng. Nếu tài liệu khác code, xác minh hành vi thực tế rồi cập nhật tài liệu. Mọi thay đổi luồng video call phải cập nhật file này trong cùng đợt sửa.

---

## 1. THÔNG TIN HIỆN TRẠNG & NHẬT KÝ CẬP NHẬT

- **Ngày cập nhật:** 30/10/2026
- **Git Branch:** `feature/video_call`
- **Commit HEAD nền:** `c63dcad` (*fix*) + các chỉnh sửa chưa commit trên working tree.
- **Phạm vi bảo toàn:** Không can thiệp thư mục `/robot`, ROS2, ESP32, motor, LiDAR, cảm biến, bản đồ, POI hoặc điều hướng. Không sửa các hook giọng nói dùng chung toàn cục (`useSpeechSynthesis.js`, `useSpeechRecognition.js`). Không log dữ liệu nhạy cảm (Base64 audio, token, nội dung hội thoại mặc định) ra console sản phẩm.

### Tóm tắt đợt sửa hiện tại (Đợt 3 — Sửa chiều `Staff → Robot`, STT đa ngữ theo âm thanh, tách ngôn ngữ vào/ra và xử lý `TTS_EMPTY`)
1. **Khắc phục điểm nghẽn chiều `Staff → Robot`:**
   - Sửa lỗi treo vĩnh viễn cờ `isPlayingAudioRef` và `isAiSpeakingRef` trong `processAudioQueue` khi `AudioContext.resume()` bị trình duyệt giữ ở trạng thái pending (chưa có user gesture). Hiện tại chỉ bật `isAiSpeakingRef = true` khi âm thanh thực sự bắt đầu phát (`PLAY_STARTED`), bọc `ctx.resume()` bằng timeout `400 ms` và bổ sung `playbackWatchdogRef` tự động giải phóng khóa nếu sự kiện `onended` không kích hoạt.
   - Bổ sung bộ thu âm **Call Audio Stream STT Adapter** đọc trực tiếp từ `localStreamRef.current` (16 kHz Mono PCM WAV theo ngưỡng khoảng lặng VAD) gửi về `/api/v1/ai/stt/transcribe`. Nhờ đó phía Staff và Robot vẫn nhận diện được giọng nói ngay cả khi `webkitSpeechRecognition` bị trình duyệt abort (mở 2 tab cùng máy hoặc xung đột WebRTC trên iOS Safari/Chrome).
   - Thu gọn khoảng đuôi chống vọng sau TTS từ `850 ms` xuống `280 ms` và cho phép câu trả lời mới của Staff (không trùng `lastPlayedTtsTextRef`) đi qua ngay lập tức.
2. **Tách biệt Ngôn ngữ đầu vào (Input Language theo từng câu) và Ngôn ngữ đầu ra (Target Language của người nhận):**
   - Ngôn ngữ đích của Staff là `'vi'`; ngôn ngữ đích của Khách tại Robot là `'en'` (khi ở chế độ `EN ⇄ VI`).
   - Khi ngôn ngữ câu vừa nói trùng với ngôn ngữ đích của người nhận (ví dụ Khách nói câu tiếng Việt cho Staff `vi == vi`, hoặc Staff nói câu tiếng Anh cho Khách `en == en`): giữ nguyên văn bản gốc, gửi `live_subtitle` với `needsTranslation: false`, không dịch vòng qua ngôn ngữ thứ ba, không gọi TTS thừa, và **không tự ý khóa chế độ cuộc gọi sang `Thuần Việt` (`bypass`)**.
3. **Nhận diện ngôn ngữ dựa trên tín hiệu âm thanh (Audio-Based Bilingual STT):**
   - Nâng cấp `backend/app/services/ai/stt_service.py` (`transcribe_audio_wav_detailed`): khi ở chế độ `language="auto"`, nếu `faster_whisper` không khả dụng trong môi trường chạy, hệ thống gọi song song Google Speech Recognition cho cả `vi-VN` và `en-US` kèm điểm tự tin âm học (`with_confidence=True`), chấm điểm dựa trên độ tự tin, dấu tiếng Việt, từ vựng đặc trưng và độ phủ âm tiết để chọn đúng ngôn ngữ thực tế của câu nói.
   - Bổ sung nút chọn chế độ nghe trên thanh cuộc gọi (`Nghe: Đa ngữ` / `Nghe: EN` / `Nghe: VI`) và cơ chế chống chốt trùng lặp (`evaluateSpokenTextCommit`) để mỗi câu nói chỉ được commit duy nhất 1 lần.
4. **Phân loại mã lỗi `TTS_EMPTY` và chống kẹt hàng đợi phát âm thanh:**
   - Chuẩn hóa mã lỗi xuyên suốt từ `tts_service.py` $\rightarrow$ `/api/v1/ai/tts` $\rightarrow$ `aiApi.synthesizeSpeech` $\rightarrow$ `MessengerVideoCallModal.jsx`: `TTS_INPUT_EMPTY`, `TTS_TIMEOUT`, `TTS_PROVIDER_ERROR`, `TTS_RESPONSE_INVALID`, `TTS_AUDIO_EMPTY`, `PLAYBACK_BLOCKED`, `PLAYBACK_DECODE_ERROR`.
   - Bổ sung 1 lần retry có giới hạn thời gian ở cả backend (`_synthesize_edge_tts_detailed`) và frontend, kèm dự phòng qua Google Translate TTS HTTP endpoint khi `edge_tts` gặp lỗi kết nối hoặc timeout.
   - Khi nhận `live_audio_status: { status: 'failed', seq }`, phía nhận gọi `advanceExpectedSeqOnFailure` để tăng ngay `expectedPlaySeqRef.current` qua `seq` lỗi, không bắt các câu kế tiếp phải chờ `1.2 s`.
   - Sửa lỗi tái sử dụng `httpx.AsyncClient` giữa các event loop trong `translation_service.py` gây lỗi `RuntimeError('Event loop is closed')`.

---

## 2. SƠ ĐỒ KIẾN TRÚC VÀ CÁC BƯỚC TRẠNG THÁI CHUẨN HÓA

### 2.1. Chuỗi bước log chẩn đoán một câu nói (End-to-End Trace Steps)

Mỗi câu nói từ lúc thu âm tới khi phát loa đi qua các bước có thể truy vết trên Console:

```text
STT_STARTED
  └─► STT_RESULT (hoặc STT_SKIPPED kèm reason cụ thể)
        └─► COMMITTED (engine=google_bilingual | faster_whisper_auto | web_speech)
              └─► TRANSLATE_REQUEST (srcHint, tgt)
                    └─► TRANSLATED (src, tgt, needsTrans)
                          ├─► SUBTITLE_SENT ──► [WebSocket] ──► SUBTITLE_RECEIVED
                          └─► (Nếu needsTrans === true):
                                TTS_REQUEST
                                  ├─► (Thành công): TTS_READY ──► TTS_SENT ──► [WebSocket] ──► AUDIO_RECEIVED ──► PLAY_STARTED ──► PLAY_ENDED
                                  └─► (Thất bại):   TTS_RETRY (tối đa 1 lần) ──► TTS_EMPTY (code, detail) ──► LIVE_AUDIO_FAILED (advance expectedPlaySeq)
```

### 2.2. Ma trận quyết định ngôn ngữ (Tách biệt Input Language và Target Language)

| Người nói (`senderRole`) | Chế độ cuộc gọi (`translateMode`) | Ngôn ngữ câu nói phát hiện (`sourceLang`) | Ngôn ngữ đích phía nhận (`targetLang`) | Hành vi xử lý | Giọng đọc TTS phía nhận | Tự động đổi `translateMode`? |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Guest (Robot)** | `auto` (`EN ⇄ VI`) | `en` | `vi` (Staff) | Dịch `EN → VI` (`needsTranslation: true`) | `vi-VN-HoaiMyNeural` (tại Staff) | Không |
| **Guest (Robot)** | `auto` (`EN ⇄ VI`) | `vi` | `vi` (Staff) | Giữ nguyên câu tiếng Việt (`needsTranslation: false`), gửi phụ đề gốc cho Staff, **không gọi TTS** | Không phát TTS | **Không** (câu EN kế tiếp vẫn dịch) |
| **Staff** | `auto` (`EN ⇄ VI`) | `vi` | `en` (Guest) | Dịch `VI → EN` (`needsTranslation: true`) | `en-US-JennyNeural` (tại Robot) | Không |
| **Staff** | `auto` (`EN ⇄ VI`) | `en` | `en` (Guest) | Giữ nguyên câu tiếng Anh (`needsTranslation: false`), gửi phụ đề gốc cho Robot, **không gọi TTS** | Không phát TTS | **Không** |
| **Guest / Staff** | `bypass` (`Thuần Việt`) | Bất kỳ (`vi` / `en`) | `vi` | Giữ nguyên câu gốc (`needsTranslation: false`), không dịch, không gọi TTS | Không phát TTS | Giữ `bypass` cho tới khi người dùng bấm `EN ⇄ VI` |

---

## 3. NGUYÊN NHÂN GỐC RỄ ĐÃ XÁC MINH TRONG CODE & RUNTIME

### 3.1. Vì sao Staff nói tiếng Việt nhưng Robot chỉ nghe tiếng gốc WebRTC mà chưa nhận bản dịch tiếng Anh?
1. **Treo cờ `isPlayingAudioRef` và `isAiSpeakingRef` sau lượt Robot nói trước đó (`MessengerVideoCallModal.jsx`):**
   Ở phiên bản trước, ngay đầu hàm `processAudioQueue`, code gán `isPlayingAudioRef.current = true`, `isAiSpeakingRef.current = true` và `ttsActiveUntilRef.current = Date.now() + 15000` **trước khi** gọi `await ctx.resume()`. Trên trình duyệt khi `AudioContext` đang ở trạng thái `suspended` mà chưa có tương tác người dùng trực tiếp, Promise `ctx.resume()` treo vô thời hạn (không resolve và không reject). Do đó `handleAudioFinished()` không bao giờ chạy, `isAiSpeakingRef.current` kẹt vĩnh viễn ở `true`, và mọi câu nói tiếp theo của Staff đều bị `recognition.onresult` / `commitSpokenText` chặn bỏ.
2. **Xung đột `webkitSpeechRecognition` khi mở 2 tab trình duyệt hoặc dùng WebRTC trên di động:**
   `webkitSpeechRecognition` của trình duyệt dùng chung bộ thu mức tiến trình; khi mở đồng thời màn hình Robot và màn hình Staff trên cùng máy hoặc khi WebRTC giữ kênh mic trên iOS Safari, `webkitSpeechRecognition` bị ngắt (`aborted`) liên tục trong khi WebRTC vẫn truyền tiếng nói gốc bình thường. Việc bổ sung **Call Audio Stream STT Adapter** đọc trực tiếp từ `localStreamRef.current` giúp giải quyết điểm mù này.
3. **Lỗi tái sử dụng `httpx.AsyncClient` trong `translation_service.py`:**
   `TranslationService` khởi tạo một `self.http_client = httpx.AsyncClient()` tĩnh dùng chung. Khi event loop thay đổi hoặc đóng kết nối, lời gọi Google GTX ném lỗi `RuntimeError('Event loop is closed')`, rơi xuống fallback và trả về nguyên văn câu tiếng Việt (`needs_translation = False`).

### 3.2. Vì sao khách tại Robot nói tiếng Việt xen giữa tiếng Anh bị nhận diện sai?
1. **Ở phía Frontend:** `recognition.lang` của Web Speech API trước đây bị gán cố định `en-US` cho `role === 'guest'` khi ở chế độ `EN ⇄ VI`. Khi khách nói một câu tiếng Việt, bộ nhận diện `en-US` phiên âm tiếng Việt thành các từ tiếng Anh vô nghĩa rồi đem dịch ngược sang tiếng Việt.
2. **Ở phía Backend (`stt_service.py`):** Trong môi trường `backend/.venv`, thư viện `faster_whisper` chưa được cài đặt (`ModuleNotFoundError`), nên hàm `transcribe_audio_wav(language="auto")` luôn rơi vào vòng lặp dự phòng tuần tự `for fallback_lang in ["vi-VN", "en-US"]:`. Vòng lặp này luôn gọi `vi-VN` trước và trả về ngay nếu chuỗi khác rỗng; thực nghiệm trên audio tiếng Anh cho thấy bộ nhận diện `vi-VN` vẫn trả về các chữ ASCII rời rạc không dấu, khiến nhánh `en-US` không bao giờ được chạy.

### 3.3. Vì sao xuất hiện lỗi `step=TTS_EMPTY error=No audio`?
1. Trong `backend/app/services/ai/tts_service.py`, hàm `_synthesize_edge_tts` bắt mọi ngoại lệ (`edge_tts.exceptions.NoAudioReceived`, lỗi kết nối hoặc timeout `> 4.5 s` khi khởi tạo kết nối lạnh tới máy chủ Microsoft Edge) rồi trả về `None`. Hàm `synthesize()` nhận `None` và trả về `("", "audio/mp3", "browser")` với HTTP `200 OK` mà không kèm bất kỳ trường mô tả lỗi nào.
2. Schema `TTSResponse` không có `error_code` và `error_detail`, nên `MessengerVideoCallModal.jsx` chỉ thấy `audio_base64: ""` và in ra `error=No audio`.
3. Khi `live_audio_status: { status: 'failed', seq }` gửi sang phía nhận, phía nhận chỉ hiển thị thông báo UI chứ không tăng `expectedPlaySeqRef.current`, làm câu tiếp theo có `seq` lớn hơn bị giữ lại trong hàng đợi chờ `1.2 s`.

### 3.4. Hiện tượng bất đối xứng âm thanh mộc WebRTC (Staff nói Robot nghe tiếng gốc, nhưng Robot nói Staff chỉ thấy Text & Giọng AI)
Trong quá trình kiểm thử thực tế, người dùng nhận thấy hiện tượng:
- **Staff nói tiếng Việt:** Phía Robot Kiosk nghe được tiếng Việt gốc rất rõ qua loa WebRTC.
- **Khách tại Robot nói:** Phía Staff dường như không nghe thấy âm thanh mộc của khách, chỉ thấy phụ đề text và nghe giọng đọc dịch AI.

**Cơ chế thực tế trong code và nguyên nhân gốc rễ:**
1. **Thiết kế hạ tầng WebRTC:** Cả hai bên đều gắn AudioTrack từ micro vào kết nối P2P (`pc.addTrack(track, stream)`). Điều này khẳng định **tiếng nói mộc thực tế luôn được phát đi từ cả hai phía**, không hề bị code chặn ở đầu gửi.
2. **Tại sao Robot nghe được tiếng mộc của Staff?**
   - Robot Kiosk thường chạy trên PC hoặc Tablet cảm ứng. Trước khi kết nối, khách đã bấm nút *"Gọi nhân viên"* hoặc chạm vào màn hình Kiosk $\rightarrow$ Trình duyệt đã ghi nhận cử chỉ người dùng (**User Gesture**).
   - Trình duyệt máy tính không áp dụng chính sách chặn âm thanh ngặt nghèo $\rightarrow$ Thẻ `<video ref={remoteVideoRef}>` tự động mở loa và phát tiếng Việt mộc của Staff ra màng loa Kiosk bình thường.
3. **Tại sao Staff (Điện thoại / iPhone Safari) không nghe được tiếng mộc của Robot?**
   - **Chính sách Autoplay trên iOS Safari / Mobile Browser:** Trình duyệt di động cấm phát tự động âm thanh từ thẻ media WebRTC nếu chưa có thao tác chạm trực tiếp vào chính thẻ video đó trong phiên gọi.
   - Khi `remoteVideoRef.current.play()` ném lỗi `NotAllowedError` trên điện thoại Staff, để giữ luồng hình ảnh không bị đứng hoặc màn hình đen, code WebRTC tại dòng 640 buộc phải fallback:
     ```javascript
     remoteVideoRef.current.muted = true; // Tắt tiếng mộc để video tiếp tục chạy hình
     ```
     Nhánh xử lý này vô tình **tắt tiếng mộc WebRTC từ Robot truyền sang Staff**.
   - Trong khi đó, **phụ đề text** (truyền qua WebSocket Signaling) và **âm thanh giọng đọc AI** (truyền qua WebSocket `live_audio` nạp vào Web Audio API `AudioContext` riêng biệt) hoàn toàn không chịu sự chi phối của thuộc tính `muted` trên thẻ `<video>`. Do đó, Staff vẫn đọc được phụ đề tiếng Việt và nghe giọng Hoài My đọc bản dịch bình thường.
4. **Cơ chế Audio Ducking (Dìm âm lượng tiếng mộc khi AI phát):**
   - Kể cả khi tiếng mộc được mở, hàm `processAudioQueue` vẫn tự động giảm âm lượng WebRTC đối phương xuống 15% (`remoteVideoRef.current.volume = 0.15`) trong suốt thời gian AI đọc bản dịch để tránh 2 thứ tiếng đè ầm ĩ lẫn nhau, và tự động khôi phục lại khi AI dứt câu.

---

## 4. CƠ CHẾ STT ĐA NGỮ (BILINGUAL AUDIO STT) & GIỚI HẠN KỸ THUẬT

### 4.1. Kiến trúc thu âm và nhận diện
- **Call Audio Stream STT Adapter (`MessengerVideoCallModal.jsx`):**
  - Tách luồng âm thanh từ `localStreamRef.current.getAudioTracks()` vào một `AudioContext` `16000 Hz` riêng biệt với `ScriptProcessorNode` (`4096` mẫu/khung $\approx 256\text{ ms}$).
  - Theo dõi năng lượng âm thanh RMS (`calculateFrameRms`): bắt đầu ghi khi `rms >= 0.013` (kèm 1 khung pre-roll) và tự động cắt câu khi gặp khoảng lặng `>= 3` khung liên tiếp (`~768 ms`) hoặc đạt độ dài tối đa `~7.1 s`.
  - Đóng gói dữ liệu PCM Float32 thành file WAV 16-bit Mono chuẩn (`encodeWavBlobFromFloat32`) và gửi tới `POST /api/v1/ai/stt/transcribe`.
  - Khi dừng adapter (`stopCallAudioSttAdapter`), chỉ ngắt kết nối các node Web Audio nội bộ, **không gọi `.stop()` lên audio track của `localStreamRef.current`** để bảo toàn luồng thoại WebRTC.
- **Backend Bilingual STT (`backend/app/services/ai/stt_service.py`):**
  - Nếu `faster_whisper` có sẵn: dùng Whisper tự động phát hiện ngôn ngữ từ âm thanh (`language=None`).
  - Nếu `faster_whisper` không có sẵn: chạy song song 2 luồng `recognize_google(..., with_confidence=True)` cho `vi-VN` và `en-US` qua `ThreadPoolExecutor(max_workers=2)`.
  - Hàm `_score_bilingual_candidates` chấm điểm cả 2 ứng viên dựa trên:
    - Độ tự tin âm học (`confidence`) từ bộ nhận diện.
    - Sự hiện diện của dấu thanh tiếng Việt (`VI_DIACRITICS_RE`) và từ neo tiếng Việt (`VI_ANCHOR_WORDS_RE`) so với từ neo tiếng Anh (`EN_ANCHOR_WORDS_RE`).
    - Phạt điểm ứng viên `vi-VN` (`-0.28`) nếu đầu ra hoàn toàn là chữ ASCII không dấu và không chứa từ tiếng Việt đặc trưng (hiện tượng model `vi-VN` nghe nhầm câu tiếng Anh).
    - Độ phủ số lượng từ giữa hai bản nhận diện và gợi ý `preferred_lang` khi hai điểm sát nhau.

### 4.2. Cơ chế chống trùng lặp (Deduplication)
- Khi `inputLangMode === 'auto'` và bộ thu âm Audio Stream VAD đang bắt được tín hiệu giọng nói thực tế (`lastAudioVadSpeechAtRef`), kết quả tạm từ `webkitSpeechRecognition` được giữ trong timer dự phòng `1250 ms`. Khi kết quả song ngữ từ `/api/v1/ai/stt/transcribe` trả về, hệ thống hủy timer dự phòng và chỉ commit duy nhất kết quả từ Audio STT. Nếu request mạng gặp sự cố, timer dự phòng sẽ commit kết quả Web Speech để không mất câu nói.
- Mọi lời gọi `commitSpokenText` đều đi qua `evaluateSpokenTextCommit`: nếu cùng một nội dung đã được commit trong vòng `2200 ms`, lần gọi thứ hai bị từ chối với lý do `DUPLICATE_UTTERANCE`.

### 4.3. Giới hạn kỹ thuật thực tế
- **Hỗ trợ tốt:** Chuyển đổi ngôn ngữ **giữa các câu** (inter-utterance switching), ví dụ khách nói một câu tiếng Anh, câu tiếp theo nói tiếng Việt, rồi câu sau nói lại tiếng Anh.
- **Giới hạn:** Trường hợp **trộn 2 ngôn ngữ trong cùng một câu ngắn** (intra-utterance code-switching, ví dụ nửa đầu câu tiếng Việt, nửa cuối câu tiếng Anh không ngắt nghỉ) vẫn bị giới hạn bởi đặc thù model âm học đơn ngữ của Google Speech API trên từng chunk. Người dùng có thể dùng nút **`Nghe: Đa ngữ / EN / VI`** trên thanh điều khiển để khóa ngôn ngữ đầu vào khi cần thiết.

---

## 5. BẢNG MÃ LỖI CHUẨN HÓA & LÝ DO BỎ QUA CÂU NÓI

### 5.1. Mã lý do bỏ qua câu nói tại STT (`STT_SKIP_REASONS`)

| Mã lý do (`reason`) | Điều kiện kích hoạt | Ý nghĩa chẩn đoán |
| :--- | :--- | :--- |
| `EMPTY_TEXT` | `!text \|\| !text.trim()` | Chuỗi nhận diện rỗng hoặc chỉ chứa khoảng trắng. |
| `MIC_MUTED` | `isMicMutedRef.current === true` | Người dùng đang chủ động tắt micro trên modal cuộc gọi. |
| `CALL_NOT_CONNECTED` | `callStatusRef.current !== 'connected'` | Cuộc gọi chưa kết nối WebRTC hoặc đã kết thúc. |
| `ECHO_AI_SPEAKING` | `isAiSpeakingRef.current === true` | Loa thiết bị đang thực sự phát giọng đọc AI (`PLAY_STARTED` $\rightarrow$ chưa `PLAY_ENDED`). |
| `ECHO_MATCHES_LAST_TTS` | Văn bản khớp/nằm trong `lastPlayedTtsTextRef` trong vòng `3.5 s` sau TTS | Micro thu lại đúng câu dịch mà loa vừa phát ra. |
| `ECHO_POST_TTS_TAIL` | Trong khoảng đuôi âm học `280 ms` sau `PLAY_ENDED` và câu ngắn (`<= 2` từ) hoặc trùng TTS | Chặn tiếng vang cuối câu của loa (nhưng vẫn cho phép câu trả lời mới `>= 3` từ đi qua ngay). |
| `DUPLICATE_UTTERANCE` | Nội dung chuẩn hóa trùng với câu vừa commit trong vòng `2200 ms` | Ngăn commit 2 lần cùng một câu nói từ 2 nguồn STT. |

### 5.2. Mã lỗi tổng hợp và phát âm thanh TTS (`TTS_ERROR_CODES`)

| Mã lỗi (`error_code`) | Nguồn phát sinh | Nguyên nhân & Hành vi xử lý |
| :--- | :--- | :--- |
| `TTS_INPUT_EMPTY` | Frontend (`aiApi.js`) / Backend (`tts_service.py`) | Văn bản cần đọc rỗng sau khi loại bỏ ký tự đặc biệt/markdown. Không gửi request mạng. |
| `TTS_TIMEOUT` | Frontend (`AbortController` `6.5 s`) / Backend (`asyncio.wait_for` `6.0 s`) | Quá thời gian chờ tổng hợp âm thanh. Kích hoạt tối đa 1 lần retry hoặc chuyển sang Google TTS fallback. |
| `TTS_PROVIDER_ERROR` | Backend (`edge_tts` exception, HTTP 5xx) / Frontend (Network error) | Lỗi từ provider TTS (ví dụ `NoAudioReceived` hoặc mất kết nối). Thực hiện retry/fallback; nếu vẫn lỗi thì gửi `live_audio_status: failed`. |
| `TTS_RESPONSE_INVALID` | Frontend (`aiApi.js`) | Phản hồi từ `/api/v1/ai/tts` không phải JSON hợp lệ hoặc thiếu trường `audio_base64`. |
| `TTS_AUDIO_EMPTY` | Backend / Frontend | Provider hoàn tất nhưng trả về `0` byte âm thanh (`audio_base64 === ""`). |
| `PLAYBACK_BLOCKED` | Frontend (`processAudioQueue`) | Trình duyệt chặn tự động phát (`NotAllowedError` / `AudioContext` vẫn `suspended` sau `400 ms`). Mở khóa ngay `isPlayingAudioRef` / `isAiSpeakingRef` và hiện nút **Autoplay Unlock**. |
| `PLAYBACK_DECODE_ERROR` | Frontend (`ctx.decodeAudioData` / `HTML5 Audio`) | Dữ liệu âm thanh nhận được bị lỗi định dạng không thể giải mã. Chuyển sang fallback hoặc bỏ qua câu đó và giải phóng hàng đợi. |

---

## 6. DANH SÁCH FILE & HÀM ĐÃ CẬP NHẬT TRONG ĐỢT NÀY

| File | Các hàm / thành phần cập nhật |
| :--- | :--- |
| [`backend/app/schemas/ai.py`](file:///d:/FPT_Learning2026/FPT_Ky9/Đồ%20Án/repo/HCROBOT/backend/app/schemas/ai.py) | Bổ sung `error_code`, `error_detail` vào `TTSResponse` và `tts_error_code`, `tts_error_detail` vào `QuickTranslateResponse`. |
| [`backend/app/services/ai/tts_service.py`](file:///d:/FPT_Learning2026/FPT_Ky9/Đồ%20Án/repo/HCROBOT/backend/app/services/ai/tts_service.py) | Thêm `synthesize_with_details()`, `_synthesize_edge_tts_detailed()` (có retry ngắn), `_synthesize_google_tts()` fallback, và phân loại mã lỗi chuẩn hóa. |
| [`backend/app/services/ai/stt_service.py`](file:///d:/FPT_Learning2026/FPT_Ky9/Đồ%20Án/repo/HCROBOT/backend/app/services/ai/stt_service.py) | Thêm `transcribe_audio_wav_detailed()` và `_score_bilingual_candidates()` chạy song song `vi-VN` & `en-US` kèm điểm tự tin âm học khi `language="auto"`. |
| [`backend/app/services/ai/translation_service.py`](file:///d:/FPT_Learning2026/FPT_Ky9/Đồ%20Án/repo/HCROBOT/backend/app/services/ai/translation_service.py) | Cải tiến `detect_language()`, tách biệt `source_lang` theo từng câu khỏi `target_lang`, và dùng context-managed `httpx.AsyncClient` tránh lỗi `Event loop is closed`. |
| [`backend/app/api/v1/endpoints/ai.py`](file:///d:/FPT_Learning2026/FPT_Ky9/Đồ%20Án/repo/HCROBOT/backend/app/api/v1/endpoints/ai.py) | Cập nhật `/api/v1/ai/stt/transcribe` (trả về `detected_language`, `confidence`, `provider`) và `/api/v1/ai/tts` (trả về `error_code`, `error_detail`). |
| [`frontend/src/services/aiApi.js`](file:///d:/FPT_Learning2026/FPT_Ky9/Đồ%20Án/repo/HCROBOT/frontend/src/services/aiApi.js) | Cập nhật `synthesizeSpeech()` (timeout + phân loại mã lỗi) và thêm `transcribeCallAudio()`. |
| [`frontend/src/components/video/videoCallTranslationHelpers.js`](file:///d:/FPT_Learning2026/FPT_Ky9/Đồ%20Án/repo/HCROBOT/frontend/src/components/video/videoCallTranslationHelpers.js) | Module helper kiểm tra echo/skip reason (`evaluateSpokenTextCommit`), phân giải ngôn ngữ đích (`resolveTranslationTarget`), nhảy qua sequence lỗi (`advanceExpectedSeqOnFailure`) và đóng gói WAV 16 kHz (`encodeWavBlobFromFloat32`). |
| [`frontend/src/components/video/MessengerVideoCallModal.jsx`](file:///d:/FPT_Learning2026/FPT_Ky9/Đồ%20Án/repo/HCROBOT/frontend/src/components/video/MessengerVideoCallModal.jsx) | Tích hợp `startCallAudioSttAdapter`, sửa khóa `processAudioQueue`, tách biệt ngôn ngữ vào/ra trong `handleProcessSpokenText`, thêm nút chọn `Nghe: Đa ngữ / EN / VI` và xử lý `live_audio_status`. |

---

## 7. KẾT QUẢ KIỂM THỬ ĐÃ XÁC MINH & CÁC MỤC CẦN TEST VẬT LÝ

### 7.1. Đã xác minh bằng kiểm thử tự động và chạy thực nghiệm

1. **Backend Pytest (`test_translation_api.py` & `test_tts_service.py`):**
   ```bash
   $env:PYTHONPATH="backend"; .\backend\.venv\Scripts\python.exe -m pytest backend/tests/test_translation_api.py backend/tests/test_tts_service.py -v
   ```
   - **Kết quả:** `11 passed` (bao gồm dịch `EN → VI`, dịch `Staff VI → Robot EN`, khách nói câu tiếng Việt xen giữa 2 câu tiếng Anh không dịch vòng và không khóa chế độ, Staff nói tiếng Anh khi khách nhận tiếng Anh, chấm điểm STT song ngữ, và kiểm tra đủ 4 mã lỗi `TTS_INPUT_EMPTY`, `TTS_TIMEOUT`, `TTS_PROVIDER_ERROR`, `TTS_AUDIO_EMPTY`).
2. **Frontend Vitest (`MessengerVideoCallModal.test.jsx`):**
   ```bash
   cmd /c "cd frontend && npx vitest run src/components/video/MessengerVideoCallModal.test.jsx"
   ```
   - **Kết quả:** `16 passed` (kiểm tra luồng dịch 2 chiều, phân loại mã lỗi TTS, mã lý do `STT_SKIP_REASONS`, cho phép Staff trả lời tiếng Việt ngay sau khi Robot dứt câu TTS, chống trùng lặp STT, nhảy qua sequence lỗi `advanceExpectedSeqOnFailure`, và đóng gói WAV 16 kHz).
3. **Production Build (`vite build`):**
   ```bash
   cmd /c "cd frontend && npx vite build"
   ```
   - **Kết quả:** Build thành công không có lỗi cú pháp hay lỗi import.

### 7.2. Phần chưa thể xác minh tự động — Cần kiểm tra trên 2 thiết bị thực tế

> [!WARNING]
> Các bài test tự động xác minh logic xử lý âm thanh, phân loại ngôn ngữ, API backend, hàng đợi WebSocket và giải mã buffer. Các yếu tố vật lý sau đây bắt buộc phải kiểm tra trực tiếp trên 2 thiết bị thật (qua HTTPS / Secure Context hoặc `localhost`):
> 1. **Âm lượng thực tế và độ vọng âm học (Acoustic Echo)** giữa loa ngoài của Robot Kiosk và micro của Kiosk trong không gian sảnh thực tế.
> 2. **Chính sách Autoplay trên Safari iOS / Chrome Mobile** khi nhân viên nhận cuộc gọi mà chưa chạm thêm vào vùng video.
> 3. **Chất lượng thu âm của micro thiết bị** khi khách đứng cách Robot Kiosk trên `1.5 m` (nếu âm lượng quá nhỏ làm `rms < 0.013`, cần nói gần micro hơn hoặc dùng nút `🧪 Thử AI` để đối chiếu).
