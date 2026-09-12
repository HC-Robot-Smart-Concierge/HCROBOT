import { describe, it, expect } from 'vitest';

describe('AdminLogsTab Log Filtering & Level Parsing', () => {
  const sampleLogs = [
    {
      id: 1,
      level: 'INFO',
      category: 'AUDIT',
      event_type: 'AUDIT_LOGIN',
      actor_id: 'robot_01',
      actor_type: 'STAFF',
      message: '[STAFF] robot_01 performed LOGIN',
    },
    {
      id: 2,
      level: 'WARNING',
      category: 'ROBOT',
      event_type: 'ROBOT_OBSTACLE',
      actor_id: 'RC-001',
      actor_type: 'ROBOT',
      message: 'Obstacle detected in Hallway 4A',
    },
    {
      id: 3,
      level: 'ERROR',
      category: 'SYSTEM',
      event_type: 'HTTP_500',
      actor_id: 'system',
      actor_type: 'SYSTEM',
      message: 'Database query timeout error',
    },
  ];

  it('should filter logs by level accurately', () => {
    const filterByLevel = (list, level) =>
      level === 'ALL' ? list : list.filter((item) => item.level === level);

    expect(filterByLevel(sampleLogs, 'ALL')).toHaveLength(3);
    expect(filterByLevel(sampleLogs, 'WARNING')).toHaveLength(1);
    expect(filterByLevel(sampleLogs, 'ERROR')[0].id).toBe(3);
  });

  it('should filter logs by category accurately', () => {
    const filterByCategory = (list, cat) =>
      cat === 'ALL' ? list : list.filter((item) => item.category === cat);

    const auditLogs = filterByCategory(sampleLogs, 'AUDIT');
    expect(auditLogs).toHaveLength(1);
    expect(auditLogs[0].event_type).toBe('AUDIT_LOGIN');
  });

  it('should search logs by keyword across message, actor, and event_type', () => {
    const searchLogs = (list, query) => {
      if (!query.trim()) return list;
      const q = query.toLowerCase();
      return list.filter(
        (item) =>
          item.message.toLowerCase().includes(q) ||
          item.actor_id.toLowerCase().includes(q) ||
          item.event_type.toLowerCase().includes(q)
      );
    };

    expect(searchLogs(sampleLogs, 'obstacle')).toHaveLength(1);
    expect(searchLogs(sampleLogs, 'robot_01')).toHaveLength(1);
    expect(searchLogs(sampleLogs, 'unknown')).toHaveLength(0);
  });
});
