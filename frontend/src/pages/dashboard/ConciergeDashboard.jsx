import React, { useState, useEffect } from 'react';
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
  UserCheck,
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
    priority: 'HIGH',
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
  const [assignModal, setAssignModal] = useState({ open: false, reqId: null, driver: '' });
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

  const handleUpdateTaxiStatus = async (reqId, newStatus, driver = null) => {
    const res = await updateTaxiRequestStatus(reqId, newStatus, driver);
    if (res) {
      onNotify(`Cập nhật trạng thái chuyến xe: ${newStatus}`);
      setTaxiRequests((prev) =>
        prev.map((r) =>
          r.id === reqId ? { ...r, status: newStatus, assigned_driver: driver || r.assigned_driver } : r
        )
      );
      if (assignModal.open) {
        setAssignModal({ open: false, reqId: null, driver: '' });
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-palette-cream">
      {/* Top Header */}
      <div className="bg-white border-b border-palette-silver px-6 py-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-palette-charcoal flex items-center gap-2">
              {activeSubTab === 'recordings' ? (
                <>
                  <Film className="w-5 h-5 text-sky-600" />
                  Lịch Sử Cuộc Gọi & Bản Ghi Cloudinary
                </>
              ) : activeSubTab === 'taxi' ? (
                <>
                  <Car className="w-5 h-5 text-emerald-600" />
                  Điều Phối Dịch Vụ Đặt Xe & Vận Chuyển
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
            <p className="text-xs text-palette-slate mt-0.5">
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
              className="p-2 rounded-lg bg-palette-stone text-palette-charcoal hover:bg-palette-silver border border-palette-silver text-xs font-semibold flex items-center gap-1 transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Làm mới
            </button>
            {activeSubTab === 'live_call' && (
              <button
                onClick={() => setIsTestModalOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-palette-charcoal hover:bg-neutral-800 text-palette-cream text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                Mô phỏng gọi từ Kiosk
              </button>
            )}
            {activeSubTab === 'taxi' && (
              <button
                onClick={() => setIsTaxiModalOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-palette-charcoal hover:bg-neutral-800 text-palette-cream text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                Đặt xe mới
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
              <span>Bản Ghi Cuộc Gọi (Cloudinary)</span>
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
              <span>Điều phối Đặt xe & Vận chuyển</span>
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
      <div className="flex-1 overflow-y-auto p-6">
        {/* SUBTAB 1: LIVE CALL */}
        {activeSubTab === 'live_call' && (
          <div className="space-y-6">
            {/* Live Call Metric Banner */}
            <div className="flex items-center gap-3 bg-palette-stone/50 border border-palette-silver rounded-xl p-3">
              <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <div className="flex-1">
                <span className="text-xs font-bold text-palette-charcoal">
                  Trạng thái Trực Tổng Đài: Sẵn Sàng (Live Concierge Online)
                </span>
                <span className="text-xs text-palette-slate ml-2">
                  Đang có <strong className="text-palette-charcoal">{activeCount}</strong> phiên hỗ trợ cần xử lý
                </span>
              </div>
            </div>

            {activeSession ? (
              <div className="max-w-3xl mx-auto bg-white rounded-xl border border-palette-silver p-6 shadow-sm">
                <div className="flex items-start justify-between border-b border-palette-silver/40 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold bg-palette-stone text-palette-charcoal border border-palette-silver px-2 py-0.5 rounded">
                        {activeSession.ticket_code || activeSession.id}
                      </span>
                      <span className="text-sm font-bold text-palette-charcoal">
                        {activeSession.guest_name || 'Khách tại Kiosk'}
                      </span>
                      <span className="text-xs text-palette-slate">
                        ({activeSession.room_number || 'Sảnh S1'})
                      </span>
                    </div>
                    <div className="text-xs text-palette-slate mt-1 flex items-center gap-2">
                      <Clock className="w-3 h-3" />
                      Khởi tạo: {activeSession.created_at || 'Vừa xong'}
                    </div>
                  </div>

                  <span
                    className={`text-xs font-bold px-3 py-1 rounded-full ${
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
                <div className="my-6">
                  <label className="text-xs font-bold text-palette-charcoal uppercase tracking-wider flex items-center gap-1.5 mb-2">
                    <MessageSquare className="w-3.5 h-3.5 text-palette-charcoal" />
                    Nội Dung Hội Thoại Chuyển Tiếp Từ Robot
                  </label>
                  <div className="bg-palette-cream/70 border border-palette-silver rounded-lg p-4 text-xs text-palette-charcoal leading-relaxed font-sans">
                    {activeSession.description || 'Không có mô tả hội thoại.'}
                  </div>
                </div>

                {/* Action Bar */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-palette-silver/50">
                  {activeSession.status !== 'Connected' && activeSession.status !== 'Closed' && (
                    <button
                      onClick={async () => {
                        await handleUpdateStatus('Connected');
                        setIsVideoModalOpen(true);
                      }}
                      className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center gap-2 shadow-sm transition-all"
                    >
                      <Video className="w-4 h-4" />
                      Tiếp nhận cuộc gọi Video
                    </button>
                  )}

                  {activeSession.status === 'Connected' && (
                    <button
                      onClick={() => setIsVideoModalOpen(true)}
                      className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-2 shadow-sm transition-all"
                    >
                      <Video className="w-4 h-4" />
                      Mở Màn Hình Cuộc Gọi
                    </button>
                  )}

                  {activeSession.status === 'Connected' && (
                    <button
                      onClick={async () => {
                        setIsVideoModalOpen(false);
                        await handleUpdateStatus('Closed');
                      }}
                      className="px-4 py-2 rounded-lg bg-neutral-700 hover:bg-neutral-800 text-white text-xs font-bold flex items-center gap-2 shadow-sm transition-all"
                    >
                      <PhoneOff className="w-4 h-4" />
                      Kết thúc phiên hỗ trợ
                    </button>
                  )}

                  {activeSession.status === 'Closed' && (
                    <span className="text-xs text-palette-slate font-semibold">
                      Phiên hỗ trợ này đã hoàn tất.
                    </span>
                  )}
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
                    Lịch Sử Cuộc Gọi & Bản Ghi Cloudinary (Human Support Sessions)
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
                  {recordedSessions.map((session) => (
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
            </div>
          </div>
        )}

        {/* SUBTAB 2: TAXI & TRANSPORTATION */}
        {activeSubTab === 'taxi' && (
          <div className="space-y-6">
            {/* Metric KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-palette-stone/40 border border-palette-silver rounded-xl p-3">
                <div className="text-[11px] font-semibold text-palette-slate">Tổng cuốc xe</div>
                <div className="text-xl font-bold text-palette-charcoal mt-1">
                  {taxiRequests.length || taxiKpis.totalRequests}
                </div>
              </div>
              <div className="bg-palette-stone/40 border border-palette-silver rounded-xl p-3">
                <div className="text-[11px] font-semibold text-palette-slate">Chờ điều phối</div>
                <div className="text-xl font-bold text-palette-charcoal mt-1">
                  {taxiRequests.filter((r) => r.status === 'Pending' || r.status === 'Unassigned').length ||
                    taxiKpis.pendingRequests}
                </div>
              </div>
              <div className="bg-palette-stone/40 border border-palette-silver rounded-xl p-3">
                <div className="text-[11px] font-semibold text-palette-slate">Đang di chuyển</div>
                <div className="text-xl font-bold text-sky-600 mt-1">
                  {taxiRequests.filter(
                    (r) => r.status === 'In Progress' || r.status === 'On The Way' || r.status === 'Driver Assigned'
                  ).length || taxiKpis.activeTrips}
                </div>
              </div>
              <div className="bg-palette-stone/40 border border-palette-silver rounded-xl p-3">
                <div className="text-[11px] font-semibold text-palette-slate">Đã hoàn thành</div>
                <div className="text-xl font-bold text-emerald-600 mt-1">
                  {taxiRequests.filter((r) => r.status === 'Completed').length || taxiKpis.completedTrips}
                </div>
              </div>
            </div>

            {/* Taxi Request List */}
            <div className="bg-white rounded-xl border border-palette-silver shadow-sm overflow-hidden">
              <div className="p-4 border-b border-palette-silver/50 flex items-center justify-between">
                <span className="text-xs font-bold text-palette-charcoal">Danh Sách Yêu Cầu Đặt Xe & Điều Phối</span>
                <span className="text-[11px] text-palette-slate">Hiển thị {taxiRequests.length} chuyến xe</span>
              </div>

              {taxiRequests.length === 0 ? (
                <div className="p-8 text-center text-xs text-palette-slate">
                  Hiện chưa có yêu cầu đặt xe nào trong hệ thống.
                </div>
              ) : (
                <div className="divide-y divide-palette-silver/30">
                  {taxiRequests.map((trip) => (
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

                        {trip.assigned_driver && (
                          <div className="mt-2 flex items-center gap-2 text-[11px] text-palette-charcoal">
                            <span className="font-semibold">Tài xế:</span> {trip.assigned_driver}
                            {trip.license_plate && (
                              <span className="font-mono bg-palette-stone text-palette-charcoal px-1.5 py-0.5 rounded border border-palette-silver">
                                {trip.license_plate}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 self-start md:self-center">
                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                            trip.status === 'Completed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : trip.status === 'On The Way' || trip.status === 'Driver Assigned'
                              ? 'bg-sky-100 text-sky-800'
                              : 'bg-palette-stone text-palette-charcoal border border-palette-silver'
                          }`}
                        >
                          {trip.status}
                        </span>

                        {trip.status === 'Pending' && (
                          <button
                            onClick={() =>
                              setAssignModal({ open: true, reqId: trip.id, driver: 'Mai Linh Taxi - Tài xế Tuấn' })
                            }
                            className="px-2.5 py-1 text-[11px] font-bold rounded bg-palette-charcoal hover:bg-neutral-800 text-palette-cream transition-all flex items-center gap-1 shadow-sm"
                          >
                            <UserCheck className="w-3 h-3" />
                            Gán tài xế
                          </button>
                        )}

                        {(trip.status === 'Driver Assigned' || trip.status === 'On The Way') && (
                          <button
                            onClick={() => handleUpdateTaxiStatus(trip.id, 'Completed')}
                            className="px-2.5 py-1 text-[11px] font-bold rounded bg-emerald-600 hover:bg-emerald-700 text-white transition-all flex items-center gap-1"
                          >
                            <Check className="w-3 h-3" />
                            Đã đón xong
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* SUBTAB 4: FEEDBACK & SERVICE RECOVERY */}
        {activeSubTab === 'feedback' && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl border border-palette-silver p-4 shadow-xs">
                <span className="text-xs text-palette-slate font-medium">Tổng Đánh Giá Nhận Được</span>
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

              <div className="bg-white rounded-xl border border-palette-silver p-4 shadow-xs">
                <span className="text-xs text-palette-slate font-medium">Hài Lòng (4 - 5 Sao)</span>
                <div className="text-2xl font-bold text-emerald-600 mt-1">
                  {feedbacks.filter((f) => f.rating >= 4).length}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-rose-200 bg-rose-50/30 p-4 shadow-xs">
                <span className="text-xs text-rose-700 font-bold uppercase tracking-wider">Cần Can Thiệp (≤ 3 Sao)</span>
                <div className="text-2xl font-bold text-rose-600 mt-1 flex items-center gap-2">
                  <span>{feedbacks.filter((f) => f.rating <= 3).length}</span>
                  {feedbacks.filter((f) => f.rating <= 3).length > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-semibold animate-pulse">
                      Cần xử lý
                    </span>
                  )}
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

            {/* Feedback List */}
            <div className="bg-white rounded-xl border border-palette-silver p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-palette-silver/50 pb-3">
                <h3 className="text-sm font-bold text-palette-charcoal flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-palette-charcoal" />
                  Danh Sách Đánh Giá & Ý Kiến Khách Hàng Từ Robot Kiosk
                </h3>
                <span className="text-xs font-mono text-palette-slate font-semibold">
                  {feedbacks.length} phản hồi
                </span>
              </div>

              {feedbacks.length === 0 ? (
                <div className="py-12 text-center text-xs text-palette-slate">
                  Chưa có đánh giá nào từ khách hàng tại Kiosk.
                </div>
              ) : (
                <div className="space-y-3">
                  {feedbacks.map((fb) => {
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
                        <div className="flex items-center gap-3">
                          {/* Star Badge */}
                          <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-stone-100 border border-stone-200">
                            <Star className={`w-3.5 h-3.5 ${isBad ? 'text-rose-500 fill-rose-500' : 'text-amber-500 fill-amber-500'}`} />
                            <span className="text-xs font-bold text-palette-charcoal">
                              {fb.rating} / 5 Sao
                            </span>
                          </div>

                          {/* Mã phiên */}
                          <div className="text-xs font-mono text-stone-700">
                            <span className="text-stone-400">Mã phiên:</span> {fb.chat_session_id || fb.id || 'N/A'}
                          </div>
                        </div>

                        {/* Thời gian */}
                        <div className="text-xs font-mono text-stone-500">
                          <span className="text-stone-400">Thời gian:</span> {fb.created_at ? new Date(fb.created_at).toLocaleString('vi-VN') : 'Vừa xong'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* MODAL: MÔ PHỎNG LIVE CALL */}
      {isTestModalOpen && (
        <div className="fixed inset-0 z-50 bg-palette-charcoal/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-palette-silver">
            <h2 className="text-base font-bold text-palette-charcoal mb-4">Mô Phỏng Cuộc Gọi Từ Robot Kiosk</h2>
            <form onSubmit={handleCreateLiveCall} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-palette-charcoal">Vị trí Kiosk</label>
                <input
                  type="text"
                  required
                  value={testForm.room_number}
                  onChange={(e) => setTestForm({ ...testForm, room_number: e.target.value })}
                  className="w-full mt-1 px-3 py-1.5 border border-palette-silver rounded-lg text-xs outline-none focus:border-palette-charcoal"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-palette-charcoal">Tên khách hàng</label>
                <input
                  type="text"
                  required
                  value={testForm.guest_name}
                  onChange={(e) => setTestForm({ ...testForm, guest_name: e.target.value })}
                  className="w-full mt-1 px-3 py-1.5 border border-palette-silver rounded-lg text-xs outline-none focus:border-palette-charcoal"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-palette-charcoal">Nội dung hội thoại Robot chuyển tiếp</label>
                <textarea
                  rows="3"
                  value={testForm.transcript}
                  onChange={(e) => setTestForm({ ...testForm, transcript: e.target.value })}
                  className="w-full mt-1 px-3 py-1.5 border border-palette-silver rounded-lg text-xs outline-none focus:border-palette-charcoal"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-palette-silver/50">
                <button
                  type="button"
                  onClick={() => setIsTestModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-palette-slate hover:text-palette-charcoal hover:bg-palette-stone rounded-lg font-semibold transition-all"
                >
                  Huỷ
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs bg-palette-charcoal hover:bg-neutral-800 text-palette-cream rounded-lg font-semibold transition-all shadow-sm"
                >
                  Phát tín hiệu gọi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ĐẶT XE MỚI */}
      {isTaxiModalOpen && (
        <div className="fixed inset-0 z-50 bg-palette-charcoal/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-palette-silver">
            <h2 className="text-base font-bold text-palette-charcoal mb-4">Tạo Yêu Cầu Đặt Xe Mới</h2>
            <form onSubmit={handleCreateTaxi} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-palette-charcoal">Tên khách hàng *</label>
                <input
                  type="text"
                  required
                  value={taxiForm.guest_name}
                  onChange={(e) => setTaxiForm({ ...taxiForm, guest_name: e.target.value })}
                  className="w-full mt-1 px-3 py-1.5 border border-palette-silver rounded-lg text-xs outline-none focus:border-palette-charcoal"
                  placeholder="Vd: Mr. David Miller"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-palette-charcoal">Số phòng</label>
                  <input
                    type="text"
                    value={taxiForm.room_number}
                    onChange={(e) => setTaxiForm({ ...taxiForm, room_number: e.target.value })}
                    className="w-full mt-1 px-3 py-1.5 border border-palette-silver rounded-lg text-xs outline-none focus:border-palette-charcoal"
                    placeholder="Vd: 501"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-palette-charcoal">Số khách</label>
                  <input
                    type="number"
                    min="1"
                    max="16"
                    value={taxiForm.party_size}
                    onChange={(e) => setTaxiForm({ ...taxiForm, party_size: parseInt(e.target.value) || 1 })}
                    className="w-full mt-1 px-3 py-1.5 border border-palette-silver rounded-lg text-xs outline-none focus:border-palette-charcoal"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-palette-charcoal">Điểm đón</label>
                <input
                  type="text"
                  value={taxiForm.pickup_location}
                  onChange={(e) => setTaxiForm({ ...taxiForm, pickup_location: e.target.value })}
                  className="w-full mt-1 px-3 py-1.5 border border-palette-silver rounded-lg text-xs outline-none focus:border-palette-charcoal"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-palette-charcoal">Điểm đến</label>
                <input
                  type="text"
                  value={taxiForm.destination}
                  onChange={(e) => setTaxiForm({ ...taxiForm, destination: e.target.value })}
                  className="w-full mt-1 px-3 py-1.5 border border-palette-silver rounded-lg text-xs outline-none focus:border-palette-charcoal"
                  placeholder="Vd: Sân bay Đà Nẵng, Phố Cổ Hội An..."
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-palette-charcoal">Loại xe</label>
                  <select
                    value={taxiForm.vehicle_type}
                    onChange={(e) => setTaxiForm({ ...taxiForm, vehicle_type: e.target.value })}
                    className="w-full mt-1 px-3 py-1.5 border border-palette-silver rounded-lg text-xs outline-none focus:border-palette-charcoal bg-white"
                  >
                    <option value="4-Seater Sedan">Sedan 4 chỗ</option>
                    <option value="7-Seater SUV">SUV 7 chỗ</option>
                    <option value="Luxury Limousine">Limousine VIP</option>
                    <option value="16-Seater Van">Xe 16 chỗ</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-palette-charcoal">Thời gian đón</label>
                  <input
                    type="text"
                    value={taxiForm.pickup_time}
                    onChange={(e) => setTaxiForm({ ...taxiForm, pickup_time: e.target.value })}
                    className="w-full mt-1 px-3 py-1.5 border border-palette-silver rounded-lg text-xs outline-none focus:border-palette-charcoal"
                    placeholder="Vd: 14:00 Chiều nay"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-palette-silver/50">
                <button
                  type="button"
                  onClick={() => setIsTaxiModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-palette-slate hover:text-palette-charcoal hover:bg-palette-stone rounded-lg font-semibold transition-all"
                >
                  Huỷ
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs bg-palette-charcoal hover:bg-neutral-800 text-palette-cream rounded-lg font-semibold transition-all shadow-sm"
                >
                  Xác nhận gọi xe
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: GÁN TÀI XẾ */}
      {assignModal.open && (
        <div className="fixed inset-0 z-50 bg-palette-charcoal/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-5 shadow-xl border border-palette-silver">
            <h2 className="text-sm font-bold text-palette-charcoal mb-3">Điều Phối Tài Xế Cho Chuyến Đi</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-palette-charcoal">Tên tài xế & Hãng xe</label>
                <input
                  type="text"
                  value={assignModal.driver}
                  onChange={(e) => setAssignModal({ ...assignModal, driver: e.target.value })}
                  className="w-full mt-1 px-3 py-1.5 border border-palette-silver rounded-lg text-xs outline-none focus:border-palette-charcoal"
                  placeholder="Vd: Anh Nam (Mai Linh - 43A-123.45)"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setAssignModal({ open: false, reqId: null, driver: '' })}
                  className="px-3 py-1.5 text-xs text-palette-slate hover:text-palette-charcoal hover:bg-palette-stone rounded-lg font-semibold transition-all"
                >
                  Huỷ
                </button>
                <button
                  onClick={() =>
                    handleUpdateTaxiStatus(assignModal.reqId, 'Driver Assigned', assignModal.driver)
                  }
                  className="px-4 py-1.5 text-xs bg-palette-charcoal hover:bg-neutral-800 text-palette-cream rounded-lg font-semibold transition-all shadow-sm"
                >
                  Lưu & Báo khách
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
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
        sessionId={activeSession?.id || activeSession?.ticket_code || 'SUP-STAFF'}
        role="staff"
        callerName={activeSession?.guest_name || 'Khách tại Kiosk'}
        calleeName={currentUser?.full_name || 'Tổng Đài Viên Concierge'}
        roomNumber={activeSession?.room_number || 'Sảnh S1'}
        ticketCode={activeSession?.ticket_code}
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
