import React from 'react';
import { BatteryCharging, MapPin, History, Wrench, Save } from 'lucide-react';
import { ROBOT_STATUS_OPTIONS } from './adminRobotManagementUtils';

export const AdminRobotProfileAndKpis = ({
  isEN, profile, liveBattery, piBattery, jobsData, maintData, activeView, handleSaveProfile, profileForm, setProfileForm, isSavingProfile, handleQuickAction, formatDateTime,
}) => (
  <>
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
  </>
);
