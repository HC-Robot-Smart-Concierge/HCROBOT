import React, { useState, useEffect } from 'react';
import {
  Search,
  PlusCircle,
  Clock,
  CheckCircle2,
  User,
  Bot,
  MapPin,
  RefreshCw,
  Send,
  Building2,
  Sparkles,
  MessageSquare,
} from 'lucide-react';
import {
  fetchAdminTasks,
  fetchAdminSummary,
  dispatchAdminTask,
  updateAdminTask,
} from '../../../services/operationsApi';
import { AdminHumanSupportView } from './AdminHumanSupportView';
import { Pagination } from '../../../components/common/Pagination';

export const AdminOperationsTab = ({
  currentUser,
  onNotify = () => {},
  subTabProp,
  onSelectSubTab,
}) => {
  const [localSubTab, setLocalSubTab] = useState('requests');
  const subTab = subTabProp || localSubTab;
  const setSubTab = onSelectSubTab || setLocalSubTab;

  const [tasks, setTasks] = useState([]);

  const [summary, setSummary] = useState({
    total_active: 0,
    all_count: 0,
    reception_count: 0,
    housekeeping_count: 0,
    room_service_count: 0,
    bell_services_count: 0,
    maintenance_count: 0,
    directives_count: 0,
  });

  const [deptFilter, setDeptFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [deptFilter, statusFilter, searchQuery]);

  const paginatedTasks = tasks.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Form Dispatch State
  const [dispatchForm, setDispatchForm] = useState({
    department: 'Housekeeping',
    title: '',
    room_number: '',
    guest_name: 'Hotel Guest',
    priority: 'HIGH PRIORITY',
    description: '',
    assigned_staff_name: '',
    assigned_robot_code: 'RC-001',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [tasksData, summaryData] = await Promise.all([
        fetchAdminTasks({
          department: deptFilter,
          status: statusFilter,
          search: searchQuery,
        }),
        fetchAdminSummary(),
      ]);

      if (Array.isArray(tasksData)) {
        setTasks(tasksData);
      }
      if (summaryData) {
        setSummary(summaryData);
      }
    } catch (err) {
      console.error('Error loading operations data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [deptFilter, statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadData();
  };

  const handleStatusChange = async (ticketId, nextStatus) => {
    try {
      const res = await updateAdminTask(ticketId, { status: nextStatus });
      if (res && res.success) {
        onNotify(`Đã chuyển trạng thái phiếu ${ticketId} sang: ${nextStatus}`);
        loadData();
      }
    } catch (err) {
      onNotify('Lỗi cập nhật trạng thái phiếu.');
    }
  };

  const handleDispatchSubmit = async (e) => {
    e.preventDefault();
    if (!dispatchForm.title || !dispatchForm.room_number) {
      onNotify('Vui lòng nhập đầy đủ tiêu đề và số phòng/vị trí!');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await dispatchAdminTask(dispatchForm);
      if (res && res.id) {
        onNotify(`Đã phát lệnh thành công! Mã phiếu: ${res.id}`);
        setDispatchForm({
          department: 'Housekeeping',
          title: '',
          room_number: '',
          guest_name: 'Hotel Guest',
          priority: 'HIGH PRIORITY',
          description: '',
          assigned_staff_name: '',
          assigned_robot_code: 'RC-001',
        });
        setIsCreateModalOpen(false);
        loadData();
      }
    } catch (err) {
      onNotify('Lỗi khi phát lệnh điều phối.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const deptList = [
    { id: 'All', label: 'Tất cả', count: summary.all_count },
    { id: 'Reception', label: 'Lễ tân', count: summary.reception_count },
    { id: 'Housekeeping', label: 'Buồng phòng', count: summary.housekeeping_count },
    { id: 'F&B', label: 'Phục vụ phòng (F&B)', count: summary.room_service_count },
    { id: 'Bell Services', label: 'Hành lý (Bellman)', count: summary.bell_services_count },
    { id: 'Maintenance', label: 'Kỹ thuật', count: summary.maintenance_count },
  ];

  if (subTab === 'support') {

    return (
      <div className="w-full h-full overflow-hidden">
        <AdminHumanSupportView />
      </div>
    );
  }

  return (
    <div className="w-full min-h-full flex flex-col p-6 space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-stone-200 pb-4">
        <div>
          <h2 className="text-2xl font-black text-stone-900 tracking-tight">
            Quản Lý Yêu Cầu Toàn Khách Sạn (Service Requests)
          </h2>
          <p className="text-sm text-stone-500 font-medium">
            Trung tâm tiếp nhận, điều phối và phân công yêu cầu dịch vụ trên toàn khách sạn.
          </p>
        </div>
      </div>

      {/* SERVICE REQUESTS LIST */}
      <div className="space-y-6">
          {/* Controls Bar: Search & Status Filters & Department Select */}
          <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm space-y-4">
            {/* Search Input & Status Filters */}
            <div className="flex flex-col lg:flex-row items-center justify-between gap-3">
              <form onSubmit={handleSearchSubmit} className="relative w-full lg:w-96">
                <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm theo mã phiếu, số phòng, tên khách..."
                  className="w-full pl-9 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-800 placeholder-stone-400 focus:outline-none focus:border-stone-500"
                />
              </form>

              {/* Status Filter Pills */}
              <div className="flex items-center gap-2 overflow-x-auto w-full lg:w-auto">
                {['All', 'Pending', 'In Progress', 'Completed'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                      statusFilter === st
                        ? 'bg-stone-900 text-white shadow-sm'
                        : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                    }`}
                  >
                    {st === 'All' ? 'Tất Cả Trạng Thái' : st}
                  </button>
                ))}

                <button
                  onClick={loadData}
                  title="Làm mới dữ liệu"
                  className="p-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg transition-all ml-1 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Department Dropdown Select */}
            <div className="flex items-center gap-3 pt-2 border-t border-stone-100">
              <label className="text-xs font-bold text-stone-500 uppercase tracking-wider shrink-0">
                LỌC BỘ PHẬN:
              </label>
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="px-3.5 py-1.5 rounded-xl bg-[#FAF8F5] border border-[#DDD8CE] text-xs font-bold text-stone-900 outline-none focus:border-stone-600 cursor-pointer shadow-sm"
              >
                {deptList.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.label} ({dept.count})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Cards List */}
          {isLoading ? (
            <div className="py-20 text-center text-stone-400 flex flex-col items-center justify-center space-y-2">
              <RefreshCw className="w-8 h-8 animate-spin text-stone-700" />
              <p className="text-sm font-semibold">Đang tải danh sách yêu cầu toàn khách sạn...</p>
            </div>
          ) : paginatedTasks.length === 0 ? (
            <div className="py-16 text-center bg-white rounded-2xl border border-dashed border-stone-300 text-stone-400 space-y-2">
              <Building2 className="w-10 h-10 mx-auto text-stone-300" />
              <p className="text-sm font-bold text-stone-700">Không tìm thấy phiếu yêu cầu nào</p>
              <p className="text-xs text-stone-400">Hãy thử đổi bộ lọc tìm kiếm.</p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {paginatedTasks.map((t) => {
                const isHigh =
                  (t.priority || '').toUpperCase().includes('HIGH') ||
                  (t.priority || '').toUpperCase().includes('URGENT');
                const isDone = (t.status || '').toLowerCase() === 'completed';
                const isInProgress =
                  (t.status || '').toLowerCase().includes('progress') ||
                  (t.status || '').toLowerCase().includes('delivering');

                return (
                  <div
                    key={t.id}
                    className="bg-white rounded-2xl border border-stone-200/90 shadow-sm hover:shadow-md transition-all p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    {/* Left Meta & Content */}
                    <div className="space-y-2.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* ID Badge */}
                        <span className="font-mono text-xs font-extrabold text-stone-900 bg-stone-100 px-2 py-0.5 rounded-md border border-stone-200">
                          {t.id}
                        </span>

                        {/* Location / Room (Soft Gray without Icon) */}
                        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#EFECE6] text-stone-800 border border-[#DDD8CE]">
                          {t.location}
                        </span>

                        {/* Priority Badge */}
                        {isHigh && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200 animate-pulse">
                            HIGH PRIORITY
                          </span>
                        )}

                        {/* Robot Indicator */}
                        {t.assigned_robot && (
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-stone-100 text-stone-700 border border-stone-200 flex items-center gap-1">
                            <Bot className="w-3 h-3 text-stone-600" />
                            {t.assigned_robot}
                          </span>
                        )}
                      </div>

                      {/* Title & Notes */}
                      <div>
                        <h4 className="text-base font-extrabold text-stone-900 tracking-tight">
                          {t.title}
                        </h4>
                        <p className="text-xs text-stone-600 mt-0.5">
                          <span className="font-semibold text-stone-800">{t.guest_name}</span>
                          {t.notes ? ` — Ghi chú: ${t.notes}` : ''}
                        </p>
                      </div>

                      {/* Source & Assigned Staff info */}
                      <div className="flex items-center gap-4 text-[11px] text-stone-400">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {t.time}
                        </span>
                        <span>•</span>
                        <span>Nguồn: {t.source}</span>
                        {t.assigned_to && (
                          <>
                            <span>•</span>
                            <span className="text-indigo-600 font-semibold flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {t.assigned_to}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Right Actions & Status */}
                    <div className="flex items-center gap-3 self-end md:self-center border-t md:border-t-0 pt-3 md:pt-0 w-full md:w-auto justify-between md:justify-end">
                      {/* Status Pill */}
                      <div className="text-right">
                        <span
                          className={`text-xs font-extrabold px-3 py-1 rounded-full ${
                            isDone
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : isInProgress
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-stone-100 text-stone-700 border border-stone-200'
                          }`}
                        >
                          {t.status}
                        </span>
                      </div>

                      {/* Action Buttons */}
                      {!isDone ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleStatusChange(t.id, 'In Progress')}
                            disabled={isInProgress}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                              isInProgress
                                ? 'bg-stone-100 text-stone-400 cursor-not-allowed'
                                : 'bg-stone-900 hover:bg-stone-800 text-white cursor-pointer shadow-sm'
                            }`}
                          >
                            Tiếp Nhận
                          </button>
                          <button
                            onClick={() => handleStatusChange(t.id, 'Completed')}
                            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all cursor-pointer shadow-sm flex items-center gap-1"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Xong</span>
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Đã Hoàn Tất</span>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination Footer */}
          <Pagination
            currentPage={currentPage}
            totalItems={tasks.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            className="rounded-2xl border border-stone-200 shadow-sm mt-4 bg-white"
          />
        </div>

      {/* MODAL: DISPATCH NEW TASK POPUP */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-xl w-full bg-white p-6 rounded-3xl border border-stone-200 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="text-base font-black text-stone-900 tracking-tight flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span>Tạo Yêu Cầu / Phát Lệnh Điều Phối Mới</span>
              </h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="w-8 h-8 rounded-full bg-stone-100 text-stone-500 hover:bg-stone-200 flex items-center justify-center font-bold text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleDispatchSubmit} className="space-y-4">
              {/* Department Selection */}
              <div>
                <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1">
                  BỘ PHẬN TIẾP NHẬN:
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {['Housekeeping', 'F&B', 'Bell Services', 'Maintenance', 'Reception', 'Directive'].map(
                    (d) => (
                      <button
                        type="button"
                        key={d}
                        onClick={() => setDispatchForm({ ...dispatchForm, department: d })}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all border text-center cursor-pointer ${
                          dispatchForm.department === d
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                            : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                        }`}
                      >
                        {d}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Task Title */}
              <div>
                <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1">
                  TIÊU ĐỀ YÊU CẦU:
                </label>
                <input
                  type="text"
                  required
                  value={dispatchForm.title}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, title: e.target.value })}
                  placeholder="Ví dụ: Mang 2 chai nước khoáng, Dọn phòng 402..."
                  className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              {/* Location & Guest Name */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1">
                    SỐ PHÒNG / VỊ TRÍ:
                  </label>
                  <input
                    type="text"
                    required
                    value={dispatchForm.room_number}
                    onChange={(e) => setDispatchForm({ ...dispatchForm, room_number: e.target.value })}
                    placeholder="Ví dụ: Room 412, Suite 502..."
                    className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1">
                    TÊN KHÁCH HÀNG:
                  </label>
                  <input
                    type="text"
                    value={dispatchForm.guest_name}
                    onChange={(e) => setDispatchForm({ ...dispatchForm, guest_name: e.target.value })}
                    placeholder="Mr. David Smith / Hotel Guest"
                    className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Priority & Assign to Robot */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1">
                    MỨC ƯU TIÊN:
                  </label>
                  <select
                    value={dispatchForm.priority}
                    onChange={(e) => setDispatchForm({ ...dispatchForm, priority: e.target.value })}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="HIGH PRIORITY">Khẩn cấp (HIGH PRIORITY)</option>
                    <option value="NORMAL">Bình thường (NORMAL)</option>
                    <option value="LOW">Thấp (LOW)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1">
                    GÁN CHO ROBOT (NẾU CẦN):
                  </label>
                  <select
                    value={dispatchForm.assigned_robot_code}
                    onChange={(e) =>
                      setDispatchForm({ ...dispatchForm, assigned_robot_code: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="RC-001">Robot Concierge Unit 01 (RC-001)</option>
                    <option value="Bot Unit Alpha">Bot Unit Alpha (Bellman Service)</option>
                    <option value="">Không gán Robot (Giao nhân viên)</option>
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1">
                  CHI TIẾT / GHI CHÚ:
                </label>
                <textarea
                  rows={2}
                  value={dispatchForm.description}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, description: e.target.value })}
                  placeholder="Ghi chú thêm chỉ dẫn cho nhân viên..."
                  className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-stone-600 hover:bg-stone-100 transition-all cursor-pointer"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'Đang gửi...' : 'Phát Lệnh Ngay'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
