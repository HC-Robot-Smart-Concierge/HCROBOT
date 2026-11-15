import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Building, Search, X } from 'lucide-react';
import { fetchRAGFacilities } from '../../services/knowledgeApi';
import {
  normalizeFacility,
  FacilitiesListBody,
  FacilityDetailView,
} from './RobotFacilitiesView';

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
      {!selectedFacilityForDetail ? (
        <FacilitiesListBody
          isLoading={isLoading}
          loadError={loadError}
          isEn={isEn}
          filteredFacilities={filteredFacilities}
          allLabel={allLabel}
          setSelectedCategory={setSelectedCategory}
          setSearchQuery={setSearchQuery}
          loadFromKnowledgeBase={loadFromKnowledgeBase}
          handleSelectFacility={handleSelectFacility}
          onClose={onClose}
          onOpenFoodMenu={onOpenFoodMenu}
          onNavigateToDestination={onNavigateToDestination}
        />
      ) : (
        <FacilityDetailView
          facility={selectedFacilityForDetail}
          isEn={isEn}
          isAskingAI={isAskingAI}
          aiAnswer={aiAnswer}
          onBack={() => {
            setSelectedFacilityForDetail(null);
            setAiAnswer('');
          }}
          onHearIntroduction={handleHearIntroduction}
          hasAiTrigger={Boolean(onAskFacilityWithAI || onSpeak)}
          onClose={onClose}
          onOpenFoodMenu={onOpenFoodMenu}
          onNavigateToDestination={onNavigateToDestination}
        />
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
