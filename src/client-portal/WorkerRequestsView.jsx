import React, { useState, useMemo } from 'react';
import { Clock, Check, X, ChevronDown, ClipboardList } from 'lucide-react';
import { CLIENT_REQUESTS_CUTOFF, approveWorkerRequest, rejectWorkerRequest } from '../utils/clientPortalApi';
import { calculateDuration } from '../utils/formatUtils';
import { roundTimeToIntervalTimeUp, roundTimeToIntervalTimeDown, getIntervalSettings } from '../utils/timeUtils';

const calculateHoursDiff = (entry, exit, breakStart, breakEnd) => {
  if (!entry || !exit || !entry.includes(':') || !exit.includes(':')) return 0;
  const { interval, tolerance } = getIntervalSettings();
  return calculateDuration(
    roundTimeToIntervalTimeUp(entry, interval, tolerance),
    roundTimeToIntervalTimeDown(exit, interval),
    breakStart && breakStart !== '--:--' ? roundTimeToIntervalTimeUp(breakStart, interval, tolerance) : null,
    breakEnd && breakEnd !== '--:--' ? roundTimeToIntervalTimeDown(breakEnd, interval) : null,
  );
};

const dateLabel = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', weekday: 'short' });
};

function RequestCard({ correction, items, clientId, clientName, supabase, onActionDone }) {
  const [expanded, setExpanded] = useState(true);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [loading, setLoading] = useState(false);

  const isDeletion = correction.type === 'deletion_request';

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

  const workerName = items[0]?.worker_name || 'Colaborador';

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      {/* Cabeçalho do card */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left"
      >
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isDeletion ? 'bg-rose-400' : 'bg-indigo-400'}`} />
        <div className="flex-1 min-w-0">
          <p className="font-black text-slate-800 text-sm truncate">{workerName}</p>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            {items.length} item{items.length > 1 ? 's' : ''} · {correction.month || dateLabel(items[0]?.date)}
          </p>
        </div>
        <span className={`text-[10px] font-black px-2 py-1 rounded-lg border flex-shrink-0 ${isDeletion ? 'text-rose-600 bg-rose-50 border-rose-200' : 'text-indigo-600 bg-indigo-50 border-indigo-200'}`}>
          {isDeletion ? 'Eliminação' : 'Criação'}
        </span>
        <ChevronDown size={14} className={`text-slate-400 flex-shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {expanded && (
        <div className="border-t border-slate-100 px-4 pb-4 pt-3 space-y-3">
          {/* Items */}
          {items.map(item => {
            const proposedHours = item.proposed?.startTime
              ? calculateHoursDiff(item.proposed.startTime, item.proposed.endTime, item.proposed.breakStart, item.proposed.breakEnd)
              : null;
            const isDel = !item.proposed?.startTime && !item.proposed?.endTime;
            return (
              <div key={item.id} className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">{dateLabel(item.date)}</span>
                  {isDel
                    ? <span className="text-[10px] font-black text-rose-600">Eliminar</span>
                    : proposedHours !== null && <span className="text-[10px] font-bold text-indigo-600">{proposedHours}h</span>
                  }
                </div>
                {item.before?.startTime && (
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="font-bold text-[9px] uppercase">Antes</span>
                    <span className="font-mono">{item.before.startTime} → {item.before.endTime || '…'}</span>
                  </div>
                )}
                {!isDel && item.proposed?.startTime && (
                  <div className="flex items-center gap-2 text-xs text-indigo-700 font-bold">
                    <span className="font-bold text-[9px] uppercase text-indigo-400">Proposto</span>
                    <span className="font-mono">{item.proposed.startTime} → {item.proposed.endTime || '…'}</span>
                    {item.proposed.breakStart && (
                      <span className="text-indigo-300 font-normal text-[10px]">⏸ {item.proposed.breakStart}–{item.proposed.breakEnd || '…'}</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {correction.justification && (
            <p className="text-xs text-slate-400 italic border-l-2 border-slate-200 pl-3">"{correction.justification}"</p>
          )}

          {/* Input de rejeição */}
          {showRejectInput && (
            <input
              type="text"
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Motivo da rejeição (opcional)"
              className="w-full px-3 py-2 text-sm border border-rose-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-300 bg-rose-50"
              autoFocus
            />
          )}

          {/* Botões de ação */}
          <div className="flex gap-2 pt-1">
            {!showRejectInput ? (
              <>
                <button
                  onClick={handleApprove}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all disabled:opacity-50"
                >
                  <Check size={13} /> {loading ? '…' : 'Aprovar'}
                </button>
                <button
                  onClick={() => setShowRejectInput(true)}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 font-black text-xs uppercase tracking-wider rounded-xl border border-rose-200 transition-all"
                >
                  <X size={13} /> Rejeitar
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleReject}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all disabled:opacity-50"
                >
                  <X size={13} /> {loading ? '…' : 'Confirmar'}
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
  const byClient = (correction.reviewed_by || '').startsWith('client:');
  const reviewDate = correction.reviewed_at
    ? new Date(correction.reviewed_at).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: '2-digit' })
    : null;

  return (
    <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full px-4 py-3 hover:bg-slate-50 transition-colors text-left"
      >
        {/* Linha principal */}
        <div className="flex items-center gap-2 min-w-0">
          <Clock size={12} className="text-slate-300 flex-shrink-0" />
          <span className="font-bold text-slate-700 text-xs truncate flex-1 min-w-0">
            {items[0]?.worker_name || 'Colaborador'}
          </span>
          <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg flex-shrink-0 ${isApproved ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
            {isApproved ? '✓' : '✗'}
          </span>
          <ChevronDown size={12} className={`text-slate-300 flex-shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </div>
        {/* Linha secundária */}
        <div className="flex items-center gap-2 mt-0.5 ml-5">
          {correction.month && <span className="text-[10px] text-slate-400">{correction.month}</span>}
          {reviewDate && (
            <span className={`text-[10px] font-bold ${isApproved ? 'text-emerald-600' : 'text-rose-500'}`}>
              {isApproved ? 'Aprovado' : 'Rejeitado'} {reviewDate}
            </span>
          )}
          {byClient && <span className="text-[9px] font-bold text-indigo-400 bg-indigo-50 px-1.5 py-0.5 rounded">por si</span>}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-3 border-t border-slate-50 pt-2 space-y-1.5">
          {items.map(item => (
            <div key={item.id} className="flex items-center gap-3 text-xs text-slate-500">
              <span className="font-bold text-[9px] uppercase text-slate-400 w-16 shrink-0">{item.date}</span>
              {item.proposed?.startTime
                ? <span className="font-mono">{item.proposed.startTime} → {item.proposed.endTime}</span>
                : <span className="text-rose-400">Eliminação</span>
              }
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function WorkerRequestsView({ effectiveClientId, clientName, corrections, correctionItems, supabase, onRequestsChange, compact = false }) {
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
    <div className={compact ? 'space-y-4' : 'space-y-6'}>
      {/* Pendentes */}
      {pending.length === 0 ? (
        <div className={`bg-slate-50 rounded-2xl border border-slate-100 text-center ${compact ? 'py-8 px-4' : 'py-12 px-4'}`}>
          <ClipboardList size={compact ? 18 : 24} className="mx-auto text-slate-300 mb-2" />
          <p className="font-black text-slate-400 text-sm uppercase tracking-widest">Sem pedidos pendentes</p>
          <p className="text-xs text-slate-300 mt-1">Os pedidos dos colaboradores aparecerão aqui</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">
            {pending.length} a aguardar aprovação
          </p>
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
        <div className="space-y-1.5">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Histórico</p>
          {history.slice(0, 20).map(c => (
            <HistoryCard key={c.id} correction={c} items={getItems(c.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
