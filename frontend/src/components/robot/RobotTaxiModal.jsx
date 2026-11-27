import React, { useState, useEffect, useRef } from 'react';
import { X, Car, ShieldCheck, CheckCircle2, AlertCircle, Phone, UserCheck, Mic, Send, Users } from 'lucide-react';
import { createTaxiRequest } from '../../services/taxiApi';
import { extractTaxiRequirements, taxiAssistanceReplyKind, buildTaxiBookingPayload, taxiVehicleLabel, normalizeTaxiSpeech } from '../../utils/taxiAssistance';
export { buildTaxiBookingPayload } from '../../utils/taxiAssistance';

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
  const clean = normalizeTaxiSpeech(transcript);
  return /\b(tu dat|tu goi|tu lien he|tu book|cho toi so|cho so|so dien thoai|hotline|first option|call (?:it |a taxi )?myself|book (?:it )?myself|taxi numbers?|thu nhat|dau tien)\b/.test(clean)
    || /\b(?:option|lua chon|phuong an|chon(?: cach)?|so)\s+(?:1|one|mot)\b/.test(clean)
    || /^(?:da\s+)?(?:1|one|mot)(?:\s+(?:a|please))?[.!?]?$/.test(clean);
}

export function isConciergeVoiceIntent(transcript) {
  const clean = normalizeTaxiSpeech(transcript);
  return /\b(nho dat|dat (?:xe )?(?:gium|dum|giup|ho)|concierge|nhan vien dat|le tan dat|ho tro dat|second option|staff (?:to )?(?:book|arrange)|book (?:it |a taxi )?for me|thu hai|thu 2)\b/.test(clean)
    || /\b(?:option|lua chon|phuong an|chon(?: cach)?|so)\s+(?:2|two|hai)\b/.test(clean)
    || /^(?:da\s+)?(?:2|two|hai)(?:\s+(?:a|please))?[.!?]?$/.test(clean);
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
  onSuccess, speak, onStartTalk,
}) => {
  const isEn = language === 'English' || language === 'EN';
  const langCode = isEn ? 'en-US' : 'vi-VN';
  const t = (vi, en) => isEn ? en : vi;
  const [mode, setMode] = useState(initialMode);
  const [stage, setStage] = useState('requirements');
  const [requirements, setRequirements] = useState({ partySize: null, vehicleType: null });
  const [notes, setNotes] = useState([]);
  const [typedReply, setTypedReply] = useState('');
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

  const askRequirements = () => t(
    'Quý khách cần đặt xe cho bao nhiêu người hoặc cần xe mấy chỗ ạ?',
    'How many passengers will be travelling, or how many seats would you like?'
  );
  const askNotes = () => t(
    'Quý khách có hành lý hoặc yêu cầu gì thêm không ạ? Nếu không, em sẽ gửi yêu cầu cho nhân viên đặt xe giúp.',
    'Do you have any luggage or other requests? If not, I will send the request to our staff to arrange your taxi.'
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
    setNotes(request.trim() ? [request.trim()] : []);
    setConfirmedTicket(null);
    setErrorMsg('');
    setMode('concierge_booking');
    const hasDetails = Boolean(details.partySize || details.vehicleType);
    setStage(hasDetails ? 'notes' : 'requirements');
    say(hasDetails ? askNotes() : askRequirements());
  };

  useEffect(() => {
    requestVersionRef.current += 1;
    lastProcessedTranscriptRef.current = '';
    if (!isOpen) return;
    submitLockRef.current = false;
    setIsSubmitting(false);
    setConfirmedTicket(null);
    setErrorMsg('');
    setTypedReply('');
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

  const submitRequest = async (details = requirements, capturedNotes = notes) => {
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
        activeRoomNumber, ...details, note: capturedNotes.join('\n'),
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
      say(t('Em chưa gửi yêu cầu. Quý khách có thể sửa thông tin hoặc nói gửi yêu cầu khi sẵn sàng.', 'I have not sent the request. You can change the details or say send the request when ready.'));
      return;
    }
    const parsed = extractTaxiRequirements(reply, { allowBareCount: stage === 'requirements' });
    const hasDetails = Boolean(parsed.partySize || parsed.vehicleType);
    if (kind === 'edit' && !hasDetails) {
      setStage('requirements');
      say(askRequirements());
      return;
    }
    const nextDetails = {
      partySize: parsed.partySize ?? requirements.partySize,
      vehicleType: parsed.vehicleType ?? requirements.vehicleType,
    };
    const nextNotes = notes.includes(reply) ? notes : [...notes, reply];
    if (stage === 'requirements') {
      if (hasDetails || kind === 'unsure') {
        setRequirements(nextDetails);
        setNotes(nextNotes);
        setStage('notes');
        say(askNotes());
      } else say(askRequirements());
      return;
    }
    if (hasDetails) {
      setRequirements(nextDetails);
      setNotes(nextNotes);
      if (kind === 'send') void submitRequest(nextDetails, nextNotes);
      else say(askNotes());
    } else if (kind === 'send') {
      void submitRequest(requirements, notes);
    } else if (kind === 'more_notes') {
      say(t('Quý khách cho em biết yêu cầu thêm nhé ạ.', 'Please tell me your additional requests.'));
    } else {
      setNotes(nextNotes);
      void submitRequest(requirements, nextNotes);
    }
  };

  useEffect(() => {
    if (!isOpen || !lastVoiceTranscript) { lastProcessedTranscriptRef.current = ''; return; }
    if (lastProcessedTranscriptRef.current === lastVoiceTranscript) return;
    lastProcessedTranscriptRef.current = lastVoiceTranscript;
    processReply(lastVoiceTranscript);
  }, [isOpen, lastVoiceTranscript, mode, stage, requirements, notes, isSubmitting]);

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
        {mode === 'concierge_booking' && <div className="pt-4 space-y-4">
          <p aria-live="polite" className="flex gap-2 text-sm leading-relaxed bg-amber-500/10 border border-amber-500/25 rounded-xl p-3"><Mic className="text-amber-400 w-4 h-4 mt-0.5 shrink-0" />{isSubmitting ? t('Đang gửi yêu cầu...', 'Sending your request...') : voiceGuidance}</p>
          {(requirements.partySize || requirements.vehicleType) && <div className="flex flex-wrap gap-2 text-sm">
            {requirements.partySize && <span className="rounded-lg bg-stone-800 px-3 py-2 flex items-center gap-2"><Users className="w-4 h-4" />{requirements.partySize} {t('khách', 'passengers')}</span>}
            {requirements.vehicleType && <span className="rounded-lg bg-stone-800 px-3 py-2">{taxiVehicleLabel(requirements.vehicleType, isEn)}</span>}
          </div>}
          <p className="text-xs text-stone-400">{t('Nhân viên sẽ nhận yêu cầu và liên hệ theo thông tin phòng của quý khách.', 'Staff will receive your request and use your room contact details to follow up.')}</p>
          <details className="text-xs text-stone-400">
            <summary className="cursor-pointer">{t('Nhập thay vì nói', 'Type instead of speaking')}</summary>
            <form onSubmit={e => { e.preventDefault(); processReply(typedReply); setTypedReply(''); }} className="flex gap-2 mt-2">
              <input aria-label={t('Câu trả lời', 'Your reply')} value={typedReply} onChange={e => setTypedReply(e.target.value)} maxLength={1000} disabled={isSubmitting} placeholder={t('Ví dụ: 5 người, có 2 vali lớn', 'For example: 5 passengers and 2 large bags')} className="min-w-0 flex-1 rounded-lg p-2 bg-stone-800 border border-stone-600 text-white" />
              <button disabled={!typedReply.trim() || isSubmitting} className="px-3 rounded-lg bg-stone-700 disabled:opacity-40">{t('Trả lời', 'Reply')}</button>
            </form>
          </details>
          <footer className="flex flex-wrap justify-between gap-2 border-t border-stone-700 pt-3">
            <button type="button" disabled={isSubmitting} onClick={() => onStartTalk?.({ silent: true })} className="flex items-center gap-2 rounded-lg px-3 py-2 bg-stone-800 disabled:opacity-40"><Mic className="w-4 h-4" />{t('Nói với robot', 'Speak to the robot')}</button>
            {stage === 'notes' && <button type="button" disabled={isSubmitting} onClick={() => { if (typedReply.trim()) { processReply(typedReply); setTypedReply(''); } else void submitRequest(); }} className="flex items-center gap-2 rounded-lg px-4 py-2 bg-amber-500 text-stone-950 font-bold disabled:opacity-40"><Send className="w-4 h-4" />{t('Gửi yêu cầu', 'Send request')}</button>}
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
