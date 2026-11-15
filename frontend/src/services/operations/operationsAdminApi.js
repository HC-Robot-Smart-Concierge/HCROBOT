import { BASE_URL, fetchWithFallback } from './operationsCore';

// ---------------------------------------------------------
// 9. Admin Central Operations API Helpers
// ---------------------------------------------------------
export const fetchAdminSummary = async () => {
  return await fetchWithFallback(`${BASE_URL}/admin/summary`, {}, {
    total_active: 0,
    all_count: 0,
    reception_count: 0,
    housekeeping_count: 0,
    room_service_count: 0,
    bell_services_count: 0,
    maintenance_count: 0,
    concierge_count: 0,
    taxi_count: 0,
    directives_count: 0,
  });
};

export const fetchAdminTasks = async (params = {}) => {
  const query = new URLSearchParams();
  if (params.department && params.department !== 'All') query.append('department', params.department);
  if (params.status && params.status !== 'All') query.append('status', params.status);
  if (params.search) query.append('search', params.search);
  if (params.limit) query.append('limit', params.limit);
  if (params.offset) query.append('offset', params.offset);

  const qs = query.toString() ? `?${query.toString()}` : '';
  return await fetchWithFallback(`${BASE_URL}/tasks${qs}`, {}, []);
};

export const dispatchAdminTask = async (taskData) => {
  return await fetchWithFallback(
    `${BASE_URL}/admin/dispatch`,
    {
      method: 'POST',
      body: JSON.stringify(taskData),
    },
    null
  );
};

