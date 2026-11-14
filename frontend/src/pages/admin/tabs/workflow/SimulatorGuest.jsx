import React from 'react';
import { LogOut, MessageCircle, UserPlus, Users } from 'lucide-react';
import { meterToSvg } from './workflowSimulatorUtils';

const COPY = {
  EN: {
    title: 'Guest interaction', simulated: 'Simulated', name: 'Guest 01',
    none: 'No guest', paused: 'Paused', approaching: 'Approaching', waiting: 'Waiting for robot',
    following: 'Following robot', 'catching-up': 'Joining robot', leaving: 'Leaving',
    listening: 'Listening', talking: 'Talking', choosing: 'Choosing a service',
    selectingLanguage: 'Choosing a language', readingMap: 'Reading the map',
    viewing: 'Viewing the screen', requesting: 'Requesting service', rating: 'Giving feedback',
    arrive: 'Guest arrives', leave: 'Guest leaves', reply: 'Simulate reply',
    ready: 'Run a workflow to see the guest journey.', empty: 'Add a guest to try an interaction.',
    promotion: 'Promotion paused while the guest is here.',
    charging: 'Robot is returning to charge.', requestSent: 'Request sent · preview',
    preview: 'Web preview',
    bubbles: {
      waiting: 'I will wait here.', listening: 'Hello!', talking: 'Could you help me?',
      selectingLanguage: 'Let me choose my language.', readingMap: 'Please show me the way.',
      choosing: 'Let me choose a service.', viewing: 'I am looking at the screen.',
      requesting: 'I would like to request a service.', rating: 'I am ready to rate the service.',
      following: 'Please lead the way.', leaving: 'Thank you. Goodbye!',
    },
    replies: {
      waiting: 'Hello, I am here.', listening: 'Hello, nice to meet you!', talking: 'Yes, please. Thank you!',
      selectingLanguage: 'I will choose on the screen.', readingMap: 'I understand the route.',
      choosing: 'I will choose on the screen.', viewing: 'I understand, thank you.',
      requesting: 'I will fill in the request.', rating: 'Thank you for your help!',
    },
  },
  VI: {
    title: 'Tương tác với khách', simulated: 'Giả lập', name: 'Khách 01',
    none: 'Chưa có khách', paused: 'Tạm dừng', approaching: 'Đang tiếp cận', waiting: 'Đang chờ robot',
    following: 'Đang đi theo robot', 'catching-up': 'Đang tới gần robot', leaving: 'Đang rời đi',
    listening: 'Đang lắng nghe', talking: 'Đang trò chuyện', choosing: 'Đang chọn dịch vụ',
    selectingLanguage: 'Đang chọn ngôn ngữ', readingMap: 'Đang xem bản đồ',
    viewing: 'Đang xem màn hình', requesting: 'Đang yêu cầu dịch vụ', rating: 'Đang đánh giá',
    arrive: 'Khách đến', leave: 'Khách rời đi', reply: 'Mô phỏng trả lời',
    ready: 'Chạy kịch bản để xem hành trình của khách.', empty: 'Thêm khách để thử tương tác.',
    promotion: 'Quảng cáo tạm dừng khi có khách.',
    charging: 'Robot đang trở về trạm sạc.', requestSent: 'Đã gửi yêu cầu · mô phỏng',
    preview: 'Mô phỏng trên web',
    bubbles: {
      waiting: 'Tôi sẽ chờ ở đây.', listening: 'Xin chào!', talking: 'Bạn giúp tôi được không?',
      selectingLanguage: 'Để tôi chọn ngôn ngữ.', readingMap: 'Bạn chỉ đường giúp tôi nhé.',
      choosing: 'Để tôi chọn dịch vụ.', viewing: 'Tôi đang xem màn hình.',
      requesting: 'Tôi muốn yêu cầu dịch vụ.', rating: 'Tôi sẵn sàng đánh giá dịch vụ.',
      following: 'Bạn dẫn đường giúp tôi nhé.', leaving: 'Cảm ơn. Tạm biệt!',
    },
    replies: {
      waiting: 'Xin chào, tôi ở đây.', listening: 'Xin chào, rất vui được gặp bạn!', talking: 'Được, cảm ơn bạn!',
      selectingLanguage: 'Tôi sẽ chọn trên màn hình.', readingMap: 'Tôi đã hiểu đường đi.',
      choosing: 'Tôi sẽ chọn trên màn hình.', viewing: 'Tôi hiểu rồi, cảm ơn.',
      requesting: 'Tôi sẽ điền yêu cầu.', rating: 'Cảm ơn bạn đã hỗ trợ!',
    },
  },
};

