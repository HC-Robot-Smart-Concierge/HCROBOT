import React, { useState, useEffect } from 'react';
import { X, ShieldAlert, AlertTriangle } from 'lucide-react';

export const RejectReasonModal = ({
  isOpen,
  onClose,
  onConfirm,
  order,
  department = 'kitchen',
}) => {
  const [selectedPreset, setSelectedPreset] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [error, setError] = useState('');

  const kitchenPresets = [
    'Hết nguyên liệu chế biến',
    'Bếp đang quá tải đơn hàng',
    'Món ăn tạm ngưng phục vụ',
    'Ngoài khung giờ phục vụ của bếp',
  ];

  const roomServicePresets = [
    'Tạm hết đồ dùng / vật dụng yêu cầu',
    'Nhân viên buồng phòng đang kín lịch',
    'Dịch vụ tạm ngưng phục vụ ngoài giờ',
    'Phòng cần liên hệ lễ tân để xác nhận',
  ];

  const presets = department === 'kitchen' ? kitchenPresets : roomServicePresets;

  useEffect(() => {
    if (isOpen) {
      setSelectedPreset('');
      setCustomReason('');
      setError('');
    }
  }, [isOpen, order]);

  if (!isOpen || !order) return null;

  const handleSelectPreset = (preset) => {
    setSelectedPreset(preset);
    setCustomReason(preset);
    setError('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const finalReason = customReason.trim();
    if (!finalReason) {
      setError('Vui lòng chọn hoặc nhập lý do từ chối để Robot giải thích cho khách hàng.');
      return;
    }
    onConfirm(finalReason);
  };

  const isKitchen = department === 'kitchen';
  const title = isKitchen ? 'Từ chối đơn đặt món' : 'Từ chối yêu cầu phục vụ phòng';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
      <div 
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900">{title}</h3>
              <p className="text-xs text-stone-500">
                Đơn #{order.id} · Phòng {order.room || order.room_number || 'Khách'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {order.items && (
            <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 text-xs text-stone-600">
              <span className="font-semibold text-stone-700">Nội dung yêu cầu:</span>{' '}
              {typeof order.items === 'string'
                ? order.items
                : Array.isArray(order.items)
                ? order.items.map((it) => (typeof it === 'string' ? it : `${it.qty || it.quantity || 1}x ${it.name || it.item_name || ''}`)).join(', ')
                : ''}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-2">
              Lý do nhanh thường gặp:
            </label>
            <div className="grid grid-cols-2 gap-2">
              {presets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  className={`px-3 py-2 text-left rounded-xl border text-xs transition-all cursor-pointer ${
                    selectedPreset === preset
                      ? 'border-rose-500 bg-rose-50 text-rose-700 font-semibold shadow-xs'
                      : 'border-stone-200 bg-white hover:bg-stone-50 text-stone-700'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1.5">
              Lý do từ chối cụ thể <span className="text-rose-500">*</span>
              <span className="text-[11px] font-normal text-stone-400 ml-1">
                (Robot AI sẽ phát âm lý do này tới khách hàng)
              </span>
            </label>
            <textarea
              rows={3}
              value={customReason}
              onChange={(e) => {
                setCustomReason(e.target.value);
                if (error) setError('');
              }}
              placeholder={isKitchen ? 'Ví dụ: Hết nguyên liệu hải sản tươi trong ngày...' : 'Ví dụ: Đang giặt sấy, tạm hết khăn tắm bổ sung...'}
              className={`w-full rounded-xl border px-3.5 py-2.5 text-xs text-stone-800 placeholder-stone-400 focus:outline-hidden transition-all resize-none ${
                error
                  ? 'border-rose-400 ring-2 ring-rose-100'
                  : 'border-stone-300 focus:border-rose-500 focus:ring-2 focus:ring-rose-100'
              }`}
            />
            {error && (
              <p className="mt-1 text-xs text-rose-600 flex items-center gap-1 font-medium">
                <AlertTriangle className="w-3.5 h-3.5" />
                {error}
              </p>
            )}
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-stone-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-xs font-semibold text-stone-700 cursor-pointer transition-colors"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-xs font-bold text-white shadow-xs cursor-pointer transition-all active:scale-95"
            >
              Xác nhận từ chối
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

