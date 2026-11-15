import React, { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { verifyRoomPin } from '../../services/operationsApi';
import {
  PIN_LOCKOUT_MAX_ATTEMPTS,
  PIN_LOCKOUT_DURATION_SEC,
  DEFAULT_WRONG_PIN_ERROR_MSG,
  getRoomLockoutState,
  setRoomLockoutState,
  clearRoomLockoutState,
  OFFICIAL_ROOMS,
} from './roomPinLockoutUtils';
import { useRoomPinNfc } from './useRoomPinNfc';
import { RoomPinViews } from './RoomPinViews';

export * from './roomPinLockoutUtils';

export const RoomPinModal = ({
  isOpen,
  onClose,
  roomNumber = '',
  onRoomSelect,
  pendingAction = 'room_service',
  pendingItems = 'Yêu cầu dịch vụ phòng',
  onVerifiedSuccess,
  onNotCheckedIn,
  onForgotPin,
  initialTab = 'pin',
  isSelectingRoomInitial = false,
  skipTicketCreation = true,
  sessionId = null,
}) => {
  const [selectedRoom, setSelectedRoom] = useState(roomNumber || '');
  const [isSelectingRoom, setIsSelectingRoom] = useState(Boolean(isSelectingRoomInitial || !roomNumber));
  const [isForgotPinView, setIsForgotPinView] = useState(false);
  const [roomFloorTab, setRoomFloorTab] = useState(() => {
    if (roomNumber && String(roomNumber).startsWith('4')) return '4';
    return '3';
  });

  const [activeTab, setActiveTab] = useState(initialTab || 'pin');
  const [pin, setPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [successInfo, setSuccessInfo] = useState(null);
  const [isShaking, setIsShaking] = useState(false);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);
  // Dong bo trang thai lockout khi selectedRoom thay doi hoac modal mo
  useEffect(() => {
    if (!selectedRoom || !isOpen) {
      setLockoutRemaining(0);
      return;
    }
    const state = getRoomLockoutState(selectedRoom);
    if (state.lockedUntil > Date.now()) {
      const remainingSec = Math.ceil((state.lockedUntil - Date.now()) / 1000);
      setLockoutRemaining(remainingSec);
      setErrorMessage(`Quý khách đã nhập sai mã PIN 5 lần. Hệ thống tạm khóa 1 phút. Quý khách vui lòng thử lại sau (${remainingSec}s).`);
    } else {
      setLockoutRemaining(0);
    }
  }, [selectedRoom, isOpen]);
  // Bo dem giam dan lockout 1 phut (60s)
  useEffect(() => {
    if (lockoutRemaining <= 0) return;
    const timer = setInterval(() => {
      setLockoutRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          clearRoomLockoutState(selectedRoom);
          setErrorMessage('');
          return 0;
        }
        const next = prev - 1;
        setErrorMessage(`Quý khách đã nhập sai mã PIN 5 lần. Hệ thống tạm khóa 1 phút. Quý khách vui lòng thử lại sau (${next}s).`);
        return next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutRemaining, selectedRoom]);


  useRoomPinNfc({
    isOpen,
    activeTab,
    selectedRoom,
    pendingAction,
    pendingItems,
    skipTicketCreation,
    sessionId,
    isLoading,
    isSuccess,
    setIsLoading,
    setIsSuccess,
    setSuccessInfo,
    setErrorMessage,
    setIsShaking,
    onVerifiedSuccess,
    onClose,
  });

  useEffect(() => {
    if (isOpen) {
      setIsForgotPinView(false);
      setPin('');
      setErrorMessage('');
      setIsSuccess(false);
      setSuccessInfo(null);
      setIsShaking(false);
      setSelectedRoom(roomNumber || '');
      setIsSelectingRoom(Boolean(isSelectingRoomInitial || !roomNumber));
      if (roomNumber && String(roomNumber).startsWith('4')) {
        setRoomFloorTab('4');
      } else {
        setRoomFloorTab('3');
      }
      setActiveTab(initialTab || 'pin');
    }
  }, [isOpen, roomNumber, initialTab, isSelectingRoomInitial]);

  const handleKeyPress = useCallback((digit) => {
    if (isLoading || isSuccess || lockoutRemaining > 0) return;
    setErrorMessage('');
    setPin((prev) => (prev.length < 4 ? prev + digit : prev));
  }, [isLoading, isSuccess, lockoutRemaining]);

  const handleDelete = useCallback(() => {
    if (isLoading || isSuccess || lockoutRemaining > 0) return;
    setErrorMessage('');
    setPin((prev) => prev.slice(0, -1));
  }, [isLoading, isSuccess, lockoutRemaining]);

  const handleClear = useCallback(() => {
    if (isLoading || isSuccess || lockoutRemaining > 0) return;
    setErrorMessage('');
    setPin('');
  }, [isLoading, isSuccess, lockoutRemaining]);

  useEffect(() => {
    if (pin.length === 4 && !isLoading && !isSuccess && activeTab === 'pin' && selectedRoom && !isSelectingRoom) {
      const submitPin = async () => {
        setIsLoading(true);
        setErrorMessage('');
        try {
          const res = await verifyRoomPin(
            selectedRoom,
            pin,
            pendingAction,
            pendingItems,
            null,
            null,
            (skipTicketCreation || ["taxi", "book_taxi", "taxi_booking", "query_order_status", "query_service_status", "query_taxi_status"].includes(pendingAction)),
            sessionId
          );
          // Xoa trang thai lockout va dem loi khi xac thuc thanh cong
          clearRoomLockoutState(selectedRoom);
          setLockoutRemaining(0);
          setIsSuccess(true);
          setSuccessInfo(res);
          setIsLoading(false);

          if (onVerifiedSuccess) {
            onVerifiedSuccess(res, selectedRoom);
          }

          setTimeout(() => {
            onClose();
          }, 1000);
        } catch (err) {
          setIsLoading(false);
          if (err.not_checked_in) {
            setErrorMessage(err.message || 'Phòng chưa làm thủ tục nhận phòng. Đang chuyển tới quầy Lễ tân...');
            setIsShaking(true);
            if (onNotCheckedIn) {
              setTimeout(() => {
                onNotCheckedIn({
                  roomNumber: err.room_number || selectedRoom,
                  destination_key: err.destination_key || 'front_desk',
                  message: err.message,
                });
                onClose();
              }, 1200);
            }
            return;
          }
          // Xu ly neu backend tra ve HTTP 429 lockout
          if (err.data?.status === 429 || err.message?.includes('khóa 1 phút') || err.message?.includes('spam')) {
            const lockedUntil = Date.now() + PIN_LOCKOUT_DURATION_SEC * 1000;
            setRoomLockoutState(selectedRoom, { count: PIN_LOCKOUT_MAX_ATTEMPTS, lockedUntil });
            setLockoutRemaining(PIN_LOCKOUT_DURATION_SEC);
            setErrorMessage(err.message || `Quý khách đã nhập sai mã PIN 5 lần. Hệ thống tạm khóa 1 phút. Quý khách vui lòng thử lại sau (${PIN_LOCKOUT_DURATION_SEC}s).`);
            setIsShaking(true);
            setTimeout(() => setIsShaking(false), 500);
            setPin('');
            return;
          }
          // Cap nhat so lan nhap sai cho phong dang chon (Mã PIN 4 số không chính xác (4 số cuối CCCD))
          const currentLock = getRoomLockoutState(selectedRoom);
          const nextCount = (currentLock.count || 0) + 1;
          if (nextCount >= PIN_LOCKOUT_MAX_ATTEMPTS) {
            const lockedUntil = Date.now() + PIN_LOCKOUT_DURATION_SEC * 1000;
            setRoomLockoutState(selectedRoom, { count: nextCount, lockedUntil });
            setLockoutRemaining(PIN_LOCKOUT_DURATION_SEC);
            setErrorMessage(`Quý khách đã nhập sai mã PIN 5 lần. Hệ thống tạm khóa 1 phút. Quý khách vui lòng thử lại sau (${PIN_LOCKOUT_DURATION_SEC}s).`);
          } else {
            setRoomLockoutState(selectedRoom, { count: nextCount, lockedUntil: 0 });
            setErrorMessage(err.message || DEFAULT_WRONG_PIN_ERROR_MSG);
          }
          setIsShaking(true);
          setTimeout(() => setIsShaking(false), 500);
          setPin('');
        }
      };

      submitPin();
    }
  }, [pin, isLoading, isSuccess, activeTab, selectedRoom, isSelectingRoom, pendingAction, pendingItems, onVerifiedSuccess, onNotCheckedIn, onClose]);

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150 select-none overscroll-contain">
      <div
        className={`relative w-full max-w-[340px] sm:max-w-sm max-h-[92vh] overflow-y-auto p-5 sm:p-6 rounded-3xl bg-white border border-[#E3DFD5] shadow-2xl text-stone-900 transition-all ${
          isShaking ? 'animate-shake' : ''
        } ${isSuccess ? 'border-emerald-500/60' : ''}`}
      >
        {/* Nút đóng */}
        <button
          type="button"
          onClick={onClose}
          disabled={isLoading || isSuccess}
          className="absolute top-3.5 right-3.5 z-10 w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-500 hover:text-stone-800 transition-colors flex items-center justify-center cursor-pointer"
          title="Đóng"
        >
          <X className="w-4 h-4" />
        </button>

        <RoomPinViews
          isSuccess={isSuccess}
          successInfo={successInfo}
          selectedRoom={selectedRoom}
          isForgotPinView={isForgotPinView}
          setIsForgotPinView={setIsForgotPinView}
          onForgotPin={onForgotPin}
          onClose={onClose}
          isSelectingRoom={isSelectingRoom}
          setIsSelectingRoom={setIsSelectingRoom}
          roomFloorTab={roomFloorTab}
          setRoomFloorTab={setRoomFloorTab}
          setSelectedRoom={setSelectedRoom}
          onRoomSelect={onRoomSelect}
          setPin={setPin}
          setErrorMessage={setErrorMessage}
          isLoading={isLoading}
          errorMessage={errorMessage}
          lockoutRemaining={lockoutRemaining}
          pin={pin}
          handleKeyPress={handleKeyPress}
          handleClear={handleClear}
          handleDelete={handleDelete}
        />
      </div>
    </div>
  );
};
