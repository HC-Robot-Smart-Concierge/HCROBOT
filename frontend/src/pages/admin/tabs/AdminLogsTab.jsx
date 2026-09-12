import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Pagination } from '../../../components/common/Pagination';

const API_BASE_URL = '/api/v1';

export const AdminLogsTab = () => {
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

  const [currentPage, setCurrentPage] = useState(() => {
    try {
      const p = parseInt(new URLSearchParams(window.location.search).get('page'), 10);
      return !isNaN(p) && p > 0 ? p : 1;
    } catch {
      return 1;
    }
  });
  const pageSize = 7;

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
    try {
      const params = new URLSearchParams(window.location.search);
      params.set('tab', 'Logs');
      params.set('page', newPage.toString());
      window.history.pushState(null, '', `${window.location.pathname}?${params.toString()}`);
    } catch {}
  };

  useEffect(() => {
    const onPopState = () => {
      try {
        const p = parseInt(new URLSearchParams(window.location.search).get('page'), 10);
        if (!isNaN(p) && p > 0) setCurrentPage(p);
      } catch {}
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

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/logs?limit=100`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.items || []);
      }
    } catch {
      // Fallback
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/logs/statistics`);
      if (res.ok) {
        const data = await res.json();
        setStatistics(data.data || {});
      }
    } catch {
      // Fallback
    }
  };

  useEffect(() => {
    const loadAll = async () => {
      setIsLoading(true);
      await Promise.all([fetchLogs(), fetchStats()]);
      setIsLoading(false);
    };
    loadAll();

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

  const handleExportLogs = (format = 'csv') => {
    const url = `${API_BASE_URL}/logs/export?format=${format}&level=${selectedLevel}&category=${selectedCategory}&search=${encodeURIComponent(
      searchQuery
    )}`;
    window.open(url, '_blank');
    showToast(`Đang tải xuống tệp Log ${format.toUpperCase()}...`);
  };

  const filteredLogs = useMemo(() => {
    return logs.filter((item) => {
      if (selectedLevel !== 'ALL' && item.level !== selectedLevel) return false;
      if (selectedCategory !== 'ALL' && item.category !== selectedCategory) return false;

      if (selectedDepartment !== 'ALL') {
        const mod = (item.module || '').toLowerCase();
        const msg = (item.message || '').toLowerCase();
        const deptKey = selectedDepartment.toLowerCase();
        if (!mod.includes(deptKey) && !msg.includes(deptKey)) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesMsg = (item.message || '').toLowerCase().includes(q);
        const matchesActor = (item.actor_id || '').toLowerCase().includes(q);
        const matchesModule = (item.module || '').toLowerCase().includes(q);
        const matchesType = (item.event_type || '').toLowerCase().includes(q);
        const matchesCorrelation = (item.correlation_id || '').toLowerCase().includes(q);
        if (!matchesMsg && !matchesActor && !matchesModule && !matchesType && !matchesCorrelation) {
          return false;
        }
      }
      return true;
    });
  }, [logs, selectedLevel, selectedCategory, selectedDepartment, searchQuery]);

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    handlePageChange(1);
  }, [selectedLevel, selectedCategory, selectedDepartment, searchQuery]);

  const paginatedLogs = filteredLogs.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const formatTimestamp = (ts) => {
    if (!ts) return '--:--:--';
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString('vi-VN', { hour12: false });
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
    <div className="w-full flex flex-col p-4 space-y-3 pb-2" style={{ color: '#262626' }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className="fixed top-5 right-5 z-50 px-4 py-2 rounded-lg border text-xs font-semibold shadow-lg"
          style={{
            backgroundColor: '#262626',
            color: '#F2EFE9',
            borderColor: '#BFBFBD',
          }}
        >
          {toastMessage}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-2.5" style={{ borderColor: '#BFBFBD' }}>
        <div>
          <h2 className="text-base font-bold tracking-tight" style={{ color: '#262626' }}>
            Nhật Ký Hệ Thống & Kiểm Toán (System Logs)
          </h2>
          <p className="text-[11px] font-normal" style={{ color: '#8C8C8C' }}>
            Truy vết trực tiếp từ cơ sở dữ liệu về sự kiện hội thoại AI, điều phối và kiểm toán Robot
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => setIsLiveStreaming(!isLiveStreaming)}
            className="px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-colors"
            style={{
              backgroundColor: isLiveStreaming ? '#262626' : '#FFFFFF',
              borderColor: isLiveStreaming ? '#262626' : '#BFBFBD',
              color: isLiveStreaming ? '#F2EFE9' : '#262626',
            }}
          >
            {isLiveStreaming ? '● Đang truyền trực tiếp' : '○ Tạm dừng'}
          </button>
          <button
            onClick={() => { fetchLogs(); fetchStats(); }}
            className="px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer"
            style={{
              backgroundColor: '#FFFFFF',
              borderColor: '#BFBFBD',
              color: '#262626',
            }}
          >
            Làm mới
          </button>
          <button
            onClick={() => handleExportLogs('csv')}
            className="px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer"
            style={{
              backgroundColor: '#E9E5DC',
              borderColor: '#BFBFBD',
              color: '#262626',
            }}
          >
            Xuất CSV
          </button>
        </div>
      </div>

      {/* 4 Metric Cards (Single Compact Row) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <div className="p-3 rounded-xl border flex flex-col justify-between" style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD' }}>
          <div className="text-[11px] font-semibold" style={{ color: '#8C8C8C' }}>TỔNG BẢN GHI NHẬT KÝ</div>
          <div className="flex items-baseline gap-1.5 my-1">
            <span className="text-2xl font-bold" style={{ color: '#262626' }}>{statistics.total || logs.length}</span>
            <span className="text-xs" style={{ color: '#8C8C8C' }}>sự kiện</span>
          </div>
          <div className="text-[10px] font-medium" style={{ color: '#8C8C8C' }}>Ghi nhận từ database</div>
        </div>

        <div className="p-3 rounded-xl border flex flex-col justify-between" style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD' }}>
          <div className="text-[11px] font-semibold" style={{ color: '#8C8C8C' }}>CẢNH BÁO (WARNING)</div>
          <div className="flex items-baseline gap-1.5 my-1">
            <span className="text-2xl font-bold" style={{ color: '#262626' }}>{statistics.warnings || 0}</span>
            <span className="text-xs" style={{ color: '#8C8C8C' }}>cần chú ý</span>
          </div>
          <div className="text-[10px] font-medium" style={{ color: '#8C8C8C' }}>Vật cản đường & pin thấp</div>
        </div>

        <div className="p-3 rounded-xl border flex flex-col justify-between" style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD' }}>
          <div className="text-[11px] font-semibold" style={{ color: '#8C8C8C' }}>LỖI HỆ THỐNG (ERROR / CRIT)</div>
          <div className="flex items-baseline gap-1.5 my-1">
            <span className="text-2xl font-bold" style={{ color: '#262626' }}>{(statistics.errors || 0) + (statistics.critical || 0)}</span>
            <span className="text-xs" style={{ color: '#8C8C8C' }}>lỗi</span>
          </div>
          <div className="text-[10px] font-medium" style={{ color: '#8C8C8C' }}>Không có lỗi nghiêm trọng</div>
        </div>

        <div className="p-3 rounded-xl border flex flex-col justify-between" style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD' }}>
          <div className="text-[11px] font-semibold" style={{ color: '#8C8C8C' }}>TRẠNG THÁI TRUY VẾT</div>
          <div className="flex items-baseline gap-1.5 my-1">
            <span className="text-2xl font-bold" style={{ color: '#262626' }}>{isLiveStreaming ? 'Tự động' : 'Thủ công'}</span>
          </div>
          <div className="text-[10px] font-medium" style={{ color: '#8C8C8C' }}>{isLiveStreaming ? 'Cập nhật mỗi 5 giây' : 'Chế độ xem tĩnh'}</div>
        </div>
      </div>

      {/* Filter Bar (Single Compact Row) */}
      <div
        className="p-2.5 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-2.5"
        style={{
          backgroundColor: '#E9E5DC',
          borderColor: '#BFBFBD',
        }}
      >
        <div className="w-full sm:w-72">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo nội dung, tác nhân, correlation ID..."
            className="w-full px-3 py-1.5 rounded-lg text-xs font-normal border focus:outline-none"
            style={{
              backgroundColor: '#FFFFFF',
              borderColor: '#BFBFBD',
              color: '#262626',
            }}
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
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
            <option value="DISPATCH">Điều phối (DISPATCH)</option>
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
            <option value="ALL">Tất cả 5 bộ phận</option>
            <option value="reception">Lễ tân</option>
            <option value="housekeeping">Buồng phòng</option>
            <option value="room_service">Phục vụ phòng (F&B)</option>
            <option value="bell_service">Hành lý</option>
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
                <th className="py-2 px-3 w-24">Thời gian</th>
                <th className="py-2 px-3 w-24 text-center">Mức độ</th>
                <th className="py-2 px-3 w-36">Phân loại</th>
                <th className="py-2 px-3 w-32">Tác nhân</th>
                <th className="py-2 px-3">Thông điệp nhật ký</th>
                <th className="py-2 px-3 w-24 text-right">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y text-xs" style={{ borderColor: '#E9E5DC' }}>
              {isLoading && paginatedLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center" style={{ color: '#8C8C8C' }}>
                    Đang tải nhật ký từ cơ sở dữ liệu...
                  </td>
                </tr>
              ) : paginatedLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center" style={{ color: '#8C8C8C' }}>
                    Không tìm thấy sự kiện nhật ký nào.
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((log) => (
                  <tr
                    key={log.id}
                    className="transition-colors hover:bg-[#F2EFE9]/40"
                    style={{ borderBottom: '1px solid #E9E5DC' }}
                  >
                    {/* Timestamp */}
                    <td className="py-2 px-3 font-mono text-[11px]" style={{ color: '#8C8C8C' }}>
                      {formatTimestamp(log.timestamp)}
                    </td>

                    {/* Level */}
                    <td className="py-2 px-3 text-center">
                      <span
                        className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold border"
                        style={getLevelBadgeStyle(log.level)}
                      >
                        {log.level || 'INFO'}
                      </span>
                    </td>

                    {/* Category & Event */}
                    <td className="py-2 px-3">
                      <div className="font-semibold text-[11px]" style={{ color: '#262626' }}>
                        {log.category || 'SYSTEM'}
                      </div>
                      <div className="text-[10px] font-mono" style={{ color: '#8C8C8C' }}>
                        {log.event_type || '--'}
                      </div>
                    </td>

                    {/* Actor */}
                    <td className="py-2 px-3 font-mono text-[11px]" style={{ color: '#262626' }}>
                      {log.actor_id ? `@${log.actor_id}` : log.actor_type || 'System'}
                    </td>

                    {/* Message */}
                    <td className="py-2 px-3">
                      <div className="font-medium truncate max-w-lg" style={{ color: '#262626' }}>
                        {log.message}
                      </div>
                      {log.module && (
                        <div className="text-[10px] font-mono" style={{ color: '#8C8C8C' }}>
                          [{log.module}]
                        </div>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-2 px-3 text-right">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="px-2.5 py-1 rounded text-[11px] font-medium border cursor-pointer hover:opacity-80"
                        style={{
                          backgroundColor: '#FFFFFF',
                          borderColor: '#BFBFBD',
                          color: '#262626',
                        }}
                      >
                        Chi tiết
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <Pagination
          currentPage={currentPage}
          totalItems={filteredLogs.length}
          pageSize={pageSize}
          onPageChange={handlePageChange}
          itemName="sự kiện"
        />
      </div>

      {/* Log Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div
            className="max-w-lg w-full rounded-2xl border p-5 space-y-3 shadow-xl"
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
                  {selectedLog.message}
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
                  <span className="font-mono font-bold" style={{ color: '#262626' }}>{selectedLog.actor_id || selectedLog.actor_type || 'N/A'}</span>
                </div>
                <div className="p-2 rounded border" style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD' }}>
                  <span style={{ color: '#8C8C8C' }}>Module: </span>
                  <span className="font-mono font-bold" style={{ color: '#262626' }}>{selectedLog.module || 'core'}</span>
                </div>
              </div>

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
    </div>
  );
};
