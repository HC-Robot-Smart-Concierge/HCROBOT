import React, { useState, useEffect } from 'react';
import { Wrench, Plus, Edit2, Trash2, Check, X, RefreshCw, AlertCircle, Power } from 'lucide-react';
import {
  fetchMaintenanceCatalog,
  createMaintenanceCatalogItem,
  updateMaintenanceCatalogItem,
  deleteMaintenanceCatalogItem,
  toggleMaintenanceCatalogItem,
} from '../../services/operationsApi';
import { useLanguage } from '../../context/LanguageContext';

const CATEGORY_OPTIONS = [
  { value: 'hvac', labelVi: 'Điều hòa & Không khí', labelEn: 'AC & Climate' },
  { value: 'plumbing', labelVi: 'Nước & Vệ sinh', labelEn: 'Plumbing' },
  { value: 'electrical', labelVi: 'Điện & Ánh sáng', labelEn: 'Electrical' },
  { value: 'door_lock', labelVi: 'Khóa cửa & Thẻ từ', labelEn: 'Door & Lock' },
  { value: 'media_network', labelVi: 'Wifi & Tivi', labelEn: 'Wifi & Media' },
  { value: 'other', labelVi: 'Khác', labelEn: 'Other' },
];

const PRIORITY_OPTIONS = [
  { value: 'LOW', labelVi: 'Thấp', labelEn: 'Low' },
  { value: 'NORMAL', labelVi: 'Tiêu chuẩn', labelEn: 'Standard' },
  { value: 'HIGH', labelVi: 'Ưu tiên', labelEn: 'High Priority' },
  { value: 'URGENT', labelVi: 'Khẩn cấp', labelEn: 'Urgent' },
];

