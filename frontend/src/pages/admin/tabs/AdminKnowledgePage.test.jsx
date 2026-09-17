import { describe, it, expect } from 'vitest';

describe('AdminKnowledgePage Source File Filtering and State', () => {
  const sampleSources = [
    {
      filename: 'danh_sach_co_so_vat_chat.md',
      file_type: 'md',
      file_size_kb: 4.44,
      chunks_count: 5,
      status: 'Synced',
    },
    {
      filename: 'De_Xuat_Tinh_Nang_Robot_Concierge.pdf',
      file_type: 'pdf',
      file_size_kb: 238.58,
      chunks_count: 3,
      status: 'Active',
    },
  ];

  it('should parse source files and report total chunks accurately', () => {
    const totalChunks = sampleSources.reduce((acc, curr) => acc + curr.chunks_count, 0);
    expect(totalChunks).toBe(8);
  });

  it('should filter sources by extension correctly', () => {
    const mdSources = sampleSources.filter((s) => s.file_type.toLowerCase() === 'md');
    expect(mdSources).toHaveLength(1);
    expect(mdSources[0].filename).toBe('danh_sach_co_so_vat_chat.md');
  });

  it('should format file size correctly for display', () => {
    const formatKb = (kb) => `${kb} KB`;
    expect(formatKb(sampleSources[0].file_size_kb)).toBe('4.44 KB');
  });
});
