import React from 'react';

// Cabeçalho de secção do admin — faixa branca de uma linha (ícone, título,
// sub-abas) com uma linha de resumo opcional por baixo.
//
// Substituiu um bloco navy em gradiente de ~115px que aparecia em todas as
// 19 secções, logo a seguir aos 104px de navy da BrandBar: eram duas
// superfícies escuras coladas. Esta versão gasta ~90px até à primeira linha
// de dados, contra 238px da anterior.
//
// O breadcrumb saiu por ser redundante: dizia "Equipa › Colaboradores" com o
// título e a aba ativa a dizerem o mesmo, logo por cima.

export function StatChip({ label, value, dotColor, active, onClick }) {
  const Tag = onClick ? 'button' : 'span';
  return (
    <Tag
      onClick={onClick}
      className={`relative flex items-center gap-1.5 text-[11.5px] font-semibold whitespace-nowrap transition-colors ${
        active ? 'text-[#EB8D00]' : 'text-slate-500 hover:text-slate-700'
      }`}
    >
      <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ backgroundColor: dotColor }} />
      <b className={`font-extrabold tabular-nums ${active ? 'text-[#EB8D00]' : 'text-slate-800'}`}>{value}</b>
      {label}
      {active && <span className="absolute left-0 right-0 -bottom-2 h-0.5 bg-[#EB8D00]" />}
    </Tag>
  );
}

export default function SectionHeaderShell({
  icon,
  title,
  // Mantido na assinatura por ser informação útil, mas já não ocupa uma linha:
  // passa a tooltip do título.
  subtitle,
  tabs,
  activeTab,
  onTabChange,
  stats,
  rightSlot,
}) {
  return (
    <div className="bg-white border border-slate-200/70 rounded-2xl overflow-hidden mb-5">
      <div className="flex items-center gap-3 flex-wrap px-4 py-3">
        {icon && (
          <span className="w-[26px] h-[26px] rounded-lg flex items-center justify-center shrink-0 bg-[#1B3A57]/[0.08] text-[#1B3A57] [&>svg]:w-[14px] [&>svg]:h-[14px]">
            {icon}
          </span>
        )}
        <h2
          className="text-[1.3rem] font-bold leading-none text-[#1B3A57] truncate"
          title={subtitle || undefined}
        >
          {title}
        </h2>

        {tabs && tabs.length > 0 && (
          <div className="flex flex-wrap gap-0.5 ml-auto bg-slate-100 rounded-[10px] p-[3px]">
            {tabs.map(({ id, label, icon: Icon, badge, badgeColor = 'rose' }) => {
              const isActive = activeTab === id;
              return (
                <button
                  key={id}
                  onClick={() => onTabChange(id)}
                  style={{ fontFamily: 'var(--mono)' }}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-[7px] text-[9.5px] font-bold uppercase tracking-[0.04em] whitespace-nowrap transition-all ${
                    isActive ? 'bg-white text-[#1B3A57] shadow-sm' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {Icon && <Icon size={11} />} {label}
                  {!!badge && (
                    <span
                      className="text-white text-[8.5px] font-extrabold px-1.5 py-px rounded-full leading-none"
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

        {rightSlot && <div className={tabs && tabs.length > 0 ? '' : 'ml-auto'}>{rightSlot}</div>}
      </div>

      {stats && stats.length > 0 && (
        <div className="flex items-center gap-4 flex-wrap px-4 py-2 border-t border-slate-100 bg-slate-50/50">
          {stats.map((s, i) => <StatChip key={i} {...s} />)}
        </div>
      )}
    </div>
  );
}
