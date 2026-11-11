import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Wrench,
  ThermometerSnowflake,
  Droplets,
  Zap,
  KeyRound,
  Wifi,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  X,
  Search,
  Building,
  Send,
  Layers,
  Edit3,
} from 'lucide-react';
import { RoomPinModal } from './RoomPinModal';
import { RoomPickerModal } from './RoomPickerModal';
import {
  fetchMaintenanceCatalog,
  createMaintenanceRequest,
  fetchRoomMaintenanceStatus,
} from '../../services/operationsApi';
import { useLanguage } from '../../context/LanguageContext';

export const MAINTENANCE_CATEGORIES = [
  { id: 'all', nameVi: 'Tất Cả', nameEn: 'All', icon: Layers },
  { id: 'hvac', nameVi: 'Điều Hòa', nameEn: 'AC & Climate', icon: ThermometerSnowflake },
  { id: 'plumbing', nameVi: 'Nước & Vệ Sinh', nameEn: 'Plumbing', icon: Droplets },
  { id: 'electrical', nameVi: 'Điện & Ánh Sáng', nameEn: 'Electrical', icon: Zap },
  { id: 'door_lock', nameVi: 'Khóa & Cửa', nameEn: 'Door & Lock', icon: KeyRound },
  { id: 'media_network', nameVi: 'Wifi & Tivi', nameEn: 'Wifi & Media', icon: Wifi },
  { id: 'other', nameVi: 'Sự Cố Khác', nameEn: 'Other', icon: Wrench },
];

