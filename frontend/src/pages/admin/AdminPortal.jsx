import React, { useState } from 'react';
import {
  LayoutGrid,
  Sliders,
  Bot,
  BookOpen,
  Hotel,
  Users,
  BarChart2,
  FileText,
  Settings,
  LogOut,
  Search,
  Bell,
  AlertTriangle,
  HelpCircle,
  Map as MapIcon,
  Sparkles,
} from 'lucide-react';
import { AdminDashboardTab } from './tabs/AdminDashboardTab';
import { AdminOperationsTab } from './tabs/AdminOperationsTab';
import { AdminKnowledgePage } from './tabs/AdminKnowledgePage';
import { AdminStaffTab } from './tabs/AdminStaffTab';
import { AdminAnalyticsTab } from './tabs/AdminAnalyticsTab';
import { AdminSettingsTab } from './tabs/AdminSettingsTab';
import { AdminLogsTab } from './tabs/AdminLogsTab';
import { AdminLidarPage } from './AdminLidarPage';

export const AdminPortal = ({ currentUser, onLogout = () => {}, onNotify = () => {} }) => {
  // Navigation Menu: 'Dashboard' | 'Operations' | 'Robots' | 'Knowledge' | 'Hotel Content' | 'Staff' | 'Analytics' | 'Logs' | 'Settings'
  const [activeMenu, setActiveMenu] = useState('Operations');
  const [operationsSubTab, setOperationsSubTab] = useState('requests'); // 'requests' | 'support'
  const [knowledgeSubTab, setKnowledgeSubTab] = useState('overview'); // 'overview' | 'articles' | 'sources' | 'upload' | 'create'
  const [searchQuery, setSearchQuery] = useState('');


  const menuItems = [
    { id: 'Dashboard', label: 'Dashboard', icon: LayoutGrid },
    { id: 'Operations', label: 'Operations', icon: Sliders },
    { id: 'Robots', label: 'Robots', icon: Bot },
    { id: 'Knowledge', label: 'Knowledge', icon: BookOpen },
    { id: 'Hotel Content', label: 'Hotel Content', icon: Hotel },
    { id: 'Staff', label: 'Staff', icon: Users },
    { id: 'Analytics', label: 'Analytics', icon: BarChart2 },
    { id: 'Logs', label: 'Logs', icon: FileText },
  ];

  return (
    <div className="w-full h-screen overflow-hidden bg-[#F8F9FA] text-[#1A1917] flex font-sans select-none">
      {/* 1. LEFT SIDEBAR (Matching Figma 'RoboConcierge V2.4.1 Admin') */}
      <aside className="w-64 h-full bg-[#18181B] text-white flex flex-col justify-between shrink-0 border-r border-stone-800 z-30 shadow-2xl">
        {/* Brand Header */}
        <div>
          <div className="p-6 border-b border-stone-800/80 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white font-black text-lg flex items-center justify-center shadow-md shadow-indigo-500/25">
              R
            </div>
            <div>
              <div className="font-black text-sm tracking-tight text-white flex items-center gap-1.5">
                <span>RoboConcierge</span>
              </div>
              <div className="text-[10px] font-bold text-indigo-400 tracking-wider">
                V2.4.1 ADMIN PORTAL
              </div>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="p-3 space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeMenu === item.id;
              return (
                <div key={item.id} className="space-y-1">
                  <button
                    onClick={() => setActiveMenu(item.id)}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-indigo-600/90 text-white shadow-lg shadow-indigo-600/30'
                        : 'text-stone-400 hover:text-white hover:bg-stone-800/60'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-stone-400'}`} />
                    <span>{item.label}</span>
                  </button>

                  {/* Nested Sub-items directly under Operations on the sidebar (Matching Figma) */}
                  {item.id === 'Operations' && activeMenu === 'Operations' && (
                    <div className="ml-5 pl-3 border-l-2 border-indigo-500/40 my-1 space-y-1">
                      <button
                        onClick={() => setOperationsSubTab('requests')}
                        className={`w-full text-left px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                          operationsSubTab === 'requests'
                            ? 'bg-stone-800 text-white shadow-sm border border-stone-700'
                            : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/40'
                        }`}
                      >
                        Service Requests
                      </button>
                      <button
                        onClick={() => setOperationsSubTab('support')}
                        className={`w-full text-left px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                          operationsSubTab === 'support'
                            ? 'bg-stone-800 text-white shadow-sm border border-stone-700'
                            : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/40'
                        }`}
                      >
                        Human Support
                      </button>
                    </div>
                  )}

                  {/* Nested Sub-items directly under Knowledge on the sidebar */}
                  {item.id === 'Knowledge' && activeMenu === 'Knowledge' && (
                    <div className="ml-5 pl-3 border-l-2 border-indigo-500/40 my-1 space-y-1">
                      <button
                        onClick={() => setKnowledgeSubTab('overview')}
                        className={`w-full text-left px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                          knowledgeSubTab === 'overview'
                            ? 'bg-stone-800 text-white shadow-sm border border-stone-700'
                            : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/40'
                        }`}
                      >
                        Overview
                      </button>
                      <button
                        onClick={() => setKnowledgeSubTab('articles')}
                        className={`w-full text-left px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                          knowledgeSubTab === 'articles'
                            ? 'bg-stone-800 text-white shadow-sm border border-stone-700'
                            : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/40'
                        }`}
                      >
                        Articles
                      </button>
                      <button
                        onClick={() => setKnowledgeSubTab('sources')}
                        className={`w-full text-left px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                          knowledgeSubTab === 'sources'
                            ? 'bg-stone-800 text-white shadow-sm border border-stone-700'
                            : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/40'
                        }`}
                      >
                        Source Files
                      </button>
                    </div>
                  )}



                </div>
              );
            })}
          </nav>
        </div>


        {/* Bottom Settings & Logout */}
        <div className="p-3 border-t border-stone-800/80 space-y-1">
          <button
            onClick={() => setActiveMenu('Settings')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeMenu === 'Settings'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-stone-400 hover:text-white hover:bg-stone-800/60'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </button>

          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      {/* 2. MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden">
        {/* Top Header Bar (Matching Figma Topbar) */}
        <header className="h-16 bg-white border-b border-stone-200 px-6 flex items-center justify-between shrink-0 z-20 shadow-sm">
          {/* Left Title */}
          <div className="flex items-center gap-3">
            <h1 className="text-base font-black text-stone-900 tracking-tight">
              Hotel Concierge Admin
            </h1>
            <span className="text-stone-300">|</span>
            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
              {activeMenu}
            </span>
          </div>

          {/* Center Search Input */}
          <div className="hidden md:flex items-center relative w-80">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search operations, robots..."
              className="w-full pl-9 pr-4 py-1.5 bg-stone-100/80 border border-stone-200 rounded-xl text-xs text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          {/* Right Action Icons & Profile */}
          <div className="flex items-center gap-3">
            {/* Notification Bell with Badge */}
            <div className="relative">
              <button
                title="3 cảnh báo hoạt động"
                className="p-2 rounded-xl text-stone-500 hover:text-stone-900 hover:bg-stone-100 transition-all cursor-pointer"
              >
                <Bell className="w-4 h-4" />
              </button>
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white" />
            </div>

            {/* Alert Status Icon */}
            <button
              title="Trạng thái hệ thống bình thường"
              className="p-2 rounded-xl text-amber-500 hover:bg-stone-100 transition-all cursor-pointer"
            >
              <AlertTriangle className="w-4 h-4" />
            </button>

            {/* Help Icon */}
            <button
              title="Trợ giúp"
              className="p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-all cursor-pointer"
            >
              <HelpCircle className="w-4 h-4" />
            </button>

            {/* User Avatar & Name */}
            <div className="flex items-center gap-2 pl-2 border-l border-stone-200">
              <div className="w-8 h-8 rounded-full bg-stone-900 text-white font-bold text-xs flex items-center justify-center ring-2 ring-indigo-500/30">
                AD
              </div>
              <div className="hidden xl:block text-left">
                <div className="text-xs font-bold text-stone-900 leading-tight">
                  {currentUser?.full_name || 'System Administrator'}
                </div>
                <div className="text-[10px] text-stone-400 font-semibold">
                  {currentUser?.role || 'Operations Admin'}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* 3. DYNAMIC TAB VIEW BODY */}
        <main className={`flex-1 min-h-0 ${activeMenu === 'Robots' ? 'overflow-hidden' : 'overflow-y-auto custom-scrollbar'} relative`}>
          {activeMenu === 'Dashboard' && (
            <AdminDashboardTab
              onNavigateToOperations={() => setActiveMenu('Operations')}
              onNavigateToRobots={() => setActiveMenu('Robots')}
            />
          )}

          {activeMenu === 'Operations' && (
            <AdminOperationsTab
              currentUser={currentUser}
              onNotify={onNotify}
              subTabProp={operationsSubTab}
              onSelectSubTab={setOperationsSubTab}
            />
          )}


          {activeMenu === 'Robots' && (
            <div className="w-full h-full flex flex-col">
              <div className="bg-white border-b border-stone-200 px-6 py-3 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <Bot className="w-5 h-5 text-indigo-600" />
                  <h3 className="text-sm font-black text-stone-900">
                    Bản Đồ SLAM LiDAR & Điều Hướng Robot Concierge
                  </h3>
                </div>
                <span className="text-xs text-stone-500">
                  Cổng RPLiDAR COM9 • Tọa độ thời gian thực
                </span>
              </div>
              <div className="flex-1 overflow-hidden">
                <AdminLidarPage />
              </div>
            </div>
          )}

          {activeMenu === 'Knowledge' && (
            <AdminKnowledgePage activeSubView={knowledgeSubTab} />
          )}

          {activeMenu === 'Staff' && (
            <AdminStaffTab currentUser={currentUser} />
          )}

          {activeMenu === 'Analytics' && (
            <AdminAnalyticsTab currentUser={currentUser} />
          )}

          {activeMenu === 'Settings' && (
            <AdminSettingsTab currentUser={currentUser} />
          )}

          {activeMenu === 'Logs' && (
            <AdminLogsTab currentUser={currentUser} />
          )}

          {/* Placeholders for Hotel Content */}
          {activeMenu === 'Hotel Content' && (
            <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-sm">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-extrabold text-stone-900">Phân Hệ {activeMenu}</h3>
              <p className="text-xs text-stone-500 max-w-md">
                Module này đã được chuẩn bị sẵn cấu trúc trong bản thiết kế Figma của bạn và sẽ được kết nối tiếp theo.
              </p>
              <button
                onClick={() => setActiveMenu('Operations')}
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-500 transition-all cursor-pointer"
              >
                ← Quay lại Operations
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
