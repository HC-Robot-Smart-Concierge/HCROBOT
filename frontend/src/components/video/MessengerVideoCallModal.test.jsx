import { describe, it, expect, vi } from 'vitest';
import { quickTranslateText } from '../../services/aiApi';

describe('Video Call Auto-Translate Service', () => {
  it('should return empty response when text is empty', async () => {
    const res = await quickTranslateText({ text: '' });
    expect(res.needs_translation).toBe(false);
    expect(res.original_text).toBe('');
  });

  it('should fallback gracefully when server is offline', async () => {
    // Mock fetch failure
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const res = await quickTranslateText({
      text: 'Hello hotel',
      sourceLang: 'auto',
      targetLang: 'vi',
    });

    expect(res.original_text).toBe('Hello hotel');
    expect(res.translated_text).toBe('Hello hotel');
    expect(res.needs_translation).toBe(false);

    globalThis.fetch = originalFetch;
  });

  it('should parse translated result correctly from backend', async () => {
    const originalFetch = globalThis.fetch;
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
      sourceLang: 'en',
      targetLang: 'vi',
    });

    expect(res.needs_translation).toBe(true);
    expect(res.translated_text).toBe('Hồ bơi ở đâu?');
    expect(res.source_lang).toBe('en');

    globalThis.fetch = originalFetch;
  });
});
