import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect } from 'vitest';
import { RoomPinModal, OFFICIAL_ROOMS } from '../RoomPinModal';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('RoomPinModal Minimal Gray Theme & 4-Digit UX', () => {
  it('exports RoomPinModal as a functional React component', () => {
    expect(typeof RoomPinModal).toBe('function');
    expect(RoomPinModal.name).toBe('RoomPinModal');
  });

  it('exports OFFICIAL_ROOMS with 10 rooms per floor', () => {
    expect(OFFICIAL_ROOMS.floor3).toHaveLength(10);
    expect(OFFICIAL_ROOMS.floor4).toHaveLength(10);
    expect(OFFICIAL_ROOMS.floor3[0]).toBe('301');
    expect(OFFICIAL_ROOMS.floor4[0]).toBe('401');
    expect(OFFICIAL_ROOMS.floor3).toContain('305');
    expect(OFFICIAL_ROOMS.floor4).toContain('402');
  });

  it('guarantees code has no emoji characters anywhere in the file', () => {
    const filePath = path.resolve(__dirname, '../RoomPinModal.jsx');
    const content = fs.readFileSync(filePath, 'utf8');
    const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    expect(emojiRegex.test(content)).toBe(false);
  });

  it('enforces 4-digit PIN indicator and clean gray stone theme classes', () => {
    const filePath = path.resolve(__dirname, '../RoomPinModal.jsx');
    const content = fs.readFileSync(filePath, 'utf8');

    // 4 ô chỉ báo
    expect(content).toContain('[0, 1, 2, 3].map');

    // Tone xám tối giản
    expect(content).toContain('bg-stone-900');
    expect(content).toContain('border-stone-800');

    // Tuyệt đối không còn class sặc sỡ amber và indigo trong modal
    expect(content).not.toContain('bg-amber-400');
    expect(content).not.toContain('from-indigo-600');
    expect(content).not.toContain('to-purple-600');

    // Thông báo lỗi 4 số cuối CCCD
    expect(content).toContain('Mã PIN 4 số không chính xác (4 số cuối CCCD)');
  });

  it('supports skipTicketCreation to prevent duplicate ghost support requests', () => {
    const modalPath = path.resolve(__dirname, '../RoomPinModal.jsx');
    const modalContent = fs.readFileSync(modalPath, 'utf8');

    expect(modalContent).toContain('skipTicketCreation = true');
    expect(modalContent).toContain('skipTicketCreation');

    const foodMenuPath = path.resolve(__dirname, '../RobotFoodMenuScreen.jsx');
    const foodContent = fs.readFileSync(foodMenuPath, 'utf8');
    expect(foodContent).toContain('skipTicketCreation={true}');
    expect(foodContent).toContain('pendingAction="verify_only"');

    const roomServicePath = path.resolve(__dirname, '../RobotRoomServiceScreen.jsx');
    const roomContent = fs.readFileSync(roomServicePath, 'utf8');
    expect(roomContent).toContain('skipTicketCreation={true}');
    expect(roomContent).toContain('pendingAction="verify_only"');
  });
});
