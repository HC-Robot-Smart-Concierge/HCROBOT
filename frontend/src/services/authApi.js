// =======================================================================
// AURORA OS - AUTHENTICATION & JWT SERVICE
// =======================================================================

const AUTH_URL = '/api/v1/auth';
const TOKEN_KEY = 'aurora_jwt_token';
const USER_KEY = 'aurora_user_profile';

// Mock users for offline demo fallback with strict role isolation
export const DEMO_STAFF_ACCOUNTS = [
  {
    username: 'roomservice',
    password: 'password123',
    name: 'Elena Rossi',
    role: 'Shift Leader / F&B Lead',
    department: 'F&B',
    defaultDashboard: 'room_service',
    allowedDashboards: ['room_service'],
    avatar: null,
    badge: '1. Room Service / F&B',
    icon: '🍽️',
  },
  {
    username: 'housekeeping',
    password: 'password123',
    name: 'Maria Santos',
    role: 'Housekeeping Lead',
    department: 'Housekeeping',
    defaultDashboard: 'housekeeping',
    allowedDashboards: ['housekeeping'],
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&auto=format&fit=crop&q=80',
    badge: '2. Housekeeping Staff',
    icon: '🧹',
  },
  {
    username: 'bellman',
    password: 'password123',
    name: 'Marcus T.',
    role: 'Bell Captain',
    department: 'Bell Services',
    defaultDashboard: 'bell_services',
    allowedDashboards: ['bell_services'],
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
    badge: '3. Bell Services',
    icon: '🧳',
  },
  {
    username: 'maintenance',
    password: 'password123',
    name: 'James Doe',
    role: 'HVAC Tech & Maintenance',
    department: 'Maintenance',
    defaultDashboard: 'maintenance',
    allowedDashboards: ['maintenance'],
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100&auto=format&fit=crop&q=80',
    badge: '4. Maintenance Staff',
    icon: '🔧',
  },
  {
    username: 'manager',
    password: 'password123',
    name: 'Marcus Vane',
    role: 'General Manager',
    department: 'Executive',
    defaultDashboard: 'manager_hub',
    allowedDashboards: ['manager_hub'],
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
    badge: '5. Management Hub',
    icon: '👔',
  },
  {
    username: 'admin',
    password: 'password123',
    name: 'System Administrator',
    role: 'Operations Admin',
    department: 'Executive',
    defaultDashboard: 'manager_hub',
    allowedDashboards: [
      'room_service',
      'housekeeping',
      'bell_services',
      'maintenance',
      'manager_hub',
      'robot_display',
      'admin_map',
    ],
    avatar: null,
    badge: '👑 Admin (All Roles)',
    icon: '👑',
  },
];

/**
 * Perform login via FastAPI backend or fallback to local demo matching.
 */
export async function loginUser(username, password) {
  const usernameClean = username.trim().toLowerCase();

  try {
    const response = await fetch(`${AUTH_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: usernameClean, password }),
    });

    if (response.ok) {
      const data = await response.json();
      localStorage.setItem(TOKEN_KEY, data.access_token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      return {
        success: true,
        token: data.access_token,
        user: data.user,
        targetDashboard: data.target_dashboard,
      };
    }
  } catch (error) {
    console.warn('[AuthApi] Backend server offline, checking demo fallback accounts...', error);
  }

  // Fallback demo authentication if backend is offline or demo accounts used
  const matched = DEMO_STAFF_ACCOUNTS.find(
    (acc) => acc.username.toLowerCase() === usernameClean
  );

  if (matched && (password === '123456' || password === 'password123' || password === matched.password)) {
    const mockToken = `mock_jwt_${matched.username}_${Date.now()}`;
    const mockUser = {
      id: `STF-${matched.username.toUpperCase()}`,
      username: matched.username,
      full_name: matched.name,
      role: matched.role,
      department: matched.department,
      default_dashboard: matched.defaultDashboard,
      avatar_url: matched.avatar,
    };

    localStorage.setItem(TOKEN_KEY, mockToken);
    localStorage.setItem(USER_KEY, JSON.stringify(mockUser));

    return {
      success: true,
      token: mockToken,
      user: mockUser,
      targetDashboard: matched.defaultDashboard,
    };
  }

  return {
    success: false,
    error: 'Tên đăng nhập hoặc mật khẩu không chính xác.',
  };
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function logoutUser() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
