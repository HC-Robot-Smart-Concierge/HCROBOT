import { describe, it, expect } from 'vitest';
import {
  extractMarkdownTables,
  formatMarkdownTable,
  replaceMarkdownTable,
  appendMarkdownTable,
  parseCSVToTable,
  extractKnowledgeSections,
} from '../markdownTableHelper';

describe('markdownTableHelper', () => {
  const sampleMarkdown = `
# Khách Sạn Aurora Grand

## 1. Tổng Quan
- **Sảnh Trệt:** Tiếp đón khách 24/7.
  - Hỗ trợ gửi đồ
- **Bãi Xe:** Có trạm sạc điện.

## 2. Bảng Tra Cứu Tiện Ích

| Tầng | Tiện Ích | Giờ Mở Cửa | Ghi Chú |
|---|---|---|---|
| Tầng Trệt | Lễ Tân | 24/7 | Nằm bên phải |
| Tầng 5 | Hồ Bơi | 06:00 - 22:00 | Miễn phí |
`;

  it('extracts markdown tables correctly', () => {
    const tables = extractMarkdownTables(sampleMarkdown);
    expect(tables).toHaveLength(1);
    expect(tables[0].headers).toEqual(['Tầng', 'Tiện Ích', 'Giờ Mở Cửa', 'Ghi Chú']);
    expect(tables[0].rows).toHaveLength(2);
    expect(tables[0].rows[0][0]).toBe('Tầng Trệt');
    expect(tables[0].rows[1][1]).toBe('Hồ Bơi');
  });

  it('formats markdown table with alignment delimiter', () => {
    const headers = ['A', 'B'];
    const rows = [['1', '2'], ['3', '4']];
    const md = formatMarkdownTable(headers, rows);
    expect(md).toContain('| A | B |');
    expect(md).toContain('| --- | --- |');
    expect(md).toContain('| 1 | 2 |');
  });

  it('replaces table in markdown without modifying outside content', () => {
    const tables = extractMarkdownTables(sampleMarkdown);
    const newHeaders = ['Tầng', 'Tiện Ích', 'Giờ Mở Cửa'];
    const newRows = [['Tầng Trệt', 'Lễ Tân Mới', '24/7']];

    const updated = replaceMarkdownTable(sampleMarkdown, tables[0], newHeaders, newRows);
    expect(updated).toContain('Lễ Tân Mới');
    expect(updated).not.toContain('Hồ Bơi');
    expect(updated).toContain('## 1. Tổng Quan');
    expect(updated).toContain('Bãi Xe:');
  });

  it('appends a new markdown table', () => {
    const updated = appendMarkdownTable('# Demo', 'Bảng Mới', ['Col 1', 'Col 2'], [['Val 1', 'Val 2']]);
    expect(updated).toContain('## Bảng Mới');
    expect(updated).toContain('| Col 1 | Col 2 |');
  });

  it('parses CSV text into headers and rows with quoted commas', () => {
    const csv = 'Name,Description,Price\n"Locker, Towels",Included,Free\nSpa,"Massage, Sauna",500k';
    const { headers, rows } = parseCSVToTable(csv);
    expect(headers).toEqual(['Name', 'Description', 'Price']);
    expect(rows).toHaveLength(2);
    expect(rows[0][0]).toBe('Locker, Towels');
    expect(rows[1][1]).toBe('Massage, Sauna');
  });

  it('extracts knowledge sections and bullets', () => {
    const items = extractKnowledgeSections(sampleMarkdown);
    expect(items.length).toBeGreaterThanOrEqual(2);
    expect(items[0].name).toBe('Sảnh Trệt');
    expect(items[0].details).toContain('Tiếp đón khách 24/7');
    expect(items[0].details).toContain('Hỗ trợ gửi đồ');
  });
});
