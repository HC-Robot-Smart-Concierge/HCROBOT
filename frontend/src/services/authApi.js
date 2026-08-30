// =======================================================================
// AURORA OS - AUTHENTICATION & JWT SERVICE
// =======================================================================

const AUTH_URL = '/api/v1/auth';
const TOKEN_KEY = 'aurora_jwt_token';
const USER_KEY = 'aurora_user_profile';

/**
 * Perform login via the FastAPI backend.
 */
export async function loginUser(username, password) {
  const usernameClean = username.trim().toLowerCase();

  try {
    const response = await fetch(`${AUTH_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: usernameClean, password }),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        success: false,
        error: data?.detail || 'Tên đăng nhập hoặc mật khẩu không chính xác.',
      };
    }

    localStorage.setItem(TOKEN_KEY, data.access_token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    return {
      success: true,
      token: data.access_token,
      user: data.user,
      targetDashboard: data.target_dashboard,
    };
  } catch (error) {
    console.error('[AuthApi] Backend authentication is unavailable.', error);
    return {
      success: false,
      error: 'Không thể kết nối tới máy chủ xác thực. Vui lòng thử lại sau.',
    };
  }
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
  localStorage.removeItem('aurora_user');
}

export function updateStoredUser(updatedUser) {
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
    localStorage.setItem('aurora_user', JSON.stringify(updatedUser));
  } catch (e) {
    console.error('Failed to save user to localStorage', e);
  }
}

/**
 * Fetch latest user profile from FastAPI backend using stored JWT token.
 */
export async function fetchCurrentUser() {
  const token = getStoredToken();
  if (!token) return null;

  try {
    const response = await fetch(`${AUTH_URL}/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) return null;

    const user = await response.json();
    if (user) {
      updateStoredUser(user);
      return user;
    }
  } catch (err) {
    console.warn('[AuthApi] Failed to fetch current user from backend:', err);
  }
  return null;
}
