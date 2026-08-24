import React from 'react';
import { FT, SCALE } from '../../styles/designTokens';

// Regra geral para navegação secundária (abas/filtros DENTRO de uma página
// que já tem o seu próprio SectionHeaderShell) — pill cinza com aba ativa em
// branco. Substitui os vários padrões de "sublinhado laranja" (border-b-2
// -mb-px) que existiam espalhados pelos painéis internos do admin.
export default function SubTabBar({ tabs, activeTab, onTabChange, className = '' }) {
  return (
    <div className={`flex flex-wrap items-center gap-1 bg-slate-100 rounded-2xl p-1 mb-5 ${className}`}>
      {tabs.map(({ id, label, icon: Icon, badge, badgeColor = 'rose' }) => {
        const isActive = activeTab === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onTabChange(id)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl ${SCALE.text.badge} transition-all whitespace-nowrap ${
              isActive ? 'bg-white text-[var(--navy)] shadow-sm' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            {Icon && <Icon size={13} />} {label}
            {!!badge && (
              <span
                className={`text-white ${SCALE.text.badge} px-1.5 py-0.5 rounded-full leading-none`}
                style={{ backgroundColor: badgeColor === 'amber' ? FT.badgeWarn : badgeColor === 'slate' ? FT.slate : FT.badgeBad }}
              >
                {badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
