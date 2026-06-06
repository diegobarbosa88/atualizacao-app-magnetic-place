import React from 'react';
import { AlertTriangle, Edit2, X, Clock } from 'lucide-react';

export default function IncompleteLogModal({ logs, clients, onComplete, onDismiss }) {
  if (!logs || logs.length === 0) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="bg-gradient-to-br from-orange-500 to-amber-500 px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2.5 rounded-xl">
              <AlertTriangle size={22} className="text-white" />
            </div>
            <div>
              <h2 className="font-black text-white uppercase tracking-tight text-base">
                Registo Incompleto
              </h2>
              <p className="text-orange-100 text-xs font-bold">
                {logs.length === 1 ? '1 entrada sem saída registada' : `${logs.length} entradas sem saída registada`}
              </p>
            </div>
          </div>
          <button
            onClick={onDismiss}
            className="p-2 text-white/70 hover:text-white hover:bg-white/20 rounded-xl transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Log list */}
        <div className="px-6 py-4 space-y-3 max-h-64 overflow-y-auto">
          {logs.map(log => {
            const clientName = (clients || []).find(c => c.id === log.clientId)?.name || 'Cliente';
            const dateObj = new Date(log.date + 'T00:00:00');
            const dateLabel = dateObj.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' });
            return (
              <div key={log.id} className="flex items-center justify-between gap-3 bg-orange-50 border border-orange-100 rounded-2xl px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="bg-orange-100 p-2 rounded-xl shrink-0">
                    <Clock size={16} className="text-orange-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-black text-slate-700 capitalize truncate">{dateLabel}</p>
                    <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                      {clientName} · Entrada {log.startTime} · Saída em falta
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => onComplete(log)}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-2 bg-orange-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-900 transition-all shadow-sm active:scale-95"
                >
                  <Edit2 size={12} /> Completar
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 pb-5">
          <p className="text-[10px] text-slate-400 font-bold text-center">
            Completa os registos para garantir que as horas são contabilizadas corretamente.
          </p>
        </div>
      </div>
    </div>
  );
}
