import { describe, it, expect, beforeEach } from 'vitest';

describe('Speech Rate Control and Clamping Logic', () => {
  let mockStore = {};
  const mockStorage = {
    getItem: (key) => mockStore[key] || null,
    setItem: (key, value) => {
      mockStore[key] = String(value);
    },
    clear: () => {
      mockStore = {};
    },
  };

  const clampSpeechRate = (rate) => {
    const parsed = parseFloat(rate);
    return Math.max(0.5, Math.min(2.0, isNaN(parsed) ? 1.0 : parsed));
  };

  const loadSavedSpeechRate = (storage = mockStorage) => {
    try {
      const saved = storage.getItem('rora_speech_rate');
      return saved ? parseFloat(saved) : 1.0;
    } catch {
      return 1.0;
    }
  };

  const saveSpeechRate = (rate, storage = mockStorage) => {
    const clamped = clampSpeechRate(rate);
    storage.setItem('rora_speech_rate', clamped.toString());
    return clamped;
  };

  beforeEach(() => {
    mockStorage.clear();
  });

  it('defaults to 1.0 when storage is not set', () => {
    expect(loadSavedSpeechRate()).toBe(1.0);
  });

  it('correctly reads persisted speech rate from storage', () => {
    mockStorage.setItem('rora_speech_rate', '0.85');
    expect(loadSavedSpeechRate()).toBe(0.85);
  });

  it('saves and updates speech rate to storage', () => {
    const saved = saveSpeechRate(1.15);
    expect(saved).toBe(1.15);
    expect(mockStorage.getItem('rora_speech_rate')).toBe('1.15');
  });

  it('safely clamps rates below minimum (0.5x)', () => {
    const clamped = saveSpeechRate(0.2);
    expect(clamped).toBe(0.5);
    expect(mockStorage.getItem('rora_speech_rate')).toBe('0.5');
  });

  it('safely clamps rates above maximum (2.0x)', () => {
    const clamped = saveSpeechRate(3.0);
    expect(clamped).toBe(2.0);
    expect(mockStorage.getItem('rora_speech_rate')).toBe('2');
  });

  it('safely handles non-numeric values by defaulting to 1.0', () => {
    const clamped = saveSpeechRate('invalid');
    expect(clamped).toBe(1.0);
    expect(mockStorage.getItem('rora_speech_rate')).toBe('1');
  });
});
