import React from 'react';
import {
  PhoneCall,
  Clock,
  Car,
  MapPin,
  Navigation,
  Check,
} from 'lucide-react';
import { Pagination } from '../../components/common/Pagination';
import { CONCIERGE_PAGE_SIZE } from './conciergeDashboardUtils';

export const ConciergeTaxiView = ({
  activeSubTab,
  taxiKpis,
  taxiRequests,
  paginatedTaxiRequests,
  taxiPage,
  setTaxiPage,
  handleUpdateTaxiStatus,
}) => (
  <>
        {/* SUBTAB 2: TAXI & TRANSPORTATION */}
        {activeSubTab === 'taxi' && (
          <div className="space-y-5">
            {/* Metric KPI Cards */}
            <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <article className="bg-white rounded-xl border border-[#E8E5E0] px-5 py-4">
                <p className="text-[11px] font-semibold uppercase text-[#8C8C8C]">Tổng yêu cầu</p>
                <p className="text-[22px] font-bold text-[#262626] mt-2">
                  {taxiRequests.length || taxiKpis.totalRequests}
                </p>
              </article>
              <article className="bg-white rounded-xl border border-[#E8E5E0] px-5 py-4">
                <p className="text-[11px] font-semibold uppercase text-amber-700">Chờ tiếp nhận</p>
                <p className="text-[22px] font-bold text-[#262626] mt-2">
                  {taxiRequests.filter((r) => {
                    const st = (r.status || '').toLowerCase();
                    return st === 'pending' || st === 'unassigned' || st === 'chờ tiếp nhận' || st === 'missed';
                  }).length || taxiKpis.pendingRequests}
                </p>
              </article>
              <article className="bg-white rounded-xl border border-[#E8E5E0] px-5 py-4">
                <p className="text-[11px] font-semibold uppercase text-sky-700">Đang gọi xe</p>
                <p className="text-[22px] font-bold text-sky-600 mt-2">
                  {taxiRequests.filter((r) => {
                    const st = (r.status || '').toLowerCase();
                    return (
                      st === 'calling' ||
                      st === 'in progress' ||
                      st === 'đang gọi' ||
                      st === 'driver assigned' ||
                      st === 'on the way'
                    );
                  }).length || taxiKpis.callingRequests || taxiKpis.activeTrips}
                </p>
              </article>
              <article className="bg-white rounded-xl border border-[#E8E5E0] px-5 py-4">
                <p className="text-[11px] font-semibold uppercase text-emerald-700">Gọi thành công</p>
                <p className="text-[22px] font-bold text-emerald-600 mt-2">
                  {taxiRequests.filter((r) => {
                    const st = (r.status || '').toLowerCase();
                    return st === 'completed' || st === 'thành công' || st === 'success' || st === 'done' || st === 'closed';
                  }).length || taxiKpis.completedTrips}
                </p>
              </article>
            </section>

            {/* Taxi Request List */}
            <div className="bg-white rounded-xl border border-[#BFBFBD] overflow-hidden">
              <div className="px-5 py-4 border-b border-[#E9E5DC] flex items-center justify-between gap-3">
                <span className="text-[13px] font-semibold text-[#403D39]">Danh Sách Yêu Cầu Gọi Xe Taxi</span>
                <span className="text-[11px] text-[#77736E]">Hiển thị {taxiRequests.length} yêu cầu</span>
              </div>

              {taxiRequests.length === 0 ? (
                <div className="p-10 text-center text-[12px] text-[#777]">
                  Hiện chưa có yêu cầu gọi taxi nào trong hệ thống.
                </div>
              ) : (
                <div className="divide-y divide-[#EFECE6]">
                  {paginatedTaxiRequests.map((trip) => {
                    const stLower = (trip.status || '').toLowerCase();
                    const isPending =
                      stLower === 'pending' ||
                      stLower === 'unassigned' ||
                      stLower === 'chờ tiếp nhận' ||
                      stLower === 'missed';
                    const isCalling =
                      stLower === 'calling' ||
                      stLower === 'in progress' ||
                      stLower === 'đang gọi' ||
                      stLower === 'driver assigned' ||
                      stLower === 'on the way';
                    const isCompleted =
                      stLower === 'completed' ||
                      stLower === 'thành công' ||
                      stLower === 'success' ||
                      stLower === 'done' ||
                      stLower === 'closed';
                    const isCancelled =
                      stLower === 'cancelled' || stLower === 'đã hủy' || stLower === 'rejected';

                    return (
                      <div
                        key={trip.id}
                        className="px-5 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 hover:bg-[#FAF9F6] transition-all"
                      >
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[11px] font-mono font-bold text-[#1A1917] bg-[#F4F3F0] border border-[#E2DFD9] px-2 py-0.5 rounded">
                              {trip.ticket_code || trip.id}
                            </span>
                            <span className="text-[13px] font-bold text-[#262626]">{trip.guest_name}</span>
                            {trip.room_number && (
                              <span className="text-[11px] text-[#777]">(Phòng {trip.room_number})</span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-4 text-[12px] text-[#666] mt-2">
                            <span className="flex items-center gap-1 text-[#262626]">
                              <MapPin className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                              Đón: <strong className="font-semibold">{trip.pickup_location}</strong>
                            </span>
                            <span className="flex items-center gap-1 text-[#262626]">
                              <Navigation className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                              Đến: <strong className="font-semibold">{trip.destination}</strong>
                            </span>
                            <span className="flex items-center gap-1 text-[#777]">
                              <Clock className="w-3.5 h-3.5 shrink-0" />
                              {trip.pickup_time || 'Ngay bây giờ'}
                            </span>
                            <span className="flex items-center gap-1 text-[#777]">
                              <Car className="w-3.5 h-3.5 shrink-0" />
                              {trip.vehicle_type || '4 chỗ'} ({trip.party_size || 2} khách)
                            </span>
                          </div>

                          {trip.notes && (
                            <div className="mt-2 text-[11px] text-[#666] italic">
                              Ghi chú: {trip.notes}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 self-start md:self-center shrink-0">
                          {/* Status Badge */}
                          <span
                            className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${
                              isCompleted
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : isCalling
                                ? 'bg-sky-50 text-sky-800 border-sky-200'
                                : isCancelled
                                ? 'bg-neutral-100 text-neutral-700 border-neutral-200'
                                : stLower === 'missed'
                                ? 'bg-amber-50 text-amber-800 border-amber-300'
                                : 'bg-amber-50 text-amber-800 border-amber-200'
                            }`}
                          >
                            {isCompleted
                              ? (stLower === 'closed' ? 'Đã đóng' : 'Thành công')
                              : isCalling
                              ? 'Đang gọi'
                              : isCancelled
                              ? 'Đã hủy'
                              : stLower === 'missed'
                              ? 'Chờ tiếp nhận'
                              : 'Chờ tiếp nhận'}
                          </span>

                          {/* Action Button 1: Khi còn Pending hoặc Missed -> Concierge nhận yêu cầu và chuyển sang Đang gọi */}
                          {isPending && (
                            <button
                              type="button"
                              onClick={() => handleUpdateTaxiStatus(trip.id, 'Calling')}
                              className="px-3.5 py-2 text-[11px] font-bold rounded-lg bg-sky-600 hover:bg-sky-700 text-white transition-all flex items-center gap-1.5 cursor-pointer"
                              title="Concierge tiếp nhận và gọi xe cho khách"
                            >
                              <PhoneCall className="w-3.5 h-3.5" />
                              Nhận yêu cầu
                            </button>
                          )}

                          {/* Action Button 2: Khi đang Gọi -> Concierge gọi xong bấm Thành công */}
                          {isCalling && (
                            <button
                              type="button"
                              onClick={() => handleUpdateTaxiStatus(trip.id, 'Completed')}
                              className="px-3.5 py-2 text-[11px] font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-all flex items-center gap-1.5 cursor-pointer"
                              title="Xác nhận đã gọi taxi thành công cho khách"
                            >
                              <Check className="w-3.5 h-3.5" />
                              Thành công
                            </button>
                          )}

                          {isCompleted && (
                            <span className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1">
                              <Check className="w-3.5 h-3.5" />
                              Đã gọi xong
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Pagination Footer */}
              {taxiRequests.length > 0 && (
                <Pagination
                  currentPage={taxiPage}
                  totalItems={taxiRequests.length}
                  pageSize={CONCIERGE_PAGE_SIZE}
                  onPageChange={setTaxiPage}
                  itemName="yêu cầu"
                />
              )}
            </div>
          </div>
        )}
  </>
);
