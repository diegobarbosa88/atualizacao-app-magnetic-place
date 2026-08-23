import React from 'react';
import { formatCurrency } from './costReportsUtils';
import '../reconciliacao/reconciliacao-mockup.css';

// Limiar de margem saudável — abaixo de 15% (sobre a faturação) mostra a
// vermelho, mesmo que a margem seja positiva. Valor combinável com o
// Diego se preferir outro corte.
const LIMIAR_MARGEM_BAIXA = 0.15;

function margemPct(item) {
  return item.faturation > 0 ? item.margin / item.faturation : 0;
}

function corMargem(item) {
  if (item.margin < 0) return 'text-rose-600';
  return margemPct(item) < LIMIAR_MARGEM_BAIXA ? 'text-rose-600' : 'text-emerald-600';
}

export default function MargemTab({ clientMargins }) {
  const totalFaturation = clientMargins.reduce((a, i) => a + i.faturation, 0);
  const totalCost = clientMargins.reduce((a, i) => a + i.cost, 0);
  const totalMargin = clientMargins.reduce((a, i) => a + i.margin, 0);
  const totalHours = clientMargins.reduce((a, i) => a + i.totalHours, 0);
  const margemMediaPct = totalFaturation > 0 ? (totalMargin / totalFaturation) * 100 : 0;
  const nAbaixoLimiar = clientMargins.filter(i => margemPct(i) < LIMIAR_MARGEM_BAIXA).length;

  return (
    <div>
      <div className="recon-scope">
        <div className="recon-stat-strip mb-6" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <div className="recon-stat">
            <p className="recon-stat-label">Margem Bruta</p>
            <p className="recon-stat-value" style={{ color: totalMargin >= 0 ? 'var(--green)' : 'var(--red)' }}>{formatCurrency(totalMargin)}</p>
          </div>
          <div className="recon-stat">
            <p className="recon-stat-label">Margem Média</p>
            <p className="recon-stat-value" style={{ color: 'var(--navy)' }}>{margemMediaPct.toFixed(1)}%</p>
          </div>
          <div className="recon-stat">
            <p className="recon-stat-label">Clientes Abaixo de {(LIMIAR_MARGEM_BAIXA * 100).toFixed(0)}%</p>
            <p className="recon-stat-value" style={{ color: nAbaixoLimiar > 0 ? 'var(--red)' : 'var(--navy)' }}>{nAbaixoLimiar}</p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto -mx-2">
        <table className="w-full text-left border-separate border-spacing-y-2">
          <thead>
            <tr className="text-slate-400">
              <th className="px-4 py-2 text-[10px] font-black uppercase tracking-widest">Cliente</th>
              <th className="px-4 py-2 text-[10px] font-black uppercase tracking-widest">Horas</th>
              <th className="px-4 py-2 text-[10px] font-black uppercase tracking-widest">Faturação</th>
              <th className="px-4 py-2 text-[10px] font-black uppercase tracking-widest">Custo</th>
              <th className="px-4 py-2 text-[10px] font-black uppercase tracking-widest">Margem</th>
              <th className="px-4 py-2 text-[10px] font-black uppercase tracking-widest">%</th>
            </tr>
          </thead>
          <tbody>
            {clientMargins.length === 0 ? (
              <tr><td colSpan="6" className="py-16 text-center text-slate-400 text-sm font-medium">Sem dados para o período selecionado.</td></tr>
            ) : clientMargins.map((item) => (
              <tr key={item.id} className="bg-slate-50/30 hover:bg-white hover:shadow-md transition-all duration-300">
                <td className="px-4 py-3 rounded-l-2xl border-y border-l border-slate-100 text-sm font-black text-slate-800">{item.name}</td>
                <td className="px-4 py-3 border-y border-slate-100 text-sm font-bold text-slate-600 whitespace-nowrap">{item.totalHours.toFixed(1)}h</td>
                <td className="px-4 py-3 border-y border-slate-100 text-sm font-black text-[var(--navy)] whitespace-nowrap">{formatCurrency(item.faturation)}</td>
                <td className="px-4 py-3 border-y border-slate-100 text-sm font-black text-rose-600 whitespace-nowrap">{formatCurrency(item.cost)}</td>
                <td className={`px-4 py-3 border-y border-slate-100 text-sm font-black whitespace-nowrap ${corMargem(item)}`}>{formatCurrency(item.margin)}</td>
                <td className={`px-4 py-3 rounded-r-2xl border-y border-r border-slate-100 text-sm font-black whitespace-nowrap ${corMargem(item)}`}>{(margemPct(item) * 100).toFixed(1)}%</td>
              </tr>
            ))}
            {clientMargins.length > 0 && (
              <tr className="bg-slate-100/60">
                <td className="px-4 py-3 rounded-l-2xl text-[10px] font-black uppercase text-slate-500">Total</td>
                <td className="px-4 py-3 text-sm font-black text-slate-700">{totalHours.toFixed(1)}h</td>
                <td className="px-4 py-3 text-sm font-black text-[var(--navy)]">{formatCurrency(totalFaturation)}</td>
                <td className="px-4 py-3 text-sm font-black text-rose-600">{formatCurrency(totalCost)}</td>
                <td className="px-4 py-3 text-sm font-black text-emerald-600">{formatCurrency(totalMargin)}</td>
                <td className="px-4 py-3 rounded-r-2xl text-sm font-black text-emerald-600">{margemMediaPct.toFixed(1)}%</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
