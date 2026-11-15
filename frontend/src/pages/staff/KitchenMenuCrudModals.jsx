import React from 'react';
import { ChefHat, BookOpen, X } from 'lucide-react';
import { handleNumberInputBlockExponent } from '../../utils/numberInputHelper';
import { MENU_CATEGORIES } from './kitchenMenuUtils';

export const KitchenMenuCrudModals = ({
  foodModalOpen,
  setFoodModalOpen,
  editingFood,
  foodForm,
  setFoodForm,
  handleSaveFoodItem,
  menuModalOpen,
  setMenuModalOpen,
  editingMenu,
  menuForm,
  setMenuForm,
  handleSaveMenu,
}) => (
  <>
      {/* -------------------------------------------------------------
          MODAL 1: THÊM / SỬA MÓN ĂN GỐC (FOOD ITEM)
          ------------------------------------------------------------- */}
      {foodModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-[#E5E1D8] shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-stone-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ChefHat className="w-5 h-5 text-amber-300" />
                <h3 className="text-sm font-bold">
                  {editingFood ? 'Chỉnh Sửa Món Ăn Gốc' : 'Thêm Món Ăn Mới Vào Kho Gốc'}
                </h3>
              </div>
              <button
                onClick={() => setFoodModalOpen(false)}
                className="p-1 hover:bg-stone-800 rounded-lg text-stone-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveFoodItem} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">Tên món ăn (*):</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Bò Wagyu Nướng Sốt Tiêu Đen"
                  value={foodForm.name}
                  onChange={(e) => setFoodForm({ ...foodForm, name: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#FAF8F5] border border-stone-300 text-xs font-semibold text-stone-900 outline-none focus:border-stone-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">Phân loại:</label>
                  <select
                    value={foodForm.category}
                    onChange={(e) => setFoodForm({ ...foodForm, category: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-[#FAF8F5] border border-stone-300 text-xs font-semibold text-stone-900 outline-none"
                  >
                    <option value="Món chính">Món chính</option>
                    <option value="Khai vị">Khai vị</option>
                    <option value="Tráng miệng">Tráng miệng</option>
                    <option value="Đồ uống">Đồ uống</option>
                    <option value="Ăn nhẹ">Ăn nhẹ</option>
                    <option value="Món phụ">Món phụ</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">Thời gian nấu (phút):</label>
                  <input
                    type="number"
                    min="1"
                    max="180"
                    value={foodForm.prep_time_minutes}
                    onKeyDown={(e) => handleNumberInputBlockExponent(e, { allowDecimal: false })}
                    onChange={(e) => setFoodForm({ ...foodForm, prep_time_minutes: Math.max(1, Number(e.target.value) || 1) })}
                    className="w-full px-3.5 py-2 rounded-xl bg-[#FAF8F5] border border-stone-300 text-xs font-semibold text-stone-900 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">Đường dẫn ảnh (URL):</label>
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/..."
                  value={foodForm.image_url}
                  onChange={(e) => setFoodForm({ ...foodForm, image_url: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#FAF8F5] border border-stone-300 text-xs font-medium text-stone-900 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">Mô tả chi tiết & Thành phần:</label>
                <textarea
                  rows="3"
                  placeholder="Mô tả hương vị, nguyên liệu chính hoặc lưu ý dị ứng..."
                  value={foodForm.description}
                  onChange={(e) => setFoodForm({ ...foodForm, description: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#FAF8F5] border border-stone-300 text-xs font-medium text-stone-900 outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="food_avail"
                  checked={foodForm.is_available}
                  onChange={(e) => setFoodForm({ ...foodForm, is_available: e.target.checked })}
                  className="w-4 h-4 rounded text-stone-900 cursor-pointer"
                />
                <label htmlFor="food_avail" className="text-xs font-bold text-stone-800 cursor-pointer">
                  Món ăn đang sẵn sàng phục vụ (Available)
                </label>
              </div>

              <div className="pt-3 border-t border-stone-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setFoodModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-stone-100 hover:bg-stone-200 text-stone-700 cursor-pointer"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-[#18181B] hover:bg-black text-white shadow-xs cursor-pointer"
                >
                  {editingFood ? 'Lưu Thay Đổi' : 'Thêm Vào Kho Gốc'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          MODAL 2: TẠO / SỬA THỰC ĐƠN (MENU)
          ------------------------------------------------------------- */}
      {menuModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-[#E5E1D8] shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-stone-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-amber-300" />
                <h3 className="text-sm font-bold">
                  {editingMenu ? 'Chỉnh Sửa Bộ Thực Đơn' : 'Tạo Thực Đơn Mới'}
                </h3>
              </div>
              <button
                onClick={() => setMenuModalOpen(false)}
                className="p-1 hover:bg-stone-800 rounded-lg text-stone-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMenu} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">Tên thực đơn (*):</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Menu Buffet Sáng, Thực Đơn Alacarte..."
                  value={menuForm.name}
                  onChange={(e) => setMenuForm({ ...menuForm, name: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#FAF8F5] border border-stone-300 text-xs font-semibold text-stone-900 outline-none focus:border-stone-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">Phân loại menu:</label>
                <select
                  value={menuForm.category}
                  onChange={(e) => setMenuForm({ ...menuForm, category: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#FAF8F5] border border-stone-300 text-xs font-semibold text-stone-900 outline-none"
                >
                  {MENU_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">Mô tả thực đơn:</label>
                <textarea
                  rows="3"
                  placeholder="Ví dụ: Phục vụ từ 6h00 - 10h00 tại nhà hàng chính..."
                  value={menuForm.description}
                  onChange={(e) => setMenuForm({ ...menuForm, description: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#FAF8F5] border border-stone-300 text-xs font-medium text-stone-900 outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="menu_active"
                  checked={menuForm.is_active}
                  onChange={(e) => setMenuForm({ ...menuForm, is_active: e.target.checked })}
                  className="w-4 h-4 rounded text-stone-900 cursor-pointer"
                />
                <label htmlFor="menu_active" className="text-xs font-bold text-stone-800 cursor-pointer">
                  Kích hoạt áp dụng thực đơn này (Active)
                </label>
              </div>

              <div className="pt-3 border-t border-stone-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setMenuModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-stone-100 hover:bg-stone-200 text-stone-700 cursor-pointer"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-[#18181B] hover:bg-black text-white shadow-xs cursor-pointer"
                >
                  {editingMenu ? 'Lưu Thay Đổi' : 'Tạo Thực Đơn'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
  </>
);
