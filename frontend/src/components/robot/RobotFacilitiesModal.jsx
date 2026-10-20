import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Waves,
  Utensils,
  Sparkles,
  Dumbbell,
  Coffee,
  Bell,
  Car,
  ShoppingBag,
  Navigation,
  QrCode,
  X,
  Clock,
  ChevronRight,
  Building,
  Search,
  Info,
  Volume2,
  ArrowLeft,
  CheckCircle2,
  MapPin,
} from 'lucide-react';

export const HOTEL_FACILITIES_LIST = [
  {
    key: 'infinity_pool',
    name: 'Hồ Bơi Vô Cực Nước Ấm',
    floorLevel: 'TẦNG 5',
    category: 'Thư giãn',
    hours: '06:00 - 22:00',
    desc: 'Bể bơi tràn bờ nước ấm bốn mùa, tầm nhìn vịnh biển và khu ghế tắm nắng.',
    icon: Waves,
    knowledge: {
      pricing: 'Miễn phí cho khách lưu trú',
      summary:
        'Hồ bơi vô cực nước ấm mở cửa từ 06:00 đến 22:00 hàng ngày tại Tầng 5, hoàn toàn miễn phí cho khách lưu trú, có sẵn khăn tắm và khu ghế tắm nắng view biển.',
      highlights: [
        'Nước ấm bốn mùa với tầm nhìn toàn cảnh vịnh biển thoáng đãng',
        'Cung cấp miễn phí khăn tắm và nước khoáng đóng chai tại quầy phục vụ',
        'Kèm phòng thay đồ locker riêng biệt, cabin tắm tráng và ghế tắm nắng cao cấp',
      ],
      transitHint:
        'Từ sảnh chính, đi Thang máy A lên Tầng 5. Ra khỏi thang máy, rẽ trái qua cửa kính là tới hồ bơi.',
    },
  },
  {
    key: 'restaurant',
    name: 'Nhà Hàng Aurora & Bếp Mở',
    floorLevel: 'TẦNG 2',
    category: 'Ẩm thực',
    hours: '06:30 - 22:00',
    desc: 'Buffet hải sản thượng hạng, bò Wagyu và thực đơn quốc tế 5 sao.',
    icon: Utensils,
    hasMenuAction: true,
    knowledge: {
      pricing: 'Miễn phí theo gói phòng (hoặc 350.000 VNĐ/khách)',
      summary:
        'Nhà hàng ẩm thực Aurora tại Tầng 2 phục vụ buffet sáng từ 06:30 đến 10:00 và thực đơn quốc tế Alacarte đến 22:00 mỗi ngày.',
      highlights: [
        'Buffet sáng Á - Âu cao cấp từ 06:30 đến 10:00 hàng ngày',
        'Thực đơn trưa và tối Alacarte với bò Wagyu và hải sản tươi sống',
        'Khu quầy nhận món pickup và dịch vụ gọi món tận phòng (Room Service)',
      ],
      transitHint:
        'Từ sảnh tiếp tân, đi Thang máy A lên Tầng 2. Ra khỏi thang máy, đi thẳng theo sảnh chính vào nhà hàng.',
    },
  },
  {
    key: 'spa',
    name: 'Thảo Mộc Spa & Massage',
    floorLevel: 'TẦNG 5',
    category: 'Thư giãn',
    hours: '09:00 - 22:00',
    desc: 'Trị liệu tinh dầu tự nhiên, phòng xông hơi khô và bể sục jacuzzi thư giãn.',
    icon: Sparkles,
    knowledge: {
      pricing: 'Gói liệu trình từ 500.000 VNĐ (Ưu đãi giảm 15% cho khách lưu trú)',
      summary:
        'Thảo Mộc Spa tại Tầng 5 mở cửa từ 09:00 đến 22:00, ưu đãi giảm 15% cho khách khách sạn với các gói xông hơi đá muối Himalaya và trị liệu tinh dầu thảo mộc.',
      highlights: [
        'Phòng xông hơi đá muối khoáng Himalaya và phòng xông hơi khô sauna',
        'Liệu trình massage đá nóng kết hợp tinh dầu thảo mộc tự nhiên',
        'Bể sục jacuzzi ngâm mình thư giãn, phục hồi cơ thể và chăm sóc da',
      ],
      transitHint:
        'Từ sảnh chính, đi Thang máy A lên Tầng 5. Ra khỏi thang máy, rẽ trái 15m là đến cửa phòng Spa.',
    },
  },
  {
    key: 'gym',
    name: 'Trung Tâm Fitness & Yoga',
    floorLevel: 'TẦNG 5',
    category: 'Thể thao',
    hours: '24/7 (Phục vụ liên tục)',
    desc: 'Hệ thống máy Technogym chuẩn châu Âu, phòng yoga và HLV hướng dẫn.',
    icon: Dumbbell,
    knowledge: {
      pricing: 'Miễn phí 100% cho khách lưu trú',
      summary:
        'Phòng tập Gym & Yoga tại Tầng 5 mở cửa 24/7 hoàn toàn miễn phí cho khách lưu trú, trang bị máy Technogym chuẩn châu Âu hiện đại.',
      highlights: [
        'Thiết bị máy tập cardio và tạ Technogym chuẩn châu Âu chuyên nghiệp',
        'Phòng tập yoga cách âm có sẵn thảm tập, bóng yoga và gương toàn thân',
        'Mở cửa tự do 24/7 với quầy nước lọc và khăn tập miễn phí',
      ],
      transitHint:
        'Từ sảnh chính, đi Thang máy A lên Tầng 5. Ra khỏi thang máy, đi thẳng về phía trước để vào phòng gym.',
    },
  },
  {
    key: 'rooftop_coffee',
    name: 'Rooftop Sky Bar & Cafe',
    floorLevel: 'TẦNG 6',
    category: 'Ẩm thực',
    hours: 'Cafe: 07:00 - 23:00 · Bar: 16:30 - 01:00',
    desc: 'Quầy bar tầng thượng ngắm hoàng hôn, cocktail signature và acoustic.',
    icon: Coffee,
    knowledge: {
      pricing: 'Theo giá niêm yết menu',
      summary:
        'Rooftop Sky Bar & Cafe tại Tầng 6 mở cửa phục vụ cafe từ 07:00 và quầy bar đến 01:00 sáng với tầm nhìn ngắm hoàng hôn toàn cảnh thành phố.',
      highlights: [
        'Không gian ban công ngoài trời ngắm hoàng hôn view toàn cảnh thành phố',
        'Thực đơn cocktail signature, rượu vang cao cấp và món nhẹ tapas',
        'Âm nhạc lounge nhẹ nhàng và biểu diễn acoustic thư giãn vào buổi tối',
      ],
      transitHint:
        'Từ sảnh chính, đi Thang máy A lên Tầng 6. Ra khỏi thang máy, rẽ trái theo hành lang ra sảnh sân thượng.',
    },
  },
  {
    key: 'front_desk',
    name: 'Quầy Lễ Tân & Tiền Sảnh',
    floorLevel: 'TẦNG TRỆT',
    category: 'Dịch vụ',
    hours: 'Phục vụ 24/7',
    desc: 'Check-in/out nhanh, giữ hành lý, đổi ngoại tệ và đặt xe đưa đón sân bay.',
    icon: Bell,
    knowledge: {
      pricing: 'Hỗ trợ miễn phí 24/7',
      summary:
        'Quầy Lễ Tân tại Tầng Trệt phục vụ 24/7 mọi nhu cầu nhận trả phòng, giữ hành lý, đổi ngoại tệ và cung cấp thông tin cho quý khách.',
      highlights: [
        'Nhận phòng từ 14:00, trả phòng trước 12:00 trưa (hỗ trợ nhận trả phòng linh hoạt)',
        'Dịch vụ giữ hành lý an toàn, thu đổi ngoại tệ và hỗ trợ đặt xe đưa đón sân bay',
        'Mạng Wi-Fi tốc độ cao: Aurora_Guest_5G (Mật khẩu: aurora2026)',
      ],
      transitHint:
        'Nằm ngay bên tay phải sảnh chính Tầng Trệt khi quý khách bước vào khách sạn.',
    },
  },
  {
    key: 'parking_car',
    name: 'Bãi Đỗ Xe & Trạm Sạc EV',
    floorLevel: 'HẦM B2',
    category: 'Dịch vụ',
    hours: 'Phục vụ 24/7',
    desc: 'Bãi đỗ xe thông minh có camera an ninh 24/7 và trạm sạc nhanh ô tô điện.',
    icon: Car,
    knowledge: {
      pricing: 'Miễn phí cho khách lưu trú',
      summary:
        'Bãi đỗ xe an toàn 24/7 tại Hầm B2 và B1 miễn phí cho khách lưu trú, có bảo vệ giám sát và trạm sạc nhanh xe ô tô điện.',
      highlights: [
        'Bãi đỗ xe ô tô tại Hầm B2 và bãi đỗ xe máy tại Hầm B1',
        'Hệ thống camera an ninh giám sát 24/7 và hướng dẫn đỗ tự động',
        'Trang bị trạm sạc điện nhanh cho các dòng xe ô tô điện của khách lưu trú',
      ],
      transitHint:
        'Từ sảnh chính, đi Thang máy A bấm xuống Hầm B2 cho ô tô hoặc Hầm B1 cho xe máy.',
    },
  },
  {
    key: 'gift_shop',
    name: 'Cửa Hàng Quà Lưu Niệm',
    floorLevel: 'TẦNG 6',
    category: 'Dịch vụ',
    hours: '08:00 - 22:00',
    desc: 'Quà lưu niệm đặc sản bản địa, phụ kiện du lịch và trang phục bơi cao cấp.',
    icon: ShoppingBag,
    knowledge: {
      pricing: 'Theo giá niêm yết sản phẩm',
      summary:
        'Cửa Hàng Quà Lưu Niệm tại Tầng 6 mở cửa từ 08:00 đến 22:00, chuyên cung cấp quà lưu niệm địa phương, đồ bơi và phụ kiện du lịch.',
      highlights: [
        'Đặc sản cà phê thủ công địa phương và các sản phẩm lụa tơ tằm truyền thống',
        'Quà tặng lưu niệm mang dấu ấn bản địa và đồ thủ công mỹ nghệ tinh xảo',
        'Trang phục bơi lội thời trang, kính bơi và vật dụng du lịch cao cấp',
      ],
      transitHint:
        'Từ sảnh chính, đi Thang máy A lên Tầng 6. Ra khỏi thang máy, rẽ trái vào khu vực mua sắm.',
    },
  },
];

