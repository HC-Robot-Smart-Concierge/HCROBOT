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

export const MyTasksPage = ({ currentUser, onNotify = () => {} }) => {
  const staffName = currentUser?.full_name || currentUser?.name || 'Elena Rossi';
  const staffRole = currentUser?.role || 'Shift Leader / F&B Lead';
  const staffDept = currentUser?.department || 'F&B';
  const staffId = currentUser?.id || currentUser?.username || 'user';

  const STORAGE_KEY = `aurora_staff_tasks_${staffId}_${staffDept}`;

  const [statusFilter, setStatusFilter] = useState('All'); // 'All' | 'In Progress' | 'Completed'
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Generate standardized checklist based on request type
  const generateChecklistForRequest = (req) => {
    const dept = req.department || staffDept;
    if (dept === 'Housekeeping') {
      return [
        { id: `c_${req.id}_1`, text: `Tiếp nhận xử lý tại ${req.location}: ${req.title}`, done: true },
        { id: `c_${req.id}_2`, text: 'Chuẩn bị dụng cụ và hóa chất sinh học chuyên dụng', done: true },
        { id: `c_${req.id}_3`, text: 'Tiến hành dọn dẹp / xử lý theo tiêu chuẩn khách sạn 5 sao', done: false },
        { id: `c_${req.id}_4`, text: 'Khử khuẩn khu vực và xác nhận hoàn tất trên HCRobot', done: false },
      ];
    }
    if (dept === 'Bell Services') {
      return [
        { id: `c_${req.id}_1`, text: `Tiếp nhận yêu cầu tại ${req.location}: ${req.title}`, done: true },
        { id: `c_${req.id}_2`, text: 'Điều xe đẩy tự hành Bot Unit Alpha hỗ trợ di chuyển', done: true },
        { id: `c_${req.id}_3`, text: 'Tiếp nhận hành lý và vận chuyển cẩn thận, an toàn', done: false },
        { id: `c_${req.id}_4`, text: 'Bàn giao tận tay khách và chốt phiếu dịch vụ', done: false },
      ];
    }
    if (dept === 'Maintenance') {
      return [
        { id: `c_${req.id}_1`, text: `Tiếp nhận sự cố kỹ thuật tại ${req.location}: ${req.title}`, done: true },
        { id: `c_${req.id}_2`, text: 'Kiểm tra hiện trường và ngắt nguồn / khóa van an toàn', done: true },
        { id: `c_${req.id}_3`, text: 'Tiến hành sửa chữa, thay thế phụ tùng cần thiết', done: false },
        { id: `c_${req.id}_4`, text: 'Chạy thử kiểm tra áp lực / nguồn điện và thu dọn hiện trường', done: false },
      ];
    }
    if (dept === 'Reception') {
      return [
        { id: `c_${req.id}_1`, text: `Review the guest request at ${req.location}: ${req.title}`, done: true },
        { id: `c_${req.id}_2`, text: 'Confirm the issue details and guest preference', done: true },
        { id: `c_${req.id}_3`, text: 'Coordinate and assign the correct hotel department', done: false },
        { id: `c_${req.id}_4`, text: 'Follow up with the guest and close the request', done: false },
      ];
    }
    // Default F&B
    return [
      { id: `c_${req.id}_1`, text: `Tiếp nhận đơn gọi món tại ${req.location}: ${req.title}`, done: true },
      { id: `c_${req.id}_2`, text: 'Chế biến món ăn và chuẩn bị đồ uống kèm đá lạnh', done: true },
      { id: `c_${req.id}_3`, text: 'Đặt khay thức ăn vào khoang chứa của HCRobot Unit 01', done: false },
      { id: `c_${req.id}_4`, text: 'Cung cấp mã PIN mở khoang cho khách khi robot tới phòng', done: false },
    ];
  };

  // Default core shift duties
  const getDefaultShiftDuties = () => {
    return [
      {
        id: `SHIFT-DUTY-${staffDept.toUpperCase().slice(0, 3)}-01`,
        title: `Kiểm tra dụng cụ & trang thiết bị đầu ca trực (${staffDept})`,
        location: 'Khu vực quầy nghiệp vụ',
        priority: 'NORMAL',
        status: 'In Progress',
        dueTime: 'Trước 10:00 AM',
        isShiftDuty: true,
        checklist: [
          { id: 'sd1', text: 'Bàn giao sổ trực ca và kiểm tra danh sách phòng VIP', done: false },
          { id: 'sd2', text: 'Kiểm tra trạm sạc và dung lượng pin của HCRobot', done: false },
        ],
      },
    ];
  };

  const [tasks, setTasks] = useState([]);

  // Load and merge claimed requests from Database into My Tasks
  const loadTasksAndSyncDb = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch live requests from PostgreSQL
      const allRequests = await fetchUnifiedRequests();
      const claimedRequests = Array.isArray(allRequests)
        ? allRequests.filter(
            (r) =>
              (r.assignedTo === staffName ||
                r.assigned_staff_name === staffName ||
                (r.department?.toLowerCase() === staffDept.toLowerCase() &&
                  r.status === 'In Progress'))
          )
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

        return {
          id: req.id,
          raw_id: req.raw_id,
          title: req.title,
          location: req.location || 'Tại phòng khách',
          priority: req.priority || 'HIGH PRIORITY',
          status: isReqCompleted ? 'Completed' : existingLocal?.status || 'In Progress',
          dueTime: req.time || '15 phút nữa',
          isClaimedFromRobot: true,
          checklist:
            existingLocal?.checklist || generateChecklistForRequest(req),
        };
      });

      // 4. Combine with shift duties
      const shiftDuties = savedLocalTasks.filter((t) => t.isShiftDuty) || getDefaultShiftDuties();
      const combined = [...syncedClaimedTasks, ...shiftDuties];

      if (combined.length === 0) {
        const defaultStarters = [
          {
            id: `TASK-STARTER-${staffDept.slice(0, 2).toUpperCase()}-01`,
            title: `Tiếp nhận yêu cầu dịch vụ đầu ca (${staffDept})`,
            location: 'Trực ca phòng ban',
            priority: 'NORMAL',
            status: 'In Progress',
            dueTime: 'Trong ca trực',
            checklist: [
              { id: 'st1', text: 'Bật thông báo ứng dụng tiếp nhận yêu cầu từ HCRobot', done: true },
              { id: 'st2', text: 'Sẵn sàng bấm "Nhận Xử Lý" khi có yêu cầu mới', done: false },
            ],
          },
        ];
        setTasks(defaultStarters);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultStarters));
      } else {
        setTasks(combined);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(combined));
      }
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
  const handleToggleChecklist = (taskId, checkId) => {
    const updated = tasks.map((task) => {
      if (task.id !== taskId) return task;
      const nextChecklist = task.checklist.map((item) =>
        item.id === checkId ? { ...item, done: !item.done } : item
      );
      const allDone = nextChecklist.every((item) => item.done);
      return {
        ...task,
        checklist: nextChecklist,
        status: allDone ? 'Completed' : task.status === 'Completed' ? 'In Progress' : task.status,
      };
    });
    saveTasksState(updated);
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
    totalTasksCount > 0 ? Math.round((completedCount / totalTasksCount) * 100) : 100;

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-8 bg-[#FAF8F5] font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-[#1A1917]">Nhiệm Vụ Của Tôi (My Tasks)</h2>
            <p className="text-xs text-[#78716C] mt-1">
              Nhân viên: <span className="font-bold text-stone-800">{staffName}</span> • {staffRole} (Bộ phận {staffDept})
            </p>
          </div>
        </div>

        {/* 3 Task KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricCard
            title="ĐANG THỰC HIỆN"
            value={inProgressCount}
            subText="Cần ưu tiên xử lý"
            icon={Play}
          />
          <MetricCard
            title="ĐÃ HOÀN THÀNH"
            value={completedCount}
            variant="dark"
            subText="Nhiệm vụ xong"
            icon={CheckCircle2}
          />
          <MetricCard
            title="HIỆU SUẤT CA"
            value={`${completionRate}%`}
            variant="danger-gradient"
            subText="Tỷ lệ hoàn thành"
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
              placeholder="Tìm theo mã nhiệm vụ, phòng, nội dung..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-1.5 rounded-xl bg-[#FAF8F5] border border-[#E0DCD3] text-xs font-medium text-stone-900 outline-none focus:border-stone-400"
            />
          </div>

          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1 bg-[#EFECE6] p-1 rounded-full border border-[#DDD8CE]">
            {[
              { id: 'All', label: 'Tất Cả', count: tasks.length },
              { id: 'In Progress', label: 'Đang Làm', count: inProgressCount },
              { id: 'Completed', label: 'Đã Xong', count: completedCount },
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
              <div className="p-12 text-center bg-white rounded-3xl border border-[#E5E1D8] text-xs text-stone-500">
                Không tìm thấy nhiệm vụ nào phù hợp với bộ lọc hiện tại.
              </div>
            ) : (
              filteredTasks.map((task) => {
                const isUrgent = (task.priority || '').includes('HIGH');
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
                        {isUrgent && (
                          <span className="px-2.5 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-ping" />
                            HIGH PRIORITY
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
