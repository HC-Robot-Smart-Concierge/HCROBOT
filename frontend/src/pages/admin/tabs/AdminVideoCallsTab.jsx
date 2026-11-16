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
  Copy,
  Check,
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

  // Video Player Modal & Alternative / Exception Flow State
  const [playingVideo, setPlayingVideo] = useState(null);
  const [videoError, setVideoError] = useState(false);
  const [videoErrorDetail, setVideoErrorDetail] = useState('');
  const [isVideoLoading, setIsVideoLoading] = useState(false);
  const [useMp4Fallback, setUseMp4Fallback] = useState(false);
  const [autoRetriedMp4, setAutoRetriedMp4] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [detectedDuration, setDetectedDuration] = useState(null);

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
      setError('Không thể tải danh sách cuộc gọi. Vui lòng kiểm tra kết nối máy chủ và thử lại.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [startDate, endDate]);

  // Helper: xác định trạng thái bản ghi thực tế của từng phiên
  const getEffectiveRecordingStatus = (session) => {
    const rStat = (session?.recording_status || '').toLowerCase();
    const hasUrl = Boolean(session?.recording_url && session.recording_url.trim());
    if (rStat === 'saving') return 'saving';
    if (rStat === 'failed') return 'failed';
    if (hasUrl) return 'ready';
    return 'none';
  };

  // Client-side filtering & smart sorting (ưu tiên các phiên có bản ghi video lên trang đầu)
  const filteredSessions = useMemo(() => {
    const matched = sessions.filter((session) => {
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
      const effectiveStatus = getEffectiveRecordingStatus(session);
      if (recordingStatusFilter !== 'all' && effectiveStatus !== recordingStatusFilter) {
        return false;
      }

      // 3. Search Term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const codeMatch = (session.session_code || '').toLowerCase().includes(term);
        const robotMatch = (session.origin_robot_code || '').toLowerCase().includes(term);
        const ticketMatch = (session.linked_request_id || '').toLowerCase().includes(term);
        if (!codeMatch && !robotMatch && !ticketMatch) return false;
      }

      return true;
    });

    // Sắp xếp ưu tiên: Các phiên có bản ghi ('ready', 'saving', 'failed') hiển thị trước, sau đó theo thời gian mới nhất
    const priorityWeight = { ready: 3, saving: 2, failed: 1, none: 0 };
    return [...matched].sort((a, b) => {
      const pA = priorityWeight[getEffectiveRecordingStatus(a)] ?? 0;
      const pB = priorityWeight[getEffectiveRecordingStatus(b)] ?? 0;
      if (pA !== pB) return pB - pA;
      const tA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return tB - tA;
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

  // Mở trình phát video với cơ chế tự động chọn định dạng tối ưu
  const handleOpenVideoPlayer = (session) => {
    const rawUrl = (session?.recording_url || '').trim();
    const isCloudinaryWebm = rawUrl.includes('res.cloudinary.com') && /\.webm(\?.*)?$/i.test(rawUrl);
    setPlayingVideo(session);
    setVideoError(false);
    setVideoErrorDetail('');
    setIsVideoLoading(true);
    // Tự động ưu tiên luồng MP4 (H.264) cho video WebM trên Cloudinary để hỗ trợ tua (seeking) và tương thích mọi trình duyệt
    setUseMp4Fallback(isCloudinaryWebm);
    setAutoRetriedMp4(false);
    setRetryCount(0);
    setCopiedUrl(false);
    setDetectedDuration(session?.recording_duration > 0 ? session.recording_duration : null);
  };

  // Tính toán URL phát thực tế (hỗ trợ chuyển đổi MP4 trên Cloudinary & retry cache-bust)
  const getActivePlaybackUrl = () => {
    if (!playingVideo || !playingVideo.recording_url) return '';
    let url = playingVideo.recording_url.trim();
    if (useMp4Fallback && url.includes('res.cloudinary.com') && /\.webm(\?.*)?$/i.test(url)) {
      url = url.replace(/\.webm(\?.*)?$/i, '.mp4$1');
    }
    if (retryCount > 0) {
      const sep = url.includes('?') ? '&' : '?';
      url = `${url}${sep}_retry=${retryCount}`;
    }
    return url;
  };

  // Xử lý ngoại lệ khi thẻ <video> gặp lỗi giải mã hoặc lỗi mạng (Alternative Flow tự động)
  const handleVideoElementError = (e) => {
    const rawUrl = (playingVideo?.recording_url || '').trim();
    const canSwitchFormat = rawUrl.includes('res.cloudinary.com') && /\.webm(\?.*)?$/i.test(rawUrl);

    // Alternative Flow 1: Tự động chuyển đổi giữa MP4 và WebM gốc nếu lần thử đầu bị lỗi
    if (canSwitchFormat && !autoRetriedMp4) {
      setAutoRetriedMp4(true);
      setUseMp4Fallback((prev) => !prev);
      setIsVideoLoading(true);
      setVideoError(false);
      return;
    }

    // Alternative Flow 2: Hiển thị bảng chẩn đoán lỗi kèm các thao tác khôi phục
    setIsVideoLoading(false);
    setVideoError(true);
    const mediaErrCode = e?.currentTarget?.error?.code;
    if (mediaErrCode === 1) {
      setVideoErrorDetail('Quá trình tải video bị hủy bởi người dùng.');
    } else if (mediaErrCode === 2) {
      setVideoErrorDetail('Lỗi kết nối mạng trong khi đang tải luồng video từ máy chủ lưu trữ.');
    } else if (mediaErrCode === 3) {
      setVideoErrorDetail('Lỗi giải mã khung hình (codec WebM/VP8 không tương thích với phần cứng trình duyệt).');
    } else if (mediaErrCode === 4) {
      setVideoErrorDetail('Không tìm thấy file bản ghi trên máy chủ (HTTP 404) hoặc định dạng nguồn không được hỗ trợ.');
    } else {
      setVideoErrorDetail('Không thể tải hoặc giải mã luồng video trực tiếp trên trình duyệt.');
    }
  };

  const handleCopyVideoUrl = async () => {
    if (!playingVideo?.recording_url) return;
    try {
      await navigator.clipboard.writeText(playingVideo.recording_url);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2500);
    } catch {
      setCopiedUrl(false);
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
              Video Calls & Call Recordings (WF-04)
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

      {/* 2. Compact Interactive Metrics Bar (Click để lọc nhanh) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {/* Total Calls */}
        <div
          onClick={() => { setRecordingStatusFilter('all'); setCurrentPage(1); }}
          className={`px-4 py-2.5 rounded-xl bg-white border shadow-xs flex items-center justify-between cursor-pointer transition-all ${
            recordingStatusFilter === 'all' ? 'border-neutral-400 ring-1 ring-neutral-300' : 'border-neutral-200/80 hover:border-neutral-300'
          }`}
        >
          <div>
            <div className="text-[11px] font-medium text-neutral-500">Tổng cuộc gọi</div>
            <div className="text-xl font-semibold text-neutral-900 mt-0.5">{metrics.total_calls}</div>
          </div>
          <span className="text-[10px] text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-full font-medium">
            Phiên đàm thoại
          </span>
        </div>

        {/* Ready Recordings */}
        <div
          onClick={() => { setRecordingStatusFilter('ready'); setCurrentPage(1); }}
          className={`px-4 py-2.5 rounded-xl bg-white border shadow-xs flex items-center justify-between cursor-pointer transition-all ${
            recordingStatusFilter === 'ready' ? 'border-emerald-500 ring-1 ring-emerald-200' : 'border-neutral-200/80 hover:border-emerald-300'
          }`}
        >
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
        <div
          onClick={() => { setRecordingStatusFilter('saving'); setCurrentPage(1); }}
          className={`px-4 py-2.5 rounded-xl bg-white border shadow-xs flex items-center justify-between cursor-pointer transition-all ${
            recordingStatusFilter === 'saving' ? 'border-amber-500 ring-1 ring-amber-200' : 'border-neutral-200/80 hover:border-amber-300'
          }`}
        >
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
        <div
          onClick={() => { setRecordingStatusFilter('failed'); setCurrentPage(1); }}
          className={`px-4 py-2.5 rounded-xl bg-white border shadow-xs flex items-center justify-between cursor-pointer transition-all ${
            recordingStatusFilter === 'failed' ? 'border-rose-500 ring-1 ring-rose-200' : 'border-neutral-200/80 hover:border-rose-300'
          }`}
        >
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
            placeholder="Tìm theo mã phiên, thiết bị robot, ticket..."
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
          <div className="py-16 text-center text-xs text-rose-600 flex flex-col items-center justify-center gap-3">
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
            <button
              onClick={loadData}
              className="px-3 py-1.5 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-700 font-medium text-xs transition-colors cursor-pointer"
            >
              Thử tải lại
            </button>
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
                  <th className="py-2.5 px-3.5">Kênh gọi & Thiết bị</th>
                  <th className="py-2.5 px-3.5">Thời điểm</th>
                  <th className="py-2.5 px-3.5">Thời lượng</th>
                  <th className="py-2.5 px-3.5">Cuộc gọi</th>
                  <th className="py-2.5 px-3.5">Trạng thái bản ghi</th>
                  <th className="py-2.5 px-3.5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {paginatedSessions.map((session) => {
                  const effectiveStatus = getEffectiveRecordingStatus(session);
                  const hasUrl = effectiveStatus === 'ready';

                  let statusBadge = (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] text-neutral-500 bg-neutral-100">
                      Không có bản ghi
                    </span>
                  );

                  if (effectiveStatus === 'saving') {
                    statusBadge = (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                        Đang lưu
                      </span>
                    );
                  } else if (effectiveStatus === 'failed') {
                    statusBadge = (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-50 text-rose-700">
                        <AlertCircle className="w-3 h-3" />
                        Lưu thất bại
                      </span>
                    );
                  } else if (effectiveStatus === 'ready') {
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
                        <div className="font-medium text-neutral-900">Robot Kiosk ⇄ Lễ tân</div>
                        <div className="text-[11px] text-neutral-500 font-mono">{session.origin_robot_code || 'RC-001 (Main Lobby)'}</div>
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
                          : hasUrl
                            ? 'Bản ghi Cloud'
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
                              onClick={() => handleOpenVideoPlayer(session)}
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
                        ) : effectiveStatus === 'failed' ? (
                          <button
                            onClick={handleSyncCloudinary}
                            disabled={isSyncing}
                            title="Đồng bộ lại từ Cloudinary"
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 transition-colors cursor-pointer"
                          >
                            <RefreshCw className="w-3 h-3" />
                            <span>Khôi phục</span>
                          </button>
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

      {/* 5. Maximized Video Player Modal with Automatic Fallback & Exception Recovery */}
      {playingVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-3 md:p-6 animate-fade-in">
          <div className="bg-neutral-900 text-white rounded-2xl max-w-4xl w-full max-h-[92vh] overflow-hidden shadow-2xl border border-neutral-800 flex flex-col">
            {/* Modal Header */}
            <div className="px-4 py-3 bg-neutral-950/80 border-b border-neutral-800 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 truncate pr-2">
                <Play className="w-3.5 h-3.5 text-emerald-400 fill-current shrink-0" />
                <span className="text-xs font-medium text-neutral-200 truncate">
                  {playingVideo.session_code || playingVideo.id} — Robot Kiosk ⇄ Nhân viên lễ tân
                </span>
                {detectedDuration ? (
                  <span className="px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300 text-[10px] font-mono shrink-0">
                    {Math.round(detectedDuration)}s
                  </span>
                ) : null}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {/* Format Toggle Button for Cloudinary Videos */}
                {(playingVideo.recording_url || '').includes('res.cloudinary.com') && (
                  <button
                    onClick={() => {
                      setUseMp4Fallback((prev) => !prev);
                      setVideoError(false);
                      setIsVideoLoading(true);
                    }}
                    title="Chuyển đổi định dạng phát MP4 (H.264) / WebM gốc"
                    className="px-2.5 py-1 rounded-full bg-neutral-800 hover:bg-neutral-700 text-[11px] text-neutral-200 transition-colors cursor-pointer"
                  >
                    {useMp4Fallback ? 'Định dạng: MP4 (Tương thích)' : 'Định dạng: WebM (Gốc)'}
                  </button>
                )}

                <button
                  onClick={() => {
                    setPlayingVideo(null);
                    setVideoError(false);
                    setIsVideoLoading(false);
                  }}
                  title="Đóng xem video"
                  className="p-1 rounded-full hover:bg-white/10 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Maximized Video Display */}
            <div className="bg-black flex-1 flex items-center justify-center relative aspect-video max-h-[70vh]">
              {isVideoLoading && !videoError && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-black/50 pointer-events-none">
                  <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
                  <span className="text-xs text-neutral-300">Đang nạp luồng video...</span>
                </div>
              )}

              {videoError ? (
                <div className="p-6 text-center text-xs text-neutral-300 flex flex-col items-center justify-center gap-3 max-w-lg">
                  <AlertCircle className="w-8 h-8 text-amber-400" />
                  <div>
                    <p className="font-semibold text-white text-sm">
                      Không thể phát trực tiếp bản ghi video này
                    </p>
                    <p className="text-[11px] text-neutral-400 mt-1">
                      {videoErrorDetail || 'Video có thể sử dụng codec chưa tương thích hoặc đường truyền tới kho lưu trữ bị gián đoạn.'}
                    </p>
                  </div>

                  {/* Alternative Flows Action Bar */}
                  <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
                    {(playingVideo.recording_url || '').includes('res.cloudinary.com') && (
                      <button
                        onClick={() => {
                          setUseMp4Fallback((prev) => !prev);
                          setVideoError(false);
                          setIsVideoLoading(true);
                        }}
                        className="px-3 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs cursor-pointer transition-colors"
                      >
                        {useMp4Fallback ? 'Thử phát luồng WebM gốc' : 'Chuyển sang định dạng MP4'}
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setRetryCount((c) => c + 1);
                        setVideoError(false);
                        setIsVideoLoading(true);
                      }}
                      className="px-3 py-1.5 rounded-full bg-neutral-800 hover:bg-neutral-700 text-white font-medium text-xs inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Thử tải lại</span>
                    </button>

                    <a
                      href={playingVideo.recording_url}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 rounded-full bg-neutral-800 hover:bg-neutral-700 text-white font-medium text-xs inline-flex items-center gap-1.5 transition-colors"
                    >
                      <span>Mở file gốc trên tab mới</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              ) : (
                <video
                  key={`${playingVideo.recording_url}-${useMp4Fallback}-${retryCount}`}
                  src={getActivePlaybackUrl()}
                  controls
                  autoPlay
                  playsInline
                  preload="metadata"
                  onLoadStart={() => setIsVideoLoading(true)}
                  onLoadedMetadata={(e) => {
                    const dur = e?.currentTarget?.duration;
                    if (dur && Number.isFinite(dur) && dur > 0) {
                      setDetectedDuration(Math.round(dur));
                    }
                  }}
                  onCanPlay={() => setIsVideoLoading(false)}
                  onPlaying={() => setIsVideoLoading(false)}
                  onError={handleVideoElementError}
                  className="w-full h-full max-h-[70vh] object-contain"
                >
                  Trình duyệt không hỗ trợ phát video WebM/MP4.
                </video>
              )}
            </div>

            {/* Modal Footer with Direct Source & Copy Action */}
            <div className="px-4 py-2.5 bg-neutral-950 border-t border-neutral-800 text-xs text-neutral-400 flex items-center justify-between gap-2">
              <div className="truncate max-w-[65%] text-[11px]">
                <span className="text-neutral-500">Nguồn:</span> {playingVideo.recording_url}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <button
                  onClick={handleCopyVideoUrl}
                  className="inline-flex items-center gap-1 text-xs text-neutral-300 hover:text-white transition-colors cursor-pointer"
                >
                  {copiedUrl ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-neutral-400" />}
                  <span>{copiedUrl ? 'Đã sao chép' : 'Sao chép link'}</span>
                </button>
                <a
                  href={playingVideo.recording_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-neutral-200 hover:text-white hover:underline transition-colors"
                >
                  <span>Mở file gốc</span>
                  <ExternalLink className="w-3 h-3 text-neutral-400" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
