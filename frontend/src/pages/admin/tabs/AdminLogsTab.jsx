import React, { useState, useEffect, useMemo } from 'react';
import {
  Activity,
  AlertTriangle,
  AlertOctagon,
  ShieldAlert,
  MessageSquare,
  Cpu,
  Radio,
  Search,
  Filter,
  Download,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  ChevronDown,
  Layers,
  Building2,
  BedDouble,
  Utensils,
  Luggage,
  Wrench,
  ShieldCheck,
  Server,
  ArrowRight,
  ExternalLink,
  Copy,
  Check,
  X,
  Code2,
  Clock,
  User,
  Bot,
  Compass,
  FileSpreadsheet,
  FileText,
  FileCheck,
  RefreshCw,
  Zap,
} from 'lucide-react';
import { Pagination } from '../../../components/common/Pagination';

const API_BASE_URL = 'http://localhost:8000/api/v1';

export const AdminLogsTab = ({ currentUser = {} }) => {
  // State
  const [logs, setLogs] = useState([]);
  const [statistics, setStatistics] = useState({
    total: 0,
    errors: 0,
    critical: 0,
    warnings: 0,
    ai_requests: 0,
    robot_events: 0,
    dispatch_events: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isLiveStreaming, setIsLiveStreaming] = useState(true);
  const [toastMessage, setToastMessage] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // Filters
  const [selectedLevel, setSelectedLevel] = useState('ALL');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedDepartment, setSelectedDepartment] = useState('ALL');
  const [selectedActor, setSelectedActor] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTimeRange, setSelectedTimeRange] = useState('ALL');

  // Inspection Drawer & Trace Modal
  const [selectedLog, setSelectedLog] = useState(null);
  const [traceData, setTraceData] = useState(null);
  const [isTraceModalOpen, setIsTraceModalOpen] = useState(false);
  const [isLoadingTrace, setIsLoadingTrace] = useState(false);
  const [copiedField, setCopiedField] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const copyToClipboard = (text, fieldName) => {
    navigator.clipboard.writeText(typeof text === 'object' ? JSON.stringify(text, null, 2) : text);
    setCopiedField(fieldName);
    showToast(`Đã sao chép ${fieldName} vào bộ nhớ tạm!`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Fetch Logs from Backend
  const fetchLogs = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/logs?limit=100`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.items || []);
      }
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    }
  };

  // Fetch Statistics
  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/logs/statistics`);
      if (res.ok) {
        const data = await res.json();
        setStatistics(data.data || {});
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  // Initial Load & Polling for Live Stream
  useEffect(() => {
    const loadAll = async () => {
      setIsLoading(true);
      await Promise.all([fetchLogs(), fetchStats()]);
      setIsLoading(false);
    };
    loadAll();

    // Polling interval if Live Streaming is active
    let interval = null;
    if (isLiveStreaming) {
      interval = setInterval(() => {
        fetchLogs();
        fetchStats();
      }, 5000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isLiveStreaming]);

  // Open Lifecycle Trace
  const handleOpenTrace = async (correlationId) => {
    if (!correlationId) return;
    setIsLoadingTrace(true);
    setIsTraceModalOpen(true);
    try {
      const res = await fetch(`${API_BASE_URL}/logs/trace/${correlationId}`);
      if (res.ok) {
        const data = await res.json();
        setTraceData(data);
      } else {
        showToast(`Không tìm thấy dữ liệu trace cho: ${correlationId}`);
        setIsTraceModalOpen(false);
      }
    } catch (err) {
      console.error('Error fetching trace:', err);
      showToast('Lỗi khi tải dữ liệu trace lifecycle.');
      setIsTraceModalOpen(false);
    } finally {
      setIsLoadingTrace(false);
    }
  };

  // Export logs
  const handleExportLogs = (format = 'csv') => {
    const url = `${API_BASE_URL}/logs/export?format=${format}&level=${selectedLevel}&category=${selectedCategory}&search=${encodeURIComponent(
      searchQuery
    )}`;
    window.open(url, '_blank');
    showToast(`Đang tải xuống tệp Log định dạng ${format.toUpperCase()}...`);
  };

  // 5 Hotel Departments
  const departments = [
    { id: 'ALL', label: 'Tất cả 5 bộ phận' },
    { id: 'reception', label: 'Lễ tân' },
    { id: 'housekeeping', label: 'Buồng phòng' },
    { id: 'room_service', label: 'Phục vụ phòng (F&B)' },
    { id: 'bell_service', label: 'Hành lý (Bellman)' },
    { id: 'maintenance', label: 'Kỹ thuật' },
  ];

  // Filtered Logs
  const filteredLogs = useMemo(() => {
    return logs.filter((item) => {
      // Level
      if (selectedLevel !== 'ALL' && item.level !== selectedLevel) return false;
      // Category
      if (selectedCategory !== 'ALL' && item.category !== selectedCategory) return false;
      // Actor
      if (selectedActor !== 'ALL' && item.actor_type !== selectedActor) return false;
      // Department
      if (selectedDepartment !== 'ALL') {
        const mod = (item.module || '').toLowerCase();
        const msg = (item.message || '').toLowerCase();
        const deptKey = selectedDepartment.toLowerCase();
        if (!mod.includes(deptKey) && !msg.includes(deptKey)) return false;
      }
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesMsg = (item.message || '').toLowerCase().includes(q);
        const matchesType = (item.event_type || '').toLowerCase().includes(q);
        const matchesMod = (item.module || '').toLowerCase().includes(q);
        const matchesCorr = (item.correlation_id || '').toLowerCase().includes(q);
        const matchesActor = (item.actor_id || '').toLowerCase().includes(q);
        if (!matchesMsg && !matchesType && !matchesMod && !matchesCorr && !matchesActor) return false;
      }
      return true;
    });
  }, [logs, selectedLevel, selectedCategory, selectedDepartment, selectedActor, searchQuery]);

  // Reset to page 1 on filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedLevel, selectedCategory, selectedDepartment, selectedActor, searchQuery]);

  // Paginated Slice (20 items per page)
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, currentPage, pageSize]);

  // Level Badge Helper
  const renderLevelBadge = (level) => {
    switch (level) {
      case 'CRITICAL':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white animate-pulse">
            CRITICAL
          </span>
        );
      case 'ERROR':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-700 border border-rose-200">
            ERROR
          </span>
        );
      case 'WARNING':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-200">
            WARN
          </span>
        );
      case 'DEBUG':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-stone-100 text-stone-600 border border-stone-200">
            DEBUG
          </span>
        );
      case 'INFO':
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200">
            INFO
          </span>
        );
    }
  };

  // Category Icon & Label Helper
  const renderCategoryTag = (category) => {
    switch (category) {
      case 'AI_VOICE':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-violet-700 bg-violet-50 px-2 py-0.5 rounded-lg">
            <MessageSquare className="w-3 h-3 text-violet-600" />
            <span>AI Voice</span>
          </span>
        );
      case 'ROBOT':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg">
            <Bot className="w-3 h-3 text-indigo-600" />
            <span>Robot LiDAR</span>
          </span>
        );
      case 'DISPATCH':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg">
            <Building2 className="w-3 h-3 text-emerald-600" />
            <span>Dispatch</span>
          </span>
        );
      case 'AUDIT':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-lg">
            <ShieldCheck className="w-3 h-3 text-amber-600" />
            <span>Audit</span>
          </span>
        );
      case 'SYSTEM':
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-lg">
            <Server className="w-3 h-3 text-slate-600" />
            <span>System</span>
          </span>
        );
    }
  };

  return (
    <div className="w-full min-h-full flex flex-col p-6 space-y-6 pb-16 font-sans select-none">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-stone-900 text-white px-5 py-3 rounded-2xl shadow-2xl border border-stone-700 flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-200">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-bold">{toastMessage}</span>
        </div>
      )}

      {/* 1. Header Section with Live Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-stone-200 pb-4">
        <div>
          <h2 className="text-2xl font-black text-stone-900 tracking-tight flex items-center gap-2">
            <span>System Logs & Audit Trail</span>
          </h2>
          <p className="text-sm text-stone-500 font-medium mt-0.5">
            Real-time event tracking, AI voice interactions, robot telemetry, and end-to-end lifecycle trace for HC-Robot (Unit RC-001).
          </p>
        </div>

        {/* Live Stream Controls & Export */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Live Status Badge */}
          <div
            onClick={() => setIsLiveStreaming(!isLiveStreaming)}
            className={`px-3 py-1.5 rounded-xl text-xs font-black tracking-wider flex items-center gap-2 border cursor-pointer transition-all ${
              isLiveStreaming
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-sm'
                : 'bg-stone-100 text-stone-600 border-stone-200'
            }`}
          >
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isLiveStreaming ? 'bg-emerald-500 animate-ping' : 'bg-stone-400'
              }`}
            />
            <span>{isLiveStreaming ? 'LIVE STREAM' : 'PAUSED'}</span>
          </div>

          {/* Pause / Resume Button */}
          <button
            onClick={() => {
              setIsLiveStreaming(!isLiveStreaming);
              showToast(isLiveStreaming ? 'Đã tạm dừng nhận log thời gian thực.' : 'Đã tiếp tục live stream log.');
            }}
            className="px-3 py-2 bg-white hover:bg-stone-50 border border-stone-200 text-stone-700 text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
          >
            {isLiveStreaming ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isLiveStreaming ? 'Pause' : 'Resume'}</span>
          </button>

          {/* Refresh / Clear View Button */}
          <button
            onClick={() => {
              fetchLogs();
              fetchStats();
              showToast('Đã tải lại toàn bộ nhật ký mới nhất.');
            }}
            className="px-3 py-2 bg-white hover:bg-stone-50 border border-stone-200 text-stone-700 text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-stone-500" />
            <span>Refresh</span>
          </button>

          {/* Export Logs Dropdown */}
          <div className="relative group">
            <button className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-2 transition-all cursor-pointer">
              <Download className="w-3.5 h-3.5 text-indigo-300" />
              <span>Export</span>
              <ChevronDown className="w-3 h-3 text-stone-400" />
            </button>
            <div className="absolute right-0 mt-1 w-44 bg-white rounded-2xl border border-stone-200 shadow-xl p-1.5 hidden group-hover:block z-30 animate-in fade-in zoom-in-95 duration-150">
              <button
                onClick={() => handleExportLogs('csv')}
                className="w-full px-3 py-2 rounded-xl text-left text-xs font-bold text-stone-700 hover:bg-stone-50 flex items-center gap-2"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>Export as CSV</span>
              </button>
              <button
                onClick={() => handleExportLogs('json')}
                className="w-full px-3 py-2 rounded-xl text-left text-xs font-bold text-stone-700 hover:bg-stone-50 flex items-center gap-2"
              >
                <FileText className="w-4 h-4 text-indigo-600" />
                <span>Export as JSON</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Summary KPI Metrics (6 Cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Card 1: Total Events */}
        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-stone-400 text-xs font-bold">
            <span>Total Events</span>
            <Activity className="w-4 h-4 text-indigo-600" />
          </div>
          <p className="text-2xl font-black text-stone-900 tracking-tight">{statistics.total || logs.length}</p>
          <p className="text-[10px] text-stone-400 font-medium">All logged records</p>
        </div>

        {/* Card 2: Errors */}
        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-stone-400 text-xs font-bold">
            <span>Errors</span>
            <AlertOctagon className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-2xl font-black text-rose-600 tracking-tight">{statistics.errors || 0}</p>
          <p className="text-[10px] text-stone-400 font-medium">HTTP 5xx & exceptions</p>
        </div>

        {/* Card 3: Critical Alerts */}
        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-stone-400 text-xs font-bold">
            <span>Critical</span>
            <ShieldAlert className="w-4 h-4 text-red-600" />
          </div>
          <p className="text-2xl font-black text-red-700 tracking-tight">{statistics.critical || 0}</p>
          <p className="text-[10px] text-stone-400 font-medium">Emergency shutdowns</p>
        </div>

        {/* Card 4: Warnings */}
        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-stone-400 text-xs font-bold">
            <span>Warnings</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-black text-amber-700 tracking-tight">{statistics.warnings || 0}</p>
          <p className="text-[10px] text-stone-400 font-medium">Obstacle, low battery</p>
        </div>

        {/* Card 5: AI Voice */}
        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-stone-400 text-xs font-bold">
            <span>AI Voice</span>
            <MessageSquare className="w-4 h-4 text-violet-600" />
          </div>
          <p className="text-2xl font-black text-violet-700 tracking-tight">{statistics.ai_requests || 0}</p>
          <p className="text-[10px] text-stone-400 font-medium">STT, RAG & LLM</p>
        </div>

        {/* Card 6: Robot Fleet */}
        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-stone-400 text-xs font-bold">
            <span>RC-001 Fleet</span>
            <Bot className="w-4 h-4 text-indigo-600" />
          </div>
          <p className="text-2xl font-black text-stone-900 tracking-tight">{statistics.robot_events || 0}</p>
          <p className="text-[10px] text-stone-400 font-medium">LiDAR, Dock & Nav</p>
        </div>
      </div>

      {/* 3. Filter Bar (Severity Pills, Category Pills, Department, Search) */}
      <div className="bg-white p-5 rounded-3xl border border-stone-200 shadow-sm space-y-4">
        {/* Row 1: Search & Dropdowns */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Instant Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo số phòng (412), từ khóa giọng nói, mã Correlation ID (SR-20260830-4102), sự kiện..."
              className="w-full pl-10 pr-4 py-2.5 bg-stone-50 border border-stone-200 rounded-2xl text-xs font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-stone-400 placeholder:font-normal"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700"
              >
                ✕
              </button>
            )}
          </div>

          {/* Department Selector */}
          <div className="relative shrink-0">
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="appearance-none bg-stone-50 hover:bg-stone-100 border border-stone-200 text-stone-800 text-xs font-bold rounded-2xl px-3.5 py-2.5 pr-8 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all cursor-pointer"
            >
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-stone-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Actor Selector */}
          <div className="relative shrink-0">
            <select
              value={selectedActor}
              onChange={(e) => setSelectedActor(e.target.value)}
              className="appearance-none bg-stone-50 hover:bg-stone-100 border border-stone-200 text-stone-800 text-xs font-bold rounded-2xl px-3.5 py-2.5 pr-8 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all cursor-pointer"
            >
              <option value="ALL">All Actors</option>
              <option value="ROBOT">Robot (RC-001)</option>
              <option value="STAFF">Staff Member</option>
              <option value="ADMIN">System Admin</option>
              <option value="AI">AI Voice Engine</option>
              <option value="GUEST">Guest</option>
              <option value="SYSTEM">System Backend</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-stone-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Row 2: Category & Severity Pills */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-3 border-t border-stone-100">
          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-black text-stone-400 uppercase tracking-wider mr-1">CATEGORY:</span>
            {['ALL', 'AI_VOICE', 'ROBOT', 'DISPATCH', 'AUDIT', 'SYSTEM'].map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer border ${
                  selectedCategory === cat
                    ? 'bg-stone-900 text-white border-stone-900 shadow-sm'
                    : 'bg-stone-50 hover:bg-stone-100 text-stone-600 border-stone-200'
                }`}
              >
                {cat === 'AI_VOICE'
                  ? 'AI Voice'
                  : cat === 'ROBOT'
                  ? 'Robot LiDAR'
                  : cat === 'DISPATCH'
                  ? 'Dispatch'
                  : cat === 'AUDIT'
                  ? 'Audit Trail'
                  : cat === 'SYSTEM'
                  ? 'System'
                  : 'All Categories'}
              </button>
            ))}
          </div>

          {/* Severity Level Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-black text-stone-400 uppercase tracking-wider mr-1">LEVEL:</span>
            {['ALL', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'].map((lvl) => (
              <button
                key={lvl}
                onClick={() => setSelectedLevel(lvl)}
                className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer border ${
                  selectedLevel === lvl
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-stone-50 hover:bg-stone-100 text-stone-600 border-stone-200'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Main Log Events Table */}
      <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden flex flex-col">
        {/* Table Header Controls */}
        <div className="p-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/40 text-xs font-bold text-stone-500">
          <div className="flex items-center gap-2">
            <span>Hiển thị</span>
            <span className="font-mono text-stone-900 font-extrabold">{filteredLogs.length}</span>
            <span>bản ghi nhật ký</span>
          </div>
          <span className="text-[11px] text-stone-400">Click vào dòng bất kỳ để xem JSON Metadata hoặc Trace</span>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-stone-200/80 bg-stone-50/70 text-[11px] font-black text-stone-500 uppercase tracking-wider">
                <th className="py-3 px-4">TIMESTAMP</th>
                <th className="py-3 px-3">LEVEL</th>
                <th className="py-3 px-3">CATEGORY</th>
                <th className="py-3 px-3">EVENT TYPE</th>
                <th className="py-3 px-3">ACTOR</th>
                <th className="py-3 px-4 min-w-[320px]">MESSAGE & CONTEXT</th>
                <th className="py-3 px-4 text-right">CORRELATION ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 font-medium">
              {paginatedLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-stone-400 font-medium space-y-2">
                    <Activity className="w-8 h-8 text-stone-300 mx-auto" />
                    <p>Không tìm thấy bản ghi log nào phù hợp với bộ lọc hiện tại.</p>
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((log) => {
                  const formattedTime = log.timestamp
                    ? new Date(log.timestamp).toLocaleTimeString('vi-VN', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })
                    : 'N/A';

                  const isSelected = selectedLog?.id === log.id;

                  return (
                    <tr
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className={`hover:bg-indigo-50/40 transition-colors cursor-pointer group ${
                        isSelected ? 'bg-indigo-50/60 ring-1 ring-inset ring-indigo-500/20' : ''
                      }`}
                    >
                      {/* Timestamp */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-mono text-stone-600 font-bold">{formattedTime}</span>
                      </td>

                      {/* Level */}
                      <td className="py-3 px-3 whitespace-nowrap">{renderLevelBadge(log.level)}</td>

                      {/* Category */}
                      <td className="py-3 px-3 whitespace-nowrap">{renderCategoryTag(log.category)}</td>

                      {/* Event Type */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="font-mono font-bold text-stone-800 text-[11px] bg-stone-100 px-2 py-0.5 rounded-md">
                          {log.event_type}
                        </span>
                      </td>

                      {/* Actor */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="text-stone-700 font-bold flex items-center gap-1.5">
                          {log.actor_type === 'ROBOT' ? (
                            <Bot className="w-3.5 h-3.5 text-indigo-600" />
                          ) : log.actor_type === 'GUEST' ? (
                            <User className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Server className="w-3.5 h-3.5 text-stone-500" />
                          )}
                          <span>{log.actor_id || log.actor_type}</span>
                        </span>
                      </td>

                      {/* Message */}
                      <td className="py-3 px-4 text-stone-800 leading-snug">
                        <span>{log.message}</span>
                        {log.module && (
                          <span className="text-[10px] text-stone-400 font-mono block mt-0.5">
                            [{log.module}]
                          </span>
                        )}
                      </td>

                      {/* Correlation ID */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {log.correlation_id ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenTrace(log.correlation_id);
                            }}
                            className="px-2.5 py-1 rounded-xl bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white border border-indigo-200 text-[11px] font-mono font-bold transition-all shadow-xs inline-flex items-center gap-1 cursor-pointer"
                          >
                            <span>{log.correlation_id}</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        ) : (
                          <span className="text-stone-300 font-mono text-[11px]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <Pagination
          currentPage={currentPage}
          totalItems={filteredLogs.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* 5. RIGHT-SIDE LOG DETAIL DRAWER */}
      {selectedLog && (
        <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-xl bg-white h-full shadow-2xl border-l border-stone-200 p-6 flex flex-col justify-between space-y-4 animate-in slide-in-from-right duration-200 overflow-y-auto">
            {/* Drawer Header */}
            <div className="space-y-3 border-b border-stone-100 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {renderLevelBadge(selectedLog.level)}
                  <span className="text-xs font-mono font-bold text-stone-400">LOG-#{selectedLog.id}</span>
                </div>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center font-bold text-xs cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div>
                <h3 className="text-lg font-black text-stone-900 leading-tight">{selectedLog.event_type}</h3>
                <p className="text-xs text-stone-600 mt-1">{selectedLog.message}</p>
              </div>
            </div>

            {/* Key Field Details Grid */}
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-stone-50 rounded-2xl border border-stone-100 space-y-0.5">
                  <span className="text-[10px] font-black text-stone-400 uppercase">TIMESTAMP</span>
                  <p className="font-mono font-bold text-stone-800">{selectedLog.timestamp || 'N/A'}</p>
                </div>

                <div className="p-3 bg-stone-50 rounded-2xl border border-stone-100 space-y-0.5">
                  <span className="text-[10px] font-black text-stone-400 uppercase">MODULE</span>
                  <p className="font-mono font-bold text-stone-800 truncate">{selectedLog.module || 'app'}</p>
                </div>

                <div className="p-3 bg-stone-50 rounded-2xl border border-stone-100 space-y-0.5">
                  <span className="text-[10px] font-black text-stone-400 uppercase">ACTOR</span>
                  <p className="font-bold text-stone-800">
                    {selectedLog.actor_type} ({selectedLog.actor_id || 'N/A'})
                  </p>
                </div>

                <div className="p-3 bg-stone-50 rounded-2xl border border-stone-100 space-y-0.5">
                  <span className="text-[10px] font-black text-stone-400 uppercase">ROBOT FLEET</span>
                  <p className="font-mono font-bold text-indigo-600">{selectedLog.robot_id || 'RC-001'}</p>
                </div>
              </div>

              {/* Correlation ID Banner */}
              {selectedLog.correlation_id && (
                <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-2xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-black text-indigo-700 uppercase">CORRELATION TRACE ID:</span>
                    <p className="font-mono font-black text-xs text-indigo-900">{selectedLog.correlation_id}</p>
                  </div>
                  <button
                    onClick={() => handleOpenTrace(selectedLog.correlation_id)}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <span>View Lifecycle</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              )}

              {/* JSON Payload Inspector */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black text-stone-600 uppercase flex items-center gap-1.5">
                    <Code2 className="w-3.5 h-3.5 text-indigo-600" />
                    <span>STRUCTURED METADATA (JSONB)</span>
                  </span>
                  <button
                    onClick={() => copyToClipboard(selectedLog.metadata, 'JSON Payload')}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer"
                  >
                    {copiedField === 'JSON Payload' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3 text-stone-400" />}
                    <span>{copiedField === 'JSON Payload' ? 'Copied!' : 'Copy JSON'}</span>
                  </button>
                </div>

                <pre className="p-4 bg-stone-900 text-emerald-400 font-mono text-[11px] rounded-2xl overflow-x-auto max-h-64 border border-stone-800 shadow-inner">
                  {JSON.stringify(selectedLog.metadata || {}, null, 2)}
                </pre>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-2">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-5 py-2.5 rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700 font-bold text-xs cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. TRACE VIEW MODAL (Lifecycle Timeline Visualizer) */}
      {isTraceModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-3xl w-full bg-white rounded-3xl border border-stone-200 shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col justify-between">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Compass className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-stone-900">
                    Trace Lifecycle Visualizer
                  </h3>
                  <p className="text-xs font-mono font-bold text-indigo-600 mt-0.5">
                    {traceData?.correlation_id || 'Tracing...'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsTraceModalOpen(false)}
                className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center font-bold text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Timeline Scroll Area */}
            <div className="overflow-y-auto pr-2 space-y-4 py-2">
              {isLoadingTrace ? (
                <div className="py-16 text-center space-y-2 text-stone-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-600" />
                  <p className="text-xs font-bold">Đang truy vết toàn bộ vòng đời...</p>
                </div>
              ) : !traceData || !traceData.timeline || traceData.timeline.length === 0 ? (
                <div className="py-12 text-center text-xs text-stone-400 font-bold">
                  Không tìm thấy các bước liên quan trong trace này.
                </div>
              ) : (
                <div className="relative pl-6 space-y-6 before:content-[''] before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-indigo-100">
                  {traceData.timeline.map((step, idx) => {
                    const stepTime = step.timestamp
                      ? new Date(step.timestamp).toLocaleTimeString('vi-VN', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })
                      : '';

                    return (
                      <div key={step.id} className="relative group">
                        {/* Timeline Step Dot */}
                        <div className="absolute -left-[23px] top-1 w-5 h-5 rounded-full bg-white border-2 border-indigo-600 text-indigo-600 flex items-center justify-center shadow-xs">
                          <span className="text-[9px] font-black">{idx + 1}</span>
                        </div>

                        {/* Step Card */}
                        <div className="bg-stone-50 hover:bg-indigo-50/40 p-4 rounded-2xl border border-stone-200/80 transition-all space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              {renderCategoryTag(step.category)}
                              <span className="font-mono font-extrabold text-stone-900 text-xs">
                                {step.event_type}
                              </span>
                            </div>
                            <span className="font-mono font-bold text-stone-500 text-[11px]">{stepTime}</span>
                          </div>

                          <p className="text-xs text-stone-800 font-medium leading-relaxed">{step.message}</p>

                          {/* Step Metadata Summary */}
                          {step.metadata && Object.keys(step.metadata).length > 0 && (
                            <div className="p-2.5 bg-white rounded-xl border border-stone-200/60 font-mono text-[10px] text-stone-600 flex items-center gap-3 flex-wrap">
                              {Object.entries(step.metadata).map(([k, v]) => (
                                <span key={k} className="inline-flex items-center gap-1">
                                  <span className="font-bold text-stone-400">{k}:</span>
                                  <span className="font-semibold text-stone-800">
                                    {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                                  </span>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-stone-100 flex items-center justify-between">
              <span className="text-xs text-stone-400 font-medium">
                Tổng cộng {traceData?.timeline?.length || 0} bước xử lý liên kết
              </span>
              <button
                onClick={() => setIsTraceModalOpen(false)}
                className="px-5 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs cursor-pointer shadow-sm"
              >
                Hoàn Tất
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
