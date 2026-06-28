import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  LayoutGrid, Trophy, Building2, Clock, FileText, BarChart3,
  Wallet, Settings, LogOut, X, Users, CalendarX, ShieldCheck,
  AlertTriangle, Send, ChevronRight, ChevronDown,
  FolderOpen, Mail, ReceiptText, Coins, TrendingUp, Receipt, FileSignature, BarChart2, BookOpen, ArrowRightLeft, Landmark, ListChecks, Truck,
} from 'lucide-react';
import CompanyLogo from '../../components/common/CompanyLogo';

const MENU_STRUCTURE = [
  { id: 'overview', label: 'Geral', icon: LayoutGrid },
  {
    id: 'team', label: 'Equipa', icon: Trophy, badgeType: 'team',
    subtabs: [
      { id: 'workers', label: 'Colaboradores', icon: Users, path: '/admin/team?subtab=workers' },
      { id: 'absences', label: 'Faltas', icon: CalendarX, path: '/admin/team?subtab=absences', badgeType: 'absences', color: 'orange' },
      { id: 'validacao', label: 'Validação', icon: ShieldCheck, path: '/admin/team?subtab=validacao', color: 'emerald' },
      { id: 'correcoes', label: 'Correções', icon: AlertTriangle, path: '/admin/team?subtab=correcoes', badgeType: 'workerCorrections', color: 'amber' },
    ],
  },
  {
    id: 'clients', label: 'Clientes', icon: Building2, badgeType: 'clients',
    subtabs: [
      { id: 'list', label: 'Clientes', icon: Building2, path: '/admin/clients?subtab=list' },
      { id: 'envios', label: 'Envios', icon: Send, path: '/admin/clients?subtab=envios', color: 'blue' },
      { id: 'correcoes', label: 'Correções', icon: AlertTriangle, path: '/admin/clients?subtab=correcoes', badgeType: 'clientCorrections', color: 'orange' },
    ],
  },
  {
    id: 'fornecedores', label: 'Fornecedores', icon: Truck,
    subtabs: [
      { id: 'forn-list', label: 'Fornecedores', icon: Truck, path: '/admin/fornecedores?subtab=list' },
    ],
  },
  { id: 'schedules', label: 'Horários', icon: Clock },
  {
    id: 'documentos', label: 'Documentos', icon: FolderOpen,
    subtabs: [
      { id: 'doc-docs',      label: 'Documentos',    icon: FileText,      path: '/admin/documentos/documentos',                    color: 'indigo' },
      { id: 'doc-templates', label: 'Templates',     icon: FileSignature, path: '/admin/documentos/templates',                     color: 'indigo' },
      { id: 'fat-importar',  label: 'Importar Fat.', icon: Mail,          path: '/admin/documentos/faturas/importar',              color: 'blue' },
      { id: 'fat-fornec',    label: 'Fat. Fornec.',  icon: Receipt,       path: '/admin/documentos/faturas/fornecedores',          color: 'blue' },
      { id: 'rec-recibos',   label: 'Recibos',       icon: ReceiptText,   path: '/admin/documentos/reconciliacao/recibos',         color: 'emerald' },
      { id: 'rec-salarios',  label: 'Salários',      icon: Coins,         path: '/admin/documentos/reconciliacao/salarios',        color: 'emerald' },
      { id: 'rec-movs',      label: 'Movimentações', icon: TrendingUp,    path: '/admin/documentos/reconciliacao/movimentacoes',   color: 'emerald' },
      { id: 'rec-bancaria',  label: 'Bancária',      icon: Landmark,      path: '/admin/documentos/reconciliacao/bancaria',        color: 'emerald' },
      { id: 'pag-fornecedores', label: 'Pagamentos',    icon: ArrowRightLeft, path: '/admin/documentos/pagamentos/pagamentos-fornecedores', color: 'violet' },
      { id: 'pag-fila',        label: 'Fila de Pag.',  icon: ListChecks,    path: '/admin/documentos/pagamentos/fila',                    color: 'violet' },
      { id: 'banco-movs',      label: 'Conta Bancária', icon: Landmark,     path: '/admin/documentos/banco/movimentacoes',               color: 'blue' },
    ],
  },
  { id: 'reports', label: 'Folhas', icon: BarChart3 },
  { id: 'costs', label: 'Custos', icon: Wallet },
  {
    id: 'toconline', label: 'TOConline', icon: BookOpen,
    subtabs: [
      { id: 'toc-documentos', label: 'Documentos',  icon: FileText,  path: '/admin/toconline?subtab=documentos', color: 'blue' },
      { id: 'toc-clientes',   label: 'Clientes',    icon: Users,     path: '/admin/toconline?subtab=clientes',   color: 'blue' },
      { id: 'toc-artigos',    label: 'Artigos',      icon: Receipt,   path: '/admin/toconline?subtab=artigos',    color: 'blue' },
      { id: 'toc-relatorios', label: 'Relatórios',  icon: BarChart2, path: '/admin/toconline?subtab=relatorios', color: 'blue' },
    ],
  },
  { id: 'settings', label: 'Configurações', icon: Settings },
];

