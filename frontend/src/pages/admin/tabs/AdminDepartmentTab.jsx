import React, { useState, useEffect, useRef } from 'react';
import { Pagination } from '../../../components/common/Pagination';
import { useLanguage } from '../../../context/LanguageContext';
import {
  fetchDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} from '../../../services/departmentApi';

// Standard hotel department localizations for bilingual display
const DEPARTMENT_LOCALIZATIONS = {
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

const getLocalizedDept = (dept, isEN) => {
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

export const AdminDepartmentTab = ({ currentUser }) => {
  const { t, language } = useLanguage();
  const isEN = language === 'EN';
  const [departments, setDepartments] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [notification, setNotification] = useState(null);

  const [currentPage, setCurrentPage] = useState(() => {
    try {
      const p = parseInt(new URLSearchParams(window.location.search).get('page'), 10);
      return !isNaN(p) && p > 0 ? p : 1;
    } catch {
      return 1;
    }
  });
  const pageSize = 7;

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
    try {
      const params = new URLSearchParams(window.location.search);
      params.set('tab', 'Department');
      params.set('page', newPage.toString());
      window.history.pushState(null, '', `${window.location.pathname}?${params.toString()}`);
    } catch {}
  };

  useEffect(() => {
    const onPopState = () => {
      try {
        const p = parseInt(new URLSearchParams(window.location.search).get('page'), 10);
        if (!isNaN(p) && p > 0) setCurrentPage(p);
      } catch {}
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Modals state
  const [selectedDept, setSelectedDept] = useState(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Forms state
  const [editForm, setEditForm] = useState({
    name: '',
    code: '',
    description: '',
    is_active: true,
  });

  const [addForm, setAddForm] = useState({
    name: '',
    code: '',
    description: '',
    is_active: true,
  });

  const showNotification = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await fetchDepartments(null); // Fetch all including inactive
      setDepartments(Array.isArray(data) ? data : []);
    } catch {
      showNotification(t('deptNotifyLoadError'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenAddModal = () => {
    setAddForm({
      name: '',
      code: '',
      description: '',
      is_active: true,
    });
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (dept) => {
    setSelectedDept(dept);
    setEditForm({
      name: dept.name || '',
      code: dept.code || '',
      description: dept.description || '',
      is_active: dept.is_active !== false,
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!selectedDept) return;
    const cleanName = editForm.name.trim();
    if (!cleanName) {
      showNotification(t('deptNotifyNameRequired'));
      return;
    }

    try {
      setIsLoading(true);
      await updateDepartment(selectedDept.id, {
        name: cleanName,
        code: editForm.code ? editForm.code.trim().toUpperCase() : undefined,
        description: editForm.description ? editForm.description.trim() : '',
        is_active: editForm.is_active,
      });
      showNotification(t('deptNotifyUpdated').replace('{name}', cleanName));
      setSelectedDept(null);
      await loadData();
    } catch (err) {
      showNotification(t('deptNotifyUpdateError').replace('{msg}', err.message));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateDepartment = async (e) => {
    e.preventDefault();
    const cleanName = addForm.name.trim();
    if (!cleanName) {
      showNotification(t('deptNotifyNameRequired'));
      return;
    }

    try {
      setIsLoading(true);
      await createDepartment({
        name: cleanName,
        code: addForm.code ? addForm.code.trim().toUpperCase() : undefined,
        description: addForm.description ? addForm.description.trim() : '',
        is_active: addForm.is_active,
      });
      showNotification(t('deptNotifyCreated').replace('{name}', cleanName));
      setIsAddModalOpen(false);
      setAddForm({
        name: '',
        code: '',
        description: '',
        is_active: true,
      });
      setSearchQuery(cleanName);
      await loadData();
    } catch (err) {
      showNotification(t('deptNotifyCreateError').replace('{msg}', err.message));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (deptId, name) => {
    const confirmMsg = t('deptNotifyConfirmDeactivate').replace('{name}', name);
    if (!window.confirm(confirmMsg)) return;
    try {
      setIsLoading(true);
      await deleteDepartment(deptId);
      showNotification(t('deptNotifyDeactivated').replace('{name}', name));
      if (selectedDept?.id === deptId) setSelectedDept(null);
      await loadData();
    } catch (err) {
      showNotification(t('deptNotifyDeactivateError').replace('{msg}', err.message));
    } finally {
      setIsLoading(false);
    }
  };

  // Filter departments
  const filteredDepartments = departments.filter((d) => {
    const q = searchQuery.toLowerCase().trim();
    const { displayName, displayDesc } = getLocalizedDept(d, isEN);
    const matchesSearch =
      !q ||
      (d.name || '').toLowerCase().includes(q) ||
      displayName.toLowerCase().includes(q) ||
      (d.code || '').toLowerCase().includes(q) ||
      (d.id || '').toLowerCase().includes(q) ||
      (d.description || '').toLowerCase().includes(q) ||
      displayDesc.toLowerCase().includes(q);

    const matchesStatus =
      statusFilter === 'All' ||
      (statusFilter === 'active' && !!d.is_active) ||
      (statusFilter === 'inactive' && !d.is_active);

    return matchesSearch && matchesStatus;
  });

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    handlePageChange(1);
  }, [searchQuery, statusFilter]);

  const paginatedDepartments = filteredDepartments.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <div className="w-full flex flex-col min-h-full pb-4" style={{ color: '#262626' }}>
      {/* Toast Notification */}
      {notification && (
        <div
          className="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-xl border text-xs font-semibold shadow-2xl animate-in fade-in slide-in-from-bottom-3"
          style={{
            backgroundColor: '#262626',
            color: '#F2EFE9',
            borderColor: '#BFBFBD',
          }}
        >
          {notification}
        </div>
      )}

      {/* Header Bar - seamlessly aligned with sidebar brand header */}
      <div
        className="h-16 px-5 border-b flex items-center justify-between gap-4 shrink-0 sticky top-0 z-20"
        style={{ borderColor: '#BFBFBD', backgroundColor: '#F2EFE9' }}
      >
        <div className="min-w-0">
          <h2 className="text-sm sm:text-base font-bold tracking-tight leading-tight truncate" style={{ color: '#262626' }}>
            {t('deptTabTitle')}
          </h2>
          <p className="text-[10px] sm:text-[11px] font-normal truncate mt-0.5" style={{ color: '#8C8C8C' }}>
            {t('deptTabSubtitle')}
          </p>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border transition-colors whitespace-nowrap shrink-0 hover:bg-[#262626]/90"
          style={{
            backgroundColor: '#262626',
            color: '#F2EFE9',
            borderColor: '#262626',
          }}
        >
          + {t('deptAddBtn')}
        </button>
      </div>

      {/* Content Body */}
      <div className="p-4 space-y-3">
        {/* Controls: Search & Filters */}
        <div
          className="p-2.5 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-2.5"
          style={{
            backgroundColor: '#E9E5DC',
            borderColor: '#BFBFBD',
          }}
        >
          {/* Search */}
          <div className="w-full sm:w-72">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('deptSearchPlaceholder')}
              className="w-full px-3 py-1.5 rounded-lg text-xs font-normal border focus:outline-none"
              style={{
                backgroundColor: '#FFFFFF',
                borderColor: '#BFBFBD',
                color: '#262626',
              }}
            />
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium border focus:outline-none cursor-pointer"
              style={{
                backgroundColor: '#FFFFFF',
                borderColor: '#BFBFBD',
                color: '#262626',
              }}
            >
              <option value="All">{t('deptFilterAllStatus')}</option>
              <option value="active">{t('deptFilterActive')}</option>
              <option value="inactive">{t('deptFilterInactive')}</option>
            </select>
          </div>
        </div>

        {/* Department Table */}
        <div
          className="rounded-xl border overflow-hidden shadow-none"
          style={{
            backgroundColor: '#FFFFFF',
            borderColor: '#BFBFBD',
          }}
        >
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
                  <th className="w-[28%] py-2 px-4 text-left">{t('deptColName')}</th>
                  <th className="w-[34%] py-2 px-4 text-left">{t('deptColDesc')}</th>
                  <th className="w-[14%] py-2 px-4 text-center">{t('deptColScale')}</th>
                  <th className="w-[12%] py-2 px-4 text-center">{t('deptColStatus')}</th>
                  <th className="w-[12%] py-2 px-4 text-center">{t('deptColActions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y text-xs" style={{ borderColor: '#E9E5DC' }}>
                {isLoading && paginatedDepartments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center" style={{ color: '#8C8C8C' }}>
                      {t('deptLoading')}
                    </td>
                  </tr>
                ) : paginatedDepartments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center" style={{ color: '#8C8C8C' }}>
                      {t('deptEmpty')}
                    </td>
                  </tr>
                ) : (
                  paginatedDepartments.map((dept) => {
                    const { displayName, displayDesc } = getLocalizedDept(dept, isEN);
                    return (
                      <tr
                        key={dept.id}
                        className="transition-colors hover:bg-[#F2EFE9]/40"
                        style={{ borderBottom: '1px solid #E9E5DC' }}
                      >
                        {/* Column 1: Department Name & Code */}
                        <td className="w-[28%] py-2 px-4 text-left">
                          <div className="font-semibold text-xs truncate" style={{ color: '#262626' }}>
                            {displayName}
                          </div>
                          <div className="text-[11px] font-mono truncate" style={{ color: '#8C8C8C' }}>
                            {dept.id || `@${dept.code}`}
                          </div>
                        </td>

                        {/* Column 2: Description */}
                        <td className="w-[34%] py-2 px-4 text-left">
                          <p className="text-xs text-stone-600 line-clamp-2" title={displayDesc || t('deptNoDesc')}>
                            {displayDesc || (
                              <span className="italic" style={{ color: '#8C8C8C' }}>
                                {t('deptNoDesc')}
                              </span>
                            )}
                          </p>
                        </td>

                        {/* Column 3: Staff Count */}
                        <td className="w-[14%] py-2 px-4 text-center">
                          <span
                            className="inline-flex items-center justify-center px-2.5 py-1 rounded text-[11px] font-medium border text-center"
                            style={{
                              backgroundColor: '#E9E5DC',
                              borderColor: '#BFBFBD',
                              color: '#262626',
                            }}
                          >
                            {dept.staff_count ?? 0} {t('deptStaffUnit')}
                          </span>
                        </td>

                        {/* Column 4: Status */}
                        <td className="w-[12%] py-2 px-4 text-center">
                          {dept.is_active ? (
                            <span
                              className="inline-flex items-center justify-center px-2 py-0.5 rounded text-[10px] font-semibold border"
                              style={{
                                backgroundColor: '#262626',
                                color: '#F2EFE9',
                                borderColor: '#262626',
                              }}
                            >
                              {t('deptStatusActive')}
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center justify-center px-2 py-0.5 rounded text-[10px] font-medium border"
                              style={{
                                backgroundColor: '#FFFFFF',
                                borderColor: '#BFBFBD',
                                color: '#8C8C8C',
                              }}
                            >
                              {t('deptStatusInactive')}
                            </span>
                          )}
                        </td>

                        {/* Column 5: Actions */}
                        <td className="w-[12%] py-2 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleOpenEditModal(dept)}
                              className="px-2 py-1 rounded text-[11px] font-medium border cursor-pointer hover:opacity-80 transition-all whitespace-nowrap"
                              style={{
                                backgroundColor: '#FFFFFF',
                                borderColor: '#BFBFBD',
                                color: '#262626',
                              }}
                            >
                              {t('deptBtnEdit')}
                            </button>
                            <button
                              onClick={() => handleDelete(dept.id, displayName || dept.name)}
                              className="px-2 py-1 rounded text-[11px] font-medium border cursor-pointer hover:bg-red-50 hover:border-red-300 hover:text-red-700 transition-all whitespace-nowrap"
                              style={{
                                backgroundColor: '#FFFFFF',
                                borderColor: '#BFBFBD',
                                color: '#8C8C8C',
                              }}
                            >
                              {t('deptBtnDelete')}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <Pagination
            currentPage={currentPage}
            totalItems={filteredDepartments.length}
            pageSize={pageSize}
            onPageChange={handlePageChange}
            itemName={t('deptItemName')}
          />
        </div>
      </div>

      {/* MODAL: EDIT DEPARTMENT */}
      {selectedDept && (
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
                onClick={() => setSelectedDept(null)}
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

            <form onSubmit={handleSaveEdit} className="space-y-3.5 text-xs">
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
                  onClick={() => setSelectedDept(null)}
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
      )}

      {/* MODAL: ADD NEW DEPARTMENT */}
      {isAddModalOpen && (
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
                onClick={() => setIsAddModalOpen(false)}
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

            <form onSubmit={handleCreateDepartment} className="space-y-3.5 text-xs">
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
                  onClick={() => setIsAddModalOpen(false)}
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
      )}
    </div>
  );
};
