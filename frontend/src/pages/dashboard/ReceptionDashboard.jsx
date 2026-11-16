import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  CheckCircle2,
  Clock,
  User,
  MapPin,
  RefreshCw,
  ArrowLeft,
  ChevronRight,
  Sparkles,
  KeyRound,
  Eye,
  EyeOff,
  ShieldCheck,
  DoorOpen,
  LogOut,
  LogIn,
  Search,
  Copy,
  Building2,
  AlertCircle,
  X,
} from 'lucide-react';
import { Pagination } from '../../components/common/Pagination';
import { handleNumericKeyDown, sanitizeDigitsOnly, sanitizePhoneNumber } from '../../utils/numberInputHelper';
import { StaffPageHeader } from '../../components/dashboard/RoomServiceFrame';
import { useStaffText, staffStatusLabel } from '../../context/StaffLanguage';
import {
  fetchReceptionDashboard,
  updateReceptionRequest,
  fetchAllRooms,
  checkInRoom,
  checkOutRoom,
  syncRoomsFromRAG,
} from '../../services/operationsApi';

const normalizeRequest = (request = {}) => ({
  ...request,
  ticketCode: request.ticket_code || request.ticketCode || request.id || 'REC-00000',
  title: request.title,
  createdLabel:
    request.created_label ||
    request.createdLabel ||
    (request.created_at ? new Date(request.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''),
  location: request.room_number || request.location || 'Lobby Desk',
  locationDetails: request.location_details || request.locationDetails || { floor: 'Lobby', category: 'Standard Room' },
  guestName: request.guest_name || request.guestName,
  guestTier: request.guest_tier || request.guestTier || 'Standard',
  guestStayDetails: request.guest_stay_details || request.guestStayDetails,
  description: request.description,
  attachedMedia: request.attached_media || request.attachedMedia || [],
  transcript: request.transcript || [],
  assistanceStatus: request.assistance_status || request.assistanceStatus || 'Connected',
  assignedTo: request.assigned_to || request.assignedTo || request.assigned_staff_name || '',
  assignedRole: request.assigned_role || request.assignedRole || 'Lễ tân trực ca',
  activityLog: request.activity_log || request.activityLog || [],
  status: request.status || 'Pending',
});

export const ReceptionDashboard = ({ currentUser, onNotify = () => {}, onNavigate }) => {
  const st = useStaffText();
  const displayFloor = (floor) => st('Floor {0}', String(floor || '—').replace(/^(tầng|floor)\s*/i, ''));
  const staffName = currentUser?.full_name || currentUser?.name || 'Nhân viên Lễ tân';

  const [activeTab, setActiveTab] = useState('requests'); // 'requests' | 'rooms'

  const [activeRequest, setActiveRequest] = useState(null);
  const [recentRequests, setRecentRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isViewingHistory, setIsViewingHistory] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Room & PIN management states
  const [rooms, setRooms] = useState([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [roomSearchQuery, setRoomSearchQuery] = useState('');
  const [roomStatusFilter, setRoomStatusFilter] = useState('all'); // 'all' | 'occupied' | 'available'
  const [revealedPins, setRevealedPins] = useState({});
  const [isSyncingRAG, setIsSyncingRAG] = useState(false);
  const [checkInModalOpen, setCheckInModalOpen] = useState(false);
  const [checkInTargetRoom, setCheckInTargetRoom] = useState(null);
  const [checkInForm, setCheckInForm] = useState({
    guest_name: '',
    guest_phone: '',
    room_phone: '',
    identity_number: '',
    pin_code: '',
  });
  const [checkOutTargetRoom, setCheckOutTargetRoom] = useState(null);
  const [isSubmittingRoom, setIsSubmittingRoom] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetchReceptionDashboard();
      if (response && response.current_request) {
        setActiveRequest(normalizeRequest(response.current_request));
        setIsViewingHistory(false);
      } else {
        setActiveRequest(null);
        setIsViewingHistory(false);
      }

      if (Array.isArray(response?.recent_requests)) {
        setRecentRequests(response.recent_requests);
      }
    } catch (err) {
      console.error('Lỗi khi tải dữ liệu Reception Dashboard:', err);
      setActiveRequest(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadRooms = useCallback(async () => {
    setIsLoadingRooms(true);
    try {
      const data = await fetchAllRooms();
      if (Array.isArray(data)) {
        setRooms(data);
      }
    } catch (err) {
      console.error('Lỗi khi tải danh sách phòng:', err);
      onNotify(st("Unable to load rooms."));
    } finally {
      setIsLoadingRooms(false);
    }
  }, [onNotify]);

  useEffect(() => {
    loadData();
    loadRooms();
  }, [loadData, loadRooms]);

  const handleStartTask = async () => {
    if (!activeRequest) return;
    const currentTicket = activeRequest.ticketCode;
    setActiveRequest((prev) => (prev ? { ...prev, status: 'In Progress', assignedTo: staffName } : null));

    await updateReceptionRequest(
      activeRequest.ticketCode || activeRequest.id,
      { status: 'In Progress', assigned_to: staffName }
    );
    onNotify(st("Started request {0}.", currentTicket));
    await loadData();
  };

  const handleComplete = async () => {
    if (!activeRequest) return;
    const currentTicket = activeRequest.ticketCode;
    
    // Đánh dấu hoàn tất trên server
    await updateReceptionRequest(
      activeRequest.ticketCode || activeRequest.id,
      { status: 'Completed', assigned_to: staffName }
    );
    onNotify(st("Completed request {0}.", currentTicket));

    // Tự động tải lại: Nếu còn yêu cầu chờ thì tải yêu cầu tiếp theo, nếu hết thì chuyển sang màn hình hoàn tất
    await loadData();
  };

  // Check-in & Check-out handlers
  const handleOpenCheckIn = (room) => {
    setCheckInTargetRoom(room);
    setCheckInForm({
      guest_name: '',
      guest_phone: room.current_guest_phone || '',
      room_phone: room.room_phone || `Ext ${room.room_number}`,
      identity_number: '',
      pin_code: '',
    });
    setCheckInModalOpen(true);
  };

  const handleGenerateNewPin = () => {
    const randomPin = Math.floor(100000 + Math.random() * 900000).toString();
    setCheckInForm((prev) => ({ ...prev, pin_code: randomPin }));
  };

  const handleSubmitCheckIn = async (e) => {
    e?.preventDefault();
    if (!checkInTargetRoom) return;
    if (!checkInForm.guest_name.trim()) {
      onNotify(st("Enter the guest’s full name."));
      return;
    }
    const cleanDigits = sanitizeDigitsOnly(checkInForm.identity_number);
    if (!cleanDigits || cleanDigits.length < 4) {
      onNotify(st("Enter an ID or passport number with at least 4 digits to generate a PIN."));
      return;
    }
    const expectedPin = cleanDigits.slice(-4);
    if (!checkInForm.pin_code || checkInForm.pin_code.trim().length !== 4) {
      checkInForm.pin_code = expectedPin;
    }
    setIsSubmittingRoom(true);
    try {
      const res = await checkInRoom(checkInTargetRoom.id, {
        guest_name: checkInForm.guest_name.trim(),
        guest_phone: sanitizePhoneNumber(checkInForm.guest_phone) || undefined,
        room_phone: checkInForm.room_phone.trim() || undefined,
        identity_number: cleanDigits,
        pin_code: checkInForm.pin_code.trim() || undefined,
      });
      onNotify(st("Room {0} checked in. PIN: {1}", res.room_number, res.pin_code));
      setCheckInModalOpen(false);
      await loadRooms();
    } catch (err) {
      onNotify(err.message || st("Unable to check in."));
    } finally {
      setIsSubmittingRoom(false);
    }
  };

  const handleConfirmCheckOut = async () => {
    if (!checkOutTargetRoom) return;
    setIsSubmittingRoom(true);
    try {
      await checkOutRoom(checkOutTargetRoom.id);
      onNotify(st("Room {0} checked out. The PIN has been revoked.", checkOutTargetRoom.room_number));
      setCheckOutTargetRoom(null);
      await loadRooms();
    } catch (err) {
      onNotify(err.message || st("Unable to check out."));
    } finally {
      setIsSubmittingRoom(false);
    }
  };

  const togglePinReveal = (roomId) => {
    setRevealedPins((prev) => ({
      ...prev,
      [roomId]: !prev[roomId],
    }));
  };

  const handleCopyPin = (pin, roomNum) => {
    if (!pin) return;
    navigator.clipboard.writeText(pin);
    onNotify(st("Copied the 4-digit PIN for room {0}: {1}", roomNum, pin));
  };

  const isCompleted = activeRequest?.status === 'Completed';
  const isInProgress = activeRequest?.status === 'In Progress';

  const statusColor = isCompleted
    ? 'text-[#258955]'
    : isInProgress
    ? 'text-[#3D72B9]'
    : 'text-[#C9222A]';

  const totalPages = Math.max(1, Math.ceil(recentRequests.length / pageSize));
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedRecentRequests = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return recentRequests.slice(start, start + pageSize);
  }, [recentRequests, currentPage, pageSize]);

  const handleSyncFromRAG = async () => {
    setIsSyncingRAG(true);
    try {
      const res = await syncRoomsFromRAG();
      onNotify(res.message || st("Rooms synced from the system room directory."));
      await loadRooms();
    } catch (err) {
      console.error('Lỗi khi đồng bộ phòng từ RAG:', err);
      onNotify(st("Unable to sync rooms."));
    } finally {
      setIsSyncingRAG(false);
    }
  };

  const roomStats = useMemo(() => {
    const total = rooms.length;
    const occupied = rooms.filter((r) => (r.status || '').toLowerCase() === 'occupied').length;
    const available = rooms.filter((r) => (r.status || '').toLowerCase() === 'available').length;
    const occupancyRate = total > 0 ? Math.round((occupied / total) * 100) : 0;
    return { total, occupied, available, occupancyRate };
  }, [rooms]);

  const filteredRooms = useMemo(() => {
    return rooms.filter((room) => {
      const statusLower = (room.status || '').toLowerCase();
      if (roomStatusFilter !== 'all' && statusLower !== roomStatusFilter.toLowerCase()) {
        return false;
      }
      if (!roomSearchQuery.trim()) return true;
      const q = roomSearchQuery.toLowerCase().trim();
      const matchRoom = (room.room_number || '').toLowerCase().includes(q);
      const matchGuest = (room.guest_name || room.current_guest_name || '').toLowerCase().includes(q);
      const matchId = (room.identity_number || '').toLowerCase().includes(q);
      const matchType = (room.room_type || '').toLowerCase().includes(q);
      return matchRoom || matchGuest || matchId || matchType;
    });
  }, [rooms, roomStatusFilter, roomSearchQuery]);

  return (
    <div className="staff-page-body reception-dashboard flex-1 overflow-y-auto custom-scrollbar bg-[#FCFAF7] font-sans">
      <div className="staff-page-container w-full max-w-[1180px] mx-auto px-6 sm:px-8 pt-4 pb-12">
        {/* Header toolbar */}
        <StaffPageHeader className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#EBE8E3] mb-4">
          <div>
            <h1 className="text-base font-bold text-[#211F1D]">{st("Reception & Front Desk")} </h1>
            <p>{st('Manage guest requests, room occupancy and check-in details.')}</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (activeTab === 'requests') loadData();
                else loadRooms();
              }}
              disabled={isLoading || isLoadingRooms}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-stone-700 bg-white border border-[#E0DDD8] rounded-lg hover:bg-stone-50 transition-colors shadow-2xs cursor-pointer"
              title={st("Refresh data")}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading || isLoadingRooms ? 'animate-spin' : ''}`} />
              <span>{st("Refresh")}</span>
            </button>
            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('Requests')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-stone-700 bg-white border border-[#E0DDD8] rounded-lg hover:bg-stone-50 transition-colors shadow-2xs cursor-pointer"
              >
                <span>{st("View all requests")}</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </StaffPageHeader>

        {/* Tab switchers */}
        <div className="reception-tabs" role="group" aria-label={st('Reception views')}>
          <button
            type="button"
            onClick={() => setActiveTab('requests')}
            aria-pressed={activeTab === 'requests'}
          >
            <Clock className="h-3.5 w-3.5" />
            <span>{st("Incoming requests")}</span>
            {recentRequests.length > 0 && (
              <span className="px-1.5 py-0.2 bg-stone-100 text-stone-700 text-[10px] rounded-full">
                {recentRequests.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('rooms');
              if (rooms.length === 0) loadRooms();
            }}
            aria-pressed={activeTab === 'rooms'}
          >
            <KeyRound className="h-3.5 w-3.5 text-amber-600" />
            <span>{st("Rooms & PINs")}</span>
            {rooms.length > 0 && (
              <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-full">
                {roomStats.occupied}/{roomStats.total}
              </span>
            )}
          </button>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: PHIẾU YÊU CẦU LỄ TÂN */}
        {/* ========================================================================= */}
        {activeTab === 'requests' && (
          <div>
            {activeRequest ? (
              <div>
                <header className="reception-panel rounded-2xl bg-white p-5 border border-[#E8E5E0] shadow-2xs flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2.5 text-[11px] text-[#77726D]">
                      <span className="rounded bg-[#EFEEEB] px-2.5 py-1 font-mono font-bold tracking-wide text-stone-800">
                        {activeRequest.ticketCode}
                      </span>
                      <span>{st('Created:')} {activeRequest.createdLabel || st('Just now')}</span>
                      <span className={`font-bold ${statusColor}`}>● {st(staffStatusLabel(activeRequest.status))}</span>
                      {isViewingHistory && (
                        <span className="px-2 py-0.5 text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 rounded">{st("Reviewing history")} </span>
                      )}
                    </div>
                    <h2 className="mt-2 text-base font-bold text-[#211F1D]">{activeRequest.title || st('Reception & reservation request')}</h2>
                  </div>

                  <div className="flex items-center gap-2">
                    {isViewingHistory && (
                      <button
                        type="button"
                        onClick={loadData}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 px-3.5 py-2 text-[11px] font-bold text-stone-700 cursor-pointer transition-colors"
                      >
                        <ArrowLeft className="h-3.5 w-3.5" />{st("Back to current request")} </button>
                    )}

                    {isCompleted ? (
                      <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />{st("Completed")} </span>
                    ) : (
                      <>
                        {!isInProgress && (
                          <button
                            type="button"
                            onClick={handleStartTask}
                            className="rounded-lg bg-stone-900 px-4 py-2 text-[11px] font-bold text-white hover:bg-black cursor-pointer shadow-xs transition-colors"
                          >{st("Start request")} </button>
                        )}
                        <button
                          type="button"
                          onClick={handleComplete}
                          className="rounded-lg bg-emerald-600 px-4 py-2 text-[11px] font-bold text-white hover:bg-emerald-700 cursor-pointer shadow-xs transition-colors"
                        >{st("Mark completed")} </button>
                      </>
                    )}
                  </div>
                </header>

                {/* Thông tin chi tiết yêu cầu */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                  <article className="reception-panel rounded-xl bg-[#F4F3F0] p-4 border border-[#E8E5E0]">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#77726D] flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {st("Location")} </p>
                    <p className="mt-1 text-[13px] font-semibold text-[#2B2825]">{st(activeRequest.location)}</p>
                    <p className="mt-0.5 text-[11px] text-[#6F6A65]">
                      {st(activeRequest.locationDetails?.floor || 'Lobby area')} • {st(activeRequest.locationDetails?.category || 'Standard Room')}
                    </p>
                  </article>

                  <article className="reception-panel rounded-xl bg-[#F4F3F0] p-4 border border-[#E8E5E0]">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#77726D] flex items-center gap-1">
                      <User className="h-3 w-3" /> {st("Guest Profile")} </p>
                    <div className="mt-1 flex items-center gap-2">
                      <p className="truncate text-[13px] font-semibold text-[#2B2825]">{activeRequest.guestName || st('Hotel guest')}</p>
                      <span className="rounded bg-black px-1.5 py-0.5 text-[9px] font-bold text-white">
                        {st(activeRequest.guestTier || 'Standard')}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-[#6F6A65]">
                      {activeRequest.guestStayDetails || st('Guest staying at the hotel')}
                    </p>
                  </article>
                </div>

                <article className="reception-panel mt-4 rounded-xl bg-white p-5 border border-[#E8E5E0]">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#57524D]">{st("Issue Description")}</h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-[#3F3B37]">{activeRequest.description || st('No description provided.')}</p>

                  {activeRequest.attachedMedia && activeRequest.attachedMedia.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-[#F0ECE6]">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#77726D]">{st("Attached Media (")}{activeRequest.attachedMedia.length})
                      </p>
                      <div className="mt-2 flex gap-3">
                        {activeRequest.attachedMedia.map((media) => (
                          <img
                            key={media.url}
                            src={media.url}
                            alt={media.alt || st("Media")}
                            className="h-20 w-24 rounded object-cover border border-[#E5E2DD]"
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </article>

                {activeRequest.transcript && activeRequest.transcript.length > 0 && (
                  <article className="reception-panel mt-4 rounded-xl bg-[#F4F3F0] p-5 border border-[#E8E5E0]">
                    <div className="flex items-center justify-between gap-3 border-b border-[#E5E2DD] pb-3">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-[#4E4945]">{st("HCRobot Transcript")} </div>
                      <span className="text-[10px] text-[#716C67]">{st("Source: Voice Assistant")} </span>
                    </div>

                    <div className="mt-3 space-y-2.5">
                      {activeRequest.transcript.map((entry, index) => {
                        const isAssistant = entry.speaker === 'assistant';
                        return (
                          <div key={`${entry.time}-${index}`} className="flex items-start gap-2 text-[12px]">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${isAssistant ? 'bg-black text-white' : 'bg-[#E0DDD8] text-[#444]'}`}>
                              {isAssistant ? 'Robot' : st("Guest")}
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
                )}
              </div>
            ) : (
              <div className="reception-panel rounded-2xl border border-stone-200 bg-white p-10 text-center shadow-xs">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <h3 className="mt-4 text-base font-bold text-stone-900">{st("No pending requests")} </h3>
                <p className="mx-auto mt-1.5 max-w-md text-xs text-stone-500 leading-relaxed">{st("All Reception requests have been completed. Ready to receive new requests from guests and HCRobot.")} </p>
                <div className="reception-request-actions">
                  <button
                    type="button"
                    onClick={loadData}
                    className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-black transition-colors cursor-pointer"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />{st("Check for new requests")} </button>
                  {onNavigate && (
                    <button
                      type="button"
                      onClick={() => onNavigate('Requests')}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 transition-colors cursor-pointer"
                    >{st("View request history")} </button>
                  )}
                </div>
              </div>
            )}

            {/* Danh sách các yêu cầu gần đây */}
            {recentRequests.length > 0 && (
              <section className="reception-panel mt-6 rounded-2xl border border-[#E8E5E0] bg-white p-5 shadow-2xs">
                <div className="flex items-center justify-between pb-3 border-b border-[#F0ECE6]">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-stone-900">{st("Recent Reception requests")} </h3>
                    <p className="text-[11px] text-stone-500">{st("Recently received and processed support requests")} </p>
                  </div>
                  <span className="text-xs font-semibold text-stone-500">
                    {recentRequests.length} {st("requests")} </span>
                </div>

                <div className="mt-3 divide-y divide-stone-100">
                  {paginatedRecentRequests.map((r) => {
                    const rTicket = r.ticket_code || r.ticketCode || r.id;
                    const isSelected = activeRequest && (activeRequest.ticketCode === rTicket);
                    const statusLower = String(r.status || '').toLowerCase();
                    const isDone = ['completed', 'done', 'hoàn tất', 'đã hoàn thành'].includes(statusLower);
                    const isProg = statusLower.includes('progress');

                    return (
                      <div
                        key={rTicket}
                        onClick={() => {
                          setActiveRequest(normalizeRequest(r));
                          setIsViewingHistory(true);
                        }}
                        className={`flex items-center justify-between py-3 px-3 rounded-xl transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-amber-50/60 border border-amber-200'
                            : 'hover:bg-stone-50 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="font-mono text-xs font-bold text-stone-700 bg-stone-100 px-2 py-1 rounded">
                            {rTicket}
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-stone-900 truncate">
                              {r.title}
                            </p>
                            <p className="text-[11px] text-stone-500">
                              {r.room_number || r.location || st("Lobby")} • {r.guest_name || st("Hotel guest")}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              isDone
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : isProg
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                          >
                            ● {st(staffStatusLabel(r.status))}
                          </span>
                          <ChevronRight className="h-4 w-4 text-stone-400" />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {recentRequests.length > 0 && (
                  <Pagination
                    currentPage={currentPage}
                    totalItems={recentRequests.length}
                    pageSize={pageSize}
                    onPageChange={setCurrentPage}
                    itemName={st("requests")}
                    className="mt-3 rounded-2xl border border-[#E5E1D8] shadow-xs bg-white"
                  />
                )}
              </section>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: QUẢN LÝ PHÒNG & MÃ PIN KIOSK */}
        {/* ========================================================================= */}
        {activeTab === 'rooms' && (
          <div className="space-y-5">
            {/* KPI stats cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="reception-panel p-4 rounded-xl bg-white border border-[#E8E5E0] shadow-2xs">
                <div className="flex items-center justify-between text-[#77726D]">
                  <span className="text-[11px] font-semibold uppercase tracking-wider">{st("Total rooms")}</span>
                  <Building2 className="h-4 w-4 text-stone-500" />
                </div>
                <div className="mt-2 text-2xl font-black text-stone-900 font-mono">
                  {roomStats.total}
                </div>
                <div className="mt-0.5 text-[10px] text-stone-500">{st("Configured in the system")}</div>
              </div>

              <div className="reception-panel p-4 rounded-xl bg-white border border-[#E8E5E0] shadow-2xs">
                <div className="flex items-center justify-between text-emerald-700">
                  <span className="text-[11px] font-semibold uppercase tracking-wider">{st("Occupied")}</span>
                  <User className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="mt-2 text-2xl font-black text-emerald-700 font-mono">
                  {roomStats.occupied}
                </div>
                <div className="mt-0.5 text-[10px] text-emerald-600/80">{st("Occupancy:")} {roomStats.occupancyRate}%</div>
              </div>

              <div className="reception-panel p-4 rounded-xl bg-white border border-[#E8E5E0] shadow-2xs">
                <div className="flex items-center justify-between text-stone-600">
                  <span className="text-[11px] font-semibold uppercase tracking-wider">{st("Vacant")}</span>
                  <DoorOpen className="h-4 w-4 text-stone-500" />
                </div>
                <div className="mt-2 text-2xl font-black text-stone-700 font-mono">
                  {roomStats.available}
                </div>
                <div className="mt-0.5 text-[10px] text-stone-500">{st("Ready for check-in")}</div>
              </div>

              <div className="reception-panel p-4 rounded-xl bg-white border border-[#E8E5E0] shadow-2xs">
                <div className="flex items-center justify-between text-amber-700">
                  <span className="text-[11px] font-semibold uppercase tracking-wider">{st("Kiosk PIN security")}</span>
                  <ShieldCheck className="h-4 w-4 text-amber-600" />
                </div>
                <div className="mt-2 text-sm font-bold text-amber-800">{st("4-digit PIN / ID")} </div>
                <div className="mt-0.5 text-[10px] text-stone-500">{st("Robot voice verification")}</div>
              </div>
            </div>

            {/* Filter and search toolbar */}
            <div className="reception-panel flex flex-wrap items-center justify-between gap-3 p-3 bg-white rounded-xl border border-[#E8E5E0] shadow-2xs">
              <div className="flex items-center gap-2 flex-1 min-w-[240px]">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-400" />
                  <input
                    type="text"
                    value={roomSearchQuery}
                    onChange={(e) => setRoomSearchQuery(e.target.value)}
                    placeholder={st("Search by room, guest name or ID...")}
                    className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-stone-200 focus:outline-none focus:border-amber-500 bg-stone-50/50"
                  />
                  {roomSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setRoomSearchQuery('')}
                      aria-label={st('Clear search')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setRoomStatusFilter('all')}
                  className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors cursor-pointer ${
                    roomStatusFilter === 'all'
                      ? 'bg-stone-900 text-white'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >{st("All (")}{rooms.length})
                </button>
                <button
                  type="button"
                  onClick={() => setRoomStatusFilter('occupied')}
                  className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors cursor-pointer ${
                    roomStatusFilter === 'occupied'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >{st("Occupied (")}{roomStats.occupied})
                </button>
                <button
                  type="button"
                  onClick={() => setRoomStatusFilter('available')}
                  className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors cursor-pointer ${
                    roomStatusFilter === 'available'
                      ? 'bg-stone-700 text-white'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >{st("Vacant (")}{roomStats.available})
                </button>

                <button
                  type="button"
                  onClick={handleSyncFromRAG}
                  disabled={isSyncingRAG}
                  className="inline-flex items-center gap-1.5 px-3 py-1 text-xs rounded-lg font-medium bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition-colors cursor-pointer disabled:opacity-50 ml-2"
                  title={st("Sync rooms from the system room directory (301–310, 401–410)")}
                >
                  <RefreshCw className={`h-3 w-3 ${isSyncingRAG ? 'animate-spin' : ''}`} />
                  <span>{st("Sync rooms")}</span>
                </button>
              </div>
            </div>

            {/* Room List Table */}
            <div className="reception-panel rounded-xl border border-[#E8E5E0] bg-white overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F8F7F4] border-b border-[#E8E5E0] text-[11px] font-bold text-stone-600 uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">{st("Room number")}</th>
                      <th className="py-3 px-4">{st("Status")}</th>
                      <th className="py-3 px-4">{st("Hotel guest")}</th>
                      <th className="py-3 px-4">{st("ID / passport")}</th>
                      <th className="py-3 px-4">{st("Kiosk PIN")}</th>
                      <th className="py-3 px-4 text-right">{st("Actions")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0ECE6]">
                    {isLoadingRooms ? (
                      <tr>
                        <td colSpan={6} className="py-10 text-center text-stone-400">
                          <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-stone-400" />{st("Loading rooms...")} </td>
                      </tr>
                    ) : filteredRooms.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-10 text-center text-stone-400">{st("No rooms match your filters.")} </td>
                      </tr>
                    ) : (
                      filteredRooms.map((room) => {
                        const isOccupied = (room.status || '').toLowerCase() === 'occupied';
                        const isPinRevealed = !!revealedPins[room.id];

                        return (
                          <tr key={room.id} className="hover:bg-stone-50/70 transition-colors">
                            {/* Số phòng & Tầng */}
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-black text-sm text-stone-900 bg-amber-50/90 border border-amber-200/80 px-2.5 py-0.5 rounded-md">
                                  {room.room_number}
                                </span>
                                <div>
                                  <div className="text-[11px] font-semibold text-stone-700">
                                    {st(room.room_type || 'Standard')}
                                  </div>
                                  <div className="text-[10px] text-stone-400">
                                    {displayFloor(room.floor)}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Trạng thái */}
                            <td className="py-3 px-4">
                              {isOccupied ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />{st("Occupied")} </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-stone-100 text-stone-600 border border-stone-200">
                                  <span className="h-1.5 w-1.5 rounded-full bg-stone-400" />{st("Vacant")} </span>
                              )}
                            </td>

                            {/* Khách lưu trú */}
                            <td className="py-3 px-4">
                              {isOccupied ? (
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <User className="h-3 w-3 text-stone-400" />
                                    <span className="font-semibold text-stone-800">
                                      {room.guest_name || st("Hotel guest")}
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-stone-500 font-mono mt-0.5 space-x-1.5">
                                    {(room.current_guest_phone || room.guest_phone) && (
                                      <span>{st("Phone:")} {room.current_guest_phone || room.guest_phone}</span>
                                    )}
                                    {(room.room_phone || room.roomPhone) && (
                                      <span className="text-amber-800 font-medium">({room.room_phone || room.roomPhone})</span>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-stone-400 italic">—</span>
                              )}
                            </td>

                            {/* CCCD / Passport */}
                            <td className="py-3 px-4">
                              {room.identity_number ? (
                                <div className="font-mono text-stone-700 text-xs">
                                  •••• {room.identity_number.slice(-4)}
                                </div>
                              ) : (
                                <span className="text-stone-400 italic">—</span>
                              )}
                            </td>

                            {/* Mã PIN Kiosk */}
                            <td className="py-3 px-4">
                              {room.pin_code ? (
                                <div className="inline-flex items-center gap-1.5 bg-stone-100 px-2 py-1 rounded-lg border border-stone-200">
                                  <KeyRound className="h-3 w-3 text-amber-600" />
                                  <span className="font-mono font-bold tracking-widest text-xs text-stone-900">
                                    {isPinRevealed ? room.pin_code : '••••••'}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => togglePinReveal(room.id)}
                                    className="text-stone-400 hover:text-stone-700 p-0.5 ml-1 transition-colors cursor-pointer"
                                    title={isPinRevealed ? st("Hide PIN") : st("Show PIN")}
                                  >
                                    {isPinRevealed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleCopyPin(room.pin_code, room.room_number)}
                                    className="text-stone-400 hover:text-amber-700 p-0.5 transition-colors cursor-pointer"
                                    title={st("Copy PIN")}
                                  >
                                    <Copy className="h-3 w-3" />
                                  </button>
                                </div>
                              ) : (
                                <span className="text-stone-400 italic text-[11px]">{st("No PIN assigned")}</span>
                              )}
                            </td>

                            {/* Thao tác */}
                            <td className="py-3 px-4 text-right">
                              {isOccupied ? (
                                <button
                                  type="button"
                                  onClick={() => setCheckOutTargetRoom(room)}
                                  className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer"
                                >
                                  <LogOut className="h-3 w-3" />
                                  <span>{st("Check-out")}</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleOpenCheckIn(room)}
                                  className="inline-flex items-center gap-1 px-3 py-1 text-xs font-bold text-white bg-stone-900 hover:bg-black rounded-lg transition-colors shadow-2xs cursor-pointer"
                                >
                                  <LogIn className="h-3 w-3" />
                                  <span>{st("Check-in")}</span>
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL: CHECK-IN PHÒNG & CẤP MÃ PIN */}
        {/* ========================================================================= */}
        {checkInModalOpen && checkInTargetRoom && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
            <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl border border-stone-200 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600 border border-amber-200">
                    <KeyRound className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-stone-900">{st("Check in room")} {checkInTargetRoom.room_number}
                    </h3>
                    <p className="text-[11px] text-stone-500">
                      {st(checkInTargetRoom.room_type || 'Standard')} • {displayFloor(checkInTargetRoom.floor)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCheckInModalOpen(false)}
                  aria-label={st('Close')}
                  className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleSubmitCheckIn} className="mt-4 space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">{st("Guest’s full name")} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={st("e.g. Alex Nguyen")}
                    value={checkInForm.guest_name}
                    onChange={(e) => setCheckInForm((prev) => ({ ...prev, guest_name: e.target.value }))}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-stone-300 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 bg-white"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">{st("Guest mobile phone")} <span className="text-stone-400 font-normal">{st("(Door access calls)")}</span>
                    </label>
                    <input
                      type="tel"
                      inputMode="tel"
                      maxLength={15}
                      placeholder={st("e.g. 0901234567")}
                      value={checkInForm.guest_phone}
                      onKeyDown={(e) => handleNumericKeyDown(e, { allowPlus: true })}
                      onChange={(e) => {
                        const digits = sanitizePhoneNumber(e.target.value, 15);
                        setCheckInForm((prev) => ({ ...prev, guest_phone: digits }));
                      }}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-stone-300 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">{st("Room extension")} <span className="text-stone-400 font-normal">{st("(Internal calls)")}</span>
                    </label>
                    <input
                      type="text"
                      placeholder={st("e.g. Ext 301")}
                      value={checkInForm.room_phone}
                      onChange={(e) => setCheckInForm((prev) => ({ ...prev, room_phone: e.target.value }))}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-stone-300 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">{st("ID / passport number")} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={15}
                    required
                    placeholder={st("e.g. 079201012345 (numbers only)")}
                    value={checkInForm.identity_number}
                    onKeyDown={handleNumericKeyDown}
                    onChange={(e) => {
                      const digits = sanitizeDigitsOnly(e.target.value, 15);
                      const autoPin = digits.length >= 4 ? digits.slice(-4) : '';
                      setCheckInForm((prev) => ({
                        ...prev,
                        identity_number: digits,
                        pin_code: autoPin || prev.pin_code,
                      }));
                    }}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-stone-300 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 bg-white"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-stone-700">{st("4-digit Kiosk PIN (generated from ID)")} <span className="text-rose-500">*</span>
                    </label>
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    placeholder={st("Last 4 digits of ID")}
                    value={checkInForm.pin_code}
                    onKeyDown={handleNumericKeyDown}
                    onChange={(e) => {
                      const digits = sanitizeDigitsOnly(e.target.value, 4);
                      setCheckInForm((prev) => ({ ...prev, pin_code: digits }));
                    }}
                    className="w-full font-mono font-bold tracking-widest text-center px-3 py-2 text-sm rounded-lg border border-stone-300 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 bg-amber-50/30 text-stone-900"
                  />
                  <p className="mt-1 text-[10px] text-stone-500">{st("The 4-digit PIN is generated from the last 4 digits of the guest’s ID for ordering at the Robot Kiosk.")} </p>
                </div>

                <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setCheckInModalOpen(false)}
                    disabled={isSubmittingRoom}
                    className="px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded-lg cursor-pointer"
                  >{st("Cancel")} </button>
                  <button
                    type="submit"
                    disabled={isSubmittingRoom}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-stone-900 hover:bg-black rounded-lg shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    {isSubmittingRoom ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    )}
                    <span>{st("Confirm check-in")}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL: XÁC NHẬN CHECK-OUT */}
        {/* ========================================================================= */}
        {checkOutTargetRoom && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
            <div className="w-full max-w-sm max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl border border-stone-200 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 mx-auto">
                <AlertCircle className="h-6 w-6" />
              </div>
              <h3 className="mt-3 text-center text-sm font-bold text-stone-900">
                {st('Check out room {0}?', checkOutTargetRoom.room_number)}
              </h3>
              <p className="mt-1 text-center text-xs text-stone-500 leading-relaxed">{st("Guest")} <span className="font-bold text-stone-800">{checkOutTargetRoom.guest_name || st("Hotel guest")}</span> {st("will be checked out. The Kiosk PIN will be revoked and the room will become available for the next guest.")} </p>

              <div className="mt-5 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setCheckOutTargetRoom(null)}
                  disabled={isSubmittingRoom}
                  className="px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded-lg cursor-pointer"
                >{st("Close")} </button>
                <button
                  type="button"
                  onClick={handleConfirmCheckOut}
                  disabled={isSubmittingRoom}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingRoom && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  <span>{st("Confirm check-out")}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

