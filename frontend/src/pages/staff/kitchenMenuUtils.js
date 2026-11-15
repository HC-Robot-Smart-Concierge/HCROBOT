/** Pure defaults, categories, and filter helpers for KitchenMenuManagementPage. */

export const FOOD_CATEGORIES = ['All', 'Khai vị', 'Món chính', 'Đồ uống', 'Tráng miệng', 'Ăn nhẹ', 'Món phụ'];
export const MENU_CATEGORIES = ['Food', 'Beverage', 'Dessert', 'Room Service', 'A La Carte', 'Buffet', 'Combo'];

export const KITCHEN_MENU_GRID_PAGE_SIZE = 9;
export const KITCHEN_MENU_LIST_PAGE_SIZE = 10;

export const INITIAL_FOOD_FORM = {
  name: '',
  category: 'Món chính',
  description: '',
  image_url: '',
  prep_time_minutes: 15,
  is_available: true,
};

export const INITIAL_MENU_FORM = {
  name: '',
  category: 'Food',
  description: '',
  is_active: true,
};

export const INITIAL_ASSIGN_FORM = {
  menu_id: '',
  food_item_id: '',
  price: 0,
  display_order: 0,
  is_available: true,
};

export const INITIAL_EDIT_ITEM_FORM = {
  price: 0,
  display_order: 0,
  is_available: true,
};

export const buildFoodFormState = (food = null) => (
  food
    ? {
        name: food.name || '',
        category: food.category || 'Món chính',
        description: food.description || '',
        image_url: food.image_url || '',
        prep_time_minutes: food.prep_time_minutes || 15,
        is_available: food.is_available ?? true,
      }
    : { ...INITIAL_FOOD_FORM }
);

export const buildMenuFormState = (menu = null) => (
  menu
    ? {
        name: menu.name || '',
        category: menu.category || 'Food',
        description: menu.description || '',
        is_active: menu.is_active ?? true,
      }
    : { ...INITIAL_MENU_FORM }
);

export const filterFoodItems = (foodItems, selectedCategory, searchQuery) => {
  const q = searchQuery.trim().toLowerCase();
  return foodItems.filter((f) => {
    const matchCategory = selectedCategory === 'All' || f.category === selectedCategory;
    const matchSearch =
      !q ||
      (f.name || '').toLowerCase().includes(q) ||
      (f.description || '').toLowerCase().includes(q);
    return matchCategory && matchSearch;
  });
};

export const filterMenus = (menus, searchQuery) => {
  const q = searchQuery.trim().toLowerCase();
  return menus.filter((m) => (
    !q ||
    (m.name || '').toLowerCase().includes(q) ||
    (m.category || '').toLowerCase().includes(q)
  ));
};

export const filterMenuItems = (menuItems, searchQuery) => {
  const q = searchQuery.trim().toLowerCase();
  return menuItems.filter((item) => {
    const itemName = item.name || item.food_item?.name || '';
    return (
      !q ||
      itemName.toLowerCase().includes(q) ||
      (item.category || '').toLowerCase().includes(q)
    );
  });
};

export const paginateSlice = (items, page, pageSize) => {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
};
