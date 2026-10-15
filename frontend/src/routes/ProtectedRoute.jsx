import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth, resolveStaffDashboard } from '../context/AuthContext';

export const ProtectedRoute = ({ children, requireAdmin = false }) => {
  const { currentUser, isLoading, isAdmin, isRobot } = useAuth();

  if (isLoading) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-[#FAF8F5]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-stone-500 font-semibold tracking-wider uppercase">
            Đang tải dữ liệu phiên làm việc...
          </span>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (isRobot) {
    return <Navigate to="/robot" replace />;
  }

  if (requireAdmin && !isAdmin) {
    const dash = resolveStaffDashboard(currentUser).replace('_', '-');
    return <Navigate to={`/staff/${dash}`} replace />;
  }

  return children;
};