export const updateAdminTask = async (ticketId, updateData) => {
  return await fetchWithFallback(
    `${BASE_URL}/tasks/${encodeURIComponent(ticketId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(updateData),
    },
    { success: true, id: ticketId, ...updateData }
  );
};

export const fetchAdminConversations = async (status = 'all') => {
  const qs = status && status !== 'all' ? `?status=${encodeURIComponent(status)}` : '';
  return await fetchWithFallback(`${BASE_URL}/admin/conversations${qs}`, {}, []);
};

export const fetchAdminConversationDetail = async (sessionId) => {
  return await fetchWithFallback(
    `${BASE_URL}/admin/conversations/${encodeURIComponent(sessionId)}`,
    {},
    null
  );
};

// ---------------------------------------------------------
// 10. Department & System Notification Center
// ---------------------------------------------------------
export const fetchNotifications = async (department = null, limit = 50) => {
  const params = new URLSearchParams();
  if (department && department !== 'All' && department !== 'admin') {
    params.append('department', department);
  }
  if (limit) params.append('limit', limit);
  const qs = params.toString() ? `?${params.toString()}` : '';
  return await fetchWithFallback(`${BASE_URL}/notifications${qs}`, {}, []);
};

export const createNotification = async (notifData) => {
  return await fetchWithFallback(
    `${BASE_URL}/notifications`,
    {
      method: 'POST',
      body: JSON.stringify(notifData),
    },
    { id: `NOTIF-${Date.now()}`, ...notifData, is_read: false, created_at: new Date().toISOString() }
  );
};

export const toggleNotificationRead = async (notificationId) => {
  return await fetchWithFallback(
    `${BASE_URL}/notifications/${encodeURIComponent(notificationId)}/read`,
    {
      method: 'PATCH',
    },
    { success: true, id: notificationId }
  );
};

export const markAllNotificationsRead = async (department = null) => {
  const params = new URLSearchParams();
  if (department && department !== 'All') {
    params.append('department', department);
  }
  const qs = params.toString() ? `?${params.toString()}` : '';
  return await fetchWithFallback(
    `${BASE_URL}/notifications/mark-all-read${qs}`,
    {
      method: 'POST',
    },
    { success: true, department }
  );
};

export const deleteNotification = async (notificationId) => {
  return await fetchWithFallback(
    `${BASE_URL}/notifications/${encodeURIComponent(notificationId)}`,
    {
      method: 'DELETE',
    },
    { success: true, id: notificationId }
  );
};

export const fetchAnalyticsSummary = async (period = 'all') => {
  return await fetchWithFallback(
    `${BASE_URL}/analytics/summary?period=${encodeURIComponent(period)}`,
    {},
    {
      period,
      total_tasks: 0,
      active_tasks: 0,
      completed_tasks: 0,
      completion_rate: 0,
      robot_assigned_tasks: 0,
      human_tasks: 0,
      robot_rate: 0,
      total_sessions: 0,
      total_messages: 0,
      total_staff: 0,
      fallback_staff: 0,
      total_robots: 1,
      dept_distribution: {
        Reception: 0,
        Housekeeping: 0,
        'F&B': 0,
        'Bell Services': 0,
        Maintenance: 0,
      },
      recent_activities: [],
    }
  );
};

export const fetchAdminTaskDetail = async (ticketId) => {
  return await fetchWithFallback(
    `${BASE_URL}/tasks/${encodeURIComponent(ticketId)}`,
    {},
    null
  );
};

export const sendRobotControlCommand = async (command, speed = 60, targetIp = (import.meta.env.VITE_PI5_IP || '100.99.72.51'), port = 9999) => {
  return await fetchWithFallback(
    `${BASE_URL}/robot/control`,
    {
      method: 'POST',
      body: JSON.stringify({
        command,
        speed,
        target_ip: targetIp,
        port,
      }),
    },
    { success: true, command }
  );
};

// ---------------------------------------------------------
// 11. Departments & Service Types Directory
// ---------------------------------------------------------
export const fetchDepartments = async () => {
  return await fetchWithFallback(`${BASE_URL}/departments`, {}, []);
};

export const fetchDepartmentDetail = async (departmentId) => {
  return await fetchWithFallback(
    `${BASE_URL}/departments/${encodeURIComponent(departmentId)}`,
    {},
    null
  );
};

export const fetchServiceTypes = async (departmentId = null) => {
  const query = departmentId ? `?department_id=${encodeURIComponent(departmentId)}` : '';
  return await fetchWithFallback(`${BASE_URL}/service-types${query}`, {}, []);
};

export const fetchStaffDepartments = async () => {
  return await fetchWithFallback(`${BASE_URL}/departments`, {}, []);
};

// ---------------------------------------------------------
// 12. Kitchen Food Items, Menus & Menu Items Management
// ---------------------------------------------------------

// 12A. Kho món ăn gốc (Master Food Catalog)
export const fetchKitchenFoodItems = async ({ category = null, search = null, is_available = null } = {}) => {
  const params = new URLSearchParams();
  if (category && category !== 'All') params.append('category', category);
  if (search) params.append('search', search);
  if (is_available !== null && is_available !== undefined) params.append('is_available', is_available);
  const qs = params.toString() ? `?${params.toString()}` : '';
  return await fetchWithFallback(`${BASE_URL}/kitchen/food-items${qs}`, {}, []);
};

export const createKitchenFoodItem = async (foodData) => {
  return await fetchWithFallback(
    `${BASE_URL}/kitchen/food-items`,
    {
      method: 'POST',
      body: JSON.stringify(foodData),
    },
    { id: `FOOD-${Date.now()}`, ...foodData }
  );
};

export const getKitchenFoodItem = async (foodId) => {
  return await fetchWithFallback(
    `${BASE_URL}/kitchen/food-items/${encodeURIComponent(foodId)}`,
    {},
    null
  );
};

export const updateKitchenFoodItem = async (foodId, foodData) => {
  return await fetchWithFallback(
    `${BASE_URL}/kitchen/food-items/${encodeURIComponent(foodId)}`,
    {
      method: 'PUT',
      body: JSON.stringify(foodData),
    },
    { id: foodId, ...foodData }
  );
};

export const deleteKitchenFoodItem = async (foodId) => {
  return await fetchWithFallback(
    `${BASE_URL}/kitchen/food-items/${encodeURIComponent(foodId)}`,
    {
      method: 'DELETE',
    },
    { id: foodId, detail: 'Đã xóa' }
  );
};

// 12B. Danh sách bộ thực đơn (Menus)
export const fetchKitchenMenus = async ({ category = null, is_active = null } = {}) => {
  const params = new URLSearchParams();
  if (category && category !== 'All') params.append('category', category);
  if (is_active !== null && is_active !== undefined) params.append('is_active', is_active);
  const qs = params.toString() ? `?${params.toString()}` : '';
  return await fetchWithFallback(`${BASE_URL}/kitchen/menus${qs}`, {}, []);
};

export const createKitchenMenu = async (menuData) => {
  return await fetchWithFallback(
    `${BASE_URL}/kitchen/menus`,
    {
      method: 'POST',
      body: JSON.stringify(menuData),
    },
    { id: `MENU-${Date.now()}`, ...menuData, items: [] }
  );
};

export const getKitchenMenu = async (menuId) => {
  return await fetchWithFallback(
    `${BASE_URL}/kitchen/menus/${encodeURIComponent(menuId)}`,
    {},
    null
  );
};

export const updateKitchenMenu = async (menuId, menuData) => {
  return await fetchWithFallback(
    `${BASE_URL}/kitchen/menus/${encodeURIComponent(menuId)}`,
    {
      method: 'PUT',
      body: JSON.stringify(menuData),
    },
    { id: menuId, ...menuData }
  );
};

export const deleteKitchenMenu = async (menuId) => {
  return await fetchWithFallback(
    `${BASE_URL}/kitchen/menus/${encodeURIComponent(menuId)}`,
    {
      method: 'DELETE',
    },
    { id: menuId, detail: 'Đã xóa thực đơn' }
  );
};

// 12C. Món ăn trong thực đơn (Menu Items)
export const fetchKitchenMenuItems = async ({ menu_id = null, category = null } = {}) => {
  const params = new URLSearchParams();
  if (menu_id) params.append('menu_id', menu_id);
  if (category && category !== 'All') params.append('category', category);
  const qs = params.toString() ? `?${params.toString()}` : '';
  return await fetchWithFallback(`${BASE_URL}/kitchen/menu-items${qs}`, {}, []);
};

export const createKitchenMenuItem = async (itemData) => {
  return await fetchWithFallback(
    `${BASE_URL}/kitchen/menu-items`,
    {
      method: 'POST',
      body: JSON.stringify(itemData),
    },
    { id: `ITEM-${Date.now()}`, ...itemData }
  );
};

export const assignFoodItemToMenu = async (menuId, assignData) => {
  return await fetchWithFallback(
    `${BASE_URL}/kitchen/menus/${encodeURIComponent(menuId)}/items`,
    {
      method: 'POST',
      body: JSON.stringify(assignData),
    },
    { id: `ITEM-${Date.now()}`, menu_id: menuId, ...assignData }
  );
};

export const updateKitchenMenuItem = async (menuId, menuItemId, updateData) => {
  return await fetchWithFallback(
    `${BASE_URL}/kitchen/menus/${encodeURIComponent(menuId)}/items/${encodeURIComponent(menuItemId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(updateData),
    },
    { id: menuItemId, menu_id: menuId, ...updateData }
  );
};

export const removeKitchenMenuItem = async (menuId, menuItemId) => {
  return await fetchWithFallback(
    `${BASE_URL}/kitchen/menus/${encodeURIComponent(menuId)}/items/${encodeURIComponent(menuItemId)}`,
    {
      method: 'DELETE',
    },
    { id: menuItemId, menu_id: menuId, detail: 'Đã gỡ món khỏi thực đơn' }
  );
};
