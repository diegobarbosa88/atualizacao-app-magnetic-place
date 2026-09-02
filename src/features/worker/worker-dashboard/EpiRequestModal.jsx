import React, { useState, useEffect } from 'react';
import { HardHat, Send, CheckCircle, Clock, XCircle, PackageCheck } from 'lucide-react';
import ModalShell from '../../../components/common/ModalShell';
import { FT, FONT_MONO, SCALE } from '../../../styles/designTokens';
import { EpiIcon } from '../../../utils/epiIcons';
import { eligibleTypesForWorker, typeTotalStock } from '../../../utils/epiHelpers';

const MOTIVOS = ['Primeira atribuição', 'Desgaste / fim de vida útil', 'Perda', 'Dano', 'Troca de tamanho', 'Outro'];

const STATUS_MAP = {
  pending: { label: 'Pendente', bg: FT.warnBg, fg: FT.warn, icon: Clock },
  approved: { label: 'Aprovado', bg: '#ECEBFC', fg: '#4F46C7', icon: CheckCircle },
  delivered: { label: 'Entregue', bg: FT.okBg, fg: FT.ok, icon: PackageCheck },
  rejected: { label: 'Rejeitado', bg: FT.badBg, fg: FT.bad, icon: XCircle },
};

function EpiHistoryRow({ r, type }) {
  const s = STATUS_MAP[r.status] || STATUS_MAP.pending;
  const Icon = s.icon;
  return (
    <div className="px-4 py-3 space-y-1 border-b border-slate-50 last:border-b-0">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
          <EpiIcon name={type.icon} size={12} /> {type.label}
        </p>
        <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${SCALE.text.badge}`} style={{ background: s.bg, color: s.fg, fontFamily: FONT_MONO }}>
          <Icon size={9} /> {s.label}
        </span>
      </div>
      <p className={`${SCALE.text.meta} text-slate-400`}>{r.qty} un.{r.size ? ` · Tam. ${r.size}` : ''} · {r.motivo}</p>
      {r.status === 'rejected' && r.reject_reason && (
        <p className={`${SCALE.text.meta} text-rose-600`}>{r.reject_reason}</p>
      )}
    </div>
  );
}

export default function EpiRequestModal({ isOpen, onClose, currentUser, types, requests, onSubmit }) {
  const eligible = eligibleTypesForWorker(types, currentUser);
  const [typeId, setTypeId] = useState('');
  const [qty, setQty] = useState(1);
  const [size, setSize] = useState('');
  const [motivo, setMotivo] = useState(MOTIVOS[0]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTypeId(eligible[0]?.id || '');
      setQty(1);
      setMotivo(MOTIVOS[0]);
      setNotes('');
      setSubmitting(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const type = eligible.find((t) => t.id === typeId) || null;

  useEffect(() => {
    if (!type) { setSize(''); return; }
    const saved = (currentUser?.epi_sizes || {})[type.id];
    if (type.sizes?.length && saved && type.sizes.some((s) => s.name === saved)) setSize(saved);
    else setSize('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeId]);

  const canSubmit = !!type && (!type.sizes?.length || !!size) && !!motivo && (motivo !== 'Outro' || !!notes.trim()) && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onSubmit({ typeId: type.id, typeLabel: type.label, qty, size: size || null, motivo, notes: notes.trim() });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const myRequests = (requests || [])
    .filter((r) => r.worker_id === currentUser?.id)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const typeById = (id) => types.find((t) => t.id === id) || { label: id, icon: 'Package' };

  const footer = (
    <div className="px-4 pt-2 pb-[max(1.25rem,env(safe-area-inset-bottom,1.25rem))] space-y-2 border-t border-slate-100">
      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        className={`w-full flex items-center justify-center gap-2 py-3 bg-orange-500 text-white rounded-xl hover:bg-slate-900 transition-all shadow-sm active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${SCALE.text.badge}`}
      >
        <Send size={13} /> {submitting ? 'A enviar...' : 'Enviar Pedido'}
      </button>
    </div>
  );

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} title="Solicitar EPI" subtitle={currentUser?.profissao} icon={<HardHat size={16} />} accent="brand" footer={footer}>
      <div className="px-4 py-4 space-y-4">
        <div>
          <p className={`${SCALE.text.statLabel} text-slate-500 mb-2`}>Tipo de equipamento</p>
          {eligible.length === 0 ? (
            <p className="text-xs text-slate-400">Nenhum tipo de EPI disponível para a tua profissão de momento. Fala com o teu encarregado.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {eligible.map((t) => {
                const oos = typeTotalStock(t) <= 0;
                const selected = t.id === typeId;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTypeId(t.id)}
                    className={`flex flex-col items-center gap-1 py-3 rounded-xl border transition-all ${selected ? 'border-orange-500 bg-orange-50' : 'border-slate-200 bg-slate-50 hover:border-orange-200'}`}
                  >
                    <EpiIcon name={t.icon} size={20} className={selected ? 'text-orange-600' : 'text-slate-500'} />
                    <span className="text-[11px] font-bold text-slate-700 text-center leading-tight px-1">{t.label}</span>
                    {oos && <span className="text-[9px] font-bold text-rose-600">Sem stock</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {type && (
          <>
            <div>
              <p className={`${SCALE.text.statLabel} text-slate-500 mb-2`}>Quantidade</p>
              <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden w-fit">
                <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="w-9 h-9 bg-slate-50 font-bold text-slate-600">−</button>
                <span className="w-10 text-center font-bold text-sm">{qty}</span>
                <button onClick={() => setQty((q) => Math.min(5, q + 1))} className="w-9 h-9 bg-slate-50 font-bold text-slate-600">+</button>
              </div>
            </div>

            {type.sizes?.length > 0 && (
              <div>
                <p className={`${SCALE.text.statLabel} text-slate-500 mb-2`}>Tamanho</p>
                <div className="flex flex-wrap gap-1.5">
                  {type.sizes.map((s) => (
                    <button
                      key={s.name}
                      onClick={() => setSize(s.name)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-bold ${size === s.name ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-slate-200 bg-white text-slate-600'}`}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
                {(currentUser?.epi_sizes || {})[type.id] === size && size && (
                  <p className={`${SCALE.text.meta} text-slate-400 mt-1`}>Pré-preenchido com a tua medida guardada — podes alterar.</p>
                )}
              </div>
            )}

            <div>
              <p className={`${SCALE.text.statLabel} text-slate-500 mb-2`}>Motivo</p>
              <select
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-700 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all"
              >
                {MOTIVOS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            <div>
              <p className={`${SCALE.text.statLabel} text-slate-500 mb-2`}>
                Notas {motivo === 'Outro' ? '' : <span className="font-bold normal-case tracking-normal text-slate-400">(opcional)</span>}
              </p>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Algum detalhe que ajude o admin a avaliar o pedido..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all resize-none placeholder:text-slate-300"
              />
            </div>
          </>
        )}

        {myRequests.length > 0 && (
          <div>
            <p className={`${SCALE.text.statLabel} text-slate-500 mb-2`}>Os meus pedidos</p>
            <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden">
              {myRequests.map((r) => <EpiHistoryRow key={r.id} r={r} type={typeById(r.type_id)} />)}
            </div>
          </div>
        )}
      </div>
    </ModalShell>
  );
}
