import React from 'react';

// Standard hotel department localizations for bilingual display
export const DEPARTMENT_LOCALIZATIONS = {
  BELL: {
    nameEN: 'Bell Services',
    nameVI: 'Hành Lý & Tiền Sảnh',
    descEN: 'Luggage assistance, luggage storage & lobby guest coordination',
    descVI: 'Bộ phận Hành lý & Tiền sảnh',
  },
  CONCIERGE: {
    nameEN: 'Concierge & Live Support',
    nameVI: 'Trợ Lý Concierge & Kiosk',
    descEN: 'Robot Kiosk Concierge desk & live guest video call assistance',
    descVI: 'Bộ phận Trợ lý Concierge & Live Call Robot Kiosk',
  },
  EXECUTIVE: {
    nameEN: 'Executive & Management',
    nameVI: 'Ban Quản Trị & Điều Hành',
    descEN: 'Hotel executive administration & system operations',
    descVI: 'Ban Quản trị và Điều hành hệ thống khách sạn',
  },
  HOUSEKEEPING: {
    nameEN: 'Housekeeping',
    nameVI: 'Buồng Phòng & Vệ Sinh',
    descEN: 'Room turnover, priority sanitization & robotic cleaning fleet',
    descVI: 'Bộ phận Buồng phòng & Vệ sinh',
  },
  KITCHEN: {
    nameEN: 'Kitchen Operations',
    nameVI: 'Bếp & Chế Biến Ẩm Thực',
    descEN: 'Culinary preparation, order tickets & kitchen dispatch',
    descVI: 'Bộ phận Bếp & Chế biến ẩm thực (Kitchen Operations)',
  },
  MAINTENANCE: {
    nameEN: 'Maintenance & Engineering',
    nameVI: 'Kỹ Thuật & Bảo Trì',
    descEN: 'Facility repair, electrical/mechanical maintenance & troubleshooting',
    descVI: 'Bộ phận Kỹ thuật & Bảo trì sự cố',
  },
  RECEPTION: {
    nameEN: 'Front Desk & Reception',
    nameVI: 'Lễ Tân & Tiếp Đón',
    descEN: 'Guest reception, check-in/out and front desk coordination',
    descVI: 'Bộ phận Lễ tân & Tiếp đón khách hàng',
  },
  ROOMSERVICE: {
    nameEN: 'Room Service & In-Room Dining',
    nameVI: 'Phục Vụ Phòng',
    descEN: 'In-room food & beverage orders delivery and coordination',
    descVI: 'Bộ phận Phục vụ phòng (Room Service)',
  },
  TAXI: {
    nameEN: 'Taxi & Transportation',
    nameVI: 'Vận Chuyển & Đặt Xe',
    descEN: 'Guest transportation, taxi booking & airport shuttles',
    descVI: 'Bộ phận Đặt xe & Vận chuyển đưa đón khách',
  },
};

export const getLocalizedDept = (dept, isEN) => {
  const codeKey = (dept?.code || '').toUpperCase().replace(/^DEP[-_]/, '');
  const idKey = (dept?.id || '').toUpperCase().replace(/^DEP[-_]/, '');
  const config = DEPARTMENT_LOCALIZATIONS[codeKey] || DEPARTMENT_LOCALIZATIONS[idKey];
  if (!config) {
    return {
      displayName: dept?.name || '',
      displayDesc: dept?.description || '',
    };
  }
  return {
    displayName: isEN ? (config.nameEN || dept?.name) : (config.nameVI || dept?.name),
    displayDesc: isEN ? (config.descEN || dept?.description) : (config.descVI || dept?.description),
  };
};

