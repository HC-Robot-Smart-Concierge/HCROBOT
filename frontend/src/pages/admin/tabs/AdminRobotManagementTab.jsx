import React, { useState, useEffect, useCallback } from 'react';
import {
  Bot,
  BatteryCharging,
  MapPin,
  Cpu,
  History,
  Wrench,
  Save,
  RotateCw,
  Plus,
  CheckCircle2,
  Play,
  Trash2,
  Edit3,
  Eye,
  X,
  AlertTriangle,
  Clock,
  Wifi,
  WifiOff,
} from 'lucide-react';
import {
  fetchRobotProfile,
  updateRobotProfile,
  fetchRobotJobs,
  fetchRobotJobDetail,
  fetchRobotMaintenance,
  createRobotMaintenance,
  updateRobotMaintenance,
  deleteRobotMaintenance,
  sendRobotControlCommand,
} from '../../../services/operationsApi';
import { useLanguage } from '../../../context/LanguageContext';

const PI5_IP = import.meta.env.VITE_PI5_IP || '100.99.72.51';
const PI5_API = `http://${PI5_IP}:8000/api/v1`;

const ROBOT_STATUS_OPTIONS = ['IDLE', 'NAVIGATING', 'INTERACTING', 'CHARGING', 'MAINTENANCE', 'ERROR', 'OFFLINE'];

const COMPONENT_OPTIONS = [
  { value: 'lidar', vi: 'Cảm biến LiDAR', en: 'LiDAR Sensor' },
  { value: 'battery', vi: 'Pin & Nguồn Pi 5', en: 'Battery & Power' },
  { value: 'motors', vi: 'Động cơ & Bánh xe', en: 'Motors & Wheels' },
  { value: 'camera', vi: 'Camera & Màn hình', en: 'Camera & Display' },
  { value: 'chassis', vi: 'Khung vỏ & Cơ khí', en: 'Chassis & Frame' },
  { value: 'software', vi: 'Phần mềm ROS 2 / AI', en: 'ROS 2 / AI Software' },
  { value: 'general', vi: 'Tổng quát', en: 'General' },
];

const MAINTENANCE_TYPE_OPTIONS = [
  { value: 'preventive', vi: 'Bảo trì định kỳ', en: 'Preventive' },
  { value: 'inspection', vi: 'Kiểm tra kỹ thuật', en: 'Inspection' },
  { value: 'calibration', vi: 'Hiệu chỉnh (Calibration)', en: 'Calibration' },
  { value: 'repair', vi: 'Sửa chữa / Thay thế', en: 'Repair' },
];

const mapSubTabToView = (subTab) => {
  if (subTab === 'robot_jobs' || subTab === 'history') return 'history';
  if (subTab === 'robot_maintenance' || subTab === 'maintenance') return 'maintenance';
  return 'profile';
};

const mapViewToSubTab = (view) => {
  if (view === 'history') return 'robot_jobs';
  if (view === 'maintenance') return 'robot_maintenance';
  return 'robot_profile';
};

const formatDateTime = (iso) => {
  if (!iso) return '---';
  try {
    return new Date(iso).toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(iso);
  }
};

