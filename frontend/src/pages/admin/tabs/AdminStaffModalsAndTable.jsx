import React from 'react';

// Danh sách phòng ban khách sạn chuẩn
export const STANDARD_DEPARTMENTS = [
  'Reception',
  'Housekeeping',
  'Food & Beverage',
  'Bell Services',
  'Maintenance',
  'Restaurant',
  'Taxi',
  'Concierge',
  'Executive',
];

const INPUT_STYLE = {
  backgroundColor: '#FFFFFF',
  borderColor: '#BFBFBD',
  color: '#262626',
};

const StaffDepartmentSelect = ({ value, onSelectDept, deptOptions, t }) => (
  <div>
    <label className="block text-[11px] font-semibold mb-1" style={{ color: '#8C8C8C' }}>
      {t('staffLabelDept')}
    </label>
    <select
      value={value}
      onChange={(e) => {
        const val = e.target.value;
        const found = deptOptions.find((d) => d.id === val || d.name === val);
        onSelectDept(found, val);
      }}
      className="w-full px-3 py-2 rounded-lg border focus:outline-none cursor-pointer"
      style={INPUT_STYLE}
    >
      {deptOptions.map((dept) => (
        <option key={dept.id || dept.name} value={dept.id || dept.name}>
          {dept.name}
        </option>
      ))}
    </select>
  </div>
);

export const AdminStaffTable = ({
  t,
  isLoading,
  paginatedStaff,
  onEditStaff,
  onDeleteStaff,
}) => (
  <div className="overflow-x-auto">
    <table className="w-full table-fixed text-left border-collapse">
      <thead>
        <tr
          className="border-b text-[11px] font-semibold uppercase tracking-wider"
          style={{
            backgroundColor: '#E9E5DC',
            borderColor: '#BFBFBD',
            color: '#262626',
          }}
        >
          <th className="w-1/4 py-2 px-4 text-left">{t('staffColAccount')}</th>
          <th className="w-1/4 py-2 px-4 text-center">{t('staffColDept')}</th>
          <th className="w-1/4 py-2 px-4 text-center">{t('staffColRobotSupport')}</th>
          <th className="w-1/4 py-2 px-4 text-center">{t('staffColActions')}</th>
        </tr>
      </thead>
      <tbody className="divide-y text-xs" style={{ borderColor: '#E9E5DC' }}>
        {isLoading && paginatedStaff.length === 0 ? (
          <tr>
            <td colSpan={4} className="py-6 text-center" style={{ color: '#8C8C8C' }}>
              {t('staffLoading')}
            </td>
          </tr>
        ) : paginatedStaff.length === 0 ? (
          <tr>
            <td colSpan={4} className="py-6 text-center" style={{ color: '#8C8C8C' }}>
              {t('staffEmpty')}
            </td>
          </tr>
        ) : (
          paginatedStaff.map((staff) => (
            <tr
              key={staff.id}
              className="transition-colors hover:bg-[#F2EFE9]/40"
              style={{ borderBottom: '1px solid #E9E5DC' }}
            >
              {/* Column 1: Staff Name & ID (25%) */}
              <td className="w-1/4 py-2 px-4 text-left">
                <div className="font-semibold text-xs truncate" style={{ color: '#262626' }}>
                  {staff.full_name}
                </div>
                <div className="text-[11px] font-mono truncate" style={{ color: '#8C8C8C' }}>
                  {staff.username ? `@${staff.username}` : staff.code || staff.id}
                </div>
              </td>

              {/* Column 2: Department (25%) */}
              <td className="w-1/4 py-2 px-4 text-center">
                <span
                  className="inline-flex items-center justify-center w-40 px-2 py-1 rounded text-[11px] font-medium border text-center truncate"
                  style={{
                    backgroundColor: '#E9E5DC',
                    borderColor: '#BFBFBD',
                    color: '#262626',
                  }}
                >
                  {staff.department || t('staffNoDept')}
                </span>
              </td>

              {/* Column 3: Robot Escalation (25%) */}
              <td className="w-1/4 py-2 px-4 text-center">
                {staff.is_fallback_agent ? (
                  <span
                    className="inline-flex items-center justify-center w-40 px-2 py-1 rounded text-[11px] font-semibold border text-center truncate"
                    style={{
                      backgroundColor: '#262626',
                      color: '#F2EFE9',
                      borderColor: '#262626',
                    }}
                  >
                    {t('staffFallbackBadge')}
                  </span>
                ) : (
                  <span
                    className="inline-flex items-center justify-center w-40 px-2 py-1 rounded text-[11px] font-medium border text-center truncate"
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderColor: '#BFBFBD',
                      color: '#8C8C8C',
                    }}
                  >
                    {t('staffStandardBadge')}
                  </span>
                )}
              </td>

              {/* Column 4: Actions (25%) */}
              <td className="w-1/4 py-2 px-4 text-center">
                <div className="flex items-center justify-center gap-1.5">
                  <button
                    onClick={() => onEditStaff(staff)}
                    className="px-2.5 py-1 rounded text-[11px] font-medium border cursor-pointer hover:opacity-80 transition-all whitespace-nowrap"
                    style={INPUT_STYLE}
                  >
                    {t('staffEditBtn')}
                  </button>
                  <button
                    onClick={() => onDeleteStaff(staff.id, staff.full_name)}
                    className="px-2.5 py-1 rounded text-[11px] font-medium border cursor-pointer hover:bg-red-50 hover:border-red-300 hover:text-red-700 transition-all whitespace-nowrap"
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderColor: '#BFBFBD',
                      color: '#8C8C8C',
                    }}
                  >
                    {t('staffDeleteBtn')}
                  </button>
                </div>
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  </div>
);

