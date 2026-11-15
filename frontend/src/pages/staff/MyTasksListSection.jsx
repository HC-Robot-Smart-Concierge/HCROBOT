import React from 'react';
import { RefreshCw, Clock, CheckCircle2, Check, User, Utensils, ChefHat, ClipboardList, ConciergeBell, Phone } from 'lucide-react';
import { Pagination } from '../../components/common/Pagination';
import { staffDepartmentLabel, staffStatusLabel } from '../../context/StaffLanguage';

export const MyTasksListSection = ({
  isLoading, st, paginatedRequests, requests, isDirectServiceOrder, isFoodOrder, isKitchenStaff, KITCHEN_STEPS, SERVICE_STEPS, FOOD_STEPS, getKitchenOrderStage, getDirectServiceStage, getFoodOrderStage, isTaskCompleted, isTaskInProgress, canUserActOnStage, staffName, handleUpdateTaskStatus, setSelectedDetailReq, sortedRequests, currentPage, pageSize, setCurrentPage,
}) => (
  <>
        {/* Requests List */}
        {isLoading ? (
          <div className="py-20 text-center text-stone-400 flex flex-col items-center justify-center space-y-2">
            <RefreshCw className="w-8 h-8 animate-spin text-stone-700" />
            <p className="text-sm font-semibold text-stone-600">{st("Loading tasks...")}</p>
          </div>
        ) : (
          <div className="space-y-3.5">
            {paginatedRequests.length === 0 ? (
              <div className="p-12 text-center bg-white rounded-2xl border border-[#E5E1D8] text-xs text-stone-500 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center mx-auto">
                  <ClipboardList className="w-6 h-6 text-amber-600" />
                </div>
                <p className="font-semibold text-stone-700 text-sm">
                  {statusFilter === 'All'
                    ? st("You have no assigned requests yet.")
                    : st("No requests in \"{0}\".", statusFilter)}
                </p>
                <p className="text-stone-500 text-xs">{st("Go to")} <strong>{st("Requests")}</strong> {st("to claim or forward guest requests.")} </p>
              </div>
            ) : (
              paginatedRequests.map((req) => {
                const isInProgress = isTaskInProgress(req);
                const isCompleted = isTaskCompleted(req);
                const isDirectSvc = isDirectServiceOrder(req);
                const isFood = !isDirectSvc && isFoodOrder(req);
                const isKitchenOrder = (isKitchenStaff || req.department === 'Kitchen' || req.department === 'DEP-KITCHEN') && isFood;
                const isMultiStep = isFood || isDirectSvc;
                const currentSteps = isKitchenOrder
                  ? KITCHEN_STEPS
                  : isDirectSvc
                  ? SERVICE_STEPS
                  : isFood
                  ? FOOD_STEPS
                  : null;
                const stage = isKitchenOrder
                  ? getKitchenOrderStage(req.status)
                  : isDirectSvc
                  ? getDirectServiceStage(req.status)
                  : isFood
                  ? getFoodOrderStage(req.status)
                  : null;

                return (
                  <div
                    key={req.id}
                    className={`bg-white rounded-2xl border border-[#E5E1D8] p-4 md:p-5 shadow-xs space-y-3.5 transition-all hover:shadow-md ${
                      isMultiStep
                        ? isKitchenOrder
                          ? stage.step === 3
                            ? 'border-l-4 border-l-emerald-500 bg-emerald-50/15'
                            : stage.step === 2
                            ? 'border-l-4 border-l-amber-500'
                            : ''
                          : (isDirectSvc ? stage.step === 4 : stage.step === 4)
                          ? 'border-l-4 border-l-emerald-500 bg-emerald-50/15'
                          : (isDirectSvc ? stage.step === 3 : stage.step === 5)
                          ? 'border-l-4 border-l-purple-500 bg-purple-50/10'
                          : isInProgress
                          ? 'border-l-4 border-l-sky-500'
                          : ''
                        : isInProgress
                        ? 'border-l-4 border-l-sky-500'
                        : ''
                    } ${isCompleted ? 'border-l-4 border-l-emerald-500 bg-emerald-50/5' : ''}`}
                  >
                    {/* Top Bar: ID, Room, Dept & Status */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-xs font-bold text-[#1A1917]">{req.id}</span>
                        <span className="px-2 py-0.5 rounded-full bg-[#18181B] text-white text-[10px] font-bold">
                          {req.location}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-[#EFECE6] text-stone-800 text-[10px] font-bold">
                          {st(staffDepartmentLabel(req.department))}
                        </span>
                        {isFood && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold flex items-center gap-1">
                            <Utensils className="w-2.5 h-2.5 text-amber-600" />{st("Food order")} </span>
                        )}
                        {isDirectSvc && (
                          <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200 text-[10px] font-bold flex items-center gap-1">
                            <ConciergeBell className="w-2.5 h-2.5 text-indigo-600" />{st("Room service")} </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {isMultiStep ? (
                          <>
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${stage.badgeClass}`}
                            >
                              {stage.label}
                            </span>
                            {stage.roleBadge && stage.step < currentSteps.length && (
                              <span className="hidden sm:inline-block px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 text-[10px] font-semibold border border-stone-200">{st("Assigned to:")} {stage.roleBadge}
                              </span>
                            )}
                          </>
                        ) : (
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                              isCompleted
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-sky-100 text-sky-800'
                            }`}
                          >
                            {st(staffStatusLabel(req.status))}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Title */}
                    <h4 className="text-sm font-bold text-[#1A1917] leading-snug">{req.title}</h4>

                    {/* Stepper Component: Visual Progress Bar */}
                    {isMultiStep && (
                      <div className="py-2 px-3 bg-[#FAF8F5] rounded-xl border border-stone-200/80">
                        <div className="flex items-center justify-between relative">
                          {/* Background connecting line */}
                          <div className="absolute left-3 right-3 top-3 h-0.5 bg-stone-200 z-0" />
                          <div
                            className="absolute left-3 top-3 h-0.5 bg-emerald-500 transition-all duration-300 z-0"
                            style={{
                              width: `${Math.min(
                                100,
                                Math.max(0, ((stage.step - 1) / (currentSteps.length - 1)) * 100)
                              )}%`,
                            }}
                          />

                          {currentSteps.map((s) => {
                            const isPast = stage.step > s.step;
                            const isCurrent = stage.step === s.step;
                            return (
                              <div
                                key={s.step}
                                className="flex flex-col items-center relative z-10"
                              >
                                <div
                                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                                    isPast
                                      ? 'bg-emerald-500 text-white shadow-xs'
                                      : isCurrent
                                      ? 'bg-stone-900 text-white ring-4 ring-amber-200 ring-offset-1 font-black scale-110 shadow-xs'
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

                    {/* Ordered Items / Services Preview */}
                    {isMultiStep && Array.isArray(req.items) && req.items.length > 0 && (
                      <div className="p-2.5 rounded-xl bg-stone-50/80 border border-stone-200/80 text-xs flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {isDirectSvc ? (
                            <ConciergeBell className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          ) : (
                            <Utensils className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          )}
                          <span className="font-semibold text-stone-800 text-[11px]">
                            {isDirectSvc ? st("Requested services:") : st("Food:")}
                          </span>
                          {req.items.map((it, idx) => (
                            <span
                              key={idx}
                              className="bg-white px-2 py-0.5 rounded-md border border-stone-200 text-stone-700 text-[11px] font-medium shadow-2xs"
                            >
                              {it.quantity || it.qty || 1}x {it.name || it.item_name}
                            </span>
                          ))}
                        </div>
                        {req.total_amount > 0 && (
                          <span className="font-bold text-stone-900 bg-amber-50 text-amber-900 px-2.5 py-0.5 rounded-lg border border-amber-200 text-[11px]">{st("Total:")} {Number(req.total_amount).toLocaleString('vi-VN')} ₫
                          </span>
                        )}
                      </div>
                    )}

                    {/* Guest info & Notes */}
                    <div className="text-xs text-[#78716C] flex items-center justify-between flex-wrap gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-stone-900 flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-stone-500" />
                          <span>{req.guestName || req.guest_name || st("Hotel guest")}</span>
                        </span>
                        {(req.guestPhone || req.guest_phone) && (
                          <a
                            href={`tel:${req.guestPhone || req.guest_phone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded text-[11px] font-mono font-bold transition-colors cursor-pointer shadow-2xs"
                            title={st("Call the guest to confirm the order")}
                          >
                            <Phone className="w-3 h-3 text-emerald-600" />
                            <span>{st("Phone:")} {req.guestPhone || req.guest_phone}</span>
                          </a>
                        )}
                        {(req.roomPhone || req.room_phone) && (
                          <span
                            className="inline-flex items-center gap-1 bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded text-[11px] font-mono font-medium shadow-2xs"
                            title={st("Room extension")}
                          >
                            <Phone className="w-3 h-3 text-amber-600" />
                            <span>{req.roomPhone || req.room_phone}</span>
                          </span>
                        )}
                        {req.notes && <span className="text-stone-500">{st("• Notes:")} {req.notes}</span>}
                      </div>
                      <span className="text-[11px] text-stone-500">{st("Created:")} {req.time || st("Just completed")}
                      </span>
                    </div>

                    {/* Bottom Action Bar */}
                    <div className="pt-2 border-t border-[#F5F2EB] flex items-center justify-between gap-2 text-xs">
                      <span className="text-[11px] text-[#78716C] font-medium hidden md:inline">
                        {isMultiStep ? stage.deptNote : st("Assigned to you ({0})", staffName)}
                      </span>

                      <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                        {/* 1. Multi-Step (Food or Direct Service) Action Button */}
                        {isMultiStep && stage.nextStatus && (
                          canUserActOnStage(stage.step, req, isDirectSvc) ? (
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleUpdateTaskStatus(req.id, stage.nextStatus)}
                                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 flex items-center gap-1.5 ${stage.actionBtnClass}`}
                                title={stage.deptNote}
                              >
                                {stage.nextIcon && <stage.nextIcon className="w-3.5 h-3.5" />}
                                <span>{stage.nextActionName}</span>
                              </button>
                            </div>
                          ) : (
                            /* Waiting chips for kitchen steps */
                            isDirectSvc ? (
                              <span className="px-3 py-1.5 rounded-full bg-stone-100 text-stone-600 text-xs font-semibold border border-stone-200">{st("Waiting")} {stage.roleBadge}
                              </span>
                            ) : (
                              stage.step === 2 ? (
                                <span
                                  className="px-3 py-1.5 rounded-full bg-blue-50 text-blue-800 text-[11px] font-bold border border-blue-200 flex items-center gap-1.5 select-none shadow-2xs"
                                  title={st("This order has been sent to the kitchen. Kitchen staff must accept it.")}
                                >
                                  <Clock className="w-3.5 h-3.5 text-blue-600" />
                                  <span>{st("Awaiting kitchen acceptance")}</span>
                                </span>
                              ) : stage.step === 3 ? (
                                <span
                                  className="px-3 py-1.5 rounded-full bg-amber-50 text-amber-800 text-[11px] font-bold border border-amber-200 flex items-center gap-1.5 select-none shadow-2xs"
                                  title={
                                    isKitchenStaff
                                      ? st("This order is assigned to {0}. Only the assigned staff member can mark it ready.", req.assignedTo || req.assigned_staff_name || st('Another chef'))
                                      : st("The kitchen is preparing the food and will notify Room Service when it is ready.")
                                  }
                                >
                                  <ChefHat className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                                  <span>
                                    {isKitchenStaff
                                      ? st("Prepared by: {0}", req.assignedTo || req.assigned_staff_name || st('Another chef'))
                                      : st("Kitchen is cooking...")}
                                  </span>
                                </span>
                              ) : (
                                <span className="px-3 py-1.5 rounded-full bg-stone-100 text-stone-600 text-xs font-semibold border border-stone-200">{st("Waiting")} {stage.roleBadge}
                                </span>
                              )
                            )
                          )
                        )}

                        {/* Completed indicator */}
                        {isMultiStep && !stage.nextStatus && (
                          <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-200 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{isDirectSvc ? st("Delivered") : st("Delivered")}</span>
                          </span>
                        )}

                        {/* Standard Non-Food Task Complete button */}
                        {!isMultiStep && isInProgress && (
                          <button
                            onClick={() => handleUpdateTaskStatus(req.id, 'Completed')}
                            className="px-4 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
                          >
                            <span>{st("Complete task")}</span>
                          </button>
                        )}

                        {/* Xem Chi Tiết */}
                        <button
                          onClick={() => setSelectedDetailReq(req)}
                          className="px-4 py-1.5 rounded-full bg-[#FAF8F5] hover:bg-[#EFECE6] text-stone-900 border border-[#E0DCD3] text-xs font-bold transition-all shadow-xs cursor-pointer"
                          title={st("View request details")}
                        >
                          <span>{st("View details")}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Pagination Footer */}
        {!isLoading && sortedRequests.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalItems={sortedRequests.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            className="rounded-2xl border border-[#E5E1D8] shadow-xs bg-white"
          />
        )}
  </>
);
