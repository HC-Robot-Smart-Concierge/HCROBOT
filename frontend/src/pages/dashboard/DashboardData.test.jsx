import { describe, it, expect } from 'vitest';

describe('Dashboard Data Normalization and Filtering Logic', () => {
  const sampleRequests = [
    { id: 'REQ-101', status: 'Pending', title: 'Leaking Faucet' },
    { id: 'REQ-102', status: 'In Progress', title: 'AC Noise' },
    { id: 'REQ-103', status: 'Completed', title: 'Towel Delivery' },
  ];

  it('should filter requests by Pending status correctly', () => {
    const pending = sampleRequests.filter((r) => r.status === 'Pending');
    expect(pending).toHaveLength(1);
    expect(pending[0].id).toBe('REQ-101');
  });

  it('should filter requests by In Progress status correctly', () => {
    const inProgress = sampleRequests.filter((r) => r.status === 'In Progress');
    expect(inProgress).toHaveLength(1);
    expect(inProgress[0].id).toBe('REQ-102');
  });

  it('should filter requests by Completed status correctly', () => {
    const completed = sampleRequests.filter((r) => r.status === 'Completed');
    expect(completed).toHaveLength(1);
    expect(completed[0].id).toBe('REQ-103');
  });
});
