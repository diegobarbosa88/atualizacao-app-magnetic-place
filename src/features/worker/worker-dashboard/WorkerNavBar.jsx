import React from 'react';
import { LogOut, Timer, Users, UserCircle, Bell } from 'lucide-react';
import CompanyLogo from '../../../components/common/CompanyLogo';

const formatShortName = (fullName) => {
  if (!fullName) return '';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 2) return fullName;
  const middle = parts.slice(1, -1).map(p => p[0].toUpperCase() + '.').join(' ');
  return `${parts[0]} ${middle} ${parts[parts.length - 1]}`;
};

const formatTimeCompact = (timeStr) => {
  if (!timeStr) return '--h';
  const [h, m] = timeStr.split(':').map(Number);
  if (isNaN(h)) return '--h';
  return `${h}h${m === 0 ? '' : m.toString().padStart(2, '0')}`;
};

export default function WorkerNavBar({ currentUser, workerTab, setWorkerTab, activeWorkerSchedule, workerChangeRequests, onLogin, onLogout, alertCount, onOpenAlerts }) {
  const pendingRequests = (workerChangeRequests || []).filter(r => r.worker_id === currentUser?.id && r.status === 'pending').length;

  return (
    <>
      {currentUser?.isAdminImpersonating && (
        <div className="bg-indigo-600 text-white p-2 text-center text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-4 shadow-lg sticky top-0 z-[100]">
          <span>Modo Visualização Admin (Impersonando: {currentUser.name})</span>
          <button
            onClick={() => onLogin('admin')}
            className="bg-white text-indigo-600 px-3 py-1 rounded-full hover:bg-indigo-50 transition-all shadow-sm"
          >
            Voltar ao Painel Admin
          </button>
        </div>
      )}
      <nav className="bg-white border-b border-slate-200 h-16 flex items-center px-4 md:px-6 justify-between sticky top-0 z-40 shadow-sm">
        <button
          onClick={() => { setWorkerTab('home'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          className="flex items-center gap-3 hover:opacity-75 transition-opacity"
        >
          <CompanyLogo className="h-10 w-10 object-contain" />
          <div className="flex flex-col">
            <p className="text-sm sm:text-base font-black leading-none text-slate-800 uppercase tracking-tight">{formatShortName(currentUser?.name)}</p>
            <p className="text-[9px] sm:text-[10px] text-indigo-500 uppercase font-black tracking-widest mt-1">{currentUser?.profissao || 'Colaborador'}</p>
          </div>
        </button>
        <div className="flex items-center gap-2 sm:gap-4">
          {alertCount > 0 && (
            <button
              onClick={onOpenAlerts}
              className="relative p-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-xl transition-all shadow-sm"
              title="Avisos pendentes"
            >
              <Bell size={18} />
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-rose-500 rounded-full text-[9px] font-black text-white flex items-center justify-center px-1">
                {alertCount}
              </span>
            </button>
          )}
          <button
            onClick={() => setWorkerTab(t => t === 'horarios' ? 'home' : 'horarios')}
            className={`flex items-center gap-2 p-2 sm:px-4 sm:py-2 rounded-xl text-xs font-black shadow-sm ${workerTab === 'horarios' ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-600'}`}
          >
            {activeWorkerSchedule && (
              <span className="hidden sm:inline-block text-[9px] sm:text-xs opacity-70 border-r border-indigo-200 pr-2 mr-1 leading-tight text-right uppercase">
                <span className="block">{formatTimeCompact(activeWorkerSchedule.startTime)} - {formatTimeCompact(activeWorkerSchedule.endTime)}</span>
                {activeWorkerSchedule.breakStart && (
                  <span className="block text-[8px] sm:text-[9px] font-bold text-indigo-400/80">
                    P: {formatTimeCompact(activeWorkerSchedule.breakStart)}-{formatTimeCompact(activeWorkerSchedule.breakEnd)}
                  </span>
                )}
              </span>
            )}
            <Timer size={16} className="shrink-0" />
            <span className="hidden sm:inline">Meus Horários</span>
          </button>
          <button
            onClick={() => setWorkerTab(t => t === 'perfil' ? 'home' : 'perfil')}
            className={`p-2 rounded-xl transition-all relative ${workerTab === 'perfil' ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-600'}`}
            title="Meu Perfil"
          >
            <UserCircle size={18} />
            {pendingRequests > 0 && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-amber-400 rounded-full text-[8px] font-black text-white flex items-center justify-center">
                {pendingRequests}
              </span>
            )}
          </button>
          {currentUser?.isAdmin && !currentUser?.isAdminImpersonating && (
            <button onClick={() => onLogin('admin', currentUser)} className="flex items-center justify-center p-2 bg-indigo-600 text-white rounded-xl shadow-sm hover:bg-indigo-700 transition-all">
              <Users size={18} />
            </button>
          )}
          <button onClick={onLogout} className="p-2 text-slate-400 hover:text-red-600 transition-all"><LogOut size={18} /></button>
        </div>
      </nav>
    </>
  );
}
