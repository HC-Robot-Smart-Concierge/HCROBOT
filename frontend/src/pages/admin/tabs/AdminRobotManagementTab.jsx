import React, { useState, useEffect, useCallback } from 'react';
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
import {
  PI5_API,
  COMPONENT_OPTIONS,
  MAINTENANCE_TYPE_OPTIONS,
  mapSubTabToView,
  mapViewToSubTab,
  formatDateTime,
  toDatetimeLocalInput,
} from './adminRobotManagementUtils';
import { AdminRobotProfileAndKpis } from './AdminRobotProfileAndKpis';
import { AdminRobotJobsAndMaintenanceView } from './AdminRobotJobsAndMaintenanceView';
import {
  AdminRobotManagementHeader,
  AdminRobotManagementModals,
} from './AdminRobotManagementModals';

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
    <div className="w-full h-full flex flex-col overflow-hidden" style={{ backgroundColor: '#F2EFE9', color: '#262626' }}>      <AdminRobotManagementHeader
        toast={toast}
        profile={profile}
        piBattery={piBattery}
        activeView={activeView}
        handleSelectView={handleSelectView}
        loadAll={loadAll}
        isLoading={isLoading}
        isEN={isEN}
      />
      {/* Main Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4">
        <AdminRobotProfileAndKpis
          isEN={isEN}
          profile={profile}
          liveBattery={liveBattery}
          piBattery={piBattery}
          jobsData={jobsData}
          maintData={maintData}
          activeView={activeView}
          handleSaveProfile={handleSaveProfile}
          profileForm={profileForm}
          setProfileForm={setProfileForm}
          isSavingProfile={isSavingProfile}
          handleQuickAction={handleQuickAction}
          formatDateTime={formatDateTime}
        />

        <AdminRobotJobsAndMaintenanceView
          activeView={activeView}
          isEN={isEN}
          jobStatusFilter={jobStatusFilter}
          setJobStatusFilter={setJobStatusFilter}
          jobTriggerFilter={jobTriggerFilter}
          setJobTriggerFilter={setJobTriggerFilter}
          jobsData={jobsData}
          formatDateTime={formatDateTime}
          isLoadingJobDetail={isLoadingJobDetail}
          handleViewJobDetail={handleViewJobDetail}
          maintStatusFilter={maintStatusFilter}
          setMaintStatusFilter={setMaintStatusFilter}
          maintComponentFilter={maintComponentFilter}
          setMaintComponentFilter={setMaintComponentFilter}
          maintData={maintData}
          openCreateMaintModal={openCreateMaintModal}
          openEditMaintModal={openEditMaintModal}
          getComponentLabel={getComponentLabel}
          getMaintTypeLabel={getMaintTypeLabel}
          handleQuickMaintStatus={handleQuickMaintStatus}
          handleDeleteMaint={handleDeleteMaint}
        />
      </div>

      <AdminRobotManagementModals
        isEN={isEN}
        selectedJob={selectedJob}
        setSelectedJob={setSelectedJob}
        formatDateTime={formatDateTime}
        isMaintModalOpen={isMaintModalOpen}
        setIsMaintModalOpen={setIsMaintModalOpen}
        editingMaint={editingMaint}
        handleSaveMaintenance={handleSaveMaintenance}
        maintForm={maintForm}
        setMaintForm={setMaintForm}
        isSavingMaint={isSavingMaint}
      />
    </div>
  );
};
