import React from 'react';
import { CheckCircle, AlertCircle, ChevronDown, ChevronUp, X, Undo2, MessageSquare } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { fmtEur, MESES_PT_SAL } from './salarioUtils';

export default function SalarioEmployeeCard({
  employee,
  justificacoes,
  onJustificar,
  onRemoverJustificacao,
  tolerancia = 0.01,
  onTipoUpdate,
  isOpen,
  onToggleOpen,
}) {
  const { supabase } = useApp();
  const pendingMonths = employee.months.filter(m =>
    m.status !== 'Match Exato' &&
    !justificacoes.some(j => j.employee_name === employee.employee_name && j.month === m.month)
  ).length;
  const allOk = pendingMonths === 0;

  return (
    <div className="border border-slate-200 rounded-2xl overflow-hidden">
      <button onClick={onToggleOpen}
        className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-slate-50 transition-colors text-left">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${allOk ? 'bg-emerald-500' : 'bg-amber-400'}`} />
          <span className="text-sm font-bold text-slate-800">{employee.employee_name}</span>
          <span className="text-[10px] text-slate-400">{employee.months.length} mês(es)</span>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-[10px] font-black uppercase tracking-widest ${allOk ? 'text-emerald-600' : 'text-amber-600'}`}>
            {allOk ? 'Tudo Ok' : `${pendingMonths} pendente(s)`}
          </span>
          {isOpen ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
        </div>
      </button>
      {isOpen && (
        <div className="divide-y divide-slate-100 bg-slate-50">
          {employee.months.map((m, index) => {
            const [ano, mm] = m.month.split('-');
            const isMatch = m.status === 'Match Exato';
            const justEntry = justificacoes.find(j => j.employee_name === employee.employee_name && j.month === m.month);
            const isJustified = !!justEntry;
            const displayStatus = isMatch ? 'Match Exato' : isJustified ? 'Justificado' : m.status;
            const badgeClass = isMatch || isJustified
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-amber-100 text-amber-700';

            return (
              <div key={`${m.month}-${index}`} className="px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                      {MESES_PT_SAL[mm]} {ano}
                    </span>
                    <span
                      onClick={() => onJustificar({ employee_name: employee.employee_name, month: m.month, balance: m.balance })}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest cursor-pointer hover:opacity-80 ${badgeClass}`}
                    >
                      {isMatch || isJustified ? <CheckCircle size={9} /> : <AlertCircle size={9} />} {displayStatus}
                    </span>
                    {isJustified && (
                      <>
                        <span className="text-[9px] text-slate-400 italic max-w-[180px] truncate" title={justEntry.justification}>
                          "{justEntry.justification}"
                        </span>
                        <button
                          onClick={() => onRemoverJustificacao({ employee_name: employee.employee_name, month: m.month })}
                          className="flex items-center gap-0.5 px-2 py-0.5 rounded-xl text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-500 hover:bg-rose-100 hover:text-rose-600 transition-colors"
                          title="Desfazer justificação"
                        >
                          <Undo2 size={9} /> Desfazer
                        </button>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-3 text-[11px] text-slate-600">
                      <span>Recibo: <strong>{fmtEur(m.expected_amount)}</strong></span>
                      <span>Pago: <strong>{fmtEur(m.total_paid)}</strong></span>
                      {Math.abs(m.balance) > tolerancia && (
                        <span className={`font-black text-[10px] px-2 py-0.5 rounded-full ${m.balance > 0 ? 'bg-rose-100 text-rose-700' : 'bg-sky-100 text-sky-700'}`}>
                          {m.balance > 0
                            ? `Pagou ${fmtEur(m.balance)} a menos`
                            : `Pagou ${fmtEur(Math.abs(m.balance))} a mais`}
                        </span>
                      )}
                    </div>
                    {!isMatch && !isJustified && (
                      <button
                        onClick={() => onJustificar({ employee_name: employee.employee_name, month: m.month, balance: m.balance })}
                        className="flex items-center gap-1 px-2 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest bg-violet-100 text-violet-700 hover:bg-violet-200 transition-colors"
                      >
                        <MessageSquare size={9} /> Justificar
                      </button>
                    )}
                  </div>
                </div>
                {m.transfers.length > 0 ? (
                  <div className="space-y-1">
                    {m.transfers.map((t, i) => (
                      <div key={i} className="flex items-center justify-between bg-white border border-slate-100 rounded-xl px-3 py-1.5">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => window.__toggleTipoLink(t, supabase, onTipoUpdate)}
                            className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest cursor-pointer hover:opacity-75 transition-opacity ${t.type === 'Adiantamento' ? 'bg-blue-100 text-blue-700' : 'bg-violet-100 text-violet-700'}`}>
                            {t.type === 'Adiantamento' ? 'Adiant.' : 'Liquid.'}
                          </button>
                          <span className="text-[11px] text-slate-500">{t.date}</span>
                        </div>
                        <span className="text-[12px] font-bold text-slate-700">{fmtEur(t.amount)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400 italic">Nenhuma transferência identificada</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
