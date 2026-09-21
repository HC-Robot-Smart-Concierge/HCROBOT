import React, { useEffect, useState } from 'react';
import {
  Inbox,
  PhoneCall,
  Bot,
  CheckCircle2,
  Clock,
  Wifi,
  BatteryCharging,
  MapPin,
  RefreshCw,
  Search,
  User,
  Check,
} from 'lucide-react';
import {
  fetchUnifiedRequests,
  fetchRobotFleet,
  updateGenericRequestStatus,
} from '../../services/operationsApi';

export const StaffOverviewDashboard = ({ currentUser, onNotify = () => {} }) => {
  const staffName = currentUser?.full_name || currentUser?.name || 'Hotel Staff';
  const staffDept = currentUser?.department || 'Staff';
  const isExecutive = staffDept === 'Executive' || currentUser?.username === 'admin';

  const [isLoading, setIsLoading] = useState(false);
  const [requests, setRequests] = useState([]);
  const [robotFleet, setRobotFleet] = useState([]);
  const [statusFilter, setStatusFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Voice & Support Calls Mock Data (Synchronized with Backend API calls)
  const [supportCalls, setSupportCalls] = useState([
    {
      id: 'CALL-8942',
      room: 'Room 402',
      guestName: 'Mr. A. Sterling',
      time: '10:42 AM - Hôm nay',
      duration: '2 phút 15 giây',
      status: 'Connected',
      type: 'Video Support',
      transcript: 'Khách báo vòi nước chậu rửa mặt bị rò rỉ, nhờ nhân viên kỹ thuật qua xem.',
    },
    {
      id: 'CALL-8939',
      room: 'Suite 501',
      guestName: 'Ms. Elena Rostova',
      time: '09:50 AM - Hôm nay',
      duration: '1 phút 40 giây',
      status: 'Ended',
      type: 'Voice Assistant',
      transcript: 'Yêu cầu robot mang 2 bộ khăn tắm cao cấp và đồ dùng vệ sinh cá nhân lên phòng.',
    },
    {
      id: 'CALL-8925',
      room: 'Room 310',
      guestName: 'Dr. Robert Chen',
      time: '08:30 AM - Hôm nay',
      duration: '3 phút 05 giây',
      status: 'Ended',
      type: 'F&B Order Call',
      transcript: 'Đặt đơn bữa sáng Artisan Breakfast & Espresso không dùng đường.',
    },
  ]);

  // Load live data from PostgreSQL DB & Fleet Service
  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      const [reqData, fleetData] = await Promise.all([
        fetchUnifiedRequests(),
        fetchRobotFleet(),
      ]);

      if (Array.isArray(reqData) && reqData.length > 0) {
        setRequests(reqData);
      }
      if (Array.isArray(fleetData) && fleetData.length > 0) {
        setRobotFleet(fleetData);
      } else {
        // Fallback standard fleet data
        setRobotFleet([
          {
            id: 'unit_01',
            unit_code: 'HCRobot Unit 01',
            status: 'Delivering',
            battery_level: 92,
            location: 'Tầng 4 - Hành lang phòng 402',
            status_color: 'bg-emerald-500',
            ip: '192.168.1.120',
          },
          {
            id: 'unit_02',
            unit_code: 'HCRobot Unit 02',
            status: 'Standby / Ready',
            battery_level: 85,
            location: 'Trạm Sạc Tự Động - Sảnh Chính',
            status_color: 'bg-sky-500',
            ip: '192.168.1.121',
          },
          {
            id: 'unit_03',
            unit_code: 'Bot Unit Alpha',
            status: 'Docked & Charging',
            battery_level: 98,
            location: 'Khu Vực Hỗ Trợ Hành Lý Bellman',
            status_color: 'bg-indigo-500',
            ip: '192.168.1.122',
          },
        ]);
      }
    } catch (err) {
      console.error('Error loading overview dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Department Filter matching RequestsPage
  const isDeptMatch = (reqDept) => {
    if (isExecutive) return true;
    if (!reqDept) return true;
    const rD = reqDept.toLowerCase().trim();
    const uD = staffDept.toLowerCase().trim();
    if (rD === uD) return true;
    if ((uD.includes('f&b') || uD.includes('room')) && (rD.includes('f&b') || rD.includes('room') || rD.includes('ẩm thực'))) return true;
    if ((uD.includes('housekeeping') || uD.includes('buồng')) && (rD.includes('housekeeping') || rD.includes('buồng'))) return true;
    if ((uD.includes('bell') || uD.includes('hành lý')) && (rD.includes('bell') || rD.includes('hành lý'))) return true;
    if ((uD.includes('maint') || uD.includes('bảo trì') || uD.includes('kỹ thuật')) && (rD.includes('maint') || rD.includes('bảo trì') || rD.includes('kỹ thuật'))) return true;
    if ((uD.includes('reception') || uD.includes('lễ tân')) && (rD.includes('reception') || rD.includes('lễ tân'))) return true;
    return false;
  };

  const scopedRequests = requests.filter((r) => isDeptMatch(r.department));

  // Request Statistics
  const totalReqCount = scopedRequests.length;
  const pendingReqCount = scopedRequests.filter((r) => {
    const s = (r.status || '').toLowerCase();
    return s === 'pending' || s === 'unassigned' || s === 'waiting';
  }).length;
  const inProgressReqCount = scopedRequests.filter((r) => {
    const s = (r.status || '').toLowerCase();
    return s === 'in progress' || s === 'in_progress' || s === 'cooking' || s === 'delivering';
  }).length;
  const completedReqCount = scopedRequests.filter((r) => {
    const s = (r.status || '').toLowerCase();
    return s === 'completed' || s === 'ready' || s === 'delivered';
  }).length;

  // Filtered list for table
  const filteredRequests = scopedRequests.filter((r) => {
    const matchStatus = (() => {
      if (statusFilter === 'All') return true;
      const s = (r.status || '').toLowerCase();
      if (statusFilter === 'Pending') return s === 'pending' || s === 'unassigned' || s === 'waiting';
      if (statusFilter === 'In Progress') return s === 'in progress' || s === 'in_progress' || s === 'cooking' || s === 'delivering';
      if (statusFilter === 'Completed') return s === 'completed' || s === 'ready' || s === 'delivered';
      return true;
    })();

    const matchSearch =
      (r.id || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.location || '').toLowerCase().includes(searchQuery.toLowerCase());

    return matchStatus && matchSearch;
  });

  const handleUpdateStatus = async (reqId, nextStatus) => {
    setRequests((prev) =>
      prev.map((r) => (r.id === reqId ? { ...r, status: nextStatus, assignedTo: staffName } : r))
    );
    await updateGenericRequestStatus(reqId, nextStatus, staffName);
    onNotify(`Đã cập nhật trạng thái phiếu ${reqId} ➔ ${nextStatus}`);
  };

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 bg-[#FCFAF7] font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Title & Refresh Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-[#1A1917]">
              Tổng Quan Vận Hành & Tình Trạng HCRobot
            </h2>
            <p className="text-xs text-[#78716C] mt-1">
              Bảng điều khiển trung tâm theo dõi chỉ số Yêu Cầu, Cuộc Gọi Hỗ Trợ và Đội Xe Robot Tự Hành.
            </p>
          </div>

          <button
            onClick={loadDashboardData}
            className="px-4 py-2 rounded-full bg-white border border-[#E8E5E0] text-xs font-bold text-stone-700 hover:bg-[#F5F2EB] transition-all flex items-center gap-2 shadow-sm cursor-pointer self-start sm:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Làm Mới Dữ Liệu</span>
          </button>
        </div>

        {/* ========================================================================= */}
        {/* SECTION 1: THỐNG KÊ REQUESTS (REQUEST STATISTICS) */}
        {/* ========================================================================= */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-[#211F1D] flex items-center gap-2">
              <Inbox className="w-4 h-4 text-stone-700" />
              <span>1. Thống Kê Yêu Cầu Dịch Vụ (Requests)</span>
            </h3>
            <span className="text-xs text-[#78716C] font-semibold">
              Bộ phận: <strong className="text-stone-900">{isExecutive ? 'Toàn Khách Sạn' : staffDept}</strong>
            </span>
          </div>

          {/* KPI Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-white border border-[#E8E5E0] shadow-sm space-y-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#78716C]">
                Tổng Yêu Cầu
              </span>
              <div className="flex items-baseline justify-between pt-1">
                <span className="text-2xl font-black text-[#1A1917]">{totalReqCount}</span>
                <span className="text-[11px] font-bold text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full">
                  Tất cả phiếu
                </span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-[#E8E5E0] shadow-sm space-y-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700">
                Chờ Tiếp Nhận
              </span>
              <div className="flex items-baseline justify-between pt-1">
                <span className="text-2xl font-black text-amber-900">{pendingReqCount}</span>
                <span className="text-[11px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                  Cần xử lý
                </span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-[#E8E5E0] shadow-sm space-y-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-sky-700">
                Đang Xử Lý
              </span>
              <div className="flex items-baseline justify-between pt-1">
                <span className="text-2xl font-black text-sky-900">{inProgressReqCount}</span>
                <span className="text-[11px] font-bold text-sky-800 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-200">
                  Đang thực hiện
                </span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-[#E8E5E0] shadow-sm space-y-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">
                Đã Hoàn Thành
              </span>
              <div className="flex items-baseline justify-between pt-1">
                <span className="text-2xl font-black text-emerald-900">{completedReqCount}</span>
                <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  Hoàn tất
                </span>
              </div>
            </div>
          </div>

          {/* Quick Filter & Requests Table */}
          <div className="rounded-2xl bg-white border border-[#E8E5E0] p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Tìm kiếm phiếu..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-[#FAF8F5] border border-[#E0DCD3] text-xs outline-none focus:border-stone-400"
                />
              </div>

              <div className="flex items-center gap-1.5 bg-[#F4F3F0] p-1 rounded-full border border-[#E0DDD8]">
                {['All', 'Pending', 'In Progress', 'Completed'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      statusFilter === st
                        ? 'bg-[#18181B] text-white shadow-sm'
                        : 'text-stone-600 hover:text-black'
                    }`}
                  >
                    {st === 'All'
                      ? 'Tất Cả'
                      : st === 'Pending'
                      ? 'Chờ Tiếp Nhận'
                      : st === 'In Progress'
                      ? 'Đang Xử Lý'
                      : 'Hoàn Thành'}
                  </button>
                ))}
              </div>
            </div>

            {/* Desktop Table & Mobile Ultra-Simple Cards */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#E8E5E0] text-[10px] font-extrabold uppercase tracking-wider text-[#78716C]">
                    <th className="py-2.5 px-3">Mã Phiếu</th>
                    <th className="py-2.5 px-3">Nội Dung Yêu Cầu</th>
                    <th className="py-2.5 px-3">Vị Trí / Phòng</th>
                    <th className="py-2.5 px-3">Bộ Phận</th>
                    <th className="py-2.5 px-3">Trạng Thái</th>
                    <th className="py-2.5 px-3 text-right">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0ECE6]">
                  {filteredRequests.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-stone-400">
                        Không có yêu cầu nào phù hợp.
                      </td>
                    </tr>
                  ) : (
                    filteredRequests.slice(0, 5).map((r) => {
                      const isPending =
                        (r.status || '').toLowerCase() === 'pending' ||
                        (r.status || '').toLowerCase() === 'unassigned';
                      const isInProgress =
                        (r.status || '').toLowerCase() === 'in progress' ||
                        (r.status || '').toLowerCase() === 'cooking';
                      const isCompleted =
                        (r.status || '').toLowerCase() === 'completed' ||
                        (r.status || '').toLowerCase() === 'ready';

                      return (
                        <tr key={r.id} className="hover:bg-[#FAF8F5] transition-colors">
                          <td className="py-3 px-3 font-mono font-bold text-stone-900">{r.id}</td>
                          <td className="py-3 px-3 font-semibold text-stone-800">{r.title}</td>
                          <td className="py-3 px-3 font-medium text-stone-700">{r.location}</td>
                          <td className="py-3 px-3 font-medium text-stone-600">
                            {r.department || staffDept}
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                isPending
                                  ? 'bg-amber-100 text-amber-800'
                                  : isInProgress
                                  ? 'bg-sky-100 text-sky-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {r.status || 'Pending'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            {isPending && (
                              <button
                                onClick={() => handleUpdateStatus(r.id, 'In Progress')}
                                className="px-3 py-1 rounded-lg bg-black text-white text-[11px] font-bold hover:bg-stone-800 cursor-pointer"
                              >
                                Nhận Xử Lý
                              </button>
                            )}
                            {isInProgress && (
                              <button
                                onClick={() => handleUpdateStatus(r.id, 'Completed')}
                                className="px-3 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-bold hover:bg-emerald-700 cursor-pointer"
                              >
                                Hoàn Thành
                              </button>
                            )}
                            {isCompleted && (
                              <span className="text-[11px] font-bold text-emerald-700">✓ Xong</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Ultra-Simple Mobile Cards */}
            <div className="space-y-3 block md:hidden">
              {filteredRequests.length === 0 ? (
                <div className="py-6 text-center text-stone-400 text-xs">
                  Không có yêu cầu nào phù hợp.
                </div>
              ) : (
                filteredRequests.slice(0, 5).map((r) => {
                  const isPending =
                    (r.status || '').toLowerCase() === 'pending' ||
                    (r.status || '').toLowerCase() === 'unassigned';
                  const isInProgress =
                    (r.status || '').toLowerCase() === 'in progress' ||
                    (r.status || '').toLowerCase() === 'cooking';
                  const isCompleted =
                    (r.status || '').toLowerCase() === 'completed' ||
                    (r.status || '').toLowerCase() === 'ready';

                  return (
                    <div
                      key={r.id}
                      className="p-3.5 rounded-2xl bg-white border border-[#E5E1D8] space-y-2 shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-bold text-stone-900">{r.id}</span>
                          <span className="px-2 py-0.5 rounded-full bg-[#18181B] text-white text-[10px] font-bold">
                            {r.location}
                          </span>
                        </div>

                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            isPending
                              ? 'bg-amber-100 text-amber-800'
                              : isInProgress
                              ? 'bg-sky-100 text-sky-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {r.status || 'Pending'}
                        </span>
                      </div>

                      <h4 className="text-xs font-bold text-stone-900 leading-snug">{r.title}</h4>

                      <div className="pt-2 border-t border-[#F5F2EB] flex items-center justify-end gap-2">
                        {isPending && (
                          <button
                            onClick={() => handleUpdateStatus(r.id, 'In Progress')}
                            className="px-3.5 py-1 rounded-full bg-black text-white text-xs font-bold cursor-pointer active:scale-95"
                          >
                            Nhận Việc
                          </button>
                        )}
                        {isInProgress && (
                          <button
                            onClick={() => handleUpdateStatus(r.id, 'Completed')}
                            className="px-3.5 py-1 rounded-full bg-emerald-600 text-white text-xs font-bold cursor-pointer active:scale-95"
                          >
                            Hoàn Thành
                          </button>
                        )}
                        {isCompleted && (
                          <span className="text-xs font-bold text-emerald-700">✓ Đã Xong</span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 2: THỐNG KÊ & NHẬT KÝ CUỘC GỌI (SUPPORT & VOICE CALLS) */}
        {/* ========================================================================= */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-[#211F1D] flex items-center gap-2">
              <PhoneCall className="w-4 h-4 text-stone-700" />
              <span>2. Thống Kê & Nhật Ký Cuộc Gọi Hỗ Trợ (Voice & Video Calls)</span>
            </h3>
            <span className="text-xs text-[#78716C] font-semibold">
              Live Stream & Voice AI Logs
            </span>
          </div>

          {/* Call Stats Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-white border border-[#E8E5E0] shadow-sm space-y-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#78716C]">
                Tổng Cuộc Gọi Hôm Nay
              </span>
              <div className="flex items-baseline justify-between pt-1">
                <span className="text-xl font-bold text-[#1A1917]">18 cuộc gọi</span>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                  +12% so với hôm qua
                </span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-[#E8E5E0] shadow-sm space-y-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#78716C]">
                Thời Gian Đàm Thoại TB
              </span>
              <div className="flex items-baseline justify-between pt-1">
                <span className="text-xl font-bold text-[#1A1917]">2 phút 10 giây</span>
                <span className="text-[10px] font-bold text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full">
                  Tối ưu
                </span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-[#E8E5E0] shadow-sm space-y-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#78716C]">
                Tỷ Lệ Kết Nối Thành Công
              </span>
              <div className="flex items-baseline justify-between pt-1">
                <span className="text-xl font-bold text-emerald-800">98.5%</span>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                  Hoạt động tốt
                </span>
              </div>
            </div>
          </div>

          {/* Calls Log Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {supportCalls.map((call) => (
              <div
                key={call.id}
                className="p-5 rounded-2xl bg-white border border-[#E8E5E0] shadow-sm space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-stone-900">{call.id}</span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        call.status === 'Connected'
                          ? 'bg-emerald-100 text-emerald-800 animate-pulse'
                          : 'bg-stone-100 text-stone-700'
                      }`}
                    >
                      ● {call.status === 'Connected' ? 'Đang Kết Nối' : 'Đã Kết Thúc'}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-stone-900">{call.room}</h4>
                    <p className="text-xs font-medium text-stone-600">{call.guestName}</p>
                  </div>

                  <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[#EAE6DE] text-xs text-stone-700 leading-relaxed italic">
                    "{call.transcript}"
                  </div>
                </div>

                <div className="pt-2 border-t border-[#F0ECE6] flex items-center justify-between text-[11px] text-[#78716C]">
                  <span>{call.time}</span>
                  <span className="font-semibold text-stone-800">{call.duration}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 3: TÌNH TRẠNG CHUNG CỦA ROBOT (ROBOT FLEET GENERAL STATUS) */}
        {/* ========================================================================= */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-[#211F1D] flex items-center gap-2">
              <Bot className="w-4 h-4 text-sky-700" />
              <span>3. Tình Trạng Chung Của Đội Xe HCRobot (Robot Fleet Status)</span>
            </h3>
            <span className="text-xs text-[#78716C] font-semibold">
              SLAM LiDAR & Fleet Manager
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {robotFleet.map((unit) => {
              const battery = unit.battery_level ?? unit.battery ?? 90;
              const isHigh = battery > 50;
              const isMed = battery > 20 && battery <= 50;

              return (
                <div
                  key={unit.id || unit.unit_code}
                  className="p-5 rounded-2xl bg-white border border-[#E8E5E0] shadow-sm space-y-4"
                >
                  <div className="flex items-center justify-between pb-3 border-b border-[#F0ECE6]">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                      <h4 className="text-sm font-bold text-stone-900">{unit.unit_code || unit.id}</h4>
                    </div>

                    <span className="px-2.5 py-0.5 rounded-full bg-stone-900 text-white font-mono text-[10px] font-bold">
                      {unit.ip || 'Online'}
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    {/* Battery Status */}
                    <div className="flex items-center justify-between">
                      <span className="text-stone-500 font-medium flex items-center gap-1">
                        <BatteryCharging className="w-3.5 h-3.5 text-stone-700" />
                        <span>Mức Pin Hiện Tại:</span>
                      </span>
                      <span
                        className={`font-mono font-bold px-2 py-0.5 rounded ${
                          isHigh
                            ? 'bg-emerald-100 text-emerald-800'
                            : isMed
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {battery}%
                      </span>
                    </div>

                    {/* Operational Status */}
                    <div className="flex items-center justify-between">
                      <span className="text-stone-500 font-medium">Trạng thái:</span>
                      <span className="font-bold text-stone-900">{unit.status || 'Standby / Ready'}</span>
                    </div>

                    {/* Current Location */}
                    <div className="flex items-center justify-between">
                      <span className="text-stone-500 font-medium flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-stone-700" />
                        <span>Vị trí hiện tại:</span>
                      </span>
                      <span className="font-semibold text-stone-800 truncate max-w-[160px]">
                        {unit.location || 'Sảnh Chính'}
                      </span>
                    </div>

                    {/* Sensor & Network */}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-stone-500 font-medium flex items-center gap-1">
                        <Wifi className="w-3.5 h-3.5 text-sky-600" />
                        <span>SLAM LiDAR:</span>
                      </span>
                      <span className="font-bold text-emerald-700">Đang Định Vị (Active)</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
};
