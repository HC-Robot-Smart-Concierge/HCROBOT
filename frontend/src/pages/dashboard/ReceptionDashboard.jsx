import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  Briefcase,
  CheckCircle2,
  Clock,
  FileText,
  MapPin,
  MessageSquare,
  Mic,
  PhoneOff,
  Play,
  Printer,
  Share2,
  User,
  Video,
  Volume2,
} from 'lucide-react';
import { INITIAL_RECEPTION_DATA } from '../../data/mockHotelData';
import {
  fetchReceptionDashboard,
  updateReceptionRequest,
} from '../../services/operationsApi';

const normalizeRequest = (request = {}) => ({
  ...request,
  ticketCode: request.ticket_code || request.ticketCode || 'REQ-8942A',
  createdLabel: request.created_label || request.createdLabel || 'Recently',
  location: request.location || 'Room 402',
  locationDetails: request.location_details || request.locationDetails || { floor: 'West Wing', category: 'Standard Room' },
  guestName: request.guest_name || request.guestName || 'Standard Guest',
  guestTier: request.guest_tier || request.guestTier || 'Standard',
  guestStayDetails: request.guest_stay_details || request.guestStayDetails || 'Standard Check-in',
  description: request.description || '',
  attachedMedia: request.attached_media || request.attachedMedia || [],
  transcript: request.transcript || [],
  assistanceStatus: request.assistance_status || request.assistanceStatus || 'Connected',
  assignedTo: request.assigned_to || request.assignedTo || 'Javier Morales',
  assignedRole: request.assigned_role || request.assignedRole || 'Staff Tech',
  activityLog: request.activity_log || request.activityLog || [],
});

const staffOptions = [
  { name: 'Javier Morales', role: 'Maintenance Tech II' },
  { name: 'James Doe', role: 'HVAC Tech & Maintenance' },
];

