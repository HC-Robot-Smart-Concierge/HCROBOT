import React from 'react';
import { handleNumericKeyDown, handleNumberInputBlockExponent, sanitizeDigitsOnly } from '../../../utils/numberInputHelper';

export const ConciergeTaxiBookingModal = ({
  isOpen,
  onClose,
  onSubmit,
  taxiForm,
  setTaxiForm,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-palette-charcoal/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-palette-silver">
        <h2 className="text-base font-bold text-palette-charcoal mb-4">Tạo Yêu Cầu Đặt Xe Mới</h2>
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-palette-charcoal">Tên khách hàng *</label>
            <input
              type="text"
              required
              value={taxiForm.guest_name}
              onChange={(e) => setTaxiForm({ ...taxiForm, guest_name: e.target.value })}
              className="w-full mt-1 px-3 py-1.5 border border-palette-silver rounded-lg text-xs outline-none focus:border-palette-charcoal"
              placeholder="Vd: Mr. David Miller"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-semibold text-palette-charcoal">Số phòng</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={taxiForm.room_number}
                onKeyDown={(e) => handleNumericKeyDown(e)}
                onChange={(e) => setTaxiForm({ ...taxiForm, room_number: sanitizeDigitsOnly(e.target.value, 6) })}
                className="w-full mt-1 px-3 py-1.5 border border-palette-silver rounded-lg text-xs outline-none focus:border-palette-charcoal"
                placeholder="Vd: 501"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-palette-charcoal">Số khách</label>
              <input
                type="number"
                min="1"
                max="16"
                value={taxiForm.party_size}
                onKeyDown={(e) => handleNumberInputBlockExponent(e, { allowDecimal: false })}
                onChange={(e) => {
                  const val = sanitizeDigitsOnly(e.target.value);
                  setTaxiForm({ ...taxiForm, party_size: val ? Math.min(16, Math.max(1, parseInt(val, 10))) : 1 });
                }}
                className="w-full mt-1 px-3 py-1.5 border border-palette-silver rounded-lg text-xs outline-none focus:border-palette-charcoal"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-palette-charcoal">Điểm đón</label>
            <input
              type="text"
              value={taxiForm.pickup_location}
              onChange={(e) => setTaxiForm({ ...taxiForm, pickup_location: e.target.value })}
              className="w-full mt-1 px-3 py-1.5 border border-palette-silver rounded-lg text-xs outline-none focus:border-palette-charcoal"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-palette-charcoal">Điểm đến</label>
            <input
              type="text"
              value={taxiForm.destination}
              onChange={(e) => setTaxiForm({ ...taxiForm, destination: e.target.value })}
              className="w-full mt-1 px-3 py-1.5 border border-palette-silver rounded-lg text-xs outline-none focus:border-palette-charcoal"
              placeholder="Vd: Sân bay Đà Nẵng, Phố Cổ Hội An..."
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-semibold text-palette-charcoal">Loại xe</label>
              <select
                value={taxiForm.vehicle_type}
                onChange={(e) => setTaxiForm({ ...taxiForm, vehicle_type: e.target.value })}
                className="w-full mt-1 px-3 py-1.5 border border-palette-silver rounded-lg text-xs outline-none focus:border-palette-charcoal bg-white"
              >
                <option value="4-Seater Sedan">Sedan 4 chỗ</option>
                <option value="7-Seater SUV">SUV 7 chỗ</option>
                <option value="Luxury Limousine">Limousine VIP</option>
                <option value="16-Seater Van">Xe 16 chỗ</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-palette-charcoal">Thời gian đón</label>
              <input
                type="text"
                value={taxiForm.pickup_time}
                onChange={(e) => setTaxiForm({ ...taxiForm, pickup_time: e.target.value })}
                className="w-full mt-1 px-3 py-1.5 border border-palette-silver rounded-lg text-xs outline-none focus:border-palette-charcoal"
                placeholder="Vd: 14:00 Chiều nay"
              />
            </div>
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
              Xác nhận gọi xe
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

