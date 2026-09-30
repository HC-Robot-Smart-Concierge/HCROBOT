// =====================================================================
// AURORA OS - RESTAURANT, TABLE RESERVATIONS & MENUS API SERVICE
// Connects React Frontend with FastAPI Backend (/api/v1/operations/restaurant)
// =====================================================================

const BASE_URL = '/api/v1/operations/restaurant';
const DASHBOARD_URL = '/api/v1/operations/dashboard/restaurant';

async function fetchWithFallback(url, options = {}, fallbackData = null) {
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
    console.warn(`[RestaurantAPI] Fallback for ${url}:`, error.message);
    return fallbackData;
  }
}

/**
 * 1. Lay so lieu tong quan Dashboard Nha hang (KPIs, Ban dat, Mon goi truoc)
 */
export async function fetchRestaurantDashboard() {
  return await fetchWithFallback(DASHBOARD_URL, {}, {
    kpis: {
      totalReservations: 0,
      totalPreOrders: 0,
      seatedGuests: 0,
      pendingPreOrders: 0,
    },
    reservations: [],
    pre_orders: [],
  });
}

/**
 * 2. Lay danh sach tat ca ban da dat
 */
export async function fetchRestaurantReservations() {
  return await fetchWithFallback(`${BASE_URL}/reservations`, {}, []);
}

/**
 * 3. Tao moi yeu cau dat ban an tu Robot Kiosk hoac Le tan
 */
export async function createRestaurantReservation(reservationData) {
  return await fetchWithFallback(
    `${BASE_URL}/reservations`,
    {
      method: 'POST',
      body: JSON.stringify(reservationData),
    },
    {
      id: `res_${Date.now()}`,
      reservation_code: `RES-${Math.floor(1000 + Math.random() * 9000)}`,
      ...reservationData,
      status: 'Confirmed',
      created_at: new Date().toISOString(),
    }
  );
}

/**
 * 4. Cap nhat trang thai dat ban (Confirmed, Seated, Completed, Cancelled)
 */
export async function updateReservationStatus(reservationId, status) {
  return await fetchWithFallback(
    `${BASE_URL}/reservations/${encodeURIComponent(reservationId)}/status?status=${encodeURIComponent(status)}`,
    {
      method: 'PATCH',
    },
    {
      id: reservationId,
      reservation_code: reservationId,
      status: status,
    }
  );
}

/**
 * 5. Lay danh sach goi mon truoc cua khach
 */
export async function fetchRestaurantPreOrders() {
  return await fetchWithFallback(`${BASE_URL}/pre-orders`, {}, []);
}

/**
 * 6. Tao moi yeu cau goi mon truoc
 */
export async function createRestaurantPreOrder(orderData) {
  return await fetchWithFallback(
    `${BASE_URL}/pre-orders`,
    {
      method: 'POST',
      body: JSON.stringify(orderData),
    },
    {
      id: `order_${Date.now()}`,
      order_code: `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
      ...orderData,
      status: 'Pending',
      created_at: new Date().toISOString(),
    }
  );
}

/**
 * 7. Lay danh muc Menu nha hang (kem danh sach mon an)
 */
export async function fetchRestaurantMenus(category = null) {
  const query = category ? `?category=${encodeURIComponent(category)}` : '';
  return await fetchWithFallback(`${BASE_URL}/menus${query}`, {}, []);
}

/**
 * 8. Tao Menu moi
 */
export async function createRestaurantMenu(menuData) {
  return await fetchWithFallback(
    `${BASE_URL}/menus`,
    {
      method: 'POST',
      body: JSON.stringify(menuData),
    },
    { id: `menu_${Date.now()}`, ...menuData }
  );
}

/**
 * 9. Lay danh sach tat ca mon an theo Menu hoac Danh muc
 */
export async function fetchRestaurantMenuItems(menuId = null, category = null) {
  const params = new URLSearchParams();
  if (menuId) params.append('menu_id', menuId);
  if (category) params.append('category', category);
  const qs = params.toString() ? `?${params.toString()}` : '';
  return await fetchWithFallback(`${BASE_URL}/menu-items${qs}`, {}, []);
}

/**
 * 10. Tao moi mot mon an trong Menu
 */
export async function createRestaurantMenuItem(itemData) {
  return await fetchWithFallback(
    `${BASE_URL}/menu-items`,
    {
      method: 'POST',
      body: JSON.stringify(itemData),
    },
    { id: `item_${Date.now()}`, ...itemData }
  );
}
