import React from 'react';
import { PhoneCall, Bot, BatteryCharging, MapPin, Wifi } from 'lucide-react';

export const StaffOverviewMobileCards = ({ filteredRequests, paginatedRequests, onUpdateStatus }) => (
  <div className="space-y-3 block md:hidden">
    {filteredRequests.length === 0 ? (
      <div className="py-6 text-center text-stone-400 text-xs">
        Không có yêu cầu nào phù hợp.
      </div>
    ) : (
      paginatedRequests.map((r) => {
        const statusLower = (r.status || '').toLowerCase();
        const isPending = statusLower === 'pending' || statusLower === 'unassigned';
        const isInProgress = statusLower === 'in progress' || statusLower === 'cooking';
        const isCompleted = statusLower === 'completed' || statusLower === 'ready';

        return (
          <div
            key={r.id}
            className="p-3.5 rounded-2xl bg-white border border-[#E5E1D8] space-y-2 shadow-sm"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-xs font-bold text-stone-900">{r.id}</span>
                <span className="px-2 py-0.5 rounded-full bg-[#18181B] text-white text-[10px] font-bold">
                  {r.location}
                </span>
              </div>

              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                  isPending
                    ? 'bg-amber-100 text-amber-800'
                    : isInProgress
                    ? 'bg-sky-100 text-sky-800'
                    : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {r.status || 'Pending'}
              </span>
            </div>

            <h4 className="text-xs font-bold text-stone-900 leading-snug">{r.title}</h4>

            <div className="pt-2 border-t border-[#F5F2EB] flex items-center justify-end gap-2">
              {isPending && (
                <button
                  onClick={() => onUpdateStatus(r.id, 'In Progress')}
                  className="px-3.5 py-1 rounded-full bg-black text-white text-xs font-bold cursor-pointer active:scale-95"
                >
                  Nhận Việc
                </button>
              )}
              {isInProgress && (
                <button
                  onClick={() => onUpdateStatus(r.id, 'Completed')}
                  className="px-3.5 py-1 rounded-full bg-emerald-600 text-white text-xs font-bold cursor-pointer active:scale-95"
                >
                  Hoàn Thành
                </button>
              )}
              {isCompleted && (
                <span className="text-xs font-bold text-emerald-700">✓ Đã Xong</span>
              )}
            </div>
          </div>
        );
      })
    )}
  </div>
);

export const StaffOverviewBottomSections = ({ supportCalls, robotFleet }) => (
  <>
    {/* SECTION 2: THỐNG KÊ & NHẬT KÝ CUỘC GỌI */}
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-extrabold uppercase tracking-wider text-[#211F1D] flex items-center gap-2">
          <PhoneCall className="w-4 h-4 text-stone-700" />
          <span>2. Thống Kê & Nhật Ký Cuộc Gọi Hỗ Trợ (Voice & Video Calls)</span>
        </h3>
        <span className="text-xs text-[#78716C] font-semibold">Live Stream & Voice AI Logs</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-[#E8E5E0] shadow-sm space-y-1">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#78716C]">
            Tổng Cuộc Gọi Hôm Nay
          </span>
          <div className="flex items-baseline justify-between pt-1">
            <span className="text-xl font-bold text-[#1A1917]">18 cuộc gọi</span>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
              +12% so với hôm qua
            </span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#E8E5E0] shadow-sm space-y-1">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#78716C]">
            Thời Gian Đàm Thoại TB
          </span>
          <div className="flex items-baseline justify-between pt-1">
            <span className="text-xl font-bold text-[#1A1917]">2 phút 10 giây</span>
            <span className="text-[10px] font-bold text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full">
              Tối ưu
            </span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#E8E5E0] shadow-sm space-y-1">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#78716C]">
            Tỷ Lệ Kết Nối Thành Công
          </span>
          <div className="flex items-baseline justify-between pt-1">
            <span className="text-xl font-bold text-emerald-800">98.5%</span>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
              Hoạt động tốt
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {supportCalls.map((call) => (
          <div
            key={call.id}
            className="p-5 rounded-2xl bg-white border border-[#E8E5E0] shadow-sm space-y-3 flex flex-col justify-between"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-stone-900">{call.id}</span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                    call.status === 'Connected'
                      ? 'bg-emerald-100 text-emerald-800 animate-pulse'
                      : 'bg-stone-100 text-stone-700'
                  }`}
                >
                  ● {call.status === 'Connected' ? 'Đang Kết Nối' : 'Đã Kết Thúc'}
                </span>
              </div>

              <div>
                <h4 className="text-sm font-bold text-stone-900">{call.room}</h4>
                <p className="text-xs font-medium text-stone-600">{call.guestName}</p>
              </div>

              <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[#EAE6DE] text-xs text-stone-700 leading-relaxed italic">
                "{call.transcript}"
              </div>
            </div>

            <div className="pt-2 border-t border-[#F0ECE6] flex items-center justify-between text-[11px] text-[#78716C]">
              <span>{call.time}</span>
              <span className="font-semibold text-stone-800">{call.duration}</span>
            </div>
          </div>
        ))}
      </div>
    </section>

    {/* SECTION 3: TÌNH TRẠNG CHUNG CỦA ROBOT */}
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-extrabold uppercase tracking-wider text-[#211F1D] flex items-center gap-2">
          <Bot className="w-4 h-4 text-sky-700" />
          <span>3. Tình Trạng Chung Của Đội Xe HCRobot (Robot Fleet Status)</span>
        </h3>
        <span className="text-xs text-[#78716C] font-semibold">SLAM LiDAR & Fleet Manager</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {robotFleet.map((unit) => {
          const battery = unit.battery_level ?? unit.battery ?? 90;
          const isHigh = battery > 50;
          const isMed = battery > 20 && battery <= 50;

          return (
            <div
              key={unit.id || unit.unit_code}
              className="p-5 rounded-2xl bg-white border border-[#E8E5E0] shadow-sm space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-[#F0ECE6]">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                  <h4 className="text-sm font-bold text-stone-900">{unit.unit_code || unit.id}</h4>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-stone-900 text-white font-mono text-[10px] font-bold">
                  {unit.ip || 'Online'}
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-stone-500 font-medium flex items-center gap-1">
                    <BatteryCharging className="w-3.5 h-3.5 text-stone-700" />
                    <span>Mức Pin Hiện Tại:</span>
                  </span>
                  <span
                    className={`font-mono font-bold px-2 py-0.5 rounded ${
                      isHigh
                        ? 'bg-emerald-100 text-emerald-800'
                        : isMed
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {battery}%
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-stone-500 font-medium">Trạng thái:</span>
                  <span className="font-bold text-stone-900">{unit.status || 'Standby / Ready'}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-stone-500 font-medium flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-stone-700" />
                    <span>Vị trí hiện tại:</span>
                  </span>
                  <span className="font-semibold text-stone-800 truncate max-w-[160px]">
                    {unit.location || 'Sảnh Chính'}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-stone-500 font-medium flex items-center gap-1">
                    <Wifi className="w-3.5 h-3.5 text-sky-600" />
                    <span>SLAM LiDAR:</span>
                  </span>
                  <span className="font-bold text-emerald-700">Đang Định Vị (Active)</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  </>
);
