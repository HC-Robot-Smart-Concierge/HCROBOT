import React, { useState, useEffect, useMemo } from 'react';
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
import {
  fetchTaxiDashboard,
  fetchTaxiRequests,
  createTaxiRequest,
  updateTaxiRequestStatus,
} from '../../services/taxiApi';
import {
  CONCIERGE_PAGE_SIZE,
  INITIAL_TEST_FORM,
  INITIAL_TAXI_KPIS,
  INITIAL_TAXI_FORM,
  INITIAL_EMOTION_FORM,
  normalizeEmotionStatus,
  filterConciergeFeedbacks,
  paginateConciergeItems,
} from './conciergeDashboardUtils';
import { ConciergeBannerAndNav } from './ConciergeBannerAndNav';
import { ConciergeEmotionAlertsView } from './ConciergeEmotionAlertsView';
import { ConciergeLiveCallAndRecordingsView } from './ConciergeLiveCallAndRecordingsView';
import { ConciergeTaxiView } from './ConciergeTaxiView';
import { ConciergeFeedbackView } from './ConciergeFeedbackView';
import { ConciergeModals } from './ConciergeModals';

export const ConciergeDashboard = ({
  currentUser,
  onNotify = () => {},
  activeSubTab: propActiveSubTab,
}) => {
  const [internalSubTab, setInternalSubTab] = useState('live_call');
  const activeSubTab = propActiveSubTab || internalSubTab;
  const isManagedFromSidebar = Boolean(propActiveSubTab);
  const [isLoading, setIsLoading] = useState(false);

  const [feedbacks, setFeedbacks] = useState([]);
  const [selectedTranscriptFb, setSelectedTranscriptFb] = useState(null);
  const [transcriptMessages, setTranscriptMessages] = useState([]);
  const [isTranscriptLoading, setIsTranscriptLoading] = useState(false);

  const [activeSession, setActiveSession] = useState(null);
  const [activeCallSessionId, setActiveCallSessionId] = useState(null);
  const [activeCallSession, setActiveCallSession] = useState(null);
  const [activeCount, setActiveCount] = useState(0);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [recordedSessions, setRecordedSessions] = useState([]);
  const [playingVideo, setPlayingVideo] = useState(null);
  const [testForm, setTestForm] = useState(INITIAL_TEST_FORM);

  const [taxiKpis, setTaxiKpis] = useState(INITIAL_TAXI_KPIS);
  const [taxiRequests, setTaxiRequests] = useState([]);
  const [isTaxiModalOpen, setIsTaxiModalOpen] = useState(false);
  const [taxiForm, setTaxiForm] = useState(INITIAL_TAXI_FORM);

  const [emotionAlerts, setEmotionAlerts] = useState([]);
  const [emotionFilter, setEmotionFilter] = useState('All');
  const [emotionAlertsPage, setEmotionAlertsPage] = useState(1);
  const [isEmotionModalOpen, setIsEmotionModalOpen] = useState(false);
  const [isSavingEmotion, setIsSavingEmotion] = useState(false);
  const [emotionForm, setEmotionForm] = useState(INITIAL_EMOTION_FORM);

  const pageSize = CONCIERGE_PAGE_SIZE;
  const [recordingsPage, setRecordingsPage] = useState(1);
  const [taxiPage, setTaxiPage] = useState(1);
  const [feedbackPage, setFeedbackPage] = useState(1);
  const [feedbackRatingFilter, setFeedbackRatingFilter] = useState('all');

  const totalRecordingsPages = Math.max(1, Math.ceil(recordedSessions.length / pageSize));
  const totalTaxiPages = Math.max(1, Math.ceil(taxiRequests.length / pageSize));

  const activeEmotionAlerts = useMemo(
    () => emotionAlerts.filter((a) => normalizeEmotionStatus(a.status) !== 'Completed'),
    [emotionAlerts]
  );

  const filteredEmotionAlerts = useMemo(
    () => emotionAlerts.filter((a) => emotionFilter === 'All' || normalizeEmotionStatus(a.status) === emotionFilter),
    [emotionAlerts, emotionFilter]
  );

  const totalEmotionAlertsPages = Math.max(1, Math.ceil(filteredEmotionAlerts.length / pageSize));

  useEffect(() => { setEmotionAlertsPage(1); }, [emotionFilter]);
  useEffect(() => {
    if (emotionAlertsPage > totalEmotionAlertsPages) setEmotionAlertsPage(totalEmotionAlertsPages);
  }, [emotionAlertsPage, totalEmotionAlertsPages]);

  const paginatedEmotionAlerts = useMemo(
    () => paginateConciergeItems(filteredEmotionAlerts, emotionAlertsPage, pageSize),
    [filteredEmotionAlerts, emotionAlertsPage, pageSize]
  );

  const filteredFeedbacks = useMemo(
    () => filterConciergeFeedbacks(feedbacks, feedbackRatingFilter),
    [feedbacks, feedbackRatingFilter]
  );

  const totalFeedbackPages = Math.max(1, Math.ceil(filteredFeedbacks.length / pageSize));

  useEffect(() => { setFeedbackPage(1); }, [feedbackRatingFilter]);
  useEffect(() => { if (recordingsPage > totalRecordingsPages) setRecordingsPage(totalRecordingsPages); }, [recordingsPage, totalRecordingsPages]);
  useEffect(() => { if (taxiPage > totalTaxiPages) setTaxiPage(totalTaxiPages); }, [taxiPage, totalTaxiPages]);
  useEffect(() => { if (feedbackPage > totalFeedbackPages) setFeedbackPage(totalFeedbackPages); }, [feedbackPage, totalFeedbackPages]);

  const paginatedRecordings = useMemo(
    () => paginateConciergeItems(recordedSessions, recordingsPage, pageSize),
    [recordedSessions, recordingsPage, pageSize]
  );

  const paginatedTaxiRequests = useMemo(
    () => paginateConciergeItems(taxiRequests, taxiPage, pageSize),
    [taxiRequests, taxiPage, pageSize]
  );

  const paginatedFeedbacks = useMemo(
    () => paginateConciergeItems(filteredFeedbacks, feedbackPage, pageSize),
    [filteredFeedbacks, feedbackPage, pageSize]
  );

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
      if (Array.isArray(sessionsData)) setRecordedSessions(sessionsData);
      if (Array.isArray(feedbacksData)) setFeedbacks(feedbacksData);
      if (Array.isArray(emotionData)) setEmotionAlerts(emotionData);
      if (taxiDashData?.kpis) setTaxiKpis(taxiDashData.kpis);
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
      setTaxiForm({ ...INITIAL_TAXI_FORM });
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
        setEmotionForm({ ...INITIAL_EMOTION_FORM });
        loadData();
      }
    } finally {
      setIsSavingEmotion(false);
    }
  };

  return (
    <div className="staff-page-body flex-1 overflow-y-auto custom-scrollbar font-sans">
      <div className="staff-page-container space-y-5">
        <ConciergeBannerAndNav
          activeSubTab={activeSubTab}
          setInternalSubTab={setInternalSubTab}
          isManagedFromSidebar={isManagedFromSidebar}
          isLoading={isLoading}
          loadData={loadData}
          setIsTestModalOpen={setIsTestModalOpen}
          setIsEmotionModalOpen={setIsEmotionModalOpen}
          setIsTaxiModalOpen={setIsTaxiModalOpen}
          activeCount={activeCount}
          activeEmotionAlerts={activeEmotionAlerts}
          recordedSessions={recordedSessions}
          taxiKpis={taxiKpis}
          feedbacks={feedbacks}
          handleAcceptEmotionAlert={handleAcceptEmotionAlert}
          handleCompleteEmotionAlert={handleCompleteEmotionAlert}
        />

        <ConciergeEmotionAlertsView
          activeSubTab={activeSubTab}
          emotionAlerts={emotionAlerts}
          emotionFilter={emotionFilter}
          setEmotionFilter={setEmotionFilter}
          filteredEmotionAlerts={filteredEmotionAlerts}
          paginatedEmotionAlerts={paginatedEmotionAlerts}
          emotionAlertsPage={emotionAlertsPage}
          setEmotionAlertsPage={setEmotionAlertsPage}
          handleAcceptEmotionAlert={handleAcceptEmotionAlert}
          handleCompleteEmotionAlert={handleCompleteEmotionAlert}
        />

        <ConciergeLiveCallAndRecordingsView
          activeSubTab={activeSubTab}
          activeCount={activeCount}
          activeSession={activeSession}
          isLoading={isLoading}
          loadData={loadData}
          setIsTestModalOpen={setIsTestModalOpen}
          handleAcceptCall={handleAcceptCall}
          handleFinishCall={handleFinishCall}
          recordedSessions={recordedSessions}
          paginatedRecordings={paginatedRecordings}
          recordingsPage={recordingsPage}
          setRecordingsPage={setRecordingsPage}
          setPlayingVideo={setPlayingVideo}
        />

        <ConciergeTaxiView
          activeSubTab={activeSubTab}
          taxiKpis={taxiKpis}
          taxiRequests={taxiRequests}
          paginatedTaxiRequests={paginatedTaxiRequests}
          taxiPage={taxiPage}
          setTaxiPage={setTaxiPage}
          handleUpdateTaxiStatus={handleUpdateTaxiStatus}
        />

        <ConciergeFeedbackView
          activeSubTab={activeSubTab}
          feedbacks={feedbacks}
          feedbackRatingFilter={feedbackRatingFilter}
          setFeedbackRatingFilter={setFeedbackRatingFilter}
          filteredFeedbacks={filteredFeedbacks}
          paginatedFeedbacks={paginatedFeedbacks}
          feedbackPage={feedbackPage}
          setFeedbackPage={setFeedbackPage}
          handleViewTranscript={handleViewTranscript}
        />
      </div>

      <ConciergeModals
        currentUser={currentUser}
        isTestModalOpen={isTestModalOpen}
        setIsTestModalOpen={setIsTestModalOpen}
        handleCreateLiveCall={handleCreateLiveCall}
        testForm={testForm}
        setTestForm={setTestForm}
        isTaxiModalOpen={isTaxiModalOpen}
        setIsTaxiModalOpen={setIsTaxiModalOpen}
        handleCreateTaxi={handleCreateTaxi}
        taxiForm={taxiForm}
        setTaxiForm={setTaxiForm}
        playingVideo={playingVideo}
        setPlayingVideo={setPlayingVideo}
        isEmotionModalOpen={isEmotionModalOpen}
        setIsEmotionModalOpen={setIsEmotionModalOpen}
        isSavingEmotion={isSavingEmotion}
        emotionForm={emotionForm}
        setEmotionForm={setEmotionForm}
        handleCreateEmotionAlert={handleCreateEmotionAlert}
        selectedTranscriptFb={selectedTranscriptFb}
        setSelectedTranscriptFb={setSelectedTranscriptFb}
        isTranscriptLoading={isTranscriptLoading}
        transcriptMessages={transcriptMessages}
        activeSession={activeSession}
        isVideoModalOpen={isVideoModalOpen}
        activeCallSessionId={activeCallSessionId}
        activeCallSession={activeCallSession}
        handleAcceptCall={handleAcceptCall}
        handleUpdateStatus={handleUpdateStatus}
        handleFinishCall={handleFinishCall}
      />
    </div>
  );
};
