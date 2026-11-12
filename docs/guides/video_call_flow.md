# TÀI LIỆU LUỒNG PHIÊN DỊCH VÀ PHÁT ÂM THANH VIDEO CALL (STAFF <-> ROBOT)

> **QUY TẮC BẢO TRÌ:**
> Đọc tài liệu này trước để nắm luồng. Sau đó đối chiếu git diff, các commit liên quan và những đoạn code sắp sửa. Mọi thay đổi luồng video call phải cập nhật tài liệu này trong cùng đợt sửa.

---

## 1. THÔNG TIN HIỆN TRẠNG & NHẬT KÝ CẬP NHẬT

- **Phạm vi bảo toàn:** Không can thiệp thư mục `/robot`, ROS2, ESP32, motor, LiDAR, cảm biến, bản đồ, POI hoặc điều hướng. Không sửa các hook giọng nói dùng chung toàn cục (`useSpeechSynthesis.js`, `useSpeechRecognition.js`). Không log dữ liệu nhạy cảm (Base64 audio, token, nội dung hội thoại mặc định) ra console sản phẩm.

### Tóm tắt kiến trúc luồng Video Call hai chiều

1. **Khắc phục điểm nghẽn chiều Staff -> Robot:**
   - Xử lý treo cờ `isPlayingAudioRef` và `isAiSpeakingRef` trong `processAudioQueue` khi `AudioContext.resume()` bị trình duyệt giữ ở trạng thái pending (chưa có user gesture). Chỉ bật `isAiSpeakingRef = true` khi âm thanh thực sự bắt đầu phát (`PLAY_STARTED`), bọc `ctx.resume()` bằng timeout `400 ms` và bổ sung `playbackWatchdogRef` tự động giải phóng khóa nếu sự kiện `onended` không kích hoạt.
   - Bổ sung bộ thu âm **Call Audio Stream STT Adapter** đọc trực tiếp từ `localStreamRef.current` (16 kHz Mono PCM WAV theo ngưỡng khoảng lặng VAD) gửi về `/api/v1/ai/stt/transcribe`. Nhờ đó phía Staff và Robot vẫn nhận diện được giọng nói ngay cả khi `webkitSpeechRecognition` bị trình duyệt abort (mở 2 tab cùng máy hoặc xung đột WebRTC trên iOS Safari/Chrome).
   - Thu gọn khoảng đuôi chống vọng sau TTS từ `850 ms` xuống `280 ms` và cho phép câu trả lời mới của Staff (không trùng `lastPlayedTtsTextRef`) đi qua ngay lập tức.
2. **Tách biệt Ngôn ngữ đầu vào (Input Language theo từng câu) và Ngôn ngữ đầu ra (Target Language của người nhận):**
   - Ngôn ngữ đích của Staff là `'vi'`; ngôn ngữ đích của Khách tại Robot là `'en'` (khi ở chế độ `EN <-> VI`).
   - Khi ngôn ngữ câu vừa nói trùng với ngôn ngữ đích của người nhận (ví dụ Khách nói câu tiếng Việt cho Staff `vi == vi`, hoặc Staff nói câu tiếng Anh cho Khách `en == en`): giữ nguyên văn bản gốc, gửi `live_subtitle` với `needsTranslation: false`, không dịch vòng qua ngôn ngữ thứ ba, không gọi TTS thừa, và không tự ý khóa chế độ cuộc gọi sang `Thuần Việt` (`bypass`).
3. **Nhận diện ngôn ngữ dựa trên tín hiệu âm thanh (Audio-Based Bilingual STT):**
   - Tại `backend/app/services/ai/stt_service.py` (`transcribe_audio_wav_detailed`): khi ở chế độ `language="auto"`, nếu `faster_whisper` không khả dụng trong môi trường chạy, hệ thống gọi song song Google Speech Recognition cho cả `vi-VN` và `en-US` kèm điểm tự tin âm học (`with_confidence=True`), chấm điểm dựa trên độ tự tin, dấu tiếng Việt, từ vựng đặc trưng và độ phủ âm tiết để chọn đúng ngôn ngữ thực tế của câu nói.
   - Bổ sung nút chọn chế độ nghe trên thanh cuộc gọi (`Nghe: Đa ngữ` / `Nghe: EN` / `Nghe: VI`) và cơ chế chống chốt trùng lặp (`evaluateSpokenTextCommit`) để mỗi câu nói chỉ được commit duy nhất 1 lần.
