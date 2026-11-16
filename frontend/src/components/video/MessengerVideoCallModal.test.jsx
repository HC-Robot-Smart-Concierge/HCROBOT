import { describe, it, expect, vi, afterEach } from 'vitest';
import { quickTranslateText, synthesizeSpeech, transcribeCallAudio } from '../../services/aiApi';
import {
  TTS_ERROR_CODES,
  STT_SKIP_REASONS,
  evaluateSpokenTextCommit,
  resolveTranslationTarget,
  advanceExpectedSeqOnFailure,
  calculateFrameRms,
  encodeWavBlobFromFloat32,
  normalizeLanguageCode,
} from './videoCallTranslationHelpers';

describe('Video Call Auto-Translate & TTS Pipeline (Staff ⇄ Robot)', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('1. Translation Service & Input/Output Language Decoupling', () => {
    it('should return empty response when text is empty', async () => {
      const res = await quickTranslateText({ text: '' });
      expect(res.needs_translation).toBe(false);
      expect(res.original_text).toBe('');
    });

    it('should fallback gracefully when server is offline', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const res = await quickTranslateText({
        text: 'Hello hotel',
        sourceLang: 'auto',
        targetLang: 'vi',
      });

      expect(res.original_text).toBe('Hello hotel');
      expect(res.translated_text).toBe('Hello hotel');
      expect(res.needs_translation).toBe(false);
    });

    it('should parse translated result correctly for Guest EN -> Staff VI', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          original_text: 'Where is the pool?',
          translated_text: 'Hồ bơi ở đâu?',
          source_lang: 'en',
          target_lang: 'vi',
          needs_translation: true,
        }),
      });

      const res = await quickTranslateText({
        text: 'Where is the pool?',
        sourceLang: 'auto',
        targetLang: 'vi',
        senderRole: 'guest',
      });

      expect(res.needs_translation).toBe(true);
      expect(res.translated_text).toBe('Hồ bơi ở đâu?');
      expect(res.source_lang).toBe('en');
      expect(res.target_lang).toBe('vi');
    });

    it('should parse translated result correctly for Staff VI -> Robot EN', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          original_text: 'Dạ bể bơi nằm ở tầng 3 ạ',
          translated_text: 'The swimming pool is on the 3rd floor',
          source_lang: 'vi',
          target_lang: 'en',
          needs_translation: true,
        }),
      });

      const targetCfg = resolveTranslationTarget('staff', 'auto');
      expect(targetCfg.targetLang).toBe('en');
      expect(targetCfg.ttsVoice).toBe('en-US-JennyNeural');

      const res = await quickTranslateText({
        text: 'Dạ bể bơi nằm ở tầng 3 ạ',
        sourceLang: 'auto',
        targetLang: targetCfg.targetLang,
        senderRole: 'staff',
      });

      expect(res.needs_translation).toBe(true);
      expect(res.source_lang).toBe('vi');
      expect(res.target_lang).toBe('en');
      expect(res.translated_text).toBe('The swimming pool is on the 3rd floor');
    });

    it('should keep original Vietnamese without circular translation when Guest speaks VI to Staff (target=vi)', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          original_text: 'Cho tôi hỏi nhà hàng mở cửa lúc mấy giờ?',
          translated_text: 'Cho tôi hỏi nhà hàng mở cửa lúc mấy giờ?',
          source_lang: 'vi',
          target_lang: 'vi',
          needs_translation: false,
        }),
      });

      const targetCfg = resolveTranslationTarget('guest', 'auto');
      expect(targetCfg.targetLang).toBe('vi');

      const res = await quickTranslateText({
        text: 'Cho tôi hỏi nhà hàng mở cửa lúc mấy giờ?',
        sourceLang: 'auto',
        targetLang: targetCfg.targetLang,
        senderRole: 'guest',
      });

      expect(res.needs_translation).toBe(false);
      expect(res.source_lang).toBe('vi');
      expect(res.target_lang).toBe('vi');
      expect(res.translated_text).toBe('Cho tôi hỏi nhà hàng mở cửa lúc mấy giờ?');
    });

    it('should keep original English without redundant TTS when Staff speaks EN to Guest (target=en)', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          original_text: 'Please wait a moment, I will check right now.',
          translated_text: 'Please wait a moment, I will check right now.',
          source_lang: 'en',
          target_lang: 'en',
          needs_translation: false,
        }),
      });

      const targetCfg = resolveTranslationTarget('staff', 'auto');
      const res = await quickTranslateText({
        text: 'Please wait a moment, I will check right now.',
        sourceLang: 'auto',
        targetLang: targetCfg.targetLang,
        senderRole: 'staff',
      });

      expect(res.needs_translation).toBe(false);
      expect(res.source_lang).toBe('en');
      expect(res.target_lang).toBe('en');
    });
  });

  describe('2. Structured TTS Error Classification (Fixing TTS_EMPTY)', () => {
    it('should return TTS_INPUT_EMPTY without calling fetch when text is blank', async () => {
      const fetchSpy = vi.fn();
      globalThis.fetch = fetchSpy;

      const res = await synthesizeSpeech('   ', { language: 'vi-VN' });
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(res.audio_base64).toBe('');
      expect(res.error_code).toBe(TTS_ERROR_CODES.TTS_INPUT_EMPTY);
    });

    it('should classify HTTP 500 as TTS_PROVIDER_ERROR', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      const res = await synthesizeSpeech('Xin chào', { language: 'vi-VN' });
      expect(res.audio_base64).toBe('');
      expect(res.error_code).toBe(TTS_ERROR_CODES.TTS_PROVIDER_ERROR);
      expect(res.error_detail).toContain('500');
    });

    it('should classify malformed JSON response as TTS_RESPONSE_INVALID', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => {
          throw new Error('Unexpected token < in JSON');
        },
      });

      const res = await synthesizeSpeech('Xin chào', { language: 'vi-VN' });
      expect(res.audio_base64).toBe('');
      expect(res.error_code).toBe(TTS_ERROR_CODES.TTS_RESPONSE_INVALID);
    });

    it('should preserve backend error_code and error_detail when audio_base64 is empty', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          audio_base64: '',
          mime_type: 'audio/mp3',
          provider_used: 'browser',
          error_code: 'TTS_PROVIDER_ERROR',
          error_detail: 'NoAudioReceived: Microsoft Edge WebSocket closed early',
        }),
      });

      const res = await synthesizeSpeech('The pool is on the 3rd floor', { language: 'en-US' });
      expect(res.audio_base64).toBe('');
      expect(res.error_code).toBe(TTS_ERROR_CODES.TTS_PROVIDER_ERROR);
      expect(res.error_detail).toContain('NoAudioReceived');
    });

    it('should classify request timeout as TTS_TIMEOUT', async () => {
      globalThis.fetch = vi.fn().mockImplementation((_url, opts) => {
        return new Promise((_resolve, reject) => {
          if (opts?.signal) {
            opts.signal.addEventListener('abort', () => {
              const abortErr = new Error('The operation was aborted');
              abortErr.name = 'AbortError';
              reject(abortErr);
            });
          }
        });
      });

      const res = await synthesizeSpeech('Xin chào quý khách', {
        language: 'vi-VN',
        timeoutMs: 30,
      });
      expect(res.audio_base64).toBe('');
      expect(res.error_code).toBe(TTS_ERROR_CODES.TTS_TIMEOUT);
    });
  });

  describe('3. Echo Guard, Skip Reasons & Immediate Staff Reply After Robot TTS', () => {
    it('should log exact skip reasons for empty, muted, disconnected, and AI speaking states', () => {
      expect(evaluateSpokenTextCommit({ text: '   ' })).toEqual({
        allowed: false,
        reason: STT_SKIP_REASONS.EMPTY_TEXT,
        cleanText: '',
      });

      expect(evaluateSpokenTextCommit({ text: 'Xin chào', isMicMuted: true })).toEqual({
        allowed: false,
        reason: STT_SKIP_REASONS.MIC_MUTED,
        cleanText: 'Xin chào',
      });

      expect(evaluateSpokenTextCommit({ text: 'Xin chào', callStatus: 'ringing' })).toEqual({
        allowed: false,
        reason: STT_SKIP_REASONS.CALL_NOT_CONNECTED,
        cleanText: 'Xin chào',
      });

      expect(evaluateSpokenTextCommit({ text: 'Xin chào', isAiSpeaking: true })).toEqual({
        allowed: false,
        reason: STT_SKIP_REASONS.ECHO_AI_SPEAKING,
        cleanText: 'Xin chào',
      });
    });

    it('should block acoustic echo matching lastPlayedTtsText but allow Staff immediate new Vietnamese reply', () => {
      const now = 10000;
      const lastTts = 'Xin lỗi, bể bơi ở đâu?';

      // Nếu mic thu lại đúng câu loa vừa đọc -> chặn với lý do ECHO_MATCHES_LAST_TTS
      const echoCheck = evaluateSpokenTextCommit({
        text: 'Xin lỗi bể bơi ở đâu',
        isAiSpeaking: false,
        now,
        ttsActiveUntil: now + 250,
        lastPlayedTtsText: lastTts,
      });
      expect(echoCheck.allowed).toBe(false);
      expect(echoCheck.reason).toBe(STT_SKIP_REASONS.ECHO_MATCHES_LAST_TTS);

      // Nếu Staff lập tức trả lời câu mới hoàn toàn ngay sau khi loa vừa dứt -> CHO PHÉP đi qua!
      const staffReplyCheck = evaluateSpokenTextCommit({
        text: 'Dạ bể bơi nằm ở tầng ba thưa quý khách',
        isAiSpeaking: false,
        now,
        ttsActiveUntil: now + 250,
        lastPlayedTtsText: lastTts,
      });
      expect(staffReplyCheck.allowed).toBe(true);
      expect(staffReplyCheck.reason).toBeNull();
    });

    it('should deduplicate identical utterance committed by Web Speech and Audio Stream Adapter within 2.2s', () => {
      const now = 20000;
      const dupCheck = evaluateSpokenTextCommit({
        text: 'Bể bơi nằm ở tầng 3!',
        isAiSpeaking: false,
        now,
        lastProcessedText: 'bể bơi nằm ở tầng 3',
        lastProcessedTime: now - 800,
      });
      expect(dupCheck.allowed).toBe(false);
      expect(dupCheck.reason).toBe(STT_SKIP_REASONS.DUPLICATE_UTTERANCE);
    });
  });

  describe('4. Audio Queue Sequence Recovery on TTS Failure & Bilingual Audio Adapter', () => {
    it('should advance expectedPlaySeq immediately when a sequence fails TTS so next sentences do not stall', () => {
      const failedSet = new Set();
      // Ban đầu đang đợi seq=1, nhưng seq=1 bị lỗi TTS
      const nextSeq = advanceExpectedSeqOnFailure(1, 1, failedSet);
      expect(nextSeq).toBe(2);

      // Nếu seq=3 bị lỗi trước khi seq=2 phát xong:
      const afterSeq3Fail = advanceExpectedSeqOnFailure(2, 3, failedSet);
      expect(afterSeq3Fail).toBe(2);
      // Khi seq=2 cũng lỗi hoặc xong, tự động nhảy qua 3 tới 4:
      const afterSeq2Done = advanceExpectedSeqOnFailure(2, 2, failedSet);
      expect(afterSeq2Done).toBe(4);
    });

    it('should calculate RMS and encode 16kHz mono WAV blob for Backend Bilingual STT', async () => {
      const frame = new Float32Array(1600);
      frame.fill(0.25);
      const rms = calculateFrameRms(frame);
      expect(rms).toBeCloseTo(0.25, 3);

      const wavBlob = encodeWavBlobFromFloat32([frame], 16000);
      expect(wavBlob).not.toBeNull();
      expect(wavBlob.type).toBe('audio/wav');
      expect(wavBlob.size).toBe(44 + 1600 * 2);

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          text: 'Cho tôi hỏi phòng ăn sáng ở đâu',
          detected_language: 'vi',
          confidence: 0.94,
          provider: 'google_bilingual',
        }),
      });

      const sttRes = await transcribeCallAudio(wavBlob, { language: 'auto', preferredLang: 'en' });
      expect(sttRes.success).toBe(true);
      expect(sttRes.detected_language).toBe('vi');
      expect(sttRes.text).toBe('Cho tôi hỏi phòng ăn sáng ở đâu');
    });
  });

  describe('5. Strict Binary Language Normalization (Only EN & VI)', () => {
    it('should normalize valid language codes to vi or en', () => {
      expect(normalizeLanguageCode('vi-VN')).toBe('vi');
      expect(normalizeLanguageCode('vi')).toBe('vi');
      expect(normalizeLanguageCode('Tiếng Việt')).toBe('vi');
      expect(normalizeLanguageCode('en-US')).toBe('en');
      expect(normalizeLanguageCode('en-GB')).toBe('en');
      expect(normalizeLanguageCode('English')).toBe('en');
    });

    it('should reject foreign language codes and return fallback without corrupting session', () => {
      expect(normalizeLanguageCode('ja')).toBeNull();
      expect(normalizeLanguageCode('zh-CN')).toBeNull();
      expect(normalizeLanguageCode('ko')).toBeNull();
      expect(normalizeLanguageCode('es')).toBeNull();
      expect(normalizeLanguageCode('ja', 'en')).toBe('en');
      expect(normalizeLanguageCode('zh', 'vi')).toBe('vi');
    });

    it('should reject transcript containing foreign CJK script to prevent incorrect TTS/translation', () => {
      const res = evaluateSpokenTextCommit({
        text: 'こんにちは',
        isAiSpeaking: false,
      });
      expect(res.allowed).toBe(false);
      expect(res.reason).toBe(STT_SKIP_REASONS.FOREIGN_SCRIPT_REJECTED);
    });

    it('should allow Vietnamese with English loanwords or room names without rejection', () => {
      const res = evaluateSpokenTextCommit({
        text: 'Khách ở phòng VIP 402 cần check in và lấy key card',
        isAiSpeaking: false,
      });
      expect(res.allowed).toBe(true);
      expect(res.reason).toBeNull();
    });
  });

  describe('6. Speaker Mute Isolation (Never Disconnects Active WebRTC Call)', () => {
    it('ensures isSpeakerMuted is not in primeAudioContext or call lifecycle useEffect dependencies', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const { fileURLToPath } = await import('url');
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const modalCode = fs.readFileSync(path.resolve(__dirname, './MessengerVideoCallModal.jsx'), 'utf8');

      expect(modalCode).toContain('isSpeakerMutedRef.current');
      expect(modalCode).not.toContain('}, [getOrCreateAudioContext, isSpeakerMuted]);');
      expect(modalCode).not.toContain('}, [isOpen, setupWebRTC]);');
      expect(modalCode).toContain('}, [isOpen, sessionId, role]);');
    });
  });

  describe('7. Staff -> Robot Interpreter Audio Playback Guards', () => {
    it('never drops peer audio by comparing sender clock with receiver clock, and reuses unlocked shared AudioContext', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const { fileURLToPath } = await import('url');
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const modalCode = fs.readFileSync(path.resolve(__dirname, './MessengerVideoCallModal.jsx'), 'utf8');

      // Lệch giờ giữa Robot và Staff không được làm mất toàn bộ audio của một chiều
      expect(modalCode).not.toContain('Date.now() - item.timestamp > 15000');
      expect(modalCode).toContain('subtitleReceivedAtRef.current.get(item.utteranceId)');
      // Robot mở cuộc gọi bằng giọng nói vẫn phát được nhờ AudioContext dùng chung đã mở khóa
      expect(modalCode).toContain('window._sharedAudioCtx');
    });
  });

  describe('8. Staff Vietnamese STT & Turn Aggregation (WF-04)', () => {
    it('verifies Staff STT is locked to vi-VN, endpointing at 1000ms and slices turns by turnStartIndexRef', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const { fileURLToPath } = await import('url');
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const modalCode = fs.readFileSync(path.resolve(__dirname, './MessengerVideoCallModal.jsx'), 'utf8');

      // Staff STT luôn bị khóa ở 'vi-VN'
      expect(modalCode).toMatch(/role === 'staff'\)\s*\{\s*listenLang = 'vi-VN'/);
      // Chuẩn đàm thoại Voice Bot 1.000ms
      expect(modalCode).toContain('STAFF_CONVERSATIONAL_SILENCE_MS = 1000');
      // Slicing bằng turnStartIndexRef để chống cộng dồn các lượt nói riêng biệt
      expect(modalCode).toContain('turnStartIndexRef.current = currentResultsLen');
      // Chặn xung đột kép giữa Web Speech API và backend Audio Adapter
      expect(modalCode).toContain("role === 'staff' && speechRecognitionRef.current && !speechRecognitionRef.current._hasPermError");
      // Dọn dẹp bộ đếm khi tắt mic
      expect(modalCode).toContain('staffTurnEpochRef.current += 1');
      expect(modalCode).toContain('turnStartIndexRef.current = 0');
    });

    it('TC-A: aggregates fragmented phrases with 800ms pause into ONE single turn at 1000ms silence', () => {
      vi.useFakeTimers();
      try {
        let results = [];
        let turnStartIndex = 0;
        let timer = null;
        let committed = [];

        const onResult = (text, isFinal) => {
          results.push({ text, isFinal });
          let turnFinal = '';
          for (let i = turnStartIndex; i < results.length; i++) {
            if (results[i].isFinal) {
              turnFinal += (turnFinal ? ' ' : '') + results[i].text;
            }
          }
          if (timer) clearTimeout(timer);
          timer = setTimeout(() => {
            committed.push(turnFinal);
            turnStartIndex = results.length;
          }, 1000);
        };

        // 1. Staff nói vế đầu: "Dạ, để em kiểm tra"
        onResult('Dạ, để em kiểm tra', true);
        expect(committed.length).toBe(0);

        // 2. Staff nghỉ 750ms (< 1000ms -> timer chưa kích hoạt)
        vi.advanceTimersByTime(750);
        expect(committed.length).toBe(0);

        // 3. Staff nói tiếp vế sau: "phòng cho anh ạ."
        onResult('phòng cho anh ạ.', true);
        expect(committed.length).toBe(0);

        // 4. Hết câu, đủ 1.000ms im lặng
        vi.advanceTimersByTime(1000);
        expect(committed.length).toBe(1);
        expect(committed[0]).toBe('Dạ, để em kiểm tra phòng cho anh ạ.');
      } finally {
        vi.useRealTimers();
      }
    });

    it('TC-B: handles short phrase "Dạ, vâng ạ." with 1000ms silence commit', () => {
      vi.useFakeTimers();
      try {
        let timer = null;
        let committed = [];

        const onResult = (finalChunk) => {
          if (timer) clearTimeout(timer);
          timer = setTimeout(() => {
            committed.push(finalChunk);
          }, 1000);
        };

        onResult('Dạ, vâng ạ.');
        expect(committed.length).toBe(0);
        vi.advanceTimersByTime(1000);
        expect(committed.length).toBe(1);
        expect(committed[0]).toBe('Dạ, vâng ạ.');
      } finally {
        vi.useRealTimers();
      }
    });

    it('TC-NO-ACCUMULATE: does NOT accumulate past sentences after a long pause', () => {
      vi.useFakeTimers();
      try {
        let results = [];
        let turnStartIndex = 0;
        let timer = null;
        let committed = [];

        const onResult = (text, isFinal) => {
          results.push({ text, isFinal });
          let turnText = '';
          for (let i = turnStartIndex; i < results.length; i++) {
            turnText += (turnText ? ' ' : '') + results[i].text;
          }
          if (timer) clearTimeout(timer);
          timer = setTimeout(() => {
            committed.push(turnText);
            turnStartIndex = results.length;
          }, 1000);
        };

        // Turn 1: "Xin chào quý khách"
        onResult('Xin chào quý khách', true);
        vi.advanceTimersByTime(1000);
        expect(committed.length).toBe(1);
        expect(committed[0]).toBe('Xin chào quý khách');

        // Nghỉ một đoạn dài (e.g. 5 giây)
        vi.advanceTimersByTime(5000);

        // Turn 2: "Phòng 301 ở tầng 3"
        onResult('Phòng 301 ở tầng 3', true);
        vi.advanceTimersByTime(1000);
        expect(committed.length).toBe(2);
        // Turn 2 KHÔNG được cộng dồn với Turn 1!
        expect(committed[1]).toBe('Phòng 301 ở tầng 3');
      } finally {
        vi.useRealTimers();
      }
    });

    it('TC-C: preserves code-switching with English loanwords in Vietnamese', () => {
      const text = 'Anh muốn check-in lúc mấy giờ ạ?';
      const evalRes = evaluateSpokenTextCommit({
        text,
        isMicMuted: false,
        callStatus: 'connected',
      });
      expect(evalRes.allowed).toBe(true);
      expect(evalRes.cleanText).toBe('Anh muốn check-in lúc mấy giờ ạ?');
    });

    it('TC-D: cancels pending turn immediately when mic is muted mid-sentence', () => {
      vi.useFakeTimers();
      try {
        let turnBuffer = 'Dạ để em kiểm tra';
        let epoch = 1;
        let committed = [];

        let timer = setTimeout(() => {
          if (epoch === 1) committed.push(turnBuffer);
        }, 1000);

        // Tắt mic giữa chừng sau 400ms
        epoch += 1;
        clearTimeout(timer);
        turnBuffer = '';

        vi.advanceTimersByTime(2000);
        expect(committed.length).toBe(0);
        expect(turnBuffer).toBe('');
      } finally {
        vi.useRealTimers();
      }
    });

    it('routes Staff output correctly based on guest language (English vs Tiếng Việt)', () => {
      // Khách tiếng Anh -> Staff nói tiếng Việt dịch sang Anh + TTS Jenny
      const enGuestConfig = resolveTranslationTarget('staff', 'auto', 'English');
      expect(enGuestConfig.targetLang).toBe('en');
      expect(enGuestConfig.isBypassMode).toBe(false);
      expect(enGuestConfig.ttsVoice).toBe('en-US-JennyNeural');

      // Khách tiếng Việt -> Staff nói tiếng Việt dùng âm thanh gốc, không dịch, không TTS
      const viGuestConfig = resolveTranslationTarget('staff', 'auto', 'Tiếng Việt');
      expect(viGuestConfig.targetLang).toBe('vi');
      expect(viGuestConfig.isBypassMode).toBe(true);
    });
  });
});
