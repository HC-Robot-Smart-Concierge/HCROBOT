import React, { useState, useEffect, useMemo, useRef } from 'react';
import { RotateCw } from 'lucide-react';
import { Pagination } from '../../../components/common/Pagination';
import {
  fetchLogs,
  fetchLogStatistics,
  fetchLogTrace,
  fetchAuditLogs,
  getLogExportUrl,
} from '../../../services/logsApi';

export const AdminLogsTab = () => {
  const [activeView, setActiveView] = useState('operational'); // 'operational' | 'audit'
  const [logs, setLogs] = useState([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [auditLogs, setAuditLogs] = useState([]);
  const [totalAudit, setTotalAudit] = useState(0);

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

  const [currentPage, setCurrentPage] = useState(() => {
    try {
      const p = parseInt(new URLSearchParams(window.location.search).get('page'), 10);
      return !isNaN(p) && p > 0 ? p : 1;
    } catch {
      return 1;
    }
  });
  const pageSize = 15;

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
    try {
      const params = new URLSearchParams(window.location.search);
      params.set('tab', 'Logs');
      params.set('page', newPage.toString());
      window.history.pushState(null, '', `${window.location.pathname}?${params.toString()}`);
    } catch { }
  };

  useEffect(() => {
    const onPopState = () => {
      try {
        const p = parseInt(new URLSearchParams(window.location.search).get('page'), 10);
        if (!isNaN(p) && p > 0) setCurrentPage(p);
      } catch { }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Filters
  const [selectedLevel, setSelectedLevel] = useState('ALL');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedDepartment, setSelectedDepartment] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected Log Modal
  const [selectedLog, setSelectedLog] = useState(null);
  // Trace Modal
  const [activeTrace, setActiveTrace] = useState(null);
  const [isTraceLoading, setIsTraceLoading] = useState(false);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const formatLogMessage = (msg) => {
    if (!msg || typeof msg !== 'string') return '';
    const staffMatch = msg.match(/^\[([A-Z_]+)\]\s+([\w\d_-]+)\s+performed\s+([A-Z_]+)(?:\s+on\s+([A-Z_]+):?([^\s]*))?/i);
    if (staffMatch) {
      const [, , actor, action] = staffMatch;
      const act = action.toUpperCase();
      if (act === 'LOGIN') {
        return `Nhân viên '${actor}' đã đăng nhập thành công vào hệ thống.`;
      }
      if (act === 'LOGOUT') {
        return `Nhân viên '${actor}' đã đăng xuất thành công khỏi hệ thống.`;
      }
      if (act === 'CREATE') {
        return `Nhân viên '${actor}' đã tạo mới dữ liệu.`;
      }
      if (act === 'UPDATE') {
        return `Nhân viên '${actor}' đã cập nhật thông tin dữ liệu.`;
      }
      if (act === 'DELETE') {
        return `Nhân viên '${actor}' đã xóa dữ liệu khỏi hệ thống.`;
      }
      return `Nhân viên '${actor}' đã thực hiện thao tác ${action.toLowerCase()}.`;
    }

    return msg.replace(/SESSION:[a-zA-Z0-9_\-]+/gi, 'Phiên làm việc')
              .replace(/token:[a-zA-Z0-9_\-\.]+/gi, '***');
  };

  const loadLogsData = async () => {
    if (activeView === 'operational') {
      try {
        const res = await fetchLogs({
          page: currentPage,
          limit: pageSize,
          level: selectedLevel,
          category: selectedCategory,
          department: selectedDepartment,
          search: searchQuery,
        });
        if (res && res.status === 'success') {
          setLogs(res.items || []);
          setTotalLogs(res.total || 0);
        }
      } catch {
        // Fallback
      }
    } else {
      try {
        const res = await fetchAuditLogs({
          page: currentPage,
          limit: pageSize,
        });
        if (res && res.status === 'success') {
          setAuditLogs(res.items || []);
          setTotalAudit(res.total || 0);
        }
      } catch {
        // Fallback
      }
    }
  };

  const loadStats = async () => {
    try {
      const res = await fetchLogStatistics();
      if (res && res.status === 'success') {
        setStatistics(res.data || {});
      }
    } catch {
      // Fallback
    }
  };

  const handleManualRefresh = async () => {
    setIsLoading(true);
    try {
      await Promise.all([loadLogsData(), loadStats()]);
      showToast('Đã làm mới dữ liệu nhật ký mới nhất.');
    } catch {
      showToast('Không thể làm mới dữ liệu.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const loadAll = async () => {
      setIsLoading(true);
      await Promise.all([loadLogsData(), loadStats()]);
      setIsLoading(false);
    };
    loadAll();
  }, [activeView, currentPage, selectedLevel, selectedCategory, selectedDepartment]);

  useEffect(() => {
    let interval = null;
    if (isLiveStreaming && activeView === 'operational') {
      interval = setInterval(() => {
        loadLogsData();
        loadStats();
      }, 5000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isLiveStreaming, activeView, currentPage, selectedLevel, selectedCategory, selectedDepartment]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    loadLogsData();
  };

  const handleExportLogs = (format = 'csv') => {
    const url = getLogExportUrl(format, {
      level: selectedLevel,
      category: selectedCategory,
      department: selectedDepartment,
      search: searchQuery,
    });
    window.open(url, '_blank');
    showToast(`Đang tải xuống tệp Log ${format.toUpperCase()}...`);
  };

  const handleOpenTrace = async (correlationId) => {
    if (!correlationId) return;
    setIsTraceLoading(true);
    setActiveTrace({ correlation_id: correlationId, timeline: [] });
    try {
      const res = await fetchLogTrace(correlationId);
      if (res && res.status === 'success') {
        setActiveTrace(res);
      } else {
        showToast('Không tìm thấy chuỗi trace tương ứng.');
      }
    } catch {
      showToast('Lỗi truy vấn trace vòng đời.');
    } finally {
      setIsTraceLoading(false);
    }
  };

  const formatTimestamp = (ts) => {
    if (!ts) return '--:--:--';
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString('vi-VN', { hour12: false }) + ' ' + d.toLocaleDateString('vi-VN');
    } catch {
      return ts;
    }
  };

  const getLevelBadgeStyle = (level = '') => {
    const l = level.toUpperCase();
    if (l === 'CRITICAL' || l === 'ERROR') {
      return {
        backgroundColor: '#262626',
        color: '#F2EFE9',
        borderColor: '#262626',
      };
    }
    if (l === 'WARNING') {
      return {
        backgroundColor: '#E9E5DC',
        color: '#262626',
        borderColor: '#BFBFBD',
      };
    }
    return {
      backgroundColor: '#FFFFFF',
      color: '#8C8C8C',
      borderColor: '#BFBFBD',
    };
  };

  return (
    <div className="w-full flex flex-col min-h-full pb-4" style={{ color: '#262626' }}>
      {/* Toast Notification (Placed at bottom-right so it never covers the header) */}
      {toastMessage && (
        <div
          className="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-xl border text-xs font-semibold shadow-2xl animate-in fade-in slide-in-from-bottom-3"
          style={{
            backgroundColor: '#262626',
            color: '#F2EFE9',
            borderColor: '#BFBFBD',
          }}
        >
          {toastMessage}
        </div>
      )}

      {/* Header Bar - aligns seamlessly with sidebar brand box line */}
      <div
        className="h-16 px-5 border-b flex items-center justify-between gap-4 shrink-0 sticky top-0 z-20"
        style={{ borderColor: '#BFBFBD', backgroundColor: '#F2EFE9' }}
      >
        <div className="min-w-0">
          <h2 className="text-sm sm:text-base font-bold tracking-tight leading-tight truncate" style={{ color: '#262626' }}>
            Nhật Ký Hệ Thống & Kiểm Toán (System Logs & Audit Trail)
          </h2>
          <p className="text-[10px] sm:text-[11px] font-normal truncate mt-0.5" style={{ color: '#8C8C8C' }}>
            Truy vết trực tiếp từ cơ sở dữ liệu về sự kiện hội thoại AI, điều phối và kiểm toán bảo mật Robot
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Toggle Operational vs Audit */}
          <div className="flex rounded-lg border p-0.5" style={{ borderColor: '#BFBFBD', backgroundColor: '#E9E5DC' }}>
            <button
              onClick={() => { setActiveView('operational'); setCurrentPage(1); }}
              className={`px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer ${activeView === 'operational' ? 'bg-[#262626] text-white' : 'text-stone-600 hover:text-stone-900'
                }`}
            >
              Nhật Ký Vận Hành
            </button>
            <button
              onClick={() => { setActiveView('audit'); setCurrentPage(1); }}
              className={`px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer ${activeView === 'audit' ? 'bg-[#262626] text-white' : 'text-stone-600 hover:text-stone-900'
                }`}
            >
              Kiểm Toán Bảo Mật
            </button>
          </div>

          <button
            onClick={() => handleExportLogs('csv')}
            className="px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-all hover:bg-[#E9E5DC]/80"
            style={{
              backgroundColor: '#E9E5DC',
              borderColor: '#BFBFBD',
              color: '#262626',
            }}
          >
            Xuất CSV
          </button>
          <button
            onClick={() => handleExportLogs('json')}
            className="px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-all hover:bg-[#E9E5DC]/80"
            style={{
              backgroundColor: '#E9E5DC',
              borderColor: '#BFBFBD',
              color: '#262626',
            }}
          >
            Xuất JSON
          </button>
        </div>
      </div>

      {/* Content Body */}
      <div className="p-4 space-y-3">

      {/* 4 Metric Cards (Single Compact Row) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <div className="p-3 rounded-xl border flex flex-col justify-between" style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD' }}>
          <div className="text-[11px] font-semibold" style={{ color: '#8C8C8C' }}>TỔNG BẢN GHI NHẬT KÝ</div>
          <div className="flex items-baseline gap-1.5 my-1">
            <span className="text-2xl font-bold" style={{ color: '#262626' }}>
              {statistics.total || totalLogs}
            </span>
            <span className="text-xs" style={{ color: '#8C8C8C' }}>sự kiện</span>
          </div>
          <div className="text-[10px] font-medium" style={{ color: '#8C8C8C' }}></div>
        </div>

        <div className="p-3 rounded-xl border flex flex-col justify-between" style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD' }}>
          <div className="text-[11px] font-semibold" style={{ color: '#8C8C8C' }}>CẢNH BÁO (WARNING)</div>
          <div className="flex items-baseline gap-1.5 my-1">
            <span className="text-2xl font-bold" style={{ color: '#262626' }}>{statistics.warnings || 0}</span>
            <span className="text-xs" style={{ color: '#8C8C8C' }}>cần chú ý</span>
          </div>
          <div className="text-[10px] font-medium" style={{ color: '#8C8C8C' }}></div>
        </div>

        <div className="p-3 rounded-xl border flex flex-col justify-between" style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD' }}>
          <div className="text-[11px] font-semibold" style={{ color: '#8C8C8C' }}>LỖI HỆ THỐNG (ERROR / CRIT)</div>
          <div className="flex items-baseline gap-1.5 my-1">
            <span className="text-2xl font-bold" style={{ color: '#262626' }}>{(statistics.errors || 0) + (statistics.critical || 0)}</span>
            <span className="text-xs" style={{ color: '#8C8C8C' }}>lỗi</span>
          </div>
          <div className="text-[10px] font-medium" style={{ color: '#8C8C8C' }}></div>
        </div>

        <div className="p-3 rounded-xl border flex flex-col justify-between" style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD' }}>
          <div className="text-[11px] font-semibold" style={{ color: '#8C8C8C' }}>TRẠNG THÁI TRUY VẾT</div>
          <div className="flex items-baseline gap-1.5 my-1">
            <span className="text-2xl font-bold" style={{ color: '#262626' }}>{isLiveStreaming ? 'Tự động' : 'Thủ công'}</span>
          </div>
        </div>
      </div>

      {activeView === 'operational' ? (
        <>
          {/* Filter Bar */}
          <div
            className="p-2.5 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-2.5"
            style={{
              backgroundColor: '#E9E5DC',
              borderColor: '#BFBFBD',
            }}
          >
            <form onSubmit={handleSearchSubmit} className="w-full sm:w-72">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm nội dung, tác nhân, correlation ID..."
                className="w-full px-3 py-1.5 rounded-lg text-xs font-normal border focus:outline-none"
                style={{
                  backgroundColor: '#FFFFFF',
                  borderColor: '#BFBFBD',
                  color: '#262626',
                }}
              />
            </form>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              {/* Nút làm mới icon xoay đặt bên trái Tất cả mức độ */}
              <button
                type="button"
                onClick={handleManualRefresh}
                disabled={isLoading}
                title="Làm mới nhật ký"
                className="p-2 rounded-lg border text-xs font-medium cursor-pointer transition-all hover:bg-[#E9E5DC] active:scale-95 flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: '#FFFFFF',
                  borderColor: '#BFBFBD',
                  color: '#262626',
                }}
              >
                <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>

              <select
                value={selectedLevel}
                onChange={(e) => setSelectedLevel(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium border focus:outline-none cursor-pointer"
                style={{
                  backgroundColor: '#FFFFFF',
                  borderColor: '#BFBFBD',
                  color: '#262626',
                }}
              >
                <option value="ALL">Tất cả mức độ</option>
                <option value="INFO">INFO</option>
                <option value="WARNING">WARNING</option>
                <option value="ERROR">ERROR</option>
                <option value="CRITICAL">CRITICAL</option>
              </select>

              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium border focus:outline-none cursor-pointer"
                style={{
                  backgroundColor: '#FFFFFF',
                  borderColor: '#BFBFBD',
                  color: '#262626',
                }}
              >
                <option value="ALL">Tất cả phân loại</option>
                <option value="AUDIT">Kiểm toán (AUDIT)</option>
                <option value="SYSTEM">Hệ thống (SYSTEM)</option>
                <option value="ROBOT">Robot (ROBOT)</option>
                <option value="AI">Trí tuệ nhân tạo (AI)</option>
                <option value="SERVICE">Dịch vụ (SERVICE)</option>
              </select>

              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium border focus:outline-none cursor-pointer"
                style={{
                  backgroundColor: '#FFFFFF',
                  borderColor: '#BFBFBD',
                  color: '#262626',
                }}
              >
                <option value="ALL">Tất cả bộ phận</option>
                <option value="reception">Lễ tân</option>
                <option value="housekeeping">Buồng phòng</option>
                <option value="room_service">Phục vụ phòng (F&B)</option>
                <option value="bell_services">Hành lý</option>
                <option value="maintenance">Kỹ thuật</option>
              </select>
            </div>
          </div>

          {/* Logs Table */}
          <div
            className="rounded-xl border overflow-hidden shadow-none"
            style={{
              backgroundColor: '#FFFFFF',
              borderColor: '#BFBFBD',
            }}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr
                    className="border-b text-[11px] font-semibold uppercase tracking-wider"
                    style={{
                      backgroundColor: '#E9E5DC',
                      borderColor: '#BFBFBD',
                      color: '#262626',
                    }}
                  >
                    <th className="py-2 px-3 w-28">Thời gian</th>
                    <th className="py-2 px-3 w-24 text-center">Mức độ</th>
                    <th className="py-2 px-3 w-32">Phân loại</th>
                    <th className="py-2 px-3 w-32">Tác nhân</th>
                    <th className="py-2 px-3">Thông điệp nhật ký</th>
                    <th className="py-2 px-3 w-32 text-right">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-xs" style={{ borderColor: '#E9E5DC' }}>
                  {isLoading && logs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center" style={{ color: '#8C8C8C' }}>
                        Đang tải nhật ký hệ thống...
                      </td>
                    </tr>
                  ) : logs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center" style={{ color: '#8C8C8C' }}>
                        Không có nhật ký nào phù hợp với bộ lọc
                      </td>
                    </tr>
                  ) : (
                    logs.map((item) => {
                      const badgeStyle = getLevelBadgeStyle(item.level);
                      return (
                        <tr
                          key={item.id}
                          className="hover:bg-[#F2EFE9]/50 transition-colors"
                          style={{ borderColor: '#E9E5DC' }}
                        >
                          <td className="py-2 px-3 font-mono text-[11px]" style={{ color: '#8C8C8C' }}>
                            {formatTimestamp(item.timestamp)}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span
                              className="px-2 py-0.5 rounded text-[10px] font-semibold border"
                              style={badgeStyle}
                            >
                              {item.level}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-semibold text-[11px]" style={{ color: '#262626' }}>
                            {item.category}
                          </td>
                          <td className="py-2 px-3 font-mono text-[11px]" style={{ color: '#8C8C8C' }}>
                            {item.actor_id || item.actor_type || 'N/A'}
                          </td>
                          <td className="py-2 px-3 font-medium text-[11px]" style={{ color: '#262626' }}>
                            {formatLogMessage(item.message)}
                          </td>
                          <td className="py-2 px-3 text-right space-x-1.5">
                            {item.correlation_id && (
                              <button
                                onClick={() => handleOpenTrace(item.correlation_id)}
                                className="text-[11px] font-bold px-2 py-0.5 rounded border cursor-pointer hover:bg-stone-200"
                                style={{
                                  backgroundColor: '#E9E5DC',
                                  borderColor: '#BFBFBD',
                                  color: '#262626',
                                }}
                                title="Xem Trace vòng đời transaction"
                              >
                                Trace
                              </button>
                            )}
                            <button
                              onClick={() => setSelectedLog(item)}
                              className="text-[11px] font-bold px-2 py-0.5 rounded border cursor-pointer hover:bg-stone-200"
                              style={{
                                backgroundColor: '#E9E5DC',
                                borderColor: '#BFBFBD',
                                color: '#262626',
                              }}
                            >
                              Xem
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={currentPage}
              totalItems={totalLogs}
              pageSize={pageSize}
              onPageChange={handlePageChange}
              className="border-t px-3 py-2"
            />
          </div>
        </>
      ) : (
        /* AUDIT TRAIL VIEW */
        <div
          className="rounded-xl border overflow-hidden shadow-none"
          style={{
            backgroundColor: '#FFFFFF',
            borderColor: '#BFBFBD',
          }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr
                  className="border-b text-[11px] font-semibold uppercase tracking-wider"
                  style={{
                    backgroundColor: '#E9E5DC',
                    borderColor: '#BFBFBD',
                    color: '#262626',
                  }}
                >
                  <th className="py-2 px-3 w-32">Thời gian</th>
                  <th className="py-2 px-3 w-32">Hành động</th>
                  <th className="py-2 px-3 w-36">Tác nhân</th>
                  <th className="py-2 px-3 w-32">Tài nguyên</th>
                  <th className="py-2 px-3">Chi tiết thay đổi</th>
                  <th className="py-2 px-3 w-28">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y text-xs" style={{ borderColor: '#E9E5DC' }}>
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center" style={{ color: '#8C8C8C' }}>
                      Chưa có bản ghi kiểm toán bảo mật nào
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((item) => (
                    <tr key={item.id} className="hover:bg-[#F2EFE9]/50 transition-colors">
                      <td className="py-2 px-3 font-mono text-[11px]" style={{ color: '#8C8C8C' }}>
                        {formatTimestamp(item.timestamp)}
                      </td>
                      <td className="py-2 px-3 font-bold text-indigo-700">
                        {item.action}
                      </td>
                      <td className="py-2 px-3 font-medium">
                        {item.actor_name || item.actor_id || 'System'} ({item.actor_type})
                      </td>
                      <td className="py-2 px-3 font-mono text-[11px]">
                        {item.resource_type} #{item.resource_id}
                      </td>
                      <td className="py-2 px-3 text-[11px] text-stone-700">
                        {item.after_state ? JSON.stringify(item.after_state) : 'Action logged'}
                      </td>
                      <td className="py-2 px-3 font-mono text-[10px] text-stone-500">
                        {item.ip_address || '127.0.0.1'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <Pagination
            currentPage={currentPage}
            totalItems={totalAudit}
            pageSize={pageSize}
            onPageChange={handlePageChange}
            className="border-t px-3 py-2"
          />
        </div>
      )}
      </div>

      {/* MODAL: LOG DETAILS */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            className="max-w-xl w-full p-4 rounded-xl border shadow-xl space-y-3"
            style={{
              backgroundColor: '#FFFFFF',
              borderColor: '#BFBFBD',
            }}
          >
            <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: '#BFBFBD' }}>
              <h3 className="text-xs font-bold" style={{ color: '#262626' }}>
                Chi tiết sự kiện #{selectedLog.id}
              </h3>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-xs font-bold px-2 py-0.5 rounded border cursor-pointer"
                style={{
                  backgroundColor: '#E9E5DC',
                  borderColor: '#BFBFBD',
                  color: '#262626',
                }}
              >
                Đóng
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-2.5 rounded border space-y-1" style={{ backgroundColor: '#E9E5DC', borderColor: '#BFBFBD' }}>
                <div className="font-semibold text-xs" style={{ color: '#262626' }}>
                  {formatLogMessage(selectedLog.message)}
                </div>
                <div className="text-[10px] font-mono" style={{ color: '#8C8C8C' }}>
                  Thời gian: {selectedLog.timestamp}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2 rounded border" style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD' }}>
                  <span style={{ color: '#8C8C8C' }}>Mức độ: </span>
                  <span className="font-bold" style={{ color: '#262626' }}>{selectedLog.level}</span>
                </div>
                <div className="p-2 rounded border" style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD' }}>
                  <span style={{ color: '#8C8C8C' }}>Phân loại: </span>
                  <span className="font-bold" style={{ color: '#262626' }}>{selectedLog.category}</span>
                </div>
                <div className="p-2 rounded border" style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD' }}>
                  <span style={{ color: '#8C8C8C' }}>Tác nhân: </span>
                  <span className="font-mono font-bold" style={{ color: '#262626' }}>
                    {selectedLog.actor_id || selectedLog.actor_type || 'N/A'}
                  </span>
                </div>
                <div className="p-2 rounded border" style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD' }}>
                  <span style={{ color: '#8C8C8C' }}>Module: </span>
                  <span className="font-mono font-bold" style={{ color: '#262626' }}>{selectedLog.module || 'core'}</span>
                </div>
              </div>

              {selectedLog.correlation_id && (
                <div className="p-2 rounded border flex items-center justify-between" style={{ backgroundColor: '#E9E5DC', borderColor: '#BFBFBD' }}>
                  <div>
                    <span className="text-[10px] font-bold text-stone-500 block">CORRELATION ID:</span>
                    <span className="font-mono text-xs font-bold text-stone-800">{selectedLog.correlation_id}</span>
                  </div>
                  <button
                    onClick={() => {
                      const corr = selectedLog.correlation_id;
                      setSelectedLog(null);
                      handleOpenTrace(corr);
                    }}
                    className="px-2.5 py-1 rounded bg-[#262626] text-white text-[11px] font-bold cursor-pointer"
                  >
                    Xem Toàn Bộ Trace →
                  </button>
                </div>
              )}

              {selectedLog.metadata && (
                <div>
                  <div className="text-[10px] font-semibold mb-1" style={{ color: '#8C8C8C' }}>METADATA:</div>
                  <pre
                    className="p-2.5 rounded border text-[11px] font-mono overflow-x-auto max-h-40"
                    style={{
                      backgroundColor: '#E9E5DC',
                      borderColor: '#BFBFBD',
                      color: '#262626',
                    }}
                  >
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t" style={{ borderColor: '#BFBFBD' }}>
              <button
                onClick={() => setSelectedLog(null)}
                className="px-3 py-1.5 rounded text-xs font-semibold border cursor-pointer"
                style={{
                  backgroundColor: '#262626',
                  borderColor: '#262626',
                  color: '#F2EFE9',
                }}
              >
                Hoàn tất
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: TRANSACTION TRACE TIMELINE */}
      {activeTrace && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-2xl w-full bg-white p-6 rounded-2xl border border-stone-200 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-sm font-bold text-stone-900">
                  Trace Vòng Đời Transaction #{activeTrace.correlation_id}
                </h3>
                <p className="text-[11px] text-stone-500">
                  Tổng {activeTrace.total_steps || activeTrace.timeline?.length || 0} bước xử lý
                </p>
              </div>
              <button
                onClick={() => setActiveTrace(null)}
                className="w-7 h-7 rounded-full bg-stone-100 text-stone-600 hover:bg-stone-200 flex items-center justify-center font-bold text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-1 text-xs">
              {isTraceLoading ? (
                <div className="py-10 text-center text-stone-400">Đang truy vấn lịch sử trace...</div>
              ) : activeTrace.timeline?.length === 0 ? (
                <div className="py-10 text-center text-stone-400">Không có bản ghi liên kết</div>
              ) : (
                activeTrace.timeline?.map((step, idx) => (
                  <div key={step.id || idx} className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] text-indigo-600 font-bold">
                        BƯỚC {idx + 1} • {step.event_type || step.category}
                      </span>
                      <span className="font-mono text-[10px] text-stone-400">
                        {step.timestamp}
                      </span>
                    </div>
                    <div className="font-semibold text-stone-900">{step.message}</div>
                    <div className="text-[10px] text-stone-500">
                      Module: <span className="font-mono">{step.module}</span> • Tác nhân: <span className="font-mono">{step.actor_id || step.actor_type}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-3 border-t">
              <button
                onClick={() => setActiveTrace(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-stone-900 text-white cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
