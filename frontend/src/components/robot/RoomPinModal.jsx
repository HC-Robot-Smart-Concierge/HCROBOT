import React, { useState, useEffect, useCallback } from 'react';
import { Lock, Delete, CheckCircle2, AlertCircle, X, ShieldCheck, KeyRound } from 'lucide-react';
import { verifyRoomPin } from '../../services/operationsApi';

/**
 * RoomPinModal - Modal bàn phím số Numpad cảm ứng (Touch PIN Verification)
 * Thiết kế chuẩn Dark Glassmorphism cho Robot Kiosk 5 sao.
 * Hỗ trợ xác thực: Mã PIN 4 số phòng HOẶC 4 số cuối CCCD/Hộ chiếu.
 */
export const RoomPinModal = ({
  isOpen,
  onClose,
  roomNumber,
  pendingAction = 'room_service',
  pendingItems = 'Yêu cầu phục vụ phòng',
  onVerifiedSuccess,
}) => {
  const [pin, setPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [isShaking, setIsShaking] = useState(false);

  // Reset state mỗi khi mở modal
  useEffect(() => {
    if (isOpen) {
      setPin('');
      setErrorMessage('');
      setIsLoading(false);
      setIsSuccess(false);
      setIsShaking(false);
    }
  }, [isOpen, roomNumber]);

  const handleKeyPress = useCallback((digit) => {
    if (isLoading || isSuccess) return;
    setErrorMessage('');
    setPin((prev) => {
      if (prev.length < 4) {
        return prev + digit;
      }
      return prev;
    });
  }, [isLoading, isSuccess]);

  const handleDelete = useCallback(() => {
    if (isLoading || isSuccess) return;
    setErrorMessage('');
    setPin((prev) => prev.slice(0, -1));
  }, [isLoading, isSuccess]);

  const handleClear = useCallback(() => {
    if (isLoading || isSuccess) return;
    setErrorMessage('');
    setPin('');
  }, [isLoading, isSuccess]);

  // Tự động gọi API xác thực khi nhập đủ 4 số
  useEffect(() => {
    if (pin.length === 4 && !isLoading && !isSuccess) {
      const submitPin = async () => {
        setIsLoading(true);
        setErrorMessage('');
        try {
          const res = await verifyRoomPin(
            roomNumber,
            pin,
            pendingAction,
            pendingItems
          );
          setIsSuccess(true);
          setIsLoading(false);

          if (onVerifiedSuccess) {
            onVerifiedSuccess(res);
          }

          // Đóng modal sau 1.2s hiển thị checkmark thành công
          setTimeout(() => {
            onClose();
          }, 1200);
        } catch (err) {
          setIsLoading(false);
          setErrorMessage(err.message || 'Mã PIN hoặc 4 số cuối CCCD không chính xác.');
          setIsShaking(true);
          setTimeout(() => setIsShaking(false), 500);
          setPin(''); // Xóa để nhập lại
        }
      };

      submitPin();
    }
  }, [pin, isLoading, isSuccess, roomNumber, pendingAction, pendingItems, onVerifiedSuccess, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className={`relative w-full max-w-md p-6 sm:p-8 rounded-3xl bg-stone-900/90 border border-stone-700/70 shadow-2xl backdrop-blur-2xl text-white transition-all ${
          isShaking ? 'animate-shake' : ''
        } ${isSuccess ? 'border-emerald-500/80 shadow-emerald-500/20' : ''}`}
      >
        {/* Nút đóng */}
        <button
          onClick={onClose}
          disabled={isLoading || isSuccess}
          className="absolute top-5 right-5 p-2 rounded-full bg-stone-800/80 hover:bg-stone-700 text-stone-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Tiêu đề & Biểu tượng */}
        <div className="text-center mb-6">
          <div
            className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3 shadow-lg transition-colors ${
              isSuccess
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
            }`}
          >
            {isSuccess ? (
              <CheckCircle2 className="w-8 h-8 animate-bounce" />
            ) : (
              <KeyRound className="w-7 h-7" />
            )}
          </div>
          <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-stone-100">
            {isSuccess ? 'Xác Thực Thành Công!' : `Xác Nhận Phòng ${roomNumber}`}
          </h3>
          <p className="mt-1 text-xs sm:text-sm text-stone-400">
            {isSuccess
              ? 'Yêu cầu của bạn đã được chuyển tới bộ phận xử lý'
              : 'Nhập mã PIN 4 số phòng hoặc 4 số cuối CCCD/Hộ chiếu'}
          </p>

          {/* Chi tiết yêu cầu phục vụ */}
          {pendingItems && !isSuccess && (
            <div className="mt-3 px-3 py-1.5 rounded-xl bg-stone-800/60 border border-stone-700/50 text-xs text-amber-300 font-medium inline-block max-w-full truncate">
              {pendingItems}
            </div>
          )}
        </div>

        {/* 4 Ô chỉ báo mã PIN (● ● ○ ○) */}
        <div className="flex justify-center items-center gap-4 my-6">
          {[0, 1, 2, 3].map((index) => {
            const isFilled = pin.length > index;
            return (
              <div
                key={index}
                className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full transition-all duration-200 ${
                  isSuccess
                    ? 'bg-emerald-400 ring-4 ring-emerald-500/30'
                    : isFilled
                    ? 'bg-amber-400 ring-4 ring-amber-500/30 scale-110'
                    : 'bg-stone-800 border-2 border-stone-600'
                }`}
              />
            );
          })}
        </div>

        {/* Thông báo trạng thái hoặc lỗi */}
        <div className="h-6 mb-4 text-center">
          {isLoading && (
            <span className="text-xs text-amber-400 animate-pulse font-medium">
              Đang xác thực thông tin...
            </span>
          )}
          {errorMessage && (
            <div className="flex items-center justify-center gap-1.5 text-xs text-rose-400 font-medium animate-in fade-in">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
          {isSuccess && (
            <div className="flex items-center justify-center gap-1.5 text-xs text-emerald-400 font-semibold animate-in fade-in">
              <ShieldCheck className="w-4 h-4 flex-shrink-0" />
              <span>Khách lưu trú đã được chứng thực!</span>
            </div>
          )}
        </div>

        {/* Bàn phím số Numpad cảm ứng (Touch Buttons) */}
        <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              onClick={() => handleKeyPress(String(num))}
              disabled={isLoading || isSuccess}
              className="h-14 sm:h-16 rounded-2xl bg-stone-800/90 hover:bg-stone-700/90 active:bg-amber-500/20 active:border-amber-400/50 border border-stone-700/60 text-2xl font-semibold text-stone-100 shadow-md active:scale-95 transition-all flex items-center justify-center select-none"
            >
              {num}
            </button>
          ))}

          {/* Phím Clear/Xóa hết */}
          <button
            onClick={handleClear}
            disabled={isLoading || isSuccess || pin.length === 0}
            className="h-14 sm:h-16 rounded-2xl bg-stone-800/50 hover:bg-stone-700/50 border border-stone-700/40 text-xs font-semibold text-stone-400 hover:text-white uppercase tracking-wider active:scale-95 transition-all flex items-center justify-center select-none disabled:opacity-30"
          >
            Xóa
          </button>

          {/* Phím 0 */}
          <button
            onClick={() => handleKeyPress('0')}
            disabled={isLoading || isSuccess}
            className="h-14 sm:h-16 rounded-2xl bg-stone-800/90 hover:bg-stone-700/90 active:bg-amber-500/20 active:border-amber-400/50 border border-stone-700/60 text-2xl font-semibold text-stone-100 shadow-md active:scale-95 transition-all flex items-center justify-center select-none"
          >
            0
          </button>

          {/* Phím Backspace */}
          <button
            onClick={handleDelete}
            disabled={isLoading || isSuccess || pin.length === 0}
            className="h-14 sm:h-16 rounded-2xl bg-stone-800/50 hover:bg-stone-700/50 border border-stone-700/40 text-stone-300 hover:text-white active:scale-95 transition-all flex items-center justify-center select-none disabled:opacity-30"
          >
            <Delete className="w-6 h-6" />
          </button>
        </div>

        {/* Chú thích chân modal */}
        <div className="mt-6 text-center">
          <p className="text-[11px] text-stone-400 flex items-center justify-center gap-1.5">
            <Lock className="w-3 h-3 text-stone-400" />
            <span>Mã bảo mật chống đặt món giả mạo phòng lưu trú</span>
          </p>
        </div>
      </div>
    </div>
  );
};
