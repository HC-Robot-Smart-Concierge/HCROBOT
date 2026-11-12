import React, { useState, useEffect, useMemo } from 'react';
import {
  PhoneCall,
  Video,
  Clock,
  PhoneOff,
  Plus,
  RefreshCw,
  MessageSquare,
  Car,
  MapPin,
  Navigation,
  Check,
  Users,
  Disc,
  Play,
  Film,
  ExternalLink,
  Cloud,
  Star,
  AlertCircle,
  MessageCircle,
} from 'lucide-react';
import {
  fetchConciergeDashboard,
  createConciergeRequest,
  updateConciergeRequest,
  fetchHumanSupportSessions,
} from '../../services/conciergeApi';
import { fetchFeedbacks, fetchSessionMessages } from '../../services/aiApi';
import { MessengerVideoCallModal } from '../../components/video/MessengerVideoCallModal';
import { ConciergeTaxiBookingModal } from '../../components/dashboard/concierge/ConciergeTaxiBookingModal';
import { ConciergeTestCallModal } from '../../components/dashboard/concierge/ConciergeTestCallModal';
import { handleNumericKeyDown, handleNumberInputBlockExponent, sanitizeDigitsOnly } from '../../utils/numberInputHelper';
import { Pagination } from '../../components/common/Pagination';
import {
  fetchTaxiDashboard,
  fetchTaxiRequests,
  createTaxiRequest,
  updateTaxiRequestStatus,
} from '../../services/taxiApi';

