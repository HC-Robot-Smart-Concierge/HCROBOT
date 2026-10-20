import React, { useState, useEffect, useRef } from 'react';
import { Pagination } from '../../../components/common/Pagination';
import {
  fetchDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} from '../../../services/departmentApi';

export const AdminDepartmentTab = ({ currentUser }) => {
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
      showNotification('Không thể tải danh sách bộ phận');
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
      showNotification('Vui lòng nhập tên bộ phận');
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
      showNotification(`Đã cập nhật bộ phận ${cleanName}`);
      setSelectedDept(null);
      await loadData();
    } catch (err) {
      showNotification('Lỗi khi cập nhật: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateDepartment = async (e) => {
    e.preventDefault();
    const cleanName = addForm.name.trim();
    if (!cleanName) {
      showNotification('Vui lòng nhập tên bộ phận');
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
      showNotification(`Đã tạo thành công bộ phận ${cleanName}`);
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
      showNotification('Lỗi khi tạo bộ phận: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (deptId, name) => {
    if (!window.confirm(`Xác nhận vô hiệu hóa bộ phận "${name}"?`)) return;
    try {
      setIsLoading(true);
      await deleteDepartment(deptId);
      showNotification(`Đã vô hiệu hóa bộ phận ${name}`);
      if (selectedDept?.id === deptId) setSelectedDept(null);
      await loadData();
    } catch (err) {
      showNotification('Lỗi khi vô hiệu hóa: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter departments
  const filteredDepartments = departments.filter((d) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      (d.name || '').toLowerCase().includes(q) ||
      (d.code || '').toLowerCase().includes(q) ||
      (d.id || '').toLowerCase().includes(q) ||
      (d.description || '').toLowerCase().includes(q);

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
            Quản Lý Bộ Phận Khách Sạn
          </h2>
          <p className="text-[10px] sm:text-[11px] font-normal truncate mt-0.5" style={{ color: '#8C8C8C' }}>
            Danh sách các bộ phận và phòng ban vận hành kết nối điều phối nhiệm vụ và tiếp nhận hỗ trợ Robot
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
          + Thêm bộ phận
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
              placeholder="Tìm theo tên, mã code hoặc mô tả..."
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
              <option value="All">Tất cả trạng thái</option>
              <option value="active">Đang hoạt động</option>
              <option value="inactive">Tạm ngưng</option>
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
                  <th className="w-[28%] py-2 px-4 text-left">Bộ phận</th>
                  <th className="w-[34%] py-2 px-4 text-left">Mô tả nhiệm vụ</th>
                  <th className="w-[14%] py-2 px-4 text-center">Quy mô</th>
                  <th className="w-[12%] py-2 px-4 text-center">Trạng thái</th>
                  <th className="w-[12%] py-2 px-4 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y text-xs" style={{ borderColor: '#E9E5DC' }}>
                {isLoading && paginatedDepartments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center" style={{ color: '#8C8C8C' }}>
                      Đang tải dữ liệu...
                    </td>
                  </tr>
                ) : paginatedDepartments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center" style={{ color: '#8C8C8C' }}>
                      Không tìm thấy bộ phận phù hợp.
                    </td>
                  </tr>
                ) : (
                  paginatedDepartments.map((dept) => (
                    <tr
                      key={dept.id}
                      className="transition-colors hover:bg-[#F2EFE9]/40"
                      style={{ borderBottom: '1px solid #E9E5DC' }}
                    >
                      {/* Column 1: Department Name & Code */}
                      <td className="w-[28%] py-2 px-4 text-left">
                        <div className="font-semibold text-xs truncate" style={{ color: '#262626' }}>
                          {dept.name}
                        </div>
                        <div className="text-[11px] font-mono truncate" style={{ color: '#8C8C8C' }}>
                          {dept.id || `@${dept.code}`}
                        </div>
                      </td>

                      {/* Column 2: Description */}
                      <td className="w-[34%] py-2 px-4 text-left">
                        <p className="text-xs text-stone-600 line-clamp-2" title={dept.description || 'Chưa có mô tả'}>
                          {dept.description || (
                            <span className="italic" style={{ color: '#8C8C8C' }}>
                              Chưa có mô tả nhiệm vụ
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
                          {dept.staff_count ?? 0} nhân sự
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
                            Hoạt động
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
                            Tạm ngưng
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
                            Chỉnh sửa
                          </button>
                          <button
                            onClick={() => handleDelete(dept.id, dept.name)}
                            className="px-2 py-1 rounded text-[11px] font-medium border cursor-pointer hover:bg-red-50 hover:border-red-300 hover:text-red-700 transition-all whitespace-nowrap"
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
            totalItems={filteredDepartments.length}
            pageSize={pageSize}
            onPageChange={handlePageChange}
            itemName="bộ phận"
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
                Cập nhật thông tin bộ phận
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
                Đóng
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[11px] font-semibold mb-1" style={{ color: '#8C8C8C' }}>
                  TÊN BỘ PHẬN:
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
                  MÃ CODE:
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
                  MÔ TẢ NHIỆM VỤ:
                </label>
                <textarea
                  rows={3}
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  placeholder="Mô tả chức năng nhiệm vụ của bộ phận..."
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
                    Trạng thái hoạt động
                  </div>
                  <div className="text-[11px]" style={{ color: '#8C8C8C' }}>
                    Cho phép điều phối công việc và tiếp nhận nhiệm vụ
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
                Thêm bộ phận mới
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

            <form onSubmit={handleCreateDepartment} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[11px] font-semibold mb-1" style={{ color: '#8C8C8C' }}>
                  TÊN BỘ PHẬN:
                </label>
                <input
                  type="text"
                  required
                  value={addForm.name}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                  placeholder="Ví dụ: Security & Loss Prevention"
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
                  MÃ CODE (TÙY CHỌN):
                </label>
                <input
                  type="text"
                  value={addForm.code}
                  onChange={(e) => setAddForm({ ...addForm, code: e.target.value.toUpperCase().replace(/\s+/g, '_') })}
                  placeholder="SECURITY (để trống sẽ tự động sinh)"
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
                  MÔ TẢ NHIỆM VỤ:
                </label>
                <textarea
                  rows={3}
                  value={addForm.description}
                  onChange={(e) => setAddForm({ ...addForm, description: e.target.value })}
                  placeholder="Mô tả chức năng nhiệm vụ của bộ phận..."
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
                    Trạng thái hoạt động
                  </div>
                  <div className="text-[11px]" style={{ color: '#8C8C8C' }}>
                    Kích hoạt hoạt động ngay sau khi tạo
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
                  {isLoading ? 'Đang tạo...' : 'Tạo bộ phận'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
