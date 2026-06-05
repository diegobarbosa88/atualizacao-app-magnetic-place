import React from 'react';
import { Clock, ChevronDown, ChevronUp, X, Send, CheckCircle, XCircle } from 'lucide-react';
import { formatDocDate } from '../../../utils/dateUtils';

export default function PendingCorrectionsPanel({ pendingItems, resolvedItems, pendingCollapsed, setPendingCollapsed, dismissCorrection, labelKind, corrections }) {
  if (pendingItems.length === 0 && resolvedItems.length === 0) return null;

  const findCorr = (id) => (corrections || []).find((c) => c.id === id) || null;
  const fmtTs = (iso) => formatDocDate(iso, true) || '—';

  return (
    <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
      <button
        onClick={() => setPendingCollapsed(v => !v)}
        className="w-full flex items-center justify-between gap-2 text-left"
      >
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-amber-600" />
          <h3 className="text-sm font-black text-amber-700">
            {pendingItems.length > 0
              ? `Você tem ${pendingItems.length} pedido${pendingItems.length > 1 ? 's' : ''} pendente${pendingItems.length > 1 ? 's' : ''} de resposta`
              : 'Pedidos respondidos'}
          </h3>
        </div>
        {pendingCollapsed
          ? <ChevronDown size={16} className="text-amber-500 flex-shrink-0" />
          : <ChevronUp size={16} className="text-amber-500 flex-shrink-0" />}
      </button>
      {!pendingCollapsed && (
        <ul className="space-y-2 mt-3">
          {pendingItems.map((item) => {
            const corrObj = findCorr(item.correction_id);
            const hasBefore = item.before && (item.before.startTime || item.before.endTime);
            const hasProposed = item.proposed && (item.proposed.startTime || item.proposed.endTime);
            const hasBreak = (t) => t && (t.breakStart || t.breakEnd);
            return (
              <li key={item.id} className="text-xs bg-white/70 rounded-xl p-3 border border-amber-100">
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <span className="font-mono font-black text-amber-900">{item.date}</span>
                  <span className="text-amber-400">·</span>
                  <span className="font-black uppercase tracking-widest text-[10px] text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md">
                    {labelKind(item)}
                  </span>
                </div>
                {corrObj?.submitted_at && (
                  <div className="flex items-center gap-1.5 text-amber-600 text-[10px] font-bold mb-1.5">
                    <Send size={10} />
                    <span>Solicitado em <span className="font-mono">{fmtTs(corrObj.submitted_at)}</span></span>
                  </div>
                )}
                {hasBefore && (
                  <div className="flex items-center gap-2 text-slate-500">
                    <span className="text-[10px] font-black uppercase tracking-widest w-20 flex-shrink-0 text-slate-400">Original</span>
                    <span className="font-mono">{item.before.startTime} → {item.before.endTime}</span>
                    {hasBreak(item.before) && (
                      <span className="text-slate-400">· pausa {item.before.breakStart || '--:--'}–{item.before.breakEnd || '--:--'}</span>
                    )}
                  </div>
                )}
                {hasProposed && (
                  <div className="flex items-center gap-2 text-amber-800 font-bold">
                    <span className="text-[10px] font-black uppercase tracking-widest w-20 flex-shrink-0 text-amber-600">Solicitado</span>
                    <span className="font-mono">{item.proposed.startTime} → {item.proposed.endTime}</span>
                    {hasBreak(item.proposed) && (
                      <span className="text-amber-500 font-normal">· pausa {item.proposed.breakStart || '--:--'}–{item.proposed.breakEnd || '--:--'}</span>
                    )}
                  </div>
                )}
                {!hasBefore && !hasProposed && (
                  <div className="text-slate-500 italic text-[11px]">Sem detalhes de horário</div>
                )}
              </li>
            );
          })}
          {resolvedItems.length > 0 && (() => {
            const byCorrectionId = resolvedItems.reduce((acc, item) => {
              if (!acc[item.correction_id]) acc[item.correction_id] = [];
              acc[item.correction_id].push(item);
              return acc;
            }, {});
            return Object.entries(byCorrectionId).map(([corrId, items]) => {
              const corr = findCorr(corrId);
              const accepted = corr?.status === 'applied';
              return (
                <li key={corrId} className={`text-xs rounded-xl p-3 border ${accepted ? 'bg-emerald-50/80 border-emerald-200' : 'bg-rose-50/80 border-rose-200'}`}>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`font-black text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-md ${accepted ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                        {accepted ? '✓ Aceite' : '✕ Rejeitado'}
                      </span>
                      <span className={`font-mono font-black ${accepted ? 'text-emerald-900' : 'text-rose-900'}`}>{items[0]?.date}{items.length > 1 ? ` +${items.length - 1}` : ''}</span>
                    </div>
                    <button
                      onClick={() => dismissCorrection(corrId)}
                      className={`p-1 rounded-lg transition-colors ${accepted ? 'text-emerald-400 hover:text-emerald-700 hover:bg-emerald-100' : 'text-rose-400 hover:text-rose-700 hover:bg-rose-100'}`}
                      title="Fechar"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-bold mb-1.5 ${accepted ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {corr?.submitted_at && (
                      <span className="flex items-center gap-1">
                        <Send size={10} /> Solicitado: <span className="font-mono">{fmtTs(corr.submitted_at)}</span>
                      </span>
                    )}
                    {corr?.reviewed_at && (
                      <span className="flex items-center gap-1">
                        {accepted ? <CheckCircle size={10} /> : <XCircle size={10} />} Respondido: <span className="font-mono">{fmtTs(corr.reviewed_at)}</span>
                      </span>
                    )}
                  </div>
                  {items.map((item) => {
                    const hasBefore = item.before && (item.before.startTime || item.before.endTime);
                    const hasProposed = item.proposed && (item.proposed.startTime || item.proposed.endTime);
                    const hasBreak = (t) => t && (t.breakStart || t.breakEnd);
                    return (
                      <div key={item.id} className="mt-1">
                        {items.length > 1 && <span className="font-mono text-[10px] text-slate-400 mr-2">{item.date}</span>}
                        {hasBefore && (
                          <div className="flex items-center gap-2 text-slate-500">
                            <span className="text-[10px] font-black uppercase tracking-widest w-20 flex-shrink-0 text-slate-400">Original</span>
                            <span className="font-mono">{item.before.startTime} → {item.before.endTime}</span>
                            {hasBreak(item.before) && <span className="text-slate-400">· pausa {item.before.breakStart || '--:--'}–{item.before.breakEnd || '--:--'}</span>}
                          </div>
                        )}
                        {hasProposed && (
                          <div className={`flex items-center gap-2 font-bold ${accepted ? 'text-emerald-800' : 'text-rose-800'}`}>
                            <span className={`text-[10px] font-black uppercase tracking-widest w-20 flex-shrink-0 ${accepted ? 'text-emerald-600' : 'text-rose-600'}`}>Solicitado</span>
                            <span className="font-mono">{item.proposed.startTime} → {item.proposed.endTime}</span>
                            {hasBreak(item.proposed) && <span className={`font-normal ${accepted ? 'text-emerald-500' : 'text-rose-500'}`}>· pausa {item.proposed.breakStart || '--:--'}–{item.proposed.breakEnd || '--:--'}</span>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </li>
              );
            });
          })()}
        </ul>
      )}
    </div>
  );
}
