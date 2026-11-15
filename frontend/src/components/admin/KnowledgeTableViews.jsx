import React from 'react';
import {
  Table as TableIcon,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Copy,
  Sparkles,
} from 'lucide-react';

export const KnowledgeSpreadsheetView = ({
  isEN,
  currentTable,
  filteredRowsWithIndex,
  searchQuery,
  handleHeaderChange,
  handleDeleteColumn,
  handleCellChange,
  handleMoveRow,
  handleDuplicateRow,
  handleAddRow,
  handleDeleteRow,
}) => (
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

    <div className="flex-1 overflow-auto border border-stone-300 rounded-xl bg-white shadow-2xs custom-scrollbar">
      <table className="w-full border-collapse text-left text-xs">
        <thead className="bg-stone-100 sticky top-0 z-10 border-b border-stone-300 shadow-2xs">
          <tr>
            <th className="w-12 py-2 px-2.5 text-center font-mono font-bold text-[11px] text-stone-500 border-r border-stone-300 bg-stone-100 select-none">
              #
            </th>

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
              <tr key={originalIndex} className="hover:bg-indigo-50/40 transition-colors group">
                <td className="py-1 px-2 text-center font-mono text-[11px] text-stone-400 border-r border-stone-200 bg-stone-50/50 select-none font-semibold">
                  {displayIdx + 1}
                </td>

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
                          onChange={(e) => handleCellChange(originalIndex, colIdx, e.target.value)}
                          rows={Math.min(4, Math.max(2, cellValue.split('\n').length))}
                          className="w-full p-1.5 text-xs font-sans text-stone-900 bg-transparent rounded border border-transparent hover:border-stone-300 focus:border-indigo-600 focus:bg-white focus:outline-none transition-all resize-y leading-relaxed"
                        />
                      ) : (
                        <input
                          type="text"
                          value={cellValue}
                          onChange={(e) => handleCellChange(originalIndex, colIdx, e.target.value)}
                          className="w-full px-2 py-1.5 text-xs font-sans text-stone-900 bg-transparent rounded border border-transparent hover:border-stone-300 focus:border-indigo-600 focus:bg-white focus:outline-none transition-all"
                        />
                      )}
                    </td>
                  );
                })}

                <td className="py-1 px-2 text-center align-middle whitespace-nowrap">
                  <div className="flex items-center justify-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleMoveRow(originalIndex, 'up')}
                      disabled={originalIndex === 0}
                      title={isEN ? 'Move row up' : 'Di chuyển lên'}
                      className="p-1 rounded text-stone-400 hover:text-stone-900 hover:bg-stone-200 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleMoveRow(originalIndex, 'down')}
                      disabled={originalIndex === currentTable.rows.length - 1}
                      title={isEN ? 'Move row down' : 'Di chuyển xuống'}
                      className="p-1 rounded text-stone-400 hover:text-stone-900 hover:bg-stone-200 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleDuplicateRow(originalIndex)}
                      title={isEN ? 'Duplicate row' : 'Nhân bản dòng'}
                      className="p-1 rounded text-stone-400 hover:text-stone-900 hover:bg-stone-200 cursor-pointer transition-colors"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleAddRow(originalIndex)}
                      title={isEN ? 'Insert row below' : 'Chèn dòng bên dưới'}
                      className="p-1 rounded text-stone-400 hover:text-emerald-700 hover:bg-emerald-50 cursor-pointer transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
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
);

export const KnowledgeSectionsGridView = ({ isEN, filteredSectionItems }) => (
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
                  <span className="font-bold text-stone-900 block leading-tight">{item.section}</span>
                  {item.subCategory && (
                    <span className="text-[10px] text-stone-500 block mt-0.5">{item.subCategory}</span>
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
);

export const KnowledgeTableEmptyState = ({ isEN, onCreateDefaultTable }) => (
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
      onClick={onCreateDefaultTable}
      className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-2"
    >
      <Sparkles className="w-4 h-4" />
      <span>
        {isEN ? 'Create Hotel Facilities Master Table' : 'Tạo Bảng Tra Cứu Tiện Ích Chuẩn'}
      </span>
    </button>
  </div>
);
