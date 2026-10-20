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

export const StaffLayout = () => {
  const { currentUser, isAdmin, logout, setCurrentUser, resolveStaffDashboard } = useAuth();
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

  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  // Determine activeView & activeMenu from current path
  const path = location.pathname;
  const staffDefaultView = resolveStaffDashboard ? resolveStaffDashboard(currentUser) : 'housekeeping';
  let activeView = staffDefaultView;
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
    showNotification('You have been signed out successfully.');
    navigate('/');
  };

  return (
    <div className="w-full h-screen overflow-hidden bg-[#FAF8F5] text-[#1A1917] flex flex-col font-sans select-none relative">
      {/* Toast Notification */}
      <ToastNotification message={toastMessage} />

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
          showNotification('Request created and dispatched successfully!');
        }}
      />

      <UserProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        onUserUpdated={(updated) => {
          setCurrentUser(updated);
          showNotification('Staff profile updated successfully!');
        }}
      />
    </div>
  );
};
