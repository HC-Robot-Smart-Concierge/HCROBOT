import React, { useState, useRef, useEffect } from 'react';
import {
  Globe,
  Bell,
  CheckCheck,
  Bot,
  AlertTriangle,
  Briefcase,
  Wrench,
  CookingPot,
  Sparkles,
  ShieldAlert,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';

export const AuroraHeader = ({
  hotelName = 'Aurora Grand Hotel',
  systemName = 'HCROBOT',
  subtitle = 'Front Desk Operations',
  unreadCount = 0,
  language = 'EN',
  onToggleLanguage = () => {},
  referenceLayout = false,
  notifications = [],
  onOpenNotificationsPage = () => {},
  onToggleRead = () => {},
  onMarkAllRead = () => {},
  departmentName = 'Staff',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const getNotifIcon = (notif) => {
    const type = (notif.type || notif.request_type || '').toLowerCase();
    if (type.includes('urgent') || type.includes('warning')) {
      return { Icon: AlertTriangle, color: 'bg-red-100 text-red-600' };
    }
    if (type.includes('robot')) {
      return { Icon: Bot, color: 'bg-sky-100 text-sky-600' };
    }
    if (type.includes('room_service') || type.includes('f&b')) {
      return { Icon: CookingPot, color: 'bg-amber-100 text-amber-700' };
    }
    if (type.includes('bell')) {
      return { Icon: Briefcase, color: 'bg-stone-100 text-stone-700' };
    }
    if (type.includes('maint')) {
      return { Icon: Wrench, color: 'bg-orange-100 text-orange-700' };
    }
    if (type.includes('directive')) {
      return { Icon: ShieldAlert, color: 'bg-purple-100 text-purple-700' };
    }
    return { Icon: Sparkles, color: 'bg-emerald-100 text-emerald-700' };
  };

  const recentNotifications = notifications.slice(0, 5);

  return (
    <header
      className={`w-full flex items-center justify-between px-4 md:px-8 select-none shrink-0 sticky top-0 z-30 font-sans mobile-safe-header pt-10 md:pt-2.5 pb-2.5 border-b border-[#EAE6DE]/70 bg-[#FAF8F5]/95 backdrop-blur-md ${
        referenceLayout ? 'bg-[#FCFAF7]' : ''
      }`}
    >
      {/* Hotel & System Breadcrumb */}
      <div className="min-w-0 flex-1 pr-2">
        <div className="flex items-center gap-1.5 text-[#1A1917] text-xs font-semibold truncate">
          <span className="truncate">{hotelName}</span>
          <span className="text-[#A8A29E] shrink-0">|</span>
          <span className="font-bold tracking-wide shrink-0">{systemName}</span>
        </div>
        <p className="text-[10px] md:text-[11px] font-medium text-[#78716C] truncate">{subtitle}</p>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3 relative" ref={dropdownRef}>
        {/* Language selector */}
        <button
          type="button"
          onClick={onToggleLanguage}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#DDD8CE] text-xs font-semibold text-[#44403C] hover:bg-[#E5E0D5] transition-all cursor-pointer ${referenceLayout ? 'bg-[#F5F4F1]' : 'bg-[#EFECE6]'}`}
        >
          <Globe className="w-3.5 h-3.5 text-[#57534E]" />
          <span>{language}</span>
        </button>

        {/* Notifications Bell Button */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          title="Xem thông báo phòng ban"
          className={`relative p-2 rounded-full text-[#44403C] hover:bg-[#E5E0D5] transition-all cursor-pointer ${
            isOpen ? 'bg-[#E5E0D5] ring-2 ring-stone-400' : ''
          } ${referenceLayout ? 'bg-transparent border-0' : 'bg-[#EFECE6] border border-[#DDD8CE]'}`}
        >
          <Bell className="w-4 h-4 text-[#44403C]" />
          {unreadCount > 0 && (
            <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[#EF4444] text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-[#FAF8F5] animate-pulse">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* Interactive Notification Popover / Dropdown */}
        {isOpen && (
          <div className="absolute right-0 top-12 w-[390px] max-w-[calc(100vw-32px)] bg-white rounded-3xl border border-[#E5E1D8] shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150 flex flex-col">
            {/* Popover Header */}
            <div className="p-4 border-b border-[#F0ECE3] bg-[#FAF8F5] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold text-stone-900">Thông Báo Phòng Ban</h3>
                <span className="px-2 py-0.5 rounded-full bg-[#18181B] text-white text-[9px] font-bold">
                  {departmentName}
                </span>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold">
                    {unreadCount} mới
                  </span>
                )}
              </div>

              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    onMarkAllRead();
                  }}
                  className="text-[11px] font-semibold text-stone-600 hover:text-stone-900 flex items-center gap-1 hover:underline cursor-pointer"
                >
                  <CheckCheck className="w-3 h-3" />
                  <span>Đọc tất cả</span>
                </button>
              )}
            </div>

            {/* Notifications List */}
            <div className="max-h-[340px] overflow-y-auto custom-scrollbar divide-y divide-[#F5F2EB]">
              {recentNotifications.length === 0 ? (
                <div className="py-12 px-6 text-center text-stone-400 text-xs">
                  <Bell className="w-8 h-8 mx-auto text-stone-300 mb-2" />
                  <p>Hiện không có thông báo nào mới.</p>
                </div>
              ) : (
                recentNotifications.map((notif) => {
                  const { Icon, color } = getNotifIcon(notif);
                  const isUnread = notif.is_read === false || notif.isRead === false;

                  return (
                    <div
                      key={notif.id}
                      onClick={() => onToggleRead(notif.id)}
                      className={`p-3.5 hover:bg-[#F9F7F4] transition-colors cursor-pointer flex items-start gap-3 relative ${
                        isUnread ? 'bg-amber-50/20' : 'opacity-80'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${color}`}>
                        <Icon className="w-4 h-4" />
                      </div>

                      <div className="flex-1 min-w-0 space-y-0.5">
                        <div className="flex items-center justify-between gap-2">
                          <p className={`text-xs truncate ${isUnread ? 'font-bold text-stone-900' : 'font-medium text-stone-700'}`}>
                            {notif.title}
                          </p>
                          {isUnread && (
                            <span className="w-2 h-2 rounded-full bg-red-600 shrink-0" />
                          )}
                        </div>

                        <p className="text-[11px] text-stone-500 line-clamp-2 leading-relaxed">
                          {notif.description}
                        </p>

                        <div className="flex items-center justify-between pt-1">
                          <span className="text-[10px] text-stone-400 font-medium">
                            {notif.time || (notif.created_at ? new Date(notif.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : 'Vừa xong')}
                          </span>
                          <span className="text-[10px] text-stone-400 font-mono">
                            {notif.id}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Popover Footer: View all in Notification Center */}
            <div className="p-3 border-t border-[#F0ECE3] bg-[#FAF8F5] text-center">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenNotificationsPage();
                }}
                className="w-full py-2 px-3 rounded-2xl bg-white hover:bg-stone-100 border border-[#DDD8CE] text-xs font-bold text-stone-800 transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
              >
                <span>Xem tất cả trong Trung Tâm Thông Báo</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
