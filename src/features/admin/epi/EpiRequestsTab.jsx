import React, { useState } from 'react';
import { CheckCircle2, XCircle, PackageCheck, HardHat, List, Kanban as KanbanIcon } from 'lucide-react';
import { FT, SCALE, FONT_TITLE } from '../../../styles/designTokens';
import ModalShell from '../../../components/common/ModalShell';
import Badge from '../../../components/common/Badge';
import { EpiIcon } from '../../../utils/epiIcons';
import { getStock, LOW_STOCK_THRESHOLD } from '../../../utils/epiHelpers';
import { notifyWorkerEpiApproved, notifyWorkerEpiRejected, notifyWorkerEpiDelivered } from '../../../utils/epiRequestsApi';

const STATUS_META = {
  pending: { label: 'Pendente', tone: 'warning' },
  approved: { label: 'Aprovado', tone: 'info' },
  delivered: { label: 'Entregue', tone: 'success' },
  rejected: { label: 'Rejeitado', tone: 'danger' },
};

const getInitials = (name) => {
  if (!name) return '?';
  const p = name.trim().split(/\s+/);
  return p.length === 1 ? p[0][0].toUpperCase() : (p[0][0] + p[p.length - 1][0]).toUpperCase();
};

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—');

const FILTERS = [
  { id: 'all', label: 'Todos' },
  { id: 'pending', label: 'Pendentes' },
  { id: 'approved', label: 'Aprovados' },
  { id: 'delivered', label: 'Entregues' },
  { id: 'rejected', label: 'Rejeitados' },
];

const KANBAN_COLS = [
  { key: 'pending', label: 'Pendente' },
  { key: 'approved', label: 'Aprovado' },
  { key: 'delivered', label: 'Entregue' },
  { key: 'rejected', label: 'Rejeitado' },
];
const COL_INK = { pending: 'var(--warn)', approved: FT.info, delivered: 'var(--ok)', rejected: 'var(--bad)' };

