import React from 'react';
import {
  Settings, Bell, BarChart3, LogOut, Users
} from 'lucide-react';
import CompanyLogo from '../../components/common/CompanyLogo';

const TABS = [
  { id: 'overview', label: 'Geral' },
  { id: 'team', label: 'Equipa', badgeType: 'team' },
  { id: 'clients', label: 'Clientes', badgeType: 'clients' },
  { id: 'schedules', label: 'Horários' },
  { id: 'documentos', label: 'Documentos' },
  { id: 'reports', label: 'Folhas' },
  { id: 'costs', label: 'Custos' },
  { id: 'settings', label: <Settings size={14} /> },
];

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
  return (
    <nav className="bg-white border-b border-slate-200 min-h-[4rem] sticky top-0 z-40 shadow-sm py-3 px-4 md:px-0">
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
              className="flex items-center justify-center p-1 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-100 relative"
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
                className="flex items-center justify-center p-1 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-100"
              >
                <Users size={18} />
              </button>
            )}
            <button
              onClick={onOpenFinReport}
              className="flex items-center justify-center p-1 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100"
            >
              <BarChart3 size={18} />
            </button>
            <button onClick={onLogout} className="p-1 text-slate-400">
              <LogOut size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 flex justify-center w-full md:w-auto relative">
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white/80 to-transparent z-10 rounded-r-2xl md:hidden" />
          <div
            className="flex menu-scroll w-full md:w-auto items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200 overflow-x-auto"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {TABS.map(t => {
              const isActive = activeTab === t.id;
              const badge = t.badgeType === 'team'
                ? (pendingAbsencesCount || 0) + (pendingWorkerCorrectionsCount || 0)
                : t.badgeType === 'clients'
                  ? (pendingClientCorrectionsCount || 0)
                  : 0;
              return (
                <button
                  key={t.id}
                  onClick={() => { setActiveTab(t.id); setAuditWorkerId(null); }}
                  className={`flex-shrink-0 whitespace-nowrap px-3 sm:px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all relative ${
                    isActive ? 'bg-white text-indigo-600 shadow-md scale-105' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {t.id === 'settings' ? t.label : badge > 0 ? (
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
            className="p-1 text-slate-400 hover:text-red-500 transition-colors"
          >
            <LogOut size={20} />
          </button>
        </div>
      </div>
    </nav>
  );
}