4. **Phân loại mã lỗi `TTS_EMPTY` và chống kẹt hàng đợi phát âm thanh:**
   - Chuẩn hóa mã lỗi xuyên suốt từ `tts_service.py` -> `/api/v1/ai/tts` -> `aiApi.synthesizeSpeech` -> `MessengerVideoCallModal.jsx`: `TTS_INPUT_EMPTY`, `TTS_TIMEOUT`, `TTS_PROVIDER_ERROR`, `TTS_RESPONSE_INVALID`, `TTS_AUDIO_EMPTY`, `PLAYBACK_BLOCKED`, `PLAYBACK_DECODE_ERROR`.
   - Bổ sung 1 lần retry có giới hạn thời gian ở cả backend (`_synthesize_edge_tts_detailed`) và frontend, kèm dự phòng qua Google Translate TTS HTTP endpoint khi `edge_tts` gặp lỗi kết nối hoặc timeout.
   - Khi nhận `live_audio_status: { status: 'failed', seq }`, phía nhận gọi `advanceExpectedSeqOnFailure` để tăng ngay `expectedPlaySeqRef.current` qua `seq` lỗi, không bắt các câu kế tiếp phải chờ `1.2 s`.
   - Sử dụng context-managed `httpx.AsyncClient` trong `translation_service.py` tránh lỗi `RuntimeError('Event loop is closed')`.

---

## 2. SƠ ĐỒ KIẾN TRÚC VÀ CÁC BƯỚC TRẠNG THÁI CHUẨN HÓA

### 2.1. Chuỗi bước log chẩn đoán một câu nói (End-to-End Trace Steps)

Mỗi câu nói từ lúc thu âm tới khi phát loa đi qua các bước có thể truy vết trên Console:

```text
STT_STARTED
  |-- STT_RESULT (hoặc STT_SKIPPED kèm reason cụ thể)
        |-- COMMITTED (engine=google_bilingual | faster_whisper_auto | web_speech)
              |-- TRANSLATE_REQUEST (srcHint, tgt)
                    |-- TRANSLATED (src, tgt, needsTrans)
                          |-- SUBTITLE_SENT ----> [WebSocket] ----> SUBTITLE_RECEIVED
                          |-- (Nếu needsTrans === true):
                                TTS_REQUEST
                                  |-- (Thành công): TTS_READY ----> TTS_SENT ----> [WebSocket] ----> AUDIO_RECEIVED ----> PLAY_STARTED ----> PLAY_ENDED
                                  |-- (Thất bại):   TTS_RETRY (tối đa 1 lần) ----> TTS_EMPTY (code, detail) ----> LIVE_AUDIO_FAILED (advance expectedPlaySeq)
```

### 2.2. Ma trận quyết định ngôn ngữ (Tách biệt Input Language và Target Language)

| Người nói (`senderRole`) | Chế độ cuộc gọi (`translateMode`) | Ngôn ngữ câu nói phát hiện (`sourceLang`) | Ngôn ngữ đích phía nhận (`targetLang`) | Hành vi xử lý | Giọng đọc TTS phía nhận | Tự động đổi `translateMode`? |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Guest (Robot)** | `auto` (`EN <-> VI`) | `en` | `vi` (Staff) | Dịch `EN -> VI` (`needsTranslation: true`) | `vi-VN-HoaiMyNeural` (tại Staff) | Không |
| **Guest (Robot)** | `auto` (`EN <-> VI`) | `vi` | `vi` (Staff) | Giữ nguyên câu tiếng Việt (`needsTranslation: false`), gửi phụ đề gốc cho Staff, không gọi TTS | Không phát TTS | Không (câu EN kế tiếp vẫn dịch) |
| **Staff** | `auto` (`EN <-> VI`) | `vi` | `en` (Guest) | Dịch `VI -> EN` (`needsTranslation: true`) | `en-US-JennyNeural` (tại Robot) | Không |
| **Staff** | `auto` (`EN <-> VI`) | `en` | `en` (Guest) | Giữ nguyên câu tiếng Anh (`needsTranslation: false`), gửi phụ đề gốc cho Robot, không gọi TTS | Không phát TTS | Không |
| **Guest / Staff** | `bypass` (`Thuần Việt`) | Bất kỳ (`vi` / `en`) | `vi` | Giữ nguyên câu gốc (`needsTranslation: false`), không dịch, không gọi TTS | Không phát TTS | Giữ `bypass` cho tới khi người dùng bấm `EN <-> VI` |

---

## 3. NGUYÊN NHÂN GỐC RỄ ĐÃ XÁC MINH TRONG CODE & RUNTIME

### 3.1. Treo cờ `isPlayingAudioRef` và `isAiSpeakingRef` (`MessengerVideoCallModal.jsx`)

- Khi `AudioContext` đang ở trạng thái `suspended` mà chưa có tương tác người dùng trực tiếp, Promise `ctx.resume()` treo vô thời hạn. Do đó `handleAudioFinished()` không bao giờ chạy, `isAiSpeakingRef.current` kẹt vĩnh viễn ở `true`, và mọi câu nói tiếp theo của Staff đều bị chặn bỏ.
- Giải pháp: Chỉ bật cờ phát khi audio thực sự bắt đầu phát, bổ sung watchdog timeout 400ms và fallback giải phóng hàng đợi.

