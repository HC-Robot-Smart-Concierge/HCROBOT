import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
  X,
  Clock,
  ChevronRight,
  Building,
  Search,
  Volume2,
  ArrowLeft,
  CheckCircle2,
  MapPin,
  Wine,
  Mic,
  RefreshCw,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { fetchRAGFacilities } from '../../services/knowledgeApi';

const FACILITY_ICONS = {
  waves: Waves,
  utensils: Utensils,
  sparkles: Sparkles,
  dumbbell: Dumbbell,
  coffee: Coffee,
  wine: Wine,
  mic: Mic,
  bell: Bell,
  car: Car,
  'shopping-bag': ShoppingBag,
  building: Building,
};

function normalizeFacility(raw) {
  const knowledge = raw?.knowledge || {};
  return {
    key: raw?.key || 'facility',
    name: raw?.name || '',
    floorLevel: raw?.floor_level || raw?.floorLevel || '',
    category: raw?.category || 'Dịch vụ',
    hours: raw?.hours || '',
    desc: raw?.desc || '',
    icon: FACILITY_ICONS[raw?.icon_key] || Building,
    hasMenuAction: Boolean(raw?.has_menu_action ?? raw?.hasMenuAction),
    navigable: raw?.navigable !== false,
    sourceFile: raw?.source_file || raw?.sourceFile || null,
    kbContext: raw?.kb_context || raw?.kbContext || '',
    knowledge: {
      pricing: knowledge.pricing || '',
      summary: knowledge.summary || raw?.desc || '',
      highlights: Array.isArray(knowledge.highlights) ? knowledge.highlights : [],
      transitHint: knowledge.transit_hint || knowledge.transitHint || '',
    },
  };
}

