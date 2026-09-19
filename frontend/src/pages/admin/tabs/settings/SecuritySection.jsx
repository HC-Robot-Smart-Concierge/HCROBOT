import React from 'react';
import { ChevronDown, LogOut } from 'lucide-react';

export const SecuritySection = ({ settings, setSettings, showToast }) => {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Card 1: Admin Access Control */}
      <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-stone-100 bg-stone-50/40">
          <h3 className="text-base font-extrabold text-stone-900">Admin Access Control</h3>
          <p className="text-xs text-stone-500 mt-0.5">
            Manage authentication and session policies for the dashboard.
          </p>
        </div>

        <div className="p-6 space-y-5 text-xs">
          {/* 2FA Toggle */}
          <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 flex items-center justify-between">
            <div className="space-y-0.5 pr-4">
              <p className="font-extrabold text-stone-900">
                Require Two-Factor Authentication (2FA) for all Admins
              </p>
              <p className="text-[11px] text-stone-500">
                Enforces an extra layer of security during login.
              </p>
            </div>

            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={settings.require2FA}
                onChange={(e) => setSettings({ ...settings, require2FA: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-stone-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          {/* Idle Session Timeout */}
          <div>
            <label className="block text-[11px] font-black text-stone-600 uppercase tracking-wider mb-1.5">
              IDLE SESSION TIMEOUT
            </label>
            <div className="relative">
              <select
                value={settings.idleTimeout}
                onChange={(e) => setSettings({ ...settings, idleTimeout: e.target.value })}
                className="w-full appearance-none px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer pr-10"
              >
                <option value="15 Minutes">15 Minutes</option>
                <option value="30 Minutes">30 Minutes</option>
                <option value="1 Hour">1 Hour</option>
                <option value="4 Hours">4 Hours</option>
                <option value="8 Hours">8 Hours</option>
              </select>
              <ChevronDown className="w-4 h-4 text-stone-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Reset All Sessions Button */}
          <div>
            <button
              type="button"
              onClick={() => showToast('Đã thu hồi và đăng xuất tất cả các phiên làm việc quản trị.')}
              className="px-4 py-2.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-all cursor-pointer flex items-center gap-2"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Reset All Active Sessions</span>
            </button>
          </div>
        </div>
      </div>

      {/* Card 2: Robot Security Policies */}
      <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-stone-100 bg-stone-50/40">
          <h3 className="text-base font-extrabold text-stone-900">Robot Security Policies</h3>
          <p className="text-xs text-stone-500 mt-0.5">
            Configure physical and digital security protocols for the robot fleet.
          </p>
        </div>

        <div className="p-6 space-y-4 text-xs">
          {/* Delivery Auth */}
          <div>
            <label className="block text-[11px] font-black text-stone-600 uppercase tracking-wider mb-1.5">
              GUEST AUTHENTICATION FOR DELIVERIES
            </label>
            <div className="relative">
              <select
                value={settings.guestAuthForDeliveries}
                onChange={(e) => setSettings({ ...settings, guestAuthForDeliveries: e.target.value })}
                className="w-full appearance-none px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer pr-10"
              >
                <option value="Room Number + PIN">Room Number + PIN (Số phòng + Mã PIN ngẫu nhiên)</option>
                <option value="NFC Keycard Tap">NFC Keycard Tap (Quẹt thẻ phòng lên Robot)</option>
                <option value="Facial Recognition">Facial Recognition (Nhận diện khuôn mặt khách VIP)</option>
                <option value="Direct Delivery - No Auth">Direct Delivery - No Auth (Giao trực tiếp khi đến cửa)</option>
              </select>
              <ChevronDown className="w-4 h-4 text-stone-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            <p className="text-[11px] text-stone-400 mt-1">
              Determines what the guest must input on the robot's screen to retrieve items.
            </p>
          </div>

          {/* Restricted Zones Toggle */}
          <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 flex items-center justify-between">
            <div className="space-y-0.5 pr-4">
              <p className="font-extrabold text-stone-900">
                Allow Navigation in Restricted Zones (Staff Only)
              </p>
              <p className="text-[11px] text-stone-500">
                Robots can enter kitchen areas and staff-only elevators.
              </p>
            </div>

            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={settings.allowRestrictedZones}
                onChange={(e) => setSettings({ ...settings, allowRestrictedZones: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-stone-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          {/* Auto-Lock Screen Toggle */}
          <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 flex items-center justify-between">
            <div className="space-y-0.5 pr-4">
              <p className="font-extrabold text-stone-900">
                Auto-Lock Screen after 10 seconds of inactivity
              </p>
              <p className="text-[11px] text-stone-500">
                Prevents unauthorized tampering if a guest walks away mid-interaction.
              </p>
            </div>

            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={settings.autoLockScreen}
                onChange={(e) => setSettings({ ...settings, autoLockScreen: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-stone-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};
