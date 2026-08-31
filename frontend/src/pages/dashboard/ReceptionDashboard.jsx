import React, { useEffect, useState } from 'react';
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
    await persistUpdate(
      { status: 'In Progress', assigned_to: staffName },
      { status: 'In Progress', assignedTo: staffName }
    );
    onNotify(`Đã bắt đầu xử lý ${request.ticketCode}`);
  };

  const handleComplete = async () => {
    await persistUpdate(
      { status: 'Completed', assigned_to: staffName },
      { status: 'Completed', assignedTo: staffName }
    );
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
        <header className="border-b border-[#EBE8E3] pb-3 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#77726D]">
              <span className="rounded bg-[#EFEEEB] px-2.5 py-1 font-semibold tracking-wide">
                {request.ticketCode}
              </span>
              <span>Created {request.createdLabel}</span>
              <span className={`font-bold ${statusColor}`}>● {request.status}</span>
            </div>
            <h2 className="mt-2 text-[16px] font-semibold text-[#211F1D]">{request.title}</h2>
          </div>

          <div className="flex items-center gap-2">
            {request.status !== 'Completed' && (
              <button
                type="button"
                onClick={handleStartTask}
                className="rounded-lg bg-black px-4 py-2 text-[11px] font-bold text-white hover:bg-[#252525] cursor-pointer"
              >
                Start Task
              </button>
            )}
            <button
              type="button"
              onClick={handleComplete}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-[11px] font-bold text-white hover:bg-emerald-700 cursor-pointer"
            >
              Mark Completed
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          <article className="rounded-xl bg-[#F4F3F0] p-4 border border-[#E8E5E0]">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#77726D]">Location</p>
            <p className="mt-1 text-[13px] font-semibold text-[#2B2825]">{request.location}</p>
            <p className="mt-0.5 text-[11px] text-[#6F6A65]">
              {request.locationDetails?.floor || 'West Wing'} • {request.locationDetails?.category || 'Standard Room'}
            </p>
          </article>

          <article className="rounded-xl bg-[#F4F3F0] p-4 border border-[#E8E5E0]">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#77726D]">Guest Profile</p>
            <div className="mt-1 flex items-center gap-2">
              <p className="truncate text-[13px] font-semibold text-[#2B2825]">{request.guestName}</p>
              <span className="rounded bg-black px-1.5 py-0.5 text-[9px] font-bold text-white">
                {request.guestTier || 'Standard'}
              </span>
            </div>
            <p className="mt-0.5 text-[11px] text-[#6F6A65]">
              {request.guestStayDetails}
            </p>
          </article>
        </div>

        <article className="mt-4 rounded-xl bg-white p-5 border border-[#E8E5E0]">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#57524D]">Issue Description</h3>
          <p className="mt-2 text-[13px] leading-relaxed text-[#3F3B37]">{request.description}</p>

          {request.attachedMedia && request.attachedMedia.length > 0 && (
            <div className="mt-4 pt-3 border-t border-[#F0ECE6]">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#77726D]">
                Attached Media ({request.attachedMedia.length})
              </p>
              <div className="mt-2 flex gap-3">
                {request.attachedMedia.map((media) => (
                  <img
                    key={media.url}
                    src={media.url}
                    alt={media.alt || 'Media'}
                    className="h-20 w-24 rounded object-cover border border-[#E5E2DD]"
                  />
                ))}
              </div>
            </div>
          )}
        </article>

        <article className="mt-4 rounded-xl bg-[#F4F3F0] p-5 border border-[#E8E5E0]">
          <div className="flex items-center justify-between gap-3 border-b border-[#E5E2DD] pb-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#4E4945]">
              HCRobot Transcript
            </div>
            <span className="text-[10px] text-[#716C67]">
              Source: Voice Assistant
            </span>
          </div>

          <div className="mt-3 space-y-2.5">
            {(request.transcript || []).map((entry, index) => {
              const isAssistant = entry.speaker === 'assistant';
              return (
                <div key={`${entry.time}-${index}`} className="flex items-start gap-2 text-[12px]">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${isAssistant ? 'bg-black text-white' : 'bg-[#E0DDD8] text-[#444]'}`}>
                    {isAssistant ? 'Robot' : 'Guest'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] text-[#888] mr-2">{entry.time}</span>
                    <span className="text-[#333]">"{entry.message}"</span>
                  </div>
                </div>
              );
            })}
          </div>
        </article>
      </div>
    </main>
  );
};

