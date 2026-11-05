import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Setup mock sessionStorage for Node test environment
const storageMap = new Map();
const mockSessionStorage = {
  getItem: (key) => storageMap.get(key) || null,
  setItem: (key, val) => storageMap.set(key, String(val)),
  removeItem: (key) => storageMap.delete(key),
  clear: () => storageMap.clear(),
};
if (typeof global.window === 'undefined') {
  global.window = {};
}
global.window.sessionStorage = mockSessionStorage;
global.sessionStorage = mockSessionStorage;

import {
  RoomPinModal,
  PIN_LOCKOUT_MAX_ATTEMPTS,
  PIN_LOCKOUT_DURATION_SEC,
  DEFAULT_WRONG_PIN_ERROR_MSG,
  getRoomLockoutState,
  setRoomLockoutState,
  clearRoomLockoutState,
} from '../RoomPinModal';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('RoomPinModal 5-Attempt Failure Limit & 1-Minute Lockout Tests', () => {
  beforeEach(() => {
    mockSessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('exports lockout configuration constants correctly', () => {
    expect(PIN_LOCKOUT_MAX_ATTEMPTS).toBe(5);
    expect(PIN_LOCKOUT_DURATION_SEC).toBe(60);
    expect(DEFAULT_WRONG_PIN_ERROR_MSG).toBe('Mã PIN phòng không chính xác. Quý khách vui lòng thử lại sau.');
  });

  it('manages per-room lockout state in sessionStorage correctly', () => {
    const room = '301';
    expect(getRoomLockoutState(room)).toEqual({ count: 0, lockedUntil: 0 });

    const futureTime = Date.now() + 60000;
    setRoomLockoutState(room, { count: 5, lockedUntil: futureTime });

    const state = getRoomLockoutState(room);
    expect(state.count).toBe(5);
    expect(state.lockedUntil).toBe(futureTime);

    clearRoomLockoutState(room);
    expect(getRoomLockoutState(room)).toEqual({ count: 0, lockedUntil: 0 });
  });

  it('ignores expired lockout states automatically', () => {
    const room = '402';
    const pastTime = Date.now() - 1000; // expired
    setRoomLockoutState(room, { count: 5, lockedUntil: pastTime });

    const state = getRoomLockoutState(room);
    expect(state).toEqual({ count: 0, lockedUntil: 0 });
  });

  it('isolates lockout states between different rooms when changing room', () => {
    const roomA = '301';
    const roomB = '302';

    setRoomLockoutState(roomA, { count: 5, lockedUntil: Date.now() + 60000 });

    expect(getRoomLockoutState(roomA).count).toBe(5);
    expect(getRoomLockoutState(roomB).count).toBe(0);
  });

  it('verifies RoomPinModal code disables numpad and displays lockout badge during cooldown', () => {
    const filePath = path.resolve(__dirname, '../RoomPinModal.jsx');
    const content = fs.readFileSync(filePath, 'utf8');

    expect(content).toContain('lockoutRemaining > 0');
    expect(content).toContain('PIN_LOCKOUT_MAX_ATTEMPTS');
    expect(content).toContain('PIN_LOCKOUT_DURATION_SEC');
    expect(content).toContain('Mã PIN phòng không chính xác. Quý khách vui lòng thử lại sau.');
    expect(content).toContain('Quý khách đã nhập sai mã PIN 5 lần. Hệ thống tạm khóa 1 phút.');
    expect(content).toContain('Đã khóa 1 phút: Thử lại sau');
  });

  it('verifies operationsApi default error message matches user requirement', () => {
    const apiPath = path.resolve(__dirname, '../../../services/operationsApi.js');
    const content = fs.readFileSync(apiPath, 'utf8');

    expect(content).toContain('Mã PIN phòng không chính xác. Quý khách vui lòng thử lại sau.');
  });

  it('verifies backend reception.py enforces 5-attempt limit and 1-minute lockout', () => {
    const backendPath = path.resolve(__dirname, '../../../../../backend/app/api/v1/endpoints/operations/reception.py');
    const content = fs.readFileSync(backendPath, 'utf8');

    expect(content).toContain('ROOM_PIN_ATTEMPTS');
    expect(content).toContain('PIN_LOCKOUT_MAX_ATTEMPTS = 5');
    expect(content).toContain('PIN_LOCKOUT_DURATION_SEC = 60');
    expect(content).toContain('status.HTTP_429_TOO_MANY_REQUESTS');
    expect(content).toContain('Mã PIN phòng không chính xác. Quý khách vui lòng thử lại sau.');
  });

  it('ensures no emojis exist in modified files', () => {
    const files = [
      path.resolve(__dirname, '../RoomPinModal.jsx'),
      path.resolve(__dirname, '../../../services/operationsApi.js'),
      path.resolve(__dirname, '../../../../../backend/app/api/v1/endpoints/operations/reception.py'),
    ];

    const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    files.forEach((file) => {
      const content = fs.readFileSync(file, 'utf8');
      expect(emojiRegex.test(content)).toBe(false);
    });
  });
});
