import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Wrench, Clock, X, Search, Edit3,
} from 'lucide-react';
import { RoomPinModal } from './RoomPinModal';
import { RoomPickerModal } from './RoomPickerModal';
import {
  fetchMaintenanceCatalog,
  createMaintenanceRequest,
  fetchRoomMaintenanceStatus,
} from '../../services/operationsApi';
import {
  MAINTENANCE_CATEGORIES,
  FALLBACK_MAINTENANCE_CATALOG,
} from './robotMaintenanceData';
import {
  MaintenanceIssueGrid,
  MaintenanceConfirmAndSuccessModals,
} from './RobotMaintenanceViews';
import { MaintenanceStatusModal } from './RobotMaintenanceStatusModal';

export { MAINTENANCE_CATEGORIES, FALLBACK_MAINTENANCE_CATALOG };

export const RobotMaintenanceMenuScreen = ({
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

  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [catalogItems, setCatalogItems] = useState(FALLBACK_MAINTENANCE_CATALOG);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);

  // Selection & Room states
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [targetRoom, setTargetRoom] = useState(activeRoomNumber || '');
  const [timePreference, setTimePreference] = useState('ASAP'); // 'ASAP' | 'WHEN_AWAY'
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [successTicket, setSuccessTicket] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Status tracking modal states (Giống Room Service & Kitchen, bảo mật qua mã PIN)
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [statusData, setStatusData] = useState(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);

  // PIN modal & Touch Room Picker modal
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pinActionTarget, setPinActionTarget] = useState('submit'); // 'submit' | 'status'
  const [isLocalPinVerified, setIsLocalPinVerified] = useState(false);
  const [isRoomPickerOpen, setIsRoomPickerOpen] = useState(false);

  const isRoomAuth = Boolean(
    targetRoom &&
      ((authenticatedRoom && String(authenticatedRoom).trim() === String(targetRoom).trim()) ||
        isLocalPinVerified)
  );

  const handleTargetRoomChange = (val) => {
    setTargetRoom(val);
    if (typeof onRoomChange === 'function') {
      onRoomChange(val);
    }
    if (authenticatedRoom && String(authenticatedRoom).trim() !== String(val).trim()) {
      setIsLocalPinVerified(false);
    }
  };

  // Load catalog on mount
  useEffect(() => {
    let isMounted = true;
    const loadCatalog = async () => {
      setIsLoadingCatalog(true);
      try {
        const items = await fetchMaintenanceCatalog({ is_active: true });
        if (isMounted && Array.isArray(items) && items.length > 0) {
          setCatalogItems(items);
        }
      } catch (err) {
        console.warn('[RobotMaintenanceMenuScreen] Using fallback catalog:', err);
      } finally {
        if (isMounted) setIsLoadingCatalog(false);
      }
    };
    loadCatalog();
    return () => {
      isMounted = false;
    };
  }, []);

  // Sync activeRoomNumber
  useEffect(() => {
    if (activeRoomNumber && String(activeRoomNumber).trim()) {
      const r = String(activeRoomNumber).trim();
      setTargetRoom(r);
    }
  }, [activeRoomNumber]);

  // Load status logic
  const loadRoomStatus = useCallback(async (roomNum) => {
    const room = roomNum || targetRoom;
    if (!room || !String(room).trim()) return;
    setIsLoadingStatus(true);
    try {
      const res = await fetchRoomMaintenanceStatus(room);
      setStatusData(res);
    } catch (err) {
      console.warn('[RobotMaintenanceMenuScreen] Failed to load status:', err);
    } finally {
      setIsLoadingStatus(false);
    }
  }, [targetRoom]);

  // Mở modal Tra cứu tiến độ (Bảo mật: Bắt buộc chọn phòng và xác thực mã PIN phòng nếu chưa auth)
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

  // Filtered issues
  const filteredIssues = useMemo(() => {
    let list = catalogItems || [];
    if (activeCategory !== 'all') {
      list = list.filter((i) => i.category === activeCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (i) =>
          (i.name_vi && i.name_vi.toLowerCase().includes(q)) ||
          (i.name_en && i.name_en.toLowerCase().includes(q)) ||
          (i.description_vi && i.description_vi.toLowerCase().includes(q)) ||
          (i.description_en && i.description_en.toLowerCase().includes(q))
      );
    }
    return list;
  }, [catalogItems, activeCategory, searchQuery]);

  const handleSelectIssue = (issue) => {
    setSelectedIssue(issue);
    setErrorMsg('');
  };

  const handleConfirmSubmit = async () => {
    if (!targetRoom || !String(targetRoom).trim()) {
      setIsRoomPickerOpen(true);
      return;
    }
    if (!selectedIssue) {
      setErrorMsg(isEn ? 'Please select an issue' : 'Vui lòng chọn sự cố');
      return;
    }

    if (!isRoomAuth) {
      setPinActionTarget('submit');
      setIsPinModalOpen(true);
      return;
    }

    await doSubmitRequest();
  };

  const doSubmitRequest = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const timeLabel =
        timePreference === 'ASAP'
          ? isEn
            ? 'Require immediate visit'
            : 'Cần thợ lên ngay'
          : isEn
          ? 'Visit when guest is out'
          : 'Lên khi khách vắng mặt';

      const desc = [
        isEn ? selectedIssue.name_en : selectedIssue.name_vi,
        `[${timeLabel}]`,
      ]
        .filter(Boolean)
        .join(' - ');

      const payload = {
        catalog_item_id: selectedIssue.id,
        title: isEn ? selectedIssue.name_en : selectedIssue.name_vi,
        category: selectedIssue.category || 'general',
        location: targetRoom.trim(),
        description: desc,
        source: 'HCRobot Kiosk Screen',
        priority: selectedIssue.priority || 'NORMAL',
      };

      const res = await createMaintenanceRequest(payload);
      setSuccessTicket(res);
      setSelectedIssue(null);
      if (!res.duplicate && !res.merged && onRequestSuccess) {
        onRequestSuccess({
          ...(res || {}),
          location: targetRoom.trim(),
          room_number: targetRoom.trim(),
        });
      }
      loadRoomStatus(targetRoom.trim());
    } catch (err) {
      console.error('[RobotMaintenanceMenuScreen] Submit error:', err);
      setErrorMsg(
        isEn
          ? 'Could not submit maintenance ticket. Please try again.'
          : 'Không thể gửi yêu cầu bảo trì. Vui lòng thử lại.'
      );
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handlePinSuccess = (res, room) => {
    const verified = room || (typeof res === 'string' ? res : res?.room_number) || targetRoom.trim();
    setIsLocalPinVerified(true);
    setIsPinModalOpen(false);
    if (onPinVerifiedSuccess) {
      onPinVerifiedSuccess(verified);
    }

    if (pinActionTarget === 'status') {
      setIsStatusModalOpen(true);
      loadRoomStatus(verified);
    } else {
      doSubmitRequest();
    }
  };

  return (
    <div className="fixed inset-0 w-full h-[100dvh] max-h-[100dvh] bg-[#F5F2EB] text-[#1A1917] select-none flex overflow-hidden font-sans z-50 overscroll-none touch-none">
      {/* 1. LEFT SIDEBAR: DANH MỤC SỰ CỐ & THOÁT VỀ ROBOT */}
      <aside className="w-36 sm:w-44 shrink-0 bg-[#EFECE4] border-r border-[#E3DFD5] flex flex-col h-full select-none pl-[max(0.75rem,env(safe-area-inset-left,0px))]">
        {/* Header danh mục */}
        <div className="p-3 border-b border-[#E3DFD5]">
          <div className="flex items-center gap-1.5 text-stone-500 text-[10px] uppercase font-bold tracking-wider">
            <Wrench className="w-3.5 h-3.5 text-stone-600" />
            <span>{isEn ? 'Maintenance' : 'Kỹ Thuật'}</span>
          </div>
          <h2 className="text-xs sm:text-sm font-black text-stone-900 mt-0.5">
            {isEn ? 'Repairs' : 'Báo Hỏng'}
          </h2>
        </div>

        {/* Danh sách danh mục dọc */}
        <nav className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
          {MAINTENANCE_CATEGORIES.map((cat) => {
            const CatIcon = cat.icon;
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`w-full p-2.5 rounded-xl text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#1A1917] text-white shadow-xs font-bold'
                    : 'hover:bg-[#E5E1D8] text-stone-700 font-medium'
                }`}
              >
                <CatIcon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-stone-500'}`} />
                <span className="text-xs truncate">{isEn ? cat.nameEn : cat.nameVi}</span>
              </button>
            );
          })}
        </nav>

        {/* Nút đóng thoát về Robot */}
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

      {/* 2. MAIN AREA: HEADER GỌN GÀNG + LƯỚI SỰ CỐ TOÀN MÀN HÌNH (100% PURE MENU) */}
      <main className="flex-1 flex flex-col h-full min-w-0 bg-[#F5F2EB]">
        {/* Top Header Bar: Tiêu đề danh mục bên trái, nút Tiến độ & Phòng bên phải */}
        <header className="h-12 sm:h-14 px-3 sm:px-5 bg-[#F5F2EB] border-b border-[#E3DFD5] flex items-center justify-between shrink-0 gap-2">
          {/* Tiêu đề thanh lịch (Không còn tab switcher chia cắt) */}
          <div className="min-w-0 flex items-center gap-2">
            <h1 className="text-xs sm:text-sm font-black text-stone-900 truncate">
              {isEn ? 'Maintenance & Repair Services' : 'Tiếp Nhận & Báo Hỏng Thiết Bị Phòng'}
            </h1>
          </div>

          {/* Right Controls: Tiến độ sửa chữa, Search, Room badge, Close */}
          <div className="flex items-center gap-2">
            {/* Nút Tra cứu tiến độ (Bảo mật qua PIN, mở popup riêng giống Room Service & Kitchen) */}
            <button
              type="button"
              onClick={handleOpenStatusModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white hover:bg-stone-50 border border-[#E3DFD5] hover:border-stone-400 text-[11px] font-bold text-stone-700 hover:text-stone-900 shadow-2xs transition-all cursor-pointer active:scale-95"
              title={isEn ? 'Check repair progress (Requires PIN)' : 'Tra cứu tiến độ sửa chữa phòng (Bảo mật)'}
            >
              <Clock className="w-3.5 h-3.5 text-stone-500" />
              <span className="hidden sm:inline">{isEn ? 'Repair Status' : 'Tiến độ sửa chữa'}</span>
              <span className="sm:hidden">{isEn ? 'Status' : 'Tiến độ'}</span>
            </button>

            {/* Search input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isEn ? 'Search repair...' : 'Tìm sự cố...'}
                className="w-24 sm:w-40 bg-white border border-[#E3DFD5] rounded-xl pl-7 pr-2.5 py-1.5 text-xs text-stone-800 placeholder-stone-400 focus:outline-none focus:border-stone-400"
              />
            </div>

            {/* Room selector badge (Bấm để chạm chọn số phòng trực tiếp trên màn hình, không mở bàn phím) */}
            <button
              type="button"
              onClick={() => setIsRoomPickerOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white hover:bg-stone-50 border border-[#E3DFD5] hover:border-stone-400 text-[11px] font-bold text-stone-800 shadow-2xs transition-all cursor-pointer active:scale-95 group"
              title={isEn ? 'Tap to select or change your room' : 'Chạm để chọn hoặc đổi số phòng'}
            >
              <span className={`w-2 h-2 rounded-full ${targetRoom ? 'bg-emerald-500' : 'bg-stone-400'}`} />
              <span>{targetRoom ? `${isEn ? 'Room' : 'Phòng'} ${targetRoom}` : (isEn ? 'Select Room' : 'Chọn số phòng')}</span>
              <Edit3 className="w-3 h-3 text-stone-400 group-hover:text-stone-700 transition-colors ml-0.5" />
            </button>

            {/* Close button */}
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

        {/* Lưới danh mục sự cố 100% diện tích (Rộng rãi, tối ưu xoay ngang) */}
          <MaintenanceIssueGrid
            isLoadingCatalog={isLoadingCatalog}
            filteredIssues={filteredIssues}
            isEn={isEn}
            handleSelectIssue={handleSelectIssue}
          />
      </main>

      {/* 3. MODAL XÁC NHẬN YÊU CẦU SỬA CHỮA (COMPACT POPUP DIALOG - 100% CẢM ỨNG ON-SCREEN) */}
      <MaintenanceConfirmAndSuccessModals
        selectedIssue={selectedIssue}
        setSelectedIssue={setSelectedIssue}
        isEn={isEn}
        targetRoom={targetRoom}
        setIsRoomPickerOpen={setIsRoomPickerOpen}
        timePreference={timePreference}
        setTimePreference={setTimePreference}
        errorMsg={errorMsg}
        isSubmitting={isSubmitting}
        handleConfirmSubmit={handleConfirmSubmit}
        successTicket={successTicket}
        setSuccessTicket={setSuccessTicket}
        handleOpenStatusModal={handleOpenStatusModal}
      />

      <MaintenanceStatusModal
        isStatusModalOpen={isStatusModalOpen}
        setIsStatusModalOpen={setIsStatusModalOpen}
        isLoadingStatus={isLoadingStatus}
        loadRoomStatus={loadRoomStatus}
        targetRoom={targetRoom}
        setIsRoomPickerOpen={setIsRoomPickerOpen}
        isEn={isEn}
        statusData={statusData}
      />
      {/* 5. ROOM PICKER MODAL (CHẠM CHỌN SỐ PHÒNG 100% CẢM ỨNG ON-SCREEN - KHÔNG DÙNG BÀN PHÍM) */}
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

      {/* 6. SUCCESS NOTIFICATION DIALOG */}
      {/* 7. ROOM PIN VERIFICATION MODAL (BÀN PHÍM SỐ CẢM ỨNG ON-SCREEN - KHÔNG BẬT BÀN PHÍM THIẾT BỊ) */}
      {isPinModalOpen && (
        <RoomPinModal
          isOpen={isPinModalOpen}
          onClose={() => setIsPinModalOpen(false)}
          roomNumber={targetRoom}
          isSelectingRoomInitial={!targetRoom}
          onRoomSelect={(room) => handleTargetRoomChange(room)}
          skipTicketCreation={true}
          pendingAction={pinActionTarget === 'status' ? 'query_maintenance_status' : 'maintenance'}
          pendingItems={
            pinActionTarget === 'status'
              ? (isEn ? 'Check repair progress' : 'Tra cứu tiến độ sửa chữa')
              : (selectedIssue ? (isEn ? selectedIssue.name_en : selectedIssue.name_vi) : (isEn ? 'Room maintenance' : 'Bảo trì phòng'))
          }
          onVerifiedSuccess={handlePinSuccess}
          onSuccess={handlePinSuccess}
          onNotCheckedIn={onNotCheckedIn}
        />
      )}
    </div>
  );
};
