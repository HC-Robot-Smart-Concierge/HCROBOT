import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  getStoredUser,
  fetchCurrentUser,
  logoutUser,
  updateStoredUser,
} from '../services/authApi';

const AuthContext = createContext(null);

export const STAFF_DASHBOARDS = [
  'reception',
  'room_service',
  'housekeeping',
  'bell_services',
  'maintenance',
  'kitchen',
  'concierge',
];

export const isRobotUser = (user) => {
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

export const isAdminUser = (user) => {
  if (!user) return false;
  if (isRobotUser(user)) return false;
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

export const normalizeLegacyView = (view, user) => {
  if (isRobotUser(user)) return 'robot_display';
  if (isAdminUser(user)) {
    if (!view || view === 'manager_hub' || view === 'landing' || STAFF_DASHBOARDS.includes(view)) {
      return 'admin_portal';
    }
    return view;
  }
  if (view === 'robot_display') return 'robot_display';
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
  if (['kitchen', 'bep', 'nha_bep', 'nhabep', 'chef', 'restaurant', 'nhahang', 'nha_hang'].includes(clean)) {
    return 'kitchen';
  }
  if (['taxi', 'datxe', 'dat_xe', 'transport', 'transportation'].includes(clean)) {
    return 'concierge';
  }
  if (['concierge', 'livecall', 'live_call', 'troly'].includes(clean)) {
    return 'concierge';
  }
  return clean;
};

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => getStoredUser());
  const [isLoading, setIsLoading] = useState(true);

  const syncProfile = useCallback(async () => {
    try {
      const freshUser = await fetchCurrentUser();
      if (freshUser) {
        setCurrentUser(freshUser);
        updateStoredUser(freshUser);
      }
    } catch (e) {
      console.warn('[AuthContext] syncProfile failed:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    syncProfile();
  }, [syncProfile]);

  const login = (user, targetDashboard = null) => {
    if (user?.username === 'manager') {
      logoutUser();
      setCurrentUser(null);
      return { success: false, message: 'Tài khoản Housekeeping Manager không còn được hỗ trợ.' };
    }
    setCurrentUser(user);
    updateStoredUser(user);

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
    return { success: true, resolvedDashboard };
  };

  const logout = async () => {
    await logoutUser();
    setCurrentUser(null);
  };

  const updateUser = (updated) => {
    setCurrentUser(updated);
    updateStoredUser(updated);
  };

  const value = {
    currentUser,
    setCurrentUser: updateUser,
    isLoading,
    isLoggedIn: !!currentUser,
    isAdmin: isAdminUser(currentUser),
    isRobot: isRobotUser(currentUser),
    login,
    logout,
    syncProfile,
    normalizeLegacyView: (v) => normalizeLegacyView(v, currentUser),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
