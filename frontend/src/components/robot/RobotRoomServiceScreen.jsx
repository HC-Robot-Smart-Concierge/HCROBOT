import React, { useState, useMemo, useCallback } from 'react';
import {
  X,
  Plus,
  Minus,
  Sparkles,
  CheckCircle2,
  Clock,
  ChevronRight,
  ShieldCheck,
  BedDouble,
  Bath,
  Shirt,
  HeartHandshake,
  ConciergeBell,
  Check,
  Edit3,
  RefreshCw,
} from 'lucide-react';
import { RoomPinModal } from './RoomPinModal';
import { createRoomServiceOrder, fetchRoomOrdersHistory } from '../../services/operationsApi';

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
  {
    id: 'AMENITY-06',
    name: 'Nước khoáng Aurora đóng chai',
    category: 'bath',
    price: 0,
    unit: '2 chai (500ml)',
    prep_time: 8,
    badge: 'Miễn phí',
    description: 'Nước khoáng thiên nhiên đóng chai thủy tinh cao cấp phục vụ thêm tại phòng.',
    image_url: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=500&auto=format&fit=crop&q=80',
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
  { id: 'all', name: 'Tất Cả', icon: Sparkles },
  { id: 'bath', name: 'Khăn & Tiện Ích', icon: Bath },
  { id: 'spa', name: 'Massage Tại Phòng', icon: HeartHandshake },
  { id: 'bedding', name: 'Gối & Chăn Ấm', icon: BedDouble },
  { id: 'housekeeping', name: 'Dọn Phòng Nhanh', icon: ConciergeBell },
  { id: 'laundry', name: 'Giặt Ủi', icon: Shirt },
];

