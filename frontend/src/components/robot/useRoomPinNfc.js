import { useState, useEffect, useCallback, useRef } from 'react';
import { verifyRoomNfc } from '../../services/operationsApi';

export const useRoomPinNfc = ({
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
}) => {
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
              (skipTicketCreation || ["taxi", "book_taxi", "taxi_booking", "query_order_status", "query_service_status", "query_taxi_status"].includes(pendingAction))
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
          (skipTicketCreation || ["taxi", "book_taxi", "taxi_booking", "query_order_status", "query_service_status", "query_taxi_status"].includes(pendingAction)),
          sessionId
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
      setNfcStatus('idle');
      setNfcStatusMsg('');
    } else if (nfcAbortControllerRef.current) {
      try { nfcAbortControllerRef.current.abort(); } catch (e) {}
      nfcAbortControllerRef.current = null;
    }
    return () => {
      if (nfcAbortControllerRef.current) {
        try { nfcAbortControllerRef.current.abort(); } catch (e) {}
        nfcAbortControllerRef.current = null;
      }
    };
  }, [isOpen]);

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

  return {
    nfcStatus,
    nfcStatusMsg,
    startWebNfcScan,
    handleVerifyNfc,
  };
};
