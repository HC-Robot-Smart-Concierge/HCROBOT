import React from 'react';

export const ConciergeTestCallModal = ({
  isOpen,
  onClose,
  onSubmit,
  testForm,
  setTestForm,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-palette-charcoal/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-palette-silver">
        <h2 className="text-base font-bold text-palette-charcoal mb-4">Mô Phỏng Cuộc Gọi Từ Robot Kiosk</h2>
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-palette-charcoal">Vị trí Kiosk</label>
            <input
              type="text"
              required
              value={testForm.room_number}
              onChange={(e) => setTestForm({ ...testForm, room_number: e.target.value })}
              className="w-full mt-1 px-3 py-1.5 border border-palette-silver rounded-lg text-xs outline-none focus:border-palette-charcoal"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-palette-charcoal">Tên khách hàng</label>
            <input
              type="text"
              required
              value={testForm.guest_name}
              onChange={(e) => setTestForm({ ...testForm, guest_name: e.target.value })}
              className="w-full mt-1 px-3 py-1.5 border border-palette-silver rounded-lg text-xs outline-none focus:border-palette-charcoal"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-palette-charcoal">Nội dung hội thoại Robot chuyển tiếp</label>
            <textarea
              rows="3"
              value={testForm.transcript}
              onChange={(e) => setTestForm({ ...testForm, transcript: e.target.value })}
              className="w-full mt-1 px-3 py-1.5 border border-palette-silver rounded-lg text-xs outline-none focus:border-palette-charcoal"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-palette-silver/50">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-palette-slate hover:text-palette-charcoal hover:bg-palette-stone rounded-lg font-semibold transition-all cursor-pointer"
            >
              Huỷ
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 text-xs bg-palette-charcoal hover:bg-neutral-800 text-palette-cream rounded-lg font-semibold transition-all shadow-sm cursor-pointer"
            >
              Phát tín hiệu gọi
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

