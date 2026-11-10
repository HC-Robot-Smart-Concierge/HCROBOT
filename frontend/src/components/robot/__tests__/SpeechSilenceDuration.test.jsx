import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect } from 'vitest';
import {
  useSpeechRecognition,
  SPEECH_FINAL_SILENCE_MS,
  INTERIM_FINALIZE_DEBOUNCE_MS,
  HARDWARE_VAD_SILENCE_MS,
  EXTENDED_INCOMPLETE_SILENCE_MS,
  getSemanticSilenceDebounce,
} from '../../../hooks/useSpeechRecognition';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Speech Recognition Silence Duration & Anti-Cutoff Tests', () => {
  it('exports useSpeechRecognition as a custom hook function', () => {
    expect(typeof useSpeechRecognition).toBe('function');
  });

  it('configures natural conversational silence duration thresholds >= 1800ms', () => {
    // Thời gian chờ im lặng khi trình duyệt báo isFinal phải >= 1.8s để tránh cướp lời khi khách lấy hơi
    expect(SPEECH_FINAL_SILENCE_MS).toBeGreaterThanOrEqual(1800);
    expect(SPEECH_FINAL_SILENCE_MS).toBe(1800);

    // Thời gian chờ khi ở chế độ interim (Safari/iOS) >= 2.0s
    expect(INTERIM_FINALIZE_DEBOUNCE_MS).toBeGreaterThanOrEqual(2000);
    expect(INTERIM_FINALIZE_DEBOUNCE_MS).toBe(2200);

    // Thời gian chờ VAD của phần cứng thu âm Whisper >= 2.0s
    expect(HARDWARE_VAD_SILENCE_MS).toBeGreaterThanOrEqual(2000);
    expect(HARDWARE_VAD_SILENCE_MS).toBe(2000);
  });

  it('guarantees useSpeechRecognition debounces isFinal instead of cutting off immediately', () => {
    const filePath = path.resolve(__dirname, '../../../hooks/useSpeechRecognition.js');
    const content = fs.readFileSync(filePath, 'utf8');

    // Không được gọi commitFinalTranscript ngay tức thì trong nhánh isCurrentFinal
    expect(content).not.toContain('if (isCurrentFinal) {\n            commitFinalTranscript(trimmed);');
    expect(content).toContain('SPEECH_FINAL_SILENCE_MS');
    expect(content).toContain('clearSpeechFinalizeTimer();');
  });

  it('verifies RobotScreenPage silence debounce duration is increased to 1800ms', () => {
    const filePath = path.resolve(__dirname, '../../../pages/robot/RobotScreenPage.jsx');
    const content = fs.readFileSync(filePath, 'utf8');

    // Không còn dùng 650ms gây ngắt lời khách
    expect(content).not.toContain('}, 650);');
    expect(content).toContain('}, 1800);');
  });

  it('adaptively extends silence debounce for incomplete or hesitation utterances', () => {
    // Các câu còn dở dang / cụm mở đầu / từ nối ngập ngừng phải chờ 2800ms
    const incompleteQueries = [
      'Cho tôi hỏi',
      'Cho em hỏi',
      'Em ơi',
      'Tôi muốn',
      'Tôi cần',
      'Khách sạn có',
      'Và',
      'Phòng 401 bị',
    ];

    incompleteQueries.forEach((query) => {
      expect(getSemanticSilenceDebounce(query, true)).toBe(EXTENDED_INCOMPLETE_SILENCE_MS);
      expect(getSemanticSilenceDebounce(query, true)).toBe(2800);
    });

    // Các câu hỏi / mệnh lệnh hoàn chỉnh ngữ nghĩa chờ 1800ms (hoặc 2200ms cho interim)
    const completeQueries = [
      'Hồ bơi ở đâu',
      'Cho tôi hỏi phòng gym ở đâu',
      'Khách sạn có dịch vụ giặt ủi không',
      'Mấy giờ phục vụ ăn sáng',
      'Chỉ đường lên phòng 401 giúp tôi',
    ];

    completeQueries.forEach((query) => {
      expect(getSemanticSilenceDebounce(query, true)).toBe(SPEECH_FINAL_SILENCE_MS);
      expect(getSemanticSilenceDebounce(query, true)).toBe(1800);
    });
  });

  it('ensures no emojis exist in modified speech recognition files', () => {
    const files = [
      path.resolve(__dirname, '../../../hooks/useSpeechRecognition.js'),
      path.resolve(__dirname, '../../../pages/robot/RobotScreenPage.jsx'),
    ];

    const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    files.forEach((file) => {
      const content = fs.readFileSync(file, 'utf8');
      expect(emojiRegex.test(content)).toBe(false);
    });
  });
});
