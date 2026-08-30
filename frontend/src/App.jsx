import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AuroraSidebar } from './components/dashboard/AuroraSidebar';
import { AuroraHeader } from './components/dashboard/AuroraHeader';
import { ToastNotification } from './components/dashboard/ToastNotification';

// Pages
import { LandingHomePage } from './pages/home/LandingHomePage';
import { LoginPage } from './pages/auth/LoginPage';
import { ReceptionDashboard } from './pages/dashboard/ReceptionDashboard';
import { RoomServiceDashboard } from './pages/dashboard/RoomServiceDashboard';
import { HousekeepingDashboard } from './pages/dashboard/HousekeepingDashboard';
import { BellServicesDashboard } from './pages/dashboard/BellServicesDashboard';
import { MaintenanceDashboard } from './pages/dashboard/MaintenanceDashboard';
import { RobotScreenPage } from './pages/robot/RobotScreenPage';
import { AdminLidarPage } from './pages/admin/AdminLidarPage';
import { AdminPortal } from './pages/admin/AdminPortal';

// 5 Sidebar Staff Pages
import { RequestsPage } from './pages/staff/RequestsPage';
import { MyTasksPage } from './pages/staff/MyTasksPage';
import { HistoryPage } from './pages/staff/HistoryPage';
import { NotificationsPage } from './pages/staff/NotificationsPage';
import { ProfilePage } from './pages/staff/ProfilePage';
import { useLanguage } from './context/LanguageContext';

// Auth Api
import { getStoredUser, logoutUser, fetchCurrentUser } from './services/authApi';
import {
  fetchNotifications,
  toggleNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
} from './services/operationsApi';

import {
  UtensilsCrossed,
  Sparkles,
  Luggage,
  Wrench,
  ShieldCheck,
  Bot,
  Map,
  Home,
  Lock,
  LogOut,
  Shield,
  Layers,
} from 'lucide-react';

const STAFF_DASHBOARDS = [
  'reception',
  'room_service',
  'housekeeping',
  'bell_services',
  'maintenance',
];

const isAdminUser = (user) =>
  user?.username === 'admin' || user?.role === 'Operations Admin';

const normalizeLegacyView = (view, user) => {
  if (isAdminUser(user)) {
    if (!view || view === 'manager_hub' || view === 'landing' || STAFF_DASHBOARDS.includes(view)) {
      return 'admin_portal';
    }
    return view;
  }
  if (!view || view === 'manager_hub' || view === 'admin_portal') {
    return user ? 'room_service' : 'landing';
  }
  const clean = String(view).toLowerCase().trim().replace(/[\s-]+/g, '_');
  if (['f&b', 'fb', 'food_beverage', 'roomservice', 'f_and_b', 'room_service'].includes(clean)) {
    return 'room_service';
  }
  if (['bellman', 'bell', 'bell_service', 'bell_services'].includes(clean)) {
    return 'bell_services';
  }
  if (['housekeeping', 'clean'].includes(clean)) {
    return 'housekeeping';
  }
  if (['maintenance', 'tech', 'technician'].includes(clean)) {
    return 'maintenance';
  }
  if (['reception', 'front_desk', 'frontdesk'].includes(clean)) {
    return 'reception';
  }
  return clean;
};

