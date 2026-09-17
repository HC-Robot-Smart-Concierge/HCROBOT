import React, { useState, useEffect, useRef } from 'react';
import { Pagination } from '../../../components/common/Pagination';
import {
  fetchStaffRoster,
  createStaffMember,
  updateStaffMember,
  deleteStaffMember,
} from '../../../services/staffApi';

const DEFAULT_DEPARTMENTS = [
  'Reception',
  'Housekeeping',
  'F&B',
  'Bell Services',
  'Maintenance',
  'Administration',
  'Lễ tân',
  'Buồng phòng',
  'Ẩm thực (F&B)',
  'Kỹ thuật / Bảo trì',
  'CNTT & Vận hành Robot',
  'An ninh',
];

export const AdminStaffTab = () => {
  const [staffList, setStaffList] = useState([]);
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
      params.set('tab', 'Staff');
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

  // Forms
  const [editForm, setEditForm] = useState({
    full_name: '',
    department: 'Reception',
    is_fallback_agent: false,
  });

  const [addForm, setAddForm] = useState({
    username: '',
    password: '123456',
    full_name: '',
    department: 'Reception',
    is_fallback_agent: false,
  });

  const allDepartments = Array.from(
    new Set([
      ...DEFAULT_DEPARTMENTS,
      ...staffList.map((s) => s.department).filter(Boolean),
    ])
  );

  const showNotification = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  const loadStaff = async () => {
    setIsLoading(true);
    try {
      const data = await fetchStaffRoster();
      setStaffList(data || []);
    } catch {
      showNotification('Không thể tải danh sách nhân sự');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStaff();
  }, []);

  const handleOpenEditModal = (staff) => {
    setSelectedStaff(staff);
    setEditForm({
      full_name: staff.full_name || '',
      department: staff.department || 'Reception',
      is_fallback_agent: !!staff.is_fallback_agent,
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!selectedStaff) return;
    try {
      setIsLoading(true);
      await updateStaffMember(selectedStaff.id, {
        full_name: editForm.full_name,
        department: editForm.department,
        is_fallback_agent: editForm.is_fallback_agent,
      });
      showNotification(`Đã cập nhật nhân sự ${editForm.full_name}`);
      setSelectedStaff(null);
      await loadStaff();
    } catch (err) {
      showNotification('Lỗi khi cập nhật: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateStaff = async (e) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      await createStaffMember({
        username: addForm.username.trim(),
        password: addForm.password,
        full_name: addForm.full_name.trim(),
        department: addForm.department,
        role: addForm.department,
        is_fallback_agent: addForm.is_fallback_agent,
        status: 'available',
        shift: 'All Shifts',
        location: 'On Site',
      });
      showNotification(`Đã tạo nhân sự ${addForm.full_name}`);
      setIsAddModalOpen(false);
      setAddForm({
        username: '',
        password: '123456',
        full_name: '',
        department: 'Reception',
        is_fallback_agent: false,
      });
      await loadStaff();
    } catch (err) {
      showNotification('Lỗi khi tạo nhân sự: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (staffId, name) => {
    if (!window.confirm(`Xác nhận xóa nhân sự ${name}?`)) return;
    try {
      setIsLoading(true);
      await deleteStaffMember(staffId);
      showNotification(`Đã xóa nhân sự ${name}`);
      if (selectedStaff?.id === staffId) setSelectedStaff(null);
      await loadStaff();
    } catch (err) {
      showNotification('Lỗi khi xóa: ' + err.message);
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

    const matchesDept =
      departmentFilter === 'All' ||
      (s.department || '').toLowerCase() === departmentFilter.toLowerCase();

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
    <div className="w-full flex flex-col p-4 space-y-3 pb-2" style={{ color: '#262626' }}>
      {/* Toast Notification */}
      {notification && (
        <div
          className="fixed top-5 right-5 z-50 px-4 py-2 rounded-lg border text-xs font-semibold shadow-lg"
          style={{
            backgroundColor: '#262626',
            color: '#F2EFE9',
            borderColor: '#BFBFBD',
          }}
        >
          {notification}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-2.5" style={{ borderColor: '#BFBFBD' }}>
        <div>
          <h2 className="text-base font-bold tracking-tight" style={{ color: '#262626' }}>
            Nhân Sự Tiếp Nhận & Hỗ Trợ Robot
          </h2>
          <p className="text-[11px] font-normal" style={{ color: '#8C8C8C' }}>
            Danh sách nhân sự theo bộ phận để robot chuyển tiếp yêu cầu hoặc gọi hỗ trợ khi cần thiết
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border transition-colors whitespace-nowrap self-start sm:self-auto"
          style={{
            backgroundColor: '#262626',
            color: '#F2EFE9',
            borderColor: '#262626',
          }}
        >
          + Thêm nhân sự
        </button>
      </div>

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
            placeholder="Tìm theo họ tên, username hoặc mã..."
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
            <option value="All">Tất cả bộ phận</option>
            {allDepartments.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
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
            <option value="All">Tất cả loại phân công</option>
            <option value="fallback">Hỗ trợ Robot (Fallback)</option>
            <option value="standard">Tiêu chuẩn</option>
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
                <th className="w-1/4 py-2 px-4 text-left">Nhân sự</th>
                <th className="w-1/4 py-2 px-4 text-center">Bộ phận</th>
                <th className="w-1/4 py-2 px-4 text-center">Hỗ trợ Robot</th>
                <th className="w-1/4 py-2 px-4 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y text-xs" style={{ borderColor: '#E9E5DC' }}>
              {isLoading && paginatedStaff.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center" style={{ color: '#8C8C8C' }}>
                    Đang tải dữ liệu...
                  </td>
                </tr>
              ) : paginatedStaff.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center" style={{ color: '#8C8C8C' }}>
                    Không tìm thấy nhân sự phù hợp.
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
                        {staff.department || 'Chưa phân bộ phận'}
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
                          Hỗ trợ Robot (Fallback)
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
                          Tiêu chuẩn
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
                          Chỉnh sửa
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
                          Xóa
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
          itemName="nhân sự"
        />
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
                Cập nhật nhân sự hỗ trợ
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
                Đóng
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-semibold mb-1" style={{ color: '#8C8C8C' }}>
                  HỌ VÀ TÊN:
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
                  BỘ PHẬN:
                </label>
                <select
                  value={editForm.department}
                  onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border focus:outline-none cursor-pointer"
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderColor: '#BFBFBD',
                    color: '#262626',
                  }}
                >
                  {allDepartments.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
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
                    Tiếp nhận hỗ trợ Robot
                  </div>
                  <div className="text-[11px]" style={{ color: '#8C8C8C' }}>
                    Chuyển tiếp yêu cầu khi Robot Concierge cần hỗ trợ
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
                  Hủy
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
                  {isLoading ? 'Đang lưu...' : 'Lưu thay đổi'}
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
                Thêm nhân sự mới
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
                Đóng
              </button>
            </div>

            <form onSubmit={handleCreateStaff} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold mb-1" style={{ color: '#8C8C8C' }}>
                  HỌ VÀ TÊN:
                </label>
                <input
                  type="text"
                  required
                  value={addForm.full_name}
                  onChange={(e) => setAddForm({ ...addForm, full_name: e.target.value })}
                  placeholder="Ví dụ: Nguyễn Văn An"
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
                    TÊN ĐĂNG NHẬP:
                  </label>
                  <input
                    type="text"
                    required
                    value={addForm.username}
                    onChange={(e) => setAddForm({ ...addForm, username: e.target.value })}
                    placeholder="nguyen_an"
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
                    MẬT KHẨU:
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
                  BỘ PHẬN:
                </label>
                <select
                  value={addForm.department}
                  onChange={(e) => setAddForm({ ...addForm, department: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border focus:outline-none cursor-pointer"
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderColor: '#BFBFBD',
                    color: '#262626',
                  }}
                >
                  {allDepartments.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
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
                    Tiếp nhận hỗ trợ Robot
                  </div>
                  <div className="text-[11px]" style={{ color: '#8C8C8C' }}>
                    Đặt làm nhân sự tiếp nhận khi Robot cần hỗ trợ
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
                  Hủy
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
                  {isLoading ? 'Đang tạo...' : 'Tạo nhân sự'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
