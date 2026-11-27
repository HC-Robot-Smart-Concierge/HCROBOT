import React, { useState, useEffect, useRef } from 'react';
import { X, Car, ShieldCheck, CheckCircle2, AlertCircle, Phone, UserCheck, Mic, Send, Users } from 'lucide-react';
import { createTaxiRequest } from '../../services/taxiApi';
import { extractTaxiRequirements, taxiAssistanceReplyKind, buildTaxiBookingPayload, taxiVehicleLabel, normalizeTaxiSpeech, TAXI_PARTNERS } from '../../utils/taxiAssistance';
export { buildTaxiBookingPayload, TAXI_PARTNERS } from '../../utils/taxiAssistance';

export function getTaxiOptionsPrompt(room, isEn = false) {
  const intro = room ? (isEn ? `Room ${room} is verified. ` : `Dạ phòng ${room} đã được xác thực. `) : '';
  return intro + (isEn
    ? 'You have two options: option one, call a taxi company yourself; option two, ask our staff to arrange a taxi. Which would you prefer?'
    : 'Quý khách có hai lựa chọn: lựa chọn một, tự gọi cho hãng taxi; lựa chọn hai, nhờ nhân viên đặt xe giúp. Quý khách muốn chọn cách nào ạ?');
}

export const AUTO_CLOSE_SECONDS = 45;
export const CONFIRMED_AUTO_CLOSE_SECONDS = 5;

export function startAutoCloseTimer({ durationSeconds, onTick, onExpire }) {
  const safeSeconds = Math.max(1, Number(durationSeconds) || 1);
  const closeAt = Date.now() + safeSeconds * 1000;
  let stopped = false;
  let intervalId = null;
  let timeoutId = null;

  const cleanup = () => {
    stopped = true;
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };

  const expireOnce = () => {
    if (stopped) return;
    cleanup();
    if (typeof onTick === 'function') onTick(0);
    if (typeof onExpire === 'function') onExpire();
  };

  if (typeof onTick === 'function') onTick(safeSeconds);
  timeoutId = setTimeout(expireOnce, safeSeconds * 1000);
  intervalId = setInterval(() => {
    const remainingMs = closeAt - Date.now();
    if (remainingMs <= 0) {
      expireOnce();
      return;
    }
    if (typeof onTick === 'function') {
      onTick(Math.ceil(remainingMs / 1000));
    }
  }, 500);

  return cleanup;
}

export function getTaxiSelfBookingAnnouncement(isEn = false) {
  return isEn
    ? 'Here is the directory of trusted taxi hotlines in Da Nang. This screen will turn off automatically after 45 seconds or when you say thank you.'
    : 'Dạ, đây là danh bạ số điện thoại các hãng taxi uy tín tại Đà Nẵng. Màn hình sẽ tự tắt sau 45 giây hoặc khi quý khách nói cảm ơn ạ.';
}

export function getTaxiSelfBookingNotice(isEn = false) {
  return isEn
    ? 'This screen will turn off automatically after 45 seconds or when you say "Thank you".'
    : 'Màn hình sẽ tự tắt sau 45 giây hoặc khi quý khách nói "Cảm ơn".';
}

export function getTaxiCloseFollowUpMessage({ justBooked = false, closeReason = 'manual', isEn = false } = {}) {
  if (justBooked && closeReason === 'voice_dismiss') {
    return null;
  }
  if (justBooked) {
    return isEn
      ? 'Your taxi request has been sent to Concierge! How may I assist you further?'
      : 'Dạ yêu cầu đặt xe taxi của quý khách đã được chuyển tới bộ phận hỗ trợ đặt xe rồi ạ! Em có thể hỗ trợ thêm gì cho quý khách nữa không ạ?';
  }
  if (closeReason === 'voice_dismiss') {
    return isEn
      ? 'You are welcome! How may I assist you further?'
      : 'Dạ vâng, em có thể hỗ trợ gì thêm cho quý khách ạ?';
  }
  if (closeReason === 'auto') {
    return isEn
      ? 'How may I assist you further?'
      : 'Dạ vâng, em có thể hỗ trợ gì thêm cho quý khách ạ?';
  }
  return null;
}

