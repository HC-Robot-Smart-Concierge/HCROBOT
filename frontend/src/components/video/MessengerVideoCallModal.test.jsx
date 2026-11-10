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
});
