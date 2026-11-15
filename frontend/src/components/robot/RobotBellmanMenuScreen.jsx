import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Edit3,
  Luggage,
  X,
} from 'lucide-react';
import { RoomPinModal } from './RoomPinModal';
import { RoomPickerModal } from './RoomPickerModal';
import { createBellRequest, fetchRoomBellStatus } from '../../services/operationsApi';
import {
  BELL_SERVICE_OPTIONS,
  GROUPS,
  TIME_OPTIONS,
  bellServiceLabel,
  bellRequestMessage,
  BellmanConfirmModal,
  BellmanStatusModal,
} from './RobotBellmanParts';

export { BELL_SERVICE_OPTIONS, bellServiceLabel, bellRequestMessage };

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
      <BellmanConfirmModal
        selected={selected}
        onClose={() => setSelected(null)}
        isEn={isEn}
        targetRoom={targetRoom}
        onOpenRoomPicker={() => setIsRoomPickerOpen(true)}
        bagCount={bagCount}
        setBagCount={setBagCount}
        timePref={timePref}
        setTimePref={setTimePref}
        errorMsg={errorMsg}
        isSubmitting={isSubmitting}
        onConfirmSubmit={handleConfirmSubmit}
      />

      {/* 4. MODAL TRA CỨU TIẾN ĐỘ */}
      <BellmanStatusModal
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
        isEn={isEn}
        targetRoom={targetRoom}
        isLoadingStatus={isLoadingStatus}
        onRefresh={() => loadRoomStatus(targetRoom)}
        statusData={statusData}
      />

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