function presentation(guest, language, ticket) {
  const text = COPY[language === 'VI' ? 'VI' : 'EN'];
  const state = guest?.mode === 'interacting' ? guest.activity : guest?.mode;
  const status = text[state] || text.none;
  const bubble = guest?.reply ? text.replies[guest.reply] :
    ticket && guest?.mode === 'interacting' ? text.requestSent : text.bubbles[state];
  return { text, status, bubble };
}

export function SimulatorGuestControls({ simulation, language, isPlaying, isPaused, isCharging, promotionInterrupted, ticket }) {
  const { guest, arrive, leave, reply, disabled, canArrive } = simulation;
  const { text, status, bubble } = presentation(guest, language, ticket);
  const departing = guest?.mode === 'leaving';
  const canReply = guest && ['interacting', 'waiting'].includes(guest.mode);
  const buttonClass = 'flex items-center justify-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40';
  return <section aria-label={text.title} className="shrink-0 border-b border-stone-300 bg-[#FAF9F6] px-3 py-2 sm:px-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
    <div className="flex min-w-0 items-center gap-2.5">
      <span className="rounded-lg bg-teal-50 p-2 text-teal-700"><Users size={17} /></span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold text-stone-900">{text.title}</span>
          <span className="rounded border border-teal-200 bg-teal-50 px-1.5 py-0.5 text-[10px] text-teal-800">{text.simulated}</span>
          <span role="status" className="text-stone-500">{isPaused ? text.paused : status}</span>
        </div>
        <p className="mt-1 text-[11px] text-stone-500">
          {isCharging ? text.charging : promotionInterrupted ? text.promotion : bubble || (guest ? `${text.name} · ${status}` : isPlaying ? text.empty : text.ready)}
        </p>
      </div>
    </div>
    <div className="flex flex-wrap gap-1.5">
      <button type="button" onClick={arrive} disabled={disabled || !canArrive || Boolean(guest)} className={`${buttonClass} border-teal-200 bg-teal-50 text-teal-800`}>
        <UserPlus size={14} />{text.arrive}
      </button>
      <button type="button" onClick={reply} disabled={disabled || !canReply} className={`${buttonClass} border-stone-300 bg-white text-stone-700`}>
        <MessageCircle size={14} />{text.reply}
      </button>
      <button type="button" onClick={leave} disabled={disabled || !guest || departing} className={`${buttonClass} border-stone-300 bg-white text-stone-700`}>
        <LogOut size={14} />{text.leave}
      </button>
    </div>
  </section>;
}

export function SimulatorGuestMarker({ guest, language, ticket }) {
  if (!guest) return null;
  const { text, status, bubble } = presentation(guest, language, ticket);
  const position = meterToSvg(guest.pose.x, guest.pose.y);
  const route = [guest.pose, ...guest.route].map((p) => {
    const svg = meterToSvg(p.x, p.y);
    return `${svg.x},${svg.y}`;
  }).join(' ');
  const captionX = Math.max(91, Math.min(469, position.x));
  const captionY = position.y < 98 ? position.y + 28 : position.y - 35;
  const words = (bubble || status).split(' ');
  const lines = [''];
  words.forEach((word) => {
    const last = lines.length - 1;
    if (lines[last].length + word.length > 36 && lines[last]) lines.push(word);
    else lines[last] += (lines[last] ? ' ' : '') + word;
  });
  return <g data-sim-guest="true" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}
    role="img" aria-label={`${text.name} · ${text.simulated} · ${status}`}>
    <title>{`${text.name} · ${text.preview} · ${status}`}</title>
    {guest.route.length > 0 && <polyline points={route} fill="none" stroke="#0D9488" strokeWidth="0.8" strokeDasharray="2 3" opacity="0.4" pointerEvents="none" />}
    <g transform={`translate(${position.x}, ${position.y})`}>
      <circle r="10.5" fill="#CCFBF1" opacity="0.75" />
      <circle r="8" fill="#FFFFFF" stroke="#0D9488" strokeWidth="1" />
      <circle cy="-2.8" r="2.3" fill="#0F766E" />
      <path d="M -4.2 4.5 Q -4.2 0 0 0 Q 4.2 0 4.2 4.5 Z" fill="#0F766E" />
    </g>
    <g transform={`translate(${captionX}, ${captionY})`}>
      <rect x="-54" y="-11" width="108" height={bubble ? 31 : 23} rx="4" fill="#FFFFFF" stroke="#99D5CC" strokeWidth="0.7" />
      <text y="-3" textAnchor="middle" fontSize="5.5" fontWeight="700" fill="#0F766E">{text.name} · {text.simulated}</text>
      {lines.slice(0, 2).map((line, index) => <text key={index} y={5 + index * 7} textAnchor="middle" fontSize="5" fill="#44403C">{line}</text>)}
    </g>
  </g>;
}
