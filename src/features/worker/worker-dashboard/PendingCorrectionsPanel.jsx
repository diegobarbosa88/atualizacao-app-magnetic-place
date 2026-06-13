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
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-mono font-black text-slate-800 text-xs">{item.date}</span>
        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md flex items-center gap-1 ${
          isRemoval ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
        }`}>
          {isRemoval ? <Trash2 size={9} /> : <Edit3 size={9} />}
          {labelKind(item)}
        </span>
        {corrObj?.submitted_at && (
          <span className="text-[9px] font-bold text-slate-400 flex items-center gap-1 ml-auto">
            <Send size={9} /> {fmtTs(corrObj.submitted_at)}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5">
          <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Original</p>
          <TimeRange data={item.before} color="slate" />
        </div>
        <ArrowRight size={14} className="text-amber-400 shrink-0" />
        <div className={`flex-1 border rounded-lg px-2.5 py-1.5 ${isRemoval ? 'bg-rose-50 border-rose-200' : 'bg-amber-50 border-amber-200'}`}>
          <p className={`text-[8px] font-black uppercase tracking-widest mb-0.5 ${isRemoval ? 'text-rose-400' : 'text-amber-500'}`}>Solicitado</p>
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
    <div className={`border rounded-xl p-3 space-y-2 ${accepted ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${
            accepted ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
          }`}>
            {accepted ? <CheckCircle size={9} /> : <XCircle size={9} />}
            {accepted ? 'Aceite' : 'Rejeitado'}
          </span>
          <span className={`font-mono font-black text-xs ${accepted ? 'text-emerald-900' : 'text-rose-900'}`}>
            {items[0]?.date}{items.length > 1 ? ` +${items.length - 1}` : ''}
          </span>
        </div>
        <button
          onClick={() => dismissCorrection(corrId)}
          className={`p-1 rounded-lg transition-colors ${
            accepted ? 'text-emerald-400 hover:text-emerald-700 hover:bg-emerald-100' : 'text-rose-400 hover:text-rose-700 hover:bg-rose-100'
          }`}
          title="Fechar"
        >
          <X size={13} />
        </button>
      </div>

      {(corr?.submitted_at || corr?.reviewed_at) && (
        <div className={`flex items-center gap-3 text-[9px] font-bold flex-wrap ${accepted ? 'text-emerald-600' : 'text-rose-600'}`}>
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

      {items.map((item) => {
        const hasProposed = item.proposed && (item.proposed.startTime || item.proposed.endTime);
        return (
          <div key={item.id} className="flex items-center gap-2">
            {items.length > 1 && (
              <span className="font-mono text-[9px] text-slate-400 w-16 shrink-0">{item.date}</span>
            )}
            <div className="flex-1 bg-white/60 border border-white rounded-lg px-2.5 py-1.5">
              <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Original</p>
              <TimeRange data={item.before} color="slate" />
            </div>
            <ArrowRight size={13} className={`shrink-0 ${accepted ? 'text-emerald-400' : 'text-rose-400'}`} />
            <div className="flex-1 bg-white/60 border border-white rounded-lg px-2.5 py-1.5">
              <p className={`text-[8px] font-black uppercase tracking-widest mb-0.5 ${accepted ? 'text-emerald-500' : 'text-rose-500'}`}>Aplicado</p>
              {hasProposed
                ? <TimeRange data={item.proposed} color={accepted ? 'emerald' : 'rose'} />
                : <span className={`text-[11px] font-black italic ${accepted ? 'text-emerald-500' : 'text-rose-500'}`}>Removido</span>
              }
            </div>
          </div>
        );
      })}
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
    <div className="mb-4 bg-white border border-slate-200 rounded-2xl overflow-hidden">

      {/* Header colapsável */}
      <button
        onClick={() => setPendingCollapsed(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-50 transition-colors"
      >
        <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${hasPending ? 'bg-amber-100' : 'bg-slate-100'}`}>
          <Clock size={14} className={hasPending ? 'text-amber-600 animate-pulse' : 'text-slate-400'} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black text-slate-700 leading-none">
            {hasPending
              ? `${pendingItems.length} pedido${pendingItems.length > 1 ? 's' : ''} pendente${pendingItems.length > 1 ? 's' : ''}`
              : 'Pedidos respondidos'}
          </p>
          {hasPending && hasResolved && (
            <p className="text-[9px] font-bold text-slate-400 mt-0.5">{resolvedItems.length} já respondido{resolvedItems.length > 1 ? 's' : ''}</p>
          )}
        </div>
        {hasPending && (
          <span className="bg-amber-100 text-amber-700 text-[9px] font-black px-2 py-0.5 rounded-full shrink-0">
            {pendingItems.length}
          </span>
        )}
        {pendingCollapsed
          ? <ChevronDown size={15} className="text-slate-400 shrink-0" />
          : <ChevronUp size={15} className="text-slate-400 shrink-0" />}
      </button>

      {!pendingCollapsed && (
        <div className="px-3 pb-3 space-y-2 border-t border-slate-100 pt-3">

          {/* Pendentes */}
          {pendingItems.map((item) => (
            <PendingItem
              key={item.id}
              item={item}
              corrObj={findCorr(item.correction_id)}
              labelKind={labelKind}
            />
          ))}

          {/* Separador */}
          {hasPending && hasResolved && (
            <div className="flex items-center gap-2 py-1">
              <div className="flex-1 h-px bg-slate-100" />
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-300">Respondidos</span>
              <div className="flex-1 h-px bg-slate-100" />
            </div>
          )}

          {/* Resolvidos */}
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
