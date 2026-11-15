import React, { useState, useEffect, useMemo } from 'react';
import {
  Video,
  Calendar,
  Filter,
  CheckCircle2,
  X,
  RefreshCw,
  Search,
  Cloud,
} from 'lucide-react';
import {
  fetchHumanSupportSessions,
  fetchVideoCallMetrics,
  syncCloudinaryRecordings,
} from '../../../services/conciergeApi';
import { Pagination } from '../../../components/common/Pagination';
import { useLanguage } from '../../../context/LanguageContext';
import { AdminVideoCallsMetrics, AdminVideoCallsTable, AdminVideoPlayerModal } from './AdminVideoCallsParts';

export const AdminVideoCallsTab = ({ currentUser }) => {
  const { language } = useLanguage();
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

  // Pagination (synced with URL query params like Department & Account tabs)
  const [currentPage, setCurrentPage] = useState(() => {
    try {
      const p = parseInt(new URLSearchParams(window.location.search).get('page'), 10);
      return !isNaN(p) && p > 0 ? p : 1;
    } catch {
      return 1;
    }
  });
  const pageSize = 10;

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
    try {
      const params = new URLSearchParams(window.location.search);
      params.set('tab', 'Video Calls');
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
  const paginatedSessions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredSessions.slice(start, start + pageSize);
  }, [filteredSessions, currentPage]);

  const handleResetFilters = () => {
    setStartDate('');
    setEndDate('');
    setRecordingStatusFilter('all');
    setSearchTerm('');
    handlePageChange(1);
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
      <AdminVideoCallsMetrics
        metrics={metrics}
        recordingStatusFilter={recordingStatusFilter}
        onSelectFilter={(status) => { setRecordingStatusFilter(status); handlePageChange(1); }}
      />

      {/* 3. Google-style Streamlined Filter Toolbar */}
      <div className="p-2 rounded-xl bg-white border border-neutral-200/80 shadow-xs flex flex-wrap items-center gap-2">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); handlePageChange(1); }}
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
            onChange={(e) => { setStartDate(e.target.value); handlePageChange(1); }}
            className="bg-transparent text-xs text-neutral-700 focus:outline-hidden cursor-pointer"
          />
        </div>

        {/* End Date */}
        <div className="flex items-center gap-1 px-2.5 py-1 text-xs text-neutral-600 bg-neutral-50 rounded-full border border-neutral-200/70">
          <span className="text-[11px] text-neutral-400">Đến:</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); handlePageChange(1); }}
            className="bg-transparent text-xs text-neutral-700 focus:outline-hidden cursor-pointer"
          />
        </div>

        {/* Status Select */}
        <div className="flex items-center gap-1 px-2.5 py-1 text-xs text-neutral-600 bg-neutral-50 rounded-full border border-neutral-200/70">
          <Filter className="w-3 h-3 text-neutral-400" />
          <select
            value={recordingStatusFilter}
            onChange={(e) => { setRecordingStatusFilter(e.target.value); handlePageChange(1); }}
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
        <AdminVideoCallsTable
          isLoading={isLoading}
          error={error}
          paginatedSessions={paginatedSessions}
          onRetryLoad={loadData}
          getEffectiveRecordingStatus={getEffectiveRecordingStatus}
          handleOpenVideoPlayer={handleOpenVideoPlayer}
          handleSyncCloudinary={handleSyncCloudinary}
          isSyncing={isSyncing}
        />

        {/* Pagination Footer */}
        <Pagination
          currentPage={currentPage}
          totalItems={filteredSessions.length}
          pageSize={pageSize}
          onPageChange={handlePageChange}
          itemName={language === 'EN' ? 'sessions' : 'phiên'}
        />
      </div>

      {/* 5. Maximized Video Player Modal with Automatic Fallback & Exception Recovery */}
      <AdminVideoPlayerModal
        playingVideo={playingVideo}
        detectedDuration={detectedDuration}
        useMp4Fallback={useMp4Fallback}
        setUseMp4Fallback={setUseMp4Fallback}
        setVideoError={setVideoError}
        setIsVideoLoading={setIsVideoLoading}
        onClose={() => {
          setPlayingVideo(null);
          setVideoError(false);
          setIsVideoLoading(false);
        }}
        isVideoLoading={isVideoLoading}
        videoError={videoError}
        videoErrorDetail={videoErrorDetail}
        retryCount={retryCount}
        setRetryCount={setRetryCount}
        getActivePlaybackUrl={getActivePlaybackUrl}
        setDetectedDuration={setDetectedDuration}
        handleVideoElementError={handleVideoElementError}
        handleCopyVideoUrl={handleCopyVideoUrl}
        copiedUrl={copiedUrl}
      />
    </div>
  );
};
