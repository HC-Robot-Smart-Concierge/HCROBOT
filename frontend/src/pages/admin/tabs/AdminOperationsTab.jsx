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
  Eye,
  Edit3,
} from 'lucide-react';
import {
  fetchAdminTasks,
  fetchAdminSummary,
  dispatchAdminTask,
  updateAdminTask,
  fetchAdminTaskDetail,
  fetchStaffRoster,
} from '../../../services/operationsApi';
import { AdminHumanSupportView } from './AdminHumanSupportView';
import { Pagination } from '../../../components/common/Pagination';
import { useLanguage } from '../../../context/LanguageContext';

export const AdminOperationsTab = ({
  currentUser,
  onNotify = () => {},
  subTabProp,
  onSelectSubTab,
}) => {
  const { t, language } = useLanguage();
  const [localSubTab, setLocalSubTab] = useState('requests');
  const subTab = subTabProp || localSubTab;
  const setSubTab = onSelectSubTab || setLocalSubTab;

  const [tasks, setTasks] = useState([]);
  const [staffList, setStaffList] = useState([]);

  const [summary, setSummary] = useState({
    total_active: 0,
    all_count: 0,
    reception_count: 0,
    housekeeping_count: 0,
    room_service_count: 0,
    bell_services_count: 0,
    maintenance_count: 0,
    concierge_count: 0,
    taxi_count: 0,
    directives_count: 0,
  });

  const [deptFilter, setDeptFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [editTaskForm, setEditTaskForm] = useState({
    status: '',
    assigned_to: '',
    assigned_robot: '',
    note: '',
  });

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
    description: '',
    assigned_staff_name: '',
    assigned_robot_code: 'RC-001',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [tasksData, summaryData, rosterData] = await Promise.all([
        fetchAdminTasks({
          department: deptFilter,
          status: statusFilter,
          search: searchQuery,
        }),
        fetchAdminSummary(),
        fetchStaffRoster(),
      ]);

      if (Array.isArray(tasksData)) {
        setTasks(tasksData);
      }
      if (summaryData) {
        setSummary(summaryData);
      }
      if (Array.isArray(rosterData)) {
        setStaffList(rosterData);
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
        onNotify(t('opsNotifyStatusChanged').replace('{id}', ticketId).replace('{status}', nextStatus));
        loadData();
      }
    } catch (err) {
      onNotify(t('opsNotifyStatusError'));
    }
  };

  const handleOpenTaskDetail = async (task) => {
    setSelectedTask(task);
    setEditTaskForm({
      status: task.status || 'Pending',
      assigned_to: task.assigned_to || '',
      assigned_robot: task.assigned_robot || '',
      note: task.notes || '',
    });

    setIsDetailLoading(true);
    try {
      const detail = await fetchAdminTaskDetail(task.id);
      if (detail) {
        setSelectedTask(detail);
        setEditTaskForm({
          status: detail.status || task.status || 'Pending',
          assigned_to: detail.assigned_to || task.assigned_to || '',
          assigned_robot: detail.assigned_robot || task.assigned_robot || '',
          note: detail.notes || task.notes || '',
        });
      }
    } catch {
      // keep current task
    } finally {
      setIsDetailLoading(false);
    }
  };

  const handleSaveTaskDetail = async (e) => {
    e.preventDefault();
    if (!selectedTask) return;
    try {
      const res = await updateAdminTask(selectedTask.id, {
        status: editTaskForm.status,
        assigned_to: editTaskForm.assigned_to || null,
        assigned_robot: editTaskForm.assigned_robot || null,
        note: editTaskForm.note || null,
      });
      if (res && res.success) {
        onNotify(t('opsNotifyUpdated').replace('{id}', selectedTask.id));
        setSelectedTask(null);
        loadData();
      }
    } catch {
      onNotify(t('opsNotifyUpdateError'));
    }
  };

  const handleDispatchSubmit = async (e) => {
    e.preventDefault();
    if (!dispatchForm.title || !dispatchForm.room_number) {
      onNotify(t('opsNotifyRequiredFields'));
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await dispatchAdminTask(dispatchForm);
      if (res && res.id) {
        onNotify(t('opsNotifyDispatched').replace('{id}', res.id));
        setDispatchForm({
          department: 'Housekeeping',
          title: '',
          room_number: '',
          guest_name: 'Hotel Guest',
          description: '',
          assigned_staff_name: '',
          assigned_robot_code: 'RC-001',
        });
        setIsCreateModalOpen(false);
        loadData();
      }
    } catch (err) {
      onNotify(t('opsNotifyDispatchError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const deptList = [
    { id: 'All', label: language === 'VI' ? 'Tất cả' : 'All', count: summary.all_count },
    { id: 'Reception', label: language === 'VI' ? 'Lễ tân' : 'Reception', count: summary.reception_count },
    { id: 'Housekeeping', label: language === 'VI' ? 'Buồng phòng' : 'Housekeeping', count: summary.housekeeping_count },
    { id: 'F&B', label: language === 'VI' ? 'Phục vụ phòng' : 'Room Service', count: summary.room_service_count },
    { id: 'Bell Services', label: language === 'VI' ? 'Hành lý' : 'Bell Services', count: summary.bell_services_count },
    { id: 'Maintenance', label: language === 'VI' ? 'Kỹ thuật' : 'Maintenance', count: summary.maintenance_count },
    { id: 'Concierge', label: language === 'VI' ? 'Trợ lý Concierge' : 'Concierge Assistant', count: summary.concierge_count || 0 },
    { id: 'Taxi', label: language === 'VI' ? 'Đặt xe & Taxi' : 'Taxi & Transport', count: summary.taxi_count || 0 },
    { id: 'Directive', label: language === 'VI' ? 'Chỉ thị điều phối' : 'Directives', count: summary.directives_count || 0 },
  ];

  const statusOptions = [
    { key: 'All', label: t('opsFilterAllStatus') },
    { key: 'Pending', label: t('pending') },
    { key: 'In Progress', label: t('inProgress') },
    { key: 'Completed', label: t('completed') },
  ];

  if (subTab === 'support') {
    return (
      <div className="w-full h-full overflow-hidden">
        <AdminHumanSupportView />
      </div>
    );
  }

  return (
    <div className="w-full min-h-full flex flex-col pb-4" style={{ color: '#262626' }}>
      {/* Header Bar - seamlessly aligned with sidebar brand header */}
      <div
        className="h-16 px-5 border-b flex items-center justify-between gap-4 shrink-0 sticky top-0 z-20"
        style={{ borderColor: '#BFBFBD', backgroundColor: '#F2EFE9' }}
      >
        <div className="min-w-0">
          <h2 className="text-sm sm:text-base font-bold tracking-tight leading-tight truncate" style={{ color: '#262626' }}>
            {t('opsTitle')}
          </h2>
          <p className="text-[10px] sm:text-[11px] font-normal truncate mt-0.5" style={{ color: '#8C8C8C' }}>
            {t('opsSubtitle')}
          </p>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="px-3.5 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap shrink-0 hover:bg-[#262626]/90 flex items-center gap-1.5"
          style={{
            backgroundColor: '#262626',
            color: '#F2EFE9',
            borderColor: '#262626',
          }}
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span>{t('opsCreateDispatch')}</span>
        </button>
      </div>

      <div className="p-4 space-y-4">

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
                placeholder={t('searchPlaceholder')}
                className="w-full pl-9 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-800 placeholder-stone-400 focus:outline-none focus:border-stone-500"
              />
            </form>

            {/* Status Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto w-full lg:w-auto">
              {statusOptions.map((st) => (
                <button
                  key={st.key}
                  onClick={() => setStatusFilter(st.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    statusFilter === st.key
                      ? 'bg-stone-900 text-white shadow-sm'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  {st.label}
                </button>
              ))}

              <button
                onClick={loadData}
                title={t('opsRefreshTooltip')}
                className="p-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg transition-all ml-1 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Department Dropdown Select */}
          <div className="flex items-center gap-3 pt-2 border-t border-stone-100">
            <label className="text-xs font-bold text-stone-500 uppercase tracking-wider shrink-0">
              {t('opsFilterDept')}
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
            <p className="text-sm font-semibold">{t('opsLoading')}</p>
          </div>
        ) : paginatedTasks.length === 0 ? (
          <div className="py-16 text-center bg-white rounded-2xl border border-dashed border-stone-300 text-stone-400 space-y-2">
            <Building2 className="w-10 h-10 mx-auto text-stone-300" />
            <p className="text-sm font-bold text-stone-700">{t('opsEmptyTitle')}</p>
            <p className="text-xs text-stone-400">{t('opsEmptyDesc')}</p>
          </div>
        ) : (
          <div className="space-y-3.5">
            {paginatedTasks.map((task) => {
              const isDone = (task.status || '').toLowerCase() === 'completed';
              const isInProgress =
                (task.status || '').toLowerCase().includes('progress') ||
                (task.status || '').toLowerCase().includes('delivering');

              return (
                <div
                  key={task.id}
                  className="bg-white rounded-2xl border border-stone-200/90 shadow-sm hover:shadow-md transition-all p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  {/* Left Meta & Content */}
                  <div className="space-y-2.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* ID Badge */}
                      <span className="font-mono text-xs font-extrabold text-stone-900 bg-stone-100 px-2 py-0.5 rounded-md border border-stone-200">
                        {task.id}
                      </span>

                      {/* Department Badge */}
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {task.department}
                      </span>

                      {/* Location / Room */}
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#EFECE6] text-stone-800 border border-[#DDD8CE]">
                        {task.location}
                      </span>

                      {/* Robot Indicator */}
                      {task.assigned_robot && (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-stone-100 text-stone-700 border border-stone-200 flex items-center gap-1">
                          <Bot className="w-3 h-3 text-stone-600" />
                          {task.assigned_robot}
                        </span>
                      )}
                    </div>

                    {/* Title & Notes */}
                    <div>
                      <h4 className="text-base font-extrabold text-stone-900 tracking-tight">
                        {task.title}
                      </h4>
                      <p className="text-xs text-stone-600 mt-0.5">
                        <span className="font-semibold text-stone-800">{task.guest_name}</span>
                        {task.notes ? ` — ${t('opsNotes')}: ${task.notes}` : ''}
                      </p>
                    </div>

                    {/* Source & Assigned Staff info */}
                    <div className="flex items-center gap-4 text-[11px] text-stone-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {task.time}
                      </span>
                      <span>•</span>
                      <span>{t('opsSource')}: {task.source}</span>
                      {task.assigned_to && (
                        <>
                          <span>•</span>
                          <span className="text-indigo-600 font-semibold flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {task.assigned_to}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Right Actions & Status */}
                  <div className="flex items-center gap-2.5 self-end md:self-center border-t md:border-t-0 pt-3 md:pt-0 w-full md:w-auto justify-between md:justify-end">
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
                        {task.status === 'Completed' ? t('completed') : task.status === 'In Progress' ? t('inProgress') : task.status === 'Pending' ? t('pending') : task.status}
                      </span>
                    </div>

                    {/* Detail button */}
                    <button
                      onClick={() => handleOpenTaskDetail(task)}
                      className="px-3 py-1.5 rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all shadow-2xs hover:border-stone-300"
                    >
                      <Eye className="w-3.5 h-3.5 text-stone-500" />
                      <span>{t('details')}</span>
                    </button>
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
      </div>

      {/* MODAL: TASK DETAIL (READ-ONLY FOR ADMIN) */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-lg w-full bg-white p-6 rounded-3xl border border-stone-200 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <h3 className="text-base font-black text-stone-900 tracking-tight flex items-center gap-2">
                  <span>{t('opsModalTaskDetailTitle').replace('{id}', selectedTask.id)}</span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {selectedTask.department}
                  </span>
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  {t('opsModalLocationGuest')
                    .replace('{location}', selectedTask.location)
                    .replace('{guest}', selectedTask.guest_name)}
                </p>
              </div>
              <button
                onClick={() => setSelectedTask(null)}
                className="w-8 h-8 rounded-full bg-stone-100 text-stone-500 hover:bg-stone-200 flex items-center justify-center font-bold text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200 space-y-1.5">
                <div className="font-extrabold text-stone-900 text-sm">{selectedTask.title}</div>
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-stone-500">
                  <span>{t('opsModalSource')}: <strong>{selectedTask.source}</strong></span>
                  <span>•</span>
                  <span>{t('opsModalCreatedAt')}: <strong>{selectedTask.time || selectedTask.created_at}</strong></span>
                </div>
              </div>

              {/* Status & Location Display */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
                  <span className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">
                    {t('opsModalCurrentStatus')}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-stone-200 text-stone-800">
                    {selectedTask.status}
                  </span>
                </div>

                <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
                  <span className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">
                    {t('opsModalRoomLocation')}
                  </span>
                  <span className="text-xs font-bold text-stone-900">
                    {selectedTask.location}
                  </span>
                </div>
              </div>

              {/* Assigned Staff Display */}
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
                <span className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">
                  {t('opsModalAssignedStaff')}
                </span>
                <span className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{selectedTask.assigned_to || t('opsModalUnassignedStaff')}</span>
                </span>
              </div>

              {/* Assigned Robot Display */}
              {selectedTask.assigned_robot && (
                <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
                  <span className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">
                    {t('opsModalAssignedRobot')}
                  </span>
                  <span className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                    <Bot className="w-3.5 h-3.5 text-stone-600" />
                    <span>{selectedTask.assigned_robot}</span>
                  </span>
                </div>
              )}

              {/* Note Display */}
              {selectedTask.notes && (
                <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
                  <span className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">
                    {t('opsModalGuestNotes')}
                  </span>
                  <p className="text-xs text-stone-700 leading-relaxed font-medium">
                    {selectedTask.notes}
                  </p>
                </div>
              )}

              <div className="flex items-center justify-end pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setSelectedTask(null)}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-stone-900 hover:bg-stone-800 text-white transition-all cursor-pointer shadow-sm"
                >
                  {t('opsModalClose')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DISPATCH NEW TASK POPUP */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-xl w-full bg-white p-6 rounded-3xl border border-stone-200 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="text-base font-black text-stone-900 tracking-tight flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span>{t('opsCreateDispatchTitle')}</span>
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
                  {t('opsDispatchDeptLabel')}
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {['Reception', 'Housekeeping', 'F&B', 'Bell Services', 'Maintenance', 'Concierge', 'Taxi', 'Directive'].map(
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
                  {t('opsDispatchTitleLabel')}
                </label>
                <input
                  type="text"
                  required
                  value={dispatchForm.title}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, title: e.target.value })}
                  placeholder={t('opsDispatchTitlePlaceholder')}
                  className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              {/* Location & Guest Name */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1">
                    {t('opsDispatchRoomLabel')}
                  </label>
                  <input
                    type="text"
                    required
                    value={dispatchForm.room_number}
                    onChange={(e) => setDispatchForm({ ...dispatchForm, room_number: e.target.value })}
                    placeholder={t('opsDispatchRoomPlaceholder')}
                    className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1">
                    {t('opsDispatchGuestLabel')}
                  </label>
                  <input
                    type="text"
                    value={dispatchForm.guest_name}
                    onChange={(e) => setDispatchForm({ ...dispatchForm, guest_name: e.target.value })}
                    placeholder={t('opsDispatchGuestPlaceholder')}
                    className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Assign to Robot */}
              <div>
                <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1">
                  {t('opsDispatchRobotLabel')}
                </label>
                <select
                  value={dispatchForm.assigned_robot_code}
                  onChange={(e) =>
                    setDispatchForm({ ...dispatchForm, assigned_robot_code: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
                >
                  <option value="RC-001">{t('opsDispatchRobotOpt1')}</option>
                  <option value="Bot Unit Alpha">{t('opsDispatchRobotOpt2')}</option>
                  <option value="">{t('opsDispatchRobotOptNone')}</option>
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1">
                  {t('opsDispatchNotesLabel')}
                </label>
                <textarea
                  rows={2}
                  value={dispatchForm.description}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, description: e.target.value })}
                  placeholder={t('opsDispatchNotesPlaceholder')}
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
                  {t('opsModalClose')}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? t('opsDispatchSubmitting') : t('opsDispatchSubmit')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
