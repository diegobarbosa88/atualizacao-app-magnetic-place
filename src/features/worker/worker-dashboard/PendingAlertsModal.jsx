import React from 'react';
import { Bell, Clock, CheckCircle, FileText, AlertTriangle, Edit2, ChevronRight } from 'lucide-react';
import ModalShell from '../../../components/common/ModalShell';

export default function PendingAlertsModal({
  isOpen, onClose,
  pendingApprovals, currentMonthStr,
  pendingSignaturesCount,
  previousOpenLogs, clients,
  onApproveMonth, onReviewMonth,
  onSignDocuments,
  onCompleteLog,
}) {
  const totalCount = (pendingApprovals?.length || 0) + (pendingSignaturesCount > 0 ? 1 : 0) + (previousOpenLogs?.length || 0);
  const subtitle = `${totalCount} ${totalCount === 1 ? 'item requer atenção' : 'itens requerem atenção'}`;

  return (
    <ModalShell
      isOpen={isOpen && totalCount > 0}
      onClose={onClose}
      title="Avisos Pendentes"
      subtitle={subtitle}
      icon={<Bell size={16} />}
      accent="indigo"
    >
      <div className="px-4 py-4 space-y-3">

        {/* Pending approvals */}
        {(pendingApprovals || []).map(pending => {
          const isCurrentMonth = pending.monthStr === currentMonthStr;
          const monthLabel = pending.date.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });
          return (
            <div key={pending.monthStr} className="bg-indigo-50 border border-indigo-100 rounded-2xl px-4 py-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="bg-indigo-100 p-2 rounded-xl shrink-0">
                  <Clock size={15} className="text-indigo-600 animate-pulse" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-black text-slate-700 capitalize leading-snug">
                    Validar Horas de {monthLabel}
                  </p>
                  <p className="text-[10px] font-bold text-slate-400 mt-0.5 leading-snug">
                    {isCurrentMonth
                      ? 'O mês terminou. Verifica os registos e submete.'
                      : 'Tens horas de um mês anterior por validar.'}
                  </p>
                </div>
              </div>
              {isCurrentMonth ? (
                <button
                  onClick={() => { onApproveMonth(); onClose(); }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 text-white rounded-xl font-black text-[11px] uppercase tracking-widest hover:bg-slate-900 transition-all shadow-sm active:scale-95"
                >
                  <CheckCircle size={13} /> Confirmar e Enviar
                </button>
              ) : (
                <button
                  onClick={() => { onReviewMonth(pending); onClose(); }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-orange-500 text-white rounded-xl font-black text-[11px] uppercase tracking-widest hover:bg-slate-900 transition-all shadow-sm active:scale-95"
                >
                  <ChevronRight size={13} /> Rever e Validar
                </button>
              )}
            </div>
          );
        })}

        {/* Pending signatures */}
        {pendingSignaturesCount > 0 && (
          <div className="bg-amber-50 border border-amber-100 rounded-2xl px-4 py-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="bg-amber-100 p-2 rounded-xl shrink-0">
                <FileText size={15} className="text-amber-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black text-slate-700 leading-snug">Assinaturas Pendentes</p>
                <p className="text-[10px] font-bold text-slate-400 mt-0.5 leading-snug">
                  {pendingSignaturesCount} {pendingSignaturesCount === 1 ? 'documento requer' : 'documentos requerem'} a tua assinatura digital.
                </p>
              </div>
            </div>
            <button
              onClick={() => { onSignDocuments(); onClose(); }}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-amber-500 text-white rounded-xl font-black text-[11px] uppercase tracking-widest hover:bg-slate-900 transition-all shadow-sm active:scale-95"
            >
              <Edit2 size={13} /> Assinar Agora
            </button>
          </div>
        )}

        {/* Incomplete logs */}
        {(previousOpenLogs || []).map(log => {
          const clientName = (clients || []).find(c => c.id === log.clientId)?.name || 'Cliente';
          const dateObj = new Date(log.date + 'T00:00:00');
          const dateLabel = dateObj.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' });
          return (
            <div key={log.id} className="bg-orange-50 border border-orange-100 rounded-2xl px-4 py-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="bg-orange-100 p-2 rounded-xl shrink-0">
                  <AlertTriangle size={15} className="text-orange-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-black text-slate-700 capitalize leading-snug">{dateLabel}</p>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                    <span className="text-[10px] font-bold text-slate-500">{clientName}</span>
                    <span className="text-[10px] font-bold text-indigo-600">Entrada {log.startTime}</span>
                    <span className="text-[10px] font-bold text-rose-500">Saída em falta</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => { onCompleteLog(log); onClose(); }}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-orange-600 text-white rounded-xl font-black text-[11px] uppercase tracking-widest hover:bg-slate-900 transition-all shadow-sm active:scale-95"
              >
                <Edit2 size={13} /> Completar Registo
              </button>
            </div>
          );
        })}

        <p className="text-[10px] text-slate-400 font-bold text-center leading-relaxed pb-2">
          Resolve os avisos pendentes para manter os teus registos em dia.
        </p>
      </div>
    </ModalShell>
  );
}
