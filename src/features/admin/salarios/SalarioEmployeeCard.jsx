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
              <div key={`${m.month}-${index}`} className="px-4 py-3 space-y-2">
                {/* Linha 1: mês + badge de estado */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-black uppercase tracking-widest text-slate-600 flex-shrink-0">
                      {MESES_PT_SAL[mm]} {ano}
                    </span>
                    <span
                      onClick={() => onJustificar({ employee_name: employee.employee_name, month: m.month, balance: m.balance })}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest cursor-pointer hover:opacity-80 flex-shrink-0 ${badgeClass}`}
                    >
                      {isMatch || isJustified ? <CheckCircle size={9} /> : <AlertCircle size={9} />} {displayStatus}
                    </span>
                  </div>
                  {Math.abs(m.balance) > tolerancia && (
                    <span className={`flex-shrink-0 font-black text-[10px] px-2 py-0.5 rounded-full ${m.balance > 0 ? 'bg-rose-100 text-rose-700' : 'bg-sky-100 text-sky-700'}`}>
                      {m.balance > 0
                        ? `−${fmtEur(m.balance)}`
                        : `+${fmtEur(Math.abs(m.balance))}`}
                    </span>
                  )}
                </div>

                {/* Linha 2: valores financeiros + botão justificar */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-4 text-xs text-slate-600">
                    <span>Recibo: <strong className="text-slate-800">{fmtEur(m.expected_amount)}</strong></span>
                    <span>Pago: <strong className="text-slate-800">{fmtEur(m.total_paid)}</strong></span>
                  </div>
                  {!isMatch && !isJustified && (
                    <button
                      onClick={() => onJustificar({ employee_name: employee.employee_name, month: m.month, balance: m.balance })}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-violet-100 text-violet-700 hover:bg-violet-200 transition-colors flex-shrink-0"
                    >
                      <MessageSquare size={10} /> Justificar
                    </button>
                  )}
                </div>

                {/* Linha 3: justificação (só se existir) */}
                {isJustified && (
                  <div className="flex items-center justify-between gap-2 bg-white border border-slate-100 rounded-xl px-3 py-2">
                    <span className="text-[10px] text-slate-500 italic min-w-0 truncate" title={justEntry.justification}>
                      "{justEntry.justification}"
                    </span>
                    <button
                      onClick={() => onRemoverJustificacao({ employee_name: employee.employee_name, month: m.month })}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-500 hover:bg-rose-100 hover:text-rose-600 transition-colors flex-shrink-0 ml-2"
                      title="Desfazer justificação"
                    >
                      <Undo2 size={9} /> Desfazer
                    </button>
                  </div>
                )}
                {m.transfers.length > 0 ? (
                  <div className="space-y-1">
                    {m.transfers.map((t, i) => (
                      <div key={i} className="flex items-center justify-between bg-white border border-slate-100 rounded-xl px-3 py-2">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => window.__toggleTipoLink(t, supabase, onTipoUpdate)}
                            className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest cursor-pointer hover:opacity-75 transition-opacity flex-shrink-0 ${t.type === 'Adiantamento' ? 'bg-blue-100 text-blue-700' : 'bg-violet-100 text-violet-700'}`}>
                            {t.type === 'Adiantamento' ? 'Adiant.' : 'Liquid.'}
                          </button>
                          <span className="text-xs text-slate-500">{t.date}</span>
                        </div>
                        <span className="text-sm font-bold text-slate-700">{fmtEur(t.amount)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">Nenhuma transferência identificada</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
