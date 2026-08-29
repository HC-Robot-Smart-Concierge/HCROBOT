import React, { useState, useEffect } from 'react';
import { MetricCard } from '../../components/dashboard/MetricCard';
import { NewDirectiveModal, InteractiveMapModal } from '../../components/dashboard/Modals';
import { INITIAL_MAINTENANCE_DATA } from '../../data/mockHotelData';
import {
  fetchMaintenanceDashboard,
  createMaintenanceRequest,
  updateMaintenanceStatus,
} from '../../services/operationsApi';
import {
  AlertCircle,
  Clock,
  Wrench,
  CheckCircle2,
  Droplets,
  Fan,
  Lightbulb,
  Plus,
  SlidersHorizontal,
  Bot,
  MapPin,
  Calendar,
  CheckCheck,
} from 'lucide-react';

export const MaintenanceDashboard = ({ currentUser, onNotify = () => {} }) => {
  const staffName = currentUser?.full_name || currentUser?.name || 'James Doe';
  const staffId = currentUser?.id || currentUser?.username || 'user';

  const [data, setData] = useState(INITIAL_MAINTENANCE_DATA);
  const [filter, setFilter] = useState('All');
  const [isNewRequestModalOpen, setIsNewRequestModalOpen] = useState(false);
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);

  // Load live data from PostgreSQL on mount
  useEffect(() => {
    const loadData = async () => {
      const res = await fetchMaintenanceDashboard();
      if (res && res.requests) {
        setData((prev) => ({
          ...prev,
          kpis: res.kpis || prev.kpis,
          requests: res.requests.length > 0 ? res.requests : prev.requests,
          staffAvailability: res.staff_availability?.length > 0 ? res.staff_availability : prev.staffAvailability,
        }));
      }
    };
    loadData();
  }, []);

  const filteredRequests = (data.requests || []).filter((req) => {
    if (filter === 'All') return true;
    if (filter === 'Pending') return req.status === 'Pending' || req.status === 'Unassigned';
    if (filter === 'In Progress') return req.status === 'In Progress';
    if (filter === 'Completed') return req.status === 'Completed';
    if (filter === 'Plumbing') return (req.category || '').toLowerCase() === 'plumbing';
    if (filter === 'HVAC') return (req.category || '').toLowerCase() === 'hvac';
    if (filter === 'Electrical') return (req.category || '').toLowerCase() === 'electrical';
    return true;
  });

  // Action: Self-Claim Maintenance Task -> Persists in PostgreSQL with Staff Identity
  const handleClaim = async (taskId) => {
    setData((prev) => ({
      ...prev,
      requests: prev.requests.map((r) =>
        (r.id === taskId || r.ticket_code === taskId)
          ? { ...r, status: 'In Progress', assignedTo: staffName }
          : r
      ),
      kpis: {
        ...prev.kpis,
        pendingRequests: Math.max(0, prev.kpis.pendingRequests - 1),
        inProgress: prev.kpis.inProgress + 1,
      },
    }));
    await updateMaintenanceStatus(taskId, 'In Progress', staffName);
    onNotify(`Bạn (${staffName}) đã nhận xử lý phiếu bảo trì #${taskId}`);
  };

  // Action: Mark Completed -> Persists in PostgreSQL
  const handleComplete = async (taskId) => {
    setData((prev) => ({
      ...prev,
      requests: prev.requests.map((r) =>
        (r.id === taskId || r.ticket_code === taskId)
          ? { ...r, status: 'Completed' }
          : r
      ),
      kpis: {
        ...prev.kpis,
        inProgress: Math.max(0, prev.kpis.inProgress - 1),
        completedToday: {
          ...prev.kpis.completedToday,
          count: prev.kpis.completedToday.count + 1,
        },
      },
    }));
    await updateMaintenanceStatus(taskId, 'Completed', staffName);
    onNotify(`Đã hoàn tất xử lý phiếu bảo trì #${taskId}`);
  };

  // Action: Submit New Request -> Persists in PostgreSQL
  const handleCreateNew = async (newReq) => {
    const createdItem = {
      id: `MN-${Math.floor(100 + Math.random() * 900)}`,
      title: newReq.title,
      priority: newReq.priority,
      reportedTime: 'Vừa xong',
      location: newReq.location || 'Room 412',
      category: 'plumbing',
      description: newReq.description || 'Khách báo sự cố',
      source: 'PHÁT TỪ HCROBOT',
      status: 'Pending',
    };
    setData((prev) => ({
      ...prev,
      requests: [createdItem, ...prev.requests],
    }));

    await createMaintenanceRequest({
      title: newReq.title,
      category: 'general',
      priority: newReq.priority,
      location: newReq.location || 'Room 412',
      description: newReq.description || 'Khách báo sự cố',
      source: 'PHÁT TỪ HCROBOT',
    });

    onNotify(`Đã tạo phiếu bảo trì mới #${createdItem.id}`);
  };

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-8 bg-[#FAF8F5] font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header & New Request Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-[#1A1917]">Maintenance Operations</h2>
            <p className="text-xs text-[#78716C] mt-1">
              Hàng đợi yêu cầu sửa chữa từ Robot HCRobot • Kỹ thuật viên nhận trực tiếp (Self-Claim)
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs font-bold text-stone-700 bg-white px-4 py-2 rounded-full border border-[#DDD8CE] shadow-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Kỹ thuật viên: {staffName}</span>
            </div>

            <button
              onClick={() => setIsNewRequestModalOpen(true)}
              className="px-5 py-2 rounded-full bg-[#18181B] hover:bg-black text-white text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4 text-amber-300" />
              <span>Tạo Phiếu Mới</span>
            </button>
          </div>
        </div>

        {/* 4 Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="ƯU TIÊN CAO"
            value={data.kpis.highPriority?.count ?? 2}
            delta={data.kpis.highPriority?.delta ?? '+1'}
            deltaType="negative"
            icon={AlertCircle}
          />
          <MetricCard
            title="CHỜ TIẾP NHẬN"
            value={data.kpis.pendingRequests ?? 5}
            icon={Clock}
          />
          <MetricCard
            title="ĐANG XỬ LÝ"
            value={data.kpis.inProgress ?? 3}
            icon={Wrench}
          />
          <MetricCard
            title="HOÀN TẤT HÔM NAY"
            value={data.kpis.completedToday?.count ?? 12}
            delta={data.kpis.completedToday?.delta ?? '+3'}
            deltaType="positive"
            icon={CheckCircle2}
          />
        </div>

        {/* Main Section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
          {/* Left Column: Active Requests */}
          <div className="lg:col-span-8 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#1A1917]">Hàng Đợi Phiếu Kỹ Thuật Từ Robot</h3>
              <div className="flex items-center gap-1.5 text-xs">
                {/* Filter Pills */}
                <div className="flex items-center gap-1 bg-[#EFECE6] p-1 rounded-full border border-[#DDD8CE] overflow-x-auto no-scrollbar max-w-full">
                  {['All', 'Pending', 'In Progress', 'Completed', 'Plumbing', 'HVAC', 'Electrical'].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => {
                        setFilter(tab);
                        onNotify(`Đã lọc danh sách kỹ thuật theo: ${tab}`);
                      }}
                      className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
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
            </div>

            {/* Requests List */}
            <div className="space-y-4">
              {filteredRequests.length === 0 ? (
                <div className="p-8 text-center bg-white rounded-2xl border border-[#E5E1D8] text-stone-500 text-xs font-medium">
                  Không có yêu cầu kỹ thuật nào trong danh mục "{filter}".
                </div>
              ) : (
                filteredRequests.map((req) => {
                  const isHigh = (req.priority || '').includes('HIGH');
                  const isPending = req.status === 'Pending' || req.status === 'Unassigned';
                  const isInProgress = req.status === 'In Progress';
                  const isCompleted = req.status === 'Completed';
                  const handlerName = req.assignedTo || req.assigned_to;

                  return (
                    <div
                      key={req.id}
                      className={`bg-white rounded-2xl border border-[#E5E1D8] p-5 shadow-sm space-y-3 transition-all hover:shadow-md ${
                        isInProgress ? 'border-l-4 border-l-sky-500' : ''
                      } ${isCompleted ? 'border-l-4 border-l-emerald-500 bg-emerald-50/5' : ''}`}
                    >
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                              req.category === 'plumbing'
                                ? 'bg-red-50 text-red-600'
                                : req.category === 'hvac'
                                ? 'bg-sky-50 text-sky-600'
                                : 'bg-stone-100 text-stone-600'
                            }`}
                          >
                            {req.category === 'plumbing' && <Droplets className="w-5 h-5" />}
                            {req.category === 'hvac' && <Fan className="w-5 h-5" />}
                            {req.category === 'electrical' && <Lightbulb className="w-5 h-5" />}
                            {!['plumbing', 'hvac', 'electrical'].includes(req.category) && (
                              <Wrench className="w-5 h-5" />
                            )}
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-bold text-[#1A1917]">{req.title}</h4>
                              {isHigh && (
                                <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold">
                                  HIGH
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-[#78716C] mt-0.5">
                              {req.location} • Báo cáo lúc: {req.reportedTime || 'Gần đây'}
                            </p>
                          </div>
                        </div>

                        <span className="font-mono text-xs font-bold text-stone-500">{req.id}</span>
                      </div>

                      {/* Description */}
                      <p className="text-xs text-stone-700 bg-[#FAF8F5] p-3 rounded-xl border border-[#EAE6DE]">
                        {req.description}
                      </p>

                      {/* Footer Actions */}
                      <div className="pt-2 border-t border-[#F5F2EB] flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs">
                          {isPending ? (
                            <span className="text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200 font-bold text-[11px]">
                              Chờ Kỹ thuật viên tiếp nhận
                            </span>
                          ) : isInProgress ? (
                            <span className="text-sky-800 bg-sky-50 px-2.5 py-0.5 rounded-full border border-sky-200 font-bold text-[11px]">
                              Đang sửa chữa bởi: <span className="underline">{handlerName || staffName}</span>
                            </span>
                          ) : (
                            <span className="text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 font-bold text-[11px] flex items-center gap-1">
                              <CheckCheck className="w-3 h-3 text-emerald-600" />
                              Hoàn tất bởi: {handlerName || staffName}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {isPending && (
                            <button
                              onClick={() => handleClaim(req.id)}
                              className="px-5 py-2 rounded-full bg-[#18181B] hover:bg-black text-white text-xs font-bold transition-all shadow-md cursor-pointer active:scale-95"
                            >
                              <span>✋ Nhận Sửa Chữa</span>
                            </button>
                          )}

                          {isInProgress && (
                            <button
                              onClick={() => handleComplete(req.id)}
                              className="px-5 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Hoàn Thành</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Staff Availability & Facility Map */}
          <div className="lg:col-span-4 space-y-4">
            {/* Staff Availability Card */}
            <div className="bg-white rounded-2xl border border-[#E5E1D8] p-5 shadow-sm space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#1A1917]">
                Kỹ Thuật Viên Trong Ca
              </h3>
              <p className="text-[11px] text-stone-500">
                Tất cả thành viên trong ca đều nhận thông báo đồng thời từ Robot.
              </p>

              <div className="space-y-2.5 pt-1">
                {(data.staffAvailability || []).map((staff) => (
                  <div
                    key={staff.id || staff.name}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-[#FAF8F5] border border-[#EAE6DE]"
                  >
                    <div className="flex items-center gap-2.5">
                      <img
                        src={
                          staff.avatar ||
                          'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100&auto=format&fit=crop&q=80'
                        }
                        alt={staff.name}
                        className="w-7 h-7 rounded-full object-cover"
                      />
                      <div>
                        <p className="text-xs font-bold text-stone-800">{staff.name}</p>
                        <p className="text-[10px] text-stone-500">{staff.specialty || 'Kỹ thuật tổng hợp'}</p>
                      </div>
                    </div>
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  </div>
                ))}
              </div>
            </div>

            {/* Interactive Facility Map Card */}
            <div className="bg-white rounded-2xl border border-[#E5E1D8] p-5 shadow-sm space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#1A1917]">
                Sơ Đồ Kỹ Thuật Tòa Nhà
              </h3>

              <div
                onClick={() => setIsMapModalOpen(true)}
                className="w-full h-32 rounded-xl bg-[#F0ECE3] border border-[#E0DCD3] p-3 flex flex-col justify-between cursor-pointer hover:bg-[#EAE5DC] transition-colors relative overflow-hidden"
              >
                <div className="flex items-center justify-between text-[11px] font-bold text-stone-700">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-red-500" />
                    <span>3 khu vực sự cố đang xử lý</span>
                  </span>
                  <span className="text-[10px] text-stone-400">Bấm để mở</span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-mono font-bold">
                  <div className="p-2 rounded-lg bg-emerald-100 text-emerald-800">Zone A (OK)</div>
                  <div className="p-2 rounded-lg bg-red-100 text-red-800 animate-pulse">Zone B (Rò rỉ)</div>
                  <div className="p-2 rounded-lg bg-emerald-100 text-emerald-800">Zone C (OK)</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* New Request Modal */}
      <NewDirectiveModal
        isOpen={isNewRequestModalOpen}
        onClose={() => setIsNewRequestModalOpen(false)}
        onSubmit={handleCreateNew}
      />

      {/* Map Modal */}
      <InteractiveMapModal
        isOpen={isMapModalOpen}
        onClose={() => setIsMapModalOpen(false)}
        title="Sơ Đồ Kỹ Thuật & Mạng Lưới Hạ Tầng Khách Sạn"
      />
    </div>
  );
};
