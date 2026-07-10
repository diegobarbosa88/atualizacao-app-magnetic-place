import React, { useState, useMemo } from 'react';
import { Clock, Check, X, ChevronDown, ClipboardList } from 'lucide-react';
import { CLIENT_REQUESTS_CUTOFF, approveWorkerRequest, rejectWorkerRequest } from '../utils/clientPortalApi';

const calculateHoursDiff = (entry, exit, breakStart, breakEnd) => {
  if (!entry || !exit || !entry.includes(':') || !exit.includes(':')) return 0;
  const [eh, em] = entry.split(':').map(n => parseInt(n, 10) || 0);
  const [xh, xm] = exit.split(':').map(n => parseInt(n, 10) || 0);
  let diffMins = (xh * 60 + xm) - (eh * 60 + em);
  if (diffMins < 0) diffMins += 24 * 60;
  if (breakStart && breakEnd && breakStart !== '--:--' && breakEnd !== '--:--') {
    const [bsh, bsm] = breakStart.split(':').map(Number);
    const [beh, bem] = breakEnd.split(':').map(Number);
    let bDiff = (beh * 60 + bem) - (bsh * 60 + bsm);
    if (bDiff < 0) bDiff += 24 * 60;
    diffMins -= bDiff;
  }
  return Number(Math.max(0, diffMins / 60).toFixed(2));
};