### 3.2. Nhận diện sai khi khách nói xen kẽ hai ngôn ngữ

- Trước đây `recognition.lang` gán cứng `en-US` cho `role === 'guest'`. Khi khách nói tiếng Việt, bộ nhận diện nhận nhầm thành chuỗi ASCII vô nghĩa.
- Giải pháp: Bổ sung Audio-Based Bilingual STT Adapter chấm điểm âm học song song `vi-VN` và `en-US`, kết hợp nút chọn chế độ nghe trực tiếp.

### 3.3. Hiện tượng bất đối xứng âm thanh mộc WebRTC

1. Cả hai bên đều gắn AudioTrack từ micro vào kết nối P2P (`pc.addTrack(track, stream)`). Tiếng nói mộc thực tế luôn được phát đi từ cả hai phía.
2. Robot Kiosk chạy trên PC/Kiosk chạm: Trình duyệt đã ghi nhận User Gesture -> Thẻ `<video ref={remoteVideoRef}>` tự động mở loa và phát tiếng Việt mộc bình thường.
3. Trên iOS Safari / Mobile Browser của Staff: Autoplay policy chặn phát tự động âm thanh nếu chưa chạm trực tiếp vào thẻ video. Khi `remoteVideoRef.current.play()` ném lỗi `NotAllowedError`, mã nguồn đặt `remoteVideoRef.current.muted = true` để giữ luồng hình ảnh. Phụ đề text và giọng đọc AI (qua AudioContext riêng) vẫn chạy bình thường.
4. Cơ chế Audio Ducking: Tự động giảm âm lượng WebRTC đối phương xuống 15% trong suốt thời gian AI đọc bản dịch để tránh 2 thứ tiếng đè lẫn nhau, và tự động khôi phục lại khi AI dứt câu.

---

## 4. CƠ CHẾ STT ĐA NGỮ (BILINGUAL AUDIO STT) & GIỚI HẠN KỸ THUẬT

### 4.1. Kiến trúc thu âm và nhận diện

- **Call Audio Stream STT Adapter (`MessengerVideoCallModal.jsx`):**
  - Tách luồng âm thanh từ `localStreamRef.current.getAudioTracks()` vào một `AudioContext` `16000 Hz` riêng biệt với `ScriptProcessorNode` (`4096` mẫu/khung ~ 256 ms).
  - Theo dõi năng lượng âm thanh RMS (`calculateFrameRms`): bắt đầu ghi khi `rms >= 0.013` (kèm 1 khung pre-roll) và tự động cắt câu khi gặp khoảng lặng `>= 3` khung liên tiếp (`~768 ms`) hoặc đạt độ dài tối đa `~7.1 s`.
  - Đóng gói dữ liệu PCM Float32 thành file WAV 16-bit Mono chuẩn (`encodeWavBlobFromFloat32`) và gửi tới `POST /api/v1/ai/stt/transcribe`.
  - Khi dừng adapter (`stopCallAudioSttAdapter`), chỉ ngắt kết nối các node Web Audio nội bộ, không gọi `.stop()` lên audio track của `localStreamRef.current` để bảo toàn luồng thoại WebRTC.
- **Backend Bilingual STT (`backend/app/services/ai/stt_service.py`):**
  - Nếu `faster_whisper` có sẵn: dùng Whisper tự động phát hiện ngôn ngữ từ âm thanh (`language=None`).
  - Nếu `faster_whisper` không có sẵn: chạy song song 2 luồng `recognize_google(..., with_confidence=True)` cho `vi-VN` và `en-US` qua `ThreadPoolExecutor(max_workers=2)`.
  - Hàm `_score_bilingual_candidates` chấm điểm cả 2 ứng viên dựa trên độ tự tin âm học, dấu tiếng Việt, từ neo tiếng Việt so với tiếng Anh, và độ phủ từ.

### 4.2. Cơ chế chống trùng lặp (Deduplication)

- Khi `inputLangMode === 'auto'` và bộ thu âm Audio Stream VAD đang bắt được tín hiệu giọng nói thực tế (`lastAudioVadSpeechAtRef`), kết quả tạm từ `webkitSpeechRecognition` được giữ trong timer dự phòng `1250 ms`. Khi kết quả song ngữ từ `/api/v1/ai/stt/transcribe` trả về, hệ thống hủy timer dự phòng và chỉ commit duy nhất kết quả từ Audio STT.
- Mọi lời gọi `commitSpokenText` đều đi qua `evaluateSpokenTextCommit`: nếu cùng một nội dung đã được commit trong vòng `2200 ms`, lần gọi thứ hai bị từ chối với lý do `DUPLICATE_UTTERANCE`.

