import { FOOD_ITEMS_PART_1 } from './robotFoodMenuDataPart1';
import { FOOD_ITEMS_PART_2 } from './robotFoodMenuDataPart2';

export const INITIAL_MENU_CATEGORIES = [
  { id: 'appetizers', name: 'Khai vị & Ăn nhẹ', icon: '' },
  { id: 'soups_porridge', name: 'Súp & Cháo', icon: '' },
  { id: 'salads', name: 'Salad & Gỏi', icon: '' },
  { id: 'mains', name: 'Món chính', icon: '' },
  { id: 'seafood', name: 'Hải sản', icon: '' },
  { id: 'noodles_rice', name: 'Mì – Cơm – Pasta', icon: '' },
  { id: 'hotpot', name: 'Lẩu', icon: '' },
  { id: 'sides_veggies', name: 'Rau & Món thêm', icon: '' },
  { id: 'desserts', name: 'Trái cây & Tráng miệng', icon: '' },
  { id: 'drinks', name: 'Đồ uống', icon: '' },
];

export const INITIAL_FOOD_ITEMS = [...FOOD_ITEMS_PART_1, ...FOOD_ITEMS_PART_2];

export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('vi-VN').format(amount || 0);
};
