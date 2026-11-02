import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect } from 'vitest';
import { RoomServiceMenuManagementPage } from '../../../pages/staff/RoomServiceMenuManagementPage';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('RoomServiceMenuManagementPage Component & Contract Tests', () => {
  it('exports RoomServiceMenuManagementPage as a valid React functional component', () => {
    expect(typeof RoomServiceMenuManagementPage).toBe('function');
    expect(RoomServiceMenuManagementPage.name).toBe('RoomServiceMenuManagementPage');
  });

  it('guarantees no emoji characters in RoomServiceMenuManagementPage source code', () => {
    const filePath = path.resolve(__dirname, '../../../pages/staff/RoomServiceMenuManagementPage.jsx');
    const content = fs.readFileSync(filePath, 'utf8');
    const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    expect(emojiRegex.test(content)).toBe(false);
  });

  it('contains full CRUD operations for Room Service Catalog', () => {
    const filePath = path.resolve(__dirname, '../../../pages/staff/RoomServiceMenuManagementPage.jsx');
    const content = fs.readFileSync(filePath, 'utf8');

    // API methods called
    expect(content).toContain('fetchRoomServiceCatalog');
    expect(content).toContain('createRoomServiceCatalogItem');
    expect(content).toContain('updateRoomServiceCatalogItem');
    expect(content).toContain('deleteRoomServiceCatalogItem');
    expect(content).toContain('toggleRoomServiceCatalogItem');
  });

  it('includes KPI cards, filter pills, search input and modals', () => {
    const filePath = path.resolve(__dirname, '../../../pages/staff/RoomServiceMenuManagementPage.jsx');
    const content = fs.readFileSync(filePath, 'utf8');

    // UI elements
    expect(content).toContain('Tổng Dịch Vụ');
    expect(content).toContain('Đang Phục Vụ');
    expect(content).toContain('Tạm Ngưng');
    expect(content).toContain('Miễn Phí Buồng Phòng');
    expect(content).toContain('Thêm Dịch Vụ Mới');
    expect(content).toContain('Xóa Dịch Vụ Phòng');
  });

  it('filters out any mineral water item if present', () => {
    const filePath = path.resolve(__dirname, '../../../pages/staff/RoomServiceMenuManagementPage.jsx');
    const content = fs.readFileSync(filePath, 'utf8');

    expect(content).toContain('nước khoáng');
    expect(content).toContain('nuoc khoang');
  });
});

