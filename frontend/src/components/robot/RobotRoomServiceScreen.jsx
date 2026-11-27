import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  X,
  CheckCircle2,
  Clock,
  BedDouble,
  Bath,
  Shirt,
  HeartHandshake,
  ConciergeBell,
  Check,
  Edit3,
} from 'lucide-react';
import { RoomPinModal } from './RoomPinModal';
import { createRoomServiceOrder, fetchRoomServiceCatalog } from '../../services/operationsApi';
import { MenuVoiceButton, MenuVoiceSubtitle } from './MenuVoiceBar';
import { useMenuVoiceInteraction } from '../../hooks/useMenuVoiceInteraction';
import {
  extractRoomIfValid,
  isMenuConfirmVoice,
  matchCatalogItemsByVoice,
} from '../../utils/menuVoiceAssistant';

export const ROOM_SERVICE_CATALOG = [
  // 1. KHĂN & TIỆN ÍCH BUỒNG PHÒNG
  {
    id: 'AMENITY-01',
    name: 'Khăn tắm lớn cao cấp',
    category: 'bath',
    price: 0,
    unit: 'Chiếc',
    prep_time: 10,
    badge: 'Miễn phí',
    description: 'Khăn tắm cotton 100% sợi dệt dài cao cấp của khách sạn, mềm mại và siêu thấm hút.',
    image_url: 'https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?w=500&auto=format&fit=crop&q=80',
  },
  {
    id: 'AMENITY-02',
    name: 'Bộ khăn tắm & khăn mặt',
    category: 'bath',
    price: 0,
    unit: 'Bộ (2 khăn tắm + 2 khăn mặt)',
    prep_time: 10,
    badge: 'Phổ biến',
    description: 'Set đầy đủ gồm 2 khăn tắm đại và 2 khăn lau mặt tiệt trùng tinh khiết.',
    image_url: 'https://images.unsplash.com/photo-1616046229478-9901c5536a45?w=500&auto=format&fit=crop&q=80',
  },
  {
    id: 'AMENITY-03',
    name: 'Gối lông vũ cao cấp thêm',
    category: 'bedding',
    price: 0,
    unit: 'Chiếc',
    prep_time: 12,
    badge: 'Miễn phí',
    description: 'Gối lông vũ êm ái chống mỏi cổ vai gáy, áo gối lụa tơ tằm mềm mịn thoáng mát.',
    image_url: 'https://images.unsplash.com/photo-1584100936733-315132228d4d?w=500&auto=format&fit=crop&q=80',
  },
  {
    id: 'AMENITY-04',
    name: 'Chăn đắp ấm bổ sung',
    category: 'bedding',
    price: 0,
    unit: 'Chiếc',
    prep_time: 12,
    badge: 'Miễn phí',
    description: 'Chăn ấm bông microfiber cao cấp nhẹ nhàng, giữ nhiệt tốt cho giấc ngủ sâu.',
    image_url: 'https://images.unsplash.com/photo-1540518614846-7ede433c4ef4?w=500&auto=format&fit=crop&q=80',
  },
  {
    id: 'AMENITY-05',
    name: 'Bộ đồ vệ sinh cá nhân cao cấp',
    category: 'bath',
    price: 0,
    unit: 'Bộ (Bàn chải, dao cạo, chụp tóc)',
    prep_time: 10,
    badge: 'Miễn phí',
    description: 'Bàn chải than hoạt tính, kem đánh răng thảo mộc, dao cạo kép và lược gỗ tự nhiên.',
    image_url: 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=500&auto=format&fit=crop&q=80',
  },

  // 2. MASSAGE & TRỊ LIỆU TẠI PHÒNG (IN-ROOM SPA & WELLNESS)
  {
    id: 'SPA-01',
    name: 'Massage toàn thân Thụy Điển',
    category: 'spa',
    price: 350000,
    unit: 'Suất 60 phút / Kỹ thuật viên tại phòng',
    prep_time: 20,
    badge: 'Được yêu thích',
    description: 'Kỹ thuật massage miết dài kết hợp tinh dầu oải hương Pháp giúp thư giãn cơ thể và giảm căng thẳng.',
    image_url: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=500&auto=format&fit=crop&q=80',
  },
  {
    id: 'SPA-02',
    name: 'Trị liệu bấm huyệt cổ vai gáy',
    category: 'spa',
    price: 280000,
    unit: 'Suất 45 phút / Kỹ thuật viên tại phòng',
    prep_time: 20,
    badge: 'Trị liệu sâu',
    description: 'Tập trung giải tỏa căng cơ vùng cổ, gáy và bả vai, lưu thông khí huyết cho người mệt mỏi sau chuyến đi.',
    image_url: 'https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=500&auto=format&fit=crop&q=80',
  },
  {
    id: 'SPA-03',
    name: 'Ngâm chân thảo dược & Massage chân',
    category: 'spa',
    price: 220000,
    unit: 'Suất 45 phút / Kỹ thuật viên tại phòng',
    prep_time: 15,
    badge: 'Thư giãn',
    description: 'Ngâm chân nước ấm thảo mộc gừng quế kết hợp bấm huyệt lòng bàn chân phục hồi thể lực tức thì.',
    image_url: 'https://images.unsplash.com/photo-1519824145371-296894a0daa9?w=500&auto=format&fit=crop&q=80',
  },
  {
    id: 'SPA-04',
    name: 'Trị liệu đá nóng núi lửa',
    category: 'spa',
    price: 450000,
    unit: 'Suất 75 phút / Kỹ thuật viên tại phòng',
    prep_time: 25,
    badge: 'Cao cấp',
    description: 'Chườm đá bazan núi lửa giữ nhiệt kết hợp ấn huyệt toàn thân giúp thải độc và cải thiện tuần hoàn máu.',
    image_url: 'https://images.unsplash.com/photo-1600334129128-685c5582fd35?w=500&auto=format&fit=crop&q=80',
  },

  // 3. DỌN PHÒNG & BUỒNG PHÒNG NHANH
  {
    id: 'HK-01',
    name: 'Dọn phòng & thay drap giường ngay',
    category: 'housekeeping',
    price: 0,
    unit: 'Lượt phục vụ',
    prep_time: 15,
    badge: 'Miễn phí',
    description: 'Nhân viên buồng phòng đến thay toàn bộ vỏ gối, drap giường và dọn dẹp phòng sạch tinh tươm.',
    image_url: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=500&auto=format&fit=crop&q=80',
  },
  {
    id: 'HK-02',
    name: 'Thu dọn rác & làm sạch nhanh',
    category: 'housekeeping',
    price: 0,
    unit: 'Lượt phục vụ',
    prep_time: 10,
    badge: 'Miễn phí',
    description: 'Thu gom túi rác, làm sạch bàn trà và bổ sung túi rác mới nhanh chóng trong 10 phút.',
    image_url: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=500&auto=format&fit=crop&q=80',
  },
  {
    id: 'HK-03',
    name: 'Xông tinh dầu khử mùi phòng ngủ',
    category: 'housekeeping',
    price: 0,
    unit: 'Lượt phục vụ',
    prep_time: 10,
    badge: 'Thư thái',
    description: 'Máy khuếch tán tinh dầu sả chanh hoặc ngọc lan tây tự nhiên mang lại không gian thư giãn dễ chịu.',
    image_url: 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=500&auto=format&fit=crop&q=80',
  },

  // 4. GIẶT ỦI & CHĂM SÓC TRANG PHỤC
  {
    id: 'LAUNDRY-01',
    name: 'Ủi / Là phẳng trang phục khẩn cấp',
    category: 'laundry',
    price: 60000,
    unit: '2 món trang phục',
    prep_time: 25,
    badge: 'Tận nơi',
    description: 'Ủi hơi nước đứng chuyên dụng cho áo sơ mi, váy đầm hoặc âu phục lấy lại phom dáng chuẩn chỉnh.',
    image_url: 'https://images.unsplash.com/photo-1517677208171-0bc6725a3e60?w=500&auto=format&fit=crop&q=80',
  },
  {
    id: 'LAUNDRY-02',
    name: 'Giặt sấy nhanh trong ngày',
    category: 'laundry',
    price: 120000,
    unit: 'Giỏ 3kg',
    prep_time: 180,
    badge: 'Giao tận phòng',
    description: 'Giặt sạch, sấy thơm và gấp gọn trang phục thường ngày giao tận cửa phòng trong vòng 3-4 giờ.',
    image_url: 'https://images.unsplash.com/photo-1545173168-9f1947eebb7f?w=500&auto=format&fit=crop&q=80',
  },
  {
    id: 'LAUNDRY-03',
    name: 'Mượn bàn ủi & cầu là tại phòng',
    category: 'laundry',
    price: 0,
    unit: 'Bộ thiết bị',
    prep_time: 10,
    badge: 'Miễn phí',
    description: 'Giao bàn ủi hơi nước Tefal và bàn để ủi chuyên dụng lên phòng để khách tự do sử dụng.',
    image_url: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=500&auto=format&fit=crop&q=80',
  },
];

