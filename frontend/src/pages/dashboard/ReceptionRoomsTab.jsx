import React from 'react';
import { User, RefreshCw, KeyRound, Eye, EyeOff, ShieldCheck, DoorOpen, LogOut, LogIn, Search, Copy, Building2, X } from 'lucide-react';

export const ReceptionRoomsTab = ({
  roomStats, roomSearchQuery, setRoomSearchQuery, roomStatusFilter, setRoomStatusFilter, handleSyncFromRAG, isSyncingRAG, isLoadingRooms, filteredRooms, displayFloor, revealedPins, togglePinReveal, handleCopyPin, handleOpenCheckIn, setCheckOutTargetRoom, st,
}) => (
  <>
          <div className="space-y-5">
            {/* KPI stats cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="reception-panel p-4 rounded-xl bg-white border border-[#E8E5E0] shadow-2xs">
                <div className="flex items-center justify-between text-[#77726D]">
                  <span className="text-[11px] font-semibold uppercase tracking-wider">{st("Total rooms")}</span>
                  <Building2 className="h-4 w-4 text-stone-500" />
                </div>
                <div className="mt-2 text-2xl font-black text-stone-900 font-mono">
                  {roomStats.total}
                </div>
                <div className="mt-0.5 text-[10px] text-stone-500">{st("Configured in the system")}</div>
              </div>

              <div className="reception-panel p-4 rounded-xl bg-white border border-[#E8E5E0] shadow-2xs">
                <div className="flex items-center justify-between text-emerald-700">
                  <span className="text-[11px] font-semibold uppercase tracking-wider">{st("Occupied")}</span>
                  <User className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="mt-2 text-2xl font-black text-emerald-700 font-mono">
                  {roomStats.occupied}
                </div>
                <div className="mt-0.5 text-[10px] text-emerald-600/80">{st("Occupancy:")} {roomStats.occupancyRate}%</div>
              </div>

              <div className="reception-panel p-4 rounded-xl bg-white border border-[#E8E5E0] shadow-2xs">
                <div className="flex items-center justify-between text-stone-600">
                  <span className="text-[11px] font-semibold uppercase tracking-wider">{st("Vacant")}</span>
                  <DoorOpen className="h-4 w-4 text-stone-500" />
                </div>
                <div className="mt-2 text-2xl font-black text-stone-700 font-mono">
                  {roomStats.available}
                </div>
                <div className="mt-0.5 text-[10px] text-stone-500">{st("Ready for check-in")}</div>
              </div>

              <div className="reception-panel p-4 rounded-xl bg-white border border-[#E8E5E0] shadow-2xs">
                <div className="flex items-center justify-between text-amber-700">
                  <span className="text-[11px] font-semibold uppercase tracking-wider">{st("Kiosk PIN security")}</span>
                  <ShieldCheck className="h-4 w-4 text-amber-600" />
                </div>
                <div className="mt-2 text-sm font-bold text-amber-800">{st("4-digit PIN / ID")} </div>
                <div className="mt-0.5 text-[10px] text-stone-500">{st("Robot voice verification")}</div>
              </div>
            </div>

            {/* Filter and search toolbar */}
            <div className="reception-panel flex flex-wrap items-center justify-between gap-3 p-3 bg-white rounded-xl border border-[#E8E5E0] shadow-2xs">
              <div className="flex items-center gap-2 flex-1 min-w-[240px]">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-400" />
                  <input
                    type="text"
                    value={roomSearchQuery}
                    onChange={(e) => setRoomSearchQuery(e.target.value)}
                    placeholder={st("Search by room, guest name or ID...")}
                    className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-stone-200 focus:outline-none focus:border-amber-500 bg-stone-50/50"
                  />
                  {roomSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setRoomSearchQuery('')}
                      aria-label={st('Clear search')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setRoomStatusFilter('all')}
                  className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors cursor-pointer ${
                    roomStatusFilter === 'all'
                      ? 'bg-stone-900 text-white'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >{st("All (")}{rooms.length})
                </button>
                <button
                  type="button"
                  onClick={() => setRoomStatusFilter('occupied')}
                  className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors cursor-pointer ${
                    roomStatusFilter === 'occupied'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >{st("Occupied (")}{roomStats.occupied})
                </button>
                <button
                  type="button"
                  onClick={() => setRoomStatusFilter('available')}
                  className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors cursor-pointer ${
                    roomStatusFilter === 'available'
                      ? 'bg-stone-700 text-white'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >{st("Vacant (")}{roomStats.available})
                </button>

                <button
                  type="button"
                  onClick={handleSyncFromRAG}
                  disabled={isSyncingRAG}
                  className="inline-flex items-center gap-1.5 px-3 py-1 text-xs rounded-lg font-medium bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition-colors cursor-pointer disabled:opacity-50 ml-2"
                  title={st("Sync rooms from the system room directory (301–310, 401–410)")}
                >
                  <RefreshCw className={`h-3 w-3 ${isSyncingRAG ? 'animate-spin' : ''}`} />
                  <span>{st("Sync rooms")}</span>
                </button>
              </div>
            </div>

            {/* Room List Table */}
            <div className="reception-panel rounded-xl border border-[#E8E5E0] bg-white overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F8F7F4] border-b border-[#E8E5E0] text-[11px] font-bold text-stone-600 uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">{st("Room number")}</th>
                      <th className="py-3 px-4">{st("Status")}</th>
                      <th className="py-3 px-4">{st("Hotel guest")}</th>
                      <th className="py-3 px-4">{st("ID / passport")}</th>
                      <th className="py-3 px-4">{st("Kiosk PIN")}</th>
                      <th className="py-3 px-4 text-right">{st("Actions")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0ECE6]">
                    {isLoadingRooms ? (
                      <tr>
                        <td colSpan={6} className="py-10 text-center text-stone-400">
                          <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-stone-400" />{st("Loading rooms...")} </td>
                      </tr>
                    ) : filteredRooms.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-10 text-center text-stone-400">{st("No rooms match your filters.")} </td>
                      </tr>
                    ) : (
                      filteredRooms.map((room) => {
                        const isOccupied = (room.status || '').toLowerCase() === 'occupied';
                        const isPinRevealed = !!revealedPins[room.id];

                        return (
                          <tr key={room.id} className="hover:bg-stone-50/70 transition-colors">
                            {/* Số phòng & Tầng */}
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-black text-sm text-stone-900 bg-amber-50/90 border border-amber-200/80 px-2.5 py-0.5 rounded-md">
                                  {room.room_number}
                                </span>
                                <div>
                                  <div className="text-[11px] font-semibold text-stone-700">
                                    {st(room.room_type || 'Standard')}
                                  </div>
                                  <div className="text-[10px] text-stone-400">
                                    {displayFloor(room.floor)}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Trạng thái */}
                            <td className="py-3 px-4">
                              {isOccupied ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />{st("Occupied")} </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-stone-100 text-stone-600 border border-stone-200">
                                  <span className="h-1.5 w-1.5 rounded-full bg-stone-400" />{st("Vacant")} </span>
                              )}
                            </td>

                            {/* Khách lưu trú */}
                            <td className="py-3 px-4">
                              {isOccupied ? (
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <User className="h-3 w-3 text-stone-400" />
                                    <span className="font-semibold text-stone-800">
                                      {room.guest_name || st("Hotel guest")}
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-stone-500 font-mono mt-0.5 space-x-1.5">
                                    {(room.current_guest_phone || room.guest_phone) && (
                                      <span>{st("Phone:")} {room.current_guest_phone || room.guest_phone}</span>
                                    )}
                                    {(room.room_phone || room.roomPhone) && (
                                      <span className="text-amber-800 font-medium">({room.room_phone || room.roomPhone})</span>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-stone-400 italic">—</span>
                              )}
                            </td>

                            {/* CCCD / Passport */}
                            <td className="py-3 px-4">
                              {room.identity_number ? (
                                <div className="font-mono text-stone-700 text-xs">
                                  •••• {room.identity_number.slice(-4)}
                                </div>
                              ) : (
                                <span className="text-stone-400 italic">—</span>
                              )}
                            </td>

                            {/* Mã PIN Kiosk */}
                            <td className="py-3 px-4">
                              {room.pin_code ? (
                                <div className="inline-flex items-center gap-1.5 bg-stone-100 px-2 py-1 rounded-lg border border-stone-200">
                                  <KeyRound className="h-3 w-3 text-amber-600" />
                                  <span className="font-mono font-bold tracking-widest text-xs text-stone-900">
                                    {isPinRevealed ? room.pin_code : '••••••'}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => togglePinReveal(room.id)}
                                    className="text-stone-400 hover:text-stone-700 p-0.5 ml-1 transition-colors cursor-pointer"
                                    title={isPinRevealed ? st("Hide PIN") : st("Show PIN")}
                                  >
                                    {isPinRevealed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleCopyPin(room.pin_code, room.room_number)}
                                    className="text-stone-400 hover:text-amber-700 p-0.5 transition-colors cursor-pointer"
                                    title={st("Copy PIN")}
                                  >
                                    <Copy className="h-3 w-3" />
                                  </button>
                                </div>
                              ) : (
                                <span className="text-stone-400 italic text-[11px]">{st("No PIN assigned")}</span>
                              )}
                            </td>

                            {/* Thao tác */}
                            <td className="py-3 px-4 text-right">
                              {isOccupied ? (
                                <button
                                  type="button"
                                  onClick={() => setCheckOutTargetRoom(room)}
                                  className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer"
                                >
                                  <LogOut className="h-3 w-3" />
                                  <span>{st("Check-out")}</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleOpenCheckIn(room)}
                                  className="inline-flex items-center gap-1 px-3 py-1 text-xs font-bold text-white bg-stone-900 hover:bg-black rounded-lg transition-colors shadow-2xs cursor-pointer"
                                >
                                  <LogIn className="h-3 w-3" />
                                  <span>{st("Check-in")}</span>
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
  </>
);
