import React from 'react';
import { ChevronDown, Download, ShieldAlert, RefreshCw, Trash2 } from 'lucide-react';

export const AdvancedSection = ({
  settings,
  setSettings,
  showToast,
  handleClearMapCache,
  setShowResetModal,
}) => {
  return (
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
  );
};
