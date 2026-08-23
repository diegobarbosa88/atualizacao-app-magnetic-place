import React from 'react';
import { LogOut, Timer, Users, UserCircle, Bell, Home, CalendarX, FileText, GraduationCap } from 'lucide-react';
import { FT, FONT_TITLE, FONT_MONO } from './formacaoDesignTokens';

const formatShortName = (fullName) => {
  if (!fullName) return '';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 2) return fullName;
  const middle = parts.slice(1, -1).map(p => p[0].toUpperCase() + '.').join(' ');
  return `${parts[0]} ${middle} ${parts[parts.length - 1]}`;
};

const getInitials = (fullName) => {
  if (!fullName) return '?';
  const parts = fullName.trim().split(/\s+/);
  return parts.length === 1
    ? parts[0][0].toUpperCase()
    : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const formatTimeCompact = (timeStr) => {
  if (!timeStr) return '--h';
  const [h, m] = timeStr.split(':').map(Number);
  if (isNaN(h)) return '--h';
  return `${h}h${m === 0 ? '' : m.toString().padStart(2, '0')}`;
};

const TabButton = ({ active, onClick, icon, label, badge }) => (
  <button
    onClick={onClick}
    className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 relative transition-colors"
    style={{ color: active ? FT.orange : FT.slateDim }}
  >
    {icon}
    <span className="text-[9px] font-black uppercase tracking-wide" style={{ fontFamily: FONT_MONO }}>{label}</span>
    {badge > 0 && (
      <span className="absolute top-1.5 right-[calc(50%-16px)] w-3.5 h-3.5 bg-amber-400 rounded-full text-[8px] font-black text-white flex items-center justify-center">
        {badge}
      </span>
    )}
  </button>
);

export default function WorkerNavBar({ currentUser, workerTab, setWorkerTab, activeWorkerSchedule, workerChangeRequests, onLogin, onLogout, alertCount, onOpenAlerts, onOpenAbsenceModal, onOpenScheduleModal, onOpenProfileModal, onOpenDocumentsModal, onOpenFormacaoModal, isCurrentMonth, absencePendingCount, documentsPendingCount, formacaoPendingCount, notifCount, onOpenNotifs }) {
  const pendingRequests = (workerChangeRequests || []).filter(r => r.worker_id === currentUser?.id && r.status === 'pending').length;
  const totalBellCount = (alertCount || 0) + (notifCount || 0);
  const handleBellClick = () => { if (alertCount > 0) onOpenAlerts(); else if (notifCount > 0) onOpenNotifs?.(); };

  return (
    <>
      {currentUser?.isAdminImpersonating && (
        <div className="bg-[var(--navy)] text-white p-2 text-center text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-4 shadow-lg sticky top-0 z-[100]">
          <span>Modo Visualização Admin (Impersonando: {currentUser.name})</span>
          <button
            onClick={() => onLogin('admin')}
            className="bg-white text-[var(--navy)] px-3 py-1 rounded-full hover:bg-[#EFEDE7] transition-all shadow-sm"
          >
            Voltar ao Painel Admin
          </button>
        </div>
      )}

      {/* Top bar */}
      <nav className="bg-white border-b border-slate-200 h-16 flex items-center px-4 md:px-6 justify-between sticky top-0 z-40 shadow-sm">
        <button
          onClick={() => { setWorkerTab('home'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          className="flex items-center gap-3 hover:opacity-75 transition-opacity"
        >
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
            style={{ background: FT.navyDeep, color: FT.orange, border: `2px solid ${FT.orange}`, fontFamily: FONT_TITLE, fontWeight: 800, fontSize: 14 }}
          >
            {getInitials(currentUser?.name)}
          </div>
          <div className="flex flex-col">
            <p className="text-sm sm:text-base leading-none tracking-tight" style={{ fontFamily: FONT_TITLE, fontWeight: 800, color: FT.navyDeep }}>{formatShortName(currentUser?.name)}</p>
            <p className="text-[9px] sm:text-[10px] uppercase tracking-widest mt-1" style={{ fontFamily: FONT_MONO, fontWeight: 700, color: FT.orangeDeep }}>{currentUser?.profissao || 'Colaborador'}</p>
          </div>
        </button>

        <div className="flex items-center gap-2">
          {/* Sino — visível se há alertas ou notificações */}
          {totalBellCount > 0 && (
            <button
              onClick={handleBellClick}
              className="relative p-2 bg-[#1B3A57]/10 text-[var(--navy)] hover:bg-[var(--navy)] hover:text-white rounded-xl transition-all shadow-sm"
              title={alertCount > 0 ? 'Avisos pendentes' : 'Notificações'}
            >
              <Bell size={18} />
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-rose-500 rounded-full text-[9px] font-black text-white flex items-center justify-center px-1">
                {totalBellCount}
              </span>
            </button>
          )}

          {/* Botões de navegação — só desktop */}
          <div className="hidden sm:flex items-center gap-2">
            <button
              onClick={() => setWorkerTab(t => t === 'horarios' ? 'home' : 'horarios')}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-black shadow-sm transition-all ${workerTab === 'horarios' ? 'bg-[var(--navy)] text-white' : 'bg-[#1B3A57]/10 text-[var(--navy)] hover:bg-[#1B3A57]/20'}`}
            >
              {activeWorkerSchedule && (
                <span className="text-[9px] opacity-70 border-r border-current/20 pr-2 mr-1 leading-tight text-right uppercase">
                  <span className="block">{formatTimeCompact(activeWorkerSchedule.startTime)} - {formatTimeCompact(activeWorkerSchedule.endTime)}</span>
                  {activeWorkerSchedule.breakStart && (
                    <span className="block text-[8px] font-bold opacity-70">
                      P: {formatTimeCompact(activeWorkerSchedule.breakStart)}-{formatTimeCompact(activeWorkerSchedule.breakEnd)}
                    </span>
                  )}
                </span>
              )}
              <Timer size={15} className="shrink-0" />
              <span>Horários</span>
            </button>

            {isCurrentMonth && (
              <button
                onClick={onOpenAbsenceModal}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-black shadow-sm transition-all bg-orange-50 text-orange-500 hover:bg-orange-100 relative"
                title="Avisar Falta"
              >
                <CalendarX size={15} className="shrink-0" />
                <span>Falta</span>
                {absencePendingCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-orange-500 rounded-full text-[8px] font-black text-white flex items-center justify-center">
                    {absencePendingCount}
                  </span>
                )}
              </button>
            )}

            <button
              onClick={onOpenDocumentsModal}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-black shadow-sm transition-all bg-slate-50 text-slate-600 hover:bg-slate-100 relative"
              title="Documentos"
            >
              <FileText size={15} className="shrink-0" />
              <span>Documentos</span>
              {documentsPendingCount > 0 && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-rose-500 rounded-full text-[8px] font-black text-white flex items-center justify-center">
                  {documentsPendingCount}
                </span>
              )}
            </button>

            <button
              onClick={onOpenFormacaoModal}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-black shadow-sm transition-all bg-slate-50 text-slate-600 hover:bg-slate-100 relative"
              title="Formação"
            >
              <GraduationCap size={15} className="shrink-0" />
              <span>Formação</span>
              {formacaoPendingCount > 0 && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-rose-500 rounded-full text-[8px] font-black text-white flex items-center justify-center">
                  {formacaoPendingCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setWorkerTab(t => t === 'perfil' ? 'home' : 'perfil')}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-black shadow-sm transition-all relative ${workerTab === 'perfil' ? 'bg-[var(--navy)] text-white' : 'bg-[#1B3A57]/10 text-[var(--navy)] hover:bg-[#1B3A57]/20'}`}
              title="Meu Perfil"
            >
              <UserCircle size={15} />
              <span>Perfil</span>
              {pendingRequests > 0 && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-amber-400 rounded-full text-[8px] font-black text-white flex items-center justify-center">
                  {pendingRequests}
                </span>
              )}
            </button>

            {currentUser?.isAdmin && !currentUser?.isAdminImpersonating && (
              <button onClick={() => onLogin('admin', currentUser)} className="flex items-center gap-2 px-3 py-2 bg-[var(--navy)] text-white rounded-xl shadow-sm hover:bg-[var(--navy-deep)] transition-all text-xs font-black">
                <Users size={15} />
                <span>Admin</span>
              </button>
            )}
          </div>

          {/* Logout — sempre visível */}
          <button onClick={onLogout} className="p-2 text-slate-400 hover:text-red-600 transition-all">
            <LogOut size={18} />
          </button>
        </div>
      </nav>

      {/* Bottom tab bar — mobile only */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 flex sm:hidden shadow-[0_-4px_12px_rgba(0,0,0,0.06)] pb-[env(safe-area-inset-bottom)]">
        <TabButton
          active={workerTab === 'home'}
          onClick={() => { setWorkerTab('home'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          icon={<Home size={20} />}
          label="Home"
        />
        <TabButton
          active={false}
          onClick={onOpenScheduleModal}
          icon={<Timer size={20} />}
          label="Horários"
        />
        {isCurrentMonth && (
          <TabButton
            active={false}
            onClick={onOpenAbsenceModal}
            icon={
              <span className="relative inline-flex">
                <CalendarX size={20} />
                {absencePendingCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-orange-500" />
                )}
              </span>
            }
            label="Falta"
            accent
          />
        )}
        <TabButton
          active={false}
          onClick={onOpenDocumentsModal}
          icon={
            <span className="relative inline-flex">
              <FileText size={20} />
              {documentsPendingCount > 0 && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-rose-500" />
              )}
            </span>
          }
          label="Documentos"
        />
        <TabButton
          active={false}
          onClick={onOpenFormacaoModal}
          icon={
            <span className="relative inline-flex">
              <GraduationCap size={20} />
              {formacaoPendingCount > 0 && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-rose-500" />
              )}
            </span>
          }
          label="Formação"
        />
        <TabButton
          active={false}
          onClick={onOpenProfileModal}
          icon={<UserCircle size={20} />}
          label="Perfil"
          badge={pendingRequests}
        />
        {currentUser?.isAdmin && !currentUser?.isAdminImpersonating && (
          <TabButton
            onClick={() => onLogin('admin', currentUser)}
            icon={<Users size={20} />}
            label="Admin"
          />
        )}
      </nav>
    </>
  );
}
