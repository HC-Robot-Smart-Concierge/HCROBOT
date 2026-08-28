import React, { useState } from 'react';
import { RobotScreenPage } from './pages/robot/RobotScreenPage';
import { AdminLidarPage } from './pages/admin/AdminLidarPage';
import { Monitor, Map, Cpu } from 'lucide-react';

export function App() {
  // activeTab: 'robot_display' | 'admin_map'
  const [activeTab, setActiveTab] = useState('admin_map');

  return (
    <div className="w-full h-screen overflow-hidden relative bg-slate-950 font-sans">
      {/* Top Floating View Switcher Header */}
      <div className="absolute top-3 right-6 z-50 flex items-center gap-2 bg-slate-900/90 border border-slate-700/70 backdrop-blur-lg px-3 py-1.5 rounded-full shadow-2xl">
        <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase mr-1 flex items-center gap-1">
          <Cpu className="w-3.5 h-3.5 text-sky-400" />
          <span>VIEW MODE:</span>
        </span>

        <button
          onClick={() => setActiveTab('robot_display')}
          className={`px-3 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'robot_display'
              ? 'bg-sky-500 text-white shadow-md scale-105'
              : 'text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Monitor className="w-3.5 h-3.5" />
          <span>Màn Hình Robot</span>
        </button>

        <button
          onClick={() => setActiveTab('admin_map')}
          className={`px-3 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'admin_map'
              ? 'bg-emerald-600 text-white shadow-md scale-105'
              : 'text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Map className="w-3.5 h-3.5" />
          <span>Admin LiDAR Map</span>
        </button>
      </div>

      {/* Dynamic Content View */}
      {activeTab === 'robot_display' ? <RobotScreenPage /> : <AdminLidarPage />}
    </div>
  );
}

export default App;
