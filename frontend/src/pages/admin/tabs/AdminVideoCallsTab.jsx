import React, { useState, useEffect, useMemo } from 'react';
import {
  Video,
  Play,
  ExternalLink,
  Clock,
  Disc,
  Cloud,
  Calendar,
  Filter,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  FileVideo,
  RefreshCw,
  Search,
  Maximize2
} from 'lucide-react';
import { fetchHumanSupportSessions, fetchVideoCallMetrics } from '../../../services/conciergeApi';

export const AdminVideoCallsTab = ({ currentUser }) => {
  const [sessions, setSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
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
        fetchHumanSupportSessions(null, 200, 0),
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

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* 1. Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-palette-silver">
        <div>
          <div className="flex items-center gap-2">
            <Video className="w-6 h-6 text-palette-charcoal" />
            <h1 className="text-xl font-bold tracking-tight text-palette-charcoal">
              Theo dõi cuộc gọi & Bản ghi Video Call (WF-04)
            </h1>
          </div>
          <p className="text-xs text-palette-slate mt-1">
            Giám sát toàn bộ các phiên hỗ trợ khẩn cấp, bàn giao Kiosk sang nhân viên lễ tân và kho lưu trữ video Cloudinary / Local.
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={isLoading}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-white border border-palette-silver hover:bg-neutral-50 text-palette-charcoal shadow-xs transition-all cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Làm mới
        </button>
      </div>

      {/* 2. Basic Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Calls */}
        <div className="p-4 rounded-xl bg-white border border-palette-silver shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-palette-slate uppercase tracking-wider">Tổng cuộc gọi</div>
            <div className="text-2xl font-bold text-palette-charcoal mt-1">{metrics.total_calls}</div>
            <div className="text-[10px] text-palette-slate mt-0.5">Phiên đàm thoại duy nhất</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-neutral-100 flex items-center justify-center text-palette-charcoal">
            <Disc className="w-5 h-5 text-palette-charcoal" />
          </div>
        </div>

        {/* Ready Recordings */}
        <div className="p-4 rounded-xl bg-white border border-palette-silver shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">Có thể xem</div>
            <div className="text-2xl font-bold text-emerald-700 mt-1">{metrics.ready_recordings}</div>
            <div className="text-[10px] text-palette-slate mt-0.5">Sẵn sàng phát video</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-700">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        {/* Saving Recordings */}
        <div className="p-4 rounded-xl bg-white border border-palette-silver shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider">Đang lưu ngầm</div>
            <div className="text-2xl font-bold text-amber-700 mt-1">{metrics.saving_recordings}</div>
            <div className="text-[10px] text-palette-slate mt-0.5">Background upload</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center text-amber-700">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        </div>

        {/* Failed Recordings */}
        <div className="p-4 rounded-xl bg-white border border-palette-silver shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-rose-700 uppercase tracking-wider">Lưu thất bại</div>
            <div className="text-2xl font-bold text-rose-700 mt-1">{metrics.failed_recordings}</div>
            <div className="text-[10px] text-palette-slate mt-0.5">Lỗi hoặc quá hạn</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-rose-50 flex items-center justify-center text-rose-700">
            <AlertCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 3. Filter Bar */}
      <div className="p-4 rounded-xl bg-white border border-palette-silver shadow-xs space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search box */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-palette-slate absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              placeholder="Tìm mã phiên, số phòng, tên khách, mã ticket..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-palette-silver focus:outline-hidden focus:ring-1 focus:ring-palette-charcoal bg-neutral-50"
            />
          </div>

          {/* Start Date */}
          <div className="flex items-center gap-1.5 text-xs text-palette-slate">
            <Calendar className="w-3.5 h-3.5 text-palette-slate" />
            <span>Từ:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1); }}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-palette-silver bg-neutral-50 focus:outline-hidden focus:ring-1 focus:ring-palette-charcoal"
            />
          </div>

          {/* End Date */}
          <div className="flex items-center gap-1.5 text-xs text-palette-slate">
            <span>Đến:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1); }}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-palette-silver bg-neutral-50 focus:outline-hidden focus:ring-1 focus:ring-palette-charcoal"
            />
          </div>

          {/* Status Select */}
          <div className="flex items-center gap-1.5 text-xs text-palette-slate">
            <Filter className="w-3.5 h-3.5 text-palette-slate" />
            <span>Bản ghi:</span>
            <select
              value={recordingStatusFilter}
              onChange={(e) => { setRecordingStatusFilter(e.target.value); setCurrentPage(1); }}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-palette-silver bg-neutral-50 focus:outline-hidden focus:ring-1 focus:ring-palette-charcoal"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="ready">Có thể xem</option>
              <option value="saving">Đang lưu</option>
              <option value="failed">Lưu thất bại</option>
              <option value="none">Không có bản ghi</option>
            </select>
          </div>

          {(startDate || endDate || recordingStatusFilter !== 'all' || searchTerm) && (
            <button
              onClick={handleResetFilters}
              className="px-3 py-1.5 text-xs font-medium text-palette-slate hover:text-palette-charcoal underline cursor-pointer"
            >
              Xóa bộ lọc
            </button>
          )}
        </div>

        {/* Filter Summary Label */}
        <div className="text-[11px] text-palette-slate flex items-center justify-between border-t border-neutral-100 pt-2">
          <div>
            Đang hiển thị <strong>{filteredSessions.length}</strong> phiên phù hợp
            {startDate && ` từ ngày ${startDate}`}
            {endDate && ` đến ngày ${endDate}`}
          </div>
          <div>Sắp xếp: Mới nhất trước</div>
        </div>
      </div>

      {/* 4. Table */}
      <div className="bg-white rounded-xl border border-palette-silver shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-xs text-palette-slate flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-palette-charcoal" />
            <span>Đang tải danh sách lịch sử cuộc gọi...</span>
          </div>
        ) : error ? (
          <div className="py-16 text-center text-xs text-rose-600 flex flex-col items-center justify-center gap-2">
            <AlertCircle className="w-6 h-6" />
            <span>{error}</span>
          </div>
        ) : paginatedSessions.length === 0 ? (
          <div className="py-16 text-center text-xs text-palette-slate flex flex-col items-center justify-center gap-2">
            <FileVideo className="w-8 h-8 text-neutral-300" />
            <span>Không tìm thấy cuộc gọi hoặc bản ghi nào phù hợp với bộ lọc.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-neutral-50/80 border-b border-palette-silver text-palette-slate font-semibold uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4">Mã phiên / Ticket</th>
                  <th className="py-3 px-4">Vị trí & Khách</th>
                  <th className="py-3 px-4">Thời điểm</th>
                  <th className="py-3 px-4">Thời lượng</th>
                  <th className="py-3 px-4">Cuộc gọi</th>
                  <th className="py-3 px-4">Trạng thái bản ghi</th>
                  <th className="py-3 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {paginatedSessions.map((session) => {
                  const rStat = (session.recording_status || '').toLowerCase();
                  const hasUrl = Boolean(session.recording_url && session.recording_url.trim());

                  let statusBadge = (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-neutral-100 text-neutral-600">
                      Không có bản ghi
                    </span>
                  );

                  if (rStat === 'saving') {
                    statusBadge = (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                        Đang lưu
                      </span>
                    );
                  } else if (rStat === 'failed') {
                    statusBadge = (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200">
                        <AlertCircle className="w-3 h-3" />
                        Lưu thất bại
                      </span>
                    );
                  } else if (hasUrl || rStat === 'ready') {
                    statusBadge = (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3" />
                        Có thể xem
                      </span>
                    );
                  }

                  return (
                    <tr key={session.id || session.session_code} className="hover:bg-neutral-50/60 transition-colors">
                      <td className="py-3 px-4 font-mono font-medium text-palette-charcoal">
                        <div>{session.session_code || session.id}</div>
                        {session.linked_request_id && (
                          <div className="text-[10px] text-palette-slate font-sans">
                            Ticket: <span className="font-mono">{session.linked_request_id}</span>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-palette-charcoal">{session.room_number || 'Kiosk Sảnh'}</div>
                        <div className="text-[11px] text-palette-slate">{session.guest_name || 'Khách lưu trú'}</div>
                      </td>
                      <td className="py-3 px-4 text-palette-slate">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{session.created_at ? new Date(session.created_at).toLocaleString('vi-VN') : '—'}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-semibold text-palette-charcoal">
                        {typeof session.recording_duration === 'number' && session.recording_duration > 0
                          ? `${session.recording_duration}s`
                          : '—'}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-neutral-100 text-palette-charcoal">
                          {session.status || 'Resolved'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {statusBadge}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {hasUrl ? (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              onClick={() => setPlayingVideo(session)}
                              className="px-2.5 py-1 rounded-md bg-palette-charcoal hover:bg-neutral-800 text-white text-xs font-semibold inline-flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                            >
                              <Play className="w-3 h-3 fill-current" />
                              Xem
                            </button>
                            <a
                              href={session.recording_url}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1 rounded-md border border-palette-silver hover:bg-neutral-100 text-palette-slate hover:text-palette-charcoal transition-all"
                              title="Mở tab mới"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        ) : (
                          <span className="text-neutral-400 text-xs italic">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-3 border-t border-neutral-100 flex items-center justify-between text-xs text-palette-slate">
            <div>
              Trang {currentPage} / {totalPages}
            </div>
            <div className="flex items-center gap-1">
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 rounded border border-palette-silver disabled:opacity-40 hover:bg-neutral-50 cursor-pointer"
              >
                Trước
              </button>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1 rounded border border-palette-silver disabled:opacity-40 hover:bg-neutral-50 cursor-pointer"
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 5. Video Player Modal */}
      {playingVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-3xl w-full overflow-hidden shadow-2xl border border-palette-silver flex flex-col">
            <div className="px-5 py-3.5 bg-palette-charcoal text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Play className="w-4 h-4 text-emerald-400 fill-current" />
                <span className="text-xs font-bold">
                  Bản ghi cuộc gọi — {playingVideo.session_code || playingVideo.id} ({playingVideo.room_number})
                </span>
              </div>
              <button
                onClick={() => setPlayingVideo(null)}
                className="p-1 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-black aspect-video flex items-center justify-center relative">
              <video
                src={playingVideo.recording_url}
                controls
                autoPlay
                className="w-full h-full object-contain"
              >
                Trình duyệt không hỗ trợ phát video WebM/MP4.
              </video>
            </div>

            <div className="p-4 bg-neutral-50 text-xs text-palette-slate flex items-center justify-between border-t border-neutral-200">
              <div className="truncate max-w-[80%]">
                <span className="font-semibold text-palette-charcoal">Nguồn phát:</span> {playingVideo.recording_url}
              </div>
              <a
                href={playingVideo.recording_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-sky-700 hover:underline font-semibold"
              >
                Mở file gốc <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
