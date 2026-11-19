import React, { useState, useEffect, useMemo } from 'react';
import {
  ClipboardList,
  Search,
  RefreshCw,
  Download,
  User,
  Bot,
  Star,
  CheckCircle2,
  Clock,
  XCircle,
  Eye,
  X,
  Building2,
  Phone,
  MessageSquare,
  Video,
  Utensils,
  Calendar,
  Filter,
} from 'lucide-react';
import { fetchAdminGuestServiceRecords } from '../../../services/operationsApi';
import { Pagination } from '../../../components/common/Pagination';
import { useLanguage } from '../../../context/LanguageContext';

const formatCurrencyVND = (amount) => {
  const num = Number(amount || 0);
  if (!num) return '0 đ';
  return `${num.toLocaleString('vi-VN')} đ`;
};

const formatDateTime = (isoStr) => {
  if (!isoStr) return '--';
  try {
    const d = new Date(isoStr);
    if (Number.isNaN(d.getTime())) return isoStr;
    return d.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoStr;
  }
};

const getStatusBadgeStyle = (statusGroup, statusLabel) => {
  if (statusGroup === 'completed') {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  }
  if (statusGroup === 'cancelled') {
    return 'bg-rose-50 text-rose-700 border-rose-200';
  }
  const low = (statusLabel || '').toLowerCase();
  if (low.includes('progress') || low.includes('cook') || low.includes('deliver') || low.includes('ready')) {
    return 'bg-sky-50 text-sky-700 border-sky-200';
  }
  return 'bg-amber-50 text-amber-700 border-amber-200';
};

const getRoomStatusBadgeStyle = (roomStatus) => {
  const s = (roomStatus || '').toUpperCase();
  if (s === 'OCCUPIED') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (s === 'CLEANING') return 'bg-amber-50 text-amber-700 border-amber-200';
  if (s === 'MAINTENANCE') return 'bg-rose-50 text-rose-700 border-rose-200';
  if (s === 'AVAILABLE') return 'bg-stone-100 text-stone-700 border-stone-200';
  return 'bg-stone-100 text-stone-500 border-stone-200';
};

const getGuestStayBadge = (guestType, stayStatus, isVI) => {
  if (guestType === 'walkin' || stayStatus === 'WALK_IN') {
    return {
      label: isVI ? 'Khách vãng lai' : 'Walk-in Guest',
      className: 'bg-sky-50 text-sky-700 border-sky-200',
    };
  }
  if (stayStatus === 'CURRENT_STAY') {
    return {
      label: isVI ? 'Đang lưu trú' : 'Current Stay',
      className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    };
  }
  return {
    label: isVI ? 'Khách cũ (Lịch sử)' : 'Past Stay',
    className: 'bg-stone-100 text-stone-600 border-stone-200',
  };
};

