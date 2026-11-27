import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Lock,
  Delete,
  CheckCircle2,
  AlertCircle,
  X,
  ShieldCheck,
  KeyRound,
  CreditCard,
  Radio,
} from 'lucide-react';
import { verifyRoomPin, verifyRoomNfc } from '../../services/operationsApi';

export const PIN_LOCKOUT_MAX_ATTEMPTS = 5;
export const PIN_LOCKOUT_DURATION_SEC = 60;
export const DEFAULT_WRONG_PIN_ERROR_MSG = 'Mã PIN phòng không chính xác. Quý khách vui lòng thử lại sau.';

export const getRoomLockoutState = (roomNumber) => {
  if (!roomNumber || typeof window === 'undefined' || typeof sessionStorage === 'undefined') return { count: 0, lockedUntil: 0 };
  try {
    const raw = sessionStorage.getItem(`room_pin_lock_${roomNumber}`);
    if (raw) {
      const data = JSON.parse(raw);
      if (data && typeof data.lockedUntil === 'number' && data.lockedUntil > Date.now()) {
        return data;
      }
    }
  } catch (e) { }
  return { count: 0, lockedUntil: 0 };
};

export const setRoomLockoutState = (roomNumber, state) => {
  if (!roomNumber || typeof window === 'undefined' || typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(`room_pin_lock_${roomNumber}`, JSON.stringify(state));
  } catch (e) { }
};

export const clearRoomLockoutState = (roomNumber) => {
  if (!roomNumber || typeof window === 'undefined' || typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.removeItem(`room_pin_lock_${roomNumber}`);
  } catch (e) { }
};

