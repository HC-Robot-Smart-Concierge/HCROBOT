import React, { useState } from 'react';
import { Utensils, Sparkles, ChefHat, Tag, Check, ShoppingBag, Clock } from 'lucide-react';
import {
  INITIAL_MENU_CATEGORIES,
  INITIAL_FOOD_ITEMS,
} from '../../../../components/robot/RobotFoodMenuScreen';

export const KioskDiningMenu = ({ activeStep }) => {
  const params = activeStep?.params || {};
  const [activeCategory, setActiveCategory] = useState('all');

  const filteredItems =
    activeCategory === 'all'
      ? INITIAL_FOOD_ITEMS.slice(0, 8)
      : INITIAL_FOOD_ITEMS.filter((item) => item.category === activeCategory).slice(0, 8);

  return (
    <div className="space-y-3.5 animate-in fade-in duration-300 select-none">
      {/* Header thực đơn */}
      <div className="flex items-center justify-between pb-2 border-b border-stone-200">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
            <Utensils className="w-4 h-4 text-amber-600" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black text-stone-900 uppercase tracking-wide">
                {params.display_banner || 'Thực Đơn Nhà Hàng & Ẩm Thực Khách Sạn'}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                TẦNG 2 • AURORA RESTAURANT
              </span>
            </div>
            <p className="text-[10px] text-stone-500 font-medium">
              Phục vụ bữa sáng, tiệc trà chiều hoàng gia & gọi món tận phòng 24/7
            </p>
          </div>
        </div>
      </div>

      {/* Categories Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        <button
          type="button"
          onClick={() => setActiveCategory('all')}
          className={`px-3 py-1 rounded-xl font-bold whitespace-nowrap text-[11px] cursor-pointer transition-all ${
            activeCategory === 'all'
              ? 'bg-[#262626] text-white shadow-2xs'
              : 'bg-white text-stone-700 border border-stone-200 hover:bg-stone-50'
          }`}
        >
          Tất cả món
        </button>
        {INITIAL_MENU_CATEGORIES.slice(0, 5).map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setActiveCategory(cat.id)}
            className={`px-2.5 py-1 rounded-xl font-semibold whitespace-nowrap text-[11px] cursor-pointer transition-all flex items-center gap-1 ${
              activeCategory === cat.id
                ? 'bg-[#262626] text-white shadow-2xs'
                : 'bg-white text-stone-700 border border-stone-200 hover:bg-stone-50'
            }`}
          >
            <span>{cat.icon}</span>
            <span>{cat.name}</span>
          </button>
        ))}
      </div>

      {/* Food Items Grid (2 Cột x 3-4 Hàng) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1">
        {filteredItems.map((item) => (
          <div
            key={item.id}
            className="p-2.5 rounded-2xl bg-white border border-stone-200 shadow-xs hover:border-amber-400 hover:shadow-sm transition-all flex items-center gap-3 group"
          >
            {/* Dish Image */}
            <div className="w-16 h-16 rounded-xl overflow-hidden bg-stone-100 shrink-0 relative">
              <img
                src={item.image_url}
                alt={item.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              {item.badge && (
                <span className="absolute bottom-0.5 left-0.5 px-1 py-0.2 rounded text-[8px] font-black bg-amber-500 text-white">
                  {item.badge}
                </span>
              )}
            </div>

            {/* Dish Info */}
            <div className="flex-1 min-w-0">
              <h5 className="text-xs font-bold text-stone-900 truncate group-hover:text-amber-700 transition-colors">
                {item.name}
              </h5>
              <p className="text-[10px] text-stone-500 line-clamp-1 mt-0.5">
                {item.description}
              </p>
              <div className="flex items-center justify-between mt-1 pt-1 border-t border-stone-100">
                <span className="text-xs font-extrabold text-amber-600 font-mono">
                  {item.price.toLocaleString('vi-VN')} ₫
                </span>
                <span className="text-[9.5px] font-medium text-stone-400 flex items-center gap-0.5">
                  <Clock className="w-2.5 h-2.5" />
                  <span>{item.prep_time || 15}p</span>
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
