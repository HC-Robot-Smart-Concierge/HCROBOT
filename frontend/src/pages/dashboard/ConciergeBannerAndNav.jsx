import React from 'react';
import {
  PhoneCall,
  Video,
  Plus,
  RefreshCw,
  Car,
  Navigation,
  Film,
  Star,
  AlertTriangle,
  ShieldAlert,
} from 'lucide-react';
import { StaffPageHeader } from '../../components/dashboard/RoomServiceFrame';
import { normalizeEmotionStatus } from './conciergeDashboardUtils';

export const ConciergeBannerAndNav = ({
  activeSubTab,
  setInternalSubTab,
  isManagedFromSidebar,
  isLoading,
  loadData,
  setIsTestModalOpen,
  setIsEmotionModalOpen,
  setIsTaxiModalOpen,
  activeCount,
  activeEmotionAlerts,
  recordedSessions,
  taxiKpis,
  feedbacks,
  handleAcceptEmotionAlert,
  handleCompleteEmotionAlert,
}) => (
  <>
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
  </>
);
