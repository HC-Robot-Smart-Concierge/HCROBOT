import React from 'react';

export const DeleteConfirmModal = ({ target, onConfirm, onCancel }) => {
  if (!target) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-xs">
      <div
        className="max-w-sm w-full rounded-2xl border p-5 space-y-4 shadow-2xl animate-fadeIn"
        style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD' }}
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0 font-bold text-lg">
            ✕
          </div>
          <div>
            <h4 className="text-sm font-bold" style={{ color: '#262626' }}>
              Xác Nhận Xóa Điểm Mốc?
            </h4>
            <p className="text-xs text-stone-600 mt-1 leading-relaxed">
              Bạn có chắc chắn muốn xóa vĩnh viễn điểm mốc <strong className="text-stone-900">"{target.name}"</strong>? Điểm này sẽ bị xóa khỏi bản đồ LiDAR và cơ sở dữ liệu.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t" style={{ borderColor: '#E9E5DC' }}>
          <button
            type="button"
            onClick={onCancel}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer hover:bg-stone-100"
            style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
          >
            Hủy Bỏ
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-red-600 hover:bg-red-700 cursor-pointer transition-colors shadow-sm"
          >
            Xác Nhận Xóa
          </button>
        </div>
      </div>
    </div>
  );
};
