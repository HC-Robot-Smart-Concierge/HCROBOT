import React from 'react';
import { AlertTriangle } from 'lucide-react';

export const ResetSettingsModal = ({
  showResetModal,
  setShowResetModal,
  handleFactoryReset,
}) => {
  if (!showResetModal) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl border border-stone-200 shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6" />
        </div>

        <div className="text-center space-y-1.5">
          <h3 className="text-lg font-black text-stone-900">Xác Nhận Khôi Phục Cài Đặt Gốc?</h3>
          <p className="text-xs text-stone-500 leading-relaxed">
            Hành động này sẽ đặt lại toàn bộ cấu hình PMS, ngôn ngữ, âm lượng và các chính sách bảo mật về mặc định ban đầu. Bạn có chắc chắn muốn tiếp tục?
          </p>
        </div>

        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => setShowResetModal(false)}
            className="flex-1 py-2.5 rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700 font-bold text-xs transition-all cursor-pointer"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            onClick={handleFactoryReset}
            className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
          >
            Đồng Ý Khôi Phục
          </button>
        </div>
      </div>
    </div>
  );
};
