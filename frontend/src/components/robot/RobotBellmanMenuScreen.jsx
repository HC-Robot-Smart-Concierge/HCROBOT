import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArchiveRestore,
  ArrowDownToLine,
  ArrowUpFromLine,
  Building,
  CheckCircle2,
  Clock,
  DoorOpen,
  Edit3,
  Layers,
  Luggage,
  RefreshCw,
  Send,
  X,
} from 'lucide-react';
import { RoomPinModal } from './RoomPinModal';
import { RoomPickerModal } from './RoomPickerModal';
import { createBellRequest, fetchRoomBellStatus } from '../../services/operationsApi';

// Keys must match backend app/services/bell_request_service.py BELL_SERVICES.
export const BELL_SERVICE_OPTIONS = [
  {
    key: 'luggage_delivery',
    group: 'luggage',
    icon: ArrowUpFromLine,
    nameVi: 'Mang hành lý lên phòng',
    nameEn: 'Bring luggage to room',
    descVi: 'Bellman mang hành lý từ sảnh hoặc xe lên tận phòng.',
    descEn: 'A bellman brings your bags from the lobby or car to your room.',
  },
  {
    key: 'luggage_pickup',
    group: 'luggage',
    icon: ArrowDownToLine,
    nameVi: 'Lấy hành lý xuống sảnh',
    nameEn: 'Take luggage down to lobby',
    descVi: 'Khi trả phòng hoặc ra xe, Bellman lên phòng lấy hành lý xuống.',
    descEn: 'At check-out or departure, a bellman collects your bags from the room.',
  },
  {
    key: 'luggage_storage',
    group: 'luggage',
    icon: Luggage,
    nameVi: 'Gửi giữ hành lý',
    nameEn: 'Store luggage',
    descVi: 'Giữ hành lý miễn phí tại quầy Bellman trước khi nhận hoặc sau khi trả phòng.',
    descEn: 'Free luggage storage at the Bell desk before check-in or after check-out.',
  },
  {
    key: 'luggage_retrieval',
    group: 'luggage',
    icon: ArchiveRestore,
    nameVi: 'Lấy lại hành lý đã gửi',
    nameEn: 'Retrieve stored luggage',
    descVi: 'Bellman lấy hành lý đã gửi và giao cho quý khách.',
    descEn: 'A bellman brings back the bags you stored with us.',
  },
  {
    key: 'room_move',
    group: 'room_move',
    icon: DoorOpen,
    nameVi: 'Chuyển đồ sang phòng mới',
    nameEn: 'Room move assistance',
    descVi: 'Chuyển hành lý và đồ đạc sang phòng mới. Lễ tân xác nhận phòng mới.',
    descEn: 'We move your belongings to the new room. Front Desk confirms the new room.',
  },
];

const GROUPS = [
  { id: 'all', nameVi: 'Tất Cả', nameEn: 'All', icon: Layers },
  { id: 'luggage', nameVi: 'Hành Lý', nameEn: 'Luggage', icon: Luggage },
  { id: 'room_move', nameVi: 'Chuyển Phòng', nameEn: 'Room Move', icon: DoorOpen },
];

const BAG_OPTIONS = ['1', '2', '3', '4+'];
const TIME_OPTIONS = [
  { id: 'now', vi: 'Ngay bây giờ', en: 'Right now' },
  { id: '15', vi: 'Sau 15 phút', en: 'In 15 min' },
  { id: '30', vi: 'Sau 30 phút', en: 'In 30 min' },
];

export const bellServiceLabel = (key, isEn) => {
  const option = BELL_SERVICE_OPTIONS.find((o) => o.key === key);
  if (!option) return isEn ? 'Luggage assistance' : 'Hỗ trợ hành lý';
  return isEn ? option.nameEn : option.nameVi;
};

