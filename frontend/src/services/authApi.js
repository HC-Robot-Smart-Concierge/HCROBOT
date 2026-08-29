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
}
