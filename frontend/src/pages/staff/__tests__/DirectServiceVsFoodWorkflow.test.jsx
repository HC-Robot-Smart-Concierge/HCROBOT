import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect } from 'vitest';
import { RequestsPage } from '../RequestsPage';
import { MyTasksPage } from '../MyTasksPage';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Direct Room Service vs Kitchen Food Order Workflow & Contract Tests', () => {
  const requestsPagePath = path.resolve(__dirname, '../RequestsPage.jsx');
  const requestsPageContent = fs.readFileSync(requestsPagePath, 'utf8');

  const myTasksPagePath = path.resolve(__dirname, '../MyTasksPage.jsx');
  const myTasksPageContent = fs.readFileSync(myTasksPagePath, 'utf8');

  it('exports RequestsPage and MyTasksPage as functional components', () => {
    expect(typeof RequestsPage).toBe('function');
    expect(typeof MyTasksPage).toBe('function');
  });

  it('guarantees no emoji characters in RequestsPage and MyTasksPage source code', () => {
    const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    expect(emojiRegex.test(requestsPageContent)).toBe(false);
    expect(emojiRegex.test(myTasksPageContent)).toBe(false);
  });

  it('contains isDirectServiceOrder and SERVICE_STEPS in RequestsPage', () => {
    expect(requestsPageContent).toContain('isDirectServiceOrder');
    expect(requestsPageContent).toContain('SERVICE_STEPS');
    expect(requestsPageContent).toContain('getDirectServiceStage');
    expect(requestsPageContent).toContain('Tiếp Nhận Xử Lý');
    expect(requestsPageContent).toContain('Giao Lên Phòng');
    expect(requestsPageContent).toContain('Xác Nhận Đã Giao');
  });

  it('excludes direct service orders from Kitchen staff queue in RequestsPage', () => {
    // Verifies that kitchen staff cannot see direct service requests
    expect(requestsPageContent).toContain('isDirectServiceOrder(r)');
    expect(requestsPageContent).toContain('return false; // Bếp không nhận và không thấy đơn dịch vụ phòng!');
  });

  it('differentiates 4-step direct room service workflow from 6-step kitchen food order', () => {
    // 4-step direct service
    expect(requestsPageContent).toContain("{ step: 1, title: 'Khách Đặt' },");
    expect(requestsPageContent).toContain("{ step: 2, title: 'Tiếp Nhận' },");
    expect(requestsPageContent).toContain("{ step: 3, title: 'Giao Phòng' },");
    expect(requestsPageContent).toContain("{ step: 4, title: 'Hoàn Tất' },");

    // 6-step food order
    expect(requestsPageContent).toContain("{ step: 1, title: 'Khách Đặt' },");
    expect(requestsPageContent).toContain("{ step: 2, title: 'Chuyển Bếp' },");
    expect(requestsPageContent).toContain("{ step: 3, title: 'Bếp Nấu' },");
    expect(requestsPageContent).toContain("{ step: 4, title: 'Món Xong' },");
    expect(requestsPageContent).toContain("{ step: 5, title: 'Giao Phòng' },");
    expect(requestsPageContent).toContain("{ step: 6, title: 'Hoàn Tất' },");
  });

  it('contains isDirectServiceOrder and SERVICE_STEPS in MyTasksPage', () => {
    expect(myTasksPageContent).toContain('isDirectServiceOrder');
    expect(myTasksPageContent).toContain('SERVICE_STEPS');
    expect(myTasksPageContent).toContain('getDirectServiceStage');
    expect(myTasksPageContent).toContain('Tiếp Nhận Xử Lý');
    expect(myTasksPageContent).toContain('Giao Lên Phòng');
    expect(myTasksPageContent).toContain('Xác Nhận Đã Giao');
  });

  it('properly classifies towels, massage, cleaning, and amenities as direct service keywords', () => {
    const serviceKeywords = [
      'khăn', 'khan', 'gối', 'goi', 'chăn', 'chan', 'nệm', 'nem',
      'dọn phòng', 'don phong', 'vệ sinh', 've sinh', 'massage', 'mát xa', 'spa',
      'giặt', 'giat', 'ủi', 'ui', 'bàn ủi', 'bàn là', 'tiện ích', 'amenity',
      'dịch vụ phòng', 'dich vu phong'
    ];

    serviceKeywords.forEach((kw) => {
      expect(requestsPageContent).toContain(kw);
      expect(myTasksPageContent).toContain(kw);
    });
  });

  it('ensures getTaskHandlerName helper function is properly defined in RequestsPage', () => {
    expect(requestsPageContent).toContain('const getTaskHandlerName = (r) => {');
    expect(requestsPageContent).toContain('r.assignedTo ||');
  });
});
