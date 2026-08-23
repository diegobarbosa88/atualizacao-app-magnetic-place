import React from 'react';
import { FT } from '../../../styles/designTokens';

export default function KpiCard({ icon, iconBg, iconColor, iconStyle = {}, value, subtitle, label, trend, invertTrend = false, dark = false, neutralBadge = false }) {
  const trendGood = invertTrend ? trend <= 0 : trend >= 0;
  const base = dark
    ? 'shadow-xl text-white'
    : 'bg-white shadow-sm border border-[var(--border-soft)]';
  const darkBg = dark ? { backgroundColor: FT.navy } : {};

  // Este cartão renderiza-se sobre dois fundos opostos — navy fixo quando
  // `dark`, branco quando não — e nenhum tom da escala de tinta serve os dois:
  // o --slate-dim dá 5,10:1 sobre branco mas 2,30:1 sobre o navy, e o --slate
  // dava 4,05:1 sobre o navy, a falhar AA por pouco. Daí o --on-navy (#A9B8C7,
  // 5,79:1), criado para este papel: texto secundário sobre os fundos navy da
  // marca, que não invertem. O ternário mantém-se porque os dois fundos são
  // mesmo opostos — o que mudou é que agora ambos os ramos passam AA.
  const textoNeutro = dark ? 'text-[var(--on-navy)]' : 'text-[var(--slate-dim)]';

  const badgeClass = neutralBadge
    ? (dark ? `bg-slate-500/20 ${textoNeutro}` : `bg-[var(--surface-dim)] ${textoNeutro}`)
    : dark
      ? (trendGood ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400')
      : (trendGood ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600');

  return (
    <div className={`p-4 sm:p-6 rounded-2xl sm:rounded-[2.5rem] flex flex-col gap-2 sm:gap-3 ${base}`} style={darkBg}>
      <div className="flex justify-between items-start">
        <div className={`${iconBg} ${iconColor} p-3 rounded-2xl`} style={iconStyle}>{icon}</div>
        {trend !== null && trend !== undefined && trend !== 0 && (
          <span className={`text-[10px] font-black px-2 py-1 rounded-full ${badgeClass}`}>
            {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div>
        <p className={`text-xl sm:text-3xl font-black ${dark ? '' : 'text-[var(--ink)]'}`}>{value}</p>
        {subtitle && (
          // O subtítulo não tinha o ternário que o label já tinha: usava
          // text-slate-400 nos dois cartões, o que dava 2,56:1 sobre o branco.
          <p className={`text-[10px] font-black uppercase tracking-widest ${textoNeutro}`}>{subtitle}</p>
        )}
      </div>
      <p className={`text-xs font-bold uppercase tracking-wider ${textoNeutro}`}>{label}</p>
    </div>
  );
}
