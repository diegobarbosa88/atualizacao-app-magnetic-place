import React from 'react';
import { AlertTriangle, Edit2, X, Clock } from 'lucide-react';

export default function IncompleteLogModal({ logs, clients, onComplete, onDismiss }) {
  if (!logs || logs.length === 0) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-[9999] p-0 sm:p-4">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-md overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-300">

        {/* Header */}
        <div className="bg-gradient-to-br from-orange-500 to-amber-500 px-5 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="bg-white/20 p-2 rounded-xl shrink-0">
              <AlertTriangle size={20} className="text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="font-black text-white uppercase tracking-tight text-sm leading-tight">
                Registo Incompleto
              </h2>
              <p className="text-orange-100 text-[11px] font-bold leading-tight mt-0.5">
                {logs.length === 1
                  ? '1 entrada sem saída registada'
                  : `${logs.length} entradas sem saída registada`}
              </p>
            </div>
          </div>
          <button
            onClick={onDismiss}
            className="shrink-0 p-2 text-white/70 hover:text-white hover:bg-white/20 rounded-xl transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Log list */}
        <div className="px-4 py-4 space-y-3 max-h-[50vh] overflow-y-auto">
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

        {/* Footer */}
        <div className="px-5 pb-6 pt-1">
          <p className="text-[10px] text-slate-400 font-bold text-center leading-relaxed">
            Completa os registos para garantir que as horas são contabilizadas corretamente.
          </p>
        </div>
      </div>
    </div>
  );
}
