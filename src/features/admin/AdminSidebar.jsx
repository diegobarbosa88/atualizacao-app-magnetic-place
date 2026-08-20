import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { LogOut, X, ChevronRight, ChevronDown, ChevronLeft, Users } from 'lucide-react';
import CompanyLogo from '../../components/common/CompanyLogo';
import { ADMIN_SECTIONS, resolveBadge } from './adminNavConfig';

// Paleta de marca
const B = {
  navy: '#1B3A57',
  orange: '#EB8D00',
  activeItemBg: 'rgba(235,141,0,0.18)',
  sectionLabel: '#869AAF',
  inactiveText: '#B9C6D4',
  inactiveIcon: '#869AAF',
  divider: 'rgba(255,255,255,0.15)',
  navBorder: 'rgba(255,255,255,0.08)',
  hoverBg: 'rgba(255,255,255,0.07)',
  flyoutActiveBg: 'rgba(235,141,0,0.12)',
  accordionGuide: 'rgba(235,141,0,0.35)',
};

// Fonte única de navegação (partilhada com AdminClassicNav) — ver adminNavConfig.js
const MENU_STRUCTURE = ADMIN_SECTIONS;

const MENU_GROUPS = [
  { id: 'principal',   label: 'PRINCIPAL',   itemIds: ['overview', 'team'] },
  { id: 'operacional', label: 'OPERACIONAL', itemIds: ['clients', 'fornecedores', 'schedules', 'documentos'] },
  { id: 'financeiro',  label: 'FINANCEIRO',  itemIds: ['faturacao', 'reconciliacao', 'pagamentos', 'reports', 'costs', 'recibos', 'mapa-salarios', 'toconline', 'ajudas-custo'] },
  { id: 'sistema',     label: 'SISTEMA',     itemIds: ['formacao', 'alertas', 'settings'] },
];

// Verifica se um path de subtab corresponde à URL atual
function useSubtabActive() {
  const location = useLocation();
  return (path) => {
    const [p, q] = path.split('?');
    if (!q) return location.pathname === p;
    return location.pathname === p && location.search.includes(q);
  };
}