const toDatetimeLocalInput = (iso) => {
  const dt = iso ? new Date(iso) : new Date(Date.now() + 86400000);
  if (Number.isNaN(dt.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
};

export const AdminRobotManagementTab = ({
  initialView = 'profile',
  onSwitchSubTab,
}) => {
  const { language } = useLanguage();
  const isEN = language === 'EN';

  const [activeView, setActiveView] = useState(() => mapSubTabToView(initialView));
  const [toast, setToast] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Profile & Live Pi5 Power
  const [profile, setProfile] = useState(null);
  const [profileForm, setProfileForm] = useState({
    name: '',
    model_type: '',
    serial_number: '',
    firmware_version: '',
    status: 'IDLE',
    battery_level: 100,
    current_location: 'Main Lobby',
    is_online: true,
    ip_address: PI5_IP,
    notes: '',
  });
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [piBattery, setPiBattery] = useState(null);

  // Job History
  const [jobsData, setJobsData] = useState({ total: 0, completed: 0, running: 0, failed: 0, items: [] });
  const [jobStatusFilter, setJobStatusFilter] = useState('ALL');
  const [jobTriggerFilter, setJobTriggerFilter] = useState('ALL');
  const [selectedJob, setSelectedJob] = useState(null);
  const [isLoadingJobDetail, setIsLoadingJobDetail] = useState(false);

  // Maintenance Schedules
  const [maintData, setMaintData] = useState({ total: 0, scheduled: 0, in_progress: 0, completed: 0, overdue: 0, items: [] });
  const [maintStatusFilter, setMaintStatusFilter] = useState('all');
  const [maintComponentFilter, setMaintComponentFilter] = useState('all');
  const [isMaintModalOpen, setIsMaintModalOpen] = useState(false);
  const [editingMaint, setEditingMaint] = useState(null);
  const [maintForm, setMaintForm] = useState({
    title: '',
    maintenance_type: 'preventive',
    component: 'lidar',
    priority: 'Normal',
    status: 'Scheduled',
    scheduled_date: toDatetimeLocalInput(null),
    interval_days: 30,
    assigned_technician: '',
    notes: '',
  });
  const [isSavingMaint, setIsSavingMaint] = useState(false);

  useEffect(() => {
    setActiveView(mapSubTabToView(initialView));
  }, [initialView]);

  const showToast = (msg, isError = false) => {
    setToast({ msg, isError });
    setTimeout(() => setToast(null), 3500);
  };

  const handleSelectView = (view) => {
    setActiveView(view);
    if (onSwitchSubTab) {
      onSwitchSubTab(mapViewToSubTab(view));
    }
  };

  const loadProfile = useCallback(async () => {
    const data = await fetchRobotProfile('RC-001');
    setProfile(data);
    setProfileForm({
      name: data.name || 'Aurora Concierge Unit 01',
      model_type: data.model_type || 'Differential Drive Concierge',
      serial_number: data.serial_number || '',
      firmware_version: data.firmware_version || '',
      status: data.status || 'IDLE',
      battery_level: typeof data.battery_level === 'number' ? data.battery_level : 100,
      current_location: data.current_location || 'Main Lobby',
      is_online: Boolean(data.is_online),
      ip_address: data.ip_address || PI5_IP,
      notes: data.notes || '',
    });
  }, []);

  const loadJobs = useCallback(async () => {
    const res = await fetchRobotJobs({
      robotId: 'RC-001',
      status: jobStatusFilter,
      triggerType: jobTriggerFilter,
      limit: 100,
    });
    setJobsData(res);
  }, [jobStatusFilter, jobTriggerFilter]);

  const loadMaintenance = useCallback(async () => {
    const res = await fetchRobotMaintenance({
      robotId: 'RC-001',
      status: maintStatusFilter,
      component: maintComponentFilter,
    });
    setMaintData(res);
  }, [maintStatusFilter, maintComponentFilter]);

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    try {
      await Promise.all([loadProfile(), loadJobs(), loadMaintenance()]);
    } catch (err) {
      showToast(err.message || (isEN ? 'Failed to load RC-001 data.' : 'Không thể tải dữ liệu RC-001.'), true);
    } finally {
      setIsLoading(false);
    }
  }, [loadProfile, loadJobs, loadMaintenance, isEN]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Đọc thêm nguồn pin Pi 5 thực tế nếu Pi 5 đang online (không block nếu offline)
  useEffect(() => {
    let mounted = true;
    const pollPi = async () => {
      try {
        const res = await fetch(`${PI5_API}/system/power`);
        if (!res.ok) return;
        const data = await res.json();
        if (mounted && data?.battery) {
          setPiBattery(data.battery);
        }
      } catch {
        if (mounted) setPiBattery(null);
      }
    };
    pollPi();
    const timer = setInterval(pollPi, 5000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setIsSavingProfile(true);
    try {
      const updated = await updateRobotProfile(
        {
          ...profileForm,
          battery_level: Math.max(0, Math.min(100, Number(profileForm.battery_level) || 0)),
        },
        'RC-001'
      );
      setProfile(updated);
      showToast(isEN ? 'RC-001 profile & status saved.' : 'Đã cập nhật hồ sơ & trạng thái RC-001.');
    } catch (err) {
      showToast(err.message || 'Lỗi lưu hồ sơ robot', true);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleQuickAction = async (cmd, nextStatus, nextLocation) => {
    try {
      await sendRobotControlCommand(cmd);
    } catch {
      // UDP may be unreachable in dev; still update DB status cleanly
    }
    try {
      const updated = await updateRobotProfile(
        {
          status: nextStatus,
          ...(nextLocation ? { current_location: nextLocation } : {}),
        },
        'RC-001'
      );
      setProfile(updated);
      setProfileForm((prev) => ({
        ...prev,
        status: updated.status,
        current_location: updated.current_location,
      }));
      showToast(
        isEN
          ? `RC-001 status updated to ${nextStatus}.`
          : `Đã chuyển trạng thái RC-001 sang ${nextStatus}.`
      );
    } catch (err) {
      showToast(err.message || 'Lỗi gửi lệnh điều khiển', true);
    }
  };

  const handleViewJobDetail = async (jobId) => {
    setIsLoadingJobDetail(true);
    try {
      const detail = await fetchRobotJobDetail(jobId);
      setSelectedJob(detail);
    } catch (err) {
      showToast(err.message || 'Không thể tải chi tiết Job', true);
    } finally {
      setIsLoadingJobDetail(false);
    }
  };

  const openCreateMaintModal = () => {
    setEditingMaint(null);
    setMaintForm({
      title: '',
      maintenance_type: 'preventive',
      component: 'lidar',
      priority: 'Normal',
      status: 'Scheduled',
      scheduled_date: toDatetimeLocalInput(null),
      interval_days: 30,
      assigned_technician: '',
      notes: '',
    });
    setIsMaintModalOpen(true);
  };

  const openEditMaintModal = (item) => {
    setEditingMaint(item);
    setMaintForm({
      title: item.title || '',
      maintenance_type: item.maintenance_type || 'preventive',
      component: item.component || 'general',
      priority: item.priority || 'Normal',
      status: item.status || 'Scheduled',
      scheduled_date: toDatetimeLocalInput(item.scheduled_date),
      interval_days: item.interval_days || '',
      assigned_technician: item.assigned_technician || '',
      notes: item.notes || '',
    });
    setIsMaintModalOpen(true);
  };

  const handleSaveMaintenance = async (e) => {
    e.preventDefault();
    if (!maintForm.title.trim()) {
      showToast(isEN ? 'Please enter maintenance title.' : 'Vui lòng nhập tiêu đề lịch bảo trì.', true);
      return;
    }
    setIsSavingMaint(true);
    try {
      const payload = {
        robot_id: 'RC-001',
        title: maintForm.title.trim(),
        maintenance_type: maintForm.maintenance_type,
        component: maintForm.component,
        priority: maintForm.priority,
        status: maintForm.status,
        scheduled_date: new Date(maintForm.scheduled_date).toISOString(),
        interval_days: maintForm.interval_days ? Number(maintForm.interval_days) : null,
        assigned_technician: maintForm.assigned_technician.trim() || null,
        notes: maintForm.notes.trim() || null,
      };

      if (editingMaint) {
        await updateRobotMaintenance(editingMaint.id, payload);
        showToast(isEN ? 'Maintenance schedule updated.' : 'Đã cập nhật lịch bảo trì.');
      } else {
        await createRobotMaintenance(payload);
        showToast(isEN ? 'Maintenance schedule created.' : 'Đã tạo lịch bảo trì mới.');
      }
      setIsMaintModalOpen(false);
      await Promise.all([loadMaintenance(), loadProfile()]);
    } catch (err) {
      showToast(err.message || 'Lỗi lưu lịch bảo trì', true);
    } finally {
      setIsSavingMaint(false);
    }
  };

  const handleQuickMaintStatus = async (item, nextStatus) => {
    try {
      await updateRobotMaintenance(item.id, { status: nextStatus, auto_schedule_next: true });
      showToast(
        nextStatus === 'Completed'
          ? (isEN ? 'Marked completed (next cycle scheduled if recurring).' : 'Đã hoàn thành bảo trì (tự tạo kỳ tiếp theo nếu định kỳ).')
          : (isEN ? `Updated to ${nextStatus}.` : `Đã chuyển sang trạng thái ${nextStatus}.`)
      );
      await Promise.all([loadMaintenance(), loadProfile()]);
    } catch (err) {
      showToast(err.message || 'Lỗi cập nhật trạng thái bảo trì', true);
    }
  };

  const handleDeleteMaint = async (item) => {
    if (!window.confirm(isEN ? `Delete maintenance "${item.title}"?` : `Xóa lịch bảo trì "${item.title}"?`)) return;
    try {
      await deleteRobotMaintenance(item.id);
      showToast(isEN ? 'Maintenance schedule deleted.' : 'Đã xóa lịch bảo trì.');
      await Promise.all([loadMaintenance(), loadProfile()]);
    } catch (err) {
      showToast(err.message || 'Lỗi xóa lịch bảo trì', true);
    }
  };

  const getComponentLabel = (val) => {
    const found = COMPONENT_OPTIONS.find((c) => c.value === val);
    return found ? (isEN ? found.en : found.vi) : val;
  };

  const getMaintTypeLabel = (val) => {
    const found = MAINTENANCE_TYPE_OPTIONS.find((t) => t.value === val);
    return found ? (isEN ? found.en : found.vi) : val;
  };

  const liveBattery = typeof piBattery?.percent === 'number' ? Math.round(piBattery.percent) : (profile?.battery_level ?? 100);

  return (
    <div className="w-full h-full flex flex-col overflow-hidden" style={{ backgroundColor: '#F2EFE9', color: '#262626' }}>
      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-xl border text-xs font-bold shadow-2xl flex items-center gap-2"
          style={{
            backgroundColor: toast.isError ? '#991B1B' : '#262626',
            color: '#F2EFE9',
            borderColor: '#BFBFBD',
          }}
        >
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Header */}
      <div
        className="h-16 px-5 border-b flex items-center justify-between gap-3 shrink-0"
        style={{ borderColor: '#BFBFBD', backgroundColor: '#F2EFE9' }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-9 h-9 rounded-xl border flex items-center justify-center shrink-0"
            style={{ backgroundColor: '#E9E5DC', borderColor: '#BFBFBD' }}
          >
            <Bot className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold tracking-tight truncate">
                {profile?.id || 'RC-001'}
                {profile?.code && profile.code !== profile.id ? ` (${profile.code})` : ''} — {profile?.name || 'Aurora Concierge Unit 01'}
              </h2>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 ${
                  profile?.is_online ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-stone-100 text-stone-600 border-stone-300'
                }`}
              >
                {profile?.is_online ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                {profile?.is_online ? 'Online' : 'Offline'}
              </span>
            </div>
            <p className="text-[11px] truncate" style={{ color: '#8C8C8C' }}>
              {isEN
                ? 'Single-robot profile, live operating status, real job history & maintenance schedule'
                : 'Quản lý hồ sơ RC-001, trạng thái vận hành, lịch sử Job thực tế và lịch bảo trì định kỳ'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Sub-view Switcher */}
          <div className="hidden md:flex items-center p-0.5 rounded-xl border" style={{ backgroundColor: '#E9E5DC', borderColor: '#BFBFBD' }}>
            {[
              { id: 'profile', label: isEN ? 'Profile & Status' : 'Hồ sơ & Trạng thái', icon: Cpu },
              { id: 'history', label: isEN ? 'Job History' : 'Lịch sử Job', icon: History },
              { id: 'maintenance', label: isEN ? 'Maintenance' : 'Lịch bảo trì', icon: Wrench },
            ].map((tab) => {
              const Icon = tab.icon;
              const isAct = activeView === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleSelectView(tab.id)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all"
                  style={{
                    backgroundColor: isAct ? '#262626' : 'transparent',
                    color: isAct ? '#FFFFFF' : '#525252',
                  }}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={loadAll}
            disabled={isLoading}
            className="px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer hover:bg-[#E9E5DC] flex items-center gap-1.5"
            style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD' }}
          >
            <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isEN ? 'Refresh' : 'Làm mới'}</span>
          </button>
        </div>
      </div>

      {/* Mobile Sub-view Switcher */}
      <div className="md:hidden px-4 py-2 border-b flex gap-1.5" style={{ borderColor: '#BFBFBD', backgroundColor: '#E9E5DC' }}>
        {[
          { id: 'profile', label: isEN ? 'Profile' : 'Hồ sơ' },
          { id: 'history', label: isEN ? 'Jobs' : 'Lịch sử Job' },
          { id: 'maintenance', label: isEN ? 'Maintenance' : 'Bảo trì' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => handleSelectView(tab.id)}
            className="flex-1 py-1.5 rounded-lg text-xs font-bold cursor-pointer"
            style={{
              backgroundColor: activeView === tab.id ? '#262626' : '#FFFFFF',
              color: activeView === tab.id ? '#FFFFFF' : '#262626',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4">
        {/* KPI Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl border bg-white" style={{ borderColor: '#BFBFBD' }}>
            <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#8C8C8C' }}>
              {isEN ? 'Operating Status' : 'Trạng thái vận hành'}
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-base font-black">{profile?.status || 'IDLE'}</span>
              <MapPin className="w-4 h-4 text-stone-500" />
            </div>
            <div className="text-[11px] mt-0.5 truncate" style={{ color: '#8C8C8C' }}>
              {profile?.current_location || 'Main Lobby'}
            </div>
          </div>

          <div className="p-3.5 rounded-xl border bg-white" style={{ borderColor: '#BFBFBD' }}>
            <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#8C8C8C' }}>
              {isEN ? 'Battery Level' : 'Mức Pin Hiện Tại'}
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className={`text-base font-black ${liveBattery < 20 ? 'text-red-600' : ''}`}>
                {liveBattery}%
              </span>
              <BatteryCharging className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-[11px] mt-0.5 truncate" style={{ color: '#8C8C8C' }}>
              {piBattery ? (isEN ? 'Live Pi 5 telemetry' : 'Đọc trực tiếp từ Pi 5') : (isEN ? 'Saved DB telemetry' : 'Lưu trong CSDL')}
            </div>
          </div>

          <div className="p-3.5 rounded-xl border bg-white" style={{ borderColor: '#BFBFBD' }}>
            <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#8C8C8C' }}>
              {isEN ? 'Executed Jobs' : 'Tổng Job Đã Chạy'}
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-base font-black">{jobsData.total}</span>
              <History className="w-4 h-4 text-stone-500" />
            </div>
            <div className="text-[11px] mt-0.5" style={{ color: '#8C8C8C' }}>
              {isEN ? `Completed: ${jobsData.completed}` : `Hoàn thành: ${jobsData.completed}`}
            </div>
          </div>

          <div className="p-3.5 rounded-xl border bg-white" style={{ borderColor: '#BFBFBD' }}>
            <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#8C8C8C' }}>
              {isEN ? 'Maintenance Queue' : 'Lịch Bảo Trì'}
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className={`text-base font-black ${maintData.overdue > 0 ? 'text-red-600' : ''}`}>
                {maintData.scheduled + maintData.in_progress + maintData.overdue}
              </span>
              <Wrench className="w-4 h-4 text-stone-500" />
            </div>
            <div className="text-[11px] mt-0.5" style={{ color: maintData.overdue > 0 ? '#DC2626' : '#8C8C8C' }}>
              {maintData.overdue > 0
                ? (isEN ? `${maintData.overdue} overdue!` : `${maintData.overdue} lịch quá hạn!`)
                : (isEN ? `${maintData.completed} completed` : `Đã hoàn thành: ${maintData.completed}`)}
            </div>
          </div>
        </div>

        {/* ============================================================
            VIEW 1: ROBOT PROFILE & OPERATING STATUS
           ============================================================ */}
        {activeView === 'profile' && (
          <form
            onSubmit={handleSaveProfile}
            className="rounded-xl border bg-white p-5 space-y-4"
            style={{ borderColor: '#BFBFBD' }}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b" style={{ borderColor: '#E9E5DC' }}>
              <div>
                <h3 className="text-sm font-bold">
                  {isEN ? 'RC-001 Profile & Hardware Configuration' : 'Thông tin Hồ sơ & Trạng thái Robot RC-001'}
                </h3>
                <p className="text-[11px]" style={{ color: '#8C8C8C' }}>
                  {isEN ? `Last heartbeat: ${formatDateTime(profile?.last_heartbeat)}` : `Cập nhật cuối: ${formatDateTime(profile?.last_heartbeat)}`}
                  {profile?.hardware_status ? ` · LiDAR: ${profile.hardware_status}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickAction('dock', 'CHARGING', 'Trạm Sạc Robot Sảnh')}
                  className="px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer hover:bg-[#E9E5DC]"
                  style={{ backgroundColor: '#F2EFE9', borderColor: '#BFBFBD' }}
                >
                  {isEN ? 'Send to Dock / Charging' : 'Về trạm sạc'}
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickAction('stop', 'IDLE', null)}
                  className="px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer bg-stone-900 text-white hover:bg-black"
                  style={{ borderColor: '#262626' }}
                >
                  {isEN ? 'Emergency Stop -> IDLE' : 'Dừng & Đặt IDLE'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block text-[10px] font-bold uppercase mb-1" style={{ color: '#8C8C8C' }}>
                  {isEN ? 'Robot ID / Code' : 'Mã định danh Robot'}
                </label>
                <input
                  type="text"
                  value={profile?.code && profile.code !== profile.id ? `${profile.id} (${profile.code})` : (profile?.id || 'RC-001')}
                  disabled
                  className="w-full px-3 py-2 rounded-lg border font-mono font-bold bg-[#F2EFE9]"
                  style={{ borderColor: '#BFBFBD', color: '#525252' }}
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase mb-1" style={{ color: '#8C8C8C' }}>
                  {isEN ? 'Display Name' : 'Tên hiển thị'}
                </label>
                <input
                  type="text"
                  value={profileForm.name}
                  onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border font-semibold"
                  style={{ borderColor: '#BFBFBD' }}
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase mb-1" style={{ color: '#8C8C8C' }}>
                  {isEN ? 'Model Type' : 'Dòng thiết bị / Model'}
                </label>
                <input
                  type="text"
                  value={profileForm.model_type}
                  onChange={(e) => setProfileForm({ ...profileForm, model_type: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border"
                  style={{ borderColor: '#BFBFBD' }}
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase mb-1" style={{ color: '#8C8C8C' }}>
                  {isEN ? 'Serial Number' : 'Số Serial'}
                </label>
                <input
                  type="text"
                  value={profileForm.serial_number}
                  onChange={(e) => setProfileForm({ ...profileForm, serial_number: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border font-mono"
                  style={{ borderColor: '#BFBFBD' }}
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase mb-1" style={{ color: '#8C8C8C' }}>
                  {isEN ? 'Firmware Version' : 'Phiên bản Firmware'}
                </label>
                <input
                  type="text"
                  value={profileForm.firmware_version}
                  onChange={(e) => setProfileForm({ ...profileForm, firmware_version: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border font-mono"
                  style={{ borderColor: '#BFBFBD' }}
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase mb-1" style={{ color: '#8C8C8C' }}>
                  {isEN ? 'Raspberry Pi 5 IP' : 'Địa chỉ IP Pi 5'}
                </label>
                <input
                  type="text"
                  value={profileForm.ip_address}
                  onChange={(e) => setProfileForm({ ...profileForm, ip_address: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border font-mono"
                  style={{ borderColor: '#BFBFBD' }}
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase mb-1" style={{ color: '#8C8C8C' }}>
                  {isEN ? 'Operating Status' : 'Trạng thái vận hành'}
                </label>
                <select
                  value={profileForm.status}
                  onChange={(e) => setProfileForm({ ...profileForm, status: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border font-bold bg-white"
                  style={{ borderColor: '#BFBFBD' }}
                >
                  {ROBOT_STATUS_OPTIONS.map((st) => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase mb-1" style={{ color: '#8C8C8C' }}>
                  {isEN ? 'Current Location' : 'Vị trí hiện tại'}
                </label>
                <input
                  type="text"
                  value={profileForm.current_location}
                  onChange={(e) => setProfileForm({ ...profileForm, current_location: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border"
                  style={{ borderColor: '#BFBFBD' }}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold uppercase mb-1" style={{ color: '#8C8C8C' }}>
                    {isEN ? 'Battery (%)' : 'Pin (%)'}
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={profileForm.battery_level}
                    onChange={(e) => setProfileForm({ ...profileForm, battery_level: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border font-bold"
                    style={{ borderColor: '#BFBFBD' }}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase mb-1" style={{ color: '#8C8C8C' }}>
                    {isEN ? 'Connection' : 'Kết nối'}
                  </label>
                  <button
                    type="button"
                    onClick={() => setProfileForm({ ...profileForm, is_online: !profileForm.is_online })}
                    className={`w-full px-3 py-2 rounded-lg border font-bold cursor-pointer ${
                      profileForm.is_online ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-stone-100 text-stone-600 border-stone-300'
                    }`}
                  >
                    {profileForm.is_online ? 'Online' : 'Offline'}
                  </button>
                </div>
              </div>
            </div>

            <div className="text-xs">
              <label className="block text-[10px] font-bold uppercase mb-1" style={{ color: '#8C8C8C' }}>
                {isEN ? 'Technical Notes' : 'Ghi chú kỹ thuật & Vận hành'}
              </label>
              <textarea
                rows={3}
                value={profileForm.notes}
                onChange={(e) => setProfileForm({ ...profileForm, notes: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border"
                style={{ borderColor: '#BFBFBD' }}
                placeholder={isEN ? 'Hardware notes, calibration details...' : 'Thông số phần cứng, ghi chú vận hành...'}
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isSavingProfile}
                className="px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 cursor-pointer text-white bg-[#262626] hover:bg-black disabled:opacity-60"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSavingProfile ? (isEN ? 'Saving...' : 'Đang lưu...') : (isEN ? 'Save Profile & Status' : 'Lưu Hồ sơ & Trạng thái')}</span>
              </button>
            </div>
          </form>
        )}

        {/* ============================================================
            VIEW 2: REAL ROBOT JOB EXECUTION HISTORY
           ============================================================ */}
        {activeView === 'history' && (
          <div className="rounded-xl border bg-white p-5 space-y-4" style={{ borderColor: '#BFBFBD' }}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold">
                  {isEN ? 'Real Job Execution History (RC-001)' : 'Lịch sử Job Chạy Thực Tế của Robot RC-001'}
                </h3>
                <p className="text-[11px]" style={{ color: '#8C8C8C' }}>
                  {isEN
                    ? 'Automatically recorded whenever workflows or missions are dispatched to RC-001.'
                    : 'Tự động ghi nhận mỗi lần phát lệnh quy trình (Workflow) hoặc nhiệm vụ tới RC-001.'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <select
                  value={jobStatusFilter}
                  onChange={(e) => setJobStatusFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border bg-white font-semibold"
                  style={{ borderColor: '#BFBFBD' }}
                >
                  <option value="ALL">{isEN ? 'All Statuses' : 'Tất cả trạng thái'}</option>
                  <option value="COMPLETED">COMPLETED</option>
                  <option value="RUNNING">RUNNING</option>
                  <option value="PENDING">PENDING</option>
                  <option value="FAILED">FAILED</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>
                <select
                  value={jobTriggerFilter}
                  onChange={(e) => setJobTriggerFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border bg-white font-semibold"
                  style={{ borderColor: '#BFBFBD' }}
                >
                  <option value="ALL">{isEN ? 'All Triggers' : 'Tất cả nguồn'}</option>
                  <option value="MANUAL">MANUAL</option>
                  <option value="AUTO_DETECT">AUTO_DETECT</option>
                  <option value="SCHEDULE">SCHEDULE</option>
                  <option value="VOICE">VOICE</option>
                  <option value="GUEST_TAP">GUEST_TAP</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="text-[10px] font-bold uppercase border-b" style={{ borderColor: '#E9E5DC', color: '#8C8C8C' }}>
                    <th className="py-2.5 px-2">Job Code</th>
                    <th className="py-2.5 px-2">{isEN ? 'Workflow / Task' : 'Nhiệm vụ / Kịch bản'}</th>
                    <th className="py-2.5 px-2">{isEN ? 'Trigger' : 'Nguồn'}</th>
                    <th className="py-2.5 px-2">{isEN ? 'Steps' : 'Bước'}</th>
                    <th className="py-2.5 px-2">{isEN ? 'Status' : 'Trạng thái'}</th>
                    <th className="py-2.5 px-2">{isEN ? 'Started' : 'Thời gian'}</th>
                    <th className="py-2.5 px-2 text-right">{isEN ? 'Details' : 'Chi tiết'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: '#E9E5DC' }}>
                  {jobsData.items.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-xs" style={{ color: '#8C8C8C' }}>
                        {isEN ? 'No job execution records yet. Dispatch a workflow to record one.' : 'Chưa có bản ghi Job nào. Hãy phát lệnh một kịch bản ở mục Quản lý Quy trình.'}
                      </td>
                    </tr>
                  ) : (
                    jobsData.items.map((job) => (
                      <tr key={job.id} className="hover:bg-[#F2EFE9]/60">
                        <td className="py-2.5 px-2 font-mono font-bold whitespace-nowrap">{job.job_code}</td>
                        <td className="py-2.5 px-2 font-medium max-w-[260px] truncate">{job.title}</td>
                        <td className="py-2.5 px-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono border bg-[#F2EFE9]" style={{ borderColor: '#BFBFBD' }}>
                            {job.trigger_type}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 font-mono">
                          {job.current_step_index}/{job.total_steps}
                        </td>
                        <td className="py-2.5 px-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                              job.status === 'COMPLETED'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : job.status === 'FAILED'
                                ? 'bg-red-50 text-red-700 border-red-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}
                          >
                            {job.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-[11px] whitespace-nowrap" style={{ color: '#8C8C8C' }}>
                          {formatDateTime(job.started_at || job.created_at)}
                        </td>
                        <td className="py-2.5 px-2 text-right">
                          <button
                            type="button"
                            onClick={() => handleViewJobDetail(job.id)}
                            disabled={isLoadingJobDetail}
                            className="px-2.5 py-1 rounded-lg border text-[11px] font-semibold cursor-pointer hover:bg-[#E9E5DC] inline-flex items-center gap-1"
                            style={{ borderColor: '#BFBFBD' }}
                          >
                            <Eye className="w-3 h-3" />
                            <span>{isEN ? 'View' : 'Xem'}</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ============================================================
            VIEW 3: ROBOT MAINTENANCE SCHEDULES
           ============================================================ */}
        {activeView === 'maintenance' && (
          <div className="rounded-xl border bg-white p-5 space-y-4" style={{ borderColor: '#BFBFBD' }}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold">
                  {isEN ? 'Robot Hardware & Software Maintenance Schedule' : 'Lịch Bảo Trì & Kiểm Tra Định Kỳ RC-001'}
                </h3>
                <p className="text-[11px]" style={{ color: '#8C8C8C' }}>
                  {isEN
                    ? 'Track preventive checks, calibration & repairs; recurring items auto-schedule upon completion.'
                    : 'Theo dõi lịch kiểm tra LiDAR, hiệu chỉnh pin, cơ khí; tự động lên lịch kỳ tiếp theo khi hoàn tất.'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <select
                  value={maintStatusFilter}
                  onChange={(e) => setMaintStatusFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border bg-white font-semibold"
                  style={{ borderColor: '#BFBFBD' }}
                >
                  <option value="all">{isEN ? 'All Statuses' : 'Tất cả trạng thái'}</option>
                  <option value="Scheduled">Scheduled</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Overdue">Overdue</option>
                  <option value="Completed">Completed</option>
                </select>
                <select
                  value={maintComponentFilter}
                  onChange={(e) => setMaintComponentFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border bg-white font-semibold"
                  style={{ borderColor: '#BFBFBD' }}
                >
                  <option value="all">{isEN ? 'All Components' : 'Tất cả bộ phận'}</option>
                  {COMPONENT_OPTIONS.map((c) => (
                    <option key={c.value} value={c.value}>{isEN ? c.en : c.vi}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={openCreateMaintModal}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#262626] text-white hover:bg-black cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isEN ? 'Schedule Maintenance' : 'Thêm lịch bảo trì'}</span>
                </button>
              </div>
            </div>

            <div className="space-y-2.5">
              {maintData.items.length === 0 ? (
                <div className="py-10 text-center text-xs rounded-xl border border-dashed" style={{ borderColor: '#BFBFBD', color: '#8C8C8C' }}>
                  {isEN ? 'No maintenance schedules found.' : 'Chưa có lịch bảo trì nào khớp bộ lọc.'}
                </div>
              ) : (
                maintData.items.map((item) => {
                  const isOverdue = item.status === 'Overdue';
                  const isCompleted = item.status === 'Completed';
                  return (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-xl border flex flex-col lg:flex-row lg:items-center justify-between gap-3"
                      style={{
                        borderColor: isOverdue ? '#FCA5A5' : '#BFBFBD',
                        backgroundColor: isOverdue ? '#FEF2F2' : '#FFFFFF',
                      }}
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                              isCompleted
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : isOverdue
                                ? 'bg-red-100 text-red-700 border-red-300'
                                : item.status === 'In Progress'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-[#F2EFE9] text-[#262626] border-[#BFBFBD]'
                            }`}
                          >
                            {isOverdue && <AlertTriangle className="w-3 h-3 inline mr-1" />}
                            {item.status}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold border bg-[#E9E5DC]" style={{ borderColor: '#BFBFBD' }}>
                            {getComponentLabel(item.component)}
                          </span>
                          <span className="text-[10px] font-mono" style={{ color: '#8C8C8C' }}>
                            {getMaintTypeLabel(item.maintenance_type)} · {item.priority}
                          </span>
                          {item.interval_days && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-stone-100 border border-stone-200">
                              {isEN ? `Every ${item.interval_days}d` : `Chu kỳ ${item.interval_days} ngày`}
                            </span>
                          )}
                        </div>
                        <div className="text-xs font-bold">{item.title}</div>
                        {item.notes && (
                          <div className="text-[11px]" style={{ color: '#525252' }}>{item.notes}</div>
                        )}
                        <div className="flex flex-wrap items-center gap-3 text-[11px]" style={{ color: '#8C8C8C' }}>
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {isEN ? 'Scheduled:' : 'Dự kiến:'} {formatDateTime(item.scheduled_date)}
                          </span>
                          {item.completed_date && (
                            <span>{isEN ? 'Completed:' : 'Hoàn thành:'} {formatDateTime(item.completed_date)}</span>
                          )}
                          {item.assigned_technician && (
                            <span>{isEN ? 'Tech:' : 'Phụ trách:'} {item.assigned_technician}</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {!isCompleted && item.status !== 'In Progress' && (
                          <button
                            type="button"
                            onClick={() => handleQuickMaintStatus(item, 'In Progress')}
                            className="px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold cursor-pointer hover:bg-[#E9E5DC] inline-flex items-center gap-1"
                            style={{ borderColor: '#BFBFBD', backgroundColor: '#FFFFFF' }}
                          >
                            <Play className="w-3 h-3" />
                            <span>{isEN ? 'Start' : 'Bắt đầu'}</span>
                          </button>
                        )}
                        {!isCompleted && (
                          <button
                            type="button"
                            onClick={() => handleQuickMaintStatus(item, 'Completed')}
                            className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer bg-[#262626] text-white hover:bg-black inline-flex items-center gap-1"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            <span>{isEN ? 'Complete' : 'Hoàn thành'}</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openEditMaintModal(item)}
                          className="p-1.5 rounded-lg border cursor-pointer hover:bg-[#E9E5DC]"
                          style={{ borderColor: '#BFBFBD', backgroundColor: '#FFFFFF' }}
                          title={isEN ? 'Edit' : 'Sửa'}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteMaint(item)}
                          className="p-1.5 rounded-lg border cursor-pointer hover:bg-red-50 hover:text-red-700"
                          style={{ borderColor: '#BFBFBD', backgroundColor: '#FFFFFF', color: '#8C8C8C' }}
                          title={isEN ? 'Delete' : 'Xóa'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Job Detail Modal */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden" style={{ borderColor: '#BFBFBD' }}>
            <div className="px-5 py-3.5 border-b flex items-center justify-between" style={{ backgroundColor: '#F2EFE9', borderColor: '#BFBFBD' }}>
              <div>
                <div className="text-xs font-mono font-bold" style={{ color: '#8C8C8C' }}>{selectedJob.job_code}</div>
                <h4 className="text-sm font-bold">{selectedJob.title}</h4>
              </div>
              <button type="button" onClick={() => setSelectedJob(null)} className="p-1.5 rounded-lg hover:bg-black/5 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              <div>
                <h5 className="text-[11px] font-bold uppercase mb-2" style={{ color: '#8C8C8C' }}>
                  {isEN ? 'Executed Steps' : 'Các bước đã thực thi'} ({selectedJob.job_steps?.length || 0})
                </h5>
                <div className="space-y-1.5">
                  {(selectedJob.job_steps || []).map((st) => (
                    <div key={st.id} className="px-3 py-2 rounded-lg border flex items-center justify-between" style={{ borderColor: '#E9E5DC' }}>
                      <span className="font-mono font-bold">#{st.step_index + 1} · {st.step_type}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">{st.status}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h5 className="text-[11px] font-bold uppercase mb-2" style={{ color: '#8C8C8C' }}>
                  {isEN ? 'Execution Events' : 'Nhật ký sự kiện Job'} ({selectedJob.job_events?.length || 0})
                </h5>
                <div className="space-y-1.5">
                  {(selectedJob.job_events || []).map((ev) => (
                    <div key={ev.id} className="px-3 py-2 rounded-lg border bg-[#F2EFE9]/50" style={{ borderColor: '#E9E5DC' }}>
                      <div className="flex items-center justify-between text-[10px] font-mono" style={{ color: '#8C8C8C' }}>
                        <span>{ev.event_type} ({ev.severity})</span>
                        <span>{formatDateTime(ev.created_at)}</span>
                      </div>
                      <div className="mt-0.5 font-medium">{ev.message}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Maintenance Create/Edit Modal */}
      {isMaintModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveMaintenance}
            className="bg-white rounded-2xl border w-full max-w-lg overflow-hidden"
            style={{ borderColor: '#BFBFBD' }}
          >
            <div className="px-5 py-3.5 border-b flex items-center justify-between" style={{ backgroundColor: '#F2EFE9', borderColor: '#BFBFBD' }}>
              <h4 className="text-sm font-bold">
                {editingMaint
                  ? (isEN ? 'Edit Robot Maintenance Schedule' : 'Cập nhật Lịch Bảo Trì RC-001')
                  : (isEN ? 'New Robot Maintenance Schedule' : 'Tạo Lịch Bảo Trì RC-001')}
              </h4>
              <button type="button" onClick={() => setIsMaintModalOpen(false)} className="p-1.5 rounded-lg hover:bg-black/5 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold uppercase mb-1" style={{ color: '#8C8C8C' }}>
                  {isEN ? 'Title' : 'Nội dung / Tiêu đề'} *
                </label>
                <input
                  type="text"
                  value={maintForm.title}
                  onChange={(e) => setMaintForm({ ...maintForm, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border font-semibold"
                  style={{ borderColor: '#BFBFBD' }}
                  placeholder={isEN ? 'e.g. Clean RPLIDAR optical window' : 'VD: Vệ sinh cảm biến RPLIDAR A1'}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase mb-1" style={{ color: '#8C8C8C' }}>
                    {isEN ? 'Component' : 'Bộ phận'}
                  </label>
                  <select
                    value={maintForm.component}
                    onChange={(e) => setMaintForm({ ...maintForm, component: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border bg-white"
                    style={{ borderColor: '#BFBFBD' }}
                  >
                    {COMPONENT_OPTIONS.map((c) => (
                      <option key={c.value} value={c.value}>{isEN ? c.en : c.vi}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase mb-1" style={{ color: '#8C8C8C' }}>
                    {isEN ? 'Maintenance Type' : 'Loại bảo trì'}
                  </label>
                  <select
                    value={maintForm.maintenance_type}
                    onChange={(e) => setMaintForm({ ...maintForm, maintenance_type: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border bg-white"
                    style={{ borderColor: '#BFBFBD' }}
                  >
                    {MAINTENANCE_TYPE_OPTIONS.map((m) => (
                      <option key={m.value} value={m.value}>{isEN ? m.en : m.vi}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase mb-1" style={{ color: '#8C8C8C' }}>
                    {isEN ? 'Scheduled Date' : 'Ngày giờ dự kiến'} *
                  </label>
                  <input
                    type="datetime-local"
                    value={maintForm.scheduled_date}
                    onChange={(e) => setMaintForm({ ...maintForm, scheduled_date: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border"
                    style={{ borderColor: '#BFBFBD' }}
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase mb-1" style={{ color: '#8C8C8C' }}>
                    {isEN ? 'Repeat Interval (days)' : 'Chu kỳ lặp (ngày)'}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={3650}
                    value={maintForm.interval_days}
                    onChange={(e) => setMaintForm({ ...maintForm, interval_days: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border"
                    style={{ borderColor: '#BFBFBD' }}
                    placeholder="30"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase mb-1" style={{ color: '#8C8C8C' }}>
                    {isEN ? 'Priority' : 'Độ ưu tiên'}
                  </label>
                  <select
                    value={maintForm.priority}
                    onChange={(e) => setMaintForm({ ...maintForm, priority: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border bg-white"
                    style={{ borderColor: '#BFBFBD' }}
                  >
                    <option value="Low">Low</option>
                    <option value="Normal">Normal</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase mb-1" style={{ color: '#8C8C8C' }}>
                    {isEN ? 'Status' : 'Trạng thái'}
                  </label>
                  <select
                    value={maintForm.status}
                    onChange={(e) => setMaintForm({ ...maintForm, status: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border bg-white"
                    style={{ borderColor: '#BFBFBD' }}
                  >
                    <option value="Scheduled">Scheduled</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase mb-1" style={{ color: '#8C8C8C' }}>
                    {isEN ? 'Technician' : 'Kỹ thuật viên'}
                  </label>
                  <input
                    type="text"
                    value={maintForm.assigned_technician}
                    onChange={(e) => setMaintForm({ ...maintForm, assigned_technician: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border"
                    style={{ borderColor: '#BFBFBD' }}
                    placeholder={isEN ? 'Optional' : 'Tùy chọn'}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase mb-1" style={{ color: '#8C8C8C' }}>
                  {isEN ? 'Notes' : 'Ghi chú kiểm tra'}
                </label>
                <textarea
                  rows={2}
                  value={maintForm.notes}
                  onChange={(e) => setMaintForm({ ...maintForm, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border"
                  style={{ borderColor: '#BFBFBD' }}
                />
              </div>
            </div>
            <div className="px-5 py-3 border-t flex justify-end gap-2" style={{ backgroundColor: '#F2EFE9', borderColor: '#BFBFBD' }}>
              <button
                type="button"
                onClick={() => setIsMaintModalOpen(false)}
                className="px-3.5 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer bg-white"
                style={{ borderColor: '#BFBFBD' }}
              >
                {isEN ? 'Cancel' : 'Hủy'}
              </button>
              <button
                type="submit"
                disabled={isSavingMaint}
                className="px-4 py-1.5 rounded-lg text-xs font-bold cursor-pointer text-white bg-[#262626] hover:bg-black disabled:opacity-60"
              >
                {isSavingMaint ? (isEN ? 'Saving...' : 'Đang lưu...') : (isEN ? 'Save' : 'Lưu')}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

