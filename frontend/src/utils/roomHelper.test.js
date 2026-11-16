import { describe, it, expect } from 'vitest';
import { extractSpokenRoomNumber } from './roomHelper';

describe('extractSpokenRoomNumber', () => {
  it('extracts direct room numbers with prefixes', () => {
    expect(extractSpokenRoomNumber('order đồ ăn vô phòng 301')).toBe('301');
    expect(extractSpokenRoomNumber('Tôi muốn order đồ ăn lên phòng 301')).toBe('301');
    expect(extractSpokenRoomNumber('đặt đồ ăn vào phòng 402')).toBe('402');
    expect(extractSpokenRoomNumber('cho phòng 503 một suất cơm')).toBe('503');
    expect(extractSpokenRoomNumber('gửi 2 khăn tắm lên phòng 301')).toBe('301');
    expect(extractSpokenRoomNumber('room 402 please')).toBe('402');
  });

  it('extracts spoken Vietnamese room words', () => {
    expect(extractSpokenRoomNumber('Tôi muốn order đồ ăn lên phòng ba lẻ một')).toBe('301');
    expect(extractSpokenRoomNumber('Tôi muốn order đồ ăn lên phòng ba lẻ 1')).toBe('301');
    expect(extractSpokenRoomNumber('vô phòng ba không một')).toBe('301');
    expect(extractSpokenRoomNumber('phòng ba trăm lẻ một')).toBe('301');
    expect(extractSpokenRoomNumber('đặt món lên phòng bốn lẻ hai')).toBe('402');
    expect(extractSpokenRoomNumber('phòng năm lẻ ba')).toBe('503');
  });

  it('extracts staying phrases', () => {
    expect(extractSpokenRoomNumber('Tôi ở phòng 301')).toBe('301');
    expect(extractSpokenRoomNumber('mình ở 402 nha')).toBe('402');
  });

  it('returns null when no room number is mentioned', () => {
    expect(extractSpokenRoomNumber('Tôi muốn đặt đồ ăn')).toBeNull();
    expect(extractSpokenRoomNumber('cho tôi xem menu')).toBeNull();
    expect(extractSpokenRoomNumber('')).toBeNull();
    expect(extractSpokenRoomNumber(null)).toBeNull();
  });
});

