import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Reusable Pagination Component (20 items/page by default)
 * Matches the requested UX design with numbered pills and jump-to-page input.
 */
export const Pagination = ({
  currentPage = 1,
  totalItems = 0,
  pageSize = 20,
  onPageChange = () => {},
  className = '',
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const [jumpPage, setJumpPage] = useState(currentPage);

  useEffect(() => {
    setJumpPage(currentPage);
  }, [currentPage]);

  const handleJump = (e) => {
    if (e) e.preventDefault();
    const target = parseInt(jumpPage, 10);
    if (!isNaN(target) && target >= 1 && target <= totalPages) {
      onPageChange(target);
    } else {
      setJumpPage(currentPage);
    }
  };

  // Generate pagination page numbers array with smart ellipsis (...)
  const getPageNumbers = () => {
    const pages = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 4) {
        pages.push(1, 2, 3, 4, 5, '...', totalPages);
      } else if (currentPage >= totalPages - 3) {
        pages.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
      }
    }
    return pages;
  };

  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <div
      className={`p-4 border-t border-stone-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-stone-50/40 text-xs ${className}`}
    >
      {/* Left: Range text */}
      <div className="text-stone-500 font-medium">
        Hiển thị <span className="font-bold text-stone-900">{startItem}</span> -{' '}
        <span className="font-bold text-stone-900">{endItem}</span> trong tổng số{' '}
        <span className="font-bold text-stone-900">{totalItems}</span> bản ghi (20 mục / trang)
      </div>

      {/* Right: Pagination buttons and Jump Input */}
      <div className="flex items-center gap-4 flex-wrap justify-center sm:justify-end">
        {/* Page Buttons List */}
        <div className="flex items-center gap-1">
          {/* Previous Button */}
          <button
            type="button"
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage <= 1}
            className="w-8 h-8 rounded-xl border border-stone-200 bg-white hover:bg-stone-100 text-stone-700 disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center transition-all cursor-pointer shadow-xs"
            title="Trang trước"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Numbered Buttons */}
          {getPageNumbers().map((p, idx) => {
            if (p === '...') {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  className="w-8 h-8 flex items-center justify-center text-stone-400 font-bold text-xs select-none"
                >
                  ...
                </span>
              );
            }

            const isCurrent = p === currentPage;
            return (
              <button
                key={`page-${p}`}
                type="button"
                onClick={() => onPageChange(p)}
                className={`w-8 h-8 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center ${
                  isCurrent
                    ? 'bg-stone-900 text-white shadow-md scale-105'
                    : 'bg-white hover:bg-stone-100 text-stone-700 border border-stone-200 shadow-xs'
                }`}
              >
                {p}
              </button>
            );
          })}

          {/* Next Button */}
          <button
            type="button"
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage >= totalPages}
            className="w-8 h-8 rounded-xl border border-stone-200 bg-white hover:bg-stone-100 text-stone-700 disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center transition-all cursor-pointer shadow-xs"
            title="Trang tiếp theo"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Jump-to-page input box (Matching design in screenshot) */}
        <form onSubmit={handleJump} className="flex items-center gap-1.5 pl-2 border-l border-stone-200">
          <input
            type="number"
            min={1}
            max={totalPages}
            value={jumpPage}
            onChange={(e) => setJumpPage(e.target.value)}
            className="w-14 py-1.5 px-1.5 text-center font-mono font-bold text-xs bg-white border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs"
          />
          <span className="text-stone-400 font-bold text-xs select-none">/ {totalPages}</span>
          <button
            type="submit"
            className="px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer ml-1"
          >
            Đi đến
          </button>
        </form>
      </div>
    </div>
  );
};
