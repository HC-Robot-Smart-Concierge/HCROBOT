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

      setNfcStatusMsg('Trình duyệt chưa hỗ trợ Web NFC. Cần dùng Google Chrome trên Android.');

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

      setNfcStatusMsg('Đang kích hoạt đầu đọc thẻ NFC...');



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

          setNfcStatusMsg(`Đã nhận diện thẻ: ${tagCode}. Đang đối chiếu...`);

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

              skipTicketCreation

            );

            setIsSuccess(true);

            setSuccessInfo(res);

            setIsLoading(false);

            setNfcStatusMsg(`Xác thực thành công phòng ${res.room_number} (${res.guest_name})!`);



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

            setErrorMessage(err.message || 'Thẻ NFC không hợp lệ hoặc phòng chưa check-in.');

            setIsShaking(true);

            setTimeout(() => setIsShaking(false), 500);

          }

        } else {

          setErrorMessage('Thẻ không trả về dữ liệu NDEF hoặc mã UID.');

        }

      };



      ndef.onreadingerror = () => {

        setNfcStatusMsg('Lỗi đọc: Hãy giữ yên thẻ NFC trong 1-2 giây.');

      };



      await ndef.scan({ signal: controller.signal });

      setNfcStatus('scanning');

      setNfcStatusMsg('Đang lắng nghe thẻ NFC... Vui lòng áp thẻ vào mặt lưng thiết bị.');

    } catch (err) {

      console.warn('[WebNFC] Scan error:', err);

      setNfcStatus('error');

      if (err.name === 'NotAllowedError') {

        setNfcStatusMsg('Quyền truy cập NFC bị từ chối.');

      } else {

        setNfcStatusMsg(`Lỗi kích hoạt NFC: ${err.message || 'Không thể mở đầu đọc'}`);

      }

    }

  }, [selectedRoom, pendingAction, pendingItems, onVerifiedSuccess, onClose]);



  const handleVerifyNfc = useCallback(

    async (scannedCode) => {

      if (!scannedCode || isLoading || isSuccess) return;



      setIsLoading(true);

      setErrorMessage('');

      setNfcStatus('read_detected');

      setNfcStatusMsg(`Nhận diện thẻ USB: ${scannedCode}. Đang xác thực...`);



      try {

        const res = await verifyRoomNfc(

          scannedCode,

          selectedRoom || null,

          pendingAction,

          pendingItems,

          null,

          skipTicketCreation

        );

        setIsSuccess(true);

        setSuccessInfo(res);

        setIsLoading(false);

        setNfcStatusMsg(`Xác thực thành công phòng ${res.room_number} (${res.guest_name})!`);



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

        setErrorMessage(err.message || 'Thẻ phòng không khớp hoặc chưa làm thủ tục nhận phòng.');

        setIsShaking(true);

        setTimeout(() => setIsShaking(false), 500);

      }

    },

    [isLoading, isSuccess, selectedRoom, pendingAction, pendingItems, onVerifiedSuccess, onClose]

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

  }, [isOpen, roomNumber, initialTab, isSelectingRoomInitial]);



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

  }, [isOpen, activeTab]);



  const handleKeyPress = useCallback((digit) => {

    if (isLoading || isSuccess) return;

    setErrorMessage('');

    setPin((prev) => (prev.length < 4 ? prev + digit : prev));

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

            skipTicketCreation

          );

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

          setErrorMessage(err.message || 'Mã PIN 4 số không chính xác (4 số cuối CCCD). Quý khách vui lòng thử lại.');

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
                {errorMessage && !isLoading && (
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
                  disabled={isLoading || isSuccess}
                  className="h-11 rounded-2xl bg-stone-50 hover:bg-stone-100 active:bg-stone-200 border border-stone-200/90 text-lg font-bold text-stone-900 shadow-2xs active:scale-95 transition-all flex items-center justify-center select-none cursor-pointer"
                >
                  {num}
                </button>
              ))}

              <button
                type="button"
                onClick={handleClear}
                disabled={isLoading || isSuccess || pin.length === 0}
                className="h-11 rounded-2xl bg-stone-100/70 hover:bg-stone-100 border border-stone-200/50 text-[11px] font-bold text-stone-500 hover:text-stone-800 uppercase tracking-wider active:scale-95 transition-all flex items-center justify-center select-none disabled:opacity-30 cursor-pointer"
              >
                Xóa
              </button>

              <button
                type="button"
                onClick={() => handleKeyPress('0')}
                disabled={isLoading || isSuccess}
                className="h-11 rounded-2xl bg-stone-50 hover:bg-stone-100 active:bg-stone-200 border border-stone-200/90 text-lg font-bold text-stone-900 shadow-2xs active:scale-95 transition-all flex items-center justify-center select-none cursor-pointer"
              >
                0
              </button>

              <button
                type="button"
                onClick={handleDelete}
                disabled={isLoading || isSuccess || pin.length === 0}
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
      </div>
    </div>
  );
};
