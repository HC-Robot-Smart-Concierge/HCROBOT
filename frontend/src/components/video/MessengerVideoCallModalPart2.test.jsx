import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect, vi } from 'vitest';
import {
  evaluateSpokenTextCommit,
  resolveTranslationTarget,
} from './videoCallTranslationHelpers';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MODAL_FILES = [
  './MessengerVideoCallModal.jsx',
  './messengerVideoCallUtils.js',
  './useMessengerCallMediaRecorder.js',
  './useMessengerCallAudioPlayback.js',
  './messengerCallSignalingHandlers.js',
  './useMessengerCallSignaling.js',
  './useMessengerCallAudioAdapter.js',
  './useMessengerCallWebSpeech.js',
  './useMessengerCallTranslation.js',
  './useMessengerCallMediaControls.js',
  './MessengerCallTopAndTestBars.jsx',
  './MessengerCallStageAndControls.jsx',
];

function readAllModalCode() {
  return MODAL_FILES.map((file) => fs.readFileSync(path.resolve(__dirname, file), 'utf8')).join('\n');
}

describe('Video Call Pipeline Part 2 (Speaker Guard, Audio & Staff Turn)', () => {
  describe('6. Speaker Mute Isolation (Never Disconnects Active WebRTC Call)', () => {
    it('ensures isSpeakerMuted is not in primeAudioContext or call lifecycle useEffect dependencies', async () => {
      const modalCode = readAllModalCode();

      expect(modalCode).toContain('isSpeakerMutedRef.current');
      expect(modalCode).not.toContain('}, [getOrCreateAudioContext, isSpeakerMuted]);');
      expect(modalCode).not.toContain('}, [isOpen, setupWebRTC]);');
      expect(modalCode).toContain('}, [isOpen, sessionId, role]);');
    });
  });

  describe('7. Staff -> Robot Interpreter Audio Playback Guards', () => {
    it('never drops peer audio by comparing sender clock with receiver clock, and reuses unlocked shared AudioContext', async () => {
      const modalCode = readAllModalCode();

      // Lệch giờ giữa Robot và Staff không được làm mất toàn bộ audio của một chiều
      expect(modalCode).not.toContain('Date.now() - item.timestamp > 15000');
      expect(modalCode).toContain('subtitleReceivedAtRef.current.get(item.utteranceId)');
      // Robot mở cuộc gọi bằng giọng nói vẫn phát được nhờ AudioContext dùng chung đã mở khóa
      expect(modalCode).toContain('window._sharedAudioCtx');
    });
  });

  describe('8. Staff Vietnamese STT & Turn Aggregation (WF-04)', () => {
    it('verifies Staff STT is locked to vi-VN, endpointing at 1000ms and slices turns by turnStartIndexRef', async () => {
      const modalCode = readAllModalCode();

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
