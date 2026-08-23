import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Settings, Bell, BarChart3, LogOut, Users
} from 'lucide-react';
import CompanyLogo from '../../components/common/CompanyLogo';
import { ADMIN_SECTIONS, resolveBadge } from './adminNavConfig';

export default function AdminClassicNav({
  activeTab,
  setActiveTab,
  setAuditWorkerId,
  pendingAbsencesCount,
  pendingWorkerCorrectionsCount,
  pendingClientCorrectionsCount,
  currentUser,
  unreadCount,
  systemSettings,
  onToggleNotifDropdown,
  onOpenFinReport,
  onLogout,
  onLogin,
}) {
  const navigate = useNavigate();
  const location = useLocation();

  const counts = {
    absences: pendingAbsencesCount || 0,
    workerCorrections: pendingWorkerCorrectionsCount || 0,
    clientCorrections: pendingClientCorrectionsCount || 0,
  };

  const activeSection = ADMIN_SECTIONS.find(s => s.id === activeTab);
  const activeSubtabs = activeSection?.subtabs || [];

  const isSubtabActive = (subtab) => {
    const [spath, ssearch] = subtab.path.split('?');
    if (location.pathname !== spath) return false;
    if (!ssearch) return true;
    return location.search === '?' + ssearch;
  };

  return (
    <nav className="bg-white border-b border-[var(--border)] min-h-[4rem] sticky top-0 z-40 shadow-sm py-3 px-4 md:px-0">
      <div
        className="mx-auto md:px-10 lg:px-16 flex flex-col md:flex-row items-center justify-between gap-2 md:gap-6"
        style={{ maxWidth: `var(--app-max-width)` }}
      >
        <div className="flex items-center justify-between w-full md:w-auto">
          <div className="flex items-center gap-3 font-bold text-base tracking-tighter uppercase shrink-0">
            <CompanyLogo className="h-14 w-auto" />
            <span className="hidden md:inline">{systemSettings?.companyName}</span>
          </div>
          <div className="flex md:hidden items-center gap-1">
            <button
              data-notif-bell
              onClick={onToggleNotifDropdown}
              className="flex items-center justify-center p-2 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-100 relative"
            >
              <Bell size={17} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] px-1.5 py-0.5 rounded-full">
                  {unreadCount}
                </span>
              )}
            </button>
            {currentUser?.isAdmin && (
              <button
                onClick={() => onLogin && onLogin('worker', currentUser)}
                className="flex items-center justify-center p-2 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-100"
              >
                <Users size={18} />
              </button>
            )}
            <button
              onClick={onOpenFinReport}
              className="flex items-center justify-center p-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100"
            >
              <BarChart3 size={18} />
            </button>
            <button onClick={onLogout} className="p-2 text-[var(--slate)]">
              <LogOut size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 flex justify-center w-full md:w-auto relative">
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white/80 to-transparent z-10 rounded-r-2xl md:hidden" />
          <div
            className="flex menu-scroll w-full md:w-auto items-center gap-1 bg-[var(--surface-dim)] p-1 rounded-2xl border border-[var(--border)] overflow-x-auto"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {ADMIN_SECTIONS.map(t => {
              const isActive = activeTab === t.id;
              const badge = resolveBadge(t.badgeType, counts);
              return (
                <button
                  key={t.id}
                  onClick={() => { setActiveTab(t.id); setAuditWorkerId(null); }}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex-shrink-0 whitespace-nowrap px-3 sm:px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all relative ${
                    isActive ? 'bg-white text-indigo-600 shadow-md scale-105' : 'text-[var(--slate-dim)] hover:text-[var(--ink-soft)]'
                  }`}
                >
                  {t.id === 'settings' ? <Settings size={14} /> : badge > 0 ? (
                    <span className="flex items-center gap-1">
                      {t.label}
                      <span className="bg-red-500 text-white text-[8px] px-1.5 py-0.5 rounded-full">{badge}</span>
                    </span>
                  ) : t.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="hidden md:flex items-center gap-4 shrink-0">
          <button
            data-notif-bell
            onClick={onToggleNotifDropdown}
            className="flex items-center justify-center p-1 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-100 hover:bg-indigo-600 hover:text-white transition-all shadow-sm relative"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] px-1.5 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </button>
          <button
            onClick={onOpenFinReport}
            className="flex items-center justify-center p-1 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100 hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
          >
            <BarChart3 size={18} />
          </button>
          {currentUser?.isAdmin && (
            <button
              onClick={() => onLogin && onLogin('worker', currentUser)}
              className="flex items-center justify-center p-1 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-100 hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
            >
              <Users size={18} />
            </button>
          )}
          <button
            onClick={onLogout}
            className="p-1 text-[var(--slate)] hover:text-red-500 transition-colors"
          >
            <LogOut size={20} />
          </button>
        </div>
      </div>

      {activeSubtabs.length > 0 && (
        <div className="border-t border-[var(--border-soft)]">
          <div
            className="mx-auto md:px-10 lg:px-16 flex items-center overflow-x-auto"
            style={{ maxWidth: `var(--app-max-width)`, scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {activeSubtabs.map(st => {
              const isActive = isSubtabActive(st);
              const badge = resolveBadge(st.badgeType, counts);
              return (
                <button
                  key={st.id}
                  onClick={() => navigate(st.path)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex-shrink-0 whitespace-nowrap px-4 py-2 text-[10px] font-bold uppercase tracking-wider transition-all border-b-2 ${
                    isActive
                      ? 'text-indigo-600 border-indigo-500'
                      : 'text-[var(--slate-dim)] border-transparent hover:text-[var(--ink-soft)] hover:border-[var(--border)]'
                  }`}
                >
                  {badge > 0 ? (
                    <span className="flex items-center gap-1.5">
                      {st.label}
                      <span className="bg-red-500 text-white text-[8px] px-1.5 py-0.5 rounded-full leading-none">{badge}</span>
                    </span>
                  ) : st.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </nav>
  );
}
