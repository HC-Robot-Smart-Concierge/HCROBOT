import React from 'react';
import { RotateCw, MessageSquare } from 'lucide-react';
import { Pagination } from '../../../components/common/Pagination';

export const AdminLogsAuditAndChatViews = ({
  activeView, language, auditLogs, totalAudit, currentPage, pageSize, handlePageChange, formatTimestamp, chatSearchQuery, setChatSearchQuery, setCurrentPage, chatSessions, filteredChatSessions, paginatedChatSessions, handleManualRefresh, isLoading, handleOpenChatTranscript,
}) => (
  <>
    {activeView === 'audit' ? (
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
            onPageChange={handlePageChange}
            className="border-t px-3 py-2"
          />
        </div>
    ) : (
        <>
          <div
            className="p-2.5 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-2.5"
            style={{
              backgroundColor: '#E9E5DC',
              borderColor: '#BFBFBD',
            }}
          >
            <input
              type="text"
              value={chatSearchQuery}
              onChange={(e) => { setChatSearchQuery(e.target.value); setCurrentPage(1); }}
              placeholder={t('logsChatSearchPlaceholder')}
              className="w-full sm:w-80 px-3 py-1.5 rounded-lg text-xs font-normal border focus:outline-none"
              style={{
                backgroundColor: '#FFFFFF',
                borderColor: '#BFBFBD',
                color: '#262626',
              }}
            />

            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={isLoading}
              title={t('logsRefreshTooltip')}
              className="px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-all hover:bg-[#F2EFE9] active:scale-95 flex items-center gap-1.5 shrink-0"
              style={{
                backgroundColor: '#FFFFFF',
                borderColor: '#BFBFBD',
                color: '#262626',
              }}
            >
              <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
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
                    <th className="py-2 px-3 w-40">{t('logsChatColUpdated')}</th>
                    <th className="py-2 px-3">{t('logsChatColSession')}</th>
                    <th className="py-2 px-3 w-48">{t('logsChatColRoom')}</th>
                    <th className="py-2 px-3 w-36 text-center">{t('logsChatColStatus')}</th>
                    <th className="py-2 px-3 w-40 text-right">{t('logsColAction')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-xs" style={{ borderColor: '#E9E5DC' }}>
                  {isLoading && chatSessions.length === 0 ? (
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
                        <td className="py-2 px-3 font-mono text-[11px]" style={{ color: '#8C8C8C' }}>
                          {formatTimestamp(session.updated_at || session.created_at)}
                        </td>
                        <td className="py-2 px-3 font-mono text-[11px] font-semibold" style={{ color: '#262626' }}>
                          {session.id}
                        </td>
                        <td className="py-2 px-3 text-[11px] font-medium" style={{ color: '#262626' }}>
                          {session.room_number
                            ? `${language === 'EN' ? 'Room' : 'Phòng'} ${session.room_number}`
                            : t('logsChatLobbyGuest')}
                          {session.guest_name ? ` • ${session.guest_name}` : ''}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span
                            className="px-2 py-0.5 rounded text-[10px] font-semibold border"
                            style={
                              session.is_active
                                ? { backgroundColor: '#262626', color: '#F2EFE9', borderColor: '#262626' }
                                : { backgroundColor: '#FFFFFF', color: '#8C8C8C', borderColor: '#BFBFBD' }
                            }
                          >
                            {session.is_active ? t('logsChatStatusActive') : t('logsChatStatusEnded')}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right">
                          <button
                            onClick={() => handleOpenChatTranscript(session)}
                            className="text-[11px] font-bold px-2.5 py-1 rounded border cursor-pointer hover:bg-stone-200 inline-flex items-center gap-1"
                            style={{
                              backgroundColor: '#E9E5DC',
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
              onPageChange={handlePageChange}
              className="border-t px-3 py-2"
            />
          </div>
        </>
    )}
  </>
);
