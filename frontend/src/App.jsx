import React, { useState, useEffect } from 'react';
import { AuroraSidebar } from './components/dashboard/AuroraSidebar';
import { AuroraHeader } from './components/dashboard/AuroraHeader';
import { ToastNotification } from './components/dashboard/ToastNotification';

// Pages
import { LandingHomePage } from './pages/home/LandingHomePage';
import { LoginPage } from './pages/auth/LoginPage';
import { RoomServiceDashboard } from './pages/dashboard/RoomServiceDashboard';
import { HousekeepingDashboard } from './pages/dashboard/HousekeepingDashboard';
import { BellServicesDashboard } from './pages/dashboard/BellServicesDashboard';
import { MaintenanceDashboard } from './pages/dashboard/MaintenanceDashboard';
import { HousekeepingManagerDashboard } from './pages/dashboard/HousekeepingManagerDashboard';
import { RobotScreenPage } from './pages/robot/RobotScreenPage';
import { AdminLidarPage } from './pages/admin/AdminLidarPage';

// 5 Sidebar Staff Pages
import { RequestsPage } from './pages/staff/RequestsPage';
import { MyTasksPage } from './pages/staff/MyTasksPage';
import { HistoryPage } from './pages/staff/HistoryPage';
import { NotificationsPage } from './pages/staff/NotificationsPage';
import { ProfilePage } from './pages/staff/ProfilePage';

// Auth Api
import { getStoredUser, logoutUser } from './services/authApi';

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