export const MaintenanceCatalogModal = ({ isOpen, onClose, onNotify = () => {} }) => {
  const { language } = useLanguage();
  const isEn = language === 'English';

  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    name_vi: '',
    name_en: '',
    category: 'hvac',
    priority: 'NORMAL',
    estimated_fix_time: 15,
    description_vi: '',
    description_en: '',
    is_active: true,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const loadCatalog = async () => {
    setIsLoading(true);
    try {
      const data = await fetchMaintenanceCatalog();
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('Failed to load maintenance catalog:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadCatalog();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormData({
      name_vi: '',
      name_en: '',
      category: 'hvac',
      priority: 'NORMAL',
      estimated_fix_time: 15,
      description_vi: '',
      description_en: '',
      is_active: true,
    });
    setFormError('');
    setIsFormOpen(true);
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setFormData({
      name_vi: item.name_vi || '',
      name_en: item.name_en || '',
      category: item.category || 'hvac',
      priority: item.priority || 'NORMAL',
      estimated_fix_time: item.estimated_fix_time || 15,
      description_vi: item.description_vi || '',
      description_en: item.description_en || '',
      is_active: item.is_active ?? true,
    });
    setFormError('');
    setIsFormOpen(true);
  };

  const handleToggle = async (item) => {
    try {
      await toggleMaintenanceCatalogItem(item.id);
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, is_active: !i.is_active } : i))
      );
      onNotify(isEn ? 'Status updated' : 'Đã cập nhật trạng thái');
    } catch (err) {
      onNotify(isEn ? 'Failed to update status' : 'Không thể cập nhật trạng thái');
    }
  };

  const handleDelete = async (itemId) => {
    if (!window.confirm(isEn ? 'Delete this issue template?' : 'Xóa sự cố mẫu này?')) return;
    try {
      await deleteMaintenanceCatalogItem(itemId);
      setItems((prev) => prev.filter((i) => i.id !== itemId));
      onNotify(isEn ? 'Issue deleted' : 'Đã xóa sự cố');
    } catch (err) {
      onNotify(isEn ? 'Failed to delete issue' : 'Không thể xóa sự cố');
    }
  };

  const handleSaveForm = async (e) => {
    e.preventDefault();
    if (!formData.name_vi.trim() || !formData.name_en.trim()) {
      setFormError(isEn ? 'Please provide both Vietnamese and English names' : 'Vui lòng nhập cả tên tiếng Việt và tiếng Anh');
      return;
    }

    setIsSaving(true);
    setFormError('');
    try {
      if (editingItem) {
        const res = await updateMaintenanceCatalogItem(editingItem.id, formData);
        setItems((prev) => prev.map((i) => (i.id === editingItem.id ? res : i)));
        onNotify(isEn ? 'Issue updated' : 'Đã cập nhật sự cố');
      } else {
        const res = await createMaintenanceCatalogItem(formData);
        setItems((prev) => [res, ...prev]);
        onNotify(isEn ? 'Issue created' : 'Đã thêm sự cố mới');
      }
      setIsFormOpen(false);
    } catch (err) {
      setFormError(isEn ? 'Failed to save issue' : 'Không thể lưu sự cố');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-stone-200 max-w-4xl w-full max-h-[90vh] flex flex-col shadow-xl overflow-hidden font-sans">
        {/* Header */}
        <header className="px-6 py-4 border-b border-stone-200 flex items-center justify-between shrink-0 bg-stone-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-stone-100 border border-stone-200 flex items-center justify-center text-stone-800">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900">
                {isEn ? 'Maintenance Issue Catalog' : 'Danh mục sự cố kỹ thuật mẫu'}
              </h3>
              <p className="text-xs text-stone-500">
                {isEn ? 'Manage bilingual issue templates for Robot Kiosk & Mobile' : 'Quản lý các sự cố thường gặp song ngữ cho Robot và ứng dụng'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenAdd}
              className="px-3.5 py-1.5 rounded-xl bg-stone-900 hover:bg-black text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              {isEn ? 'Add Issue' : 'Thêm sự cố'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl hover:bg-stone-100 text-stone-500 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Content Table */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6">
          {isLoading ? (
            <div className="py-16 flex flex-col items-center justify-center text-stone-400 gap-2">
              <RefreshCw className="w-6 h-6 animate-spin" />
              <p className="text-xs">{isEn ? 'Loading catalog...' : 'Đang tải danh mục...'}</p>
            </div>
          ) : items.length === 0 ? (
            <div className="py-16 text-center text-stone-400">
              <p className="text-sm">{isEn ? 'No issue templates yet' : 'Chưa có sự cố mẫu nào'}</p>
            </div>
          ) : (
            <div className="border border-stone-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">{isEn ? 'Issue Name (VI / EN)' : 'Tên sự cố (VI / EN)'}</th>
                    <th className="py-3 px-4">{isEn ? 'Category' : 'Phân loại'}</th>
                    <th className="py-3 px-4">{isEn ? 'Priority' : 'Độ ưu tiên'}</th>
                    <th className="py-3 px-4">{isEn ? 'Est. Time' : 'Dự kiến'}</th>
                    <th className="py-3 px-4 text-center">{isEn ? 'Status' : 'Trạng thái'}</th>
                    <th className="py-3 px-4 text-right">{isEn ? 'Actions' : 'Thao tác'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-stone-50/50 transition-colors">
                      <td className="py-3 px-4">
                        <p className="font-bold text-stone-900">{item.name_vi}</p>
                        <p className="text-[11px] text-stone-500">{item.name_en}</p>
                      </td>
                      <td className="py-3 px-4 text-stone-700 capitalize">
                        {CATEGORY_OPTIONS.find((c) => c.value === item.category)?.[isEn ? 'labelEn' : 'labelVi'] || item.category}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            item.priority === 'URGENT'
                              ? 'bg-rose-50 text-rose-800 border-rose-200'
                              : item.priority === 'HIGH'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-stone-100 text-stone-800 border-stone-200'
                          }`}
                        >
                          {item.priority}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-stone-600 font-medium">
                        {item.estimated_fix_time || 15} {isEn ? 'mins' : 'phút'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggle(item)}
                          className={`px-2 py-1 rounded-md text-[10px] font-bold border transition-colors cursor-pointer ${
                            item.is_active
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-stone-100 text-stone-400 border-stone-200'
                          }`}
                        >
                          {item.is_active ? (isEn ? 'Active' : 'Hoạt động') : (isEn ? 'Hidden' : 'Tạm ẩn')}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(item)}
                            className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-600 transition-colors cursor-pointer"
                            title={isEn ? 'Edit' : 'Sửa'}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(item.id)}
                            className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-600 transition-colors cursor-pointer"
                            title={isEn ? 'Delete' : 'Xóa'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="px-6 py-3 border-t border-stone-200 bg-stone-50/50 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-stone-200 hover:bg-stone-300 text-stone-800 text-xs font-semibold transition-colors cursor-pointer"
          >
            {isEn ? 'Close' : 'Đóng'}
          </button>
        </footer>
      </div>

      {/* Add / Edit Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-stone-200 max-w-md w-full p-6 shadow-xl space-y-4 font-sans">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <h4 className="text-sm font-bold text-stone-900">
                {editingItem
                  ? isEn ? 'Edit Issue Template' : 'Chỉnh sửa sự cố mẫu'
                  : isEn ? 'Add New Issue Template' : 'Thêm sự cố mẫu mới'}
              </h4>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="w-7 h-7 rounded-lg hover:bg-stone-100 text-stone-500 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-stone-600 mb-1">
                  {isEn ? 'Vietnamese Name' : 'Tên tiếng Việt'} *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name_vi}
                  onChange={(e) => setFormData({ ...formData, name_vi: e.target.value })}
                  placeholder="Ví dụ: Điều hòa không mát"
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-stone-900 focus:outline-none focus:border-stone-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-600 mb-1">
                  {isEn ? 'English Name' : 'Tên tiếng Anh'} *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name_en}
                  onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                  placeholder="e.g. AC not cooling"
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-stone-900 focus:outline-none focus:border-stone-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-stone-600 mb-1">
                    {isEn ? 'Category' : 'Phân loại'}
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-2.5 py-2 text-stone-900 focus:outline-none focus:border-stone-400"
                  >
                    {CATEGORY_OPTIONS.map((c) => (
                      <option key={c.value} value={c.value}>
                        {isEn ? c.labelEn : c.labelVi}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-stone-600 mb-1">
                    {isEn ? 'Priority' : 'Độ ưu tiên'}
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-2.5 py-2 text-stone-900 focus:outline-none focus:border-stone-400"
                  >
                    {PRIORITY_OPTIONS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {isEn ? p.labelEn : p.labelVi}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-600 mb-1">
                  {isEn ? 'Estimated Fix Time (mins)' : 'Thời gian xử lý dự kiến (phút)'}
                </label>
                <input
                  type="number"
                  min="5"
                  max="120"
                  value={formData.estimated_fix_time}
                  onChange={(e) => setFormData({ ...formData, estimated_fix_time: parseInt(e.target.value, 10) || 15 })}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-stone-900 focus:outline-none focus:border-stone-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-600 mb-1">
                  {isEn ? 'Vietnamese Description' : 'Mô tả tiếng Việt'}
                </label>
                <textarea
                  rows={2}
                  value={formData.description_vi}
                  onChange={(e) => setFormData({ ...formData, description_vi: e.target.value })}
                  placeholder="Mô tả hiện tượng sự cố..."
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl p-2.5 text-stone-900 focus:outline-none focus:border-stone-400 resize-none"
                />
              </div>

              {formError && (
                <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-[11px] flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-3 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold"
                >
                  {isEn ? 'Cancel' : 'Hủy'}
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 rounded-xl bg-stone-900 hover:bg-black text-white font-bold disabled:bg-stone-300"
                >
                  {isSaving ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    isEn ? 'Save' : 'Lưu'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

