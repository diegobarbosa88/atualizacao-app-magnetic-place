import React from 'react';
import { Clock, ChevronDown, ChevronUp, X, Send, CheckCircle, XCircle, ArrowRight, Edit3, Trash2 } from 'lucide-react';
import { formatDocDate } from '../../../utils/dateUtils';

const fmtTime = (t) => t || '--:--';
const fmtTs = (iso) => formatDocDate(iso, true) || '—';

function TimeRange({ data, color = 'slate' }) {
  if (!data || (!data.startTime && !data.endTime)) {
    return <span className="italic text-slate-300 text-[11px]">Sem registo</span>;
  }
  return (
    <span className={`font-mono text-[11px] font-black text-${color}-700`}>
      {fmtTime(data.startTime)} → {fmtTime(data.endTime)}
      {(data.breakStart || data.breakEnd) && (
        <span className={`font-normal text-${color}-400 ml-1`}>
          · P {fmtTime(data.breakStart)}–{fmtTime(data.breakEnd)}
        </span>
      )}
    </span>
  );
}

function PendingItem({ item, corrObj, labelKind }) {
  const hasProposed = item.proposed && (item.proposed.startTime || item.proposed.endTime);
  const isRemoval = !hasProposed;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
        <div className={`p-1.5 rounded-xl shrink-0 ${isRemoval ? 'bg-rose-50' : 'bg-amber-50'}`}>
          {isRemoval
            ? <Trash2 size={14} className="text-rose-500" />
            : <Edit3 size={14} className="text-amber-500" />
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black text-slate-800 leading-none">{item.date}</p>
          <p className={`text-[10px] font-bold uppercase tracking-wide mt-0.5 ${isRemoval ? 'text-rose-500' : 'text-amber-500'}`}>
            {labelKind(item)}
          </p>
        </div>
        {corrObj?.submitted_at && (
          <span className="text-[9px] font-bold text-slate-400 flex items-center gap-1 shrink-0">
            <Send size={10} /> {fmtTs(corrObj.submitted_at)}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 px-4 py-3">
        <div className="flex-1 bg-slate-50 rounded-xl px-3 py-2">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Original</p>
          <TimeRange data={item.before} color="slate" />
        </div>
        <ArrowRight size={14} className="text-amber-400 shrink-0" />
        <div className={`flex-1 rounded-xl px-3 py-2 ${isRemoval ? 'bg-rose-50' : 'bg-amber-50'}`}>
          <p className={`text-[9px] font-black uppercase tracking-widest mb-0.5 ${isRemoval ? 'text-rose-400' : 'text-amber-500'}`}>
            Solicitado
          </p>
          {isRemoval
            ? <span className="text-[11px] font-black text-rose-500 italic">Remover dia</span>
            : <TimeRange data={item.proposed} color="amber" />
          }
        </div>
      </div>
    </div>
  );
}

function ResolvedGroup({ corrId, items, corr, accepted, dismissCorrection }) {
  return (
    <div className={`bg-white border rounded-2xl shadow-sm overflow-hidden ${accepted ? 'border-emerald-200' : 'border-rose-200'}`}>
      <div className={`h-1 ${accepted ? 'bg-emerald-400' : 'bg-rose-400'}`} />

      <div className="flex items-center gap-3 px-4 py-3">
        <div className={`p-1.5 rounded-xl shrink-0 ${accepted ? 'bg-emerald-50' : 'bg-rose-50'}`}>
          {accepted
            ? <CheckCircle size={16} className="text-emerald-500" />
            : <XCircle size={16} className="text-rose-500" />
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] font-black uppercase tracking-wide rounded-full px-2.5 py-0.5 ${
              accepted ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
            }`}>
              {accepted ? 'Aceite' : 'Rejeitado'}
            </span>
            <span className={`font-mono font-black text-xs ${accepted ? 'text-emerald-900' : 'text-rose-900'}`}>
              {items[0]?.date}{items.length > 1 ? ` +${items.length - 1}` : ''}
            </span>
          </div>
          {(corr?.submitted_at || corr?.reviewed_at) && (
            <div className={`flex items-center gap-2 mt-1 text-[9px] font-bold flex-wrap ${accepted ? 'text-emerald-500' : 'text-rose-400'}`}>
              {corr.submitted_at && (
                <span className="flex items-center gap-1">
                  <Send size={9} /> {fmtTs(corr.submitted_at)}
                </span>
              )}
              {corr.submitted_at && corr.reviewed_at && <span className="opacity-40">·</span>}
              {corr.reviewed_at && (
                <span className="flex items-center gap-1">
                  {accepted ? <CheckCircle size={9} /> : <XCircle size={9} />} {fmtTs(corr.reviewed_at)}
                </span>
              )}
            </div>
          )}
        </div>
        <button
          onClick={() => dismissCorrection(corrId)}
          className={`p-1.5 rounded-xl transition-colors shrink-0 ${
            accepted
              ? 'text-emerald-400 hover:text-emerald-700 hover:bg-emerald-50'
              : 'text-rose-400 hover:text-rose-700 hover:bg-rose-50'
          }`}
          title="Fechar"
        >
          <X size={14} />
        </button>
      </div>

      {items.length > 0 && (
        <div className="px-4 pb-3 space-y-2">
          {items.map((item) => {
            const hasProposed = item.proposed && (item.proposed.startTime || item.proposed.endTime);
            return (
              <div key={item.id} className="flex items-center gap-2">
                {items.length > 1 && (
                  <span className="font-mono text-[9px] text-slate-400 w-16 shrink-0">{item.date}</span>
                )}
                <div className="flex-1 bg-slate-50 rounded-xl px-3 py-2">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Original</p>
                  <TimeRange data={item.before} color="slate" />
                </div>
                <ArrowRight size={13} className={`shrink-0 ${accepted ? 'text-emerald-400' : 'text-rose-400'}`} />
                <div className={`flex-1 rounded-xl px-3 py-2 ${accepted ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                  <p className={`text-[9px] font-black uppercase tracking-widest mb-0.5 ${accepted ? 'text-emerald-500' : 'text-rose-500'}`}>
                    Aplicado
                  </p>
                  {hasProposed
                    ? <TimeRange data={item.proposed} color={accepted ? 'emerald' : 'rose'} />
                    : <span className={`text-[11px] font-black italic ${accepted ? 'text-emerald-500' : 'text-rose-500'}`}>Removido</span>
                  }
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function PendingCorrectionsPanel({ pendingItems, resolvedItems, pendingCollapsed, setPendingCollapsed, dismissCorrection, labelKind, corrections }) {
  if (pendingItems.length === 0 && resolvedItems.length === 0) return null;

  const findCorr = (id) => (corrections || []).find((c) => c.id === id) || null;

  const byCorrectionId = (resolvedItems || []).reduce((acc, item) => {
    if (!acc[item.correction_id]) acc[item.correction_id] = [];
    acc[item.correction_id].push(item);
    return acc;
  }, {});

  const hasPending = pendingItems.length > 0;
  const hasResolved = resolvedItems.length > 0;

  return (
    <div className="mt-4 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">

      <button
        onClick={() => setPendingCollapsed(v => !v)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-slate-50 transition-colors"
      >
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${hasPending ? 'bg-amber-100' : 'bg-slate-100'}`}>
          <Clock size={15} className={hasPending ? 'text-amber-600 animate-pulse' : 'text-slate-400'} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black text-slate-700 leading-none">
            {hasPending
              ? `${pendingItems.length} pedido${pendingItems.length > 1 ? 's' : ''} pendente${pendingItems.length > 1 ? 's' : ''}`
              : 'Pedidos respondidos'}
          </p>
          {hasPending && hasResolved && (
            <p className="text-[10px] font-bold text-slate-400 mt-0.5">
              {resolvedItems.length} já respondido{resolvedItems.length > 1 ? 's' : ''}
            </p>
          )}
        </div>
        {hasPending && (
          <span className="bg-amber-100 text-amber-700 text-[10px] font-black px-2.5 py-0.5 rounded-full shrink-0">
            {pendingItems.length}
          </span>
        )}
        {pendingCollapsed
          ? <ChevronDown size={15} className="text-slate-400 shrink-0" />
          : <ChevronUp size={15} className="text-slate-400 shrink-0" />
        }
      </button>

      {!pendingCollapsed && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-100 pt-3">

          {pendingItems.map((item) => (
            <PendingItem
              key={item.id}
              item={item}
              corrObj={findCorr(item.correction_id)}
              labelKind={labelKind}
            />
          ))}

          {hasPending && hasResolved && (
            <div className="flex items-center gap-2 py-1">
              <div className="flex-1 h-px bg-slate-100" />
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-300">Respondidos</span>
              <div className="flex-1 h-px bg-slate-100" />
            </div>
          )}

          {Object.entries(byCorrectionId).map(([corrId, items]) => {
            const corr = findCorr(corrId);
            return (
              <ResolvedGroup
                key={corrId}
                corrId={corrId}
                items={items}
                corr={corr}
                accepted={corr?.status === 'applied'}
                dismissCorrection={dismissCorrection}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
