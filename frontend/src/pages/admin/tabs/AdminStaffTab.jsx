import React, { useState, useEffect, useRef } from 'react';
import { Pagination } from '../../../components/common/Pagination';
import { useLanguage } from '../../../context/LanguageContext';
import {
  fetchStaffRoster,
  fetchDepartments,
  createStaffMember,
  updateStaffMember,
  deleteStaffMember,
} from '../../../services/staffApi';

// Danh sách phòng ban khách sạn chuẩn
const STANDARD_DEPARTMENTS = [
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

export const AdminStaffTab = ({ currentUser }) => {
  const { t, language } = useLanguage();
  const [staffList, setStaffList] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('All');
  const [fallbackFilter, setFallbackFilter] = useState('All');
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
      params.set('tab', params.get('tab') || 'Account');
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

  // Modals
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Department options mapping
  const deptOptions =
    departments.length > 0
      ? departments
      : STANDARD_DEPARTMENTS.map((dept) => ({ id: dept, name: dept, code: dept }));

  const allDepartments = deptOptions.map((d) => d.name);

  // Forms
  const [editForm, setEditForm] = useState({
    full_name: '',
    department: 'Front Desk & Reception',
    department_id: '',
    is_fallback_agent: false,
  });

  const [addForm, setAddForm] = useState({
    username: '',
    password: '123456',
    full_name: '',
    department: 'Front Desk & Reception',
    department_id: '',
    is_fallback_agent: false,
  });

  const showNotification = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [staffData, deptData] = await Promise.all([
        fetchStaffRoster(),
        fetchDepartments(),
      ]);
      setStaffList(staffData || []);
      if (Array.isArray(deptData) && deptData.length > 0) {
        setDepartments(deptData);
      }
    } catch {
      showNotification(t('staffNotifyLoadError'));
    } finally {
      setIsLoading(false);
    }
  };

  const loadStaff = loadData; // Alias to safeguard against legacy references

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (departments.length > 0 && !addForm.department_id) {
      setAddForm((prev) => ({
        ...prev,
        department: departments[0].name,
        department_id: departments[0].id,
      }));
    }
  }, [departments]);

  const handleOpenAddModal = () => {
    const firstDept = deptOptions[0] || { id: '', name: 'Bell Services' };
    setAddForm({
      username: '',
      password: '123456',
      full_name: '',
      department: firstDept.name,
      department_id: firstDept.id,
      is_fallback_agent: false,
    });
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (staff) => {
    setSelectedStaff(staff);
    const matchedDept = deptOptions.find(
      (d) =>
        d.id === staff.department_id ||
        (d.name && (staff.department || '').toLowerCase().includes(d.name.toLowerCase())) ||
        (staff.department && d.name && d.name.toLowerCase().includes(staff.department.toLowerCase())) ||
        d.code === staff.department_id ||
        (d.code && (staff.department || '').toLowerCase().includes(d.code.toLowerCase()))
    );

    setEditForm({
      full_name: staff.full_name || '',
      department: matchedDept ? matchedDept.name : (staff.department || deptOptions[0]?.name || 'Reception'),
      department_id: matchedDept ? matchedDept.id : (staff.department_id || deptOptions[0]?.id || ''),
      is_fallback_agent: !!staff.is_fallback_agent,
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!selectedStaff) return;
    try {
      setIsLoading(true);
      await updateStaffMember(selectedStaff.id, {
        full_name: editForm.full_name.trim(),
        department: editForm.department,
        department_id: editForm.department_id,
        is_fallback_agent: editForm.is_fallback_agent,
      });
      showNotification(t('staffNotifyUpdated').replace('{name}', editForm.full_name));
      setSelectedStaff(null);
      await loadData();
    } catch (err) {
      showNotification(t('staffNotifyUpdateError').replace('{msg}', err.message));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateStaff = async (e) => {
    e.preventDefault();
    const cleanFullName = addForm.full_name.trim();
    const cleanUsername = addForm.username.trim().toLowerCase();

    if (!cleanFullName) {
      showNotification(t('staffNameRequired'));
      return;
    }
    if (!cleanUsername) {
      showNotification(t('staffUsernameRequired'));
      return;
    }

    const targetDept =
      deptOptions.find((d) => d.id === addForm.department_id) ||
      deptOptions.find((d) => d.name === addForm.department) ||
      deptOptions[0] ||
      { id: undefined, name: addForm.department };

    try {
      setIsLoading(true);
      await createStaffMember({
        username: cleanUsername,
        password: addForm.password || '123456',
        full_name: cleanFullName,
        department: targetDept.name,
        department_id: targetDept.id || undefined,
        role: targetDept.name,
        is_fallback_agent: addForm.is_fallback_agent,
        status: 'available',
        location: 'On Site',
      });
      showNotification(t('staffNotifyCreated').replace('{name}', cleanFullName));
      setIsAddModalOpen(false);
      const firstDept = deptOptions[0] || { id: '', name: 'Bell Services' };
      setAddForm({
        username: '',
        password: '123456',
        full_name: '',
        department: firstDept.name,
        department_id: firstDept.id,
        is_fallback_agent: false,
      });
      setSearchQuery(cleanFullName);
      await loadData();
    } catch (err) {
      showNotification(t('staffNotifyCreateError').replace('{msg}', err.message));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (staffId, name) => {
    const targetStaff = staffList.find((s) => s.id === staffId);
    if (
      currentUser &&
      (currentUser.id === staffId ||
        currentUser.username === targetStaff?.username ||
        (targetStaff?.username === 'admin' && currentUser.role?.toLowerCase().includes('admin')))
    ) {
      showNotification(t('staffNotifyDeleteSelf'));
      return;
    }

    if (!window.confirm(t('staffConfirmDelete').replace('{name}', name))) return;
    try {
      setIsLoading(true);
      await deleteStaffMember(staffId);
      showNotification(t('staffNotifyDeleted').replace('{name}', name));
      if (selectedStaff?.id === staffId) setSelectedStaff(null);
      await loadData();
    } catch (err) {
      showNotification(t('staffNotifyDeleteError').replace('{msg}', err.message));
    } finally {
      setIsLoading(false);
    }
  };

  // Filters
  const filteredStaff = staffList.filter((s) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      (s.full_name || '').toLowerCase().includes(q) ||
      (s.username || '').toLowerCase().includes(q) ||
      (s.code || '').toLowerCase().includes(q);

    const staffDept = (s.department || '').toLowerCase();
    const staffDeptId = (s.department_id || '').toLowerCase();
    const filterDept = departmentFilter.toLowerCase();
    const matchesDept =
      departmentFilter === 'All' ||
      staffDeptId === filterDept ||
      staffDept === filterDept ||
      (s.department_rel?.name || '').toLowerCase() === filterDept ||
      (filterDept.length > 3 && (staffDept.includes(filterDept) || filterDept.includes(staffDept)));

    const matchesFallback =
      fallbackFilter === 'All' ||
      (fallbackFilter === 'fallback' && !!s.is_fallback_agent) ||
      (fallbackFilter === 'standard' && !s.is_fallback_agent);

    return matchesSearch && matchesDept && matchesFallback;
  });

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    handlePageChange(1);
  }, [searchQuery, departmentFilter, fallbackFilter]);

  const paginatedStaff = filteredStaff.slice((currentPage - 1) * pageSize, currentPage * pageSize);

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
            {t('staffTabTitle')}
          </h2>
          <p className="text-[10px] sm:text-[11px] font-normal truncate mt-0.5" style={{ color: '#8C8C8C' }}>
            {t('staffTabSubtitle')}
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
          + {t('staffAddBtn')}
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
        placeholder={t('staffSearchPlaceholder')}
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
          {/* Department Filter */}
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium border focus:outline-none cursor-pointer"
            style={{
              backgroundColor: '#FFFFFF',
              borderColor: '#BFBFBD',
              color: '#262626',
            }}
          >
            <option value="All">{t('staffFilterAllDepts')}</option>
            {deptOptions.map((dept) => (
              <option key={dept.id || dept.name} value={dept.id || dept.name}>
                {dept.name}
              </option>
            ))}
          </select>

          {/* Fallback Filter */}
          <select
            value={fallbackFilter}
            onChange={(e) => setFallbackFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium border focus:outline-none cursor-pointer"
            style={{
              backgroundColor: '#FFFFFF',
              borderColor: '#BFBFBD',
              color: '#262626',
            }}
          >
            <option value="All">{t('staffFilterAllTypes')}</option>
            <option value="fallback">{t('staffFilterFallback')}</option>
            <option value="standard">{t('staffFilterStandard')}</option>
          </select>
        </div>
      </div>

      {/* Staff Table */}
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
                          onClick={() => handleOpenEditModal(staff)}
                          className="px-2.5 py-1 rounded text-[11px] font-medium border cursor-pointer hover:opacity-80 transition-all whitespace-nowrap"
                          style={{
                            backgroundColor: '#FFFFFF',
                            borderColor: '#BFBFBD',
                            color: '#262626',
                          }}
                        >
                          {t('staffEditBtn')}
                        </button>
                        <button
                          onClick={() => handleDelete(staff.id, staff.full_name)}
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

        {/* Pagination Footer */}
        <Pagination
          currentPage={currentPage}
          totalItems={filteredStaff.length}
          pageSize={pageSize}
          onPageChange={handlePageChange}
          itemName={t('staffItemName')}
        />
      </div>
      </div>

      {/* MODAL: EDIT STAFF */}
      {selectedStaff && (
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
                {t('staffEditTitle')}
              </h3>
              <button
                onClick={() => setSelectedStaff(null)}
                className="text-xs font-bold px-2 py-1 rounded border cursor-pointer"
                style={{
                  backgroundColor: '#E9E5DC',
                  borderColor: '#BFBFBD',
                  color: '#262626',
                }}
              >
                {t('staffCloseBtn')}
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
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
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderColor: '#BFBFBD',
                    color: '#262626',
                  }}
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold mb-1" style={{ color: '#8C8C8C' }}>
                  {t('staffLabelDept')}
                </label>
                <select
                  value={editForm.department_id || editForm.department}
                  onChange={(e) => {
                    const val = e.target.value;
                    const found = deptOptions.find((d) => d.id === val || d.name === val);
                    setEditForm({
                      ...editForm,
                      department_id: found ? found.id : '',
                      department: found ? found.name : val,
                    });
                  }}
                  className="w-full px-3 py-2 rounded-lg border focus:outline-none cursor-pointer"
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderColor: '#BFBFBD',
                    color: '#262626',
                  }}
                >
                  {deptOptions.map((dept) => (
                    <option key={dept.id || dept.name} value={dept.id || dept.name}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>

              <div
                className="p-3 rounded-lg border flex items-center justify-between"
                style={{
                  backgroundColor: '#E9E5DC',
                  borderColor: '#BFBFBD',
                }}
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
                  onClick={() => setSelectedStaff(null)}
                  className="px-3 py-1.5 rounded-lg border font-medium cursor-pointer"
                  style={{
                    backgroundColor: '#E9E5DC',
                    borderColor: '#BFBFBD',
                    color: '#262626',
                  }}
                >
                  {t('staffCancelBtn')}
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
                  {isLoading ? t('staffSavingBtn') : t('staffSaveBtn')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD NEW STAFF */}
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
                {t('staffAddTitle')}
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
                {t('staffCloseBtn')}
              </button>
            </div>

            <form onSubmit={handleCreateStaff} className="space-y-3 text-xs">
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
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderColor: '#BFBFBD',
                    color: '#262626',
                  }}
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
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderColor: '#BFBFBD',
                      color: '#262626',
                    }}
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
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderColor: '#BFBFBD',
                      color: '#262626',
                    }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold mb-1" style={{ color: '#8C8C8C' }}>
                  {t('staffLabelDept')}
                </label>
                <select
                  value={addForm.department_id || (deptOptions[0]?.id || '')}
                  onChange={(e) => {
                    const val = e.target.value;
                    const found = deptOptions.find((d) => d.id === val || d.name === val);
                    setAddForm({
                      ...addForm,
                      department_id: found ? found.id : val,
                      department: found ? found.name : val,
                    });
                  }}
                  className="w-full px-3 py-2 rounded-lg border focus:outline-none cursor-pointer"
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderColor: '#BFBFBD',
                    color: '#262626',
                  }}
                >
                  {deptOptions.map((dept) => (
                    <option key={dept.id || dept.name} value={dept.id || dept.name}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>

              <div
                className="p-3 rounded-lg border flex items-center justify-between"
                style={{
                  backgroundColor: '#E9E5DC',
                  borderColor: '#BFBFBD',
                }}
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
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border font-medium cursor-pointer"
                  style={{
                    backgroundColor: '#E9E5DC',
                    borderColor: '#BFBFBD',
                    color: '#262626',
                  }}
                >
                  {t('staffCancelBtn')}
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
                  {isLoading ? t('staffCreatingBtn') : t('staffCreateBtn')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
