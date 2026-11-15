import React from 'react';
import {
  Play,
  ExternalLink,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  FileVideo,
  RefreshCw,
  Copy,
  Check,
} from 'lucide-react';

export const AdminVideoCallsMetrics = ({
  metrics,
  recordingStatusFilter,
  onSelectFilter,
}) => (
  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
    <div
      onClick={() => onSelectFilter('all')}
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

    <div
      onClick={() => onSelectFilter('ready')}
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

    <div
      onClick={() => onSelectFilter('saving')}
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

    <div
      onClick={() => onSelectFilter('failed')}
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
);

export const AdminVideoCallsTable = ({
  isLoading,
  error,
  paginatedSessions,
  onRetryLoad,
  getEffectiveRecordingStatus,
  handleOpenVideoPlayer,
  handleSyncCloudinary,
  isSyncing,
}) => {
  if (isLoading) {
    return (
      <div className="py-16 text-center text-xs text-neutral-500 flex flex-col items-center justify-center gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-neutral-600" />
        <span>Đang tải danh sách lịch sử cuộc gọi...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-16 text-center text-xs text-rose-600 flex flex-col items-center justify-center gap-3">
        <AlertCircle className="w-5 h-5" />
        <span>{error}</span>
        <button
          onClick={onRetryLoad}
          className="px-3 py-1.5 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-700 font-medium text-xs transition-colors cursor-pointer"
        >
          Thử tải lại
        </button>
      </div>
    );
  }

  if (paginatedSessions.length === 0) {
    return (
      <div className="py-16 text-center text-xs text-neutral-500 flex flex-col items-center justify-center gap-2">
        <FileVideo className="w-7 h-7 text-neutral-300" />
        <span>Không tìm thấy cuộc gọi hoặc bản ghi nào phù hợp với bộ lọc.</span>
      </div>
    );
  }

  return (
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
                      <button
                        onClick={() => handleOpenVideoPlayer(session)}
                        title="Xem video bản ghi"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium text-neutral-800 bg-neutral-100 hover:bg-neutral-200 transition-colors cursor-pointer"
                      >
                        <Play className="w-3 h-3 fill-current text-neutral-700" />
                        <span>Xem</span>
                      </button>
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
  );
};

export const AdminVideoPlayerModal = ({
  playingVideo,
  detectedDuration,
  useMp4Fallback,
  setUseMp4Fallback,
  setVideoError,
  setIsVideoLoading,
  onClose,
  isVideoLoading,
  videoError,
  videoErrorDetail,
  retryCount,
  setRetryCount,
  getActivePlaybackUrl,
  setDetectedDuration,
  handleVideoElementError,
  handleCopyVideoUrl,
  copiedUrl,
}) => {
  if (!playingVideo) return null;

  return (
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
              onClick={onClose}
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
  );
};
