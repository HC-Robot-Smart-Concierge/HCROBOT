import React, { useState, useRef, useEffect } from 'react';
import {
  Bell,
  CheckCheck,
  Bot,
  AlertTriangle,
  Briefcase,
  Wrench,
  CookingPot,
  Sparkles,
  ShieldAlert,
  ChevronRight,
} from 'lucide-react';

export const AuroraHeader = ({
  hotelName = 'Aurora Grand Hotel',
  systemName = 'HCROBOT',
  subtitle = 'Front Desk Operations',
  unreadCount = 0,
  referenceLayout = false,
  notifications = [],
  onOpenNotificationsPage = () => {},
  onToggleRead = () => {},
  onMarkAllRead = () => {},
  departmentName = 'Staff',
  currentUser = null,
  onOpenProfilePage = () => {},
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
      return { Icon: AlertTriangle, color: 'bg-red-50 text-red-600 border border-red-100' };
    }
    if (type.includes('robot')) {
      return { Icon: Bot, color: 'bg-sky-50 text-sky-600 border border-sky-100' };
    }
    if (type.includes('room_service') || type.includes('f&b')) {
      return { Icon: CookingPot, color: 'bg-amber-50 text-amber-600 border border-amber-100' };
    }
    if (type.includes('bell')) {
      return { Icon: Briefcase, color: 'bg-stone-100 text-zinc-700 border border-stone-200' };
    }
    if (type.includes('maint')) {
      return { Icon: Wrench, color: 'bg-orange-50 text-orange-600 border border-orange-100' };
    }
    if (type.includes('directive')) {
      return { Icon: ShieldAlert, color: 'bg-purple-50 text-purple-600 border border-purple-100' };
    }
    return { Icon: Sparkles, color: 'bg-emerald-50 text-emerald-600 border border-emerald-100' };
  };

  const recentNotifications = notifications.slice(0, 5);

  return (
    <header
      className={`w-full flex items-center justify-between px-4 md:px-8 select-none shrink-0 sticky top-0 z-30 font-sans mobile-safe-header pt-10 md:pt-2.5 pb-2.5 border-b border-[#EAE6DE]/70 bg-[#FAF8F5]/95 backdrop-blur-md ${
        referenceLayout ? 'bg-[#FCFAF7]' : ''
      }`}
    >
      {/* Hotel & System Breadcrumb */}
      <div className="min-w-0 flex-1 pr-2 flex items-center gap-2.5">
        <img
          src="/hc-robot-logo.png"
          alt="HC-Robot Logo"
          className="w-7 h-7 object-contain shrink-0 drop-shadow-xs"
        />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[#1A1917] text-xs font-semibold truncate">
            <span className="truncate">{hotelName}</span>
            <span className="text-[#A8A29E] shrink-0">|</span>
            <span className="font-bold tracking-wide shrink-0">{systemName}</span>
          </div>
          <p className="text-[10px] md:text-[11px] font-medium text-[#78716C] truncate">{subtitle}</p>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2.5 relative" ref={dropdownRef}>
        {/* 1. Notifications Bell Button */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          title="Xem thông báo bộ phận"
          className={`relative w-10 h-10 rounded-full bg-stone-100 hover:bg-stone-200/80 flex items-center justify-center transition-colors border border-stone-200/60 cursor-pointer ${
            isOpen ? 'bg-stone-200/90 ring-2 ring-stone-300' : ''
          }`}
        >
          <Bell className="w-5 h-5 text-zinc-700" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 rounded-full bg-red-600 text-white text-[11px] font-bold flex items-center justify-center ring-2 ring-[#F8F7F4] animate-pulse">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* 2. Mobile Profile Avatar Button (1-tap access on mobile PWA) */}
        <button
          type="button"
          onClick={() => {
            if (typeof onOpenProfilePage === 'function') {
              onOpenProfilePage();
            }
          }}
          title="Hồ sơ nhân viên & Cài đặt"
          className="md:hidden flex items-center justify-center w-10 h-10 rounded-full border border-stone-200/90 overflow-hidden bg-zinc-900 text-white text-xs font-semibold shrink-0 hover:ring-2 hover:ring-stone-400 transition-all cursor-pointer shadow-xs active:scale-95"
        >
          {currentUser?.avatar_url || currentUser?.avatar ? (
            <img
              src={currentUser.avatar_url || currentUser.avatar}
              alt={currentUser?.name || currentUser?.full_name || 'Staff'}
              className="w-full h-full object-cover"
            />
          ) : (
            <span>{(currentUser?.full_name || currentUser?.name || 'S').charAt(0).toUpperCase()}</span>
          )}
        </button>

        {/* 3. Interactive Notification Popover / Dropdown */}
        {isOpen && (
          <div className="fixed inset-x-3 top-16 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[400px] bg-white rounded-2xl shadow-xl shadow-zinc-900/10 border border-stone-200/80 overflow-hidden z-50 flex flex-col animate-in fade-in slide-in-from-top-2 duration-150">
            {/* Header: Tách thành 2 hàng rõ ràng khắc phục triệt để lỗi vỡ chữ */}
            <div className="p-4 border-b border-stone-100 bg-white/90 backdrop-blur-md sticky top-0 z-10">
              {/* Hàng 1 (Tiêu đề + Nút thao tác) */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <h3 className="text-base font-bold text-zinc-900 whitespace-nowrap">
                    Department Notifications
                  </h3>
                  {unreadCount > 0 && (
                    <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-red-50 text-red-600 border border-red-100 whitespace-nowrap">
                      {unreadCount} new
                    </span>
                  )}
                </div>

                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      onMarkAllRead();
                    }}
                    className="flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <CheckCheck className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Mark all read</span>
                  </button>
                )}
              </div>

              {/* Hàng 2 (Tag bộ phận) */}
              <div className="mt-2 flex items-center">
                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-zinc-900 text-white whitespace-nowrap">
                  {departmentName}
                </span>
              </div>
            </div>

            {/* Notifications List */}
            <div className="max-h-[60vh] sm:max-h-[420px] overflow-y-auto divide-y divide-stone-100 custom-scrollbar">
              {recentNotifications.length === 0 ? (
                <div className="py-12 px-6 text-center text-zinc-400 text-xs">
                  <Bell className="w-8 h-8 mx-auto text-zinc-300 mb-2" />
                  <p>No new notifications.</p>
                </div>
              ) : (
                recentNotifications.map((notif) => {
                  const { Icon, color } = getNotifIcon(notif);
                  const isUnread = notif.is_read === false || notif.isRead === false;

                  return (
                    <div
                      key={notif.id}
                      onClick={() => onToggleRead(notif.id)}
                      className={`p-4 hover:bg-stone-50/80 transition-colors flex items-start gap-3.5 cursor-pointer relative ${
                        isUnread ? 'bg-stone-50/40' : 'opacity-90'
                      }`}
                    >
                      {/* Icon bên trái */}
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${color}`}>
                        <Icon className="w-5 h-5" />
                      </div>

                      {/* Nội dung ở giữa */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p
                            className={`text-sm truncate pr-2 ${
                              isUnread ? 'font-bold text-zinc-900' : 'font-medium text-zinc-700'
                            }`}
                          >
                            {notif.title}
                          </p>
                          {isUnread && (
                            <span className="w-2 h-2 rounded-full bg-red-500 shrink-0 mt-1.5" />
                          )}
                        </div>

                        <p className="text-xs text-zinc-500 line-clamp-2 mt-0.5 leading-relaxed">
                          {notif.description}
                        </p>

                        {/* Meta info */}
                        <div className="flex items-center justify-between mt-2 pt-1">
                          <span className="text-[11px] font-medium text-zinc-400">
                            {notif.time ||
                              (notif.created_at
                                ? new Date(notif.created_at).toLocaleTimeString('vi-VN', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : 'Just now')}
                          </span>
                          <span className="text-[11px] font-mono text-zinc-400 bg-stone-100 px-1.5 py-0.5 rounded">
                            {notif.id || 'NOTIF'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Popover Footer: View all in Notification Center */}
            <div className="p-3 bg-stone-50/50 border-t border-stone-100">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenNotificationsPage();
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-stone-100 text-zinc-800 text-xs font-semibold border border-stone-200/80 shadow-2xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <span>View all in Notification Center</span>
                <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
