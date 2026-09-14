import React from 'react';
import { Volume1, Volume2, ChevronDown } from 'lucide-react';

export const GeneralSection = ({ settings, setSettings }) => {
  return (
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
  );
};