const ACCENT = {
  orange: 'text-orange-500',
  emerald: 'text-emerald-600',
  amber: 'text-amber-500',
  blue: 'text-blue-600',
  violet: 'text-violet-600',
  sky: 'text-sky-600',
};

function resolveBadge(badgeType, counts) {
  if (!badgeType || !counts) return 0;
  if (badgeType === 'team') return (counts.absences || 0) + (counts.workerCorrections || 0);
  if (badgeType === 'clients') return counts.clientCorrections || 0;
  return counts[badgeType] || 0;
}

function SubSubFlyout({ subtabs, anchorTop, onNavigate, onMouseEnter, onMouseLeave }) {
  const style = { top: Math.max(8, anchorTop), left: 416, zIndex: 410 };
  const el = (
    <div
      className="fixed bg-white border border-slate-200 rounded-2xl shadow-2xl shadow-slate-200/60 py-1.5 min-w-[160px]"
      style={style}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {subtabs.map(st => (
        <button
          key={st.id}
          onClick={() => onNavigate(st.path)}
          className="w-full flex items-center px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 transition-colors text-left"
        >
          {st.label}
        </button>
      ))}
    </div>
  );
  const portal = document.getElementById('flyout-root');
  return portal ? ReactDOM.createPortal(el, portal) : el;
}

function SubFlyout({ subtabs, top, counts, onNavigate, onMouseEnter, onMouseLeave }) {
  const [hoveredId, setHoveredId] = useState(null);
  const [subTop, setSubTop] = useState(0);
  const hideSubTimer = useRef(null);

  const clearHideSub = () => clearTimeout(hideSubTimer.current);
  const scheduleHideSub = () => {
    hideSubTimer.current = setTimeout(() => setHoveredId(null), 160);
  };

  const handleSubEnter = (st, e) => {
    if (!st.subtabs) { setHoveredId(null); return; }
    clearHideSub();
    const rect = e.currentTarget.getBoundingClientRect();
    setSubTop(rect.top);
    setHoveredId(st.id);
  };

  const activeSub = subtabs.find(s => s.id === hoveredId);

  const style = { top: Math.max(8, top), left: 240, zIndex: 400 };
  const el = (
    <>
      <div
        className="fixed bg-white border border-slate-200 rounded-2xl shadow-2xl shadow-slate-200/60 py-1.5 min-w-[176px]"
        style={style}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        {subtabs.map(st => {
          const Icon = st.icon;
          const badge = resolveBadge(st.badgeType, counts);
          const accentCls = ACCENT[st.color] || 'text-slate-700';
          return (
            <button
              key={st.id}
              onClick={() => onNavigate(st.path)}
              onMouseEnter={(e) => handleSubEnter(st, e)}
              onMouseLeave={st.subtabs ? scheduleHideSub : undefined}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 transition-colors text-left"
            >
              {Icon && <Icon size={13} className={`shrink-0 ${accentCls}`} />}
              <span className="flex-1 truncate">{st.label}</span>
              {badge > 0 && (
                <span className="text-[9px] font-black bg-red-500 text-white px-1.5 py-0.5 rounded-full shrink-0">{badge}</span>
              )}
              {st.subtabs && <ChevronRight size={12} className="text-slate-400 shrink-0" />}
            </button>
          );
        })}
      </div>

      {hoveredId && activeSub?.subtabs && (
        <SubSubFlyout
          subtabs={activeSub.subtabs}
          anchorTop={subTop}
          onNavigate={onNavigate}
          onMouseEnter={() => { clearHideSub(); onMouseEnter(); }}
          onMouseLeave={() => { scheduleHideSub(); onMouseLeave(); }}
        />
      )}
    </>
  );
  const portal = document.getElementById('flyout-root');
  return portal ? ReactDOM.createPortal(el, portal) : el;
}

