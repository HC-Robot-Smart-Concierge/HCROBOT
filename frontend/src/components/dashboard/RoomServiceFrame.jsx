import React, { createContext, useContext, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell, LogOut, Menu, Settings } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useStaffText } from '../../context/StaffLanguage';
import './room-service.css';

const PageHeaderTarget = createContext(undefined);

// Keep each page's existing actions and state while placing its title in the shell.
export function StaffPageHeader({ children, className = '' }) {
  const target = useContext(PageHeaderTarget);
  const header = <div className={target === undefined ? className : 'room-service-page-header'}>{children}</div>;
  return target ? createPortal(header, target) : header;
}

export function RoomServiceFrame({ activeMenu, onSelectMenu, currentUser, onLogout, unreadNotifCount, children }) {
  const { t } = useLanguage();
  const st = useStaffText();
  const [collapsed, setCollapsed] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  const [headerTarget, setHeaderTarget] = useState(null);
  const name = currentUser?.full_name || currentUser?.name || st('Room Service staff');
  const operationsActive = ['Requests', 'MyTasks'].includes(activeMenu);
  const select = (id) => {
    onSelectMenu(id);
    if (window.innerWidth < 768) setCollapsed(true);
  };
  const navButton = (id, label) => (
    <button type="button" className="room-service-nav-item" data-active={activeMenu === id}
      aria-current={activeMenu === id ? 'page' : undefined} onClick={() => select(id)}>
      {label}
    </button>
  );

  return (
    <div className="room-service-portal">
      {!collapsed && <button type="button" className="room-service-backdrop" aria-label={t('adminCollapseSidebar')} onClick={() => setCollapsed(true)} />}
      <aside className={`room-service-sidebar ${collapsed ? 'is-collapsed' : ''}`}>
        <div className="room-service-brand">
          {!collapsed && <>
            <img src="/hc-robot-logo.png" alt="HC-ROBOT" width="32" height="32" />
            <div className="min-w-0 flex-1">
              <strong>HC-ROBOT</strong>
              <span>{st('ROOM SERVICE PORTAL')}</span>
            </div>
          </>}
          <button type="button" className="room-service-icon-button" onClick={() => setCollapsed(value => !value)}
            aria-expanded={!collapsed} aria-controls="room-service-navigation room-service-sidebar-actions"
            aria-label={t(collapsed ? 'adminExpandSidebar' : 'adminCollapseSidebar')}
            title={t(collapsed ? 'adminExpandSidebar' : 'adminCollapseSidebar')}>
            <Menu size={16} aria-hidden="true" />
          </button>
        </div>

        <nav id="room-service-navigation" className="room-service-navigation" hidden={collapsed} aria-label={st('Room Service navigation')}>
          {navButton('Dashboard', t('menuDashboard'))}
          <button type="button" className="room-service-nav-item" data-active={operationsActive}
            aria-expanded={operationsActive} onClick={() => select('Requests')}>{t('adminOperations')}</button>
          {operationsActive && <div className="room-service-subnav">
            {navButton('Requests', t('menuRequests'))}
            {navButton('MyTasks', t('menuMyTasks'))}
          </div>}
          {navButton('RoomServiceMenu', t('menuRoomServiceMenu'))}
          {activeMenu === 'RoomServiceMenu' && <div className="room-service-subnav">
            {navButton('RoomServiceMenu', st('Service catalog'))}
          </div>}
        </nav>

        <div id="room-service-sidebar-actions" className="room-service-sidebar-actions" hidden={collapsed}>
          {navButton('Notifications', <><Bell size={14} /><span>{t('menuNotifications')}</span>
            {unreadNotifCount > 0 && <span className="room-service-count">{unreadNotifCount > 99 ? '99+' : unreadNotifCount}</span>}</>)}
          {navButton('Settings', <><Settings size={14} /><span>{t('adminSettings')}</span></>)}
          {activeMenu === 'Settings' && <div className="room-service-subnav">
            {navButton('Settings', st('General'))}
          </div>}
          <div className="room-service-user-card">
            <button type="button" className="room-service-user" onClick={() => select('Profile')} title={t('menuProfile')} aria-current={activeMenu === 'Profile' ? 'page' : undefined}>
              {currentUser?.avatar_url || currentUser?.avatar
                ? <img src={currentUser.avatar_url || currentUser.avatar} alt="" />
                : <span className="room-service-avatar">{name.charAt(0).toUpperCase()}</span>}
              <span className="min-w-0"><strong>{name}</strong><small>{st('Room Service')}</small></span>
            </button>
            <button type="button" className="room-service-icon-button" onClick={onLogout} aria-label={t('menuLogout')} title={t('menuLogout')}><LogOut size={14} /></button>
          </div>
        </div>
      </aside>
      <main className="room-service-main">
        <header className="room-service-header-slot" ref={setHeaderTarget} />
        <PageHeaderTarget.Provider value={headerTarget}>
          <div className="room-service-content">{children}</div>
        </PageHeaderTarget.Provider>
      </main>
    </div>
  );
}