export const ConciergeDashboard = ({
  currentUser,
  onNotify = () => {},
  activeSubTab: propActiveSubTab,
}) => {
  const [internalSubTab, setInternalSubTab] = useState('live_call');
  const activeSubTab = propActiveSubTab || internalSubTab;
  const isManagedFromSidebar = Boolean(propActiveSubTab);
  const [isLoading, setIsLoading] = useState(false);

  // Feedback & Service Recovery states
  const [feedbacks, setFeedbacks] = useState([]);
  const [selectedTranscriptFb, setSelectedTranscriptFb] = useState(null);
  const [transcriptMessages, setTranscriptMessages] = useState([]);
  const [isTranscriptLoading, setIsTranscriptLoading] = useState(false);

  // Live Call states
  const [activeSession, setActiveSession] = useState(null);
  const [activeCount, setActiveCount] = useState(0);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [recordedSessions, setRecordedSessions] = useState([]);
  const [playingVideo, setPlayingVideo] = useState(null);
  const [testForm, setTestForm] = useState({
    room_number: 'Lobby Kiosk Unit 01',
    guest_name: 'Mr. Tanaka Kenji',
    transcript: 'Khách muốn tìm hiểu thông tin về tour du lịch Bà Nà Hills trong ngày.',
  });

  // Taxi & Transportation states
  const [taxiKpis, setTaxiKpis] = useState({
    totalRequests: 0,
    pendingRequests: 0,
    activeTrips: 0,
    completedTrips: 0,
  });
  const [taxiRequests, setTaxiRequests] = useState([]);
  const [isTaxiModalOpen, setIsTaxiModalOpen] = useState(false);
  const [taxiForm, setTaxiForm] = useState({
    guest_name: '',
    room_number: '',
    pickup_location: 'Main Lobby & Front Entrance',
    destination: 'Da Nang International Airport (DAD)',
    pickup_time: 'Ngay bây giờ (Immediate)',
    party_size: 2,
    vehicle_type: '4-Seater Sedan',
    notes: '',
  });

  // Pagination states (10 items/page standard across dashboards)
  const pageSize = 10;
  const [recordingsPage, setRecordingsPage] = useState(1);
  const [taxiPage, setTaxiPage] = useState(1);
  const [feedbackPage, setFeedbackPage] = useState(1);

  // Guest Feedback filter states
  const [feedbackRatingFilter, setFeedbackRatingFilter] = useState('all');

  const totalRecordingsPages = Math.max(1, Math.ceil(recordedSessions.length / pageSize));
  const totalTaxiPages = Math.max(1, Math.ceil(taxiRequests.length / pageSize));

  // Filter feedbacks by 3 rating tabs (Tất cả, Cần can thiệp <= 3 sao, Hài lòng >= 4 sao)
  const filteredFeedbacks = useMemo(() => {
    let list = feedbacks;

    // 1. Rating filter
    if (feedbackRatingFilter === 'recovery') {
      list = list.filter((f) => (f.rating || 5) <= 3);
    } else if (feedbackRatingFilter === 'satisfied') {
      list = list.filter((f) => (f.rating || 5) >= 4);
    }

    return [...list].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  }, [feedbacks, feedbackRatingFilter]);

  const totalFeedbackPages = Math.max(1, Math.ceil(filteredFeedbacks.length / pageSize));

  useEffect(() => {
    setFeedbackPage(1);
  }, [feedbackRatingFilter]);

  useEffect(() => {
    if (recordingsPage > totalRecordingsPages) setRecordingsPage(totalRecordingsPages);
  }, [recordingsPage, totalRecordingsPages]);

  useEffect(() => {
    if (taxiPage > totalTaxiPages) setTaxiPage(totalTaxiPages);
  }, [taxiPage, totalTaxiPages]);

  useEffect(() => {
    if (feedbackPage > totalFeedbackPages) setFeedbackPage(totalFeedbackPages);
  }, [feedbackPage, totalFeedbackPages]);

  const paginatedRecordings = useMemo(() => {
    const start = (recordingsPage - 1) * pageSize;
    return recordedSessions.slice(start, start + pageSize);
  }, [recordedSessions, recordingsPage, pageSize]);

  const paginatedTaxiRequests = useMemo(() => {
    const start = (taxiPage - 1) * pageSize;
    return taxiRequests.slice(start, start + pageSize);
  }, [taxiRequests, taxiPage, pageSize]);

  const paginatedFeedbacks = useMemo(() => {
    const start = (feedbackPage - 1) * pageSize;
    return filteredFeedbacks.slice(start, start + pageSize);
  }, [filteredFeedbacks, feedbackPage, pageSize]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [conciergeData, taxiDashData, taxiReqsData, sessionsData, feedbacksData] = await Promise.all([
        fetchConciergeDashboard(),
        fetchTaxiDashboard(),
        fetchTaxiRequests(),
        fetchHumanSupportSessions(),
        fetchFeedbacks(),
      ]);

      if (conciergeData) {
        const curReq = conciergeData.current_request;
        if (curReq && ['Pending', 'Connected', 'In Progress'].includes(curReq.status)) {
          setActiveSession(curReq);
        } else {
          setActiveSession(null);
        }
        setActiveCount(conciergeData.active_sessions_count || 0);
      }
      if (Array.isArray(sessionsData)) {
        setRecordedSessions(sessionsData);
      }
      if (Array.isArray(feedbacksData)) {
        setFeedbacks(feedbacksData);
      }

      if (taxiDashData?.kpis) {
        setTaxiKpis(taxiDashData.kpis);
      }
      if (Array.isArray(taxiDashData?.requests) && taxiDashData.requests.length > 0) {
        setTaxiRequests(taxiDashData.requests);
      } else if (Array.isArray(taxiReqsData) && taxiReqsData.length > 0) {
        setTaxiRequests(taxiReqsData);
      } else {
        setTaxiRequests([]);
      }
    } catch (err) {
      console.error('[ConciergeDashboard] Error loading data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewTranscript = async (fb) => {
    setSelectedTranscriptFb(fb);
    setIsTranscriptLoading(true);
    setTranscriptMessages([]);
    if (fb.chat_session_id) {
      try {
        const msgs = await fetchSessionMessages(fb.chat_session_id);
        setTranscriptMessages(Array.isArray(msgs) ? msgs : []);
      } catch (err) {
        console.warn('Error fetching transcript:', err);
      }
    }
    setIsTranscriptLoading(false);
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  // --- LIVE CALL HANDLERS ---
  const handleCreateLiveCall = async (e) => {
    e.preventDefault();
    const result = await createConciergeRequest(testForm);
    if (result) {
      onNotify(`Đã khởi tạo phiên Live Call: ${result.ticket_code || result.id}`);
      setIsTestModalOpen(false);
      loadData();
    }
  };

  const handleUpdateStatus = async (status) => {
    if (!activeSession) return;
    const reqId = activeSession.id || activeSession.ticket_code;
    
    // Optimistic UI: nếu từ chối hoặc đóng cuộc gọi, lập tức tắt modal
    if (status === 'Closed' || status === 'Completed' || status === 'Cancelled') {
      setActiveSession(null);
    }

    const result = await updateConciergeRequest(reqId, {
      status,
      assigned_staff_name: currentUser?.full_name || 'Concierge Specialist',
    });
    if (result) {
      onNotify(`Cập nhật trạng thái cuộc gọi: ${status}`);
      loadData();
    }
  };

  // --- TAXI HANDLERS ---
  const handleCreateTaxi = async (e) => {
    e.preventDefault();
    if (!taxiForm.guest_name.trim()) {
      onNotify('Vui lòng nhập tên khách hàng');
      return;
    }
    const result = await createTaxiRequest(taxiForm);
    if (result) {
      onNotify(`Tạo yêu cầu gọi xe thành công: ${result.ticket_code || result.id}`);
      setIsTaxiModalOpen(false);
      setTaxiForm({
        guest_name: '',
        room_number: '',
        pickup_location: 'Main Lobby & Front Entrance',
        destination: 'Da Nang International Airport (DAD)',
        pickup_time: 'Ngay bây giờ (Immediate)',
        party_size: 2,
        vehicle_type: '4-Seater Sedan',
        notes: '',
      });
      loadData();
    }
  };

  const handleUpdateTaxiStatus = async (reqId, newStatus, note = null) => {
    const res = await updateTaxiRequestStatus(reqId, newStatus, note);
    if (res) {
      const statusMsg =
        newStatus === 'Calling'
          ? 'Concierge đã nhận yêu cầu và đang gọi xe taxi cho khách'
          : newStatus === 'Completed'
          ? 'Đã hoàn tất cuộc gọi xe taxi thành công'
          : `Cập nhật trạng thái yêu cầu taxi: ${newStatus}`;
      onNotify(statusMsg);
      setTaxiRequests((prev) =>
        prev.map((r) => (r.id === reqId ? { ...r, status: newStatus } : r))
      );
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-palette-cream">
      {/* Top Header */}
      <div className="bg-white border-b border-palette-silver px-3.5 py-2.5 sm:px-6 sm:py-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2.5 sm:gap-4">
          <div>
            <h1 className="text-base sm:text-xl font-bold text-palette-charcoal flex items-center gap-2">
              {activeSubTab === 'recordings' ? (
                <>
                  <Film className="w-5 h-5 text-sky-600" />
                  Lịch Sử Cuộc Gọi & Bản Ghi Video
                </>
              ) : activeSubTab === 'taxi' ? (
                <>
                  <Car className="w-5 h-5 text-emerald-600" />
                  Tiếp Nhận & Gọi Xe Taxi Cho Khách
                </>
              ) : activeSubTab === 'feedback' ? (
                <>
                  <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                  Đánh Giá & Cứu Vãn Dịch Vụ (Robot Kiosk)
                </>
              ) : (
                <>
                  <PhoneCall className="w-5 h-5 text-palette-charcoal" />
                  Tổng Đài Can Thiệp Trực Tuyến Live Call (Robot Kiosk)
                </>
              )}
            </h1>
            <p className="text-[11px] sm:text-xs text-palette-slate mt-0.5 line-clamp-1 sm:line-clamp-none">
              {activeSubTab === 'recordings'
                ? 'Danh sách video ghi hình tự động các phiên hỗ trợ trực tiếp giữa Robot Kiosk và Nhân viên'
                : activeSubTab === 'taxi'
                ? 'Tiếp nhận yêu cầu xe, điều phối tài xế và theo dõi lộ trình di chuyển của khách'
                : activeSubTab === 'feedback'
                ? 'Theo dõi mức độ hài lòng của khách hàng và can thiệp hỗ trợ dịch vụ kịp thời'
                : 'Tiếp nhận cuộc gọi video hỗ trợ tức thì từ màn hình Robot Kiosk của khách hàng'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              disabled={isLoading}
              className="p-1.5 sm:p-2 rounded-lg bg-palette-stone text-palette-charcoal hover:bg-palette-silver border border-palette-silver text-[11px] sm:text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Làm mới</span>
            </button>
            {activeSubTab === 'live_call' && (
              <button
                onClick={() => setIsTestModalOpen(true)}
                className="px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-lg bg-palette-charcoal hover:bg-neutral-800 text-palette-cream text-[11px] sm:text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Mô phỏng gọi</span>
              </button>
            )}
            {activeSubTab === 'taxi' && (
              <button
                onClick={() => setIsTaxiModalOpen(true)}
                className="px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-lg bg-palette-charcoal hover:bg-neutral-800 text-palette-cream text-[11px] sm:text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Đặt xe mới</span>
              </button>
            )}
          </div>
        </div>

        {/* Tab Navigation (Chỉ hiển thị fallback nếu không điều hướng từ sidebar) */}
        {!isManagedFromSidebar && (
          <div className="flex items-center gap-2 mt-4 border-t border-palette-silver/50 pt-3">
            <button
              onClick={() => setActiveSubTab('live_call')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                activeSubTab === 'live_call'
                  ? 'bg-palette-charcoal text-palette-cream shadow-sm'
                  : 'text-palette-slate hover:bg-palette-stone hover:text-palette-charcoal'
              }`}
            >
              <PhoneCall className="w-3.5 h-3.5" />
              <span>Tổng đài Live Call</span>
              {activeCount > 0 && (
                <span className="bg-emerald-500 text-white text-[10px] px-1.5 py-0.2 rounded-full">
                  {activeCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveSubTab('recordings')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                activeSubTab === 'recordings'
                  ? 'bg-palette-charcoal text-palette-cream shadow-sm'
                  : 'text-palette-slate hover:bg-palette-stone hover:text-palette-charcoal'
              }`}
            >
              <Film className="w-3.5 h-3.5" />
              <span>Bản Ghi Cuộc Gọi</span>
              {recordedSessions.filter((s) => s.recording_url).length > 0 && (
                <span className="bg-sky-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                  {recordedSessions.filter((s) => s.recording_url).length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveSubTab('taxi')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                activeSubTab === 'taxi'
                  ? 'bg-palette-charcoal text-palette-cream shadow-sm'
                  : 'text-palette-slate hover:bg-palette-stone hover:text-palette-charcoal'
              }`}
            >
              <Car className="w-3.5 h-3.5" />
              <span>Yêu cầu gọi Taxi</span>
              {taxiKpis.pendingRequests > 0 && (
                <span className="bg-palette-stone text-palette-charcoal border border-palette-silver text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                  {taxiKpis.pendingRequests}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveSubTab('feedback')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                activeSubTab === 'feedback'
                  ? 'bg-palette-charcoal text-palette-cream shadow-sm'
                  : 'text-palette-slate hover:bg-palette-stone hover:text-palette-charcoal'
              }`}
            >
              <Star className="w-3.5 h-3.5" />
              <span>Đánh Giá & Cứu Vãn Dịch Vụ</span>
              {feedbacks.filter((f) => f.rating <= 3).length > 0 && (
                <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold animate-pulse">
                  {feedbacks.filter((f) => f.rating <= 3).length}
                </span>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3.5 sm:p-6 pb-6">
        {/* SUBTAB 1: LIVE CALL */}
        {activeSubTab === 'live_call' && (
          <div className="space-y-4 sm:space-y-6">
            {/* Live Call Metric Banner */}
            <div className="flex items-center gap-2.5 sm:gap-3 bg-palette-stone/50 border border-palette-silver rounded-xl p-2.5 sm:p-3">
              <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <div className="flex-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5">
                <span className="text-[11px] sm:text-xs font-bold text-palette-charcoal">
                  Trạng thái Trực Tổng Đài: Sẵn Sàng (Live Concierge Online)
                </span>
                <span className="text-[10px] sm:text-xs text-palette-slate">
                  Đang có <strong className="text-palette-charcoal">{activeCount}</strong> phiên hỗ trợ cần xử lý
                </span>
              </div>
            </div>

            {activeSession ? (
              <div className="max-w-3xl mx-auto bg-white rounded-2xl border border-palette-silver p-3.5 sm:p-6 shadow-sm">
                <div className="flex items-start justify-between border-b border-palette-silver/40 pb-3 sm:pb-4">
                  <div>
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <span className="font-mono text-[11px] sm:text-xs font-bold bg-palette-stone text-palette-charcoal border border-palette-silver px-2 py-0.5 rounded">
                        {activeSession.ticket_code || activeSession.id}
                      </span>
                      <span className="text-xs sm:text-sm font-bold text-palette-charcoal">
                        {activeSession.guest_name || 'Khách tại Kiosk'}
                      </span>
                      <span className="text-[11px] sm:text-xs text-palette-slate">
                        ({activeSession.room_number || 'Sảnh S1'})
                      </span>
                    </div>
                    <div className="text-[10px] sm:text-xs text-palette-slate mt-1 flex items-center gap-1.5">
                      <Clock className="w-3 h-3" />
                      <span>Khởi tạo: {activeSession.created_at || 'Vừa xong'}</span>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] sm:text-xs font-bold px-2.5 py-1 rounded-full ${
                      activeSession.status === 'Connected'
                        ? 'bg-emerald-100 text-emerald-800 animate-pulse'
                        : activeSession.status === 'Closed'
                        ? 'bg-palette-stone text-palette-slate'
                        : 'bg-palette-stone text-palette-charcoal border border-palette-silver'
                    }`}
                  >
                    {activeSession.status || 'Pending'}
                  </span>
                </div>

                {/* Conversation Transcript */}
                <div className="my-3 sm:my-5">
                  <label className="text-[10px] sm:text-xs font-bold text-palette-charcoal uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-palette-charcoal" />
                    <span>Nội Dung Hội Thoại Chuyển Tiếp Từ Robot</span>
                  </label>
                  <div className="bg-palette-cream/70 border border-palette-silver rounded-xl p-3 sm:p-4 text-xs text-palette-charcoal leading-relaxed font-sans max-h-40 sm:max-h-none overflow-y-auto">
                    {activeSession.description || 'Không có mô tả hội thoại.'}
                  </div>
                </div>

                {/* Action Bar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3 pt-3 sm:pt-4 border-t border-palette-silver/50">
                  <div className="hidden sm:flex items-center gap-2 text-xs text-palette-slate">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Sẵn sàng kết nối video call trực tiếp</span>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    {activeSession.status !== 'Connected' && activeSession.status !== 'Closed' && (
                      <button
                        type="button"
                        onClick={async () => {
                          await handleUpdateStatus('Connected');
                          setIsVideoModalOpen(true);
                        }}
                        className="flex-1 sm:flex-initial w-full sm:w-auto px-5 py-3 sm:py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 cursor-pointer"
                      >
                        <Video className="w-4 h-4" />
                        <span>Tiếp nhận cuộc gọi Video</span>
                      </button>
                    )}

                    {activeSession.status === 'Connected' && (
                      <button
                        type="button"
                        onClick={() => setIsVideoModalOpen(true)}
                        className="flex-1 sm:flex-initial w-full sm:w-auto px-5 py-3 sm:py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 cursor-pointer"
                      >
                        <Video className="w-4 h-4" />
                        <span>Mở Màn Hình Cuộc Gọi</span>
                      </button>
                    )}

                    {activeSession.status === 'Connected' && (
                      <button
                        type="button"
                        onClick={async () => {
                          setIsVideoModalOpen(false);
                          await handleUpdateStatus('Closed');
                        }}
                        className="px-4 py-3 sm:py-2 rounded-xl bg-neutral-700 hover:bg-neutral-800 active:bg-neutral-900 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 cursor-pointer"
                      >
                        <PhoneOff className="w-4 h-4" />
                        <span>Kết thúc</span>
                      </button>
                    )}

                    {activeSession.status === 'Closed' && (
                      <span className="text-xs text-palette-slate font-semibold">
                        Phiên hỗ trợ này đã hoàn tất.
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="max-w-md mx-auto my-12 bg-white rounded-xl border border-palette-silver p-8 text-center shadow-sm">
                <PhoneCall className="w-12 h-12 text-palette-slate/40 mx-auto mb-3" />
                <h2 className="text-sm font-bold text-palette-charcoal">Không có cuộc gọi Live Call nào</h2>
                <p className="text-xs text-palette-slate mt-1">
                  Robot Kiosk hiện chưa phát tín hiệu can thiệp trực tiếp từ khách hàng.
                </p>
                <button
                  onClick={() => setIsTestModalOpen(true)}
                  className="mt-4 px-3 py-1.5 rounded-lg bg-palette-charcoal hover:bg-neutral-800 text-palette-cream text-xs font-semibold inline-flex items-center gap-1.5 transition-all shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Tạo cuộc gọi mô phỏng
                </button>
              </div>
            )}
          </div>
        )}

        {/* SUBTAB: CLOUDINARY CALL RECORDINGS */}
        {activeSubTab === 'recordings' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-palette-silver shadow-sm overflow-hidden">
              <div className="p-4 border-b border-palette-silver/50 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-palette-charcoal flex items-center gap-2">
                    <Film className="w-4 h-4 text-sky-600" />
                    Lịch Sử Cuộc Gọi & Bản Ghi Video (Human Support Sessions)
                  </h3>
                  <p className="text-[11px] text-palette-slate mt-0.5">
                    Các cuộc gọi video hỗ trợ trực tiếp giữa Robot Kiosk và Nhân viên được ghi hình tự động.
                  </p>
                </div>
                <button
                  onClick={loadData}
                  className="px-2.5 py-1 text-xs rounded-lg border border-palette-silver hover:bg-palette-stone flex items-center gap-1 text-palette-charcoal transition-all"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                  Làm mới
                </button>
              </div>

              {recordedSessions.length === 0 ? (
                <div className="p-12 text-center text-xs text-palette-slate">
                  Chưa có bản ghi cuộc gọi nào. Khi khách gọi qua Robot Kiosk, video sẽ tự động xuất hiện ở đây.
                </div>
              ) : (
                <div className="divide-y divide-palette-silver/30">
                  {paginatedRecordings.map((session) => (
                    <div
                      key={session.id}
                      className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 hover:bg-palette-cream/40 transition-all"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold bg-palette-stone text-palette-charcoal px-2 py-0.5 rounded border border-palette-silver">
                            {session.session_code || session.id}
                          </span>
                          <span className="text-xs font-bold text-palette-charcoal">{session.guest_name}</span>
                          <span className="text-[11px] text-palette-slate">({session.room_number})</span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              session.status === 'Resolved'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-sky-100 text-sky-800'
                            }`}
                          >
                            {session.status}
                          </span>
                        </div>

                        <div className="text-xs text-palette-slate flex flex-wrap items-center gap-4 pt-1">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {session.created_at ? new Date(session.created_at).toLocaleString('vi-VN') : 'Vừa xong'}
                          </span>
                          <span className="flex items-center gap-1">
                            <Disc className="w-3.5 h-3.5 text-red-500" />
                            Thời lượng: <strong className="font-semibold text-palette-charcoal">{session.recording_duration || 0}s</strong>
                          </span>
                          {session.recording_url && (
                            <span className="flex items-center gap-1 text-sky-700 font-semibold text-[11px]">
                              <Cloud className="w-3.5 h-3.5" />
                              Cloudinary Cloud Storage
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {session.recording_url ? (
                          <>
                            <button
                              onClick={() => setPlayingVideo(session)}
                              className="px-3 py-1.5 rounded-lg bg-palette-charcoal hover:bg-neutral-800 text-palette-cream text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
                            >
                              <Play className="w-3.5 h-3.5 fill-current" />
                              Xem Bản Ghi
                            </button>
                            <a
                              href={session.recording_url}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 rounded-lg border border-palette-silver hover:bg-palette-stone text-palette-slate hover:text-palette-charcoal transition-all"
                              title="Mở tab Cloudinary mới"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          </>
                        ) : (
                          <span className="text-xs text-palette-slate italic">Đang diễn ra hoặc chưa lưu video</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Pagination Footer */}
              {recordedSessions.length > 0 && (
                <Pagination
                  currentPage={recordingsPage}
                  totalItems={recordedSessions.length}
                  pageSize={pageSize}
                  onPageChange={setRecordingsPage}
                  itemName="bản ghi"
                  className="border-t border-palette-silver/50 bg-white"
                />
              )}
            </div>
          </div>
        )}

        {/* SUBTAB 2: TAXI & TRANSPORTATION */}
        {activeSubTab === 'taxi' && (
          <div className="space-y-6">
            {/* Metric KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-palette-stone/40 border border-palette-silver rounded-xl p-3">
                <div className="text-[11px] font-semibold text-palette-slate">Tổng yêu cầu</div>
                <div className="text-xl font-bold text-palette-charcoal mt-1">
                  {taxiRequests.length || taxiKpis.totalRequests}
                </div>
              </div>
              <div className="bg-palette-stone/40 border border-palette-silver rounded-xl p-3">
                <div className="text-[11px] font-semibold text-palette-slate">Chờ tiếp nhận</div>
                <div className="text-xl font-bold text-palette-charcoal mt-1">
                  {taxiRequests.filter((r) => {
                    const st = (r.status || '').toLowerCase();
                    return st === 'pending' || st === 'unassigned' || st === 'chờ tiếp nhận' || st === 'missed';
                  }).length || taxiKpis.pendingRequests}
                </div>
              </div>
              <div className="bg-palette-stone/40 border border-palette-silver rounded-xl p-3">
                <div className="text-[11px] font-semibold text-palette-slate">Đang gọi xe</div>
                <div className="text-xl font-bold text-sky-600 mt-1">
                  {taxiRequests.filter((r) => {
                    const st = (r.status || '').toLowerCase();
                    return (
                      st === 'calling' ||
                      st === 'in progress' ||
                      st === 'đang gọi' ||
                      st === 'driver assigned' ||
                      st === 'on the way'
                    );
                  }).length || taxiKpis.callingRequests || taxiKpis.activeTrips}
                </div>
              </div>
              <div className="bg-palette-stone/40 border border-palette-silver rounded-xl p-3">
                <div className="text-[11px] font-semibold text-palette-slate">Gọi thành công</div>
                <div className="text-xl font-bold text-emerald-600 mt-1">
                  {taxiRequests.filter((r) => {
                    const st = (r.status || '').toLowerCase();
                    return st === 'completed' || st === 'thành công' || st === 'success' || st === 'done' || st === 'closed';
                  }).length || taxiKpis.completedTrips}
                </div>
              </div>
            </div>

            {/* Taxi Request List */}
            <div className="bg-white rounded-xl border border-palette-silver shadow-sm overflow-hidden">
              <div className="p-4 border-b border-palette-silver/50 flex items-center justify-between">
                <span className="text-xs font-bold text-palette-charcoal">Danh Sách Yêu Cầu Gọi Xe Taxi</span>
                <span className="text-[11px] text-palette-slate">Hiển thị {taxiRequests.length} yêu cầu</span>
              </div>

              {taxiRequests.length === 0 ? (
                <div className="p-8 text-center text-xs text-palette-slate">
                  Hiện chưa có yêu cầu gọi taxi nào trong hệ thống.
                </div>
              ) : (
                <div className="divide-y divide-palette-silver/30">
                  {paginatedTaxiRequests.map((trip) => {
                    const stLower = (trip.status || '').toLowerCase();
                    const isPending =
                      stLower === 'pending' ||
                      stLower === 'unassigned' ||
                      stLower === 'chờ tiếp nhận' ||
                      stLower === 'missed';
                    const isCalling =
                      stLower === 'calling' ||
                      stLower === 'in progress' ||
                      stLower === 'đang gọi' ||
                      stLower === 'driver assigned' ||
                      stLower === 'on the way';
                    const isCompleted =
                      stLower === 'completed' ||
                      stLower === 'thành công' ||
                      stLower === 'success' ||
                      stLower === 'done' ||
                      stLower === 'closed';
                    const isCancelled =
                      stLower === 'cancelled' || stLower === 'đã hủy' || stLower === 'rejected';

                    return (
                      <div
                        key={trip.id}
                        className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 hover:bg-palette-cream/40 transition-all"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold text-palette-charcoal bg-palette-stone border border-palette-silver px-2 py-0.5 rounded">
                              {trip.ticket_code || trip.id}
                            </span>
                            <span className="text-xs font-bold text-palette-charcoal">{trip.guest_name}</span>
                            {trip.room_number && (
                              <span className="text-[11px] text-palette-slate">(Phòng {trip.room_number})</span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-4 text-xs text-palette-slate mt-2">
                            <span className="flex items-center gap-1 text-palette-charcoal">
                              <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0" />
                              Đón: <strong className="font-semibold">{trip.pickup_location}</strong>
                            </span>
                            <span className="flex items-center gap-1 text-palette-charcoal">
                              <Navigation className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                              Đến: <strong className="font-semibold">{trip.destination}</strong>
                            </span>
                            <span className="flex items-center gap-1 text-palette-slate">
                              <Clock className="w-3.5 h-3.5 shrink-0" />
                              {trip.pickup_time || 'Ngay bây giờ'}
                            </span>
                            <span className="flex items-center gap-1 text-palette-slate">
                              <Car className="w-3.5 h-3.5 shrink-0" />
                              {trip.vehicle_type || '4 chỗ'} ({trip.party_size || 2} khách)
                            </span>
                          </div>

                          {trip.notes && (
                            <div className="mt-2 text-[11px] text-palette-slate italic">
                              Ghi chú: {trip.notes}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 self-start md:self-center">
                          {/* Status Badge */}
                          <span
                            className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                              isCompleted
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : isCalling
                                ? 'bg-sky-100 text-sky-800 border border-sky-200 animate-pulse'
                                : isCancelled
                                ? 'bg-neutral-100 text-neutral-700'
                                : stLower === 'missed'
                                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                : 'bg-amber-100 text-amber-800 border border-amber-200'
                            }`}
                          >
                            {isCompleted
                              ? (stLower === 'closed' ? 'Đã đóng' : 'Thành công')
                              : isCalling
                              ? 'Đang gọi'
                              : isCancelled
                              ? 'Đã hủy'
                              : stLower === 'missed'
                              ? 'Chờ tiếp nhận'
                              : 'Chờ tiếp nhận'}
                          </span>

                          {/* Action Button 1: Khi còn Pending hoặc Missed -> Concierge nhận yêu cầu và chuyển sang Đang gọi */}
                          {isPending && (
                            <button
                              onClick={() => handleUpdateTaxiStatus(trip.id, 'Calling')}
                              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-sky-600 hover:bg-sky-700 text-white transition-all flex items-center gap-1.5 shadow-sm cursor-pointer active:scale-95"
                              title="Concierge tiếp nhận và gọi xe cho khách"
                            >
                              <PhoneCall className="w-3.5 h-3.5" />
                              Nhận yêu cầu
                            </button>
                          )}

                          {/* Action Button 2: Khi đang Gọi -> Concierge gọi xong bấm Thành công */}
                          {isCalling && (
                            <button
                              onClick={() => handleUpdateTaxiStatus(trip.id, 'Completed')}
                              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-all flex items-center gap-1.5 shadow-sm cursor-pointer active:scale-95"
                              title="Xác nhận đã gọi taxi thành công cho khách"
                            >
                              <Check className="w-3.5 h-3.5" />
                              Thành công
                            </button>
                          )}

                          {isCompleted && (
                            <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                              <Check className="w-3.5 h-3.5" />
                              Đã gọi xong
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Pagination Footer */}
              {taxiRequests.length > 0 && (
                <Pagination
                  currentPage={taxiPage}
                  totalItems={taxiRequests.length}
                  pageSize={pageSize}
                  onPageChange={setTaxiPage}
                  itemName="yêu cầu"
                  className="border-t border-palette-silver/50 bg-white"
                />
              )}
            </div>
          </div>
        )}

        {/* SUBTAB 4: FEEDBACK & SERVICE RECOVERY */}
        {activeSubTab === 'feedback' && (
          <div className="space-y-6">
            {/* KPI Cards (Clickable Quick Filters) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div
                onClick={() => setFeedbackRatingFilter('all')}
                className={`bg-white rounded-xl border p-4 shadow-xs cursor-pointer transition-all ${
                  feedbackRatingFilter === 'all'
                    ? 'border-palette-charcoal ring-2 ring-palette-charcoal/20'
                    : 'border-palette-silver hover:border-palette-charcoal/50'
                }`}
                title="Nhấn để xem tất cả đánh giá"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs text-palette-slate font-medium">Tổng Đánh Giá Nhận Được</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                    feedbackRatingFilter === 'all' ? 'bg-palette-charcoal text-white' : 'bg-palette-stone text-palette-slate'
                  }`}>Tất cả</span>
                </div>
                <div className="text-2xl font-bold text-palette-charcoal mt-1">
                  {feedbacks.length}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-palette-silver p-4 shadow-xs">
                <span className="text-xs text-palette-slate font-medium">Điểm Đánh Giá Trung Bình</span>
                <div className="text-2xl font-bold text-palette-charcoal mt-1 flex items-center gap-1.5">
                  <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                  <span>
                    {feedbacks.length > 0
                      ? (feedbacks.reduce((acc, cur) => acc + (cur.rating || 5), 0) / feedbacks.length).toFixed(1)
                      : '--'}
                  </span>
                  {feedbacks.length > 0 && (
                    <span className="text-xs text-palette-slate font-normal">/ 5.0</span>
                  )}
                </div>
              </div>

              <div
                onClick={() => setFeedbackRatingFilter('satisfied')}
                className={`bg-white rounded-xl border p-4 shadow-xs cursor-pointer transition-all ${
                  feedbackRatingFilter === 'satisfied'
                    ? 'border-emerald-600 ring-2 ring-emerald-500/20 bg-emerald-50/20'
                    : 'border-palette-silver hover:border-emerald-500/50'
                }`}
                title="Nhấn để lọc các đánh giá hài lòng (4 - 5 sao)"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs text-palette-slate font-medium">Hài Lòng (4 - 5 Sao)</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                    feedbackRatingFilter === 'satisfied' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-800'
                  }`}>4-5 sao</span>
                </div>
                <div className="text-2xl font-bold text-emerald-600 mt-1">
                  {feedbacks.filter((f) => f.rating >= 4).length}
                </div>
              </div>

              <div
                onClick={() => setFeedbackRatingFilter('recovery')}
                className={`rounded-xl border p-4 shadow-xs cursor-pointer transition-all ${
                  feedbackRatingFilter === 'recovery'
                    ? 'border-rose-600 ring-2 ring-rose-500/20 bg-rose-50/50'
                    : 'border-rose-200 bg-rose-50/30 hover:border-rose-400'
                }`}
                title="Nhấn để lọc các đánh giá cần can thiệp (≤ 3 sao)"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs text-rose-700 font-bold uppercase tracking-wider">Cần Can Thiệp (≤ 3 Sao)</span>
                  {feedbacks.filter((f) => f.rating <= 3).length > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-800 font-semibold animate-pulse">
                      Cần xử lý
                    </span>
                  )}
                </div>
                <div className="text-2xl font-bold text-rose-600 mt-1 flex items-center gap-2">
                  <span>{feedbacks.filter((f) => f.rating <= 3).length}</span>
                </div>
              </div>
            </div>

            {/* Service Recovery Alerts Banner */}
            {feedbacks.filter((f) => f.rating <= 3).length > 0 && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1 text-xs text-rose-900">
                  <strong className="font-bold">Cảnh báo can thiệp dịch vụ (Service Recovery): </strong>
                  Có {feedbacks.filter((f) => f.rating <= 3).length} lượt khách chưa hài lòng về hỗ trợ của Robot Kiosk.
                  Nhân viên Concierge có thể nhấn trực tiếp vào dòng đánh giá để xem lại lịch sử hội thoại và chủ động hỗ trợ khách ngay!
                </div>
              </div>
            )}

            {/* Feedback List Card */}
            <div className="bg-white rounded-xl border border-palette-silver p-5 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-palette-silver/50 pb-3">
                <h3 className="text-sm font-bold text-palette-charcoal flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-palette-charcoal" />
                  Danh Sách Đánh Giá & Ý Kiến Khách Hàng Từ Robot Kiosk
                </h3>
                <div className="flex items-center gap-2 text-xs font-mono text-palette-slate">
                  <span>Hiển thị <strong>{filteredFeedbacks.length}</strong> / {feedbacks.length} phản hồi</span>
                  {feedbackRatingFilter !== 'all' && (
                    <button
                      onClick={() => setFeedbackRatingFilter('all')}
                      className="text-[11px] text-sky-700 hover:underline font-semibold cursor-pointer"
                    >
                      (Xóa bộ lọc)
                    </button>
                  )}
                </div>
              </div>

              {/* Rating Filter Pills */}
              <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1 sm:pb-0">
                {[
                  { id: 'all', label: 'Tất cả', count: feedbacks.length },
                  { id: 'recovery', label: 'Cần can thiệp', count: feedbacks.filter((f) => (f.rating || 5) <= 3).length, isWarning: true },
                  { id: 'satisfied', label: 'Hài lòng (4-5 sao)', count: feedbacks.filter((f) => (f.rating || 5) >= 4).length },
                ].map((tab) => {
                  const isSelected = feedbackRatingFilter === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setFeedbackRatingFilter(tab.id)}
                      className={`px-3.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-2 border ${
                        isSelected
                          ? tab.isWarning
                            ? 'bg-rose-700 text-white border-transparent shadow-xs'
                            : 'bg-palette-charcoal text-white border-transparent shadow-xs'
                          : 'bg-white text-palette-charcoal border-palette-silver hover:bg-palette-stone/40'
                      }`}
                    >
                      <span>{tab.label}</span>
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
                          isSelected
                            ? tab.isWarning
                              ? 'bg-black/20 text-white'
                              : 'bg-white/20 text-white'
                            : 'bg-palette-stone text-palette-charcoal'
                        }`}
                      >
                        {tab.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {filteredFeedbacks.length === 0 ? (
                <div className="py-12 text-center text-xs text-palette-slate space-y-2">
                  <p>
                    {feedbacks.length === 0
                      ? 'Chưa có đánh giá nào từ khách hàng tại Kiosk.'
                      : 'Không tìm thấy đánh giá nào phù hợp với bộ lọc hiện tại.'}
                  </p>
                  {feedbacks.length > 0 && (
                    <button
                      onClick={() => setFeedbackRatingFilter('all')}
                      className="px-3 py-1 rounded-lg bg-palette-charcoal text-white text-xs font-semibold hover:bg-neutral-800 transition-all cursor-pointer"
                    >
                      Đặt lại bộ lọc
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {paginatedFeedbacks.map((fb) => {
                    const isBad = (fb.rating || 5) <= 3;
                    return (
                      <div
                        key={fb.id || fb.chat_session_id}
                        onClick={() => fb.chat_session_id && handleViewTranscript(fb)}
                        className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:shadow-xs ${
                          isBad
                            ? 'bg-rose-50/40 border-rose-200 hover:border-rose-300'
                            : 'bg-white border-palette-silver hover:border-palette-charcoal/40'
                        }`}
                        title={fb.chat_session_id ? 'Nhấn để xem chi tiết lịch sử hội thoại' : undefined}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                          {/* Star Badge */}
                          <div className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border shrink-0 ${
                            isBad
                              ? 'bg-rose-50 border-rose-200'
                              : 'bg-stone-100 border-stone-200'
                          }`}>
                            <Star className={`w-3.5 h-3.5 ${isBad ? 'text-rose-500 fill-rose-500' : 'text-amber-500 fill-amber-500'}`} />
                            <span className={`text-xs font-bold ${isBad ? 'text-rose-800' : 'text-palette-charcoal'}`}>
                              {fb.rating} / 5 Sao
                            </span>
                          </div>

                          {/* Info bar: Session ID, Room, Guest Name, Category */}
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              <span className="font-mono font-bold bg-palette-stone text-palette-charcoal px-2 py-0.5 rounded border border-palette-silver">
                                {fb.chat_session_id || fb.id || 'N/A'}
                              </span>
                              {fb.room_number && (
                                <span className="font-semibold text-palette-charcoal bg-amber-50 text-amber-900 border border-amber-200 px-1.5 py-0.2 rounded text-[11px]">
                                  Phòng {fb.room_number}
                                </span>
                              )}
                              {fb.guest_name && (
                                <span className="font-semibold text-palette-charcoal">
                                  {fb.guest_name}
                                </span>
                              )}
                              {fb.category && (
                                <span className="text-[11px] px-2 py-0.5 rounded bg-palette-stone text-palette-slate border border-palette-silver">
                                  {fb.category}
                                </span>
                              )}
                              {isBad && (
                                <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold animate-pulse">
                                  Cần can thiệp
                                </span>
                              )}
                            </div>

                            {/* Comment */}
                            {fb.comment && (
                              <p className="text-xs text-palette-charcoal/90 italic bg-palette-cream/60 border border-palette-silver/50 rounded-lg px-2.5 py-1 mt-1">
                                &quot;{fb.comment}&quot;
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Right: Time & Action */}
                        <div className="flex items-center gap-3 shrink-0 self-start sm:self-center">
                          <div className="text-[11px] font-mono text-stone-500 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-stone-400" />
                            <span>{fb.created_at ? new Date(fb.created_at).toLocaleString('vi-VN') : 'Vừa xong'}</span>
                          </div>
                          {fb.chat_session_id && (
                            <span className="text-xs font-semibold text-sky-700 hover:text-sky-900 flex items-center gap-1">
                              <MessageSquare className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Hội thoại</span>
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Pagination Footer */}
              {filteredFeedbacks.length > 0 && (
                <Pagination
                  currentPage={feedbackPage}
                  totalItems={filteredFeedbacks.length}
                  pageSize={pageSize}
                  onPageChange={setFeedbackPage}
                  itemName="đánh giá"
                  className="mt-3 rounded-xl border border-palette-silver bg-white"
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* MODAL: MÔ PHỎNG LIVE CALL */}
      <ConciergeTestCallModal
        isOpen={isTestModalOpen}
        onClose={() => setIsTestModalOpen(false)}
        onSubmit={handleCreateLiveCall}
        testForm={testForm}
        setTestForm={setTestForm}
      />

      {/* MODAL: ĐẶT XE MỚI */}
      <ConciergeTaxiBookingModal
        isOpen={isTaxiModalOpen}
        onClose={() => setIsTaxiModalOpen(false)}
        onSubmit={handleCreateTaxi}
        taxiForm={taxiForm}
        setTaxiForm={setTaxiForm}
      />

      {/* MODAL XEM LẠI VIDEO GHI HÌNH TỪ CLOUDINARY */}
      {playingVideo && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-3xl w-full overflow-hidden shadow-2xl">
            <div className="p-4 bg-neutral-900 flex items-center justify-between border-b border-neutral-800">
              <div className="flex items-center gap-2 text-white text-xs font-bold">
                <Film className="w-4 h-4 text-emerald-400" />
                <span>Bản Ghi Cuộc Gọi: {playingVideo.session_code || playingVideo.id}</span>
                <span className="text-neutral-400 font-normal">({playingVideo.guest_name} - {playingVideo.room_number})</span>
              </div>
              <button
                onClick={() => setPlayingVideo(null)}
                className="text-neutral-400 hover:text-white text-xs font-bold px-2 py-1 rounded-lg hover:bg-neutral-800 transition-all"
              >
                Đóng
              </button>
            </div>
            <div className="bg-black aspect-video flex items-center justify-center">
              <video
                src={playingVideo.recording_url}
                controls
                autoPlay
                className="w-full h-full object-contain"
              />
            </div>
            <div className="p-3 bg-neutral-900/90 text-[11px] text-neutral-400 flex items-center justify-between border-t border-neutral-800">
              <span className="truncate">URL: {playingVideo.recording_url}</span>
              <a
                href={playingVideo.recording_url}
                target="_blank"
                rel="noreferrer"
                className="text-emerald-400 hover:underline shrink-0 ml-3 flex items-center gap-1 font-semibold"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Mở gốc
              </a>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: XEM TRANSCRIPT CHI TIẾT HỘI THOẠI (SERVICE RECOVERY) */}
      {selectedTranscriptFb && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-palette-silver overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 bg-palette-stone/40 border-b border-palette-silver flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-palette-charcoal text-palette-cream">
                    {selectedTranscriptFb.chat_session_id}
                  </span>
                  <span className="text-sm font-bold text-palette-charcoal">
                    {selectedTranscriptFb.guest_name || 'Khách tại Kiosk'}
                  </span>
                  <span className="text-xs text-palette-slate">
                    ({selectedTranscriptFb.room_number ? `Phòng ${selectedTranscriptFb.room_number}` : 'Kiosk Sảnh'})
                  </span>
                </div>
                <div className="text-xs text-palette-slate mt-1 flex items-center gap-2">
                  <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                  <span>Đánh giá dịch vụ: <strong>{selectedTranscriptFb.rating}/5 Sao</strong></span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTranscriptFb(null)}
                className="p-1.5 text-palette-slate hover:text-palette-charcoal hover:bg-palette-stone rounded-lg font-bold text-xs cursor-pointer"
              >
                Đóng
              </button>
            </div>

            {/* Modal Content / Chat Stream */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-palette-cream/30">
              {isTranscriptLoading ? (
                <div className="py-12 text-center text-xs text-palette-slate flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Đang tải toàn bộ lượt hội thoại...</span>
                </div>
              ) : transcriptMessages.length === 0 ? (
                <div className="py-12 text-center text-xs text-palette-slate">
                  Không tìm thấy bản ghi chi tiết từng tin nhắn cho phiên này.
                </div>
              ) : (
                transcriptMessages.map((msg, idx) => {
                  const isUser = msg.sender === 'user';
                  return (
                    <div
                      key={msg.id || idx}
                      className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                    >
                      <span className="text-[10px] font-mono font-bold text-palette-slate mb-1 px-1">
                        {isUser ? 'Khách hàng (User)' : 'Trợ lý Robot Rora (Assistant)'}
                      </span>
                      <div
                        className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed shadow-2xs ${
                          isUser
                            ? 'bg-palette-charcoal text-palette-cream rounded-br-xs'
                            : 'bg-white text-palette-charcoal border border-palette-silver rounded-bl-xs'
                        }`}
                      >
                        {msg.text}
                        {msg.intent_action && (
                          <div className="mt-1 pt-1 border-t border-white/20 text-[9px] font-mono opacity-70">
                            Intent: {msg.intent_action}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-white border-t border-palette-silver flex items-center justify-between">
              <span className="text-[11px] text-palette-slate font-medium">
                Dữ liệu lưu tự động trong CSDL bảng <code>chat_messages</code>
              </span>
              <button
                type="button"
                onClick={() => setSelectedTranscriptFb(null)}
                className="px-4 py-1.5 rounded-lg bg-palette-stone hover:bg-palette-silver text-palette-charcoal font-bold text-xs transition-colors cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INCOMING CALL RINGING MODAL FOR STAFF (FACE-TIME / MESSENGER STYLE) */}
      {activeSession && activeSession.status === 'Pending' && !isVideoModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-neutral-900 border border-emerald-500/50 rounded-3xl p-6 max-w-sm w-full text-center space-y-5 shadow-2xl text-white">
            <div className="relative mx-auto w-20 h-20 rounded-full bg-emerald-600/20 border-2 border-emerald-500 flex items-center justify-center animate-pulse">
              <PhoneCall className="w-10 h-10 text-emerald-400 animate-bounce" />
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-mono font-bold tracking-widest text-emerald-400 uppercase bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-800">
                CUỘC GỌI ĐẾN TỪ ROBOT KIOSK
              </span>
              <h3 className="text-lg font-black text-white pt-1">
                {activeSession.guest_name || 'Khách tại Sảnh'}
              </h3>
              <p className="text-xs text-neutral-400 font-medium">
                Vị trí: {activeSession.room_number || 'Main Lobby Kiosk'} • Mã: {activeSession.ticket_code}
              </p>
            </div>

            <p className="text-xs text-neutral-300 bg-neutral-800/80 p-3 rounded-2xl border border-neutral-700 italic">
              "{activeSession.description || 'Khách bấm gọi hỗ trợ trực tiếp từ màn hình Robot Concierge'}"
            </p>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => handleUpdateStatus('Closed')}
                className="flex-1 py-3 rounded-2xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold text-xs transition-colors cursor-pointer"
              >
                Từ chối
              </button>
              <button
                type="button"
                onClick={async () => {
                  await handleUpdateStatus('Connected');
                  setIsVideoModalOpen(true);
                }}
                className="flex-1 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-black text-xs transition-all shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2 cursor-pointer active:scale-95 animate-pulse"
              >
                <PhoneCall className="w-4 h-4" />
                <span>Trả Lời Ngay</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MESSENGER VIDEO CALL MODAL (STAFF CALLEE ROLE) */}
      <MessengerVideoCallModal
        isOpen={isVideoModalOpen}
        sessionId={activeSession?.ticket_code || activeSession?.id || 'SUP-STAFF'}
        role="staff"
        callerName={activeSession?.guest_name || 'Khách hàng'}
        calleeName={currentUser?.full_name || 'Nhân viên hỗ trợ'}
        roomNumber={activeSession?.room_number || ''}
        ticketCode={activeSession?.ticket_code}
        guestLanguage={activeSession?.language || 'Tiếng Việt'}
        onClose={async () => {
          setIsVideoModalOpen(false);
          if (activeSession && activeSession.status === 'Connected') {
            await handleUpdateStatus('Closed');
          }
          loadData();
        }}
        onCallEnded={async (recordRes) => {
          console.log('[ConciergeDashboard] Staff call ended:', recordRes);
          setIsVideoModalOpen(false);
          if (activeSession && activeSession.status === 'Connected') {
            await handleUpdateStatus('Closed');
          }
          loadData();
        }}
      />
    </div>
  );
};
