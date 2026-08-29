// =======================================================================
// AURORA OS - AUTHENTICATION & JWT SERVICE
// =======================================================================

const AUTH_URL = '/api/v1/auth';
const TOKEN_KEY = 'aurora_jwt_token';
const USER_KEY = 'aurora_user_profile';

// Standardized Staff & Robot Accounts by Department (No fake mock names)
export const DEMO_STAFF_ACCOUNTS = [
  {
    username: 'reception',
    password: '123456',
    name: 'Nhân viên Lễ tân (Reception)',
    role: 'Front Desk / Receptionist',
    department: 'Reception',
    defaultDashboard: 'manager_hub',
    allowedDashboards: ['manager_hub', 'bell_services', 'room_service'],
    avatar: null,
    badge: 'Lễ tân / Reception',
  },
  {
    username: 'roomservice',
    password: '123456',
    name: 'Nhân viên Phục vụ phòng (F&B)',
    role: 'F&B Room Service Staff',
    department: 'F&B',
    defaultDashboard: 'room_service',
    allowedDashboards: ['room_service'],
    avatar: null,
    badge: 'Phục vụ phòng / F&B',
  },
  {
    username: 'housekeeping',
    password: '123456',
    name: 'Nhân viên Buồng phòng (Housekeeping)',
    role: 'Housekeeping Staff',
    department: 'Housekeeping',
    defaultDashboard: 'housekeeping',
    allowedDashboards: ['housekeeping'],
    avatar: null,
    badge: 'Buồng phòng / Housekeeping',
  },
  {
    username: 'bellman',
    password: '123456',
    name: 'Nhân viên Vận chuyển hành lý (Bellman)',
    role: 'Bellman / Luggage Staff',
    department: 'Bell Services',
    defaultDashboard: 'bell_services',
    allowedDashboards: ['bell_services'],
    avatar: null,
    badge: 'Vận chuyển hành lý / Bellman',
  },
  {
    username: 'maintenance',
    password: '123456',
    name: 'Nhân viên Kỹ thuật & Bảo trì',
    role: 'Maintenance Technician',
    department: 'Maintenance',
    defaultDashboard: 'maintenance',
    allowedDashboards: ['maintenance'],
    avatar: null,
    badge: 'Kỹ thuật & Bảo trì',
  },
  {
    username: 'manager',
    password: '123456',
    name: 'Ban Quản lý Khách sạn (Manager)',
    role: 'General Manager',
    department: 'Executive',
    defaultDashboard: 'manager_hub',
    allowedDashboards: ['manager_hub'],
    avatar: null,
    badge: 'Ban Quản lý / Manager',
  },
  {
    username: 'admin',
    password: '123456',
    name: 'Quản trị Hệ thống (Admin)',
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
    badge: 'Quản trị / System Admin',
  },
  {
    username: 'robot_01',
    password: '123456',
    name: 'Robot Kiosk Unit 01',
    role: 'Robot Kiosk',
    department: 'Robot Node',
    defaultDashboard: 'robot_display',
    allowedDashboards: ['robot_display'],
    avatar: null,
    badge: 'Robot Kiosk Unit 01',
  },
  {
    username: 'robot_02',
    password: '123456',
    name: 'Robot Kiosk Unit 02',
    role: 'Robot Kiosk',
    department: 'Robot Node',
    defaultDashboard: 'robot_display',
    allowedDashboards: ['robot_display'],
    avatar: null,
    badge: 'Robot Kiosk Unit 02',
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
    console.warn('[AuthApi] Backend server offline or DB error, checking demo fallback accounts...', error);
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
  } catch (e) {
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