export const AdminGuestServiceRecordsTab = ({ currentUser, onNotify = () => {} }) => {
  const { language } = useLanguage();
  const isVI = language === 'VI';

  const [viewMode, setViewMode] = useState('ledger'); // 'ledger' | 'dossiers'
  const [isLoading, setIsLoading] = useState(true);

  // Data from backend
  const [metrics, setMetrics] = useState({
    total_records: 0,
    completed_records: 0,
    active_records: 0,
    cancelled_records: 0,
    completion_rate: 0,
    total_revenue: 0,
    robot_assisted_count: 0,
    robot_rate: 0,
    total_feedbacks: 0,
    avg_rating: null,
    total_rooms_served: 0,
  });
  const [records, setRecords] = useState([]);
  const [guestProfiles, setGuestProfiles] = useState([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sourceFilter, setSourceFilter] = useState('All');
  const [guestTypeFilter, setGuestTypeFilter] = useState('all'); // 'all' | 'registered' | 'walkin'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Pagination & Detail Modals
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [selectedDossier, setSelectedDossier] = useState(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await fetchAdminGuestServiceRecords({
        department: departmentFilter,
        status: statusFilter,
        source: sourceFilter,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      });
      if (data) {
        if (data.metrics) setMetrics(data.metrics);
        setRecords(Array.isArray(data.records) ? data.records : []);
        setGuestProfiles(Array.isArray(data.guest_profiles) ? data.guest_profiles : []);
      }
    } catch (err) {
      console.error('[AdminGuestServiceRecords] Failed to load:', err);
      onNotify(isVI ? 'Không thể tải hồ sơ dịch vụ khách hàng.' : 'Failed to load guest service records.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [departmentFilter, statusFilter, sourceFilter, startDate, endDate]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, departmentFilter, statusFilter, sourceFilter, guestTypeFilter, startDate, endDate, viewMode]);

  // Client-side instant search & guest type filter across fetched records & dossiers
  const filteredRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return records.filter((r) => {
      if (guestTypeFilter !== 'all' && r.guest_type && r.guest_type !== guestTypeFilter) {
        return false;
      }
      if (!q) return true;
      const text = [
        r.id,
        r.ticket_code,
        r.guest_name,
        r.room_number,
        r.location,
        r.department,
        r.title,
        r.description,
        r.notes,
        r.assigned_to,
        r.assigned_robot,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return text.includes(q);
    });
  }, [records, searchQuery, guestTypeFilter]);

  const filteredProfiles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return guestProfiles.filter((p) => {
      if (guestTypeFilter !== 'all' && p.guest_type !== guestTypeFilter) {
        return false;
      }
      if (!q) return true;
      const text = [
        p.room_key,
        p.room_number,
        p.guest_name,
        p.guest_phone,
        p.room_type,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (text.includes(q)) return true;
      return (p.services || []).some((s) =>
        `${s.ticket_code || ''} ${s.title || ''} ${s.department || ''}`.toLowerCase().includes(q)
      );
    });
  }, [guestProfiles, searchQuery, guestTypeFilter]);

  const paginatedRecords = useMemo(() => {
    const startIdx = (currentPage - 1) * pageSize;
    return filteredRecords.slice(startIdx, startIdx + pageSize);
  }, [filteredRecords, currentPage]);

  const hasActiveFilters = Boolean(
    searchQuery.trim() ||
      departmentFilter !== 'All' ||
      statusFilter !== 'All' ||
      sourceFilter !== 'All' ||
      guestTypeFilter !== 'all' ||
      startDate ||
      endDate
  );

  const handleResetFilters = () => {
    setSearchQuery('');
    setDepartmentFilter('All');
    setStatusFilter('All');
    setSourceFilter('All');
    setGuestTypeFilter('all');
    setStartDate('');
    setEndDate('');
  };

  const handleExportCsv = () => {
    if (!filteredRecords.length) {
      onNotify(isVI ? 'Không có bản ghi nào để xuất CSV.' : 'No records available to export.');
      return;
    }

    const headers = [
      'Ticket Code',
      'Created At',
      'Room / Location',
      'Guest Name',
      'Guest Phone',
      'Department',
      'Service Title',
      'Description',
      'Source',
      'Assigned Staff',
      'Assigned Robot',
      'Total Amount (VND)',
      'Status',
    ];

    const escapeCell = (val) => {
      const str = String(val ?? '').replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = filteredRecords.map((r) =>
      [
        r.ticket_code || r.id,
        formatDateTime(r.created_at),
        r.room_number || r.location || '',
        r.guest_name || '',
        r.guest_phone || '',
        r.department || '',
        r.title || '',
        r.notes || r.description || '',
        r.source || '',
        r.assigned_to || '',
        r.assigned_robot || '',
        r.total_amount || 0,
        r.status || '',
      ]
        .map(escapeCell)
        .join(',')
    );

    const csvContent = `\uFEFF${headers.map(escapeCell).join(',')}\n${rows.join('\n')}`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `guest_service_records_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    onNotify(
      isVI
        ? `Đã xuất ${filteredRecords.length} hồ sơ dịch vụ ra file CSV.`
        : `Exported ${filteredRecords.length} service records to CSV.`
    );
  };

  const deptOptions = [
    { id: 'All', label: isVI ? 'Tất cả bộ phận' : 'All Departments' },
    { id: 'Room Service', label: isVI ? 'Phục vụ phòng & F&B' : 'Room Service & F&B' },
    { id: 'Housekeeping', label: isVI ? 'Buồng phòng' : 'Housekeeping' },
    { id: 'Taxi', label: isVI ? 'Đặt xe & Taxi' : 'Taxi & Transport' },
    { id: 'Bell Services', label: isVI ? 'Hành lý (Bell)' : 'Bell Services' },
    { id: 'Maintenance', label: isVI ? 'Kỹ thuật & Bảo trì' : 'Maintenance' },
    { id: 'Reception', label: isVI ? 'Lễ tân' : 'Reception' },
    { id: 'Concierge', label: isVI ? 'Concierge & Live Call' : 'Concierge & Live Call' },
  ];

  const statusOptions = [
    { id: 'All', label: isVI ? 'Tất cả' : 'All' },
    { id: 'Completed', label: isVI ? 'Hoàn thành' : 'Completed' },
    { id: 'In Progress', label: isVI ? 'Đang xử lý' : 'In Progress' },
    { id: 'Pending', label: isVI ? 'Chờ tiếp nhận' : 'Pending' },
    { id: 'Cancelled', label: isVI ? 'Đã hủy' : 'Cancelled' },
  ];

  const sourceOptions = [
    { id: 'All', label: isVI ? 'Mọi nguồn' : 'All Sources' },
    { id: 'robot', label: 'HCRobot Kiosk' },
    { id: 'Front Desk', label: isVI ? 'Quầy lễ tân' : 'Front Desk' },
    { id: 'Guest App', label: 'Guest App' },
  ];

  return (
    <div className="w-full min-h-full flex flex-col pb-6" style={{ color: '#262626' }}>
      {/* Header Bar */}
      <div
        className="h-16 px-5 border-b flex items-center justify-between gap-4 shrink-0 sticky top-0 z-20"
        style={{ borderColor: '#BFBFBD', backgroundColor: '#F2EFE9' }}
      >
        <div className="min-w-0">
          <h2 className="text-sm sm:text-base font-bold tracking-tight leading-tight truncate" style={{ color: '#262626' }}>
            {isVI ? 'Hồ Sơ Dịch Vụ Khách Hàng' : 'Guest Service Records'}
          </h2>
          <p className="text-[10px] sm:text-[11px] font-normal truncate mt-0.5" style={{ color: '#8C8C8C' }}>
            {isVI
              ? 'Lưu trữ toàn diện lịch sử phục vụ, đơn hàng phòng, điều phối robot và mức độ hài lòng của khách.'
              : 'Unified service history, room orders, robot-assisted deliveries, and guest satisfaction records.'}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleExportCsv}
            className="px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-all hover:bg-[#E9E5DC]/80 flex items-center gap-1.5"
            style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
            title={isVI ? 'Xuất danh sách hiện tại ra CSV' : 'Export current list to CSV'}
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{isVI ? 'Xuất CSV' : 'Export CSV'}</span>
          </button>

          <button
            type="button"
            onClick={loadData}
            disabled={isLoading}
            className="px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-all hover:bg-[#262626]/90 flex items-center gap-1.5"
            style={{ backgroundColor: '#262626', color: '#F2EFE9', borderColor: '#262626' }}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{isVI ? 'Làm mới' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4 space-y-4">
        {/* 1. SUMMARY METRICS STRIP */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white rounded-2xl border border-[#E3DFD5] p-4 shadow-sm">
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[#8C857B]">
              <span>{isVI ? 'Tổng Hồ Sơ Dịch Vụ' : 'Total Service Records'}</span>
              <ClipboardList className="w-4 h-4 text-[#262626]" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-[#1A1917]">{metrics.total_records}</span>
              <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                {metrics.completion_rate}% {isVI ? 'hoàn tất' : 'completed'}
              </span>
            </div>
            <p className="text-[11px] text-[#8C857B] mt-1">
              {metrics.total_rooms_served} {isVI ? 'phòng / khu vực đã phục vụ' : 'rooms / locations served'}
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-[#E3DFD5] p-4 shadow-sm">
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[#8C857B]">
              <span>{isVI ? 'Tiến Độ Thực Hiện' : 'Fulfillment Breakdown'}</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="mt-2 flex items-center gap-3 text-xs font-bold">
              <span className="text-emerald-700">
                {metrics.completed_records} {isVI ? 'Xong' : 'Done'}
              </span>
              <span className="text-amber-700">
                {metrics.active_records} {isVI ? 'Đang xử lý' : 'Active'}
              </span>
              <span className="text-rose-700">
                {metrics.cancelled_records} {isVI ? 'Hủy' : 'Cancelled'}
              </span>
            </div>
            <p className="text-[11px] text-[#8C857B] mt-2">
              {metrics.robot_assisted_count} {isVI ? 'lượt có Robot tham gia' : 'robot-assisted'} ({metrics.robot_rate}%)
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-[#E3DFD5] p-4 shadow-sm">
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[#8C857B]">
              <span>{isVI ? 'Tổng Chi Tiêu Dịch Vụ' : 'Service Order Value'}</span>
              <Utensils className="w-4 h-4 text-amber-600" />
            </div>
            <div className="mt-2">
              <span className="text-2xl font-black text-[#1A1917]">{formatCurrencyVND(metrics.total_revenue)}</span>
            </div>
            <p className="text-[11px] text-[#8C857B] mt-1">
              {isVI ? 'Tổng hợp từ đơn F&B & dịch vụ phòng' : 'Aggregated from F&B & room services'}
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-[#E3DFD5] p-4 shadow-sm">
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[#8C857B]">
              <span>{isVI ? 'Mức Độ Hài Lòng' : 'Guest Satisfaction'}</span>
              <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-[#1A1917]">
                {metrics.avg_rating !== null && metrics.avg_rating !== undefined ? `${metrics.avg_rating} / 5` : '--'}
              </span>
            </div>
            <p className="text-[11px] text-[#8C857B] mt-1">
              {metrics.total_feedbacks} {isVI ? 'lượt đánh giá từ khách lưu trú' : 'guest feedback submissions'}
            </p>
          </div>
        </div>

        {/* 2. VIEW SWITCHER & FILTER BAR */}
        <div className="bg-white rounded-2xl border border-[#E3DFD5] p-4 shadow-sm space-y-3.5">
          {/* Top Row: View Mode Switcher + Search */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="inline-flex items-center p-1 rounded-xl bg-[#F5F2EB] border border-[#E3DFD5] self-start">
              <button
                type="button"
                onClick={() => setViewMode('ledger')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  viewMode === 'ledger'
                    ? 'bg-[#262626] text-white shadow-sm'
                    : 'text-[#8C857B] hover:text-[#262626]'
                }`}
              >
                <ClipboardList className="w-3.5 h-3.5" />
                <span>{isVI ? `Sổ Hồ Sơ (${filteredRecords.length})` : `Service Ledger (${filteredRecords.length})`}</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('dossiers')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  viewMode === 'dossiers'
                    ? 'bg-[#262626] text-white shadow-sm'
                    : 'text-[#8C857B] hover:text-[#262626]'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>{isVI ? `Theo Phòng & Khách (${filteredProfiles.length})` : `Guest Dossiers (${filteredProfiles.length})`}</span>
              </button>
            </div>

            <div className="relative w-full lg:w-96">
              <Search className="w-4 h-4 text-[#8C857B] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  isVI
                    ? 'Tìm tên khách, số phòng, mã phiếu, nội dung dịch vụ...'
                    : 'Search guest name, room, ticket code, service...'
                }
                className="w-full pl-9 pr-4 py-2 bg-[#F9F8F5] border border-[#E3DFD5] rounded-xl text-xs text-[#1A1917] placeholder-[#8C857B] focus:outline-none focus:border-[#262626]"
              />
            </div>
          </div>

          {/* Second Row: Filters */}
          <div className="flex flex-wrap items-center gap-2.5 pt-2.5 border-t border-[#EFECE6]">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#8C857B] uppercase mr-1">
              <Filter className="w-3.5 h-3.5" />
              <span>{isVI ? 'Bộ lọc:' : 'Filters:'}</span>
            </div>

            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              aria-label="Filter by department"
              className="px-3 py-1.5 rounded-xl bg-[#F9F8F5] border border-[#E3DFD5] text-xs font-semibold text-[#1A1917] outline-none focus:border-[#262626] cursor-pointer"
            >
              {deptOptions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>

            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              aria-label="Filter by source"
              className="px-3 py-1.5 rounded-xl bg-[#F9F8F5] border border-[#E3DFD5] text-xs font-semibold text-[#1A1917] outline-none focus:border-[#262626] cursor-pointer"
            >
              {sourceOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>

            <select
              value={guestTypeFilter}
              onChange={(e) => setGuestTypeFilter(e.target.value)}
              aria-label="Filter by guest type"
              className="px-3 py-1.5 rounded-xl bg-[#F9F8F5] border border-[#E3DFD5] text-xs font-semibold text-[#1A1917] outline-none focus:border-[#262626] cursor-pointer"
            >
              <option value="all">{isVI ? 'Tất cả loại khách' : 'All Guest Types'}</option>
              <option value="registered">{isVI ? 'Khách đăng ký phòng' : 'Room Guests'}</option>
              <option value="walkin">{isVI ? 'Khách vãng lai (Sảnh)' : 'Walk-in Guests'}</option>
            </select>

            <div className="flex items-center gap-1.5 bg-[#F9F8F5] border border-[#E3DFD5] rounded-xl px-2.5 py-1 text-xs">
              <Calendar className="w-3.5 h-3.5 text-[#8C857B]" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                aria-label="Start date"
                className="bg-transparent text-xs text-[#1A1917] outline-none cursor-pointer"
              />
              <span className="text-[#8C857B]">-</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                aria-label="End date"
                className="bg-transparent text-xs text-[#1A1917] outline-none cursor-pointer"
              />
            </div>

            <div className="flex items-center gap-1.5 ml-auto flex-wrap">
              {statusOptions.map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setStatusFilter(st.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                    statusFilter === st.id
                      ? 'bg-[#262626] text-white'
                      : 'bg-[#F5F2EB] text-[#8C857B] hover:text-[#262626]'
                  }`}
                >
                  {st.label}
                </button>
              ))}

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 cursor-pointer"
                >
                  {isVI ? 'Xóa lọc' : 'Clear'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 3. CONTENT BODY */}
        {isLoading ? (
          <div className="py-20 text-center bg-white rounded-2xl border border-[#E3DFD5] text-[#8C857B] flex flex-col items-center justify-center space-y-2">
            <RefreshCw className="w-7 h-7 animate-spin text-[#262626]" />
            <p className="text-xs font-semibold">
              {isVI ? 'Đang tổng hợp hồ sơ dịch vụ khách hàng...' : 'Loading guest service records...'}
            </p>
          </div>
        ) : viewMode === 'ledger' ? (
          /* VIEW A: SERVICE LEDGER */
          filteredRecords.length === 0 ? (
            <div className="py-16 text-center bg-white rounded-2xl border border-dashed border-[#BFBFBD] text-[#8C857B] space-y-2">
              <Building2 className="w-10 h-10 mx-auto text-[#BFBFBD]" />
              <p className="text-sm font-bold text-[#1A1917]">
                {isVI ? 'Không tìm thấy hồ sơ dịch vụ phù hợp' : 'No matching guest service records'}
              </p>
              <p className="text-xs">
                {isVI ? 'Hãy thử thay đổi bộ lọc hoặc khoảng thời gian.' : 'Try adjusting filters or date range.'}
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-[#E3DFD5] shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#F9F8F5] border-b border-[#E3DFD5] text-[10px] font-bold uppercase tracking-wider text-[#8C857B]">
                      <th className="py-3 px-4">{isVI ? 'Mã Phiếu / Thời Gian' : 'Ticket / Time'}</th>
                      <th className="py-3 px-4">{isVI ? 'Khách & Phòng' : 'Guest & Room'}</th>
                      <th className="py-3 px-4">{isVI ? 'Bộ Phận & Dịch Vụ' : 'Service & Details'}</th>
                      <th className="py-3 px-4">{isVI ? 'Phụ Trách & Nguồn' : 'Fulfillment & Source'}</th>
                      <th className="py-3 px-4 text-right">{isVI ? 'Giá Trị' : 'Amount'}</th>
                      <th className="py-3 px-4">{isVI ? 'Trạng Thái' : 'Status'}</th>
                      <th className="py-3 px-4 text-right">{isVI ? 'Chi Tiết' : 'Action'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EFECE6]">
                    {paginatedRecords.map((rec) => (
                      <tr
                        key={rec.id}
                        onClick={() => setSelectedRecord(rec)}
                        className="hover:bg-[#F9F8F5] transition-colors cursor-pointer"
                      >
                        <td className="py-3 px-4 align-top whitespace-nowrap">
                          <div className="font-mono font-extrabold text-[#1A1917]">
                            {rec.ticket_code || rec.id}
                          </div>
                          <div className="text-[11px] text-[#8C857B] mt-0.5 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{formatDateTime(rec.created_at)}</span>
                          </div>
                        </td>

                        <td className="py-3 px-4 align-top">
                          <div className="font-bold text-[#1A1917]">{rec.guest_name || 'Hotel Guest'}</div>
                          <div className="text-[11px] text-[#8C857B] font-medium mt-0.5">
                            {rec.location || rec.room_number || 'Main Lobby'}
                          </div>
                        </td>

                        <td className="py-3 px-4 align-top max-w-xs">
                          <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#F5F2EB] text-[#262626] border border-[#E3DFD5] mb-1">
                            {rec.department}
                          </span>
                          <div className="font-bold text-[#1A1917] line-clamp-1">{rec.title}</div>
                          {(rec.notes || rec.description) && (
                            <div className="text-[11px] text-[#8C857B] line-clamp-1 mt-0.5">
                              {rec.notes || rec.description}
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-4 align-top whitespace-nowrap">
                          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#1A1917]">
                            {rec.assigned_robot ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-stone-100 border border-stone-200">
                                <Bot className="w-3 h-3 text-[#262626]" />
                                {rec.assigned_robot}
                              </span>
                            ) : rec.assigned_to ? (
                              <span className="inline-flex items-center gap-1">
                                <User className="w-3 h-3 text-[#8C857B]" />
                                {rec.assigned_to}
                              </span>
                            ) : (
                              <span className="text-[#8C857B] italic">
                                {isVI ? 'Chưa phân công' : 'Unassigned'}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-[#8C857B] mt-1">{rec.source || 'From HCRobot'}</div>
                        </td>

                        <td className="py-3 px-4 align-top text-right whitespace-nowrap font-bold text-[#1A1917]">
                          {Number(rec.total_amount) > 0 ? formatCurrencyVND(rec.total_amount) : '--'}
                        </td>

                        <td className="py-3 px-4 align-top whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${getStatusBadgeStyle(
                              rec.status_group,
                              rec.status
                            )}`}
                          >
                            {rec.status}
                          </span>
                        </td>

                        <td className="py-3 px-4 align-top text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedRecord(rec);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#F5F2EB] hover:bg-[#E9E5DC] text-[#262626] font-semibold text-[11px] border border-[#E3DFD5] cursor-pointer"
                          >
                            <Eye className="w-3 h-3" />
                            <span>{isVI ? 'Xem' : 'View'}</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {filteredRecords.length > pageSize && (
                <div className="p-3 border-t border-[#EFECE6] bg-[#F9F8F5]">
                  <Pagination
                    currentPage={currentPage}
                    totalItems={filteredRecords.length}
                    pageSize={pageSize}
                    onPageChange={setCurrentPage}
                  />
                </div>
              )}
            </div>
          )
        ) : (
          /* VIEW B: GUEST & ROOM DOSSIERS */
          filteredProfiles.length === 0 ? (
            <div className="py-16 text-center bg-white rounded-2xl border border-dashed border-[#BFBFBD] text-[#8C857B] space-y-2">
              <User className="w-10 h-10 mx-auto text-[#BFBFBD]" />
              <p className="text-sm font-bold text-[#1A1917]">
                {isVI ? 'Chưa có hồ sơ theo phòng / khách hàng' : 'No guest or room dossiers found'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
              {filteredProfiles.map((prof) => {
                const stayBadge = getGuestStayBadge(prof.guest_type, prof.stay_status, isVI);
                return (
                <article
                  key={prof.dossier_key || prof.room_key}
                  onClick={() => setSelectedDossier(prof)}
                  className="bg-white rounded-2xl border border-[#E3DFD5] hover:border-[#262626]/40 hover:shadow-md transition-all p-4 flex flex-col justify-between gap-3 cursor-pointer"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-lg bg-[#262626] text-white text-xs font-extrabold">
                            {prof.room_number}
                          </span>
                          <span className="text-[11px] font-medium text-[#8C857B]">{prof.room_type}</span>
                        </div>
                        <h3 className="text-base font-bold text-[#1A1917] mt-1.5">{prof.guest_name}</h3>
                        {prof.guest_phone && (
                          <p className="text-[11px] text-[#8C857B] flex items-center gap-1 mt-0.5">
                            <Phone className="w-3 h-3" />
                            <span>{prof.guest_phone}</span>
                          </p>
                        )}
                      </div>

                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border shrink-0 ${stayBadge.className}`}
                      >
                        {stayBadge.label}
                      </span>
                    </div>

                    {/* Quick Counters */}
                    <div className="grid grid-cols-3 gap-2 bg-[#F9F8F5] rounded-xl p-2.5 border border-[#EFECE6] text-center">
                      <div>
                        <div className="text-[10px] font-semibold text-[#8C857B] uppercase">
                          {isVI ? 'Dịch vụ' : 'Services'}
                        </div>
                        <div className="text-sm font-black text-[#1A1917]">
                          {prof.completed_services}/{prof.total_services}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-semibold text-[#8C857B] uppercase">
                          {isVI ? 'Chi tiêu' : 'Spend'}
                        </div>
                        <div className="text-sm font-black text-[#1A1917]">
                          {prof.total_spend > 0 ? formatCurrencyVND(prof.total_spend) : '--'}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-semibold text-[#8C857B] uppercase">
                          {isVI ? 'Đánh giá' : 'Rating'}
                        </div>
                        <div className="text-sm font-black text-[#1A1917] flex items-center justify-center gap-0.5">
                          {prof.avg_rating ? (
                            <>
                              <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                              <span>{prof.avg_rating}</span>
                            </>
                          ) : (
                            '--'
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Recent 2 Services Preview */}
                    <div className="space-y-1.5">
                      {(prof.services || []).slice(0, 2).map((s) => (
                        <div
                          key={s.id}
                          className="flex items-center justify-between gap-2 text-[11px] py-1 border-b border-[#EFECE6] last:border-b-0"
                        >
                          <div className="min-w-0 flex-1 truncate">
                            <span className="font-semibold text-[#1A1917]">{s.title}</span>
                            <span className="text-[#8C857B] ml-1.5">({s.department})</span>
                          </div>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${getStatusBadgeStyle(
                              s.status_group,
                              s.status
                            )}`}
                          >
                            {s.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Footer Meta */}
                  <div className="flex items-center justify-between pt-2 border-t border-[#EFECE6] text-[11px] text-[#8C857B]">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" />
                        {prof.chat_session_count} {isVI ? 'chat' : 'chats'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Video className="w-3 h-3" />
                        {prof.video_call_count} {isVI ? 'call' : 'calls'}
                      </span>
                    </div>
                    <span className="font-bold text-[#262626] hover:underline">
                      {isVI ? 'Mở hồ sơ chi tiết' : 'Open Dossier'}
                    </span>
                  </div>
                </article>
                );
              })}
            </div>
          )
        )}
      </div>

      {/* MODAL 1: SERVICE RECORD DETAIL (z-[60] để luôn nổi lên trên khi mở từ Modal Hồ sơ khách) */}
      {selectedRecord && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedRecord(null);
          }}
          className="fixed inset-0 z-[60] bg-[#141413]/65 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div className="bg-white border border-[#E3DFD5] rounded-3xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-[#EFECE6] bg-[#F9F8F5] flex items-center justify-between">
              <div>
                <span className="font-mono text-xs font-extrabold text-[#262626] bg-[#E9E5DC] px-2.5 py-0.5 rounded-md">
                  {selectedRecord.ticket_code || selectedRecord.id}
                </span>
                <h3 className="text-base font-bold text-[#1A1917] mt-1">{selectedRecord.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="p-1.5 rounded-full hover:bg-[#E9E5DC] text-[#8C857B] hover:text-[#1A1917] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`px-3 py-1 rounded-full font-bold border ${getStatusBadgeStyle(
                    selectedRecord.status_group,
                    selectedRecord.status
                  )}`}
                >
                  {selectedRecord.status}
                </span>
                <span className="px-3 py-1 rounded-full font-bold bg-[#F5F2EB] text-[#262626] border border-[#E3DFD5]">
                  {selectedRecord.department}
                </span>
                <span className="px-3 py-1 rounded-full font-medium bg-stone-100 text-stone-700">
                  {selectedRecord.source || 'From HCRobot'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-[#F9F8F5] p-4 rounded-2xl border border-[#EFECE6]">
                <div>
                  <span className="text-[10px] font-bold uppercase text-[#8C857B]">
                    {isVI ? 'Khách hàng' : 'Guest Name'}
                  </span>
                  <p className="font-bold text-[#1A1917] mt-0.5">{selectedRecord.guest_name}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-[#8C857B]">
                    {isVI ? 'Phòng / Vị trí' : 'Room / Location'}
                  </span>
                  <p className="font-bold text-[#1A1917] mt-0.5">
                    {selectedRecord.location || selectedRecord.room_number || 'Main Lobby'}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-[#8C857B]">
                    {isVI ? 'Nhân sự phụ trách' : 'Assigned Staff'}
                  </span>
                  <p className="font-semibold text-[#1A1917] mt-0.5">
                    {selectedRecord.assigned_to || (isVI ? 'Chưa phân công' : 'Unassigned')}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-[#8C857B]">
                    {isVI ? 'Robot thực hiện' : 'Assigned Robot'}
                  </span>
                  <p className="font-semibold text-[#1A1917] mt-0.5">
                    {selectedRecord.assigned_robot || '--'}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-[#8C857B]">
                    {isVI ? 'Thời gian tạo' : 'Created At'}
                  </span>
                  <p className="font-semibold text-[#1A1917] mt-0.5">
                    {formatDateTime(selectedRecord.created_at)}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-[#8C857B]">
                    {isVI ? 'Liên hệ khách' : 'Guest Phone'}
                  </span>
                  <p className="font-semibold text-[#1A1917] mt-0.5">
                    {selectedRecord.guest_phone || selectedRecord.room_phone || '--'}
                  </p>
                </div>
              </div>

              {(selectedRecord.notes || selectedRecord.description) && (
                <div>
                  <h4 className="text-[11px] font-bold uppercase text-[#8C857B] mb-1">
                    {isVI ? 'Mô tả & Ghi chú' : 'Notes & Description'}
                  </h4>
                  <div className="p-3.5 rounded-2xl bg-[#F9F8F5] border border-[#EFECE6] text-[#1A1917] leading-relaxed">
                    {selectedRecord.notes || selectedRecord.description}
                  </div>
                </div>
              )}

              {Array.isArray(selectedRecord.items) && selectedRecord.items.length > 0 && (
                <div>
                  <h4 className="text-[11px] font-bold uppercase text-[#8C857B] mb-1.5">
                    {isVI ? 'Chi tiết hạng mục / Món ăn' : 'Order Items Breakdown'}
                  </h4>
                  <div className="border border-[#E3DFD5] rounded-2xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#F9F8F5] border-b border-[#E3DFD5] text-[10px] uppercase text-[#8C857B]">
                        <tr>
                          <th className="py-2 px-3">{isVI ? 'Hạng mục' : 'Item'}</th>
                          <th className="py-2 px-3 text-center">{isVI ? 'SL' : 'Qty'}</th>
                          <th className="py-2 px-3 text-right">{isVI ? 'Thành tiền' : 'Subtotal'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#EFECE6]">
                        {selectedRecord.items.map((item, idx) => (
                          <tr key={idx}>
                            <td className="py-2 px-3 font-semibold text-[#1A1917]">
                              {item.name || item.item_name || 'Item'}
                            </td>
                            <td className="py-2 px-3 text-center">{item.qty || item.quantity || 1}</td>
                            <td className="py-2 px-3 text-right font-semibold">
                              {formatCurrencyVND(
                                item.subtotal ||
                                  (Number(item.unit_price || item.price || 0) * Number(item.qty || item.quantity || 1))
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="px-3 py-2.5 bg-[#F9F8F5] border-t border-[#E3DFD5] flex items-center justify-between font-bold text-[#1A1917]">
                      <span>{isVI ? 'Tổng cộng' : 'Total Amount'}</span>
                      <span>{formatCurrencyVND(selectedRecord.total_amount)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-3.5 border-t border-[#EFECE6] bg-[#F9F8F5] flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="px-5 py-2 rounded-full bg-[#262626] hover:bg-stone-800 text-white text-xs font-bold cursor-pointer"
              >
                {isVI ? 'Đóng' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: GUEST & ROOM DOSSIER */}
      {selectedDossier && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedDossier(null);
          }}
          className="fixed inset-0 z-50 bg-[#141413]/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div className="bg-white border border-[#E3DFD5] rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-[#EFECE6] bg-[#F9F8F5] flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-lg bg-[#262626] text-white text-xs font-extrabold">
                    {selectedDossier.room_number}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                      getGuestStayBadge(selectedDossier.guest_type, selectedDossier.stay_status, isVI).className
                    }`}
                  >
                    {getGuestStayBadge(selectedDossier.guest_type, selectedDossier.stay_status, isVI).label}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-[#1A1917] mt-1">{selectedDossier.guest_name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDossier(null)}
                className="p-1.5 rounded-full hover:bg-[#E9E5DC] text-[#8C857B] hover:text-[#1A1917] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              {/* Guest Dossier Summary Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#F9F8F5] p-3.5 rounded-2xl border border-[#EFECE6]">
                <div>
                  <span className="text-[10px] font-bold uppercase text-[#8C857B]">{isVI ? 'Tổng dịch vụ' : 'Total Services'}</span>
                  <p className="text-base font-black text-[#1A1917] mt-0.5">{selectedDossier.total_services}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-[#8C857B]">{isVI ? 'Chi tiêu' : 'Total Spend'}</span>
                  <p className="text-base font-black text-[#1A1917] mt-0.5">{formatCurrencyVND(selectedDossier.total_spend)}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-[#8C857B]">{isVI ? 'Chat AI / Video' : 'AI & Calls'}</span>
                  <p className="text-base font-black text-[#1A1917] mt-0.5">
                    {selectedDossier.chat_session_count} / {selectedDossier.video_call_count}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-[#8C857B]">{isVI ? 'Đánh giá TB' : 'Avg Rating'}</span>
                  <p className="text-base font-black text-[#1A1917] mt-0.5 flex items-center gap-1">
                    {selectedDossier.avg_rating ? (
                      <>
                        <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                        <span>{selectedDossier.avg_rating}</span>
                      </>
                    ) : (
                      '--'
                    )}
                  </p>
                </div>
              </div>

              {/* Service History Timeline */}
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#8C857B] mb-2">
                  {isVI ? 'Lịch Sử Dịch Vụ Đã Phục Vụ' : 'Service History Timeline'}
                </h4>
                <div className="space-y-2">
                  {(selectedDossier.services || []).map((srv) => (
                    <div
                      key={srv.id}
                      onClick={() => setSelectedRecord(srv)}
                      className="p-3 rounded-2xl border border-[#E3DFD5] hover:border-[#262626]/40 bg-white flex items-center justify-between gap-3 cursor-pointer transition-all"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] font-bold text-[#262626]">
                            {srv.ticket_code || srv.id}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#F5F2EB] text-[#262626]">
                            {srv.department}
                          </span>
                          <span className="text-[10px] text-[#8C857B]">{formatDateTime(srv.created_at)}</span>
                        </div>
                        <p className="font-bold text-[#1A1917] mt-1 truncate">{srv.title}</p>
                        {(srv.notes || srv.description) && (
                          <p className="text-[11px] text-[#8C857B] truncate">{srv.notes || srv.description}</p>
                        )}
                      </div>

                      <div className="text-right shrink-0 space-y-1">
                        <span
                          className={`inline-block text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${getStatusBadgeStyle(
                            srv.status_group,
                            srv.status
                          )}`}
                        >
                          {srv.status}
                        </span>
                        {Number(srv.total_amount) > 0 && (
                          <div className="text-xs font-extrabold text-[#1A1917]">
                            {formatCurrencyVND(srv.total_amount)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Guest Feedbacks */}
              {Array.isArray(selectedDossier.feedbacks) && selectedDossier.feedbacks.length > 0 && (
                <div>
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#8C857B] mb-2">
                    {isVI ? 'Đánh Giá & Phản Hồi Từ Khách' : 'Guest Feedbacks'}
                  </h4>
                  <div className="space-y-2">
                    {selectedDossier.feedbacks.map((fb) => (
                      <div key={fb.id} className="p-3 rounded-2xl bg-[#F9F8F5] border border-[#EFECE6] space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1 font-bold text-amber-600">
                            <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                            <span>{fb.rating} / 5</span>
                            <span className="text-[10px] font-semibold text-[#8C857B] ml-1.5">• {fb.category}</span>
                          </div>
                          <span className="text-[10px] text-[#8C857B]">{formatDateTime(fb.created_at)}</span>
                        </div>
                        {fb.comment && <p className="text-[#1A1917] italic">"{fb.comment}"</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-3.5 border-t border-[#EFECE6] bg-[#F9F8F5] flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedDossier(null)}
                className="px-5 py-2 rounded-full bg-[#262626] hover:bg-stone-800 text-white text-xs font-bold cursor-pointer"
              >
                {isVI ? 'Đóng' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

