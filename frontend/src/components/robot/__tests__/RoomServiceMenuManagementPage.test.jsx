import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { RoomServiceMenuManagementPage } from '../../../pages/staff/RoomServiceMenuManagementPage';
import { LanguageProvider } from '../../../context/LanguageContext';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('RoomServiceMenuManagementPage Component & Contract Tests', () => {
  afterEach(() => vi.unstubAllGlobals());
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

  it.each([
    [null, ['Total services', 'Available services', 'Paused services', 'Complimentary services', 'New service', 'Room cleaning']],
    ['VI', ['Tổng Dịch Vụ', 'Đang Phục Vụ', 'Tạm Ngưng', 'Miễn Phí Buồng Phòng', 'Thêm Dịch Vụ Mới', 'Dọn Phòng Nhanh']],
  ])('renders catalog controls in the chosen language (%s)', (language, labels) => {
    vi.stubGlobal('localStorage', { getItem: () => language });
    const content = renderToStaticMarkup(<LanguageProvider><RoomServiceMenuManagementPage /></LanguageProvider>);
    for (const label of labels) expect(content).toContain(label);
    expect(content).toContain('type="text"');
  });

  it('filters out any mineral water item if present', () => {
    const filePath = path.resolve(__dirname, '../../../pages/staff/RoomServiceMenuManagementPage.jsx');
    const content = fs.readFileSync(filePath, 'utf8');

    expect(content).toContain('nước khoáng');
    expect(content).toContain('nuoc khoang');
  });

  it('integrates Pagination component matching Admin standard (pageSize = 10)', () => {
    const filePath = path.resolve(__dirname, '../../../pages/staff/RoomServiceMenuManagementPage.jsx');
    const content = fs.readFileSync(filePath, 'utf8');

    expect(content).toContain("import { Pagination } from '../../components/common/Pagination';");
    expect(content).toContain('paginatedServices');
    expect(content).toContain('const pageSize = 10');
    expect(content).toContain('<Pagination');
  });
});

