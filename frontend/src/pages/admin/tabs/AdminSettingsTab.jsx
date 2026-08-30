import React, { useState, useEffect } from 'react';
import {
  Sliders,
  ShieldCheck,
  Bell,
  Network,
  Box,
  Save,
  RotateCcw,
  Building2,
  MapPin,
  Globe,
  Volume2,
  Volume1,
  Moon,
  Lock,
  Key,
  Smartphone,
  LogOut,
  ShieldAlert,
  AlertTriangle,
  Mail,
  MessageSquare,
  Radio,
  CheckCircle2,
  Cpu,
  DoorOpen,
  ArrowUpRight,
  Database,
  Eye,
  EyeOff,
  Sparkles,
  RefreshCw,
  Trash2,
  Download,
  Check,
  ChevronDown,
} from 'lucide-react';

const SETTINGS_STORAGE_KEY = 'aurora_admin_settings';

const DEFAULT_SETTINGS = {
  // 1. General
  hotelName: 'Aurora Grand Hotel',
  address: '123 Main St, Cityville',
  systemTimezone: 'UTC+07:00 Asia/Ho_Chi_Minh',
  defaultLanguage: 'English (US)',
  voiceVolume: 75,
  nightMode: 'Quiet Navigation Only',

  // 2. Security & Access
  require2FA: true,
  idleTimeout: '30 Minutes',
  guestAuthForDeliveries: 'Room Number + PIN',
  allowRestrictedZones: false,
  autoLockScreen: true,

  // 3. Notifications
  primaryAlertEmail: 'admin@grandplaza.com',
  criticalHardwareErrors: true,
  lowBatteryWarning: true,
  connectivityLoss: false,
  activeChannels: {
    inAppConsole: true,
    smsAlerts: true,
    emailDigest: false,
    walkieTalkie: true,
  },
  escalationTimeout: 'Alert Manager after 5 minutes of no response',

  // 4. Integrations (PMS)
  pmsProvider: 'Oracle OPERA Cloud',
  pmsApiUrl: 'https://api.operacloud.com/v1/hotel/grandplaza',
  pmsAuthKey: 'ak_live_98f4a7c8192e0b65d14',
  pmsStatus: 'CONNECTED',
  smartElevatorApi: true,
  elevatorVendor: 'Schindler PORT Technology',
  automaticDoorControls: true,

  // 5. Advanced
  auditLogsRetention: '90 Days',
  anonymizeVoiceData: true,
  enableBetaNav: false,
};

