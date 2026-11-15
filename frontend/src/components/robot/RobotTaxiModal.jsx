import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Car,
  ShieldCheck,
  AlertCircle,
  ArrowLeft,
} from 'lucide-react';
import { createTaxiRequest } from '../../services/taxiApi';
import {
  AUTO_CLOSE_SECONDS,
  CONFIRMED_AUTO_CLOSE_SECONDS,
  isDismissVoiceIntent,
  isSelfBookingVoiceIntent,
  isConciergeVoiceIntent,
  isConfirmVoiceIntent,
  isEditVoiceIntent,
  extractDestinationFromVoice,
  extractVehicleAndPartyFromVoice,
  buildTaxiBookingPayload,
} from './robotTaxiUtils';
import { RobotTaxiViews } from './RobotTaxiViews';

export * from './robotTaxiUtils';

export const RobotTaxiModal = ({
  isOpen,
  onClose,
  activeRoomNumber = null,
  initialMode = 'self_booking',
  lastVoiceTranscript = '',
  onSuccess,
  speak,
  onStartTalk,
}) => {
  const [mode, setMode] = useState(initialMode);
  const [conciergeStage, setConciergeStage] = useState('form'); // 'form' | 'review'
  const [conciergeSubStep, setConciergeSubStep] = useState('ask_destination'); // 'ask_destination' | 'ask_vehicle'
  const [countdown, setCountdown] = useState(AUTO_CLOSE_SECONDS);
  const [selectedDest, setSelectedDest] = useState('');
  const [customDest, setCustomDest] = useState('');
  const [vehicleType, setVehicleType] = useState('4-Seater Sedan');
  const [partySize, setPartySize] = useState(2);
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [confirmedTicket, setConfirmedTicket] = useState(null);
  const [voiceGuidance, setVoiceGuidance] = useState('');

  const countdownTimerRef = useRef(null);
  const lastProcessedTranscriptRef = useRef('');

  // Đồng bộ mode khi modal mở lên
  useEffect(() => {
    if (isOpen) {
      const startMode = initialMode || 'self_booking';
      setMode(startMode);
      setCountdown(AUTO_CLOSE_SECONDS);
      setErrorMsg('');
      setConfirmedTicket(null);
      lastProcessedTranscriptRef.current = '';

      if (startMode === 'concierge_booking') {
        setSelectedDest('');
        setCustomDest('');
        setVehicleType('4-Seater Sedan');
        setPartySize(2);
        setNote('');
        setConciergeStage('form');
        setConciergeSubStep('ask_destination');
        const promptMsg = 'Dạ, quý khách muốn đi đến đâu ạ?';
        setVoiceGuidance(promptMsg);
        if (typeof speak === 'function') {
          speak(promptMsg, 'vi-VN', () => {
            if (typeof onStartTalk === 'function') onStartTalk();
          });
        }
      } else if (startMode === 'self_booking') {
        setVoiceGuidance('Danh bạ hotline các hãng taxi đối tác uy tín');
      }
    } else {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
    }
  }, [isOpen, initialMode]);

  // Bộ đếm lùi 45s cho màn hình khách tự đặt xe và 5s cho màn hình hoàn tất đặt xe
  useEffect(() => {
    if (isOpen && (mode === 'self_booking' || mode === 'concierge_confirmed')) {
      const initialSeconds = mode === 'concierge_confirmed' ? CONFIRMED_AUTO_CLOSE_SECONDS : AUTO_CLOSE_SECONDS;
      setCountdown(initialSeconds);
      countdownTimerRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
            if (typeof onClose === 'function') {
              onClose();
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
    }

    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
    };
  }, [isOpen, mode, onClose]);

  // Xử lý tương tác giọng nói trong các chế độ
  useEffect(() => {
    if (!isOpen || !lastVoiceTranscript) return;

    const transcriptLower = lastVoiceTranscript.toLowerCase().trim();
    if (!transcriptLower || transcriptLower === lastProcessedTranscriptRef.current) return;
    lastProcessedTranscriptRef.current = transcriptLower;

    // 1. Chế độ khách tự gọi xe (Self booking) hoặc đã xác nhận Concierge -> đóng khi nói cảm ơn / tắt
    if (mode === 'self_booking' || mode === 'concierge_confirmed') {
      if (isDismissVoiceIntent(transcriptLower)) {
        if (typeof onClose === 'function') {
          onClose();
        }
      }
      return;
    }

    // 2. Chế độ lựa chọn ban đầu (options) -> chọn option 1 hoặc option 2
    if (mode === 'options') {
      if (isSelfBookingVoiceIntent(transcriptLower)) {
        handleSelectSelfBooking();
      } else if (isConciergeVoiceIntent(transcriptLower)) {
        handleSelectConciergeBooking();
      } else if (isDismissVoiceIntent(transcriptLower)) {
        if (typeof onClose === 'function') {
          onClose();
        }
      }
      return;
    }

    // 3. Chế độ nhờ Concierge đặt giùm (concierge_booking)
    if (mode === 'concierge_booking') {
      if (conciergeStage === 'form') {
        if (conciergeSubStep === 'ask_destination') {
          const foundDest = extractDestinationFromVoice(transcriptLower);
          const vehicleInfo = extractVehicleAndPartyFromVoice(transcriptLower);

          if (foundDest && vehicleInfo) {
            // Khách nói trọn vẹn cả điểm đến và loại xe / số khách trong 1 câu
            setSelectedDest(foundDest);
            if (vehicleInfo.vehicleType) setVehicleType(vehicleInfo.vehicleType);
            if (vehicleInfo.partySize) setPartySize(vehicleInfo.partySize);

            setConciergeStage('review');
            const vLabel = (vehicleInfo.vehicleType || vehicleType) === '7-Seater SUV' ? 'xe 7 chỗ' : 'xe 4 chỗ';
            const reviewMsg = `Dạ em đã ghi nhận thông tin đặt xe đi ${foundDest}, ${vLabel}. Quý khách vui lòng kiểm tra lại thông tin trên màn hình đã đúng chưa ạ?`;
            setVoiceGuidance(reviewMsg);
            if (typeof speak === 'function') {
              speak(reviewMsg, 'vi-VN', () => {
                if (typeof onStartTalk === 'function') onStartTalk({ silent: true });
              });
            }
          } else if (foundDest) {
            // Khách trả lời điểm đến -> Lưu điểm đến và hỏi tiếp loại xe
            setSelectedDest(foundDest);
            setConciergeSubStep('ask_vehicle');
            const askVehicleMsg = `Dạ điểm đến là ${foundDest}. Quý khách muốn đặt xe 4 chỗ hay 7 chỗ ạ?`;
            setVoiceGuidance(askVehicleMsg);
            if (typeof speak === 'function') {
              speak(askVehicleMsg, 'vi-VN', () => {
                if (typeof onStartTalk === 'function') onStartTalk({ silent: true });
              });
            }
          }
        } else if (conciergeSubStep === 'ask_vehicle') {
          const vehicleInfo = extractVehicleAndPartyFromVoice(transcriptLower);
          if (vehicleInfo) {
            const nextVehicle = vehicleInfo.vehicleType || vehicleType;
            if (vehicleInfo.vehicleType) setVehicleType(vehicleInfo.vehicleType);
            if (vehicleInfo.partySize) setPartySize(vehicleInfo.partySize);

            setConciergeStage('review');
            const currentDest = selectedDest === 'Điểm đến khác...' ? customDest.trim() : selectedDest;
            const vLabel = nextVehicle === '7-Seater SUV' ? 'xe 7 chỗ' : 'xe 4 chỗ';
            const reviewMsg = `Dạ em đã ghi nhận thông tin đặt xe đi ${currentDest || 'điểm đến'}, ${vLabel}. Quý khách vui lòng kiểm tra lại thông tin trên màn hình đã đúng chưa ạ?`;
            setVoiceGuidance(reviewMsg);
            if (typeof speak === 'function') {
              speak(reviewMsg, 'vi-VN', () => {
                if (typeof onStartTalk === 'function') onStartTalk({ silent: true });
              });
            }
          }
        }
      } else if (conciergeStage === 'review') {
        // Khách đang ở bước kiểm tra lại thông tin
        if (isConfirmVoiceIntent(transcriptLower)) {
          handleSubmitConciergeRequest();
        } else if (isEditVoiceIntent(transcriptLower)) {
          setConciergeStage('form');
          setConciergeSubStep('ask_destination');
          const editMsg = 'Dạ quý khách muốn thay đổi thông tin nào ạ? Quý khách có thể nói lại điểm đến hoặc loại xe mới ạ.';
          setVoiceGuidance(editMsg);
          if (typeof speak === 'function') {
            speak(editMsg, 'vi-VN', () => {
              if (typeof onStartTalk === 'function') onStartTalk();
            });
          }
        }
      }
    }
  }, [
    isOpen,
    mode,
    conciergeStage,
    conciergeSubStep,
    lastVoiceTranscript,
    selectedDest,
    customDest,
    vehicleType,
    partySize,
    speak,
    onClose,
    onStartTalk,
  ]);

  if (!isOpen) return null;

  const resolvedDestination = selectedDest === 'Điểm đến khác...' ? customDest.trim() : selectedDest;
  const pickupLocation = activeRoomNumber
    ? `Sảnh chính (Khách Phòng ${activeRoomNumber})`
    : 'Sảnh chính & Cổng trước (Main Lobby)';

  const handleSelectSelfBooking = () => {
    setMode('self_booking');
    const msg = 'Dạ, đây là danh bạ hotline các hãng taxi uy tín tại Đà Nẵng ạ.';
    setVoiceGuidance(msg);
    if (typeof speak === 'function') {
      speak(msg, 'vi-VN', () => {
        if (typeof onStartTalk === 'function') onStartTalk({ silent: true });
      });
    }
  };

  const handleSelectConciergeBooking = () => {
    setMode('concierge_booking');
    setSelectedDest('');
    setCustomDest('');
    setVehicleType('4-Seater Sedan');
    setPartySize(2);
    setNote('');
    setConciergeStage('form');
    setConciergeSubStep('ask_destination');
    const promptMsg = 'Dạ, quý khách muốn đi đến đâu ạ?';
    setVoiceGuidance(promptMsg);
    if (typeof speak === 'function') {
      speak(promptMsg, 'vi-VN', () => {
        if (typeof onStartTalk === 'function') onStartTalk();
      });
    }
  };

  const handleSelectDestinationCard = (destName) => {
    setSelectedDest(destName);
    if (conciergeSubStep === 'ask_destination') {
      setConciergeSubStep('ask_vehicle');
      const askVehicleMsg = `Dạ điểm đến là ${destName}. Quý khách muốn đặt xe 4 chỗ hay 7 chỗ ạ?`;
      setVoiceGuidance(askVehicleMsg);
      if (typeof speak === 'function') {
        speak(askVehicleMsg, 'vi-VN', () => {
          if (typeof onStartTalk === 'function') onStartTalk({ silent: true });
        });
      }
    }
  };

  const handleProceedToReview = () => {
    const targetDest = selectedDest === 'Điểm đến khác...' ? customDest.trim() : selectedDest;
    if (!targetDest) {
      setErrorMsg('Vui lòng chọn hoặc nhập điểm đến của quý khách.');
      return;
    }
    setErrorMsg('');
    setConciergeStage('review');
    const vLabel = vehicleType === '7-Seater SUV' ? 'xe 7 chỗ' : 'xe 4 chỗ';
    const reviewMsg = `Dạ em đã ghi nhận thông tin đặt xe đi ${targetDest}, ${vLabel}. Quý khách vui lòng kiểm tra lại thông tin trên màn hình đã đúng chưa ạ?`;
    setVoiceGuidance(reviewMsg);
    if (typeof speak === 'function') {
      speak(reviewMsg, 'vi-VN', () => {
        if (typeof onStartTalk === 'function') onStartTalk({ silent: true });
      });
    }
  };

  const handleSubmitConciergeRequest = async (e) => {
    if (e) e.preventDefault();
    const finalDest = selectedDest === 'Điểm đến khác...' ? customDest.trim() : selectedDest;
    if (!finalDest) {
      setErrorMsg('Vui lòng chọn hoặc nhập điểm đến của quý khách.');
      setConciergeStage('form');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const payload = buildTaxiBookingPayload({
        activeRoomNumber,
        destination: finalDest,
        vehicleType,
        partySize,
        note,
      });

      const res = await createTaxiRequest(payload);
      const ticketCode = res?.ticket_code || `TX-${Math.floor(10000 + Math.random() * 90000)}`;

      setConfirmedTicket({
        ticketCode,
        destination: finalDest,
        vehicleType,
        partySize,
        roomNumber: activeRoomNumber,
      });
      setMode('concierge_confirmed');

      const roomText = activeRoomNumber ? `phòng ${activeRoomNumber}` : 'quý khách';
      if (typeof speak === 'function') {
        speak(`Dạ em đã chuyển tiếp yêu cầu đặt taxi của ${roomText} đến bộ phận Concierge ạ.`);
      }

      if (typeof onSuccess === 'function') {
        onSuccess(res || { ticket_code: ticketCode });
      }
    } catch (err) {
      setErrorMsg('Không thể gửi yêu cầu gọi xe. Quý khách vui lòng thử lại hoặc liên hệ Lễ tân.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetAndClose = () => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setConfirmedTicket(null);
    setErrorMsg('');
    setMode('options');
    setConciergeStage('form');
    setConciergeSubStep('ask_destination');
    onClose();
  };

  return (
    <div
      onClick={handleResetAndClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-2 bg-black/85 backdrop-blur-md animate-in fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl bg-stone-900 border border-stone-700/80 rounded-2xl shadow-2xl px-3 py-2.5 sm:px-4 sm:py-3 text-stone-100 flex flex-col max-h-[calc(100dvh-1rem)] overflow-hidden"
      >
        {/* Header (gọn 1 dòng) */}
        <div className="flex items-center justify-between gap-2 pb-2 border-b border-stone-800 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {mode !== 'options' && !confirmedTicket && (
              <button
                type="button"
                onClick={() => {
                  if (mode === 'concierge_booking' && conciergeStage === 'review') {
                    setConciergeStage('form');
                  } else {
                    setMode('options');
                  }
                }}
                className="w-7 h-7 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-white flex items-center justify-center transition-all cursor-pointer shrink-0"
                aria-label="Quay lại"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <Car className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm font-bold text-white tracking-wide whitespace-nowrap">Đặt Xe &amp; Taxi Sảnh</h2>
                {activeRoomNumber && (
                  <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-[10px] border border-emerald-500/40 inline-flex items-center gap-1 whitespace-nowrap">
                    <ShieldCheck className="w-3 h-3" />
                    Phòng {activeRoomNumber}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-stone-400 truncate">
                {mode === 'options' && 'Vui lòng chọn hình thức đặt xe thuận tiện cho quý khách'}
                {mode === 'self_booking' && 'Danh bạ hotline các hãng taxi đối tác uy tín'}
                {mode === 'concierge_booking' && (conciergeStage === 'review' ? 'Kiểm tra lại thông tin trước khi gửi Concierge' : 'Giao tiếp giọng nói hoặc chạm để điền thông tin')}
                {mode === 'concierge_confirmed' && 'Yêu cầu đặt xe đã được chuyển tiếp thành công'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleResetAndClose}
            className="w-7 h-7 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-white flex items-center justify-center transition-all cursor-pointer shrink-0"
            aria-label="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 min-h-0 overflow-y-auto pt-2 space-y-2">
          {errorMsg && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-[11px]">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <RobotTaxiViews
            mode={mode}
            setMode={setMode}
            conciergeStage={conciergeStage}
            setConciergeStage={setConciergeStage}
            setConciergeSubStep={setConciergeSubStep}
            countdown={countdown}
            selectedDest={selectedDest}
            setSelectedDest={setSelectedDest}
            customDest={customDest}
            setCustomDest={setCustomDest}
            vehicleType={vehicleType}
            setVehicleType={setVehicleType}
            note={note}
            setNote={setNote}
            isSubmitting={isSubmitting}
            confirmedTicket={confirmedTicket}
            voiceGuidance={voiceGuidance}
            handleSelectSelfBooking={handleSelectSelfBooking}
            handleSelectConciergeBooking={handleSelectConciergeBooking}
            handleSelectDestinationCard={handleSelectDestinationCard}
            handleProceedToReview={handleProceedToReview}
            handleSubmitConciergeRequest={handleSubmitConciergeRequest}
            handleResetAndClose={handleResetAndClose}
            resolvedDestination={resolvedDestination}
            pickupLocation={pickupLocation}
          />
        </div>
      </div>
    </div>
  );
};

export default RobotTaxiModal;
