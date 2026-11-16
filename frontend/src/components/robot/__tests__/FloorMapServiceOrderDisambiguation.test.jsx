import { describe, it, expect } from 'vitest';
import { detectDestinationPoi } from '../FloorMap';

describe('detectDestinationPoi Service Order vs Navigation Disambiguation', () => {
  it('does NOT trigger navigation for service requests with room numbers', () => {
    const serviceQueries = [
      'Cho tôi 2 chai nước lên phòng 401',
      'Mang 2 chai nước lên phòng 401',
      'Giao 2 chai nước suối lên phòng 401',
      'Cho anh 2 khăn tắm lên phòng 402',
      'Tôi cần mượn bàn ủi phòng 305',
      'Dọn phòng 401 giúp tôi',
      'Giao 1 tô phở lên phòng 408',
      'Cho mượn máy sấy tóc phòng 301',
      'Gửi thêm 1 gối lên phòng 405'
    ];

    serviceQueries.forEach((query) => {
      const dest = detectDestinationPoi(query, null);
      expect(dest).toBeNull();
    });
  });

  it('triggers navigation for explicit wayfinding queries to rooms', () => {
    expect(detectDestinationPoi('Chỉ đường lên phòng 401', null)).toBe('room_401');
    expect(detectDestinationPoi('Phòng 401 ở đâu', null)).toBe('room_401');
    expect(detectDestinationPoi('Lối đi lên phòng 302', null)).toBe('room_302');
    expect(detectDestinationPoi('Cho tôi hỏi đường lên phòng 401', null)).toBe('room_401');
    expect(detectDestinationPoi('Đường đến phòng 410', null)).toBe('room_410');
  });
});

