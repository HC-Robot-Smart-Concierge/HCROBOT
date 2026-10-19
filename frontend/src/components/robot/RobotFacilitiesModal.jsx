import React, { useState, useEffect, useRef } from 'react';
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
} from 'lucide-react';

export const HOTEL_FACILITIES_LIST = [
  {
    key: 'infinity_pool',
    name: 'Hồ Bơi Vô Cực Nước Ấm',
    floorLevel: 'TẦNG 5',
    category: 'Thư giãn',
    hours: '06:00 - 21:00',
    desc: 'Hồ bơi tràn bờ bốn mùa với tầm nhìn toàn cảnh vịnh biển và ghế phơi nắng cao cấp.',
    icon: Waves,
    accentColor: 'from-cyan-500/20 to-blue-500/20 text-cyan-400 border-cyan-500/30',
  },
  {
    key: 'restaurant',
    name: 'Nhà Hàng Ẩm Thực Aurora & Bếp Mở',
    floorLevel: 'TẦNG 2',
    category: 'Ẩm thực',
    hours: '06:30 - 22:00',
    desc: 'Thực đơn buffet hải sản thượng hạng, bò Wagyu áp chảo và các món ăn quốc tế do bếp trưởng 5 sao chế biến.',
    icon: Utensils,
    accentColor: 'from-amber-500/20 to-orange-500/20 text-amber-400 border-amber-500/30',
    hasMenuAction: true,
  },
  {
    key: 'spa',
    name: 'Thảo Mộc Spa & Massage Thụy Điển',
    floorLevel: 'TẦNG 5',
    category: 'Thư giãn',
    hours: '09:00 - 22:30',
    desc: 'Liệu trình thư giãn phục hồi năng lượng với tinh dầu tự nhiên, phòng xông hơi khô và bể sục jacuzzi.',
    icon: Sparkles,
    accentColor: 'from-rose-500/20 to-pink-500/20 text-rose-400 border-rose-500/30',
  },
  {
    key: 'gym',
    name: 'Fitness & Gym Center Đẳng Cấp',
    floorLevel: 'TẦNG 5',
    category: 'Thể thao',
    hours: '05:30 - 22:00',
    desc: 'Hệ thống máy tập Technogym chuẩn châu Âu, phòng tập yoga cách âm và huấn luyện viên hỗ trợ.',
    icon: Dumbbell,
    accentColor: 'from-emerald-500/20 to-teal-500/20 text-emerald-400 border-emerald-500/30',
  },
  {
    key: 'rooftop_coffee',
    name: 'Rooftop Sky Coffee & Bar',
    floorLevel: 'TẦNG 6',
    category: 'Ẩm thực',
    hours: '15:00 - 23:30',
    desc: 'Không gian ngắm hoàng hôn, cocktail signature cùng âm nhạc lounge nhẹ nhàng buổi tối.',
    icon: Coffee,
    accentColor: 'from-purple-500/20 to-indigo-500/20 text-purple-400 border-purple-500/30',
  },
  {
    key: 'front_desk',
    name: 'Quầy Lễ Tân & Hỗ Trợ Đón Tiếp',
    floorLevel: 'TẦNG TRỆT',
    category: 'Dịch vụ',
    hours: 'Phục vụ 24/7',
    desc: 'Hỗ trợ nhận trả phòng nhanh, gửi hành lý, đổi ngoại tệ và đặt xe đưa đón sân bay.',
    icon: Bell,
    accentColor: 'from-stone-500/20 to-stone-400/20 text-stone-300 border-stone-500/30',
  },
  {
    key: 'parking_car',
    name: 'Bãi Đỗ Xe Ô Tô & Trạm Sạc Điện',
    floorLevel: 'HẦM B2',
    category: 'Dịch vụ',
    hours: '24/7',
    desc: 'Hệ thống đỗ xe tự động có camera an ninh và trạm sạc xe điện nhanh cho khách lưu trú.',
    icon: Car,
    accentColor: 'from-blue-500/20 to-indigo-500/20 text-blue-400 border-blue-500/30',
  },
  {
    key: 'gift_shop',
    name: 'Cửa Hàng Lưu Niệm & Thời Trang Biển',
    floorLevel: 'TẦNG 6',
    category: 'Dịch vụ',
    hours: '08:00 - 21:00',
    desc: 'Quà tặng lưu niệm bản địa, đồ dùng du lịch cao cấp và trang phục bơi lội thời trang.',
    icon: ShoppingBag,
    accentColor: 'from-amber-500/20 to-yellow-500/20 text-amber-300 border-amber-500/30',
  },
];

