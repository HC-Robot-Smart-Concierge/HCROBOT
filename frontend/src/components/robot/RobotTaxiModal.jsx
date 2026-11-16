import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Car,
  Plane,
  Clock,
  ShieldCheck,
  CheckCircle2,
  Users,
  AlertCircle,
  Navigation,
  Phone,
  PhoneCall,
  UserCheck,
  ArrowLeft,
  Info,
  Mic,
  Edit3,
  Send,
} from 'lucide-react';
import { createTaxiRequest } from '../../services/taxiApi';

export const POPULAR_DESTINATIONS = [
  { id: 'dad', name: 'Sân bay Quốc tế Đà Nẵng (DAD)', desc: '15 phút di chuyển' },
  { id: 'hoian', name: 'Phố cổ Hội An', desc: '40 phút di chuyển' },
  { id: 'banahills', name: 'Bà Nà Hills & Cầu Vàng', desc: '45 phút di chuyển' },
  { id: 'sontra', name: 'Bán đảo Sơn Trà & Chùa Linh Ứng', desc: '20 phút di chuyển' },
  { id: 'mykhe', name: 'Bãi biển Mỹ Khê', desc: '5 phút di chuyển' },
  { id: 'custom', name: 'Điểm đến khác...', desc: 'Nhập địa chỉ tùy chọn' },
];

export const TAXI_PARTNERS = [
  {
    id: 'mailinh',
    name: 'Taxi Mai Linh Đà Nẵng',
    hotline: '0236 3 56 56 56',
    shortCode: '1055',
    color: 'emerald',
    desc: 'Hãng taxi phổ biến nhất, xe có mặt sau 3 đến 5 phút.',
  },
  {
    id: 'vinasun',
    name: 'Taxi Vinasun Đà Nẵng',
    hotline: '0236 3 68 68 68',
    shortCode: null,
    color: 'red',
    desc: 'Đội xe sedan 4 chỗ và SUV 7 chỗ đời mới, phục vụ chuyên nghiệp.',
  },
  {
    id: 'tiensa',
    name: 'Taxi Tiên Sa Đà Nẵng',
    hotline: '0236 3 79 79 79',
    shortCode: null,
    color: 'amber',
    desc: 'Hãng taxi địa phương uy tín, nhận diện xe vàng, phục vụ 24/7.',
  },
  {
    id: 'airport_taxi',
    name: 'Taxi Sân Bay Đà Nẵng',
    hotline: '0236 3 82 82 82',
    shortCode: null,
    color: 'blue',
    desc: 'Chuyên tuyến đưa đón Sân bay Quốc tế Đà Nẵng và tour tham quan.',
  },
];

export const AUTO_CLOSE_SECONDS = 45;
export const CONFIRMED_AUTO_CLOSE_SECONDS = 5;

export function isDismissVoiceIntent(transcript) {
  return /cảm ơn|cám ơn|cam on|thank you|thanks|tắt|tat|đóng|dong|xong rồi|xong roi|được rồi|duoc roi|ok rồi|thôi|thoát|quay lại|close|dismiss/i.test(transcript || '');
}

export function isSelfBookingVoiceIntent(transcript) {
  return /tự đặt|tu dat|tự gọi|tu goi|tự liên hệ|tự book|cho tôi số|cho số|số điện thoại|hotline|option 1|option một|lựa chọn 1|lua chon 1|lựa chọn một|phương án 1|phuong an 1|phương án một|số 1|so 1|số một|thứ nhất|thu nhat|đầu tiên|chọn 1|chon 1|^\s*1\s*$|(?:\b|^)một(?:\b|$)/i.test(transcript || '');
}

export function isConciergeVoiceIntent(transcript) {
  return /nhờ đặt|nho dat|đặt giùm|dat gium|đặt giúp|dat giup|đặt hộ|dat ho|concierge|nhân viên đặt|lễ tân đặt|hỗ trợ đặt|option 2|option hai|lựa chọn 2|lua chon 2|lựa chọn hai|phương án 2|phuong an 2|phương án hai|số 2|so 2|số hai|thứ hai|thu hai|thứ 2|chọn 2|chon 2|^\s*2\s*$|(?:\b|^)hai(?:\b|$)/i.test(transcript || '');
}