export const SERVICE_CATEGORIES = [
  { id: 'bath', name: 'Khăn & Tiện Ích', icon: Bath },
  { id: 'spa', name: 'Massage Tại Phòng', icon: HeartHandshake },
  { id: 'bedding', name: 'Gối & Chăn Ấm', icon: BedDouble },
  { id: 'housekeeping', name: 'Dọn Phòng Nhanh', icon: ConciergeBell },
  { id: 'laundry', name: 'Giặt Ủi', icon: Shirt },
];

export const RobotRoomServiceScreen = ({
  language = 'Tiếng Việt',
  activeRoomNumber = '',
  authenticatedRoom = null,
  onClose,
  onRoomChange,
  onRequestSuccess,
  onNotCheckedIn,
  onPinVerifiedSuccess = () => {},
  sessionId = null,
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
  const [activeCategory, setActiveCategory] = useState(SERVICE_CATEGORIES[0].id);
  const [catalogItems, setCatalogItems] = useState(() =>
    ROOM_SERVICE_CATALOG.filter(
      (it) => !it.name?.toLowerCase().includes('nước khoáng') && !it.name?.toLowerCase().includes('nuoc khoang')
    )
  );

  useEffect(() => {
    let isMounted = true;
    const loadCatalog = async () => {
      try {
        const items = await fetchRoomServiceCatalog({ is_available: true });
        if (isMounted && Array.isArray(items) && items.length > 0) {
          const cleaned = items.filter(
            (it) => !it.name?.toLowerCase().includes('nước khoáng') && !it.name?.toLowerCase().includes('nuoc khoang')
          );
          setCatalogItems(cleaned);
        }
      } catch (err) {
        console.warn('[RobotRoomServiceScreen] Failed to load catalog from server, using fallback', err);
      }
    };
    loadCatalog();
    return () => {
      isMounted = false;
    };
  }, []);
  const [cart, setCart] = useState({});
  const [requestNote, setRequestNote] = useState('');
  const [targetRoom, setTargetRoom] = useState(activeRoomNumber || '');

  useEffect(() => {
    if (activeRoomNumber && String(activeRoomNumber).trim()) {
      setTargetRoom(String(activeRoomNumber).trim());
    }
  }, [activeRoomNumber]);
  const [isLocalPinVerified, setIsLocalPinVerified] = useState(false);
  const isRoomAuth = Boolean(
    (authenticatedRoom && targetRoom && String(authenticatedRoom).trim() === String(targetRoom).trim()) ||
    (isLocalPinVerified && targetRoom)
  );
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [isPinModalSelectingRoom, setIsPinModalSelectingRoom] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successData, setSuccessData] = useState(null);
  const [submitError, setSubmitError] = useState('');
  const [voiceConfirmTick, setVoiceConfirmTick] = useState(0);
  const usedVoiceRef = useRef(false);

  const mainScrollRef = useRef(null);
  const isManualScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // Khi mở drawer xác nhận dịch vụ bên phải, khóa cuộn nền và chỉ cho cuộn danh sách bên trong drawer
  useEffect(() => {
    if (!isReviewModalOpen) return;

    const handleTouchMove = (e) => {
      const isInsideDrawerList = e.target?.closest?.('.room-service-drawer-scrollable');
      if (!isInsideDrawerList) {
        e.preventDefault();
      }
    };

    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    return () => {
      window.removeEventListener('touchmove', handleTouchMove);
    };
  }, [isReviewModalOpen]);

  const servicesByCategory = useMemo(() => {
    const list = catalogItems.length > 0 ? catalogItems : ROOM_SERVICE_CATALOG;
    return SERVICE_CATEGORIES.map((cat) => ({
      category: cat,
      items: list.filter((item) => item.category === cat.id),
    }));
  }, [catalogItems]);

  const handleCategoryClick = (catId) => {
    setActiveCategory(catId);
    isManualScrollingRef.current = true;

    const container = mainScrollRef.current;
    const targetEl = document.getElementById(`room-service-cat-section-${catId}`);
    if (container && targetEl) {
      const containerRect = container.getBoundingClientRect();
      const targetRect = targetEl.getBoundingClientRect();
      const targetScrollTop = targetRect.top - containerRect.top + container.scrollTop;
      container.scrollTo({
        top: Math.max(0, targetScrollTop - 4),
        behavior: 'smooth',
      });
    }

    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = setTimeout(() => {
      isManualScrollingRef.current = false;
    }, 700);
  };

  const handleMainScroll = () => {
    if (isManualScrollingRef.current) return;
    const container = mainScrollRef.current;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const isAtBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 30;

    if (isAtBottom) {
      const activeGroups = servicesByCategory.filter((g) => g.items.length > 0);
      const lastGroup = activeGroups[activeGroups.length - 1];
      if (lastGroup && lastGroup.category.id !== activeCategory) {
        setActiveCategory(lastGroup.category.id);
        const sidebarBtn = document.getElementById(`room-service-sidebar-cat-${lastGroup.category.id}`);
        if (sidebarBtn) {
          sidebarBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
      return;
    }

    let activeCatId = null;
    for (const group of servicesByCategory) {
      if (group.items.length === 0) continue;
      const el = document.getElementById(`room-service-cat-section-${group.category.id}`);
      if (el) {
        const rect = el.getBoundingClientRect();
        if (rect.top - containerRect.top <= 100) {
          activeCatId = group.category.id;
        }
      }
    }

    if (activeCatId && activeCatId !== activeCategory) {
      setActiveCategory(activeCatId);
      const sidebarBtn = document.getElementById(`room-service-sidebar-cat-${activeCatId}`);
      if (sidebarBtn) {
        sidebarBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  };

  const totalItemsCount = useMemo(() => {
    return Object.values(cart).reduce((sum, entry) => sum + entry.qty, 0);
  }, [cart]);

  const totalPrice = useMemo(() => {
    return Object.values(cart).reduce((sum, entry) => sum + entry.item.price * entry.qty, 0);
  }, [cart]);

  const handleAddToCart = (item) => {
    setCart((prev) => {
      const currentQty = prev[item.id]?.qty || 0;
      return {
        ...prev,
        [item.id]: { item, qty: currentQty + 1 },
      };
    });
  };

  const handleRemoveFromCart = (itemId) => {
    setCart((prev) => {
      const currentQty = prev[itemId]?.qty || 0;
      if (currentQty <= 1) {
        const next = { ...prev };
        delete next[itemId];
        return next;
      }
      return {
        ...prev,
        [itemId]: { ...prev[itemId], qty: currentQty - 1 },
      };
    });
  };

  const formatCurrency = (val) => {
    if (val === 0) return 'Miễn phí';
    return new Intl.NumberFormat('vi-VN').format(val) + ' đ';
  };

  const executeSubmitRequest = async (verifiedRoom, guestNameOverride) => {
    setIsSubmitting(true);
    setSubmitError('');
    const roomToUse = verifiedRoom || targetRoom;
    const itemsPayload = Object.values(cart).map((entry) => ({
      name: entry.item.name,
      qty: entry.qty,
      price: entry.item.price,
      notes: entry.item.unit || '',
    }));

    const itemsSummary = Object.values(cart).map((c) => `${c.qty}x ${c.item.name}`).join(', ');

    try {
      const res = await createRoomServiceOrder({
        room_number: roomToUse,
        guest_name: guestNameOverride || undefined,
        special_instructions: requestNote
          ? `[Dịch vụ phòng Room Service] ${requestNote}`
          : `[Dịch vụ phòng Room Service] Yêu cầu ${itemsSummary}`,
        items: itemsPayload,
        total_amount: totalPrice,
        note: requestNote || `Yêu cầu dịch vụ phòng: ${itemsSummary}`,
        is_service_request: true,
      });

      const isMerged = Boolean(res?.is_merged);
      const orderCode = res?.ticket_code || res?.order_number || res?.id || `RS-${Math.floor(1000 + Math.random() * 9000)}`;

      setSuccessData({
        orderCode,
        room: roomToUse,
        totalAmount: res?.total_amount || totalPrice,
        itemCount: totalItemsCount,
        itemsSummary,
        isMerged,
      });

      setCart({});
      setRequestNote('');
      setIsReviewModalOpen(false);
      setIsLocalPinVerified(true);
      if (typeof onPinVerifiedSuccess === 'function') {
        onPinVerifiedSuccess(roomToUse);
      }
      if (onRequestSuccess) {
        onRequestSuccess({
          ...res,
          orderCode,
          room_number: roomToUse,
          totalAmount: totalPrice,
          itemsSummary,
        });
      }
    } catch (err) {
      setSubmitError(err?.message || 'Chưa thể gửi yêu cầu tới Room Service lúc này. Quý khách vui lòng thử lại ạ.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmSubmit = () => {
    if (totalItemsCount === 0 || isSubmitting) return;
    const roomToUse = targetRoom || activeRoomNumber;
    const isCurrentlyAuth = Boolean(
      roomToUse &&
      ((authenticatedRoom && String(authenticatedRoom).trim() === String(roomToUse).trim()) ||
       isLocalPinVerified)
    );
    if (isCurrentlyAuth && roomToUse && String(roomToUse).trim()) {
      setIsReviewModalOpen(false);
      executeSubmitRequest(roomToUse);
    } else {
      setIsReviewModalOpen(false);
      if (roomToUse && String(roomToUse).trim()) {
        setIsPinModalSelectingRoom(false);
      } else {
        setIsPinModalSelectingRoom(true);
      }
      setIsPinModalOpen(true);
    }
  };

  useEffect(() => {
    if (voiceConfirmTick > 0) {
      handleConfirmSubmit();
    }
  }, [voiceConfirmTick]);

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
    isEn: false,
    onUnhandledVoice,
    onVoiceCommand: (text) => {
      usedVoiceRef.current = true;
      setSubmitError('');
      const spokenRoom = extractRoomIfValid(text);
      if (spokenRoom) {
        setTargetRoom(spokenRoom);
        if (typeof onRoomChange === 'function') onRoomChange(spokenRoom);
      }
      const activeList = catalogItems.length > 0 ? catalogItems : ROOM_SERVICE_CATALOG;
      const matched = matchCatalogItemsByVoice(text, activeList);
      const isConfirm = isMenuConfirmVoice(text);

      if (matched.length > 0) {
        setCart((prev) => {
          const next = { ...prev };
          for (const { item, qty } of matched) {
            const cur = next[item.id]?.qty || 0;
            next[item.id] = { item, qty: cur + qty };
          }
          return next;
        });
        setIsReviewModalOpen(true);
        const summary = matched.map((m) => `${m.qty} ${m.item.name}`).join(', ');
        if (isConfirm) {
          setVoiceConfirmTick((n) => n + 1);
        } else {
          announce(`Dạ em đã chọn ${summary}. Quý khách nói Xác nhận hoặc chạm Gửi yêu cầu để chuyển bộ phận Room Service nhé ạ.`);
        }
        return true;
      }

      if (isConfirm) {
        if (totalItemsCount > 0) {
          setVoiceConfirmTick((n) => n + 1);
        } else {
          announce('Quý khách chưa chọn dịch vụ nào. Quý khách cần khăn tắm, dọn phòng, giặt ủi hay massage ạ?');
        }
        return true;
      }

      return false;
    },
  });

  useEffect(() => {
    if (successData && usedVoiceRef.current) {
      usedVoiceRef.current = false;
      announce(
        successData.isMerged
          ? `Dạ yêu cầu cho Phòng ${successData.room} đã được gộp chung vào đơn Room Service #${successData.orderCode} ạ.`
          : `Dạ yêu cầu dịch vụ #${successData.orderCode} cho Phòng ${successData.room} đã được lưu và gửi tới bộ phận Room Service rồi ạ.`
      );
    }
  }, [successData, announce]);

  useEffect(() => {
    if (submitError && usedVoiceRef.current) {
      announce(submitError);
    }
  }, [submitError, announce]);

  return (
    <div className="fixed inset-0 w-full h-[100dvh] max-h-[100dvh] bg-[#F5F2EB] text-[#1A1917] select-none flex overflow-hidden font-sans z-30 overscroll-none touch-none">
      {/* SIDEBAR DANH MỤC DỊCH VỤ */}
      <aside className="w-[calc(10rem+env(safe-area-inset-left,0px))] sm:w-[calc(11.5rem+env(safe-area-inset-left,0px))] shrink-0 bg-[#EFECE4] border-r border-[#E3DFD5] flex flex-col h-full select-none overscroll-contain touch-none pl-[max(0.75rem,env(safe-area-inset-left,0px))]">
        <div className="h-11 sm:h-12 shrink-0 px-2 sm:px-3 border-b border-[#E3DFD5] flex items-center bg-white/40 touch-none">
          <span className="text-[10px] sm:text-[11px] font-black uppercase text-stone-700 tracking-wider truncate">
            Dịch Vụ Phòng
          </span>
        </div>

        <nav
          className={`flex-1 min-h-0 p-1.5 space-y-1 ${
            isReviewModalOpen ? 'overflow-hidden pointer-events-none' : 'overflow-y-auto'
          } overscroll-contain touch-pan-y no-scrollbar`}
        >
          {SERVICE_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                id={`room-service-sidebar-cat-${cat.id}`}
                type="button"
                onClick={() => handleCategoryClick(cat.id)}
                className={`w-full px-2 sm:px-2.5 py-1.5 sm:py-2 rounded-xl text-left text-[11px] font-bold flex items-center gap-2 transition-all cursor-pointer active:scale-95 ${
                  isActive
                    ? 'bg-[#1A1917] text-white shadow-sm'
                    : 'text-stone-700 hover:bg-white/70 hover:text-stone-900'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-white' : 'text-stone-500'}`} />
                <span className="block truncate">{cat.name}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* KHU VỰC CHÍNH: HEADER + DANH SÁCH DỊCH VỤ NẰM NGANG THEO DANH MỤC + FOOTER */}
      <div className="flex-1 min-w-0 flex flex-col h-full bg-[#F5F2EB] overscroll-none touch-none">
        {/* Header trên */}
        <header className="h-11 sm:h-12 shrink-0 border-b border-[#E3DFD5] px-3 sm:px-4 pr-[max(0.75rem,env(safe-area-inset-right,0px))] flex items-center justify-between gap-2 bg-white/80 backdrop-blur-md touch-none">
          <div className="min-w-0 flex-1 flex items-center">
            <h1 className="text-xs sm:text-sm font-black text-stone-900 tracking-tight truncate">
              Tiện Ích & Dịch Vụ Phục Vụ Tại Phòng
            </h1>
          </div>

          {/* Thanh điều khiển Header: Chọn phòng, Quay lại Robot */}
          <div className="flex items-center gap-2 shrink-0">
            <MenuVoiceButton
              isListening={isListening}
              isSpeaking={isSpeaking}
              isEn={false}
              onToggle={() => {
                usedVoiceRef.current = true;
                toggleVoice();
              }}
            />
            {/* 1. Nút Chọn / Sửa Số Phòng */}
            <button
              type="button"
              onClick={() => {
                setIsPinModalSelectingRoom(true);
                setIsPinModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white hover:bg-stone-50 border border-[#E3DFD5] hover:border-stone-400 text-[11px] font-bold text-stone-800 shadow-sm transition-all cursor-pointer active:scale-95 group shrink-0 whitespace-nowrap"
              title="Bấm để chọn hoặc đổi số phòng"
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${targetRoom ? 'bg-emerald-500' : 'bg-stone-400'}`} />
              <span>{targetRoom ? `Phòng ${targetRoom}` : 'Chọn số phòng'}</span>
              <Edit3 className="w-3 h-3 text-stone-400 group-hover:text-stone-700 transition-colors ml-0.5 shrink-0" />
            </button>

            {/* 2. Nút Quay lại màn hình Robot (giống màn hình chọn món ăn) */}
            <button
              type="button"
              onClick={onClose}
              className="h-8 px-3.5 rounded-full bg-[#1A1917] hover:bg-stone-800 text-white text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-sm shrink-0 whitespace-nowrap"
              title="Quay lại giao diện Robot"
            >
              <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
              <span>Quay lại Robot</span>
            </button>
          </div>
        </header>

        {/* Danh sách dịch vụ nằm ngang gom nhóm theo danh mục */}
        <main
          ref={mainScrollRef}
          onScroll={handleMainScroll}
          className={`flex-1 min-h-0 p-3 sm:p-4 pr-[max(0.75rem,env(safe-area-inset-right,0px))] ${
            isReviewModalOpen ? 'overflow-hidden pointer-events-none' : 'overflow-y-auto'
          } overscroll-contain touch-pan-y custom-scrollbar`}
        >
          <div className="space-y-6 pb-4">
            {servicesByCategory.map((group) => {
              if (group.items.length === 0) return null;

              return (
                <section
                  key={group.category.id}
                  id={`room-service-cat-section-${group.category.id}`}
                  className="scroll-mt-2"
                >
                  {/* Note phân cách danh mục */}
                  <div className="flex items-center gap-2 mb-2.5 pt-1">
                    <span className="text-stone-900 text-sm font-black leading-none select-none">•</span>
                    <h2 className="text-xs sm:text-sm font-black text-stone-900 uppercase tracking-wider">
                      {group.category.name}
                    </h2>
                  </div>

                  {/* Danh sách 1 cột thẻ ngang (giống chọn món ăn) */}
                  <div className="flex flex-col gap-3 sm:gap-3.5">
                    {group.items.map((item) => {
                      const inCartQty = cart[item.id]?.qty || 0;

                      return (
                        <div
                          key={item.id}
                          className="bg-white rounded-2xl sm:rounded-3xl border border-[#E3DFD5] p-3 sm:p-3.5 shadow-xs hover:shadow-md transition-all flex items-center gap-3.5 sm:gap-4 group hover:border-stone-400 min-h-[116px] sm:min-h-[124px]"
                        >
                          {/* Ảnh dịch vụ bên trái */}
                          <div className="relative w-24 h-24 sm:w-28 sm:h-28 shrink-0 rounded-2xl overflow-hidden bg-stone-100 shadow-xs">
                            <img
                              src={item.image_url}
                              alt={item.name}
                              loading="lazy"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            {item.badge && (
                              <span className="absolute bottom-1.5 left-1.5 px-2 py-0.5 bg-black/70 backdrop-blur-xs text-white text-[9px] font-bold rounded-md">
                                {item.badge}
                              </span>
                            )}
                          </div>

                          {/* Thông tin dịch vụ ở giữa */}
                          <div className="flex-1 min-w-0 flex flex-col justify-center pr-2">
                            <h3 className="text-sm sm:text-base font-black text-stone-900 truncate group-hover:text-black leading-snug">
                              {item.name}
                            </h3>
                            <p className="text-xs sm:text-[13px] text-stone-600 line-clamp-2 mt-1 leading-relaxed">
                              {item.description}
                            </p>
                            <div className="mt-1.5 flex items-center gap-3 text-[10px] sm:text-[11px] text-stone-400 font-medium">
                              <span className="truncate">Quy cách: {item.unit}</span>
                              {item.prep_time ? (
                                <span className="flex items-center gap-1 shrink-0 text-stone-500">
                                  <Clock className="w-3 h-3 shrink-0" />
                                  <span>~{item.prep_time}p</span>
                                </span>
                              ) : null}
                            </div>
                          </div>

                          {/* Cột giá tiền & Thao tác bên phải */}
                          <div className="flex flex-col items-end justify-between self-stretch py-1 shrink-0 pl-3 sm:pl-4 border-l border-stone-100 min-w-[105px] sm:min-w-[120px]">
                            <span
                              className={`text-sm sm:text-base font-black whitespace-nowrap ${
                                item.price === 0 ? 'text-emerald-700' : 'text-stone-900'
                              }`}
                            >
                              {formatCurrency(item.price)}
                            </span>

                            {inCartQty === 0 ? (
                              <button
                                type="button"
                                onClick={() => handleAddToCart(item)}
                                className="h-8 sm:h-8.5 px-3.5 sm:px-4 rounded-full bg-[#1A1917] hover:bg-stone-800 text-white flex items-center justify-center font-bold text-xs sm:text-sm shadow-xs active:scale-95 transition-all cursor-pointer whitespace-nowrap"
                                title="Thêm vào danh sách yêu cầu"
                              >
                                + Yêu cầu
                              </button>
                            ) : (
                              <div className="flex items-center gap-1 bg-stone-100 rounded-full p-1 border border-stone-200">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveFromCart(item.id)}
                                  className="w-7 h-7 sm:w-7.5 sm:h-7.5 rounded-full bg-white hover:bg-stone-200 text-stone-800 font-bold text-sm flex items-center justify-center shadow-xs cursor-pointer active:scale-95"
                                  title="Bớt 1 dịch vụ"
                                >
                                  -
                                </button>
                                <span className="text-xs sm:text-sm font-black text-stone-900 min-w-5 text-center px-0.5">
                                  {inCartQty}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleAddToCart(item)}
                                  className="w-7 h-7 sm:w-7.5 sm:h-7.5 rounded-full bg-[#1A1917] hover:bg-stone-800 text-white font-bold text-sm flex items-center justify-center shadow-xs cursor-pointer active:scale-95"
                                  title="Thêm 1 dịch vụ"
                                >
                                  +
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </main>

        {/* HÀNG CUỐI: TỔNG CỘNG & NÚT XEM LẠI YÊU CẦU */}
        <footer className="h-11 sm:h-12 shrink-0 bg-white border-t border-[#E3DFD5] px-4 sm:px-6 pr-[max(1rem,env(safe-area-inset-right,0px))] flex items-center justify-between gap-2 shadow-lg z-10 touch-none pb-[env(safe-area-inset-bottom,0px)]">
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="text-[10px] sm:text-xs font-bold text-stone-500 uppercase tracking-wider shrink-0">
              Tổng cộng:
            </span>
            <span className="text-base sm:text-xl font-black text-stone-900 tracking-tight truncate">
              {totalItemsCount === 0 ? '0 đ' : formatCurrency(totalPrice)}
            </span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setIsReviewModalOpen(true)}
              disabled={totalItemsCount === 0}
              className={`h-8 sm:h-9 px-3.5 sm:px-4 rounded-full font-bold text-[11px] sm:text-xs flex items-center gap-2 shadow-md transition-all cursor-pointer active:scale-95 whitespace-nowrap ${
                totalItemsCount > 0
                  ? 'bg-[#1A1917] hover:bg-stone-800 text-white shadow-stone-950/20'
                  : 'bg-stone-200 text-stone-400 cursor-not-allowed'
              }`}
            >
              <ConciergeBell className="w-3.5 h-3.5 shrink-0" />
              <span>Xem lại yêu cầu</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[9px] sm:text-[10px] font-black min-w-4 text-center ${
                  totalItemsCount > 0 ? 'bg-amber-400 text-stone-950' : 'bg-stone-300 text-stone-500'
                }`}
              >
                {totalItemsCount}
              </span>
            </button>
          </div>
        </footer>
      </div>

      {/* DRAWER BÊN PHẢI: XEM LẠI & XÁC NHẬN DỊCH VỤ PHÒNG TRƯỚC KHI NHẬP PIN */}
      {isReviewModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-stretch justify-end animate-fadeIn overscroll-none touch-none"
          onClick={() => setIsReviewModalOpen(false)}
        >
          <div
            className="w-full max-w-[380px] sm:max-w-md h-full max-h-[100dvh] bg-[#FAF8F5] border-l border-[#E3DFD5] text-[#1A1917] shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-200 overscroll-contain touch-none"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Drawer */}
            <div className="h-12 sm:h-14 shrink-0 px-4 sm:px-5 pr-[max(1rem,env(safe-area-inset-right,0px))] border-b border-[#E3DFD5] bg-white flex items-center justify-between gap-2 touch-none">
              <div className="flex items-center gap-2 min-w-0">
                <ConciergeBell className="w-4 h-4 text-stone-700 shrink-0" />
                <h3 className="text-sm sm:text-base font-extrabold text-stone-900 truncate">
                  Xác Nhận Dịch Vụ Phòng
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsReviewModalOpen(false)}
                className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-500 hover:text-stone-800 transition-colors flex items-center justify-center cursor-pointer shrink-0"
                title="Đóng"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Danh sách dịch vụ bên trong drawer (chỉ cuộn vùng này) */}
            <div className="room-service-drawer-scrollable flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 pr-[max(0.75rem,env(safe-area-inset-right,0px))] space-y-2.5 custom-scrollbar overscroll-contain touch-pan-y">
              {/* Vị trí phục vụ - Chọn số phòng nhận dịch vụ */}
              <div className="flex justify-between items-center gap-2 text-xs p-2.5 sm:p-3 bg-white rounded-2xl border border-[#E3DFD5] shadow-2xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${targetRoom ? 'bg-emerald-500' : 'bg-stone-400'}`} />
                  <span className="text-stone-600 font-medium truncate">Phục vụ tới phòng:</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsReviewModalOpen(false);
                    setIsPinModalSelectingRoom(true);
                    setIsPinModalOpen(true);
                  }}
                  className="font-bold text-stone-900 hover:text-stone-700 flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-xl bg-stone-50 hover:bg-stone-100 border border-stone-200 shadow-2xs cursor-pointer transition-colors active:scale-95 shrink-0 whitespace-nowrap"
                  title="Bấm để chọn hoặc đổi số phòng"
                >
                  <span>{targetRoom ? `Phòng ${targetRoom}` : 'Chưa chọn phòng'}</span>
                  <Edit3 className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                </button>
              </div>

              {Object.values(cart).length === 0 ? (
                <div className="h-32 flex items-center justify-center text-xs text-stone-400 bg-white rounded-2xl border border-[#E3DFD5]">
                  Chưa có dịch vụ nào được chọn.
                </div>
              ) : (
                <div className="space-y-2">
                  {Object.values(cart).map(({ item, qty }) => (
                    <div
                      key={item.id}
                      className="p-3 rounded-2xl bg-white border border-[#E3DFD5] flex items-center justify-between gap-2.5 text-xs shadow-2xs"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-stone-900 truncate">{item.name}</p>
                        <p className="text-[10px] text-stone-500 truncate">{item.unit}</p>
                        <p className={`text-[11px] font-bold mt-0.5 ${item.price > 0 ? 'text-stone-900' : 'text-emerald-700'}`}>
                          {item.price > 0 ? formatCurrency(item.price * qty) : 'Miễn phí'}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 bg-stone-100 rounded-full p-1 border border-stone-200 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleRemoveFromCart(item.id)}
                          className="w-6 h-6 rounded-full bg-white hover:bg-stone-200 text-stone-800 font-bold text-xs flex items-center justify-center cursor-pointer shadow-xs"
                          title="Giảm số lượng"
                        >
                          -
                        </button>
                        <span className="text-xs font-black text-stone-900 min-w-4 text-center">
                          {qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleAddToCart(item)}
                          className="w-6 h-6 rounded-full bg-[#1A1917] hover:bg-stone-800 text-white font-bold text-xs flex items-center justify-center cursor-pointer shadow-xs"
                          title="Tăng số lượng"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer Drawer: Thông báo thanh toán & Nút Xác Nhận */}
            <div className="shrink-0 p-3 sm:p-4 pr-[max(0.75rem,env(safe-area-inset-right,0px))] pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] border-t border-[#E3DFD5] bg-white space-y-2.5 touch-none">
              <div className="p-2.5 sm:p-3 rounded-2xl bg-[#EFECE4]/60 border border-[#E3DFD5] text-[11px] text-stone-700 space-y-0.5">
                <div className="flex justify-between font-extrabold text-xs text-stone-900 gap-2">
                  <span>Tổng chi phí phát sinh:</span>
                  <span className="shrink-0">{formatCurrency(totalPrice)}</span>
                </div>
                <p className="text-[10px] text-stone-500 leading-snug">
                  Chi phí (nếu có) được ghi nhận vào hóa đơn phòng khi trả phòng tại Lễ tân.
                </p>
              </div>

              {submitError && (
                <div className="p-2.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
                  {submitError}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsReviewModalOpen(false)}
                  className="px-3.5 sm:px-4 py-2.5 rounded-2xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold transition-all cursor-pointer shrink-0 whitespace-nowrap"
                >
                  Chọn thêm
                </button>
                <button
                  type="button"
                  disabled={totalItemsCount === 0 || isSubmitting}
                  onClick={handleConfirmSubmit}
                  className="flex-1 py-2.5 px-3 rounded-2xl bg-[#1A1917] hover:bg-stone-800 disabled:opacity-50 text-white text-xs font-bold shadow-md transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap"
                >
                  {isSubmitting ? (
                    <span>Đang gửi...</span>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-stone-300 shrink-0" />
                      <span>
                        {targetRoom || activeRoomNumber
                          ? `Gửi Yêu Cầu (Phòng ${targetRoom || activeRoomNumber})`
                          : 'Tiếp Tục'}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL MÃ PIN XÁC THỰC 4 SỐ CUỐI CCCD */}
      <RoomPinModal
        isOpen={isPinModalOpen}
        language={language}
        speak={speak}
        onClose={(reason) => {
          if (reason === 'manual' && typeof onStopSpeaking === 'function') {
            onStopSpeaking();
          }
          setIsPinModalOpen(false);
          setIsPinModalSelectingRoom(false);
          if (totalItemsCount > 0) {
            setIsReviewModalOpen(true);
          }
        }}
        roomNumber={targetRoom || activeRoomNumber}
        isSelectingRoomInitial={isPinModalSelectingRoom}
        sessionId={sessionId}
        onRoomSelect={(room) => {
          setTargetRoom(room);
          if (onRoomChange) onRoomChange(room);
        }}
        pendingAction="verify_only"
        skipTicketCreation={true}
        pendingItems={Object.values(cart).map((c) => `${c.qty}x ${c.item.name}`).join(', ')}
        initialTab="pin"
        onVerifiedSuccess={(res, verifiedRoom) => {
          const finalRoom = verifiedRoom || res?.room_number || targetRoom || activeRoomNumber;
          setTargetRoom(finalRoom);
          setIsLocalPinVerified(true);
          if (typeof onPinVerifiedSuccess === 'function') {
            onPinVerifiedSuccess(finalRoom);
          }
          if (onRoomChange) onRoomChange(finalRoom);
          setIsPinModalOpen(false);
          setIsPinModalSelectingRoom(false);
          if (totalItemsCount > 0) {
            // Xác thực PIN thành công -> Tiến hành tạo đơn Room Service
            executeSubmitRequest(finalRoom, res?.guest_name);
          }
        }}
        onNotCheckedIn={(info) => {
          setIsPinModalOpen(false);
          setIsReviewModalOpen(false);
          onClose();
          if (onNotCheckedIn) onNotCheckedIn(info);
        }}
        onForgotPin={(info) => {
          setIsPinModalOpen(false);
          setIsReviewModalOpen(false);
          onClose();
          if (onNotCheckedIn) {
            onNotCheckedIn({
              destination_key: 'front_desk',
              message: 'Dạ vì lý do an toàn và bảo mật thông tin phòng, Robot không thể cấp lại mã PIN phòng. Quý khách vui lòng đến quầy Lễ tân tại sảnh chính để được nhân viên hỗ trợ nhé ạ.',
              roomNumber: info?.roomNumber || targetRoom,
            });
          }
        }}
      />

      {/* POPUP THÔNG BÁO YÊU CẦU DỊCH VỤ THÀNH CÔNG */}
      {successData && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-stone-900 border border-stone-800 text-stone-100 rounded-2xl p-4 sm:p-5 max-w-sm w-full max-h-[calc(100dvh-1.5rem)] overflow-y-auto overscroll-contain touch-pan-y shadow-2xl text-center space-y-3.5 custom-scrollbar">
            <div className="w-12 h-12 rounded-xl bg-stone-800 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto">
              <Check className="w-6 h-6" />
            </div>

            <div>
              {successData.isMerged ? (
                <>
                  <span className="inline-block px-3 py-0.5 rounded-full bg-indigo-900/60 text-indigo-300 border border-indigo-700/60 text-[11px] font-bold mb-1.5">
                    Đã Tự Động Gộp Vào Yêu Cầu Hiện Tại
                  </span>
                  <h3 className="text-base font-bold text-stone-100">Gộp Yêu Cầu Thành Công!</h3>
                  <p className="text-xs text-stone-400 mt-1">
                    Mã yêu cầu: <span className="font-mono font-bold text-stone-200">{successData.orderCode}</span>
                  </p>
                  <p className="text-xs text-stone-300 mt-2 leading-relaxed">
                    Phòng <strong>{successData.room}</strong> đang có yêu cầu chờ xử lý. Hệ thống đã tự động gộp các dịch vụ này vào chung đơn để phục vụ cùng một chuyến duy nhất.
                  </p>
                </>
              ) : (
                <>
                  <h3 className="text-base font-bold text-stone-100">Yêu Cầu Dịch Vụ Thành Công!</h3>
                  <p className="text-xs text-stone-400 mt-1">
                    Mã yêu cầu: <span className="font-mono font-bold text-stone-200">{successData.orderCode}</span>
                  </p>
                  <p className="text-xs text-stone-300 mt-2 leading-relaxed">
                    Yêu cầu đã được chuyển tới bộ phận <strong>Room Service</strong> để phục vụ đến{' '}
                    <strong>phòng {successData.room}</strong> trong ít phút tới.
                  </p>
                </>
              )}
            </div>

            <div className="p-3 bg-stone-800/80 rounded-xl border border-stone-700/50 text-xs flex flex-col gap-1 text-left">
              <div className="flex justify-between font-bold">
                <span className="text-stone-400">Ghi vào hóa đơn phòng:</span>
                <span className="text-stone-100">{formatCurrency(successData.totalAmount)}</span>
              </div>
              <p className="text-[11px] text-stone-400 font-normal">
                Hóa đơn đã được gửi về quầy Lễ tân để thanh toán khi trả phòng (không thanh toán tại chỗ).
              </p>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setSuccessData(null)}
                className="flex-1 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold transition-all cursor-pointer"
              >
                Tiếp tục xem dịch vụ
              </button>
              <button
                type="button"
                onClick={() => {
                  setSuccessData(null);
                  onClose();
                }}
                className="flex-1 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-900 text-xs font-bold transition-all cursor-pointer"
              >
                Về Robot
              </button>
            </div>
          </div>
        </div>
      )}

      <MenuVoiceSubtitle
        message={voiceReply}
        transcript={transcript}
        isListening={isListening}
        isEn={false}
        onClear={clearVoiceReply}
      />
    </div>
  );
};