const CATEGORIES = ['Tất cả', 'Thư giãn', 'Ẩm thực', 'Thể thao', 'Dịch vụ'];

export const RobotFacilitiesModal = ({
  isOpen,
  onClose,
  onNavigateToDestination,
  onOpenFoodMenu,
}) => {
  const [selectedCategory, setSelectedCategory] = useState('Tất cả');
  const [autoCloseSeconds, setAutoCloseSeconds] = useState(45);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      if (timerRef.current) clearInterval(timerRef.current);
      setAutoCloseSeconds(45);
      setSelectedCategory('Tất cả');
      return;
    }

    timerRef.current = setInterval(() => {
      setAutoCloseSeconds((prev) => {
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
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredFacilities =
    selectedCategory === 'Tất cả'
      ? HOTEL_FACILITIES_LIST
      : HOTEL_FACILITIES_LIST.filter((f) => f.category === selectedCategory);

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fadeIn select-none">
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-5xl h-[88vh] max-h-[740px] bg-stone-900/95 border border-stone-700/80 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-stone-100"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-800 flex items-center justify-between bg-stone-950/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-black uppercase tracking-wider text-stone-100">
                  Cơ Sở Vật Chất & Tiện Ích Khách Sạn
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  5 Sao
                </span>
              </div>
              <p className="text-xs text-stone-400">
                Chạm để xem chỉ dẫn lộ trình và quét mã QR mang theo trên điện thoại
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[11px] font-mono font-bold text-stone-400 bg-stone-800/80 px-2.5 py-1 rounded-full border border-stone-700">
              Tự đóng sau {autoCloseSeconds}s
            </span>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-300 flex items-center justify-center transition-colors cursor-pointer"
              title="Đóng"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Category Filters */}
        <div className="px-6 py-3 border-b border-stone-800/80 bg-stone-900/50 flex items-center gap-2 overflow-x-auto shrink-0">
          {CATEGORIES.map((cat) => {
            const isActive = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-stone-100 text-stone-900 shadow-md'
                    : 'bg-stone-800/80 hover:bg-stone-800 text-stone-400 hover:text-stone-200 border border-stone-700/60'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* Facilities Grid */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-4 custom-scrollbar">
          {filteredFacilities.map((facility) => {
            const Icon = facility.icon;
            return (
              <div
                key={facility.key}
                className="p-4 rounded-2xl bg-stone-800/70 border border-stone-700/70 hover:border-stone-500/80 hover:bg-stone-800 transition-all flex flex-col justify-between gap-3 shadow-md group"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-9 h-9 rounded-xl bg-gradient-to-br ${facility.accentColor} border flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-stone-100 leading-snug">
                          {facility.name}
                        </h4>
                        <div className="flex items-center gap-2 text-[10px] text-stone-400 mt-0.5">
                          <span className="font-mono font-bold text-amber-300">
                            {facility.floorLevel}
                          </span>
                          <span>·</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-stone-500" />
                            {facility.hours}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-stone-300/90 leading-relaxed font-normal">
                    {facility.desc}
                  </p>
                </div>

                <div className="pt-2 border-t border-stone-700/60 flex items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold text-stone-400">
                    Phân loại: {facility.category}
                  </span>

                  <div className="flex items-center gap-2">
                    {facility.hasMenuAction && onOpenFoodMenu && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenFoodMenu();
                        }}
                        className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Utensils className="w-3 h-3" />
                        <span>Xem thực đơn</span>
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
                      className="px-3.5 py-1.5 rounded-xl bg-stone-100 hover:bg-white text-stone-900 text-[11px] font-black flex items-center gap-1.5 transition-all shadow-sm cursor-pointer group-hover:bg-amber-400 group-hover:text-stone-950"
                    >
                      <Navigation className="w-3 h-3" />
                      <span>Chỉ đường & QR</span>
                      <ChevronRight className="w-3 h-3 text-stone-500 group-hover:text-stone-900" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Note */}
        <div className="px-6 py-3 border-t border-stone-800 bg-stone-950/80 flex items-center justify-between text-xs text-stone-400 shrink-0">
          <span className="flex items-center gap-1.5">
            <QrCode className="w-3.5 h-3.5 text-amber-400" />
            <span>Chạm "Chỉ đường & QR" để Robot dẫn đường và cấp mã QR lưu trên điện thoại</span>
          </span>
          <span className="text-[10px] text-stone-500">Aurora Concierge Service</span>
        </div>
      </div>
    </div>
  );
};
