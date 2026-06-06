import React from 'react';
import { Bell, BarChart3, LogOut, Users, Menu, ChevronLeft } from 'lucide-react';

const TAB_LABELS = {
  overview: 'Geral',
  team: 'Equipa',
  clients: 'Clientes',
  portal_validacao: 'Portal Validação',
  schedules: 'Horários',
  documentos: 'Documentos',
  reports: 'Folhas',
  costs: 'Custos',
  settings: 'Configurações',
  notificacoes: 'Notificações',
};

export default function AdminTopbar({
  activeTab,
  unreadCount,
  onToggleNotifDropdown,
  onOpenFinReport,
  onLogout,
  onSwitchToWorker,
  onOpenMobileNav,
  showBackToTeam,
  onBackToTeam,
}) {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <button
          onClick={onOpenMobileNav}
          aria-label="Abrir menu"
          className="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-all shrink-0"
        >
          <Menu size={20} />
        </button>
        {showBackToTeam ? (
          <button
            onClick={onBackToTeam}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-black text-indigo-600 hover:bg-indigo-50 transition-all"
          >
            <ChevronLeft size={16} /> Voltar à equipa
          </button>
        ) : (
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Administração</p>
            <p className="text-sm font-black text-slate-800 truncate">{TAB_LABELS[activeTab] || 'Geral'}</p>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <button
          data-notif-bell
          onClick={onToggleNotifDropdown}
          className="flex items-center justify-center p-2 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-100 hover:bg-indigo-600 hover:text-white transition-all shadow-sm relative"
          aria-label="Notificações"
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] px-1.5 py-0.5 rounded-full font-black">
              {unreadCount}
            </span>
          )}
        </button>

        <button
          onClick={onOpenFinReport}
          className="hidden sm:flex items-center justify-center p-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100 hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
          aria-label="Relatório financeiro"
          title="Relatório financeiro"
        >
          <BarChart3 size={18} />
        </button>

        {onSwitchToWorker && (
          <button
            onClick={onSwitchToWorker}
            className="hidden md:flex items-center justify-center p-2 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-100 hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
            aria-label="Ver como trabalhador"
            title="Ver como trabalhador"
          >
            <Users size={18} />
          </button>
        )}

        <button
          onClick={onLogout}
          className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
          aria-label="Terminar sessão"
          title="Terminar sessão"
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}