export function isConfirmVoiceIntent(transcript) {
  return /đúng rồi|dung roi|chính xác|chinh xac|xác nhận|xac nhan|chuẩn rồi|chuan roi|gửi đi|gui di|gửi yêu cầu|gui yeu cau|đồng ý|dong y|được rồi|duoc roi|ok|okay|yes|correct|confirm/i.test(transcript || '');
}

export function isEditVoiceIntent(transcript) {
  return /chưa đúng|chua dung|không đúng|khong dung|sai rồi|sai roi|sửa lại|sua lai|chỉnh sửa|thay đổi|thay doi|chọn lại|chon lai|sửa|sua|no|edit|change/i.test(transcript || '');
}

export function extractDestinationFromVoice(transcript) {
  if (!transcript || typeof transcript !== 'string') return null;
  const clean = transcript.trim().toLowerCase();
  if (!clean) return null;

  // 1. Phù hợp các địa danh du lịch nổi tiếng Đà Nẵng
  if (/sân bay|airport|dad\b/i.test(clean)) return 'Sân bay Quốc tế Đà Nẵng (DAD)';
  if (/hội an|hoi an|phố cổ|pho co/i.test(clean)) return 'Phố cổ Hội An';
  if (/bà nà|ba na|cầu vàng|cau vang/i.test(clean)) return 'Bà Nà Hills & Cầu Vàng';
  if (/sơn trà|son tra|chùa linh ứng|linh ung/i.test(clean)) return 'Bán đảo Sơn Trà & Chùa Linh Ứng';
  if (/mỹ khê|my khe|bãi biển|bai bien/i.test(clean)) return 'Bãi biển Mỹ Khê';
  if (/cầu rồng|cau rong/i.test(clean)) return 'Cầu Rồng Đà Nẵng';
  if (/chợ hàn|cho han/i.test(clean)) return 'Chợ Hàn Đà Nẵng';
  if (/chợ đêm|cho dem|helio/i.test(clean)) return 'Chợ đêm Helio';
  if (/ngũ hành sơn|ngu hanh son/i.test(clean)) return 'Danh thắng Ngũ Hành Sơn';

  // 2. Nhận diện các cấu trúc câu: "đi [X]", "đến [X]", "tới [X]", "qua [X]", "ra [X]"
  // Giữ nguyên casing gốc từ transcript
  const match = transcript.match(/(?:tôi muốn đi|cho tôi đi|muốn đi|đi đến|đi tới|đi ra|đi|đến|tới|qua|ra)\s+(.+)/i);
  if (match && match[1]) {
    const rawDest = match[1].replace(/[.,?!]+$/, '').trim();
    if (rawDest.length >= 2) {
      return rawDest.charAt(0).toUpperCase() + rawDest.slice(1);
    }
  }

  // 3. Fallback: Nếu không rơi vào các từ phủ định hoặc lệnh hệ thống
  if (!/^(hủy|thôi|không|chào|alo|hello|hi|ok|đúng|sai|option|lựa chọn)/i.test(clean) && clean.length >= 3) {
    return transcript.trim().charAt(0).toUpperCase() + transcript.trim().slice(1);
  }

  return null;
}

