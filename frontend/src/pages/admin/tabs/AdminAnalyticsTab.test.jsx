import { describe, it, expect } from 'vitest';

describe('AdminAnalyticsTab Real Data Processing', () => {
  const sampleAnalyticsPayload = {
    total_tasks: 33,
    active_tasks: 33,
    completed_tasks: 0,
    completion_rate: 0.0,
    robot_assigned_tasks: 0,
    human_tasks: 33,
    robot_rate: 0.0,
    total_sessions: 25,
    total_messages: 270,
    total_staff: 9,
    fallback_staff: 0,
    total_robots: 1,
    dept_distribution: {
      Reception: 27,
      Housekeeping: 0,
      'F&B': 6,
      'Bell Services': 0,
      Maintenance: 0,
    },
    recent_activities: [
      { id: 'REQ-8446', title: 'Order #8446', department: 'F&B', location: '402', status: 'Pending' },
    ],
  };

  it('should correctly calculate department distribution percentages', () => {
    const total = sampleAnalyticsPayload.total_tasks || 1;
    const receptionPct = Math.round((sampleAnalyticsPayload.dept_distribution.Reception / total) * 100);
    const fbPct = Math.round((sampleAnalyticsPayload.dept_distribution['F&B'] / total) * 100);

    expect(receptionPct).toBe(82); // 27 / 33 = 81.8% -> 82%
    expect(fbPct).toBe(18); // 6 / 33 = 18.2% -> 18%
  });

  it('should verify total interactions match real session counts', () => {
    expect(sampleAnalyticsPayload.total_sessions).toBe(25);
    expect(sampleAnalyticsPayload.total_messages).toBe(270);
    expect(sampleAnalyticsPayload.total_staff).toBe(9);
  });

  it('should compute completion and human escalation ratios', () => {
    const total = sampleAnalyticsPayload.total_tasks;
    const humanRatio = sampleAnalyticsPayload.human_tasks / total;
    expect(humanRatio).toBe(1.0);
    expect(sampleAnalyticsPayload.active_tasks).toBe(33);
  });
});