export const RobotFacilitiesModal = ({
  isOpen,
  onClose,
  onNavigateToDestination,
  onOpenFoodMenu,
  onSpeak,
  onAskFacilityWithAI,
  language = 'Tiếng Việt',
}) => {
  const isEn = String(language || '').toLowerCase().includes('en');
  const allLabel = isEn ? 'All' : 'Tất cả';

  const [facilities, setFacilities] = useState([]);
  const [categories, setCategories] = useState([allLabel]);
  const [sourceFile, setSourceFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);

  const [selectedCategory, setSelectedCategory] = useState(allLabel);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFacilityForDetail, setSelectedFacilityForDetail] = useState(null);
  const [autoCloseSeconds, setAutoCloseSeconds] = useState(45);
  const [isPaused, setIsPaused] = useState(false);

  const [isAskingAI, setIsAskingAI] = useState(false);
  const [aiAnswer, setAiAnswer] = useState('');
  const timerRef = useRef(null);

  const loadFromKnowledgeBase = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await fetchRAGFacilities(isEn ? 'en' : 'vi');
      const items = Array.isArray(data?.facilities) ? data.facilities.map(normalizeFacility) : [];
      const cats = Array.isArray(data?.categories) && data.categories.length > 0
        ? data.categories
        : [allLabel, ...Array.from(new Set(items.map((i) => i.category)))];

      setFacilities(items);
      setCategories(cats);
      setSourceFile(data?.source_file || null);
      setSelectedCategory(cats[0] || allLabel);
    } catch (err) {
      setLoadError(
        err?.message || (isEn ? 'Unable to load Knowledge Base.' : 'Không thể tải dữ liệu từ Knowledge Base.')
      );
      setFacilities([]);
    } finally {
      setIsLoading(false);
    }
  }, [isEn, allLabel]);

  useEffect(() => {
    if (isOpen) {
      loadFromKnowledgeBase();
    }
  }, [isOpen, loadFromKnowledgeBase]);

  useEffect(() => {
    if (!isOpen) {
      if (timerRef.current) clearInterval(timerRef.current);
      setAutoCloseSeconds(45);
      setSelectedCategory(allLabel);
      setSearchQuery('');
      setSelectedFacilityForDetail(null);
      setAiAnswer('');
      setIsAskingAI(false);
      setIsPaused(false);
      return;
    }

    timerRef.current = setInterval(() => {
      setAutoCloseSeconds((prev) => {
        if (isPaused || isAskingAI) return prev;
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
  }, [isOpen, onClose, isPaused, isAskingAI, allLabel]);

  const handleSelectFacility = (facility) => {
    setAiAnswer('');
    setSelectedFacilityForDetail(facility);
  };

  const handleHearIntroduction = async () => {
    if (!selectedFacilityForDetail || isAskingAI) return;
    if (onAskFacilityWithAI) {
      setIsAskingAI(true);
      setAiAnswer('');
      try {
        const reply = await onAskFacilityWithAI(selectedFacilityForDetail);
        if (reply) {
          setAiAnswer(reply);
        }
      } finally {
        setIsAskingAI(false);
      }
      return;
    }
    if (onSpeak && selectedFacilityForDetail.knowledge?.summary) {
      onSpeak(selectedFacilityForDetail.knowledge.summary);
    }
  };

  const filteredFacilities = useMemo(() => {
    return facilities.filter((facility) => {
      const matchCategory = selectedCategory === allLabel || facility.category === selectedCategory;
      const normalizedQuery = searchQuery.trim().toLowerCase();
      const matchSearch =
        !normalizedQuery ||
        facility.name.toLowerCase().includes(normalizedQuery) ||
        facility.floorLevel.toLowerCase().includes(normalizedQuery) ||
        facility.desc.toLowerCase().includes(normalizedQuery) ||
        facility.category.toLowerCase().includes(normalizedQuery);
      return matchCategory && matchSearch;
    });
  }, [facilities, selectedCategory, searchQuery, allLabel]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#F5F2EB] text-[#1A1917] flex flex-col justify-between p-3.5 sm:p-5 select-none overflow-hidden robot-safe-x animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-label={isEn ? 'Hotel Facilities & Amenities' : 'Cơ Sở Vật Chất & Tiện Ích'}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={() => setIsPaused(true)}
      onTouchEnd={() => setIsPaused(false)}
    >
      {/* Header: Title + Category Filter Pills + Search + Close */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[#E3DFD5] shrink-0">
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#EFECE4] border border-[#E3DFD5] text-stone-700 flex items-center justify-center shrink-0">
            <Building className="w-4 h-4 sm:w-5 sm:h-5 text-stone-800" />
          </div>
          <div className="flex items-center gap-1.5">
            <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-stone-900 whitespace-nowrap">
              {isEn ? 'Hotel Facilities' : 'Tiện Ích 5 Sao'}
            </h3>
            <span
              className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-stone-200 text-stone-700 border border-stone-300"
              title={sourceFile || 'Knowledge Base'}
            >
              KB
            </span>
          </div>
        </div>

        {!selectedFacilityForDetail && (
          <div className="flex-1 min-w-0 flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 px-1">
            {categories.map((cat) => {
              const isActive = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 active:scale-95 ${
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

        <div className="flex items-center gap-2 shrink-0">
          {!selectedFacilityForDetail && (
            <div className="relative hidden sm:block w-44">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isEn ? 'Search facility...' : 'Tìm tiện ích...'}
                className="w-full h-8 pl-8 pr-2.5 rounded-full bg-white border border-[#E3DFD5] text-xs text-stone-800 placeholder:text-stone-400 focus:outline-none focus:border-stone-500"
              />
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            className="h-8 px-3.5 rounded-full bg-[#1A1917] hover:bg-stone-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all shadow-sm shrink-0"
            title={isEn ? 'Close facilities menu' : 'Đóng menu tiện ích'}
          >
            <X className="w-3.5 h-3.5" />
            <span>{isEn ? 'Close' : 'Đóng'}</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      {isLoading ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2.5 text-stone-600">
          <Loader2 className="w-7 h-7 animate-spin text-stone-700" />
          <p className="text-xs font-bold">
            {isEn ? 'Loading facilities from Knowledge Base...' : 'Đang tải tiện ích từ Knowledge Base...'}
          </p>
        </div>
      ) : loadError ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-2.5">
          <AlertCircle className="w-8 h-8 text-amber-600" />
          <p className="text-xs font-bold text-stone-800">{loadError}</p>
          <button
            type="button"
            onClick={loadFromKnowledgeBase}
            className="px-4 py-1.5 rounded-full bg-[#1A1917] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{isEn ? 'Retry' : 'Thử lại'}</span>
          </button>
        </div>
      ) : !selectedFacilityForDetail ? (
        <div className="flex-1 min-h-0 py-2 sm:py-2.5 overflow-y-auto no-scrollbar">
          {filteredFacilities.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2">
              <Search className="w-8 h-8 text-stone-400" />
              <p className="text-xs font-bold text-stone-800">
                {isEn ? 'No matching facility found' : 'Không tìm thấy tiện ích phù hợp'}
              </p>
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory(allLabel);
                  setSearchQuery('');
                }}
                className="px-3.5 py-1.5 rounded-full bg-stone-200 text-stone-800 text-xs font-bold cursor-pointer"
              >
                {isEn ? 'Reset filters' : 'Đặt lại bộ lọc'}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2 sm:gap-2.5">
              {filteredFacilities.map((facility, index) => {
                const Icon = facility.icon;
                return (
                  <div
                    key={`${facility.key}-${index}`}
                    onClick={() => handleSelectFacility(facility)}
                    className="p-2.5 sm:p-3 rounded-2xl bg-white hover:bg-stone-50/90 border border-[#E3DFD5] hover:border-stone-400 transition-all flex items-center justify-between gap-3 shadow-xs hover:shadow-md group cursor-pointer active:scale-[0.995]"
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#EFECE4] border border-[#E3DFD5] text-stone-700 flex items-center justify-center shrink-0 group-hover:bg-[#1A1917] group-hover:text-white transition-colors">
                      <Icon className="w-5 h-5" />
                    </div>

                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-xs sm:text-sm font-black text-stone-900 group-hover:text-black truncate leading-tight">
                          {facility.name}
                        </h4>
                        <span className="font-mono font-bold px-1.5 py-0.5 rounded bg-stone-200 text-stone-700 border border-stone-300 text-[9px] shrink-0">
                          {facility.floorLevel}
                        </span>
                        <span className="text-[10px] text-stone-500 font-medium shrink-0">
                          {facility.hours}
                        </span>
                        <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 border border-stone-200 shrink-0">
                          {facility.category}
                        </span>
                      </div>

                      <p className="text-[11px] text-stone-600 truncate leading-snug">
                        {facility.desc}
                      </p>
                    </div>

                    {facility.hasMenuAction && onOpenFoodMenu ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onClose();
                          onOpenFoodMenu();
                        }}
                        className="h-8 px-3.5 rounded-full bg-[#1A1917] hover:bg-stone-800 text-white text-[11px] font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95 shrink-0"
                        title={isEn ? 'Open 24/7 Room Service food menu' : 'Mở thực đơn gọi món tận phòng 24/7'}
                      >
                        <Utensils className="w-3.5 h-3.5 text-white" />
                        <span>{isEn ? 'Order Room Service' : 'Xem thực đơn'}</span>
                        <ChevronRight className="w-3.5 h-3.5 text-stone-400 group-hover:translate-x-0.5 transition-transform" />
                      </button>
                    ) : facility.navigable ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onClose();
                          if (onNavigateToDestination) {
                            onNavigateToDestination(facility.key);
                          }
                        }}
                        className="h-8 px-3.5 rounded-full bg-[#1A1917] hover:bg-stone-800 text-white text-[11px] font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95 shrink-0"
                        title={isEn ? 'View 2D map & QR directions' : 'Xem sơ đồ 2D và chỉ đường kèm mã QR'}
                      >
                        <Navigation className="w-3.5 h-3.5 text-white" />
                        <span>{isEn ? 'Directions & QR' : 'Chỉ đường & QR'}</span>
                        <ChevronRight className="w-3.5 h-3.5 text-stone-400 group-hover:translate-x-0.5 transition-transform" />
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 min-h-0 py-2.5 overflow-y-auto no-scrollbar space-y-3">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setSelectedFacilityForDetail(null);
                setAiAnswer('');
              }}
              className="px-3.5 py-1.5 rounded-full bg-white hover:bg-stone-50 text-stone-800 border border-[#E3DFD5] text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{isEn ? 'Back to list' : 'Quay lại danh sách'}</span>
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
                  {selectedFacilityForDetail.knowledge?.pricing || (isEn ? 'Hotel standard' : 'Tiêu chuẩn khách sạn')}
                </span>
              </div>
              <p className="text-xs text-stone-600 mt-1.5 leading-relaxed">
                {selectedFacilityForDetail.knowledge?.summary || selectedFacilityForDetail.desc}
              </p>
            </div>
          </div>

          {/* Live AI Answer grounded in Knowledge Base */}
          {(isAskingAI || aiAnswer) && (
            <div className="p-3.5 rounded-2xl bg-stone-900 text-stone-100 border border-stone-700 shadow-sm space-y-1.5">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-stone-300">
                {isAskingAI ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                <span>
                  {isAskingAI
                    ? (isEn ? 'Rora AI is reading Knowledge Base...' : 'Rora AI đang tổng hợp từ Knowledge Base...')
                    : (isEn ? 'Rora AI Answer (from Knowledge Base)' : 'Phản hồi từ Rora AI (Knowledge Base)')}
                </span>
              </div>
              {aiAnswer && (
                <p className="text-xs text-stone-100 leading-relaxed">{aiAnswer}</p>
              )}
            </div>
          )}

          {/* Highlights */}
          {selectedFacilityForDetail.knowledge?.highlights?.length > 0 && (
            <div className="p-4 rounded-2xl bg-white border border-[#E3DFD5] shadow-xs space-y-2">
              <h5 className="text-[11px] font-black text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-stone-600" />
                <span>{isEn ? 'Highlights & Services' : 'Dịch vụ & Đặc quyền nổi bật'}</span>
              </h5>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {selectedFacilityForDetail.knowledge.highlights.map((item, idx) => (
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
          )}

          {/* Transit hint */}
          <div className="p-3 rounded-xl bg-[#EFECE4] border border-[#E3DFD5] text-[11px] text-stone-700 flex items-start gap-2.5">
            <MapPin className="w-4 h-4 text-stone-700 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-bold text-stone-900">
                {isEn ? 'Directions from Main Lobby:' : 'Hướng dẫn lộ trình từ sảnh chính:'}
              </p>
              <p className="text-stone-600 leading-snug">
                {selectedFacilityForDetail.knowledge?.transitHint ||
                  (isEn
                    ? `Take Elevator A to ${selectedFacilityForDetail.floorLevel}.`
                    : `Đi Thang máy A tới ${selectedFacilityForDetail.floorLevel}.`)}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2 border-t border-[#E3DFD5] flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {(onAskFacilityWithAI || onSpeak) && (
                <button
                  type="button"
                  disabled={isAskingAI}
                  onClick={handleHearIntroduction}
                  className="h-8 px-3 rounded-full bg-white hover:bg-stone-50 disabled:opacity-60 text-stone-800 border border-[#E3DFD5] text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
                >
                  {isAskingAI ? (
                    <Loader2 className="w-3.5 h-3.5 text-stone-600 animate-spin" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5 text-stone-600" />
                  )}
                  <span>{isEn ? 'Hear AI introduction' : 'Nghe AI giới thiệu'}</span>
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
                  <span>{isEn ? 'View food menu' : 'Xem thực đơn'}</span>
                </button>
              )}
            </div>

            {selectedFacilityForDetail.navigable && (
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
                <span>{isEn ? 'Directions & QR' : 'Chỉ đường & Quét mã QR'}</span>
                <ChevronRight className="w-3.5 h-3.5 text-stone-400" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="pt-1.5 border-t border-[#E3DFD5] flex items-center justify-between text-[10px] text-stone-600 shrink-0">
        <span className="font-bold text-stone-700">
          Aurora Grand Hotel · {sourceFile ? `Knowledge Base (${sourceFile})` : 'Knowledge Base'}
        </span>
        <span className="text-stone-500 font-medium hidden sm:inline">
          {isEn
            ? `Auto-closes in ${autoCloseSeconds}s · Tap a card for AI details`
            : `Tự đóng sau ${autoCloseSeconds}s · Chạm thẻ để xem chi tiết & hỏi AI`}
        </span>
      </div>
    </div>
  );
};
