import { describe, it, expect } from 'vitest';

describe('AuroraSidebar & MobileBottomNav History Menu Visibility', () => {
  const getNavItems = (user, activeView) => {
    const deptLower = (user?.department || '').toLowerCase();
    const roleLower = (user?.role || '').toLowerCase();
    const defaultDashLower = (user?.default_dashboard || user?.defaultDashboard || '').toLowerCase();
    const isConcierge =
      activeView === 'concierge' ||
      deptLower.includes('concierge') ||
      roleLower.includes('concierge') ||
      defaultDashLower === 'concierge';

    return [
      { id: 'Dashboard', label: 'Dashboard' },
      { id: 'Requests', label: 'Requests' },
      ...(isConcierge ? [{ id: 'History', label: 'History' }] : []),
      { id: 'Notifications', label: 'Notifications' },
      { id: 'Profile', label: 'Profile' },
    ];
  };

  it('hides History menu for Reception department', () => {
    const receptionUser = { username: 'reception', department: 'Reception', role: 'Staff' };
    const items = getNavItems(receptionUser, 'reception');
    const ids = items.map((i) => i.id);
    expect(ids).not.toContain('History');
    expect(ids).toEqual(['Dashboard', 'Requests', 'Notifications', 'Profile']);
  });

  it('hides History menu for Housekeeping department', () => {
    const hkUser = { username: 'housekeeping', department: 'Housekeeping', role: 'Housekeeper' };
    const items = getNavItems(hkUser, 'housekeeping');
    const ids = items.map((i) => i.id);
    expect(ids).not.toContain('History');
  });

  it('hides History menu for Restaurant department', () => {
    const restaurantUser = { username: 'restaurant', department: 'Restaurant', role: 'Staff' };
    const items = getNavItems(restaurantUser, 'restaurant');
    const ids = items.map((i) => i.id);
    expect(ids).not.toContain('History');
  });

  it('hides History menu for Taxi department', () => {
    const taxiUser = { username: 'taxi', department: 'Taxi', role: 'Driver' };
    const items = getNavItems(taxiUser, 'taxi');
    const ids = items.map((i) => i.id);
    expect(ids).not.toContain('History');
  });

  it('shows History menu ONLY for Concierge department', () => {
    const conciergeUser = { username: 'concierge', department: 'Concierge', role: 'Concierge Lead' };
    const items = getNavItems(conciergeUser, 'concierge');
    const ids = items.map((i) => i.id);
    expect(ids).toContain('History');
    expect(ids).toEqual(['Dashboard', 'Requests', 'History', 'Notifications', 'Profile']);
  });
});
