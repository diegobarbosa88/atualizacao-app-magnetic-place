import React, { useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CheckCircle, AlertCircle, XCircle, Clock, Building2, ChevronDown, LayoutList, Users, Send, MessageCircle, FileText } from 'lucide-react';
import { formatDocDate } from '../../../utils/dateUtils';
import { useApp } from '../../../context/AppContext';
import { applyCreationRequest, rejectCorrection, applyCorrection, markResolved } from '../../../utils/correctionsApi';
import { calculateDuration } from '../../../utils/formatUtils';
import CorrectionDetail from './CorrectionDetail';
import { STATUS_LABEL, TYPE_LABEL } from './correctionsUtils';

// ── Client corrections grouped view ──────────────────────────────────────────

function ClientCorrectionsPanel({ filtered, clients, workers, itemsByCorrection, expandedCards, setExpandedCards, supabase, currentUser, setCorrections, setCorrectionItems, logs }) {
  const fmtTs = (iso) => formatDocDate(iso, true) || '—';
  const hasBreak = (t) => t && (t.breakStart || t.breakEnd);

  const groupsMap = new Map();
  filtered.forEach((c) => {
    const key = `${c.client_id || 'sem-cliente'}__${c.month || 'sem-mes'}`;
    if (!groupsMap.has(key)) groupsMap.set(key, { clientId: c.client_id, month: c.month, corrections: [] });
    groupsMap.get(key).corrections.push(c);
  });
  const groups = [...groupsMap.values()].sort((a, b) => {
    const am = (b.month || '').localeCompare(a.month || '');
    if (am !== 0) return am;
    const aName = clients.find((cl) => String(cl.id) === String(a.clientId))?.name || '';
    const bName = clients.find((cl) => String(cl.id) === String(b.clientId))?.name || '';
    return aName.localeCompare(bName);
  });

  if (groups.length === 0) return null;

  const handleApply = async (correction, items) => {
    const client = clients.find((cl) => String(cl.id) === String(correction.client_id));
    if (!confirm(`Aplicar correção ao relatório de ${client?.name || 'cliente'}?`)) return;
    try {
      if (correction.type === 'quick') {
        await markResolved(supabase, { correctionId: correction.id, clientId: correction.client_id, month: correction.month, note: '', reviewer: currentUser?.id, clientName: client?.name, clientEmail: client?.email, portalBase: window.location.origin, shareToken: client?.share_token });
      } else {
        // Marca todos os itens como 'accepted' para aplicação em bloco
        const acceptedItems = items.map((it) => ({ ...it, item_status: 'accepted' }));
        await applyCorrection(supabase, { correction, items: acceptedItems, logs, reviewer: currentUser?.id, clientName: client?.name, clientEmail: client?.email, portalBase: window.location.origin, shareToken: client?.share_token });
      }
      setCorrections((prev) => prev.map((c) => c.id === correction.id ? { ...c, status: 'applied', reviewed_at: new Date().toISOString() } : c));
    } catch (e) { alert('Erro ao aplicar: ' + e.message); }
  };

  const handleReject = async (correction) => {
    const client = clients.find((cl) => String(cl.id) === String(correction.client_id));
    const reason = prompt('Motivo da rejeição (será enviado ao cliente):');
    if (reason === null) return;
    try {
      await rejectCorrection(supabase, { correctionId: correction.id, clientId: correction.client_id, month: correction.month, reason, reviewer: currentUser?.id, clientName: client?.name, clientEmail: client?.email, portalBase: window.location.origin, shareToken: client?.share_token });
      setCorrections((prev) => prev.map((c) => c.id === correction.id ? { ...c, status: 'rejected', reviewed_at: new Date().toISOString() } : c));
    } catch (e) { alert('Erro ao rejeitar: ' + e.message); }
  };

  return groups.map((g) => {
    const client = clients.find((cl) => String(cl.id) === String(g.clientId));
    const pendingCount = g.corrections.filter((c) => c.status === 'submitted' || c.status === 'under_review').length;
    const groupKey = `${g.clientId || ''}__${g.month || ''}`;
    const isExpanded = !!expandedCards[groupKey];
    const isPending = pendingCount > 0;
    const isResolved = g.corrections.every((c) => c.status === 'applied' || c.status === 'rejected');

    return (
      <div key={groupKey} className={`bg-white border rounded-2xl overflow-hidden ${isPending ? 'border-orange-200 shadow-sm' : 'border-slate-200'}`}>
        <button
          onClick={() => setExpandedCards((prev) => ({ ...prev, [groupKey]: !prev[groupKey] }))}
          className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className={`p-2 rounded-xl flex-shrink-0 ${isPending ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-500'}`}>
              <Building2 size={16} />
            </div>
            <div className="text-left min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-slate-700 text-sm truncate">{client?.name || g.clientId || 'Cliente'}</span>
                <span className="text-xs font-mono text-slate-400">{g.month}</span>
              </div>
              <span className="text-xs text-slate-400">
                {g.corrections.length} pedido{g.corrections.length !== 1 ? 's' : ''} • {pendingCount > 0 ? `${pendingCount} pendente${pendingCount !== 1 ? 's' : ''}` : 'resolvido'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {isResolved && <span className="text-[10px] font-black px-3 py-1.5 rounded-xl bg-slate-100 text-slate-500">Resolvido</span>}
            <ChevronDown size={16} className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
          </div>
        </button>

        {isExpanded && (
          <div className="px-4 pb-4 border-t border-slate-100">
            <div className="pt-4 space-y-3">
              {g.corrections.map((correction) => {
                const corrItems = itemsByCorrection.get(correction.id) || [];
                const corrIsPending = correction.status === 'submitted' || correction.status === 'under_review';
                const corrIsApplied = correction.status === 'applied';
                const isQuick = correction.type === 'quick';

                return (
                  <div key={correction.id} className={`rounded-xl border p-3 ${corrIsPending ? 'bg-orange-50 border-orange-200' : corrIsApplied ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
                    {/* Header */}
                    <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                      <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-bold ${corrIsPending ? 'text-orange-700' : corrIsApplied ? 'text-emerald-700' : 'text-rose-700'}`}>
                        <span className={`flex items-center gap-1 px-2 py-0.5 rounded-md font-black ${isQuick ? 'bg-indigo-100 text-indigo-600' : 'bg-amber-100 text-amber-600'}`}>
                          {isQuick ? <MessageCircle size={10} /> : <FileText size={10} />}
                          {isQuick ? 'Mensagem' : 'Precisão'}
                        </span>
                        {correction.submitted_at && (
                          <span className="flex items-center gap-1"><Send size={10} /> Submetido: <span className="font-mono">{fmtTs(correction.submitted_at)}</span></span>
                        )}
                        {!corrIsPending && correction.reviewed_at && (
                          <span className="flex items-center gap-1">
                            {corrIsApplied ? <CheckCircle size={10} /> : <XCircle size={10} />}
                            Respondido: <span className="font-mono">{fmtTs(correction.reviewed_at)}</span>
                          </span>
                        )}
                      </div>
                      {corrIsPending && (
                        <div className="flex gap-1.5 flex-shrink-0">
                          <button onClick={() => handleApply(correction, corrItems)} className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-[10px] font-black hover:bg-emerald-700 transition-colors"><CheckCircle size={12} /> Aceitar</button>
                          <button onClick={() => handleReject(correction)} className="flex items-center gap-1 px-2.5 py-1 bg-rose-500 text-white rounded-lg text-[10px] font-black hover:bg-rose-600 transition-colors"><XCircle size={12} /> Rejeitar</button>
                        </div>
                      )}
                      {!corrIsPending && (
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${corrIsApplied ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                          {corrIsApplied ? '✓ Aceite' : '✕ Rejeitado'}
                        </span>
                      )}
                    </div>

                    {/* Body */}
                    {isQuick ? (
                      <p className={`text-xs italic font-medium mt-1 ${corrIsPending ? 'text-orange-800' : corrIsApplied ? 'text-emerald-800' : 'text-rose-800'}`}>
                        "{correction.justification || '(sem texto)'}"
                      </p>
                    ) : (
                      <div className="space-y-2 mt-1">
                        {corrItems.map((item) => {
                          const workerObj = workers.find((w) => String(w.id) === String(item.worker_id));
                          const hasBefore = item.before && (item.before.startTime || item.before.endTime);
                          const hasProposed = item.proposed && (item.proposed.startTime || item.proposed.endTime);
                          return (
                            <div key={item.id} className="bg-white/70 rounded-lg p-2.5 border border-white/80">
                              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                <span className={`font-black text-xs ${corrIsPending ? 'text-orange-900' : corrIsApplied ? 'text-emerald-900' : 'text-rose-900'}`}>
                                  {item.worker_name || workerObj?.name || 'Trabalhador'}
                                </span>
                                <span className={`font-mono font-black text-xs ${corrIsPending ? 'text-orange-800' : corrIsApplied ? 'text-emerald-800' : 'text-rose-800'}`}>{item.date}</span>
                              </div>
                              <div className="flex items-center gap-2 text-slate-500 text-xs">
                                <span className="text-[10px] font-black uppercase tracking-widest w-20 flex-shrink-0 text-slate-400">Original</span>
                                {hasBefore
                                  ? <><span className="font-mono">{item.before.startTime} → {item.before.endTime}</span>{hasBreak(item.before) && <span className="text-slate-400">· pausa {item.before.breakStart || '--:--'}–{item.before.breakEnd || '--:--'}</span>}</>
                                  : <span className="italic text-slate-300">Sem registo anterior</span>}
                              </div>
                              <div className={`flex items-center gap-2 font-bold text-xs ${corrIsPending ? 'text-orange-800' : corrIsApplied ? 'text-emerald-800' : 'text-rose-800'}`}>
                                <span className={`text-[10px] font-black uppercase tracking-widest w-20 flex-shrink-0 ${corrIsPending ? 'text-orange-600' : corrIsApplied ? 'text-emerald-600' : 'text-rose-600'}`}>Solicitado</span>
                                {hasProposed
                                  ? <><span className="font-mono">{item.proposed.startTime} → {item.proposed.endTime}</span>{hasBreak(item.proposed) && <span className={`font-normal ${corrIsPending ? 'text-orange-500' : corrIsApplied ? 'text-emerald-500' : 'text-rose-500'}`}>· pausa {item.proposed.breakStart || '--:--'}–{item.proposed.breakEnd || '--:--'}</span>}</>
                                  : <span className={`italic font-bold ${corrIsApplied ? 'text-emerald-500' : 'text-rose-500'}`}>Remover dia</span>}
                              </div>
                            </div>
                          );
                        })}
                        {corrItems.length === 0 && <p className="text-xs text-slate-400 italic">Sem itens registados.</p>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  });
}

// ── Worker corrections grouped view ──────────────────────────────────────────

function WorkerCorrectionsPanel({ filtered, clients, workers, itemsByCorrection, expandedCards, setExpandedCards, onApprove, onReject }) {
  const [expandedItems, setExpandedItems] = React.useState({});
  const toggleItem = (id) => setExpandedItems((prev) => ({ ...prev, [id]: !prev[id] }));

  const labelKind = (item) => {
    if (!item.before || (!item.before.startTime && !item.before.endTime)) return '✚ Novo';
    if (!item.proposed || (!item.proposed.startTime && !item.proposed.endTime)) return '✖ Eliminar';
    return '✎ Ajuste';
  };
  const hasBreak = (t) => t && (t.breakStart || t.breakEnd);
  const fmtTs = (iso) => formatDocDate(iso, true) || '—';

  const groupsMap = new Map();
  filtered.forEach((c) => {
    const key = `${c.client_id || 'sem-cliente'}__${c.month || 'sem-mes'}`;
    if (!groupsMap.has(key)) groupsMap.set(key, { clientId: c.client_id, month: c.month, corrections: [] });
    groupsMap.get(key).corrections.push(c);
  });
  const groups = [...groupsMap.values()].sort((a, b) => {
    const am = `${a.month || ''}`.localeCompare(b.month || '');
    if (am !== 0) return am;
    const aName = clients.find((cl) => String(cl.id) === String(a.clientId))?.name || '';
    const bName = clients.find((cl) => String(cl.id) === String(b.clientId))?.name || '';
    return aName.localeCompare(bName);
  });

  if (groups.length === 0) return null;

  return groups.map((g) => {
    const client = clients.find((cl) => String(cl.id) === String(g.clientId));
    // pendingCount based on correction status (not item_status) so updates immediately after approve/reject
    const pendingCount = g.corrections.filter((c) => c.status === 'submitted' || c.status === 'under_review').length;
    const allItemCount = g.corrections.reduce((sum, c) => sum + (itemsByCorrection.get(c.id) || []).length, 0);
    const groupKey = `${g.clientId || ''}__${g.month || ''}`;
    const isExpanded = !!expandedCards[groupKey];
    const isPending = pendingCount > 0;
    const isResolved = g.corrections.every((c) => c.status === 'applied' || c.status === 'rejected');

    return (
      <div key={groupKey} className={`bg-white border rounded-2xl overflow-hidden ${isPending ? 'border-amber-200 shadow-sm' : 'border-slate-200'}`}>
        <button
          onClick={() => setExpandedCards((prev) => ({ ...prev, [groupKey]: !prev[groupKey] }))}
          className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className={`p-2 rounded-xl flex-shrink-0 ${isPending ? 'bg-amber-100 text-amber-600' : isResolved ? 'bg-slate-100 text-slate-500' : 'bg-slate-100 text-slate-500'}`}>
              <Building2 size={16} />
            </div>
            <div className="text-left min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-slate-700 text-sm truncate">{client?.name || g.clientId || 'Cliente'}</span>
                <span className="text-xs font-mono text-slate-400">{g.month}</span>
              </div>
              <span className="text-xs text-slate-400">
                {allItemCount} item{allItemCount !== 1 ? 's' : ''} • {pendingCount > 0 ? `${pendingCount} pendente${pendingCount !== 1 ? 's' : ''}` : 'resolvido'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {isResolved && (
              <span className="text-[10px] font-black px-3 py-1.5 rounded-xl bg-slate-100 text-slate-500">Resolvido</span>
            )}
            <ChevronDown size={16} className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
          </div>
        </button>
        {isExpanded && (
          <div className="px-4 pb-4 border-t border-slate-100">
            <div className="pt-4 space-y-3">
              {g.corrections.map((correction) => {
                const corrItems = itemsByCorrection.get(correction.id) || [];
                const corrIsPending = correction.status === 'submitted' || correction.status === 'under_review';
                const corrIsApplied = correction.status === 'applied';
                return (
                  <div key={correction.id} className={`rounded-xl border p-3 ${corrIsPending ? 'bg-amber-50 border-amber-200' : corrIsApplied ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
                    {/* Correction header */}
                    <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                      <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-bold ${corrIsPending ? 'text-amber-700' : corrIsApplied ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {correction.submitted_at && (
                          <span className="flex items-center gap-1">
                            <Send size={10} /> Solicitado: <span className="font-mono">{fmtTs(correction.submitted_at)}</span>
                          </span>
                        )}
                        {!corrIsPending && correction.reviewed_at && (
                          <span className="flex items-center gap-1">
                            {corrIsApplied ? <CheckCircle size={10} /> : <XCircle size={10} />}
                            Respondido: <span className="font-mono">{fmtTs(correction.reviewed_at)}</span>
                          </span>
                        )}
                      </div>
                      {corrIsPending && (
                        <div className="flex gap-1.5 flex-shrink-0">
                          <button onClick={() => onApprove(correction)} title="Aprovar" className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-[10px] font-black hover:bg-emerald-700 transition-colors"><CheckCircle size={12} /> Aceitar</button>
                          <button onClick={() => onReject(correction)} title="Rejeitar" className="flex items-center gap-1 px-2.5 py-1 bg-rose-500 text-white rounded-lg text-[10px] font-black hover:bg-rose-600 transition-colors"><XCircle size={12} /> Rejeitar</button>
                        </div>
                      )}
                      {!corrIsPending && (
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${corrIsApplied ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                          {corrIsApplied ? '✓ Aceite' : '✕ Rejeitado'}
                        </span>
                      )}
                    </div>
                    {/* Items */}
                    <div className="space-y-1.5">
                      {corrItems.map((item) => {
                        const workerObj = workers.find((w) => String(w.id) === String(item.worker_id));
                        const hasBefore = item.before && (item.before.startTime || item.before.endTime);
                        const hasProposed = item.proposed && (item.proposed.startTime || item.proposed.endTime);
                        const kind = labelKind(item);
                        const isOpen = !!expandedItems[item.id];
                        return (
                          <div key={item.id} className="bg-white/70 rounded-lg border border-white/80 overflow-hidden">
                            {/* Linha clicável — log ao clicar */}
                            <button
                              onClick={() => toggleItem(item.id)}
                              className="w-full flex items-center gap-2 p-2.5 text-left hover:bg-white/90 transition-colors"
                            >
                              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded flex-shrink-0 ${corrIsPending ? 'bg-amber-100 text-amber-700' : corrIsApplied ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600'}`}>{kind}</span>
                              <span className={`font-black text-xs flex-shrink-0 ${corrIsPending ? 'text-amber-900' : corrIsApplied ? 'text-emerald-900' : 'text-rose-900'}`}>
                                {item.worker_name || workerObj?.name || 'Trabalhador'}
                              </span>
                              <span className={`font-mono text-xs ${corrIsPending ? 'text-amber-700' : corrIsApplied ? 'text-emerald-700' : 'text-rose-700'}`}>{item.date}</span>
                              {hasProposed && !isOpen && (
                                <span className="font-mono text-[10px] text-slate-400 ml-auto">{item.proposed.startTime}–{item.proposed.endTime}</span>
                              )}
                              <ChevronDown size={12} className={`ml-auto flex-shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                            </button>
                            {/* Log de alterações expandido */}
                            {isOpen && (
                              <div className="px-2.5 pb-2.5 border-t border-white/60 pt-2 space-y-1">
                                <div className="flex items-center gap-2 text-slate-500 text-xs">
                                  <span className="text-[10px] font-black uppercase tracking-widest w-20 flex-shrink-0 text-slate-400">Original</span>
                                  {hasBefore
                                    ? <><span className="font-mono">{item.before.startTime} → {item.before.endTime}</span>{hasBreak(item.before) && <span className="text-slate-400 ml-1">· pausa {item.before.breakStart || '--:--'}–{item.before.breakEnd || '--:--'}</span>}</>
                                    : <span className="italic text-slate-300">Sem registo anterior</span>}
                                </div>
                                <div className={`flex items-center gap-2 font-bold text-xs ${corrIsPending ? 'text-amber-800' : corrIsApplied ? 'text-emerald-800' : 'text-rose-800'}`}>
                                  <span className={`text-[10px] font-black uppercase tracking-widest w-20 flex-shrink-0 ${corrIsPending ? 'text-amber-600' : corrIsApplied ? 'text-emerald-600' : 'text-rose-600'}`}>Solicitado</span>
                                  {hasProposed
                                    ? <><span className="font-mono">{item.proposed.startTime} → {item.proposed.endTime}</span>{hasBreak(item.proposed) && <span className={`font-normal ml-1 ${corrIsPending ? 'text-amber-500' : corrIsApplied ? 'text-emerald-500' : 'text-rose-500'}`}>· pausa {item.proposed.breakStart || '--:--'}–{item.proposed.breakEnd || '--:--'}</span>}</>
                                    : <span className={`italic font-bold ${corrIsApplied ? 'text-emerald-500' : 'text-rose-500'}`}>Remover dia</span>}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  });
}

// ── Main component ────────────────────────────────────────────────────────────

const isWorkerType = (c) => c?.type === 'creation_request' || c?.type === 'deletion_request';

const CorrectionsInbox = ({ initialCorrectionId, onCorrectionNavigated, forcedSource }) => {
  const { corrections, correctionItems, clients, workers, logs, supabase, currentUser, setCorrections, setCorrectionItems } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedId, setSelectedId] = useState(initialCorrectionId || null);
  const [expandedCards, setExpandedCards] = useState({});

  const qp = new URLSearchParams(location.search);
  const sourceFilter = forcedSource || qp.get('source') || 'workers';
  const filter = qp.get('filter') || 'open';

  const setSourceFilter = (src) => {
    if (forcedSource) return;
    const p = new URLSearchParams(location.search);
    p.set('source', src);
    p.delete('filter');
    setExpandedCards({});
    navigate(`${location.pathname}?${p.toString()}`);
  };
  const setFilter = (f) => {
    const p = new URLSearchParams(location.search);
    p.set('filter', f);
    navigate(`${location.pathname}?${p.toString()}`);
  };

  React.useEffect(() => {
    if (initialCorrectionId) { setSelectedId(initialCorrectionId); onCorrectionNavigated?.(); }
  }, [initialCorrectionId]);

  // Redirect worker corrections (creation_request/deletion_request) to the Workers tab
  // instead of opening CorrectionDetail, which is designed for client corrections.
  React.useEffect(() => {
    if (!selectedId || !(corrections || []).length) return;
    const correction = corrections.find((c) => c.id === selectedId);
    if (!correction || !isWorkerType(correction)) return;
    const groupKey = `${correction.client_id || ''}__${correction.month || ''}`;
    const newFilter = (correction.status === 'submitted' || correction.status === 'under_review') ? 'open'
      : correction.status === 'applied' ? 'applied'
      : correction.status === 'rejected' ? 'rejected'
      : 'all';
    setSelectedId(null);
    setExpandedCards((prev) => ({ ...prev, [groupKey]: true }));
    navigate(`${location.pathname}?source=workers&filter=${newFilter}`, { replace: true });
  }, [selectedId, corrections]);

  const workerCorrections = useMemo(() => [...(corrections || [])].filter(c => c.type === 'creation_request' || c.type === 'deletion_request').sort((a, b) => (b.submitted_at || '').localeCompare(a.submitted_at || '')), [corrections]);
  const clientCorrections = useMemo(() => [...(corrections || [])].filter(c => c.type !== 'creation_request' && c.type !== 'deletion_request').sort((a, b) => (b.submitted_at || '').localeCompare(a.submitted_at || '')), [corrections]);
  const sourceFiltered = sourceFilter === 'workers' ? workerCorrections : clientCorrections;

  const sorted   = useMemo(() => [...sourceFiltered].sort((a, b) => (b.submitted_at || '').localeCompare(a.submitted_at || '')), [sourceFiltered]);
  const filtered = useMemo(() => {
    if (filter === 'open')     return sorted.filter((c) => c.status === 'submitted' || c.status === 'under_review' || c.status === 'pending');
    if (filter === 'applied')  return sorted.filter((c) => c.status === 'applied');
    if (filter === 'rejected') return sorted.filter((c) => c.status === 'rejected');
    return sorted;
  }, [sorted, filter]);

  const itemsByCorrection = useMemo(() => {
    const map = new Map();
    (correctionItems || []).forEach((it) => {
      if (!map.has(it.correction_id)) map.set(it.correction_id, []);
      map.get(it.correction_id).push(it);
    });
    map.forEach((arr) => arr.sort((a, b) => (a.date || '').localeCompare(b.date || '')));
    return map;
  }, [correctionItems]);

  const handleWorkerApprove = async (correction) => {
    if (!supabase) { alert('Sistema ainda não está pronto.'); return; }
    if (!confirm('Aprovar este pedido de registo? Os horários serão atualizados/criados no relatório.')) return;
    try {
      const client = clients.find(cl => String(cl.id) === String(correction.client_id));
      await applyCreationRequest(supabase, { correction, items: itemsByCorrection.get(correction.id) || [], logs: logs || [], clientName: client?.name, clientEmail: client?.email, portalBase: window.location.origin });
      setCorrections(prev => prev.map(c => c.id === correction.id ? { ...c, status: 'applied' } : c));
      alert('Pedido aprovado. Relatório atualizado.');
    } catch (e) {
      alert('Erro ao aprovar: ' + (e?.message || e));
    }
  };

  const handleWorkerReject = async (correction) => {
    if (!supabase) { alert('Sistema ainda não está pronto.'); return; }
    if (!confirm(`Tem a certeza que quer rejeitar o pedido de ${correction.month}?`)) return;
    const reason = prompt('Motivo da rejeição (opcional, será enviado ao cliente):') || '';
    try {
      const client = clients.find(cl => String(cl.id) === String(correction.client_id));
      await rejectCorrection(supabase, { correctionId: correction.id, clientId: correction.client_id, month: correction.month, reason: reason || null, reviewer: currentUser?.id, clientName: client?.name, clientEmail: client?.email, portalBase: window.location.origin });
      setCorrections(prev => prev.map(c => c.id === correction.id ? { ...c, status: 'rejected' } : c));
      alert('Pedido rejeitado. Cliente notificado.');
    } catch (e) {
      alert('Erro ao rejeitar: ' + (e?.message || e));
    }
  };

  // ── Detail view (only for client corrections) ───────────────────────────
  if (selectedId) {
    const correction = corrections.find((c) => c.id === selectedId);
    if (!correction) { setSelectedId(null); return null; }
    // Worker corrections are redirected to the Workers tab via the useEffect above
    if (isWorkerType(correction)) return null;
    return (
      <div className="p-6 md:p-8 bg-slate-50 min-h-screen">
        <CorrectionDetail correction={correction} items={itemsByCorrection.get(selectedId) || []} onBack={() => setSelectedId(null)} />
      </div>
    );
  }

  // ── Inbox list ───────────────────────────────────────────────────────────
  const isPending = (c) => c.status === 'submitted' || c.status === 'under_review' || c.status === 'pending';
  const workerOpenCount = workerCorrections.filter(isPending).length;
  const clientOpenCount = clientCorrections.filter(isPending).length;
  const totalOpenCount  = workerOpenCount + clientOpenCount;
  const counts = {
    open:     sorted.filter(isPending).length,
    applied:  sorted.filter((c) => c.status === 'applied').length,
    rejected: sorted.filter((c) => c.status === 'rejected').length,
  };

  return (
    <div className="p-6 md:p-8 bg-slate-50 min-h-screen">
      <header className="mb-8 flex items-center gap-3">
        <div className="bg-amber-50 p-2 rounded-xl text-amber-600"><AlertCircle size={20} /></div>
        <h3 className="font-black text-base sm:text-xl text-slate-800 uppercase tracking-tight">Inbox de Correções</h3>
      </header>

      {/* Source selector — hidden when forcedSource is set */}
      {!forcedSource && (
        <div className="flex gap-2 mb-4">
          <button onClick={() => setSourceFilter('workers')} className={`flex items-center gap-2 px-4 py-2 rounded-xl font-black text-[10px] uppercase transition-all ${sourceFilter === 'workers' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-500 border border-slate-200 hover:border-emerald-300'}`}>
            <Users size={14} /> Workers
            {workerOpenCount > 0 && <span className="bg-rose-500 text-white text-[8px] px-1.5 py-0.5 rounded-full ml-1">{workerOpenCount}</span>}
          </button>
          <button onClick={() => setSourceFilter('clients')} className={`flex items-center gap-2 px-4 py-2 rounded-xl font-black text-[10px] uppercase transition-all ${sourceFilter === 'clients' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-500 border border-slate-200 hover:border-indigo-300'}`}>
            <Building2 size={14} /> Clientes
            {clientOpenCount > 0 && <span className="bg-rose-500 text-white text-[8px] px-1.5 py-0.5 rounded-full ml-1">{clientOpenCount}</span>}
          </button>
        </div>
      )}

      {/* Status filter tabs */}
      <div className="grid grid-cols-4 gap-1 mb-6 bg-slate-100 p-1 rounded-2xl w-full">
        {[
          ['open',     AlertCircle, 'text-amber-500',  totalOpenCount],
          ['applied',  CheckCircle, 'text-emerald-500', counts.applied],
          ['rejected', XCircle,     'text-rose-500',    counts.rejected],
          ['all',      LayoutList,  'text-slate-500',   null],
        ].map(([k, Icon, iconColor, count]) => (
          <button key={k} onClick={() => setFilter(k)} className={`relative flex items-center justify-center gap-1 py-2 rounded-xl transition-all ${filter === k ? 'bg-white shadow-sm' : 'hover:text-slate-600'}`}>
            <Icon size={13} className={filter === k ? iconColor : 'text-slate-400'} />
            <span className={`text-[9px] font-black uppercase whitespace-nowrap ${filter === k ? iconColor : 'text-slate-400'}`}>
              {k === 'open' ? 'Abertas' : k === 'applied' ? 'Aplicadas' : k === 'rejected' ? 'Rejeitadas' : 'Todas'}
              {count !== null && count > 0 ? ` (${count})` : ''}
            </span>
          </button>
        ))}
      </div>

      {/* List */}
      <div className="grid gap-3">
        {filtered.length === 0 && (
          <div className="text-center py-20 bg-white rounded-3xl border border-slate-100">
            <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-2xl flex items-center justify-center mx-auto mb-4"><CheckCircle size={32} /></div>
            <h3 className="text-lg font-black text-slate-700">Nada por aqui</h3>
            <p className="text-slate-400 text-sm font-medium">Sem correções neste filtro.</p>
          </div>
        )}

        {sourceFilter === 'workers' ? (
          <WorkerCorrectionsPanel
            filtered={filtered}
            clients={clients}
            workers={workers}
            itemsByCorrection={itemsByCorrection}
            expandedCards={expandedCards}
            setExpandedCards={setExpandedCards}
            onApprove={handleWorkerApprove}
            onReject={handleWorkerReject}
          />
        ) : (
          <ClientCorrectionsPanel
            filtered={filtered}
            clients={clients}
            workers={workers}
            itemsByCorrection={itemsByCorrection}
            expandedCards={expandedCards}
            setExpandedCards={setExpandedCards}
            supabase={supabase}
            currentUser={currentUser}
            setCorrections={setCorrections}
            setCorrectionItems={setCorrectionItems}
            logs={logs}
          />
        )}
      </div>
    </div>
  );
};

export default CorrectionsInbox;
