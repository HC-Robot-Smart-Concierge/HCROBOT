import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Clock, RefreshCw, ChevronRight, KeyRound } from 'lucide-react';
import { sanitizeDigitsOnly, sanitizePhoneNumber } from '../../utils/numberInputHelper';
import { StaffPageHeader } from '../../components/dashboard/RoomServiceFrame';
import { useStaffText } from '../../context/StaffLanguage';
import {
  fetchReceptionDashboard,
  updateReceptionRequest,
  fetchAllRooms,
  checkInRoom,
  checkOutRoom,
  syncRoomsFromRAG,
} from '../../services/operationsApi';
import { ReceptionRequestsTab } from './ReceptionRequestsTab';
import { ReceptionRoomsTab } from './ReceptionRoomsTab';
import { ReceptionCheckInOutModals } from './ReceptionCheckInOutModals';

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
          <ReceptionRequestsTab
            activeRequest={activeRequest}
          statusColor={statusColor}
          isCompleted={isCompleted}
          isInProgress={isInProgress}
          isViewingHistory={isViewingHistory}
          setIsViewingHistory={setIsViewingHistory}
          loadData={loadData}
          handleStartTask={handleStartTask}
          handleComplete={handleComplete}
          recentRequests={recentRequests}
          paginatedRecentRequests={paginatedRecentRequests}
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          setCurrentPage={setCurrentPage}
          normalizeRequest={normalizeRequest}
          setActiveRequest={setActiveRequest}
          st={st}
          />
        )}

        {activeTab === 'rooms' && (
          <ReceptionRoomsTab
            roomStats={roomStats}
          roomSearchQuery={roomSearchQuery}
          setRoomSearchQuery={setRoomSearchQuery}
          roomStatusFilter={roomStatusFilter}
          setRoomStatusFilter={setRoomStatusFilter}
          handleSyncFromRAG={handleSyncFromRAG}
          isSyncingRAG={isSyncingRAG}
          isLoadingRooms={isLoadingRooms}
          filteredRooms={filteredRooms}
          displayFloor={displayFloor}
          revealedPins={revealedPins}
          togglePinReveal={togglePinReveal}
          handleCopyPin={handleCopyPin}
          handleOpenCheckIn={handleOpenCheckIn}
          setCheckOutTargetRoom={setCheckOutTargetRoom}
          st={st}
          />
        )}

        <ReceptionCheckInOutModals
          checkInModalOpen={checkInModalOpen}
          checkInTargetRoom={checkInTargetRoom}
          setCheckInModalOpen={setCheckInModalOpen}
          handleSubmitCheckIn={handleSubmitCheckIn}
          checkInForm={checkInForm}
          setCheckInForm={setCheckInForm}
          isSubmittingRoom={isSubmittingRoom}
          checkOutTargetRoom={checkOutTargetRoom}
          setCheckOutTargetRoom={setCheckOutTargetRoom}
          handleConfirmCheckOut={handleConfirmCheckOut}
          displayFloor={displayFloor}
          st={st}
        />
      </div>
    </div>
  );
};
