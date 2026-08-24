import React from 'react';
import { formatCurrency } from './costReportsUtils';
import { SCALE } from '../../../styles/designTokens';
import '../reconciliacao/reconciliacao-mockup.css';

export default function EquipaTab({ workerCosts }) {
  const totalCost = workerCosts.reduce((a, i) => a + i.cost, 0);
  const totalHours = workerCosts.reduce((a, i) => a + i.totalHours, 0);
  const custoMedio = workerCosts.length ? totalCost / workerCosts.length : 0;

  return (
    <div>
      <div className="recon-scope">
        <div className="recon-stat-strip mb-6" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <div className="recon-stat">
            <p className="recon-stat-label">Total Custo Equipa</p>
            <p className="recon-stat-value" style={{ color: 'var(--navy)' }}>{formatCurrency(totalCost)}</p>
            <p className="recon-stat-sub">{workerCosts.length} trabalhadores ativos</p>
          </div>
          <div className="recon-stat">
            <p className="recon-stat-label">Custo Médio / Trabalhador</p>
            <p className="recon-stat-value" style={{ color: 'var(--navy)' }}>{formatCurrency(custoMedio)}</p>
          </div>
          <div className="recon-stat">
            <p className="recon-stat-label">Total Horas</p>
            <p className="recon-stat-value" style={{ color: 'var(--navy)' }}>{totalHours.toFixed(1)}h</p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto -mx-2">
        <table className="w-full text-left border-separate border-spacing-y-2">
          <thead>
            <tr className="text-[var(--slate-dim)]">
              <th className={`px-4 py-2 ${SCALE.text.statLabel}`}>Nome</th>
              <th className={`px-4 py-2 ${SCALE.text.statLabel}`}>Total Horas</th>
              <th className={`px-4 py-2 ${SCALE.text.statLabel}`}>Custo (€)</th>
            </tr>
          </thead>
          <tbody>
            {workerCosts.length === 0 ? (
              <tr><td colSpan="3" className="py-16 text-center text-[var(--slate-dim)] text-sm font-medium">Sem dados para o período selecionado.</td></tr>
            ) : workerCosts.map((item) => (
              <tr key={item.id} className="bg-[var(--surface)] hover:bg-white hover:shadow-md transition-all duration-300">
                <td className="px-4 py-3 rounded-l-2xl border-y border-l border-[var(--border-soft)] text-sm font-black text-[var(--ink)]">{item.name}</td>
                <td className="px-4 py-3 border-y border-[var(--border-soft)] text-sm font-bold text-[var(--ink-soft)]">{item.totalHours.toFixed(1)}h</td>
                <td className="px-4 py-3 rounded-r-2xl border-y border-r border-[var(--border-soft)] text-sm font-black text-[var(--navy)]">{formatCurrency(item.cost)}</td>
              </tr>
            ))}
            {workerCosts.length > 0 && (
              <tr className="bg-[var(--surface-dim)]">
                <td className={`px-4 py-3 rounded-l-2xl ${SCALE.text.statLabel} text-[var(--slate-dim)]`}>Total</td>
                <td className="px-4 py-3 text-sm font-black text-[var(--ink-mid)]">{totalHours.toFixed(1)}h</td>
                <td className="px-4 py-3 rounded-r-2xl text-sm font-black text-[var(--navy)]">{formatCurrency(totalCost)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
