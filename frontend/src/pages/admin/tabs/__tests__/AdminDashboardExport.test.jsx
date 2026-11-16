import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { buildDashboardReportHtml } from '../adminDashboardReport';

describe('AdminDashboardTab PDF Export & Period Filtering', () => {
  it('buildDashboardReportHtml renders escaped VI/EN weekly, monthly, and all reports', () => {
    const sampleData = {
      total_sessions: 12,
      total_messages: 54,
      total_tasks: 8,
      completed_tasks: 6,
      completion_rate: 75,
      robot_rate: 50,
      robot_assigned_tasks: 4,
      human_tasks: 4,
      total_staff: 5,
      recent_activities: [
        {
          id: 'REQ-101',
          title: '<script>alert(1)</script> Towels',
          department: 'Housekeeping',
          location: 'ROOM 302',
          status: 'Completed',
        },
      ],
    };
    const deptEntries = [
      { name: 'Housekeeping', count: 5, pct: 63 },
      { name: 'Reception', count: 3, pct: 37 },
    ];

    const viWeekly = buildDashboardReportHtml({
      data: sampleData,
      deptEntries,
      period: 'weekly',
      language: 'VI',
    });
    expect(viWeekly).toContain('Theo tuần (7 ngày gần nhất)');
    expect(viWeekly).toContain('&lt;script&gt;alert(1)&lt;/script&gt; Towels');
    expect(viWeekly).not.toContain('<script>alert(1)</script>');
    expect(viWeekly).toContain('REQ-101');
    expect(viWeekly).toContain('Housekeeping');

    const enMonthly = buildDashboardReportHtml({
      data: { ...sampleData, recent_activities: [] },
      deptEntries,
      period: 'monthly',
      language: 'EN',
    });
    expect(enMonthly).toContain('Monthly (Last 30 Days)');
    expect(enMonthly).toContain('No activities in this period');

    const enAll = buildDashboardReportHtml({
      data: sampleData,
      deptEntries,
      period: 'all',
      language: 'EN',
    });
    expect(enAll).toContain('All Time');
  });

  it('AdminDashboardTab wires period selector + Export PDF button without Export Excel', () => {
    const componentPath = path.resolve(process.cwd(), 'src/pages/admin/tabs/AdminDashboardTab.jsx');
    const componentContent = fs.readFileSync(componentPath, 'utf-8');

    expect(componentContent).toContain('buildDashboardReportHtml');
    expect(componentContent).toContain('reportPeriod');
    expect(componentContent).toContain('fetchAnalyticsSummary(period)');
    expect(componentContent).toContain('handleExportPdf');
    expect(componentContent).toContain('dashExportPdf');
    expect(componentContent).toContain('dashPeriodAll');
    expect(componentContent).toContain('dashPeriodWeekly');
    expect(componentContent).toContain('dashPeriodMonthly');
    expect(componentContent).not.toContain('handleExportExcel');
    expect(componentContent).not.toContain('dashExportExcel');
  });

  it('operationsApi fetchAnalyticsSummary sends period query parameter', () => {
    const apiPath = path.resolve(process.cwd(), 'src/services/operationsApi.js');
    const apiContent = fs.readFileSync(apiPath, 'utf-8');
    expect(apiContent).toContain('/analytics/summary?period=${encodeURIComponent(safePeriod)}');
  });
});
