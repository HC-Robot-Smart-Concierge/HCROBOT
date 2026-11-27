import React, { useEffect, useState } from 'react';
import { Car, PhoneCall, Users, X } from 'lucide-react';
import { TAXI_PARTNERS, taxiVehicleLabel } from '../../../utils/taxiAssistance';

const OTHER_COMPANY = '__other__';
const VEHICLE_OPTIONS = ['4-Seater Sedan', '7-Seater SUV', '16-Seater Van'];

const emptyForm = (trip) => {
  const savedCompany = trip?.taxi_company || '';
  const isPartner = TAXI_PARTNERS.some((p) => p.name === savedCompany);
  return {
    company: savedCompany ? (isPartner ? savedCompany : OTHER_COMPANY) : '',
    customCompany: savedCompany && !isPartner ? savedCompany : '',
    vehicle_type: trip?.arranged_vehicle_type || trip?.vehicle_type || '',
    note: trip?.arrangement_note || '',
  };
};

/**
 * Bảng gọn để Concierge xác nhận hãng xe & loại xe/số chỗ đã đặt giúp khách.
 * Chỉ khi lưu thành công yêu cầu mới chuyển sang "Thành công".
 */
export const ConciergeTaxiArrangeModal = ({ trip, onClose, onSubmit, isSubmitting = false, isEn = false }) => {
  const t = (vi, en) => (isEn ? en : vi);
  const [form, setForm] = useState(() => emptyForm(trip));
  const [error, setError] = useState('');

  useEffect(() => {
    setForm(emptyForm(trip));
    setError('');
  }, [trip?.id]);

  if (!trip) return null;

  const update = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));
  const selectedPartner = TAXI_PARTNERS.find((p) => p.name === form.company);
  const companyName = form.company === OTHER_COMPANY ? form.customCompany.trim() : form.company;
  const vehicleOptions = form.vehicle_type && !VEHICLE_OPTIONS.includes(form.vehicle_type)
    ? [...VEHICLE_OPTIONS, form.vehicle_type]
    : VEHICLE_OPTIONS;
  const roomExtText = trip.room_phone
    ? (/^ext\b/i.test(String(trip.room_phone).trim()) ? trip.room_phone : `${t('Máy nhánh', 'Ext')} ${trip.room_phone}`)
    : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!companyName) {
      setError(t('Vui lòng chọn hoặc nhập hãng xe đã đặt.', 'Please choose or enter the taxi company.'));
      return;
    }
    if (!form.vehicle_type) {
      setError(t('Vui lòng chọn loại xe / số chỗ đã đặt cho khách.', 'Please select the car size booked for the guest.'));
      return;
    }
    setError('');
    const ok = await onSubmit?.({
      taxi_company: companyName,
      vehicle_type: form.vehicle_type,
      note: form.note,
    });
    if (ok === false) {
      setError(t('Chưa lưu được thông tin đặt xe. Vui lòng thử lại.', 'Could not save the booking details. Please try again.'));
    }
  };

  const inputClass = 'w-full mt-1 px-3 py-2 border border-palette-silver rounded-lg text-xs outline-none focus:border-palette-charcoal bg-white disabled:bg-palette-stone';
  const labelClass = 'block text-xs font-semibold text-palette-charcoal';

  return (
    <div className="fixed inset-0 z-50 bg-palette-charcoal/70 backdrop-blur-xs flex items-center justify-center p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-label={t('Xác nhận đặt xe giúp khách', 'Confirm taxi booked for guest')}
        className="bg-white rounded-xl max-w-md w-full max-h-[calc(100dvh-2rem)] overflow-y-auto p-6 shadow-xl border border-palette-silver"
      >
        <header className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-base font-bold text-palette-charcoal">{t('Xác nhận xe đã đặt giúp khách', 'Confirm taxi booked')}</h2>
            <p className="text-xs text-palette-slate mt-1">
              {t('Chọn hãng taxi và loại xe / số chỗ đã gọi giúp khách để hoàn tất yêu cầu.', 'Select the taxi company and car size arranged for the guest to complete the request.')}
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={isSubmitting} aria-label={t('Đóng', 'Close')} className="p-1.5 rounded-lg hover:bg-palette-stone disabled:opacity-40">
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* Tóm tắt yêu cầu của khách để nhân viên xem khi gọi xe */}
        <div className="rounded-lg border border-[#E2DFD9] bg-[#FAF9F6] p-3 text-xs text-[#555] space-y-1.5 mb-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono font-bold text-[#1A1917]">{trip.ticket_code || trip.id}</span>
            <span className="font-semibold text-[#262626]">{trip.guest_name}</span>
            {trip.room_number && <span>({t('Phòng', 'Room')} {trip.room_number})</span>}
          </div>
          <div className="flex flex-wrap gap-3">
            <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />
              {trip.party_size ? `${trip.party_size} ${t('khách', 'passengers')}` : t('Số khách chưa xác định', 'Passenger count not specified')}
            </span>
            <span className="flex items-center gap-1"><Car className="w-3.5 h-3.5" />{taxiVehicleLabel(trip.vehicle_type, isEn)}</span>
            {trip.guest_phone && <a href={`tel:${trip.guest_phone}`} className="flex items-center gap-1 text-emerald-700"><PhoneCall className="w-3.5 h-3.5" />{trip.guest_phone}</a>}
            {roomExtText && <span className="flex items-center gap-1"><PhoneCall className="w-3.5 h-3.5" />{roomExtText}</span>}
          </div>
          {trip.notes && (
            <p className="whitespace-pre-line break-words"><strong>{t('Ghi chú của khách: ', 'Guest note: ')}</strong>{trip.notes}</p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <label className={labelClass}>
            {t('Hãng xe đã gọi', 'Taxi company')} *
            <select value={form.company} onChange={update('company')} disabled={isSubmitting} className={inputClass}>
              <option value="">{t('— Chọn hãng xe —', '— Choose a company —')}</option>
              {TAXI_PARTNERS.map((p) => (
                <option key={p.id} value={p.name}>{p.name} · {p.hotline}</option>
              ))}
              <option value={OTHER_COMPANY}>{t('Khác (nhập tên)', 'Other (enter name)')}</option>
            </select>
          </label>
          {selectedPartner && (
            <a href={`tel:${selectedPartner.hotline.replace(/\s+/g, '')}`} className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
              <PhoneCall className="w-3.5 h-3.5" />{t('Gọi tổng đài', 'Call hotline')} {selectedPartner.hotline}
            </a>
          )}
          {form.company === OTHER_COMPANY && (
            <label className={labelClass}>
              {t('Tên hãng / đơn vị xe', 'Company / provider name')} *
              <input value={form.customCompany} onChange={update('customCompany')} maxLength={100} disabled={isSubmitting} className={inputClass} placeholder={t('Ví dụ: Xe Grab, xe khách sạn...', 'For example: Grab, hotel car...')} />
            </label>
          )}

          <label className={labelClass}>
            {t('Loại xe / số chỗ đã đặt', 'Booked car size')} *
            <select value={form.vehicle_type} onChange={update('vehicle_type')} disabled={isSubmitting} className={inputClass}>
              <option value="">{t('— Chọn loại xe —', '— Select car size —')}</option>
              {vehicleOptions.map((v) => <option key={v} value={v}>{taxiVehicleLabel(v, isEn)}</option>)}
            </select>
          </label>

          <label className={labelClass}>
            {t('Ghi chú thêm (không bắt buộc)', 'Optional note')}
            <textarea rows={2} value={form.note} onChange={update('note')} maxLength={1000} disabled={isSubmitting} className={inputClass} placeholder={t('Ví dụ: Xe tới sảnh sau ~5 phút, đã báo phòng khách...', 'For example: arriving at lobby in ~5 mins, guest notified...')} />
          </label>

          {error && <p role="alert" className="text-xs font-semibold text-red-600">{error}</p>}

          <footer className="flex justify-end gap-2 pt-3 border-t border-palette-silver/50">
            <button type="button" disabled={isSubmitting} onClick={onClose} className="px-3 py-2 text-xs text-palette-slate rounded-lg hover:bg-palette-stone">{t('Hủy', 'Cancel')}</button>
            <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold disabled:opacity-50">
              {isSubmitting ? t('Đang lưu...', 'Saving...') : t('Xác nhận đã đặt xe', 'Confirm taxi booked')}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
};