// Flyout navy para modo recolhido (portal)
function SubFlyout({ subtabs, top, flyoutLeft, counts, onNavigate, onMouseEnter, onMouseLeave }) {
  const [hoveredId, setHoveredId] = useState(null);
  const isSubtabActive = useSubtabActive();

  const style = {
    position: 'fixed',
    top: Math.max(8, top),
    left: flyoutLeft,
    zIndex: 400,
    backgroundColor: B.navy,
    border: `1px solid ${B.orange}`,
    borderRadius: '7px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
    minWidth: '182px',
    paddingTop: '4px',
    paddingBottom: '4px',
  };

  const el = (
    <div style={style} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      {subtabs.map(st => {
        const Icon = st.icon;
        const badge = resolveBadge(st.badgeType, counts);
        const active = isSubtabActive(st.path);
        const hovered = hoveredId === st.id;
        const highlighted = active || hovered;
        return (
          <button
            key={st.id}
            onClick={() => onNavigate(st.path)}
            onMouseEnter={() => setHoveredId(st.id)}
            onMouseLeave={() => setHoveredId(null)}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-left"
            style={{
              color: highlighted ? 'white' : B.inactiveText,
              fontWeight: highlighted ? 500 : 400,
              backgroundColor: highlighted ? B.flyoutActiveBg : 'transparent',
              boxShadow: active ? `inset 2px 0 0 0 ${B.orange}` : 'none',
              transition: 'background-color 100ms ease, color 100ms ease',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {Icon && (
              <Icon size={13} className="shrink-0" style={{ color: highlighted ? B.orange : B.inactiveIcon }} />
            )}
            <span className="flex-1 truncate">{st.label}</span>
            {badge > 0 && (
              <span className="text-[9px] font-black bg-red-500 text-white px-1.5 py-0.5 rounded-full shrink-0">
                {badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
  const portal = document.getElementById('flyout-root');
  return portal ? ReactDOM.createPortal(el, portal) : el;
}

// Botão circular flutuante na borda direita da sidebar
function ToggleBtn({ collapsed, onToggle }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onToggle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
      style={{
        position: 'absolute',
        right: '-11px',
        top: '50%',
        transform: 'translateY(-50%)',
        width: '22px',
        height: '22px',
        borderRadius: '50%',
        backgroundColor: 'white',
        border: `1.5px solid ${hovered ? B.orange : B.sectionLabel}`,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        padding: 0,
        transition: 'border-color 150ms ease',
        zIndex: 20,
        boxShadow: '0 1px 5px rgba(0,0,0,0.2)',
      }}
    >
      {collapsed
        ? <ChevronRight size={13} style={{ color: B.navy }} />
        : <ChevronLeft size={13} style={{ color: B.navy }} />
      }
    </button>
  );
}

function NavList({ activeTab, setActiveTab, setAuditWorkerId, counts, onItemClick, collapsed }) {
  const navigate = useNavigate();
  const location = useLocation();
  const hideTimer = useRef(null);
  const [hoveredTab, setHoveredTab] = useState(null);
  const [hoveredBtn, setHoveredBtn] = useState(null);
  const [flyoutTop, setFlyoutTop] = useState(0);
  const [flyoutLeft, setFlyoutLeft] = useState(0);

  // Accordion: abre o pai da subpágina atual na inicialização
  const [expandedAccordion, setExpandedAccordion] = useState(() =>
    MENU_STRUCTURE.find(t =>
      t.subtabs?.some(st => {
        const [p, q] = st.path.split('?');
        return q ? location.pathname === p && location.search.includes(q) : location.pathname === p;
      })
    )?.id || null
  );

  // Fecha flyout ao alternar modo expandido/recolhido
  useEffect(() => {
    setHoveredTab(null);
    clearTimeout(hideTimer.current);
  }, [collapsed]);

  // Sincroniza accordion ao navegar com back/forward
  useEffect(() => {
    const match = MENU_STRUCTURE.find(t =>
      t.subtabs?.some(st => {
        const [p, q] = st.path.split('?');
        return q ? location.pathname === p && location.search.includes(q) : location.pathname === p;
      })
    );
    if (match) setExpandedAccordion(match.id);
  }, [location.pathname, location.search]);

  const clearHide = () => clearTimeout(hideTimer.current);
  const scheduleHide = () => {
    hideTimer.current = setTimeout(() => setHoveredTab(null), 160);
  };

  const isSubtabActive = (path) => {
    const [p, q] = path.split('?');
    if (!q) return location.pathname === p;
    return location.pathname === p && location.search.includes(q);
  };

  // Flyout só no modo recolhido
  const handleTabEnter = (tab, e) => {
    if (!collapsed || !tab.subtabs) { scheduleHide(); return; }
    clearHide();
    const rect = e.currentTarget.getBoundingClientRect();
    setFlyoutTop(rect.top);
    setFlyoutLeft(rect.right + 4);
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
    <nav className={`scroll-marca flex-1 overflow-y-auto py-3 ${collapsed ? 'px-2' : 'px-3'}`}>
      {MENU_GROUPS.map((group, groupIdx) => {
        const items = group.itemIds
          .map(id => MENU_STRUCTURE.find(t => t.id === id))
          .filter(Boolean);

        return (
          <div key={group.id} className={groupIdx > 0 ? 'mt-3' : ''}>
            {groupIdx > 0 && collapsed ? (
              <div style={{ height: '0.5px', backgroundColor: B.divider, margin: '0 4px 8px' }} />
            ) : (
              <p
                className={`px-3 mb-1 ${groupIdx > 0 ? 'mt-1' : ''}`}
                style={{
                  fontSize: '9.5px',
                  fontWeight: 500,
                  letterSpacing: '0.06em',
                  color: collapsed ? 'transparent' : B.sectionLabel,
                  textTransform: 'uppercase',
                  userSelect: 'none',
                  lineHeight: collapsed ? 0 : undefined,
                  height: collapsed ? 0 : undefined,
                  marginBottom: collapsed ? 0 : undefined,
                  overflow: 'hidden',
                }}
              >
                {group.label}
              </p>
            )}

            <div className="space-y-0.5">
              {items.map(tab => {
                const Icon = tab.icon;
                const isActive = tab.subtabs
                  ? tab.subtabs.some(st => isSubtabActive(st.path))
                  : activeTab === tab.id;
                const isHovered = hoveredBtn === tab.id;
                const badge = resolveBadge(tab.badgeType, counts);
                const accordionOpen = !collapsed && expandedAccordion === tab.id && !!tab.subtabs;

                return (
                  <div key={tab.id}>
                    <button
                      onClick={() => {
                        if (tab.subtabs) {
                          if (!collapsed) {
                            setExpandedAccordion(prev => prev === tab.id ? null : tab.id);
                          }
                        } else {
                          setActiveTab(tab.id);
                          setAuditWorkerId(null);
                          onItemClick && onItemClick();
                        }
                      }}
                      onMouseEnter={(e) => { setHoveredBtn(tab.id); handleTabEnter(tab, e); }}
                      onMouseLeave={() => { setHoveredBtn(null); scheduleHide(); }}
                      aria-current={isActive ? 'page' : undefined}
                      aria-expanded={tab.subtabs ? accordionOpen : undefined}
                      aria-controls={tab.subtabs ? `accordion-${tab.id}` : undefined}
                      title={collapsed ? tab.label : undefined}
                      style={{
                        backgroundColor: isActive ? B.activeItemBg : isHovered ? B.hoverBg : 'transparent',
                        boxShadow: isActive ? `inset 3px 0 0 0 ${B.orange}` : 'none',
                        transition: 'background-color 150ms ease, box-shadow 150ms ease',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                      className={`w-full flex items-center rounded-lg text-sm font-bold relative ${
                        collapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5'
                      }`}
                    >
                      <Icon size={18} className="shrink-0" style={{ color: isActive ? B.orange : B.inactiveIcon }} />
                      {!collapsed && (
                        <span className="flex-1 text-left truncate" style={{ color: isActive ? 'white' : B.inactiveText }}>
                          {tab.label}
                        </span>
                      )}
                      {!collapsed && badge > 0 && (
                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-red-500 text-white shrink-0">
                          {badge}
                        </span>
                      )}
                      {!collapsed && tab.subtabs && (
                        <ChevronDown
                          size={12}
                          className={`shrink-0 transition-transform duration-200 ${accordionOpen ? '' : '-rotate-90'}`}
                          style={{ color: accordionOpen ? B.orange : B.inactiveIcon }}
                        />
                      )}
                      {collapsed && badge > 0 && (
                        <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" />
                      )}
                    </button>

                    {/* Accordion de subitens (só no modo expandido) */}
                    {!collapsed && tab.subtabs && (
                      <div
                        id={`accordion-${tab.id}`}
                        style={{
                          maxHeight: accordionOpen ? '600px' : '0',
                          overflow: 'hidden',
                          opacity: accordionOpen ? 1 : 0,
                          transition: accordionOpen
                            ? 'max-height 200ms ease, opacity 150ms ease'
                            : 'max-height 150ms ease, opacity 80ms ease',
                        }}
                      >
                        <div
                          className="ml-4 pl-3 pb-1.5 pt-0.5 space-y-0.5"
                          style={{ borderLeft: `1px solid ${B.accordionGuide}` }}
                        >
                          {tab.subtabs.map(st => {
                            const StIcon = st.icon;
                            const stBadge = resolveBadge(st.badgeType, counts);
                            const subActive = isSubtabActive(st.path);
                            return (
                              <button
                                key={st.id}
                                onClick={() => handleNavigate(st.path)}
                                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-left"
                                style={{
                                  color: subActive ? 'white' : B.inactiveText,
                                  fontWeight: subActive ? 500 : 400,
                                  backgroundColor: subActive ? B.flyoutActiveBg : 'transparent',
                                  boxShadow: subActive ? `inset 2px 0 0 0 ${B.orange}` : 'none',
                                  transition: 'background-color 100ms ease',
                                  border: 'none',
                                  cursor: 'pointer',
                                }}
                              >
                                {StIcon && (
                                  <StIcon size={12} className="shrink-0" style={{ color: subActive ? B.orange : B.inactiveIcon }} />
                                )}
                                <span className="flex-1 truncate">{st.label}</span>
                                {stBadge > 0 && (
                                  <span className="text-[9px] font-black bg-red-500 text-white px-1.5 py-0.5 rounded-full shrink-0">
                                    {stBadge}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Flyout navy (só no modo recolhido) */}
      {hoveredTab && activeFlyoutTab?.subtabs && (
        <SubFlyout
          subtabs={activeFlyoutTab.subtabs}
          top={flyoutTop}
          flyoutLeft={flyoutLeft}
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
  const location = useLocation();
  const [expandedTab, setExpandedTab] = useState(activeTab);
  const [expandedSubtab, setExpandedSubtab] = useState(null);

  useEffect(() => {
    const match = MENU_STRUCTURE.find(t =>
      t.subtabs?.some(st => {
        const [p, q] = st.path.split('?');
        return q ? location.pathname === p && location.search.includes(q) : location.pathname === p;
      })
    );
    if (match) setExpandedTab(match.id);
  }, [location.pathname, location.search]);

  const isSubtabActive = (path) => {
    const [p, q] = path.split('?');
    if (!q) return location.pathname === p;
    return location.pathname === p && location.search.includes(q);
  };

  const handleTabClick = (tab) => {
    if (!tab.subtabs) {
      setActiveTab(tab.id);
      setAuditWorkerId(null);
      onItemClick && onItemClick();
      return;
    }
    setExpandedTab(prev => prev === tab.id ? null : tab.id);
    setExpandedSubtab(null);
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
    <nav className="scroll-marca flex-1 overflow-y-auto px-3 py-4">
      {MENU_GROUPS.map((group, groupIdx) => {
        const items = group.itemIds
          .map(id => MENU_STRUCTURE.find(t => t.id === id))
          .filter(Boolean);
        return (
          <div key={group.id} className={groupIdx > 0 ? 'mt-4' : ''}>
            <p className="px-3 mb-1 text-[9.5px] font-medium tracking-wide uppercase" style={{ color: B.sectionLabel }}>
              {group.label}
            </p>
            <div className="space-y-0.5">
              {items.map(tab => {
                const Icon = tab.icon;
                const isActive = tab.subtabs
                  ? tab.subtabs.some(st => isSubtabActive(st.path))
                  : activeTab === tab.id;
                const isExpanded = expandedTab === tab.id;
                const badge = resolveBadge(tab.badgeType, counts);
                return (
                  <div key={tab.id}>
                    <button
                      onClick={() => handleTabClick(tab)}
                      aria-current={isActive ? 'page' : undefined}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all"
                      style={{
                        backgroundColor: isActive ? B.activeItemBg : 'transparent',
                        boxShadow: isActive ? `inset 3px 0 0 0 ${B.orange}` : 'none',
                      }}
                    >
                      <Icon size={18} className="shrink-0" style={{ color: isActive ? B.orange : B.inactiveIcon }} />
                      <span className="flex-1 text-left truncate" style={{ color: isActive ? 'white' : B.inactiveText }}>
                        {tab.label}
                      </span>
                      {badge > 0 && (
                        <span
                          className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${isActive ? 'text-white' : 'bg-red-500 text-white'}`}
                          style={isActive ? { backgroundColor: B.orange } : {}}
                        >
                          {badge}
                        </span>
                      )}
                      {tab.subtabs && (
                        <ChevronDown
                          size={13}
                          className={`shrink-0 transition-transform duration-200 ${isExpanded ? '' : '-rotate-90'}`}
                          style={{ color: isActive ? B.orange : B.inactiveIcon }}
                        />
                      )}
                    </button>

                    {tab.subtabs && (
                      <div style={{
                        maxHeight: isExpanded ? '600px' : '0',
                        overflow: 'hidden',
                        opacity: isExpanded ? 1 : 0,
                        transition: isExpanded
                          ? 'max-height 200ms ease, opacity 150ms ease'
                          : 'max-height 150ms ease, opacity 80ms ease',
                      }}>
                        <div
                          className="mt-1 ml-4 pl-3 pb-1 space-y-0.5"
                          style={{ borderLeft: `1px solid ${B.accordionGuide}` }}
                        >
                          {tab.subtabs.map(st => {
                            const StIcon = st.icon;
                            const stBadge = resolveBadge(st.badgeType, counts);
                            const subActive = isSubtabActive(st.path);
                            const isSubExpanded = expandedSubtab === st.id;
                            return (
                              <div key={st.id}>
                                <button
                                  onClick={() => handleSubtabClick(st)}
                                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all"
                                  style={{
                                    color: subActive ? 'white' : B.inactiveText,
                                    backgroundColor: subActive ? B.flyoutActiveBg : 'transparent',
                                    boxShadow: subActive ? `inset 2px 0 0 0 ${B.orange}` : 'none',
                                  }}
                                >
                                  {StIcon && <StIcon size={13} className="shrink-0" style={{ color: subActive ? B.orange : B.inactiveIcon }} />}
                                  <span className="flex-1 text-left truncate">{st.label}</span>
                                  {stBadge > 0 && (
                                    <span className="text-[9px] font-black bg-red-500 text-white px-1.5 py-0.5 rounded-full shrink-0">
                                      {stBadge}
                                    </span>
                                  )}
                                  {st.subtabs && (
                                    <ChevronDown size={12} className={`shrink-0 transition-transform duration-200 ${isSubExpanded ? '' : '-rotate-90'}`} style={{ color: B.inactiveIcon }} />
                                  )}
                                </button>

                                {isSubExpanded && st.subtabs && (
                                  <div className="mt-0.5 ml-3 pl-3 space-y-0.5" style={{ borderLeft: `1px solid ${B.divider}` }}>
                                    {st.subtabs.map(sst => (
                                      <button
                                        key={sst.id}
                                        onClick={() => { navigate(sst.path); onItemClick && onItemClick(); }}
                                        className="w-full flex items-center px-3 py-1.5 rounded-lg text-xs font-bold transition-colors text-left"
                                        style={{ color: B.inactiveText }}
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
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

function UserFooterBtn({ onClick, title, children, danger = false, onItemClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={() => { onClick(); onItemClick?.(); }}
      title={title}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="w-full flex items-center justify-center p-2 rounded-xl"
      style={{
        color: hovered ? (danger ? '#f87171' : 'white') : B.inactiveText,
        backgroundColor: hovered ? (danger ? 'rgba(239,68,68,0.15)' : B.hoverBg) : 'transparent',
        transition: 'background-color 150ms ease, color 150ms ease',
        border: 'none',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

function UserFooterBtnExpanded({ onClick, children, danger = false, onItemClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={() => { onClick(); onItemClick?.(); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold"
      style={{
        color: hovered ? (danger ? '#f87171' : 'white') : B.inactiveText,
        backgroundColor: hovered ? (danger ? 'rgba(239,68,68,0.15)' : B.hoverBg) : 'transparent',
        transition: 'background-color 150ms ease, color 150ms ease',
        border: 'none',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

function UserFooter({ currentUser, onLogout, onSwitchToWorker, onItemClick, collapsed }) {
  if (collapsed) {
    return (
      <div className="p-2 space-y-1 flex flex-col items-center" style={{ borderTop: `1px solid ${B.navBorder}` }}>
        <div
          title={currentUser?.name || 'Admin'}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black shrink-0 mb-1"
          style={{ backgroundColor: B.orange, color: B.navy }}
        >
          {(currentUser?.name || 'A').slice(0, 1).toUpperCase()}
        </div>
        {onSwitchToWorker && (
          <UserFooterBtn onClick={onSwitchToWorker} title="Meu painel de trabalhador" onItemClick={onItemClick}>
            <Users size={14} />
          </UserFooterBtn>
        )}
        <UserFooterBtn onClick={onLogout} title="Terminar sessão" danger onItemClick={onItemClick}>
          <LogOut size={14} />
        </UserFooterBtn>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-1" style={{ borderTop: `1px solid ${B.navBorder}` }}>
      <div className="flex items-center gap-3 px-2 py-2">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black shrink-0"
          style={{ backgroundColor: B.orange, color: B.navy }}
        >
          {(currentUser?.name || 'A').slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black truncate" style={{ color: 'white' }}>
            {currentUser?.name || 'Admin'}
          </p>
          <p style={{ fontSize: '10px', fontWeight: 700, color: B.sectionLabel, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Administrador
          </p>
        </div>
      </div>
      {onSwitchToWorker && (
        <UserFooterBtnExpanded onClick={onSwitchToWorker} onItemClick={onItemClick}>
          <Users size={14} /> Meu painel de trabalhador
        </UserFooterBtnExpanded>
      )}
      <UserFooterBtnExpanded onClick={onLogout} danger onItemClick={onItemClick}>
        <LogOut size={14} /> Terminar sessão
      </UserFooterBtnExpanded>
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
  const [collapsed, setCollapsed] = useState(true);
  const autoCollapseTimer = useRef(null);

  const clearAutoCollapse = () => clearTimeout(autoCollapseTimer.current);
  const scheduleAutoCollapse = () => {
    clearAutoCollapse();
    autoCollapseTimer.current = setTimeout(() => setCollapsed(true), 7000);
  };

  const toggleCollapsed = () => {
    clearAutoCollapse();
    setCollapsed(prev => !prev);
  };

  const handleSidebarMouseEnter = () => clearAutoCollapse();
  const handleSidebarMouseLeave = () => {
    if (!collapsed) scheduleAutoCollapse();
  };

  useEffect(() => () => clearAutoCollapse(), []);

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
    <aside
      onMouseEnter={handleSidebarMouseEnter}
      onMouseLeave={handleSidebarMouseLeave}
      className={`relative hidden md:flex shrink-0 h-full flex-col transition-all duration-200 ${
        collapsed ? 'w-[68px]' : 'w-60'
      }`}
      style={{
        backgroundColor: B.navy,
        borderRight: `1px solid ${B.navBorder}`,
        zIndex: 1,
      }}
    >
      <NavList
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        setAuditWorkerId={setAuditWorkerId}
        counts={counts}
        collapsed={collapsed}
      />

      <UserFooter
        currentUser={currentUser}
        onLogout={onLogout}
        onSwitchToWorker={onSwitchToWorker}
        collapsed={collapsed}
      />

      <ToggleBtn collapsed={collapsed} onToggle={toggleCollapsed} />
    </aside>
  );

  const drawer = isMobileOpen ? (
    <div className="md:hidden fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <aside ref={drawerRef} className="relative w-64 max-w-[85vw] h-full flex flex-col shadow-2xl" style={{ backgroundColor: B.navy }}>
        <div className="px-5 py-5 flex items-center justify-between" style={{ borderBottom: `1px solid ${B.navBorder}` }}>
          <div className="flex items-center gap-3 min-w-0">
            <div style={{ width: '44px', height: '44px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0, backgroundColor: B.orange }}>
              <CompanyLogo className="w-full h-full object-cover" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: B.sectionLabel }}>Admin</p>
              <p className="text-xs font-black truncate" style={{ color: 'white' }}>Menu Principal</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar menu"
            className="p-2 rounded-xl transition-all shrink-0"
            style={{ color: B.inactiveText, backgroundColor: B.hoverBg }}
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
