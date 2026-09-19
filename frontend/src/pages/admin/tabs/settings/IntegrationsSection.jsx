import React from 'react';
import { ChevronDown, Eye, EyeOff, RefreshCw } from 'lucide-react';

export const IntegrationsSection = ({
  settings,
  setSettings,
  showPmsKey,
  setShowPmsKey,
  isTestingPms,
  handleTestPmsConnection,
}) => {
  return (
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
  );
};
