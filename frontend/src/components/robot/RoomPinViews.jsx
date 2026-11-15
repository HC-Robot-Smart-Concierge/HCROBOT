import React from 'react';
import { Lock, Delete, CheckCircle2, AlertCircle, ShieldCheck } from 'lucide-react';
import { OFFICIAL_ROOMS } from './roomPinLockoutUtils';

export const RoomPinViews = ({
  isSuccess, successInfo, selectedRoom, isForgotPinView, setIsForgotPinView, onForgotPin, onClose, isSelectingRoom, setIsSelectingRoom, roomFloorTab, setRoomFloorTab, setSelectedRoom, onRoomSelect, setPin, setErrorMessage, isLoading, errorMessage, lockoutRemaining, pin, handleKeyPress, handleClear, handleDelete,
}) => (
  <>
        {/* 1. MÀN HÌNH THÀNH CÔNG */}
        {isSuccess ? (
          <div className="text-center py-6 space-y-3">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-extrabold text-stone-900">
                Xác Thực Thành Công
              </h3>
              <p className="mt-1 text-xs text-stone-600">
                Chào mừng {successInfo?.guest_name || 'quý khách'}! Đã xác nhận phòng {successInfo?.room_number || selectedRoom}.
              </p>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-stone-100 border border-stone-200 text-[11px] font-semibold text-stone-700">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Đang gửi yêu cầu...</span>
            </div>
          </div>
        ) : isForgotPinView ? (
          /* 2. FALLBACK: QUÊN MÃ PIN PHÒNG -> HƯỚNG DẪN RA LỄ TÂN */
          <div className="space-y-4 py-2 text-center">
            <div className="w-12 h-12 rounded-2xl mx-auto bg-stone-100 border border-stone-200 text-stone-700 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-extrabold text-stone-900">
                Quên Mã PIN Phòng?
              </h3>
              <p className="text-xs text-stone-600 mt-2 leading-relaxed px-1">
                Vì lý do bảo mật, Robot không được phép cấp lại mã PIN. Quý khách vui lòng liên hệ quầy Lễ tân tại sảnh chính để được nhân viên hỗ trợ cấp lại mã PIN nhé ạ.
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  if (onForgotPin) {
                    onForgotPin({ destination_key: 'front_desk', roomNumber: selectedRoom });
                  }
                  onClose();
                }}
                className="w-full py-2.5 px-4 rounded-2xl bg-[#1A1917] hover:bg-stone-800 text-white font-bold text-xs sm:text-sm shadow-md transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>Chỉ đường đến Quầy Lễ Tân</span>
              </button>

              <button
                type="button"
                onClick={() => setIsForgotPinView(false)}
                className="w-full py-2 px-4 rounded-2xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold transition-all cursor-pointer"
              >
                Quay lại nhập mã PIN
              </button>
            </div>
          </div>
        ) : isSelectingRoom ? (
          /* 3. BƯỚC 1: CHỌN SỐ PHÒNG (MINIMAL TOUCH UI SÁNG) */
          <div className="space-y-3.5">
            <div className="text-center">
              <h3 className="text-sm sm:text-base font-extrabold text-stone-900">
                Chọn Số Phòng Lưu Trú
              </h3>
              <p className="text-[11px] text-stone-500 mt-0.5">
                Chạm chọn số phòng của quý khách
              </p>
            </div>

            {/* Tab chuyển tầng 3 và tầng 4 */}
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-stone-100 border border-stone-200 rounded-xl">
              <button
                type="button"
                onClick={() => setRoomFloorTab('3')}
                className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  roomFloorTab === '3'
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Tầng 3 (P.301 - 310)
              </button>
              <button
                type="button"
                onClick={() => setRoomFloorTab('4')}
                className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  roomFloorTab === '4'
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Tầng 4 (P.401 - 410)
              </button>
            </div>

            {/* Grid 10 phòng / tầng */}
            <div className="grid grid-cols-5 gap-1.5">
              {(roomFloorTab === '3' ? OFFICIAL_ROOMS.floor3 : OFFICIAL_ROOMS.floor4).map((rNum) => {
                const isSelected = selectedRoom === rNum;
                return (
                  <button
                    key={rNum}
                    type="button"
                    onClick={() => {
                      setSelectedRoom(rNum);
                      if (onRoomSelect) onRoomSelect(rNum);
                      setIsSelectingRoom(false);
                      setPin('');
                      setErrorMessage('');
                    }}
                    className={`py-2 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer select-none active:scale-95 ${
                      isSelected
                        ? 'bg-[#1A1917] text-white shadow-sm'
                        : 'bg-stone-50 hover:bg-stone-100 text-stone-900 border border-stone-200/80'
                    }`}
                  >
                    {rNum}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          /* 4. BƯỚC 2: NHẬP MÃ PIN 4 SỐ (TỐI GIẢN ICON & CHỮ, TONE SÁNG) */
          <div className="space-y-3">
            {/* Header thông tin ngắn gọn */}
            <div className="flex flex-col items-center text-center">
              <h3 className="text-base sm:text-lg font-extrabold text-stone-900">
                {selectedRoom ? `Mã PIN Phòng ${selectedRoom}` : 'Nhập Mã PIN Phòng'}
              </h3>

              <p className="text-xs text-stone-500 mt-0.5">
                4 số cuối CCCD của khách lưu trú
              </p>

              {/* Thanh hiển thị phòng đang chọn kèm nút đổi phòng */}
              <div className="mt-2 w-full flex items-center justify-between px-3 py-1.5 rounded-2xl bg-stone-50 border border-stone-200">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-xs font-bold text-stone-900">
                    Phòng {selectedRoom}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsSelectingRoom(true);
                    setPin('');
                    setErrorMessage('');
                  }}
                  className="text-[11px] font-semibold text-stone-700 hover:text-stone-900 px-2 py-0.5 rounded-lg bg-stone-200 hover:bg-stone-300 transition-colors cursor-pointer"
                >
                  Đổi phòng
                </button>
              </div>

              {/* Trạng thái / lỗi */}
              <div className="min-h-[16px] mt-1 text-center">
                {isLoading && (
                  <span className="text-[11px] text-stone-600 animate-pulse font-medium">
                    Đang xác thực mã PIN...
                  </span>
                )}
                {lockoutRemaining > 0 && !isLoading && (
                  <div className="flex items-center justify-center gap-1.5 text-[11px] text-rose-600 font-bold bg-rose-50 border border-rose-200/80 rounded-xl py-1.5 px-2.5">
                    <Lock className="w-3.5 h-3.5 flex-shrink-0 text-rose-600" />
                    <span>Đã khóa 1 phút: Thử lại sau {lockoutRemaining}s</span>
                  </div>
                )}
                {errorMessage && !isLoading && lockoutRemaining <= 0 && (
                  <div className="flex items-center justify-center gap-1 text-[11px] text-rose-500 font-semibold">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="line-clamp-2">{errorMessage}</span>
                  </div>
                )}
              </div>
            </div>

            {/* 4 Ô chỉ báo mã PIN */}
            <div className="flex justify-center items-center gap-2.5 py-1">
              {[0, 1, 2, 3].map((index) => {
                const isFilled = pin.length > index;
                return (
                  <div
                    key={index}
                    className={`w-3.5 h-3.5 rounded-full transition-all duration-150 ${
                      isFilled
                        ? 'bg-stone-900 ring-2 ring-stone-900/20 scale-105'
                        : 'bg-stone-200 border border-stone-300'
                    }`}
                  />
                );
              })}
            </div>

            {/* Bàn phím số Numpad cảm ứng tone sáng */}
            <div className="grid grid-cols-3 gap-2 w-full max-w-[240px] mx-auto pt-1">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleKeyPress(String(num))}
                  disabled={isLoading || isSuccess || lockoutRemaining > 0}
                  className="h-11 rounded-2xl bg-stone-50 hover:bg-stone-100 active:bg-stone-200 border border-stone-200/90 text-lg font-bold text-stone-900 shadow-2xs active:scale-95 transition-all flex items-center justify-center select-none cursor-pointer"
                >
                  {num}
                </button>
              ))}

              <button
                type="button"
                onClick={handleClear}
                disabled={isLoading || isSuccess || pin.length === 0 || lockoutRemaining > 0}
                className="h-11 rounded-2xl bg-stone-100/70 hover:bg-stone-100 border border-stone-200/50 text-[11px] font-bold text-stone-500 hover:text-stone-800 uppercase tracking-wider active:scale-95 transition-all flex items-center justify-center select-none disabled:opacity-30 cursor-pointer"
              >
                Xóa
              </button>

              <button
                type="button"
                onClick={() => handleKeyPress('0')}
                disabled={isLoading || isSuccess || lockoutRemaining > 0}
                className="h-11 rounded-2xl bg-stone-50 hover:bg-stone-100 active:bg-stone-200 border border-stone-200/90 text-lg font-bold text-stone-900 shadow-2xs active:scale-95 transition-all flex items-center justify-center select-none cursor-pointer"
              >
                0
              </button>

              <button
                type="button"
                onClick={handleDelete}
                disabled={isLoading || isSuccess || pin.length === 0 || lockoutRemaining > 0}
                className="h-11 rounded-2xl bg-stone-100/70 hover:bg-stone-100 border border-stone-200/50 text-stone-600 hover:text-stone-900 active:scale-95 transition-all flex items-center justify-center select-none disabled:opacity-30 cursor-pointer"
                title="Xóa lùi"
              >
                <Delete className="w-4 h-4" />
              </button>
            </div>

            {/* Quên PIN tinh giản */}
            <div className="flex items-center justify-center pt-2">
              <button
                type="button"
                onClick={() => setIsForgotPinView(true)}
                className="text-xs text-stone-500 hover:text-stone-900 underline underline-offset-4 transition-colors cursor-pointer font-semibold"
              >
                Quên mã PIN?
              </button>
            </div>
          </div>
        )}
  </>
);
