import React, { useState, useEffect } from 'react';
import { MetricCard } from '../../components/dashboard/MetricCard';
import { AssignStaffModal, NewDirectiveModal, InteractiveMapModal } from '../../components/dashboard/Modals';
import { INITIAL_MANAGER_DATA } from '../../data/mockHotelData';
import {
  fetchManagerHubDashboard,
  createManagementDirective,
  assignManagementDirective,
} from '../../services/operationsApi';
import {
  Inbox,
  Sparkles,
  Users,
  Clock,
  Search,
  Droplets,
  BedDouble,
  FileCheck,
  ChevronRight,
  MapPin,
  TrendingUp,
  User,
} from 'lucide-react';

export const HousekeepingManagerDashboard = ({ onNotify = () => {} }) => {
  const [data, setData] = useState(INITIAL_MANAGER_DATA);
  const [filter, setFilter] = useState('All'); // 'All' | 'Unassigned'
  const [searchQuery, setSearchQuery] = useState('');
  const [isDirectiveModalOpen, setIsDirectiveModalOpen] = useState(false);
  const [selectedTaskForAssign, setSelectedTaskForAssign] = useState(null);
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);

  // Load live data from PostgreSQL on mount
  useEffect(() => {
    const loadData = async () => {
      const res = await fetchManagerHubDashboard();
      if (res) {
        setData((prev) => ({
          ...prev,
          department: res.department || prev.department || 'Executive & Housekeeping',
          kpis: res.kpis || prev.kpis,
          liveRequests: res.live_requests?.length > 0 ? res.live_requests : prev.liveRequests,
          staffRoster: res.staff_roster?.length > 0 ? res.staff_roster : prev.staffRoster,
          zoneHeatmap: res.zone_heatmap || prev.zoneHeatmap,
        }));
      }
    };
    loadData();
  }, []);

  // Filter requests
  const liveRequestsList = data.liveRequests || [];
  const filteredRequests = liveRequestsList.filter((req) => {
    if (filter === 'All') return true;
    const s = (req.status || '').toLowerCase().trim();
    const p = (req.priority || '').toUpperCase().trim();
    const type = (req.type || '').toLowerCase().trim();

    if (filter === 'Pending' || filter === 'Unassigned') {
      return s === 'unassigned' || s === 'pending';
    }
    if (filter === 'In Progress') {
      return s === 'in progress' || s === 'in_progress';
    }
    if (filter === 'Completed') {
      return s === 'completed' || s === 'done';
    }
    if (filter === 'Urgent VIP') {
      return p.includes('URGENT') || p.includes('HIGH') || p.includes('VIP');
    }
    if (filter === 'Directives') {
      return type === 'directive' || (req.title || '').toLowerCase().includes('chỉ thị');
    }
    return true;
  });

  // Filter staff roster
  const staffRosterList = data.staffRoster || [];
  const filteredRoster = staffRosterList.filter((staff) => {
    const nameStr = (staff.full_name || staff.name || '').toLowerCase();
    const locStr = (staff.location || '').toLowerCase();
    const query = searchQuery.toLowerCase();
    return nameStr.includes(query) || locStr.includes(query);
  });

  // Action: Create New Directive -> Persists in PostgreSQL
  const handleCreateDirective = async (newDirective) => {
    const createdItem = {
      id: `M-${Math.floor(100 + Math.random() * 900)}`,
      code: `M-${Math.floor(100 + Math.random() * 900)}`,
      title: newDirective.title,
      priority: (newDirective.priority || '').includes('HIGH') ? 'URGENT' : 'PENDING',
      location: newDirective.location || 'Main Entrance',
      reported_time_label: 'Chỉ thị vừa ban hành',
      reportedTime: 'Chỉ thị vừa ban hành',
      status: 'Unassigned',
      type: 'directive',
    };

    setData((prev) => ({
      ...prev,
      liveRequests: [createdItem, ...(prev.liveRequests || [])],
    }));

    await createManagementDirective({
      title: newDirective.title,
      department: newDirective.department || 'Housekeeping',
      priority: (newDirective.priority || '').includes('HIGH') ? 'URGENT' : 'PENDING',
      location: newDirective.location || 'Main Entrance',
      description: newDirective.notes || 'Chỉ thị điều hành từ Tổng Quản Lý',
    });

    onNotify(`Đã phát chỉ thị điều hành mới #${createdItem.id}`);
  };

  // Action: Open Assign Modal
  const handleOpenAssign = (task) => {
    setSelectedTaskForAssign(task);
  };

  // Action: Confirm Assignment -> Persists in PostgreSQL
  const handleConfirmAssignment = async (taskId, assignedTarget) => {
    setData((prev) => ({
      ...prev,
      liveRequests: (prev.liveRequests || []).map((r) =>
        r.id === taskId || r.code === taskId
          ? {
              ...r,
              status: 'In Progress',
              assigned_staff_name: assignedTarget.name,
              assignedStaff: assignedTarget.name,
              assigned_eta: '5m',
              assignedEta: '5m',
              assigned_staff_avatar: assignedTarget.avatar,
              assignedAvatar: assignedTarget.avatar,
            }
          : r
      ),
    }));

    await assignManagementDirective(taskId, 'In Progress', assignedTarget.name);
    onNotify(`Đã phân công ${assignedTarget.name} xử lý chỉ thị #${taskId}`);
  };

  const kpis = data.kpis || {};
  const activeReqCurrent = kpis.activeRequests?.current ?? 12;
  const activeReqTotal = kpis.activeRequests?.total ?? 45;
  const roomsCleanedCurrent = kpis.roomsCleaned?.current ?? 78;
  const roomsCleanedTotal = kpis.roomsCleaned?.total ?? 120;
  const staffActiveCurrent = kpis.staffActive?.current ?? 8;
  const staffActiveTotal = kpis.staffActive?.total ?? 10;
  const responseTimeAvg = kpis.responseTime?.avg ?? '14m';
  const responseTimeTrend = kpis.responseTime?.trend || [18, 16, 15, 17, 14, 13, 14];

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-8 bg-[#FAF8F5] font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Subheader: Department Control & Action */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold tracking-widest text-[#78716C] uppercase">
              EXECUTIVE OPERATIONS & CONTROL
            </p>
            <h2 className="text-xl font-bold text-[#1A1917] mt-0.5">Management Hub</h2>
          </div>

          <button
            onClick={() => setIsDirectiveModalOpen(true)}
            className="px-5 py-2.5 rounded-full bg-[#18181B] hover:bg-black text-white text-xs font-bold transition-all shadow-sm flex items-center gap-2 self-start cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>Ban Hành Chỉ Thị Mới</span>
          </button>
        </div>

        {/* 4 KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="YÊU CẦU ĐANG XỬ LÝ"
            value={activeReqCurrent}
            subText={`/ ${activeReqTotal} Tổng số`}
            icon={Inbox}
          />
          <MetricCard
            title="PHÒNG ĐÃ DỌN SẠCH"
            variant="progress"
            progressValue={roomsCleanedCurrent}
            progressTotal={roomsCleanedTotal}
          />
          <MetricCard
            title="NHÂN SỰ TRỰC CA"
            value={staffActiveCurrent}
            subText={`/ ${staffActiveTotal} Tổng định biên`}
            icon={Users}
          />
          <MetricCard
            title="THỜI GIAN PHẢN HỒI"
            value={responseTimeAvg}
            subText="Trung bình"
            variant="sparkline"
            sparklineData={responseTimeTrend}
            icon={Clock}
          />
        </div>

        {/* Main Section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
          {/* Left Column: Live Requests */}
          <div className="lg:col-span-8 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-[#1A1917] shrink-0">Yêu Cầu & Chỉ Thị Trực Tiếp</h3>
              <div className="flex items-center gap-1 bg-[#EFECE6] p-1 rounded-full border border-[#DDD8CE] overflow-x-auto no-scrollbar max-w-full">
                {['All', 'Pending', 'In Progress', 'Completed', 'Urgent VIP', 'Directives'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => {
                      setFilter(tab);
                      onNotify(`Đã lọc chỉ thị điều hành theo: ${tab}`);
                    }}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                      filter === tab
                        ? 'bg-[#18181B] text-white shadow-sm'
                        : 'text-[#78716C] hover:text-[#1A1917]'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {/* Request Cards */}
            <div className="space-y-4">
              {filteredRequests.map((req) => {
                const reqPriority = req.priority || 'NORMAL';
                const isUrgent = reqPriority.toUpperCase().includes('URGENT') || reqPriority.toUpperCase().includes('HIGH');
                const isUnassigned = (req.status || '').toLowerCase() === 'unassigned';
                const staffAssignedName =
                  req.assigned_staff_name ||
                  req.assignedStaff ||
                  (typeof req.assignedTo === 'object' ? req.assignedTo?.name : req.assignedTo);
                const staffAvatar =
                  req.assigned_staff_avatar ||
                  req.assignedAvatar ||
                  (typeof req.assignedTo === 'object' ? req.assignedTo?.avatar : null);
                const eta = req.assigned_eta || req.assignedEta || '5m';

                return (
                  <div
                    key={req.id || req.code}
                    className={`bg-white rounded-2xl border border-[#E5E1D8] p-5 shadow-sm space-y-3 transition-all hover:shadow-md ${
                      isUrgent ? 'border-l-4 border-l-red-500' : ''
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      {/* Icon */}
                      <div
                        className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                          isUrgent ? 'bg-red-100 text-red-600' : 'bg-[#F0ECE3] text-stone-700'
                        }`}
                      >
                        {req.type === 'spill' && <Droplets className="w-5 h-5" />}
                        {req.type === 'room_service' && <BedDouble className="w-5 h-5" />}
                        {req.type === 'towels' && <FileCheck className="w-5 h-5" />}
                        {req.type !== 'spill' && req.type !== 'room_service' && req.type !== 'towels' && (
                          <Sparkles className="w-5 h-5" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-bold text-[#1A1917]">{req.title}</h4>
                          <span
                            className={`flex items-center gap-1 text-xs font-bold ${
                              isUrgent ? 'text-red-600' : 'text-stone-500'
                            }`}
                          >
                            <span
                              className={`w-2 h-2 rounded-full ${
                                isUrgent ? 'bg-red-600 animate-ping' : 'bg-stone-400'
                              }`}
                            />
                            <span>{reqPriority}</span>
                          </span>
                        </div>

                        <p className="text-xs text-[#78716C] mt-1">
                          <span className="font-semibold text-stone-800">{req.location || 'Main Floor'}</span> •{' '}
                          {req.reported_time_label || req.reportedTime || 'Gần đây'}
                        </p>

                        {/* Footer */}
                        <div className="pt-3 mt-3 border-t border-[#F5F2EB] flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs text-stone-500 font-medium">
                            {isUnassigned ? (
                              <>
                                <span className="text-stone-400">⊘</span>
                                <span>Chưa gán nhân sự</span>
                              </>
                            ) : staffAssignedName ? (
                              <div className="flex items-center gap-2">
                                {staffAvatar ? (
                                  <img
                                    src={staffAvatar}
                                    alt={staffAssignedName}
                                    className="w-5 h-5 rounded-full object-cover"
                                  />
                                ) : (
                                  <div className="w-5 h-5 rounded-full bg-stone-800 text-white flex items-center justify-center text-[10px] font-bold">
                                    {staffAssignedName.charAt(0)}
                                  </div>
                                )}
                                <span className="font-semibold text-stone-800">
                                  {staffAssignedName} • ETA: {eta}
                                </span>
                              </div>
                            ) : null}
                          </div>

                          <div>
                            {isUnassigned ? (
                              <button
                                onClick={() => setSelectedTaskForAssign(req)}
                                className="px-5 py-1.5 rounded-full bg-[#18181B] hover:bg-black text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                              >
                                <span>Phân Công Nhân Sự</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <button
                                onClick={() => onNotify(`Xem nhật ký chỉ thị #${req.code || req.id}`)}
                                className="text-xs font-bold text-stone-700 hover:text-black cursor-pointer"
                              >
                                Chi Tiết
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Staff Roster & Zone Heatmap */}
          <div className="lg:col-span-4 space-y-4">
            {/* Staff Roster Card */}
            <div className="bg-white rounded-2xl border border-[#E5E1D8] p-5 shadow-sm space-y-3">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#1A1917]">
                  Danh Sách Nhân Sự Trực Ca
                </h3>
                <p className="text-[10px] font-bold text-[#78716C] tracking-wider uppercase mt-0.5">
                  CURRENT SHIFT ROSTER
                </p>
              </div>

              {/* Search Box */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Tìm nhân viên, khu vực..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-[#FAF8F5] border border-[#E0DCD3] text-xs font-medium text-stone-800 outline-none focus:border-stone-400"
                />
              </div>

              {/* Staff List */}
              <div className="space-y-3 pt-1">
                {filteredRoster.map((staff) => {
                  const sName = staff.full_name || staff.name || 'Staff';
                  const sAvatar = staff.avatar_url || staff.avatar;
                  const sLocation = staff.location || 'Main Hotel';
                  const sTasks =
                    staff.tasks ||
                    (staff.current_tasks_count ? `${staff.current_tasks_count} nhiệm vụ` : 'Trực ca');
                  const sStatus = (staff.status || 'available').toLowerCase();

                  return (
                    <div
                      key={staff.id || staff.code || sName}
                      className="flex items-center justify-between p-2 rounded-xl hover:bg-[#FAF8F5] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {sAvatar ? (
                          <img
                            src={sAvatar}
                            alt={sName}
                            className="w-8 h-8 rounded-full object-cover border border-[#E5E1D8]"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-[#18181B] text-white flex items-center justify-center font-bold text-xs">
                            {sName.charAt(0)}
                          </div>
                        )}
                        <div>
                          <p className="text-xs font-bold text-[#1A1917]">{sName}</p>
                          <p className="text-[11px] text-[#78716C]">
                            {sLocation} • {sTasks}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        {sStatus === 'available' && (
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                        )}
                        {sStatus === 'active' && (
                          <span className="w-2.5 h-2.5 rounded-full bg-sky-500 inline-block" />
                        )}
                        {sStatus.includes('busy') && (
                          <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                            Bận
                          </span>
                        )}
                        {sStatus === 'off_shift' && (
                          <span className="text-[11px] font-medium text-stone-400">Nghỉ ca</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Zone Heatmap Card */}
            <div className="bg-white rounded-2xl border border-[#E5E1D8] p-5 shadow-sm space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#1A1917]">
                Bản Đồ Nhiệt Khu Vực (Zone Heatmap)
              </h3>

              {/* Heatmap Graphic Representation */}
              <div
                onClick={() => setIsMapModalOpen(true)}
                className="w-full h-28 rounded-xl bg-[#F0ECE3] border border-[#E0DCD3] p-3 flex flex-col justify-between cursor-pointer hover:bg-[#EAE5DC] transition-colors relative overflow-hidden"
              >
                {/* Zone Grid Cells */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="h-9 rounded-lg bg-[#E2DDCF] flex items-center justify-center text-[10px] font-mono text-stone-600">
                    Floor 2
                  </div>
                  <div className="h-9 rounded-lg bg-red-200/90 border border-red-300 flex items-center justify-center text-[10px] font-mono text-red-800 font-bold relative">
                    <span className="w-2 h-2 rounded-full bg-red-600 absolute top-1 right-1 animate-ping" />
                    Floor 4
                  </div>
                  <div className="h-9 rounded-lg bg-[#E2DDCF] flex items-center justify-center text-[10px] font-mono text-stone-600">
                    Floor 5
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] text-stone-600 font-semibold pt-1">
                  <span className="flex items-center gap-1">
                    <TrendingUp className="w-3 h-3 text-red-500" />
                    {data.zoneHeatmap?.activeZone || 'Floor 4 Hoạt Động Cao'}
                  </span>
                  <span className="text-stone-400">Bấm để mở rộng</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* New Directive Modal */}
      <NewDirectiveModal
        isOpen={isDirectiveModalOpen}
        onClose={() => setIsDirectiveModalOpen(false)}
        onSubmit={handleCreateDirective}
      />

      {/* Assign Modal */}
      <AssignStaffModal
        isOpen={!!selectedTaskForAssign}
        onClose={() => setSelectedTaskForAssign(null)}
        task={selectedTaskForAssign}
        staffList={(data.staffRoster || []).filter((s) => (s.status || '').toLowerCase() !== 'off_shift')}
        onAssign={handleConfirmAssignment}
      />

      {/* Map Modal */}
      <InteractiveMapModal
        isOpen={isMapModalOpen}
        onClose={() => setIsMapModalOpen(false)}
        title="Executive Operations & Zone Heatmap"
      />
    </div>
  );
};
