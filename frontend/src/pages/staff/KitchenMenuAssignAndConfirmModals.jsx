import React from 'react';
import { Plus, AlertCircle, X, DollarSign } from 'lucide-react';
import { handleNumberInputBlockExponent } from '../../utils/numberInputHelper';

export const KitchenMenuAssignAndConfirmModals = ({
  assignModalOpen,
  setAssignModalOpen,
  currentMenu,
  assignForm,
  setAssignForm,
  foodItems,
  handleAssignFoodToMenu,
  editingMenuItem,
  setEditingMenuItem,
  editItemForm,
  setEditItemForm,
  handleSaveEditMenuItem,
  deleteConfirm,
  setDeleteConfirm,
  handleDeleteFoodItem,
  handleDeleteMenu,
  handleRemoveItemFromMenu,
}) => (
  <>
      {/* -------------------------------------------------------------
          MODAL 3: GÁN MÓN VÀO THỰC ĐƠN (ASSIGN FOOD TO MENU)
          ------------------------------------------------------------- */}
      {assignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-[#E5E1D8] shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-stone-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-amber-300" />
                <h3 className="text-sm font-bold">Gán Món Vào Thực Đơn: {currentMenu?.name}</h3>
              </div>
              <button
                onClick={() => setAssignModalOpen(false)}
                className="p-1 hover:bg-stone-800 rounded-lg text-stone-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAssignFoodToMenu} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">
                  Chọn món ăn từ kho gốc (*):
                </label>
                <select
                  required
                  value={assignForm.food_item_id}
                  onChange={(e) => setAssignForm({ ...assignForm, food_item_id: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF8F5] border border-stone-300 text-xs font-bold text-stone-900 outline-none"
                >
                  <option value="">-- Chọn món ăn --</option>
                  {foodItems.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.category})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">
                    Giá bán trong Menu (VNĐ) (*):
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    required
                    placeholder="Ví dụ: 85000"
                    value={assignForm.price}
                    onKeyDown={(e) => handleNumberInputBlockExponent(e)}
                    onChange={(e) => setAssignForm({ ...assignForm, price: Math.max(0, Number(e.target.value) || 0) })}
                    className="w-full px-3.5 py-2 rounded-xl bg-[#FAF8F5] border border-stone-300 text-xs font-bold text-amber-900 outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">Thứ tự hiển thị:</label>
                  <input
                    type="number"
                    min="0"
                    value={assignForm.display_order}
                    onKeyDown={(e) => handleNumberInputBlockExponent(e, { allowDecimal: false })}
                    onChange={(e) => setAssignForm({ ...assignForm, display_order: Math.max(0, Number(e.target.value) || 0) })}
                    className="w-full px-3.5 py-2 rounded-xl bg-[#FAF8F5] border border-stone-300 text-xs font-semibold text-stone-900 outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="assign_avail"
                  checked={assignForm.is_available}
                  onChange={(e) => setAssignForm({ ...assignForm, is_available: e.target.checked })}
                  className="w-4 h-4 rounded text-stone-900 cursor-pointer"
                />
                <label htmlFor="assign_avail" className="text-xs font-bold text-stone-800 cursor-pointer">
                  Mở bán món trong thực đơn này
                </label>
              </div>

              <div className="pt-3 border-t border-stone-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAssignModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-stone-100 hover:bg-stone-200 text-stone-700 cursor-pointer"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-[#18181B] hover:bg-black text-white shadow-xs cursor-pointer"
                >
                  Gán Vào Menu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          MODAL 4: ĐỔI GIÁ & THỨ TỰ MÓN TRONG MENU
          ------------------------------------------------------------- */}
      {editingMenuItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-[#E5E1D8] shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-stone-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-amber-300" />
                <h3 className="text-sm font-bold">Cập Nhật Giá Món Trong Menu</h3>
              </div>
              <button
                onClick={() => setEditingMenuItem(null)}
                className="p-1 hover:bg-stone-800 rounded-lg text-stone-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditMenuItem} className="p-6 space-y-4">
              <p className="text-xs font-bold text-stone-900">
                Món: <span className="text-amber-800">{editingMenuItem.name || editingMenuItem.food_item?.name}</span>
              </p>

              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">
                  Giá bán áp dụng riêng (VNĐ):
                </label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  required
                  value={editItemForm.price}
                  onKeyDown={(e) => handleNumberInputBlockExponent(e)}
                  onChange={(e) => setEditItemForm({ ...editItemForm, price: Math.max(0, Number(e.target.value) || 0) })}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#FAF8F5] border border-stone-300 text-sm font-black text-amber-900 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">Thứ tự hiển thị:</label>
                <input
                  type="number"
                  min="0"
                  value={editItemForm.display_order}
                  onKeyDown={(e) => handleNumberInputBlockExponent(e, { allowDecimal: false })}
                  onChange={(e) => setEditItemForm({ ...editItemForm, display_order: Math.max(0, Number(e.target.value) || 0) })}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#FAF8F5] border border-stone-300 text-xs font-semibold text-stone-900 outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="edit_avail"
                  checked={editItemForm.is_available}
                  onChange={(e) => setEditItemForm({ ...editItemForm, is_available: e.target.checked })}
                  className="w-4 h-4 rounded text-stone-900 cursor-pointer"
                />
                <label htmlFor="edit_avail" className="text-xs font-bold text-stone-800 cursor-pointer">
                  Mở bán món trong thực đơn này
                </label>
              </div>

              <div className="pt-3 border-t border-stone-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingMenuItem(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-stone-100 hover:bg-stone-200 text-stone-700 cursor-pointer"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-[#18181B] hover:bg-black text-white shadow-xs cursor-pointer"
                >
                  Lưu Giá
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          MODAL 5: XÁC NHẬN XÓA / GỠ MÓN (CONFIRM DELETE / REMOVE)
          ------------------------------------------------------------- */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-[#E5E1D8] shadow-2xl w-full max-w-sm overflow-hidden p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5 text-rose-700" />
              </div>
              <h3 className="text-sm font-bold text-stone-900">
                {deleteConfirm.type === 'menu_item' ? 'Gỡ Món Khỏi Thực Đơn' : 'Xác Nhận Xóa Dữ Liệu'}
              </h3>
            </div>

            <p className="text-xs text-stone-600 leading-relaxed">
              {deleteConfirm.type === 'menu_item' ? (
                <>
                  Bạn có chắc chắn muốn gỡ món <strong className="text-stone-900">"{deleteConfirm.name}"</strong> khỏi thực đơn này?{' '}
                  <span className="block mt-1 text-emerald-700 font-medium">
                    - Món ăn trong <strong>Kho Món Ăn Gốc</strong> vẫn được giữ nguyên.
                  </span>
                </>
              ) : (
                <>
                  Bạn có chắc chắn muốn xóa{' '}
                  <strong className="text-stone-900">"{deleteConfirm.name}"</strong>?
                  {deleteConfirm.type === 'food' && ' Món ăn sẽ bị xóa vĩnh viễn khỏi kho dữ liệu gốc và tự động gỡ khỏi toàn bộ các thực đơn liên quan.'}
                  {deleteConfirm.type === 'menu' && ' Bộ thực đơn sẽ bị xóa. Các món ăn trong Kho Món Ăn Gốc vẫn được giữ nguyên.'}
                </>
              )}
            </p>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-stone-100 hover:bg-stone-200 text-stone-700 cursor-pointer"
              >
                Hủy
              </button>
              <button
                onClick={() => {
                  if (deleteConfirm.type === 'food') handleDeleteFoodItem(deleteConfirm.id);
                  if (deleteConfirm.type === 'menu') handleDeleteMenu(deleteConfirm.id);
                  if (deleteConfirm.type === 'menu_item') handleRemoveItemFromMenu(deleteConfirm.id);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs cursor-pointer"
              >
                {deleteConfirm.type === 'menu_item' ? 'Gỡ Khỏi Thực Đơn' : 'Xác Nhận Xóa'}
              </button>
            </div>
          </div>
        </div>
      )}
  </>
);
