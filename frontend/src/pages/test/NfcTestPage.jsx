import React, { useState, useEffect, useRef } from 'react';
import { Radio, CreditCard, CheckCircle2, AlertCircle, RefreshCw, PenTool, ArrowLeft, ShieldCheck, Cpu } from 'lucide-react';
import { verifyRoomNfc } from '../../services/operationsApi';

export const NfcTestPage = () => {
  const [isSupported, setIsSupported] = useState(false);
  const [isSecure, setIsSecure] = useState(true);
  const [scanStatus, setScanStatus] = useState('idle'); // 'idle' | 'scanning' | 'read' | 'error'
  const [writeStatus, setWriteStatus] = useState('idle'); // 'idle' | 'writing' | 'written' | 'error'
  
  const [statusMessage, setStatusMessage] = useState('');
  const [cardDetails, setCardDetails] = useState(null);
  const [backendResult, setBackendResult] = useState(null);
  const [logList, setLogList] = useState([]);
  
  const [textToWrite, setTextToWrite] = useState('401');

  const abortControllerRef = useRef(null);

  const addLog = (msg, type = 'info') => {
    const time = new Date().toLocaleTimeString();
    setLogList((prev) => [{ time, msg, type }, ...prev.slice(0, 30)]);
  };

  useEffect(() => {
    const hasNdef = typeof window !== 'undefined' && 'NDEFReader' in window;
    const isHttps = typeof window !== 'undefined' && (window.location.protocol === 'https:' || window.location.hostname === 'localhost');
    setIsSupported(hasNdef);
    setIsSecure(isHttps);

    addLog(`Kiểm tra NDEFReader: ${hasNdef ? 'HỖ TRỢ' : 'KHÔNG HỖ TRỢ'}`, hasNdef ? 'success' : 'error');
    addLog(`Giao thức HTTPS: ${isHttps ? 'AN TOÀN (HTTPS)' : 'CHƯA BẢO MẬT (HTTP)'}`, isHttps ? 'success' : 'warning');

    return () => {
      if (abortControllerRef.current) {
        try { abortControllerRef.current.abort(); } catch (e) { }
      }
    };
  }, []);

  // 1. KÍCH HOẠT QUÉT THẺ
  const handleStartScan = async () => {
    if (!('NDEFReader' in window)) {
      alert('Trình duyệt này không hỗ trợ Web NFC. Vui lòng mở bằng Google Chrome trên Android.');
      return;
    }

    try {
      if (abortControllerRef.current) {
        try { abortControllerRef.current.abort(); } catch (e) { }
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;
      const ndef = new window.NDEFReader();

      setScanStatus('scanning');
      setStatusMessage('Đầu đọc NFC đang lắng nghe... Hãy áp thẻ vào lưng máy.');
      setCardDetails(null);
      setBackendResult(null);
      addLog('Đã khởi chạy ndef.scan() thành công. Đang chờ thẻ...');

      ndef.onreading = async (event) => {
        addLog(`ĐÃ PHÁT HIỆN THẺ! SerialNumber: ${event.serialNumber || 'Rỗng'}`, 'success');
        
        let ndefText = '';
        const recordsInfo = [];

        if (event.message && event.message.records) {
          for (const rec of event.message.records) {
            recordsInfo.push({ recordType: rec.recordType, mediaType: rec.mediaType });
            try {
              if (rec.recordType === 'text') {
                const decoder = new TextDecoder(rec.encoding || 'utf-8');
                ndefText = decoder.decode(rec.data);
              } else if (rec.recordType === 'url') {
                const decoder = new TextDecoder();
                ndefText = decoder.decode(rec.data);
              }
            } catch (decErr) {
              console.warn('Decode err:', decErr);
            }
          }
        }

        const tagCode = (ndefText || '').trim() || event.serialNumber;
        setCardDetails({
          serialNumber: event.serialNumber,
          ndefText,
          recordsCount: recordsInfo.length,
          recordsInfo,
          tagCode,
        });

        setScanStatus('read');
        setStatusMessage(`Đã đọc xong! tagCode = '${tagCode}'`);
        addLog(`Dữ liệu NDEF Text: '${ndefText}' -> Mã dùng đối chiếu: '${tagCode}'`, 'success');

        // Gửi đối chiếu với Backend Supabase
        try {
          addLog(`Đang gửi '${tagCode}' lên Backend Supabase...`, 'info');
          const res = await verifyRoomNfc(tagCode);
          setBackendResult(res);
          addLog(`Backend phản hồi 200 OK! Phòng: ${res.room_number} (${res.guest_name})`, 'success');
        } catch (apiErr) {
          setBackendResult({ error: apiErr.message });
          addLog(`Backend báo lỗi: ${apiErr.message}`, 'error');
        }
      };

      ndef.onreadingerror = (err) => {
        addLog(`Lỗi đọc thẻ: Thẻ không thể giải mã NDEF hoặc bị dời quá nhanh`, 'warning');
        setStatusMessage('Lỗi đọc: Hãy giữ thẻ áp sát lưng máy yên 1-2 giây.');
      };

      await ndef.scan({ signal: controller.signal });
    } catch (err) {
      console.error('Scan error:', err);
      setScanStatus('error');
      setStatusMessage(`Lỗi quét: ${err.name} - ${err.message}`);
      addLog(`ndef.scan() thất bại: ${err.name}: ${err.message}`, 'error');
    }
  };

  // 2. GHI DỮ LIỆU NDEF VÀO THẺ TRỰC TIẾP TỪ TRÌNH DUYỆT
  const handleWriteTag = async (code) => {
    const value = code || textToWrite;
    if (!value) return;

    if (!('NDEFReader' in window)) {
      alert('Trình duyệt này không hỗ trợ Web NFC.');
      return;
    }

    try {
      setWriteStatus('writing');
      setStatusMessage(`Đang chuẩn bị ghi '${value}' vào thẻ... Hãy chạm thẻ vào lưng máy ngay!`);
      addLog(`Bắt đầu ghi NDEF Text: '${value}'... Chạm thẻ vào máy...`, 'info');

      const ndef = new window.NDEFReader();
      await ndef.write(value);

      setWriteStatus('written');
      setStatusMessage(`GHI THẺ THÀNH CÔNG! Thẻ của bạn hiện chứa mã '${value}'`);
      addLog(`Ghi NDEF '${value}' vào thẻ THÀNH CÔNG 100%!`, 'success');
      alert(`Đã ghi thành công mã '${value}' vào thẻ NFC! Bây giờ bạn có thể bấm nút Quét để thử.`);
    } catch (err) {
      console.error('Write error:', err);
      setWriteStatus('error');
      setStatusMessage(`Lỗi khi ghi thẻ: ${err.name} - ${err.message}`);
      addLog(`Lỗi ghi thẻ: ${err.message}`, 'error');
    }
  };

  return (
    <div className="min-h-screen bg-stone-950 text-white p-4 sm:p-6 font-sans">
      <div className="max-w-2xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-800 pb-4">
          <div className="flex items-center gap-3">
            <a
              href="/robot"
              className="p-2 rounded-xl bg-stone-900 border border-stone-800 hover:bg-stone-800 text-stone-300"
            >
              <ArrowLeft className="w-5 h-5" />
            </a>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-indigo-400 flex items-center gap-2">
                <Radio className="w-6 h-6 animate-pulse" />
                <span>Web NFC Diagnostic & Tester</span>
              </h1>
              <p className="text-xs text-stone-400">Công cụ kiểm tra & ghi thẻ NFC chuyên dụng cho Robot Kiosk</p>
            </div>
          </div>
        </div>

        {/* Môi trường & Hỗ trợ phần cứng */}
        <div className="grid grid-cols-2 gap-3">
          <div className={`p-4 rounded-2xl border ${isSupported ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300' : 'bg-rose-950/30 border-rose-500/40 text-rose-300'}`}>
            <div className="flex items-center gap-2 font-semibold text-sm">
              <Cpu className="w-4 h-4" />
              <span>Web NFC API: {isSupported ? 'Được hỗ trợ' : 'Không hỗ trợ'}</span>
            </div>
            <p className="text-[11px] text-stone-400 mt-1">
              {isSupported ? 'window.NDEFReader khả dụng trên trình duyệt' : 'Cần dùng Chrome trên điện thoại Android'}
            </p>
          </div>

          <div className={`p-4 rounded-2xl border ${isSecure ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300' : 'bg-amber-950/30 border-amber-500/40 text-amber-300'}`}>
            <div className="flex items-center gap-2 font-semibold text-sm">
              <ShieldCheck className="w-4 h-4" />
              <span>HTTPS: {isSecure ? 'Đã bật' : 'Chưa bật'}</span>
            </div>
            <p className="text-[11px] text-stone-400 mt-1">
              {isSecure ? 'Đủ điều kiện bảo mật để quét thẻ' : 'Yêu cầu HTTPS để Web NFC hoạt động'}
            </p>
          </div>
        </div>

        {/* KHU VỰC 1: BẬT QUÉT THẺ */}
        <div className="p-6 rounded-3xl bg-stone-900/90 border border-indigo-500/30 shadow-xl space-y-4">
          <h2 className="text-base font-bold text-stone-200 flex items-center gap-2">
            <Radio className="w-5 h-5 text-indigo-400" />
            <span>1. Thử Nghiệm Quét Thẻ (Scan Tag)</span>
          </h2>

          <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-stone-950/60 border border-stone-800 text-center">
            <button
              onClick={handleStartScan}
              disabled={scanStatus === 'scanning'}
              className="px-6 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition-all disabled:opacity-50"
            >
              {scanStatus === 'scanning' ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>ĐANG LẮNG NGHE... CHẠM THẺ VÀO LƯNG MÁY</span>
                </>
              ) : (
                <>
                  <Radio className="w-5 h-5" />
                  <span>BẤM VÀO ĐÂY ĐỂ BẬT ĐẦU ĐỌC QUÉT THẺ</span>
                </>
              )}
            </button>

            {statusMessage && (
              <p className="mt-4 text-xs font-medium text-amber-300">{statusMessage}</p>
            )}
          </div>

          {/* Dữ liệu thẻ đọc được */}
          {cardDetails && (
            <div className="p-4 rounded-2xl bg-stone-800/80 border border-stone-700 space-y-2 text-xs">
              <div className="font-bold text-stone-200 text-sm border-b border-stone-700 pb-1.5 flex items-center justify-between">
                <span>Dữ Liệu Thẻ Vừa Bắt Được:</span>
                <span className="text-emerald-400 font-mono">{cardDetails.tagCode}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-stone-300">
                <div>UID phần cứng: <span className="font-mono text-indigo-300">{cardDetails.serialNumber || 'Không có'}</span></div>
                <div>Nội dung NDEF Text: <span className="font-mono text-amber-300">{cardDetails.ndefText || '(Rỗng)'}</span></div>
                <div>Số lượng bản ghi: <span className="text-white">{cardDetails.recordsCount}</span></div>
                <div>Mã dùng đối chiếu: <span className="font-mono text-emerald-300 font-bold">{cardDetails.tagCode}</span></div>
              </div>
            </div>
          )}

          {/* Kết quả đối chiếu với Supabase */}
          {backendResult && (
            <div className={`p-4 rounded-2xl border text-xs ${backendResult.verified ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200' : 'bg-rose-950/40 border-rose-500/50 text-rose-200'}`}>
              <div className="font-bold text-sm mb-1 flex items-center gap-2">
                {backendResult.verified ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-rose-400" />}
                <span>{backendResult.verified ? 'XÁC THỰC THÀNH CÔNG VỚI SUPABASE!' : 'THẤT BẠI KHI ĐỐI CHIẾU'}</span>
              </div>
              {backendResult.verified ? (
                <div>
                  <p>Phòng: <strong>{backendResult.room_number}</strong> | Khách: <strong>{backendResult.guest_name}</strong></p>
                  <p>Mã Ticket vừa tạo: <span className="font-mono text-amber-300">#{backendResult.ticket_code}</span></p>
                </div>
              ) : (
                <p>Chi tiết lỗi: {backendResult.error}</p>
              )}
            </div>
          )}
        </div>

        {/* KHU VỰC 2: GHI THẺ NDEF TRỰC TIẾP TỪ WEB */}
        <div className="p-6 rounded-3xl bg-stone-900/90 border border-stone-800 space-y-4">
          <h2 className="text-base font-bold text-stone-200 flex items-center gap-2">
            <PenTool className="w-5 h-5 text-amber-400" />
            <span>2. Ghi Dữ Liệu NDEF Vào Thẻ Trực Tiếp Từ Trình Duyệt</span>
          </h2>
          <p className="text-xs text-stone-400">
            Nếu thẻ của bạn là thẻ trắng chưa có NDEF, bạn có thể bấm 1 trong 2 nút dưới đây để biến nó thành thẻ phòng 401 hoặc 305 ngay lập tức mà không cần dùng app NFC Tools:
          </p>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleWriteTag('401')}
              disabled={writeStatus === 'writing'}
              className="p-3.5 rounded-2xl bg-indigo-900/40 hover:bg-indigo-900/70 border border-indigo-500/40 text-left active:scale-95 transition-all"
            >
              <div className="font-bold text-xs text-indigo-200">Ghi Mã '401' Vào Thẻ</div>
              <div className="text-[10px] text-stone-400 mt-1">Dành cho Phòng 401 (Lê Văn C)</div>
            </button>

            <button
              onClick={() => handleWriteTag('305')}
              disabled={writeStatus === 'writing'}
              className="p-3.5 rounded-2xl bg-amber-900/40 hover:bg-amber-900/70 border border-amber-500/40 text-left active:scale-95 transition-all"
            >
              <div className="font-bold text-xs text-amber-200">Ghi Mã '305' Vào Thẻ</div>
              <div className="text-[10px] text-stone-400 mt-1">Dành cho Phòng 305 (Nguyễn Văn A)</div>
            </button>
          </div>
        </div>

        {/* KHU VỰC 3: NHẬT KÝ SỰ KIỆN (EVENT LOGS) */}
        <div className="p-5 rounded-3xl bg-stone-900/60 border border-stone-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-stone-400">
            <span className="font-bold text-stone-300">Nhật Ký Sự Kiện Trình Duyệt (Console Logs):</span>
            <button onClick={() => setLogList([])} className="hover:text-white">Xóa log</button>
          </div>
          <div className="p-3 rounded-xl bg-black/60 font-mono text-[11px] h-40 overflow-y-auto space-y-1">
            {logList.length === 0 ? (
              <span className="text-stone-600">Chưa có sự kiện nào. Hãy bấm Bật Đầu Đọc Quét Thẻ...</span>
            ) : (
              logList.map((l, idx) => (
                <div key={idx} className={l.type === 'success' ? 'text-emerald-400' : l.type === 'error' ? 'text-rose-400' : l.type === 'warning' ? 'text-amber-400' : 'text-stone-300'}>
                  <span className="text-stone-500">[{l.time}]</span> {l.msg}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Link tham khảo Web NFC của Google */}
        <div className="text-center pt-2">
          <a
            href="https://googlechrome.github.io/samples/web-nfc/"
            target="_blank"
            rel="noreferrer"
            className="text-xs text-indigo-400 hover:underline"
          >
            🔗 Xem trang mẫu Web NFC chính thức của Google Chrome Team
          </a>
        </div>
      </div>
    </div>
  );
};