function NavList({ activeTab, setActiveTab, setAuditWorkerId, counts, onItemClick }) {
  const navigate = useNavigate();
  const hideTimer = useRef(null);
  const [hoveredTab, setHoveredTab] = useState(null);
  const [flyoutTop, setFlyoutTop] = useState(0);

  const clearHide = () => clearTimeout(hideTimer.current);
  const scheduleHide = () => {
    hideTimer.current = setTimeout(() => setHoveredTab(null), 160);
  };

  const handleTabEnter = (tab, e) => {
    if (!tab.subtabs) { scheduleHide(); return; }
    clearHide();
    const rect = e.currentTarget.getBoundingClientRect();
    setFlyoutTop(rect.top);
    setHoveredTab(tab.id);
  };

  const handleNavigate = (path) => {
    setHoveredTab(null);
    clearHide();
    const tabId = path.replace(/^\/admin\//, '').split(/[?/]/)[0];
    setActiveTab(tabId);
    setAuditWorkerId(null);
    navigate(path);
    onItemClick && onItemClick();
  };

  const activeFlyoutTab = MENU_STRUCTURE.find(t => t.id === hoveredTab);

  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
      {MENU_STRUCTURE.map(tab => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        const badge = resolveBadge(tab.badgeType, counts);
        return (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              setAuditWorkerId(null);
              onItemClick && onItemClick();
            }}
            onMouseEnter={(e) => handleTabEnter(tab, e)}
            onMouseLeave={scheduleHide}
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
            {tab.subtabs && (
              <ChevronRight size={12} className={`shrink-0 ${isActive ? 'text-white/60' : 'text-slate-300'}`} />
            )}
          </button>
        );
      })}

      {hoveredTab && activeFlyoutTab?.subtabs && (
        <SubFlyout
          subtabs={activeFlyoutTab.subtabs}
          top={flyoutTop}
          counts={counts}
          onNavigate={handleNavigate}
          onMouseEnter={clearHide}
          onMouseLeave={scheduleHide}
        />
      )}
    </nav>
  );
}