export const AdminEditStaffModal = ({
  selectedStaff,
  onClose,
  editForm,
  setEditForm,
  deptOptions,
  onSubmit,
  isLoading,
  t,
}) => {
  if (!selectedStaff) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div
        className="max-w-md w-full rounded-2xl border p-6 space-y-4 shadow-xl"
        style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD' }}
      >
        <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: '#BFBFBD' }}>
          <h3 className="text-sm font-bold" style={{ color: '#262626' }}>
            {t('staffEditTitle')}
          </h3>
          <button
            onClick={onClose}
            className="text-xs font-bold px-2 py-1 rounded border cursor-pointer"
            style={{ backgroundColor: '#E9E5DC', borderColor: '#BFBFBD', color: '#262626' }}
          >
            {t('staffCloseBtn')}
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-[11px] font-semibold mb-1" style={{ color: '#8C8C8C' }}>
              {t('staffLabelFullName')}
            </label>
            <input
              type="text"
              required
              value={editForm.full_name}
              onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border focus:outline-none"
              style={INPUT_STYLE}
            />
          </div>

          <StaffDepartmentSelect
            value={editForm.department_id || editForm.department}
            onSelectDept={(found, val) =>
              setEditForm({
                ...editForm,
                department_id: found ? found.id : '',
                department: found ? found.name : val,
              })
            }
            deptOptions={deptOptions}
            t={t}
          />

          <div
            className="p-3 rounded-lg border flex items-center justify-between"
            style={{ backgroundColor: '#E9E5DC', borderColor: '#BFBFBD' }}
          >
            <div className="pr-3">
              <div className="font-semibold text-xs" style={{ color: '#262626' }}>
                {t('staffRobotSupportTitle')}
              </div>
              <div className="text-[11px]" style={{ color: '#8C8C8C' }}>
                {t('staffRobotSupportDesc')}
              </div>
            </div>

            <input
              type="checkbox"
              checked={editForm.is_fallback_agent}
              onChange={(e) => setEditForm({ ...editForm, is_fallback_agent: e.target.checked })}
              className="w-4 h-4 cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t" style={{ borderColor: '#BFBFBD' }}>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg border font-medium cursor-pointer"
              style={{ backgroundColor: '#E9E5DC', borderColor: '#BFBFBD', color: '#262626' }}
            >
              {t('staffCancelBtn')}
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-1.5 rounded-lg border font-semibold cursor-pointer"
              style={{ backgroundColor: '#262626', borderColor: '#262626', color: '#F2EFE9' }}
            >
              {isLoading ? t('staffSavingBtn') : t('staffSaveBtn')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const AdminAddStaffModal = ({
  isOpen,
  onClose,
  addForm,
  setAddForm,
  deptOptions,
  onSubmit,
  isLoading,
  t,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div
        className="max-w-md w-full rounded-2xl border p-6 space-y-4 shadow-xl"
        style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD' }}
      >
        <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: '#BFBFBD' }}>
          <h3 className="text-sm font-bold" style={{ color: '#262626' }}>
            {t('staffAddTitle')}
          </h3>
          <button
            onClick={onClose}
            className="text-xs font-bold px-2 py-1 rounded border cursor-pointer"
            style={{ backgroundColor: '#E9E5DC', borderColor: '#BFBFBD', color: '#262626' }}
          >
            {t('staffCloseBtn')}
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block text-[11px] font-semibold mb-1" style={{ color: '#8C8C8C' }}>
              {t('staffLabelFullName')}
            </label>
            <input
              type="text"
              required
              value={addForm.full_name}
              onChange={(e) => setAddForm({ ...addForm, full_name: e.target.value })}
              placeholder={t('staffFullNamePlaceholder')}
              className="w-full px-3 py-2 rounded-lg border focus:outline-none"
              style={INPUT_STYLE}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold mb-1" style={{ color: '#8C8C8C' }}>
                {t('staffLabelUsername')}
              </label>
              <input
                type="text"
                required
                value={addForm.username}
                onChange={(e) =>
                  setAddForm({
                    ...addForm,
                    username: e.target.value.toLowerCase().replace(/\s+/g, '_'),
                  })
                }
                placeholder={t('staffUsernamePlaceholder')}
                className="w-full px-3 py-2 rounded-lg border focus:outline-none font-mono"
                style={INPUT_STYLE}
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold mb-1" style={{ color: '#8C8C8C' }}>
                {t('staffLabelPassword')}
              </label>
              <input
                type="password"
                required
                value={addForm.password}
                onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border focus:outline-none font-mono"
                style={INPUT_STYLE}
              />
            </div>
          </div>

          <StaffDepartmentSelect
            value={addForm.department_id || (deptOptions[0]?.id || '')}
            onSelectDept={(found, val) =>
              setAddForm({
                ...addForm,
                department_id: found ? found.id : val,
                department: found ? found.name : val,
              })
            }
            deptOptions={deptOptions}
            t={t}
          />

          <div
            className="p-3 rounded-lg border flex items-center justify-between"
            style={{ backgroundColor: '#E9E5DC', borderColor: '#BFBFBD' }}
          >
            <div className="pr-3">
              <div className="font-semibold text-xs" style={{ color: '#262626' }}>
                {t('staffRobotSupportTitle')}
              </div>
              <div className="text-[11px]" style={{ color: '#8C8C8C' }}>
                {t('staffRobotSupportDescAdd')}
              </div>
            </div>

            <input
              type="checkbox"
              checked={addForm.is_fallback_agent}
              onChange={(e) => setAddForm({ ...addForm, is_fallback_agent: e.target.checked })}
              className="w-4 h-4 cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t" style={{ borderColor: '#BFBFBD' }}>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg border font-medium cursor-pointer"
              style={{ backgroundColor: '#E9E5DC', borderColor: '#BFBFBD', color: '#262626' }}
            >
              {t('staffCancelBtn')}
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-1.5 rounded-lg border font-semibold cursor-pointer"
              style={{ backgroundColor: '#262626', borderColor: '#262626', color: '#F2EFE9' }}
            >
              {isLoading ? t('staffCreatingBtn') : t('staffCreateBtn')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
