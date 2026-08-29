import React from 'react';
import {
  LayoutDashboard,
  Inbox,
  CheckSquare,
  History,
  Bell,
  User,
  LogOut,
  Home,
} from 'lucide-react';

export const AuroraSidebar = ({
  activeMenu = 'Dashboard',
  onSelectMenu = () => {},
  currentUser = { name: 'Elena Rossi', role: 'Online', avatar: null },
  onLogout = () => {},
  onBackToHome = () => {},
  referenceLayout = false,
}) => {
  const staffNavItems = [
    { id: 'Dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'Requests', label: 'Requests', icon: Inbox },
    { id: 'My Tasks', label: 'My Tasks', icon: CheckSquare },
    { id: 'History', label: 'History', icon: History },
    { id: 'Notifications', label: 'Notifications', icon: Bell },
    { id: 'Profile', label: 'Profile', icon: User },
  ];

  return (
    <aside
      className={`h-full border-r flex flex-col justify-between select-none shrink-0 font-sans ${
        referenceLayout
          ? 'w-[240px] bg-white border-[#F0EEE9] px-[19px] py-5'
          : 'w-64 bg-[#F5F2EB] border-[#E3DFD5] p-5'
      }`}
    >
      {/* Top Branding & Menu */}
      <div className={`flex flex-col ${referenceLayout ? 'space-y-[48px]' : 'space-y-6'}`}>
        {/* Brand Header */}
        <div className="px-2 pt-1 flex items-center justify-between">
          <div>
            <h1 className="text-sm font-bold tracking-tight text-[#1A1917]">Aurora OS</h1>
            <p className="text-[10px] font-semibold tracking-wider text-[#8C857B] uppercase mt-0.5">
              STAFF INTERFACE
            </p>
          </div>

          <button
            onClick={onBackToHome}
            title="Quay lại Trang Chủ"
            className={`p-1.5 rounded-xl bg-[#EBE7DE] hover:bg-[#E2DDCF] text-stone-600 hover:text-black transition-all cursor-pointer ${referenceLayout ? 'hidden' : ''}`}
          >
            <Home className="w-4 h-4" />
          </button>
        </div>

        <div className={`h-px bg-[#E3DFD5]/80 w-full ${referenceLayout ? 'hidden' : ''}`} />

        {/* Navigation Items */}
        <nav className="flex flex-col space-y-1.5">
          {staffNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeMenu === item.id;
            return (
              <React.Fragment key={item.id}>
                {referenceLayout && item.id === 'Notifications' && (
                  <div className="h-px bg-[#ECE9E4] mt-2 mb-2" />
                )}
                <button
                  onClick={() => onSelectMenu(item.id)}
                  className={`flex items-center gap-3 transition-all text-left ${
                    referenceLayout
                      ? `h-10 px-3 rounded-[10px] text-[14px] font-normal ${
                          isActive ? 'bg-black text-white' : 'text-[#555] hover:bg-[#F3F1ED]'
                        }`
                      : `px-3.5 py-2.5 rounded-full text-xs font-semibold ${
                          isActive
                            ? 'bg-[#18181B] text-white shadow-sm'
                            : 'text-[#44403C] hover:bg-[#EAE5DC] hover:text-[#1A1917]'
                        }`
                  }`}
                >
                  <Icon
                    className={`${referenceLayout ? 'w-[18px] h-[18px]' : 'w-4 h-4'} ${
                      isActive ? 'text-white' : 'text-[#78716C]'
                    }`}
                    strokeWidth={referenceLayout ? 1.8 : 2}
                  />
                  <span>{item.label}</span>
                </button>
              </React.Fragment>
            );
          })}
        </nav>
      </div>

      {/* Bottom User Card with Logout */}
      <div className={`${referenceLayout ? '' : 'pt-4 border-t border-[#E3DFD5]'} space-y-2`}>
        <div className={`group flex items-center gap-3 transition-all ${referenceLayout ? 'mx-2 p-3 rounded-[13px] bg-[#F3F1ED]' : 'p-2 rounded-2xl bg-[#EBE7DE]/70 border border-[#E0DCD3]/60 hover:bg-[#E6E1D7]'}`}>
          {currentUser.avatar_url || currentUser.avatar ? (
            <img
              src={currentUser.avatar_url || currentUser.avatar}
              alt={currentUser.name || currentUser.full_name}
              className={`${referenceLayout ? 'w-7 h-7' : 'w-8 h-8'} rounded-full object-cover border border-white/50`}
            />
          ) : (
            <div className={`${referenceLayout ? 'w-7 h-7' : 'w-8 h-8'} rounded-full bg-[#18181B] text-white flex items-center justify-center font-bold text-xs`}>
              <User className="w-4 h-4" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-[#1A1917] truncate">
              {currentUser.name || currentUser.full_name}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-[11px] font-medium text-[#78716C] truncate">
                {referenceLayout ? 'Online' : currentUser.role || 'Online'}
              </span>
            </div>
          </div>

          <button
            onClick={onLogout}
            title="Đăng xuất"
            className={`p-1.5 rounded-xl hover:bg-stone-300 text-stone-500 hover:text-red-600 transition-all cursor-pointer ${referenceLayout ? 'opacity-0 group-hover:opacity-100' : ''}`}
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};

