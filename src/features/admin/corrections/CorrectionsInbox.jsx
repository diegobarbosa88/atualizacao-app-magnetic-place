import React, { useMemo, useState } from 'react';
import { CheckCircle, AlertCircle, XCircle, Edit2, ChevronLeft, Clock, Plus, Trash2, Pencil } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import {
  markUnderReview,
  setItemResolution,
  applyCorrection,
  rejectCorrection,
} from '../../../utils/correctionsApi';
import { calculateDuration } from '../../../utils/formatUtils';
import TimeTextInput from '../../../components/common/TimeTextInput';

const STATUS_LABEL = {
  submitted: { label: 'Submetido', cls: 'bg-amber-100 text-amber-700' },
  under_review: { label: 'Em Revisão', cls: 'bg-indigo-100 text-indigo-700' },
  applied: { label: 'Aplicado', cls: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'Rejeitado', cls: 'bg-rose-100 text-rose-700' },
};

const ITEM_STATUS = {
  pending: { label: 'Pendente', cls: 'bg-slate-100 text-slate-600' },
  accepted: { label: 'Aceite', cls: 'bg-emerald-100 text-emerald-700' },
  edited: { label: 'Editado', cls: 'bg-indigo-100 text-indigo-700' },
  rejected: { label: 'Rejeitado', cls: 'bg-rose-100 text-rose-700' },
};

const isEmptyTimes = (shape) => {
  if (!shape) return true;
  const noTimes = !shape.startTime && !shape.endTime && !shape.breakStart && !shape.breakEnd;
  const zero = shape.hours === 0 || shape.hours === '0' || shape.hours === null || shape.hours === undefined;
  return noTimes && zero;
};

const detectKind = (item) => {
  if (!item.before || (item.before && !item.before.startTime && !item.before.endTime)) return 'new';
  if (isEmptyTimes(item.proposed)) return 'remove';
  return 'edit';
};

