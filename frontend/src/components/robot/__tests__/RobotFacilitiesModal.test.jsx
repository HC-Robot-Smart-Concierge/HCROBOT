import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RobotFacilitiesModal } from '../RobotFacilitiesModal';
import { fetchRAGFacilities } from '../../../services/knowledgeApi';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('RobotFacilitiesModal Knowledge Base & AI Integration Tests', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('exports RobotFacilitiesModal as a functional React component without hardcoded HOTEL_FACILITIES_LIST', () => {
    expect(typeof RobotFacilitiesModal).toBe('function');
    expect(RobotFacilitiesModal.name).toBe('RobotFacilitiesModal');

    const filePath = path.resolve(__dirname, '../RobotFacilitiesModal.jsx');
    const content = fs.readFileSync(filePath, 'utf8');

    expect(content).not.toContain('HOTEL_FACILITIES_LIST');
    expect(content).not.toContain('Nhà Hàng Aurora & Bếp Mở');
    expect(content).not.toContain('Buffet sáng Á - Âu');
    expect(content).toContain('fetchRAGFacilities');
    expect(content).toContain('onAskFacilityWithAI');

    const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    expect(emojiRegex.test(content)).toBe(false);
  });

  it('keeps FloorMap and AdminKnowledgePage markdown template consistent with 24/7 Room Service KB', () => {
    const floorMapContent = fs.readFileSync(path.resolve(__dirname, '../FloorMap.jsx'), 'utf8');
    expect(floorMapContent).not.toContain('Nhà Hàng Aurora & Bếp');
    expect(floorMapContent).toContain('Room Service 24/7');

    const knowledgePageContent = fs.readFileSync(
      path.resolve(__dirname, '../../../pages/admin/tabs/AdminKnowledgePage.jsx'),
      'utf8'
    );
    expect(knowledgePageContent).not.toContain('| Nhà Hàng Buffet |');
    expect(knowledgePageContent).toContain('Gọi Món Tận Phòng 24/7');
  });

  it('wires RobotScreenPage to ask AI grounded in facility kbContext when introducing a facility', () => {
    const robotScreenContent = fs.readFileSync(
      path.resolve(__dirname, '../../../pages/robot/RobotScreenPage.jsx'),
      'utf8'
    );
    expect(robotScreenContent).toContain('onAskFacilityWithAI={async (facility)');
    expect(robotScreenContent).toContain('facility.kbContext');
    expect(robotScreenContent).toContain('sendChatPrompt(');
  });

  it('fetchRAGFacilities requests /api/v1/rag/facilities with normalized language parameter', async () => {
    const payload = {
      total: 1,
      source_file: 'hotel_facilities_floor_layout_vi.md',
      language: 'vi',
      categories: ['Tất cả', 'Ẩm thực'],
      facilities: [],
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => payload,
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await fetchRAGFacilities('Tiếng Việt');
    expect(res).toEqual(payload);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/rag/facilities?lang=vi',
      expect.objectContaining({ headers: expect.any(Object) })
    );

    await fetchRAGFacilities('English');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/rag/facilities?lang=en',
      expect.objectContaining({ headers: expect.any(Object) })
    );
  });
});