export default function EpiRequestsTab({ requests, types, workers, clients, currentUser, supabase, onChange, loading }) {
  const [layout, setLayout] = useState('list');
  const [filter, setFilter] = useState('all');
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [deliverTarget, setDeliverTarget] = useState(null);
  const [busy, setBusy] = useState(false);

  const typeById = (id) => types.find((t) => t.id === id) || { label: id, icon: 'Package', sizes: null, stock: 0 };
  const clientById = (id) => clients?.find((c) => c.id === id);

  const counts = {
    all: requests.length,
    pending: requests.filter((r) => r.status === 'pending').length,
    approved: requests.filter((r) => r.status === 'approved').length,
    delivered: requests.filter((r) => r.status === 'delivered').length,
    rejected: requests.filter((r) => r.status === 'rejected').length,
  };

  const filtered = filter === 'all' ? requests : requests.filter((r) => r.status === filter);

  const handleApprove = async (req) => {
    if (!supabase || busy) return;
    setBusy(true);
    const { error } = await supabase
      .from('epi_requests')
      .update({ status: 'approved', approved_by: currentUser?.name || 'Admin', approved_at: new Date().toISOString() })
      .eq('id', req.id);
    setBusy(false);
    if (error) { window.alert('Erro ao aprovar: ' + error.message); return; }
    const type = typeById(req.type_id);
    notifyWorkerEpiApproved(supabase, { workerId: req.worker_id, typeLabel: type.label, requestId: req.id });
    onChange();
  };

  const openReject = (req) => { setRejectTarget(req); setRejectReason(''); };
  const confirmReject = async () => {
    if (!supabase || !rejectTarget || busy || !rejectReason.trim()) return;
    setBusy(true);
    const { error } = await supabase
      .from('epi_requests')
      .update({ status: 'rejected', rejected_by: currentUser?.name || 'Admin', rejected_at: new Date().toISOString(), reject_reason: rejectReason.trim() })
      .eq('id', rejectTarget.id);
    setBusy(false);
    if (error) { window.alert('Erro ao rejeitar: ' + error.message); return; }
    const type = typeById(rejectTarget.type_id);
    notifyWorkerEpiRejected(supabase, { workerId: rejectTarget.worker_id, typeLabel: type.label, requestId: rejectTarget.id, reason: rejectReason.trim() });
    setRejectTarget(null);
    onChange();
  };

  const confirmDeliver = async () => {
    if (!supabase || !deliverTarget || busy) return;
    setBusy(true);
    const req = deliverTarget;
    const type = typeById(req.type_id);
    if (type.sizes && type.sizes.length) {
      const newSizes = type.sizes.map((s) => (s.name === req.size ? { ...s, stock: Math.max(0, s.stock - req.qty) } : s));
      await supabase.from('epi_types').update({ sizes: newSizes }).eq('id', type.id);
    } else {
      await supabase.from('epi_types').update({ stock: Math.max(0, (type.stock || 0) - req.qty) }).eq('id', type.id);
    }
    const { error } = await supabase.from('epi_requests').update({ status: 'delivered', delivered_at: new Date().toISOString() }).eq('id', req.id);
    setBusy(false);
    if (error) { window.alert('Erro ao registar entrega: ' + error.message); return; }
    notifyWorkerEpiDelivered(supabase, { workerId: req.worker_id, typeLabel: type.label, requestId: req.id });
    setDeliverTarget(null);
    onChange();
  };

  if (loading) {
    return <p className={`${SCALE.text.body} text-[var(--slate-dim)] py-8 text-center`}>A carregar pedidos...</p>;
  }

  const renderActions = (req, compact) => {
    if (req.status === 'pending') {
      return (
        <>
          <button onClick={() => handleApprove(req)} disabled={busy} className={`flex items-center gap-1.5 ${compact ? 'flex-1 justify-center px-2 py-1.5' : 'px-3 py-1.5'} bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all ${SCALE.text.badge} disabled:opacity-50`}>
            <CheckCircle2 size={12} /> {compact ? '' : 'Aprovar'}
          </button>
          <button onClick={() => openReject(req)} disabled={busy} className={`flex items-center gap-1.5 ${compact ? 'flex-1 justify-center px-2 py-1.5' : 'px-3 py-1.5'} border border-rose-300 text-rose-600 rounded-xl hover:bg-rose-50 transition-all ${SCALE.text.badge} disabled:opacity-50`}>
            <XCircle size={12} /> {compact ? '' : 'Rejeitar'}
          </button>
        </>
      );
    }
    if (req.status === 'approved') {
      return (
        <button onClick={() => setDeliverTarget(req)} disabled={busy} className={`flex items-center gap-1.5 justify-center ${compact ? 'flex-1 px-2 py-1.5' : 'px-3 py-1.5'} bg-[var(--orange)] text-[var(--navy)] rounded-xl hover:opacity-90 transition-all ${SCALE.text.badge} disabled:opacity-50`}>
          <PackageCheck size={12} /> {compact ? 'Entregue' : 'Marcar Entregue'}
        </button>
      );
    }
    if (req.status === 'rejected' && req.reject_reason && !compact) {
      return <p className={`${SCALE.text.meta} text-rose-600 max-w-[200px] text-right`}>{req.reject_reason}</p>;
    }
    return null;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${SCALE.text.badge} transition-colors ${
                filter === f.id ? 'bg-[var(--navy)] border-[var(--navy)] text-white' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
              }`}
            >
              {f.label} <span className="opacity-70">{counts[f.id]}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center p-[3px] bg-slate-100 rounded-[10px] shrink-0">
          <button
            onClick={() => setLayout('list')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-[7px] ${SCALE.text.badge} transition-all ${layout === 'list' ? 'bg-white text-[var(--navy)] shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <List size={12} /> Lista
          </button>
          <button
            onClick={() => setLayout('kanban')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-[7px] ${SCALE.text.badge} transition-all ${layout === 'kanban' ? 'bg-white text-[var(--navy)] shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <KanbanIcon size={12} /> Kanban
          </button>
        </div>
      </div>

      {layout === 'list' && !filtered.length && (
        <div className="bg-white rounded-2xl border border-[var(--border-soft)] shadow-sm px-6 py-10 text-center">
          <HardHat size={28} className="text-[var(--slate)] mx-auto mb-3" />
          <p className="text-xs font-black uppercase text-[var(--slate-dim)] tracking-widest">Sem pedidos neste filtro</p>
        </div>
      )}

      {layout === 'list' && (
        <div className="space-y-2">
          {filtered.map((req) => {
            const type = typeById(req.type_id);
            const worker = workers?.find((w) => w.id === req.worker_id);
            const client = clientById(req.client_id || worker?.defaultClientId);
            const stock = getStock(type, req.size);
            const stockLow = stock <= LOW_STOCK_THRESHOLD;
            const st = STATUS_META[req.status] || STATUS_META.pending;
            return (
              <div key={req.id} className="bg-white rounded-2xl border border-[var(--border-soft)] shadow-sm px-4 py-3 flex flex-wrap items-center gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-black" style={{ background: FT.navy }}>
                  {getInitials(req.worker_name)}
                </div>
                <div className="min-w-[140px]">
                  <p className="text-sm font-bold text-[var(--ink)] truncate" style={{ fontFamily: FONT_TITLE }}>{req.worker_name}</p>
                  <p className={`${SCALE.text.meta} text-[var(--slate-dim)] truncate`}>{client?.name || '—'}</p>
                </div>

                <div className="flex items-center gap-2 min-w-[170px]">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-[var(--surface)] border border-[var(--border-soft)]">
                    <EpiIcon name={type.icon} size={15} className="text-[var(--navy)]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[var(--ink)]">{type.label}</p>
                    <p className={`${SCALE.text.meta} text-[var(--slate-dim)]`}>{req.size ? `Tam. ${req.size} · ` : ''}{req.qty} un.</p>
                    <p className={SCALE.text.meta} style={{ color: stockLow ? FT.bad : 'var(--slate-dim)' }}>Stock: {stock}{stockLow ? ' ⚠' : ''}</p>
                  </div>
                </div>

                <p className={`${SCALE.text.body} text-[var(--ink-soft)] flex-1 min-w-[140px] truncate`} title={req.motivo}>{req.motivo}</p>

                <div className="text-right">
                  <p className={`${SCALE.text.meta} text-[var(--slate-dim)]`}>{fmtDate(req.created_at)}</p>
                  <Badge tone={st.tone}>{st.label}</Badge>
                </div>

                <div className="flex gap-2 shrink-0 ml-auto">
                  {renderActions(req, false)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {layout === 'kanban' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 overflow-x-auto pb-2">
          {KANBAN_COLS.map((col) => {
            const items = requests.filter((r) => r.status === col.key).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            return (
              <div key={col.key} className="bg-[var(--surface)] border border-[var(--border-soft)] rounded-2xl p-2.5 min-w-[220px]">
                <div className="flex items-center justify-between px-1.5 pb-2 mb-2 border-b border-dashed border-slate-200">
                  <span className={`${SCALE.text.badge}`} style={{ color: COL_INK[col.key] }}>{col.label}</span>
                  <span className={`${SCALE.text.meta} text-[var(--slate-dim)]`}>{items.length}</span>
                </div>
                {!items.length && (
                  <p className={`${SCALE.text.meta} text-[var(--slate-dim)] text-center py-6`}>Sem pedidos</p>
                )}
                {items.map((req) => {
                  const type = typeById(req.type_id);
                  const worker = workers?.find((w) => w.id === req.worker_id);
                  const client = clientById(req.client_id || worker?.defaultClientId);
                  const stock = getStock(type, req.size);
                  const stockLow = stock <= LOW_STOCK_THRESHOLD;
                  const actions = renderActions(req, true);
                  return (
                    <div key={req.id} className="bg-white rounded-xl border border-[var(--border-soft)] shadow-sm p-2.5 mb-2">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-[var(--surface)] border border-[var(--border-soft)]">
                          <EpiIcon name={type.icon} size={13} className="text-[var(--navy)]" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[var(--ink)] truncate">{type.label}</p>
                          <p className={`${SCALE.text.meta} text-[var(--slate-dim)]`}>{req.size ? `Tam. ${req.size} · ` : ''}{req.qty} un.</p>
                        </div>
                      </div>
                      <p className={SCALE.text.meta} style={{ color: stockLow ? FT.bad : 'var(--slate-dim)', marginBottom: 6 }}>Stock: {stock}{stockLow ? ' ⚠' : ''}</p>
                      <div className="flex items-center gap-1.5 mb-2 text-[var(--ink-mid)]">
                        <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 text-white" style={{ background: FT.navy, fontSize: 7, fontWeight: 800 }}>
                          {getInitials(req.worker_name)}
                        </div>
                        <span className={`${SCALE.text.meta} truncate`}>{req.worker_name}</span>
                      </div>
                      <div className={`flex items-center justify-between ${SCALE.text.meta} text-[var(--slate-dim)] mb-1.5`}>
                        <span className="truncate">{client?.name?.split(',')[0] || '—'}</span>
                        <span className="shrink-0">{fmtDate(req.created_at)}</span>
                      </div>
                      {req.status === 'rejected' && req.reject_reason && (
                        <p className={`${SCALE.text.meta} text-rose-600 mb-1.5`}>{req.reject_reason}</p>
                      )}
                      {actions && <div className="flex gap-1.5">{actions}</div>}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      <ModalShell
        isOpen={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        title="Rejeitar pedido"
        icon={<XCircle size={16} />}
        accent="danger"
        footer={
          <div className="flex justify-end gap-2 px-6 py-4">
            <button onClick={() => setRejectTarget(null)} className="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 text-sm font-semibold">Cancelar</button>
            <button onClick={confirmReject} disabled={!rejectReason.trim() || busy} className="px-4 py-2 rounded-xl bg-rose-600 text-white text-sm font-semibold disabled:opacity-50">Confirmar Rejeição</button>
          </div>
        }
      >
        {rejectTarget && (
          <div className="px-6 py-5 space-y-3">
            <p className="text-sm text-[var(--ink-soft)]">
              {typeById(rejectTarget.type_id).label} · {rejectTarget.worker_name} · {rejectTarget.qty} un.{rejectTarget.size ? ` · Tam. ${rejectTarget.size}` : ''}
            </p>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-[var(--ink-mid)] mb-1.5">Motivo da rejeição</label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
                placeholder="Explica ao trabalhador porque o pedido não foi aprovado..."
              />
              <p className="text-xs text-[var(--slate-dim)] mt-1">Visível para o trabalhador no histórico dele.</p>
            </div>
          </div>
        )}
      </ModalShell>

      <ModalShell
        isOpen={!!deliverTarget}
        onClose={() => setDeliverTarget(null)}
        title="Confirmar entrega"
        icon={<PackageCheck size={16} />}
        accent="brand"
        footer={
          <div className="flex justify-end gap-2 px-6 py-4">
            <button onClick={() => setDeliverTarget(null)} className="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 text-sm font-semibold">Cancelar</button>
            <button onClick={confirmDeliver} disabled={busy} className="px-4 py-2 rounded-xl bg-[var(--orange)] text-[var(--navy)] text-sm font-semibold disabled:opacity-50">Confirmar Entrega</button>
          </div>
        }
      >
        {deliverTarget && (() => {
          const type = typeById(deliverTarget.type_id);
          const stock = getStock(type, deliverTarget.size);
          const insufficient = stock < deliverTarget.qty;
          return (
            <div className="px-6 py-5 space-y-3">
              <p className="text-sm text-[var(--ink-soft)]">
                {type.label} · {deliverTarget.worker_name} · {deliverTarget.qty} un.{deliverTarget.size ? ` · Tam. ${deliverTarget.size}` : ''}
              </p>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-[var(--ink-mid)] mb-1">
                  Stock atual{deliverTarget.size ? ` (${deliverTarget.size})` : ''}
                </label>
                <p className="text-lg font-bold" style={{ color: insufficient ? FT.bad : 'var(--ink)' }}>{stock} un.{insufficient ? ' ⚠ insuficiente' : ''}</p>
              </div>
              <p className="text-xs text-[var(--slate-dim)]">
                {insufficient
                  ? 'Não há stock suficiente registado. Podes confirmar na mesma — o stock fica a 0, nunca negativo.'
                  : `Confirmar desconta ${deliverTarget.qty} un. do stock.`}
              </p>
            </div>
          );
        })()}
      </ModalShell>
    </div>
  );
}
