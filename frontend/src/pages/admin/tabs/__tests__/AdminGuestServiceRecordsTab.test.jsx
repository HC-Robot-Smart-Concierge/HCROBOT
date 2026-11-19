import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect } from 'vitest';
import { AdminGuestServiceRecordsTab } from '../AdminGuestServiceRecordsTab';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('AdminGuestServiceRecordsTab (Dedicated Guest Service Records Tab)', () => {
  const componentPath = path.resolve(__dirname, '../AdminGuestServiceRecordsTab.jsx');
  const componentContent = fs.readFileSync(componentPath, 'utf8');
  const portalPath = path.resolve(__dirname, '../../AdminPortal.jsx');
  const portalContent = fs.readFileSync(portalPath, 'utf8');

  it('exports AdminGuestServiceRecordsTab as a functional component', () => {
    expect(typeof AdminGuestServiceRecordsTab).toBe('function');
  });

  it('guarantees no emoji characters in AdminGuestServiceRecordsTab', () => {
    const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    expect(emojiRegex.test(componentContent)).toBe(false);
  });

  it('registers Guest Service Records as a standalone tab in AdminPortal', () => {
    expect(portalContent).toContain("import { AdminGuestServiceRecordsTab } from './tabs/AdminGuestServiceRecordsTab'");
    expect(portalContent).toContain("'Guest Service Records'");
    expect(portalContent).toContain("t('adminGuestServiceRecords')");
    expect(portalContent).toContain("<AdminGuestServiceRecordsTab");
  });

  it('displays 4 KPI metrics cards including total_records, completion_rate, total_revenue, and avg_rating', () => {
    expect(componentContent).toContain('metrics.total_records');
    expect(componentContent).toContain('metrics.completion_rate');
    expect(componentContent).toContain('metrics.total_revenue');
    expect(componentContent).toContain('metrics.avg_rating');
  });

  it('supports switching between Service Ledger and Guest Dossiers view modes', () => {
    expect(componentContent).toContain("setViewMode('ledger')");
    expect(componentContent).toContain("setViewMode('dossiers')");
    expect(componentContent).toContain('filteredRecords');
    expect(componentContent).toContain('filteredProfiles');
  });

  it('supports filtering by department, source, status, date range, and search query', () => {
    expect(componentContent).toContain('setDepartmentFilter');
    expect(componentContent).toContain('setSourceFilter');
    expect(componentContent).toContain('setStatusFilter');
    expect(componentContent).toContain('setStartDate');
    expect(componentContent).toContain('setEndDate');
    expect(componentContent).toContain('setSearchQuery');
    expect(componentContent).toContain('handleResetFilters');
  });

  it('includes service record detail modal, guest dossier modal, and UTF-8 CSV export', () => {
    expect(componentContent).toContain('selectedRecord');
    expect(componentContent).toContain('selectedDossier');
    expect(componentContent).toContain('handleExportCsv');
    expect(componentContent).toContain('guest_service_records_');
  });
});

