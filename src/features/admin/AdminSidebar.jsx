import React, { useEffect, useRef } from 'react';
import {
  LayoutGrid, Trophy, Building2, Bell, Clock, FileText, BarChart3,
  Wallet, Settings, LogOut, X
} from 'lucide-react';
import CompanyLogo from '../../components/common/CompanyLogo';

const TABS = [
  { id: 'overview', label: 'Geral', icon: LayoutGrid },
  { id: 'team', label: 'Equipa', icon: Trophy },
  { id: 'clients', label: 'Clientes', icon: Building2 },
  { id: 'portal_validacao', label: 'Portal Validação', icon: Bell, showBadge: true },
  { id: 'schedules', label: 'Horários', icon: Clock },
  { id: 'documentos', label: 'Documentos', icon: FileText },
  { id: 'reports', label: 'Folhas', icon: BarChart3 },
  { id: 'costs', label: 'Custos', icon: Wallet },
  { id: 'settings', label: 'Configurações', icon: Settings },
];

function NavList({ activeTab, setActiveTab, setAuditWorkerId, totalPendingCorrections, onItemClick }) {
  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
      {TABS.map(tab => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        const badge = tab.showBadge ? totalPendingCorrections : 0;
        return (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              setAuditWorkerId(null);
              onItemClick && onItemClick();
            }}
            aria-current={isActive ? 'page' : undefined}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${
              isActive
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Icon size={18} className="shrink-0" />
            <span className="flex-1 text-left truncate">{tab.label}</span>
            {badge > 0 && (
              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                isActive ? 'bg-white text-indigo-600' : 'bg-red-500 text-white'
              }`}>
                {badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

function UserFooter({ currentUser, onLogout, onItemClick }) {
  return (
    <div className="border-t border-slate-100 p-3 space-y-2">
      <div className="flex items-center gap-3 px-2 py-2">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center text-xs font-black shrink-0">
          {(currentUser?.name || 'A').slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black text-slate-800 truncate">{currentUser?.name || 'Admin'}</p>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Administrador</p>
        </div>
      </div>
      <button
        onClick={() => { onLogout(); onItemClick && onItemClick(); }}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-all"
      >
        <LogOut size={14} /> Terminar sessão
      </button>
    </div>
  );
}

export default function AdminSidebar({
  activeTab,
  setActiveTab,
  setAuditWorkerId,
  totalPendingCorrections,
  currentUser,
  onLogout,
  isMobileOpen,
  onClose,
}) {
  const drawerRef = useRef(null);
  const firstItemRef = useRef(null);

  useEffect(() => {
    if (!isMobileOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    setTimeout(() => {
      const firstBtn = drawerRef.current?.querySelector('button');
      firstBtn?.focus();
    }, 50);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isMobileOpen, onClose]);

  const desktop = (
    <aside className="hidden md:flex w-60 shrink-0 sticky top-0 h-screen flex-col bg-white border-r border-slate-200 shadow-sm">
      <div className="px-5 py-5 border-b border-slate-100 flex items-center gap-3">
        <CompanyLogo className="h-10 w-auto" />
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Admin</p>
          <p className="text-xs font-black text-slate-700 truncate">Menu Principal</p>
        </div>
      </div>
      <NavList
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        setAuditWorkerId={setAuditWorkerId}
        totalPendingCorrections={totalPendingCorrections}
      />
      <UserFooter currentUser={currentUser} onLogout={onLogout} />
    </aside>
  );

  const drawer = isMobileOpen ? (
    <div className="md:hidden fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <aside ref={drawerRef} className="relative w-64 max-w-[85vw] bg-white h-full flex flex-col shadow-2xl">
        <div className="px-5 py-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <CompanyLogo className="h-10 w-auto" />
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Admin</p>
              <p className="text-xs font-black text-slate-700 truncate">Menu Principal</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar menu"
            className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all shrink-0"
          >
            <X size={18} />
          </button>
        </div>
        <NavList
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          setAuditWorkerId={setAuditWorkerId}
          totalPendingCorrections={totalPendingCorrections}
          onItemClick={onClose}
        />
        <UserFooter currentUser={currentUser} onLogout={onLogout} onItemClick={onClose} />
      </aside>
    </div>
  ) : null;

  return (
    <>
      {desktop}
      {drawer}
      <span ref={firstItemRef} className="hidden" />
    </>
  );
}
