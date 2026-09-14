import React, { useState } from 'react';
import { Sparkles, Save } from 'lucide-react';
import {
  SETTINGS_STORAGE_KEY,
  DEFAULT_SETTINGS,
  SUB_TABS,
} from './settings/settingsConstants';
import { GeneralSection } from './settings/GeneralSection';
import { SecuritySection } from './settings/SecuritySection';
import { NotificationsSection } from './settings/NotificationsSection';
import { IntegrationsSection } from './settings/IntegrationsSection';
import { AdvancedSection } from './settings/AdvancedSection';
import { ResetSettingsModal } from './settings/ResetSettingsModal';

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
        {SUB_TABS.map((tab) => {
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

      {/* 3. Section Content based on Active Sub-Tab */}
      {activeSubTab === 'general' && (
        <GeneralSection settings={settings} setSettings={setSettings} />
      )}

      {activeSubTab === 'security' && (
        <SecuritySection
          settings={settings}
          setSettings={setSettings}
          showToast={showToast}
        />
      )}

      {activeSubTab === 'notifications' && (
        <NotificationsSection settings={settings} setSettings={setSettings} />
      )}

      {activeSubTab === 'integrations' && (
        <IntegrationsSection
          settings={settings}
          setSettings={setSettings}
          showPmsKey={showPmsKey}
          setShowPmsKey={setShowPmsKey}
          isTestingPms={isTestingPms}
          handleTestPmsConnection={handleTestPmsConnection}
        />
      )}

      {activeSubTab === 'advanced' && (
        <AdvancedSection
          settings={settings}
          setSettings={setSettings}
          showToast={showToast}
          handleClearMapCache={handleClearMapCache}
          setShowResetModal={setShowResetModal}
        />
      )}

      {/* 4. Bottom Persistent Action Bar across all sub-tabs */}
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

      {/* 5. MODAL: FACTORY RESET CONFIRMATION */}
      <ResetSettingsModal
        showResetModal={showResetModal}
        setShowResetModal={setShowResetModal}
        handleFactoryReset={handleFactoryReset}
      />
    </div>
  );
};