// Spoken/printed result of a Bellman request created through the API.
export const bellRequestMessage = (result, isEn) => {
  const label = bellServiceLabel(result?.bell_service, isEn);
  const room = result?.location || result?.room_number || '';
  const code = result?.ticket_code;
  if (result?.duplicate) {
    return isEn
      ? `Room ${room} already has an open request "${label}" (#${code}). No new ticket was created.`
      : `Phòng ${room} đã có yêu cầu "${label}" đang chờ xử lý (#${code}). Không tạo thêm phiếu mới.`;
  }
  const isRoomMove = result?.bell_service === 'room_move';
  return isEn
    ? `Your request "${label}" for Room ${room} has been sent to the Bell team (ticket #${code}).${isRoomMove ? ' Front Desk will confirm your new room.' : ''}`
    : `Dạ yêu cầu "${label}" của Phòng ${room} đã được gửi tới bộ phận Bellman, mã phiếu #${code}.${isRoomMove ? ' Lễ tân sẽ xác nhận phòng mới với quý khách.' : ''}`;
};

const statusBadge = (status, isEn) => {
  const s = (status || '').toLowerCase();
  if (s === 'completed' || s === 'resolved' || s === 'done') {
    return { cls: 'bg-emerald-900/60 text-emerald-200 border-emerald-700/60', label: isEn ? 'Completed' : 'Đã hoàn tất' };
  }
  if (s === 'in progress' || s === 'assigned') {
    return { cls: 'bg-blue-900/60 text-blue-200 border-blue-700/60', label: isEn ? 'On the way' : 'Đang xử lý' };
  }
  return { cls: 'bg-stone-800 text-stone-300 border-stone-700', label: isEn ? 'Pending' : 'Chờ tiếp nhận' };
};

