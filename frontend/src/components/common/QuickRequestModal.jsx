import React, { useState } from 'react';
import { PlusCircle, X, Send, CheckCircle2 } from 'lucide-react';
import {
  createReceptionRequest,
  createHousekeepingRequest,
  createBellRequest,
  createMaintenanceRequest,
  createOperationalDirective,
  createRoomServiceOrder,
} from '../../services/operationsApi';
import { createTaxiRequest } from '../../services/taxiApi';

export function QuickRequestModal({ isOpen, onClose, onCreated }) {
  const [department, setDepartment] = useState('Housekeeping');
  const [roomNumber, setRoomNumber] = useState('');
  const [guestName, setGuestName] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg('Vui lòng nhập tiêu đề yêu cầu.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      let res = null;
      const basePayload = {
        title: title.trim(),
        description: description.trim(),
        guest_name: guestName.trim() || 'Khách lưu trú',
      };

      if (department === 'Reception') {
        res = await createReceptionRequest({
          ...basePayload,
          room_number: roomNumber.trim() || 'Lobby',
          request_type: 'Other',
        });
      } else if (department === 'Housekeeping') {
        res = await createHousekeepingRequest({
          ...basePayload,
          room_number: roomNumber.trim() || 'Phòng chưa gán',
          source: 'Front Desk / Kiosk',
        });
      } else if (department === 'Room Service') {
        res = await createRoomServiceOrder({
          room_number: roomNumber.trim() || 'Phòng chưa gán',
          items: [{ name: title.trim(), qty: 1, notes: description.trim() }],
          note: description.trim() || title.trim(),
          guest_name: guestName.trim() || 'Khách lưu trú',
        });
      } else if (department === 'Taxi') {
        res = await createTaxiRequest({
          guest_name: guestName.trim() || 'Khách lưu trú',
          pickup_location: roomNumber.trim() || 'Sảnh chính (Main Lobby)',
          destination: title.trim(),
          pickup_time: 'Immediate',
          party_size: 2,
          vehicle_type: '4-Seater Sedan',
          description: description.trim() || title.trim(),
        });
      } else if (department === 'Bell Services') {
        res = await createBellRequest({
          ...basePayload,
          location: roomNumber.trim() || 'Sảnh Tiền sảnh',
          reporter: 'Front Desk / Staff',
        });
      } else if (department === 'Maintenance') {
        res = await createMaintenanceRequest({
          ...basePayload,
          location: roomNumber.trim() || 'Khu vực chung',
          source: 'Staff / Kiosk',
        });
      } else if (department === 'Directive') {
        res = await createOperationalDirective({
          title: title.trim(),
          department: 'Executive',
          location: roomNumber.trim() || 'Toàn khách sạn',
          description: description.trim(),
          type: 'General',
        });
      }

      setSuccessMsg('Đã tạo và điều phối yêu cầu thành công!');
      if (onCreated) onCreated(res);
      setTimeout(() => {
        setSuccessMsg('');
        setTitle('');
        setDescription('');
        setRoomNumber('');
        setGuestName('');
        onClose();
      }, 1500);
    } catch (err) {
      console.error('Lỗi tạo yêu cầu:', err);
      setErrorMsg('Không thể tạo yêu cầu. Vui lòng kiểm tra lại kết nối backend.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="hc-modal-overlay">
      <div className="hc-modal-box max-w-lg w-full p-6 bg-white border border-palette-silver rounded-2xl shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-palette-silver">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-palette-stone flex items-center justify-center text-palette-charcoal">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-palette-charcoal">Tạo Yêu Cầu Điều Phối Nhanh</h3>
              <p className="text-xs text-palette-slate">Gửi tác vụ trực tiếp tới phòng ban chuyên trách</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-palette-stone text-palette-slate hover:text-palette-charcoal transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Feedback Messages */}
        {successMsg && (
          <div className="mt-4 p-3 rounded-xl bg-palette-stone border border-palette-silver flex items-center gap-2 text-xs font-bold text-palette-charcoal">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            {successMsg}
          </div>
        )}
        {errorMsg && (
          <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-bold text-red-600">
            {errorMsg}
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          <div>
            <label className="block text-xs font-bold text-palette-charcoal mb-1">Bộ phận tiếp nhận</label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="hc-select"
            >
              <option value="Housekeeping">Buồng phòng (Housekeeping)</option>
              <option value="Room Service">Phục vụ phòng (Room Service / F&B)</option>
              <option value="Taxi">Đặt xe & Vận chuyển (Taxi / Transport)</option>
              <option value="Reception">Lễ tân (Reception)</option>
              <option value="Bell Services">Hành lý & Sảnh (Bell Services)</option>
              <option value="Maintenance">Kỹ thuật & Bảo trì (Maintenance)</option>
              <option value="Directive">Chỉ thị Điều hành (Directive)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-palette-charcoal mb-1">
                {department === 'Taxi' ? 'Điểm đón (Số phòng / Sảnh)' : 'Số phòng / Vị trí'}
              </label>
              <input
                type="text"
                placeholder={department === 'Taxi' ? 'VD: Sảnh chính hoặc Phòng 402' : 'VD: Phòng 402 hoặc Sảnh A'}
                value={roomNumber}
                onChange={(e) => setRoomNumber(e.target.value)}
                className="hc-input"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-palette-charcoal mb-1">Tên khách hàng</label>
              <input
                type="text"
                placeholder="VD: Mr. David Smith"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                className="hc-input"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-palette-charcoal mb-1">
              {department === 'Taxi'
                ? 'Điểm đến / Lộ trình xe *'
                : department === 'Room Service'
                ? 'Món ăn / Đồ uống yêu cầu *'
                : 'Tiêu đề yêu cầu *'}
            </label>
            <input
              type="text"
              required
              placeholder={
                department === 'Taxi'
                  ? 'VD: Sân bay Quốc tế Đà Nẵng (DAD)'
                  : department === 'Room Service'
                  ? 'VD: 2 Club Sandwich & 1 Cà phê sữa đá'
                  : 'VD: Cung cấp thêm 2 bộ khăn tắm & nước khoáng'
              }
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="hc-input"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-palette-charcoal mb-1">
              {department === 'Taxi'
                ? 'Ghi chú chuyến xe (Loại xe, giờ đón, hành lý)'
                : department === 'Room Service'
                ? 'Ghi chú món ăn / Bếp'
                : 'Ghi chú / Chi tiết công việc'}
            </label>
            <textarea
              rows={3}
              placeholder={
                department === 'Taxi'
                  ? 'VD: Xe 4 chỗ, có 2 vali lớn, đón ngay...'
                  : department === 'Room Service'
                  ? 'VD: Ít đá, không đường, giao trước 11:30...'
                  : 'Ghi chú thêm cho nhân viên tiếp nhận công việc...'
              }
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="hc-input resize-none"
            />
          </div>


          {/* Action Buttons */}
          <div className="pt-3 border-t border-palette-silver flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold rounded-xl border border-palette-silver text-palette-charcoal hover:bg-palette-stone transition"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading}
              className="hc-btn-primary gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              {loading ? 'Đang gửi...' : 'Gửi yêu cầu'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
