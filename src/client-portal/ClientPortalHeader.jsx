import React from 'react';
import { Bell, LogOut, LogIn } from 'lucide-react';

export default function ClientPortalHeader({
  systemSettings, lang, changeLang, selectedTab, t,
  activeNow, workers, showNotifDropdown, setShowNotifDropdown,
  notifRef, clientSession, handleLogout,
}) {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-10 w-full shadow-sm">
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <img
            src={systemSettings?.companyLogo || 'MAGNETIC (3).png'}
            alt="Logo"
            className="h-14 w-auto object-contain"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
          <span className="font-bold text-base tracking-tighter uppercase text-slate-900 hidden md:inline">
            {systemSettings?.companyName || 'Magnetic Place'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <button onClick={() => changeLang('pt')} title="Português" className={`flex items-center p-1.5 rounded-lg transition-all ${lang === 'pt' ? 'opacity-100' : 'opacity-30 hover:opacity-60'}`}>
              <span className="inline-flex h-3.5 w-5 rounded-sm overflow-hidden flex-shrink-0 shadow-sm">
                <span className="w-2/5 bg-green-700" /><span className="w-3/5 bg-red-600" />
              </span>
            </button>
            <button onClick={() => changeLang('es')} title="Español" className={`flex items-center p-1.5 rounded-lg transition-all ${lang === 'es' ? 'opacity-100' : 'opacity-30 hover:opacity-60'}`}>
              <span className="inline-flex flex-col h-3.5 w-5 rounded-sm overflow-hidden flex-shrink-0 shadow-sm">
                <span className="flex-1 bg-red-600" /><span className="flex-[2] bg-yellow-400" /><span className="flex-1 bg-red-600" />
              </span>
            </button>
          </div>
          {selectedTab === 'dashboard' && (
            <div className="relative" ref={notifRef}>
              <button onClick={() => setShowNotifDropdown(s => !s)} className="relative p-1.5 text-slate-500 hover:text-slate-800 transition-all">
                <Bell size={18} />
                {activeNow.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">{activeNow.length}</span>
                )}
              </button>
              {showNotifDropdown && (
                <div className="absolute right-0 mt-2 w-72 max-w-[calc(100vw-1rem)] bg-white rounded-2xl shadow-xl border border-slate-200 z-50 overflow-hidden">
                  <div className="p-4 border-b border-slate-100 bg-indigo-50 flex items-center gap-2">
                    <Bell size={16} className="text-indigo-600" />
                    <span className="font-black text-slate-800 text-sm uppercase tracking-widest">{t('notifications')}</span>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {activeNow.length === 0 ? (
                      <div className="p-4 text-center text-slate-400 text-xs font-bold">{t('no_notifications')}</div>
                    ) : (
                      activeNow.map((log) => {
                        const w = workers.find(wk => String(wk.id) === String(log.workerId));
                        return (
                          <div key={log.id} className="p-3 border-b border-slate-50 last:border-0">
                            <p className="font-black text-slate-700 text-xs">{w?.name || 'Colaborador'}</p>
                            <p className="text-slate-400 text-[10px]">{t('on_duty_since')} {log.startTime}</p>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          {clientSession ? (
            <button onClick={handleLogout} className="p-1.5 text-slate-400 hover:text-rose-500 transition-all" title="Sair">
              <LogOut size={18} />
            </button>
          ) : (
            <a href="https://painelcliente.magneticplace.pt/" className="p-1.5 text-indigo-500 hover:text-indigo-700 transition-all" title="Efetuar Login">
              <LogIn size={18} />
            </a>
          )}
        </div>
      </div>
    </header>
  );
}
