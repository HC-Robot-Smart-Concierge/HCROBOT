import React from 'react';
import {
  Clock,
  MapPin,
  AlertTriangle,
  User,
  CheckCircle2,
} from 'lucide-react';
import { Pagination } from '../../components/common/Pagination';
import { CONCIERGE_PAGE_SIZE, normalizeEmotionStatus } from './conciergeDashboardUtils';

export const ConciergeEmotionAlertsView = ({
  activeSubTab,
  emotionAlerts,
  emotionFilter,
  setEmotionFilter,
  filteredEmotionAlerts,
  paginatedEmotionAlerts,
  emotionAlertsPage,
  setEmotionAlertsPage,
  handleAcceptEmotionAlert,
  handleCompleteEmotionAlert,
}) => (
  <>
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
                  pageSize={CONCIERGE_PAGE_SIZE}
                  onPageChange={setEmotionAlertsPage}
                  itemName="cảnh báo"
                />
              )}
            </div>
          </div>
        )}
  </>
);