export function App() {
  // activeView:
  // 'landing' | 'login' | 'room_service' | 'housekeeping' | 'bell_services' | 'maintenance' | 'manager_hub' | 'robot_display' | 'admin_map'
  const [currentUser, setCurrentUser] = useState(() => getStoredUser());

  const [activeView, setActiveView] = useState(() => {
    const user = getStoredUser();
    if (user) {
      const savedView = localStorage.getItem('aurora_active_view');
      const targetRoleDashboard = user.default_dashboard || user.defaultDashboard || 'room_service';
      const allowed = user.allowedDashboards || [targetRoleDashboard];
      if (
        savedView &&
        (allowed.includes(savedView) || ['landing', 'robot_display', 'admin_map'].includes(savedView))
      ) {
        return savedView;
      }
      return targetRoleDashboard;
    }
    return localStorage.getItem('aurora_active_view') || 'landing';
  });

  const [activeMenu, setActiveMenu] = useState(() => {
    return localStorage.getItem('aurora_active_menu') || 'Dashboard';
  });

  const [language, setLanguage] = useState('EN');
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
    if (!currentUser) {
      // If logged out, only allow landing, login, robot_display, admin_map
      if (!['landing', 'login', 'robot_display', 'admin_map'].includes(activeView)) {
        setActiveView('landing');
      }
      return;
    }

    const isAdmin = currentUser.username === 'admin' || currentUser.role === 'Operations Admin';
    if (isAdmin) return; // Admin has universal access

    const targetRoleDashboard = currentUser.default_dashboard || currentUser.defaultDashboard || 'room_service';
    const allowed = currentUser.allowedDashboards || [targetRoleDashboard];

    // If currently on login page while already authenticated, redirect to staff dashboard
    if (activeView === 'login') {
      setActiveView(targetRoleDashboard);
      return;
    }

    // If activeView is a dashboard view and is not allowed for this staff
    const isDashboard = [
      'room_service',
      'housekeeping',
      'bell_services',
      'maintenance',
      'manager_hub',
    ].includes(activeView);

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

  // Login Success Callback -> Auto-Redirect to role dashboard (1 to 5)
  const handleLoginSuccess = (user, targetDashboard) => {
    setCurrentUser(user);
    const destination = targetDashboard || user.default_dashboard || user.defaultDashboard || 'room_service';
    setActiveView(destination);
    localStorage.setItem('aurora_active_view', destination);
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

  const isManagerMode = activeView === 'manager_hub';
  const isDashboardView = [
    'room_service',
    'housekeeping',
    'bell_services',
    'maintenance',
    'manager_hub',
  ].includes(activeView);

  const isAdmin = currentUser?.username === 'admin' || currentUser?.role === 'Operations Admin';

  const viewOptions = [
    { id: 'landing', label: '🏠 Trang Chủ (Landing)' },
    { id: 'login', label: '🔐 Đăng Nhập (Login)' },
    { id: 'room_service', label: '1. Room Service (Staff)' },
    { id: 'housekeeping', label: '2. Housekeeping (Staff)' },
    { id: 'bell_services', label: '3. Bell Services (Staff)' },
    { id: 'maintenance', label: '4. Maintenance (Staff)' },
    { id: 'manager_hub', label: '5. Management Hub (GM)' },
    { id: 'robot_display', label: '🤖 Màn Hình Robot' },
    { id: 'admin_map', label: '🗺️ LiDAR SLAM Map' },
  ];

  return (
    <div className="w-full h-screen overflow-hidden bg-[#FAF8F5] text-[#1A1917] flex flex-col font-sans select-none relative">
      {/* Top Floating Header Pill (Only on Dashboard, Robot Display & LiDAR Map) */}
      {activeView !== 'landing' && activeView !== 'login' && activeView !== 'housekeeping' && (
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

      {/* 4. Bộ 5 Dashboard Nghiệp Vụ Khách Sạn (Aurora OS) */}
      {isDashboardView && (
        <div className="w-full h-full flex overflow-hidden">
          {/* Left Sidebar */}
          <AuroraSidebar
            variant={isManagerMode ? 'manager' : 'staff'}
            referenceLayout={activeView === 'housekeeping'}
            activeMenu={activeMenu}
            onSelectMenu={(menu) => {
              setActiveMenu(menu);
              showNotification(`Đã chuyển mục: ${menu}`);
            }}
            currentUser={
              currentUser ||
              (isManagerMode
                ? {
                    name: 'Marcus Vane',
                    role: 'General Manager',
                    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
                  }
                : { name: 'Elena Rossi', role: 'Online', avatar: null })
            }
            onLogout={handleLogout}
            onBackToHome={() => setActiveView('landing')}
          />

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#FAF8F5]">
            {/* Top Header */}
            <AuroraHeader
              referenceLayout={activeView === 'housekeeping'}
              hotelName="Aurora Grand Hotel"
              systemName={isManagerMode ? 'HCROBOT ADMIN' : 'HCROBOT'}
              subtitle={
                activeView === 'housekeeping'
                  ? 'Front Desk Operations'
                  : isManagerMode
                  ? 'Executive Management Hub • General Manager'
                  : `${currentUser?.department || 'Staff'} Operations Portal`
              }
              language={language}
              onToggleLanguage={() => {
                const nextLang = language === 'EN' ? 'VI' : 'EN';
                setLanguage(nextLang);
                showNotification(`Đã chuyển ngôn ngữ sang ${nextLang}`);
              }}
              managerUser={
                isManagerMode
                  ? currentUser || {
                      name: 'Marcus Vane',
                      role: 'General Manager',
                      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
                    }
                  : null
              }
            />

            {/* Dynamic View rendering based on activeMenu */}
            {activeMenu === 'Dashboard' && (
              <>
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
                {activeView === 'manager_hub' && (
                  <HousekeepingManagerDashboard
                    currentUser={currentUser}
                    onNotify={showNotification}
                  />
                )}
              </>
            )}

            {/* Requests Page (Role-Filtered) */}
            {(activeMenu === 'Requests' || activeMenu === 'Staff Management') && (
              <RequestsPage currentUser={currentUser} onNotify={showNotification} />
            )}

            {/* My Tasks Page (Role-Filtered) */}
            {activeMenu === 'My Tasks' && (
              <MyTasksPage currentUser={currentUser} onNotify={showNotification} />
            )}

            {/* History Page */}
            {(activeMenu === 'History' ||
              activeMenu === 'Department Overview' ||
              activeMenu === 'Analytics') && (
              <HistoryPage currentUser={currentUser} onNotify={showNotification} />
            )}

            {/* Notifications Page */}
            {activeMenu === 'Notifications' && (
              <NotificationsPage onNotify={showNotification} />
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
          </div>
        </div>
      )}

      {/* 5. Fallback Safety Render in case activeView is desynchronized */}
      {!['landing', 'login', 'robot_display', 'admin_map'].includes(activeView) && !isDashboardView && (
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

      {/* Floating Toast Notification */}
      <ToastNotification message={toastMessage} onClose={() => setToastMessage(null)} />
    </div>
  );
}

export default App;