export const RobotBellmanMenuScreen = ({
  language = 'English',
  activeRoomNumber = '',
  authenticatedRoom = null,
  onPinVerifiedSuccess = () => {},
  onRoomChange = () => {},
  onClose = () => {},
  onRequestSuccess = () => {},
  onNotCheckedIn = () => {},
}) => {
  // Follow the guest conversation, independently of the staff portal language.
  const isEn = language === 'English' || language === 'EN';

  const [activeGroup, setActiveGroup] = useState('all');
  const [selected, setSelected] = useState(null);
  const [bagCount, setBagCount] = useState('1');
  const [timePref, setTimePref] = useState('now');
  const [targetRoom, setTargetRoom] = useState(activeRoomNumber || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [successTicket, setSuccessTicket] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [statusData, setStatusData] = useState(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);

  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pinActionTarget, setPinActionTarget] = useState('submit'); // 'submit' | 'status'
  const [isLocalPinVerified, setIsLocalPinVerified] = useState(false);
  const [isRoomPickerOpen, setIsRoomPickerOpen] = useState(false);

  const isRoomAuth = Boolean(
    targetRoom &&
      ((authenticatedRoom && String(authenticatedRoom).trim() === String(targetRoom).trim()) || isLocalPinVerified)
  );

  useEffect(() => {
    if (activeRoomNumber && String(activeRoomNumber).trim()) {
      setTargetRoom(String(activeRoomNumber).trim());
    }
  }, [activeRoomNumber]);

  const handleTargetRoomChange = (room) => {
    setTargetRoom(room);
    onRoomChange(room);
    if (authenticatedRoom && String(authenticatedRoom).trim() !== String(room).trim()) {
      setIsLocalPinVerified(false);
    }
  };

  const services = useMemo(
    () => (activeGroup === 'all' ? BELL_SERVICE_OPTIONS : BELL_SERVICE_OPTIONS.filter((s) => s.group === activeGroup)),
    [activeGroup]
  );

  const loadRoomStatus = useCallback(async (room) => {
    const value = String(room || '').trim();
    if (!value) return;
    setIsLoadingStatus(true);
    try {
      setStatusData(await fetchRoomBellStatus(value));
    } finally {
      setIsLoadingStatus(false);
    }
  }, []);

  const handleOpenStatusModal = useCallback(() => {
    if (!targetRoom || !String(targetRoom).trim()) {
      setIsRoomPickerOpen(true);
      return;
    }
    if (!isRoomAuth) {
      setPinActionTarget('status');
      setIsPinModalOpen(true);
      return;
    }
    setIsStatusModalOpen(true);
    loadRoomStatus(targetRoom);
  }, [targetRoom, isRoomAuth, loadRoomStatus]);

  const handleSelect = (service) => {
    setSelected(service);
    setBagCount('1');
    setTimePref('now');
    setErrorMsg('');
  };

  const doSubmitRequest = async (room = targetRoom) => {
    if (submittingRef.current || !selected) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    setErrorMsg('');
    const location = String(room).trim();
    const label = isEn ? selected.nameEn : selected.nameVi;
    const time = TIME_OPTIONS.find((t) => t.id === timePref);
    const description = [
      label,
      isEn ? `${bagCount} bag(s)` : `${bagCount} kiện`,
      isEn ? time.en : time.vi,
    ].join(' · ');
    try {
      const res = await createBellRequest({
        title: label,
        location,
        description,
        service_key: selected.key,
        source: 'HCRobot Kiosk Screen',
      });
      setSuccessTicket(res);
      setSelected(null);
      if (!res.duplicate) {
        onRequestSuccess({ ...res, room_number: location });
      }
    } catch (err) {
      console.error('[RobotBellmanMenuScreen] Submit error:', err);
      setErrorMsg(
        isEn ? 'Could not send your request. Please try again.' : 'Không thể gửi yêu cầu. Quý khách vui lòng thử lại.'
      );
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleConfirmSubmit = async () => {
    if (!targetRoom || !String(targetRoom).trim()) {
      setIsRoomPickerOpen(true);
      return;
    }
    if (!isRoomAuth) {
      setPinActionTarget('submit');
      setIsPinModalOpen(true);
      return;
    }
    await doSubmitRequest();
  };

  const handlePinSuccess = (res, room) => {
    const verified = room || (typeof res === 'string' ? res : res?.room_number) || String(targetRoom).trim();
    setIsLocalPinVerified(true);
    setIsPinModalOpen(false);
    onPinVerifiedSuccess(verified);
    if (pinActionTarget === 'status') {
      setIsStatusModalOpen(true);
      loadRoomStatus(verified);
    } else {
      doSubmitRequest(verified);
    }
  };

  const roomText = targetRoom ? `${isEn ? 'Room' : 'Phòng'} ${targetRoom}` : isEn ? 'Select Room' : 'Chọn số phòng';

  return (
    <div className="fixed inset-0 w-full h-[100dvh] max-h-[100dvh] bg-[#F5F2EB] text-[#1A1917] select-none flex overflow-hidden font-sans z-50 overscroll-none touch-none">
      {/* 1. LEFT SIDEBAR: NHÓM DỊCH VỤ & THOÁT VỀ ROBOT */}
      <aside className="w-36 sm:w-44 shrink-0 bg-[#EFECE4] border-r border-[#E3DFD5] flex flex-col h-full pl-[max(0.75rem,env(safe-area-inset-left,0px))]">
        <div className="p-3 border-b border-[#E3DFD5]">
          <div className="flex items-center gap-1.5 text-stone-500 text-[10px] uppercase font-bold tracking-wider">
            <Luggage className="w-3.5 h-3.5 text-stone-600" />
            <span>Bellman</span>
          </div>
          <h2 className="text-xs sm:text-sm font-black text-stone-900 mt-0.5">{isEn ? 'Luggage' : 'Hành Lý'}</h2>
        </div>

        <nav className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
          {GROUPS.map((group) => {
            const GroupIcon = group.icon;
            const isActive = activeGroup === group.id;
            return (
              <button
                key={group.id}
                type="button"
                onClick={() => setActiveGroup(group.id)}
                aria-pressed={isActive}
                className={`w-full p-2.5 rounded-xl text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                  isActive ? 'bg-[#1A1917] text-white shadow-xs font-bold' : 'hover:bg-[#E5E1D8] text-stone-700 font-medium'
                }`}
              >
                <GroupIcon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-stone-500'}`} />
                <span className="text-xs truncate">{isEn ? group.nameEn : group.nameVi}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-2 border-t border-[#E3DFD5]">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 px-3 rounded-xl bg-stone-200 hover:bg-stone-300 text-stone-800 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            <span>{isEn ? 'Back to Robot' : 'Về Robot'}</span>
          </button>
        </div>
      </aside>

      {/* 2. MAIN AREA: HEADER + LƯỚI DỊCH VỤ */}
      <main className="flex-1 flex flex-col h-full min-w-0 bg-[#F5F2EB]">
        <header className="h-12 sm:h-14 px-3 sm:px-5 border-b border-[#E3DFD5] flex items-center justify-between shrink-0 gap-2">
          <h1 className="text-xs sm:text-sm font-black text-stone-900 truncate min-w-0">
            {isEn ? 'Luggage & Bell Services' : 'Hành Lý & Bellman'}
          </h1>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenStatusModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white hover:bg-stone-50 border border-[#E3DFD5] hover:border-stone-400 text-[11px] font-bold text-stone-700 shadow-2xs transition-all cursor-pointer active:scale-95"
              title={isEn ? 'Check request progress (requires PIN)' : 'Tra cứu tiến độ yêu cầu (cần mã PIN)'}
            >
              <Clock className="w-3.5 h-3.5 text-stone-500" />
              <span>{isEn ? 'Status' : 'Tiến độ'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsRoomPickerOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white hover:bg-stone-50 border border-[#E3DFD5] hover:border-stone-400 text-[11px] font-bold text-stone-800 shadow-2xs transition-all cursor-pointer active:scale-95"
              title={isEn ? 'Tap to select or change your room' : 'Chạm để chọn hoặc đổi số phòng'}
            >
              <span className={`w-2 h-2 rounded-full ${targetRoom ? 'bg-emerald-500' : 'bg-stone-400'}`} />
              <span>{roomText}</span>
              <Edit3 className="w-3 h-3 text-stone-400" />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-stone-200 text-stone-600 flex items-center justify-center transition-colors cursor-pointer"
              title={isEn ? 'Close' : 'Đóng'}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-3 sm:p-4 custom-scrollbar">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3 pb-8">
            {services.map((service) => {
              const ServiceIcon = service.icon;
              return (
                <div
                  key={service.key}
                  onClick={() => handleSelect(service)}
                  className="bg-white rounded-2xl border border-[#E3DFD5] hover:border-stone-400 shadow-2xs hover:shadow-md p-3 sm:p-3.5 flex flex-col justify-between transition-all group cursor-pointer active:scale-[0.99] min-h-[140px]"
                >
                  <div>
                    <div className="w-8 h-8 rounded-xl bg-[#EFECE4] border border-[#E3DFD5] text-stone-700 flex items-center justify-center group-hover:bg-[#1A1917] group-hover:text-white transition-colors">
                      <ServiceIcon className="w-4 h-4" />
                    </div>
                    <h3 className="text-xs sm:text-[13px] font-bold text-stone-900 mt-2 line-clamp-1">
                      {isEn ? service.nameEn : service.nameVi}
                    </h3>
                    <p className="text-[10px] sm:text-[11px] text-stone-500 mt-1 line-clamp-2 leading-relaxed">
                      {isEn ? service.descEn : service.descVi}
                    </p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-stone-100 flex justify-end">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelect(service);
                      }}
                      className="h-7 px-3 rounded-lg bg-[#1A1917] hover:bg-stone-800 text-white text-[11px] font-bold cursor-pointer transition-all active:scale-95"
                    >
                      {isEn ? 'Request' : 'Yêu cầu'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {/* 3. MODAL XÁC NHẬN YÊU CẦU */}
      {selected && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3"
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-md max-h-[calc(100dvh-1.5rem)] overflow-y-auto bg-white rounded-3xl border border-[#E3DFD5] shadow-2xl p-4 sm:p-5 flex flex-col gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2.5 border-b border-[#E3DFD5]">
              <h3 className="text-xs sm:text-sm font-bold text-stone-900">
                {isEn ? 'Confirm Bellman Request' : 'Xác nhận yêu cầu Bellman'}
              </h3>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="w-7 h-7 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-500 flex items-center justify-center cursor-pointer"
                title={isEn ? 'Close' : 'Đóng'}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-[#F5F2EB] border border-[#E3DFD5]">
              <p className="text-xs sm:text-sm font-bold text-stone-900">{isEn ? selected.nameEn : selected.nameVi}</p>
              <p className="text-[11px] text-stone-600 mt-1">{isEn ? selected.descEn : selected.descVi}</p>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-2xl bg-white border border-[#E3DFD5]">
              <div className="flex items-center gap-2 min-w-0">
                <Building className="w-4 h-4 text-stone-500 shrink-0" />
                <span className="text-xs font-semibold text-stone-700">{isEn ? 'Room:' : 'Phòng:'}</span>
                <span className="text-xs font-mono font-black text-stone-900 truncate">
                  {targetRoom || (isEn ? 'Not selected' : 'Chưa chọn')}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsRoomPickerOpen(true)}
                className="text-xs font-bold text-stone-800 px-2.5 py-1 rounded-xl bg-stone-100 hover:bg-stone-200 border border-stone-300 cursor-pointer active:scale-95 flex items-center gap-1"
              >
                <span>{targetRoom ? (isEn ? 'Change' : 'Đổi phòng') : isEn ? 'Select' : 'Chọn phòng'}</span>
                <Edit3 className="w-3 h-3 text-stone-500" />
              </button>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-1">
                {isEn ? 'Number of bags' : 'Số kiện hành lý'}
              </p>
              <div className="grid grid-cols-4 gap-2" role="group">
                {BAG_OPTIONS.map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => setBagCount(count)}
                    aria-pressed={bagCount === count}
                    className={`py-2 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                      bagCount === count
                        ? 'bg-[#1A1917] text-white border-[#1A1917]'
                        : 'bg-[#F5F2EB] text-stone-700 border-[#E3DFD5] hover:bg-stone-200'
                    }`}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-1">
                {isEn ? 'When' : 'Thời gian'}
              </p>
              <div className="grid grid-cols-3 gap-2" role="group">
                {TIME_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setTimePref(option.id)}
                    aria-pressed={timePref === option.id}
                    className={`py-2 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                      timePref === option.id
                        ? 'bg-[#1A1917] text-white border-[#1A1917]'
                        : 'bg-[#F5F2EB] text-stone-700 border-[#E3DFD5] hover:bg-stone-200'
                    }`}
                  >
                    {isEn ? option.en : option.vi}
                  </button>
                ))}
              </div>
            </div>

            {errorMsg && (
              <div className="p-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="pt-1 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="flex-1 py-2 rounded-xl bg-stone-200 hover:bg-stone-300 text-stone-800 text-xs font-bold cursor-pointer"
              >
                {isEn ? 'Cancel' : 'Hủy'}
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmSubmit}
                className="flex-2 py-2 rounded-xl bg-[#1A1917] hover:bg-stone-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-sm disabled:bg-stone-300"
              >
                {isSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>{isEn ? 'Send Request' : 'Gửi yêu cầu'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. MODAL TRA CỨU TIẾN ĐỘ */}
      {isStatusModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
          onClick={() => setIsStatusModalOpen(false)}
        >
          <div
            className="w-full max-w-sm sm:max-w-md max-h-[calc(100dvh-1.5rem)] bg-stone-900 border border-stone-800 text-stone-100 rounded-3xl p-4 sm:p-5 shadow-2xl flex flex-col gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-stone-800 pb-2.5">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-stone-300" />
                <h3 className="text-xs sm:text-sm font-bold">{isEn ? 'Bellman Request Status' : 'Tiến Độ Yêu Cầu Bellman'}</h3>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={isLoadingStatus}
                  onClick={() => loadRoomStatus(targetRoom)}
                  className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-stone-200"
                  title={isEn ? 'Refresh' : 'Làm mới'}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingStatus ? 'animate-spin text-stone-200' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={() => setIsStatusModalOpen(false)}
                  className="p-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-stone-200"
                  title={isEn ? 'Close' : 'Đóng'}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <p className="text-xs text-stone-400">
              {isEn ? 'Room' : 'Phòng'} <strong className="text-stone-100">{targetRoom}</strong>
            </p>

            <div className="min-h-0 overflow-y-auto space-y-2 custom-scrollbar pr-1">
              {isLoadingStatus ? (
                <div className="p-8 text-center text-xs text-stone-400">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-stone-300" />
                  <p>{isEn ? 'Checking with the Bell team...' : 'Đang kiểm tra với bộ phận Bellman...'}</p>
                </div>
              ) : !statusData?.requests?.length ? (
                <div className="p-8 text-center text-xs text-stone-400 bg-stone-800/40 rounded-2xl border border-stone-800">
                  <Luggage className="w-6 h-6 text-stone-500 mx-auto mb-2 opacity-60" />
                  <p className="font-semibold text-stone-300">
                    {isEn ? `No Bellman requests for Room ${targetRoom}` : `Phòng ${targetRoom} chưa có yêu cầu Bellman nào`}
                  </p>
                </div>
              ) : (
                statusData.requests.map((req) => {
                  const badge = statusBadge(req.status, isEn);
                  return (
                    <article key={req.id || req.ticket_code} className="p-3 rounded-2xl border border-stone-800 bg-stone-800/60 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className="text-[10px] font-mono font-bold text-stone-400">#{req.ticket_code}</span>
                          <h4 className="text-xs sm:text-sm font-bold text-stone-100 break-words">
                            {bellServiceLabel(req.bell_service, isEn)}
                          </h4>
                        </div>
                        <span className={`shrink-0 px-2 py-0.5 rounded-md text-[10px] font-bold border ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </div>
                      {req.description && (
                        <p className="text-[10px] sm:text-[11px] text-stone-300 break-words">{req.description}</p>
                      )}
                      <p className="text-[10px] text-stone-400">
                        {isEn ? 'Bellman:' : 'Nhân viên:'}{' '}
                        <strong className="text-stone-200">{req.assigned_to || (isEn ? 'Bell team' : 'Đội Bellman')}</strong>
                      </p>
                    </article>
                  );
                })
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsStatusModalOpen(false)}
              className="w-full py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold cursor-pointer"
            >
              {isEn ? 'Back to Menu' : 'Quay lại danh mục'}
            </button>
          </div>
        </div>
      )}

      {/* 5. CHẠM CHỌN SỐ PHÒNG */}
      <RoomPickerModal
        isOpen={isRoomPickerOpen}
        onClose={() => setIsRoomPickerOpen(false)}
        onSelectRoom={(pickedRoom) => {
          handleTargetRoomChange(pickedRoom);
          setIsRoomPickerOpen(false);
        }}
        initialFloor={targetRoom && String(targetRoom).startsWith('4') ? '4' : '3'}
        title={isEn ? 'Select Guest Room' : 'Chọn Số Phòng Lưu Trú'}
        subtitle={isEn ? 'Tap your room number on the screen' : 'Chạm trực tiếp vào số phòng của quý khách trên màn hình'}
        iconType="concierge"
      />

      {/* 6. THÔNG BÁO GỬI THÀNH CÔNG / ĐÃ CÓ YÊU CẦU */}
      {successTicket && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xs w-full p-5 text-center border border-[#E3DFD5] shadow-2xl space-y-3">
            <div className="w-11 h-11 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-stone-900">
                {successTicket.duplicate
                  ? isEn ? 'Request already open' : 'Yêu cầu đã có sẵn'
                  : isEn ? 'Request sent' : 'Đã gửi yêu cầu'}
              </h3>
              <p className="text-[11px] text-stone-500 mt-0.5">{bellRequestMessage(successTicket, isEn)}</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSuccessTicket(null)}
                className="flex-1 py-2 rounded-xl bg-stone-200 hover:bg-stone-300 text-stone-800 font-bold text-xs cursor-pointer"
              >
                {isEn ? 'Close' : 'Đóng'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSuccessTicket(null);
                  handleOpenStatusModal();
                }}
                className="flex-1 py-2 rounded-xl bg-[#1A1917] hover:bg-stone-800 text-white font-bold text-xs cursor-pointer"
              >
                {isEn ? 'View status' : 'Xem tiến độ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. XÁC THỰC PHÒNG BẰNG PIN / NFC (KHÔNG TẠO PHIẾU: MENU TỰ GỬI SAU KHI XÁC THỰC) */}
      {isPinModalOpen && (
        <RoomPinModal
          isOpen={isPinModalOpen}
          onClose={() => setIsPinModalOpen(false)}
          roomNumber={targetRoom}
          isSelectingRoomInitial={!targetRoom}
          onRoomSelect={(room) => handleTargetRoomChange(room)}
          skipTicketCreation={true}
          pendingAction={pinActionTarget === 'status' ? 'query_service_status' : 'bellman'}
          pendingItems={
            pinActionTarget === 'status'
              ? isEn ? 'Check Bellman request status' : 'Tra cứu tiến độ yêu cầu Bellman'
              : selected ? (isEn ? selected.nameEn : selected.nameVi) : isEn ? 'Luggage assistance' : 'Hỗ trợ hành lý'
          }
          onVerifiedSuccess={handlePinSuccess}
          onSuccess={handlePinSuccess}
          onNotCheckedIn={onNotCheckedIn}
        />
      )}
    </div>
  );
};
