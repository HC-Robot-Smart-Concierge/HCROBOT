import React from 'react';
import { Globe, Bell } from 'lucide-react';

export const AuroraHeader = ({
  hotelName = 'Aurora Grand Hotel',
  systemName = 'HCROBOT',
  subtitle = 'Front Desk Operations',
  unreadCount = 2,
  language = 'EN',
  onToggleLanguage = () => {},
  managerUser = null, // { name: 'Marcus Vane', role: 'General Manager', avatar: '...' }
  referenceLayout = false,
}) => {
  return (
    <header
      className={`w-full flex items-center justify-between px-8 select-none shrink-0 sticky top-0 z-30 font-sans ${
        referenceLayout
          ? 'h-[70px] bg-[#FCFAF7] border-0'
          : 'py-2.5 border-b border-[#EAE6DE]/70 bg-[#FAF8F5]/80 backdrop-blur-md'
      }`}
    >
      {/* Hotel & System Breadcrumb */}
      <div>
        <div className={`flex items-center gap-2 text-[#1A1917] ${referenceLayout ? 'text-[14px] font-medium' : 'text-xs font-semibold'}`}>
          <span>{hotelName}</span>
          <span className="text-[#A8A29E]">|</span>
          <span className={referenceLayout ? 'font-normal text-[#555]' : 'font-bold tracking-wide'}>{systemName}</span>
        </div>
        <p className={`${referenceLayout ? 'text-[14px] mt-0.5 font-normal' : 'text-[11px] font-medium'} text-[#78716C]`}>{subtitle}</p>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        {/* Language selector */}
        <button
          onClick={onToggleLanguage}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#DDD8CE] text-xs font-semibold text-[#44403C] hover:bg-[#E5E0D5] transition-all cursor-pointer ${referenceLayout ? 'bg-[#F5F4F1]' : 'bg-[#EFECE6]'}`}
        >
          <Globe className="w-3.5 h-3.5 text-[#57534E]" />
          <span>{language}</span>
        </button>

        {/* Notifications */}
        <button className={`relative p-2 rounded-full text-[#44403C] hover:bg-[#E5E0D5] transition-all cursor-pointer ${referenceLayout ? 'bg-transparent border-0' : 'bg-[#EFECE6] border border-[#DDD8CE]'}`}>
          <Bell className="w-4 h-4 text-[#44403C]" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#EF4444] ring-2 ring-[#FAF8F5]"></span>
          )}
        </button>

        {/* Manager User Info (if present) */}
        {managerUser && (
          <div className="flex items-center gap-2.5 pl-3 border-l border-[#DDD8CE]">
            {managerUser.avatar_url || managerUser.avatar ? (
              <img
                src={managerUser.avatar_url || managerUser.avatar}
                alt={managerUser.full_name || managerUser.name || 'Manager'}
                className="w-8 h-8 rounded-full object-cover border border-white"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-[#18181B] text-white flex items-center justify-center font-bold text-xs">
                {(managerUser.full_name || managerUser.name || 'M').charAt(0)}
              </div>
            )}
            <div className="text-left hidden sm:block">
              <p className="text-xs font-bold text-[#1A1917] leading-tight">
                {managerUser.full_name || managerUser.name || 'Marcus Vane'}
              </p>
              <p className="text-[10px] font-medium text-[#78716C]">
                {managerUser.role || 'General Manager'}
              </p>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
