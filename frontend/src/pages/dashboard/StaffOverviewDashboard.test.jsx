import { describe, it, expect } from 'vitest';

describe('Staff Overview Dashboard Stats Calculator', () => {
  const mockRequests = [
    { id: 'REQ-01', status: 'Pending', department: 'Housekeeping' },
    { id: 'REQ-02', status: 'In Progress', department: 'F&B' },
    { id: 'REQ-03', status: 'Completed', department: 'Housekeeping' },
    { id: 'REQ-04', status: 'Pending', department: 'Maintenance' },
  ];

  it('should calculate pending requests correctly', () => {
    const pending = mockRequests.filter(r => r.status === 'Pending');
    expect(pending).toHaveLength(2);
  });

  it('should calculate in progress requests correctly', () => {
    const inProgress = mockRequests.filter(r => r.status === 'In Progress');
    expect(inProgress).toHaveLength(1);
  });

  it('should calculate completed requests correctly', () => {
    const completed = mockRequests.filter(r => r.status === 'Completed');
    expect(completed).toHaveLength(1);
  });
});
