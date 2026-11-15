import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  AdminDashboardTab,
  buildDashboardReportHtml,
} from '../AdminDashboardTab';
import { fetchAnalyticsSummary } from '../../../../services/operationsApi';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('AdminDashboardTab Export PDF & Excel (Weekly / Monthly)', () => {
  const componentPath = path.resolve(__dirname, '../AdminDashboardTab.jsx');
  const componentContent = fs.readFileSync(componentPath, 'utf8');

  const sampleData = {
    period: 'weekly',
    total_sessions: 12,
    total_messages: 48,
    total_tasks: 10,
    active_tasks: 2,
    completed_tasks: 8,
    completion_rate: 80.0,
    robot_assigned_tasks: 6,
    human_tasks: 4,
    robot_rate: 60.0,
    total_staff: 9,
    recent_activities: [
      {
        id: 'REQ-001',
        title: 'Khăn tắm <script>alert(1)</script>',
        department: 'Housekeeping',
        location: 'ROOM 402',
        status: 'Completed',
      },
    ],
  };

  const sampleDepts = [
    { id: 'Reception', name: 'Lễ tân', count: 3, pct: 30 },
    { id: 'Housekeeping', name: 'Buồng phòng', count: 7, pct: 70 },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    globalThis.localStorage = { getItem: vi.fn(() => 'fake-jwt') };
  });

  it('calls /api/v1/operations/analytics/summary with period query parameter', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => sampleData,
    });
    globalThis.fetch = fetchMock;

    await fetchAnalyticsSummary('weekly');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/operations/analytics/summary?period=weekly',
      expect.any(Object)
    );

    await fetchAnalyticsSummary('monthly');
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/v1/operations/analytics/summary?period=monthly',
      expect.any(Object)
    );
  });

  it('generates printable A4 PDF HTML report with escaped dynamic fields', () => {
    const html = buildDashboardReportHtml({
      data: sampleData,
      deptEntries: sampleDepts,
      period: 'monthly',
      language: 'EN',
    });

    expect(html).toContain('@page { size: A4; margin: 14mm; }');
    expect(html).toContain('Monthly (Last 30 Days)');
    expect(html).toContain('80%');
    expect(html).toContain('60%');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('wires period selector and PDF export controls cleanly in AdminDashboardTab', () => {
    expect(typeof AdminDashboardTab).toBe('function');
    expect(componentContent).toContain('setReportPeriod');
    expect(componentContent).toContain('handleExportPdf');
    expect(componentContent).not.toContain('handleExportExcel');
    expect(componentContent).not.toContain('dashExportExcel');
    expect(componentContent).toContain("value=\"weekly\"");
    expect(componentContent).toContain("value=\"monthly\"");
  });
});