export const FALLBACK_MAINTENANCE_CATALOG = [
  {
    id: 'MNT-HVAC-01',
    category: 'hvac',
    name_vi: 'Điều hòa không mát / Chỉ có gió',
    name_en: 'AC not cooling / Fan only',
    description_vi: 'Máy lạnh chạy nhưng không phả hơi lạnh, nhiệt độ phòng tăng cao.',
    description_en: 'AC running but no cold air blowing, room temp high.',
    priority: 'HIGH',
    estimated_fix_time: 20,
  },
  {
    id: 'MNT-HVAC-02',
    category: 'hvac',
    name_vi: 'Điều hòa rò nước / Chảy nước',
    name_en: 'AC water leakage',
    description_vi: 'Dàn lạnh điều hòa chảy nước xuống sàn nhà hoặc tường.',
    description_en: 'AC indoor unit leaking water onto floor or wall.',
    priority: 'URGENT',
    estimated_fix_time: 25,
  },
  {
    id: 'MNT-PLUMB-01',
    category: 'plumbing',
    name_vi: 'Vòi nước rò rỉ / Không vặn chặt được',
    name_en: 'Leaking faucet / Cannot close tightly',
    description_vi: 'Vòi lavabo hoặc vòi sen nhỏ giọt liên tục không ngắt được.',
    description_en: 'Lavabo or shower faucet dripping continuously.',
    priority: 'HIGH',
    estimated_fix_time: 15,
  },
  {
    id: 'MNT-PLUMB-02',
    category: 'plumbing',
    name_vi: 'Bồn cầu bị tắc / Xả không trôi',
    name_en: 'Toilet clogged / Flushing issue',
    description_vi: 'Bồn cầu thoát nước chậm hoặc xả không trôi gây ngập.',
    description_en: 'Toilet draining slowly or not flushing properly.',
    priority: 'URGENT',
    estimated_fix_time: 20,
  },
  {
    id: 'MNT-PLUMB-03',
    category: 'plumbing',
    name_vi: 'Vòi sen nước yếu / Không có nước nóng',
    name_en: 'Low shower pressure / No hot water',
    description_vi: 'Nước tắm chảy yếu hoặc bình nước nóng không hoạt động.',
    description_en: 'Water pressure weak or hot water heater not functioning.',
    priority: 'NORMAL',
    estimated_fix_time: 20,
  },
  {
    id: 'MNT-ELEC-01',
    category: 'electrical',
    name_vi: 'Mất điện toàn bộ phòng / Nhảy aptomat',
    name_en: 'Complete room blackout / Circuit breaker tripped',
    description_vi: 'Toàn bộ thiết bị điện và đèn trong phòng mất nguồn hoàn toàn.',
    description_en: 'All electrical appliances and lights in room lost power.',
    priority: 'URGENT',
    estimated_fix_time: 15,
  },
  {
    id: 'MNT-ELEC-02',
    category: 'electrical',
    name_vi: 'Đèn phòng nhấp nháy hoặc cháy bóng',
    name_en: 'Flickering or burnt light bulb',
    description_vi: 'Bóng đèn trần, đèn phòng tắm hoặc đèn ngủ chập chờn.',
    description_en: 'Ceiling, bathroom, or bedside lamp flickering or burnt out.',
    priority: 'NORMAL',
    estimated_fix_time: 15,
  },
  {
    id: 'MNT-ELEC-03',
    category: 'electrical',
    name_vi: 'Ổ cắm điện đầu giường không có điện',
    name_en: 'Bedside power outlet not working',
    description_vi: 'Cắm sạc điện thoại không nhận nguồn điện.',
    description_en: 'Charger does not receive power when plugged in.',
    priority: 'NORMAL',
    estimated_fix_time: 15,
  },
  {
    id: 'MNT-LOCK-01',
    category: 'door_lock',
    name_vi: 'Khóa từ phòng báo đèn đỏ / Không mở được',
    name_en: 'Smart door lock red light / Unable to unlock',
    description_vi: 'Quẹt thẻ từ báo đèn đỏ hoặc chốt khóa cửa điện tử bị kẹt.',
    description_en: 'Keycard reader shows red light or electronic bolt jammed.',
    priority: 'URGENT',
    estimated_fix_time: 10,
  },
  {
    id: 'MNT-LOCK-02',
    category: 'door_lock',
    name_vi: 'Cửa ban công / Cửa phòng khó đóng chặt',
    name_en: 'Balcony / Room door hard to close',
    description_vi: 'Bản lề hoặc tay nắm cửa bị xệ, phát ra tiếng kêu.',
    description_en: 'Door hinges or handle sagged, making screeching noise.',
    priority: 'NORMAL',
    estimated_fix_time: 25,
  },
  {
    id: 'MNT-NET-01',
    category: 'media_network',
    name_vi: 'Wifi phòng mất kết nối / Sóng rất yếu',
    name_en: 'Room Wifi disconnected / Weak signal',
    description_vi: 'Không thể kết nối vào mạng Wifi khách sạn hoặc tốc độ rất chậm.',
    description_en: 'Unable to connect to hotel Wifi or extremely slow speed.',
    priority: 'HIGH',
    estimated_fix_time: 15,
  },
  {
    id: 'MNT-NET-02',
    category: 'media_network',
    name_vi: 'Tivi không lên hình / Mất tín hiệu truyền hình',
    name_en: 'TV no display / No signal',
    description_vi: 'Tivi màn hình đen hoặc điều khiển từ xa không phản hồi.',
    description_en: 'TV screen blank or remote control unresponsive.',
    priority: 'NORMAL',
    estimated_fix_time: 20,
  },
  {
    id: 'MNT-OTH-01',
    category: 'other',
    name_vi: 'Két sắt phòng bị khóa / Quên mã số',
    name_en: 'In-room safe locked / Code forgotten',
    description_vi: 'Không thể mở két sắt để lấy tư trang, cần kỹ thuật hỗ trợ mở.',
    description_en: 'Unable to open room safe, requires master key assistance.',
    priority: 'HIGH',
    estimated_fix_time: 15,
  },
  {
    id: 'MNT-OTH-02',
    category: 'other',
    name_vi: 'Tủ lạnh mini bar không làm lạnh',
    name_en: 'Minibar fridge not cooling',
    description_vi: 'Tủ lạnh nhỏ không mát làm hỏng đồ uống và thực phẩm.',
    description_en: 'Minibar fridge not cold, causing drinks/food to spoil.',
    priority: 'NORMAL',
    estimated_fix_time: 30,
  },
];

