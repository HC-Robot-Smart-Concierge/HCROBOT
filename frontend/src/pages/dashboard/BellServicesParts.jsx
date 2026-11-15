import React from 'react';
import {
  Luggage,
  SearchCheck,
  CheckCircle2,
  Clock,
  MapPin,
  User,
  X,
} from 'lucide-react';
import { staffStatusLabel } from '../../context/StaffLanguage';
import {
  BELL_SERVICE_LABELS,
  FLOW_TABS,
  getStatusLabel,
  getFlowBadge,
  getAcceptButtonLabel,
  getCompleteButtonLabel,
} from './bellServicesUtils';

export const BellKpiAndFlowTabs = ({
  metrics,
  activeFlow,
  setActiveFlow,
  flowCounts,
}) => (
  <>
    {/* KPI Cards */}
    <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {metrics.map(({ label, subLabel, value, flowId }) => {
        const isSelected = activeFlow === flowId;
        return (
          <article
            key={label}
            onClick={() => setActiveFlow(flowId)}
            className={`rounded-xl px-5 py-4 border transition-all cursor-pointer ${
              isSelected
                ? 'bg-white border-[#1A1917] ring-1 ring-[#1A1917]/20'
                : 'bg-white border-[#E8E5E0] hover:border-[#BDB7AE]'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-[#666]">{label}</span>
            </div>
            <p className="mt-2 text-[22px] font-bold text-[#262626]">{value}</p>
            {subLabel && <p className="mt-1 text-[11px] text-[#777]">{subLabel}</p>}
          </article>
        );
      })}
    </section>

    {/* 2 Specialized Bellman Flow Tabs */}
    <section className="flex items-center gap-2 overflow-x-auto custom-scrollbar border-b border-[#E8E5E0] pb-3">
      {FLOW_TABS.map((tab) => {
        const Icon = tab.icon;
        const isSelected = activeFlow === tab.id;
        const count = flowCounts[tab.id] ?? 0;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveFlow(tab.id)}
            className={`px-3.5 py-2 rounded-xl text-[12px] font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer border ${
              isSelected
                ? 'bg-[#1A1917] text-white border-[#1A1917]'
                : 'bg-white text-[#494540] border-[#E8E5E0] hover:bg-[#F4F2EE]'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span>{tab.label}</span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                isSelected ? 'bg-white/20 text-white' : 'bg-[#F0EEEB] text-[#494540]'
              }`}
            >
              {count}
            </span>
          </button>
        );
      })}
    </section>
  </>
);

export const BellRequestCard = ({ request, st, t, onAccept, onComplete }) => {
  const status = getStatusLabel(request.status);
  const isPending = status === 'Pending';
  const isInProgress = status === 'In Progress';
  const badge = getFlowBadge(request.type);
  const BadgeIcon = badge.icon;
  const displayTitle =
    request.serviceKey && BELL_SERVICE_LABELS[request.serviceKey]
      ? st(BELL_SERVICE_LABELS[request.serviceKey])
      : request.title;

  return (
    <article className="rounded-xl bg-white px-5 py-4 border border-[#BFBFBD] transition-all">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="font-mono text-[11px] font-bold text-[#1A1917] bg-[#F4F3F0] px-2 py-0.5 rounded border border-[#E2DFD9]">
              #{request.id}
            </span>
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${badge.className}`}
            >
              <BadgeIcon className="w-3 h-3" />
              <span>{badge.label}</span>
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#555]">
              <MapPin className="w-3 h-3 text-[#888]" />
              <span>{request.location}</span>
            </span>
          </div>

          <h4 className="text-[14px] font-bold text-[#2B2927] break-words">{displayTitle}</h4>

          <p className="mt-1 text-[12px] text-[#666] flex flex-wrap items-center gap-2 break-words">
            <span className="inline-flex items-center gap-1 font-medium text-[#3F3B38]">
              <User className="w-3.5 h-3.5 text-[#777]" />
              <span>
                {st('Guest:')} {request.guestName}
              </span>
            </span>
            {request.reporter && <span className="text-[#888]">• Nguồn: {request.reporter}</span>}
            {request.assignedTo && (
              <span className="text-emerald-700 font-semibold">
                • {st('Assigned:')} {request.assignedTo}
              </span>
            )}
          </p>

          <p className="mt-2 text-[12px] leading-relaxed text-[#444] bg-[#FAF9F6] p-2.5 rounded-lg border border-[#EFECE6] break-words">
            {request.description}
          </p>
        </div>

        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${
            status === 'Completed'
              ? 'bg-emerald-100 text-emerald-800'
              : isInProgress
              ? 'bg-sky-100 text-sky-800'
              : 'bg-amber-100 text-amber-800'
          }`}
        >
          {status === 'Completed'
            ? t('completed')
            : isInProgress
            ? t('inProgress')
            : t('pending')}
        </span>
      </div>

      <div className="mt-4 pt-3 border-t border-[#E9E5DC] flex flex-wrap items-center justify-between gap-3">
        <span className="text-[11px] text-[#777] flex items-center gap-1">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          <span>
            {request.type === 'lost_found'
              ? isPending
                ? 'Bước 1/2: Chờ Bellman tiếp nhận xác minh đồ thất lạc'
                : isInProgress
                ? 'Bước 2/2: Đang tìm kiếm & đối chiếu kho Lost & Found'
                : 'Đã bàn giao lại đồ thất lạc cho khách'
              : isPending
              ? 'Chờ phân công xe đẩy / nhân viên Bellman'
              : isInProgress
              ? 'Đang vận chuyển hành lý cho khách'
              : 'Đã hoàn tất bàn giao hành lý'}
          </span>
        </span>

        <div className="flex items-center gap-2">
          {isPending && (
            <button
              type="button"
              onClick={() => onAccept(request.id)}
              className={`rounded-lg px-4 py-1.5 text-[11px] font-bold text-white cursor-pointer ${
                request.type === 'lost_found'
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : 'bg-[#262626] hover:bg-[#404040]'
              }`}
            >
              {getAcceptButtonLabel(request.type, t)}
            </button>
          )}

          {isInProgress && (
            <button
              type="button"
              onClick={() => onComplete(request.id)}
              className="rounded-lg bg-emerald-600 px-4 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-700 cursor-pointer"
            >
              {getCompleteButtonLabel(request.type, t)}
            </button>
          )}

          {status === 'Completed' && (
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded border border-emerald-200 inline-flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{t('taskCompleted')}</span>
            </span>
          )}
        </div>
      </div>
    </article>
  );
};

export const BellSidebar = ({ teamStatus, st, t }) => (
  <aside className="min-w-0 space-y-4">
    <section className="rounded-xl bg-white p-4 border border-[#BFBFBD]">
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#403D39]">
        {t('bsTeamStatus')}
      </h3>

      <div className="mt-3 space-y-2">
        {(teamStatus || []).slice(0, 4).map((member) => (
          <div
            key={member.id || member.name}
            className="flex items-center justify-between text-[11px] py-1.5 border-b border-[#E1DEDA] last:border-0"
          >
            <div className="min-w-0">
              <p className="font-semibold text-[#333] break-words">{member.name}</p>
              <p className="text-[10px] text-[#777]">{st(member.role)}</p>
            </div>
            {member.status && (
              <span className="ml-3 inline-flex shrink-0 items-center gap-1.5 text-[10px] text-[#777]">
                <span
                  aria-hidden="true"
                  className={`h-1.5 w-1.5 rounded-full ${
                    staffStatusLabel(member.status) === 'Available'
                      ? 'bg-emerald-500'
                      : staffStatusLabel(member.status) === 'Busy'
                      ? 'bg-amber-500'
                      : 'bg-stone-400'
                  }`}
                />
                {st(staffStatusLabel(member.status))}
              </span>
            )}
          </div>
        ))}
      </div>
    </section>

    {/* Quick Guide Card for the 3 Bellman Workflows */}
    <section className="rounded-xl bg-white p-4 border border-[#BFBFBD] space-y-3">
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#403D39]">
        Quy chuẩn 3 Luồng Nghiệp vụ Bellman
      </h3>
      <div className="space-y-2.5 text-[11px] text-[#555]">
        <div className="p-2.5 rounded-lg bg-sky-50/60 border border-sky-100">
          <p className="font-bold text-sky-900">1. Tiếp nhận hỗ trợ hành lý</p>
          <p className="mt-0.5 text-sky-800/90">
            Nhận phiếu từ Kiosk/Lễ tân → Điều xe đẩy nhận hành lý tại sảnh hoặc phòng → Bàn giao &amp; hoàn tất.
          </p>
        </div>
        <div className="p-2.5 rounded-lg bg-amber-50/60 border border-amber-100">
          <p className="font-bold text-amber-900">2. Tiếp nhận báo cáo đồ thất lạc</p>
          <p className="mt-0.5 text-amber-800/90">
            Ghi nhận mô tả đồ thất lạc &amp; vị trí → Kiểm tra khu vực sảnh/phòng &amp; tủ Lost &amp; Found → Xác minh &amp; trao trả khách.
          </p>
        </div>
      </div>
    </section>
  </aside>
);

export const BellCreateRequestModal = ({
  modalFlow,
  onClose,
  formState,
  setFormState,
  onSubmit,
  isSubmitting,
}) => {
  if (!modalFlow) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full border border-[#E5E1D8] shadow-2xl overflow-hidden">
        <div className="px-5 py-4 bg-[#FAF8F5] border-b border-[#E5E1D8] flex items-center justify-between">
          <div className="flex items-center gap-2">
            {modalFlow === 'lost_found' ? (
              <SearchCheck className="w-5 h-5 text-amber-600" />
            ) : (
              <Luggage className="w-5 h-5 text-[#1A1917]" />
            )}
            <h3 className="text-[14px] font-bold text-[#1A1917]">
              {modalFlow === 'lost_found'
                ? 'Tiếp nhận Báo cáo Đồ thất lạc (Lost & Found)'
                : 'Tiếp nhận Yêu cầu Hỗ trợ Hành lý'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-[#777] hover:text-[#1A1917] hover:bg-[#EFECE6] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-5 space-y-4 text-[12px]">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-[#403D39] mb-1">
                Số phòng / Vị trí *
              </label>
              <input
                type="text"
                required
                value={formState.location}
                onChange={(e) => setFormState((s) => ({ ...s, location: e.target.value }))}
                placeholder="VD: Room 302 hoặc Main Lobby Kiosk"
                className="w-full rounded-xl border border-[#DEDAD2] px-3 py-2 text-[#1A1917] outline-none focus:border-[#1A1917]"
              />
            </div>
            <div>
              <label className="block font-semibold text-[#403D39] mb-1">
                Tên khách hàng
              </label>
              <input
                type="text"
                value={formState.guestName}
                onChange={(e) => setFormState((s) => ({ ...s, guestName: e.target.value }))}
                placeholder="VD: Mr. Nguyễn Văn A"
                className="w-full rounded-xl border border-[#DEDAD2] px-3 py-2 text-[#1A1917] outline-none focus:border-[#1A1917]"
              />
            </div>
          </div>

          {modalFlow === 'luggage' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-[#403D39] mb-1">
                  Loại hỗ trợ hành lý
                </label>
                <select
                  value={formState.subCategory}
                  onChange={(e) => setFormState((s) => ({ ...s, subCategory: e.target.value }))}
                  className="w-full rounded-xl border border-[#DEDAD2] px-3 py-2 text-[#1A1917] outline-none focus:border-[#1A1917]"
                >
                  <option value="Mang hành lý lên phòng">Mang hành lý lên phòng (Check-in)</option>
                  <option value="Thu nhận hành lý trả phòng">Thu nhận hành lý xuống sảnh (Check-out)</option>
                  <option value="Gửi giữ hành lý tại sảnh">Gửi giữ hành lý tại quầy Bellman</option>
                  <option value="Hỗ trợ chuyển phòng">Hỗ trợ chuyển phòng &amp; hành lý</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-[#403D39] mb-1">
                  Số lượng kiện hành lý
                </label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={formState.luggageCount}
                  onChange={(e) => setFormState((s) => ({ ...s, luggageCount: e.target.value }))}
                  className="w-full rounded-xl border border-[#DEDAD2] px-3 py-2 text-[#1A1917] outline-none focus:border-[#1A1917]"
                />
              </div>
            </div>
          )}

          {modalFlow === 'lost_found' && (
            <div>
              <label className="block font-semibold text-[#403D39] mb-1">
                Tên &amp; đặc điểm đồ vật thất lạc *
              </label>
              <input
                type="text"
                required
                value={formState.itemName}
                onChange={(e) => setFormState((s) => ({ ...s, itemName: e.target.value }))}
                placeholder="VD: Ví da màu đen / Điện thoại iPhone / Túi xách..."
                className="w-full rounded-xl border border-[#DEDAD2] px-3 py-2 text-[#1A1917] outline-none focus:border-[#1A1917]"
              />
            </div>
          )}

          <div>
            <label className="block font-semibold text-[#403D39] mb-1">
              Ghi chú chi tiết
            </label>
            <textarea
              rows={3}
              value={formState.description}
              onChange={(e) => setFormState((s) => ({ ...s, description: e.target.value }))}
              placeholder={
                modalFlow === 'lost_found'
                  ? 'Mô tả vị trí khách nghi ngờ để quên, thời gian, số điện thoại liên hệ...'
                  : 'Ghi chú thêm về hành lý dễ vỡ, thời gian khách cần lấy...'
              }
              className="w-full rounded-xl border border-[#DEDAD2] px-3 py-2 text-[#1A1917] outline-none focus:border-[#1A1917]"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-[#DEDAD2] text-[#494540] font-semibold hover:bg-[#F4F2EE] cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-4 py-2 rounded-xl text-white font-bold cursor-pointer ${
                modalFlow === 'lost_found'
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : 'bg-[#1A1917] hover:bg-[#333]'
              }`}
            >
              {isSubmitting ? 'Đang lưu...' : 'Xác nhận tiếp nhận'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
