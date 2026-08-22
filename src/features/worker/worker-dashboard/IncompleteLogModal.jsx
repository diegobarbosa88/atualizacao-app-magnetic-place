import React from 'react';
import { AlertTriangle, Edit2, Clock } from 'lucide-react';
import ModalShell from '../../../components/common/ModalShell';

export default function IncompleteLogModal({ logs, clients, onComplete, onDismiss }) {
  if (!logs || logs.length === 0) return null;

  return (
    <ModalShell
      isOpen
      onClose={onDismiss}
      closeOnOverlay={false}
      title="Registo Incompleto"
      meta={logs.length === 1
        ? '1 entrada sem saída registada'
        : `${logs.length} entradas sem saída registada`}
      icon={<AlertTriangle size={20} />}
      accent="brand"
      size="md"
      footer={
        <div className="px-5 pb-6 pt-4">
          <p className="text-[10px] text-slate-400 font-bold text-center leading-relaxed">
            Completa os registos para garantir que as horas são contabilizadas corretamente.
          </p>
        </div>
      }
    >
      {/* Log list */}
      <div className="px-4 py-4 space-y-3">
        {logs.map(log => {
          const clientName = (clients || []).find(c => c.id === log.clientId)?.name || 'Cliente';
          const dateObj = new Date(log.date + 'T00:00:00');
          const dateLabel = dateObj.toLocaleDateString('pt-PT', {
            weekday: 'long', day: 'numeric', month: 'long',
          });
          return (
            <div key={log.id} className="bg-orange-50 border border-orange-100 rounded-2xl px-4 py-3 flex flex-col gap-3">
              {/* Info row */}
              <div className="flex items-center gap-3">
                <div className="bg-orange-100 p-2 rounded-xl shrink-0">
                  <Clock size={15} className="text-orange-600" />
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
              {/* Action */}
              <button
                onClick={() => onComplete(log)}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-orange-600 text-white rounded-xl font-black text-[11px] uppercase tracking-widest hover:bg-slate-900 transition-all shadow-sm active:scale-95"
              >
                <Edit2 size={13} /> Completar Registo
              </button>
            </div>
          );
        })}
      </div>
    </ModalShell>
  );
}
