import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { useLanguage } from '../context/LanguageContext';

import { AuroraSidebar } from '../components/dashboard/AuroraSidebar';
import { AuroraHeader } from '../components/dashboard/AuroraHeader';
import { MobileBottomNav } from '../components/common/MobileBottomNav';
import { ToastNotification } from '../components/dashboard/ToastNotification';

// Modals
import { FeedbackModal } from '../components/common/FeedbackModal';
import { NotificationCenterModal } from '../components/common/NotificationCenterModal';
import { QuickRequestModal } from '../components/common/QuickRequestModal';
import { UserProfileModal } from '../components/common/UserProfileModal';

import { Bell, PlusCircle, LogOut } from 'lucide-react';

export const StaffLayout = () => {
  const { currentUser, isAdmin, logout, setCurrentUser } = useAuth();
  const {
    notifications,
    unreadNotifCount,
    toastMessage,
    showNotification,
    handleToggleRead,
    handleMarkAllRead,
    handleDelete,
    showNotifModal,
    setShowNotifModal,
    showQuickRequestModal,
    setShowQuickRequestModal,
    showProfileModal,
    setShowProfileModal,
    showFeedbackModal,
    setShowFeedbackModal,
    feedbackSessionId,
  } = useNotifications();

  const { language, toggleLanguage, t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  // Determine activeView & activeMenu from current path
  const path = location.pathname;
  let activeView = 'room_service';
  let activeMenu = 'Dashboard';

  if (path.includes('/staff/reception')) activeView = 'reception';
  else if (path.includes('/staff/room-service')) activeView = 'room_service';
  else if (path.includes('/staff/housekeeping')) activeView = 'housekeeping';
  else if (path.includes('/staff/bell-services')) activeView = 'bell_services';
  else if (path.includes('/staff/maintenance')) activeView = 'maintenance';
  else if (path.includes('/staff/kitchen')) activeView = 'kitchen';
  else if (path.includes('/staff/concierge')) activeView = 'concierge';
  else if (path.includes('/staff/overview')) activeView = 'overview';

  if (path === '/staff/requests') activeMenu = 'Requests';
  else if (path === '/staff/my-tasks') activeMenu = 'MyTasks';
  else if (path === '/staff/kitchen-menu') activeMenu = 'KitchenMenu';
  else if (path === '/staff/history') activeMenu = 'History';
  else if (path === '/staff/notifications') activeMenu = 'Notifications';
  else if (path === '/staff/profile') activeMenu = 'Profile';
  else {
    const searchParams = new URLSearchParams(location.search);
    const tab = searchParams.get('tab');
    if (activeView === 'concierge' && tab) {
      if (tab === 'live_call') activeMenu = 'LiveCalls';
      else if (tab === 'recordings') activeMenu = 'Recordings';
      else if (tab === 'taxi') activeMenu = 'Taxi';
      else if (tab === 'feedback') activeMenu = 'Feedback';
    } else {
      activeMenu = 'Dashboard';
    }
  }

  // Handle sidebar navigation
  const handleSelectMenu = (menuId) => {
    switch (menuId) {
      case 'Dashboard':
        navigate(`/staff/${activeView.replace('_', '-')}`);
        break;
      case 'Requests':
        navigate('/staff/requests');
        break;
      case 'MyTasks':
        navigate('/staff/my-tasks');
        break;
      case 'KitchenMenu':
        navigate('/staff/kitchen-menu');
        break;
      case 'History':
        navigate('/staff/history');
        break;
      case 'Notifications':
        navigate('/staff/notifications');
        break;
      case 'Profile':
        navigate('/staff/profile');
        break;
      case 'LiveCalls':
        navigate('/staff/concierge?tab=live_call');
        break;
      case 'Recordings':
        navigate('/staff/concierge?tab=recordings');
        break;
      case 'Taxi':
        navigate('/staff/concierge?tab=taxi');
        break;
      case 'Feedback':
        navigate('/staff/concierge?tab=feedback');
        break;
      default:
        navigate(`/staff/${activeView.replace('_', '-')}`);
    }
  };

  const handleLogout = async () => {
    await logout();
    showNotification('Đã đăng xuất khỏi phiên làm việc.');
    navigate('/');
  };

  const viewOptions = [
    { id: 'admin_portal', label: 'Admin Command Portal', path: '/admin/portal' },
    { id: 'landing', label: 'Trang Chu (Landing)', path: '/' },
    { id: 'reception', label: '0. Reception (Staff)', path: '/staff/reception' },
    { id: 'room_service', label: '1. Room Service (Staff)', path: '/staff/room-service' },
    { id: 'housekeeping', label: '2. Housekeeping (Staff)', path: '/staff/housekeeping' },
    { id: 'bell_services', label: '3. Bell Services (Staff)', path: '/staff/bell-services' },
    { id: 'maintenance', label: '4. Maintenance (Staff)', path: '/staff/maintenance' },
    { id: 'kitchen', label: '5. Kitchen / Bếp (Staff)', path: '/staff/kitchen' },
    { id: 'concierge', label: '6. Concierge & Transport (Staff)', path: '/staff/concierge' },
    { id: 'robot_display', label: 'Man Hinh Robot', path: '/robot' },
    { id: 'admin_map', label: 'LiDAR SLAM Map', path: '/admin/map' },
  ];

  return (
    <div className="w-full h-screen overflow-hidden bg-[#FAF8F5] text-[#1A1917] flex flex-col font-sans select-none relative">
      {/* Toast Notification */}
      <ToastNotification message={toastMessage} />

      {/* Floating Header Pill with User & Admin Switcher */}
      <div className="absolute top-2.5 right-6 z-50 flex items-center gap-2">
        {currentUser && (
          <div className="flex items-center gap-2 bg-[#18181B]/95 text-white border border-stone-700/80 backdrop-blur-md px-3.5 py-1.5 rounded-full shadow-2xl">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <button
              onClick={() => setShowProfileModal(true)}
              title="Xem hồ sơ & Đổi mật khẩu"
              className="flex items-center gap-1.5 text-xs font-bold hover:opacity-80 transition cursor-pointer"
            >
              <span className="text-amber-300">
                {currentUser.full_name || currentUser.name}
              </span>
              <span className="text-stone-400 text-[10px]">
                ({currentUser.role || currentUser.department})
              </span>
            </button>

            {/* Quick Request Button */}
            <button
              onClick={() => setShowQuickRequestModal(true)}
              title="Tạo yêu cầu dịch vụ nhanh"
              className="p-1 rounded-full text-stone-300 hover:text-white hover:bg-stone-800 transition cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
            </button>

            {/* Notification Bell Badge Button */}
            <button
              onClick={() => setShowNotifModal(true)}
              title="Trung tâm thông báo"
              className="relative p-1 rounded-full text-stone-300 hover:text-white hover:bg-stone-800 transition cursor-pointer"
            >
              <Bell className="w-4 h-4" />
              {unreadNotifCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-600 text-white text-[9px] font-bold flex items-center justify-center">
                  {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
                </span>
              )}
            </button>

            {/* If Admin: Allow role switcher */}
            {isAdmin && (
              <select
                value={activeView}
                onChange={(e) => {
                  const target = viewOptions.find((opt) => opt.id === e.target.value);
                  if (target) navigate(target.path);
                }}
                className="bg-stone-800 text-white text-[11px] font-bold rounded-full px-2 py-0.5 border border-stone-600 outline-none cursor-pointer ml-1"
              >
                {viewOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            )}

            <button
              onClick={handleLogout}
              title="Đăng xuất"
              className="ml-1 px-2.5 py-1 rounded-full bg-red-600/90 hover:bg-red-600 text-white text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-sm"
            >
              <LogOut className="w-3 h-3" />
              <span>Đăng xuất</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Staff Frame: Sidebar + Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <AuroraSidebar
          activeMenu={activeMenu}
          onSelectMenu={handleSelectMenu}
          currentUser={currentUser}
          onLogout={handleLogout}
          onBackToHome={() => navigate('/')}
          referenceLayout={true}
          unreadNotifCount={unreadNotifCount}
          activeView={activeView}
        />

        {/* Center / Right Content Panel */}
        <main className="flex-1 flex flex-col overflow-hidden bg-[#FAF8F5] relative">
          <AuroraHeader
            referenceLayout={true}
            hotelName={t('hotelName')}
            systemName="HCROBOT"
            subtitle={`${currentUser?.department || 'Staff'} ${t('portalSubtitle')}`}
            language={language}
            onToggleLanguage={() => {
              toggleLanguage();
              showNotification(
                language === 'EN'
                  ? 'Đã chuyển ngôn ngữ sang Tiếng Việt'
                  : 'Language switched to English'
              );
            }}
            notifications={notifications}
            unreadCount={unreadNotifCount}
            onOpenNotificationsPage={() => navigate('/staff/notifications')}
            onToggleRead={handleToggleRead}
            onMarkAllRead={handleMarkAllRead}
            departmentName={currentUser?.department || 'Staff'}
          />

          <div className="flex-1 overflow-y-auto">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav
        activeMenu={activeMenu}
        onSelectMenu={handleSelectMenu}
        unreadNotifCount={unreadNotifCount}
        currentUser={currentUser}
        activeView={activeView}
      />

      {/* Global Modals */}
      <FeedbackModal
        isOpen={showFeedbackModal}
        onClose={() => setShowFeedbackModal(false)}
        sessionId={feedbackSessionId}
        onFeedbackSubmitted={(rating) => {
          showNotification(`Cảm ơn bạn đã đánh giá dịch vụ ${rating} sao!`);
        }}
      />

      <NotificationCenterModal
        isOpen={showNotifModal}
        onClose={() => setShowNotifModal(false)}
        notifications={notifications}
        onToggleRead={handleToggleRead}
        onMarkAllRead={handleMarkAllRead}
        onDeleteNotification={handleDelete}
        department={currentUser?.department || 'Staff'}
      />

      <QuickRequestModal
        isOpen={showQuickRequestModal}
        onClose={() => setShowQuickRequestModal(false)}
        onCreated={() => {
          showNotification('Đã tạo và điều phối yêu cầu thành công!');
        }}
      />

      <UserProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        onUserUpdated={(updated) => {
          setCurrentUser(updated);
          showNotification('Hồ sơ nhân sự đã được cập nhật thành công!');
        }}
      />
    </div>
  );
};
