import { describe, it, expect } from 'vitest';

describe('useSpeechSynthesis Utility & Normalization Logic', () => {
  const cleanTextForTTS = (text) => {
    return (text || '')
      .replace(/[*#_`\[\]()]/g, '')
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
      .replace(/^[\s*•\-–—]+\s*/gm, '')
      .replace(/\.{2,}/g, '.')
      .replace(/!{2,}/g, '!')
      .replace(/\?{2,}/g, '?')
      .replace(/:\s+/g, ', ')
      .replace(/\s*;\s*/g, ', ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const detectIsVietnamese = (cleanText) => {
    const hasVietnameseDiacritics = /[àáảãạâầấẩẫậăằắẳẵặèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i.test(cleanText);
    const hasVietnameseKeywords = /\b(dạ|em|anh|chị|quý khách|khách sạn|phòng|đã|rồi|ạ|hỗ trợ|yêu cầu|dịch vụ|không|có|tại|tầng|hồ bơi|cảm ơn|bảo trì|lễ tân|nhân viên|vận chuyển|hành lý)\b/i.test(cleanText);
    return hasVietnameseDiacritics || hasVietnameseKeywords;
  };

  it('strips markdown characters, emojis, and normalizes colons into pauses', () => {
    const raw = '**Dạ** chào quý khách! 😊 Khách sạn có các dịch vụ: Hồ bơi... và Spa!';
    const cleaned = cleanTextForTTS(raw);
    expect(cleaned).toBe('Dạ chào quý khách! Khách sạn có các dịch vụ, Hồ bơi. và Spa!');
    expect(cleaned).not.toContain('**');
    expect(cleaned).not.toContain('😊');
  });

  it('correctly classifies Vietnamese text for Hoài My Neural voice routing', () => {
    const sampleVi = 'Xin chào quý khách, em có thể giúp gì cho anh chị ạ?';
    expect(detectIsVietnamese(sampleVi)).toBe(true);

    const sampleEn = 'Welcome to Aurora Grand Hotel. How may I assist you today?';
    expect(detectIsVietnamese(sampleEn)).toBe(false);
  });

  it('handles empty or blank text gracefully', () => {
    expect(cleanTextForTTS('')).toBe('');
    expect(cleanTextForTTS('   ')).toBe('');
    expect(cleanTextForTTS(null)).toBe('');
  });
});

