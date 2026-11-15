import React from 'react';
import {
  Clock,
  MessageSquare,
  Star,
} from 'lucide-react';
import { Pagination } from '../../components/common/Pagination';
import { CONCIERGE_PAGE_SIZE } from './conciergeDashboardUtils';

export const ConciergeFeedbackView = ({
  activeSubTab,
  feedbacks,
  feedbackRatingFilter,
  setFeedbackRatingFilter,
  filteredFeedbacks,
  paginatedFeedbacks,
  feedbackPage,
  setFeedbackPage,
  handleViewTranscript,
}) => (
  <>
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
                  pageSize={CONCIERGE_PAGE_SIZE}
                  onPageChange={setFeedbackPage}
                  itemName="đánh giá"
                />
              )}
            </div>
          </div>
        )}
  </>
);
