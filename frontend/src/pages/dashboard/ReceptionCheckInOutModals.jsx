import React from 'react';
import { CheckCircle2, RefreshCw, KeyRound, AlertCircle, X } from 'lucide-react';
import { handleNumericKeyDown, sanitizeDigitsOnly, sanitizePhoneNumber } from '../../utils/numberInputHelper';

export const ReceptionCheckInOutModals = ({
  checkInModalOpen, checkInTargetRoom, setCheckInModalOpen, handleSubmitCheckIn, checkInForm, setCheckInForm, isSubmittingRoom, checkOutTargetRoom, setCheckOutTargetRoom, handleConfirmCheckOut, displayFloor, st,
}) => (
  <>
        {checkInModalOpen && checkInTargetRoom && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
            <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl border border-stone-200 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600 border border-amber-200">
                    <KeyRound className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-stone-900">{st("Check in room")} {checkInTargetRoom.room_number}
                    </h3>
                    <p className="text-[11px] text-stone-500">
                      {st(checkInTargetRoom.room_type || 'Standard')} • {displayFloor(checkInTargetRoom.floor)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCheckInModalOpen(false)}
                  aria-label={st('Close')}
                  className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleSubmitCheckIn} className="mt-4 space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">{st("Guest’s full name")} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={st("e.g. Alex Nguyen")}
                    value={checkInForm.guest_name}
                    onChange={(e) => setCheckInForm((prev) => ({ ...prev, guest_name: e.target.value }))}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-stone-300 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 bg-white"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">{st("Guest mobile phone")} <span className="text-stone-400 font-normal">{st("(Door access calls)")}</span>
                    </label>
                    <input
                      type="tel"
                      inputMode="tel"
                      maxLength={15}
                      placeholder={st("e.g. 0901234567")}
                      value={checkInForm.guest_phone}
                      onKeyDown={(e) => handleNumericKeyDown(e, { allowPlus: true })}
                      onChange={(e) => {
                        const digits = sanitizePhoneNumber(e.target.value, 15);
                        setCheckInForm((prev) => ({ ...prev, guest_phone: digits }));
                      }}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-stone-300 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">{st("Room extension")} <span className="text-stone-400 font-normal">{st("(Internal calls)")}</span>
                    </label>
                    <input
                      type="text"
                      placeholder={st("e.g. Ext 301")}
                      value={checkInForm.room_phone}
                      onChange={(e) => setCheckInForm((prev) => ({ ...prev, room_phone: e.target.value }))}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-stone-300 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">{st("ID / passport number")} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={15}
                    required
                    placeholder={st("e.g. 079201012345 (numbers only)")}
                    value={checkInForm.identity_number}
                    onKeyDown={handleNumericKeyDown}
                    onChange={(e) => {
                      const digits = sanitizeDigitsOnly(e.target.value, 15);
                      const autoPin = digits.length >= 4 ? digits.slice(-4) : '';
                      setCheckInForm((prev) => ({
                        ...prev,
                        identity_number: digits,
                        pin_code: autoPin || prev.pin_code,
                      }));
                    }}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-stone-300 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 bg-white"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-stone-700">{st("4-digit Kiosk PIN (generated from ID)")} <span className="text-rose-500">*</span>
                    </label>
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    placeholder={st("Last 4 digits of ID")}
                    value={checkInForm.pin_code}
                    onKeyDown={handleNumericKeyDown}
                    onChange={(e) => {
                      const digits = sanitizeDigitsOnly(e.target.value, 4);
                      setCheckInForm((prev) => ({ ...prev, pin_code: digits }));
                    }}
                    className="w-full font-mono font-bold tracking-widest text-center px-3 py-2 text-sm rounded-lg border border-stone-300 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 bg-amber-50/30 text-stone-900"
                  />
                  <p className="mt-1 text-[10px] text-stone-500">{st("The 4-digit PIN is generated from the last 4 digits of the guest’s ID for ordering at the Robot Kiosk.")} </p>
                </div>

                <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setCheckInModalOpen(false)}
                    disabled={isSubmittingRoom}
                    className="px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded-lg cursor-pointer"
                  >{st("Cancel")} </button>
                  <button
                    type="submit"
                    disabled={isSubmittingRoom}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-stone-900 hover:bg-black rounded-lg shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    {isSubmittingRoom ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    )}
                    <span>{st("Confirm check-in")}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL: XÁC NHẬN CHECK-OUT */}
        {/* ========================================================================= */}
        {checkOutTargetRoom && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
            <div className="w-full max-w-sm max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl border border-stone-200 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 mx-auto">
                <AlertCircle className="h-6 w-6" />
              </div>
              <h3 className="mt-3 text-center text-sm font-bold text-stone-900">
                {st('Check out room {0}?', checkOutTargetRoom.room_number)}
              </h3>
              <p className="mt-1 text-center text-xs text-stone-500 leading-relaxed">{st("Guest")} <span className="font-bold text-stone-800">{checkOutTargetRoom.guest_name || st("Hotel guest")}</span> {st("will be checked out. The Kiosk PIN will be revoked and the room will become available for the next guest.")} </p>

              <div className="mt-5 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setCheckOutTargetRoom(null)}
                  disabled={isSubmittingRoom}
                  className="px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded-lg cursor-pointer"
                >{st("Close")} </button>
                <button
                  type="button"
                  onClick={handleConfirmCheckOut}
                  disabled={isSubmittingRoom}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingRoom && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  <span>{st("Confirm check-out")}</span>
                </button>
              </div>
            </div>
          </div>
        )}
  </>
);
