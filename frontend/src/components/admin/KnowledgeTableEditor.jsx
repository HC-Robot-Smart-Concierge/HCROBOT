import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Table as TableIcon,
  Plus,
  Trash2,
  Download,
  Upload,
  Search,
  ArrowUp,
  ArrowDown,
  Copy,
  Layers,
  Columns,
  Sparkles,
  HelpCircle,
  FileSpreadsheet,
} from 'lucide-react';
import {
  extractMarkdownTables,
  replaceMarkdownTable,
  appendMarkdownTable,
  exportTableToCSV,
  parseCSVToTable,
  extractKnowledgeSections,
  getDefaultTemplate,
} from '../../utils/markdownTableHelper';

export const KnowledgeTableEditor = ({
  markdown = '',
  onChange = () => {},
  isEN = false,
  filename = '',
}) => {
  // Extract all existing markdown tables from raw text
  const extractedTables = useMemo(() => extractMarkdownTables(markdown), [markdown]);
  const sectionItems = useMemo(() => extractKnowledgeSections(markdown), [markdown]);

  // Active sheet / view: 'table_1', 'table_2', or 'sections_grid'
  const [activeSheetId, setActiveSheetId] = useState(() => {
    if (extractedTables.length > 0) return extractedTables[0].id;
    return 'sections_grid';
  });

  // Keep activeSheetId valid when tables change
  useEffect(() => {
    if (activeSheetId === 'sections_grid') return;
    const exists = extractedTables.some((t) => t.id === activeSheetId);
    if (!exists) {
      if (extractedTables.length > 0) {
        setActiveSheetId(extractedTables[0].id);
      } else {
        setActiveSheetId('sections_grid');
      }
    }
  }, [extractedTables, activeSheetId]);

  // Search filter query
  const [searchQuery, setSearchQuery] = useState('');

  // CSV upload ref
  const csvInputRef = useRef(null);

  // Active table object
  const currentTable = useMemo(() => {
    if (activeSheetId === 'sections_grid') return null;
    return extractedTables.find((t) => t.id === activeSheetId) || extractedTables[0] || null;
  }, [extractedTables, activeSheetId]);

  // Cell change handler
  const handleCellChange = (rowIdx, colIdx, newValue) => {
    if (!currentTable) return;
    const newRows = currentTable.rows.map((row, rI) => {
      if (rI !== rowIdx) return row;
      const updatedRow = [...row];
      updatedRow[colIdx] = newValue;
      return updatedRow;
    });

    const updatedMarkdown = replaceMarkdownTable(
      markdown,
      currentTable,
      currentTable.headers,
      newRows
    );
    onChange(updatedMarkdown);
  };

  // Header change handler
  const handleHeaderChange = (colIdx, newHeaderValue) => {
    if (!currentTable) return;
    const newHeaders = [...currentTable.headers];
    newHeaders[colIdx] = newHeaderValue;

    const updatedMarkdown = replaceMarkdownTable(
      markdown,
      currentTable,
      newHeaders,
      currentTable.rows
    );
    onChange(updatedMarkdown);
  };

  // Add row
  const handleAddRow = (insertIndex = null) => {
    if (!currentTable) return;
    const blankRow = currentTable.headers.map(() => '');
    const newRows = [...currentTable.rows];

    if (insertIndex !== null && insertIndex >= 0) {
      newRows.splice(insertIndex + 1, 0, blankRow);
    } else {
      newRows.push(blankRow);
    }

    const updatedMarkdown = replaceMarkdownTable(
      markdown,
      currentTable,
      currentTable.headers,
      newRows
    );
    onChange(updatedMarkdown);
  };

  // Duplicate row
  const handleDuplicateRow = (rowIdx) => {
    if (!currentTable || !currentTable.rows[rowIdx]) return;
    const duplicatedRow = [...currentTable.rows[rowIdx]];
    const newRows = [...currentTable.rows];
    newRows.splice(rowIdx + 1, 0, duplicatedRow);

    const updatedMarkdown = replaceMarkdownTable(
      markdown,
      currentTable,
      currentTable.headers,
      newRows
    );
    onChange(updatedMarkdown);
  };

  // Delete row
  const handleDeleteRow = (rowIdx) => {
    if (!currentTable) return;
    const newRows = currentTable.rows.filter((_, idx) => idx !== rowIdx);

    const updatedMarkdown = replaceMarkdownTable(
      markdown,
      currentTable,
      currentTable.headers,
      newRows
    );
    onChange(updatedMarkdown);
  };

  // Move row up or down
  const handleMoveRow = (rowIdx, direction) => {
    if (!currentTable) return;
    const targetIdx = direction === 'up' ? rowIdx - 1 : rowIdx + 1;
    if (targetIdx < 0 || targetIdx >= currentTable.rows.length) return;

    const newRows = [...currentTable.rows];
    const temp = newRows[rowIdx];
    newRows[rowIdx] = newRows[targetIdx];
    newRows[targetIdx] = temp;

    const updatedMarkdown = replaceMarkdownTable(
      markdown,
      currentTable,
      currentTable.headers,
      newRows
    );
    onChange(updatedMarkdown);
  };

  // Add column
  const handleAddColumn = () => {
    if (!currentTable) return;
    const colName = isEN
      ? `New Column ${currentTable.headers.length + 1}`
      : `Cột Mới ${currentTable.headers.length + 1}`;
    const newHeaders = [...currentTable.headers, colName];
    const newRows = currentTable.rows.map((row) => [...row, '']);

    const updatedMarkdown = replaceMarkdownTable(
      markdown,
      currentTable,
      newHeaders,
      newRows
    );
    onChange(updatedMarkdown);
  };

  // Delete column
  const handleDeleteColumn = (colIdx) => {
    if (!currentTable || currentTable.headers.length <= 1) return;
    const colName = currentTable.headers[colIdx];
    const confirmMsg = isEN
      ? `Delete column "${colName}" and all its cell data?`
      : `Xoá cột "${colName}" cùng toàn bộ dữ liệu của cột này?`;
    if (!window.confirm(confirmMsg)) return;

    const newHeaders = currentTable.headers.filter((_, idx) => idx !== colIdx);
    const newRows = currentTable.rows.map((row) => row.filter((_, idx) => idx !== colIdx));

    const updatedMarkdown = replaceMarkdownTable(
      markdown,
      currentTable,
      newHeaders,
      newRows
    );
    onChange(updatedMarkdown);
  };

  // Create starter template table
  const handleCreateDefaultTable = () => {
    const template = getDefaultTemplate(isEN);
    const updatedMarkdown = appendMarkdownTable(
      markdown,
      template.title,
      template.headers,
      template.rows
    );
    onChange(updatedMarkdown);
  };

  // Export CSV
  const handleExportCSV = () => {
    if (!currentTable) return;
    const safeTitle = (currentTable.title || 'knowledge_table')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_');
    exportTableToCSV(currentTable.headers, currentTable.rows, `${safeTitle}.csv`);
  };

  // Import CSV
  const handleImportCSVFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result;
        if (typeof text !== 'string') return;
        const { headers, rows } = parseCSVToTable(text);

        if (!headers.length) {
          alert(isEN ? 'CSV file has no data headers.' : 'File CSV không có dữ liệu tiêu đề cột.');
          return;
        }

        if (currentTable) {
          // Replace current table
          const updatedMarkdown = replaceMarkdownTable(markdown, currentTable, headers, rows);
          onChange(updatedMarkdown);
        } else {
          // Create new table
          const updatedMarkdown = appendMarkdownTable(
            markdown,
            file.name.replace(/\.csv$/i, ''),
            headers,
            rows
          );
          onChange(updatedMarkdown);
        }
      } catch (err) {
        alert(isEN ? `Error parsing CSV: ${err.message}` : `Lỗi đọc file CSV: ${err.message}`);
      }
    };
    reader.readAsText(file, 'utf-8');
    if (csvInputRef.current) csvInputRef.current.value = '';
  };

  // Filtered rows for current table
  const filteredRowsWithIndex = useMemo(() => {
    if (!currentTable) return [];
    const query = searchQuery.trim().toLowerCase();
    return currentTable.rows
      .map((row, originalIndex) => ({ row, originalIndex }))
      .filter(({ row }) => {
        if (!query) return true;
        return row.some((cell) => String(cell || '').toLowerCase().includes(query));
      });
  }, [currentTable, searchQuery]);

  // Filtered section items
  const filteredSectionItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return sectionItems;
    return sectionItems.filter(
      (item) =>
        item.section.toLowerCase().includes(query) ||
        item.name.toLowerCase().includes(query) ||
        item.details.toLowerCase().includes(query)
    );
  }, [sectionItems, searchQuery]);

  return (
    <div className="flex flex-col h-full space-y-3 font-sans select-none">
      {/* Hidden CSV file input */}
      <input
        ref={csvInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={handleImportCSVFile}
      />

      {/* TOP CONTROLS: SHEET SELECTOR & TOOLBAR */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2 border-b border-stone-200">
        {/* Sheet Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto max-w-full py-0.5 custom-scrollbar">
          {extractedTables.map((tbl, idx) => (
            <button
              key={tbl.id}
              onClick={() => setActiveSheetId(tbl.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 border ${
                activeSheetId === tbl.id
                  ? 'bg-stone-900 text-white border-stone-900 shadow-xs'
                  : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100 hover:text-stone-900'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
              <span className="truncate max-w-[200px]">{tbl.title || `Bảng ${idx + 1}`}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  activeSheetId === tbl.id ? 'bg-stone-700 text-white' : 'bg-stone-100 text-stone-600'
                }`}
              >
                {tbl.rows.length}
              </span>
            </button>
          ))}

          {/* Section Items Grid Tab */}
          <button
            onClick={() => setActiveSheetId('sections_grid')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 border ${
              activeSheetId === 'sections_grid'
                ? 'bg-stone-900 text-white border-stone-900 shadow-xs'
                : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100 hover:text-stone-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-indigo-500" />
            <span>{isEN ? 'Facilities & Sections Grid' : 'Chi Tiết Cơ Sở Vật Chất (Tất Cả)'}</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                activeSheetId === 'sections_grid'
                  ? 'bg-stone-700 text-white'
                  : 'bg-stone-100 text-stone-600'
              }`}
            >
              {sectionItems.length}
            </span>
          </button>

          {/* Add Table button */}
          <button
            onClick={handleCreateDefaultTable}
            title={isEN ? 'Insert new Table into Markdown' : 'Chèn thêm bảng mới vào tài liệu'}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-stone-600 hover:text-stone-900 hover:bg-stone-100 border border-dashed border-stone-300 transition-colors cursor-pointer flex items-center gap-1 shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isEN ? 'New Table' : 'Thêm Bảng'}</span>
          </button>
        </div>

        {/* Action Toolbar */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Quick Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isEN ? 'Filter rows in table...' : 'Tìm kiếm dòng...'}
              className="pl-8 pr-3 py-1 text-xs bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-indigo-600 text-stone-800 w-36 sm:w-48 shadow-2xs font-medium"
            />
          </div>

          {currentTable && (
            <>
              {/* Add Row Button */}
              <button
                onClick={() => handleAddRow()}
                className="px-2.5 py-1 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isEN ? 'Add Row' : 'Thêm Dòng'}</span>
              </button>

              {/* Add Column Button */}
              <button
                onClick={handleAddColumn}
                title={isEN ? 'Add new column' : 'Thêm cột mới'}
                className="px-2 py-1 text-xs font-semibold text-stone-700 hover:text-stone-900 hover:bg-stone-100 border border-stone-300 rounded-lg transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
              >
                <Columns className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{isEN ? 'Add Col' : 'Thêm Cột'}</span>
              </button>

              {/* Export CSV */}
              <button
                onClick={handleExportCSV}
                title={isEN ? 'Export table to CSV (Excel)' : 'Xuất bảng ra file CSV cho Excel'}
                className="p-1.5 text-stone-600 hover:text-stone-900 hover:bg-stone-100 border border-stone-300 rounded-lg transition-colors cursor-pointer shadow-2xs"
              >
                <Download className="w-3.5 h-3.5" />
              </button>

              {/* Import CSV */}
              <button
                onClick={() => csvInputRef.current?.click()}
                title={isEN ? 'Import CSV into table' : 'Nhập dữ liệu từ file CSV'}
                className="p-1.5 text-stone-600 hover:text-stone-900 hover:bg-stone-100 border border-stone-300 rounded-lg transition-colors cursor-pointer shadow-2xs"
              >
                <Upload className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* VIEW A: SPREADSHEET TABLE GRID */}
      {activeSheetId !== 'sections_grid' && currentTable && (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-1.5 px-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-stone-800 tracking-tight">
                {currentTable.title}
              </span>
              <span className="text-[10px] text-stone-500 font-medium">
                ({filteredRowsWithIndex.length}/{currentTable.rows.length}{' '}
                {isEN ? 'rows' : 'dòng dữ liệu'})
              </span>
            </div>
            <span className="text-[10px] text-stone-400 italic">
              {isEN
                ? 'Tip: Click any cell to edit. Changes sync instantly to Markdown.'
                : 'Mẹo: Nhấn vào ô để chỉnh sửa. Dữ liệu sẽ tự động đồng bộ sang Markdown.'}
            </span>
          </div>

          {/* Excel Spreadsheet Table */}
          <div className="flex-1 overflow-auto border border-stone-300 rounded-xl bg-white shadow-2xs custom-scrollbar">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="bg-stone-100 sticky top-0 z-10 border-b border-stone-300 shadow-2xs">
                <tr>
                  {/* Row Number Header */}
                  <th className="w-12 py-2 px-2.5 text-center font-mono font-bold text-[11px] text-stone-500 border-r border-stone-300 bg-stone-100 select-none">
                    #
                  </th>

                  {/* Dynamic Column Headers */}
                  {currentTable.headers.map((header, colIdx) => (
                    <th
                      key={colIdx}
                      className="py-2 px-3 font-bold text-[11px] text-stone-800 border-r border-stone-300 min-w-[140px] bg-stone-100"
                    >
                      <div className="flex items-center justify-between gap-1 group">
                        <input
                          type="text"
                          value={header}
                          onChange={(e) => handleHeaderChange(colIdx, e.target.value)}
                          className="w-full bg-transparent font-bold text-stone-900 border-b border-transparent hover:border-stone-400 focus:border-indigo-600 focus:bg-white focus:outline-none px-1 py-0.5 rounded transition-all"
                        />
                        {currentTable.headers.length > 1 && (
                          <button
                            onClick={() => handleDeleteColumn(colIdx)}
                            title={isEN ? 'Delete this column' : 'Xoá cột này'}
                            className="opacity-0 group-hover:opacity-100 p-0.5 text-stone-400 hover:text-red-600 transition-opacity cursor-pointer shrink-0"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </th>
                  ))}

                  {/* Actions Column */}
                  <th className="w-24 py-2 px-2.5 text-center font-bold text-[11px] text-stone-600 bg-stone-100 select-none">
                    {isEN ? 'Actions' : 'Thao tác'}
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-stone-200">
                {filteredRowsWithIndex.length === 0 ? (
                  <tr>
                    <td
                      colSpan={currentTable.headers.length + 2}
                      className="py-12 text-center text-stone-400 text-xs italic"
                    >
                      {searchQuery
                        ? isEN
                          ? 'No matching rows found.'
                          : 'Không tìm thấy dòng phù hợp từ khoá.'
                        : isEN
                        ? 'No data rows in this table.'
                        : 'Bảng chưa có dữ liệu.'}
                    </td>
                  </tr>
                ) : (
                  filteredRowsWithIndex.map(({ row, originalIndex }, displayIdx) => (
                    <tr
                      key={originalIndex}
                      className="hover:bg-indigo-50/40 transition-colors group"
                    >
                      {/* Row Index */}
                      <td className="py-1 px-2 text-center font-mono text-[11px] text-stone-400 border-r border-stone-200 bg-stone-50/50 select-none font-semibold">
                        {displayIdx + 1}
                      </td>

                      {/* Cells */}
                      {currentTable.headers.map((_, colIdx) => {
                        const cellValue = row[colIdx] !== undefined ? row[colIdx] : '';
                        const isMultiLine = cellValue.includes('\n');

                        return (
                          <td
                            key={colIdx}
                            className="p-1 border-r border-stone-200 align-top focus-within:ring-2 focus-within:ring-indigo-500/50 focus-within:bg-indigo-50/20"
                          >
                            {isMultiLine || cellValue.length > 50 ? (
                              <textarea
                                value={cellValue}
                                onChange={(e) =>
                                  handleCellChange(originalIndex, colIdx, e.target.value)
                                }
                                rows={Math.min(4, Math.max(2, cellValue.split('\n').length))}
                                className="w-full p-1.5 text-xs font-sans text-stone-900 bg-transparent rounded border border-transparent hover:border-stone-300 focus:border-indigo-600 focus:bg-white focus:outline-none transition-all resize-y leading-relaxed"
                              />
                            ) : (
                              <input
                                type="text"
                                value={cellValue}
                                onChange={(e) =>
                                  handleCellChange(originalIndex, colIdx, e.target.value)
                                }
                                className="w-full px-2 py-1.5 text-xs font-sans text-stone-900 bg-transparent rounded border border-transparent hover:border-stone-300 focus:border-indigo-600 focus:bg-white focus:outline-none transition-all"
                              />
                            )}
                          </td>
                        );
                      })}

                      {/* Row Actions */}
                      <td className="py-1 px-2 text-center align-middle whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                          {/* Move Up */}
                          <button
                            onClick={() => handleMoveRow(originalIndex, 'up')}
                            disabled={originalIndex === 0}
                            title={isEN ? 'Move row up' : 'Di chuyển lên'}
                            className="p-1 rounded text-stone-400 hover:text-stone-900 hover:bg-stone-200 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>

                          {/* Move Down */}
                          <button
                            onClick={() => handleMoveRow(originalIndex, 'down')}
                            disabled={originalIndex === currentTable.rows.length - 1}
                            title={isEN ? 'Move row down' : 'Di chuyển xuống'}
                            className="p-1 rounded text-stone-400 hover:text-stone-900 hover:bg-stone-200 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>

                          {/* Duplicate */}
                          <button
                            onClick={() => handleDuplicateRow(originalIndex)}
                            title={isEN ? 'Duplicate row' : 'Nhân bản dòng'}
                            className="p-1 rounded text-stone-400 hover:text-stone-900 hover:bg-stone-200 cursor-pointer transition-colors"
                          >
                            <Copy className="w-3 h-3" />
                          </button>

                          {/* Insert Below */}
                          <button
                            onClick={() => handleAddRow(originalIndex)}
                            title={isEN ? 'Insert row below' : 'Chèn dòng bên dưới'}
                            className="p-1 rounded text-stone-400 hover:text-emerald-700 hover:bg-emerald-50 cursor-pointer transition-colors"
                          >
                            <Plus className="w-3 h-3" />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => handleDeleteRow(originalIndex)}
                            title={isEN ? 'Delete row' : 'Xoá dòng'}
                            className="p-1 rounded text-stone-400 hover:text-red-700 hover:bg-red-50 cursor-pointer transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW B: ALL FACILITIES & SECTIONS GRID */}
      {activeSheetId === 'sections_grid' && (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-1.5 px-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-stone-800 tracking-tight">
                {isEN
                  ? 'All Facilities, Amenities & Floor Policies'
                  : 'Danh Sách Cơ Sở Vật Chất & Tiện Ích Toàn Khách Sạn'}
              </span>
              <span className="text-[10px] text-stone-500 font-medium">
                ({filteredSectionItems.length} {isEN ? 'items' : 'mục'})
              </span>
            </div>
            <span className="text-[10px] text-stone-400 italic">
              {isEN
                ? 'Structured from document sections (H2/H3) and bullet points.'
                : 'Bóc tách từ các đề mục H2/H3 và danh sách tiện ích của tài liệu.'}
            </span>
          </div>

          <div className="flex-1 overflow-auto border border-stone-300 rounded-xl bg-white shadow-2xs custom-scrollbar">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="bg-stone-100 sticky top-0 z-10 border-b border-stone-300 shadow-2xs">
                <tr>
                  <th className="w-12 py-2 px-2.5 text-center font-mono font-bold text-[11px] text-stone-500 border-r border-stone-300 bg-stone-100 select-none">
                    #
                  </th>
                  <th className="py-2 px-3 font-bold text-[11px] text-stone-800 border-r border-stone-300 w-1/4">
                    {isEN ? 'Floor / Section' : 'Khu Vực / Tầng / Đề Mục'}
                  </th>
                  <th className="py-2 px-3 font-bold text-[11px] text-stone-800 border-r border-stone-300 w-1/4">
                    {isEN ? 'Facility / Service Name' : 'Tên Tiện Ích / Dịch Vụ'}
                  </th>
                  <th className="py-2 px-3 font-bold text-[11px] text-stone-800 w-1/2">
                    {isEN ? 'Operational Details & Regulations' : 'Chi Tiết Quy Định & Vận Hành'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {filteredSectionItems.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-stone-400 text-xs italic">
                      {isEN
                        ? 'No structured facility items found.'
                        : 'Không có dữ liệu cơ sở vật chất dạng danh sách.'}
                    </td>
                  </tr>
                ) : (
                  filteredSectionItems.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-indigo-50/30 transition-colors">
                      <td className="py-2 px-2 text-center font-mono text-[11px] text-stone-400 border-r border-stone-200 bg-stone-50/50 select-none font-semibold">
                        {idx + 1}
                      </td>
                      <td className="py-2 px-3 border-r border-stone-200 align-top">
                        <span className="font-bold text-stone-900 block leading-tight">
                          {item.section}
                        </span>
                        {item.subCategory && (
                          <span className="text-[10px] text-stone-500 block mt-0.5">
                            {item.subCategory}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 border-r border-stone-200 align-top">
                        <span className="font-bold text-indigo-950 bg-indigo-50/80 px-2 py-0.5 rounded text-xs border border-indigo-100 inline-block">
                          {item.name}
                        </span>
                      </td>
                      <td className="py-2 px-3 align-top text-stone-700 leading-relaxed font-sans whitespace-pre-line text-xs">
                        {item.details}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* EMPTY STATE IF NO TABLE EXISTS */}
      {extractedTables.length === 0 && activeSheetId !== 'sections_grid' && (
        <div className="flex-1 flex flex-col items-center justify-center p-8 border-2 border-dashed border-stone-300 rounded-xl bg-stone-50 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <TableIcon className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-stone-900">
              {isEN ? 'No Markdown Tables in Document' : 'Tài Liệu Chưa Có Bảng Dữ Liệu'}
            </h4>
            <p className="text-xs text-stone-500 max-w-md mt-1">
              {isEN
                ? 'You can create a structured table template for easy Excel-like editing, or browse all facilities in the Sections tab above.'
                : 'Bạn có thể tạo bảng tra cứu tiện ích theo mẫu chuẩn để chỉnh sửa dạng Excel, hoặc xem danh sách tiện ích ở tab bên trên.'}
            </p>
          </div>
          <button
            onClick={handleCreateDefaultTable}
            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            <span>
              {isEN
                ? 'Create Hotel Facilities Master Table'
                : 'Tạo Bảng Tra Cứu Tiện Ích Chuẩn'}
            </span>
          </button>
        </div>
      )}
    </div>
  );
};
