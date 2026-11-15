import React from 'react';
import {
  UtensilsCrossed,
  ChefHat,
  Edit3,
  Trash2,
  CheckCircle2,
  XCircle,
  BookOpen,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { Pagination } from '../../components/common/Pagination';
import {
  KITCHEN_MENU_GRID_PAGE_SIZE,
  KITCHEN_MENU_LIST_PAGE_SIZE,
} from './kitchenMenuUtils';

export const KitchenMenuTabsView = ({
  activeTab,
  setActiveTab,
  filteredFoods,
  paginatedFoods,
  foodsPage,
  setFoodsPage,
  filteredMenus,
  paginatedMenus,
  menus,
  menusPage,
  setMenusPage,
  filteredMenuItems,
  paginatedMenuItems,
  menuItemsPage,
  setMenuItemsPage,
  selectedMenuId,
  setSelectedMenuId,
  handleOpenFoodModal,
  handleToggleFoodAvailability,
  handleOpenMenuModal,
  handleToggleMenuStatus,
  handleOpenAssignModal,
  handleOpenEditItemModal,
  handleToggleMenuItemAvailability,
  setDeleteConfirm,
}) => (
  <>
        {/* -------------------------------------------------------------
            TAB 1: KHO MÓN ĂN GỐC (FOOD ITEMS - MASTER CATALOG)
            ------------------------------------------------------------- */}
        {activeTab === 'food_items' && (
          <div className="space-y-4">
            {filteredFoods.length === 0 ? (
              <div className="p-12 text-center bg-white rounded-xl border border-[#BFBFBD] text-xs text-stone-500 space-y-2">
                <ChefHat className="w-8 h-8 text-stone-300 mx-auto" />
                <p>Không tìm thấy món ăn nào phù hợp trong danh mục gốc.</p>
                <button
                  onClick={() => handleOpenFoodModal()}
                  className="mt-2 px-4 py-1.5 rounded-lg bg-[#262626] text-white text-xs font-bold"
                >
                  Thêm món ăn đầu tiên
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-[#BFBFBD] overflow-hidden">
                <div className="divide-y divide-stone-100">
                  {paginatedFoods.map((food) => (
                    <div
                      key={food.id}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#FAF9F6] transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Thumbnail */}
                        <div className="w-14 h-14 rounded-xl bg-stone-100 overflow-hidden shrink-0 border border-stone-200 relative">
                          {food.image_url ? (
                            <img
                              src={food.image_url}
                              alt={food.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.target.style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-stone-300">
                              <UtensilsCrossed className="w-5 h-5" />
                            </div>
                          )}
                        </div>

                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm font-bold text-stone-900">{food.name}</h4>
                            <span className="px-2 py-0.2 rounded-md bg-stone-100 text-stone-600 text-[10px] font-semibold">
                              {food.category || 'Món chính'}
                            </span>
                            <span
                              className={`px-2 py-0.2 rounded-md text-[10px] font-bold border ${
                                food.is_available
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : 'bg-rose-50 text-rose-800 border-rose-200'
                              }`}
                            >
                              {food.is_available ? 'Còn phục vụ' : 'Tạm ngưng'}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 text-xs text-stone-500 flex-wrap">
                            <span className="inline-flex items-center gap-1 font-semibold text-[#262626]">
                              <Clock className="w-3.5 h-3.5 text-stone-400" />
                              <span>{food.prep_time_minutes || 15} phút</span>
                            </span>
                            <span className="font-mono text-[11px] text-stone-400">• #{food.id}</span>
                            {food.description && (
                              <span className="text-stone-600 line-clamp-1">{food.description}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                        <button
                          onClick={() => handleToggleFoodAvailability(food)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            food.is_available
                              ? 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                              : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-900'
                          }`}
                        >
                          {food.is_available ? 'Tạm Ngưng' : 'Mở Lại'}
                        </button>

                        <button
                          onClick={() => handleOpenFoodModal(food)}
                          title="Chỉnh sửa món"
                          className="px-3 py-1.5 rounded-lg bg-white hover:bg-stone-100 border border-[#BFBFBD] text-stone-800 text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Chỉnh Sửa</span>
                        </button>

                        <button
                          onClick={() => setDeleteConfirm({ type: 'food', id: food.id, name: food.name })}
                          title="Xóa món khỏi kho"
                          className="p-1.5 rounded-lg bg-white hover:bg-rose-50 border border-[#BFBFBD] text-rose-600 transition-all cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <Pagination
                  currentPage={foodsPage}
                  totalItems={filteredFoods.length}
                  pageSize={KITCHEN_MENU_LIST_PAGE_SIZE}
                  onPageChange={setFoodsPage}
                  itemName="món"
                />
              </div>
            )}
          </div>
        )}

        {/* -------------------------------------------------------------
            TAB 2: DANH SÁCH THỰC ĐƠN (MENUS)
            ------------------------------------------------------------- */}
        {activeTab === 'menus' && (
          <div className="space-y-4">
            {filteredMenus.length === 0 ? (
              <div className="p-12 text-center bg-white rounded-xl border border-[#BFBFBD] text-xs text-stone-500 space-y-2">
                <BookOpen className="w-8 h-8 text-stone-300 mx-auto" />
                <p>Chưa có thực đơn nào được tạo.</p>
                <button
                  onClick={() => handleOpenMenuModal()}
                  className="mt-2 px-4 py-1.5 rounded-lg bg-[#262626] text-white text-xs font-bold"
                >
                  Tạo thực đơn đầu tiên
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {paginatedMenus.map((menu) => (
                    <div
                      key={menu.id}
                      className="bg-white rounded-xl border border-[#BFBFBD] p-5 transition-all flex flex-col justify-between space-y-4"
                    >
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-900 text-[10px] font-bold">
                          {menu.category || 'Food'}
                        </span>

                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            menu.is_active
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-stone-100 text-stone-600 border-stone-200'
                          }`}
                        >
                          {menu.is_active ? '● Đang Áp Dụng' : '○ Tạm Dừng'}
                        </span>
                      </div>

                      <h4 className="text-base font-bold text-stone-900 leading-snug">{menu.name}</h4>

                      {menu.description && (
                        <p className="text-xs text-stone-600 line-clamp-2">{menu.description}</p>
                      )}

                      <div className="pt-2 flex items-center justify-between text-xs text-stone-600">
                        <span className="font-semibold">Món trong thực đơn:</span>
                        <span className="font-bold text-stone-900 bg-stone-100 px-2 py-0.5 rounded-md">
                          {menu.items?.length || 0} món
                        </span>
                      </div>
                    </div>

                    {/* Actions Bar */}
                    <div className="pt-3 border-t border-stone-100 flex items-center justify-between gap-2">
                      <button
                        onClick={() => {
                          setSelectedMenuId(menu.id);
                          setActiveTab('menu_items');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <span>Quản Lý Món</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleToggleMenuStatus(menu)}
                          title={menu.is_active ? 'Tạm ngưng menu' : 'Kích hoạt menu'}
                          className="p-1.5 rounded-xl bg-white hover:bg-stone-100 border border-stone-200 text-stone-700 transition-all cursor-pointer"
                        >
                          {menu.is_active ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <XCircle className="w-4 h-4 text-stone-400" />}
                        </button>

                        <button
                          onClick={() => handleOpenMenuModal(menu)}
                          title="Chỉnh sửa menu"
                          className="p-1.5 rounded-xl bg-white hover:bg-stone-100 border border-stone-200 text-stone-700 transition-all cursor-pointer"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => setDeleteConfirm({ type: 'menu', id: menu.id, name: menu.name })}
                          title="Xóa menu"
                          className="p-1.5 rounded-xl bg-white hover:bg-rose-50 border border-stone-200 text-rose-600 transition-all cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                </div>
                <Pagination
                  currentPage={menusPage}
                  totalItems={filteredMenus.length}
                  pageSize={KITCHEN_MENU_GRID_PAGE_SIZE}
                  onPageChange={setMenusPage}
                  itemName="thực đơn"
                  className="rounded-xl border overflow-hidden"
                />
              </>
            )}
          </div>
        )}

        {/* -------------------------------------------------------------
            TAB 3: MÓN TRONG THỰC ĐƠN (MENU ITEMS)
            ------------------------------------------------------------- */}
        {activeTab === 'menu_items' && (
          <div className="space-y-4">
            {filteredMenuItems.length === 0 ? (
              <div className="p-12 text-center bg-white rounded-xl border border-[#BFBFBD] text-xs text-stone-500 space-y-2">
                <UtensilsCrossed className="w-8 h-8 text-stone-300 mx-auto" />
                <p>Thực đơn này hiện chưa có món ăn nào.</p>
                <button
                  onClick={handleOpenAssignModal}
                  className="mt-2 px-4 py-1.5 rounded-lg bg-[#262626] text-white text-xs font-bold"
                >
                  Gán món từ kho gốc vào thực đơn này
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-[#BFBFBD] overflow-hidden">
                <div className="divide-y divide-stone-100">
                  {paginatedMenuItems.map((item, idx) => {
                    const name = item.name || item.food_item?.name || 'Món ăn';
                    const category = item.category || item.food_item?.category || 'Món chính';
                    const img = item.image_url || item.food_item?.image_url;

                    return (
                      <div
                        key={item.id}
                        className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#FAF9F6] transition-all"
                      >
                        <div className="flex items-center gap-3">
                          {/* Thumbnail */}
                          <div className="w-14 h-14 rounded-xl bg-stone-100 overflow-hidden shrink-0 border border-stone-200 relative">
                            {img ? (
                              <img src={img} alt={name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-stone-300">
                                <UtensilsCrossed className="w-5 h-5" />
                              </div>
                            )}
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-sm font-bold text-stone-900">{name}</h4>
                              <span className="px-2 py-0.2 rounded-md bg-stone-100 text-stone-600 text-[10px] font-semibold">
                                {category}
                              </span>
                              <span
                                className={`px-2 py-0.2 rounded-md text-[10px] font-bold border ${
                                  item.is_available
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                    : 'bg-rose-50 text-rose-800 border-rose-200'
                                }`}
                              >
                                {item.is_available ? 'Đang phục vụ' : 'Tạm ngưng'}
                              </span>
                            </div>

                            <div className="flex items-center gap-3 text-xs text-stone-500">
                              <span className="font-bold text-[#262626] text-sm">
                                {Number(item.price || 0).toLocaleString('vi-VN')} ₫
                              </span>
                              <span>• Thứ tự: #{item.display_order || (menuItemsPage - 1) * listPageSize + idx + 1}</span>
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 self-end sm:self-auto">
                          <button
                            onClick={() => handleToggleMenuItemAvailability(item)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              item.is_available
                                ? 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                                : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-900'
                            }`}
                          >
                            {item.is_available ? 'Tạm Dừng' : 'Mở Lại'}
                          </button>

                          <button
                            onClick={() => handleOpenEditItemModal(item)}
                            title="Đổi giá / Thứ tự"
                            className="px-3 py-1.5 rounded-lg bg-white hover:bg-stone-100 border border-[#BFBFBD] text-stone-800 text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Đổi Giá</span>
                          </button>

                          <button
                            onClick={() =>
                              setDeleteConfirm({
                                type: 'menu_item',
                                id: item.id,
                                name,
                                menuId: selectedMenuId,
                              })
                            }
                            title="Gỡ khỏi thực đơn này (không xóa món gốc)"
                            className="p-1.5 rounded-lg bg-white hover:bg-rose-50 border border-[#BFBFBD] text-rose-600 transition-all cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <Pagination
                  currentPage={menuItemsPage}
                  totalItems={filteredMenuItems.length}
                  pageSize={KITCHEN_MENU_LIST_PAGE_SIZE}
                  onPageChange={setMenuItemsPage}
                  itemName="món"
                />
              </div>
            )}
          </div>
        )}
  </>
);
