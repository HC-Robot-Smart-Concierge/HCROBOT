import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect } from 'vitest';
import {
  RobotRoomServiceScreen,
  ROOM_SERVICE_CATALOG,
  SERVICE_CATEGORIES,
} from '../RobotRoomServiceScreen';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('RobotRoomServiceScreen Contract & Behavior Tests', () => {
  it('exports RobotRoomServiceScreen as a functional component', () => {
    expect(typeof RobotRoomServiceScreen).toBe('function');
    expect(RobotRoomServiceScreen.name).toBe('RobotRoomServiceScreen');
  });

  it('exports valid SERVICE_CATEGORIES containing expected hospitality services', () => {
    expect(Array.isArray(SERVICE_CATEGORIES)).toBe(true);
    expect(SERVICE_CATEGORIES.length).toBeGreaterThanOrEqual(5);

    const categoryIds = SERVICE_CATEGORIES.map((c) => c.id);
    expect(categoryIds).toContain('all');
    expect(categoryIds).toContain('bath');
    expect(categoryIds).toContain('spa');
    expect(categoryIds).toContain('bedding');
    expect(categoryIds).toContain('housekeeping');
    expect(categoryIds).toContain('laundry');
  });

  it('exports ROOM_SERVICE_CATALOG with free amenities and paid spa services', () => {
    expect(Array.isArray(ROOM_SERVICE_CATALOG)).toBe(true);
    expect(ROOM_SERVICE_CATALOG.length).toBeGreaterThanOrEqual(10);

    // Free amenity: Khan tam
    const towelItem = ROOM_SERVICE_CATALOG.find((item) => item.id === 'AMENITY-01');
    expect(towelItem).toBeDefined();
    expect(towelItem.price).toBe(0);
    expect(towelItem.category).toBe('bath');
    expect(towelItem.name).toContain('Khăn tắm');

    // Paid service: Massage tai phong
    const spaItem = ROOM_SERVICE_CATALOG.find((item) => item.id === 'SPA-01');
    expect(spaItem).toBeDefined();
    expect(spaItem.price).toBe(350000);
    expect(spaItem.category).toBe('spa');
    expect(spaItem.name).toContain('Massage toàn thân');

    // Bedding item: Chan goi
    const beddingItem = ROOM_SERVICE_CATALOG.find((item) => item.category === 'bedding');
    expect(beddingItem).toBeDefined();
  });

  it('ensures every item in catalog has required fields and valid schema', () => {
    ROOM_SERVICE_CATALOG.forEach((item) => {
      expect(typeof item.id).toBe('string');
      expect(item.id.length).toBeGreaterThan(0);
      expect(typeof item.name).toBe('string');
      expect(item.name.length).toBeGreaterThan(0);
      expect(typeof item.category).toBe('string');
      expect(typeof item.price).toBe('number');
      expect(item.price).toBeGreaterThanOrEqual(0);
      expect(typeof item.unit).toBe('string');
      expect(typeof item.prep_time).toBe('number');
      expect(item.prep_time).toBeGreaterThan(0);
    });
  });

  it('guarantees code has no emoji characters anywhere in RobotRoomServiceScreen', () => {
    const filePath = path.resolve(__dirname, '../RobotRoomServiceScreen.jsx');
    const content = fs.readFileSync(filePath, 'utf8');
    const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    expect(emojiRegex.test(content)).toBe(false);
  });

  it('contains Reception notification and checkout billing notice', () => {
    const filePath = path.resolve(__dirname, '../RobotRoomServiceScreen.jsx');
    const content = fs.readFileSync(filePath, 'utf8');

    // Check references to Reception and room billing notice
    expect(content).toContain('Lễ tân');
    expect(content).toContain('hóa đơn');
    expect(content).toContain('RoomPinModal');
  });

  it('enforces clean Aurora Stone styling matching hotel design system', () => {
    const filePath = path.resolve(__dirname, '../RobotRoomServiceScreen.jsx');
    const content = fs.readFileSync(filePath, 'utf8');

    expect(content).toContain('bg-[#F5F2EB]');
    expect(content).toContain('border-[#E3DFD5]');
  });

  it('supports room selection badge and in-modal room picker button', () => {
    const filePath = path.resolve(__dirname, '../RobotRoomServiceScreen.jsx');
    const content = fs.readFileSync(filePath, 'utf8');

    expect(content).toContain('Chọn số phòng');
    expect(content).toContain('Phục vụ tới phòng:');
    expect(content).toContain('Edit3');
  });

  it('supports in-screen service and housekeeping status tracking modal', () => {
    const filePath = path.resolve(__dirname, '../RobotRoomServiceScreen.jsx');
    const content = fs.readFileSync(filePath, 'utf8');

    expect(content).toContain('Tiến Độ Dịch Vụ & Dọn Phòng');
    expect(content).toContain('Tiến độ yêu cầu');
    expect(content).toContain('fetchRoomOrdersHistory');
  });
});
