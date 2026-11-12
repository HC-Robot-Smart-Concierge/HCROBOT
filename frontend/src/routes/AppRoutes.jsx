import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useAuth, resolveStaffDashboard, isRobotUser } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { ProtectedRoute } from './ProtectedRoute';
import { StaffLayout } from '../layouts/StaffLayout';

// Loading fallback spinner with smooth pulse
const PageLoadingFallback = () => (
  <div className="min-h-screen bg-palette-cream/40 flex items-center justify-center p-6">
    <div className="flex flex-col items-center gap-3">
      <div className="w-9 h-9 border-3 border-palette-charcoal/20 border-t-palette-charcoal rounded-full animate-spin" />
      <span className="text-xs font-mono font-medium text-palette-slate tracking-wide">
        Đang tải giao diện...
      </span>
    </div>
  </div>
);

// Public & Top-Level Pages (Lazy-loaded for optimal initial bundle size)
const LandingHomePage = lazy(() => import('../pages/home/LandingHomePage').then(m => ({ default: m.LandingHomePage })));
const LoginPage = lazy(() => import('../pages/auth/LoginPage').then(m => ({ default: m.LoginPage })));
const RobotScreenPage = lazy(() => import('../pages/robot/RobotScreenPage').then(m => ({ default: m.RobotScreenPage })));
const RobotFoodMenuScreen = lazy(() => import('../components/robot/RobotFoodMenuScreen').then(m => ({ default: m.RobotFoodMenuScreen })));
const AdminPortal = lazy(() => import('../pages/admin/AdminPortal').then(m => ({ default: m.AdminPortal })));
const AdminLidarPage = lazy(() => import('../pages/admin/AdminLidarPage').then(m => ({ default: m.AdminLidarPage })));
const GuestMapPage = lazy(() => import('../pages/guest/GuestMapPage').then(m => ({ default: m.GuestMapPage })));

// Staff Dashboard Pages (Lazy-loaded)
const ReceptionDashboard = lazy(() => import('../pages/dashboard/ReceptionDashboard').then(m => ({ default: m.ReceptionDashboard })));
const RoomServiceDashboard = lazy(() => import('../pages/dashboard/RoomServiceDashboard').then(m => ({ default: m.RoomServiceDashboard })));
const BellServicesDashboard = lazy(() => import('../pages/dashboard/BellServicesDashboard').then(m => ({ default: m.BellServicesDashboard })));
const MaintenanceDashboard = lazy(() => import('../pages/dashboard/MaintenanceDashboard').then(m => ({ default: m.MaintenanceDashboard })));
const KitchenDashboard = lazy(() => import('../pages/dashboard/KitchenDashboard').then(m => ({ default: m.KitchenDashboard })));
const ConciergeDashboard = lazy(() => import('../pages/dashboard/ConciergeDashboard').then(m => ({ default: m.ConciergeDashboard })));
const StaffOverviewDashboard = lazy(() => import('../pages/dashboard/StaffOverviewDashboard').then(m => ({ default: m.StaffOverviewDashboard })));

// Staff Sub-pages (Lazy-loaded)
const RequestsPage = lazy(() => import('../pages/staff/RequestsPage').then(m => ({ default: m.RequestsPage })));
const MyTasksPage = lazy(() => import('../pages/staff/MyTasksPage').then(m => ({ default: m.MyTasksPage })));
const KitchenMenuManagementPage = lazy(() => import('../pages/staff/KitchenMenuManagementPage').then(m => ({ default: m.KitchenMenuManagementPage })));
const RoomServiceMenuManagementPage = lazy(() => import('../pages/staff/RoomServiceMenuManagementPage').then(m => ({ default: m.RoomServiceMenuManagementPage })));
const HistoryPage = lazy(() => import('../pages/staff/HistoryPage').then(m => ({ default: m.HistoryPage })));
const NotificationsPage = lazy(() => import('../pages/staff/NotificationsPage').then(m => ({ default: m.NotificationsPage })));
const ProfilePage = lazy(() => import('../pages/staff/ProfilePage').then(m => ({ default: m.ProfilePage })));
const StaffSettingsPage = lazy(() => import('../pages/staff/StaffSettingsPage').then(m => ({ default: m.StaffSettingsPage })));

// Wrapper for Concierge subtabs
function ConciergeRouteWrapper() {
  const { currentUser } = useAuth();
  const { showNotification } = useNotifications();
  const [searchParams] = useSearchParams();
  const activeSubTab = searchParams.get('tab') || 'live_call';

  return (
    <ConciergeDashboard
      currentUser={currentUser}
      onNotify={showNotification}
      activeSubTab={activeSubTab}
    />
  );
}

