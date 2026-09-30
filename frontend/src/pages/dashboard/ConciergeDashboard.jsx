import React, { useState, useEffect } from 'react';
import {
  PhoneCall,
  Video,
  Clock,
  PhoneOff,
  Plus,
  RefreshCw,
  MessageSquare,
  Car,
  MapPin,
  Navigation,
  UserCheck,
  Check,
  Users,
} from 'lucide-react';
import {
  fetchConciergeDashboard,
  createConciergeRequest,
  updateConciergeRequest,
} from '../../services/conciergeApi';
import {
  fetchTaxiDashboard,
  fetchTaxiRequests,
  createTaxiRequest,
  updateTaxiRequestStatus,
} from '../../services/taxiApi';

export const ConciergeDashboard = ({ currentUser, onNotify = () => {} }) => {
  const [activeSubTab, setActiveSubTab] = useState('live_call'); // 'live_call' | 'taxi'
  const [isLoading, setIsLoading] = useState(false);

  // Live Call states
  const [activeSession, setActiveSession] = useState(null);
  const [activeCount, setActiveCount] = useState(0);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [testForm, setTestForm] = useState({
    room_number: 'Lobby Kiosk Unit 01',
    guest_name: 'Mr. Tanaka Kenji',
    transcript: 'Khách muốn tìm hiểu thông tin về tour du lịch Bà Nà Hills trong ngày.',
    priority: 'HIGH',
  });

  // Taxi & Transportation states
  const [taxiKpis, setTaxiKpis] = useState({
    totalRequests: 0,
    pendingRequests: 0,
    activeTrips: 0,
    completedTrips: 0,
  });
  const [taxiRequests, setTaxiRequests] = useState([]);
  const [isTaxiModalOpen, setIsTaxiModalOpen] = useState(false);
  const [assignModal, setAssignModal] = useState({ open: false, reqId: null, driver: '' });
  const [taxiForm, setTaxiForm] = useState({
    guest_name: '',
    room_number: '',
    pickup_location: 'Main Lobby & Front Entrance',
    destination: 'Da Nang International Airport (DAD)',
    pickup_time: 'Ngay bây giờ (Immediate)',
    party_size: 2,
    vehicle_type: '4-Seater Sedan',
    notes: '',
  });

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [conciergeData, taxiDashData, taxiReqsData] = await Promise.all([
        fetchConciergeDashboard(),
        fetchTaxiDashboard(),
        fetchTaxiRequests(),
      ]);

      if (conciergeData) {
        setActiveSession(conciergeData.current_request || null);
        setActiveCount(conciergeData.active_sessions_count || 0);
      }

      if (taxiDashData?.kpis) {
        setTaxiKpis(taxiDashData.kpis);
      }
      if (Array.isArray(taxiDashData?.requests) && taxiDashData.requests.length > 0) {
        setTaxiRequests(taxiDashData.requests);
      } else if (Array.isArray(taxiReqsData) && taxiReqsData.length > 0) {
        setTaxiRequests(taxiReqsData);
      } else {
        setTaxiRequests([]);
      }
    } catch (err) {
      console.error('[ConciergeDashboard] Error loading data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  // --- LIVE CALL HANDLERS ---
  const handleCreateLiveCall = async (e) => {
    e.preventDefault();
    const result = await createConciergeRequest(testForm);
    if (result) {
      onNotify(`Đã khởi tạo phiên Live Call: ${result.ticket_code || result.id}`);
      setIsTestModalOpen(false);
      loadData();
    }
  };

  const handleUpdateStatus = async (status) => {
    if (!activeSession) return;
    const reqId = activeSession.id || activeSession.ticket_code;
    const result = await updateConciergeRequest(reqId, {
      status,
      assigned_staff_name: currentUser?.full_name || 'Concierge Specialist',
    });
    if (result) {
      onNotify(`Cập nhật trạng thái cuộc gọi: ${status}`);
      loadData();
    }
  };

  // --- TAXI HANDLERS ---
  const handleCreateTaxi = async (e) => {
    e.preventDefault();
    if (!taxiForm.guest_name.trim()) {
      onNotify('Vui lòng nhập tên khách hàng');
      return;
    }
    const result = await createTaxiRequest(taxiForm);
    if (result) {
      onNotify(`Tạo yêu cầu gọi xe thành công: ${result.ticket_code || result.id}`);
      setIsTaxiModalOpen(false);
      setTaxiForm({
        guest_name: '',
        room_number: '',
        pickup_location: 'Main Lobby & Front Entrance',
        destination: 'Da Nang International Airport (DAD)',
        pickup_time: 'Ngay bây giờ (Immediate)',
        party_size: 2,
        vehicle_type: '4-Seater Sedan',
        notes: '',
      });
      loadData();
    }
  };

  const handleUpdateTaxiStatus = async (reqId, newStatus, driver = null) => {
    const res = await updateTaxiRequestStatus(reqId, newStatus, driver);
    if (res) {
      onNotify(`Cập nhật trạng thái chuyến xe: ${newStatus}`);
      setTaxiRequests((prev) =>
        prev.map((r) =>
          r.id === reqId ? { ...r, status: newStatus, assigned_driver: driver || r.assigned_driver } : r
        )
      );
      if (assignModal.open) {
        setAssignModal({ open: false, reqId: null, driver: '' });
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-palette-cream">
      {/* Top Header */}
      <div className="bg-white border-b border-palette-silver px-6 py-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-palette-charcoal flex items-center gap-2">
              <PhoneCall className="w-5 h-5 text-palette-charcoal" />
              Bộ phận Trợ lý Concierge & Điều phối Vận chuyển (Concierge & Transportation)
            </h1>
            <p className="text-xs text-palette-slate mt-0.5">
              Tổng đài can thiệp trực tuyến Live Call Robot Kiosk và điều phối dịch vụ đặt xe di chuyển cho khách
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              disabled={isLoading}
              className="p-2 rounded-lg bg-palette-stone text-palette-charcoal hover:bg-palette-silver border border-palette-silver text-xs font-semibold flex items-center gap-1 transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Làm mới
            </button>
            {activeSubTab === 'live_call' ? (
              <button
                onClick={() => setIsTestModalOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-palette-charcoal hover:bg-neutral-800 text-palette-cream text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                Mô phỏng gọi từ Kiosk
              </button>
            ) : (
              <button
                onClick={() => setIsTaxiModalOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-palette-charcoal hover:bg-neutral-800 text-palette-cream text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                Đặt xe mới
              </button>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 mt-4 border-t border-palette-silver/50 pt-3">
          <button
            onClick={() => setActiveSubTab('live_call')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              activeSubTab === 'live_call'
                ? 'bg-palette-charcoal text-palette-cream shadow-sm'
                : 'text-palette-slate hover:bg-palette-stone hover:text-palette-charcoal'
            }`}
          >
            <PhoneCall className="w-3.5 h-3.5" />
            <span>Tổng đài Live Call</span>
            {activeCount > 0 && (
              <span className="bg-emerald-500 text-white text-[10px] px-1.5 py-0.2 rounded-full">
                {activeCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveSubTab('taxi')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              activeSubTab === 'taxi'
                ? 'bg-palette-charcoal text-palette-cream shadow-sm'
                : 'text-palette-slate hover:bg-palette-stone hover:text-palette-charcoal'
            }`}
          >
            <Car className="w-3.5 h-3.5" />
            <span>Điều phối Đặt xe & Vận chuyển</span>
            {taxiKpis.pendingRequests > 0 && (
              <span className="bg-palette-stone text-palette-charcoal border border-palette-silver text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                {taxiKpis.pendingRequests}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* SUBTAB 1: LIVE CALL */}
        {activeSubTab === 'live_call' && (
          <div className="space-y-6">
            {/* Live Call Metric Banner */}
            <div className="flex items-center gap-3 bg-palette-stone/50 border border-palette-silver rounded-xl p-3">
              <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <div className="flex-1">
                <span className="text-xs font-bold text-palette-charcoal">
                  Trạng thái Trực Tổng Đài: Sẵn Sàng (Live Concierge Online)
                </span>
                <span className="text-xs text-palette-slate ml-2">
                  Đang có <strong className="text-palette-charcoal">{activeCount}</strong> phiên hỗ trợ cần xử lý
                </span>
              </div>
            </div>

            {activeSession ? (
              <div className="max-w-3xl mx-auto bg-white rounded-xl border border-palette-silver p-6 shadow-sm">
                <div className="flex items-start justify-between border-b border-palette-silver/40 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold bg-palette-stone text-palette-charcoal border border-palette-silver px-2 py-0.5 rounded">
                        {activeSession.ticket_code || activeSession.id}
                      </span>
                      <span className="text-sm font-bold text-palette-charcoal">
                        {activeSession.guest_name || 'Khách tại Kiosk'}
                      </span>
                      <span className="text-xs text-palette-slate">
                        ({activeSession.room_number || 'Sảnh S1'})
                      </span>
                    </div>
                    <div className="text-xs text-palette-slate mt-1 flex items-center gap-2">
                      <Clock className="w-3 h-3" />
                      Khởi tạo: {activeSession.created_at || 'Vừa xong'}
                    </div>
                  </div>

                  <span
                    className={`text-xs font-bold px-3 py-1 rounded-full ${
                      activeSession.status === 'Connected'
                        ? 'bg-emerald-100 text-emerald-800 animate-pulse'
                        : activeSession.status === 'Closed'
                        ? 'bg-palette-stone text-palette-slate'
                        : 'bg-palette-stone text-palette-charcoal border border-palette-silver'
                    }`}
                  >
                    {activeSession.status || 'Pending'}
                  </span>
                </div>

                {/* Conversation Transcript */}
                <div className="my-6">
                  <label className="text-xs font-bold text-palette-charcoal uppercase tracking-wider flex items-center gap-1.5 mb-2">
                    <MessageSquare className="w-3.5 h-3.5 text-palette-charcoal" />
                    Nội Dung Hội Thoại Chuyển Tiếp Từ Robot
                  </label>
                  <div className="bg-palette-cream/70 border border-palette-silver rounded-lg p-4 text-xs text-palette-charcoal leading-relaxed font-sans">
                    {activeSession.description || 'Không có mô tả hội thoại.'}
                  </div>
                </div>

                {/* Action Bar */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-palette-silver/50">
                  {activeSession.status !== 'Connected' && activeSession.status !== 'Closed' && (
                    <button
                      onClick={() => handleUpdateStatus('Connected')}
                      className="px-4 py-2 rounded-lg bg-palette-charcoal hover:bg-neutral-800 text-palette-cream text-xs font-bold flex items-center gap-2 shadow-sm transition-all"
                    >
                      <Video className="w-4 h-4" />
                      Tiếp nhận cuộc gọi Video
                    </button>
                  )}

                  {activeSession.status === 'Connected' && (
                    <button
                      onClick={() => handleUpdateStatus('Closed')}
                      className="px-4 py-2 rounded-lg bg-neutral-700 hover:bg-neutral-800 text-white text-xs font-bold flex items-center gap-2 shadow-sm transition-all"
                    >
                      <PhoneOff className="w-4 h-4" />
                      Kết thúc phiên hỗ trợ
                    </button>
                  )}

                  {activeSession.status === 'Closed' && (
                    <span className="text-xs text-palette-slate font-semibold">
                      Phiên hỗ trợ này đã hoàn tất.
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="max-w-md mx-auto my-12 bg-white rounded-xl border border-palette-silver p-8 text-center shadow-sm">
                <PhoneCall className="w-12 h-12 text-palette-slate/40 mx-auto mb-3" />
                <h2 className="text-sm font-bold text-palette-charcoal">Không có cuộc gọi Live Call nào</h2>
                <p className="text-xs text-palette-slate mt-1">
                  Robot Kiosk hiện chưa phát tín hiệu can thiệp trực tiếp từ khách hàng.
                </p>
                <button
                  onClick={() => setIsTestModalOpen(true)}
                  className="mt-4 px-3 py-1.5 rounded-lg bg-palette-charcoal hover:bg-neutral-800 text-palette-cream text-xs font-semibold inline-flex items-center gap-1.5 transition-all shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Tạo cuộc gọi mô phỏng
                </button>
              </div>
            )}
          </div>
        )}

        {/* SUBTAB 2: TAXI & TRANSPORTATION */}
        {activeSubTab === 'taxi' && (
          <div className="space-y-6">
            {/* Metric KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-palette-stone/40 border border-palette-silver rounded-xl p-3">
                <div className="text-[11px] font-semibold text-palette-slate">Tổng cuốc xe</div>
                <div className="text-xl font-bold text-palette-charcoal mt-1">
                  {taxiRequests.length || taxiKpis.totalRequests}
                </div>
              </div>
              <div className="bg-palette-stone/40 border border-palette-silver rounded-xl p-3">
                <div className="text-[11px] font-semibold text-palette-slate">Chờ điều phối</div>
                <div className="text-xl font-bold text-palette-charcoal mt-1">
                  {taxiRequests.filter((r) => r.status === 'Pending' || r.status === 'Unassigned').length ||
                    taxiKpis.pendingRequests}
                </div>
              </div>
              <div className="bg-palette-stone/40 border border-palette-silver rounded-xl p-3">
                <div className="text-[11px] font-semibold text-palette-slate">Đang di chuyển</div>
                <div className="text-xl font-bold text-sky-600 mt-1">
                  {taxiRequests.filter(
                    (r) => r.status === 'In Progress' || r.status === 'On The Way' || r.status === 'Driver Assigned'
                  ).length || taxiKpis.activeTrips}
                </div>
              </div>
              <div className="bg-palette-stone/40 border border-palette-silver rounded-xl p-3">
                <div className="text-[11px] font-semibold text-palette-slate">Đã hoàn thành</div>
                <div className="text-xl font-bold text-emerald-600 mt-1">
                  {taxiRequests.filter((r) => r.status === 'Completed').length || taxiKpis.completedTrips}
                </div>
              </div>
            </div>

            {/* Taxi Request List */}
            <div className="bg-white rounded-xl border border-palette-silver shadow-sm overflow-hidden">
              <div className="p-4 border-b border-palette-silver/50 flex items-center justify-between">
                <span className="text-xs font-bold text-palette-charcoal">Danh Sách Yêu Cầu Đặt Xe & Điều Phối</span>
                <span className="text-[11px] text-palette-slate">Hiển thị {taxiRequests.length} chuyến xe</span>
              </div>

              {taxiRequests.length === 0 ? (
                <div className="p-8 text-center text-xs text-palette-slate">
                  Hiện chưa có yêu cầu đặt xe nào trong hệ thống.
                </div>
              ) : (
                <div className="divide-y divide-palette-silver/30">
                  {taxiRequests.map((trip) => (
                    <div
                      key={trip.id}
                      className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 hover:bg-palette-cream/40 transition-all"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-palette-charcoal bg-palette-stone border border-palette-silver px-2 py-0.5 rounded">
                            {trip.ticket_code || trip.id}
                          </span>
                          <span className="text-xs font-bold text-palette-charcoal">{trip.guest_name}</span>
                          {trip.room_number && (
                            <span className="text-[11px] text-palette-slate">(Phòng {trip.room_number})</span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-4 text-xs text-palette-slate mt-2">
                          <span className="flex items-center gap-1 text-palette-charcoal">
                            <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0" />
                            Đón: <strong className="font-semibold">{trip.pickup_location}</strong>
                          </span>
                          <span className="flex items-center gap-1 text-palette-charcoal">
                            <Navigation className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                            Đến: <strong className="font-semibold">{trip.destination}</strong>
                          </span>
                          <span className="flex items-center gap-1 text-palette-slate">
                            <Clock className="w-3.5 h-3.5 shrink-0" />
                            {trip.pickup_time || 'Ngay bây giờ'}
                          </span>
                          <span className="flex items-center gap-1 text-palette-slate">
                            <Car className="w-3.5 h-3.5 shrink-0" />
                            {trip.vehicle_type || '4 chỗ'} ({trip.party_size || 2} khách)
                          </span>
                        </div>

                        {trip.assigned_driver && (
                          <div className="mt-2 flex items-center gap-2 text-[11px] text-palette-charcoal">
                            <span className="font-semibold">Tài xế:</span> {trip.assigned_driver}
                            {trip.license_plate && (
                              <span className="font-mono bg-palette-stone text-palette-charcoal px-1.5 py-0.5 rounded border border-palette-silver">
                                {trip.license_plate}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 self-start md:self-center">
                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                            trip.status === 'Completed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : trip.status === 'On The Way' || trip.status === 'Driver Assigned'
                              ? 'bg-sky-100 text-sky-800'
                              : 'bg-palette-stone text-palette-charcoal border border-palette-silver'
                          }`}
                        >
                          {trip.status}
                        </span>

                        {trip.status === 'Pending' && (
                          <button
                            onClick={() =>
                              setAssignModal({ open: true, reqId: trip.id, driver: 'Mai Linh Taxi - Tài xế Tuấn' })
                            }
                            className="px-2.5 py-1 text-[11px] font-bold rounded bg-palette-charcoal hover:bg-neutral-800 text-palette-cream transition-all flex items-center gap-1 shadow-sm"
                          >
                            <UserCheck className="w-3 h-3" />
                            Gán tài xế
                          </button>
                        )}

                        {(trip.status === 'Driver Assigned' || trip.status === 'On The Way') && (
                          <button
                            onClick={() => handleUpdateTaxiStatus(trip.id, 'Completed')}
                            className="px-2.5 py-1 text-[11px] font-bold rounded bg-emerald-600 hover:bg-emerald-700 text-white transition-all flex items-center gap-1"
                          >
                            <Check className="w-3 h-3" />
                            Đã đón xong
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* MODAL: MÔ PHỎNG LIVE CALL */}
      {isTestModalOpen && (
        <div className="fixed inset-0 z-50 bg-palette-charcoal/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-palette-silver">
            <h2 className="text-base font-bold text-palette-charcoal mb-4">Mô Phỏng Cuộc Gọi Từ Robot Kiosk</h2>
            <form onSubmit={handleCreateLiveCall} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-palette-charcoal">Vị trí Kiosk</label>
                <input
                  type="text"
                  required
                  value={testForm.room_number}
                  onChange={(e) => setTestForm({ ...testForm, room_number: e.target.value })}
                  className="w-full mt-1 px-3 py-1.5 border border-palette-silver rounded-lg text-xs outline-none focus:border-palette-charcoal"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-palette-charcoal">Tên khách hàng</label>
                <input
                  type="text"
                  required
                  value={testForm.guest_name}
                  onChange={(e) => setTestForm({ ...testForm, guest_name: e.target.value })}
                  className="w-full mt-1 px-3 py-1.5 border border-palette-silver rounded-lg text-xs outline-none focus:border-palette-charcoal"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-palette-charcoal">Nội dung hội thoại Robot chuyển tiếp</label>
                <textarea
                  rows="3"
                  value={testForm.transcript}
                  onChange={(e) => setTestForm({ ...testForm, transcript: e.target.value })}
                  className="w-full mt-1 px-3 py-1.5 border border-palette-silver rounded-lg text-xs outline-none focus:border-palette-charcoal"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-palette-silver/50">
                <button
                  type="button"
                  onClick={() => setIsTestModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-palette-slate hover:text-palette-charcoal hover:bg-palette-stone rounded-lg font-semibold transition-all"
                >
                  Huỷ
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs bg-palette-charcoal hover:bg-neutral-800 text-palette-cream rounded-lg font-semibold transition-all shadow-sm"
                >
                  Phát tín hiệu gọi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ĐẶT XE MỚI */}
      {isTaxiModalOpen && (
        <div className="fixed inset-0 z-50 bg-palette-charcoal/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-palette-silver">
            <h2 className="text-base font-bold text-palette-charcoal mb-4">Tạo Yêu Cầu Đặt Xe Mới</h2>
            <form onSubmit={handleCreateTaxi} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-palette-charcoal">Tên khách hàng *</label>
                <input
                  type="text"
                  required
                  value={taxiForm.guest_name}
                  onChange={(e) => setTaxiForm({ ...taxiForm, guest_name: e.target.value })}
                  className="w-full mt-1 px-3 py-1.5 border border-palette-silver rounded-lg text-xs outline-none focus:border-palette-charcoal"
                  placeholder="Vd: Mr. David Miller"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-palette-charcoal">Số phòng</label>
                  <input
                    type="text"
                    value={taxiForm.room_number}
                    onChange={(e) => setTaxiForm({ ...taxiForm, room_number: e.target.value })}
                    className="w-full mt-1 px-3 py-1.5 border border-palette-silver rounded-lg text-xs outline-none focus:border-palette-charcoal"
                    placeholder="Vd: 501"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-palette-charcoal">Số khách</label>
                  <input
                    type="number"
                    min="1"
                    max="16"
                    value={taxiForm.party_size}
                    onChange={(e) => setTaxiForm({ ...taxiForm, party_size: parseInt(e.target.value) || 1 })}
                    className="w-full mt-1 px-3 py-1.5 border border-palette-silver rounded-lg text-xs outline-none focus:border-palette-charcoal"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-palette-charcoal">Điểm đón</label>
                <input
                  type="text"
                  value={taxiForm.pickup_location}
                  onChange={(e) => setTaxiForm({ ...taxiForm, pickup_location: e.target.value })}
                  className="w-full mt-1 px-3 py-1.5 border border-palette-silver rounded-lg text-xs outline-none focus:border-palette-charcoal"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-palette-charcoal">Điểm đến</label>
                <input
                  type="text"
                  value={taxiForm.destination}
                  onChange={(e) => setTaxiForm({ ...taxiForm, destination: e.target.value })}
                  className="w-full mt-1 px-3 py-1.5 border border-palette-silver rounded-lg text-xs outline-none focus:border-palette-charcoal"
                  placeholder="Vd: Sân bay Đà Nẵng, Phố Cổ Hội An..."
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-palette-charcoal">Loại xe</label>
                  <select
                    value={taxiForm.vehicle_type}
                    onChange={(e) => setTaxiForm({ ...taxiForm, vehicle_type: e.target.value })}
                    className="w-full mt-1 px-3 py-1.5 border border-palette-silver rounded-lg text-xs outline-none focus:border-palette-charcoal bg-white"
                  >
                    <option value="4-Seater Sedan">Sedan 4 chỗ</option>
                    <option value="7-Seater SUV">SUV 7 chỗ</option>
                    <option value="Luxury Limousine">Limousine VIP</option>
                    <option value="16-Seater Van">Xe 16 chỗ</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-palette-charcoal">Thời gian đón</label>
                  <input
                    type="text"
                    value={taxiForm.pickup_time}
                    onChange={(e) => setTaxiForm({ ...taxiForm, pickup_time: e.target.value })}
                    className="w-full mt-1 px-3 py-1.5 border border-palette-silver rounded-lg text-xs outline-none focus:border-palette-charcoal"
                    placeholder="Vd: 14:00 Chiều nay"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-palette-silver/50">
                <button
                  type="button"
                  onClick={() => setIsTaxiModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-palette-slate hover:text-palette-charcoal hover:bg-palette-stone rounded-lg font-semibold transition-all"
                >
                  Huỷ
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs bg-palette-charcoal hover:bg-neutral-800 text-palette-cream rounded-lg font-semibold transition-all shadow-sm"
                >
                  Xác nhận gọi xe
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: GÁN TÀI XẾ */}
      {assignModal.open && (
        <div className="fixed inset-0 z-50 bg-palette-charcoal/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-5 shadow-xl border border-palette-silver">
            <h2 className="text-sm font-bold text-palette-charcoal mb-3">Điều Phối Tài Xế Cho Chuyến Đi</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-palette-charcoal">Tên tài xế & Hãng xe</label>
                <input
                  type="text"
                  value={assignModal.driver}
                  onChange={(e) => setAssignModal({ ...assignModal, driver: e.target.value })}
                  className="w-full mt-1 px-3 py-1.5 border border-palette-silver rounded-lg text-xs outline-none focus:border-palette-charcoal"
                  placeholder="Vd: Anh Nam (Mai Linh - 43A-123.45)"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setAssignModal({ open: false, reqId: null, driver: '' })}
                  className="px-3 py-1.5 text-xs text-palette-slate hover:text-palette-charcoal hover:bg-palette-stone rounded-lg font-semibold transition-all"
                >
                  Huỷ
                </button>
                <button
                  onClick={() =>
                    handleUpdateTaxiStatus(assignModal.reqId, 'Driver Assigned', assignModal.driver)
                  }
                  className="px-4 py-1.5 text-xs bg-palette-charcoal hover:bg-neutral-800 text-palette-cream rounded-lg font-semibold transition-all shadow-sm"
                >
                  Lưu & Báo khách
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
