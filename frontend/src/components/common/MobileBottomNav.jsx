import React from 'react';
import {
  LayoutDashboard,
  Inbox,
  ClipboardCheck,
  History,
  Bell,
  User,
  PhoneCall,
  Car,
  Star,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export const MobileBottomNav = ({
  activeMenu = 'Dashboard',
  onSelectMenu = () => {},
  unreadNotifCount = 0,
  currentUser = null,
  activeView = '',
}) => {
  const { t } = useLanguage();

  const deptLower = (currentUser?.department || '').toLowerCase();
  const roleLower = (currentUser?.role || '').toLowerCase();
  const defaultDashLower = (currentUser?.default_dashboard || currentUser?.defaultDashboard || '').toLowerCase();
  const isConcierge =
    activeView === 'concierge' ||
    deptLower.includes('concierge') ||
    roleLower.includes('concierge') ||
    defaultDashLower === 'concierge';

  const navItems = isConcierge
    ? [
        { id: 'LiveCalls', label: 'Tổng Đài', icon: PhoneCall },
        { id: 'Taxi', label: 'Đặt Xe', icon: Car },
        { id: 'Feedback', label: 'Đánh Giá', icon: Star },
        { id: 'Requests', label: t('menuRequests') || 'Yêu Cầu', icon: Inbox },
        { id: 'MyTasks', label: 'Cá Nhân', icon: ClipboardCheck },
        { id: 'Notifications', label: t('menuNotifications') || 'Thông Báo', icon: Bell },
      ]
    : [
        { id: 'Dashboard', label: t('menuDashboard') || 'Tổng Quan', icon: LayoutDashboard },
        { id: 'Requests', label: t('menuRequests') || 'Yêu Cầu', icon: Inbox },
        { id: 'MyTasks', label: 'Cá Nhân', icon: ClipboardCheck },
        { id: 'Notifications', label: t('menuNotifications') || 'Thông Báo', icon: Bell },
        { id: 'Profile', label: t('menuProfile') || 'Hồ Sơ', icon: User },
      ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-[#E8E5E0] h-16 flex items-center justify-around px-1 md:hidden select-none shadow-lg">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeMenu === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onSelectMenu(item.id)}
            className={`flex flex-col items-center justify-center flex-1 h-full py-1 transition-all cursor-pointer relative ${
              isActive
                ? 'text-[#1A1917]'
                : 'text-[#78716C] hover:text-[#1A1917]'
            }`}
          >
            <div className={`p-1 rounded-xl transition-all ${isActive ? 'bg-[#F4F3F0]' : ''}`}>
              <Icon
                className={`w-5 h-5 ${isActive ? 'text-[#1A1917]' : 'text-[#78716C]'}`}
                strokeWidth={isActive ? 2.2 : 1.8}
              />
            </div>
            <span className={`text-[10px] mt-0.5 tracking-tight ${isActive ? 'font-bold text-[#1A1917]' : 'font-medium text-[#78716C]'}`}>
              {item.label}
            </span>

            {item.id === 'Notifications' && unreadNotifCount > 0 && (
              <span className="absolute top-2 right-[25%] px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-[#18181B] text-white">
                {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
};
