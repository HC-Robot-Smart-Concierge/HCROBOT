// =====================================================================
// AURORA OS - KITCHEN API SERVICE
// Re-exports kitchen endpoints from operationsApi
// =====================================================================

export {
  fetchKitchenMenus,
  createKitchenMenu,
  getKitchenMenu,
  updateKitchenMenu,
  deleteKitchenMenu,
  fetchKitchenMenuItems,
  createKitchenMenuItem,
  assignFoodItemToMenu,
  updateKitchenMenuItem,
  removeKitchenMenuItem,
  fetchKitchenFoodItems,
  createKitchenFoodItem,
  getKitchenFoodItem,
  updateKitchenFoodItem,
  deleteKitchenFoodItem,
} from './operationsApi';
