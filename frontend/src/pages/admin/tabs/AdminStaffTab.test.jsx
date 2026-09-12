import { describe, it, expect } from 'vitest';

describe('AdminStaffTab Robot Escalation Logic', () => {
  const sampleStaff = [
    {
      id: 'stf-1',
      username: 'an_nguyen',
      full_name: 'Nguyễn Văn An',
      department: 'Lễ tân',
      is_fallback_agent: true,
    },
    {
      id: 'stf-2',
      username: 'binh_le',
      full_name: 'Lê Bình',
      department: 'Kỹ thuật / Bảo trì',
      is_fallback_agent: false,
    },
    {
      id: 'stf-3',
      username: 'cuong_tran',
      full_name: 'Trần Cường',
      department: 'CNTT & Vận hành Robot',
      is_fallback_agent: true,
    },
  ];

  it('should filter staff by department correctly', () => {
    const filterByDepartment = (list, dept) =>
      dept === 'All'
        ? list
        : list.filter((s) => s.department.toLowerCase() === dept.toLowerCase());

    const receptionStaff = filterByDepartment(sampleStaff, 'Lễ tân');
    expect(receptionStaff).toHaveLength(1);
    expect(receptionStaff[0].username).toBe('an_nguyen');
  });

  it('should filter staff by robot escalation fallback role', () => {
    const filterByFallback = (list, mode) => {
      if (mode === 'fallback') return list.filter((s) => !!s.is_fallback_agent);
      if (mode === 'standard') return list.filter((s) => !s.is_fallback_agent);
      return list;
    };

    const fallbackAgents = filterByFallback(sampleStaff, 'fallback');
    expect(fallbackAgents).toHaveLength(2);
    expect(fallbackAgents.map((s) => s.username)).toEqual(['an_nguyen', 'cuong_tran']);

    const standardAgents = filterByFallback(sampleStaff, 'standard');
    expect(standardAgents).toHaveLength(1);
    expect(standardAgents[0].username).toBe('binh_le');
  });

  it('should build robot-centric create payload with required backend compatibility fields', () => {
    const buildStaffCreatePayload = (form) => ({
      username: form.username.trim(),
      password: form.password,
      full_name: form.full_name.trim(),
      department: form.department,
      role: form.department,
      is_fallback_agent: form.is_fallback_agent,
      status: 'available',
      shift: 'All Shifts',
      location: 'On Site',
    });

    const payload = buildStaffCreatePayload({
      username: 'dung_robot',
      password: 'secret',
      full_name: 'Hoàng Dũng',
      department: 'CNTT & Vận hành Robot',
      is_fallback_agent: true,
    });

    expect(payload.username).toBe('dung_robot');
    expect(payload.department).toBe('CNTT & Vận hành Robot');
    expect(payload.is_fallback_agent).toBe(true);
    expect(payload.role).toBe('CNTT & Vận hành Robot');
  });
});
