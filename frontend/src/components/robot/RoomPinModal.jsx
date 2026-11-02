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
  initialTab = 'pin',
  isSelectingRoomInitial = false,
  skipTicketCreation = true,
}) => {
  const [selectedRoom, setSelectedRoom] = useState(roomNumber || '');
  const [isSelectingRoom, setIsSelectingRoom] = useState(Boolean(isSelectingRoomInitial || !roomNumber));
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150 select-none overscroll-contain">
      <div
        className={`relative w-full max-w-[340px] sm:max-w-sm max-h-[92vh] overflow-y-auto p-4 sm:p-5 rounded-2xl bg-stone-900 border border-stone-800 shadow-2xl text-stone-100 transition-all ${
          isShaking ? 'animate-shake' : ''
        } ${isSuccess ? 'border-emerald-500/60' : ''}`}
      >
        {/* Nut dong */}
        <button
          type="button"
          onClick={onClose}
          disabled={isLoading || isSuccess}
          className="absolute top-3 right-3 z-10 p-1.5 rounded-lg bg-stone-800/80 hover:bg-stone-700 text-stone-400 hover:text-stone-200 transition-colors cursor-pointer"
          title="Đóng"
        >
          <X className="w-4 h-4" />
        </button>

        {/* 1. MAN HINH THANH CONG */}
        {isSuccess ? (
          <div className="text-center py-5 space-y-3">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-stone-800 border border-emerald-500/40 text-emerald-400">
              <CheckCircle2 className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-100">
                Xác Thực Thành Công
              </h3>
              <p className="mt-1 text-xs text-stone-400">
                Chào mừng {successInfo?.guest_name || 'quý khách'}! Đã xác nhận phòng {successInfo?.room_number || selectedRoom}.
              </p>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-stone-800/90 border border-stone-700 text-[11px] text-stone-300">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Đang gửi yêu cầu phục vụ...</span>
            </div>
          </div>
        ) : activeTab === 'nfc' ? (
          /* 2. CHE DO QUET THE NFC */
          <div className="space-y-3">
            <div className="text-center space-y-1">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-stone-800 border border-stone-700 text-stone-300 mx-auto">
                <Radio className="w-5 h-5 animate-pulse" />
              </div>
              <h3 className="text-sm sm:text-base font-bold text-stone-100">
                Chạm Thẻ Phòng NFC
              </h3>
              <p className="text-[11px] text-stone-400">
                Áp thẻ phòng vào mặt lưng điện thoại để hệ thống nhận diện
              </p>
            </div>

            <div
              onClick={() => {
                if (nfcStatus !== 'scanning') startWebNfcScan();
              }}
              className={`rounded-xl border p-3.5 text-center flex flex-col items-center justify-center cursor-pointer select-none active:scale-[0.98] transition-all ${
                nfcStatus === 'scanning'
                  ? 'bg-stone-800/80 border-emerald-500/60'
                  : 'bg-stone-800/40 border-stone-700/60 hover:border-stone-600'
              }`}
            >
              <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-1.5 bg-stone-800 border border-stone-700 text-stone-300">
                <CreditCard className="w-5 h-5" />
              </div>
              <div className="text-xs text-stone-300 leading-relaxed">
                {nfcStatusMsg || 'Áp thẻ phòng NFC vào mặt lưng điện thoại'}
              </div>
            </div>

            <button
              type="button"
              onClick={() => startWebNfcScan()}
              disabled={isLoading || nfcStatus === 'scanning'}
              className="w-full py-2.5 px-4 rounded-xl font-bold flex items-center justify-center gap-2 bg-stone-100 hover:bg-stone-200 text-stone-900 shadow-sm active:scale-95 transition-all cursor-pointer text-xs"
            >
              <Radio className="w-3.5 h-3.5 animate-pulse" />
              <span>{nfcStatus === 'scanning' ? 'ĐANG LẮNG NGHE THẺ...' : 'BẬT ĐẦU ĐỌC QUÉT THẺ'}</span>
            </button>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('pin');
                  setErrorMessage('');
                }}
                className="text-xs text-stone-400 hover:text-stone-200 underline underline-offset-4 transition-colors cursor-pointer"
              >
                Không mang thẻ? Nhập mã PIN phòng 4 số
              </button>
            </div>
          </div>
        ) : isSelectingRoom ? (
          /* 3. BƯỚC 1: CHỌN SỐ PHÒNG (MINIMAL TOUCH UI) */
          <div className="space-y-3">
            <div className="text-center">
              <h3 className="text-sm sm:text-base font-bold text-stone-100">
                Chọn Số Phòng Lưu Trú
              </h3>
              <p className="text-[11px] text-stone-400 mt-0.5">
                Chạm chọn số phòng để xác định vị trí giao món
              </p>
            </div>

            {/* Tab chọn tầng */}
            <div className="flex gap-1.5 p-1 bg-stone-800/80 rounded-xl border border-stone-700/60">
              <button
                type="button"
                onClick={() => setRoomFloorTab('3')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  roomFloorTab === '3'
                    ? 'bg-stone-100 text-stone-900 shadow-sm'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                Tầng 3 (301 - 310)
              </button>
              <button
                type="button"
                onClick={() => setRoomFloorTab('4')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  roomFloorTab === '4'
                    ? 'bg-stone-100 text-stone-900 shadow-sm'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                Tầng 4 (401 - 410)
              </button>
            </div>

            {/* Lưới 10 phòng của tầng */}
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
                        ? 'bg-stone-100 text-stone-900 shadow-sm ring-1 ring-stone-200'
                        : 'bg-stone-800/80 hover:bg-stone-750 text-stone-200 border border-stone-700/60'
                    }`}
                  >
                    {rNum}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          /* 4. BƯỚC 2: NHẬP MÃ PIN 4 SỐ (TỐI ƯU CỰC ĐẠI CHO MOBILE UX) */
          <div className="space-y-2.5">
            {/* Header thông tin */}
            <div className="flex flex-col items-center text-center">
              <div className="w-9 h-9 rounded-xl mb-1 bg-stone-800 border border-stone-700/60 text-stone-300 flex items-center justify-center">
                <KeyRound className="w-4 h-4 text-stone-300" />
              </div>

              <h3 className="text-sm sm:text-base font-bold text-stone-100">
                Xác Nhận Đặt Món
              </h3>

              <p className="text-[11px] text-stone-400 mt-0.5">
                Nhập 4 số cuối CCCD của phòng lưu trú
              </p>

              {/* Chi tiết món ăn */}
              {pendingItems && (
                <div className="mt-1 px-2.5 py-0.5 rounded-lg bg-stone-800/80 border border-stone-700/50 text-[10px] text-stone-300 font-medium max-w-full truncate">
                  {pendingItems}
                </div>
              )}

              {/* Thanh hiển thị phòng đang chọn kèm nút đổi phòng */}
              <div className="mt-1.5 w-full flex items-center justify-between px-2.5 py-1 rounded-xl bg-stone-800/60 border border-stone-700/50">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span className="text-[10px] sm:text-xs text-stone-400">Giao đến:</span>
                  <span className="text-xs sm:text-sm font-bold text-stone-100">
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
                  className="text-[10px] font-medium text-stone-300 hover:text-stone-100 px-2 py-0.5 rounded-md bg-stone-700/70 hover:bg-stone-700 transition-colors cursor-pointer"
                >
                  Đổi phòng
                </button>
              </div>

              {/* Trạng thái / lỗi */}
              <div className="min-h-[16px] mt-1 text-center">
                {isLoading && (
                  <span className="text-[11px] text-stone-300 animate-pulse font-medium">
                    Đang xác thực mã PIN...
                  </span>
                )}
                {errorMessage && !isLoading && (
                  <div className="flex items-center justify-center gap-1 text-[11px] text-rose-400 font-medium">
                    <AlertCircle className="w-3 h-3 flex-shrink-0" />
                    <span className="line-clamp-2">{errorMessage}</span>
                  </div>
                )}
              </div>
            </div>

            {/* 4 Ô chỉ báo mã PIN */}
            <div className="flex justify-center items-center gap-2 py-0.5">
              {[0, 1, 2, 3].map((index) => {
                const isFilled = pin.length > index;
                return (
                  <div
                    key={index}
                    className={`w-3 h-3 rounded-full transition-all duration-150 ${
                      isFilled
                        ? 'bg-stone-100 ring-2 ring-stone-400/30 scale-105'
                        : 'bg-stone-800 border border-stone-600'
                    }`}
                  />
                );
              })}
            </div>

            {/* Bàn phím số Numpad cảm ứng tinh giản */}
            <div className="grid grid-cols-3 gap-1.5 w-full max-w-[240px] mx-auto">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleKeyPress(String(num))}
                  disabled={isLoading || isSuccess}
                  className="h-10 rounded-xl bg-stone-800/90 hover:bg-stone-750 active:bg-stone-700 border border-stone-700/50 text-base font-semibold text-stone-100 shadow-sm active:scale-95 transition-all flex items-center justify-center select-none cursor-pointer"
                >
                  {num}
                </button>
              ))}

              <button
                type="button"
                onClick={handleClear}
                disabled={isLoading || isSuccess || pin.length === 0}
                className="h-10 rounded-xl bg-stone-850/60 hover:bg-stone-800 border border-stone-700/30 text-[11px] font-medium text-stone-400 hover:text-stone-200 uppercase tracking-wider active:scale-95 transition-all flex items-center justify-center select-none disabled:opacity-20 cursor-pointer"
              >
                Xóa
              </button>

              <button
                type="button"
                onClick={() => handleKeyPress('0')}
                disabled={isLoading || isSuccess}
                className="h-10 rounded-xl bg-stone-800/90 hover:bg-stone-750 active:bg-stone-700 border border-stone-700/50 text-base font-semibold text-stone-100 shadow-sm active:scale-95 transition-all flex items-center justify-center select-none cursor-pointer"
              >
                0
              </button>

              <button
                type="button"
                onClick={handleDelete}
                disabled={isLoading || isSuccess || pin.length === 0}
                className="h-10 rounded-xl bg-stone-850/60 hover:bg-stone-800 border border-stone-700/30 text-stone-400 hover:text-stone-200 active:scale-95 transition-all flex items-center justify-center select-none disabled:opacity-20 cursor-pointer"
              >
                <Delete className="w-4 h-4" />
              </button>
            </div>

            {/* Quẹt thẻ NFC option */}
            <div className="text-center pt-0.5">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('nfc');
                  setErrorMessage('');
                }}
                className="text-[11px] text-stone-400 hover:text-stone-200 underline underline-offset-4 transition-colors cursor-pointer"
              >
                Hoặc quẹt thẻ phòng NFC
              </button>
            </div>
          </div>
        )}

        {/* Chú thích chân modal */}
        <div className="mt-2 text-center">
          <p className="text-[10px] text-stone-400 flex items-center justify-center gap-1">
            <Lock className="w-2.5 h-2.5 text-stone-400" />
            <span>Bảo mật quyền riêng tư phòng lưu trú</span>
          </p>
        </div>
      </div>
    </div>
  );
};
