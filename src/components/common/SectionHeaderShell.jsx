import React from 'react';

// Tailwind precisa de classes estáticas e detetáveis no código-fonte — não
// pode interpolar `sm:grid-cols-${n}` diretamente, por isso mapeia aqui.
const STATS_COLS_CLASS = { 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3', 4: 'sm:grid-cols-4', 5: 'sm:grid-cols-5' };

// Regra geral de design para cabeçalhos de secção do admin: cabeçalho navy
// em gradiente com barra de acento laranja, seletor de sub-abas embutido
// (substitui as antigas barras de tabs com sublinhado por secção) e, opcionalmente,
// uma "stat strip" de resumo clicável por baixo. Nasceu no redesign de
// Documentos/Clientes — qualquer secção nova do admin deve usar isto em vez
// de recriar cabeçalho + tabs à mão.
export function StatCard({ label, value, colorText, dotColor, active, onClick }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      className={`text-left bg-white border rounded-2xl px-4 py-3 transition-all ${onClick ? '' : ''} ${active ? 'border-[#EB8D00] ring-2 ring-[#EB8D00]/25' : 'border-slate-100 hover:border-slate-200'}`}
    >
      <span className="inline-block w-2 h-2 rounded-full mb-1.5" style={{ backgroundColor: dotColor }} />
      <p className="text-xl font-black tabular-nums leading-none" style={{ color: colorText }}>{value}</p>
      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-1">{label}</p>
    </Tag>
  );
}

export default function SectionHeaderShell({
  icon,
  title,
  subtitle,
  tabs,
  activeTab,
  onTabChange,
  breadcrumbLabel,
  stats,
  statsCols = 4,
  rightSlot,
}) {
  return (
    <div className="rounded-2xl sm:rounded-[2.5rem] overflow-hidden shadow-sm border border-slate-100 mb-5">
      <div className="px-5 sm:px-7 py-[1.4rem]" style={{ background: 'linear-gradient(135deg, #1B3A57 0%, #12293e 100%)' }}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-[42px] h-[42px] rounded-[14px] bg-white/10 flex items-center justify-center shrink-0 text-white">
              {icon}
            </div>
            <div className="min-w-0">
              {/* Barlow Condensed 700 em caixa normal, como no mockup aprovado —
                  antes era text-base/font-black/uppercase, que pesava mais que
                  o conteúdo da própria página. */}
              <h2 className="text-[1.4rem] font-bold leading-[1.05] tracking-[0.01em] text-white truncate">{title}</h2>
              {subtitle && <p className="text-[11px] font-semibold mt-0.5 truncate text-[#b7c8d8]">{subtitle}</p>}
            </div>
          </div>

          {tabs && tabs.length > 0 && (
            <div className="flex flex-wrap bg-white/10 rounded-xl p-1 gap-1">
              {tabs.map(({ id, label, icon: Icon, badge, badgeColor = 'rose' }) => {
                const isActive = activeTab === id;
                return (
                  <button
                    key={id}
                    onClick={() => onTabChange(id)}
                    className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all whitespace-nowrap ${
                      isActive ? 'bg-white text-[#1B3A57]' : 'text-[#b7c8d8] hover:text-white'
                    }`}
                  >
                    {Icon && <Icon size={12} />} {label}
                    {!!badge && (
                      <span
                        className="text-white text-[9px] font-black px-1.5 py-0.5 rounded-full leading-none"
                        style={{ backgroundColor: badgeColor === 'amber' ? '#e8a317' : '#e0455a' }}
                      >
                        {badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {rightSlot}
        </div>

        {breadcrumbLabel && (
          <div className="mt-3 flex items-center gap-1.5 text-xs font-bold">
            <span className="text-[#8ea6bc]">{title}</span>
            <span className="text-[#5c7590]">›</span>
            <span className="text-white">{breadcrumbLabel}</span>
          </div>
        )}
      </div>
      <div className="h-[3px]" style={{ background: 'linear-gradient(90deg, #EB8D00, #ffb444)' }} />

      {stats && stats.length > 0 && (
        <div className={`grid grid-cols-2 ${STATS_COLS_CLASS[statsCols] || STATS_COLS_CLASS[4]} gap-2.5 p-4 sm:p-5 bg-slate-50`}>
          {stats.map((s, i) => <StatCard key={i} {...s} />)}
        </div>
      )}
    </div>
  );
}
