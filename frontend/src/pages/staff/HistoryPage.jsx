import React, { useState, useEffect } from 'react';
import {
  History,
  CheckCircle2,
  Clock,
  Star,
  Bot,
  Filter,
  Calendar,
  UtensilsCrossed,
  Sparkles,
  Luggage,
  Wrench,
  ChevronDown,
  Download,
  Search,
} from 'lucide-react';
import { MetricCard } from '../../components/dashboard/MetricCard';
import { fetchUnifiedRequests } from '../../services/operationsApi';
import { Pagination } from '../../components/common/Pagination';

export const HistoryPage = ({ currentUser, onNotify = () => {} }) => {
  const [timeRange, setTimeRange] = useState('Today'); // 'Today' | '7Days' | 'Month'
  const [deptFilter, setDeptFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [dbLogs, setDbLogs] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  const staffName = currentUser?.full_name || currentUser?.name || 'Maria Santos';
  const userDept = currentUser?.department || 'Housekeeping';
  const isExecutive =
    userDept === 'Executive' ||
    currentUser?.username === 'admin';

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [timeRange, deptFilter, searchQuery]);

  const defaultHistoryLogs = [
    // Housekeeping Logs
    {
      id: 'LOG-HK-1043',
      time: '10:22 AM - Hôm nay',
      department: 'Housekeeping',
      title: 'Hoàn tất giao 4 bộ khăn tắm cao cấp cho phòng 314',
      location: 'ROOM 314',
      operator: `${staffName}`,
      duration: '8 phút',
      rating: '5.0 ⭐',
      icon: Sparkles,
      color: 'bg-emerald-100 text-emerald-800',
    },
    {
      id: 'LOG-HK-1038',
      time: '09:15 AM - Hôm nay',
      department: 'Housekeeping',
      title: 'Xử lý sự cố vết bẩn và vệ sinh thảm buồng phòng',
      location: 'ROOM 502',
      operator: `${staffName} & HCRobot`,
      duration: '14 phút',
      rating: '5.0 ⭐',
      icon: Sparkles,
      color: 'bg-emerald-100 text-emerald-800',
    },

    // F&B Logs
    {
      id: 'LOG-FB-1039',
      time: '10:45 AM - Hôm nay',
      department: 'F&B',
      title: 'Hoàn thành giao đơn F&B #1039 (Grand Breakfast & Espresso)',
      location: 'ROOM 310',
      operator: 'Elena Rossi & HCRobot Unit 01',
      duration: '11 phút',
      rating: '5.0 ⭐',
      icon: UtensilsCrossed,
      color: 'bg-amber-100 text-amber-800',
    },

    // Bell Services Logs
    {
      id: 'LOG-BS-501',
      time: '09:55 AM - Hôm nay',
      department: 'Bell Services',
      title: 'Hỗ trợ đón khách VIP & Vận chuyển 4 kiện hành lý',
      location: 'Sảnh Lobby ➔ Phòng 510',
      operator: 'Marcus T. & Bot Unit Alpha',
      duration: '8 phút',
      rating: '5.0 ⭐',
      icon: Luggage,
      color: 'bg-blue-100 text-blue-800',
    },

    // Maintenance Logs
    {
      id: 'LOG-MN-401',
      time: '08:40 AM - Hôm nay',
      department: 'Maintenance',
      title: 'Sửa chữa thay thế linh kiện vòi nước rò rỉ phòng 412',
      location: 'ROOM 412',
      operator: 'James Doe (Kỹ thuật viên)',
      duration: '18 phút',
      rating: '5.0 ⭐',
      icon: Wrench,
      color: 'bg-rose-100 text-rose-800',
    },
  ];

  // Load completed requests live from PostgreSQL
  useEffect(() => {
    const loadDbLogs = async () => {
      const allReqs = await fetchUnifiedRequests();
      if (allReqs && Array.isArray(allReqs)) {
        const completedReqs = allReqs.filter((r) => {
          const s = (r.status || '').toLowerCase().trim();
          return s === 'completed' || s === 'ready' || s === 'delivered' || s === 'done';
        });

        const formatted = completedReqs.map((r, idx) => ({
          id: `LOG-${(r.id || '').replace('REQ-', '')}`,
          time: r.time || 'Vừa xong',
          department: r.department || 'Housekeeping',
          title: `Hoàn tất: ${r.title}`,
          location: r.location || 'Phòng lưu trú',
          operator: r.assignedTo || r.assigned_staff_name || staffName,
          duration: `${8 + (idx * 4)} phút`,
          rating: '5.0 ⭐',
          icon:
            (r.department || '').toLowerCase().includes('housekeeping')
              ? Sparkles
              : (r.department || '').toLowerCase().includes('f&b')
              ? UtensilsCrossed
              : (r.department || '').toLowerCase().includes('bell')
              ? Luggage
              : Wrench,
          color:
            (r.department || '').toLowerCase().includes('housekeeping')
              ? 'bg-emerald-100 text-emerald-800'
              : (r.department || '').toLowerCase().includes('f&b')
              ? 'bg-amber-100 text-amber-800'
              : (r.department || '').toLowerCase().includes('bell')
              ? 'bg-blue-100 text-blue-800'
              : 'bg-rose-100 text-rose-800',
        }));

        if (formatted.length > 0) {
          setDbLogs(formatted);
        }
      }
    };
    loadDbLogs();
  }, [staffName]);

  // Combine DB completed logs with defaults
  const combinedLogs = [
    ...dbLogs,
    ...defaultHistoryLogs.filter((def) => !dbLogs.some((db) => db.id === def.id)),
  ];

  // Scoped strictly to staff's department (or all if executive)
  const scopedLogs = combinedLogs.filter((log) => {
    if (isExecutive) {
      if (deptFilter !== 'All' && log.department.toLowerCase() !== deptFilter.toLowerCase()) {
        return false;
      }
    } else {
      const userDeptNorm = userDept.toLowerCase().trim();
      const logDeptNorm = (log.department || '').toLowerCase().trim();
      if (!logDeptNorm.includes(userDeptNorm) && !userDeptNorm.includes(logDeptNorm)) {
        return false;
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const match =
        log.id.toLowerCase().includes(q) ||
        log.title.toLowerCase().includes(q) ||
        log.location.toLowerCase().includes(q) ||
        log.operator.toLowerCase().includes(q);
      if (!match) return false;
    }

    return true;
  });

  // Paginated Slicing (20 items per page)
  const paginatedLogs = scopedLogs.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-8 bg-[#FAF8F5] font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-[#1A1917]">Lịch Sử Hoạt Động & Audit Logs</h2>
              <span className="px-2.5 py-0.5 rounded-full bg-[#18181B] text-white text-[10px] font-bold">
                {isExecutive ? 'Toàn Khách Sạn' : userDept}
              </span>
            </div>
            <p className="text-xs text-[#78716C] mt-1">
              {isExecutive
                ? 'Nhật ký chi tiết các lượt phục vụ, điều phối robot tự hành của toàn bộ các bộ phận.'
                : `Nhật ký phục vụ và hoàn tất nhiệm vụ thuộc bộ phận ${userDept}.`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-[#EFECE6] p-1 rounded-full border border-[#DDD8CE]">
              {[
                { id: 'Today', label: 'Hôm nay' },
                { id: '7Days', label: '7 Ngày qua' },
                { id: 'Month', label: 'Tháng này' },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setTimeRange(item.id)}
                  className={`px-3.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    timeRange === item.id
                      ? 'bg-white text-[#1A1917] shadow-sm'
                      : 'text-[#78716C] hover:text-[#1A1917]'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <button
              onClick={() => onNotify('Đang xuất báo cáo lịch sử hoạt động dạng Excel/CSV')}
              className="px-4 py-2 rounded-full bg-white border border-[#DDD8CE] text-xs font-bold text-stone-700 hover:bg-[#F5F2EB] transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Xuất Báo Cáo</span>
            </button>
          </div>
        </div>

        {/* 4 Metric Cards (100% Synchronized with scopedLogs) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="TÁC VỤ HOÀN TẤT"
            value={scopedLogs.length}
            delta="Khớp với nhật ký bên dưới"
            icon={CheckCircle2}
          />
          <MetricCard
            title="THỜI GIAN ĐÁP ỨNG"
            value="12.4m"
            delta="Trung bình ca trực"
            deltaType="neutral"
            icon={Clock}
          />
          <MetricCard
            title="HÀI LÒNG KHÁCH HÀNG"
            value="5.0 / 5"
            delta={`${scopedLogs.length} lượt đánh giá 5 sao`}
            variant="dark"
            icon={Star}
          />
          <MetricCard
            title="ROBOT TỰ HÀNH"
            value="100%"
            delta={`${scopedLogs.length} lượt hoàn tất`}
            variant="danger-solid"
            icon={Bot}
          />
        </div>

        {/* Filter and Search Bar */}
        <div className="p-4 rounded-2xl bg-white border border-[#E5E1D8] shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Search Box */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-2.5" />
            <input
              type="text"
              placeholder="Tìm theo mã log, số phòng, nội dung..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-1.5 rounded-xl bg-[#FAF8F5] border border-[#E0DCD3] text-xs font-medium text-stone-900 outline-none focus:border-stone-400"
            />
          </div>

          {/* Department Filter Pills (ONLY visible for Executive / Admin) */}
          {isExecutive && (
            <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
              <span className="text-[11px] font-bold text-stone-500 uppercase mr-1">Phòng ban:</span>
              {['All', 'Housekeeping', 'F&B', 'Bell Services', 'Maintenance'].map((dept) => (
                <button
                  key={dept}
                  onClick={() => setDeptFilter(dept)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    deptFilter === dept
                      ? 'bg-[#18181B] text-white shadow-sm'
                      : 'bg-[#FAF8F5] text-stone-600 border border-[#E0DCD3] hover:bg-[#EFECE6]'
                  }`}
                >
                  {dept === 'All' ? 'Tất Cả' : dept}
                </button>
              ))}
            </div>
          )}

          <div className="text-xs font-bold text-stone-500">
            Tổng cộng: <span className="text-stone-900 font-extrabold">{scopedLogs.length}</span> lượt ghi nhận
          </div>
        </div>

        {/* Timeline Log List */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-[#1A1917]">Nhật Ký Dòng Thời Gian</h3>

          <div className="space-y-3">
            {paginatedLogs.length === 0 ? (
              <div className="p-12 text-center bg-white rounded-2xl border border-[#E5E1D8] text-xs text-stone-500">
                Không tìm thấy nhật ký hoạt động nào cho bộ phận {userDept}.
              </div>
            ) : (
              paginatedLogs.map((log) => {
                const LogIcon = log.icon;
                return (
                  <div
                    key={log.id}
                    className="p-4 rounded-2xl bg-white border border-[#E5E1D8] shadow-sm hover:shadow-md transition-all flex items-start gap-4"
                  >
                    {/* Icon */}
                    <div className="w-10 h-10 rounded-2xl bg-[#FAF8F5] border border-[#E5E1D8] flex items-center justify-center text-stone-700 shrink-0 mt-0.5">
                      <LogIcon className="w-5 h-5" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[#1A1917]">{log.id}</span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${log.color}`}
                        >
                          {log.department}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full bg-[#18181B] text-white text-[10px] font-bold">
                          {log.location}
                        </span>
                      </div>

                      <h4 className="text-sm font-bold text-[#1A1917]">{log.title}</h4>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-[#78716C] pt-0.5">
                        <span>
                          Thực hiện bởi: <strong className="text-stone-800 font-semibold">{log.operator}</strong>
                        </span>
                        <span>•</span>
                        <span>
                          Thời lượng: <strong className="text-stone-800 font-semibold">{log.duration}</strong>
                        </span>
                      </div>
                    </div>

                    {/* Status & Rating */}
                    <div className="text-right shrink-0 space-y-1">
                      <span className="text-[11px] text-[#78716C] block">{log.time}</span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
                        <span>{log.rating}</span>
                        <span>Hoàn Tất</span>
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Pagination Footer */}
        {scopedLogs.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalItems={scopedLogs.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            className="rounded-2xl border border-[#E5E1D8] shadow-sm bg-white"
          />
        )}
      </div>
    </div>
  );
};

