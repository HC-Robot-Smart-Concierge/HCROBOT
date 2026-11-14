import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect } from 'vitest';
import { EmotionAssistanceModal } from '../EmotionAssistanceModal';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('EmotionAssistanceModal Contract & Minimalist Tone Tests', () => {
  const modalPath = path.resolve(__dirname, '../EmotionAssistanceModal.jsx');
  const modalContent = fs.readFileSync(modalPath, 'utf8');

  it('exports EmotionAssistanceModal as a valid React functional component', () => {
    expect(typeof EmotionAssistanceModal).toBe('function');
    expect(EmotionAssistanceModal.name).toBe('EmotionAssistanceModal');
  });

  it('contains dual actions for Concierge dispatch and dismissal', () => {
    expect(modalContent).toContain('Gọi Nhân Viên Concierge');
    expect(modalContent).toContain('Call Concierge Staff');
    expect(modalContent).toContain('Không, tôi tự xử lý được. Cảm ơn');
    expect(modalContent).toContain('No, I am fine. Thank you');
  });

  it('supports voice recognition hint and countdown auto-close', () => {
    expect(modalContent).toContain('Quý khách có thể nói "Có" hoặc "Không"');
    expect(modalContent).toContain('Voice recognition enabled');
    expect(modalContent).toContain('autoCloseSeconds');
  });

  it('guarantees zero emoji characters in EmotionAssistanceModal', () => {
    const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    expect(emojiRegex.test(modalContent)).toBe(false);
  });
});
