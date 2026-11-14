import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect } from 'vitest';
import { ConciergeDashboard } from '../ConciergeDashboard';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Concierge Unpleasant Guest Emotion Alert Workflow Tests', () => {
  const conciergePath = path.resolve(__dirname, '../ConciergeDashboard.jsx');
  const conciergeContent = fs.readFileSync(conciergePath, 'utf8');

  const sidebarPath = path.resolve(__dirname, '../../../components/dashboard/AuroraSidebar.jsx');
  const sidebarContent = fs.readFileSync(sidebarPath, 'utf8');

  const layoutPath = path.resolve(__dirname, '../../../layouts/StaffLayout.jsx');
  const layoutContent = fs.readFileSync(layoutPath, 'utf8');

  const framePath = path.resolve(__dirname, '../../../components/dashboard/RoomServiceFrame.jsx');
  const frameContent = fs.readFileSync(framePath, 'utf8');

  const mobileNavPath = path.resolve(__dirname, '../../../components/common/MobileBottomNav.jsx');
  const mobileNavContent = fs.readFileSync(mobileNavPath, 'utf8');

  const robotScreenPath = path.resolve(__dirname, '../../robot/RobotScreenPage.jsx');
  const robotScreenContent = fs.readFileSync(robotScreenPath, 'utf8');

  it('exports ConciergeDashboard and guarantees zero emoji characters', () => {
    expect(typeof ConciergeDashboard).toBe('function');
    const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    expect(emojiRegex.test(conciergeContent)).toBe(false);
  });

  it('supports unhappy guest emotion alert subtab, KPIs, and 2-step resolution in ConciergeDashboard', () => {
    expect(conciergeContent).toContain("activeSubTab === 'emotion_alerts'");
    expect(conciergeContent).toContain('fetchConciergeEmotionAlerts');
    expect(conciergeContent).toContain('createConciergeEmotionAlert');
    expect(conciergeContent).toContain('updateConciergeEmotionAlertStatus');
    expect(conciergeContent).toContain('Xử lý khách khó chịu');
    expect(conciergeContent).toContain('Khách có biểu cảm khó chịu');
    expect(conciergeContent).toContain('Tiếp nhận &amp; Ra hỗ trợ ngay');
    expect(conciergeContent).toContain('Đã xoa dịu &amp; Xử lý xong');
  });

  it('wires Concierge navigation entries in AuroraSidebar, StaffLayout, and MobileBottomNav', () => {
    expect(sidebarContent).toContain("id: 'EmotionAlerts'");
    expect(mobileNavContent).toContain("id: 'EmotionAlerts'");
    expect(layoutContent).toContain("tab === 'emotion_alerts'");
    expect(layoutContent).toContain('/staff/concierge?tab=emotion_alerts');
  });

  it('uses unified RoomServiceFrame and StaffPageHeader layout matching Admin/Bellman/Maintenance portals', () => {
    expect(layoutContent).toContain('usesAdminStylePortal');
    expect(layoutContent).toContain("'concierge'");
    expect(frameContent).toContain('CONCIERGE PORTAL');
    expect(conciergeContent).toContain('StaffPageHeader');
    expect(conciergeContent).toContain('staff-page-body');
  });

  it('dispatches AI unhappy emotion alerts from RobotScreenPage directly to Concierge instead of Bellman', () => {
    expect(robotScreenContent).toContain('createConciergeEmotionAlert');
    expect(robotScreenContent).toContain('Cần nhân viên Concierge tiếp cận hỗ trợ trực tiếp ngay.');
    expect(robotScreenContent).not.toContain("request_type: 'emotion_alert'");
  });
});

