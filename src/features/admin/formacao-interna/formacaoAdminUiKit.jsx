import React from 'react';

// Pequenos componentes de apresentação partilhados pelas tabs de Formação
// Interna no admin (Ações Presenciais / E-learning) — cartão de resumo no
// topo e barra de progresso de conclusão/assinatura na linha da tabela.
export function ResumoCard({ icon, label, value, accent }) {
  return (
    <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-white border border-[var(--border-soft)]">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${accent || 'bg-indigo-50 text-indigo-600'}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-lg font-black text-[var(--ink)] leading-tight">{value}</p>
        <p className="text-[9px] font-black uppercase tracking-widest text-[var(--slate-dim)] truncate">{label}</p>
      </div>
    </div>
  );
}

export function BarraProgresso({ concluidos, total }) {
  const pct = total > 0 ? Math.round((concluidos / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 h-1.5 rounded-full bg-[var(--surface-dim)] overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] font-bold text-[var(--slate-dim)] shrink-0 tabular-nums">{concluidos}/{total}</span>
    </div>
  );
}