export const AdminSettingsTab = ({ currentUser = {} }) => {
  const [activeSubTab, setActiveSubTab] = useState('general'); // 'general' | 'security' | 'notifications' | 'integrations' | 'advanced'
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  const [initialSettings, setInitialSettings] = useState(() => settings);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [showPmsKey, setShowPmsKey] = useState(false);
  const [isTestingPms, setIsTestingPms] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleSave = (e) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    setTimeout(() => {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
      setInitialSettings(settings);
      setIsSaving(false);
      showToast('Đã lưu toàn bộ cấu hình hệ thống thành công!');
    }, 600);
  };

  const handleDiscard = () => {
    setSettings(initialSettings);
    showToast('Đã hủy bỏ các thay đổi chưa lưu.');
  };

  const handleTestPmsConnection = () => {
    setIsTestingPms(true);
    setTimeout(() => {
      setIsTestingPms(false);
      showToast('✅ Kết nối cổng PMS Oracle OPERA Cloud: Phản hồi 200 OK (Độ trễ 42ms)');
    }, 1000);
  };

  const handleClearMapCache = () => {
    showToast('🧹 Đã xóa trắng Cache bản đồ SLAM. Robot đang tải lại bản đồ sàn mới.');
  };

  const handleFactoryReset = () => {
    setSettings(DEFAULT_SETTINGS);
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(DEFAULT_SETTINGS));
    setShowResetModal(false);
    showToast('⚠️ Đã khôi phục toàn bộ cài đặt về trạng thái mặc định của nhà sản xuất.');
  };

  const subTabs = [
    { id: 'general', label: 'General', icon: Sliders },
    { id: 'security', label: 'Security & Access', icon: ShieldCheck },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'integrations', label: 'Integrations (PMS)', icon: Network },
    { id: 'advanced', label: 'Advanced', icon: Box },
  ];

  return (
    <div className="w-full min-h-full flex flex-col p-6 space-y-6 pb-16 font-sans select-none">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-stone-900 text-white px-5 py-3 rounded-2xl shadow-2xl border border-stone-700 flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-200">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-bold">{toastMessage}</span>
        </div>
      )}

      {/* 1. Header Section */}
      <div className="border-b border-stone-200 pb-4">
        <h2 className="text-2xl font-black text-stone-900 tracking-tight flex items-center gap-2">
          <span>System Settings</span>
        </h2>
        <p className="text-sm text-stone-500 font-medium mt-0.5">
          Manage global configurations, hotel profiles, and robot fleet defaults.
        </p>
      </div>

      {/* 2. Top Sub-Tabs Navigation (Matching the 5 sub-tabs from Figma design) */}
      <div className="border-b border-stone-200 flex items-center gap-1 overflow-x-auto">
        {subTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'border-indigo-600 text-indigo-600 bg-indigo-50/40 rounded-t-xl'
                  : 'border-transparent text-stone-500 hover:text-stone-900 hover:bg-stone-100/60 rounded-t-xl'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-600' : 'text-stone-400'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 3. SUB-TAB 1: GENERAL */}
      {activeSubTab === 'general' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Card 1: Hotel Profile */}
          <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-stone-100 bg-stone-50/40">
              <h3 className="text-base font-extrabold text-stone-900">Hotel Profile</h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Basic information about this property installation.
              </p>
            </div>

            <div className="p-6 space-y-4 text-xs">
              {/* Hotel Name */}
              <div>
                <label className="block text-[11px] font-black text-stone-600 uppercase tracking-wider mb-1.5">
                  HOTEL NAME
                </label>
                <input
                  type="text"
                  value={settings.hotelName}
                  onChange={(e) => setSettings({ ...settings, hotelName: e.target.value })}
                  placeholder="Grand Plaza Hotel / Aurora Grand"
                  className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>

              {/* Address */}
              <div>
                <label className="block text-[11px] font-black text-stone-600 uppercase tracking-wider mb-1.5">
                  ADDRESS
                </label>
                <input
                  type="text"
                  value={settings.address}
                  onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                  placeholder="123 Main St, Cityville"
                  className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>

              {/* Timezone */}
              <div>
                <label className="block text-[11px] font-black text-stone-600 uppercase tracking-wider mb-1.5">
                  SYSTEM TIMEZONE
                </label>
                <div className="relative">
                  <select
                    value={settings.systemTimezone}
                    onChange={(e) => setSettings({ ...settings, systemTimezone: e.target.value })}
                    className="w-full appearance-none px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer pr-10"
                  >
                    <option value="UTC+07:00 Asia/Ho_Chi_Minh">UTC+07:00 Asia/Ho_Chi_Minh (Vietnam Standard Time)</option>
                    <option value="UTC+00:00 UTC">UTC+00:00 UTC (Greenwich Mean Time)</option>
                    <option value="UTC+08:00 Asia/Singapore">UTC+08:00 Asia/Singapore / Hong Kong</option>
                    <option value="UTC+09:00 Asia/Tokyo">UTC+09:00 Asia/Tokyo (JST)</option>
                    <option value="UTC-05:00 America/New_York">UTC-05:00 America/New_York (EST)</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-stone-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Robot Global Preferences */}
          <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-stone-100 bg-stone-50/40">
              <h3 className="text-base font-extrabold text-stone-900">Robot Global Preferences</h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Fleet-wide defaults for interactions and operations.
              </p>
            </div>

            <div className="p-6 space-y-5 text-xs">
              {/* Default Language */}
              <div>
                <label className="block text-[11px] font-black text-stone-600 uppercase tracking-wider mb-1.5">
                  DEFAULT LANGUAGE
                </label>
                <div className="relative">
                  <select
                    value={settings.defaultLanguage}
                    onChange={(e) => setSettings({ ...settings, defaultLanguage: e.target.value })}
                    className="w-full appearance-none px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer pr-10"
                  >
                    <option value="English (US)">English (US)</option>
                    <option value="Vietnamese (Tiếng Việt)">Vietnamese (Tiếng Việt)</option>
                    <option value="French (Français)">French (Français)</option>
                    <option value="Japanese (日本語)">Japanese (日本語)</option>
                    <option value="Chinese (中文)">Chinese (中文)</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-stone-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Default Voice Volume */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-black text-stone-600 uppercase tracking-wider">
                    DEFAULT VOICE VOLUME ({settings.voiceVolume}%)
                  </label>
                  <span className="text-[11px] font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                    {settings.voiceVolume}% Volume
                  </span>
                </div>
                <div className="flex items-center gap-3 bg-stone-50 p-3 rounded-2xl border border-stone-200">
                  <Volume1 className="w-4 h-4 text-stone-400 shrink-0" />
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={settings.voiceVolume}
                    onChange={(e) => setSettings({ ...settings, voiceVolume: Number(e.target.value) })}
                    className="w-full accent-indigo-600 cursor-pointer h-2 bg-stone-200 rounded-lg appearance-none"
                  />
                  <Volume2 className="w-4 h-4 text-stone-700 shrink-0" />
                </div>
              </div>

              {/* Night Mode Operation */}
              <div>
                <label className="block text-[11px] font-black text-stone-600 uppercase tracking-wider mb-1.5">
                  NIGHT MODE OPERATION
                </label>
                <div className="relative">
                  <select
                    value={settings.nightMode}
                    onChange={(e) => setSettings({ ...settings, nightMode: e.target.value })}
                    className="w-full appearance-none px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer pr-10"
                  >
                    <option value="Quiet Navigation Only">Quiet Navigation Only (Giảm âm lượng, tắt đèn laser chớp)</option>
                    <option value="Standard Operation">Standard Operation (Hoạt động bình thường 24/7)</option>
                    <option value="Dock Charging Sleep">Dock Charging Sleep (Tự động về trạm sạc nghỉ ban đêm)</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-stone-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. SUB-TAB 2: SECURITY & ACCESS */}
      {activeSubTab === 'security' && (
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
      )}

      {/* 5. SUB-TAB 3: NOTIFICATIONS */}
      {activeSubTab === 'notifications' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Card 1: System & Hardware Alerts */}
          <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-stone-100 bg-stone-50/40">
              <h3 className="text-base font-extrabold text-stone-900">System & Hardware Alerts</h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Configure notifications for robot fleet health and connectivity issues.
              </p>
            </div>

            <div className="p-6 space-y-4 text-xs">
              {/* Primary Email */}
              <div>
                <label className="block text-[11px] font-black text-stone-600 uppercase tracking-wider mb-1.5">
                  PRIMARY ADMIN EMAIL FOR ALERTS
                </label>
                <input
                  type="email"
                  value={settings.primaryAlertEmail}
                  onChange={(e) => setSettings({ ...settings, primaryAlertEmail: e.target.value })}
                  placeholder="admin@grandplaza.com"
                  className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>

              {/* Critical Hardware Errors Toggle */}
              <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 flex items-center justify-between">
                <div className="space-y-0.5 pr-4">
                  <p className="font-extrabold text-stone-900">Critical Hardware Errors</p>
                  <p className="text-[11px] text-stone-500">
                    Notifies when a robot requires immediate physical maintenance.
                  </p>
                </div>

                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={settings.criticalHardwareErrors}
                    onChange={(e) => setSettings({ ...settings, criticalHardwareErrors: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-stone-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              {/* Low Battery Warning Toggle */}
              <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 flex items-center justify-between">
                <div className="space-y-0.5 pr-4">
                  <p className="font-extrabold text-stone-900">Low Battery Warning (&lt; 15%)</p>
                  <p className="text-[11px] text-stone-500">
                    Sends an alert if a robot fails to return to the charging dock.
                  </p>
                </div>

                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={settings.lowBatteryWarning}
                    onChange={(e) => setSettings({ ...settings, lowBatteryWarning: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-stone-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              {/* Connectivity Loss Toggle */}
              <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 flex items-center justify-between">
                <div className="space-y-0.5 pr-4">
                  <p className="font-extrabold text-stone-900">Connectivity Loss</p>
                  <p className="text-[11px] text-stone-500">
                    Alerts if a robot drops offline for more than 5 minutes.
                  </p>
                </div>

                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={settings.connectivityLoss}
                    onChange={(e) => setSettings({ ...settings, connectivityLoss: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-stone-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Card 2: Human Handoff Routing */}
          <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-stone-100 bg-stone-50/40">
              <h3 className="text-base font-extrabold text-stone-900">Human Handoff Routing</h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Determine how staff members are notified when a robot escalates a guest request.
              </p>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-black text-stone-600 uppercase tracking-wider mb-2">
                  ACTIVE NOTIFICATION CHANNELS
                </label>
                <div className="space-y-2.5">
                  <label className="flex items-center gap-3 p-3 bg-stone-50 rounded-2xl border border-stone-200 cursor-pointer hover:bg-stone-100/70 transition-colors">
                    <input
                      type="checkbox"
                      checked={settings.activeChannels.inAppConsole}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          activeChannels: { ...settings.activeChannels, inAppConsole: e.target.checked },
                        })
                      }
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 accent-indigo-600"
                    />
                    <span className="font-bold text-stone-800">In-App Console Alerts (Desktop / Tablet)</span>
                  </label>

                  <label className="flex items-center gap-3 p-3 bg-stone-50 rounded-2xl border border-stone-200 cursor-pointer hover:bg-stone-100/70 transition-colors">
                    <input
                      type="checkbox"
                      checked={settings.activeChannels.smsAlerts}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          activeChannels: { ...settings.activeChannels, smsAlerts: e.target.checked },
                        })
                      }
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 accent-indigo-600"
                    />
                    <span className="font-bold text-stone-800">SMS Alerts (For Urgent Requests)</span>
                  </label>

                  <label className="flex items-center gap-3 p-3 bg-stone-50 rounded-2xl border border-stone-200 cursor-pointer hover:bg-stone-100/70 transition-colors">
                    <input
                      type="checkbox"
                      checked={settings.activeChannels.emailDigest}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          activeChannels: { ...settings.activeChannels, emailDigest: e.target.checked },
                        })
                      }
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 accent-indigo-600"
                    />
                    <span className="font-bold text-stone-800">Email Digest (Daily Operations Summary)</span>
                  </label>
                </div>
              </div>

              {/* Escalation Timeout */}
              <div className="pt-2">
                <label className="block text-[11px] font-black text-stone-600 uppercase tracking-wider mb-1.5">
                  ESCALATION TIMEOUT
                </label>
                <div className="relative">
                  <select
                    value={settings.escalationTimeout}
                    onChange={(e) => setSettings({ ...settings, escalationTimeout: e.target.value })}
                    className="w-full appearance-none px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer pr-10"
                  >
                    <option value="Alert Manager after 5 minutes of no response">Alert Manager after 5 minutes of no response</option>
                    <option value="Auto-reassign after 3 minutes">Auto-reassign to fallback staff after 3 minutes</option>
                    <option value="Broadcast to all on-duty staff after 8 minutes">Broadcast to all on-duty staff after 8 minutes</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-stone-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. SUB-TAB 4: INTEGRATIONS (PMS) */}
      {activeSubTab === 'integrations' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Card 1: Property Management System (PMS) */}
          <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-stone-100 bg-stone-50/40">
              <h3 className="text-base font-extrabold text-stone-900">Property Management System (PMS)</h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Connect the robot fleet to your hotel's central reservation and guest management system.
              </p>
            </div>

            <div className="p-6 space-y-4 text-xs">
              {/* PMS Provider */}
              <div>
                <label className="block text-[11px] font-black text-stone-600 uppercase tracking-wider mb-1.5">
                  PMS PROVIDER
                </label>
                <div className="relative">
                  <select
                    value={settings.pmsProvider}
                    onChange={(e) => setSettings({ ...settings, pmsProvider: e.target.value })}
                    className="w-full appearance-none px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer pr-10"
                  >
                    <option value="Oracle OPERA Cloud">Oracle OPERA Cloud (Hospitality API)</option>
                    <option value="Cloudbeds PMS">Cloudbeds PMS Integration</option>
                    <option value="Smile Hotel Management">Smile Hotel Management System</option>
                    <option value="Hotelogix Cloud PMS">Hotelogix Cloud PMS</option>
                    <option value="Custom Webhook Integration">Custom Webhook Integration</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-stone-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* API Endpoint */}
              <div>
                <label className="block text-[11px] font-black text-stone-600 uppercase tracking-wider mb-1.5">
                  API ENDPOINT URL
                </label>
                <input
                  type="text"
                  value={settings.pmsApiUrl}
                  onChange={(e) => setSettings({ ...settings, pmsApiUrl: e.target.value })}
                  placeholder="https://api.operacloud.com/v1/hotel/grandplaza"
                  className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>

              {/* Auth Key with Status Badge & Test Button */}
              <div>
                <label className="block text-[11px] font-black text-stone-600 uppercase tracking-wider mb-1.5">
                  AUTHENTICATION KEY
                </label>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                  <div className="relative flex-1">
                    <input
                      type={showPmsKey ? 'text' : 'password'}
                      value={settings.pmsAuthKey}
                      onChange={(e) => setSettings({ ...settings, pmsAuthKey: e.target.value })}
                      className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 font-mono text-xs focus:outline-none pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPmsKey(!showPmsKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 cursor-pointer"
                    >
                      {showPmsKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  <span className="px-3 py-2 bg-emerald-50 text-emerald-700 font-black text-[10px] tracking-wider rounded-xl border border-emerald-200 flex items-center justify-center gap-1.5 shrink-0">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>STATUS: CONNECTED</span>
                  </span>

                  <button
                    type="button"
                    onClick={handleTestPmsConnection}
                    disabled={isTestingPms}
                    className="px-4 py-2.5 bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer shrink-0 flex items-center justify-center gap-1.5"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isTestingPms ? 'animate-spin' : ''}`} />
                    <span>{isTestingPms ? 'Testing...' : 'Test Connection'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: IoT & Facility Integrations */}
          <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-stone-100 bg-stone-50/40">
              <h3 className="text-base font-extrabold text-stone-900">IoT & Facility Integrations</h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Enable robot access to smart elevators and automatic doors.
              </p>
            </div>

            <div className="p-6 space-y-4 text-xs">
              {/* Smart Elevator Dispatch API Toggle */}
              <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 flex items-center justify-between">
                <div className="space-y-0.5 pr-4">
                  <p className="font-extrabold text-stone-900">Smart Elevator Dispatch API</p>
                  <p className="text-[11px] text-stone-500">
                    Allows robots to call and use guest elevators autonomously.
                  </p>
                </div>

                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={settings.smartElevatorApi}
                    onChange={(e) => setSettings({ ...settings, smartElevatorApi: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-stone-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              {/* Elevator Vendor */}
              <div>
                <label className="block text-[11px] font-black text-stone-600 uppercase tracking-wider mb-1.5">
                  ELEVATOR VENDOR
                </label>
                <div className="relative">
                  <select
                    value={settings.elevatorVendor}
                    onChange={(e) => setSettings({ ...settings, elevatorVendor: e.target.value })}
                    className="w-full appearance-none px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer pr-10"
                  >
                    <option value="Schindler PORT Technology">Schindler PORT Technology</option>
                    <option value="Otis CompassPlus API">Otis CompassPlus API</option>
                    <option value="KONE Elevator API">KONE Elevator API</option>
                    <option value="Mitsubishi ELESYS">Mitsubishi ELESYS Elevator Protocol</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-stone-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Automatic Door Controls Toggle */}
              <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 flex items-center justify-between">
                <div className="space-y-0.5 pr-4">
                  <p className="font-extrabold text-stone-900">Automatic Door Controls</p>
                  <p className="text-[11px] text-stone-500">
                    Grants robot bypass access to secure corridor doors.
                  </p>
                </div>

                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={settings.automaticDoorControls}
                    onChange={(e) => setSettings({ ...settings, automaticDoorControls: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-stone-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. SUB-TAB 5: ADVANCED */}
      {activeSubTab === 'advanced' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Card 1: Data Retention & Privacy */}
          <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-stone-100 bg-stone-50/40">
              <h3 className="text-base font-extrabold text-stone-900">Data Retention & Privacy</h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Manage how long system logs and guest interaction data are stored to comply with privacy policies.
              </p>
            </div>

            <div className="p-6 space-y-4 text-xs">
              {/* Audit Logs Retention */}
              <div>
                <label className="block text-[11px] font-black text-stone-600 uppercase tracking-wider mb-1.5">
                  SYSTEM AUDIT LOGS RETENTION
                </label>
                <div className="relative">
                  <select
                    value={settings.auditLogsRetention}
                    onChange={(e) => setSettings({ ...settings, auditLogsRetention: e.target.value })}
                    className="w-full appearance-none px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer pr-10"
                  >
                    <option value="30 Days">30 Days</option>
                    <option value="90 Days">90 Days</option>
                    <option value="180 Days">180 Days</option>
                    <option value="1 Year">1 Year</option>
                    <option value="Forever">Forever (Indefinite Storage)</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-stone-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Anonymize Voice Data Toggle */}
              <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 flex items-center justify-between">
                <div className="space-y-0.5 pr-4">
                  <p className="font-extrabold text-stone-900">Anonymize Guest Voice Data</p>
                  <p className="text-[11px] text-stone-500">
                    Automatically scrubs personally identifiable information (PII) from robot voice recordings.
                  </p>
                </div>

                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={settings.anonymizeVoiceData}
                    onChange={(e) => setSettings({ ...settings, anonymizeVoiceData: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-stone-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              {/* Export Full Data Archive Button */}
              <div>
                <button
                  type="button"
                  onClick={() => showToast('📦 Đang tạo gói sao lưu toàn bộ dữ liệu... Tệp ZIP sẽ sẵn sàng tải xuống.')}
                  className="px-4 py-2.5 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-stone-800 text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shadow-sm"
                >
                  <Download className="w-3.5 h-3.5 text-stone-700" />
                  <span>Export Full Data Archive</span>
                </button>
              </div>
            </div>
          </div>

          {/* Card 2: System Maintenance (Danger Zone) */}
          <div className="bg-white rounded-3xl border border-rose-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-rose-100 bg-rose-50/40 flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-rose-950 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-600" />
                  <span>System Maintenance (Danger Zone)</span>
                </h3>
                <p className="text-xs text-rose-600/90 mt-0.5">
                  High-level controls for system cache, experimental features, and factory resets.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-100 text-rose-700 uppercase tracking-wider">
                Restricted Admin
              </span>
            </div>

            <div className="p-6 space-y-5 text-xs">
              {/* Beta Navigation Toggle */}
              <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 flex items-center justify-between">
                <div className="space-y-0.5 pr-4">
                  <p className="font-extrabold text-stone-900">Enable Beta Navigation Algorithms</p>
                  <p className="text-[11px] text-stone-500">
                    Opt-in to experimental pathfinding updates (may cause unexpected robot behavior).
                  </p>
                </div>

                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={settings.enableBetaNav}
                    onChange={(e) => setSettings({ ...settings, enableBetaNav: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-stone-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              {/* Clear Map Cache Button */}
              <div>
                <button
                  type="button"
                  onClick={handleClearMapCache}
                  className="px-4 py-2.5 rounded-xl border border-stone-300 bg-white hover:bg-stone-100 text-stone-800 text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shadow-sm"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-stone-600" />
                  <span>Clear Global Map Cache</span>
                </button>
                <p className="text-[11px] text-stone-400 mt-1.5">
                  Forces all robots to re-download the latest floor maps and LiDAR reference points.
                </p>
              </div>

              {/* Factory Reset Danger Zone */}
              <div className="pt-4 border-t border-rose-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="font-black text-rose-900">Factory Reset All Robot Preferences</p>
                  <p className="text-[11px] text-rose-600/90 mt-0.5">
                    Warning: This action will restore all settings back to system defaults.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowResetModal(true)}
                  className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer shrink-0 flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Factory Reset</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 8. Bottom Persistent Action Bar across all sub-tabs (Matching Figma Bottom Right Buttons) */}
      <div className="pt-4 border-t border-stone-200 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={handleDiscard}
          className="px-5 py-2.5 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-stone-700 font-bold text-xs transition-all shadow-sm cursor-pointer"
        >
          Discard Changes
        </button>

        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="px-6 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs shadow-md flex items-center gap-2 transition-all cursor-pointer disabled:opacity-60"
        >
          <Save className="w-3.5 h-3.5 text-indigo-400" />
          <span>{isSaving ? 'Saving Settings...' : 'Save Settings'}</span>
        </button>
      </div>

      {/* MODAL: FACTORY RESET CONFIRMATION */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-3xl border border-stone-200 shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="text-lg font-black text-stone-900">Xác Nhận Khôi Phục Cài Đặt Gốc?</h3>
              <p className="text-xs text-stone-500 leading-relaxed">
                Hành động này sẽ đặt lại toàn bộ cấu hình PMS, ngôn ngữ, âm lượng và các chính sách bảo mật về mặc định ban đầu. Bạn có chắc chắn muốn tiếp tục?
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700 font-bold text-xs transition-all cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleFactoryReset}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
              >
                Đồng Ý Khôi Phục
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
