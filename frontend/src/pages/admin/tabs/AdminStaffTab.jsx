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

import {
  STANDARD_DEPARTMENTS,
  AdminStaffTable,
  AdminEditStaffModal,
  AdminAddStaffModal,
} from './AdminStaffModalsAndTable';

export { STANDARD_DEPARTMENTS };

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
        <AdminStaffTable
          t={t}
          isLoading={isLoading}
          paginatedStaff={paginatedStaff}
          onEditStaff={handleOpenEditModal}
          onDeleteStaff={handleDelete}
        />

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

      <AdminEditStaffModal
        selectedStaff={selectedStaff}
        onClose={() => setSelectedStaff(null)}
        editForm={editForm}
        setEditForm={setEditForm}
        deptOptions={deptOptions}
        onSubmit={handleSaveEdit}
        isLoading={isLoading}
        t={t}
      />

      <AdminAddStaffModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        addForm={addForm}
        setAddForm={setAddForm}
        deptOptions={deptOptions}
        onSubmit={handleCreateStaff}
        isLoading={isLoading}
        t={t}
      />
    </div>
  );
};
