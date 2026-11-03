import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RoomServiceFrame } from './RoomServiceFrame';
import { LanguageProvider } from '../../context/LanguageContext';
import { resolveStaffDashboard, normalizeLegacyView } from '../../context/AuthContext';
import { RoomServiceDashboard } from '../../pages/dashboard/RoomServiceDashboard';
import { RequestsPage } from '../../pages/staff/RequestsPage';
import { MyTasksPage } from '../../pages/staff/MyTasksPage';
import { NotificationsPage } from '../../pages/staff/NotificationsPage';
import { ProfilePage } from '../../pages/staff/ProfilePage';
import { StaffSettingsPage } from '../../pages/staff/StaffSettingsPage';
import { staffDepartmentLabel, staffStatusLabel, translateStaffText } from '../../context/StaffLanguage';

const user = { id: 'rs-01', username: 'roomservice', department: 'Room Service', full_name: 'Room Service Staff' };
vi.mock('../../context/AuthContext', async (importOriginal) => ({
  ...await importOriginal(),
  useAuth: () => ({ currentUser: user, logout: vi.fn() }),
}));
vi.mock('../../context/NotificationContext', () => ({ useNotifications: () => ({ notifications: [] }) }));

function render(ui, language = null) {
  vi.stubGlobal('localStorage', { getItem: () => language, setItem: vi.fn() });
  return renderToStaticMarkup(<LanguageProvider>{ui}</LanguageProvider>);
}

describe('Room Service portal', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows the Admin-style navigation with Operations subtabs and bottom Settings', () => {
    const html = render(<RoomServiceFrame currentUser={user} activeMenu="Requests" unreadNotifCount={4} />);
    for (const label of ['ROOM SERVICE PORTAL', 'Dashboard', 'Operations', 'Requests', 'My Tasks', 'Service Management', 'Settings']) {
      expect(html).toContain(label);
    }
    expect(html).toContain('aria-label="Collapse sidebar"');
    expect(html).toContain('aria-current="page"');
    expect(html.indexOf('Settings')).toBeGreaterThan(html.indexOf('room-service-sidebar-actions" class='));
    expect(html).not.toMatch(/Housekeeping|adminRobotControl/);
  });

  it.each([
    [RoomServiceDashboard, 'Room Service / F&amp;B', 'Bếp Đang Nấu'],
    [RequestsPage, 'Service requests', 'Yêu Cầu Dịch Vụ'],
    [MyTasksPage, 'My assigned tasks', 'Yêu Cầu Cá Nhân Đang Phụ Trách'],
    [NotificationsPage, 'Notifications &amp; alerts', 'Trung Tâm Thông Báo'],
  ])('renders %s with English labels by default', (Page, heading, vietnameseHeading) => {
    const html = render(<Page currentUser={user} />);
    expect(html).toContain(heading);
    expect(html).not.toContain(vietnameseHeading);
  });

  it('renders the profile with English controls', () => {
    const html = render(<StaticRouter location="/staff/profile"><ProfilePage currentUser={user} /></StaticRouter>);
    expect(html).toContain('Staff profile');
    expect(html).toContain('Edit profile');
    expect(html).not.toContain('Housekeeping');
  });

  it('uses the same stored language as Admin for Settings and the dashboard', () => {
    const english = render(<StaffSettingsPage />);
    expect(english).toMatch(/<button[^>]*aria-pressed="true"[^>]*><strong>English/);
    const vietnamese = render(<StaffSettingsPage />, 'VI');
    expect(vietnamese).toMatch(/<button[^>]*aria-pressed="true"[^>]*><strong>Tiếng Việt/);
    const dashboard = render(<RoomServiceDashboard currentUser={user} />, 'VI');
    expect(dashboard).toContain('Bếp Đang Nấu');
    expect(dashboard).toContain('Làm mới');
  });

  it('routes legacy Housekeeping views to Room Service without changing the account', () => {
    const legacyUser = { username: 'staff01', department: 'Housekeeping', role: 'Staff' };
    expect(resolveStaffDashboard(legacyUser)).toBe('room_service');
    expect(normalizeLegacyView('housekeeping', legacyUser)).toBe('room_service');
    expect(legacyUser.department).toBe('Housekeeping');
    expect(resolveStaffDashboard({ department: 'Kitchen' })).toBe('kitchen');
    expect(resolveStaffDashboard({ username: 'admin' })).toBe('admin_portal');
  });

  it('localizes display values without changing unknown business data', () => {
    expect(translateStaffText('EN', staffStatusLabel('đã chuyển bếp'))).toBe('Sent to kitchen');
    expect(translateStaffText('VI', staffStatusLabel('Sent to Kitchen'))).toBe('Đã Chuyển Bếp');
    expect(staffDepartmentLabel('Housekeeping')).toBe('Room Service');
    expect(staffStatusLabel('custom_backend_status')).toBe('custom_backend_status');
    expect(translateStaffText('EN', staffDepartmentLabel(undefined))).toBe('');
    expect(translateStaffText('EN', 'Guest note: {0}', 'Thêm khăn tắm')).toBe('Guest note: Thêm khăn tắm');
  });
});
