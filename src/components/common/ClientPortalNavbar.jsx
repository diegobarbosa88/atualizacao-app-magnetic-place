import React, { useState, useRef, useEffect } from 'react';
import { Bell, ChevronLeft, ChevronRight, LogOut, X, CheckCircle, AlertCircle, Sparkles } from 'lucide-react';

export default function ClientPortalNavbar({
  clientObj,
  selectedMonth,
  setSelectedMonth,
  selectedTab,
  setSelectedTab,
  availableMonths = [],
  getMonthName,
  onLogout,
  workers,
  clientLogs,
  now,
  formatElapsed,
  systemSettings,
  lang,
  changeLang,
  myNotifications = []
}) {
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const notifRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const tabs = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'historico', label: 'Histórico' },
    { id: 'validar', label: 'Validar' },
  ];

  const handleMonthPrev = () => {
    const idx = availableMonths.indexOf(selectedMonth);
    if (idx < availableMonths.length - 1 && idx !== -1) {
      setSelectedMonth(availableMonths[idx + 1]);
    } else if (idx === -1 && availableMonths.length > 0) {
      setSelectedMonth(availableMonths[0]);
    }
  };

  const handleMonthNext = () => {
    const idx = availableMonths.indexOf(selectedMonth);
    if (idx > 0) {
      setSelectedMonth(availableMonths[idx - 1]);
    }
  };

  const todayStr = new Date().toLocaleDateString('en-CA');
  const activeNow = clientLogs.filter(l => l.date === todayStr && l.startTime && !l.endTime);

  return (
    <nav className="bg-white border-b border-slate-200 min-h-[4rem] sticky top-0 z-40 shadow-sm py-3 px-4 md:px-0">
      <div className="mx-auto md:px-10 lg:px-16 flex flex-col md:flex-row items-center justify-between gap-2 md:gap-6" style={{ maxWidth: `var(--app-max-width, 1400px)` }}>
        {/* Left: Logo + Company Name */}
        <div className="flex items-center justify-between w-full md:w-auto">
          <div className="flex items-center gap-3 font-black text-xl tracking-tighter uppercase shrink-0">
            <img
              src={systemSettings?.companyLogo || 'MAGNETIC (3).png'}
              alt="Logo"
              className="h-8 w-auto object-contain"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
            <span className="hidden md:inline">{systemSettings?.companyName || 'Magnetic Place'}</span>
          </div>
          {/* Mobile Actions */}
          <div className="flex md:hidden items-center gap-2">
            <button data-notif-bell onClick={() => setShowNotifDropdown(s => !s)} className="flex items-center justify-center p-2 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-100 relative">
              <Bell size={18} />
              {activeNow.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">{activeNow.length}</span>
              )}
            </button>
            <button onClick={onLogout} className="flex items-center justify-center p-2 bg-rose-50 text-rose-600 rounded-xl border border-rose-100">
              <LogOut size={18} />
            </button>
          </div>
        </div>

        {/* Center: Tab Pills Navigation */}
        <div className="flex-1 flex justify-center w-full md:w-auto">
          <div className="flex menu-scroll w-full md:w-auto items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200 overflow-x-auto" style={{ scrollbarWidth: 'thin', msOverflowStyle: 'auto' }}>
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setSelectedTab(t.id)}
                className={`flex-shrink-0 whitespace-nowrap px-3 sm:px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all relative ${selectedTab === t.id ? 'bg-white text-indigo-600 shadow-md scale-105' : 'text-slate-400 hover:text-slate-600'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="hidden md:flex items-center gap-4 shrink-0">
          {/* Month Selector */}
          {selectedMonth && (
            <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-200">
              <button onClick={handleMonthPrev} className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-500 transition-all"><ChevronLeft size={14} /></button>
              <span className="font-bold text-xs uppercase tracking-widest text-indigo-600 min-w-[100px] text-center">
                {getMonthName(selectedMonth)}
              </span>
              <button onClick={handleMonthNext} className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-500 transition-all"><ChevronRight size={14} /></button>
            </div>
          )}

          {/* Language Switcher */}
          <div className="flex rounded-xl overflow-hidden border border-slate-200 shadow-inner">
            <button onClick={() => changeLang('pt')} title="Português" className={`flex items-center gap-1.5 px-3 py-2 transition-all ${lang === 'pt' ? 'bg-indigo-50' : 'bg-white opacity-50 hover:opacity-80'}`}>
              <span className="inline-flex h-3.5 w-5 rounded-sm overflow-hidden flex-shrink-0 shadow-sm">
                <span className="w-2/5 bg-green-700" /><span className="w-3/5 bg-red-600" />
              </span>
              <span className="text-[9px] font-black text-slate-600">PT</span>
            </button>
            <button onClick={() => changeLang('es')} title="Español" className={`flex items-center gap-1.5 px-3 py-2 transition-all border-l border-slate-200 ${lang === 'es' ? 'bg-indigo-50' : 'bg-white opacity-50 hover:opacity-80'}`}>
              <span className="inline-flex flex-col h-3.5 w-5 rounded-sm overflow-hidden flex-shrink-0 shadow-sm">
                <span className="flex-1 bg-red-600" /><span className="flex-[2] bg-yellow-400" /><span className="flex-1 bg-red-600" />
              </span>
              <span className="text-[9px] font-black text-slate-600">ES</span>
            </button>
          </div>

          {/* Notifications Bell */}
          <div className="relative" ref={notifRef}>
            <button data-notif-bell onClick={() => setShowNotifDropdown(s => !s)} className="flex items-center justify-center p-2 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-100 relative hover:bg-indigo-100 transition-all">
              <Bell size={18} />
              {activeNow.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">{activeNow.length}</span>
              )}
            </button>

            {showNotifDropdown && (
              <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-indigo-50 flex items-center gap-2">
                  <Bell size={16} className="text-indigo-600" />
                  <span className="font-black text-slate-800 text-sm uppercase tracking-widest">Notificações</span>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {activeNow.length === 0 ? (
                    <div className="p-4 text-center text-slate-400 text-xs font-bold">Nenhuma notificação</div>
                  ) : (
                    activeNow.map((log, i) => {
                      const w = workers.find(wk => String(wk.id) === String(log.workerId));
                      return (
                        <div key={log.id} className="p-3 border-b border-slate-50 last:border-0">
                          <p className="font-black text-slate-700 text-xs">{w?.name || 'Colaborador'}</p>
                          <p className="text-slate-400 text-[10px]">Em serviço desde {log.startTime}</p>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Logout */}
          <button onClick={onLogout} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 font-black text-[10px] uppercase tracking-widest transition-all">
            <LogOut size={14} /> Sair
          </button>
        </div>
      </div>
    </nav>
  );
}