export function extractVehicleAndPartyFromVoice(transcript) {
  if (!transcript || typeof transcript !== 'string') return null;
  const clean = transcript.trim().toLowerCase();
  let vehicleType = null;
  let partySize = null;

  // 1. Nhận diện loại xe
  if (/7 chỗ|bảy chỗ|suv|7 cho|bay cho|xe to|xe lớn/i.test(clean)) {
    vehicleType = '7-Seater SUV';
  } else if (/4 chỗ|bốn chỗ|sedan|4 cho|bon cho|xe nhỏ/i.test(clean)) {
    vehicleType = '4-Seater Sedan';
  }

  // 2. Nhận diện số lượng khách (ưu tiên số đi kèm người/khách/pax/vé)
  const partyMatch = clean.match(/(\d+)\s*(?:người|khách|ve|vé|pax|bạn|thành viên|nguoi|khach)/i);
  if (partyMatch && partyMatch[1]) {
    const count = parseInt(partyMatch[1], 10);
    if (count >= 1 && count <= 16) {
      partySize = count;
    }
  } else if (/một người|mình tôi|1 mình|đơn|mot nguoi/i.test(clean)) {
    partySize = 1;
  } else if (/hai người|hai khách|2 người|hai nguoi/i.test(clean)) {
    partySize = 2;
  } else if (/ba người|ba khách|ba nguoi/i.test(clean)) {
    partySize = 3;
  } else if (/bốn người|bốn khách|bon nguoi/i.test(clean)) {
    partySize = 4;
  } else if (/năm người|năm khách|nam nguoi/i.test(clean)) {
    partySize = 5;
  } else if (/sáu người|sáu khách|sau nguoi/i.test(clean)) {
    partySize = 6;
  } else if (/bảy người|bảy khách|bay nguoi/i.test(clean)) {
    partySize = 7;
  } else {
    // Nếu chỉ có số đứng sau "đi X" hoặc "cho X" mà không phải "chỗ"
    const standaloneMatch = clean.match(/(?:đi|cho|đón)\s+(\d+)(?!\s*chỗ|\s*cho)/i);
    if (standaloneMatch && standaloneMatch[1]) {
      const count = parseInt(standaloneMatch[1], 10);
      if (count >= 1 && count <= 16) {
        partySize = count;
      }
    }
  }

  // Nếu khách đi từ 4 người trở lên mà chưa chọn loại xe, gợi ý 7 chỗ
  if (partySize && partySize >= 4 && !vehicleType) {
    vehicleType = '7-Seater SUV';
  } else if (partySize && partySize <= 3 && !vehicleType) {
    vehicleType = '4-Seater Sedan';
  }

  if (!vehicleType && !partySize) return null;
  return { vehicleType, partySize };
}

