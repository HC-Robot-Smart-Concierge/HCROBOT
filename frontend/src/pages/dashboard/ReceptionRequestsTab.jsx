import React from 'react';
import { CheckCircle2, User, MapPin, RefreshCw, ArrowLeft, ChevronRight } from 'lucide-react';
import { Pagination } from '../../components/common/Pagination';
import { staffStatusLabel } from '../../context/StaffLanguage';

export const ReceptionRequestsTab = ({
  activeRequest, statusColor, isCompleted, isInProgress, isViewingHistory, setIsViewingHistory, loadData, handleStartTask, handleComplete, recentRequests, paginatedRecentRequests, currentPage, totalPages, pageSize, setCurrentPage, normalizeRequest, setActiveRequest, st,
}) => (
  <>
          <div>
            {activeRequest ? (
              <div>
                <header className="reception-panel rounded-2xl bg-white p-5 border border-[#E8E5E0] shadow-2xs flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2.5 text-[11px] text-[#77726D]">
                      <span className="rounded bg-[#EFEEEB] px-2.5 py-1 font-mono font-bold tracking-wide text-stone-800">
                        {activeRequest.ticketCode}
                      </span>
                      <span>{st('Created:')} {activeRequest.createdLabel || st('Just now')}</span>
                      <span className={`font-bold ${statusColor}`}>● {st(staffStatusLabel(activeRequest.status))}</span>
                      {isViewingHistory && (
                        <span className="px-2 py-0.5 text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 rounded">{st("Reviewing history")} </span>
                      )}
                    </div>
                    <h2 className="mt-2 text-base font-bold text-[#211F1D]">{activeRequest.title || st('Reception & reservation request')}</h2>
                  </div>

                  <div className="flex items-center gap-2">
                    {isViewingHistory && (
                      <button
                        type="button"
                        onClick={loadData}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 px-3.5 py-2 text-[11px] font-bold text-stone-700 cursor-pointer transition-colors"
                      >
                        <ArrowLeft className="h-3.5 w-3.5" />{st("Back to current request")} </button>
                    )}

                    {isCompleted ? (
                      <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />{st("Completed")} </span>
                    ) : (
                      <>
                        {!isInProgress && (
                          <button
                            type="button"
                            onClick={handleStartTask}
                            className="rounded-lg bg-stone-900 px-4 py-2 text-[11px] font-bold text-white hover:bg-black cursor-pointer shadow-xs transition-colors"
                          >{st("Start request")} </button>
                        )}
                        <button
                          type="button"
                          onClick={handleComplete}
                          className="rounded-lg bg-emerald-600 px-4 py-2 text-[11px] font-bold text-white hover:bg-emerald-700 cursor-pointer shadow-xs transition-colors"
                        >{st("Mark completed")} </button>
                      </>
                    )}
                  </div>
                </header>

                {/* Thông tin chi tiết yêu cầu */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                  <article className="reception-panel rounded-xl bg-[#F4F3F0] p-4 border border-[#E8E5E0]">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#77726D] flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {st("Location")} </p>
                    <p className="mt-1 text-[13px] font-semibold text-[#2B2825]">{st(activeRequest.location)}</p>
                    <p className="mt-0.5 text-[11px] text-[#6F6A65]">
                      {st(activeRequest.locationDetails?.floor || 'Lobby area')} • {st(activeRequest.locationDetails?.category || 'Standard Room')}
                    </p>
                  </article>

                  <article className="reception-panel rounded-xl bg-[#F4F3F0] p-4 border border-[#E8E5E0]">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#77726D] flex items-center gap-1">
                      <User className="h-3 w-3" /> {st("Guest Profile")} </p>
                    <div className="mt-1 flex items-center gap-2">
                      <p className="truncate text-[13px] font-semibold text-[#2B2825]">{activeRequest.guestName || st('Hotel guest')}</p>
                      <span className="rounded bg-black px-1.5 py-0.5 text-[9px] font-bold text-white">
                        {st(activeRequest.guestTier || 'Standard')}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-[#6F6A65]">
                      {activeRequest.guestStayDetails || st('Guest staying at the hotel')}
                    </p>
                  </article>
                </div>

                <article className="reception-panel mt-4 rounded-xl bg-white p-5 border border-[#E8E5E0]">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#57524D]">{st("Issue Description")}</h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-[#3F3B37]">{activeRequest.description || st('No description provided.')}</p>

                  {activeRequest.attachedMedia && activeRequest.attachedMedia.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-[#F0ECE6]">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#77726D]">{st("Attached Media (")}{activeRequest.attachedMedia.length})
                      </p>
                      <div className="mt-2 flex gap-3">
                        {activeRequest.attachedMedia.map((media) => (
                          <img
                            key={media.url}
                            src={media.url}
                            alt={media.alt || st("Media")}
                            className="h-20 w-24 rounded object-cover border border-[#E5E2DD]"
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </article>

                {activeRequest.transcript && activeRequest.transcript.length > 0 && (
                  <article className="reception-panel mt-4 rounded-xl bg-[#F4F3F0] p-5 border border-[#E8E5E0]">
                    <div className="flex items-center justify-between gap-3 border-b border-[#E5E2DD] pb-3">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-[#4E4945]">{st("HCRobot Transcript")} </div>
                      <span className="text-[10px] text-[#716C67]">{st("Source: Voice Assistant")} </span>
                    </div>

                    <div className="mt-3 space-y-2.5">
                      {activeRequest.transcript.map((entry, index) => {
                        const isAssistant = entry.speaker === 'assistant';
                        return (
                          <div key={`${entry.time}-${index}`} className="flex items-start gap-2 text-[12px]">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${isAssistant ? 'bg-black text-white' : 'bg-[#E0DDD8] text-[#444]'}`}>
                              {isAssistant ? 'Robot' : st("Guest")}
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
              <div className="reception-panel rounded-2xl border border-stone-200 bg-white p-10 text-center shadow-xs">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <h3 className="mt-4 text-base font-bold text-stone-900">{st("No pending requests")} </h3>
                <p className="mx-auto mt-1.5 max-w-md text-xs text-stone-500 leading-relaxed">{st("All Reception requests have been completed. Ready to receive new requests from guests and HCRobot.")} </p>
                <div className="reception-request-actions">
                  <button
                    type="button"
                    onClick={loadData}
                    className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-black transition-colors cursor-pointer"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />{st("Check for new requests")} </button>
                  {onNavigate && (
                    <button
                      type="button"
                      onClick={() => onNavigate('Requests')}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 transition-colors cursor-pointer"
                    >{st("View request history")} </button>
                  )}
                </div>
              </div>
            )}

            {/* Danh sách các yêu cầu gần đây */}
            {recentRequests.length > 0 && (
              <section className="reception-panel mt-6 rounded-2xl border border-[#E8E5E0] bg-white p-5 shadow-2xs">
                <div className="flex items-center justify-between pb-3 border-b border-[#F0ECE6]">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-stone-900">{st("Recent Reception requests")} </h3>
                    <p className="text-[11px] text-stone-500">{st("Recently received and processed support requests")} </p>
                  </div>
                  <span className="text-xs font-semibold text-stone-500">
                    {recentRequests.length} {st("requests")} </span>
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
                              {r.room_number || r.location || st("Lobby")} • {r.guest_name || st("Hotel guest")}
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
                            ● {st(staffStatusLabel(r.status))}
                          </span>
                          <ChevronRight className="h-4 w-4 text-stone-400" />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {recentRequests.length > 0 && (
                  <Pagination
                    currentPage={currentPage}
                    totalItems={recentRequests.length}
                    pageSize={pageSize}
                    onPageChange={setCurrentPage}
                    itemName={st("requests")}
                    className="mt-3 rounded-2xl border border-[#E5E1D8] shadow-xs bg-white"
                  />
                )}
              </section>
            )}
          </div>
  </>
);
