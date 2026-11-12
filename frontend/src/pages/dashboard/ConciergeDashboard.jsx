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
  MessageCircle,
  AlertTriangle,
  User,
  ShieldAlert,
  CheckCircle2,
  X,
} from 'lucide-react';
import {
  fetchConciergeDashboard,
  createConciergeRequest,
  updateConciergeRequest,
  fetchHumanSupportSessions,
  fetchConciergeEmotionAlerts,
  createConciergeEmotionAlert,
  updateConciergeEmotionAlertStatus,
} from '../../services/conciergeApi';
import { fetchFeedbacks, fetchSessionMessages } from '../../services/aiApi';
import { MessengerVideoCallModal } from '../../components/video/MessengerVideoCallModal';
import { ConciergeTaxiBookingModal } from '../../components/dashboard/concierge/ConciergeTaxiBookingModal';
import { ConciergeTestCallModal } from '../../components/dashboard/concierge/ConciergeTestCallModal';
import { handleNumericKeyDown, handleNumberInputBlockExponent, sanitizeDigitsOnly } from '../../utils/numberInputHelper';
import { Pagination } from '../../components/common/Pagination';
import { StaffPageHeader } from '../../components/dashboard/RoomServiceFrame';
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
  const [activeCallSessionId, setActiveCallSessionId] = useState(null);
  const [activeCallSession, setActiveCallSession] = useState(null);
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

  // Emotion Alerts (Xử lý khách có biểu cảm khó chịu) states
  const [emotionAlerts, setEmotionAlerts] = useState([]);
  const [emotionFilter, setEmotionFilter] = useState('All');
  const [emotionAlertsPage, setEmotionAlertsPage] = useState(1);
  const [isEmotionModalOpen, setIsEmotionModalOpen] = useState(false);
  const [isSavingEmotion, setIsSavingEmotion] = useState(false);
  const [emotionForm, setEmotionForm] = useState({
    location: 'Main Lobby Kiosk',
    guestName: '',
    emotionType: 'Khó chịu (Unhappy)',
    description: '',
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

  const normalizeEmotionStatus = (statusStr) => {
    const lower = (statusStr || 'Pending').toLowerCase();
    if (lower === 'completed' || lower === 'closed' || lower === 'done') return 'Completed';
    if (lower === 'in progress' || lower === 'in_progress') return 'In Progress';
    return 'Pending';
  };

  const activeEmotionAlerts = useMemo(() => {
    return emotionAlerts.filter((a) => normalizeEmotionStatus(a.status) !== 'Completed');
  }, [emotionAlerts]);

  const filteredEmotionAlerts = useMemo(() => {
    return emotionAlerts.filter((a) => {
      if (emotionFilter === 'All') return true;
      return normalizeEmotionStatus(a.status) === emotionFilter;
    });
  }, [emotionAlerts, emotionFilter]);

  const totalEmotionAlertsPages = Math.max(1, Math.ceil(filteredEmotionAlerts.length / pageSize));

  useEffect(() => {
    setEmotionAlertsPage(1);
  }, [emotionFilter]);

  useEffect(() => {
    if (emotionAlertsPage > totalEmotionAlertsPages) setEmotionAlertsPage(totalEmotionAlertsPages);
  }, [emotionAlertsPage, totalEmotionAlertsPages]);

  const paginatedEmotionAlerts = useMemo(() => {
    const start = (emotionAlertsPage - 1) * pageSize;
    return filteredEmotionAlerts.slice(start, start + pageSize);
  }, [filteredEmotionAlerts, emotionAlertsPage, pageSize]);

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
      const [conciergeData, taxiDashData, taxiReqsData, sessionsData, feedbacksData, emotionData] = await Promise.all([
        fetchConciergeDashboard(),
        fetchTaxiDashboard(),
        fetchTaxiRequests(),
        fetchHumanSupportSessions(),
        fetchFeedbacks(),
        fetchConciergeEmotionAlerts(),
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
      if (Array.isArray(emotionData)) {
        setEmotionAlerts(emotionData);
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

  const handleAcceptCall = (session = activeSession) => {
    if (!session) return;
    const targetId = session.ticket_code || session.id;
    setActiveCallSessionId(targetId);
    setActiveCallSession(session);
    setIsVideoModalOpen(true);

    const reqId = session.id || session.ticket_code;
    if (reqId) {
      updateConciergeRequest(reqId, {
        status: 'Connected',
        assigned_staff_name: currentUser?.full_name || 'Concierge Specialist',
      }).catch(() => {});
    }
  };

  const handleFinishCall = async () => {
    setIsVideoModalOpen(false);
    const targetId = activeCallSessionId || activeSession?.ticket_code || activeSession?.id;
    setActiveCallSessionId(null);
    setActiveCallSession(null);
    setActiveSession(null);
    if (targetId) {
      await updateConciergeRequest(targetId, {
        status: 'Closed',
        assigned_staff_name: currentUser?.full_name || 'Concierge Specialist',
      }).catch(() => {});
    }
    await loadData();
  };

  const handleUpdateStatus = async (status) => {
    if (!activeSession) return;
    const reqId = activeSession.id || activeSession.ticket_code;
    
    // Optimistic UI: nếu từ chối hoặc đóng cuộc gọi, lập tức tắt modal
    if (status === 'Closed' || status === 'Completed' || status === 'Cancelled') {
      setActiveSession(null);
      setIsVideoModalOpen(false);
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

  // --- EMOTION ALERT HANDLERS (XỬ LÝ KHÁCH HÀNG KHÓ CHỊU) ---
  const staffDisplayName = currentUser?.full_name || currentUser?.name || 'Concierge Specialist';

  const handleAcceptEmotionAlert = async (alertId) => {
    setEmotionAlerts((prev) =>
      prev.map((a) =>
        a.id === alertId || a.ticket_code === alertId
          ? { ...a, status: 'In Progress', assigned_to: staffDisplayName }
          : a
      )
    );
    const res = await updateConciergeEmotionAlertStatus(alertId, {
      status: 'In Progress',
      assigned_to: staffDisplayName,
    });
    if (res) {
      onNotify(`Concierge đã tiếp nhận xử lý khẩn khách khó chịu (${alertId})`);
      loadData();
    }
  };

  const handleCompleteEmotionAlert = async (alertId) => {
    setEmotionAlerts((prev) =>
      prev.map((a) =>
        a.id === alertId || a.ticket_code === alertId
          ? { ...a, status: 'Completed', assigned_to: staffDisplayName }
          : a
      )
    );
    const res = await updateConciergeEmotionAlertStatus(alertId, {
      status: 'Completed',
      assigned_to: staffDisplayName,
    });
    if (res) {
      onNotify(`Đã xoa dịu và hỗ trợ hoàn tất khách hàng (${alertId})`);
      loadData();
    }
  };

  const handleCreateEmotionAlert = async (e) => {
    e.preventDefault();
    setIsSavingEmotion(true);
    try {
      const loc = emotionForm.location.trim() || 'Main Lobby Kiosk';
      const guest = emotionForm.guestName.trim() || 'Khách tại Sảnh Kiosk';
      const created = await createConciergeEmotionAlert({
        title: `Cảnh báo khách có biểu cảm khó chịu (${emotionForm.emotionType})`,
        location: loc,
        guest_name: guest,
        reporter: `HCRobot Emotion AI / Concierge (${staffDisplayName})`,
        description:
          emotionForm.description.trim() ||
          `Phát hiện khách hàng có biểu cảm ${emotionForm.emotionType} tại ${loc}. Cần nhân viên Concierge tiếp cận hỏi thăm, xoa dịu và hỗ trợ trực tiếp ngay.`,
        emotion_type: emotionForm.emotionType,
      });
      if (created) {
        onNotify(`Đã ghi nhận cảnh báo khách khó chịu #${created.ticket_code || created.id}`);
        setIsEmotionModalOpen(false);
        setEmotionForm({
          location: 'Main Lobby Kiosk',
          guestName: '',
          emotionType: 'Khó chịu (Unhappy)',
          description: '',
        });
        loadData();
      }
    } finally {
      setIsSavingEmotion(false);
    }
  };

  return (
    <div className="staff-page-body flex-1 overflow-y-auto custom-scrollbar font-sans">
      <div className="staff-page-container space-y-5">
        <StaffPageHeader className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="min-w-0">
            <h1>
              {activeSubTab === 'emotion_alerts'
                ? 'Xử Lý Khi Khách Có Biểu Cảm Khó Chịu'
                : activeSubTab === 'recordings'
                ? 'Lịch Sử Cuộc Gọi & Bản Ghi Video'
                : activeSubTab === 'taxi'
                ? 'Tiếp Nhận & Gọi Xe Taxi Cho Khách'
                : activeSubTab === 'feedback'
                ? 'Đánh Giá Dịch Vụ'
                : 'Tổng Đài Can Thiệp Trực Tuyến Live Call'}
            </h1>
            <p>
              {activeSubTab === 'emotion_alerts'
                ? 'Tiếp nhận cảnh báo từ Camera AI Robot Kiosk để nhân viên Concierge nhanh chóng tiếp cận, xoa dịu và hỗ trợ trực tiếp'
                : activeSubTab === 'recordings'
                ? 'Danh sách video ghi hình tự động các phiên hỗ trợ trực tiếp giữa Robot Kiosk và Nhân viên'
                : activeSubTab === 'taxi'
                ? 'Tiếp nhận yêu cầu xe, điều phối tài xế và theo dõi lộ trình di chuyển của khách'
                : activeSubTab === 'feedback'
                ? 'Theo dõi mức độ hài lòng của khách hàng và hỗ trợ dịch vụ kịp thời'
                : 'Tiếp nhận cuộc gọi video hỗ trợ tức thì từ màn hình Robot Kiosk của khách hàng'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadData}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 rounded border border-[#BFBFBD] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#403D39] hover:bg-[#F0EFEC] cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Làm mới</span>
            </button>
            {activeSubTab === 'live_call' && (
              <button
                type="button"
                onClick={() => setIsTestModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#262626] hover:bg-[#404040] px-3 py-1.5 text-[11px] font-bold text-white cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Mô phỏng gọi</span>
              </button>
            )}
            {activeSubTab === 'emotion_alerts' && (
              <button
                type="button"
                onClick={() => setIsEmotionModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#262626] hover:bg-[#404040] px-3 py-1.5 text-[11px] font-bold text-white cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Ghi nhận khách khó chịu</span>
              </button>
            )}
            {activeSubTab === 'taxi' && (
              <button
                type="button"
                onClick={() => setIsTaxiModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#262626] hover:bg-[#404040] px-3 py-1.5 text-[11px] font-bold text-white cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Đặt xe mới</span>
              </button>
            )}
          </div>
        </StaffPageHeader>

        {/* Tab Navigation (Fallback when rendered standalone outside StaffLayout) */}
        {!isManagedFromSidebar && (
          <div className="reception-tabs">
            <button
              type="button"
              aria-pressed={activeSubTab === 'live_call'}
              onClick={() => setInternalSubTab('live_call')}
            >
              <PhoneCall className="w-3.5 h-3.5" />
              <span>Tổng đài Live Call</span>
              {activeCount > 0 && (
                <span className="bg-emerald-600 text-white text-[10px] px-1.5 py-0.2 rounded-full">
                  {activeCount}
                </span>
              )}
            </button>

            <button
              type="button"
              aria-pressed={activeSubTab === 'recordings'}
              onClick={() => setInternalSubTab('recordings')}
            >
              <Film className="w-3.5 h-3.5" />
              <span>Bản Ghi Cuộc Gọi</span>
              {recordedSessions.filter((s) => s.recording_url).length > 0 && (
                <span className="bg-sky-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                  {recordedSessions.filter((s) => s.recording_url).length}
                </span>
              )}
            </button>

            <button
              type="button"
              aria-pressed={activeSubTab === 'taxi'}
              onClick={() => setInternalSubTab('taxi')}
            >
              <Car className="w-3.5 h-3.5" />
              <span>Yêu cầu gọi Taxi</span>
              {taxiKpis.pendingRequests > 0 && (
                <span className="bg-[#E9E5DC] text-[#262626] border border-[#BFBFBD] text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                  {taxiKpis.pendingRequests}
                </span>
              )}
            </button>

            <button
              type="button"
              aria-pressed={activeSubTab === 'feedback'}
              onClick={() => setInternalSubTab('feedback')}
            >
              <Star className="w-3.5 h-3.5" />
              <span>Đánh Giá Dịch Vụ</span>
              {feedbacks.filter((f) => f.rating <= 3).length > 0 && (
                <span className="bg-rose-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                  {feedbacks.filter((f) => f.rating <= 3).length}
                </span>
              )}
            </button>

            <button
              type="button"
              aria-pressed={activeSubTab === 'emotion_alerts'}
              onClick={() => setInternalSubTab('emotion_alerts')}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Xử lý khách khó chịu</span>
              {activeEmotionAlerts.length > 0 && (
                <span className="bg-rose-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                  {activeEmotionAlerts.length}
                </span>
              )}
            </button>
          </div>
        )}

        {/* Urgent Banner when Robot AI detects an unhappy guest */}
        {activeEmotionAlerts.length > 0 && (
          <section className="rounded-xl bg-rose-50 border border-rose-300 px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-rose-100 text-rose-700 shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-[13px] font-bold text-rose-900">
                  Cảnh báo AI Concierge: Phát hiện {activeEmotionAlerts.length} khách hàng đang có biểu cảm khó chịu cần hỗ trợ trực tiếp!
                </h3>
                <p className="text-[12px] text-rose-800 mt-0.5">
                  {activeEmotionAlerts[0].location} ({activeEmotionAlerts[0].guest_name || 'Khách tại Sảnh Kiosk'}): &ldquo;{activeEmotionAlerts[0].description}&rdquo;
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {normalizeEmotionStatus(activeEmotionAlerts[0].status) === 'Pending' ? (
                <button
                  type="button"
                  onClick={() => handleAcceptEmotionAlert(activeEmotionAlerts[0].id)}
                  className="rounded-lg bg-rose-600 hover:bg-rose-700 text-white px-3.5 py-2 text-[11px] font-bold cursor-pointer"
                >
                  Tiếp nhận &amp; Ra hỗ trợ ngay
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleCompleteEmotionAlert(activeEmotionAlerts[0].id)}
                  className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 text-[11px] font-bold cursor-pointer"
                >
                  Đã xoa dịu &amp; Xử lý xong
                </button>
              )}
              {!isManagedFromSidebar && activeSubTab !== 'emotion_alerts' && (
                <button
                  type="button"
                  onClick={() => setInternalSubTab('emotion_alerts')}
                  className="rounded-lg bg-white border border-rose-300 text-rose-800 hover:bg-rose-100 px-3 py-2 text-[11px] font-semibold cursor-pointer"
                >
                  Xem danh sách
                </button>
              )}
            </div>
          </section>
        )}

        {/* SUBTAB: EMOTION ALERTS (XỬ LÝ KHÁCH CÓ BIỂU CẢM KHÓ CHỊU) */}
        {activeSubTab === 'emotion_alerts' && (
          <div className="space-y-5">
            {/* KPI Summary Cards */}
            <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <article
                onClick={() => setEmotionFilter('All')}
                className={`bg-white rounded-xl border px-5 py-4 cursor-pointer transition-all ${
                  emotionFilter === 'All'
                    ? 'border-[#1A1917] ring-1 ring-[#1A1917]/20'
                    : 'border-[#E8E5E0] hover:border-[#BDB7AE]'
                }`}
              >
                <p className="text-[11px] font-semibold uppercase text-[#8C8C8C]">Tổng cảnh báo AI</p>
                <p className="text-[22px] font-bold text-[#262626] mt-2">{emotionAlerts.length}</p>
              </article>

              <article
                onClick={() => setEmotionFilter('Pending')}
                className={`bg-white rounded-xl border px-5 py-4 cursor-pointer transition-all ${
                  emotionFilter === 'Pending'
                    ? 'border-rose-600 ring-1 ring-rose-500/20'
                    : 'border-[#E8E5E0] hover:border-[#BDB7AE]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase text-rose-700">Chờ tiếp cận ngay</p>
                  {emotionAlerts.filter((a) => normalizeEmotionStatus(a.status) === 'Pending').length > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold">
                      Khẩn
                    </span>
                  )}
                </div>
                <p className="text-[22px] font-bold text-rose-600 mt-2">
                  {emotionAlerts.filter((a) => normalizeEmotionStatus(a.status) === 'Pending').length}
                </p>
              </article>

              <article
                onClick={() => setEmotionFilter('In Progress')}
                className={`bg-white rounded-xl border px-5 py-4 cursor-pointer transition-all ${
                  emotionFilter === 'In Progress'
                    ? 'border-sky-600 ring-1 ring-sky-500/20'
                    : 'border-[#E8E5E0] hover:border-[#BDB7AE]'
                }`}
              >
                <p className="text-[11px] font-semibold uppercase text-sky-700">Đang trực tiếp xoa dịu</p>
                <p className="text-[22px] font-bold text-sky-600 mt-2">
                  {emotionAlerts.filter((a) => normalizeEmotionStatus(a.status) === 'In Progress').length}
                </p>
              </article>

              <article
                onClick={() => setEmotionFilter('Completed')}
                className={`bg-white rounded-xl border px-5 py-4 cursor-pointer transition-all ${
                  emotionFilter === 'Completed'
                    ? 'border-emerald-600 ring-1 ring-emerald-500/20'
                    : 'border-[#E8E5E0] hover:border-[#BDB7AE]'
                }`}
              >
                <p className="text-[11px] font-semibold uppercase text-emerald-700">Đã hỗ trợ hài lòng</p>
                <p className="text-[22px] font-bold text-emerald-600 mt-2">
                  {emotionAlerts.filter((a) => normalizeEmotionStatus(a.status) === 'Completed').length}
                </p>
              </article>
            </section>

            {/* Alert List */}
            <div className="bg-white rounded-xl border border-[#BFBFBD] overflow-hidden">
              <div className="px-5 py-4 border-b border-[#E9E5DC] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-[13px] font-semibold text-[#403D39]">
                    Danh Sách Cảnh Báo &amp; Xử Lý Khách Có Biểu Cảm Khó Chịu
                  </h3>
                  <p className="text-[11px] text-[#77736E] mt-0.5">
                    Ưu tiên các trường hợp phát hiện mới nhất từ Robot Kiosk
                  </p>
                </div>

                <div className="staff-request-filters" role="group" aria-label="Lọc cảnh báo">
                  {[
                    { id: 'All', label: 'Tất cả' },
                    { id: 'Pending', label: 'Chờ hỗ trợ' },
                    { id: 'In Progress', label: 'Đang xử lý' },
                    { id: 'Completed', label: 'Đã hoàn tất' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      aria-pressed={emotionFilter === tab.id}
                      onClick={() => setEmotionFilter(tab.id)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {filteredEmotionAlerts.length === 0 ? (
                <div className="p-10 text-center text-[12px] text-[#777] space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600/50 mx-auto" />
                  <p className="font-semibold text-[#403D39]">
                    Không có cảnh báo khách hàng khó chịu nào trong mục này.
                  </p>
                  <p className="text-[11px]">
                    Khi Camera AI trên Robot Kiosk nhận diện khách chưa hài lòng, cảnh báo sẽ tự động xuất hiện tại đây.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-[#EFECE6]">
                  {paginatedEmotionAlerts.map((alert) => {
                    const stNorm = normalizeEmotionStatus(alert.status);
                    const isPending = stNorm === 'Pending';
                    const isInProgress = stNorm === 'In Progress';
                    const alertKey = alert.id || alert.ticket_code;
                    return (
                      <div
                        key={alertKey}
                        className="px-5 py-4 hover:bg-[#FAF9F6] transition-all"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          <div className="space-y-1.5 flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-[11px] font-bold text-[#1A1917] bg-[#F4F3F0] px-2 py-0.5 rounded border border-[#E2DFD9]">
                                #{alert.ticket_code || alert.id}
                              </span>
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                                <AlertTriangle className="w-3 h-3" />
                                <span>Khách có biểu cảm khó chịu</span>
                              </span>
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#555]">
                                <MapPin className="w-3 h-3 text-[#888]" />
                                <span>{alert.location || 'Main Lobby Kiosk'}</span>
                              </span>
                            </div>

                            <h4 className="text-[14px] font-bold text-[#2B2927] break-words">
                              {alert.title}
                            </h4>

                            <div className="flex flex-wrap items-center gap-3 text-[12px] text-[#666]">
                              <span className="inline-flex items-center gap-1 font-medium text-[#3F3B38]">
                                <User className="w-3.5 h-3.5 text-[#777]" />
                                <span>{alert.guest_name || 'Khách tại Sảnh Kiosk'}</span>
                              </span>
                              {alert.reporter && <span className="text-[#888]">• Nguồn: {alert.reporter}</span>}
                              {alert.assigned_to && (
                                <span className="text-emerald-700 font-semibold">
                                  • Concierge phụ trách: {alert.assigned_to}
                                </span>
                              )}
                            </div>

                            {alert.description && (
                              <p className="text-[12px] text-[#444] bg-[#FAF9F6] border border-[#EFECE6] rounded-lg p-2.5 mt-1">
                                {alert.description}
                              </p>
                            )}
                          </div>

                          <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0">
                            <span
                              className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                                stNorm === 'Completed'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : isInProgress
                                  ? 'bg-sky-100 text-sky-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {stNorm === 'Completed'
                                ? 'Đã hoàn tất'
                                : isInProgress
                                ? 'Đang xử lý'
                                : 'Chờ tiếp cận'}
                            </span>
                            <span className="text-[11px] font-mono text-[#777] flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {alert.created_at
                                ? new Date(alert.created_at).toLocaleString('vi-VN')
                                : 'Vừa xong'}
                            </span>
                          </div>
                        </div>

                        <div className="mt-3 pt-3 border-t border-[#E9E5DC] flex flex-wrap items-center justify-between gap-2">
                          <span className="text-[11px] text-[#777]">
                            {isPending
                              ? 'Ưu tiên cao: Cần nhân viên Concierge tiếp cận hỗ trợ khách ngay'
                              : isInProgress
                              ? 'Concierge đang trực tiếp hỗ trợ & xoa dịu khách hàng tại sảnh/kiosk'
                              : 'Khách đã hài lòng và được hỗ trợ hoàn tất'}
                          </span>

                          <div className="flex items-center gap-2">
                            {isPending && (
                              <button
                                type="button"
                                onClick={() => handleAcceptEmotionAlert(alertKey)}
                                className="rounded-lg bg-rose-600 hover:bg-rose-700 px-4 py-1.5 text-[11px] font-bold text-white cursor-pointer"
                              >
                                Tiếp nhận &amp; Ra hỗ trợ ngay
                              </button>
                            )}
                            {isInProgress && (
                              <button
                                type="button"
                                onClick={() => handleCompleteEmotionAlert(alertKey)}
                                className="rounded-lg bg-emerald-600 hover:bg-emerald-700 px-4 py-1.5 text-[11px] font-bold text-white cursor-pointer"
                              >
                                Đã xoa dịu &amp; Xử lý xong
                              </button>
                            )}
                            {stNorm === 'Completed' && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded border border-emerald-200">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Hoàn tất
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {filteredEmotionAlerts.length > 0 && (
                <Pagination
                  currentPage={emotionAlertsPage}
                  totalItems={filteredEmotionAlerts.length}
                  pageSize={pageSize}
                  onPageChange={setEmotionAlertsPage}
                  itemName="cảnh báo"
                />
              )}
            </div>
          </div>
        )}

        {/* SUBTAB 1: LIVE CALL */}
        {activeSubTab === 'live_call' && (
          <div className="space-y-4">
            {/* Live Call Metric Banner */}
            <div className="flex items-center gap-3 bg-white border border-[#BFBFBD] rounded-xl px-4 py-3">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <div className="flex-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5">
                <span className="text-[12px] font-semibold text-[#262626]">
                  Trạng thái Trực Tổng Đài: Sẵn Sàng (Live Concierge Online)
                </span>
                <span className="text-[11px] text-[#777]">
                  Đang có <strong className="text-[#262626]">{activeCount}</strong> phiên hỗ trợ cần xử lý
                </span>
              </div>
            </div>

            {activeSession ? (
              <div className="max-w-3xl mx-auto bg-white rounded-xl border border-[#BFBFBD] p-5">
                <div className="flex items-start justify-between border-b border-[#E9E5DC] pb-3.5">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] font-bold bg-[#F4F3F0] text-[#1A1917] border border-[#E2DFD9] px-2 py-0.5 rounded">
                        {activeSession.ticket_code || activeSession.id}
                      </span>
                      <span className="text-[13px] font-bold text-[#262626]">
                        {activeSession.guest_name || 'Khách tại Kiosk'}
                      </span>
                      <span className="text-[12px] text-[#777]">
                        ({activeSession.room_number || 'Sảnh S1'})
                      </span>
                    </div>
                    <div className="text-[11px] text-[#777] mt-1 flex items-center gap-1.5">
                      <Clock className="w-3 h-3" />
                      <span>Khởi tạo: {activeSession.created_at || 'Vừa xong'}</span>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                      activeSession.status === 'Connected'
                        ? 'bg-emerald-100 text-emerald-800'
                        : activeSession.status === 'Closed'
                        ? 'bg-[#F0EFEC] text-[#777]'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {activeSession.status || 'Pending'}
                  </span>
                </div>

                {/* Conversation Transcript */}
                <div className="my-4">
                  <label className="text-[11px] font-bold text-[#403D39] uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Nội Dung Hội Thoại Chuyển Tiếp Từ Robot</span>
                  </label>
                  <div className="bg-[#FAF9F6] border border-[#EFECE6] rounded-lg p-3 text-[12px] text-[#262626] leading-relaxed max-h-40 sm:max-h-none overflow-y-auto">
                    {activeSession.description || 'Không có mô tả hội thoại.'}
                  </div>
                </div>

                {/* Action Bar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-3 border-t border-[#E9E5DC]">
                  <div className="hidden sm:flex items-center gap-2 text-[11px] text-[#777]">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Sẵn sàng kết nối video call trực tiếp</span>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    {activeSession.status !== 'Connected' && activeSession.status !== 'Closed' && (
                      <button
                        type="button"
                        onClick={() => handleAcceptCall(activeSession)}
                        className="flex-1 sm:flex-initial w-full sm:w-auto px-5 py-3 sm:py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 cursor-pointer"
                      >
                        <Video className="w-4 h-4" />
                        <span>Tiếp nhận cuộc gọi Video</span>
                      </button>
                    )}

                    {activeSession.status === 'Connected' && (
                      <button
                        type="button"
                        onClick={() => handleAcceptCall(activeSession)}
                        className="flex-1 sm:flex-initial w-full sm:w-auto px-5 py-3 sm:py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 cursor-pointer"
                      >
                        <Video className="w-4 h-4" />
                        <span>Mở Màn Hình Cuộc Gọi</span>
                      </button>
                    )}

                    {activeSession.status === 'Connected' && (
                      <button
                        type="button"
                        onClick={handleFinishCall}
                        className="px-4 py-3 sm:py-2 rounded-xl bg-neutral-700 hover:bg-neutral-800 active:bg-neutral-900 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 cursor-pointer"
                      >
                        <PhoneOff className="w-4 h-4" />
                        <span>Kết thúc</span>
                      </button>
                    )}

                    {activeSession.status === 'Closed' && (
                      <span className="text-[12px] text-[#777] font-semibold">
                        Phiên hỗ trợ này đã hoàn tất.
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="max-w-md mx-auto my-8 bg-white rounded-xl border border-[#BFBFBD] p-8 text-center">
                <PhoneCall className="w-10 h-10 text-[#A8A29E] mx-auto mb-3" />
                <h2 className="text-[14px] font-bold text-[#262626]">Không có cuộc gọi Live Call nào</h2>
                <p className="text-[12px] text-[#777] mt-1">
                  Robot Kiosk hiện chưa phát tín hiệu can thiệp trực tiếp từ khách hàng.
                </p>
                <button
                  type="button"
                  onClick={() => setIsTestModalOpen(true)}
                  className="mt-4 px-3.5 py-2 rounded-lg bg-[#262626] hover:bg-[#404040] text-white text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer"
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
          <div className="space-y-5">
            <div className="bg-white rounded-xl border border-[#BFBFBD] overflow-hidden">
              <div className="px-5 py-4 border-b border-[#E9E5DC] flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-[13px] font-semibold text-[#403D39]">
                    Lịch Sử Cuộc Gọi & Bản Ghi Video (Human Support Sessions)
                  </h3>
                  <p className="text-[11px] text-[#77736E] mt-0.5">
                    Các cuộc gọi video hỗ trợ trực tiếp giữa Robot Kiosk và Nhân viên được ghi hình tự động.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={loadData}
                  className="px-2.5 py-1 text-[11px] font-semibold rounded border border-[#BFBFBD] bg-white hover:bg-[#F0EFEC] flex items-center gap-1 text-[#403D39] cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                  Làm mới
                </button>
              </div>

              {recordedSessions.length === 0 ? (
                <div className="p-10 text-center text-[12px] text-[#777]">
                  Chưa có bản ghi cuộc gọi nào. Khi khách gọi qua Robot Kiosk, video sẽ tự động xuất hiện ở đây.
                </div>
              ) : (
                <div className="divide-y divide-[#EFECE6]">
                  {paginatedRecordings.map((session) => (
                    <div
                      key={session.id}
                      className="px-5 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 hover:bg-[#FAF9F6] transition-all"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-mono font-bold bg-[#F4F3F0] text-[#1A1917] px-2 py-0.5 rounded border border-[#E2DFD9]">
                            {session.session_code || session.id}
                          </span>
                          <span className="text-[13px] font-bold text-[#262626]">{session.guest_name}</span>
                          <span className="text-[11px] text-[#777]">({session.room_number})</span>
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

                        <div className="text-[11px] text-[#666] flex flex-wrap items-center gap-4 pt-1">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {session.created_at ? new Date(session.created_at).toLocaleString('vi-VN') : 'Vừa xong'}
                          </span>
                          <span className="flex items-center gap-1">
                            <Disc className="w-3.5 h-3.5 text-red-500" />
                            Thời lượng: <strong className="font-semibold text-[#262626]">{session.recording_duration || 0}s</strong>
                          </span>
                          {session.recording_url && (
                            <span className="flex items-center gap-1 text-sky-700 font-semibold">
                              <Cloud className="w-3.5 h-3.5" />
                              Cloudinary Cloud Storage
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {session.recording_status === 'saving' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                            Đang lưu bản ghi...
                          </span>
                        ) : session.recording_status === 'failed' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
                            Lưu thất bại
                          </span>
                        ) : session.recording_url ? (
                          <>
                            <button
                              type="button"
                              onClick={() => setPlayingVideo(session)}
                              className="px-3 py-1.5 rounded-lg bg-[#262626] hover:bg-[#404040] text-white text-[11px] font-bold flex items-center gap-1.5 cursor-pointer"
                            >
                              <Play className="w-3.5 h-3.5 fill-current" />
                              Xem Bản Ghi
                            </button>
                            <a
                              href={session.recording_url}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 rounded-lg border border-[#BFBFBD] hover:bg-[#F0EFEC] text-[#555] hover:text-[#262626] transition-all"
                              title="Mở tab Cloudinary mới"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          </>
                        ) : (
                          <span className="text-[11px] text-[#777] italic">Đang diễn ra hoặc chưa lưu video</span>
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
                />
              )}
            </div>
          </div>
        )}

        {/* SUBTAB 2: TAXI & TRANSPORTATION */}
        {activeSubTab === 'taxi' && (
          <div className="space-y-5">
            {/* Metric KPI Cards */}
            <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <article className="bg-white rounded-xl border border-[#E8E5E0] px-5 py-4">
                <p className="text-[11px] font-semibold uppercase text-[#8C8C8C]">Tổng yêu cầu</p>
                <p className="text-[22px] font-bold text-[#262626] mt-2">
                  {taxiRequests.length || taxiKpis.totalRequests}
                </p>
              </article>
              <article className="bg-white rounded-xl border border-[#E8E5E0] px-5 py-4">
                <p className="text-[11px] font-semibold uppercase text-amber-700">Chờ tiếp nhận</p>
                <p className="text-[22px] font-bold text-[#262626] mt-2">
                  {taxiRequests.filter((r) => {
                    const st = (r.status || '').toLowerCase();
                    return st === 'pending' || st === 'unassigned' || st === 'chờ tiếp nhận' || st === 'missed';
                  }).length || taxiKpis.pendingRequests}
                </p>
              </article>
              <article className="bg-white rounded-xl border border-[#E8E5E0] px-5 py-4">
                <p className="text-[11px] font-semibold uppercase text-sky-700">Đang gọi xe</p>
                <p className="text-[22px] font-bold text-sky-600 mt-2">
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
                </p>
              </article>
              <article className="bg-white rounded-xl border border-[#E8E5E0] px-5 py-4">
                <p className="text-[11px] font-semibold uppercase text-emerald-700">Gọi thành công</p>
                <p className="text-[22px] font-bold text-emerald-600 mt-2">
                  {taxiRequests.filter((r) => {
                    const st = (r.status || '').toLowerCase();
                    return st === 'completed' || st === 'thành công' || st === 'success' || st === 'done' || st === 'closed';
                  }).length || taxiKpis.completedTrips}
                </p>
              </article>
            </section>

            {/* Taxi Request List */}
            <div className="bg-white rounded-xl border border-[#BFBFBD] overflow-hidden">
              <div className="px-5 py-4 border-b border-[#E9E5DC] flex items-center justify-between gap-3">
                <span className="text-[13px] font-semibold text-[#403D39]">Danh Sách Yêu Cầu Gọi Xe Taxi</span>
                <span className="text-[11px] text-[#77736E]">Hiển thị {taxiRequests.length} yêu cầu</span>
              </div>

              {taxiRequests.length === 0 ? (
                <div className="p-10 text-center text-[12px] text-[#777]">
                  Hiện chưa có yêu cầu gọi taxi nào trong hệ thống.
                </div>
              ) : (
                <div className="divide-y divide-[#EFECE6]">
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
                        className="px-5 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 hover:bg-[#FAF9F6] transition-all"
                      >
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[11px] font-mono font-bold text-[#1A1917] bg-[#F4F3F0] border border-[#E2DFD9] px-2 py-0.5 rounded">
                              {trip.ticket_code || trip.id}
                            </span>
                            <span className="text-[13px] font-bold text-[#262626]">{trip.guest_name}</span>
                            {trip.room_number && (
                              <span className="text-[11px] text-[#777]">(Phòng {trip.room_number})</span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-4 text-[12px] text-[#666] mt-2">
                            <span className="flex items-center gap-1 text-[#262626]">
                              <MapPin className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                              Đón: <strong className="font-semibold">{trip.pickup_location}</strong>
                            </span>
                            <span className="flex items-center gap-1 text-[#262626]">
                              <Navigation className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                              Đến: <strong className="font-semibold">{trip.destination}</strong>
                            </span>
                            <span className="flex items-center gap-1 text-[#777]">
                              <Clock className="w-3.5 h-3.5 shrink-0" />
                              {trip.pickup_time || 'Ngay bây giờ'}
                            </span>
                            <span className="flex items-center gap-1 text-[#777]">
                              <Car className="w-3.5 h-3.5 shrink-0" />
                              {trip.vehicle_type || '4 chỗ'} ({trip.party_size || 2} khách)
                            </span>
                          </div>

                          {trip.notes && (
                            <div className="mt-2 text-[11px] text-[#666] italic">
                              Ghi chú: {trip.notes}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 self-start md:self-center shrink-0">
                          {/* Status Badge */}
                          <span
                            className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${
                              isCompleted
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : isCalling
                                ? 'bg-sky-50 text-sky-800 border-sky-200'
                                : isCancelled
                                ? 'bg-neutral-100 text-neutral-700 border-neutral-200'
                                : stLower === 'missed'
                                ? 'bg-amber-50 text-amber-800 border-amber-300'
                                : 'bg-amber-50 text-amber-800 border-amber-200'
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
                              type="button"
                              onClick={() => handleUpdateTaxiStatus(trip.id, 'Calling')}
                              className="px-3.5 py-2 text-[11px] font-bold rounded-lg bg-sky-600 hover:bg-sky-700 text-white transition-all flex items-center gap-1.5 cursor-pointer"
                              title="Concierge tiếp nhận và gọi xe cho khách"
                            >
                              <PhoneCall className="w-3.5 h-3.5" />
                              Nhận yêu cầu
                            </button>
                          )}

                          {/* Action Button 2: Khi đang Gọi -> Concierge gọi xong bấm Thành công */}
                          {isCalling && (
                            <button
                              type="button"
                              onClick={() => handleUpdateTaxiStatus(trip.id, 'Completed')}
                              className="px-3.5 py-2 text-[11px] font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-all flex items-center gap-1.5 cursor-pointer"
                              title="Xác nhận đã gọi taxi thành công cho khách"
                            >
                              <Check className="w-3.5 h-3.5" />
                              Thành công
                            </button>
                          )}

                          {isCompleted && (
                            <span className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1">
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
                />
              )}
            </div>
          </div>
        )}

        {/* SUBTAB 4: FEEDBACK & SERVICE RECOVERY */}
        {activeSubTab === 'feedback' && (
          <div className="space-y-5">
            {/* KPI Cards (Clickable Quick Filters) */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <article
                onClick={() => setFeedbackRatingFilter('all')}
                className={`bg-white rounded-xl border px-5 py-4 cursor-pointer transition-all ${
                  feedbackRatingFilter === 'all'
                    ? 'border-[#1A1917] ring-1 ring-[#1A1917]/20'
                    : 'border-[#E8E5E0] hover:border-[#BDB7AE]'
                }`}
                title="Nhấn để xem tất cả đánh giá"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase text-[#8C8C8C]">Tổng đánh giá</p>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                      feedbackRatingFilter === 'all'
                        ? 'bg-[#262626] text-white'
                        : 'bg-[#F4F3F0] text-[#777]'
                    }`}
                  >
                    Tất cả
                  </span>
                </div>
                <p className="text-[22px] font-bold text-[#262626] mt-2">{feedbacks.length}</p>
              </article>

              <article className="bg-white rounded-xl border border-[#E8E5E0] px-5 py-4">
                <p className="text-[11px] font-semibold uppercase text-[#8C8C8C]">Điểm trung bình</p>
                <div className="text-[22px] font-bold text-[#262626] mt-2 flex items-center gap-1.5">
                  <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                  <span>
                    {feedbacks.length > 0
                      ? (feedbacks.reduce((acc, cur) => acc + (cur.rating || 5), 0) / feedbacks.length).toFixed(1)
                      : '--'}
                  </span>
                  {feedbacks.length > 0 && (
                    <span className="text-[12px] text-[#777] font-normal">/ 5.0</span>
                  )}
                </div>
              </article>

              <article
                onClick={() => setFeedbackRatingFilter('satisfied')}
                className={`bg-white rounded-xl border px-5 py-4 cursor-pointer transition-all ${
                  feedbackRatingFilter === 'satisfied'
                    ? 'border-emerald-600 ring-1 ring-emerald-500/20'
                    : 'border-[#E8E5E0] hover:border-[#BDB7AE]'
                }`}
                title="Nhấn để lọc các đánh giá hài lòng (4 - 5 sao)"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase text-emerald-700">Hài lòng (4-5 sao)</p>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                      feedbackRatingFilter === 'satisfied'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-emerald-50 text-emerald-800'
                    }`}
                  >
                    4-5 sao
                  </span>
                </div>
                <p className="text-[22px] font-bold text-emerald-600 mt-2">
                  {feedbacks.filter((f) => f.rating >= 4).length}
                </p>
              </article>

              <article
                onClick={() => setFeedbackRatingFilter('recovery')}
                className={`bg-white rounded-xl border px-5 py-4 cursor-pointer transition-all ${
                  feedbackRatingFilter === 'recovery'
                    ? 'border-rose-600 ring-1 ring-rose-500/20'
                    : 'border-[#E8E5E0] hover:border-[#BDB7AE]'
                }`}
                title="Nhấn để lọc các đánh giá cần can thiệp (≤ 3 sao)"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase text-rose-700">Cần can thiệp (≤ 3 sao)</p>
                  {feedbacks.filter((f) => f.rating <= 3).length > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold">
                      Cần xử lý
                    </span>
                  )}
                </div>
                <p className="text-[22px] font-bold text-rose-600 mt-2">
                  {feedbacks.filter((f) => f.rating <= 3).length}
                </p>
              </article>
            </section>

            {/* Feedback List Card */}
            <div className="bg-white rounded-xl border border-[#BFBFBD] overflow-hidden">
              <div className="px-5 py-4 border-b border-[#E9E5DC] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div>
                  <h3 className="text-[13px] font-semibold text-[#403D39] flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-[#403D39]" />
                    Danh Sách Đánh Giá & Ý Kiến Khách Hàng Từ Robot Kiosk
                  </h3>
                  <div className="flex items-center gap-2 text-[11px] text-[#77736E] mt-0.5">
                    <span>Hiển thị <strong className="text-[#262626]">{filteredFeedbacks.length}</strong> / {feedbacks.length} phản hồi</span>
                    {feedbackRatingFilter !== 'all' && (
                      <button
                        type="button"
                        onClick={() => setFeedbackRatingFilter('all')}
                        className="text-sky-700 hover:underline font-semibold cursor-pointer"
                      >
                        (Xóa bộ lọc)
                      </button>
                    )}
                  </div>
                </div>

                {/* Rating Filter Pills */}
                <div className="staff-request-filters" role="group" aria-label="Lọc đánh giá">
                  {[
                    { id: 'all', label: 'Tất cả', count: feedbacks.length },
                    { id: 'recovery', label: 'Cần can thiệp', count: feedbacks.filter((f) => (f.rating || 5) <= 3).length },
                    { id: 'satisfied', label: 'Hài lòng (4-5 sao)', count: feedbacks.filter((f) => (f.rating || 5) >= 4).length },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      aria-pressed={feedbackRatingFilter === tab.id}
                      onClick={() => setFeedbackRatingFilter(tab.id)}
                    >
                      {tab.label} ({tab.count})
                    </button>
                  ))}
                </div>
              </div>

              {filteredFeedbacks.length === 0 ? (
                <div className="p-10 text-center text-[12px] text-[#777] space-y-2">
                  <p>
                    {feedbacks.length === 0
                      ? 'Chưa có đánh giá nào từ khách hàng tại Kiosk.'
                      : 'Không tìm thấy đánh giá nào phù hợp với bộ lọc hiện tại.'}
                  </p>
                  {feedbacks.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setFeedbackRatingFilter('all')}
                      className="px-3.5 py-1.5 rounded-lg bg-[#262626] hover:bg-[#404040] text-white text-[11px] font-semibold transition-all cursor-pointer"
                    >
                      Đặt lại bộ lọc
                    </button>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-[#EFECE6]">
                  {paginatedFeedbacks.map((fb) => {
                    const isBad = (fb.rating || 5) <= 3;
                    return (
                      <div
                        key={fb.id || fb.chat_session_id}
                        onClick={() => fb.chat_session_id && handleViewTranscript(fb)}
                        className={`px-5 py-4 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer ${
                          isBad
                            ? 'bg-rose-50/40 hover:bg-rose-50/70'
                            : 'hover:bg-[#FAF9F6]'
                        }`}
                        title={fb.chat_session_id ? 'Nhấn để xem chi tiết lịch sử hội thoại' : undefined}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3 min-w-0">
                          {/* Star Badge */}
                          <div
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border shrink-0 self-start sm:self-center ${
                              isBad
                                ? 'bg-rose-50 border-rose-200'
                                : 'bg-[#F4F3F0] border-[#E2DFD9]'
                            }`}
                          >
                            <Star className={`w-3.5 h-3.5 ${isBad ? 'text-rose-500 fill-rose-500' : 'text-amber-500 fill-amber-500'}`} />
                            <span className={`text-[11px] font-bold ${isBad ? 'text-rose-800' : 'text-[#262626]'}`}>
                              {fb.rating} / 5 Sao
                            </span>
                          </div>

                          {/* Info bar: Session ID, Room, Guest Name, Category */}
                          <div className="space-y-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 text-[12px]">
                              <span className="font-mono text-[11px] font-bold bg-[#F4F3F0] text-[#1A1917] px-2 py-0.5 rounded border border-[#E2DFD9]">
                                {fb.chat_session_id || fb.id || 'N/A'}
                              </span>
                              {fb.room_number && (
                                <span className="font-semibold bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded text-[11px]">
                                  Phòng {fb.room_number}
                                </span>
                              )}
                              {fb.guest_name && (
                                <span className="font-bold text-[#262626]">
                                  {fb.guest_name}
                                </span>
                              )}
                              {fb.category && (
                                <span className="text-[11px] px-2 py-0.5 rounded bg-[#F4F3F0] text-[#555] border border-[#E2DFD9]">
                                  {fb.category}
                                </span>
                              )}
                              {isBad && (
                                <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold">
                                  Cần can thiệp
                                </span>
                              )}
                            </div>

                            {/* Comment */}
                            {fb.comment && (
                              <p className="text-[12px] text-[#403D39] italic bg-[#FAF9F6] border border-[#E9E5DC] rounded-lg px-3 py-1.5 mt-1">
                                &quot;{fb.comment}&quot;
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Right: Time & Action */}
                        <div className="flex items-center gap-3 shrink-0 self-start sm:self-center">
                          <div className="text-[11px] font-mono text-[#777] flex items-center gap-1">
                            <Clock className="w-3 h-3 text-[#999]" />
                            <span>{fb.created_at ? new Date(fb.created_at).toLocaleString('vi-VN') : 'Vừa xong'}</span>
                          </div>
                          {fb.chat_session_id && (
                            <span className="text-[11px] font-semibold text-sky-700 hover:text-sky-900 flex items-center gap-1">
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

      {/* MODAL: GHI NHẬN KHÁCH HÀNG CÓ BIỂU CẢM KHÓ CHỊU (CONCIERGE) */}
      {isEmotionModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-[#BFBFBD] shadow-2xl overflow-hidden">
            <div className="px-5 py-4 bg-[#FAF9F6] border-b border-[#E9E5DC] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
                <h3 className="text-[14px] font-bold text-[#262626]">
                  Ghi Nhận &amp; Xử Lý Khách Có Biểu Cảm Khó Chịu
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEmotionModalOpen(false)}
                className="p-1 rounded-lg text-[#777] hover:text-[#262626] hover:bg-[#EFECE6] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateEmotionAlert} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#262626] mb-1">
                    Vị trí / Kiosk / Phòng
                  </label>
                  <input
                    type="text"
                    required
                    value={emotionForm.location}
                    onChange={(e) => setEmotionForm((s) => ({ ...s, location: e.target.value }))}
                    placeholder="VD: Main Lobby Kiosk, Phòng 305..."
                    className="w-full rounded-xl border border-[#BFBFBD] px-3 py-2 text-[#262626] outline-none focus:border-[#262626]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#262626] mb-1">
                    Tên khách / Định danh
                  </label>
                  <input
                    type="text"
                    value={emotionForm.guestName}
                    onChange={(e) => setEmotionForm((s) => ({ ...s, guestName: e.target.value }))}
                    placeholder="Khách tại Sảnh Kiosk..."
                    className="w-full rounded-xl border border-[#BFBFBD] px-3 py-2 text-[#262626] outline-none focus:border-[#262626]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#262626] mb-1">
                  Biểu cảm / Mức độ ghi nhận từ AI Kiosk
                </label>
                <select
                  value={emotionForm.emotionType}
                  onChange={(e) => setEmotionForm((s) => ({ ...s, emotionType: e.target.value }))}
                  className="w-full rounded-xl border border-[#BFBFBD] px-3 py-2 text-[#262626] outline-none focus:border-[#262626]"
                >
                  <option value="Khó chịu (Unhappy)">Khó chịu (Unhappy) - Phát hiện từ Camera AI</option>
                  <option value="Bực bội / Thất vọng (Frustrated)">Bực bội / Thất vọng (Frustrated) - Cần hỗ trợ gấp</option>
                  <option value="Đang lúng túng tại Kiosk">Khách đang lúng túng / Không hài lòng tại Kiosk</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-[#262626] mb-1">
                  Ghi chú tình huống
                </label>
                <textarea
                  rows={3}
                  value={emotionForm.description}
                  onChange={(e) => setEmotionForm((s) => ({ ...s, description: e.target.value }))}
                  placeholder="Mô tả tình huống khách đang gặp phải tại Kiosk/Sảnh để nhân viên Concierge tiếp cận xử lý..."
                  className="w-full rounded-xl border border-[#BFBFBD] px-3 py-2 text-[#262626] outline-none focus:border-[#262626]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEmotionModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#BFBFBD] text-[#403D39] font-semibold hover:bg-[#F0EFEC] cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSavingEmotion}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold cursor-pointer"
                >
                  {isSavingEmotion ? 'Đang lưu...' : 'Ghi nhận & Cảnh báo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: XEM TRANSCRIPT CHI TIẾT HỘI THOẠI (SERVICE RECOVERY) */}
      {selectedTranscriptFb && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-[#BFBFBD] overflow-hidden">
            {/* Modal Header */}
            <div className="px-5 py-4 bg-[#FAF9F6] border-b border-[#E9E5DC] flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-[#262626] text-white">
                    {selectedTranscriptFb.chat_session_id}
                  </span>
                  <span className="text-[14px] font-bold text-[#262626]">
                    {selectedTranscriptFb.guest_name || 'Khách tại Kiosk'}
                  </span>
                  <span className="text-xs text-[#77736E]">
                    ({selectedTranscriptFb.room_number ? `Phòng ${selectedTranscriptFb.room_number}` : 'Kiosk Sảnh'})
                  </span>
                </div>
                <div className="text-xs text-[#77736E] mt-1 flex items-center gap-2">
                  <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                  <span>Đánh giá dịch vụ: <strong className="text-[#262626]">{selectedTranscriptFb.rating}/5 Sao</strong></span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTranscriptFb(null)}
                className="p-1.5 text-[#777] hover:text-[#262626] hover:bg-[#EFECE6] rounded-lg font-bold text-xs cursor-pointer"
              >
                Đóng
              </button>
            </div>

            {/* Modal Content / Chat Stream */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#FAF9F6]">
              {isTranscriptLoading ? (
                <div className="py-12 text-center text-xs text-[#777] flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Đang tải toàn bộ lượt hội thoại...</span>
                </div>
              ) : transcriptMessages.length === 0 ? (
                <div className="py-12 text-center text-xs text-[#777]">
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
                      <span className="text-[10px] font-mono font-bold text-[#77736E] mb-1 px-1">
                        {isUser ? 'Khách hàng (User)' : 'Trợ lý Robot Rora (Assistant)'}
                      </span>
                      <div
                        className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed ${
                          isUser
                            ? 'bg-[#262626] text-white rounded-br-xs'
                            : 'bg-white text-[#262626] border border-[#BFBFBD] rounded-bl-xs'
                        }`}
                      >
                        {msg.text}
                        {msg.intent_action && (
                          <div className={`mt-1 pt-1 border-t text-[9px] font-mono opacity-75 ${isUser ? 'border-white/20' : 'border-[#E9E5DC]'}`}>
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
            <div className="px-5 py-3 bg-white border-t border-[#E9E5DC] flex items-center justify-between">
              <span className="text-[11px] text-[#77736E] font-medium">
                Dữ liệu lưu tự động trong CSDL bảng <code>chat_messages</code>
              </span>
              <button
                type="button"
                onClick={() => setSelectedTranscriptFb(null)}
                className="px-4 py-1.5 rounded-lg bg-[#262626] hover:bg-[#404040] text-white font-bold text-xs transition-colors cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INCOMING CALL RINGING MODAL FOR STAFF (GOOGLE USER / MEET STYLE) */}
      {activeSession && activeSession.status === 'Pending' && !isVideoModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#141413]/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-[#E3DFD5] rounded-3xl p-6 sm:p-7 max-w-sm w-full text-center space-y-5 shadow-2xl text-[#1A1917] animate-in zoom-in-95 duration-200">
            {/* Animated Call Ring Icon */}
            <div className="relative mx-auto w-20 h-20 flex items-center justify-center">
              <span className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" />
              <div className="relative w-20 h-20 rounded-full bg-emerald-50 border-2 border-emerald-500 flex items-center justify-center text-emerald-600 shadow-md">
                <PhoneCall className="w-9 h-9 animate-pulse" />
              </div>
            </div>

            {/* Caller Information */}
            <div className="space-y-1.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-semibold tracking-wide uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Cuộc gọi đến từ Robot Kiosk
              </span>
              <h3 className="text-xl font-bold text-[#1A1917] pt-1">
                {activeSession.guest_name || 'Khách tại Sảnh'}
              </h3>
              <p className="text-xs text-[#8C857B] font-medium">
                Vị trí: <span className="font-semibold text-[#1A1917]">{activeSession.room_number || 'Main Lobby Kiosk'}</span> • Mã: <span className="font-mono font-semibold">{activeSession.ticket_code}</span>
              </p>
            </div>

            {/* Call Reason / Description */}
            <div className="text-xs text-[#8C857B] bg-[#F9F8F5] p-3.5 rounded-2xl border border-[#E3DFD5] italic leading-relaxed text-left">
              "{activeSession.description || 'Khách bấm gọi hỗ trợ trực tiếp từ màn hình Robot Concierge'}"
            </div>

            {/* Action Buttons (Google Phone Style) */}
            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => handleUpdateStatus('Closed')}
                className="flex-1 py-3 px-4 rounded-full bg-[#F5F2EB] hover:bg-red-50 text-[#1A1917] hover:text-red-700 font-semibold text-xs sm:text-sm border border-[#E3DFD5] hover:border-red-200 transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95"
              >
                <PhoneOff className="w-4 h-4 text-[#8C857B]" />
                <span>Từ chối</span>
              </button>
              <button
                type="button"
                onClick={() => handleAcceptCall(activeSession)}
                className="flex-1 py-3 px-4 rounded-full bg-[#059669] hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs sm:text-sm transition-all shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 cursor-pointer active:scale-95"
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
        sessionId={activeCallSessionId || activeSession?.ticket_code || activeSession?.id || 'SUP-STAFF'}
        role="staff"
        callerName={activeCallSession?.guest_name || activeSession?.guest_name || 'Khách hàng'}
        calleeName={currentUser?.full_name || 'Nhân viên hỗ trợ'}
        roomNumber={activeCallSession?.room_number || activeSession?.room_number || ''}
        ticketCode={activeCallSession?.ticket_code || activeSession?.ticket_code}
        guestLanguage={activeCallSession?.language || activeSession?.language || 'Tiếng Việt'}
        onClose={handleFinishCall}
        onCallEnded={handleFinishCall}
      />
    </div>
  );
};
