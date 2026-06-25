import React from 'react';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import { fmtEur, fmtPct } from './ajudasUtils';

export default function PainelAnual({ ano, orcamentoAnual, jaFaturadoYTD, saldoDisponivel, mesesRestantes, ajudasReciboMes, eEstimativa, semHoras, progressoPct, regraCumprida }) {
  const barCls = progressoPct >= 95 ? 'bg-red-500' : progressoPct >= 75 ? 'bg-yellow-400' : 'bg-emerald-500';

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-black text-slate-800">Ajudas de Custo — {ano}</h3>
          <p className="text-[10px] text-slate-400 mt-0.5">Baseado nos recibos TOConline processados do ano</p>
        </div>
        <div className="flex items-center gap-2">
          {orcamentoAnual === 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-xl">
              <AlertTriangle size={12} className="text-amber-500" />
              <span className="text-[10px] font-bold text-amber-600">Sem recibos processados este ano</span>
            </div>
          )}
          {orcamentoAnual > 0 && !regraCumprida && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-xl" title="O total de ajudas de custo faturadas ficará abaixo do total de recibos processados no ano">
              <AlertTriangle size={12} className="text-amber-500" />
              <span className="text-[10px] font-bold text-amber-600">Total faturas &lt; Total recibos</span>
            </div>
          )}
          {orcamentoAnual > 0 && regraCumprida && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl">
              <CheckCircle size={12} className="text-emerald-600" />
              <span className="text-[10px] font-bold text-emerald-600">Regra cumprida</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {[
          { label: 'Total recibos ano', val: fmtEur(orcamentoAnual), cls: 'indigo' },
          { label: 'Já faturado', val: fmtEur(jaFaturadoYTD), cls: 'slate' },
          { label: 'Saldo restante', val: fmtEur(saldoDisponivel), cls: saldoDisponivel < 0 ? 'red' : 'emerald' },
          { label: 'Meses restantes', val: mesesRestantes, cls: 'slate' },
          { label: semHoras ? 'Recibos mês anterior' : 'Recibos deste mês', val: fmtEur(ajudasReciboMes), cls: 'indigo' },
        ].map(({ label, val, cls }) => (
          <div key={label} className={`bg-${cls}-50 border border-${cls}-100 rounded-xl p-3 text-center`}>
            <p className={`text-base font-black text-${cls}-700`}>{val}</p>
            <p className={`text-[9px] font-black uppercase tracking-widest text-${cls}-400 mt-0.5`}>{label}</p>
          </div>
        ))}
      </div>

      {orcamentoAnual > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-slate-400">
            <span>Faturado vs Total recibos</span>
            <span>{fmtPct(progressoPct)}</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${barCls}`} style={{ width: `${progressoPct}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}
