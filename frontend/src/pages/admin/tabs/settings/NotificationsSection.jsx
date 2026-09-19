import React from 'react';
import { ChevronDown } from 'lucide-react';

export const NotificationsSection = ({ settings, setSettings }) => {
  return (
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
  );
};
