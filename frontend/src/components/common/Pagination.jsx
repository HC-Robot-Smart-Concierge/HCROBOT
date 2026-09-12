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
  itemName = 'mục',
  className = '',
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const [jumpPage, setJumpPage] = useState(currentPage);

  useEffect(() => {
    setJumpPage(currentPage);
  }, [currentPage]);

  const handleJump = (e) => {
    if (e && e.preventDefault) e.preventDefault();
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
      className={`py-2 px-4 border-t flex flex-col sm:flex-row items-center justify-between gap-2 text-xs select-none ${className}`}
      style={{
        backgroundColor: '#E9E5DC',
        borderColor: '#BFBFBD',
        color: '#262626',
      }}
    >
      {/* Left: Range text */}
      <div className="text-[11px]" style={{ color: '#8C8C8C' }}>
        Hiển thị <span className="font-bold" style={{ color: '#262626' }}>{startItem}</span> -{' '}
        <span className="font-bold" style={{ color: '#262626' }}>{endItem}</span> /{' '}
        <span className="font-bold" style={{ color: '#262626' }}>{totalItems}</span> {itemName} ({pageSize} / trang)
      </div>

      {/* Right: Pagination buttons and Jump Input */}
      <div className="flex items-center gap-3 flex-wrap justify-center sm:justify-end">
        {/* Page Buttons List */}
        <div className="flex items-center gap-1">
          {/* Previous Button */}
          <button
            type="button"
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage <= 1}
            className="w-6 h-6 rounded border flex items-center justify-center text-xs font-bold disabled:opacity-40 disabled:pointer-events-none cursor-pointer hover:bg-stone-100 transition-colors"
            style={{
              backgroundColor: '#FFFFFF',
              borderColor: '#BFBFBD',
              color: '#262626',
            }}
            title="Trang trước"
          >
            ‹
          </button>

          {/* Numbered Buttons */}
          {getPageNumbers().map((p, idx) => {
            if (p === '...') {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  className="w-6 h-6 flex items-center justify-center text-xs select-none"
                  style={{ color: '#8C8C8C' }}
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
                className="w-6 h-6 rounded text-xs font-semibold flex items-center justify-center border cursor-pointer transition-colors"
                style={{
                  backgroundColor: isCurrent ? '#262626' : '#FFFFFF',
                  color: isCurrent ? '#F2EFE9' : '#262626',
                  borderColor: isCurrent ? '#262626' : '#BFBFBD',
                }}
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
            className="w-6 h-6 rounded border flex items-center justify-center text-xs font-bold disabled:opacity-40 disabled:pointer-events-none cursor-pointer hover:bg-stone-100 transition-colors"
            style={{
              backgroundColor: '#FFFFFF',
              borderColor: '#BFBFBD',
              color: '#262626',
            }}
            title="Trang tiếp theo"
          >
            ›
          </button>
        </div>

        {/* Jump-to-page input box without form wrapper */}
        <div className="flex items-center gap-1 pl-2 border-l" style={{ borderColor: '#BFBFBD' }}>
          <input
            type="number"
            min={1}
            max={totalPages}
            value={jumpPage}
            onChange={(e) => setJumpPage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleJump(e);
              }
            }}
            className="w-10 py-0.5 px-1 text-center font-mono text-xs rounded border focus:outline-none"
            style={{
              backgroundColor: '#FFFFFF',
              borderColor: '#BFBFBD',
              color: '#262626',
            }}
          />
          <span className="text-[11px] select-none" style={{ color: '#8C8C8C' }}>/ {totalPages}</span>
          <button
            type="button"
            onClick={handleJump}
            className="px-2 py-0.5 rounded text-[11px] font-semibold border cursor-pointer hover:opacity-80 transition-opacity"
            style={{
              backgroundColor: '#262626',
              borderColor: '#262626',
              color: '#F2EFE9',
            }}
          >
            Đến
          </button>
        </div>
      </div>
    </div>
  );
};