export function buildTaxiBookingPayload({
  activeRoomNumber,
  destination,
  vehicleType = '4-Seater Sedan',
  partySize = 2,
  note = '',
}) {
  const pickupLocation = activeRoomNumber
    ? `Sảnh chính (Khách Phòng ${activeRoomNumber})`
    : 'Sảnh chính & Cổng trước (Main Lobby)';
  const guestName = activeRoomNumber
    ? `Khách Phòng ${activeRoomNumber}`
    : 'Khách tại Sảnh';

  return {
    room_number: activeRoomNumber,
    guest_name: guestName,
    pickup_location: pickupLocation,
    destination: (destination || '').trim(),
    pickup_time: 'Immediate',
    party_size: Number(partySize) || 2,
    vehicle_type: vehicleType,
    description: (note || '').trim()
      ? `Ghi chú: ${(note || '').trim()} | Phiên phòng: ${activeRoomNumber || 'Lobby'}`
      : `Phiên phòng: ${activeRoomNumber || 'Lobby'} | Xe đón tại sảnh`,
  };
}

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

          {/* VIEW 1: LỰA CHỌN 2 OPTION (FALLBACK NẾU MỞ Ở DẠNG OPTIONS) */}
          {mode === 'options' && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                {/* Option 1: Khách tự gọi xe */}
                <div
                  onClick={handleSelectSelfBooking}
                  className="p-3 rounded-2xl bg-stone-800/80 border border-stone-700 hover:border-amber-500/70 hover:bg-stone-800 transition-all cursor-pointer flex items-start gap-2.5 group active:scale-[0.98]"
                >
                  <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                    <PhoneCall className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Lựa chọn 1</span>
                    <h3 className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors leading-tight">
                      Khách Tự Đặt Xe
                    </h3>
                    <p className="text-[11px] text-stone-400 mt-0.5 leading-snug line-clamp-2">
                      Xem danh bạ hotline các hãng taxi uy tín để tự gọi xe.
                    </p>
                  </div>
                </div>

                {/* Option 2: Nhờ Concierge đặt giùm */}
                <div
                  onClick={handleSelectConciergeBooking}
                  className="p-3 rounded-2xl bg-stone-800/80 border border-stone-700 hover:border-emerald-500/70 hover:bg-stone-800 transition-all cursor-pointer flex items-start gap-2.5 group active:scale-[0.98]"
                >
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Lựa chọn 2</span>
                    <h3 className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors leading-tight">
                      Nhờ Concierge Đặt Giùm
                    </h3>
                    <p className="text-[11px] text-stone-400 mt-0.5 leading-snug line-clamp-2">
                      Điền form cùng Robot, Concierge sẽ đặt xe và đón tại sảnh.
                    </p>
                  </div>
                </div>
              </div>

              <div className="text-center text-[11px] text-stone-400">
                Xác thực: <strong className="text-stone-200">{pickupLocation}</strong> · Quý khách có thể nói <em>&quot;Option 1&quot;</em> hoặc <em>&quot;Option 2&quot;</em>
              </div>
            </div>
          )}

          {/* VIEW 2: HIỂN THỊ SỐ ĐIỆN THOẠI KHÁCH TỰ ĐẶT (ĐẾM LÙI 45S) */}
          {mode === 'self_booking' && (
            <div className="space-y-2">
              {/* Countdown banner */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-[11px] text-amber-200">
                <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0 animate-pulse" />
                <span>
                  Màn hình sẽ tự động đóng sau: <strong className="font-mono text-white text-xs">{countdown}s</strong>
                </span>
              </div>

              {/* Grid danh bạ taxi */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {TAXI_PARTNERS.map((partner) => (
                  <a
                    key={partner.id}
                    href={`tel:${partner.hotline.replace(/\s+/g, '')}`}
                    className="p-2.5 rounded-xl bg-stone-800/80 border border-stone-700 hover:border-amber-500/60 transition-colors flex flex-col gap-1 min-w-0"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Phone className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <h4 className="text-[11px] font-bold text-white truncate">{partner.name}</h4>
                    </div>
                    <span className="text-sm font-mono font-bold text-amber-400 tracking-wide whitespace-nowrap">
                      {partner.hotline}
                    </span>
                    {partner.shortCode ? (
                      <span className="self-start px-1.5 py-0.5 rounded-full bg-stone-700 text-amber-300 font-mono text-[10px] font-bold">
                        Tổng đài {partner.shortCode}
                      </span>
                    ) : (
                      <span className="text-[10px] text-stone-400 truncate">{partner.desc}</span>
                    )}
                  </a>
                ))}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-stone-800">
                <button
                  type="button"
                  onClick={() => setMode('options')}
                  className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 text-[11px] font-semibold cursor-pointer transition-colors"
                >
                  Chọn hình thức khác
                </button>
                <button
                  type="button"
                  onClick={handleResetAndClose}
                  className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 text-[11px] font-bold cursor-pointer transition-colors"
                >
                  Đóng màn hình
                </button>
              </div>
            </div>
          )}

          {/* VIEW 3A: FORM TRỐNG & GIAO TIẾP VỚI KHÁCH ĐỂ LẤY THÔNG TIN CẦN THIẾT */}
          {mode === 'concierge_booking' && conciergeStage === 'form' && (
            <div className="space-y-2">
              {/* Voice Guidance Banner */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30">
                <Mic className="w-3.5 h-3.5 text-amber-400 animate-pulse shrink-0" />
                <span className="text-[10px] uppercase font-bold tracking-wider text-amber-400 shrink-0">Rora:</span>
                <p className="text-xs font-semibold text-white truncate">
                  {voiceGuidance || 'Quý khách muốn đi đến đâu ạ?'}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-5 gap-2.5">
                {/* Destination selector */}
                <div className="md:col-span-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-300 truncate">
                      1. Điểm đến {selectedDest ? <span className="text-emerald-400 normal-case ml-1">({resolvedDestination})</span> : null}
                    </label>
                    {selectedDest && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDest('');
                          setCustomDest('');
                          setConciergeSubStep('ask_destination');
                        }}
                        className="text-[11px] text-amber-400 hover:underline cursor-pointer shrink-0"
                      >
                        Chọn lại
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    {POPULAR_DESTINATIONS.map((dest) => {
                      const isSelected = selectedDest === dest.name;
                      return (
                        <button
                          key={dest.id}
                          type="button"
                          onClick={() => handleSelectDestinationCard(dest.name)}
                          title={`${dest.name} - ${dest.desc}`}
                          className={`px-2.5 py-1.5 rounded-xl text-left border transition-all cursor-pointer flex items-center gap-1.5 min-w-0 ${isSelected
                            ? 'bg-amber-500/20 border-amber-500 text-white ring-1 ring-amber-500/50'
                            : 'bg-stone-800/60 border-stone-700/60 text-stone-300 hover:bg-stone-800 hover:border-stone-600'
                            }`}
                        >
                          {dest.id === 'dad' ? (
                            <Plane className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          ) : (
                            <Navigation className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                          )}
                          <div className="min-w-0">
                            <span className="block text-[11px] font-bold leading-tight truncate">{dest.name}</span>
                            <span className="block text-[10px] text-stone-400 leading-tight truncate">{dest.desc}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {selectedDest === 'Điểm đến khác...' && (
                    <input
                      type="text"
                      value={customDest}
                      onChange={(e) => setCustomDest(e.target.value)}
                      placeholder="Nhập địa chỉ hoặc điểm đến (vd: Cầu Rồng, Chợ Hàn...)"
                      className="w-full px-3 py-1.5 bg-stone-800 border border-stone-700 rounded-lg text-stone-100 placeholder-stone-500 text-[11px] focus:outline-none focus:border-amber-500 animate-in fade-in"
                    />
                  )}
                </div>

                {/* Vehicle Type & Note */}
                <div className="md:col-span-2 space-y-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-300">
                    2. Loại xe
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { id: '4-Seater Sedan', name: '4 Chỗ Sedan', desc: '1 - 3 khách' },
                      { id: '7-Seater SUV', name: '7 Chỗ SUV', desc: '4 - 6 khách' },
                    ].map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setVehicleType(v.id)}
                        className={`px-2 py-1.5 rounded-xl text-left border transition-all cursor-pointer ${vehicleType === v.id
                          ? 'bg-amber-500/20 border-amber-500 text-white ring-1 ring-amber-500/50'
                          : 'bg-stone-800/60 border-stone-700/60 text-stone-300 hover:bg-stone-800'
                          }`}
                      >
                        <p className="text-[11px] font-bold leading-tight">{v.name}</p>
                        <p className="text-[10px] text-stone-400 leading-tight">{v.desc}</p>
                      </button>
                    ))}
                  </div>

                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Ghi chú (tùy chọn): vd 2 vali lớn..."
                    className="w-full px-2.5 py-1.5 bg-stone-800 border border-stone-700 rounded-lg text-stone-100 placeholder-stone-500 text-[11px] focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-stone-800">
                <button
                  type="button"
                  onClick={() => setMode('options')}
                  disabled={isSubmitting}
                  className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold text-[11px] transition-all cursor-pointer"
                >
                  Quay lại
                </button>
                <button
                  type="button"
                  onClick={handleProceedToReview}
                  disabled={!resolvedDestination || isSubmitting}
                  className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-[11px] transition-all cursor-pointer active:scale-95 flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span>Kiểm tra lại thông tin</span>
                  <ArrowLeft className="w-3.5 h-3.5 rotate-180" />
                </button>
              </div>
            </div>
          )}

          {/* VIEW 3B: BƯỚC KIỂM TRA LẠI THÔNG TIN (REVIEW & CONFIRMATION) */}
          {mode === 'concierge_booking' && conciergeStage === 'review' && (
            <div className="space-y-2 animate-in fade-in">
              {/* Question Banner */}
              <div className="px-3 py-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-center">
                <h3 className="text-xs font-bold text-white">
                  Quý khách vui lòng kiểm tra lại thông tin đặt xe đã đúng chưa ạ?
                </h3>
                <p className="text-[11px] text-stone-300">
                  Nói <strong>&quot;Đúng rồi&quot;</strong> hoặc bấm nút bên dưới để gửi yêu cầu cho Concierge.
                </p>
              </div>

              {/* Review Summary Card */}
              <div className="bg-stone-800/80 border border-stone-700 rounded-xl px-3 py-2 text-[11px] grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                <div className="flex items-center justify-between gap-2 py-0.5 border-b border-stone-700/60">
                  <span className="text-stone-400 shrink-0">Điểm đón:</span>
                  <span className="font-bold text-stone-100 truncate">{pickupLocation}</span>
                </div>
                <div className="flex items-center justify-between gap-2 py-0.5 border-b border-stone-700/60">
                  <span className="text-stone-400 shrink-0">Điểm đến:</span>
                  <span className="font-bold text-amber-400 truncate">{resolvedDestination}</span>
                </div>
                <div className="flex items-center justify-between gap-2 py-0.5 border-b border-stone-700/60">
                  <span className="text-stone-400 shrink-0">Loại xe:</span>
                  <span className="font-bold text-stone-100">
                    {vehicleType === '7-Seater SUV' ? 'Xe 7 Chỗ SUV / Van' : 'Xe 4 Chỗ Sedan'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 py-0.5">
                  <span className="text-stone-400 shrink-0">Thời gian đón:</span>
                  <span className="font-semibold text-emerald-400">Ngay lập tức</span>
                </div>
                {note && (
                  <div className="flex items-center justify-between gap-2 py-0.5">
                    <span className="text-stone-400 shrink-0">Ghi chú:</span>
                    <span className="font-medium text-stone-300 italic truncate">{note}</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-stone-800">
                <button
                  type="button"
                  onClick={() => {
                    setConciergeStage('form');
                    setConciergeSubStep('ask_destination');
                  }}
                  disabled={isSubmitting}
                  className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold text-[11px] transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Chỉnh sửa lại</span>
                </button>

                <button
                  type="button"
                  onClick={handleSubmitConciergeRequest}
                  disabled={isSubmitting}
                  className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold text-[11px] transition-all cursor-pointer active:scale-95 flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'Đang gửi yêu cầu...' : 'Đúng rồi, Gửi yêu cầu'}</span>
                </button>
              </div>
            </div>
          )}

          {/* VIEW 4: THÔNG BÁO CHUYỂN REQUEST CHO CONCIERGE THÀNH CÔNG */}
          {mode === 'concierge_confirmed' && confirmedTicket && (
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-white">Chuyển tiếp yêu cầu thành công</h3>
                  <p className="text-[11px] text-stone-300">
                    Đã gửi đến <strong className="text-emerald-400">Bộ phận Concierge</strong> · Mã yêu cầu:{' '}
                    <span className="text-amber-400 font-mono font-bold">{confirmedTicket.ticketCode}</span>
                  </p>
                </div>
              </div>

              <div className="bg-stone-800/80 border border-stone-700 rounded-xl px-3 py-2 text-[11px] grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                <div className="flex justify-between gap-2 py-0.5 border-b border-stone-700/60">
                  <span className="text-stone-400 shrink-0">Điểm đón:</span>
                  <span className="font-semibold text-stone-200 truncate">{pickupLocation}</span>
                </div>
                <div className="flex justify-between gap-2 py-0.5 border-b border-stone-700/60">
                  <span className="text-stone-400 shrink-0">Điểm đến:</span>
                  <span className="font-semibold text-stone-200 truncate">{confirmedTicket.destination}</span>
                </div>
                <div className="flex justify-between gap-2 py-0.5">
                  <span className="text-stone-400 shrink-0">Loại xe:</span>
                  <span className="font-semibold text-stone-200 truncate">
                    {confirmedTicket.vehicleType === '7-Seater SUV' ? 'Xe 7 Chỗ SUV / Van' : 'Xe 4 Chỗ Sedan'}
                  </span>
                </div>
                <div className="flex justify-between gap-2 py-0.5">
                  <span className="text-stone-400 shrink-0">Xe đến:</span>
                  <span className="font-semibold text-emerald-400">Dự kiến 3 - 5 phút tại sảnh</span>
                </div>
              </div>

              {/* Status Query Hint Banner */}
              <div className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-stone-300 flex items-center gap-2">
                <Info className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>
                  Hỏi Robot <em>&quot;Kiểm tra trạng thái đặt taxi&quot;</em> hoặc <em>&quot;Taxi tới chưa&quot;</em> để cập nhật tiến độ xe đón.
                </span>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-stone-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                  <span>Tự động đóng sau: <strong className="font-mono text-white">{countdown}s</strong></span>
                </span>
                <button
                  type="button"
                  onClick={handleResetAndClose}
                  className="px-5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold text-xs transition-all cursor-pointer active:scale-95"
                >
                  Hoàn tất ({countdown}s)
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RobotTaxiModal;
