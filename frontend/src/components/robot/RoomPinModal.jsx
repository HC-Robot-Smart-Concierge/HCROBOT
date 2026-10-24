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
  RefreshCw,
} from 'lucide-react';
import { verifyRoomPin, verifyRoomNfc } from '../../services/operationsApi';

/**
 * RoomPinModal - Modal Xác Thực Khách Lưu Trú Kiosk 5 Sao
 * - Chế độ Quẹt Thẻ NFC Thực Tế (Web NFC NDEFReader + USB RFID Reader)
 * - Tự động nhận diện số phòng và xác thực không chạm ngay khi chạm thẻ
 * - Hiển thị phản hồi thời gian thực chi tiết từng bước (Đọc thẻ -> Gửi API -> Phản hồi Supabase)
 */
export const RoomPinModal = ({
  isOpen,
  onClose,
  roomNumber,
  pendingAction = 'room_service',
  pendingItems = 'Yêu cầu dịch vụ phòng',
  onVerifiedSuccess,
}) => {
  const [activeTab, setActiveTab] = useState('nfc'); // 'nfc' | 'pin'
  const [pin, setPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [successInfo, setSuccessInfo] = useState(null);
  const [isShaking, setIsShaking] = useState(false);

  // Debug & Thông tin đọc thẻ thời gian thực
  const [nfcStatus, setNfcStatus] = useState('idle'); // 'idle' | 'starting' | 'scanning' | 'read_detected' | 'unsupported' | 'error'
  const [nfcStatusMsg, setNfcStatusMsg] = useState('');
  const [lastScannedUid, setLastScannedUid] = useState(null);

  const nfcAbortControllerRef = useRef(null);
  const keyBufferRef = useRef('');
  const lastKeyTimeRef = useRef(0);

  // Ref cho hàm xác thực NFC qua USB HID Reader
  const handleVerifyNfcRef = useRef(null);

  // =========================================================================
  // 1. WEB NFC API (NDEFReader) - CHẠY TRỰC TIẾP CHUẨN XÁC 100% NHƯ /nfc-test
  // =========================================================================
  const startWebNfcScan = useCallback(async () => {
    if (typeof window === 'undefined') return;

    if (!('NDEFReader' in window)) {
      console.warn('[WebNFC] NDEFReader is not supported in this browser/device.');
      setNfcStatus('unsupported');
      setNfcStatusMsg('Trình duyệt chưa hỗ trợ Web NFC. Cần dùng Google Chrome trên Android.');
      alert('Trình duyệt này không hỗ trợ Web NFC. Vui lòng mở bằng Google Chrome trên Android.');
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
        console.log('[WebNFC] Reading event fired! serialNumber:', event.serialNumber, event);

        let ndefText = '';
        if (event.message && event.message.records && event.message.records.length > 0) {
          for (const record of event.message.records) {
            console.log('[WebNFC] Record type:', record.recordType);
            try {
              if (record.recordType === 'text') {
                const textDecoder = new TextDecoder(record.encoding || 'utf-8');
                ndefText = textDecoder.decode(record.data);
                break;
              } else if (record.recordType === 'url') {
                const textDecoder = new TextDecoder();
                ndefText = textDecoder.decode(record.data);
                break;
              } else if (record.data) {
                const textDecoder = new TextDecoder();
                ndefText = textDecoder.decode(record.data);
                break;
              }
            } catch (decErr) {
              console.warn('[WebNFC] Decode error:', decErr);
            }
          }
        }

        // Ưu tiên chuỗi dữ liệu NDEF ghi trong thẻ (ndefText), nếu rỗng thì lấy UID phần cứng
        const tagCode = (ndefText || '').trim() || event.serialNumber;
        console.log(`[WebNFC] Decoded NDEF: '${ndefText}' -> Tag code: '${tagCode}'`);

        if (tagCode) {
          setLastScannedUid(tagCode);
          setNfcStatus('read_detected');
          setNfcStatusMsg(`Đã nhận diện thẻ: ${tagCode}. Đang đối chiếu...`);
          setIsLoading(true);
          setErrorMessage('');

          // Rung điện thoại
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            try { navigator.vibrate([100, 50, 100]); } catch (e) { }
          }

          try {
            const res = await verifyRoomNfc(
              tagCode,
              null, // Để thẻ tự nhận diện phòng từ CSDL
              pendingAction,
              pendingItems
            );
            console.log(`[WebNFC] Backend response 200 OK! Room: ${res.room_number} (${res.guest_name})`);
            setIsSuccess(true);
            setSuccessInfo(res);
            setIsLoading(false);
            setNfcStatusMsg(`Xác thực thành công phòng ${res.room_number} (${res.guest_name})!`);

            if (onVerifiedSuccess) {
              onVerifiedSuccess(res);
            }
            setTimeout(() => {
              onClose();
            }, 1400);
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

      ndef.onreadingerror = (event) => {
        console.warn('[WebNFC] Reading error fired:', event);
        setNfcStatusMsg('Lỗi đọc: Thẻ không thể giải mã NDEF hoặc bị dời quá nhanh. Hãy giữ yên thẻ 1-2 giây.');
      };

      await ndef.scan({ signal: controller.signal });

      setNfcStatus('scanning');
      setNfcStatusMsg('Đầu đọc NFC đang lắng nghe... Hãy áp thẻ vào mặt lưng điện thoại.');
    } catch (err) {
      console.error('[WebNFC] Scan failed:', err);
      setNfcStatus('error');
      if (err.name === 'NotAllowedError') {
        setNfcStatusMsg('Chrome chưa được cấp quyền NFC hoặc cần tương tác người dùng.');
      } else if (err.name === 'NotReadableError') {
        setNfcStatusMsg('Chức năng NFC trên điện thoại đang TẮT. Hãy bật NFC trong Cài đặt Android.');
      } else if (err.name === 'SecurityError') {
        setNfcStatusMsg('Web NFC yêu cầu kết nối bảo mật HTTPS.');
      } else {
        setNfcStatusMsg(err.message || 'Lỗi khi kích hoạt đầu đọc thẻ NFC.');
      }
    }
  }, [pendingAction, pendingItems, onVerifiedSuccess, onClose]);

  // Hàm xác thực NFC cho USB HID Reader (gọi từ keydown handler)
  const handleVerifyNfc = useCallback(async (tagCode) => {
    if (!tagCode) return;
    console.log(`[USB-NFC] Verifying scanned UID: '${tagCode}'`);
    setLastScannedUid(tagCode);
    setNfcStatus('read_detected');
    setNfcStatusMsg(`Đã nhận diện thẻ: ${tagCode}. Đang đối chiếu...`);
    setIsLoading(true);
    setErrorMessage('');

    try {
      const res = await verifyRoomNfc(
        tagCode,
        null,
        pendingAction,
        pendingItems
      );
      console.log(`[USB-NFC] Backend response 200 OK! Room: ${res.room_number} (${res.guest_name})`);
      setIsSuccess(true);
      setSuccessInfo(res);
      setIsLoading(false);
      setNfcStatusMsg(`Xác thực thành công phòng ${res.room_number} (${res.guest_name})!`);

      if (onVerifiedSuccess) {
        onVerifiedSuccess(res);
      }
      setTimeout(() => {
        onClose();
      }, 1400);
    } catch (err) {
      console.error('[RoomPinModal] USB verify-nfc error:', err);
      setIsLoading(false);
      setNfcStatus('error');
      setErrorMessage(err.message || 'Thẻ NFC không hợp lệ hoặc phòng chưa check-in.');
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
    }
  }, [pendingAction, pendingItems, onVerifiedSuccess, onClose]);

  // Đồng bộ ref cho USB HID handler
  useEffect(() => {
    handleVerifyNfcRef.current = handleVerifyNfc;
  }, [handleVerifyNfc]);

  // Reset khi mở modal (không tự ý scan trên mount để tránh vi phạm User Gesture của Chrome)
  useEffect(() => {
    if (isOpen) {
      setPin('');
      setErrorMessage('');
      setIsLoading(false);
      setIsSuccess(false);
      setSuccessInfo(null);
      setIsShaking(false);
      setActiveTab('nfc');
      setLastScannedUid(null);
      setNfcStatus('idle');
      setNfcStatusMsg('Bấm nút bên dưới để bật đầu đọc NFC.');
      keyBufferRef.current = '';
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
  }, [isOpen]);

  // =========================================================================
  // 2. HỖ TRỢ ĐẦU ĐỌC THẺ NFC USB (Dạng USB HID Keyboard Emulation)
  // =========================================================================
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
          console.log('[USB-NFC] Scanned UID:', scannedUid);
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

  // =========================================================================
  // 3. XỬ LÝ NHẬP MÃ PIN DỰ PHÒNG
  // =========================================================================
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

  // Tự động submit khi nhập đủ 4 số PIN
  useEffect(() => {
    if (pin.length === 4 && !isLoading && !isSuccess && activeTab === 'pin') {
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
          setSuccessInfo(res);
          setIsLoading(false);

          if (onVerifiedSuccess) {
            onVerifiedSuccess(res);
          }

          setTimeout(() => {
            onClose();
          }, 1300);
        } catch (err) {
          setIsLoading(false);
          setErrorMessage(err.message || 'Mã PIN hoặc 4 số cuối CCCD không chính xác.');
          setIsShaking(true);
          setTimeout(() => setIsShaking(false), 500);
          setPin('');
        }
      };

      submitPin();
    }
  }, [pin, isLoading, isSuccess, activeTab, roomNumber, pendingAction, pendingItems, onVerifiedSuccess, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className={`relative w-full max-w-md p-6 sm:p-8 rounded-3xl bg-stone-900/95 border border-stone-700/80 shadow-2xl backdrop-blur-2xl text-white transition-all ${
          isShaking ? 'animate-shake' : ''
        } ${isSuccess ? 'border-emerald-500/80 shadow-emerald-500/30' : ''}`}
      >
        {/* Nút đóng */}
        <button
          onClick={onClose}
          disabled={isLoading || isSuccess}
          className="absolute top-5 right-5 p-2 rounded-full bg-stone-800/80 hover:bg-stone-700 text-stone-400 hover:text-white transition-colors"
          title="Đóng modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Tiêu đề & Trạng thái */}
        <div className="text-center mb-5">
          <div
            className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-3 shadow-lg transition-colors ${
              isSuccess
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                : activeTab === 'nfc'
                ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/40'
                : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
            }`}
          >
            {isSuccess ? (
              <CheckCircle2 className="w-10 h-10 animate-bounce" />
            ) : activeTab === 'nfc' ? (
              <Radio className="w-8 h-8 animate-pulse text-indigo-400" />
            ) : (
              <KeyRound className="w-8 h-8 text-amber-400" />
            )}
          </div>

          <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-stone-100">
            {isSuccess
              ? 'Xác Thực Thành Công!'
              : activeTab === 'nfc'
              ? 'Chạm Thẻ Phòng NFC'
              : roomNumber
              ? `Nhập Mã PIN Phòng ${roomNumber}`
              : 'Nhập Mã PIN Phòng'}
          </h3>

          <p className="mt-1 text-xs sm:text-sm text-stone-400">
            {isSuccess
              ? `Chào mừng ${successInfo?.guest_name || 'quý khách'}! Đã khởi tạo #${successInfo?.ticket_code || 'REQ'}`
              : activeTab === 'nfc'
              ? 'Áp thẻ phòng vào mặt lưng điện thoại để hệ thống tự nhận diện'
              : 'Nhập mã PIN 4 số của phòng hoặc 4 số cuối CCCD'}
          </p>

          {/* Chi tiết yêu cầu phục vụ */}
          {pendingItems && !isSuccess && (
            <div className="mt-2.5 px-3 py-1.5 rounded-xl bg-stone-800/70 border border-stone-700/60 text-xs text-amber-300 font-medium inline-block max-w-full truncate">
              {pendingItems}
            </div>
          )}
        </div>

        {/* Thông báo trạng thái hoặc lỗi */}
        <div className="min-h-[24px] mb-3 text-center">
          {isLoading && (
            <span className="text-xs text-amber-400 animate-pulse font-medium">
              Đang đối chiếu thẻ với máy chủ Supabase...
            </span>
          )}
          {errorMessage && !isLoading && (
            <div className="flex items-center justify-center gap-1.5 text-xs text-rose-400 font-medium animate-in fade-in">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
          {isSuccess && (
            <div className="flex items-center justify-center gap-1.5 text-xs text-emerald-400 font-semibold animate-in fade-in">
              <ShieldCheck className="w-4 h-4 flex-shrink-0" />
              <span>Đã xác nhận phòng {successInfo?.room_number}!</span>
            </div>
          )}
        </div>

        {/* NỘI DUNG CHÍNH: QUÉT THẺ NFC THẬT */}
        {activeTab === 'nfc' && !isSuccess && (
          <div className="space-y-4">
            {/* Vùng quét thẻ cảm ứng sóng radar */}
            <div
              onClick={() => {
                if (nfcStatus !== 'scanning') {
                  startWebNfcScan();
                }
              }}
              className={`relative overflow-hidden rounded-3xl border p-6 text-center flex flex-col items-center justify-center cursor-pointer select-none active:scale-[0.98] transition-all ${
                nfcStatus === 'scanning'
                  ? 'bg-gradient-to-b from-emerald-950/40 to-stone-900/80 border-emerald-500/50 shadow-lg shadow-emerald-500/10'
                  : 'bg-gradient-to-b from-indigo-950/40 to-stone-900/80 border-indigo-500/30 hover:border-indigo-400/60'
              }`}
            >
              <div className="relative mb-3 flex items-center justify-center">
                {/* Vòng sóng radar lan tỏa */}
                {nfcStatus === 'scanning' && (
                  <>
                    <span className="absolute w-28 h-28 rounded-full bg-emerald-500/20 animate-ping" />
                    <span className="absolute w-20 h-20 rounded-full bg-emerald-500/30 animate-pulse" />
                  </>
                )}
                <div
                  className={`relative w-16 h-16 rounded-2xl flex items-center justify-center shadow-xl transition-all ${
                    nfcStatus === 'scanning'
                      ? 'bg-emerald-600/30 border border-emerald-400/60 text-emerald-300 scale-105'
                      : 'bg-indigo-600/40 border border-indigo-400/60 text-indigo-300'
                  }`}
                >
                  <CreditCard className="w-8 h-8" />
                </div>
              </div>

              {/* Chỉ báo trạng thái phần cứng thực tế */}
              {nfcStatus === 'scanning' && (
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-xs text-emerald-300 font-semibold animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>ĐẦU ĐỌC ĐANG LẮNG NGHE THẺ</span>
                </div>
              )}

              {nfcStatus === 'read_detected' && (
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-xs text-indigo-300 font-medium animate-pulse">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Đã bắt được thẻ: {lastScannedUid}</span>
                </div>
              )}

              {nfcStatus === 'starting' && (
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-xs text-amber-300 font-medium">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Đang khởi động NFC...</span>
                </div>
              )}

              {nfcStatus === 'error' && (
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/40 text-xs text-rose-300 font-medium">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Chạm vào đây để kích hoạt lại</span>
                </div>
              )}

              {nfcStatus === 'idle' && (
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-xs text-indigo-300 font-medium">
                  <Radio className="w-3.5 h-3.5 animate-pulse" />
                  <span>Bấm nút bên dưới để bật quét</span>
                </div>
              )}

              <p className="mt-2.5 text-xs text-stone-300 max-w-xs leading-relaxed">
                {nfcStatusMsg || 'Áp thẻ phòng NFC vào mặt lưng điện thoại để tự động kích hoạt'}
              </p>
            </div>

            {/* NÚT BẤM BẬT QUÉT TO RÕ RÀNG (ĐẢM BẢO 100% USER GESTURE CHO CHROME) */}
            <button
              type="button"
              onClick={() => startWebNfcScan()}
              disabled={isLoading || isSuccess || nfcStatus === 'scanning'}
              className={`w-full py-3.5 px-4 rounded-2xl font-bold flex items-center justify-center gap-2.5 shadow-xl active:scale-[0.98] transition-all ${
                nfcStatus === 'scanning'
                  ? 'bg-emerald-600/30 border border-emerald-500/60 text-emerald-300 shadow-emerald-900/20'
                  : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-indigo-600/40 ring-1 ring-white/20'
              }`}
            >
              <Radio className={`w-5 h-5 ${nfcStatus === 'scanning' ? 'animate-spin text-emerald-300' : 'animate-pulse'}`} />
              <span className="text-sm font-semibold tracking-wide">
                {nfcStatus === 'scanning'
                  ? 'ĐANG LẮNG NGHE (ÁP THẺ VÀO LƯNG)...'
                  : 'BẬT ĐẦU ĐỌC QUÉT THẺ'}
              </span>
            </button>


            {/* Nút chuyển sang nhập mã PIN nếu khách quên mang thẻ */}
            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('pin');
                  setErrorMessage('');
                }}
                className="text-xs text-stone-400 hover:text-amber-300 underline underline-offset-4 transition-colors"
              >
                Không mang thẻ? Nhập mã PIN 4 số hoặc 4 số cuối CCCD
              </button>
            </div>
          </div>
        )}

        {/* NỘI DUNG DỰ PHÒNG: BÀN PHÍM PIN CẢM ỨNG (NUMPAD) */}
        {activeTab === 'pin' && !isSuccess && (
          <div>
            {/* 4 Ô chỉ báo mã PIN (● ● ○ ○) */}
            <div className="flex justify-center items-center gap-4 mb-5">
              {[0, 1, 2, 3].map((index) => {
                const isFilled = pin.length > index;
                return (
                  <div
                    key={index}
                    className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full transition-all duration-200 ${
                      isFilled
                        ? 'bg-amber-400 ring-4 ring-amber-500/30 scale-110'
                        : 'bg-stone-800 border-2 border-stone-600'
                    }`}
                  />
                );
              })}
            </div>

            {/* Bàn phím số Numpad cảm ứng (Touch Buttons) */}
            <div className="grid grid-cols-3 gap-2.5 max-w-xs mx-auto">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button
                  key={num}
                  onClick={() => handleKeyPress(String(num))}
                  disabled={isLoading || isSuccess}
                  className="h-12 sm:h-14 rounded-2xl bg-stone-800/90 hover:bg-stone-700/90 active:bg-amber-500/20 active:border-amber-400/50 border border-stone-700/60 text-xl font-semibold text-stone-100 shadow-md active:scale-95 transition-all flex items-center justify-center select-none"
                >
                  {num}
                </button>
              ))}

              {/* Phím Clear/Xóa hết */}
              <button
                onClick={handleClear}
                disabled={isLoading || isSuccess || pin.length === 0}
                className="h-12 sm:h-14 rounded-2xl bg-stone-800/50 hover:bg-stone-700/50 border border-stone-700/40 text-xs font-semibold text-stone-400 hover:text-white uppercase tracking-wider active:scale-95 transition-all flex items-center justify-center select-none disabled:opacity-30"
              >
                Xóa
              </button>

              {/* Phím 0 */}
              <button
                onClick={() => handleKeyPress('0')}
                disabled={isLoading || isSuccess}
                className="h-12 sm:h-14 rounded-2xl bg-stone-800/90 hover:bg-stone-700/90 active:bg-amber-500/20 active:border-amber-400/50 border border-stone-700/60 text-xl font-semibold text-stone-100 shadow-md active:scale-95 transition-all flex items-center justify-center select-none"
              >
                0
              </button>

              {/* Phím Backspace */}
              <button
                onClick={handleDelete}
                disabled={isLoading || isSuccess || pin.length === 0}
                className="h-12 sm:h-14 rounded-2xl bg-stone-800/50 hover:bg-stone-700/50 border border-stone-700/40 text-stone-300 hover:text-white active:scale-95 transition-all flex items-center justify-center select-none disabled:opacity-30"
              >
                <Delete className="w-5 h-5" />
              </button>
            </div>

            {/* Quay lại quét thẻ NFC */}
            <div className="text-center mt-4">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('nfc');
                  setErrorMessage('');
                }}
                className="text-xs text-stone-400 hover:text-indigo-300 underline underline-offset-4 transition-colors"
              >
                ← Quay lại chế độ Quét thẻ NFC
              </button>
            </div>
          </div>
        )}

        {/* Chú thích chân modal */}
        <div className="mt-5 text-center">
          <p className="text-[11px] text-stone-400 flex items-center justify-center gap-1.5">
            <Lock className="w-3 h-3 text-stone-400" />
            <span>Xác thực định danh bảo vệ quyền riêng tư phòng khách lưu trú</span>
          </p>
        </div>
      </div>
    </div>
  );
};
