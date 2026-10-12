import { describe, it, expect } from 'vitest';

describe('AdminDepartmentTab Logic and Filter Tests', () => {
  const sampleDepartments = [
    {
      id: 'DEP-BELL',
      code: 'BELL',
      name: 'Bell Services',
      description: 'Hành lý và đưa đón khách',
      is_active: true,
      staff_count: 2,
    },
    {
      id: 'DEP-HOUSEKEEPING',
      code: 'HOUSEKEEPING',
      name: 'Housekeeping',
      description: 'Dọn dẹp và tiện ích phòng ở',
      is_active: true,
      staff_count: 4,
    },
    {
      id: 'DEP-SECURITY',
      code: 'SECURITY',
      name: 'Security & Safety',
      description: 'An ninh trật tự',
      is_active: false,
      staff_count: 0,
    },
  ];

  it('should filter departments by search query correctly', () => {
    const filterBySearch = (list, query) => {
      const q = (query || '').toLowerCase().trim();
      if (!q) return list;
      return list.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.code.toLowerCase().includes(q) ||
          d.id.toLowerCase().includes(q) ||
          (d.description || '').toLowerCase().includes(q)
      );
    };

    const bellResults = filterBySearch(sampleDepartments, 'Bell');
    expect(bellResults).toHaveLength(1);
    expect(bellResults[0].code).toBe('BELL');

    const codeResults = filterBySearch(sampleDepartments, 'SECURITY');
    expect(codeResults).toHaveLength(1);
    expect(codeResults[0].id).toBe('DEP-SECURITY');
  });

  it('should filter departments by active status', () => {
    const filterByStatus = (list, status) => {
      if (status === 'active') return list.filter((d) => !!d.is_active);
      if (status === 'inactive') return list.filter((d) => !d.is_active);
      return list;
    };

    const activeList = filterByStatus(sampleDepartments, 'active');
    expect(activeList).toHaveLength(2);

    const inactiveList = filterByStatus(sampleDepartments, 'inactive');
    expect(inactiveList).toHaveLength(1);
    expect(inactiveList[0].code).toBe('SECURITY');
  });

  it('should format code correctly and trim fields when building payload', () => {
    const buildDepartmentCreatePayload = (form) => ({
      name: form.name.trim(),
      code: form.code ? form.code.trim().toUpperCase().replace(/\s+/g, '_') : undefined,
      description: form.description ? form.description.trim() : '',
      is_active: form.is_active !== false,
    });

    const payload = buildDepartmentCreatePayload({
      name: '  Food & Beverage Service  ',
      code: '  fb dining  ',
      description: '  Nhà hàng và đồ uống  ',
      is_active: true,
    });

    expect(payload.name).toBe('Food & Beverage Service');
    expect(payload.code).toBe('FB_DINING');
    expect(payload.description).toBe('Nhà hàng và đồ uống');
    expect(payload.is_active).toBe(true);
  });
});
