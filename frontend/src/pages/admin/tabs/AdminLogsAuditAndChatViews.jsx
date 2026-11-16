import React from 'react';
import { RotateCw, MessageSquare } from 'lucide-react';
import { Pagination } from '../../../components/common/Pagination';
import { useLanguage } from '../../../context/LanguageContext';

export const AdminLogsAuditAndChatViews = ({
  activeView,
  auditLogs,
  totalAudit,
  currentPage,
  pageSize,
  onPageChange,
  formatTimestamp,
  chatSearchQuery,
  onChatSearchChange,
  onRefreshChat,
  isChatLoading,
  filteredChatSessions,
  paginatedChatSessions,
  onOpenChatTranscript,
}) => {
  const { t } = useLanguage();

  if (activeView === 'conversations') {
    return (
      <div className="space-y-3">
        <div
          className="p-2.5 rounded-xl border flex flex-wrap items-center gap-2"
          style={{
            backgroundColor: '#FFFFFF',
            borderColor: '#BFBFBD',
          }}
        >
          <input
            type="text"
            value={chatSearchQuery}
            onChange={(e) => {
              onChatSearchChange(e.target.value);
              onPageChange(1);
            }}
            placeholder={t('logsChatSearchPlaceholder')}
            className="flex-1 min-w-[200px] px-3 py-1.5 rounded-lg border text-xs outline-none"
            style={{
              backgroundColor: '#F2EFE9',
              borderColor: '#BFBFBD',
              color: '#262626',
            }}
          />
          <button
            type="button"
            onClick={onRefreshChat}
            disabled={isChatLoading}
            className="px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 cursor-pointer hover:bg-[#E9E5DC]/80 transition-colors"
            style={{
              backgroundColor: '#FFFFFF',
              borderColor: '#BFBFBD',
              color: '#262626',
            }}
          >
            <RotateCw className={`w-3.5 h-3.5 ${isChatLoading ? 'animate-spin' : ''}`} />
            <span>{t('logsRefreshTooltip')}</span>
          </button>
        </div>

        <div
          className="rounded-xl border overflow-hidden shadow-none"
          style={{
            backgroundColor: '#FFFFFF',
            borderColor: '#BFBFBD',
          }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr
                  className="border-b text-[11px] font-semibold uppercase tracking-wider"
                  style={{
                    backgroundColor: '#E9E5DC',
                    borderColor: '#BFBFBD',
                    color: '#262626',
                  }}
                >
                  <th className="py-2 px-3 w-48">{t('logsChatColSession')}</th>
                  <th className="py-2 px-3">{t('logsChatColRoom')}</th>
                  <th className="py-2 px-3 w-32">{t('logsChatColStatus')}</th>
                  <th className="py-2 px-3 w-44">{t('logsChatColUpdated')}</th>
                  <th className="py-2 px-3 w-32 text-right">{t('logsColAction')}</th>
                </tr>
              </thead>
              <tbody className="divide-y text-xs" style={{ borderColor: '#E9E5DC' }}>
                {isChatLoading ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center" style={{ color: '#8C8C8C' }}>
                      {t('logsChatLoading')}
                    </td>
                  </tr>
                ) : paginatedChatSessions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center" style={{ color: '#8C8C8C' }}>
                      {t('logsChatEmpty')}
                    </td>
                  </tr>
                ) : (
                  paginatedChatSessions.map((session) => (
                    <tr key={session.id} className="hover:bg-[#F2EFE9]/50 transition-colors">
                      <td className="py-2 px-3 font-mono text-[11px] text-stone-700">
                        {session.id}
                      </td>
                      <td className="py-2 px-3 font-medium text-stone-900">
                        {session.room_number
                          ? `Room ${session.room_number}${session.guest_name ? ` — ${session.guest_name}` : ''}`
                          : session.guest_name || t('logsChatLobbyGuest')}
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className="px-2 py-0.5 rounded-full text-[10px] font-bold border"
                          style={
                            session.is_active
                              ? { backgroundColor: '#262626', color: '#F2EFE9', borderColor: '#262626' }
                              : { backgroundColor: '#E9E5DC', color: '#525252', borderColor: '#BFBFBD' }
                          }
                        >
                          {session.is_active ? t('logsChatStatusActive') : t('logsChatStatusEnded')}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-mono text-[11px]" style={{ color: '#8C8C8C' }}>
                        {formatTimestamp(session.updated_at || session.created_at)}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => onOpenChatTranscript(session)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded border text-[11px] font-semibold cursor-pointer hover:bg-[#E9E5DC]/80 transition-colors"
                          style={{
                            backgroundColor: '#FFFFFF',
                            borderColor: '#BFBFBD',
                            color: '#262626',
                          }}
                        >
                          <MessageSquare className="w-3 h-3" />
                          <span>{t('logsChatActionTranscript')}</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <Pagination
            currentPage={currentPage}
            totalItems={filteredChatSessions.length}
            pageSize={pageSize}
            onPageChange={onPageChange}
            className="border-t px-3 py-2"
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl border overflow-hidden shadow-none"
      style={{
        backgroundColor: '#FFFFFF',
        borderColor: '#BFBFBD',
      }}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr
              className="border-b text-[11px] font-semibold uppercase tracking-wider"
              style={{
                backgroundColor: '#E9E5DC',
                borderColor: '#BFBFBD',
                color: '#262626',
              }}
            >
              <th className="py-2 px-3 w-32">{t('logsColTime')}</th>
              <th className="py-2 px-3 w-32">{t('logsColAction')}</th>
              <th className="py-2 px-3 w-36">{t('logsColActor')}</th>
              <th className="py-2 px-3 w-32">{t('logsColResource')}</th>
              <th className="py-2 px-3">{t('logsColChanges')}</th>
              <th className="py-2 px-3 w-28">{t('logsColIp')}</th>
            </tr>
          </thead>
          <tbody className="divide-y text-xs" style={{ borderColor: '#E9E5DC' }}>
            {auditLogs.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-6 text-center" style={{ color: '#8C8C8C' }}>
                  {t('logsAuditEmpty')}
                </td>
              </tr>
            ) : (
              auditLogs.map((item) => (
                <tr key={item.id} className="hover:bg-[#F2EFE9]/50 transition-colors">
                  <td className="py-2 px-3 font-mono text-[11px]" style={{ color: '#8C8C8C' }}>
                    {formatTimestamp(item.timestamp)}
                  </td>
                  <td className="py-2 px-3 font-bold text-indigo-700">
                    {item.action}
                  </td>
                  <td className="py-2 px-3 font-medium">
                    {item.actor_name || item.actor_id || 'System'} ({item.actor_type})
                  </td>
                  <td className="py-2 px-3 font-mono text-[11px]">
                    {item.resource_type} #{item.resource_id}
                  </td>
                  <td className="py-2 px-3 text-[11px] text-stone-700">
                    {item.after_state ? JSON.stringify(item.after_state) : 'Action logged'}
                  </td>
                  <td className="py-2 px-3 font-mono text-[10px] text-stone-500">
                    {item.ip_address || '127.0.0.1'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        currentPage={currentPage}
        totalItems={totalAudit}
        pageSize={pageSize}
        onPageChange={onPageChange}
        className="border-t px-3 py-2"
      />
    </div>
  );
};

export const AdminChatTranscriptModal = ({
  session,
  messages,
  isLoading,
  formatTimestamp,
  onClose,
}) => {
  const { t } = useLanguage();
  if (!session) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        className="max-w-2xl w-full p-5 rounded-2xl border shadow-2xl space-y-4 max-h-[85vh] flex flex-col"
        style={{
          backgroundColor: '#FFFFFF',
          borderColor: '#BFBFBD',
        }}
      >
        <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: '#E9E5DC' }}>
          <div>
            <h3 className="text-sm font-black text-stone-900">
              {t('logsChatModalTitle')}
            </h3>
            <p className="text-[11px] font-mono text-stone-500 mt-0.5">
              {session.id}
              {session.room_number ? ` • Room ${session.room_number}` : ''}
              {session.guest_name ? ` • ${session.guest_name}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-stone-100 text-stone-600 hover:bg-stone-200 flex items-center justify-center font-bold text-xs cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2.5 pr-1 text-xs">
          {isLoading ? (
            <div className="py-10 text-center text-stone-400">{t('logsChatLoading')}</div>
          ) : messages.length === 0 ? (
            <div className="py-10 text-center text-stone-400">{t('logsChatModalEmpty')}</div>
          ) : (
            messages.map((msg, idx) => {
              const isUser = msg.sender === 'user';
              return (
                <div
                  key={msg.id || idx}
                  className={`p-3 rounded-xl border space-y-1 ${
                    isUser ? 'bg-[#F2EFE9] border-[#BFBFBD]' : 'bg-white border-stone-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="px-2 py-0.5 rounded text-[10px] font-bold uppercase"
                        style={
                          isUser
                            ? { backgroundColor: '#262626', color: '#F2EFE9' }
                            : { backgroundColor: '#E9E5DC', color: '#262626' }
                        }
                      >
                        {isUser ? t('logsChatRoleGuest') : t('logsChatRoleAi')}
                      </span>
                      {msg.intent_action && (
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-stone-100 text-stone-600 border border-stone-200">
                          intent: {msg.intent_action}
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-[10px] text-stone-400">
                      {formatTimestamp(msg.created_at)}
                    </span>
                  </div>
                  <div className="text-xs text-stone-900 whitespace-pre-wrap leading-relaxed">
                    {msg.text}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="flex justify-end pt-3 border-t" style={{ borderColor: '#E9E5DC' }}>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-stone-900 text-white cursor-pointer"
          >
            {t('logsDetailClose')}
          </button>
        </div>
      </div>
    </div>
  );
};