export const AdminEditDepartmentModal = ({
  selectedDept,
  onClose,
  editForm,
  setEditForm,
  onSubmit,
  isLoading,
  t,
}) => {
  if (!selectedDept) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div
        className="max-w-md w-full rounded-2xl border p-6 space-y-4 shadow-xl"
        style={{
          backgroundColor: '#FFFFFF',
          borderColor: '#BFBFBD',
        }}
      >
        <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: '#BFBFBD' }}>
          <h3 className="text-sm font-bold" style={{ color: '#262626' }}>
            {t('deptModalEditTitle')}
          </h3>
          <button
            onClick={onClose}
            className="text-xs font-bold px-2 py-1 rounded border cursor-pointer"
            style={{
              backgroundColor: '#E9E5DC',
              borderColor: '#BFBFBD',
              color: '#262626',
            }}
          >
            {t('deptModalClose')}
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block text-[11px] font-semibold mb-1" style={{ color: '#8C8C8C' }}>
              {t('deptLabelName')}
            </label>
            <input
              type="text"
              required
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border focus:outline-none"
              style={{
                backgroundColor: '#FFFFFF',
                borderColor: '#BFBFBD',
                color: '#262626',
              }}
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold mb-1" style={{ color: '#8C8C8C' }}>
              {t('deptLabelCode')}
            </label>
            <input
              type="text"
              value={editForm.code}
              onChange={(e) => setEditForm({ ...editForm, code: e.target.value.toUpperCase().replace(/\s+/g, '_') })}
              className="w-full px-3 py-2 rounded-lg border focus:outline-none font-mono"
              style={{
                backgroundColor: '#FFFFFF',
                borderColor: '#BFBFBD',
                color: '#262626',
              }}
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold mb-1" style={{ color: '#8C8C8C' }}>
              {t('deptLabelDesc')}
            </label>
            <textarea
              rows={3}
              value={editForm.description}
              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              placeholder={t('deptPlaceholderDesc')}
              className="w-full px-3 py-2 rounded-lg border focus:outline-none resize-none"
              style={{
                backgroundColor: '#FFFFFF',
                borderColor: '#BFBFBD',
                color: '#262626',
              }}
            />
          </div>

          <div
            className="p-3 rounded-lg border flex items-center justify-between"
            style={{
              backgroundColor: '#E9E5DC',
              borderColor: '#BFBFBD',
            }}
          >
            <div>
              <div className="font-semibold text-xs" style={{ color: '#262626' }}>
                {t('deptActiveTitle')}
              </div>
              <div className="text-[11px]" style={{ color: '#8C8C8C' }}>
                {t('deptActiveDescEdit')}
              </div>
            </div>

            <input
              type="checkbox"
              checked={editForm.is_active}
              onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
              className="w-4 h-4 cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t" style={{ borderColor: '#BFBFBD' }}>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg border font-medium cursor-pointer"
              style={{
                backgroundColor: '#E9E5DC',
                borderColor: '#BFBFBD',
                color: '#262626',
              }}
            >
              {t('deptBtnCancel')}
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-1.5 rounded-lg border font-semibold cursor-pointer"
              style={{
                backgroundColor: '#262626',
                borderColor: '#262626',
                color: '#F2EFE9',
              }}
            >
              {isLoading ? t('deptBtnSaving') : t('deptBtnSave')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const AdminAddDepartmentModal = ({
  isOpen,
  onClose,
  addForm,
  setAddForm,
  onSubmit,
  isLoading,
  t,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div
        className="max-w-md w-full rounded-2xl border p-6 space-y-4 shadow-xl"
        style={{
          backgroundColor: '#FFFFFF',
          borderColor: '#BFBFBD',
        }}
      >
        <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: '#BFBFBD' }}>
          <h3 className="text-sm font-bold" style={{ color: '#262626' }}>
            {t('deptModalAddTitle')}
          </h3>
          <button
            onClick={onClose}
            className="text-xs font-bold px-2 py-1 rounded border cursor-pointer"
            style={{
              backgroundColor: '#E9E5DC',
              borderColor: '#BFBFBD',
              color: '#262626',
            }}
          >
            {t('deptModalClose')}
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block text-[11px] font-semibold mb-1" style={{ color: '#8C8C8C' }}>
              {t('deptLabelName')}
            </label>
            <input
              type="text"
              required
              value={addForm.name}
              onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
              placeholder={t('deptPlaceholderAddName')}
              className="w-full px-3 py-2 rounded-lg border focus:outline-none"
              style={{
                backgroundColor: '#FFFFFF',
                borderColor: '#BFBFBD',
                color: '#262626',
              }}
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold mb-1" style={{ color: '#8C8C8C' }}>
              {t('deptLabelCodeAdd')}
            </label>
            <input
              type="text"
              value={addForm.code}
              onChange={(e) => setAddForm({ ...addForm, code: e.target.value.toUpperCase().replace(/\s+/g, '_') })}
              placeholder={t('deptPlaceholderAddCode')}
              className="w-full px-3 py-2 rounded-lg border focus:outline-none font-mono"
              style={{
                backgroundColor: '#FFFFFF',
                borderColor: '#BFBFBD',
                color: '#262626',
              }}
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold mb-1" style={{ color: '#8C8C8C' }}>
              {t('deptLabelDesc')}
            </label>
            <textarea
              rows={3}
              value={addForm.description}
              onChange={(e) => setAddForm({ ...addForm, description: e.target.value })}
              placeholder={t('deptPlaceholderDesc')}
              className="w-full px-3 py-2 rounded-lg border focus:outline-none resize-none"
              style={{
                backgroundColor: '#FFFFFF',
                borderColor: '#BFBFBD',
                color: '#262626',
              }}
            />
          </div>

          <div
            className="p-3 rounded-lg border flex items-center justify-between"
            style={{
              backgroundColor: '#E9E5DC',
              borderColor: '#BFBFBD',
            }}
          >
            <div>
              <div className="font-semibold text-xs" style={{ color: '#262626' }}>
                {t('deptActiveTitle')}
              </div>
              <div className="text-[11px]" style={{ color: '#8C8C8C' }}>
                {t('deptActiveDescAdd')}
              </div>
            </div>

            <input
              type="checkbox"
              checked={addForm.is_active}
              onChange={(e) => setAddForm({ ...addForm, is_active: e.target.checked })}
              className="w-4 h-4 cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t" style={{ borderColor: '#BFBFBD' }}>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg border font-medium cursor-pointer"
              style={{
                backgroundColor: '#E9E5DC',
                borderColor: '#BFBFBD',
                color: '#262626',
              }}
            >
              {t('deptBtnCancel')}
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-1.5 rounded-lg border font-semibold cursor-pointer"
              style={{
                backgroundColor: '#262626',
                borderColor: '#262626',
                color: '#F2EFE9',
              }}
            >
              {isLoading ? t('deptBtnCreating') : t('deptBtnCreate')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
