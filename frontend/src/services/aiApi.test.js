import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendChatPrompt, extractIntent } from './aiApi';

describe('aiApi Service Integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should send chat prompt and return AI response successfully', async () => {
    const mockApiResponse = {
      response: 'Hồ bơi nằm ở tầng 4 của khách sạn.',
      model_used: 'qwen2.5:7b-instruct',
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse,
    });

    const res = await sendChatPrompt('Hồ bơi ở đâu?');
    expect(fetch).toHaveBeenCalledWith('/api/v1/ai/chat', expect.any(Object));
    expect(res.response).toBe('Hồ bơi nằm ở tầng 4 của khách sạn.');
  });

  it('should extract intent successfully from user speech', async () => {
    const mockIntentResponse = {
      action: 'deliver_towel',
      room_number: '402',
      items: ['khăn tắm'],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockIntentResponse,
    });

    const res = await extractIntent('Mang khăn tắm lên phòng 402');
    expect(fetch).toHaveBeenCalledWith('/api/v1/ai/intent', expect.any(Object));
    expect(res.action).toBe('deliver_towel');
    expect(res.room_number).toBe('402');
  });

  it('should return error message when API call fails', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const res = await sendChatPrompt('Xin chào');
    expect(res.response).toContain('gián đoạn kết nối');
    expect(res.error).toBe('Network error');
  });
});
