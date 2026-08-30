import React, { useState, useEffect } from 'react';
import {
  CheckSquare,
  Clock,
  CheckCircle2,
  AlertCircle,
  Play,
  Bot,
  Square,
  CheckCheck,
  Calendar,
  Sparkles,
  RotateCcw,
  Search,
} from 'lucide-react';
import { MetricCard } from '../../components/dashboard/MetricCard';
import {
  fetchUnifiedRequests,
  updateGenericRequestStatus,
} from '../../services/operationsApi';
import { useLanguage } from '../../context/LanguageContext';

export const MyTasksPage = ({ currentUser, onNotify = () => {} }) => {
  const staffName = currentUser?.full_name || currentUser?.name || 'Staff Member';
  const staffRole = currentUser?.role || 'Hotel Operations Staff';
  const staffDept = currentUser?.department || 'Staff';
  const staffId = currentUser?.id || currentUser?.username || 'user';

  const STORAGE_KEY = `aurora_staff_tasks_${staffId}_${staffDept}`;

  const [statusFilter, setStatusFilter] = useState('All'); // 'All' | 'In Progress' | 'Completed'
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Generate standardized checklist based on request type
  const generateChecklistForRequest = (req) => {
    const dept = (req.department || staffDept || '').toLowerCase();
    if (dept.includes('housekeeping') || dept.includes('buồng phòng')) {
      return [
        { id: `c_${req.id}_1`, text: `Tiếp nhận xử lý tại ${req.location}: ${req.title}`, done: true },
        { id: `c_${req.id}_2`, text: 'Chuẩn bị dụng cụ và hóa chất sinh học chuyên dụng', done: true },
        { id: `c_${req.id}_3`, text: 'Tiến hành dọn dẹp / xử lý theo tiêu chuẩn khách sạn 5 sao', done: false },
        { id: `c_${req.id}_4`, text: 'Khử khuẩn khu vực và xác nhận hoàn tất trên HCRobot', done: false },
      ];
    }
    if (dept.includes('bell') || dept.includes('luggage') || dept.includes('hành lý')) {
      return [
        { id: `c_${req.id}_1`, text: `Tiếp nhận yêu cầu tại ${req.location}: ${req.title}`, done: true },
        { id: `c_${req.id}_2`, text: 'Điều xe đẩy tự hành Bot Unit Alpha hỗ trợ di chuyển', done: true },
        { id: `c_${req.id}_3`, text: 'Tiếp nhận hành lý và vận chuyển cẩn thận, an toàn', done: false },
        { id: `c_${req.id}_4`, text: 'Bàn giao tận tay khách và chốt phiếu dịch vụ', done: false },
      ];
    }
    if (dept.includes('maint') || dept.includes('kỹ thuật') || dept.includes('bảo trì')) {
      return [
        { id: `c_${req.id}_1`, text: `Tiếp nhận sự cố kỹ thuật tại ${req.location}: ${req.title}`, done: true },
        { id: `c_${req.id}_2`, text: 'Kiểm tra hiện trường và ngắt nguồn / khóa van an toàn', done: true },
        { id: `c_${req.id}_3`, text: 'Tiến hành sửa chữa, thay thế phụ tùng cần thiết', done: false },
        { id: `c_${req.id}_4`, text: 'Chạy thử kiểm tra áp lực / nguồn điện và thu dọn hiện trường', done: false },
      ];
    }
    if (dept.includes('reception') || dept.includes('lễ tân') || dept.includes('front desk')) {
      return [
        { id: `c_${req.id}_1`, text: `Tiếp nhận yêu cầu hỗ trợ tại ${req.location}: ${req.title}`, done: true },
        { id: `c_${req.id}_2`, text: 'Xác nhận thông tin khách hàng và bộ phận chuyên trách', done: true },
        { id: `c_${req.id}_3`, text: 'Điều phối nhân sự hoặc robot hỗ trợ khách phòng', done: false },
        { id: `c_${req.id}_4`, text: 'Xác nhận mức độ hài lòng của khách và đóng phiếu', done: false },
      ];
    }
    // Default F&B / Room Service
    return [
      { id: `c_${req.id}_1`, text: `Tiếp nhận đơn gọi món tại ${req.location}: ${req.title}`, done: true },
      { id: `c_${req.id}_2`, text: 'Chế biến món ăn và chuẩn bị đồ uống kèm đá lạnh', done: true },
      { id: `c_${req.id}_3`, text: 'Đặt khay thức ăn vào khoang chứa của HCRobot Unit 01', done: false },
      { id: `c_${req.id}_4`, text: 'Cung cấp mã PIN mở khoang cho khách khi robot tới phòng', done: false },
    ];
  };

  const isTaskAssignedToMe = (r) => {
    if (!r) return false;

    // 1. Department match check
    const reqDept = String(r.department || '').toLowerCase().trim();
    const myDept = String(staffDept || '').toLowerCase().trim();
    const isDeptMatch =
      reqDept === myDept ||
      (myDept.includes('housekeeping') && (reqDept.includes('housekeeping') || reqDept.includes('buồng phòng'))) ||
      ((myDept.includes('f&b') || myDept.includes('room service') || myDept.includes('room_service')) && (reqDept.includes('f&b') || reqDept.includes('room service') || reqDept.includes('ẩm thực') || reqDept.includes('room_service'))) ||
      ((myDept.includes('bell') || myDept.includes('luggage')) && (reqDept.includes('bell') || reqDept.includes('luggage') || reqDept.includes('hành lý'))) ||
      ((myDept.includes('maint') || myDept.includes('kỹ thuật') || myDept.includes('bảo trì')) && (reqDept.includes('maint') || reqDept.includes('kỹ thuật') || reqDept.includes('bảo trì'))) ||
      ((myDept.includes('reception') || myDept.includes('lễ tân') || myDept.includes('front desk')) && (reqDept.includes('reception') || reqDept.includes('lễ tân') || reqDept.includes('front desk')));

    if (!isDeptMatch) return false;

    // 2. Status match check: ONLY In Progress / Cooking / Delivering / Completed tasks belong to My Tasks
    const s = String(r.status || '').toLowerCase().trim();
    const isTaskActiveOrDone =
      s === 'in progress' ||
      s === 'in_progress' ||
      s === 'completed' ||
      s === 'ready' ||
      s === 'cooking' ||
      s === 'delivering';
    if (!isTaskActiveOrDone) return false;

    // 3. Assignee match check
    const staffNameNorm = String(staffName).toLowerCase().trim();
    const assignedNorm = String(
      r.assignedTo ||
      r.assigned_to ||
      r.assigned_staff_name ||
      r.assignedStaff ||
      r.staffName ||
      r.staff_name ||
      ''
    ).toLowerCase().trim();
    const curNameNorm = String(currentUser?.name || '').toLowerCase().trim();
    const curFullNameNorm = String(currentUser?.full_name || '').toLowerCase().trim();
    const curUserNorm = String(currentUser?.username || '').toLowerCase().trim();

    const isExplicitlyAssigned =
      Boolean(assignedNorm) &&
      (assignedNorm === staffNameNorm ||
        (curNameNorm && assignedNorm === curNameNorm) ||
        (curFullNameNorm && assignedNorm === curFullNameNorm) ||
        (curUserNorm && assignedNorm === curUserNorm) ||
        (curUserNorm && assignedNorm.includes(curUserNorm)) ||
        (curNameNorm && assignedNorm.includes(curNameNorm)) ||
        (staffNameNorm && assignedNorm.includes(staffNameNorm)));

    // Return true if explicitly assigned to current staff, or if active/completed in this department without assigned name
    return isExplicitlyAssigned || (!assignedNorm && (s === 'cooking' || s === 'in progress' || s === 'completed'));
  };

  const [tasks, setTasks] = useState([]);

  // Load and merge claimed requests from Database into My Tasks
  const loadTasksAndSyncDb = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch live requests from PostgreSQL
      const allRequests = await fetchUnifiedRequests();
      const claimedRequests = Array.isArray(allRequests)
        ? allRequests.filter(isTaskAssignedToMe)
        : [];

      // 2. Load cached local task state (preserving checklist checks)
      let savedLocalTasks = [];
      try {
        const savedStr = localStorage.getItem(STORAGE_KEY);
        if (savedStr) savedLocalTasks = JSON.parse(savedStr);
      } catch (e) {}

      // 3. Map claimed requests into Tasks
      const syncedClaimedTasks = claimedRequests.map((req) => {
        const existingLocal = savedLocalTasks.find((t) => t.id === req.id || t.raw_id === req.raw_id);
        const isReqCompleted =
          req.status?.toLowerCase() === 'completed' || req.status?.toLowerCase() === 'ready';

        const defaultChecklist = generateChecklistForRequest(req);
        let checklist = existingLocal?.checklist || defaultChecklist;
        if (isReqCompleted) {
          checklist = checklist.map((c) => ({ ...c, done: true }));
        }

        const allDone = checklist.length > 0 && checklist.every((c) => c.done);
        const status = isReqCompleted || allDone ? 'Completed' : 'In Progress';

        return {
          id: req.id,
          raw_id: req.raw_id,
          department: req.department || staffDept,
          title: req.title,
          location: req.location || 'Tại phòng khách',
          priority: 'NORMAL',
          status,
          dueTime: req.time || '15 phút nữa',
          isClaimedFromRobot: true,
          checklist,
        };
      });

      setTasks(syncedClaimedTasks);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(syncedClaimedTasks));
    } catch (err) {
      console.error('Error syncing My Tasks with database:', err);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadTasksAndSyncDb();
  }, [staffName, staffDept]);

  // Helper to save tasks permanently to localStorage
  const saveTasksState = (updatedTasks) => {
    setTasks(updatedTasks);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedTasks));
    } catch (e) {
      console.error('Failed to persist task state:', e);
    }
  };

  // Toggle checklist item
  const handleToggleChecklist = async (taskId, checkId) => {
    let nextStatus = null;
    const updated = tasks.map((task) => {
      if (task.id !== taskId) return task;
      const nextChecklist = task.checklist.map((item) =>
        item.id === checkId ? { ...item, done: !item.done } : item
      );
      const allDone = nextChecklist.length > 0 && nextChecklist.every((item) => item.done);
      const newStatus = allDone ? 'Completed' : 'In Progress';
      nextStatus = newStatus;
      return {
        ...task,
        checklist: nextChecklist,
        status: newStatus,
      };
    });
    saveTasksState(updated);

    if (nextStatus) {
      await updateGenericRequestStatus(taskId, nextStatus, staffName);
    }
  };

  // Mark task done -> Persists to localStorage & PostgreSQL Database
  const handleCompleteTask = async (taskId) => {
    const updated = tasks.map((task) =>
      task.id === taskId
        ? {
            ...task,
            status: 'Completed',
            checklist: task.checklist.map((c) => ({ ...c, done: true })),
          }
        : task
    );
    saveTasksState(updated);

    // Call database API to sync status in PostgreSQL
    await updateGenericRequestStatus(taskId, 'Completed', staffName);
    onNotify(`Đã hoàn thành xuất sắc nhiệm vụ #${taskId}!`);
  };

  // Filter tasks based on status and search query
  const filteredTasks = tasks.filter((task) => {
    const matchStatus = (() => {
      if (statusFilter === 'All') return true;
      if (statusFilter === 'In Progress') return task.status === 'In Progress';
      if (statusFilter === 'Completed') return task.status === 'Completed';
      return true;
    })();

    const matchSearch =
      (task.id || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (task.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (task.location || '').toLowerCase().includes(searchQuery.toLowerCase());

    return matchStatus && matchSearch;
  });

  const inProgressCount = tasks.filter((t) => t.status === 'In Progress').length;
  const completedCount = tasks.filter((t) => t.status === 'Completed').length;
  const totalTasksCount = tasks.length;
  const completionRate =
    totalTasksCount > 0 ? Math.round((completedCount / totalTasksCount) * 100) : 0;

  const { t } = useLanguage();

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-8 bg-[#FAF8F5] font-sans select-none">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-[#1A1917]">{t('myTasksTitle')}</h2>
            <p className="text-xs text-[#78716C] mt-1">
              {staffName} • {staffRole} ({staffDept})
            </p>
          </div>
        </div>

        {/* 3 Task KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricCard
            title={t('kpiMyInProgress')}
            value={inProgressCount}
            subText={t('inProgress')}
            icon={Play}
          />
          <MetricCard
            title={t('kpiMyCompleted')}
            value={completedCount}
            variant="dark"
            subText={t('completed')}
            icon={CheckCircle2}
          />
          <MetricCard
            title={t('kpiShiftEfficiency')}
            value={`${completionRate}%`}
            variant="danger-gradient"
            subText={`${completedCount}/${totalTasksCount}`}
            icon={Sparkles}
          />
        </div>

        {/* Controls Bar: Search & Status Tabs */}
        <div className="p-4 rounded-2xl bg-white border border-[#E5E1D8] shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Search Box */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-2.5" />
            <input
              type="text"
              placeholder={t('searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-1.5 rounded-xl bg-[#FAF8F5] border border-[#E0DCD3] text-xs font-medium text-stone-900 outline-none focus:border-stone-400"
            />
          </div>

          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1 bg-[#EFECE6] p-1 rounded-full border border-[#DDD8CE]">
            {[
              { id: 'All', label: t('tabAll'), count: totalTasksCount },
              { id: 'In Progress', label: t('tabInProgress'), count: inProgressCount },
              { id: 'Completed', label: t('tabCompleted'), count: completedCount },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setStatusFilter(tab.id);
                  onNotify(`Đã lọc: ${tab.label}`);
                }}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  statusFilter === tab.id
                    ? 'bg-[#18181B] text-white shadow-md'
                    : 'text-stone-600 hover:text-black hover:bg-stone-200/50'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    statusFilter === tab.id
                      ? 'bg-stone-800 text-amber-300'
                      : 'bg-[#DDD8CE] text-stone-700'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Task List Section */}
        <div className="space-y-4 pt-1">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#1A1917]">
              Danh Sách Nhiệm Vụ & Yêu Cầu Đã Nhận ({filteredTasks.length})
            </h3>
          </div>

          <div className="space-y-4">
            {filteredTasks.length === 0 ? (
              <div className="p-12 text-center bg-white rounded-3xl border border-[#E5E1D8] text-xs text-stone-500 space-y-2">
                <CheckSquare className="w-8 h-8 mx-auto text-stone-300" />
                <p className="font-semibold text-stone-700">Hiện không có nhiệm vụ nào trong mục này.</p>
                <p className="text-stone-400">Khi bạn tiếp nhận yêu cầu từ mục Requests hoặc Dashboard, nhiệm vụ sẽ xuất hiện tại đây.</p>
              </div>
            ) : (
              filteredTasks.map((task) => {
                const isCompleted = task.status === 'Completed';
                const isInProgress = task.status === 'In Progress';
                const completedChecklistCount = (task.checklist || []).filter((c) => c.done).length;

                return (
                  <div
                    key={task.id}
                    className={`bg-white rounded-3xl border border-[#E5E1D8] p-6 shadow-sm space-y-4 transition-all hover:shadow-md ${
                      isInProgress ? 'border-l-4 border-l-sky-500 shadow-md' : ''
                    } ${isCompleted ? 'border-l-4 border-l-emerald-500 bg-emerald-50/5' : ''}`}
                  >
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#F0ECE3]">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[#1A1917]">{task.id}</span>
                        <span className="px-2.5 py-0.5 rounded-full bg-[#18181B] text-white text-[10px] font-bold">
                          {task.location}
                        </span>
                        {task.isClaimedFromRobot && (
                          <span className="px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-800 text-[10px] font-bold flex items-center gap-1 border border-sky-200">
                            <Bot className="w-3 h-3 text-sky-600" />
                            <span>Nhận Từ HCRobot</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-stone-500 font-medium">Hạn chót: {task.dueTime}</span>
                        <span
                          className={`px-3 py-0.5 rounded-full text-[11px] font-bold ${
                            isCompleted
                              ? 'bg-emerald-100 text-emerald-800'
                              : isInProgress
                              ? 'bg-sky-100 text-sky-800'
                              : 'bg-stone-100 text-stone-700'
                          }`}
                        >
                          ● {task.status}
                        </span>
                      </div>
                    </div>

                    {/* Body & Checklist */}
                    <div className="space-y-3">
                      <h4 className="text-base font-bold text-[#1A1917]">{task.title}</h4>

                      <div>
                        <div className="flex justify-between text-xs font-semibold text-stone-600 mb-2">
                          <span>Checklist quy trình chuẩn 5 sao</span>
                          <span className="font-mono">
                            {completedChecklistCount} / {(task.checklist || []).length} hoàn thành
                          </span>
                        </div>

                        {/* Checklist items */}
                        <div className="space-y-2">
                          {(task.checklist || []).map((item) => (
                            <div
                              key={item.id}
                              onClick={() => handleToggleChecklist(task.id, item.id)}
                              className={`p-2.5 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${
                                item.done
                                  ? 'bg-emerald-50/60 border-emerald-200 text-stone-700'
                                  : 'bg-[#FAF8F5] border-[#EAE6DE] text-stone-800 hover:bg-[#F2EFE9]'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={item.done}
                                onChange={() => {}}
                                className="w-4 h-4 rounded text-emerald-600 accent-emerald-600 pointer-events-none"
                              />
                              <span
                                className={`text-xs font-medium ${
                                  item.done ? 'line-through text-stone-500' : ''
                                }`}
                              >
                                {item.text}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-2 flex items-center justify-end gap-2.5">
                      {isInProgress && (
                        <button
                          onClick={() => handleCompleteTask(task.id)}
                          className="px-5 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer active:scale-95"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Hoàn Thành Nhiệm Vụ</span>
                        </button>
                      )}

                      {isCompleted && (
                        <span className="text-xs font-bold text-emerald-700 flex items-center gap-1 bg-emerald-50 px-3.5 py-1.5 rounded-full border border-emerald-200">
                          <CheckCheck className="w-4 h-4 text-emerald-600" />
                          <span>Nhiệm vụ đã hoàn tất thành công</span>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
