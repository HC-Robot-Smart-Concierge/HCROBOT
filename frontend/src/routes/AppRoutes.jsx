import React from 'react';
import { Routes, Route, Navigate, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { ProtectedRoute } from './ProtectedRoute';
import { StaffLayout } from '../layouts/StaffLayout';

// Public & Top-Level Pages
import { LandingHomePage } from '../pages/home/LandingHomePage';
import { LoginPage } from '../pages/auth/LoginPage';
import { RobotScreenPage } from '../pages/robot/RobotScreenPage';
import { RobotFoodMenuScreen } from '../components/robot/RobotFoodMenuScreen';
import { AdminPortal } from '../pages/admin/AdminPortal';
import { AdminLidarPage } from '../pages/admin/AdminLidarPage';

// Staff Dashboard Pages
import { ReceptionDashboard } from '../pages/dashboard/ReceptionDashboard';
import { RoomServiceDashboard } from '../pages/dashboard/RoomServiceDashboard';
import { HousekeepingDashboard } from '../pages/dashboard/HousekeepingDashboard';
import { BellServicesDashboard } from '../pages/dashboard/BellServicesDashboard';
import { MaintenanceDashboard } from '../pages/dashboard/MaintenanceDashboard';
import { KitchenDashboard } from '../pages/dashboard/KitchenDashboard';
import { ConciergeDashboard } from '../pages/dashboard/ConciergeDashboard';
import { StaffOverviewDashboard } from '../pages/dashboard/StaffOverviewDashboard';

// Staff Sub-pages
import { RequestsPage } from '../pages/staff/RequestsPage';
import { MyTasksPage } from '../pages/staff/MyTasksPage';
import { KitchenMenuManagementPage } from '../pages/staff/KitchenMenuManagementPage';
import { HistoryPage } from '../pages/staff/HistoryPage';
import { NotificationsPage } from '../pages/staff/NotificationsPage';
import { ProfilePage } from '../pages/staff/ProfilePage';

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
  const { currentUser, isAdmin } = useAuth();
  if (isAdmin) return <Navigate to="/admin/portal" replace />;
  const defaultDash = (currentUser?.default_dashboard || currentUser?.defaultDashboard || 'room_service')
    .toLowerCase()
    .replace('_', '-');
  return <Navigate to={`/staff/${defaultDash}`} replace />;
}

export const AppRoutes = () => {
  const { currentUser, isAdmin, login, logout, setCurrentUser } = useAuth();
  const { showNotification } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();

  // Handle legacy query params e.g. ?view=robot_display
  const queryParams = new URLSearchParams(location.search);
  const requestedView = queryParams.get('view');
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
    if (res.resolvedDashboard === 'robot_display') {
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
    <Routes>
      {/* 1. Landing Page */}
      <Route
        path="/"
        element={
          <LandingHomePage
            currentUser={currentUser}
            onNavigateToLogin={() => {
              if (currentUser) {
                if (isAdmin) {
                  navigate('/admin/portal');
                } else {
                  const dash = (currentUser.default_dashboard || 'room-service').replace('_', '-');
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
                isAdmin
                  ? '/admin/portal'
                  : `/staff/${(currentUser.default_dashboard || 'room-service').replace('_', '-')}`
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

      {/* 3. Robot Screens */}
      <Route
        path="/robot"
        element={<RobotScreenPage onLogout={handleLogout} />}
      />
      <Route
        path="/food-menu"
        element={<RobotFoodMenuScreen onClose={() => navigate('/robot')} />}
      />

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
          element={
            <HousekeepingDashboard
              currentUser={currentUser}
              onNotify={showNotification}
            />
          }
        />
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
              onNotify={showNotification}
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
            />
          }
        />
      </Route>

      {/* Fallback Catch-All Route */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