const CATEGORIES = ['Tất cả', 'Thư giãn', 'Ẩm thực', 'Thể thao', 'Dịch vụ'];

export const RobotFacilitiesModal = ({
  isOpen,
  onClose,
  onNavigateToDestination,
  onOpenFoodMenu,
  onSpeak,
}) => {
  const [selectedCategory, setSelectedCategory] = useState('Tất cả');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFacilityForDetail, setSelectedFacilityForDetail] = useState(null);
  const [autoCloseSeconds, setAutoCloseSeconds] = useState(45);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      if (timerRef.current) clearInterval(timerRef.current);
      setAutoCloseSeconds(45);
      setSelectedCategory('Tất cả');
      setSearchQuery('');
      setSelectedFacilityForDetail(null);
      setIsPaused(false);
      return;
    }

    timerRef.current = setInterval(() => {
      setAutoCloseSeconds((prev) => {
        if (isPaused) return prev;
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          if (onClose) onClose();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isOpen, onClose, isPaused]);

  const filteredFacilities = useMemo(() => {
    return HOTEL_FACILITIES_LIST.filter((facility) => {
      const matchCategory =
        selectedCategory === 'Tất cả' || facility.category === selectedCategory;
      const normalizedQuery = searchQuery.trim().toLowerCase();
      const matchSearch =
        !normalizedQuery ||
        facility.name.toLowerCase().includes(normalizedQuery) ||
        facility.floorLevel.toLowerCase().includes(normalizedQuery) ||
        facility.desc.toLowerCase().includes(normalizedQuery) ||
        facility.category.toLowerCase().includes(normalizedQuery);
      return matchCategory && matchSearch;
    });
  }, [selectedCategory, searchQuery]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#F5F2EB] text-[#1A1917] flex flex-col justify-between p-3.5 sm:p-5 select-none overflow-hidden robot-safe-x animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-label="Cơ Sở Vật Chất & Tiện Ích"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={() => setIsPaused(true)}
      onTouchEnd={() => setIsPaused(false)}
    >
      {/* Header: Tiêu đề + Category Filter Pills + Nút Đóng Kiosk */}
      <div className="flex items-center justify-between gap-3 pb-2.5 border-b border-[#E3DFD5] shrink-0">
        {/* Bên trái: Tiêu đề & Badge */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-[#EFECE4] border border-[#E3DFD5] text-stone-700 flex items-center justify-center shrink-0">
            <Building className="w-5 h-5 text-stone-800" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-stone-900 truncate">
                Cơ Sở Vật Chất & Tiện Ích
              </h3>
              <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-stone-200 text-stone-700 border border-stone-300 shrink-0">
                5 SAO
              </span>
            </div>
            <p className="text-[10px] text-stone-500 font-medium truncate mt-0.5">
              Chỉ đường 2D & Thông tin chi tiết tiện ích khách sạn
            </p>
          </div>
        </div>

        {/* Ở giữa: Category Filter Pills */}
        {!selectedFacilityForDetail && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {CATEGORIES.map((cat) => {
              const isActive = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap active:scale-95 ${
                    isActive
                      ? 'bg-[#1A1917] text-white shadow-xs'
                      : 'bg-white hover:bg-stone-50 text-stone-700 border border-[#E3DFD5]'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        )}

        {/* Bên phải: Nút Đóng Kiosk */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="h-8 sm:h-9 px-4 rounded-full bg-[#1A1917] hover:bg-stone-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all shadow-sm"
            title="Đóng menu tiện ích"
          >
            <X className="w-4 h-4" />
            <span>Đóng</span>
          </button>
        </div>
      </div>

      {/* Main Content: Lưới tiện ích hoặc màn hình chi tiết */}
      {!selectedFacilityForDetail ? (
        <div className="flex-1 min-h-0 py-2.5 overflow-y-auto no-scrollbar">
          {filteredFacilities.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2">
              <Search className="w-8 h-8 text-stone-400" />
              <p className="text-xs font-bold text-stone-800">Không tìm thấy tiện ích phù hợp</p>
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('Tất cả');
                  setSearchQuery('');
                }}
                className="px-3.5 py-1.5 rounded-full bg-stone-200 text-stone-800 text-xs font-bold"
              >
                Đặt lại bộ lọc
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3 content-start">
              {filteredFacilities.map((facility) => {
                const Icon = facility.icon;
                return (
                  <div
                    key={facility.key}
                    className="p-3 sm:p-3.5 rounded-2xl bg-white hover:bg-stone-50/90 border border-[#E3DFD5] hover:border-stone-400 transition-all flex flex-col justify-between shadow-xs hover:shadow-md group min-h-[96px] h-[104px]"
                  >
                    {/* Top: Icon + Title + Floor + Hours */}
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-[#EFECE4] border border-[#E3DFD5] text-stone-700 flex items-center justify-center shrink-0 group-hover:bg-[#1A1917] group-hover:text-white transition-all">
                            <Icon className="w-4.5 h-4.5" />
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs sm:text-[13px] font-black text-stone-900 group-hover:text-black truncate leading-tight">
                              {facility.name}
                            </h4>
                            <div className="flex items-center gap-1.5 text-[10px] text-stone-500 mt-0.5">
                              <span className="font-mono font-bold px-1.5 py-0.5 rounded bg-stone-200 text-stone-700 border border-stone-300 text-[9px]">
                                {facility.floorLevel}
                              </span>
                              <span>·</span>
                              <span className="truncate">{facility.hours}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Description */}
                      <p className="text-[10px] sm:text-[11px] text-stone-600 line-clamp-1 mt-1.5 leading-snug">
                        {facility.desc}
                      </p>
                    </div>

                    {/* Bottom Actions */}
                    <div className="pt-2 border-t border-stone-100 flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                        {facility.category}
                      </span>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedFacilityForDetail(facility)}
                          className="h-6.5 px-2.5 rounded-full bg-white hover:bg-stone-100 text-stone-700 border border-[#E3DFD5] text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer active:scale-95"
                          title="Xem thông tin chi tiết"
                        >
                          <Info className="w-3 h-3 text-stone-500" />
                          <span>Chi tiết</span>
                        </button>

                        {facility.hasMenuAction && onOpenFoodMenu && (
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onOpenFoodMenu();
                            }}
                            className="h-6.5 px-2.5 rounded-full bg-white hover:bg-stone-100 text-stone-800 border border-[#E3DFD5] text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer active:scale-95"
                            title="Xem thực đơn ẩm thực"
                          >
                            <Utensils className="w-3 h-3 text-stone-600" />
                            <span>Thực đơn</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            if (onNavigateToDestination) {
                              onNavigateToDestination(facility.key);
                            }
                          }}
                          className="h-6.5 px-3 rounded-full bg-[#1A1917] hover:bg-stone-800 text-white text-[10px] font-bold flex items-center gap-1 transition-all shadow-xs cursor-pointer active:scale-95"
                          title="Xem sơ đồ 2D và chỉ đường kèm mã QR"
                        >
                          <Navigation className="w-3 h-3 text-white" />
                          <span>Chỉ đường & QR</span>
                          <ChevronRight className="w-3 h-3 text-stone-400 group-hover:translate-x-0.5 transition-transform" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Màn hình Xem Chi Tiết Tiện Ích */
        <div className="flex-1 min-h-0 py-2.5 overflow-y-auto no-scrollbar space-y-3">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setSelectedFacilityForDetail(null)}
              className="px-3.5 py-1.5 rounded-full bg-white hover:bg-stone-50 text-stone-800 border border-[#E3DFD5] text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Quay lại danh sách</span>
            </button>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold px-2 py-0.5 rounded bg-stone-200 text-stone-700 border border-stone-300 text-xs">
                {selectedFacilityForDetail.floorLevel}
              </span>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#1A1917] text-white shadow-xs">
                {selectedFacilityForDetail.category}
              </span>
            </div>
          </div>

          {/* Main Info Card */}
          <div className="p-4 rounded-2xl bg-white border border-[#E3DFD5] shadow-xs flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-[#EFECE4] border border-[#E3DFD5] text-stone-800 flex items-center justify-center shrink-0">
              {React.createElement(selectedFacilityForDetail.icon, { className: 'w-6 h-6 text-stone-800' })}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm sm:text-base font-black text-stone-900">
                {selectedFacilityForDetail.name}
              </h4>
              <div className="flex items-center gap-3 text-[11px] text-stone-500 mt-1">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-stone-400" />
                  <span>{selectedFacilityForDetail.hours}</span>
                </span>
                <span>·</span>
                <span className="font-bold text-stone-700">
                  {selectedFacilityForDetail.knowledge?.pricing || 'Tiêu chuẩn khách sạn'}
                </span>
              </div>
              <p className="text-xs text-stone-600 mt-1.5 leading-relaxed">
                {selectedFacilityForDetail.knowledge?.summary || selectedFacilityForDetail.desc}
              </p>
            </div>
          </div>

          {/* Highlights */}
          <div className="p-4 rounded-2xl bg-white border border-[#E3DFD5] shadow-xs space-y-2">
            <h5 className="text-[11px] font-black text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-stone-600" />
              <span>Dịch vụ & Đặc quyền nổi bật</span>
            </h5>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {selectedFacilityForDetail.knowledge?.highlights?.map((item, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-xl bg-[#FAF8F5] border border-[#E3DFD5] text-[11px] text-stone-700 flex items-start gap-2"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-stone-600 shrink-0 mt-0.5" />
                  <span className="leading-snug">{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Transit hint */}
          <div className="p-3 rounded-xl bg-[#EFECE4] border border-[#E3DFD5] text-[11px] text-stone-700 flex items-start gap-2.5">
            <MapPin className="w-4 h-4 text-stone-700 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-bold text-stone-900">Hướng dẫn lộ trình từ sảnh chính:</p>
              <p className="text-stone-600 leading-snug">
                {selectedFacilityForDetail.knowledge?.transitHint ||
                  `Đi Thang máy A tới ${selectedFacilityForDetail.floorLevel}.`}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2 border-t border-[#E3DFD5] flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {onSpeak && (
                <button
                  type="button"
                  onClick={() => {
                    if (selectedFacilityForDetail.knowledge?.summary) {
                      onSpeak(selectedFacilityForDetail.knowledge.summary);
                    }
                  }}
                  className="h-8 px-3 rounded-full bg-white hover:bg-stone-50 text-stone-800 border border-[#E3DFD5] text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
                >
                  <Volume2 className="w-3.5 h-3.5 text-stone-600" />
                  <span>Nghe giới thiệu</span>
                </button>
              )}

              {selectedFacilityForDetail.hasMenuAction && onOpenFoodMenu && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenFoodMenu();
                  }}
                  className="h-8 px-3 rounded-full bg-white hover:bg-stone-50 text-stone-800 border border-[#E3DFD5] text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
                >
                  <Utensils className="w-3.5 h-3.5 text-stone-600" />
                  <span>Xem thực đơn</span>
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                onClose();
                if (onNavigateToDestination) {
                  onNavigateToDestination(selectedFacilityForDetail.key);
                }
              }}
              className="h-8 px-4 rounded-full bg-[#1A1917] hover:bg-stone-800 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
            >
              <Navigation className="w-3.5 h-3.5 text-white" />
              <span>Chỉ đường & Quét mã QR</span>
              <ChevronRight className="w-3.5 h-3.5 text-stone-400" />
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="pt-2 border-t border-[#E3DFD5] flex items-center justify-between text-[10px] text-stone-600 shrink-0">
        <span className="font-bold text-stone-700">Aurora Grand Hotel · 5-Star Concierge</span>
        <span className="text-stone-600 font-medium">
          Chạm "Chỉ đường & QR" để Robot dẫn đường và cấp mã QR di động
        </span>
      </div>
    </div>
  );
};


