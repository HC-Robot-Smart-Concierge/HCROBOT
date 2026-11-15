import React, { useState, useEffect, useMemo } from 'react';
import {  } from 'lucide-react';
import { useLanguage } from '../../../context/LanguageContext';
import {
  fetchLogs,
  fetchLogStatistics,
  fetchLogTrace,
  fetchAuditLogs,
  getLogExportUrl,
} from '../../../services/logsApi';
import {
  fetchChatSessions,
  fetchSessionMessages,
} from '../../../services/aiApi';
import {
  formatLogMessageText,
  formatTimestampText,
  getLevelBadgeStyle,
} from './adminLogsUtils';
import { AdminLogsOperationalView } from './AdminLogsOperationalView';
import { AdminLogsAuditAndChatViews } from './AdminLogsAuditAndChatViews';
import { AdminLogsModals } from './AdminLogsModals';

export const AdminLogsTab = ({ subTabProp, onSelectSubTab }) => {
  const { t, language } = useLanguage();
  const [activeView, setActiveView] = useState(subTabProp || 'operational'); // 'operational' | 'audit' | 'conversations'
  const [logs, setLogs] = useState([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [auditLogs, setAuditLogs] = useState([]);
  const [totalAudit, setTotalAudit] = useState(0);
  const [chatSessions, setChatSessions] = useState([]);
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [activeChatSession, setActiveChatSession] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [isChatMessagesLoading, setIsChatMessagesLoading] = useState(false);

  const [statistics, setStatistics] = useState({
    total: 0,
    errors: 0,
    critical: 0,
    warnings: 0,
    ai_requests: 0,
    robot_events: 0,
    dispatch_events: 0,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isLiveStreaming, setIsLiveStreaming] = useState(true);
  const [toastMessage, setToastMessage] = useState(null);

  const [currentPage, setCurrentPage] = useState(() => {
    try {
      const p = parseInt(new URLSearchParams(window.location.search).get('page'), 10);
      return !isNaN(p) && p > 0 ? p : 1;
    } catch {
      return 1;
    }
  });
  const pageSize = 15;

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
    try {
      const params = new URLSearchParams(window.location.search);
      params.set('tab', 'Logs');
      params.set('page', newPage.toString());
      window.history.pushState(null, '', `${window.location.pathname}?${params.toString()}`);
    } catch { }
  };

  useEffect(() => {
    const onPopState = () => {
      try {
        const p = parseInt(new URLSearchParams(window.location.search).get('page'), 10);
        if (!isNaN(p) && p > 0) setCurrentPage(p);
      } catch { }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Filters
  const [selectedLevel, setSelectedLevel] = useState('ALL');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedDepartment, setSelectedDepartment] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected Log Modal
  const [selectedLog, setSelectedLog] = useState(null);
  // Trace Modal
  const [activeTrace, setActiveTrace] = useState(null);
  const [isTraceLoading, setIsTraceLoading] = useState(false);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const formatLogMessage = (msg) => formatLogMessageText(msg, language);
  useEffect(() => {
    if (subTabProp && subTabProp !== activeView) {
      setActiveView(subTabProp);
      setCurrentPage(1);
    }
  }, [subTabProp]);

  const switchView = (view) => {
    setActiveView(view);
    setCurrentPage(1);
    if (onSelectSubTab) {
      onSelectSubTab(view);
    }
  };

  const loadLogsData = async () => {
    if (activeView === 'operational') {
      try {
        const res = await fetchLogs({
          page: currentPage,
          limit: pageSize,
          level: selectedLevel,
          category: selectedCategory,
          department: selectedDepartment,
          search: searchQuery,
        });
        if (res && res.status === 'success') {
          setLogs(res.items || []);
          setTotalLogs(res.total || 0);
        }
      } catch {
        // Fallback
      }
    } else if (activeView === 'audit') {
      try {
        const res = await fetchAuditLogs({
          page: currentPage,
          limit: pageSize,
        });
        if (res && res.status === 'success') {
          setAuditLogs(res.items || []);
          setTotalAudit(res.total || 0);
        }
      } catch {
        // Fallback
      }
    } else if (activeView === 'conversations') {
      try {
        const res = await fetchChatSessions();
        if (Array.isArray(res)) {
          setChatSessions(res);
        }
      } catch {
        // Fallback
      }
    }
  };

  const loadStats = async () => {
    try {
      const res = await fetchLogStatistics();
      if (res && res.status === 'success') {
        setStatistics(res.data || {});
      }
    } catch {
      // Fallback
    }
  };

  const handleManualRefresh = async () => {
    setIsLoading(true);
    try {
      await Promise.all([loadLogsData(), loadStats()]);
      showToast(language === 'EN' ? 'Refreshed latest log data.' : 'Đã làm mới dữ liệu nhật ký mới nhất.');
    } catch {
      showToast(language === 'EN' ? 'Failed to refresh data.' : 'Không thể làm mới dữ liệu.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const loadAll = async () => {
      setIsLoading(true);
      await Promise.all([loadLogsData(), loadStats()]);
      setIsLoading(false);
    };
    loadAll();
  }, [activeView, currentPage, selectedLevel, selectedCategory, selectedDepartment]);

  useEffect(() => {
    let interval = null;
    if (isLiveStreaming && activeView === 'operational') {
      interval = setInterval(() => {
        loadLogsData();
        loadStats();
      }, 5000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isLiveStreaming, activeView, currentPage, selectedLevel, selectedCategory, selectedDepartment]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    loadLogsData();
  };

  const handleExportLogs = (format = 'csv') => {
    const url = getLogExportUrl(format, {
      level: selectedLevel,
      category: selectedCategory,
      department: selectedDepartment,
      search: searchQuery,
    });
    window.open(url, '_blank');
    showToast(
      language === 'EN'
        ? `Downloading ${format.toUpperCase()} log file...`
        : `Đang tải xuống tệp Log ${format.toUpperCase()}...`
    );
  };

  const handleOpenTrace = async (correlationId) => {
    if (!correlationId) return;
    setIsTraceLoading(true);
    setActiveTrace({ correlation_id: correlationId, timeline: [] });
    try {
      const res = await fetchLogTrace(correlationId);
      if (res && res.status === 'success') {
        setActiveTrace(res);
      } else {
        showToast(language === 'EN' ? 'Corresponding trace sequence not found.' : 'Không tìm thấy chuỗi trace tương ứng.');
      }
    } catch {
      showToast(language === 'EN' ? 'Failed to query lifecycle trace.' : 'Lỗi truy vấn trace vòng đời.');
    } finally {
      setIsTraceLoading(false);
    }
  };

  const handleOpenChatTranscript = async (session) => {
    if (!session?.id) return;
    setActiveChatSession(session);
    setChatMessages([]);
    setIsChatMessagesLoading(true);
    try {
      const msgs = await fetchSessionMessages(session.id);
      setChatMessages(Array.isArray(msgs) ? msgs : []);
    } catch {
      showToast(language === 'EN' ? 'Failed to load AI chat transcript.' : 'Lỗi tải chi tiết hội thoại AI.');
    } finally {
      setIsChatMessagesLoading(false);
    }
  };

  const filteredChatSessions = useMemo(() => {
    const q = chatSearchQuery.trim().toLowerCase();
    if (!q) return chatSessions;
    return chatSessions.filter((s) =>
      String(s.id || '').toLowerCase().includes(q) ||
      String(s.room_number || '').toLowerCase().includes(q) ||
      String(s.guest_name || '').toLowerCase().includes(q)
    );
  }, [chatSessions, chatSearchQuery]);

  const paginatedChatSessions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredChatSessions.slice(start, start + pageSize);
  }, [filteredChatSessions, currentPage, pageSize]);

  const formatTimestamp = (ts) => formatTimestampText(ts, language);

  return (
    <div className="w-full flex flex-col min-h-full pb-4" style={{ color: '#262626' }}>
      {/* Toast Notification (Placed at bottom-right so it never covers the header) */}
      {toastMessage && (
        <div
          className="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-xl border text-xs font-semibold shadow-2xl animate-in fade-in slide-in-from-bottom-3"
          style={{
            backgroundColor: '#262626',
            color: '#F2EFE9',
            borderColor: '#BFBFBD',
          }}
        >
          {toastMessage}
        </div>
      )}

      {/* Header Bar - aligns seamlessly with sidebar brand box line */}
      <div
        className="h-16 px-5 border-b flex items-center justify-between gap-4 shrink-0 sticky top-0 z-20"
        style={{ borderColor: '#BFBFBD', backgroundColor: '#F2EFE9' }}
      >
        <div className="min-w-0">
          <h2 className="text-sm sm:text-base font-bold tracking-tight leading-tight truncate" style={{ color: '#262626' }}>
            {t('logsTabTitle')}
          </h2>
          <p className="text-[10px] sm:text-[11px] font-normal truncate mt-0.5" style={{ color: '#8C8C8C' }}>
            {t('logsTabSubtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Toggle Operational vs Audit vs AI Chat History */}
          <div className="flex rounded-lg border p-0.5" style={{ borderColor: '#BFBFBD', backgroundColor: '#E9E5DC' }}>
            <button
              onClick={() => switchView('operational')}
              className={`px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer ${activeView === 'operational' ? 'bg-[#262626] text-white' : 'text-stone-600 hover:text-stone-900'
                }`}
            >
              {t('logsTabOperational')}
            </button>
            <button
              onClick={() => switchView('audit')}
              className={`px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer ${activeView === 'audit' ? 'bg-[#262626] text-white' : 'text-stone-600 hover:text-stone-900'
                }`}
            >
              {t('logsTabAudit')}
            </button>
            <button
              onClick={() => switchView('conversations')}
              className={`px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer ${activeView === 'conversations' ? 'bg-[#262626] text-white' : 'text-stone-600 hover:text-stone-900'
                }`}
            >
              {t('logsTabAiChat')}
            </button>
          </div>

          <button
            onClick={() => handleExportLogs('csv')}
            className="px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-all hover:bg-[#E9E5DC]/80"
            style={{
              backgroundColor: '#E9E5DC',
              borderColor: '#BFBFBD',
              color: '#262626',
            }}
          >
            {t('logsExportCsv')}
          </button>
          <button
            onClick={() => handleExportLogs('json')}
            className="px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-all hover:bg-[#E9E5DC]/80"
            style={{
              backgroundColor: '#E9E5DC',
              borderColor: '#BFBFBD',
              color: '#262626',
            }}
          >
            {t('logsExportJson')}
          </button>
        </div>
      </div>

      {/* Content Body */}
      <div className="p-4 space-y-3">

      {/* 4 Metric Cards (Single Compact Row) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <div className="p-3 rounded-xl border flex flex-col justify-between" style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD' }}>
          <div className="text-[11px] font-semibold" style={{ color: '#8C8C8C' }}>{t('logsMetricTotal')}</div>
          <div className="flex items-baseline gap-1.5 my-1">
            <span className="text-2xl font-bold" style={{ color: '#262626' }}>
              {statistics.total || totalLogs}
            </span>
            <span className="text-xs" style={{ color: '#8C8C8C' }}>{t('logsMetricEvents')}</span>
          </div>
          <div className="text-[10px] font-medium" style={{ color: '#8C8C8C' }}></div>
        </div>

        <div className="p-3 rounded-xl border flex flex-col justify-between" style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD' }}>
          <div className="text-[11px] font-semibold" style={{ color: '#8C8C8C' }}>{t('logsMetricWarning')}</div>
          <div className="flex items-baseline gap-1.5 my-1">
            <span className="text-2xl font-bold" style={{ color: '#262626' }}>{statistics.warnings || 0}</span>
            <span className="text-xs" style={{ color: '#8C8C8C' }}>{t('logsMetricToReview')}</span>
          </div>
          <div className="text-[10px] font-medium" style={{ color: '#8C8C8C' }}></div>
        </div>

        <div className="p-3 rounded-xl border flex flex-col justify-between" style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD' }}>
          <div className="text-[11px] font-semibold" style={{ color: '#8C8C8C' }}>{t('logsMetricErrors')}</div>
          <div className="flex items-baseline gap-1.5 my-1">
            <span className="text-2xl font-bold" style={{ color: '#262626' }}>{(statistics.errors || 0) + (statistics.critical || 0)}</span>
            <span className="text-xs" style={{ color: '#8C8C8C' }}>{t('logsMetricErrorsUnit')}</span>
          </div>
          <div className="text-[10px] font-medium" style={{ color: '#8C8C8C' }}></div>
        </div>

        <div className="p-3 rounded-xl border flex flex-col justify-between" style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD' }}>
          <div className="text-[11px] font-semibold" style={{ color: '#8C8C8C' }}>{t('logsMetricTraceStatus')}</div>
          <div className="flex items-baseline gap-1.5 my-1">
            <span className="text-2xl font-bold" style={{ color: '#262626' }}>{isLiveStreaming ? t('logsMetricLiveAuto') : t('logsMetricManual')}</span>
          </div>
        </div>
      </div>

      {activeView === 'operational' ? (
        <AdminLogsOperationalView
          language={language}
          selectedLevel={selectedLevel}
          setSelectedLevel={setSelectedLevel}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
          selectedDepartment={selectedDepartment}
          setSelectedDepartment={setSelectedDepartment}
          handleManualRefresh={handleManualRefresh}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          handleSearchSubmit={handleSearchSubmit}
          setCurrentPage={setCurrentPage}
          isLoading={isLoading}
          logs={logs}
          setSelectedLog={setSelectedLog}
          formatTimestamp={formatTimestamp}
          getLevelBadgeStyle={getLevelBadgeStyle}
          formatLogMessage={formatLogMessage}
          handleOpenTrace={handleOpenTrace}
          currentPage={currentPage}
          totalLogs={totalLogs}
          pageSize={pageSize}
          handlePageChange={handlePageChange}
        />
      ) : (activeView === 'audit' || activeView === 'conversations') ? (
        <AdminLogsAuditAndChatViews
          activeView={activeView}
          language={language}
          auditLogs={auditLogs}
          totalAudit={totalAudit}
          currentPage={currentPage}
          pageSize={pageSize}
          handlePageChange={handlePageChange}
          formatTimestamp={formatTimestamp}
          chatSearchQuery={chatSearchQuery}
          setChatSearchQuery={setChatSearchQuery}
          setCurrentPage={setCurrentPage}
          chatSessions={chatSessions}
          filteredChatSessions={filteredChatSessions}
          paginatedChatSessions={paginatedChatSessions}
          handleManualRefresh={handleManualRefresh}
          isLoading={isLoading}
          handleOpenChatTranscript={handleOpenChatTranscript}
        />
      ) : null}
      </div>

      <AdminLogsModals
        language={language}
        selectedLog={selectedLog}
        setSelectedLog={setSelectedLog}
        formatTimestamp={formatTimestamp}
        formatLogMessage={formatLogMessage}
        handleOpenTrace={handleOpenTrace}
        activeTrace={activeTrace}
        setActiveTrace={setActiveTrace}
        isTraceLoading={isTraceLoading}
        activeChatSession={activeChatSession}
        setActiveChatSession={setActiveChatSession}
        isChatMessagesLoading={isChatMessagesLoading}
        chatMessages={chatMessages}
      />
    </div>
  );
};
