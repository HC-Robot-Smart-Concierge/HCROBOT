import React from 'react';
import { MessageSquare, Bot, User, X } from 'lucide-react';

export const AdminLogsModals = ({
  language, selectedLog, setSelectedLog, formatTimestamp, formatLogMessage, handleOpenTrace, activeTrace, setActiveTrace, isTraceLoading, activeChatSession, setActiveChatSession, isChatMessagesLoading, chatMessages,
}) => (
  <>
      {/* MODAL: LOG DETAILS */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            className="max-w-xl w-full p-4 rounded-xl border shadow-xl space-y-3"
            style={{
              backgroundColor: '#FFFFFF',
              borderColor: '#BFBFBD',
            }}
          >
            <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: '#BFBFBD' }}>
              <h3 className="text-xs font-bold" style={{ color: '#262626' }}>
                {t('logsDetailTitle')} #{selectedLog.id}
              </h3>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-xs font-bold px-2 py-0.5 rounded border cursor-pointer"
                style={{
                  backgroundColor: '#E9E5DC',
                  borderColor: '#BFBFBD',
                  color: '#262626',
                }}
              >
                {t('logsDetailClose')}
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-2.5 rounded border space-y-1" style={{ backgroundColor: '#E9E5DC', borderColor: '#BFBFBD' }}>
                <div className="font-semibold text-xs" style={{ color: '#262626' }}>
                  {formatLogMessage(selectedLog.message)}
                </div>
                <div className="text-[10px] font-mono" style={{ color: '#8C8C8C' }}>
                  {t('logsDetailTime')} {selectedLog.timestamp}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2 rounded border" style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD' }}>
                  <span style={{ color: '#8C8C8C' }}>{t('logsDetailLevel')} </span>
                  <span className="font-bold" style={{ color: '#262626' }}>{selectedLog.level}</span>
                </div>
                <div className="p-2 rounded border" style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD' }}>
                  <span style={{ color: '#8C8C8C' }}>{t('logsDetailCategory')} </span>
                  <span className="font-bold" style={{ color: '#262626' }}>{selectedLog.category}</span>
                </div>
                <div className="p-2 rounded border" style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD' }}>
                  <span style={{ color: '#8C8C8C' }}>{t('logsDetailActor')} </span>
                  <span className="font-mono font-bold" style={{ color: '#262626' }}>
                    {selectedLog.actor_id || selectedLog.actor_type || 'N/A'}
                  </span>
                </div>
                <div className="p-2 rounded border" style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD' }}>
                  <span style={{ color: '#8C8C8C' }}>{t('logsDetailModule')} </span>
                  <span className="font-mono font-bold" style={{ color: '#262626' }}>{selectedLog.module || 'core'}</span>
                </div>
              </div>

              {selectedLog.correlation_id && (
                <div className="p-2 rounded border flex items-center justify-between" style={{ backgroundColor: '#E9E5DC', borderColor: '#BFBFBD' }}>
                  <div>
                    <span className="text-[10px] font-bold text-stone-500 block">{t('logsDetailCorrelation')}</span>
                    <span className="font-mono text-xs font-bold text-stone-800">{selectedLog.correlation_id}</span>
                  </div>
                  <button
                    onClick={() => {
                      const corr = selectedLog.correlation_id;
                      setSelectedLog(null);
                      handleOpenTrace(corr);
                    }}
                    className="px-2.5 py-1 rounded bg-[#262626] text-white text-[11px] font-bold cursor-pointer"
                  >
                    {t('logsDetailViewFullTrace')}
                  </button>
                </div>
              )}

              {selectedLog.metadata && (
                <div>
                  <div className="text-[10px] font-semibold mb-1" style={{ color: '#8C8C8C' }}>{t('logsDetailMetadata')}</div>
                  <pre
                    className="p-2.5 rounded border text-[11px] font-mono overflow-x-auto max-h-40"
                    style={{
                      backgroundColor: '#E9E5DC',
                      borderColor: '#BFBFBD',
                      color: '#262626',
                    }}
                  >
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t" style={{ borderColor: '#BFBFBD' }}>
              <button
                onClick={() => setSelectedLog(null)}
                className="px-3 py-1.5 rounded text-xs font-semibold border cursor-pointer"
                style={{
                  backgroundColor: '#262626',
                  borderColor: '#262626',
                  color: '#F2EFE9',
                }}
              >
                {t('logsDetailDone')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: TRANSACTION TRACE TIMELINE */}
      {activeTrace && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-2xl w-full bg-white p-6 rounded-2xl border border-stone-200 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-sm font-bold text-stone-900">
                  {t('logsTraceTitle')} #{activeTrace.correlation_id}
                </h3>
                <p className="text-[11px] text-stone-500">
                  {t('logsTraceSteps').replace('{count}', activeTrace.total_steps || activeTrace.timeline?.length || 0)}
                </p>
              </div>
              <button
                onClick={() => setActiveTrace(null)}
                className="w-7 h-7 rounded-full bg-stone-100 text-stone-600 hover:bg-stone-200 flex items-center justify-center font-bold text-xs cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-1 text-xs">
              {isTraceLoading ? (
                <div className="py-10 text-center text-stone-400">{t('logsTraceLoading')}</div>
              ) : activeTrace.timeline?.length === 0 ? (
                <div className="py-10 text-center text-stone-400">{t('logsTraceEmpty')}</div>
              ) : (
                activeTrace.timeline?.map((step, idx) => (
                  <div key={step.id || idx} className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] text-indigo-600 font-bold">
                        {t('logsTraceStep')} {idx + 1} • {step.event_type || step.category}
                      </span>
                      <span className="font-mono text-[10px] text-stone-400">
                        {step.timestamp}
                      </span>
                    </div>
                    <div className="font-semibold text-stone-900">{formatLogMessage(step.message)}</div>
                    <div className="text-[10px] text-stone-500">
                      Module: <span className="font-mono">{step.module}</span> • {t('logsColActor')}: <span className="font-mono">{step.actor_id || step.actor_type}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-3 border-t">
              <button
                onClick={() => setActiveTrace(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-stone-900 text-white cursor-pointer"
              >
                {t('logsDetailClose')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: AI CHAT TRANSCRIPT */}
      {activeChatSession && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            className="max-w-2xl w-full p-5 rounded-2xl border shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200 max-h-[85vh] flex flex-col"
            style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD' }}
          >
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: '#BFBFBD' }}>
              <div className="min-w-0">
                <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: '#262626' }}>
                  <MessageSquare className="w-4 h-4 shrink-0" />
                  <span>{t('logsChatModalTitle')}</span>
                </h3>
                <p className="text-[11px] font-mono truncate mt-0.5" style={{ color: '#8C8C8C' }}>
                  {activeChatSession.id}
                  {activeChatSession.room_number
                    ? ` • ${language === 'EN' ? 'Room' : 'Phòng'} ${activeChatSession.room_number}`
                    : ` • ${t('logsChatLobbyGuest')}`}
                  {activeChatSession.guest_name ? ` • ${activeChatSession.guest_name}` : ''}
                </p>
              </div>
              <button
                onClick={() => setActiveChatSession(null)}
                className="w-7 h-7 rounded-full flex items-center justify-center cursor-pointer transition-colors hover:bg-stone-200"
                style={{ backgroundColor: '#E9E5DC', color: '#262626' }}
                aria-label={t('logsDetailClose')}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2.5 pr-1 text-xs">
              {isChatMessagesLoading ? (
                <div className="py-10 text-center" style={{ color: '#8C8C8C' }}>{t('logsChatLoading')}</div>
              ) : chatMessages.length === 0 ? (
                <div className="py-10 text-center" style={{ color: '#8C8C8C' }}>{t('logsChatModalEmpty')}</div>
              ) : (
                chatMessages.map((msg, idx) => {
                  const isGuest = msg.sender === 'user';
                  return (
                    <div
                      key={msg.id || idx}
                      className="p-3 rounded-xl border space-y-1.5"
                      style={{
                        backgroundColor: isGuest ? '#F2EFE9' : '#FFFFFF',
                        borderColor: '#BFBFBD',
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 font-bold text-[11px]" style={{ color: '#262626' }}>
                          {isGuest ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                          <span>{isGuest ? t('logsChatRoleGuest') : t('logsChatRoleAi')}</span>
                          {msg.language && (
                            <span
                              className="px-1.5 py-0.2 rounded border text-[9px] font-mono font-semibold"
                              style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#8C8C8C' }}
                            >
                              {msg.language}
                            </span>
                          )}
                          {msg.intent_action && (
                            <span
                              className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold"
                              style={{ backgroundColor: '#262626', color: '#F2EFE9' }}
                            >
                              {msg.intent_action}
                            </span>
                          )}
                        </div>
                        <span className="font-mono text-[10px]" style={{ color: '#8C8C8C' }}>
                          {formatTimestamp(msg.created_at)}
                        </span>
                      </div>
                      <div className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: '#262626' }}>
                        {msg.text}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex justify-end pt-3 border-t" style={{ borderColor: '#BFBFBD' }}>
              <button
                onClick={() => setActiveChatSession(null)}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer"
                style={{ backgroundColor: '#262626', borderColor: '#262626', color: '#F2EFE9' }}
              >
                {t('logsDetailClose')}
              </button>
            </div>
          </div>
        </div>
      )}
  </>
);