function RequestCard({ correction, items, clientId, clientName, supabase, onActionDone }) {
  const [expanded, setExpanded] = useState(true);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [loading, setLoading] = useState(false);

  const isCreation = correction.type === 'creation_request';
  const isDeletion = correction.type === 'deletion_request';
  const typeLabel = isDeletion ? 'Eliminação' : 'Criação / Edição';
  const typeColor = isDeletion ? 'text-rose-600 bg-rose-50 border-rose-200' : 'text-indigo-600 bg-indigo-50 border-indigo-200';
  const dotColor = isDeletion ? 'bg-rose-400' : 'bg-indigo-400';

  const dateLabel = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', weekday: 'short' });
  };

  const handleApprove = async () => {
    setLoading(true);
    try {
      await approveWorkerRequest(supabase, { clientId, clientName, correction, items });
      onActionDone();
    } catch (err) {
      alert('Erro ao aprovar: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    setLoading(true);
    try {
      await rejectWorkerRequest(supabase, { clientId, clientName, correction, items, reason: rejectReason.trim() || undefined });
      onActionDone();
    } catch (err) {
      alert('Erro ao rejeitar: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`} />
          <div className="text-left">
            <p className="font-black text-slate-800 text-sm">{items[0]?.worker_name || 'Trabalhador'}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              {items.length} item{items.length > 1 ? 's' : ''} · {correction.month || dateLabel(items[0]?.date)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg border ${typeColor}`}>{typeLabel}</span>
          <ChevronDown size={15} className={`text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-100 px-4 pb-4 pt-3 space-y-3">
          {items.map(item => {
            const proposedHours = item.proposed?.startTime
              ? calculateHoursDiff(item.proposed.startTime, item.proposed.endTime, item.proposed.breakStart, item.proposed.breakEnd)
              : null;
            const isDel = !item.proposed?.startTime && !item.proposed?.endTime;
            return (
              <div key={item.id} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                    {dateLabel(item.date)}
                  </span>
                  {isDel
                    ? <span className="text-[10px] font-black text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-lg">Eliminar registo</span>
                    : proposedHours !== null && <span className="text-[10px] font-bold text-indigo-600">{proposedHours}h propostas</span>
                  }
                </div>
                {item.before?.startTime && (
                  <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                    <span className="font-bold text-[9px] uppercase tracking-widest text-slate-400">Antes</span>
                    <span>{item.before.startTime} → {item.before.endTime || '…'}</span>
                    {item.before.breakStart && <span className="text-slate-400">(pausa {item.before.breakStart}–{item.before.breakEnd || '…'})</span>}
                  </div>
                )}
                {!isDel && item.proposed?.startTime && (
                  <div className="flex items-center gap-2 text-xs text-indigo-700 font-bold">
                    <span className="font-bold text-[9px] uppercase tracking-widest text-indigo-400">Proposto</span>
                    <span>{item.proposed.startTime} → {item.proposed.endTime || '…'}</span>
                    {item.proposed.breakStart && <span className="text-indigo-400 font-normal">(pausa {item.proposed.breakStart}–{item.proposed.breakEnd || '…'})</span>}
                  </div>
                )}
              </div>
            );
          })}

          {correction.justification && (
            <p className="text-xs text-slate-500 italic border-l-2 border-slate-200 pl-3">"{correction.justification}"</p>
          )}

          {showRejectInput && (
            <div className="space-y-2">
              <input
                type="text"
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="Motivo da rejeição (opcional)"
                className="w-full px-3 py-2 text-sm border border-rose-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-300 bg-rose-50"
                autoFocus
              />
            </div>
          )}

          <div className="flex gap-2 pt-1">
            {!showRejectInput ? (
              <>
                <button
                  onClick={handleApprove}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all disabled:opacity-50"
                >
                  <Check size={14} /> Aprovar
                </button>
                <button
                  onClick={() => setShowRejectInput(true)}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 font-black text-xs uppercase tracking-wider rounded-xl border border-rose-200 transition-all disabled:opacity-50"
                >
                  <X size={14} /> Rejeitar
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleReject}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all disabled:opacity-50"
                >
                  <X size={14} /> {loading ? 'A rejeitar…' : 'Confirmar Rejeição'}
                </button>
                <button
                  onClick={() => { setShowRejectInput(false); setRejectReason(''); }}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black text-xs rounded-xl transition-all"
                >
                  Voltar
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function HistoryCard({ correction, items }) {
  const [expanded, setExpanded] = useState(false);
  const isApproved = correction.status === 'applied';
  const dateStr = correction.reviewed_at
    ? new Date(correction.reviewed_at).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '—';
  const byClient = (correction.reviewed_by || '').startsWith('client:');
  const badge = isApproved
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : 'bg-rose-50 text-rose-700 border-rose-200';
  const label = isApproved ? '✓ Aprovado' : '✗ Rejeitado';

  return (
    <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Clock size={13} className="text-slate-400" />
          <span className="text-xs font-bold text-slate-600">{items[0]?.worker_name || 'Trabalhador'}</span>
          <span className="text-[10px] text-slate-400">{correction.month}</span>
        </div>
        <div className="flex items-center gap-2">
          {byClient && <span className="text-[9px] font-bold text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded">por si</span>}
          <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg border ${badge}`}>{label} {dateStr}</span>
          <ChevronDown size={13} className={`text-slate-300 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </button>
      {expanded && (
        <div className="px-4 pb-3 border-t border-slate-50 pt-2 space-y-2">
          {items.map(item => (
            <div key={item.id} className="text-xs text-slate-500 flex items-center gap-2">
              <span className="font-bold text-[9px] uppercase text-slate-400">{item.date}</span>
              {item.proposed?.startTime
                ? <span>{item.proposed.startTime} → {item.proposed.endTime}</span>
                : <span className="text-rose-500">Eliminação</span>
              }
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function WorkerRequestsView({ effectiveClientId, clientName, corrections, correctionItems, supabase, onRequestsChange }) {
  const pending = useMemo(() => {
    if (!corrections || !effectiveClientId) return [];
    return corrections.filter(c =>
      String(c.client_id) === String(effectiveClientId) &&
      (c.type === 'creation_request' || c.type === 'deletion_request') &&
      c.status === 'submitted' &&
      c.submitted_at >= CLIENT_REQUESTS_CUTOFF
    ).sort((a, b) => (b.submitted_at || '').localeCompare(a.submitted_at || ''));
  }, [corrections, effectiveClientId]);

  const history = useMemo(() => {
    if (!corrections || !effectiveClientId) return [];
    return corrections.filter(c =>
      String(c.client_id) === String(effectiveClientId) &&
      (c.type === 'creation_request' || c.type === 'deletion_request') &&
      (c.status === 'applied' || c.status === 'rejected') &&
      c.submitted_at >= CLIENT_REQUESTS_CUTOFF
    ).sort((a, b) => (b.reviewed_at || b.submitted_at || '').localeCompare(a.reviewed_at || a.submitted_at || ''));
  }, [corrections, effectiveClientId]);

  const getItems = (correctionId) =>
    (correctionItems || []).filter(it => it.correction_id === correctionId);

  const handleActionDone = () => {
    if (onRequestsChange) onRequestsChange();
  };

  return (
    <div className="space-y-8">
      {/* Cabeçalho */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center">
          <ClipboardList size={18} className="text-indigo-600" />
        </div>
        <div>
          <h2 className="font-black text-slate-800 text-xl uppercase tracking-tighter">Pedidos dos Colaboradores</h2>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Aprovação de registos solicitados</p>
        </div>
        {pending.length > 0 && (
          <span className="ml-auto bg-amber-500 text-white text-[10px] font-black px-2.5 py-1 rounded-full">
            {pending.length} pendente{pending.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Pendentes */}
      {pending.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-50 flex items-center justify-center mb-4">
            <ClipboardList size={22} className="text-slate-300" />
          </div>
          <p className="font-black text-slate-400 text-sm uppercase tracking-widest">Sem pedidos pendentes</p>
          <p className="text-xs text-slate-300 mt-1">Os pedidos dos colaboradores aparecerão aqui para aprovação</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">A aguardar aprovação</p>
          {pending.map(c => (
            <RequestCard
              key={c.id}
              correction={c}
              items={getItems(c.id)}
              clientId={effectiveClientId}
              clientName={clientName}
              supabase={supabase}
              onActionDone={handleActionDone}
            />
          ))}
        </div>
      )}

      {/* Histórico */}
      {history.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Histórico</p>
          {history.slice(0, 20).map(c => (
            <HistoryCard key={c.id} correction={c} items={getItems(c.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