export function isDismissVoiceIntent(transcript) {
  return /cảm ơn|cám ơn|cam on|thank you|thanks|không cần(?: gì| nữa)?|khong can(?: gi| nua)?|không còn(?: gì)?(?: cần)? hỗ trợ|nothing else|no thanks|tắt|tat|đóng|dong|xong rồi|xong roi|được rồi|duoc roi|ok rồi|thôi|thoát|quay lại|close|dismiss/i.test(String(transcript || '').normalize('NFC'));
}

export function isSelfBookingVoiceIntent(transcript) {
  const clean = normalizeTaxiSpeech(transcript).replace(/[.!?,]+$/g, '');
  if (!clean) return false;
  if (/\bkhong\s+(?:muon\s+|can\s+)?tu\s+(?:goi|dat|lien he|book)\b/.test(clean)) return false;

  const negatesStaff = /\bkhong\s+(?:muon\s+|can\s+)?(?:nho\s+)?(?:nhan vien|le tan|concierge|staff)\b/.test(clean);
  const mentionsStaff = /\b(nho\s+(?:nhan vien|le tan|dat|goi|book)|nhan vien|le tan|concierge|staff|(?:dat|goi|book)\s+(?:xe\s+|taxi\s+)?(?:gium|dum|giup|ho)|for me)\b/.test(clean);
  if (mentionsStaff && !negatesStaff) return false;

  return /\b(tu dat|tu goi|tu lien he|tu book|tu alo|goi truc tiep|(?:de|cho)\s+(?:toi|minh|anh|chi|em)\s+(?:tu\s+)?goi|cho\s+(?:toi\s+|minh\s+|anh\s+|chi\s+|em\s+)?(?:xin\s+|xem\s+)?(?:so|danh ba|bang so)|lay so|so dien thoai|so taxi|so hang|danh ba|hotline|first option|first one|first choice|call (?:it |a taxi |the taxi |them )?myself|book (?:it |a taxi )?myself|i(?:'ll| will) call|let me call|self[- ]?(?:book|booking|call)|taxi numbers?|phone numbers?|thu nhat|dau tien)\b/.test(clean)
    || /\b(?:option|choice|method|way|number|lua chon|phuong an|cach|chon|cai|so|muc)\s+(?:so\s+|thu\s+|cach\s+|cai\s+)?(?:1|one|mot|nhat|dau|dau tien)\b(?!\s*(?:nguoi|khach|cho|vali|kien|chiec|bag|seat|passenger|person|people|pax))/.test(clean)
    || /^(?:da|vang|u|uh|ok|okay|toi|minh|anh|chi|em|cho toi|cho minh)?\s*(?:chon|lay)?\s*(?:1|one|mot)(?:\s+(?:di|nhe|nha|a|thoi|please))?$/.test(clean);
}

export function isConciergeVoiceIntent(transcript) {
  const clean = normalizeTaxiSpeech(transcript).replace(/[.!?,]+$/g, '');
  if (!clean) return false;
  if (/\bkhong\s+(?:muon\s+|can\s+)?(?:nho\s+)?(?:nhan vien|le tan|concierge|staff)\b/.test(clean)) return false;
  if (/\btu\s+(?:goi|dat|lien he|book)\b/.test(clean) && !/\bkhong\s+(?:muon\s+|can\s+)?tu\s+(?:goi|dat|lien he|book)\b/.test(clean)) {
    return false;
  }

  return /\b(nho\s+(?:nhan vien|le tan|ben khach san|khach san|cac ban|nguoi|em|ban|dat|goi|book)|(?:de|cho)\s+(?:nhan vien|le tan)|nhan vien|le tan|concierge|ho tro\s+(?:dat|goi)|(?:dat|goi|book)\s+(?:xe\s+|taxi\s+)?(?:gium|dum|giup|ho)|second option|second one|second choice|(?:ask\s+|let\s+|have\s+)?staff(?:\s+(?:to\s+)?(?:book|arrange|call|help|please))?|reception|front desk|(?:book|arrange|call)\s+(?:it\s+|a taxi\s+|one\s+)?for me|help me\s+(?:book|arrange|call)|thu hai|thu 2)\b/.test(clean)
    || /\b(?:option|choice|method|way|number|lua chon|phuong an|cach|chon|cai|so|muc)\s+(?:so\s+|thu\s+|cach\s+|cai\s+)?(?:2|two|hai|sau|cuoi)\b(?!\s*(?:nguoi|khach|cho|vali|kien|chiec|bag|seat|passenger|person|people|pax))/.test(clean)
    || /^(?:da|vang|u|uh|ok|okay|toi|minh|anh|chi|em|cho toi|cho minh)?\s*(?:chon|lay)?\s*(?:2|two|hai)(?:\s+(?:di|nhe|nha|a|thoi|please))?$/.test(clean);
}

export function isConfirmVoiceIntent(transcript) {
  if (isEditVoiceIntent(transcript)) return false;
  return /đúng rồi|dung roi|chính xác|chinh xac|xác nhận|xac nhan|chuẩn rồi|chuan roi|gửi đi|gui di|gửi yêu cầu|gui yeu cau|đồng ý|dong y|được rồi|duoc roi|\b(?:ok|okay|yes|correct|confirm)\b/i.test(transcript || '');
}

export function isEditVoiceIntent(transcript) {
  return /chưa đúng|chua dung|không đúng|khong dung|sai rồi|sai roi|sửa lại|sua lai|chỉnh sửa|thay đổi|thay doi|chọn lại|chon lai|sửa|sua|đừng|chưa xác nhận|không xác nhận|\b(?:no|not|wrong|edit|change)\b|don['’]t|do not/i.test(transcript || '');
}

export const RobotTaxiModal = ({
  isOpen, onClose, activeRoomNumber = null, initialMode = 'self_booking',
  initialRequest = '', language = 'Tiếng Việt', lastVoiceTranscript = '',
  onSuccess, speak, onStartTalk, onStopListening, isListening = false, isRobotSpeaking = false, liveTranscript = '',
}) => {
  const isEn = language === 'English' || language === 'EN';
  const langCode = isEn ? 'en-US' : 'vi-VN';
  const t = (vi, en) => isEn ? en : vi;
  const [mode, setMode] = useState(initialMode);
  const [stage, setStage] = useState('requirements'); // 'requirements' | 'confirm'
  const [requirements, setRequirements] = useState({ partySize: null, vehicleType: null });
  // Ghi chú CHỈ nhận từ bàn phím để tránh STT nghe nhầm câu hội thoại thành yêu cầu của khách
  const [typedNote, setTypedNote] = useState('');
  const [typedRequirements, setTypedRequirements] = useState('');
  const [voiceGuidance, setVoiceGuidance] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmedTicket, setConfirmedTicket] = useState(null);
  const [countdown, setCountdown] = useState(AUTO_CLOSE_SECONDS);
  const submitLockRef = useRef(false);
  const lastProcessedTranscriptRef = useRef('');
  const onCloseRef = useRef(onClose);
  const isOpenRef = useRef(isOpen);
  const requestVersionRef = useRef(0);
  onCloseRef.current = onClose;
  isOpenRef.current = isOpen;

  const describeRequirements = (details = requirements) => {
    const pax = details.partySize
      ? (isEn ? `${details.partySize} ${details.partySize === 1 ? 'passenger' : 'passengers'}` : `${details.partySize} khách`)
      : null;
    const car = details.vehicleType ? taxiVehicleLabel(details.vehicleType, isEn).toLowerCase() : null;
    if (pax && car) return `${pax}, ${car}`;
    if (pax) return pax;
    if (car) return car;
    return t('nhờ nhân viên tư vấn loại xe', 'staff will advise a suitable car');
  };

  const askRequirements = () => t(
    'Quý khách cần đặt xe cho bao nhiêu người hoặc cần xe mấy chỗ ạ?',
    'How many passengers will be travelling, or how many seats would you like?'
  );
  const askConfirm = (details = requirements) => t(
    `Dạ em ghi nhận đặt xe (${describeRequirements(details)}). Nếu có ghi chú thêm, quý khách vui lòng gõ trên màn hình, hoặc nói Gửi yêu cầu để hoàn tất ạ.`,
    `Got it (${describeRequirements(details)}). You can type an optional note on the screen, or say Send request to finish.`
  );
  const say = (message, listen = true) => {
    setVoiceGuidance(message);
    const version = requestVersionRef.current;
    if (typeof speak === 'function') {
      speak(message, langCode, () => {
        if (listen && isOpenRef.current && version === requestVersionRef.current && !submitLockRef.current) {
          onStartTalk?.({ silent: true });
        }
      });
    }
  };
  const beginAssistance = (request = initialRequest) => {
    const details = extractTaxiRequirements(request);
    setRequirements(details);
    setTypedNote('');
    setTypedRequirements('');
    setConfirmedTicket(null);
    setErrorMsg('');
    setMode('concierge_booking');
    const hasDetails = Boolean(details.partySize || details.vehicleType);
    setStage(hasDetails ? 'confirm' : 'requirements');
    say(hasDetails ? askConfirm(details) : askRequirements());
  };

  useEffect(() => {
    requestVersionRef.current += 1;
    lastProcessedTranscriptRef.current = '';
    if (!isOpen) return;
    submitLockRef.current = false;
    setIsSubmitting(false);
    setConfirmedTicket(null);
    setErrorMsg('');
    setTypedNote('');
    setTypedRequirements('');
    setMode(initialMode);
    if (initialMode === 'concierge_booking') beginAssistance();
  }, [isOpen, initialMode]);

  useEffect(() => {
    if (!isOpen || !['self_booking', 'concierge_confirmed'].includes(mode)) return;
    return startAutoCloseTimer({
      durationSeconds: mode === 'concierge_confirmed' ? CONFIRMED_AUTO_CLOSE_SECONDS : AUTO_CLOSE_SECONDS,
      onTick: setCountdown,
      onExpire: () => onCloseRef.current?.('auto'),
    });
  }, [isOpen, mode]);

  const submitRequest = async (details = requirements, noteText = typedNote) => {
    if (submitLockRef.current || confirmedTicket) return;
    if (!activeRoomNumber) {
      setErrorMsg(t('Vui lòng xác thực phòng trước khi gửi yêu cầu.', 'Please verify your room before sending the request.'));
      return;
    }
    submitLockRef.current = true;
    setIsSubmitting(true);
    setErrorMsg('');
    const version = requestVersionRef.current;
    try {
      const result = await createTaxiRequest(buildTaxiBookingPayload({
        activeRoomNumber,
        ...details,
        note: String(noteText || '').trim(),
      }));
      if (!result?.ticket_code && !result?.id) throw new Error('Missing request ID');
      if (!isOpenRef.current || version !== requestVersionRef.current) return;
      setConfirmedTicket(result);
      setMode('concierge_confirmed');
      onSuccess?.(result);
      say(t(
        'Em đã gửi yêu cầu cho nhân viên đặt xe giúp. Nhân viên sẽ liên hệ theo thông tin phòng của quý khách ạ.',
        'Your request has been sent to our staff to arrange a taxi. They can contact you using your room details.'
      ), false);
    } catch {
      if (isOpenRef.current && version === requestVersionRef.current) {
        setErrorMsg(t('Chưa gửi được yêu cầu. Quý khách vui lòng thử lại.', 'Could not send your request. Please try again.'));
      }
    } finally {
      if (version === requestVersionRef.current) {
        submitLockRef.current = false;
        setIsSubmitting(false);
      }
    }
  };

  const processReply = (rawReply) => {
    const reply = String(rawReply || '').trim();
    if (!reply || submitLockRef.current) return;
    if (mode === 'self_booking' || mode === 'concierge_confirmed') {
      if (isDismissVoiceIntent(reply)) onClose?.('voice_dismiss');
      return;
    }
    if (mode === 'options') {
      if (isSelfBookingVoiceIntent(reply)) {
        setMode('self_booking');
        say(getTaxiSelfBookingAnnouncement(isEn));
      } else if (isConciergeVoiceIntent(reply)) beginAssistance([initialRequest, reply].filter(Boolean).join('\n'));
      else if (taxiAssistanceReplyKind(reply) === 'cancel') onClose?.();
      else say(getTaxiOptionsPrompt(null, isEn));
      return;
    }
    const kind = taxiAssistanceReplyKind(reply);
    if (kind === 'cancel') { onClose?.(); return; }
    if (kind === 'hold') {
      say(t(
        'Em chưa gửi yêu cầu. Quý khách có thể nhập ghi chú trên màn hình rồi bấm Gửi yêu cầu khi sẵn sàng ạ.',
        'I have not sent the request. You can type a note on the screen and tap Send request when ready.'
      ), false);
      return;
    }
    const parsed = extractTaxiRequirements(reply, { allowBareCount: stage === 'requirements' });
    const hasDetails = Boolean(parsed.partySize || parsed.vehicleType);
    if (kind === 'edit' && !hasDetails) {
      setRequirements({ partySize: null, vehicleType: null });
      setStage('requirements');
      say(askRequirements());
      return;
    }
    const nextDetails = {
      partySize: parsed.partySize ?? requirements.partySize,
      vehicleType: parsed.vehicleType ?? requirements.vehicleType,
    };
    if (stage === 'requirements') {
      if (hasDetails || kind === 'unsure') {
        setRequirements(nextDetails);
        setStage('confirm');
        say(askConfirm(nextDetails));
      } else {
        say(askRequirements());
      }
      return;
    }
    // stage === 'confirm': chỉ nhận sửa số khách/xe hoặc xác nhận gửi; KHÔNG ghi âm thành ghi chú
    if (hasDetails) {
      setRequirements(nextDetails);
      if (kind === 'send' || isConfirmVoiceIntent(reply)) {
        void submitRequest(nextDetails, typedNote);
      } else {
        say(askConfirm(nextDetails));
      }
      return;
    }
    if (kind === 'send' || isConfirmVoiceIntent(reply)) {
      void submitRequest(requirements, typedNote);
      return;
    }
    say(t(
      'Để tránh ghi sai, phần ghi chú quý khách vui lòng gõ trên màn hình, hoặc nói Gửi yêu cầu để hoàn tất ạ.',
      'To avoid transcription errors, please type any note on the screen, or say Send request to finish.'
    ));
  };

  useEffect(() => {
    if (!isOpen || !lastVoiceTranscript) { lastProcessedTranscriptRef.current = ''; return; }
    if (lastProcessedTranscriptRef.current === lastVoiceTranscript) return;
    lastProcessedTranscriptRef.current = lastVoiceTranscript;
    processReply(lastVoiceTranscript);
  }, [isOpen, lastVoiceTranscript, mode, stage, requirements, typedNote, isSubmitting]);

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-md">
      <section role="dialog" aria-modal="true" aria-label={t('Đặt xe taxi', 'Taxi assistance')}
        className="w-full max-w-xl max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-2xl border border-stone-700 bg-stone-900 text-stone-100 p-4 sm:p-5 shadow-2xl">
        <header className="flex items-center gap-3 border-b border-stone-700 pb-3">
          <Car className="w-6 h-6 text-amber-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <h2 className="font-bold">{t('Nhờ đặt xe taxi', 'Taxi assistance')}</h2>
            {activeRoomNumber && <p className="text-xs text-emerald-300 flex items-center gap-1 mt-1"><ShieldCheck className="w-3.5 h-3.5" />{t('Phòng', 'Room')} {activeRoomNumber}</p>}
          </div>
          <button type="button" onClick={() => onClose?.()} disabled={isSubmitting} aria-label={t('Đóng', 'Close')} className="p-2 rounded-lg hover:bg-stone-800 disabled:opacity-40"><X className="w-5 h-5" /></button>
        </header>
        {errorMsg && <p role="alert" className="flex items-center gap-2 bg-red-500/10 text-red-300 text-sm p-3 rounded-lg mt-3"><AlertCircle className="w-4 h-4" />{errorMsg}</p>}
        {mode === 'options' && <div className="grid grid-cols-2 gap-3 pt-4">
          <button type="button" onClick={() => { setMode('self_booking'); say(getTaxiSelfBookingAnnouncement(isEn)); }} className="text-left p-4 rounded-xl bg-stone-800 hover:bg-stone-700"><Phone className="text-amber-400 mb-2" /><strong>{t('1. Tự gọi taxi', '1. Call a taxi yourself')}</strong></button>
          <button type="button" onClick={() => beginAssistance()} className="text-left p-4 rounded-xl bg-stone-800 hover:bg-stone-700"><UserCheck className="text-emerald-400 mb-2" /><strong>{t('2. Nhờ nhân viên đặt xe', '2. Ask staff to book')}</strong></button>
        </div>}
        {mode === 'self_booking' && <div className="pt-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">{TAXI_PARTNERS.map(partner => <a key={partner.id} href={`tel:${partner.hotline.replace(/\s+/g, '')}`} className="rounded-xl p-3 bg-stone-800 hover:bg-stone-700">
            <p className="text-xs font-semibold">{isEn && partner.id === 'airport_taxi' ? 'Da Nang Airport Taxi' : partner.name}</p><p className="text-amber-400 font-mono mt-1">{partner.hotline}</p>
          </a>)}</div>
          <p className="text-xs text-stone-400">{getTaxiSelfBookingNotice(isEn)}</p>
        </div>}
        {mode === 'concierge_booking' && <div className="pt-4 space-y-3.5">
          <p aria-live="polite" className="flex gap-2 text-sm leading-relaxed bg-amber-500/10 border border-amber-500/25 rounded-xl p-3"><Mic className="text-amber-400 w-4 h-4 mt-0.5 shrink-0" />{isSubmitting ? t('Đang gửi yêu cầu...', 'Sending your request...') : voiceGuidance}</p>

          {stage === 'requirements' && (
            <div className="space-y-2.5">
              <div className="grid grid-cols-3 gap-2">
                {['4-Seater Sedan', '7-Seater SUV', '16-Seater Van'].map((vType) => (
                  <button
                    key={vType}
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => {
                      const next = { ...requirements, vehicleType: vType };
                      setRequirements(next);
                      setStage('confirm');
                      say(askConfirm(next));
                    }}
                    className="rounded-xl border border-stone-700 bg-stone-800 hover:bg-stone-700 px-3 py-2.5 text-xs font-semibold text-stone-100 transition-colors cursor-pointer"
                  >
                    {taxiVehicleLabel(vType, isEn)}
                  </button>
                ))}
              </div>
              <details className="text-xs text-stone-400">
                <summary className="cursor-pointer">{t('Nhập số người bằng bàn phím', 'Type passenger count instead')}</summary>
                <form onSubmit={e => { e.preventDefault(); processReply(typedRequirements); setTypedRequirements(''); }} className="flex gap-2 mt-2">
                  <input aria-label={t('Số khách hoặc loại xe', 'Passengers or car size')} value={typedRequirements} onChange={e => setTypedRequirements(e.target.value)} onFocus={() => onStopListening?.()} maxLength={200} disabled={isSubmitting} placeholder={t('Ví dụ: 5 người hoặc xe 7 chỗ', 'For example: 5 passengers or 7-seater')} className="min-w-0 flex-1 rounded-lg p-2 bg-stone-800 border border-stone-600 text-white" />
                  <button disabled={!typedRequirements.trim() || isSubmitting} className="px-3 rounded-lg bg-stone-700 text-white font-semibold disabled:opacity-40">{t('Tiếp tục', 'Continue')}</button>
                </form>
              </details>
            </div>
          )}

          {stage === 'confirm' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-2 text-sm">
                  {requirements.partySize && <span className="rounded-lg bg-stone-800 px-3 py-1.5 flex items-center gap-2"><Users className="w-4 h-4 text-amber-400" />{requirements.partySize} {t('khách', 'passengers')}</span>}
                  {requirements.vehicleType && <span className="rounded-lg bg-stone-800 px-3 py-1.5 flex items-center gap-2"><Car className="w-4 h-4 text-amber-400" />{taxiVehicleLabel(requirements.vehicleType, isEn)}</span>}
                  {!requirements.partySize && !requirements.vehicleType && (
                    <span className="rounded-lg bg-stone-800 px-3 py-1.5 text-xs text-stone-300">{t('Nhân viên tư vấn loại xe', 'Staff will advise a suitable car')}</span>
                  )}
                </div>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => {
                    setRequirements({ partySize: null, vehicleType: null });
                    setStage('requirements');
                    say(askRequirements());
                  }}
                  className="text-xs text-amber-300 hover:text-amber-200 underline underline-offset-4 cursor-pointer"
                >
                  {t('Đổi số khách / xe', 'Change')}
                </button>
              </div>

              <label className="block text-xs text-stone-300">
                <span className="font-semibold">{t('Ghi chú thêm cho nhân viên (không bắt buộc — nhập bàn phím)', 'Optional note for staff (type with keyboard)')}</span>
                <textarea
                  rows={2}
                  maxLength={1000}
                  value={typedNote}
                  disabled={isSubmitting}
                  onFocus={() => onStopListening?.()}
                  onChange={e => setTypedNote(e.target.value)}
                  placeholder={t('Ví dụ: Có 2 vali lớn, cần xe lúc 7 giờ...', 'For example: 2 large suitcases, needed at 7:00 AM...')}
                  className="mt-1.5 w-full rounded-xl p-2.5 bg-stone-800 border border-stone-600 focus:border-amber-400 outline-none text-sm text-white placeholder:text-stone-500"
                />
              </label>
            </div>
          )}

          <p className="text-xs text-stone-400">{t('Nhân viên sẽ nhận yêu cầu và liên hệ theo thông tin phòng của quý khách.', 'Staff will receive your request and use your room contact details to follow up.')}</p>

          <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-stone-700 pt-3">
            {/* Bấm tay = lệnh chủ động: ngắt lời robot (nếu đang nói) và mở lại micro trong cử chỉ chạm (yêu cầu của iOS Safari). */}
            <button type="button" disabled={isSubmitting} onClick={() => onStartTalk?.()}
              aria-pressed={isListening}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 disabled:opacity-40 transition-colors ${isListening ? 'bg-emerald-600/25 text-emerald-200 ring-1 ring-emerald-500/60' : 'bg-stone-800 hover:bg-stone-700'}`}>
              <Mic className={`w-4 h-4 ${isListening ? 'animate-pulse text-emerald-300' : ''}`} />
              {isListening
                ? t('Đang nghe... (chạm để nghe lại)', 'Listening... (tap to restart)')
                : isRobotSpeaking
                  ? t('Chạm để nói ngay', 'Tap to speak now')
                  : t('Nói với robot', 'Speak to the robot')}
            </button>
            {isListening && liveTranscript && <span className="flex-1 min-w-0 truncate text-xs italic text-stone-300">“{liveTranscript}”</span>}
            {stage === 'confirm' && <button type="button" disabled={isSubmitting} onClick={() => void submitRequest(requirements, typedNote)} className="flex items-center gap-2 rounded-lg px-4 py-2 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold disabled:opacity-40 cursor-pointer"><Send className="w-4 h-4" />{t('Gửi yêu cầu', 'Send request')}</button>}
          </footer>
        </div>}
        {mode === 'concierge_confirmed' && confirmedTicket && <div className="pt-5 space-y-3 text-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
          <h3 className="font-bold">{t('Đã gửi yêu cầu đặt xe', 'Taxi request sent')}</h3>
          <p className="text-sm text-stone-300">{t('Nhân viên sẽ hỗ trợ đặt xe theo yêu cầu của quý khách.', 'Our staff will arrange a taxi based on your request.')}</p>
          <p className="font-mono text-amber-400">{confirmedTicket.ticket_code || confirmedTicket.id}</p>
          <button type="button" onClick={() => onClose?.()} className="rounded-lg bg-emerald-500 text-stone-950 font-bold px-5 py-2">{t('Hoàn tất', 'Done')} ({countdown}s)</button>
        </div>}
      </section>
    </div>
  );
};