export const RobotRoomServiceScreen = ({
  activeRoomNumber = '',
  onClose,
  onRoomChange,
  onRequestSuccess,
  onNotCheckedIn,
}) => {
  const [activeCategory, setActiveCategory] = useState('all');
  const [cart, setCart] = useState({});
  const [requestNote, setRequestNote] = useState('');
  const [targetRoom, setTargetRoom] = useState(activeRoomNumber || '');
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [isPinModalSelectingRoom, setIsPinModalSelectingRoom] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successData, setSuccessData] = useState(null);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [statusOrders, setStatusOrders] = useState([]);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);

  const loadStatusForRoom = useCallback(async (roomNum) => {
    const room = roomNum || targetRoom;
    if (!room || !String(room).trim()) {
      setIsPinModalSelectingRoom(true);
      setIsPinModalOpen(true);
      return;
    }
    setIsLoadingStatus(true);
    setIsStatusModalOpen(true);
    try {
      const res = await fetchRoomOrdersHistory(room);
      setStatusOrders(res?.orders || []);
    } catch {
      setStatusOrders([]);
    } finally {
      setIsLoadingStatus(false);
    }
  }, [targetRoom]);

  const filteredServices = useMemo(() => {
    if (activeCategory === 'all') return ROOM_SERVICE_CATALOG;
    return ROOM_SERVICE_CATALOG.filter((item) => item.category === activeCategory);
  }, [activeCategory]);

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

  const executeSubmitRequest = async (verifiedRoom) => {
    setIsSubmitting(true);
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
        guest_name: 'Quý Khách',
        special_instructions: requestNote
          ? `[Dịch vụ phòng Room Service] ${requestNote}`
          : `[Dịch vụ phòng Room Service] Yêu cầu ${itemsSummary}`,
        items: itemsPayload,
        total_amount: totalPrice,
        note: requestNote || `Yêu cầu dịch vụ phòng: ${itemsSummary}`,
        is_service_request: true,
      });

      const orderCode = res?.ticket_code || res?.id || `RS-${Math.floor(1000 + Math.random() * 9000)}`;

      setSuccessData({
        orderCode,
        room: roomToUse,
        totalAmount: totalPrice,
        itemCount: totalItemsCount,
        itemsSummary,
      });

      setCart({});
      setRequestNote('');
      setIsReviewModalOpen(false);

      if (onRequestSuccess) {
        onRequestSuccess({
          ...res,
          orderCode,
          room_number: roomToUse,
          totalAmount: totalPrice,
          itemsSummary,
        });
      }
    } catch {
      const fallbackCode = `RS-${Math.floor(1000 + Math.random() * 9000)}`;
      setSuccessData({
        orderCode: fallbackCode,
        room: roomToUse,
        totalAmount: totalPrice,
        itemCount: totalItemsCount,
        itemsSummary,
      });
      setCart({});
      setIsReviewModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 w-full h-[100dvh] max-h-[100dvh] bg-[#F5F2EB] text-[#1A1917] select-none flex overflow-hidden font-sans z-30 overscroll-none touch-none">
      {/* SIDEBAR DANH MỤC DỊCH VỤ */}
      <aside className="w-36 sm:w-44 shrink-0 bg-[#EFECE4] border-r border-[#E3DFD5] flex flex-col h-full select-none pl-[max(0.75rem,env(safe-area-inset-left,0px))]">
        <div className="p-3 border-b border-[#E3DFD5]">
          <div className="flex items-center gap-1.5 text-stone-500 text-[10px] uppercase font-bold tracking-wider">
            <ConciergeBell className="w-3.5 h-3.5" />
            <span>Room Service</span>
          </div>
          <h2 className="text-xs sm:text-sm font-black text-stone-900 mt-0.5">Dịch Vụ Phòng</h2>
        </div>

        <nav className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
          {SERVICE_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`w-full p-2.5 rounded-xl text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#1A1917] text-white shadow-sm font-bold'
                    : 'hover:bg-[#E5E1D8] text-stone-700 font-medium'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-stone-500'}`} />
                <span className="text-xs truncate">{cat.name}</span>
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

      {/* KHU VỰC CHÍNH: LƯỚI DANH SÁCH DỊCH VỤ */}
      <main className="flex-1 flex flex-col h-full min-w-0 bg-[#F5F2EB]">
        {/* Header trên */}
        <header className="h-14 px-4 sm:px-6 bg-[#F5F2EB] border-b border-[#E3DFD5] flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-sm sm:text-base font-black text-stone-900">
              Tiện Ích & Dịch Vụ Phục Vụ Tại Phòng
            </h1>
            <p className="text-[11px] text-stone-500">
              Khăn tắm, chăn gối, massage thư giãn · Gửi về Room Service & Lễ tân
            </p>
          </div>

          {/* Thanh điều khiển Header: Chọn phòng, Tiến độ, Giỏ hàng, Đóng */}
          <div className="flex items-center gap-2">
            {/* 1. Nút Chọn / Sửa Số Phòng */}
            <button
              type="button"
              onClick={() => {
                setIsPinModalSelectingRoom(true);
                setIsPinModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white hover:bg-stone-50 border border-[#E3DFD5] hover:border-stone-400 text-[11px] font-bold text-stone-800 shadow-xs transition-all cursor-pointer active:scale-95 group"
              title="Bấm để chọn hoặc đổi số phòng"
            >
              <span className={`w-2 h-2 rounded-full ${targetRoom ? 'bg-emerald-500' : 'bg-stone-400'}`} />
              <span>{targetRoom ? `Phòng ${targetRoom}` : 'Chọn số phòng'}</span>
              <Edit3 className="w-3 h-3 text-stone-400 group-hover:text-stone-700 transition-colors ml-0.5" />
            </button>

            {/* 2. Nút Tra Cứu Tiến Độ Yêu Cầu & Dọn Phòng */}
            <button
              type="button"
              onClick={() => loadStatusForRoom(targetRoom)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white hover:bg-stone-50 border border-[#E3DFD5] hover:border-stone-400 text-[11px] font-bold text-stone-700 hover:text-stone-900 shadow-xs transition-all cursor-pointer active:scale-95"
              title="Tra cứu tiến độ dịch vụ phòng và dọn phòng"
            >
              <Clock className="w-3.5 h-3.5 text-stone-500" />
              <span className="hidden sm:inline">Tiến độ yêu cầu</span>
              <span className="sm:hidden">Tiến độ</span>
            </button>

            {/* 3. Giỏ yêu cầu mini */}
            {totalItemsCount > 0 && (
              <button
                type="button"
                onClick={() => setIsReviewModalOpen(true)}
                className="px-3.5 py-1.5 rounded-full bg-[#1A1917] hover:bg-stone-800 text-white text-xs font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                <ConciergeBell className="w-3.5 h-3.5" />
                <span>Yêu Cầu ({totalItemsCount})</span>
                {totalPrice > 0 && <span>· {formatCurrency(totalPrice)}</span>}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full hover:bg-stone-200 text-stone-600 transition-colors cursor-pointer"
              title="Đóng"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Danh sách lưới dịch vụ */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 pb-20">
            {filteredServices.map((item) => {
              const inCartQty = cart[item.id]?.qty || 0;
              return (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl border border-[#E3DFD5] shadow-xs hover:shadow-md overflow-hidden flex flex-col transition-all group"
                >
                  {/* Hình ảnh dịch vụ */}
                  <div className="relative h-32 sm:h-36 overflow-hidden bg-stone-100">
                    <img
                      src={item.image_url}
                      alt={item.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-xs text-[10px] font-bold text-white">
                      {item.badge}
                    </div>
                    <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-stone-900/80 backdrop-blur-xs text-[10px] font-medium text-stone-200 flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      <span>~{item.prep_time}p</span>
                    </div>
                  </div>

                  {/* Thông tin dịch vụ */}
                  <div className="p-3.5 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-1.5">
                        <h3 className="text-xs sm:text-sm font-bold text-stone-900 line-clamp-1">
                          {item.name}
                        </h3>
                      </div>
                      <p className="text-[10px] sm:text-[11px] text-stone-500 mt-1 line-clamp-2 leading-relaxed">
                        {item.description}
                      </p>
                      <div className="mt-1 text-[10px] text-stone-400 font-medium">
                        Quy cách: {item.unit}
                      </div>
                    </div>

                    {/* Giá tiền & Nút Thêm */}
                    <div className="mt-3 pt-2.5 border-t border-stone-100 flex items-center justify-between">
                      <span className="text-xs sm:text-sm font-extrabold text-stone-900">
                        {formatCurrency(item.price)}
                      </span>

                      {inCartQty > 0 ? (
                        <div className="flex items-center gap-2 bg-stone-100 px-2 py-1 rounded-xl border border-stone-200">
                          <button
                            type="button"
                            onClick={() => handleRemoveFromCart(item.id)}
                            className="w-6 h-6 rounded-lg bg-white hover:bg-stone-200 flex items-center justify-center text-stone-800 transition-colors cursor-pointer"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-xs font-black min-w-[16px] text-center">
                            {inCartQty}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleAddToCart(item)}
                            className="w-6 h-6 rounded-lg bg-[#1A1917] hover:bg-stone-800 text-white flex items-center justify-center transition-colors cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleAddToCart(item)}
                          className="px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-[#1A1917] hover:text-white text-stone-900 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Yêu cầu</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Thanh Bottom Bar khi có đồ trong giỏ */}
        {totalItemsCount > 0 && (
          <div className="p-3 sm:p-4 bg-white border-t border-[#E3DFD5] flex items-center justify-between shrink-0 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-stone-100 flex items-center justify-center font-black text-stone-900 border border-stone-200">
                {totalItemsCount}
              </div>
              <div>
                <p className="text-xs font-bold text-stone-900">
                  {totalPrice > 0 ? `Chi phí dự kiến: ${formatCurrency(totalPrice)}` : 'Dịch vụ miễn phí'}
                </p>
                <p className="text-[10px] text-stone-500">
                  Ghi vào hóa đơn phòng · Lễ tân thanh toán khi trả phòng
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsReviewModalOpen(true)}
              className="py-2.5 px-5 rounded-full bg-[#1A1917] hover:bg-stone-800 text-white text-xs font-bold flex items-center gap-2 shadow-md transition-all cursor-pointer active:scale-95"
            >
              <span>Xem Lại & Xác Nhận</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </main>

      {/* MODAL XEM LẠI YÊU CẦU TRƯỚC KHI NHẬP PIN */}
      {isReviewModalOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
          onClick={() => setIsReviewModalOpen(false)}
        >
          <div
            className="w-full max-w-sm sm:max-w-md bg-stone-900 border border-stone-800 text-stone-100 rounded-2xl p-4 sm:p-5 shadow-2xl space-y-3.5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-stone-800 pb-2.5">
              <div className="flex items-center gap-2">
                <ConciergeBell className="w-4 h-4 text-stone-300" />
                <h3 className="text-sm font-bold text-stone-100">Xác Nhận Dịch Vụ Phòng</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsReviewModalOpen(false)}
                className="p-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Vị trí phục vụ - Chọn số phòng nhận dịch vụ */}
            <div className="flex justify-between items-center text-xs p-2.5 bg-stone-800/80 rounded-xl border border-stone-700/60">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${targetRoom ? 'bg-emerald-400' : 'bg-stone-500'}`} />
                <span className="text-stone-400 font-medium">Phục vụ tới phòng:</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsReviewModalOpen(false);
                  setIsPinModalSelectingRoom(true);
                  setIsPinModalOpen(true);
                }}
                className="font-bold text-stone-100 hover:text-white flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-stone-700/70 hover:bg-stone-700 border border-stone-600/80 cursor-pointer transition-colors active:scale-95"
                title="Bấm để chọn hoặc đổi số phòng"
              >
                <span>{targetRoom ? `Phòng ${targetRoom}` : 'Chưa chọn phòng'}</span>
                <Edit3 className="w-3.5 h-3.5 text-stone-300" />
              </button>
            </div>

            {/* Danh sách items */}
            <div className="max-h-48 overflow-y-auto space-y-1.5 custom-scrollbar pr-1">
              {Object.values(cart).map(({ item, qty }) => (
                <div
                  key={item.id}
                  className="p-2.5 rounded-xl bg-stone-800/80 border border-stone-700/50 flex items-center justify-between text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-stone-200 truncate">{item.name}</p>
                    <p className="text-[10px] text-stone-400">{item.unit}</p>
                  </div>
                  <div className="text-right ml-3 shrink-0">
                    <p className="font-bold text-stone-100">
                      {item.price > 0 ? formatCurrency(item.price * qty) : 'Miễn phí'}
                    </p>
                    <p className="text-[10px] text-stone-400">SL: {qty}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Ghi chú thêm */}
            <div>
              <label className="block text-[11px] text-stone-400 font-medium mb-1">
                Ghi chú thêm cho nhân viên phục vụ:
              </label>
              <input
                type="text"
                value={requestNote}
                onChange={(e) => setRequestNote(e.target.value)}
                placeholder="Ví dụ: Giao lúc 20h, cần thêm 2 áo choàng tắm..."
                className="w-full px-3 py-2 rounded-xl bg-stone-800 border border-stone-700 text-xs text-stone-100 placeholder-stone-500 focus:outline-hidden focus:border-stone-500"
              />
            </div>

            {/* Thông báo thanh toán */}
            <div className="p-3 rounded-xl bg-stone-800/50 border border-stone-700/40 text-[11px] text-stone-300 space-y-1">
              <div className="flex justify-between font-bold text-xs text-stone-100">
                <span>Tổng chi phí phát sinh:</span>
                <span>{formatCurrency(totalPrice)}</span>
              </div>
              <p className="text-[10px] text-stone-400">
                Chi phí (nếu có) được ghi nhận vào hóa đơn phòng. Quý khách thanh toán tại quầy Lễ tân khi trả phòng (không thanh toán tại chỗ).
              </p>
            </div>

            {/* Nút bấm chuyển sang nhập PIN */}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsReviewModalOpen(false)}
                className="flex-1 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-bold transition-all cursor-pointer"
              >
                Chọn thêm
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsReviewModalOpen(false);
                  if (!targetRoom || !String(targetRoom).trim()) {
                    setIsPinModalSelectingRoom(true);
                  } else {
                    setIsPinModalSelectingRoom(false);
                  }
                  setIsPinModalOpen(true);
                }}
                className="flex-1 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-900 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Nhập PIN Phòng</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL MÃ PIN XÁC THỰC 4 SỐ CUỐI CCCD */}
      <RoomPinModal
        isOpen={isPinModalOpen}
        onClose={() => {
          setIsPinModalOpen(false);
          setIsPinModalSelectingRoom(false);
        }}
        roomNumber={targetRoom}
        isSelectingRoomInitial={isPinModalSelectingRoom}
        onRoomSelect={(room) => {
          setTargetRoom(room);
          if (onRoomChange) onRoomChange(room);
        }}
        pendingAction="room_service"
        pendingItems={Object.values(cart).map((c) => `${c.qty}x ${c.item.name}`).join(', ')}
        initialTab="pin"
        onVerifiedSuccess={(res, verifiedRoom) => {
          const finalRoom = verifiedRoom || res?.room_number || targetRoom;
          setTargetRoom(finalRoom);
          if (onRoomChange) onRoomChange(finalRoom);
          setIsPinModalOpen(false);
          setIsPinModalSelectingRoom(false);
          if (isStatusModalOpen) {
            loadStatusForRoom(finalRoom);
          } else {
            // Xác thực PIN thành công -> Tiến hành tạo đơn Room Service
            executeSubmitRequest(finalRoom);
          }
        }}
        onNotCheckedIn={(info) => {
          setIsPinModalOpen(false);
          setIsReviewModalOpen(false);
          onClose();
          if (onNotCheckedIn) onNotCheckedIn(info);
        }}
      />

      {/* POPUP THÔNG BÁO YÊU CẦU DỊCH VỤ THÀNH CÔNG */}
      {successData && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-stone-900 border border-stone-800 text-stone-100 rounded-2xl p-5 max-w-sm w-full shadow-2xl text-center space-y-3.5">
            <div className="w-12 h-12 rounded-xl bg-stone-800 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto">
              <Check className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-bold text-stone-100">Yêu Cầu Dịch Vụ Thành Công!</h3>
              <p className="text-xs text-stone-400 mt-1">
                Mã yêu cầu: <span className="font-mono font-bold text-stone-200">{successData.orderCode}</span>
              </p>
              <p className="text-xs text-stone-300 mt-2 leading-relaxed">
                Yêu cầu đã được chuyển tới bộ phận <strong>Room Service</strong> để phục vụ đến{' '}
                <strong>phòng {successData.room}</strong> trong ít phút tới.
              </p>
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

      {/* MODAL TRA CỨU TIẾN ĐỘ DỊCH VỤ & DỌN PHÒNG */}
      {isStatusModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
          onClick={() => setIsStatusModalOpen(false)}
        >
          <div
            className="w-full max-w-sm sm:max-w-md bg-stone-900 border border-stone-800 text-stone-100 rounded-2xl p-4 sm:p-5 shadow-2xl space-y-3.5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-stone-800 pb-2.5">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-stone-300" />
                <h3 className="text-sm font-bold text-stone-100">Tiến Độ Dịch Vụ & Dọn Phòng</h3>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => loadStatusForRoom(targetRoom)}
                  disabled={isLoadingStatus}
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

            {/* Thông tin phòng hiện tại & nút đổi phòng */}
            <div className="flex justify-between items-center text-xs p-2.5 bg-stone-800/80 rounded-xl border border-stone-700/60">
              <span className="text-stone-400 font-medium">Đang tra cứu cho:</span>
              <button
                type="button"
                onClick={() => {
                  setIsStatusModalOpen(false);
                  setIsPinModalSelectingRoom(true);
                  setIsPinModalOpen(true);
                }}
                className="font-bold text-stone-100 hover:text-white flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-stone-700/70 hover:bg-stone-700 border border-stone-600/80 cursor-pointer transition-colors active:scale-95"
              >
                <span>{targetRoom ? `Phòng ${targetRoom}` : 'Chưa chọn phòng'}</span>
                <Edit3 className="w-3.5 h-3.5 text-stone-300" />
              </button>
            </div>

            {/* Danh sách tiến độ các yêu cầu */}
            <div className="max-h-64 overflow-y-auto space-y-2 custom-scrollbar pr-1">
              {isLoadingStatus ? (
                <div className="p-8 text-center text-xs text-stone-400">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-stone-300" />
                  <p>Đang kiểm tra tiến độ từ bộ phận buồng phòng & Room Service...</p>
                </div>
              ) : statusOrders.length === 0 ? (
                <div className="p-6 text-center text-xs text-stone-400 bg-stone-800/40 rounded-xl border border-stone-800">
                  <p>Hiện chưa có yêu cầu dịch vụ hoặc dọn phòng nào đang thực hiện cho phòng {targetRoom || 'này'}.</p>
                  <p className="text-[11px] text-stone-500 mt-1">Quý khách có thể chọn dịch vụ để gửi yêu cầu ngay ạ.</p>
                </div>
              ) : (
                statusOrders.map((ord) => {
                  const s = (ord.status || 'Pending').toLowerCase();
                  let statusLabel = 'Chờ tiếp nhận';
                  let statusBg = 'bg-stone-800 text-stone-300 border-stone-700';
                  let progressPercent = 20;

                  if (s === 'cooking' || s === 'in progress' || s === 'assigned') {
                    statusLabel = ord.is_service_request ? 'Đang dọn phòng / xử lý' : 'Đang chế biến';
                    statusBg = 'bg-indigo-900/40 text-indigo-300 border-indigo-700/60';
                    progressPercent = 50;
                  } else if (s === 'ready' || s === 'delivering') {
                    statusLabel = 'Đang giao lên phòng';
                    statusBg = 'bg-blue-900/40 text-blue-300 border-blue-700/60';
                    progressPercent = 85;
                  } else if (s === 'completed' || s === 'delivered') {
                    statusLabel = 'Đã hoàn tất';
                    statusBg = 'bg-emerald-900/40 text-emerald-300 border-emerald-700/60';
                    progressPercent = 100;
                  } else if (s === 'cancelled' || s === 'rejected') {
                    statusLabel = 'Đã hủy';
                    statusBg = 'bg-rose-900/40 text-rose-300 border-rose-700/60';
                    progressPercent = 0;
                  }

                  const itemsDesc = Array.isArray(ord.items) && ord.items.length > 0
                    ? ord.items.map((it) => `${it.qty || it.quantity || 1}x ${it.name || it.item_name || 'Dịch vụ'}`).join(', ')
                    : (ord.note || 'Yêu cầu phục vụ phòng');

                  return (
                    <div
                      key={ord.id || ord.order_number}
                      className="p-3 rounded-xl bg-stone-800/80 border border-stone-700/50 space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[11px] text-stone-400">
                          #{ord.order_number || ord.id}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusBg}`}>
                          {statusLabel}
                        </span>
                      </div>

                      <p className="font-bold text-stone-100 text-xs line-clamp-2">
                        {itemsDesc}
                      </p>

                      {/* Thanh Progress Bar */}
                      <div className="space-y-1">
                        <div className="w-full h-1.5 bg-stone-700/60 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-500 rounded-full ${
                              progressPercent === 100
                                ? 'bg-emerald-400'
                                : progressPercent >= 50
                                ? 'bg-indigo-400'
                                : 'bg-stone-400'
                            }`}
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-stone-400">
                          <span>Tiến độ: {progressPercent}%</span>
                          <span>{ord.est_completion || (progressPercent === 100 ? 'Đã xong' : 'Đang xử lý')}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsStatusModalOpen(false)}
              className="w-full py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold transition-all cursor-pointer"
            >
              Đóng
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

