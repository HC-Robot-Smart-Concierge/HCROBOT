// =====================================================================
// AURORA OS - KITCHEN API SERVICE
// Re-exports restaurantApi with modern kitchen naming conventions
// =====================================================================

export * from './restaurantApi';
export {
  fetchRestaurantDashboard as fetchKitchenDashboard,
  fetchRestaurantReservations as fetchKitchenReservations,
  createRestaurantReservation as createKitchenReservation,
  updateRestaurantReservationStatus as updateKitchenReservationStatus,
  fetchRestaurantPreOrders as fetchKitchenPreOrders,
  createRestaurantPreOrder as createKitchenPreOrder,
  fetchRestaurantMenus as fetchKitchenMenus,
  createRestaurantMenu as createKitchenMenu,
  updateRestaurantMenu as updateKitchenMenu,
  deleteRestaurantMenu as deleteKitchenMenu,
  fetchRestaurantMenuItems as fetchKitchenMenuItems,
  createRestaurantMenuItem as createKitchenMenuItem,
  fetchRestaurantFoodItems as fetchKitchenFoodItems,
  createRestaurantFoodItem as createKitchenFoodItem,
  updateRestaurantFoodItem as updateKitchenFoodItem,
  deleteRestaurantFoodItem as deleteKitchenFoodItem,
} from './restaurantApi';
