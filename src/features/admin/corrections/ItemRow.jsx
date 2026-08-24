import React, { useState } from 'react';
import { CheckCircle, XCircle, Edit2 } from 'lucide-react';
import { setItemResolution } from '../../../utils/correctionsApi';
import { calculateDuration } from '../../../utils/formatUtils';
import TimeTextInput from '../../../components/common/TimeTextInput';
import TimesCell from './TimesCell';
import { ITEM_STATUS, KIND_LABEL, detectKind, itemDelta, fmtDelta, deltaClass } from './correctionsUtils';
import { SCALE } from '../../../styles/designTokens';

export default function ItemRow({ item, supabase, disabled, setCorrectionItems }) {
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
      await setItemResolution(supabase, item.id, { itemStatus: newStatus, finalValues, adminNote: note || null });
      setCorrectionItems((prev) =>
        prev.map((x) =>
          x.id === item.id
            ? { ...x, item_status: newStatus, final: (newStatus === 'accepted' || newStatus === 'edited') ? finalValues : null, admin_note: note || x.admin_note }
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

  const onAccept  = () => act('accepted', item.proposed);
  const onReject  = () => act('rejected', null);
  const onSaveEdit = () => {
    const hours = calculateDuration(draft.startTime, draft.endTime, draft.breakStart, draft.breakEnd);
    act('edited', { ...draft, hours });
  };

  const acceptLabel = kind === 'remove' ? 'Aceitar Remoção' : kind === 'new' ? 'Aceitar Novo' : 'Aceitar';
  const rejectLabel = kind === 'remove' ? 'Manter Dia'     : kind === 'new' ? 'Recusar Novo' : 'Rejeitar';

  return (
    <div className={`border rounded-2xl p-4 bg-white ${kind === 'remove' ? 'border-rose-100' : kind === 'new' ? 'border-emerald-100' : 'border-[var(--border-soft)]'}`}>
      <div className="flex items-start gap-4 flex-wrap">
        <div className="min-w-[140px]">
          <div className="flex gap-1 flex-wrap mb-2">
            <span className={`inline-block ${SCALE.text.meta} px-2 py-1 rounded-lg border ${K.cls}`}>{K.label}</span>
            <span className={`inline-block ${SCALE.text.meta} px-2 py-1 rounded-lg ${deltaClass(itemDelta(item))}`}>Δ {fmtDelta(itemDelta(item))}</span>
          </div>
          <p className={`${SCALE.text.statLabel} text-[var(--slate-dim)]`}>Colaborador</p>
          <p className="font-bold text-[var(--ink)]">{item.worker_name || item.worker_id}</p>
          <p className="text-xs text-[var(--slate-dim)] font-mono mt-1">{item.date}</p>
          <span className={`mt-2 inline-block ${SCALE.text.meta} px-2 py-1 rounded-lg ${status.cls}`}>{status.label}</span>
        </div>

        <div className="flex-1 grid grid-cols-3 gap-4 min-w-[300px]">
          <div>
            <p className={`${SCALE.text.statLabel} text-[var(--slate-dim)] mb-1`}>Atual</p>
            <TimesCell shape={item.before} placeholder="— dia não existia —" />
          </div>
          <div className={kind === 'remove' ? 'p-2 bg-rose-50 rounded-lg' : kind === 'new' ? 'p-2 bg-emerald-50 rounded-lg' : ''}>
            <p className={`${SCALE.text.statLabel} text-amber-600 mb-1`}>Pedido</p>
            {kind === 'remove' ? (
              <p className="text-xs font-bold text-rose-700">Dia removido</p>
            ) : (
              <TimesCell shape={item.proposed} placeholder="—" />
            )}
          </div>
          <div>
            <p className={`${SCALE.text.statLabel} text-emerald-500 mb-1`}>Final</p>
            {editing ? (
              <div className="grid grid-cols-2 gap-1">
                {['startTime', 'endTime', 'breakStart', 'breakEnd'].map((k) => (
                  <TimeTextInput key={k} value={draft[k] || ''} onChange={(v) => setDraft({ ...draft, [k]: v })} className="border border-[var(--border)] rounded-lg px-2 py-1 text-xs font-mono w-full" />
                ))}
              </div>
            ) : item.item_status === 'pending' ? (
              <p className="text-xs text-[var(--slate-dim)] italic">Aguardando decisão</p>
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
              <button onClick={onSaveEdit} disabled={busy} className={`px-3 py-1.5 bg-[var(--orange)] text-[var(--navy-solid)] rounded-lg ${SCALE.text.badge}`}>Guardar Edição</button>
              <button onClick={() => setEditing(false)} className={`px-3 py-1.5 text-[var(--slate-dim)] ${SCALE.text.badge}`}>Cancelar</button>
            </>
          ) : item.item_status === 'pending' ? (
            <>
              <button onClick={onAccept} disabled={busy} className={`px-3 py-1.5 bg-emerald-700 text-white rounded-lg ${SCALE.text.badge} flex items-center gap-1`}><CheckCircle size={12} /> {acceptLabel}</button>
              {kind !== 'remove' && (
                <button onClick={() => setEditing(true)} className={`px-3 py-1.5 bg-[var(--orange)] text-[var(--navy-solid)] rounded-lg ${SCALE.text.badge} flex items-center gap-1`}><Edit2 size={12} /> Editar</button>
              )}
              <button onClick={onReject} disabled={busy} className={`px-3 py-1.5 bg-rose-600 text-white rounded-lg ${SCALE.text.badge} flex items-center gap-1`}><XCircle size={12} /> {rejectLabel}</button>
              <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nota interna (opcional)" className="flex-1 min-w-[160px] border border-[var(--border-soft)] rounded-lg px-3 py-1.5 text-xs" />
            </>
          ) : (
            <div className="flex-1 flex items-center gap-3 flex-wrap">
              <span className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${SCALE.text.badge} ${item.item_status === 'accepted' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : item.item_status === 'edited' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                {item.item_status === 'accepted' && <><CheckCircle size={14} /> Aceite</>}
                {item.item_status === 'edited'   && <><Edit2 size={14} /> Editado</>}
                {item.item_status === 'rejected'  && <><XCircle size={14} /> {kind === 'remove' ? 'Dia mantido' : 'Rejeitado'}</>}
              </span>
              <button onClick={() => { if (!confirm('Reabrir esta decisão e voltar a pendente?')) return; act('pending', null); }} disabled={busy} className={`px-3 py-1.5 text-[var(--slate-dim)] hover:text-[var(--ink)] border border-[var(--border)] rounded-lg ${SCALE.text.badge}`}>
                Alterar decisão
              </button>
            </div>
          )}
        </div>
      )}
      {item.admin_note && !editing && (
        <p className="text-xs text-[var(--slate-dim)] mt-2 italic">Nota: {item.admin_note}</p>
      )}
    </div>
  );
}
