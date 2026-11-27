import React from 'react';
import { handleNumericKeyDown, handleNumberInputBlockExponent, sanitizeDigitsOnly } from '../../../utils/numberInputHelper';

export const ConciergeTaxiBookingModal = ({ isOpen, onClose, onSubmit, taxiForm, setTaxiForm, isEn = false, isSubmitting = false }) => {
  if (!isOpen) return null;
  const t = (vi, en) => isEn ? en : vi;
  const inputClass = 'w-full mt-1 px-3 py-2 border border-palette-silver rounded-lg text-xs outline-none focus:border-palette-charcoal bg-white';
  return (
    <div className="fixed inset-0 z-50 bg-palette-charcoal/70 backdrop-blur-xs flex items-center justify-center p-4">
      <section role="dialog" aria-modal="true" aria-label={t('Nhờ đặt xe taxi', 'Taxi assistance')} className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-palette-silver">
        <h2 className="text-base font-bold text-palette-charcoal mb-4">{t('Tạo yêu cầu nhờ đặt xe', 'New taxi assistance request')}</h2>
        <form onSubmit={onSubmit} className="space-y-3">
          <label className="block text-xs font-semibold text-palette-charcoal">
            {t('Số phòng', 'Room number')} *
            <input required inputMode="numeric" maxLength={6} value={taxiForm.room_number} disabled={isSubmitting}
              onKeyDown={handleNumericKeyDown} onChange={e => setTaxiForm({ ...taxiForm, room_number: sanitizeDigitsOnly(e.target.value, 6) })}
              className={inputClass} placeholder={t('Ví dụ: 301', 'For example: 301')} />
          </label>
          <p className="text-xs text-palette-slate">{t('Tên và số điện thoại khách được lấy từ thông tin phòng đang lưu trú.', 'Guest name and contact numbers are taken from the occupied room.')}</p>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-semibold text-palette-charcoal">
              {t('Số khách (nếu đã biết)', 'Passengers (if known)')}
              <input type="number" min="1" max="100" value={taxiForm.party_size} disabled={isSubmitting}
                onKeyDown={e => handleNumberInputBlockExponent(e, { allowDecimal: false })}
                onChange={e => setTaxiForm({ ...taxiForm, party_size: sanitizeDigitsOnly(e.target.value, 3) })}
                className={inputClass} placeholder={t('Chưa xác định', 'Not specified')} />
            </label>
            <label className="block text-xs font-semibold text-palette-charcoal">
              {t('Xe khách yêu cầu', 'Requested car')}
              <select value={taxiForm.vehicle_type} disabled={isSubmitting} onChange={e => setTaxiForm({ ...taxiForm, vehicle_type: e.target.value })} className={inputClass}>
                <option value="">{t('Chưa xác định', 'Not specified')}</option>
                <option value="4-Seater Sedan">{t('Xe 4 chỗ', '4-seater car')}</option>
                <option value="7-Seater SUV">{t('Xe 7 chỗ', '7-seater car')}</option>
                <option value="16-Seater Van">{t('Xe 16 chỗ', '16-seater van')}</option>
              </select>
            </label>
          </div>
          <label className="block text-xs font-semibold text-palette-charcoal">
            {t('Nhu cầu / ghi chú của khách', 'Guest requirements / notes')}
            <textarea rows={4} maxLength={4000} value={taxiForm.description} disabled={isSubmitting}
              onChange={e => setTaxiForm({ ...taxiForm, description: e.target.value })} className={inputClass}
              placeholder={t('Ví dụ: Có 2 vali lớn, muốn xe rộng, cần xe lúc 7 giờ...', 'For example: two large bags, a spacious car, needed at 7 am...')} />
          </label>
          <footer className="flex justify-end gap-2 pt-3 border-t border-palette-silver/50">
            <button type="button" disabled={isSubmitting} onClick={onClose} className="px-3 py-2 text-xs text-palette-slate rounded-lg hover:bg-palette-stone">{t('Hủy', 'Cancel')}</button>
            <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-xs bg-palette-charcoal text-palette-cream rounded-lg font-semibold disabled:opacity-50">{isSubmitting ? t('Đang gửi...', 'Sending...') : t('Tạo yêu cầu', 'Create request')}</button>
          </footer>
        </form>
      </section>
    </div>
  );
};
