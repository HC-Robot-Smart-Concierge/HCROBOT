import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AuroraSidebar } from './components/dashboard/AuroraSidebar';
import { AuroraHeader } from './components/dashboard/AuroraHeader';
import { MobileBottomNav } from './components/common/MobileBottomNav';
import { ToastNotification } from './components/dashboard/ToastNotification';

// Pages
import { LandingHomePage } from './pages/home/LandingHomePage';
import { LoginPage } from './pages/auth/LoginPage';
import { ReceptionDashboard } from './pages/dashboard/ReceptionDashboard';
import { RoomServiceDashboard } from './pages/dashboard/RoomServiceDashboard';
import { HousekeepingDashboard } from './pages/dashboard/HousekeepingDashboard';
import { BellServicesDashboard } from './pages/dashboard/BellServicesDashboard';
import { MaintenanceDashboard } from './pages/dashboard/MaintenanceDashboard';
import { RestaurantDashboard } from './pages/dashboard/RestaurantDashboard';
import { ConciergeDashboard } from './pages/dashboard/ConciergeDashboard';
import { StaffOverviewDashboard } from './pages/dashboard/StaffOverviewDashboard';
import { RobotScreenPage } from './pages/robot/RobotScreenPage';
import { AdminLidarPage } from './pages/admin/AdminLidarPage';
import { AdminPortal } from './pages/admin/AdminPortal';
import { FeedbackModal } from './components/common/FeedbackModal';
import { NotificationCenterModal } from './components/common/NotificationCenterModal';
import { QuickRequestModal } from './components/common/QuickRequestModal';
import { UserProfileModal } from './components/common/UserProfileModal';

// 4 Sidebar Staff Pages
import { RequestsPage } from './pages/staff/RequestsPage';
import { HistoryPage } from './pages/staff/HistoryPage';
import { NotificationsPage } from './pages/staff/NotificationsPage';
import { ProfilePage } from './pages/staff/ProfilePage';
import { useLanguage } from './context/LanguageContext';
import { useNotificationWebSocket } from './hooks/useNotificationWebSocket';

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
  Bell,
  PlusCircle,
  User,
} from 'lucide-react';

const STAFF_DASHBOARDS = [
  'reception',
  'room_service',
  'housekeeping',
  'bell_services',
  'maintenance',
  'restaurant',
  'concierge',
];

const isRobotUser = (user) => {
  if (!user) return false;
  const username = String(user.username || '').toLowerCase();
  const role = String(user.role || '').toLowerCase();
  const defaultDash = String(user.default_dashboard || user.defaultDashboard || '').toLowerCase();
  return (
    username === 'robot_01' ||
    username.startsWith('robot') ||
    role.includes('robot') ||
    defaultDash === 'robot_display'
  );
};

const isAdminUser = (user) => {
  if (!user) return false;
  if (isRobotUser(user)) return false; // Tài khoản Robot Kiosk không phải Quản trị viên
  const username = String(user.username || '').toLowerCase();
  const role = String(user.role || '').toLowerCase();
  const dept = String(user.department || '').toLowerCase();
  return (
    username === 'admin' ||
    role.includes('admin') ||
    (dept === 'executive' && !role.includes('robot')) ||
    dept === 'operations'
  );
};