export const OFFICIAL_ROOMS = {
  floor3: ['301', '302', '303', '304', '305', '306', '307', '308', '309', '310'],
  floor4: ['401', '402', '403', '404', '405', '406', '407', '408', '409', '410'],
};

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
  language = 'Tiếng Việt',
}) => {
  const isEn = language === 'English' || language === 'EN';
  const t = useCallback((vi, en) => isEn ? en : vi, [isEn]);
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
      setErrorMessage(t(`Quý khách đã nhập sai mã PIN 5 lần. Hệ thống tạm khóa 1 phút. Quý khách vui lòng thử lại sau (${remainingSec}s).`, `Too many incorrect PIN attempts. Please try again in ${remainingSec} seconds.`));
    } else {
      setLockoutRemaining(0);
    }
  }, [selectedRoom, isOpen, t]);

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
        setErrorMessage(t(`Quý khách đã nhập sai mã PIN 5 lần. Hệ thống tạm khóa 1 phút. Quý khách vui lòng thử lại sau (${next}s).`, `Too many incorrect PIN attempts. Please try again in ${next} seconds.`));
        return next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutRemaining, selectedRoom, t]);

  const [nfcStatus, setNfcStatus] = useState('idle');
  const [nfcStatusMsg, setNfcStatusMsg] = useState('');

  const nfcAbortControllerRef = useRef(null);
  const keyBufferRef = useRef('');
  const lastKeyTimeRef = useRef(0);
  const handleVerifyNfcRef = useRef(null);

  const startWebNfcScan = useCallback(async () => {
    if (typeof window === 'undefined') return;

    if (!('NDEFReader' in window)) {
      setNfcStatus('unsupported');
      setNfcStatusMsg(t('Trình duyệt chưa hỗ trợ Web NFC. Cần dùng Google Chrome trên Android.', 'Web NFC is unavailable. Use Google Chrome on Android.'));
      return;
    }

    try {
      if (nfcAbortControllerRef.current) {
        try { nfcAbortControllerRef.current.abort(); } catch (e) { }
      }

      const controller = new AbortController();
      nfcAbortControllerRef.current = controller;
      const ndef = new window.NDEFReader();

      setNfcStatus('starting');
      setNfcStatusMsg(t('Đang kích hoạt đầu đọc thẻ NFC...', 'Starting the NFC reader...'));

      ndef.onreading = async (event) => {
        let ndefText = '';
        if (event.message && event.message.records && event.message.records.length > 0) {
          for (const record of event.message.records) {
            try {
              if (record.recordType === 'text') {
                const textDecoder = new TextDecoder(record.encoding || 'utf-8');
                ndefText = textDecoder.decode(record.data);
                break;
              } else if (record.recordType === 'url' || record.data) {
                const textDecoder = new TextDecoder();
                ndefText = textDecoder.decode(record.data);
                break;
              }
            } catch (decErr) {
              console.warn('[WebNFC] Decode error:', decErr);
            }
          }
        }

        const tagCode = (ndefText || '').trim() || event.serialNumber;
        if (tagCode) {
          setNfcStatus('read_detected');
          setNfcStatusMsg(t(`Đã nhận diện thẻ: ${tagCode}. Đang đối chiếu...`, `Card detected: ${tagCode}. Verifying...`));
          setIsLoading(true);
          setErrorMessage('');

          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            try { navigator.vibrate([100, 50, 100]); } catch (e) { }
          }

          try {
            const res = await verifyRoomNfc(
              tagCode,
              selectedRoom || null,
              pendingAction,
              pendingItems,
              null,
              (skipTicketCreation || ["taxi", "book_taxi", "taxi_booking", "query_order_status", "query_service_status", "query_taxi_status"].includes(pendingAction)),
              sessionId
            );
            setIsSuccess(true);
            setSuccessInfo(res);
            setIsLoading(false);
            setNfcStatusMsg(t(`Xác thực thành công phòng ${res.room_number} (${res.guest_name})!`, `Room ${res.room_number} verified (${res.guest_name})!`));

            if (onVerifiedSuccess) {
              onVerifiedSuccess(res, res.room_number || selectedRoom);
            }
            setTimeout(() => {
              onClose();
            }, 1000);
          } catch (err) {
            console.error('[RoomPinModal] verify-nfc error:', err);
            setIsLoading(false);
            setNfcStatus('error');
            setErrorMessage(t('Thẻ NFC không hợp lệ hoặc phòng chưa check-in.', 'The NFC card is invalid or the room is not checked in.'));
            setIsShaking(true);
            setTimeout(() => setIsShaking(false), 500);
          }
        } else {
          setErrorMessage(t('Thẻ không trả về dữ liệu NDEF hoặc mã UID.', 'The card did not return NDEF data or a UID.'));
        }
      };

      ndef.onreadingerror = () => {
        setNfcStatusMsg(t('Lỗi đọc: Hãy giữ yên thẻ NFC trong 1-2 giây.', 'Read error: hold the NFC card still for 1–2 seconds.'));
      };

      await ndef.scan({ signal: controller.signal });
      setNfcStatus('scanning');
      setNfcStatusMsg(t('Đang lắng nghe thẻ NFC... Vui lòng áp thẻ vào mặt lưng thiết bị.', 'Ready to scan. Hold the NFC card against the back of the device.'));
    } catch (err) {
      console.warn('[WebNFC] Scan error:', err);
      setNfcStatus('error');
      if (err.name === 'NotAllowedError') {
        setNfcStatusMsg(t('Quyền truy cập NFC bị từ chối.', 'NFC access was denied.'));
      } else {
        setNfcStatusMsg(t('Không thể mở đầu đọc NFC. Vui lòng thử lại.', 'Unable to start the NFC reader. Please try again.'));
      }
    }
  }, [selectedRoom, pendingAction, pendingItems, skipTicketCreation, sessionId, onVerifiedSuccess, onClose, t]);

  const handleVerifyNfc = useCallback(
    async (scannedCode) => {
      if (!scannedCode || isLoading || isSuccess) return;

      setIsLoading(true);
      setErrorMessage('');
      setNfcStatus('read_detected');
      setNfcStatusMsg(t(`Nhận diện thẻ USB: ${scannedCode}. Đang xác thực...`, `USB card detected: ${scannedCode}. Verifying...`));

      try {
        const res = await verifyRoomNfc(
          scannedCode,
          selectedRoom || null,
          pendingAction,
          pendingItems,
          null,
          (skipTicketCreation || ["taxi", "book_taxi", "taxi_booking", "query_order_status", "query_service_status", "query_taxi_status"].includes(pendingAction)),
          sessionId
        );
        setIsSuccess(true);
        setSuccessInfo(res);
        setIsLoading(false);
        setNfcStatusMsg(t(`Xác thực thành công phòng ${res.room_number} (${res.guest_name})!`, `Room ${res.room_number} verified (${res.guest_name})!`));

        if (onVerifiedSuccess) {
          onVerifiedSuccess(res, res.room_number || selectedRoom);
        }

        setTimeout(() => {
          onClose();
        }, 1000);
      } catch (err) {
        console.error('[RoomPinModal] USB verify-nfc error:', err);
        setIsLoading(false);
        setNfcStatus('error');
        setErrorMessage(t('Thẻ phòng không khớp hoặc chưa làm thủ tục nhận phòng.', 'The room card does not match or the room is not checked in.'));
        setIsShaking(true);
        setTimeout(() => setIsShaking(false), 500);
      }
    },
    [isLoading, isSuccess, selectedRoom, pendingAction, pendingItems, skipTicketCreation, sessionId, onVerifiedSuccess, onClose, t]
  );

  handleVerifyNfcRef.current = handleVerifyNfc;

  useEffect(() => {
    if (isOpen) {
      setIsForgotPinView(false);
      setPin('');
      setErrorMessage('');
      setIsSuccess(false);
      setSuccessInfo(null);
      setIsShaking(false);
      setNfcStatus('idle');
      setNfcStatusMsg('');
      setSelectedRoom(roomNumber || '');
      setIsSelectingRoom(Boolean(isSelectingRoomInitial || !roomNumber));
      if (roomNumber && String(roomNumber).startsWith('4')) {
        setRoomFloorTab('4');
      } else {
        setRoomFloorTab('3');
      }
      setActiveTab(initialTab || 'pin');
    } else {
      if (nfcAbortControllerRef.current) {
        try { nfcAbortControllerRef.current.abort(); } catch (e) { }
        nfcAbortControllerRef.current = null;
      }
    }

    return () => {
      if (nfcAbortControllerRef.current) {
        try { nfcAbortControllerRef.current.abort(); } catch (e) { }
        nfcAbortControllerRef.current = null;
      }
    };
  }, [isOpen, roomNumber, initialTab, isSelectingRoomInitial, t]);

  useEffect(() => {
    if (!isOpen || activeTab !== 'nfc') return;

    const handleKeyDown = (e) => {
      const now = Date.now();
      if (now - lastKeyTimeRef.current > 150) {
        keyBufferRef.current = '';
      }
      lastKeyTimeRef.current = now;

      if (e.key === 'Enter') {
        const scannedUid = keyBufferRef.current.trim();
        if (scannedUid.length >= 6) {
          handleVerifyNfcRef.current(scannedUid);
        }
        keyBufferRef.current = '';
      } else if (e.key.length === 1) {
        keyBufferRef.current += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, activeTab, t]);

  const handleKeyPress = useCallback((digit) => {
    if (isLoading || isSuccess || lockoutRemaining > 0) return;
    setErrorMessage('');
    setPin((prev) => (prev.length < 4 ? prev + digit : prev));
  }, [isLoading, isSuccess, lockoutRemaining, t]);

  const handleDelete = useCallback(() => {
    if (isLoading || isSuccess || lockoutRemaining > 0) return;
    setErrorMessage('');
    setPin((prev) => prev.slice(0, -1));
  }, [isLoading, isSuccess, lockoutRemaining, t]);

  const handleClear = useCallback(() => {
    if (isLoading || isSuccess || lockoutRemaining > 0) return;
    setErrorMessage('');
    setPin('');
  }, [isLoading, isSuccess, lockoutRemaining, t]);

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
            setErrorMessage(t('Phòng chưa làm thủ tục nhận phòng. Đang chuyển tới quầy Lễ tân...', 'This room is not checked in. Opening directions to reception...'));
            setIsShaking(true);
            if (onNotCheckedIn) {
              setTimeout(() => {
                onNotCheckedIn({
                  roomNumber: err.room_number || selectedRoom,
                  destination_key: err.destination_key || 'front_desk',
                  message: t('Phòng chưa làm thủ tục nhận phòng. Quý khách vui lòng liên hệ lễ tân.', 'This room is not checked in. Please contact reception.'),
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
            setErrorMessage(t(`Quý khách đã nhập sai mã PIN 5 lần. Hệ thống tạm khóa 1 phút. Quý khách vui lòng thử lại sau (${PIN_LOCKOUT_DURATION_SEC}s).`, `Too many incorrect PIN attempts. Please try again in ${PIN_LOCKOUT_DURATION_SEC} seconds.`));
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
            setErrorMessage(t(`Quý khách đã nhập sai mã PIN 5 lần. Hệ thống tạm khóa 1 phút. Quý khách vui lòng thử lại sau (${PIN_LOCKOUT_DURATION_SEC}s).`, `Too many incorrect PIN attempts. Please try again in ${PIN_LOCKOUT_DURATION_SEC} seconds.`));
          } else {
            setRoomLockoutState(selectedRoom, { count: nextCount, lockedUntil: 0 });
            setErrorMessage(t(DEFAULT_WRONG_PIN_ERROR_MSG, 'Incorrect room PIN. Please try again.'));
          }
          setIsShaking(true);
          setTimeout(() => setIsShaking(false), 500);
          setPin('');
        }
      };

      submitPin();
    }
  }, [pin, isLoading, isSuccess, activeTab, selectedRoom, isSelectingRoom, pendingAction, pendingItems, onVerifiedSuccess, onNotCheckedIn, onClose, t]);

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
          title={t('Đóng', 'Close')}
        >
          <X className="w-4 h-4" />
        </button>

        {/* 1. MÀN HÌNH THÀNH CÔNG */}
        {isSuccess ? (
          <div className="text-center py-6 space-y-3">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-extrabold text-stone-900">
                {t('Xác Thực Thành Công', 'Verification Successful')}
              </h3>
              <p className="mt-1 text-xs text-stone-600">
                {t('Chào mừng', 'Welcome')} {successInfo?.guest_name || t('quý khách', 'guest')}! {t('Đã xác nhận phòng', 'Verified room')} {successInfo?.room_number || selectedRoom}.
              </p>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-stone-100 border border-stone-200 text-[11px] font-semibold text-stone-700">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>{t('Đang gửi yêu cầu...', 'Sending request...')}</span>
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
                {t('Quên Mã PIN Phòng?', 'Forgot Your Room PIN?')}
              </h3>
              <p className="text-xs text-stone-600 mt-2 leading-relaxed px-1">
                {t('Vì lý do bảo mật, Robot không được phép cấp lại mã PIN. Quý khách vui lòng liên hệ quầy Lễ tân tại sảnh chính để được nhân viên hỗ trợ cấp lại mã PIN nhé ạ.', 'Please contact reception in the main lobby to reset your PIN. The robot cannot reset it for security reasons.')}
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
                <span>{t('Chỉ đường đến Quầy Lễ Tân', 'Directions to Reception')}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsForgotPinView(false)}
                className="w-full py-2 px-4 rounded-2xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold transition-all cursor-pointer"
              >
                {t('Quay lại nhập mã PIN', 'Back to PIN entry')}
              </button>
            </div>
          </div>
        ) : isSelectingRoom ? (
          /* 3. BƯỚC 1: CHỌN SỐ PHÒNG (MINIMAL TOUCH UI SÁNG) */
          <div className="space-y-3.5">
            <div className="text-center">
              <h3 className="text-sm sm:text-base font-extrabold text-stone-900">
                {t('Chọn Số Phòng Lưu Trú', 'Choose Your Room')}
              </h3>
              <p className="text-[11px] text-stone-500 mt-0.5">
                {t('Chạm chọn số phòng của quý khách', 'Tap your room number')}
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
                {t('Tầng 3 (P.301 - 310)', 'Floor 3 (Rooms 301–310)')}
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
                {t('Tầng 4 (P.401 - 410)', 'Floor 4 (Rooms 401–410)')}
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
                {selectedRoom ? t(`Mã PIN Phòng ${selectedRoom}`, `Room ${selectedRoom} PIN`) : t('Nhập Mã PIN Phòng', 'Enter Your Room PIN')}
              </h3>

              <p className="text-xs text-stone-500 mt-0.5">
                {t('4 số cuối CCCD của khách lưu trú', 'Last 4 digits of the registered identity document')}
              </p>

              {/* Thanh hiển thị phòng đang chọn kèm nút đổi phòng */}
              <div className="mt-2 w-full flex items-center justify-between px-3 py-1.5 rounded-2xl bg-stone-50 border border-stone-200">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-xs font-bold text-stone-900">
                    {t('Phòng', 'Room')} {selectedRoom}
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
                  {t('Đổi phòng', 'Change room')}
                </button>
              </div>

              {/* Trạng thái / lỗi */}
              <div className="min-h-[16px] mt-1 text-center">
                {isLoading && (
                  <span className="text-[11px] text-stone-600 animate-pulse font-medium">
                    {t('Đang xác thực mã PIN...', 'Verifying PIN...')}
                  </span>
                )}
                {lockoutRemaining > 0 && !isLoading && (
                  <div className="flex items-center justify-center gap-1.5 text-[11px] text-rose-600 font-bold bg-rose-50 border border-rose-200/80 rounded-xl py-1.5 px-2.5">
                    <Lock className="w-3.5 h-3.5 flex-shrink-0 text-rose-600" />
                    <span>{t('Thử lại sau', 'Try again in')} {lockoutRemaining}s</span>
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
                {t('Xóa', 'Clear')}
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
                title={t('Xóa lùi', 'Backspace')}
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
                {t('Quên mã PIN?', 'Forgot PIN?')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
