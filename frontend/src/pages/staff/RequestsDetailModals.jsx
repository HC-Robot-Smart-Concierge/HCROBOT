import React from 'react';
import { Clock, CheckCircle2, Check, User, MapPin, ChefHat, ConciergeBell } from 'lucide-react';
import { useStaffText, staffStatusLabel } from '../../context/StaffLanguage';
import { NewDirectiveModal } from '../../components/dashboard/Modals';
import {
  isDirectServiceOrder,
  isFoodOrder,
  isTaskPending,
  isTaskCompleted,
  isTaskInProgress,
} from './requestsPageStageUtils';

export const RequestsDetailModals = ({
  isNewModalOpen,
  setIsNewModalOpen,
  handleCreateNew,
  selectedDetailReq,
  setSelectedDetailReq,
  SERVICE_STEPS,
  FOOD_STEPS,
  getDirectServiceStage,
  getFoodOrderStage,
  getTaskHandlerName,
  canUserActOnStage,
  handleUpdateTaskStatus,
  handleClaim,
  handleMarkCompleted,
  staffName,
}) => {
  const st = useStaffText();

  return (
    <>
      {/* 1. Modal: Create New Directive / Request */}
      <NewDirectiveModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onSubmit={handleCreateNew}
      />

      {/* 2. Modal: Detail View & Direct Action for any task status */}
      {selectedDetailReq && (() => {
        const isModalDirectSvc = isDirectServiceOrder(selectedDetailReq);
        const isModalFood = !isModalDirectSvc && isFoodOrder(selectedDetailReq);
        const isModalMultiStep = isModalFood || isModalDirectSvc;
        const currentModalSteps = isModalDirectSvc ? SERVICE_STEPS : (isModalFood ? FOOD_STEPS : null);
        const modalStage = isModalDirectSvc
          ? getDirectServiceStage(selectedDetailReq.status)
          : (isModalFood ? getFoodOrderStage(selectedDetailReq.status) : null);
        const isModalCompleted = isTaskCompleted(selectedDetailReq);
        const isModalPending = isTaskPending(selectedDetailReq);
        const isModalInProgress = isTaskInProgress(selectedDetailReq);
        const modalItems = Array.isArray(selectedDetailReq.items) ? selectedDetailReq.items : [];

        return (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="max-w-xl w-full bg-white p-6 rounded-3xl border border-stone-200 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto custom-scrollbar">
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-9 h-9 rounded-2xl flex items-center justify-center ${
                      isModalDirectSvc
                        ? 'bg-indigo-100 text-indigo-900'
                        : isModalFood
                        ? 'bg-amber-100 text-amber-900'
                        : isModalCompleted
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-stone-100 text-stone-800'
                    }`}
                  >
                    {isModalDirectSvc ? (
                      <ConciergeBell className="w-5 h-5 text-indigo-700" />
                    ) : isModalFood ? (
                      <ChefHat className="w-5 h-5 text-amber-700" />
                    ) : isModalCompleted ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <Clock className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-base font-black text-stone-900 tracking-tight">
                      {isModalDirectSvc
                        ? st("Service request #{0}", selectedDetailReq.id)
                        : isModalFood
                        ? st("Room Service order #{0}", selectedDetailReq.id)
                        : isModalCompleted
                        ? st("Completed request details")
                        : st("Request details #{0}", selectedDetailReq.id)}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-stone-500 font-mono mt-0.5">
                      <span>{st("Location:")} {selectedDetailReq.location}</span>
                      <span>{st("• Guest:")} {selectedDetailReq.guestName || selectedDetailReq.guest_name || st("Hotel guest")}</span>
                      {(selectedDetailReq.guestPhone || selectedDetailReq.guest_phone) && (
                        <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.2 rounded text-[10px]">{st("Phone:")} {selectedDetailReq.guestPhone || selectedDetailReq.guest_phone}
                        </span>
                      )}
                      {(selectedDetailReq.roomPhone || selectedDetailReq.room_phone) && (
                        <span className="bg-amber-50 text-amber-900 border border-amber-200 px-1.5 py-0.2 rounded text-[10px] font-medium">
                          {selectedDetailReq.roomPhone || selectedDetailReq.room_phone}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedDetailReq(null)}
                  className="w-8 h-8 rounded-full bg-stone-100 text-stone-500 hover:bg-stone-200 flex items-center justify-center font-bold text-xs cursor-pointer transition-colors"
                >
                  X
                </button>
              </div>

              {/* Modal Body */}
              <div className="space-y-4 text-xs">
                {/* Badges Bar */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-800 font-bold text-[11px] border border-indigo-100">{st("Department:")} {selectedDetailReq.department}
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-stone-900 text-white font-bold text-[11px] flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-amber-400" />
                    {selectedDetailReq.location}
                  </span>

                  {isModalMultiStep ? (
                    <>
                      <span
                        className={`px-2.5 py-1 rounded-full font-bold text-[11px] border ${modalStage.badgeClass}`}
                      >
                        {modalStage.label}
                      </span>
                      {modalStage.roleBadge && (
                        <span className="px-2.5 py-1 rounded-full bg-stone-100 text-stone-700 font-semibold text-[11px] border border-stone-200">{st("Assigned to:")} {modalStage.roleBadge}
                        </span>
                      )}
                    </>
                  ) : (
                    <span
                      className={`px-2.5 py-1 rounded-full font-bold text-[11px] border ${
                        isModalCompleted
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                          : isModalPending
                          ? 'bg-amber-100 text-amber-800 border-amber-200'
                          : 'bg-sky-100 text-sky-800 border-sky-200'
                      }`}
                    >
                      {st(staffStatusLabel(selectedDetailReq.status))}
                    </span>
                  )}
                </div>

                {/* Stepper for Direct Service or Food Orders */}
                {isModalMultiStep && (
                  <div className="py-2.5 px-3.5 bg-[#FAF8F5] rounded-2xl border border-stone-200">
                    <div className="text-[11px] font-bold text-stone-700 mb-2 flex items-center justify-between">
                      <span>{st("PROGRESS:")}</span>
                      <span className="text-amber-800 font-extrabold">{modalStage.deptNote}</span>
                    </div>
                    <div className="flex items-center justify-between relative mt-1">
                      <div className="absolute left-3 right-3 top-3 h-0.5 bg-stone-200 z-0" />
                      <div
                        className="absolute left-3 top-3 h-0.5 bg-emerald-500 transition-all duration-300 z-0"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.max(0, ((modalStage.step - 1) / (currentModalSteps.length - 1)) * 100)
                          )}%`,
                        }}
                      />

                      {currentModalSteps.map((s) => {
                        const isPast = modalStage.step > s.step;
                        const isCurrent = modalStage.step === s.step;
                        return (
                          <div key={s.step} className="flex flex-col items-center relative z-10">
                            <div
                              className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                                isPast
                                  ? 'bg-emerald-500 text-white shadow-sm'
                                  : isCurrent
                                  ? 'bg-stone-900 text-white ring-4 ring-amber-200 ring-offset-1 font-black scale-110 shadow'
                                  : 'bg-white text-stone-400 border border-stone-300'
                              }`}
                            >
                              {isPast ? <Check className="w-3 h-3 stroke-[3]" /> : s.step}
                            </div>
                            <span
                              className={`text-[9px] md:text-[10px] mt-1 font-semibold whitespace-nowrap ${
                                isCurrent
                                  ? 'text-stone-950 font-bold'
                                  : isPast
                                  ? 'text-emerald-700'
                                  : 'text-stone-400'
                              }`}
                            >
                              {s.title}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Ordered Items / Services Detailed Table */}
                {isModalMultiStep && modalItems.length > 0 && (
                  <div className="p-3.5 rounded-2xl bg-white border border-stone-200 space-y-2 shadow-2xs">
                    <div className="flex items-center justify-between font-bold text-stone-800 text-[11px] pb-1.5 border-b border-stone-100">
                      <span>{isModalDirectSvc ? st("SERVICES / ITEMS") : st("FOOD ORDERED")}</span>
                      <span>{st("QUANTITY & UNIT PRICE")}</span>
                    </div>
                    <div className="divide-y divide-stone-100">
                      {modalItems.map((it, idx) => {
                        const q = it.quantity || it.qty || 1;
                        const p = it.price || 0;
                        return (
                          <div
                            key={idx}
                            className="py-1.5 flex items-center justify-between text-xs"
                          >
                            <span className="font-semibold text-stone-800">
                              {it.name || it.item_name}
                            </span>
                            <div className="flex items-center gap-3 text-stone-600">
                              <span className="font-bold text-stone-900">x{q}</span>
                              {p > 0 && (
                                <span className="font-medium">
                                  {Number(p * q).toLocaleString('vi-VN')} ₫
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {selectedDetailReq.total_amount > 0 && (
                      <div className="pt-2 border-t border-stone-200 flex items-center justify-between font-black text-xs text-stone-900">
                        <span>{st("TOTAL:")}</span>
                        <span className="text-amber-900 text-sm">
                          {Number(selectedDetailReq.total_amount).toLocaleString('vi-VN')} ₫
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Title & Content */}
                <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#EAE6DE] space-y-2">
                  <h4 className="text-sm font-extrabold text-stone-900">
                    {selectedDetailReq.title}
                  </h4>
                  <div className="text-stone-600 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-stone-800">{st("Guest / requester:")}{' '}
                      </span>
                      <span className="font-medium text-stone-900">
                        {selectedDetailReq.guestName ||
                          selectedDetailReq.guest_name ||
                          st("Hotel guest")}
                      </span>
                      {(selectedDetailReq.guestPhone || selectedDetailReq.guest_phone) && (
                        <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded text-[11px] font-mono">{st("Mobile phone:")} {selectedDetailReq.guestPhone || selectedDetailReq.guest_phone}
                        </span>
                      )}
                      {(selectedDetailReq.roomPhone || selectedDetailReq.room_phone) && (
                        <span className="bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded text-[11px] font-mono font-medium">{st("Extension:")} {selectedDetailReq.roomPhone || selectedDetailReq.room_phone}
                        </span>
                      )}
                    </div>
                    {selectedDetailReq.notes && (
                      <p>
                        <span className="font-semibold text-stone-800">{st("Detailed notes:")} </span>
                        {selectedDetailReq.notes}
                      </p>
                    )}
                  </div>
                </div>

                {/* Handler & Execution Information */}
                <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-2.5">
                  <div className="flex items-center gap-2 text-stone-900 font-bold text-xs">
                    <User className="w-4 h-4 text-stone-700" />
                    <span>{st("ASSIGNMENT DETAILS")}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-stone-700">
                    <div>
                      <span className="text-stone-500 text-[11px] block">{st("Assigned staff:")}</span>
                      <span className="font-bold text-stone-900 text-xs">
                        {getTaskHandlerName(selectedDetailReq)}
                      </span>
                    </div>
                    <div>
                      <span className="text-stone-500 text-[11px] block">{st("Time:")}</span>
                      <span className="font-bold text-stone-900 text-xs">
                        {selectedDetailReq.time || st("Just completed")}
                      </span>
                    </div>
                    <div>
                      <span className="text-stone-500 text-[11px] block">{st("Source:")}</span>
                      <span className="font-medium text-stone-800 text-xs">
                        {selectedDetailReq.source || 'Robot App / Front Desk'}
                      </span>
                    </div>
                    {selectedDetailReq.assigned_robot && (
                      <div>
                        <span className="text-stone-500 text-[11px] block">{st("Assigned robot:")}</span>
                        <span className="font-medium text-sky-700 text-xs">
                          {selectedDetailReq.assigned_robot}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {isModalCompleted && (
                  <div className="p-3 rounded-xl bg-stone-100 border border-stone-200 text-[11px] text-stone-600 flex items-center gap-2">
                    <span className="text-sm"></span>
                    <span>
                      <strong>{st("Read-only record:")}</strong> {st("This completed request is saved in the audit log.")} </span>
                  </div>
                )}
              </div>

              {/* Modal Footer with Direct Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-stone-100 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedDetailReq(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-stone-200 hover:bg-stone-300 text-stone-800 transition-all cursor-pointer shadow-xs"
                >{st("Close")} </button>

                <div className="flex items-center gap-2">
                  {/* Multi-step action button inside modal */}
                  {isModalMultiStep && modalStage.nextStatus && (
                    canUserActOnStage(modalStage.step, selectedDetailReq, isModalDirectSvc) ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            await handleUpdateTaskStatus(
                              selectedDetailReq.id,
                              modalStage.nextStatus
                            );
                            setSelectedDetailReq((prev) => ({
                              ...prev,
                              status: modalStage.nextStatus,
                              assignedTo: prev.assignedTo || staffName,
                            }));
                          }}
                          className={`px-5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm flex items-center gap-2 ${modalStage.actionBtnClass}`}
                        >
                          {modalStage.nextIcon && <modalStage.nextIcon className="w-4 h-4" />}
                          <span>{modalStage.nextActionName}</span>
                        </button>
                      </div>
                    ) : (
                      <span className="px-4 py-2 rounded-xl bg-stone-100 text-stone-700 text-xs font-semibold border border-stone-200 flex items-center gap-1.5 shadow-2xs">{st("This step is handled by")} {modalStage.roleBadge} {st("staff")} </span>
                    )
                  )}

                  {/* Standard non-multi-step buttons inside modal */}
                  {!isModalMultiStep && isModalPending && (
                    <button
                      type="button"
                      onClick={async () => {
                        await handleClaim(selectedDetailReq.id);
                        setSelectedDetailReq((prev) => ({
                          ...prev,
                          status: 'In Progress',
                          assignedTo: staffName,
                        }));
                      }}
                      className="px-5 py-2 rounded-xl text-xs font-bold bg-[#18181B] hover:bg-black text-white transition-all cursor-pointer shadow-sm"
                    >{st("Claim task")} </button>
                  )}

                  {!isModalMultiStep && isModalInProgress && (
                    <button
                      type="button"
                      onClick={async () => {
                        await handleMarkCompleted(selectedDetailReq.id);
                        setSelectedDetailReq((prev) => ({
                          ...prev,
                          status: 'Completed',
                          completed_by: staffName,
                        }));
                      }}
                      className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-all cursor-pointer shadow-sm"
                    >{st("Complete task")} </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
};