export const RobotMaintenanceMenuScreen = ({
  activeRoomNumber = '',
  authenticatedRoom = null,
  onPinVerifiedSuccess = () => {},
  onRoomChange = () => {},
  onClose = () => {},
  onRequestSuccess = () => {},
  onNotCheckedIn = () => {},
}) => {
  const { language } = useLanguage();
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
            <span>Kỹ Thuật</span>
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
            <span>Về Robot</span>
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
              title="Chạm để chọn hoặc đổi số phòng"
            >
              <span className={`w-2 h-2 rounded-full ${targetRoom ? 'bg-emerald-500' : 'bg-stone-400'}`} />
              <span>{targetRoom ? `Phòng ${targetRoom}` : (isEn ? 'Select Room' : 'Chọn số phòng')}</span>
              <Edit3 className="w-3 h-3 text-stone-400 group-hover:text-stone-700 transition-colors ml-0.5" />
            </button>

            {/* Close button */}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-stone-200 text-stone-600 flex items-center justify-center transition-colors cursor-pointer"
              title="Đóng"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Lưới danh mục sự cố 100% diện tích (Rộng rãi, tối ưu xoay ngang) */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 custom-scrollbar">
          {isLoadingCatalog ? (
            <div className="h-full flex flex-col items-center justify-center text-stone-400 gap-2">
              <RefreshCw className="w-6 h-6 animate-spin" />
              <p className="text-xs">{isEn ? 'Loading catalog...' : 'Đang tải danh mục...'}</p>
            </div>
          ) : filteredIssues.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-stone-400 py-12">
              <p className="text-xs sm:text-sm">
                {isEn ? 'No repair issues match your search' : 'Không tìm thấy sự cố phù hợp'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3 pb-8">
              {filteredIssues.map((issue) => {
                const catCfg =
                  MAINTENANCE_CATEGORIES.find((c) => c.id === issue.category) ||
                  MAINTENANCE_CATEGORIES[MAINTENANCE_CATEGORIES.length - 1];
                const CatIcon = catCfg.icon;

                return (
                  <div
                    key={issue.id}
                    onClick={() => handleSelectIssue(issue)}
                    className="bg-white rounded-2xl border border-[#E3DFD5] hover:border-stone-400 shadow-2xs hover:shadow-md p-3 sm:p-3.5 flex flex-col justify-between transition-all group cursor-pointer active:scale-[0.99] min-h-[140px]"
                  >
                    <div>
                      {/* Category icon */}
                      <div className="w-8 h-8 rounded-xl bg-[#EFECE4] border border-[#E3DFD5] text-stone-700 flex items-center justify-center shrink-0 group-hover:bg-[#1A1917] group-hover:text-white transition-colors">
                        <CatIcon className="w-4 h-4" />
                      </div>

                      {/* Title */}
                      <h3 className="text-xs sm:text-[13px] font-bold text-stone-900 group-hover:text-black mt-2 line-clamp-1">
                        {isEn ? issue.name_en : issue.name_vi}
                      </h3>

                      {/* Description */}
                      <p className="text-[10px] sm:text-[11px] text-stone-500 mt-1 line-clamp-2 leading-relaxed">
                        {isEn ? issue.description_en : issue.description_vi}
                      </p>
                    </div>

                    {/* Footer card: Thời gian dự kiến & Nút chọn */}
                    <div className="mt-3 pt-2 border-t border-stone-100 flex items-center justify-between">
                      <span className="text-[10px] text-stone-400 font-medium flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>~{issue.estimated_fix_time || 15}p</span>
                      </span>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectIssue(issue);
                        }}
                        className="h-7 px-3 rounded-lg bg-[#1A1917] hover:bg-stone-800 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                      >
                        <span>{isEn ? 'Select' : 'Báo sửa'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* 3. MODAL XÁC NHẬN YÊU CẦU SỬA CHỮA (COMPACT POPUP DIALOG - 100% CẢM ỨNG ON-SCREEN) */}
      {selectedIssue && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in"
          onClick={() => setSelectedIssue(null)}
        >
          <div
            className="w-full max-w-md bg-white rounded-3xl border border-[#E3DFD5] shadow-2xl p-4 sm:p-5 flex flex-col gap-3.5 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Modal */}
            <div className="flex items-center justify-between pb-2.5 border-b border-[#E3DFD5]">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#EFECE4] text-stone-800 flex items-center justify-center">
                  <Wrench className="w-3.5 h-3.5" />
                </div>
                <h3 className="text-xs sm:text-sm font-bold text-stone-900">
                  {isEn ? 'Confirm Repair Request' : 'Xác nhận yêu cầu sửa chữa'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedIssue(null)}
                className="w-7 h-7 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-500 hover:text-stone-900 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body Modal: Thông tin sự cố */}
            <div className="p-3 rounded-2xl bg-[#F5F2EB] border border-[#E3DFD5]">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs sm:text-sm font-bold text-stone-900">
                  {isEn ? selectedIssue.name_en : selectedIssue.name_vi}
                </p>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white text-stone-800 border border-[#E3DFD5]">
                  ~{selectedIssue.estimated_fix_time || 15}p
                </span>
              </div>
              <p className="text-[11px] text-stone-600 mt-1">
                {isEn ? selectedIssue.description_en : selectedIssue.description_vi}
              </p>
            </div>

            {/* Phòng tiếp nhận: Bấm để chọn trực tiếp từ bảng số phòng (Không dùng bàn phím máy) */}
            <div className="flex items-center justify-between p-2.5 rounded-2xl bg-white border border-[#E3DFD5]">
              <div className="flex items-center gap-2">
                <Building className="w-4 h-4 text-stone-500" />
                <span className="text-xs font-semibold text-stone-700">
                  {isEn ? 'Target Room:' : 'Số phòng tiếp nhận:'}
                </span>
                <span className="text-xs font-mono font-black text-stone-900">
                  {targetRoom ? `Phòng ${targetRoom}` : (isEn ? 'Not selected' : 'Chưa chọn phòng')}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setIsRoomPickerOpen(true)}
                className="text-xs font-bold text-stone-800 hover:text-black px-2.5 py-1 rounded-xl bg-stone-100 hover:bg-stone-200 border border-stone-300 transition-colors cursor-pointer active:scale-95 flex items-center gap-1"
              >
                <span>{targetRoom ? (isEn ? 'Change' : 'Đổi phòng') : (isEn ? 'Select' : 'Chọn phòng')}</span>
                <Edit3 className="w-3 h-3 text-stone-500" />
              </button>
            </div>

            {/* Thời gian tiếp đón kỹ thuật */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-1">
                {isEn ? 'Time Preference:' : 'Thời gian hỗ trợ:'}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTimePreference('ASAP')}
                  className={`p-2 rounded-xl border text-xs font-semibold text-left transition-all cursor-pointer ${
                    timePreference === 'ASAP'
                      ? 'bg-[#1A1917] text-white border-[#1A1917] shadow-xs'
                      : 'bg-[#F5F2EB] text-stone-700 border-[#E3DFD5] hover:bg-stone-200'
                  }`}
                >
                  <p className="font-bold">{isEn ? 'Immediate' : 'Cần thợ lên ngay'}</p>
                  <p className="text-[9px] opacity-80">{isEn ? 'Visit ASAP' : 'Khách đang có mặt'}</p>
                </button>

                <button
                  type="button"
                  onClick={() => setTimePreference('WHEN_AWAY')}
                  className={`p-2 rounded-xl border text-xs font-semibold text-left transition-all cursor-pointer ${
                    timePreference === 'WHEN_AWAY'
                      ? 'bg-[#1A1917] text-white border-[#1A1917] shadow-xs'
                      : 'bg-[#F5F2EB] text-stone-700 border-[#E3DFD5] hover:bg-stone-200'
                  }`}
                >
                  <p className="font-bold">{isEn ? 'When Away' : 'Khi vắng mặt'}</p>
                  <p className="text-[9px] opacity-80">{isEn ? 'Repair while out' : 'Khi khách ra ngoài'}</p>
                </button>
              </div>
            </div>

            {errorMsg && (
              <div className="p-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Actions */}
            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedIssue(null)}
                className="flex-1 py-2 rounded-xl bg-stone-200 hover:bg-stone-300 text-stone-800 text-xs font-bold transition-all cursor-pointer"
              >
                {isEn ? 'Cancel' : 'Hủy'}
              </button>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmSubmit}
                className="flex-2 py-2 rounded-xl bg-[#1A1917] hover:bg-stone-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm disabled:bg-stone-300"
              >
                {isSubmitting ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>{isEn ? 'Send Request' : 'Gửi yêu cầu'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. MODAL TRA CỨU TIẾN ĐỘ SỬA CHỮA (POPUP MODAL RIÊNG BIỆT - CHUẨN ROOM SERVICE & KITCHEN) */}
      {isStatusModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in"
          onClick={() => setIsStatusModalOpen(false)}
        >
          <div
            className="w-full max-w-sm sm:max-w-md bg-stone-900 border border-stone-800 text-stone-100 rounded-3xl p-4 sm:p-5 shadow-2xl flex flex-col gap-3.5 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Modal Tiến Độ */}
            <div className="flex items-center justify-between border-b border-stone-800 pb-2.5">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-stone-300" />
                <h3 className="text-xs sm:text-sm font-bold text-stone-100">
                  {isEn ? 'Maintenance & Repair Progress' : 'Tiến Độ Sửa Chữa Kỹ Thuật'}
                </h3>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={isLoadingStatus}
                  onClick={() => loadRoomStatus(targetRoom)}
                  className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-stone-200 transition-colors"
                  title="Làm mới tiến độ"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingStatus ? 'animate-spin text-stone-200' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={() => setIsStatusModalOpen(false)}
                  className="p-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-stone-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Thông tin phòng tra cứu & Đổi phòng (100% Cảm ứng on-screen) */}
            <div className="flex justify-between items-center text-xs p-2.5 bg-stone-800/80 rounded-2xl border border-stone-700/60">
              <span className="text-stone-400 font-medium">
                {isEn ? 'Checking room:' : 'Đang tra cứu cho:'}
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsStatusModalOpen(false);
                  setIsRoomPickerOpen(true);
                }}
                className="font-bold text-stone-100 hover:text-white flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-stone-700/70 hover:bg-stone-700 border border-stone-600/80 cursor-pointer transition-colors active:scale-95"
              >
                <span>{targetRoom ? `Phòng ${targetRoom}` : (isEn ? 'Select Room' : 'Chọn số phòng')}</span>
                <Edit3 className="w-3.5 h-3.5 text-stone-300" />
              </button>
            </div>

            {/* Status Summary Counters */}
            {statusData && (
              <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-semibold">
                <div className="p-2 rounded-xl bg-stone-800/60 border border-stone-700/50">
                  <p className="text-stone-400">{isEn ? 'Pending' : 'Chờ xử lý'}</p>
                  <p className="text-xs font-black text-stone-200 mt-0.5">{statusData.pending_count || 0}</p>
                </div>
                <div className="p-2 rounded-xl bg-blue-950/40 border border-blue-800/40">
                  <p className="text-blue-300">{isEn ? 'In Progress' : 'Đang sửa'}</p>
                  <p className="text-xs font-black text-blue-200 mt-0.5">{statusData.in_progress_count || 0}</p>
                </div>
                <div className="p-2 rounded-xl bg-emerald-950/40 border border-emerald-800/40">
                  <p className="text-emerald-300">{isEn ? 'Completed' : 'Đã xong'}</p>
                  <p className="text-xs font-black text-emerald-200 mt-0.5">{statusData.completed_count || 0}</p>
                </div>
              </div>
            )}

            {/* Danh sách yêu cầu bảo trì */}
            <div className="max-h-60 overflow-y-auto space-y-2 custom-scrollbar pr-1">
              {isLoadingStatus ? (
                <div className="p-8 text-center text-xs text-stone-400">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-stone-300" />
                  <p>{isEn ? 'Checking technical requests...' : 'Đang kiểm tra tiến độ từ bộ phận Kỹ thuật...'}</p>
                </div>
              ) : !statusData || !statusData.requests || statusData.requests.length === 0 ? (
                <div className="p-8 text-center text-xs text-stone-400 bg-stone-800/40 rounded-2xl border border-stone-800">
                  <Wrench className="w-6 h-6 text-stone-500 mx-auto mb-2 opacity-60" />
                  <p className="font-semibold text-stone-300">
                    {isEn
                      ? `No maintenance tickets found for Room ${targetRoom}`
                      : `Không có yêu cầu bảo trì nào cho Phòng ${targetRoom}`}
                  </p>
                  <p className="text-[10px] text-stone-500 mt-1">
                    {isEn ? 'All facilities in this room are operational' : 'Mọi thiết bị trong phòng đang hoạt động bình thường'}
                  </p>
                </div>
              ) : (
                statusData.requests.map((req) => {
                  const s = (req.status || '').toLowerCase();
                  const isDone = s === 'completed' || s === 'resolved';
                  const isInProg = s === 'in progress' || s === 'assigned' || s === 'in preparation';

                  let statusBadge = (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-stone-800 text-stone-300 border border-stone-700 inline-flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-stone-400" />
                      {isEn ? 'Pending' : 'Chờ tiếp nhận'}
                    </span>
                  );
                  if (isInProg) {
                    statusBadge = (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-900/60 text-blue-200 border border-blue-700/60 inline-flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                        {isEn ? 'In Progress' : 'Đang xử lý'}
                      </span>
                    );
                  } else if (isDone) {
                    statusBadge = (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-900/60 text-emerald-200 border border-emerald-700/60 inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        {isEn ? 'Completed' : 'Đã hoàn tất'}
                      </span>
                    );
                  }

                  return (
                    <article
                      key={req.id || req.ticket_code}
                      className="p-3 rounded-2xl border border-stone-800 bg-stone-800/60 space-y-1.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono font-bold text-stone-400">
                              #{req.ticket_code}
                            </span>
                            <span className="text-[10px] text-stone-500">
                              {new Date(req.created_at).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                          <h4 className="text-xs sm:text-sm font-bold text-stone-100 mt-0.5">
                            {req.title}
                          </h4>
                        </div>
                        <div className="shrink-0">{statusBadge}</div>
                      </div>

                      {req.description && (
                        <p className="text-[10px] sm:text-[11px] text-stone-300 bg-stone-900/70 p-2 rounded-xl border border-stone-800 whitespace-pre-line">
                          {req.description}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-stone-400 pt-1 border-t border-stone-800/60">
                        <span>
                          {isEn ? 'Technician:' : 'Kỹ thuật viên:'}{' '}
                          <strong className="text-stone-200">
                            {req.assigned_to || (isEn ? 'Duty Team' : 'Đội kỹ thuật')}
                          </strong>
                        </span>
                        <span>
                          {isEn ? 'ETA:' : 'Dự kiến:'}{' '}
                          <strong className="text-stone-200">{req.est_completion || '~15-20 phút'}</strong>
                        </span>
                      </div>
                    </article>
                  );
                })
              )}
            </div>

            {/* Footer Modal Tiến Độ */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setIsStatusModalOpen(false)}
                className="w-full py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold transition-all cursor-pointer"
              >
                {isEn ? 'Back to Menu' : 'Quay lại danh mục'}
              </button>
            </div>
          </div>
        </div>
      )}

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
      {successTicket && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xs w-full p-5 text-center border border-[#E3DFD5] shadow-2xl space-y-3">
            <div className="w-11 h-11 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-sm font-bold text-stone-900">
                {successTicket.merged
                  ? (isEn ? 'Existing request updated' : 'Đã bổ sung vào phiếu hiện có')
                  : successTicket.duplicate
                  ? (isEn ? 'Request already exists' : 'Yêu cầu đã tồn tại')
                  : (isEn ? 'Request Dispatched' : 'Đã tiếp nhận yêu cầu')}
              </h3>
              <p className="text-[11px] text-stone-500 mt-0.5">
                {successTicket.merged
                  ? (isEn
                    ? `The additional issue was added to repair request #${successTicket.ticket_code} for the same equipment. No new ticket was created.`
                    : `Đã bổ sung sự cố vào phiếu sửa chữa #${successTicket.ticket_code} cho cùng thiết bị. Không tạo thêm phiếu mới.`)
                  : successTicket.duplicate
                  ? (isEn
                    ? `Room ${targetRoom} already has an open request #${successTicket.ticket_code} for this issue. No new ticket was created.`
                    : `Phòng ${targetRoom} đã có phiếu #${successTicket.ticket_code} cho sự cố này đang chờ hoặc đang xử lý. Không tạo thêm phiếu mới.`)
                  : isEn
                  ? `Ticket #${successTicket.ticket_code} for Room ${targetRoom} dispatched to technicians`
                  : `Mã phiếu #${successTicket.ticket_code} của Phòng ${targetRoom} đã được gửi tới kỹ thuật`}
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setSuccessTicket(null);
                handleOpenStatusModal();
              }}
              className="w-full py-2 rounded-xl bg-[#1A1917] hover:bg-stone-800 text-white font-bold text-xs transition-colors cursor-pointer"
            >
              {isEn ? 'View Tracking Status' : 'Xem tiến độ xử lý'}
            </button>
          </div>
        </div>
      )}

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
              : (selectedIssue ? (isEn ? selectedIssue.name_en : selectedIssue.name_vi) : 'Bảo trì phòng')
          }
          onVerifiedSuccess={handlePinSuccess}
          onSuccess={handlePinSuccess}
          onNotCheckedIn={onNotCheckedIn}
        />
      )}
    </div>
  );
};
