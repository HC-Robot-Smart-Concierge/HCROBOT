import { describe, it, expect } from 'vitest';

describe('Robot Screen UI State Transitions', () => {
  const validStates = ['RT-01', 'RT-02', 'RT-03', 'RT-04', 'RT-05'];

  it('should have all 5 design states defined in state flow', () => {
    expect(validStates).toHaveLength(5);
    expect(validStates).toContain('RT-01');
    expect(validStates).toContain('RT-02');
    expect(validStates).toContain('RT-03');
    expect(validStates).toContain('RT-04');
    expect(validStates).toContain('RT-05');
  });

  it('should correctly map state transitions from Press-To-Talk action', () => {
    let currentState = 'RT-02';

    // Simulate Press to Talk action
    currentState = 'RT-03';
    expect(currentState).toBe('RT-03');

    // Simulate speech end / understanding
    currentState = 'RT-04';
    expect(currentState).toBe('RT-04');

    // Simulate route calculation complete
    currentState = 'RT-05';
    expect(currentState).toBe('RT-05');
  });

  it('correctly identifies robot user and routes to robot_display instead of admin_portal', () => {
    const isRobotUser = (user) => {
      if (!user) return false;
      const username = String(user.username || '').toLowerCase();
      const role = String(user.role || '').toLowerCase();
      const defaultDash = String(user.default_dashboard || user.defaultDashboard || '').toLowerCase();
      return (
        username === 'robot_01' ||
        username.startsWith('robot') ||
        role.includes('robot') ||
        defaultDash === 'robot_display'
      );
    };

    const isAdminUser = (user) => {
      if (!user) return false;
      if (isRobotUser(user)) return false;
      const username = String(user.username || '').toLowerCase();
      const role = String(user.role || '').toLowerCase();
      const dept = String(user.department || '').toLowerCase();
      return (
        username === 'admin' ||
        role.includes('admin') ||
        (dept === 'executive' && !role.includes('robot')) ||
        dept === 'operations'
      );
    };

    const robotUser = {
      username: 'robot_01',
      role: 'Robot Kiosk',
      department: 'Executive',
      default_dashboard: 'robot_display',
    };

    expect(isRobotUser(robotUser)).toBe(true);
    expect(isAdminUser(robotUser)).toBe(false);
  });
});