export function App() {
  // activeView:
  // 'landing' | 'login' | 'reception' | 'room_service' | 'housekeeping' | 'bell_services' | 'maintenance' | 'robot_display' | 'admin_map' | 'admin_portal'
  const [currentUser, setCurrentUser] = useState(() => getStoredUser());

  // Live sync user profile with database on mount / reload
  useEffect(() => {
    async function syncProfile() {
      const freshUser = await fetchCurrentUser();
      if (freshUser) {
        setCurrentUser(freshUser);
      }
    }
    syncProfile();
  }, []);

  const [activeView, setActiveView] = useState(() => {
    const user = getStoredUser();
    if (user) {
      const savedView = localStorage.getItem('aurora_active_view');
      const targetRoleDashboard = normalizeLegacyView(
        user.default_dashboard || user.defaultDashboard || 'room_service',
        user
      );
      const allowed = user.allowedDashboards || [targetRoleDashboard];
      const normalizedSavedView = normalizeLegacyView(savedView, user);
      if (
        normalizedSavedView &&
        (allowed.includes(normalizedSavedView) ||
          ['landing', 'robot_display', 'admin_map'].includes(normalizedSavedView))
      ) {
        return normalizedSavedView;
      }
      return targetRoleDashboard;
    }
    return normalizeLegacyView(localStorage.getItem('aurora_active_view') || 'landing');
  });

  const [activeMenu, setActiveMenu] = useState(() => {
    return localStorage.getItem('aurora_active_menu') || 'Dashboard';
  });

  const { language, toggleLanguage, t } = useLanguage();
  const [toastMessage, setToastMessage] = useState(null);

  // Sync activeView to localStorage
  useEffect(() => {
    if (activeView) {
      localStorage.setItem('aurora_active_view', activeView);
    }
  }, [activeView]);

  // Sync activeMenu to localStorage
  useEffect(() => {
    if (activeMenu) {
      localStorage.setItem('aurora_active_menu', activeMenu);
    }
  }, [activeMenu]);

  // Role Guard: Ensure user cannot access unassigned role dashboards
  useEffect(() => {
    if (currentUser?.username === 'manager') {
      logoutUser();
      setCurrentUser(null);
      setActiveView('landing');
      setActiveMenu('Dashboard');
      localStorage.setItem('aurora_active_view', 'landing');
      localStorage.setItem('aurora_active_menu', 'Dashboard');
      showNotification('Tài khoản Housekeeping Manager đã được gỡ khỏi hệ thống.');
      return;
    }

    if (!currentUser) {
      // If logged out, only allow landing, login, robot_display, admin_map
      if (!['landing', 'login', 'robot_display', 'admin_map', 'admin_portal'].includes(activeView)) {
        setActiveView('landing');
      }
      return;
    }

    if (activeView === 'manager_hub') {
      setActiveView(isAdminUser(currentUser) ? 'admin_portal' : 'landing');
      return;
    }

    if (isAdminUser(currentUser)) {
      if (activeView === 'login') {
        setActiveView('admin_portal');
      }
      return; // Admin has universal access
    }

    const targetRoleDashboard = normalizeLegacyView(
      currentUser.default_dashboard || currentUser.defaultDashboard || 'room_service',
      currentUser
    );
    const allowed = currentUser.allowedDashboards || [targetRoleDashboard];

    // If currently on login page while already authenticated, redirect to staff dashboard
    if (activeView === 'login') {
      setActiveView(targetRoleDashboard);
      return;
    }

    // If activeView is a dashboard view and is not allowed for this staff
    const isDashboard = STAFF_DASHBOARDS.includes(activeView);

    if (isDashboard && !allowed.includes(activeView)) {
      setActiveView(targetRoleDashboard);
      showNotification('Bạn chỉ có quyền truy cập vai trò nghiệp vụ được phân công!');
    }
  }, [activeView, currentUser]);

  const showNotification = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3500);
  };

  // ---------------------------------------------------------
  // Department Notifications State & Live Polling (5s)
  // ---------------------------------------------------------
  const [notifications, setNotifications] = useState([]);
  const seenNotificationIdsRef = useRef(new Set());
  const isInitialNotifLoadRef = useRef(true);

  const loadNotifications = useCallback(async () => {
    if (!currentUser) return;
    const dept = isAdminUser(currentUser) ? 'All' : (currentUser.department || 'Staff');
    const data = await fetchNotifications(dept);
    if (Array.isArray(data)) {
      // Check for incoming new unread notifications to alert the staff
      if (!isInitialNotifLoadRef.current) {
        data.forEach((n) => {
          if (!seenNotificationIdsRef.current.has(n.id) && (n.is_read === false || n.isRead === false)) {
            showNotification(`🔔 [${n.department}] ${n.title}`);
          }
        });
      }

      data.forEach((n) => seenNotificationIdsRef.current.add(n.id));
      isInitialNotifLoadRef.current = false;
      setNotifications(data);
    }
  }, [currentUser]);

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 5000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  const handleToggleNotificationRead = async (id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: !n.is_read, isRead: !n.isRead } : n))
    );
    await toggleNotificationRead(id);
  };

  const handleMarkAllNotificationsRead = async () => {
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, is_read: true, isRead: true }))
    );
    const dept = isAdminUser(currentUser) ? 'All' : (currentUser?.department || 'Staff');
    await markAllNotificationsRead(dept);
  };

  const handleDeleteNotification = async (id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    await deleteNotification(id);
  };

  const unreadNotifCount = notifications.filter(
    (n) => n.is_read === false || n.isRead === false
  ).length;

  // Login Success Callback -> Auto-Redirect to the assigned staff dashboard
  const handleLoginSuccess = (user, targetDashboard) => {
    if (user?.username === 'manager') {
      logoutUser();
      setCurrentUser(null);
      setActiveView('landing');
      showNotification('Tài khoản Housekeeping Manager không còn được hỗ trợ.');
      return;
    }

    setCurrentUser(user);
    const resolvedDashboard = isAdminUser(user)
      ? 'admin_portal'
      : normalizeLegacyView(
          targetDashboard || user.default_dashboard || user.defaultDashboard || 'room_service',
          user
        );
    setActiveView(resolvedDashboard);
    localStorage.setItem('aurora_active_view', resolvedDashboard);
    setActiveMenu('Dashboard');
    localStorage.setItem('aurora_active_menu', 'Dashboard');
    showNotification(`Đăng nhập thành công! Vai trò: ${user.role || user.department}`);
  };

  // Logout Callback -> Return to Landing Page
  const handleLogout = () => {
    logoutUser();
    setCurrentUser(null);
    setActiveView('landing');
    localStorage.setItem('aurora_active_view', 'landing');
    setActiveMenu('Dashboard');
    localStorage.setItem('aurora_active_menu', 'Dashboard');
    showNotification('Đã đăng xuất khỏi phiên làm việc.');
  };

  const isDashboardView = STAFF_DASHBOARDS.includes(activeView);
  const usesReferenceLayout = [
    'reception',
    'room_service',
    'housekeeping',
    'bell_services',
    'maintenance',
  ].includes(activeView);

  const isAdmin = isAdminUser(currentUser);

  const viewOptions = [
    { id: 'admin_portal', label: '👑 Admin Command Portal' },
    { id: 'landing', label: '🏠 Trang Chủ (Landing)' },
    { id: 'reception', label: '0. Reception (Staff)' },
    { id: 'room_service', label: '1. Room Service (Staff)' },
    { id: 'housekeeping', label: '2. Housekeeping (Staff)' },
    { id: 'bell_services', label: '3. Bell Services (Staff)' },
    { id: 'maintenance', label: '4. Maintenance (Staff)' },
    { id: 'robot_display', label: '🤖 Màn Hình Robot' },
    { id: 'admin_map', label: '🗺️ LiDAR SLAM Map' },
  ];

  return (
    <div className="w-full h-screen overflow-hidden bg-[#FAF8F5] text-[#1A1917] flex flex-col font-sans select-none relative">
      {/* Top Floating Header Pill (Only on Staff Dashboards & LiDAR Map) */}
      {activeView !== 'landing' && activeView !== 'login' && activeView !== 'admin_portal' && activeView !== 'robot_display' && !usesReferenceLayout && (
        <div className="absolute top-2.5 right-6 z-50 flex items-center gap-2">
          {/* If logged in as staff: Strict Role Badge & Logout */}
          {currentUser ? (
            <div className="flex items-center gap-2 bg-[#18181B]/95 text-white border border-stone-700/80 backdrop-blur-md px-3.5 py-1.5 rounded-full shadow-2xl">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <div className="flex items-center gap-1.5 text-xs font-bold">
                <span className="text-amber-300">
                  {currentUser.full_name || currentUser.name}
                </span>
                <span className="text-stone-400 text-[10px]">
                  ({currentUser.role || currentUser.department})
                </span>
              </div>

              {/* If Admin: Allow role switcher */}
              {isAdmin && (
                <select
                  value={activeView}
                  onChange={(e) => {
                    setActiveView(e.target.value);
                    setActiveMenu('Dashboard');
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
          ) : (
            /* If not logged in: Home Switcher */
            <div className="flex items-center gap-2 bg-[#18181B]/95 text-white border border-stone-700/80 backdrop-blur-md px-3 py-1.5 rounded-full shadow-2xl">
              <button
                onClick={() => setActiveView('landing')}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  activeView === 'landing' ? 'bg-amber-400 text-stone-950 shadow-sm' : 'text-stone-300 hover:text-white'
                }`}
              >
                Trang Chủ
              </button>
              <button
                onClick={() => setActiveView('login')}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  activeView === 'login' ? 'bg-amber-400 text-stone-950 shadow-sm' : 'text-stone-300 hover:text-white'
                }`}
              >
                Đăng Nhập
              </button>
            </div>
          )}
        </div>
      )}

      {/* 1. Trang Chủ (Landing Page) */}
      {activeView === 'landing' && (
        <LandingHomePage
          currentUser={currentUser}
          onNavigateToLogin={() => {
            if (currentUser) {
              setActiveView(currentUser.default_dashboard || 'housekeeping');
              setActiveMenu('Dashboard');
            } else {
              setActiveView('login');
            }
          }}
          onNavigateToRobotDisplay={() => setActiveView('robot_display')}
          onNavigateToLidarMap={() => setActiveView('admin_map')}
        />
      )}

      {/* 2. Giao diện Đăng Nhập (Login Page) */}
      {activeView === 'login' && (
        <LoginPage
          onLoginSuccess={handleLoginSuccess}
          onBackToHome={() => setActiveView('landing')}
        />
      )}

      {/* 3. Màn hình Robot AI & LiDAR Map */}
      {activeView === 'robot_display' && (
        <div className="w-full h-full relative">
          <RobotScreenPage onLogout={handleLogout} />
        </div>
      )}

      {activeView === 'admin_map' && (
        <div className="w-full h-full relative">
          <AdminLidarPage />
        </div>
      )}

      {/* Admin Command Portal (RoboConcierge V2.4.1) */}
      {activeView === 'admin_portal' && (
        <AdminPortal
          currentUser={currentUser}
          onLogout={handleLogout}
          onNotify={showNotification}
        />
      )}

      {/* 4. Bộ Dashboard Nghiệp Vụ Khách Sạn (Aurora OS) */}
      {isDashboardView && (
        <div className="w-full h-full flex overflow-hidden">
          {/* Left Sidebar */}
          <AuroraSidebar
            referenceLayout={usesReferenceLayout}
            activeMenu={activeMenu}
            onSelectMenu={(menu) => {
              setActiveMenu(menu);
              showNotification(`Đã chuyển mục: ${menu}`);
            }}
            currentUser={currentUser || { name: 'Elena Rossi', role: 'Online', avatar: null }}
            onLogout={handleLogout}
            onBackToHome={() => setActiveView('landing')}
            unreadNotifCount={unreadNotifCount}
          />

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#FAF8F5]">
            {/* Top Header with Interactive Notification Dropdown */}
            <AuroraHeader
              referenceLayout={usesReferenceLayout}
              hotelName={t('hotelName')}
              systemName="HCROBOT"
              subtitle={
                usesReferenceLayout
                  ? t('frontDeskSubtitle')
                  : `${currentUser?.department || 'Staff'} ${t('portalSubtitle')}`
              }
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
              onOpenNotificationsPage={() => setActiveMenu('Notifications')}
              onToggleRead={handleToggleNotificationRead}
              onMarkAllRead={handleMarkAllNotificationsRead}
              departmentName={currentUser?.department || 'Staff'}
            />

            {/* Dynamic View rendering based on activeMenu */}
            {activeMenu === 'Dashboard' && (
              <>
                {activeView === 'reception' && (
                  <ReceptionDashboard
                    currentUser={currentUser}
                    onNotify={showNotification}
                  />
                )}
                {activeView === 'room_service' && (
                  <RoomServiceDashboard
                    currentUser={currentUser}
                    onNotify={showNotification}
                  />
                )}
                {activeView === 'housekeeping' && (
                  <HousekeepingDashboard
                    currentUser={currentUser}
                    onNotify={showNotification}
                  />
                )}
                {activeView === 'bell_services' && (
                  <BellServicesDashboard
                    currentUser={currentUser}
                    onNotify={showNotification}
                  />
                )}
                {activeView === 'maintenance' && (
                  <MaintenanceDashboard
                    currentUser={currentUser}
                    onNotify={showNotification}
                  />
                )}
              </>
            )}

            {/* Requests Page (Role-Filtered) */}
            {activeMenu === 'Requests' && (
              <RequestsPage currentUser={currentUser} onNotify={showNotification} />
            )}

            {/* My Tasks Page (Role-Filtered) */}
            {activeMenu === 'My Tasks' && (
              <MyTasksPage currentUser={currentUser} onNotify={showNotification} />
            )}

            {/* History Page */}
            {activeMenu === 'History' && (
              <HistoryPage currentUser={currentUser} onNotify={showNotification} />
            )}

            {/* Notifications Page (Department-Filtered & Live Polled) */}
            {activeMenu === 'Notifications' && (
              <NotificationsPage
                currentUser={currentUser}
                notifications={notifications}
                onNotify={showNotification}
                onToggleRead={handleToggleNotificationRead}
                onMarkAllRead={handleMarkAllNotificationsRead}
                onDeleteNotification={handleDeleteNotification}
                onRefresh={loadNotifications}
              />
            )}

            {/* Profile Page */}
            {activeMenu === 'Profile' && (
              <ProfilePage
                currentUser={currentUser}
                onUpdateUser={setCurrentUser}
                onLogout={handleLogout}
                onNotify={showNotification}
              />
            )}
            {/* Default Dashboard Fallback if activeMenu is unrecognized */}
            {!['Dashboard', 'Requests', 'My Tasks', 'History', 'Notifications', 'Profile'].includes(activeMenu) && (
              <RequestsPage currentUser={currentUser} onNotify={showNotification} />
            )}
          </div>
        </div>
      )}

      {/* 5. Fallback Safety Render in case activeView is desynchronized */}
      {!['landing', 'login', 'robot_display', 'admin_map', 'admin_portal'].includes(activeView) && !isDashboardView && (
        <LandingHomePage
          currentUser={currentUser}
          onNavigateToLogin={() => {
            if (currentUser) {
              const target = normalizeLegacyView(
                currentUser.default_dashboard || currentUser.defaultDashboard || 'room_service',
                currentUser
              );
              setActiveView(target);
              setActiveMenu('Dashboard');
            } else {
              setActiveView('login');
            }
          }}
          onNavigateToRobotDisplay={() => setActiveView('robot_display')}
          onNavigateToLidarMap={() => setActiveView('admin_map')}
        />
      )}

      {/* Floating Toast Notification */}
      <ToastNotification message={toastMessage} onClose={() => setToastMessage(null)} />
    </div>
  );
}

export default App;
