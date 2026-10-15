import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  CheckCircle2,
  Clock,
  User,
  MapPin,
  RefreshCw,
  ArrowLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { Pagination } from '../../components/common/Pagination';
import {
  fetchReceptionDashboard,
  updateReceptionRequest,
} from '../../services/operationsApi';

const normalizeRequest = (request = {}) => ({
  ...request,
  ticketCode: request.ticket_code || request.ticketCode || request.id || 'REC-00000',
  title: request.title || 'Yêu cầu Lễ tân & Đặt phòng',
  createdLabel:
    request.created_label ||
    request.createdLabel ||
    (request.created_at ? new Date(request.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Vừa xong'),
  location: request.room_number || request.location || 'Lobby Desk',
  locationDetails: request.location_details || request.locationDetails || { floor: 'Lobby', category: 'Standard Room' },
  guestName: request.guest_name || request.guestName || 'Khách lưu trú',
  guestTier: request.guest_tier || request.guestTier || 'Standard',
  guestStayDetails: request.guest_stay_details || request.guestStayDetails || 'Khách lưu trú tại khách sạn',
  description: request.description || 'Không có mô tả chi tiết.',
  attachedMedia: request.attached_media || request.attachedMedia || [],
  transcript: request.transcript || [],
  assistanceStatus: request.assistance_status || request.assistanceStatus || 'Connected',
  assignedTo: request.assigned_to || request.assignedTo || request.assigned_staff_name || '',
  assignedRole: request.assigned_role || request.assignedRole || 'Lễ tân trực ca',
  activityLog: request.activity_log || request.activityLog || [],
  status: request.status || 'Pending',
});

export const ReceptionDashboard = ({ currentUser, onNotify = () => {}, onNavigate }) => {
  const staffName = currentUser?.full_name || currentUser?.name || 'Nhân viên Lễ tân';

  const [activeRequest, setActiveRequest] = useState(null);
  const [recentRequests, setRecentRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isViewingHistory, setIsViewingHistory] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetchReceptionDashboard();
      if (response && response.current_request) {
        setActiveRequest(normalizeRequest(response.current_request));
        setIsViewingHistory(false);
      } else {
        setActiveRequest(null);
        setIsViewingHistory(false);
      }

      if (Array.isArray(response?.recent_requests)) {
        setRecentRequests(response.recent_requests);
      }
    } catch (err) {
      console.error('Lỗi khi tải dữ liệu Reception Dashboard:', err);
      setActiveRequest(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleStartTask = async () => {
    if (!activeRequest) return;
    const currentTicket = activeRequest.ticketCode;
    setActiveRequest((prev) => (prev ? { ...prev, status: 'In Progress', assignedTo: staffName } : null));

    await updateReceptionRequest(
      activeRequest.ticketCode || activeRequest.id,
      { status: 'In Progress', assigned_to: staffName }
    );
    onNotify(`Đã bắt đầu xử lý yêu cầu ${currentTicket}`);
    await loadData();
  };

  const handleComplete = async () => {
    if (!activeRequest) return;
    const currentTicket = activeRequest.ticketCode;
    
    // Đánh dấu hoàn tất trên server
    await updateReceptionRequest(
      activeRequest.ticketCode || activeRequest.id,
      { status: 'Completed', assigned_to: staffName }
    );
    onNotify(`Đã hoàn tất yêu cầu ${currentTicket}`);

    // Tự động tải lại: Nếu còn yêu cầu chờ thì tải yêu cầu tiếp theo, nếu hết thì chuyển sang màn hình hoàn tất
    await loadData();
  };

  const isCompleted = activeRequest?.status === 'Completed';
  const isInProgress = activeRequest?.status === 'In Progress';

  const statusColor = isCompleted
    ? 'text-[#258955]'
    : isInProgress
    ? 'text-[#3D72B9]'
    : 'text-[#C9222A]';

  const totalPages = Math.max(1, Math.ceil(recentRequests.length / pageSize));
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedRecentRequests = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return recentRequests.slice(start, start + pageSize);
  }, [recentRequests, currentPage, pageSize]);

  return (
    <main className="flex-1 overflow-y-auto custom-scrollbar bg-[#FCFAF7] font-sans">
      <div className="w-full max-w-[1180px] mx-auto px-6 sm:px-8 pt-4 pb-12">
        {/* Header toolbar */}
        <div className="flex items-center justify-between pb-3 border-b border-[#EBE8E3] mb-4">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-[#211F1D]">
              Bộ phận Lễ tân & Tiền sảnh
            </h1>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 font-medium">
              Front Desk Portal
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadData}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-stone-700 bg-white border border-[#E0DDD8] rounded-lg hover:bg-stone-50 transition-colors shadow-2xs cursor-pointer"
              title="Làm mới dữ liệu"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Làm mới</span>
            </button>
            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('Requests')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-stone-700 bg-white border border-[#E0DDD8] rounded-lg hover:bg-stone-50 transition-colors shadow-2xs cursor-pointer"
              >
                <span>Xem tất cả yêu cầu</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* 1. Khu vực yêu cầu đang thực hiện / cần xử lý */}
        {activeRequest ? (
          <div>
            <header className="rounded-2xl bg-white p-5 border border-[#E8E5E0] shadow-2xs flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2.5 text-[11px] text-[#77726D]">
                  <span className="rounded bg-[#EFEEEB] px-2.5 py-1 font-mono font-bold tracking-wide text-stone-800">
                    {activeRequest.ticketCode}
                  </span>
                  <span>Tạo lúc {activeRequest.createdLabel}</span>
                  <span className={`font-bold ${statusColor}`}>● {activeRequest.status}</span>
                  {isViewingHistory && (
                    <span className="px-2 py-0.5 text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 rounded">
                      Đang xem lại
                    </span>
                  )}
                </div>
                <h2 className="mt-2 text-base font-bold text-[#211F1D]">{activeRequest.title}</h2>
              </div>

              <div className="flex items-center gap-2">
                {isViewingHistory && (
                  <button
                    type="button"
                    onClick={loadData}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 px-3.5 py-2 text-[11px] font-bold text-stone-700 cursor-pointer transition-colors"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Đóng xem lại
                  </button>
                )}

                {/* Nếu yêu cầu đã Hoàn tất: CHỈ hiển thị badge Đã hoàn tất, KHÔNG hiển thị nút Mark Completed */}
                {isCompleted ? (
                  <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    Đã hoàn tất
                  </span>
                ) : (
                  <>
                    {!isInProgress && (
                      <button
                        type="button"
                        onClick={handleStartTask}
                        className="rounded-lg bg-stone-900 px-4 py-2 text-[11px] font-bold text-white hover:bg-black cursor-pointer shadow-xs transition-colors"
                      >
                        Bắt đầu xử lý
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleComplete}
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-[11px] font-bold text-white hover:bg-emerald-700 cursor-pointer shadow-xs transition-colors"
                    >
                      Đánh dấu hoàn tất
                    </button>
                  </>
                )}
              </div>
            </header>

            {/* Thông tin chi tiết yêu cầu */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <article className="rounded-xl bg-[#F4F3F0] p-4 border border-[#E8E5E0]">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#77726D] flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> Location
                </p>
                <p className="mt-1 text-[13px] font-semibold text-[#2B2825]">{activeRequest.location}</p>
                <p className="mt-0.5 text-[11px] text-[#6F6A65]">
                  {activeRequest.locationDetails?.floor || 'Khu vực tiền sảnh'} • {activeRequest.locationDetails?.category || 'Standard Room'}
                </p>
              </article>

              <article className="rounded-xl bg-[#F4F3F0] p-4 border border-[#E8E5E0]">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#77726D] flex items-center gap-1">
                  <User className="h-3 w-3" /> Guest Profile
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <p className="truncate text-[13px] font-semibold text-[#2B2825]">{activeRequest.guestName}</p>
                  <span className="rounded bg-black px-1.5 py-0.5 text-[9px] font-bold text-white">
                    {activeRequest.guestTier || 'Standard'}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-[#6F6A65]">
                  {activeRequest.guestStayDetails}
                </p>
              </article>
            </div>

            <article className="mt-4 rounded-xl bg-white p-5 border border-[#E8E5E0]">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#57524D]">Issue Description</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-[#3F3B37]">{activeRequest.description}</p>

              {activeRequest.attachedMedia && activeRequest.attachedMedia.length > 0 && (
                <div className="mt-4 pt-3 border-t border-[#F0ECE6]">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#77726D]">
                    Attached Media ({activeRequest.attachedMedia.length})
                  </p>
                  <div className="mt-2 flex gap-3">
                    {activeRequest.attachedMedia.map((media) => (
                      <img
                        key={media.url}
                        src={media.url}
                        alt={media.alt || 'Media'}
                        className="h-20 w-24 rounded object-cover border border-[#E5E2DD]"
                      />
                    ))}
                  </div>
                </div>
              )}
            </article>

            {activeRequest.transcript && activeRequest.transcript.length > 0 && (
              <article className="mt-4 rounded-xl bg-[#F4F3F0] p-5 border border-[#E8E5E0]">
                <div className="flex items-center justify-between gap-3 border-b border-[#E5E2DD] pb-3">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#4E4945]">
                    HCRobot Transcript
                  </div>
                  <span className="text-[10px] text-[#716C67]">
                    Source: Voice Assistant
                  </span>
                </div>

                <div className="mt-3 space-y-2.5">
                  {activeRequest.transcript.map((entry, index) => {
                    const isAssistant = entry.speaker === 'assistant';
                    return (
                      <div key={`${entry.time}-${index}`} className="flex items-start gap-2 text-[12px]">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${isAssistant ? 'bg-black text-white' : 'bg-[#E0DDD8] text-[#444]'}`}>
                          {isAssistant ? 'Robot' : 'Guest'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <span className="text-[10px] text-[#888] mr-2">{entry.time}</span>
                          <span className="text-[#333]">"{entry.message}"</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </article>
            )}
          </div>
        ) : (
          /* Trạng thái trống khi đã hoàn tất tất cả các yêu cầu */
          <div className="rounded-2xl border border-stone-200 bg-white p-10 text-center shadow-xs">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h3 className="mt-4 text-base font-bold text-stone-900">
              Không có yêu cầu chờ xử lý
            </h3>
            <p className="mx-auto mt-1.5 max-w-md text-xs text-stone-500 leading-relaxed">
              Tất cả các yêu cầu của bộ phận Lễ tân đã được xử lý hoàn tất. Hệ thống đang sẵn sàng tiếp nhận yêu cầu mới từ khách lưu trú & HCRobot.
            </p>
            <div className="mt-5 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={loadData}
                className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-black transition-colors cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Kiểm tra yêu cầu mới
              </button>
              {onNavigate && (
                <button
                  type="button"
                  onClick={() => onNavigate('Requests')}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 transition-colors cursor-pointer"
                >
                  Xem lịch sử yêu cầu
                </button>
              )}
            </div>
          </div>
        )}

        {/* 2. Danh sách các yêu cầu gần đây của bộ phận Lễ tân (Lịch sử) */}
        {recentRequests.length > 0 && (
          <section className="mt-6 rounded-2xl border border-[#E8E5E0] bg-white p-5 shadow-2xs">
            <div className="flex items-center justify-between pb-3 border-b border-[#F0ECE6]">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-900">
                  Yêu cầu gần đây của bộ phận Lễ tân
                </h3>
                <p className="text-[11px] text-stone-500">
                  Danh sách các phiếu hỗ trợ tiếp nhận & xử lý gần nhất
                </p>
              </div>
              <span className="text-xs font-semibold text-stone-500">
                {recentRequests.length} phiếu
              </span>
            </div>

            <div className="mt-3 divide-y divide-stone-100">
              {paginatedRecentRequests.map((r) => {
                const rTicket = r.ticket_code || r.ticketCode || r.id;
                const isSelected = activeRequest && (activeRequest.ticketCode === rTicket);
                const statusLower = String(r.status || '').toLowerCase();
                const isDone = ['completed', 'done', 'hoàn tất', 'đã hoàn thành'].includes(statusLower);
                const isProg = statusLower.includes('progress');

                return (
                  <div
                    key={rTicket}
                    onClick={() => {
                      setActiveRequest(normalizeRequest(r));
                      setIsViewingHistory(true);
                    }}
                    className={`flex items-center justify-between py-3 px-3 rounded-xl transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-amber-50/60 border border-amber-200'
                        : 'hover:bg-stone-50 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-mono text-xs font-bold text-stone-700 bg-stone-100 px-2 py-1 rounded">
                        {rTicket}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-stone-900 truncate">
                          {r.title}
                        </p>
                        <p className="text-[11px] text-stone-500">
                          {r.room_number || r.location || 'Lobby'} • {r.guest_name || 'Khách lưu trú'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isDone
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : isProg
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        ● {r.status}
                      </span>
                      <ChevronRight className="h-4 w-4 text-stone-400" />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination Footer */}
            {recentRequests.length > 0 && (
              <Pagination
                currentPage={currentPage}
                totalItems={recentRequests.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                itemName="phiếu"
                className="mt-3 rounded-2xl border border-[#E5E1D8] shadow-xs bg-white"
              />
            )}
          </section>
        )}
      </div>
    </main>
  );
};
