import React from 'react';
import { Bot, Cpu, History, Wrench, Save, RotateCw, X, Wifi, WifiOff } from 'lucide-react';
import { COMPONENT_OPTIONS, MAINTENANCE_TYPE_OPTIONS } from './adminRobotManagementUtils';

export const AdminRobotManagementModals = ({
  isEN, selectedJob, setSelectedJob, formatDateTime, isMaintModalOpen, setIsMaintModalOpen, editingMaint, handleSaveMaintenance, maintForm, setMaintForm, isSavingMaint,
}) => (
  <>
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
  </>
);

export const AdminRobotManagementHeader = ({
  toast, profile, piBattery, activeView, handleSelectView, loadAll, isLoading, isEN,
}) => (
  <>
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

  </>
);
