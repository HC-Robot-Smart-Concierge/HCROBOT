import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect } from 'vitest';
import { AdminKnowledgePersonaTab } from '../knowledge/AdminKnowledgePersonaTab';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('AdminKnowledgePersonaTab Component & Minimal Theme Tests', () => {
  const componentPath = path.resolve(__dirname, '../knowledge/AdminKnowledgePersonaTab.jsx');
  const content = fs.readFileSync(componentPath, 'utf8');

  it('exports AdminKnowledgePersonaTab as a valid React functional component', () => {
    expect(typeof AdminKnowledgePersonaTab).toBe('function');
    expect(AdminKnowledgePersonaTab.name).toBe('AdminKnowledgePersonaTab');
  });

  it('contains branding fields: robot name, hotel name, and star rating', () => {
    expect(content).toContain('bot_name');
    expect(content).toContain('hotel_name');
    expect(content).toContain('star_rating');
    expect(content).toContain('tone_style');
  });

  it('contains Vietnamese address pronouns and QR call-to-action fields', () => {
    expect(content).toContain('pronoun_bot_vi');
    expect(content).toContain('pronoun_guest_vi');
    expect(content).toContain('qr_cta_vi');
    expect(content).toContain('qr_cta_en');
  });

  it('contains emotional empathy and out-of-scope refusal scripts', () => {
    expect(content).toContain('unhappy_empathy_vi');
    expect(content).toContain('unhappy_empathy_en');
    expect(content).toContain('out_of_scope_vi');
    expect(content).toContain('out_of_scope_en');
  });

  it('integrates unified TTS voice and speech rate controls', () => {
    expect(content).toContain('speech_rate');
    expect(content).toContain('vi_voice');
    expect(content).toContain('en_voice');
  });

  it('complies with system warm-beige theme and black button style', () => {
    expect(content).toContain('#FAF8F5');
    expect(content).toContain('#E9E5DC');
    expect(content).toContain('#262626');
    expect(content).toContain('#BFBFBD');
  });

  it('guarantees zero emoji characters in AdminKnowledgePersonaTab', () => {
    const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    expect(emojiRegex.test(content)).toBe(false);
  });
});
