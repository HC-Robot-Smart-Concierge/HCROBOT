import React from 'react';
import { FloorMap } from './FloorMap';
import { X, Globe, Check } from 'lucide-react';

export const MobileRobotLanguageModal = ({
  isLangMenuOpen,
  setIsLangMenuOpen,
  isEn,
  onToggleLanguage,
}) => (
  <>
        {isLangMenuOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in select-none"
            onClick={() => setIsLangMenuOpen(false)}
            onPointerDown={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={isEn ? 'Language' : 'Ngôn ngữ'}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              className="w-full max-w-xs sm:max-w-sm rounded-3xl shadow-2xl p-4 sm:p-5 flex flex-col gap-3.5 animate-in zoom-in-95 duration-150 border text-stone-900"
              style={{ background: '#FAF8F5', borderColor: '#BFBFBD' }}
            >
              {/* Header Modal */}
              <div className="flex items-center justify-between pb-2.5 border-b border-stone-200">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-stone-800" />
                  <h2 className="text-sm font-bold tracking-wide" style={{ color: '#262626' }}>
                    {isEn ? 'Language' : 'Ngôn ngữ'}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsLangMenuOpen(false)}
                  className="w-8 h-8 rounded-full bg-stone-200/80 hover:bg-stone-300 text-stone-600 hover:text-stone-900 flex items-center justify-center active:scale-95 transition-all cursor-pointer"
                  title={isEn ? 'Close' : 'Đóng'}
                  aria-label={isEn ? 'Close' : 'Đóng'}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Thân Modal: Chỉ icon cờ và tên ngôn ngữ, không chữ phụ rườm rà */}
              <div className="flex flex-col gap-2.5">
                {/* 1. Tiếng Việt */}
                <button
                  type="button"
                  onClick={() => {
                    onToggleLanguage('Tiếng Việt');
                    setIsLangMenuOpen(false);
                  }}
                  className={`w-full p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between active:scale-[0.98] ${
                    !isEn
                      ? 'bg-black border-black text-white shadow-md'
                      : 'bg-stone-100 hover:bg-stone-200 border-stone-300 text-stone-900'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <svg viewBox="0 0 32 24" className="w-10 h-7 rounded-md overflow-hidden shadow-xs border border-rose-800/60 shrink-0">
                      <rect width="32" height="24" fill="#DA251D" />
                      <polygon points="16,4 17.8,9.7 23.8,9.7 19,13.2 20.8,19 16,15.5 11.2,19 13,13.2 8.2,9.7 14.2,9.7" fill="#FFFF00" />
                    </svg>
                    <span className={`text-base font-bold ${!isEn ? 'text-white' : 'text-stone-900'}`}>Tiếng Việt</span>
                  </div>
                  {!isEn ? (
                    <div className="w-6 h-6 rounded-full bg-white text-stone-900 flex items-center justify-center shrink-0 shadow-sm">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  ) : (
                    <div className="w-6 h-6 rounded-full border border-stone-300 shrink-0" />
                  )}
                </button>

                {/* 2. English */}
                <button
                  type="button"
                  onClick={() => {
                    onToggleLanguage('English');
                    setIsLangMenuOpen(false);
                  }}
                  className={`w-full p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between active:scale-[0.98] ${
                    isEn
                      ? 'bg-black border-black text-white shadow-md'
                      : 'bg-stone-100 hover:bg-stone-200 border-stone-300 text-stone-900'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <svg viewBox="0 0 32 24" className="w-10 h-7 rounded-md overflow-hidden shadow-xs border border-blue-900/60 shrink-0">
                      <rect width="32" height="24" fill="#012169" />
                      <path d="M0,0 L32,24 M32,0 L0,24" stroke="#FFFFFF" strokeWidth="4" />
                      <path d="M0,0 L32,24 M32,0 L0,24" stroke="#C8102E" strokeWidth="1.6" />
                      <path d="M16,0 V24 M0,12 H32" stroke="#FFFFFF" strokeWidth="6" />
                      <path d="M16,0 V24 M0,12 H32" stroke="#C8102E" strokeWidth="3.6" />
                    </svg>
                    <span className={`text-base font-bold ${isEn ? 'text-white' : 'text-stone-900'}`}>English</span>
                  </div>
                  {isEn ? (
                    <div className="w-6 h-6 rounded-full bg-white text-stone-900 flex items-center justify-center shrink-0 shadow-sm">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  ) : (
                    <div className="w-6 h-6 rounded-full border border-stone-300 shrink-0" />
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
  </>
);

export const MobileRobotMapView = ({
  navigationDestinationKey,
  onSelectDestination,
  navActiveStep,
  setNavActiveStep,
  showQrModalExternal,
  qrCountdown,
  onCloseQrModal,
  handleDismissMap,
  currentDestination,
  isEn,
}) => (
          <main className="flex-1 min-h-0 w-full h-full p-2 bg-[#F5F2EB] select-none relative overflow-hidden flex flex-col">
            {/* Bản đồ Wayfinding toàn màn hình 100% diện tích, to rõ tối đa trên điện thoại xoay ngang */}
            <div className="w-full h-full relative rounded-2xl overflow-hidden border border-[#E3DFD5] shadow-sm bg-white">
              <FloorMap
                destinationKey={navigationDestinationKey}
                onSelectDestination={onSelectDestination}
                onClose={handleDismissMap}
                showQrModalExternal={showQrModalExternal}
                qrCountdown={qrCountdown}
                onCloseQrModal={onCloseQrModal || (() => {})}
                onStepChange={setNavActiveStep}
                defaultZoom={1.0}
                className="w-full h-full rounded-none border-none shadow-none"
              />

              {/* Thanh chỉ dẫn nổi tinh gọn ở đáy màn hình: hiển thị chỉ dẫn tương ứng theo Chặng 1 hoặc Chặng 2 */}
              <div className="absolute bottom-2.5 left-2.5 right-2.5 z-30 pointer-events-none flex items-center justify-between gap-2.5">
                <div className="pointer-events-auto flex-1 min-w-0 max-w-xl bg-stone-900/90 text-stone-100 backdrop-blur-md px-3.5 py-1.5 rounded-2xl border border-stone-700/80 shadow-xl flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 animate-pulse" />
                  <span className="text-xs font-semibold text-stone-100 truncate">
                    {currentDestination.isDifferentFloor
                      ? (navActiveStep === 1
                        ? `${currentDestination.step1Text || 'Chặng 1: Đi tới Thang máy A và bấm lên tầng mục tiêu.'}`
                        : `${currentDestination.step2Text || `Chặng 2: Ra khỏi thang máy tới ${currentDestination.name}.`}`)
                      : `${currentDestination.step1Text || `Đi theo hành lang tới ${currentDestination.name}`}`}
                  </span>
                </div>

                {/* Nút Đóng nhanh */}
                <button
                  type="button"
                  onClick={handleDismissMap}
                  className="pointer-events-auto h-8 px-3.5 rounded-2xl bg-stone-900 hover:bg-stone-800 text-white border border-stone-700/80 shadow-xl text-xs font-bold transition-all active:scale-95 cursor-pointer shrink-0 flex items-center gap-1.5"
                  title={isEn ? 'Close Map' : 'Đóng bản đồ'}
                  aria-label={isEn ? 'Close' : 'Đóng'}
                >
                  <X className="w-3.5 h-3.5" />
                  <span>{isEn ? 'Close' : 'Đóng'}</span>
                </button>
              </div>
            </div>
          </main>
);
