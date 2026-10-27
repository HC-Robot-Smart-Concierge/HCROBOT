import { describe, it, expect } from 'vitest';

describe('Knowledge Vault Upload Validation Logic', () => {
  const isMarkdownFile = (file) => {
    if (!file || !file.name) return false;
    return file.name.toLowerCase().endsWith('.md');
  };

  it('should accept valid .md files', () => {
    expect(isMarkdownFile({ name: 'hotel_services_detailed_guide.md' })).toBe(true);
    expect(isMarkdownFile({ name: 'HOTEL_RULES.MD' })).toBe(true);
    expect(isMarkdownFile({ name: 'spa_menu_2026.md' })).toBe(true);
  });

  it('should reject non-markdown files such as txt, pdf, docx, png', () => {
    expect(isMarkdownFile({ name: 'hotel_services.txt' })).toBe(false);
    expect(isMarkdownFile({ name: 'hotel_guide.pdf' })).toBe(false);
    expect(isMarkdownFile({ name: 'hotel_map.docx' })).toBe(false);
    expect(isMarkdownFile({ name: 'floor_plan.png' })).toBe(false);
    expect(isMarkdownFile({ name: 'spa_brochure.webp' })).toBe(false);
  });

  it('should reject files without extension or null/undefined', () => {
    expect(isMarkdownFile(null)).toBe(false);
    expect(isMarkdownFile(undefined)).toBe(false);
    expect(isMarkdownFile({ name: 'no_extension_file' })).toBe(false);
  });
});
