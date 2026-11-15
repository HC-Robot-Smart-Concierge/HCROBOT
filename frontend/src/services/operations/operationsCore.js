export const BASE_URL = '/api/v1/operations';
export const AUTH_URL = '/api/v1/auth';

/**
 * Generic fetch with fallback to provided mock data if offline or error occurs.
 */
export async function fetchWithFallback(url, options = {}, fallbackData = null) {
  try {
    const token = localStorage.getItem('aurora_jwt_token');
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.warn(`[OperationsAPI] Fallback for ${url}:`, error.message);
    return fallbackData;
  }
}

export async function requestRobotJson(url, options = {}) {
  const token = localStorage.getItem('aurora_jwt_token');
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `HTTP error ${response.status}`);
  }

  return await response.json();
}