function MobileNavList({ activeTab, setActiveTab, setAuditWorkerId, counts, onItemClick }) {
  const navigate = useNavigate();
  const [expandedTab, setExpandedTab] = useState(activeTab);
  const [expandedSubtab, setExpandedSubtab] = useState(null);

  const handleTabClick = (tab) => {
    if (!tab.subtabs) {
      setActiveTab(tab.id);
      setAuditWorkerId(null);
      onItemClick && onItemClick();
      return;
    }
    setExpandedTab(prev => prev === tab.id ? null : tab.id);
    setExpandedSubtab(null);
    setActiveTab(tab.id);
    setAuditWorkerId(null);
  };

  const handleSubtabClick = (st) => {
    if (!st.subtabs) {
      navigate(st.path);
      onItemClick && onItemClick();
      return;
    }
    setExpandedSubtab(prev => prev === st.id ? null : st.id);
  };

  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
      {MENU_STRUCTURE.map(tab => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        const isExpanded = expandedTab === tab.id;
        const badge = resolveBadge(tab.badgeType, counts);
        return (
          <div key={tab.id}>
            <button
              onClick={() => handleTabClick(tab)}
              aria-current={isActive ? 'page' : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                  : 'text-slate-600 active:bg-slate-100'
              }`}
            >
              <Icon size={18} className="shrink-0" />
              <span className="flex-1 text-left truncate">{tab.label}</span>
              {badge > 0 && (
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                  isActive ? 'bg-white text-indigo-600' : 'bg-red-500 text-white'
                }`}>{badge}</span>
              )}
              {tab.subtabs && (
                <ChevronDown size={13} className={`shrink-0 transition-transform duration-200 ${
                  isExpanded ? 'rotate-180' : ''
                } ${isActive ? 'text-white/60' : 'text-slate-400'}`} />
              )}
            </button>

            {isExpanded && tab.subtabs && (
              <div className="mt-1 ml-3 pl-3 border-l-2 border-indigo-100 space-y-0.5 pb-1">
                {tab.subtabs.map(st => {
                  const StIcon = st.icon;
                  const stBadge = resolveBadge(st.badgeType, counts);
                  const accentCls = ACCENT[st.color] || 'text-slate-600';
                  const isSubExpanded = expandedSubtab === st.id;
                  return (
                    <div key={st.id}>
                      <button
                        onClick={() => handleSubtabClick(st)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all active:bg-slate-50 ${accentCls}`}
                      >
                        {StIcon && <StIcon size={13} className="shrink-0" />}
                        <span className="flex-1 text-left truncate">{st.label}</span>
                        {stBadge > 0 && (
                          <span className="text-[9px] font-black bg-red-500 text-white px-1.5 py-0.5 rounded-full shrink-0">{stBadge}</span>
                        )}
                        {st.subtabs && (
                          <ChevronDown size={12} className={`shrink-0 text-slate-400 transition-transform duration-200 ${isSubExpanded ? 'rotate-180' : ''}`} />
                        )}
                      </button>

                      {isSubExpanded && st.subtabs && (
                        <div className="mt-0.5 ml-3 pl-3 border-l-2 border-slate-100 space-y-0.5">
                          {st.subtabs.map(sst => (
                            <button
                              key={sst.id}
                              onClick={() => { navigate(sst.path); onItemClick && onItemClick(); }}
                              className="w-full flex items-center px-3 py-1.5 rounded-lg text-xs font-bold text-slate-500 active:bg-slate-50 active:text-indigo-600 transition-colors text-left"
                            >
                              {sst.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

function UserFooter({ currentUser, onLogout, onSwitchToWorker, onItemClick }) {
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
      {onSwitchToWorker && (
        <button
          onClick={() => { onSwitchToWorker(); onItemClick && onItemClick(); }}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-indigo-600 hover:bg-indigo-50 transition-all"
        >
          <Users size={14} /> Meu painel de trabalhador
        </button>
      )}
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
  pendingAbsencesCount,
  pendingWorkerCorrectionsCount,
  pendingClientCorrectionsCount,
  currentUser,
  onLogout,
  onSwitchToWorker,
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

  const counts = {
    absences: pendingAbsencesCount || 0,
    workerCorrections: pendingWorkerCorrectionsCount || 0,
    clientCorrections: pendingClientCorrectionsCount || 0,
  };

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
        counts={counts}
      />
      <UserFooter currentUser={currentUser} onLogout={onLogout} onSwitchToWorker={onSwitchToWorker} />
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
        <MobileNavList
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          setAuditWorkerId={setAuditWorkerId}
          counts={counts}
          onItemClick={onClose}
        />
        <UserFooter currentUser={currentUser} onLogout={onLogout} onSwitchToWorker={onSwitchToWorker} onItemClick={onClose} />
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