export const ReceptionDashboard = ({ currentUser, onNotify = () => {} }) => {
  const staffName = currentUser?.full_name || currentUser?.name || 'Front Desk Receptionist';
  const [request, setRequest] = useState(normalizeRequest(INITIAL_RECEPTION_DATA));
  const [videoConnected, setVideoConnected] = useState(true);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => {
    const loadData = async () => {
      const response = await fetchReceptionDashboard();
      if (response?.current_request) {
        setRequest(normalizeRequest(response.current_request));
      }
    };

    loadData();
  }, []);

  const persistUpdate = async (payload, optimisticValues = payload) => {
    setRequest((previous) => ({ ...previous, ...optimisticValues }));
    const response = await updateReceptionRequest(
      request.ticketCode || request.id,
      payload
    );
    if (response?.ticket_code) {
      setRequest(normalizeRequest(response));
    }
  };

  const handleStartTask = async () => {
    await persistUpdate({ status: 'In Progress' }, { status: 'In Progress' });
    onNotify(`Đã bắt đầu xử lý ${request.ticketCode}`);
  };

  const handleToggleVideo = async () => {
    const nextConnected = !videoConnected;
    setVideoConnected(nextConnected);
    await persistUpdate(
      { assistance_status: nextConnected ? 'Connected' : 'Ended' },
      { assistanceStatus: nextConnected ? 'Connected' : 'Ended' }
    );
    onNotify(nextConnected ? 'Đã kết nối lại cuộc gọi hỗ trợ' : 'Đã kết thúc cuộc gọi hỗ trợ');
  };

  const handleReassign = async () => {
    const currentIndex = staffOptions.findIndex((staff) => staff.name === request.assignedTo);
    const nextStaff = staffOptions[(currentIndex + 1) % staffOptions.length];
    await persistUpdate(
      { assigned_to: nextStaff.name, assigned_role: nextStaff.role },
      { assignedTo: nextStaff.name, assignedRole: nextStaff.role }
    );
    onNotify(`Đã giao phiếu cho ${nextStaff.name}`);
  };

  const handleAddNote = async () => {
    const trimmedNote = note.trim();
    if (!trimmedNote) return;
    await persistUpdate({ note: trimmedNote });
    setNote('');
    setNoteOpen(false);
    onNotify('Đã thêm ghi chú vào phiếu lễ tân');
  };

  const handleEscalate = async () => {
    await persistUpdate({ escalated: true }, { escalated: true, priority: 'Critical' });
    onNotify('Đã chuyển cấp yêu cầu tới Operations');
  };

  const handleComplete = async () => {
    await persistUpdate({ status: 'Completed' }, { status: 'Completed' });
    onNotify(`Đã hoàn tất ${request.ticketCode}`);
  };

  const statusColor =
    request.status === 'Completed'
      ? 'text-[#258955]'
      : request.status === 'In Progress'
      ? 'text-[#3D72B9]'
      : 'text-[#C9222A]';

  return (
    <main className="flex-1 overflow-y-auto custom-scrollbar bg-[#FCFAF7] font-sans">
      <div className="w-full max-w-[1180px] mx-auto px-8 pt-3 pb-8">
        <section className="grid grid-cols-1 xl:grid-cols-[minmax(0,2.08fr)_minmax(235px,0.92fr)] gap-5">
          <div className="min-w-0">
            <header>
              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#77726D]">
                  <span className="rounded-full bg-[#EFEEEB] px-2.5 py-1 font-medium tracking-[0.06em]">
                    {request.ticketCode}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" strokeWidth={1.7} />
                    {request.createdLabel}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    title="Print request"
                    onClick={() => onNotify(`Đã chuẩn bị bản in ${request.ticketCode}`)}
                    className="h-9 w-9 rounded-[10px] bg-[#F0EFEC] flex items-center justify-center text-[#68635E] hover:bg-[#E7E4E0]"
                  >
                    <Printer className="h-4 w-4" strokeWidth={1.7} />
                  </button>
                  <button
                    type="button"
                    title="Share request"
                    onClick={() => onNotify(`Đã sao chép liên kết ${request.ticketCode}`)}
                    className="h-9 w-9 rounded-[10px] bg-[#F0EFEC] flex items-center justify-center text-[#68635E] hover:bg-[#E7E4E0]"
                  >
                    <Share2 className="h-4 w-4" strokeWidth={1.7} />
                  </button>
                </div>
              </div>

              <h2 className="mt-3 text-[15px] font-medium text-[#312E2B]">{request.title}</h2>
            </header>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <article className="min-h-[134px] rounded-[17px] bg-[#F0EFEC] p-5">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 shrink-0 rounded-full bg-black flex items-center justify-center text-white">
                    <MapPin className="h-[18px] w-[18px]" strokeWidth={1.7} />
                  </div>
                  <div>
                    <p className="mt-1 text-[10px] font-medium tracking-[0.12em] text-[#77726D]">LOCATION</p>
                    <p className="mt-1 text-[12px] font-medium text-[#44403C]">{request.location}</p>
                    <p className="mt-1 text-[11px] leading-[1.45] text-[#6F6A65]">
                      {request.locationDetails?.floor || 'West Wing'}
                      <br />
                      {request.locationDetails?.category || 'Standard Room'}
                    </p>
                  </div>
                </div>
              </article>

              <article className="min-h-[134px] rounded-[17px] bg-[#F0EFEC] p-5">
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 shrink-0 rounded-full bg-[#E5E3E0] flex items-center justify-center text-[#68635E]">
                    <User className="h-4 w-4" strokeWidth={1.7} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-medium tracking-[0.12em] text-[#77726D]">GUEST PROFILE</p>
                    <div className="mt-1 flex items-center gap-2">
                      <p className="truncate text-[12px] font-medium text-[#44403C]">{request.guestName}</p>
                      <span className="rounded-full bg-black px-2 py-0.5 text-[9px] font-medium text-white">
                        {request.guestTier || 'Standard'}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] leading-[1.45] text-[#6F6A65]">
                      {request.guestStayDetails}
                    </p>
                  </div>
                </div>
              </article>
            </div>

            <article className="mt-5 rounded-[18px] bg-white px-6 py-6 shadow-[0_4px_18px_rgba(55,48,42,0.05)]">
              <h3 className="text-[11px] font-medium text-[#57524D]">Issue Description</h3>
              <p className="mt-4 text-[12px] leading-[1.65] text-[#625D58]">{request.description}</p>

              <p className="mt-5 text-[10px] font-medium tracking-[0.08em] text-[#77726D]">
                ATTACHED MEDIA ({(request.attachedMedia || []).length})
              </p>
              <div className="mt-2 flex gap-3">
                {(request.attachedMedia || []).map((media) => (
                  <img
                    key={media.url}
                    src={media.url}
                    alt={media.alt || 'Media'}
                    className="h-[96px] w-[112px] rounded-[9px] object-cover"
                  />
                ))}
              </div>
            </article>

            <article className="mt-5 rounded-[18px] bg-[#F0EFEC] px-5 py-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-[11px] font-medium text-[#4E4945]">
                  <span className="h-7 w-7 rounded-full bg-black flex items-center justify-center text-white">
                    <Briefcase className="h-3.5 w-3.5" strokeWidth={1.7} />
                  </span>
                  HCRobot Transcript
                </div>
                <span className="rounded-full bg-[#E7E4E0] px-3 py-1.5 text-[10px] text-[#716C67]">
                  Source: In-Room Voice Assistant
                </span>
              </div>

              <div className="mt-4 space-y-3">
                {(request.transcript || []).map((entry, index) => {
                  const isAssistant = entry.speaker === 'assistant';
                  return (
                    <div key={`${entry.time}-${index}`} className="flex items-start gap-2.5">
                      <div
                        className={`mt-1 h-6 w-6 shrink-0 rounded-full flex items-center justify-center text-[9px] font-semibold ${
                          isAssistant ? 'bg-black text-white' : 'bg-[#E4E2DF] text-[#6E6964]'
                        }`}
                      >
                        {isAssistant ? <Bot className="h-3 w-3" strokeWidth={1.7} /> : 'G'}
                      </div>
                      <div
                        className={`flex-1 rounded-[12px] px-4 py-3 ${
                          isAssistant ? 'bg-[#201F1D] text-white' : 'bg-white text-[#55504B]'
                        }`}
                      >
                        <p className={`text-[9px] ${isAssistant ? 'text-[#AFAAA5]' : 'text-[#8A857F]'}`}>
                          {entry.time}
                        </p>
                        <p className="mt-1 text-[11px] leading-[1.55]">“{entry.message}”</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>
          </div>

          <aside className="min-w-0 space-y-4">
            <section className="rounded-[17px] bg-white px-5 py-5 shadow-[0_4px_18px_rgba(55,48,42,0.05)]">
              <div className="flex items-start justify-between gap-3">
                <p className="text-[10px] font-medium tracking-[0.08em] text-[#77726D]">CURRENT STATUS</p>
                <span className={`flex items-center gap-1.5 text-[11px] font-medium ${statusColor}`}>
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {request.status}
                </span>
              </div>
              <div className="mt-5 flex items-center justify-between text-[10px] text-[#77726D]">
                <span>Priority Level</span>
                <span>{request.priority}</span>
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                <span className="h-1 w-[42%] rounded-full bg-[#D5282F]" />
                <span className="h-1 flex-1 rounded-full bg-[#DDD9D4]" />
              </div>
              <button
                type="button"
                onClick={handleStartTask}
                disabled={request.status === 'Completed'}
                className="mt-5 w-full rounded-[9px] bg-black px-4 py-3 text-[11px] font-medium text-white hover:bg-[#252525] disabled:opacity-40"
              >
                <span className="inline-flex items-center gap-2">
                  <Play className="h-3.5 w-3.5" fill="currentColor" />
                  Start Task
                </span>
              </button>
            </section>

            <section className="rounded-[17px] bg-white px-4 py-4 shadow-[0_4px_18px_rgba(55,48,42,0.05)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-medium tracking-[0.08em] text-[#77726D]">LIVE ASSISTANCE</p>
                  <span className="mt-1 flex items-center gap-1.5 text-[10px] text-[#5E5954]">
                    <span className={`h-1.5 w-1.5 rounded-full ${videoConnected ? 'bg-[#25C86E]' : 'bg-[#A7A29D]'}`} />
                    {videoConnected ? 'Connected' : 'Ended'}
                  </span>
                </div>
                <p className="text-right text-[10px] leading-[1.4] text-[#5E5954]">
                  {request.guestName}
                  <br />
                  {request.location} • {request.ticketCode}
                </p>
              </div>

              <div
                className="relative mt-3 h-[112px] overflow-hidden rounded-[9px] bg-cover bg-center"
                style={{
                  backgroundImage:
                    "url(https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=600&auto=format&fit=crop&q=80)",
                }}
              >
                <div className="absolute inset-0 bg-black/25" />
                <span className="absolute left-2 top-2 rounded bg-black/60 px-2 py-1 text-[8px] tracking-[0.08em] text-white">
                  ROBOT VIEW
                </span>
                <div className="absolute inset-x-7 top-1/2 h-px -rotate-6 bg-red-500/90" />
                <div className="absolute inset-x-9 top-[62%] h-px rotate-6 bg-red-500/80" />
                <span className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-1 text-[8px] text-white">02:35</span>
                <img
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160&auto=format&fit=crop&q=80"
                  alt="Guest video preview"
                  className="absolute bottom-2 right-2 h-10 w-[58px] rounded border border-white/70 object-cover"
                />
              </div>

              <div className="mt-3 flex items-center justify-between text-[10px] text-[#68635E]">
                <span className="flex items-center gap-1.5">
                  <Bot className="h-3.5 w-3.5" strokeWidth={1.7} />
                  HCRobot Online
                </span>
                <span className="flex items-center gap-1.5">
                  <Video className="h-3.5 w-3.5" strokeWidth={1.7} />
                  Camera Active
                </span>
              </div>

              <div className="mt-3 flex items-center gap-2">
                {[Mic, Video, Volume2].map((Icon, index) => (
                  <button
                    type="button"
                    key={index}
                    className="h-8 w-8 rounded-full bg-[#F0EFEC] flex items-center justify-center text-[#68635E] hover:bg-[#E5E2DE]"
                  >
                    <Icon className="h-3.5 w-3.5" strokeWidth={1.7} />
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handleToggleVideo}
                  className={`ml-auto flex items-center gap-2 rounded-[8px] px-3 py-2 text-[10px] font-medium text-white ${
                    videoConnected ? 'bg-[#D72E33] hover:bg-[#C5262B]' : 'bg-black hover:bg-[#252525]'
                  }`}
                >
                  <PhoneOff className="h-3.5 w-3.5" strokeWidth={1.7} />
                  {videoConnected ? 'End Call' : 'Reconnect'}
                </button>
              </div>
            </section>

            <section className="rounded-[17px] bg-[#F0EFEC] px-4 py-4">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-medium tracking-[0.08em] text-[#77726D]">ASSIGNED STAFF</p>
                <button type="button" onClick={handleReassign} className="text-[10px] font-medium text-[#4F4A45] hover:text-black">
                  Reassign
                </button>
              </div>
              <div className="mt-3 flex items-center gap-3 rounded-[10px] bg-white px-3 py-3">
                <span className="h-8 w-8 rounded-full bg-[#ECEAE7] flex items-center justify-center text-[10px] font-medium text-[#68635E]">
                  {(request.assignedTo || 'JM')
                    .split(' ')
                    .slice(0, 2)
                    .map((part) => part[0])
                    .join('')}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-medium text-[#4A4641]">{request.assignedTo}</p>
                  <p className="truncate text-[10px] text-[#77726D]">{request.assignedRole}</p>
                </div>
                <MessageSquare className="h-4 w-4 text-[#77726D]" strokeWidth={1.7} />
              </div>
            </section>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setNoteOpen((current) => !current)}
                className="rounded-[9px] border border-[#D8D4CF] bg-white px-3 py-3 text-[10px] font-medium text-[#55504B] hover:bg-[#F7F5F2]"
              >
                <span className="inline-flex items-center gap-2"><FileText className="h-3.5 w-3.5" /> Add Note</span>
              </button>
              <button
                type="button"
                onClick={handleEscalate}
                className="rounded-[9px] border border-[#D8D4CF] bg-white px-3 py-3 text-[10px] font-medium text-[#55504B] hover:bg-[#F7F5F2]"
              >
                <span className="inline-flex items-center gap-2"><AlertTriangle className="h-3.5 w-3.5" /> Escalate</span>
              </button>
            </div>

            {noteOpen && (
              <div className="rounded-[12px] bg-white p-3 shadow-[0_4px_18px_rgba(55,48,42,0.05)]">
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={3}
                  placeholder="Add a Front Desk note..."
                  className="w-full resize-none rounded-[8px] border border-[#DDD9D4] px-3 py-2 text-[11px] outline-none focus:border-[#77726D]"
                />
                <button
                  type="button"
                  onClick={handleAddNote}
                  className="mt-2 w-full rounded-[8px] bg-black px-3 py-2 text-[10px] font-medium text-white"
                >
                  Save Note
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={handleComplete}
              className="w-full rounded-[9px] border border-[#D8D4CF] bg-white px-4 py-3 text-[10px] font-medium text-[#55504B] hover:bg-[#F7F5F2]"
            >
              <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5" /> Mark Completed</span>
            </button>

            <section className="rounded-[17px] bg-[#F0EFEC] px-4 py-5">
              <h3 className="text-[10px] font-medium tracking-[0.08em] text-[#77726D]">ACTIVITY LOG</h3>
              <div className="mt-4 space-y-4">
                {(request.activityLog || []).map((activity, index) => (
                  <div key={`${activity.title}-${index}`} className="relative pl-4 text-[10px] leading-[1.45] text-[#67625D]">
                    <span className="absolute left-0 top-1 h-2 w-2 rounded-full bg-[#8D8984]" />
                    <p className="font-medium text-[#4F4A45]">{activity.title}</p>
                    {activity.detail && <p>{activity.detail}</p>}
                    <p className="text-[#99938D]">{activity.time}</p>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
};
