import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  ArrowLeft,
  X,
  Building,
  Send,
  Edit3,
} from 'lucide-react';
import { RoomPinModal } from './RoomPinModal';
import { MenuVoiceButton, MenuVoiceSubtitle } from './MenuVoiceBar';
import { useMenuVoiceInteraction } from '../../hooks/useMenuVoiceInteraction';
import { extractRoomIfValid, isMenuConfirmVoice, matchMaintenanceVoiceIssue } from '../../utils/menuVoiceAssistant';
import { RoomPickerModal } from './RoomPickerModal';
import {
  fetchMaintenanceCatalog,
  createMaintenanceRequest,
} from '../../services/operationsApi';

export const MAINTENANCE_CATEGORIES = [
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
  language = 'English',
  activeRoomNumber = '',
  authenticatedRoom = null,
  sessionId = null,
  onPinVerifiedSuccess = () => { },
  onRoomChange = () => { },
  onClose = () => { },
  onRequestSuccess = () => { },
  onNotCheckedIn = () => { },
  lastVoiceTranscript = null,
  voiceReplyText = '',
  isListening = false,
  isSpeaking = false,
  transcript = '',
  speak = null,
  onStartTalk = null,
  onStopSpeaking = null,
  onUnhandledVoice = null,
}) => {
  // Follow the guest conversation, independently of the staff portal language.
  const isEn = language === 'English' || language === 'EN';

  const [activeCategory, setActiveCategory] = useState(MAINTENANCE_CATEGORIES[0].id);
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

  // PIN modal & Touch Room Picker modal
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [isLocalPinVerified, setIsLocalPinVerified] = useState(false);
  const [isRoomPickerOpen, setIsRoomPickerOpen] = useState(false);
  const [voiceSubmitTick, setVoiceSubmitTick] = useState(0);
  const usedVoiceRef = useRef(false);

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

  const {
    voiceReply,
    clearVoiceReply,
    announce,
    toggleVoice,
  } = useMenuVoiceInteraction({
    lastVoiceTranscript,
    voiceReplyText,
    speak,
    onStartTalk,
    onStopSpeaking,
    isSpeaking,
    isEn,
    onUnhandledVoice,
    onVoiceCommand: (text) => {
      usedVoiceRef.current = true;
      const spokenRoom = extractRoomIfValid(text);
      if (spokenRoom) {
        handleTargetRoomChange(spokenRoom);
      }
      const matched = matchMaintenanceVoiceIssue(text, catalogItems);
      const isConfirm = isMenuConfirmVoice(text);

      if (matched) {
        if (MAINTENANCE_CATEGORIES.some((c) => c.id === matched.category)) {
          setActiveCategory(matched.category);
        }
        setSelectedIssue(matched);
        setErrorMsg('');
        const issueLabel = isEn ? matched.name_en : matched.name_vi;
        if (isConfirm) {
          setVoiceSubmitTick((n) => n + 1);
        } else {
          announce(
            isEn
              ? `Selected issue "${issueLabel}". Say Confirm or tap Send Request to dispatch Maintenance.`
              : `Dạ em đã chọn sự cố "${issueLabel}". Quý khách nói Xác nhận hoặc chạm Gửi yêu cầu để báo bộ phận Kỹ thuật nhé ạ.`
          );
        }
        return true;
      }

      if (isConfirm) {
        if (selectedIssue) {
          setVoiceSubmitTick((n) => n + 1);
        } else {
          announce(
            isEn
              ? 'Please tell me the equipment issue first, such as AC, Wifi, light, or door lock.'
              : 'Quý khách vui lòng cho em biết sự cố cụ thể (ví dụ điều hòa, wifi, đèn, khóa cửa) nhé ạ?'
          );
        }
        return true;
      }

      return false;
    },
  });

  useEffect(() => {
    if (successTicket && usedVoiceRef.current) {
      usedVoiceRef.current = false;
      const code = successTicket.ticket_code || successTicket.id || '';
      const msg = successTicket.merged
        ? (isEn
            ? `Added to open repair request #${code} for Room ${targetRoom}.`
            : `Dạ sự cố bổ sung đã được gộp vào phiếu #${code} của Phòng ${targetRoom} và gửi bộ phận Kỹ thuật ạ.`)
        : successTicket.duplicate
          ? (isEn
              ? `Room ${targetRoom} already has open repair request #${code}.`
              : `Dạ Phòng ${targetRoom} đã có phiếu sửa chữa #${code} đang được bộ phận Kỹ thuật xử lý ạ.`)
          : (isEn
              ? `Your repair request #${code} for Room ${targetRoom} has been sent to Maintenance.`
              : `Dạ phiếu báo hỏng #${code} cho Phòng ${targetRoom} đã được lưu và gửi tới bộ phận Kỹ thuật ạ.`);
      announce(msg);
    }
  }, [successTicket, targetRoom, isEn, announce]);

  useEffect(() => {
    if (errorMsg && usedVoiceRef.current) {
      announce(errorMsg);
    }
  }, [errorMsg, announce]);

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

  useEffect(() => {
    if (!selectedIssue || isRoomPickerOpen || isPinModalOpen) return;

    const handleTouchMove = (e) => {
      const isInsideDrawer = e.target?.closest?.('.maintenance-drawer-scrollable');
      if (!isInsideDrawer) {
        e.preventDefault();
      }
    };

    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    return () => {
      window.removeEventListener('touchmove', handleTouchMove);
    };
  }, [selectedIssue, isRoomPickerOpen, isPinModalOpen]);

  // Filtered issues
  const filteredIssues = useMemo(() => {
    const list = catalogItems || [];
    return list.filter((i) => i.category === activeCategory);
  }, [catalogItems, activeCategory]);

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

    doSubmitRequest();
  };

  useEffect(() => {
    if (voiceSubmitTick > 0) {
      handleConfirmSubmit();
    }
  }, [voiceSubmitTick]);

  return (
    <div className="fixed inset-0 w-full h-[100dvh] max-h-[100dvh] bg-[#F5F2EB] text-[#1A1917] select-none flex overflow-hidden font-sans z-50 overscroll-none touch-none">
      {/* 1. LEFT SIDEBAR: DANH MỤC SỰ CỐ */}
      <aside className="w-[calc(10rem+env(safe-area-inset-left,0px))] sm:w-[calc(11.5rem+env(safe-area-inset-left,0px))] shrink-0 bg-[#EFECE4] border-r border-[#E3DFD5] flex flex-col h-full select-none pl-[max(0.75rem,env(safe-area-inset-left,0px))]">
        {/* Header danh mục */}
        <div className="h-12 sm:h-14 px-3 border-b border-[#E3DFD5] flex items-center shrink-0">
          <h2 className="text-xs sm:text-sm font-black text-stone-900 truncate">
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
                className={`w-full p-2.5 rounded-xl text-left flex items-center gap-2.5 transition-all cursor-pointer ${isActive
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
      </aside>

      {/* 2. MAIN AREA: HEADER GỌN GÀNG + LƯỚI SỰ CỐ TOÀN MÀN HÌNH (100% PURE MENU) */}
      <main className="flex-1 flex flex-col h-full min-w-0 bg-[#F5F2EB]">
        {/* Top Header Bar: Tiêu đề bên trái, Chọn phòng & Quay lại Robot bên phải */}
        <header className="h-12 sm:h-14 px-3 sm:px-5 pr-[max(0.75rem,env(safe-area-inset-right,0px))] bg-[#F5F2EB] border-b border-[#E3DFD5] flex items-center justify-between shrink-0 gap-2">
          <div className="min-w-0 flex items-center gap-2">
            <h1 className="text-xs sm:text-sm font-black text-stone-900 truncate">
              {isEn ? 'Maintenance & Repair Services' : 'Tiếp Nhận & Báo Hỏng Thiết Bị Phòng'}
            </h1>
          </div>

          {/* Right Controls: Room badge & Quay lại Robot */}
          <div className="flex items-center gap-2 shrink-0">
            <MenuVoiceButton
              isListening={isListening}
              isSpeaking={isSpeaking}
              isEn={isEn}
              onToggle={() => {
                usedVoiceRef.current = true;
                toggleVoice();
              }}
            />
            {/* Room selector badge (Bấm để chạm chọn số phòng trực tiếp trên màn hình, không mở bàn phím) */}
            <button
              type="button"
              onClick={() => setIsRoomPickerOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white hover:bg-stone-50 border border-[#E3DFD5] hover:border-stone-400 text-[11px] font-bold text-stone-800 shadow-sm transition-all cursor-pointer active:scale-95 group shrink-0 whitespace-nowrap"
              title={isEn ? 'Tap to select or change your room' : 'Chạm để chọn hoặc đổi số phòng'}
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${targetRoom ? 'bg-emerald-500' : 'bg-stone-400'}`} />
              <span>{targetRoom ? `${isEn ? 'Room' : 'Phòng'} ${targetRoom}` : (isEn ? 'Select Room' : 'Chọn số phòng')}</span>
              <Edit3 className="w-3 h-3 text-stone-400 group-hover:text-stone-700 transition-colors ml-0.5 shrink-0" />
            </button>

            {/* Nút Quay lại màn hình Robot (giống màn hình chọn món ăn) */}
            <button
              type="button"
              onClick={onClose}
              className="h-8 px-3.5 rounded-full bg-[#1A1917] hover:bg-stone-800 text-white text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-sm shrink-0 whitespace-nowrap"
              title={isEn ? 'Back to Robot' : 'Quay lại giao diện Robot'}
            >
              <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
              <span>{isEn ? 'Back to Robot' : 'Quay lại Robot'}</span>
            </button>
          </div>
        </header>

        {/* Lưới danh mục sự cố 100% diện tích (Rộng rãi, tối ưu xoay ngang) */}
        <div
          className={`flex-1 min-h-0 ${selectedIssue ? 'overflow-hidden pointer-events-none' : 'overflow-y-auto'
            } overscroll-contain touch-pan-y p-3 sm:p-4 pr-[max(0.75rem,env(safe-area-inset-right,0px))] custom-scrollbar`}
        >
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
                        <span>~{issue.estimated_fix_time || 15}{isEn ? ' min' : 'p'}</span>
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

      {/* 3. DRAWER BÊN PHẢI: XÁC NHẬN YÊU CẦU SỬA CHỮA */}
      {selectedIssue && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-stretch justify-end animate-fadeIn overscroll-none touch-none"
          onClick={() => setSelectedIssue(null)}
        >
          <div
            className="w-full max-w-[380px] sm:max-w-md h-full max-h-[100dvh] bg-[#FAF8F5] border-l border-[#E3DFD5] text-[#1A1917] shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-200 overscroll-contain touch-none"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Drawer */}
            <div className="h-12 sm:h-14 shrink-0 px-4 sm:px-5 pr-[max(1rem,env(safe-area-inset-right,0px))] border-b border-[#E3DFD5] bg-white flex items-center justify-between gap-2 touch-none">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-[#EFECE4] text-stone-800 flex items-center justify-center shrink-0">
                  <Wrench className="w-3.5 h-3.5" />
                </div>
                <h3 className="text-xs sm:text-sm font-bold text-stone-900 truncate">
                  {isEn ? 'Confirm Repair Request' : 'Xác nhận yêu cầu sửa chữa'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedIssue(null)}
                className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-500 hover:text-stone-900 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                title={isEn ? 'Close' : 'Đóng'}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Thân Drawer cuộn bên trong */}
            <div className="maintenance-drawer-scrollable flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 pr-[max(0.75rem,env(safe-area-inset-right,0px))] space-y-3 custom-scrollbar overscroll-contain touch-pan-y">
              {/* Thông tin sự cố */}
              <div className="p-3 rounded-2xl bg-white border border-[#E3DFD5] shadow-2xs">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs sm:text-sm font-bold text-stone-900">
                    {isEn ? selectedIssue.name_en : selectedIssue.name_vi}
                  </p>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#F5F2EB] text-stone-800 border border-[#E3DFD5] shrink-0 whitespace-nowrap">
                    ~{selectedIssue.estimated_fix_time || 15}{isEn ? ' min' : 'p'}
                  </span>
                </div>
                <p className="text-[11px] text-stone-600 mt-1">
                  {isEn ? selectedIssue.description_en : selectedIssue.description_vi}
                </p>
              </div>

              {/* Phòng tiếp nhận: Bấm để chọn trực tiếp từ bảng số phòng */}
              <div className="flex items-center justify-between gap-2 p-2.5 sm:p-3 rounded-2xl bg-white border border-[#E3DFD5] shadow-2xs">
                <div className="flex items-center gap-2 min-w-0">
                  <Building className="w-4 h-4 text-stone-500 shrink-0" />
                  <span className="text-xs font-semibold text-stone-700 shrink-0">
                    {isEn ? 'Target Room:' : 'Số phòng:'}
                  </span>
                  <span className="text-xs font-mono font-black text-stone-900 truncate">
                    {targetRoom ? `${isEn ? 'Room' : 'Phòng'} ${targetRoom}` : (isEn ? 'Not selected' : 'Chưa chọn phòng')}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setIsRoomPickerOpen(true)}
                  className="text-xs font-bold text-stone-800 hover:text-black px-2.5 py-1 rounded-xl bg-stone-100 hover:bg-stone-200 border border-stone-300 transition-colors cursor-pointer active:scale-95 flex items-center gap-1 shrink-0 whitespace-nowrap"
                >
                  <span>{targetRoom ? (isEn ? 'Change' : 'Đổi phòng') : (isEn ? 'Select' : 'Chọn phòng')}</span>
                  <Edit3 className="w-3 h-3 text-stone-500 shrink-0" />
                </button>
              </div>

              {/* Thời gian tiếp đón kỹ thuật */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-1.5">
                  {isEn ? 'Time Preference:' : 'Thời gian hỗ trợ:'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTimePreference('ASAP')}
                    className={`p-2.5 rounded-xl border text-xs font-semibold text-left transition-all cursor-pointer ${timePreference === 'ASAP'
                      ? 'bg-[#1A1917] text-white border-[#1A1917] shadow-xs'
                      : 'bg-white text-stone-700 border-[#E3DFD5] hover:bg-stone-100'
                      }`}
                  >
                    <p className="font-bold">{isEn ? 'Immediate' : 'Cần thợ lên ngay'}</p>
                    <p className="text-[9px] opacity-80">{isEn ? 'Visit ASAP' : 'Khách đang có mặt'}</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTimePreference('WHEN_AWAY')}
                    className={`p-2.5 rounded-xl border text-xs font-semibold text-left transition-all cursor-pointer ${timePreference === 'WHEN_AWAY'
                      ? 'bg-[#1A1917] text-white border-[#1A1917] shadow-xs'
                      : 'bg-white text-stone-700 border-[#E3DFD5] hover:bg-stone-100'
                      }`}
                  >
                    <p className="font-bold">{isEn ? 'When Away' : 'Khi vắng mặt'}</p>
                    <p className="text-[9px] opacity-80">{isEn ? 'Repair while out' : 'Khi khách ra ngoài'}</p>
                  </button>
                </div>
              </div>

              {errorMsg && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}
            </div>

            {/* Footer Drawer */}
            <div className="shrink-0 p-3 sm:p-4 pr-[max(0.75rem,env(safe-area-inset-right,0px))] pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] border-t border-[#E3DFD5] bg-white flex items-center gap-2 touch-none">
              <button
                type="button"
                onClick={() => setSelectedIssue(null)}
                className="px-4 py-2.5 rounded-2xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold transition-all cursor-pointer shrink-0 whitespace-nowrap"
              >
                {isEn ? 'Cancel' : 'Hủy'}
              </button>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmSubmit}
                className="flex-1 py-2.5 px-3 rounded-2xl bg-[#1A1917] hover:bg-stone-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-md disabled:bg-stone-300 whitespace-nowrap"
              >
                {isSubmitting ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
                ) : (
                  <Send className="w-3.5 h-3.5 shrink-0" />
                )}
                <span>{isEn ? 'Send Request' : 'Gửi yêu cầu'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. ROOM PICKER MODAL (CHẠM CHỌN SỐ PHÒNG 100% CẢM ỨNG ON-SCREEN - KHÔNG DÙNG BÀN PHÍM) */}
      <RoomPickerModal
        isOpen={isRoomPickerOpen}
        onClose={() => setIsRoomPickerOpen(false)}
        onSelectRoom={(pickedRoom) => {
          handleTargetRoomChange(pickedRoom);
          setIsRoomPickerOpen(false);
        }}
        initialFloor={targetRoom && String(targetRoom).startsWith('4') ? '4' : '3'}
        selectedRoom={targetRoom}
        variant="light"
        title={isEn ? 'Select Guest Room' : 'Chọn Số Phòng Lưu Trú'}
        subtitle={isEn ? 'Tap your room number' : 'Chạm chọn số phòng của quý khách'}
        floorLabels={
          isEn
            ? { floor3: 'Floor 3 (R.301 - 310)', floor4: 'Floor 4 (R.401 - 410)' }
            : { floor3: 'Tầng 3 (P.301 - 310)', floor4: 'Tầng 4 (P.401 - 410)' }
        }
        iconType="concierge"
      />

      {/* 5. SUCCESS NOTIFICATION DIALOG */}
      {successTicket && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in overscroll-none touch-none"
          onClick={() => setSuccessTicket(null)}
        >
          <div
            className="relative bg-white rounded-3xl max-w-sm w-full max-h-[calc(100dvh-1.5rem)] overflow-y-auto overscroll-contain touch-pan-y p-5 sm:p-6 text-center border border-[#E3DFD5] shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setSuccessTicket(null)}
              className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-500 hover:text-stone-800 flex items-center justify-center transition-colors cursor-pointer"
              title={isEn ? 'Close' : 'Đóng'}
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base font-extrabold text-stone-900">
                {successTicket.merged
                  ? (isEn ? 'Existing Request Updated' : 'Đã bổ sung vào phiếu hiện có')
                  : successTicket.duplicate
                    ? (isEn ? 'Request Already Exists' : 'Yêu cầu đã tồn tại')
                    : (isEn ? 'Request Dispatched' : 'Đã tiếp nhận yêu cầu')}
              </h3>
              <p className="text-xs text-stone-600 leading-relaxed pt-0.5">
                {successTicket.merged
                  ? (isEn
                    ? 'The additional issue was added to the open repair request for this equipment. No new ticket was created.'
                    : 'Sự cố bổ sung đã được gộp vào phiếu sửa chữa đang xử lý cho cùng thiết bị.')
                  : successTicket.duplicate
                    ? (isEn
                      ? `Room ${targetRoom} already has an active request for this issue. No duplicate ticket was created.`
                      : `Phòng ${targetRoom} đã có yêu cầu đang chờ hoặc đang xử lý cho sự cố này.`)
                    : isEn
                      ? `Your maintenance request for Room ${targetRoom} has been dispatched to our technicians.`
                      : `Yêu cầu bảo trì cho Phòng ${targetRoom} đã được chuyển tới bộ phận kỹ thuật.`}
              </p>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setSuccessTicket(null)}
                className="flex-1 py-2.5 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-xs transition-all cursor-pointer whitespace-nowrap"
              >
                {isEn ? 'Close' : 'Đóng'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSuccessTicket(null);
                  onClose();
                }}
                className="flex-1 py-2.5 rounded-full bg-[#1A1917] hover:bg-stone-800 text-white font-bold text-xs transition-all cursor-pointer whitespace-nowrap"
              >
                {isEn ? 'Back to Robot' : 'Quay lại Robot'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. ROOM PIN VERIFICATION MODAL (BÀN PHÍM SỐ CẢM ỨNG ON-SCREEN - KHÔNG BẬT BÀN PHÍM THIẾT BỊ) */}
      {isPinModalOpen && (
        <RoomPinModal
          isOpen={isPinModalOpen}
          language={language}
          speak={speak}
          onClose={(reason) => {
            if (reason === 'manual' && typeof onStopSpeaking === 'function') {
              onStopSpeaking();
            }
            setIsPinModalOpen(false);
          }}
          roomNumber={targetRoom}
          isSelectingRoomInitial={!targetRoom}
          sessionId={sessionId}
          onRoomSelect={(room) => handleTargetRoomChange(room)}
          skipTicketCreation={true}
          pendingAction="maintenance"
          pendingItems={
            selectedIssue
              ? (isEn ? selectedIssue.name_en : selectedIssue.name_vi)
              : (isEn ? 'Room maintenance' : 'Bảo trì phòng')
          }
          onVerifiedSuccess={handlePinSuccess}
          onSuccess={handlePinSuccess}
          onNotCheckedIn={onNotCheckedIn}
        />
      )}
      <MenuVoiceSubtitle
        message={voiceReply}
        transcript={transcript}
        isListening={isListening}
        isEn={isEn}
        onClear={clearVoiceReply}
      />
    </div>
  );
};