const normalizeLegacyView = (view, user) => {
  if (isRobotUser(user)) {
    return 'robot_display';
  }
  if (isAdminUser(user)) {
    if (!view || view === 'manager_hub' || view === 'landing' || STAFF_DASHBOARDS.includes(view)) {
      return 'admin_portal';
    }
    return view;
  }
  if (view === 'robot_display') {
    return 'robot_display';
  }
  if (!view || view === 'manager_hub' || view === 'admin_portal' || view === 'admin_map') {
    return user ? (user.default_dashboard || 'room_service') : 'landing';
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
  if (['restaurant', 'nhahang', 'nha_hang'].includes(clean)) {
    return 'restaurant';
  }
  if (['taxi', 'datxe', 'dat_xe', 'transport', 'transportation'].includes(clean)) {
    return 'concierge';
  }
  if (['concierge', 'livecall', 'live_call', 'troly'].includes(clean)) {
    return 'concierge';
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
    const requestedView = new URLSearchParams(window.location.search).get('view');
    if (requestedView === 'robot_display') return 'robot_display';

    const user = getStoredUser();
    if (user) {
      if (isRobotUser(user)) {
        return 'robot_display';
      }

      if (isAdminUser(user)) {
        // For admin: if URL specifically requested a view, allow it; otherwise ALWAYS enter Admin Dashboard (admin_portal)
        if (requestedView && ['admin_portal', 'admin_map', 'robot_display'].includes(requestedView)) {
          return requestedView;
        }
        return 'admin_portal';
      }

      // Regular staff
      const savedView = localStorage.getItem('aurora_active_view');
      const targetRoleDashboard = normalizeLegacyView(
        user.default_dashboard || user.defaultDashboard || 'room_service',
        user
      );
      const allowed = user.allowedDashboards || [targetRoleDashboard];
      const normalizedSavedView = normalizeLegacyView(savedView, user);
      if (normalizedSavedView && allowed.includes(normalizedSavedView)) {
        return normalizedSavedView;
      }
      return targetRoleDashboard;
    }

    // Guest / Not logged in
    const savedView = localStorage.getItem('aurora_active_view');
    if (savedView === 'login') return 'login';
    return 'landing';
  });

  const [activeMenu, setActiveMenu] = useState(() => {
    return localStorage.getItem('aurora_active_menu') || 'Dashboard';
  });

  const { language, toggleLanguage, t } = useLanguage();
  const [toastMessage, setToastMessage] = useState(null);
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [showQuickRequestModal, setShowQuickRequestModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

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

  // Tab History chỉ dành riêng cho bộ phận Concierge
  useEffect(() => {
    if (activeMenu === 'History') {
      const deptLower = (currentUser?.department || '').toLowerCase();
      const roleLower = (currentUser?.role || '').toLowerCase();
      const defaultDashLower = (currentUser?.default_dashboard || currentUser?.defaultDashboard || '').toLowerCase();
      const isConcierge =
        activeView === 'concierge' ||
        deptLower.includes('concierge') ||
        roleLower.includes('concierge') ||
        defaultDashLower === 'concierge';

      if (!isConcierge) {
        setActiveMenu('Dashboard');
      }
    }
  }, [activeMenu, activeView, currentUser]);

  // STRICT PROTECTED ROUTE GUARD
  useEffect(() => {
    // A. User not logged in (Guest)
    if (!currentUser) {
      const isPublicRoute = ['landing', 'login', 'robot_display'].includes(activeView);
      if (!isPublicRoute) {
        // Any attempt to view admin or staff dashboards requires login
        setActiveView('login');
        localStorage.setItem('aurora_active_view', 'login');
        showNotification('Vui lòng đăng nhập để truy cập trang này.');
      }
      return;
    }

    // B. Legacy manager account deprecation
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

    // C0. Logged in as Robot Kiosk -> Chuyển thẳng vào Robot Screen
    if (isRobotUser(currentUser)) {
      if (activeView !== 'robot_display') {
        setActiveView('robot_display');
        localStorage.setItem('aurora_active_view', 'robot_display');
      }
      return;
    }

    // C. Logged in as Admin
    if (isAdminUser(currentUser)) {
      // If admin visits login or landing or old manager_hub, route to admin_portal
      if (activeView === 'login' || activeView === 'landing' || activeView === 'manager_hub') {
        setActiveView('admin_portal');
        localStorage.setItem('aurora_active_view', 'admin_portal');
      }
      return; // Admin has full access to all admin tools
    }

    // D. Logged in as Staff (Protected staff dashboards)
    const targetRoleDashboard = normalizeLegacyView(
      currentUser.default_dashboard || currentUser.defaultDashboard || 'room_service',
      currentUser
    );
    const allowed = currentUser.allowedDashboards || [targetRoleDashboard];

    // Staff CANNOT access Admin Portal or Admin LiDAR Map
    if (activeView === 'admin_portal' || activeView === 'admin_map') {
      setActiveView(targetRoleDashboard);
      localStorage.setItem('aurora_active_view', targetRoleDashboard);
      showNotification('Bạn không có quyền truy cập khu vực Quản trị viên (Admin)!');
      return;
    }

    // If staff visits login or landing or manager_hub, route to their assigned dashboard
    if (activeView === 'login' || activeView === 'landing' || activeView === 'manager_hub') {
      setActiveView(targetRoleDashboard);
      localStorage.setItem('aurora_active_view', targetRoleDashboard);
      return;
    }

    // If staff attempts to navigate to another staff dashboard they don't have permission for
    const isDashboard = STAFF_DASHBOARDS.includes(activeView);
    if (isDashboard && !allowed.includes(activeView)) {
      setActiveView(targetRoleDashboard);
      localStorage.setItem('aurora_active_view', targetRoleDashboard);
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
  // Department Notifications State & Real-Time WebSocket
  // ---------------------------------------------------------
  const [notifications, setNotifications] = useState([]);
  const seenNotificationIdsRef = useRef(new Set());
  const isInitialNotifLoadRef = useRef(true);

  const activeDepartment = currentUser
    ? (isAdminUser(currentUser) ? 'All' : (currentUser.department || 'Staff'))
    : 'All';

  // Kết nối WebSocket Real-time Hub (< 30ms latency)
  useNotificationWebSocket({
    department: activeDepartment,
    enabled: !!currentUser,
    onNotificationReceived: useCallback((newNotif) => {
      if (!newNotif || !newNotif.id) return;
      if (seenNotificationIdsRef.current.has(newNotif.id)) return;
      seenNotificationIdsRef.current.add(newNotif.id);

      // Thêm thông báo mới nhất ngay lập tức vào đầu danh sách (Real-time 0ms)
      setNotifications((prev) => [newNotif, ...prev.filter((n) => n.id !== newNotif.id)]);
      showNotification(`🔔 [${newNotif.department}] ${newNotif.title}`);
    }, []),
  });

  const loadNotifications = useCallback(async () => {
    if (!currentUser) return;
    const dept = isAdminUser(currentUser) ? 'All' : (currentUser.department || 'Staff');
    const data = await fetchNotifications(dept);
    if (Array.isArray(data)) {
      // Check for incoming new unread notifications to alert the staff (fallback)
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
    // Giãn khoảng cách polling xuống 30s làm fallback dự phòng khi đã có WebSocket
    const interval = setInterval(loadNotifications, 30000);
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
    let resolvedDashboard;
    if (isRobotUser(user)) {
      resolvedDashboard = 'robot_display';
    } else if (isAdminUser(user)) {
      resolvedDashboard = 'admin_portal';
    } else {
      resolvedDashboard = normalizeLegacyView(
        targetDashboard || user.default_dashboard || user.defaultDashboard || 'room_service',
        user
      );
    }
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
    'restaurant',
    'concierge',
  ].includes(activeView);

  const isAdmin = isAdminUser(currentUser);

  const viewOptions = [
    { id: 'admin_portal', label: 'Admin Command Portal' },
    { id: 'landing', label: 'Trang Chu (Landing)' },
    { id: 'reception', label: '0. Reception (Staff)' },
    { id: 'room_service', label: '1. Room Service (Staff)' },
    { id: 'housekeeping', label: '2. Housekeeping (Staff)' },
    { id: 'bell_services', label: '3. Bell Services (Staff)' },
    { id: 'maintenance', label: '4. Maintenance (Staff)' },
    { id: 'restaurant', label: '5. Restaurant (Staff)' },
    { id: 'concierge', label: '6. Concierge & Transport (Staff)' },
    { id: 'robot_display', label: 'Man Hinh Robot' },
    { id: 'admin_map', label: 'LiDAR SLAM Map' },
  ];

  return (
    <div className="w-full h-screen overflow-hidden bg-[#FAF8F5] text-[#1A1917] flex flex-col font-sans select-none relative">
      {/* Top Floating Header Pill (Only on Staff Dashboards & LiDAR Map) */}
      {activeView !== 'landing' && activeView !== 'login' && activeView !== 'admin_portal' && activeView !== 'robot_display' && !usesReferenceLayout && (
        <div className="absolute top-2.5 right-6 z-50 flex items-center gap-2">
          {/* If logged in as staff: Strict Role Badge & Action Tools */}
          {currentUser ? (
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

              {/* Nút Tạo yêu cầu nhanh */}
              <button
                onClick={() => setShowQuickRequestModal(true)}
                title="Tạo yêu cầu dịch vụ nhanh"
                className="p-1 rounded-full text-stone-300 hover:text-white hover:bg-stone-800 transition cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
              </button>

              {/* Nút Chuông thông báo kèm badge */}
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
              if (isAdminUser(currentUser)) {
                setActiveView('admin_portal');
              } else {
                setActiveView(currentUser.default_dashboard || 'room_service');
              }
              setActiveMenu('Dashboard');
            } else {
              setActiveView('login');
            }
          }}
          onNavigateToRobotDisplay={() => setActiveView('robot_display')}
          onNavigateToLidarMap={() => {
            if (isAdminUser(currentUser)) {
              setActiveView('admin_map');
            } else {
              setActiveView('login');
              showNotification('Vui lòng đăng nhập quyền Quản trị viên để truy cập LiDAR Map.');
            }
          }}
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

      {/* 4. Bộ Dashboard Nghiệp Vụ Khách Sạn (Aurora OS PWA Mobile) */}
      {isDashboardView && (
        <div className="w-full h-full flex flex-col md:flex-row overflow-hidden relative">
          {/* Left Sidebar (Hidden on mobile screens < 768px) */}
          <div className="hidden md:flex h-full shrink-0">
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
              activeView={activeView}
            />
          </div>

          {/* Main Content Area (With bottom padding pb-16 on mobile for bottom nav) */}
          <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#FAF8F5] pb-16 md:pb-0">
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
              activeView === 'restaurant' ? (
                <RestaurantDashboard currentUser={currentUser} onNotify={showNotification} />
              ) : activeView === 'concierge' || activeView === 'taxi' ? (
                <ConciergeDashboard currentUser={currentUser} onNotify={showNotification} />
              ) : (
                <StaffOverviewDashboard
                  currentUser={currentUser}
                  onNotify={showNotification}
                />
              )
            )}

            {/* Requests Page (Role-Filtered) */}
            {activeMenu === 'Requests' && (
              <RequestsPage currentUser={currentUser} onNotify={showNotification} />
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
            {!['Dashboard', 'Requests', 'History', 'Notifications', 'Profile'].includes(activeMenu) && (
              <RequestsPage currentUser={currentUser} onNotify={showNotification} />
            )}
          </div>

          {/* Horizontal Mobile Bottom Navigation Bar (Visible only on mobile screens < 768px) */}
          <MobileBottomNav
            activeMenu={activeMenu}
            onSelectMenu={(menu) => {
              setActiveMenu(menu);
              showNotification(`Đã chuyển mục: ${menu}`);
            }}
            unreadNotifCount={unreadNotifCount}
            currentUser={currentUser}
            activeView={activeView}
          />
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

      {/* 6. System Modals (Notification Center, Quick Request, Profile & Password) */}
      <NotificationCenterModal
        isOpen={showNotifModal}
        onClose={() => setShowNotifModal(false)}
        currentDepartment={currentUser?.department || 'All'}
      />

      <QuickRequestModal
        isOpen={showQuickRequestModal}
        onClose={() => setShowQuickRequestModal(false)}
        onCreated={(res) => {
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
}

export default App;
