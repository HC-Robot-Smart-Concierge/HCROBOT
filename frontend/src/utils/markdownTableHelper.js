/**
 * Utility helpers to parse, serialize, and manipulate Markdown tables
 * and structured knowledge items for Excel-like editing.
 */

/**
 * Extracts all native Markdown tables from raw markdown text.
 * @param {string} markdown
 * @returns {Array<{ id: string, title: string, startLine: number, endLine: number, headers: string[], rows: string[][] }>}
 */
export const extractMarkdownTables = (markdown = '') => {
  if (!markdown) return [];

  const lines = markdown.split('\n');
  const tables = [];
  let inTable = false;
  let currentTable = null;
  let lastHeading = 'Bảng tra cứu';
  let tableIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (trimmed.startsWith('#')) {
      lastHeading = trimmed.replace(/^#+\s*/, '').replace(/\*+/g, '').trim();
    }

    // Check if line looks like a table row: starts and ends with '|'
    if (trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.length > 2) {
      const cells = splitMarkdownRow(trimmed);

      if (!inTable) {
        // Look ahead for delimiter row e.g. |---|---| or |:---|---:|
        if (i + 1 < lines.length) {
          const nextTrimmed = lines[i + 1].trim();
          if (isTableDelimiterRow(nextTrimmed)) {
            inTable = true;
            tableIndex++;
            currentTable = {
              id: `table_${tableIndex}`,
              title: lastHeading || `Bảng ${tableIndex}`,
              startLine: i,
              headers: cells,
              rows: [],
            };
            i++; // skip delimiter row
            continue;
          }
        }
      } else {
        currentTable.rows.push(cells);
      }
    } else {
      if (inTable && currentTable) {
        currentTable.endLine = i - 1;
        tables.push(currentTable);
        inTable = false;
        currentTable = null;
      }
    }
  }

  if (inTable && currentTable) {
    currentTable.endLine = lines.length - 1;
    tables.push(currentTable);
  }

  return tables;
};

/**
 * Checks whether a line is a markdown table separator row (|---|---|)
 */
export const isTableDelimiterRow = (line = '') => {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return false;
  const inner = trimmed.slice(1, -1);
  const parts = inner.split('|');
  return (
    parts.length > 0 &&
    parts.every((part) => {
      const p = part.trim();
      return /^:?-+:?$/.test(p);
    })
  );
};

/**
 * Splits a markdown row into cells while preserving escaped pipes.
 */
export const splitMarkdownRow = (line = '') => {
  const trimmed = line.trim();
  const inner = trimmed.slice(1, -1);
  const rawCells = inner.split(/(?<!\\)\|/);
  return rawCells.map((c) =>
    c
      .trim()
      .replace(/\\\|/g, '|')
      .replace(/<br\s*\/?>/gi, '\n')
  );
};

/**
 * Serializes headers and rows back into Markdown table syntax.
 */
export const formatMarkdownTable = (headers = [], rows = []) => {
  if (!headers.length) return '';

  const headerLine = `| ${headers.map((h) => (h || '').trim()).join(' | ')} |`;
  const delimiterLine = `| ${headers.map(() => '---').join(' | ')} |`;
  const rowLines = rows.map((row) => {
    const formattedCells = headers.map((_, colIdx) => {
      const val = row[colIdx] !== undefined ? String(row[colIdx]) : '';
      return val
        .replace(/\r?\n/g, '<br/>')
        .replace(/(?<!\\)\|/g, '\\|')
        .trim();
    });
    return `| ${formattedCells.join(' | ')} |`;
  });

  return [headerLine, delimiterLine, ...rowLines].join('\n');
};

/**
 * Replaces a specific table in the markdown document with updated headers and rows.
 */
export const replaceMarkdownTable = (markdown = '', targetTable, newHeaders = [], newRows = []) => {
  if (!targetTable || targetTable.startLine === undefined) return markdown;

  const lines = markdown.split('\n');
  const tableMarkdown = formatMarkdownTable(newHeaders, newRows);
  const newTableLines = tableMarkdown.split('\n');

  lines.splice(
    targetTable.startLine,
    targetTable.endLine - targetTable.startLine + 1,
    ...newTableLines
  );

  return lines.join('\n');
};

/**
 * Appends a new Markdown table with section title to the end of the markdown document.
 */