const KIND_LABEL = {
  new: { label: '✚ Novo dia', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: Plus },
  remove: { label: '✖ Remover dia', cls: 'bg-rose-50 text-rose-700 border-rose-200', icon: Trash2 },
  edit: { label: '✎ Ajuste', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200', icon: Pencil },
};

const fmtTime = (t) => (t && t !== '--:--' ? t : '—');

const TimesCell = ({ shape, placeholder }) => {
  if (!shape || isEmptyTimes(shape)) {
    return <p className="text-xs text-slate-400 italic leading-tight">{placeholder || '—'}</p>;
  }
  return (
    <div className="text-xs leading-tight">
      <div className="font-mono font-bold text-slate-700">{fmtTime(shape.startTime)} → {fmtTime(shape.endTime)}</div>
      <div className="font-mono text-slate-400">Pausa: {fmtTime(shape.breakStart)}–{fmtTime(shape.breakEnd)}</div>
      <div className="text-[10px] font-black text-slate-500 mt-0.5">{shape.hours ?? '—'}h</div>
    </div>
  );
};

const ItemRow = ({ item, supabase, disabled, setCorrectionItems }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => item.final || item.proposed || {});
  const [note, setNote] = useState(item.admin_note || '');
  const [busy, setBusy] = useState(false);
  const status = ITEM_STATUS[item.item_status] || ITEM_STATUS.pending;
  const kind = detectKind(item);
  const K = KIND_LABEL[kind];

  const act = async (newStatus, finalValues) => {
    setBusy(true);
    try {
      await setItemResolution(supabase, item.id, {
        itemStatus: newStatus,
        finalValues,
        adminNote: note || null,
      });
      // Optimistic local update
      setCorrectionItems((prev) =>
        prev.map((x) =>
          x.id === item.id
            ? {
                ...x,
                item_status: newStatus,
                final: newStatus === 'accepted' || newStatus === 'edited' ? finalValues : null,
                admin_note: note || x.admin_note,
              }
            : x
        )
      );
      setEditing(false);
    } catch (e) {
      alert('Erro: ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  const onAccept = () => act('accepted', item.proposed);
  const onReject = () => act('rejected', null);
  const onSaveEdit = () => {
    const hours = calculateDuration(draft.startTime, draft.endTime, draft.breakStart, draft.breakEnd);
    act('edited', { ...draft, hours });
  };

  // Friendly action label depending on kind
  const acceptLabel = kind === 'remove' ? 'Aceitar Remoção' : kind === 'new' ? 'Aceitar Novo' : 'Aceitar';
  const rejectLabel = kind === 'remove' ? 'Manter Dia' : kind === 'new' ? 'Recusar Novo' : 'Rejeitar';

  return (
    <div className={`border rounded-2xl p-4 bg-white ${kind === 'remove' ? 'border-rose-100' : kind === 'new' ? 'border-emerald-100' : 'border-slate-100'}`}>
      <div className="flex items-start gap-4 flex-wrap">
        <div className="min-w-[140px]">
          <span className={`inline-block text-[10px] font-black px-2 py-1 rounded-md border ${K.cls} mb-2`}>{K.label}</span>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Colaborador</p>
          <p className="font-bold text-slate-800">{item.worker_name || item.worker_id}</p>
          <p className="text-xs text-slate-500 font-mono mt-1">{item.date}</p>
          <span className={`mt-2 inline-block text-[10px] font-black px-2 py-1 rounded-md ${status.cls}`}>{status.label}</span>
        </div>

        <div className="flex-1 grid grid-cols-3 gap-4 min-w-[300px]">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Atual</p>
            <TimesCell shape={item.before} placeholder="— dia não existia —" />
          </div>
          <div className={kind === 'remove' ? 'p-2 bg-rose-50 rounded-lg' : kind === 'new' ? 'p-2 bg-emerald-50 rounded-lg' : ''}>
            <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">Pedido</p>
            {kind === 'remove' ? (
              <p className="text-xs font-bold text-rose-700">Dia removido</p>
            ) : (
              <TimesCell shape={item.proposed} placeholder="—" />
            )}
          </div>
          <div>
            <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">Final</p>
            {editing ? (
              <div className="grid grid-cols-2 gap-1">
                {['startTime', 'endTime', 'breakStart', 'breakEnd'].map((k) => (
                  <TimeTextInput
                    key={k}
                    value={draft[k] || ''}
                    onChange={(v) => setDraft({ ...draft, [k]: v })}
                    className="border border-slate-200 rounded-md px-2 py-1 text-xs font-mono w-full"
                  />
                ))}
              </div>
            ) : item.item_status === 'pending' ? (
              <p className="text-xs text-slate-400 italic">Aguardando decisão</p>
            ) : item.item_status === 'rejected' ? (
              <p className="text-xs text-rose-600 italic">{kind === 'remove' ? 'Dia mantido' : 'Pedido rejeitado'}</p>
            ) : (
              <TimesCell shape={item.final || item.proposed} placeholder="—" />
            )}
          </div>
        </div>
      </div>

      {!disabled && (
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          {editing ? (
            <>
              <button onClick={onSaveEdit} disabled={busy} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest">Guardar Edição</button>
              <button onClick={() => setEditing(false)} className="px-3 py-1.5 text-slate-500 text-[10px] font-black uppercase tracking-widest">Cancelar</button>
            </>
          ) : item.item_status === 'pending' ? (
            <>
              <button onClick={onAccept} disabled={busy} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1"><CheckCircle size={12} /> {acceptLabel}</button>
              {kind !== 'remove' && (
                <button onClick={() => setEditing(true)} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1"><Edit2 size={12} /> Editar</button>
              )}
              <button onClick={onReject} disabled={busy} className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1"><XCircle size={12} /> {rejectLabel}</button>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Nota interna (opcional)"
                className="flex-1 min-w-[160px] border border-slate-100 rounded-lg px-3 py-1.5 text-xs"
              />
            </>
          ) : (
            <div className="flex-1 flex items-center gap-3 flex-wrap">
              <span className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-widest ${item.item_status === 'accepted' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : item.item_status === 'edited' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                {item.item_status === 'accepted' && <><CheckCircle size={14} /> Aceite</>}
                {item.item_status === 'edited' && <><Edit2 size={14} /> Editado</>}
                {item.item_status === 'rejected' && <><XCircle size={14} /> {kind === 'remove' ? 'Dia mantido' : 'Rejeitado'}</>}
              </span>
              <button
                onClick={() => {
                  if (!confirm('Reabrir esta decisão e voltar a pendente?')) return;
                  act('pending', null);
                }}
                disabled={busy}
                className="px-3 py-1.5 text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg text-[10px] font-black uppercase tracking-widest"
              >
                Alterar decisão
              </button>
            </div>
          )}
        </div>
      )}
      {item.admin_note && !editing && (
        <p className="text-xs text-slate-500 mt-2 italic">Nota: {item.admin_note}</p>
      )}
    </div>
  );
};

const CorrectionDetail = ({ correction, items, onBack }) => {
  const { supabase, clients, logs, currentUser, setCorrections, setCorrectionItems } = useApp();
  const client = clients.find((c) => String(c.id) === String(correction.client_id));
  const clientName = client?.name || 'Cliente';
  const [busy, setBusy] = useState(false);

  React.useEffect(() => {
    if (correction.status === 'submitted' && supabase) {
      markUnderReview(supabase, correction.id, currentUser?.id)
        .then(() => {
          setCorrections((prev) => prev.map((c) => (c.id === correction.id ? { ...c, status: 'under_review' } : c)));
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [correction.id]);

  const resolved = items.filter((it) => it.item_status !== 'pending').length;
  const total = items.length;
  const canApply = total === 0 ? false : resolved === total && correction.status !== 'applied' && correction.status !== 'rejected';
  const isClosed = correction.status === 'applied' || correction.status === 'rejected';

  const kindCounts = useMemo(() => {
    const c = { new: 0, remove: 0, edit: 0 };
    items.forEach((it) => { c[detectKind(it)] += 1; });
    return c;
  }, [items]);

  const onApply = async () => {
    if (!canApply) return;
    if (!confirm(`Aplicar ${resolved} alteração(ões) ao relatório de ${clientName}?`)) return;
    setBusy(true);
    try {
      await applyCorrection(supabase, { correction, items, logs, reviewer: currentUser?.id, clientName });
      setCorrections((prev) =>
        prev.map((c) =>
          c.id === correction.id
            ? { ...c, status: 'applied', reviewed_at: new Date().toISOString(), reviewed_by: currentUser?.id || null }
            : c
        )
      );
      alert('Correção aplicada com sucesso.');
      onBack();
    } catch (e) {
      alert('Erro ao aplicar: ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  const onReject = async () => {
    const reason = prompt('Motivo da rejeição (será enviado ao cliente):');
    if (reason === null) return;
    setBusy(true);
    try {
      await rejectCorrection(supabase, {
        correctionId: correction.id,
        clientId: correction.client_id,
        month: correction.month,
        reason,
        reviewer: currentUser?.id,
        clientName,
      });
      setCorrections((prev) =>
        prev.map((c) =>
          c.id === correction.id
            ? { ...c, status: 'rejected', reviewed_at: new Date().toISOString(), justification: reason }
            : c
        )
      );
      alert('Correção rejeitada. Cliente notificado.');
      onBack();
    } catch (e) {
      alert('Erro: ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 font-black text-[10px] uppercase tracking-widest">
        <ChevronLeft size={16} /> Voltar à inbox
      </button>

      <header className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">{clientName}</h2>
            <p className="text-sm text-slate-500 font-medium mt-1">Mês {correction.month} • Tipo {correction.type}</p>
            <span className={`mt-2 inline-block text-[10px] font-black px-2 py-1 rounded-md ${STATUS_LABEL[correction.status]?.cls}`}>{STATUS_LABEL[correction.status]?.label}</span>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Resolução</p>
            <p className="text-3xl font-black text-slate-800">{resolved}/{total}</p>
            <div className="flex gap-2 mt-2 justify-end text-[10px] font-black">
              {kindCounts.edit > 0 && <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700">{kindCounts.edit} ajuste(s)</span>}
              {kindCounts.new > 0 && <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700">{kindCounts.new} novo(s)</span>}
              {kindCounts.remove > 0 && <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700">{kindCounts.remove} remover</span>}
            </div>
          </div>
        </div>
        {correction.justification && (
          <p className="mt-4 text-sm text-slate-600 italic border-l-4 border-slate-200 pl-3">"{correction.justification}"</p>
        )}
      </header>

      <div className="space-y-3">
        {items.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 p-6 text-sm text-slate-500">
            Sem items detalhados (correção do tipo rápido — cliente apenas sinalizou divergência no mês).
          </div>
        )}
        {items.map((it) => (
          <ItemRow key={it.id} item={it} supabase={supabase} disabled={isClosed} setCorrectionItems={setCorrectionItems} />
        ))}
      </div>

      {!isClosed && (
        <div className="sticky bottom-4 bg-white rounded-2xl border border-slate-100 p-4 shadow-lg flex items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            {total > 0 && !canApply && <>Resolva todos os {total} items antes de aplicar.</>}
            {canApply && <>Pronto para aplicar.</>}
          </div>
          <div className="flex gap-2">
            <button onClick={onReject} disabled={busy} className="px-4 py-2.5 bg-rose-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50">Rejeitar Tudo</button>
            <button onClick={onApply} disabled={busy || !canApply} className="px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50">Aplicar</button>
          </div>
        </div>
      )}
    </div>
  );
};

const CorrectionsInbox = () => {
  const { corrections, correctionItems, clients } = useApp();
  const [selectedId, setSelectedId] = useState(null);
  const [filter, setFilter] = useState('open');

  const sorted = useMemo(() => {
    return [...(corrections || [])].sort((a, b) => (b.submitted_at || '').localeCompare(a.submitted_at || ''));
  }, [corrections]);

  const filtered = useMemo(() => {
    if (filter === 'open') return sorted.filter((c) => c.status === 'submitted' || c.status === 'under_review');
    if (filter === 'applied') return sorted.filter((c) => c.status === 'applied');
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

  if (selectedId) {
    const correction = corrections.find((c) => c.id === selectedId);
    if (!correction) {
      setSelectedId(null);
      return null;
    }
    return (
      <div className="p-6 md:p-8 bg-slate-50 min-h-screen">
        <CorrectionDetail
          correction={correction}
          items={itemsByCorrection.get(selectedId) || []}
          onBack={() => setSelectedId(null)}
        />
      </div>
    );
  }

  const counts = {
    open: sorted.filter((c) => c.status === 'submitted' || c.status === 'under_review').length,
    applied: sorted.filter((c) => c.status === 'applied').length,
    rejected: sorted.filter((c) => c.status === 'rejected').length,
  };

  return (
    <div className="p-6 md:p-8 bg-slate-50 min-h-screen">
      <header className="mb-8 flex items-center gap-4">
        <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center">
          <AlertCircle size={24} />
        </div>
        <div>
          <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tighter">Inbox de Correções</h2>
          <p className="text-sm font-medium text-slate-400">{counts.open} aberta{counts.open !== 1 ? 's' : ''} • {counts.applied} aplicada{counts.applied !== 1 ? 's' : ''} • {counts.rejected} rejeitada{counts.rejected !== 1 ? 's' : ''}</p>
        </div>
      </header>

      <div className="flex gap-2 mb-6 flex-wrap">
        {[
          ['open', `Abertas (${counts.open})`],
          ['applied', `Aplicadas (${counts.applied})`],
          ['rejected', `Rejeitadas (${counts.rejected})`],
          ['all', 'Todas'],
        ].map(([k, label]) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${filter === k ? 'bg-slate-800 text-white' : 'bg-white text-slate-500 border border-slate-100'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-3">
        {filtered.length === 0 && (
          <div className="text-center py-20 bg-white rounded-3xl border border-slate-100">
            <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={32} />
            </div>
            <h3 className="text-lg font-black text-slate-700">Nada por aqui</h3>
            <p className="text-slate-400 text-sm font-medium">Sem correções neste filtro.</p>
          </div>
        )}
        {filtered.map((c) => {
          const client = clients.find((cl) => String(cl.id) === String(c.client_id));
          const items = itemsByCorrection.get(c.id) || [];
          const pending = items.filter((i) => i.item_status === 'pending').length;
          return (
            <button
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              className="bg-white border border-slate-100 rounded-2xl p-5 text-left hover:shadow-md transition-all flex items-center gap-4"
            >
              <div className="w-12 h-12 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center">
                <Clock size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-black text-slate-800">{client?.name || c.client_id}</span>
                  <span className="text-xs font-mono text-slate-400">{c.month}</span>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${STATUS_LABEL[c.status]?.cls}`}>{STATUS_LABEL[c.status]?.label}</span>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-slate-100 text-slate-500">{c.type}</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">{items.length} item(s) • {pending} pendente(s)</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Submetido</p>
                <p className="text-xs font-mono text-slate-600">{c.submitted_at?.slice(0, 10) || '—'}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default CorrectionsInbox;
