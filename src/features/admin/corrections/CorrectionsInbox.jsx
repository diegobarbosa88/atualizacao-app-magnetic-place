import React, { useMemo, useState } from 'react';
import { CheckCircle, AlertCircle, XCircle, Clock, Building2, ChevronDown, LayoutList, Users } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { applyCreationRequest, rejectCorrection } from '../../../utils/correctionsApi';
import { calculateDuration } from '../../../utils/formatUtils';
import CorrectionDetail from './CorrectionDetail';
import { STATUS_LABEL, TYPE_LABEL } from './correctionsUtils';

// ── Worker corrections grouped view ──────────────────────────────────────────

function WorkerCorrectionsPanel({ filtered, clients, workers, itemsByCorrection, expandedCards, setExpandedCards, onApprove, onReject }) {
  const labelKind = (item) => {
    if (!item.before || (!item.before.startTime && !item.before.endTime)) return '✚ Novo dia';
    if (!item.proposed || (!item.proposed.startTime && !item.proposed.endTime)) return '✖ Remover dia';
    return '✎ Ajuste';
  };
  const hasBreak = (t) => t && (t.breakStart || t.breakEnd);

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
    const allItems = g.corrections.flatMap((c) => itemsByCorrection.get(c.id) || []);
    const pendingCount = allItems.filter((i) => i.item_status === 'pending').length;
    const groupKey = `${g.clientId || ''}__${g.month || ''}`;
    const isExpanded = !!expandedCards[groupKey];
    const isPending = g.corrections.some((c) => c.status === 'submitted' || c.status === 'under_review');
    const isResolved = g.corrections.every((c) => c.status === 'applied' || c.status === 'rejected');

    return (
      <div key={groupKey} className={`bg-white border rounded-2xl overflow-hidden ${isPending ? 'border-emerald-200 shadow-sm' : 'border-slate-200'}`}>
        <button
          onClick={() => setExpandedCards((prev) => ({ ...prev, [groupKey]: !prev[groupKey] }))}
          className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className={`p-2 rounded-xl flex-shrink-0 ${isPending ? 'bg-emerald-100 text-emerald-600' : isResolved ? 'bg-slate-100 text-slate-500' : 'bg-amber-100 text-amber-600'}`}>
              <Building2 size={16} />
            </div>
            <div className="text-left min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-slate-700 text-sm truncate">{client?.name || g.clientId || 'Cliente'}</span>
                <span className="text-xs font-mono text-slate-400">{g.month}</span>
              </div>
              <span className="text-xs text-slate-400">{allItems.length} item{allItems.length > 1 ? 's' : ''} • {pendingCount} pendente{pendingCount > 1 ? 's' : ''}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {isResolved && !isPending && (
              <span className="text-[10px] font-black px-3 py-1.5 rounded-xl bg-slate-100 text-slate-500">Resolvido</span>
            )}
            <ChevronDown size={16} className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
          </div>
        </button>
        {isExpanded && (
          <div className="px-4 pb-4 border-t border-slate-100">
            <div className="pt-4 space-y-2">
              {allItems.map((item) => {
                const workerObj = workers.find((w) => String(w.id) === String(item.worker_id));
                const hasBefore = item.before && (item.before.startTime || item.before.endTime);
                const hasProposed = item.proposed && (item.proposed.startTime || item.proposed.endTime);
                const itemCorrection = g.corrections.find((c) => c.id === item.correction_id);
                const itemIsPending = itemCorrection && (itemCorrection.status === 'submitted' || itemCorrection.status === 'under_review');
                return (
                  <div key={item.id} className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <span className="font-black text-slate-700 text-xs">{item.worker_name || workerObj?.name || 'Trabalhador'}</span>
                        <span className="text-slate-300">·</span>
                        <span className="font-mono text-slate-500 text-xs">{item.date}</span>
                        <span className="text-slate-300">·</span>
                        <span className="font-black uppercase tracking-widest text-[10px] text-slate-700 bg-slate-200 px-2 py-0.5 rounded-md">{labelKind(item)}</span>
                      </div>
                      {hasBefore && (
                        <div className="flex items-center gap-2 text-slate-500">
                          <span className="text-[10px] font-black uppercase tracking-widest w-20 flex-shrink-0 text-slate-400">Original</span>
                          <span className="font-mono">{item.before.startTime} → {item.before.endTime}</span>
                          {hasBreak(item.before) && <span className="text-slate-400">· pausa {item.before.breakStart || '--:--'}–{item.before.breakEnd || '--:--'}</span>}
                        </div>
                      )}
                      {hasProposed && (
                        <div className="flex items-center gap-2 text-amber-800 font-bold">
                          <span className="text-[10px] font-black uppercase tracking-widest w-20 flex-shrink-0 text-amber-600">Solicitado</span>
                          <span className="font-mono">{item.proposed.startTime} → {item.proposed.endTime}</span>
                          {hasBreak(item.proposed) && <span className="text-amber-500 font-normal">· pausa {item.proposed.breakStart || '--:--'}–{item.proposed.breakEnd || '--:--'}</span>}
                        </div>
                      )}
                      {!hasBefore && !hasProposed && <div className="text-slate-500 italic text-[11px]">Sem detalhes de horário</div>}
                    </div>
                    {itemIsPending && (
                      <div className="flex gap-1.5 flex-shrink-0">
                        <button onClick={() => onApprove(itemCorrection)} title="Aprovar" className="p-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"><CheckCircle size={16} /></button>
                        <button onClick={() => onReject(itemCorrection)} title="Rejeitar" className="p-2 bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition-colors"><XCircle size={16} /></button>
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

// ── Main component ────────────────────────────────────────────────────────────

const CorrectionsInbox = ({ initialCorrectionId, onCorrectionNavigated }) => {
  const { corrections, correctionItems, clients, workers, supabase, currentUser, setCorrections } = useApp();
  const [selectedId, setSelectedId] = useState(initialCorrectionId || null);
  const [filter, setFilter] = useState('open');
  const [sourceFilter, setSourceFilter] = useState('workers');
  const [expandedCards, setExpandedCards] = useState({});

  React.useEffect(() => {
    if (initialCorrectionId) { setSelectedId(initialCorrectionId); onCorrectionNavigated?.(); }
  }, [initialCorrectionId]);

  const workerCorrections = useMemo(() => [...(corrections || [])].filter(c => c.type === 'creation_request' || c.type === 'deletion_request').sort((a, b) => (b.submitted_at || '').localeCompare(a.submitted_at || '')), [corrections]);
  const clientCorrections = useMemo(() => [...(corrections || [])].filter(c => c.type !== 'creation_request' && c.type !== 'deletion_request').sort((a, b) => (b.submitted_at || '').localeCompare(a.submitted_at || '')), [corrections]);
  const sourceFiltered = sourceFilter === 'workers' ? workerCorrections : clientCorrections;

  const sorted   = useMemo(() => [...sourceFiltered].sort((a, b) => (b.submitted_at || '').localeCompare(a.submitted_at || '')), [sourceFiltered]);
  const filtered = useMemo(() => {
    if (filter === 'open')     return sorted.filter((c) => c.status === 'submitted' || c.status === 'under_review');
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
      await applyCreationRequest(supabase, { correction, items: itemsByCorrection.get(correction.id) || [], logs: [], clientName: client?.name, clientEmail: client?.email, portalBase: window.location.origin });
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

  // ── Detail view ─────────────────────────────────────────────────────────
  if (selectedId) {
    const correction = corrections.find((c) => c.id === selectedId);
    if (!correction) { setSelectedId(null); return null; }
    return (
      <div className="p-6 md:p-8 bg-slate-50 min-h-screen">
        <CorrectionDetail correction={correction} items={itemsByCorrection.get(selectedId) || []} onBack={() => setSelectedId(null)} />
      </div>
    );
  }

  // ── Inbox list ───────────────────────────────────────────────────────────
  const workerOpenCount = workerCorrections.filter(c => c.status === 'submitted' || c.status === 'under_review').length;
  const clientOpenCount = clientCorrections.filter(c => c.status === 'submitted' || c.status === 'under_review').length;
  const totalOpenCount  = workerOpenCount + clientOpenCount;
  const counts = {
    open:     sorted.filter((c) => c.status === 'submitted' || c.status === 'under_review').length,
    applied:  sorted.filter((c) => c.status === 'applied').length,
    rejected: sorted.filter((c) => c.status === 'rejected').length,
  };

  return (
    <div className="p-6 md:p-8 bg-slate-50 min-h-screen">
      <header className="mb-8 flex items-center gap-3">
        <div className="bg-amber-50 p-2 rounded-xl text-amber-600"><AlertCircle size={20} /></div>
        <h3 className="font-black text-base sm:text-xl text-slate-800 uppercase tracking-tight">Inbox de Correções</h3>
      </header>

      {/* Source selector */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => { setSourceFilter('workers'); setExpandedCards({}); }} className={`flex items-center gap-2 px-4 py-2 rounded-xl font-black text-[10px] uppercase transition-all ${sourceFilter === 'workers' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-500 border border-slate-200 hover:border-emerald-300'}`}>
          <Users size={14} /> Workers
          {workerOpenCount > 0 && <span className="bg-rose-500 text-white text-[8px] px-1.5 py-0.5 rounded-full ml-1">{workerOpenCount}</span>}
        </button>
        <button onClick={() => { setSourceFilter('clients'); setExpandedCards({}); }} className={`flex items-center gap-2 px-4 py-2 rounded-xl font-black text-[10px] uppercase transition-all ${sourceFilter === 'clients' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-500 border border-slate-200 hover:border-indigo-300'}`}>
          <Building2 size={14} /> Clientes
          {clientOpenCount > 0 && <span className="bg-rose-500 text-white text-[8px] px-1.5 py-0.5 rounded-full ml-1">{clientOpenCount}</span>}
        </button>
      </div>

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
          filtered.map((c) => {
            const client = clients.find((cl) => String(cl.id) === String(c.client_id));
            const items  = itemsByCorrection.get(c.id) || [];
            const pending = items.filter((i) => i.item_status === 'pending').length;
            return (
              <button key={c.id} onClick={() => setSelectedId(c.id)} className="bg-white border border-slate-100 rounded-2xl p-5 text-left hover:shadow-md transition-all flex items-center gap-4">
                <div className="w-12 h-12 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center"><Clock size={20} /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-black text-slate-800">{client?.name || c.client_id}</span>
                    <span className="text-xs font-mono text-slate-400">{c.month}</span>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${STATUS_LABEL[c.status]?.cls}`}>{STATUS_LABEL[c.status]?.label}</span>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${TYPE_LABEL[c.type]?.cls || 'bg-slate-100 text-slate-500'}`}>{TYPE_LABEL[c.type]?.label || c.type}</span>
                  </div>
                  {c.type === 'quick' ? (
                    <p className="text-xs text-slate-600 mt-1 italic line-clamp-2">"{(c.justification || '(sem texto)').slice(0, 120)}{(c.justification || '').length > 120 ? '…' : ''}"</p>
                  ) : (
                    <p className="text-xs text-slate-500 mt-1">{items.length} item(s) • {pending} pendente(s)</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Submetido</p>
                  <p className="text-xs font-mono text-slate-600">{c.submitted_at?.slice(0, 10) || '—'}</p>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

export default CorrectionsInbox;