---

## 5. BẢNG MÃ LỖI CHUẨN HÓA & LÝ DO BỎ QUA CÂU NÓI

### 5.1. Mã lý do bỏ qua câu nói tại STT (`STT_SKIP_REASONS`)

| Mã lý do (`reason`) | Điều kiện kích hoạt | Ý nghĩa chẩn đoán |
| :--- | :--- | :--- |
| `EMPTY_TEXT` | `!text \|\| !text.trim()` | Chuỗi nhận diện rỗng hoặc chỉ chứa khoảng trắng. |
| `MIC_MUTED` | `isMicMutedRef.current === true` | Người dùng đang chủ động tắt micro trên modal cuộc gọi. |
| `CALL_NOT_CONNECTED` | `callStatusRef.current !== 'connected'` | Cuộc gọi chưa kết nối WebRTC hoặc đã kết thúc. |
| `ECHO_AI_SPEAKING` | `isAiSpeakingRef.current === true` | Loa thiết bị đang thực sự phát giọng đọc AI (`PLAY_STARTED` -> chưa `PLAY_ENDED`). |
| `ECHO_MATCHES_LAST_TTS` | Văn bản khớp/nằm trong `lastPlayedTtsTextRef` trong vòng `3.5 s` sau TTS | Micro thu lại đúng câu dịch mà loa vừa phát ra. |
| `ECHO_POST_TTS_TAIL` | Trong khoảng đuôi âm học `280 ms` sau `PLAY_ENDED` và câu ngắn (`<= 2` từ) hoặc trùng TTS | Chặn tiếng vang cuối câu của loa. |
| `DUPLICATE_UTTERANCE` | Nội dung chuẩn hóa trùng với câu vừa commit trong vòng `2200 ms` | Ngăn commit 2 lần cùng một câu nói từ 2 nguồn STT. |

### 5.2. Mã lỗi tổng hợp và phát âm thanh TTS (`TTS_ERROR_CODES`)

| Mã lỗi (`error_code`) | Nguồn phát sinh | Nguyên nhân & Hành vi xử lý |
| :--- | :--- | :--- |
| `TTS_INPUT_EMPTY` | Frontend (`aiApi.js`) / Backend (`tts_service.py`) | Văn bản cần đọc rỗng sau khi loại bỏ ký tự đặc biệt/markdown. |
| `TTS_TIMEOUT` | Frontend (`AbortController` `6.5 s`) / Backend (`asyncio.wait_for` `6.0 s`) | Quá thời gian chờ tổng hợp âm thanh. Kích hoạt retry hoặc fallback Google TTS. |
| `TTS_PROVIDER_ERROR` | Backend (`edge_tts` exception) / Frontend (Network error) | Lỗi từ provider TTS. Thực hiện retry/fallback. |
| `TTS_RESPONSE_INVALID` | Frontend (`aiApi.js`) | Phản hồi từ `/api/v1/ai/tts` không phải JSON hợp lệ hoặc thiếu `audio_base64`. |
| `TTS_AUDIO_EMPTY` | Backend / Frontend | Provider hoàn tất nhưng trả về 0 byte âm thanh. |
| `PLAYBACK_BLOCKED` | Frontend (`processAudioQueue`) | Trình duyệt chặn tự động phát. Mở khóa cờ và hiển thị nút Autoplay Unlock. |
| `PLAYBACK_DECODE_ERROR` | Frontend (`ctx.decodeAudioData`) | Dữ liệu âm thanh nhận được bị lỗi định dạng không thể giải mã. |

---

## 6. DANH SÁCH MODULE LIÊN QUAN

- `backend/app/schemas/ai.py`: Schema `TTSResponse` và `QuickTranslateResponse` có `error_code`, `error_detail`.
- `backend/app/services/ai/tts_service.py`: `synthesize_with_details()`, `_synthesize_edge_tts_detailed()`, Google TTS fallback.
- `backend/app/services/ai/stt_service.py`: `transcribe_audio_wav_detailed()` và `_score_bilingual_candidates()`.
- `backend/app/services/ai/translation_service.py`: `detect_language()`, tách `source_lang` và `target_lang`.
- `backend/app/api/v1/endpoints/ai.py`: Endpoints `/api/v1/ai/stt/transcribe` và `/api/v1/ai/tts`.
- `frontend/src/services/aiApi.js`: `synthesizeSpeech()`, `transcribeCallAudio()`.
- `frontend/src/components/video/videoCallTranslationHelpers.js`: Helpers `evaluateSpokenTextCommit`, `resolveTranslationTarget`, `encodeWavBlobFromFloat32`.
- `frontend/src/components/video/MessengerVideoCallModal.jsx`: Giao diện modal cuộc gọi WebRTC, audio STT adapter và hàng đợi phát bản dịch.
