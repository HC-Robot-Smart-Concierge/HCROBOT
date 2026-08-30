import React from 'react';
import { UserCheck, RotateCcw, Lock, Globe } from 'lucide-react';

export const Header = ({
  currentLanguage = 'Tiếng Việt',
  onLanguageToggle = () => {},
  activeRoomNumber = null,
  onResetSession = () => {},
  onOpenLogoutModal = () => {},
}) => {
  return (
    <header className="w-full h-[76px] px-6 bg-aurora-inverse text-aurora-textInverse flex justify-between items-center shrink-0 border-b border-stone-800/80 relative z-30 shadow-lg">
      {/* Left: Hotel Brand */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-aurora-canvas rounded-full border border-aurora-border flex items-center justify-center font-bold text-aurora-inverse text-base shadow-sm">
          A
        </div>
        <div className="flex flex-col justify-center">
          <h1 className="text-base font-bold leading-tight text-aurora-textInverse tracking-wide">
            Aurora Grand Hotel
          </h1>
          <p className="text-[11px] font-medium text-aurora-border opacity-80">
            HCRobot • Lobby Concierge
          </p>
        </div>
      </div>

      {/* Center: Active Room Session Badge / Status */}
      <div className="flex items-center gap-3">
        {activeRoomNumber ? (
          <div className="px-3.5 py-1.5 rounded-full bg-emerald-950/90 text-emerald-300 border border-emerald-700/80 shadow-md flex items-center gap-2 text-xs font-semibold backdrop-blur-md animate-fadeIn">
            <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Hỗ trợ: Phòng {activeRoomNumber}</span>
            <button
              onClick={onResetSession}
              title="Đổi phòng / Khách mới"
              className="ml-1 px-2 py-0.5 rounded-full bg-emerald-800/90 hover:bg-emerald-700 text-white text-[11px] flex items-center gap-1 transition-all cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Đổi phòng</span>
            </button>
          </div>
        ) : (
          <div className="px-3.5 py-1.5 rounded-full bg-stone-900/80 text-stone-300 border border-stone-700/60 shadow-sm flex items-center gap-2 text-xs font-medium backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span>Sẵn sàng phục vụ</span>
          </div>
        )}
      </div>

      {/* Right: Language Selector & Protected Logout */}
      <div className="flex items-center gap-4">
        <button
          onClick={onLanguageToggle}
          className="px-3 py-1.5 rounded-full bg-stone-800/80 hover:bg-stone-700/80 border border-stone-700/60 text-stone-200 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
          title="Bấm để đổi ngôn ngữ"
        >
          <Globe className="w-3.5 h-3.5 text-emerald-400" />
          <span>{currentLanguage}</span>
        </button>

        <button
          onClick={onOpenLogoutModal}
          className="px-3.5 py-1.5 rounded-full bg-rose-950/80 hover:bg-rose-900 text-rose-200 border border-rose-800/70 shadow-md flex items-center gap-1.5 text-xs font-bold transition-all cursor-pointer"
        >
          <Lock className="w-3.5 h-3.5 text-amber-400" />
          <span>Đăng Xuất</span>
        </button>
      </div>
    </header>
  );
};
