import React, { useState, useEffect, useMemo } from 'react';
import {
  Video,
  Play,
  ExternalLink,
  Clock,
  Calendar,
  Filter,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  FileVideo,
  RefreshCw,
  Search,
  Cloud,
} from 'lucide-react';
import {
  fetchHumanSupportSessions,
  fetchVideoCallMetrics,
  syncCloudinaryRecordings,
} from '../../../services/conciergeApi';

export const AdminVideoCallsTab = ({ currentUser }) => {
  const [sessions, setSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState(null);
  const [error, setError] = useState(null);

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [recordingStatusFilter, setRecordingStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Metrics
  const [metrics, setMetrics] = useState({
    total_calls: 0,
    ready_recordings: 0,
    saving_recordings: 0,
    failed_recordings: 0,
    no_recordings: 0,
  });

  // Video Player Modal
  const [playingVideo, setPlayingVideo] = useState(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [sessionsData, metricsData] = await Promise.all([
        fetchHumanSupportSessions(null, 100, 0),
        fetchVideoCallMetrics(startDate || null, endDate || null),
      ]);
      setSessions(Array.isArray(sessionsData) ? sessionsData : []);
      if (metricsData) {
        setMetrics(metricsData);
      }
    } catch (err) {
      console.error('[AdminVideoCalls] Error loading data:', err);
      setError('Không thể tải danh sách cuộc gọi. Vui lòng thử lại sau.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [startDate, endDate]);

  // Client-side filtering across sessions based on date, search, and recording status
  const filteredSessions = useMemo(() => {
    return sessions.filter((session) => {
      // 1. Date Range Filter
      if (startDate && session.created_at) {
        const sDate = new Date(startDate);
        const itemDate = new Date(session.created_at);
        if (itemDate < sDate) return false;
      }
      if (endDate && session.created_at) {
        const eDate = new Date(endDate);
        eDate.setHours(23, 59, 59, 999);
        const itemDate = new Date(session.created_at);
        if (itemDate > eDate) return false;
      }

      // 2. Recording Status Filter
      const rStat = (session.recording_status || '').toLowerCase();
      const hasUrl = Boolean(session.recording_url && session.recording_url.trim());

      if (recordingStatusFilter === 'ready') {
        if (!hasUrl && rStat !== 'ready') return false;
      } else if (recordingStatusFilter === 'saving') {
        if (rStat !== 'saving') return false;
      } else if (recordingStatusFilter === 'failed') {
        if (rStat !== 'failed') return false;
      } else if (recordingStatusFilter === 'none') {
        if (hasUrl || rStat === 'ready' || rStat === 'saving' || rStat === 'failed') return false;
      }

      // 3. Search Term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const codeMatch = (session.session_code || '').toLowerCase().includes(term);
        const roomMatch = (session.room_number || '').toLowerCase().includes(term);
        const guestMatch = (session.guest_name || '').toLowerCase().includes(term);
        const ticketMatch = (session.linked_request_id || '').toLowerCase().includes(term);
        if (!codeMatch && !roomMatch && !guestMatch && !ticketMatch) return false;
      }

      return true;
    });
  }, [sessions, startDate, endDate, recordingStatusFilter, searchTerm]);

  // Paginated Slices
  const totalPages = Math.max(1, Math.ceil(filteredSessions.length / pageSize));
  const paginatedSessions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredSessions.slice(start, start + pageSize);
  }, [filteredSessions, currentPage]);

  const handleResetFilters = () => {
    setStartDate('');
    setEndDate('');
    setRecordingStatusFilter('all');
    setSearchTerm('');
    setCurrentPage(1);
  };

  const handleSyncCloudinary = async () => {
    setIsSyncing(true);
    setSyncMessage(null);
    try {
      const res = await syncCloudinaryRecordings();
      setSyncMessage(res.message || `Đã đồng bộ ${res.synced_count} bản ghi từ Cloudinary.`);
      await loadData();
    } catch (err) {
      console.error('[AdminVideoCalls] Sync error:', err);
      setSyncMessage(err.message || 'Lỗi khi đồng bộ bản ghi từ Cloudinary.');
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncMessage(null), 6000);
    }
  };

  return (
    <div className="w-full p-4 md:p-6 space-y-4">
      {/* 1. Minimal Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-200">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-700">
            <Video className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-base md:text-lg font-semibold tracking-tight text-neutral-900">
              Theo dõi cuộc gọi & Bản ghi Video Call (WF-04)
            </h1>
            <p className="text-xs text-neutral-500">
              Giám sát phiên gọi Kiosk, nhân viên lễ tân và kho lưu trữ video Cloudinary / Local
            </p>
          </div>
        </div>

        {/* Minimal Google-style Action Buttons */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            onClick={handleSyncCloudinary}
            disabled={isSyncing || isLoading}
            title="Đồng bộ các bản ghi cũ từ Cloudinary về hệ thống"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full text-sky-800 bg-sky-50 hover:bg-sky-100 border border-sky-200/80 transition-colors cursor-pointer disabled:opacity-50"
          >
            <Cloud className={`w-3.5 h-3.5 ${isSyncing ? 'animate-bounce text-sky-600' : ''}`} />
            <span>{isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ Cloudinary'}</span>
          </button>

          <button
            onClick={loadData}
            disabled={isLoading || isSyncing}
            title="Làm mới dữ liệu"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 border border-neutral-200 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Làm mới</span>
          </button>
        </div>
      </div>

      {/* Sync Status Notification Banner */}
      {syncMessage && (
        <div className="px-3.5 py-2 rounded-xl bg-sky-50 border border-sky-200/80 text-sky-800 text-xs flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-sky-600 shrink-0" />
            <span>{syncMessage}</span>
          </div>
          <button
            onClick={() => setSyncMessage(null)}
            className="p-1 rounded-full hover:bg-sky-100 text-sky-600 transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 2. Compact Metrics Bar (Google Cloud style) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {/* Total Calls */}
        <div className="px-4 py-2.5 rounded-xl bg-white border border-neutral-200/80 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium text-neutral-500">Tổng cuộc gọi</div>
            <div className="text-xl font-semibold text-neutral-900 mt-0.5">{metrics.total_calls}</div>
          </div>
          <span className="text-[10px] text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-full font-medium">
            Phiên đàm thoại
          </span>
        </div>

        {/* Ready Recordings */}
        <div className="px-4 py-2.5 rounded-xl bg-white border border-neutral-200/80 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium text-emerald-700">Có thể xem</div>
            <div className="text-xl font-semibold text-emerald-700 mt-0.5">{metrics.ready_recordings}</div>
          </div>
          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            Sẵn sàng
          </span>
        </div>

        {/* Saving Recordings */}
        <div className="px-4 py-2.5 rounded-xl bg-white border border-neutral-200/80 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium text-amber-700">Đang lưu ngầm</div>
            <div className="text-xl font-semibold text-amber-700 mt-0.5">{metrics.saving_recordings}</div>
          </div>
          <span className="inline-flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
            Xử lý
          </span>
        </div>

        {/* Failed Recordings */}
        <div className="px-4 py-2.5 rounded-xl bg-white border border-neutral-200/80 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium text-rose-700">Lưu thất bại</div>
            <div className="text-xl font-semibold text-rose-700 mt-0.5">{metrics.failed_recordings}</div>
          </div>
          <span className="inline-flex items-center gap-1 text-[10px] text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
            Lỗi
          </span>
        </div>
      </div>

      {/* 3. Google-style Streamlined Filter Toolbar */}
      <div className="p-2 rounded-xl bg-white border border-neutral-200/80 shadow-xs flex flex-wrap items-center gap-2">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            placeholder="Tìm theo mã phiên, phòng, tên khách, ticket..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-full bg-neutral-100/70 hover:bg-neutral-100 focus:bg-white border border-transparent focus:border-neutral-300 focus:outline-hidden transition-all text-neutral-800 placeholder:text-neutral-400"
          />
        </div>

        {/* Start Date */}
        <div className="flex items-center gap-1 px-2.5 py-1 text-xs text-neutral-600 bg-neutral-50 rounded-full border border-neutral-200/70">
          <Calendar className="w-3 h-3 text-neutral-400" />
          <span className="text-[11px] text-neutral-400">Từ:</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1); }}
            className="bg-transparent text-xs text-neutral-700 focus:outline-hidden cursor-pointer"
          />
        </div>

        {/* End Date */}
        <div className="flex items-center gap-1 px-2.5 py-1 text-xs text-neutral-600 bg-neutral-50 rounded-full border border-neutral-200/70">
          <span className="text-[11px] text-neutral-400">Đến:</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1); }}
            className="bg-transparent text-xs text-neutral-700 focus:outline-hidden cursor-pointer"
          />
        </div>

        {/* Status Select */}
        <div className="flex items-center gap-1 px-2.5 py-1 text-xs text-neutral-600 bg-neutral-50 rounded-full border border-neutral-200/70">
          <Filter className="w-3 h-3 text-neutral-400" />
          <select
            value={recordingStatusFilter}
            onChange={(e) => { setRecordingStatusFilter(e.target.value); setCurrentPage(1); }}
            className="bg-transparent text-xs text-neutral-700 focus:outline-hidden cursor-pointer pr-1"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="ready">Có thể xem</option>
            <option value="saving">Đang lưu</option>
            <option value="failed">Lưu thất bại</option>
            <option value="none">Không có bản ghi</option>
          </select>
        </div>

        {/* Reset filter button */}
        {(startDate || endDate || recordingStatusFilter !== 'all' || searchTerm) && (
          <button
            onClick={handleResetFilters}
            className="px-2.5 py-1 text-xs font-medium text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-full transition-colors cursor-pointer"
          >
            Xóa bộ lọc
          </button>
        )}
      </div>

      {/* 4. Table / List with Optimized Viewing Space */}
      <div className="bg-white rounded-xl border border-neutral-200/80 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-xs text-neutral-500 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-neutral-600" />
            <span>Đang tải danh sách lịch sử cuộc gọi...</span>
          </div>
        ) : error ? (
          <div className="py-16 text-center text-xs text-rose-600 flex flex-col items-center justify-center gap-2">
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
          </div>
        ) : paginatedSessions.length === 0 ? (
          <div className="py-16 text-center text-xs text-neutral-500 flex flex-col items-center justify-center gap-2">
            <FileVideo className="w-7 h-7 text-neutral-300" />
            <span>Không tìm thấy cuộc gọi hoặc bản ghi nào phù hợp với bộ lọc.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-neutral-50/70 border-b border-neutral-200/70 text-neutral-500 font-medium text-[11px] uppercase tracking-wider">
                  <th className="py-2.5 px-3.5">Mã phiên / Ticket</th>
                  <th className="py-2.5 px-3.5">Vị trí & Khách</th>
                  <th className="py-2.5 px-3.5">Thời điểm</th>
                  <th className="py-2.5 px-3.5">Thời lượng</th>
                  <th className="py-2.5 px-3.5">Cuộc gọi</th>
                  <th className="py-2.5 px-3.5">Trạng thái bản ghi</th>
                  <th className="py-2.5 px-3.5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {paginatedSessions.map((session) => {
                  const rStat = (session.recording_status || '').toLowerCase();
                  const hasUrl = Boolean(session.recording_url && session.recording_url.trim());

                  let statusBadge = (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] text-neutral-500 bg-neutral-100">
                      Không có bản ghi
                    </span>
                  );

                  if (rStat === 'saving') {
                    statusBadge = (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                        Đang lưu
                      </span>
                    );
                  } else if (rStat === 'failed') {
                    statusBadge = (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-50 text-rose-700">
                        <AlertCircle className="w-3 h-3" />
                        Lưu thất bại
                      </span>
                    );
                  } else if (hasUrl || rStat === 'ready') {
                    statusBadge = (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700">
                        <CheckCircle2 className="w-3 h-3" />
                        Có thể xem
                      </span>
                    );
                  }

                  return (
                    <tr key={session.id || session.session_code} className="hover:bg-neutral-50/70 transition-colors">
                      <td className="py-2.5 px-3.5 font-mono text-neutral-800">
                        <div className="font-semibold">{session.session_code || session.id}</div>
                        {session.linked_request_id && (
                          <div className="text-[10px] text-neutral-400 font-sans">
                            Ticket: <span className="font-mono">{session.linked_request_id}</span>
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3.5">
                        <div className="font-medium text-neutral-900">{session.room_number || 'Kiosk Sảnh'}</div>
                        <div className="text-[11px] text-neutral-500">{session.guest_name || 'Khách lưu trú'}</div>
                      </td>
                      <td className="py-2.5 px-3.5 text-neutral-500">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-neutral-400" />
                          <span>{session.created_at ? new Date(session.created_at).toLocaleString('vi-VN') : '—'}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3.5 font-medium text-neutral-800">
                        {typeof session.recording_duration === 'number' && session.recording_duration > 0
                          ? `${session.recording_duration}s`
                          : '—'}
                      </td>
                      <td className="py-2.5 px-3.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-neutral-100 text-neutral-700">
                          {session.status || 'Resolved'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3.5">
                        {statusBadge}
                      </td>
                      <td className="py-2.5 px-3.5 text-right">
                        {hasUrl ? (
                          <div className="inline-flex items-center justify-end gap-1">
                            {/* Minimal Google-style Play Button */}
                            <button
                              onClick={() => setPlayingVideo(session)}
                              title="Xem video bản ghi"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium text-neutral-800 bg-neutral-100 hover:bg-neutral-200 transition-colors cursor-pointer"
                            >
                              <Play className="w-3 h-3 fill-current text-neutral-700" />
                              <span>Xem</span>
                            </button>
                            {/* Minimal Ghost External Link Button */}
                            <a
                              href={session.recording_url}
                              target="_blank"
                              rel="noreferrer"
                              title="Mở tab mới"
                              className="p-1 rounded-full text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        ) : (
                          <span className="text-neutral-300 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Minimalist Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-2 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500">
            <div>
              Trang {currentPage} / {totalPages} (Tổng {filteredSessions.length} phiên)
            </div>
            <div className="flex items-center gap-1">
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 rounded-full text-xs text-neutral-600 hover:bg-neutral-100 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer transition-colors"
              >
                Trước
              </button>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1 rounded-full text-xs text-neutral-600 hover:bg-neutral-100 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer transition-colors"
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 5. Maximized Video Player Modal (Google Meet / YouTube Theater style) */}
      {playingVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-3 md:p-6 animate-fade-in">
          <div className="bg-neutral-900 text-white rounded-2xl max-w-4xl w-full max-h-[92vh] overflow-hidden shadow-2xl border border-neutral-800 flex flex-col">
            {/* Modal Header */}
            <div className="px-4 py-3 bg-neutral-950/80 border-b border-neutral-800 flex items-center justify-between">
              <div className="flex items-center gap-2 truncate pr-2">
                <Play className="w-3.5 h-3.5 text-emerald-400 fill-current shrink-0" />
                <span className="text-xs font-medium text-neutral-200 truncate">
                  {playingVideo.session_code || playingVideo.id} — {playingVideo.room_number || 'Kiosk'} ({playingVideo.guest_name || 'Khách'})
                </span>
              </div>
              <button
                onClick={() => setPlayingVideo(null)}
                title="Đóng xem video"
                className="p-1 rounded-full hover:bg-white/10 text-neutral-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Maximized Video Display */}
            <div className="bg-black flex-1 flex items-center justify-center relative aspect-video max-h-[70vh]">
              <video
                src={playingVideo.recording_url}
                controls
                autoPlay
                className="w-full h-full max-h-[70vh] object-contain"
              >
                Trình duyệt không hỗ trợ phát video WebM/MP4.
              </video>
            </div>

            {/* Modal Footer with Direct Source */}
            <div className="px-4 py-2.5 bg-neutral-950 border-t border-neutral-800 text-xs text-neutral-400 flex items-center justify-between">
              <div className="truncate max-w-[70%] text-[11px]">
                <span className="text-neutral-500">Nguồn:</span> {playingVideo.recording_url}
              </div>
              <a
                href={playingVideo.recording_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-neutral-200 hover:text-white hover:underline transition-colors shrink-0"
              >
                <span>Mở file gốc</span>
                <ExternalLink className="w-3 h-3 text-neutral-400" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