// Staff index resolver
function StaffIndexRedirect() {
  const { currentUser, isAdmin, isRobot } = useAuth();
  if (isRobot) return <Navigate to="/robot" replace />;
  if (isAdmin) return <Navigate to="/admin/portal" replace />;
  const defaultDash = resolveStaffDashboard(currentUser).replace('_', '-');
  return <Navigate to={`/staff/${defaultDash}`} replace />;
}

export const AppRoutes = () => {
  const { currentUser, isAdmin, isRobot, login, logout, setCurrentUser } = useAuth();
  const {
    notifications,
    showNotification,
    handleToggleRead,
    handleMarkAllRead,
    loadNotifications,
  } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();

  // Dynamic PWA Manifest switcher: Chuyển giữa manifest-login.json (Nhân viên) và manifest.json (Robot)
  React.useEffect(() => {
    try {
      const p = location.pathname;
      const s = location.search;
      const isStaffOrLogin = p.startsWith('/login') || p.startsWith('/staff') || p.startsWith('/admin');
      const isRobot = p.startsWith('/robot') || s.includes('robot_display');

      const manifestHref = (isStaffOrLogin && !isRobot) ? '/manifest-login.json' : '/manifest.json';
      const appTitle = (isStaffOrLogin && !isRobot) ? 'HC Staff' : 'HCRobot';

      const manifestEl = document.getElementById('app-manifest') || document.querySelector('link[rel="manifest"]');
      if (manifestEl && manifestEl.getAttribute('href') !== manifestHref) {
        manifestEl.setAttribute('href', manifestHref);
      }

      const titleEl = document.getElementById('app-title') || document.querySelector('meta[name="apple-mobile-web-app-title"]');
      if (titleEl && titleEl.getAttribute('content') !== appTitle) {
        titleEl.setAttribute('content', appTitle);
      }
    } catch (e) {
      console.warn('Failed to switch dynamic manifest', e);
    }
  }, [location.pathname, location.search]);

  // Handle legacy query params e.g. ?view=robot_display & QR guest map alternative flows
  const savedQrSearch = (() => {
    try {
      return typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('aurora_qr_search') || '' : '';
    } catch {
      return '';
    }
  })();
  const queryParams = new URLSearchParams(location.search || savedQrSearch);
  const requestedView = queryParams.get('view');
  const hasGuestMapTicket = Boolean(
    queryParams.get('t') || queryParams.get('token') || queryParams.get('dest')
  );
  const isGuestMapPath =
    location.pathname === '/map.html' ||
    location.pathname.endsWith('/map.html') ||
    location.pathname === '/map' ||
    location.pathname === '/guest/map';

  if (
    requestedView === 'guest_map' ||
    isGuestMapPath ||
    (location.pathname === '/' && hasGuestMapTicket)
  ) {
    return (
      <Suspense fallback={<PageLoadingFallback />}>
        <GuestMapPage />
      </Suspense>
    );
  }
  if (requestedView === 'robot_display') {
    return <Navigate to="/robot" replace />;
  }
  if (requestedView === 'food_menu' || requestedView === 'order_food') {
    return <Navigate to="/food-menu" replace />;
  }

  const handleLoginSuccess = (user, targetDashboard) => {
    const res = login(user, targetDashboard);
    if (!res.success) {
      showNotification(res.message);
      return;
    }
    showNotification(`Đăng nhập thành công! Vai trò: ${user.role || user.department}`);
    if (res.resolvedDashboard === 'robot_display' || isRobotUser(user)) {
      navigate('/robot');
    } else if (res.resolvedDashboard === 'admin_portal') {
      navigate('/admin/portal');
    } else {
      const cleanDash = res.resolvedDashboard.replace('_', '-');
      navigate(`/staff/${cleanDash}`);
    }
  };

  const handleLogout = async () => {
    await logout();
    showNotification('Đã đăng xuất khỏi phiên làm việc.');
    navigate('/');
  };

  return (
    <Suspense fallback={<PageLoadingFallback />}>
      <Routes>
      {/* 1. Landing Page */}
      <Route
        path="/"
        element={
          <LandingHomePage
            currentUser={currentUser}
            isRobot={isRobot}
            onLoginSuccess={handleLoginSuccess}
            onNavigateToLogin={() => {
              if (currentUser) {
                if (isRobot) {
                  navigate('/robot');
                } else if (isAdmin) {
                  navigate('/admin/portal');
                } else {
                  const dash = resolveStaffDashboard(currentUser).replace('_', '-');
                  navigate(`/staff/${dash}`);
                }
              } else {
                navigate('/login');
              }
            }}
            onNavigateToRobotDisplay={() => navigate('/robot')}
            onNavigateToLidarMap={() => {
              if (isAdmin) {
                navigate('/admin/map');
              } else {
                navigate('/login');
                showNotification('Vui lòng đăng nhập quyền Quản trị viên để truy cập LiDAR Map.');
              }
            }}
          />
        }
      />

      {/* 2. Login Page */}
      <Route
        path="/login"
        element={
          currentUser ? (
            <Navigate
              to={
                isRobot
                  ? '/robot'
                  : isAdmin
                  ? '/admin/portal'
                  : `/staff/${resolveStaffDashboard(currentUser).replace('_', '-')}`
              }
              replace
            />
          ) : (
            <LoginPage
              onLoginSuccess={handleLoginSuccess}
              onBackToHome={() => navigate('/')}
            />
          )
        }
      />

      {/* 3. Robot Screens & Guest QR Wayfinding Alternative Routes */}
      <Route
        path="/robot"
        element={<RobotScreenPage onLogout={handleLogout} />}
      />
      <Route
        path="/food-menu"
        element={<RobotFoodMenuScreen onClose={() => navigate('/robot')} />}
      />
      <Route path="/map.html" element={<GuestMapPage />} />
      <Route path="/map" element={<GuestMapPage />} />
      <Route path="/guest/map" element={<GuestMapPage />} />


      {/* 4. Admin Command Portal & LiDAR */}
      <Route
        path="/admin/portal"
        element={
          <ProtectedRoute requireAdmin={true}>
            <AdminPortal
              currentUser={currentUser}
              onLogout={handleLogout}
              onNotify={showNotification}
            />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/map"
        element={
          <ProtectedRoute requireAdmin={true}>
            <AdminLidarPage />
          </ProtectedRoute>
        }
      />

      {/* 5. Protected Staff Operations Layout */}
      <Route
        path="/staff"
        element={
          <ProtectedRoute>
            <StaffLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<StaffIndexRedirect />} />
        <Route path="robot-display" element={<Navigate to="/robot" replace />} />
        <Route path="robot" element={<Navigate to="/robot" replace />} />
        <Route
          path="reception"
          element={
            <ReceptionDashboard
              currentUser={currentUser}
              onNotify={showNotification}
              onNavigate={(menu) => navigate(`/staff/${menu.toLowerCase().replace('_', '-')}`)}
            />
          }
        />
        <Route
          path="room-service"
          element={
            <RoomServiceDashboard
              currentUser={currentUser}
              onNotify={showNotification}
            />
          }
        />
        <Route
          path="housekeeping"
          element={<Navigate to="/staff/room-service" replace />}
        />
        <Route path="settings" element={<StaffSettingsPage portal={resolveStaffDashboard(currentUser)} />} />
        <Route
          path="bell-services"
          element={
            <BellServicesDashboard
              currentUser={currentUser}
              onNotify={showNotification}
            />
          }
        />
        <Route
          path="maintenance"
          element={
            <MaintenanceDashboard
              currentUser={currentUser}
              onNotify={showNotification}
            />
          }
        />
        <Route
          path="kitchen"
          element={
            <KitchenDashboard
              currentUser={currentUser}
              onNotify={showNotification}
            />
          }
        />
        <Route
          path="restaurant"
          element={<Navigate to="/staff/kitchen" replace />}
        />
        <Route
          path="concierge"
          element={<ConciergeRouteWrapper />}
        />
        <Route
          path="overview"
          element={
            <StaffOverviewDashboard
              currentUser={currentUser}
              onNotify={showNotification}
            />
          }
        />

        {/* Staff Sidebar Sub-pages */}
        <Route
          path="requests"
          element={
            <RequestsPage
              currentUser={currentUser}
              onNotify={showNotification}
            />
          }
        />
        <Route
          path="my-tasks"
          element={
            <MyTasksPage
              currentUser={currentUser}
              onNotify={showNotification}
            />
          }
        />
        <Route
          path="kitchen-menu"
          element={
            <KitchenMenuManagementPage
              currentUser={currentUser}
              onNotify={showNotification}
              onNavigate={(menu) => navigate(`/staff/${menu.toLowerCase().replace('_', '-')}`)}
            />
          }
        />
        <Route
          path="room-service-menu"
          element={
            <RoomServiceMenuManagementPage
              currentUser={currentUser}
              onNotify={showNotification}
            />
          }
        />
        <Route
          path="history"
          element={
            <HistoryPage
              currentUser={currentUser}
              onNotify={showNotification}
            />
          }
        />
        <Route
          path="notifications"
          element={
            <NotificationsPage
              currentUser={currentUser}
              notifications={notifications}
              onNotify={showNotification}
              onToggleRead={handleToggleRead}
              onMarkAllRead={handleMarkAllRead}
              onRefresh={loadNotifications}
            />
          }
        />
        <Route
          path="profile"
          element={
            <ProfilePage
              currentUser={currentUser}
              onNotify={showNotification}
              onUserUpdated={setCurrentUser}
              onUpdateUser={setCurrentUser}
              onLogout={handleLogout}
            />
          }
        />
      </Route>

      {/* Fallback Catch-All Route */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </Suspense>
  );
};