export const appendMarkdownTable = (markdown = '', title = 'Bảng dữ liệu mới', headers = [], rows = []) => {
  const cleanTitle = title.trim();
  const tableMd = formatMarkdownTable(headers, rows);
  const sectionMd = `\n\n## ${cleanTitle}\n\n${tableMd}\n`;
  return markdown.trimEnd() + sectionMd;
};

/**
 * Exports tabular data as a CSV file compatible with Excel.
 * Adds UTF-8 BOM (\uFEFF) to guarantee correct rendering of Vietnamese characters in Microsoft Excel.
 */
export const exportTableToCSV = (headers = [], rows = [], filename = 'knowledge_vault.csv') => {
  const sanitizeCell = (cell) => {
    const str = cell !== undefined && cell !== null ? String(cell) : '';
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerRow = headers.map(sanitizeCell).join(',');
  const dataRows = rows.map((row) => headers.map((_, idx) => sanitizeCell(row[idx] || '')).join(','));
  const csvContent = '\uFEFF' + [headerRow, ...dataRows].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Parses a CSV string into { headers, rows }.
 */
export const parseCSVToTable = (csvText = '') => {
  if (!csvText) return { headers: [], rows: [] };

  const cleanText = csvText.replace(/^\uFEFF/, '').trim();
  const lines = [];
  let currentLine = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentField += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentLine.push(currentField.trim());
        currentField = '';
      } else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
        currentLine.push(currentField.trim());
        if (currentLine.some((c) => c !== '')) {
          lines.push(currentLine);
        }
        currentLine = [];
        currentField = '';
        if (char === '\r') i++;
      } else {
        currentField += char;
      }
    }
  }

  if (currentField || currentLine.length > 0) {
    currentLine.push(currentField.trim());
    if (currentLine.some((c) => c !== '')) {
      lines.push(currentLine);
    }
  }

  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = lines[0];
  const rows = lines.slice(1);
  return { headers, rows };
};

/**
 * Extracts hierarchical facilities and bullet points from Markdown.
 */
export const extractKnowledgeSections = (markdown = '') => {
  if (!markdown) return [];

  const lines = markdown.split('\n');
  const items = [];
  let currentSection = 'Chung';
  let currentSub = '';
  let inFrontmatter = false;
  let frontmatterPassed = false;
  let counter = 0;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (line === '---') {
      if (!frontmatterPassed && !inFrontmatter) {
        inFrontmatter = true;
        continue;
      }
      if (inFrontmatter) {
        inFrontmatter = false;
        frontmatterPassed = true;
        continue;
      }
    }
    if (inFrontmatter) continue;

    // Skip Markdown Table lines
    if (line.startsWith('|') && line.endsWith('|')) continue;

    if (line.startsWith('## ')) {
      currentSection = line.replace(/^##\s*/, '').replace(/\*+/g, '').trim();
      currentSub = '';
      continue;
    }
    if (line.startsWith('### ')) {
      currentSub = line.replace(/^###\s*/, '').replace(/\*+/g, '').trim();
      continue;
    }

    // Bullet point with bold prefix: - **Name:** Details
    const match = line.match(/^[-*]\s+\*\*([^*]+)\*\*[:\s]*(.*)$/);
    if (match) {
      counter++;
      const name = match[1].trim().replace(/:$/, '');
      const firstDetail = match[2].trim();
      let details = firstDetail;
      let j = i + 1;

      while (
        j < lines.length &&
        (lines[j].startsWith('  ') ||
          lines[j].startsWith('\t') ||
          (lines[j].trim().startsWith('-') && !lines[j].trim().startsWith('- **')))
      ) {
        const sub = lines[j].trim();
        if (sub) {
          details += (details ? '\n' : '') + sub;
        }
        j++;
      }
      i = j - 1;

      items.push({
        id: `sec_item_${counter}`,
        section: currentSection,
        subCategory: currentSub,
        name,
        details,
      });
    }
  }

  return items;
};

/**
 * Generates starter table templates based on language.
 */
export const getDefaultTemplate = (isEN = false) => {
  if (isEN) {
    return {
      title: 'New Data Table',
      headers: [
        'Item / Topic',
        'Category',
        'Description / Details',
        'Notes',
      ],
      rows: [
        ['', '', '', ''],
      ],
    };
  }

  return {
    title: 'Bảng Dữ Liệu Mới',
    headers: [
      'Tên Mục / Tiện Ích',
      'Phân Loại',
      'Mô Tả / Hướng Dẫn',
      'Ghi Chú',
    ],
    rows: [
      ['', '', '', ''],
    ],
  };
};
