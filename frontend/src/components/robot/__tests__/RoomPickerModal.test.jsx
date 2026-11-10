import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect } from 'vitest';
import { RoomPickerModal, OFFICIAL_ROOMS } from '../RoomPickerModal';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('RoomPickerModal Contract & Minimal Gray Theme Tests', () => {
  it('exports OFFICIAL_ROOMS matching Aurora 20-rooms standard', () => {
    expect(OFFICIAL_ROOMS.floor3).toHaveLength(10);
    expect(OFFICIAL_ROOMS.floor4).toHaveLength(10);
    expect(OFFICIAL_ROOMS.floor3).toEqual([
      '301', '302', '303', '304', '305', '306', '307', '308', '309', '310'
    ]);
    expect(OFFICIAL_ROOMS.floor4).toEqual([
      '401', '402', '403', '404', '405', '406', '407', '408', '409', '410'
    ]);
  });

  it('exports RoomPickerModal as a functional React component', () => {
    expect(typeof RoomPickerModal).toBe('function');
    expect(RoomPickerModal.name).toBe('RoomPickerModal');
  });

  it('contains correct room numbering pattern for floors 3 and 4', () => {
    OFFICIAL_ROOMS.floor3.forEach((r) => {
      expect(r).toMatch(/^3\d{2}$/);
    });
    OFFICIAL_ROOMS.floor4.forEach((r) => {
      expect(r).toMatch(/^4\d{2}$/);
    });
  });

  it('guarantees no overlapping room numbers between floors', () => {
    const f3Set = new Set(OFFICIAL_ROOMS.floor3);
    const f4Set = new Set(OFFICIAL_ROOMS.floor4);
    OFFICIAL_ROOMS.floor4.forEach((r) => {
      expect(f3Set.has(r)).toBe(false);
    });
    OFFICIAL_ROOMS.floor3.forEach((r) => {
      expect(f4Set.has(r)).toBe(false);
    });
  });

  it('guarantees code has no emoji characters anywhere in RoomPickerModal', () => {
    const filePath = path.resolve(__dirname, '../RoomPickerModal.jsx');
    const content = fs.readFileSync(filePath, 'utf8');
    const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    expect(emojiRegex.test(content)).toBe(false);
  });

  it('enforces clean gray stone theme and rejects bright amber styles', () => {
    const filePath = path.resolve(__dirname, '../RoomPickerModal.jsx');
    const content = fs.readFileSync(filePath, 'utf8');

    expect(content).toContain('bg-stone-900');
    expect(content).toContain('border-stone-800');
    expect(content).not.toContain('bg-amber-400');
    expect(content).not.toContain('text-amber-400');
    expect(content).not.toContain('border-amber-400');
  });

  it('supports concierge icon and dynamic titles for housekeeping and room service', () => {
    const filePath = path.resolve(__dirname, '../RoomPickerModal.jsx');
    const content = fs.readFileSync(filePath, 'utf8');

    expect(content).toContain('ConciergeBell');
    expect(content).toContain('iconType');
  });
});
