import React from 'react';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { fmtEur } from './salarioUtils';
import ModalShell from '../../../components/common/ModalShell';
import { FT, SCALE } from '../../../styles/designTokens';

export default function AssocTransacaoModal({
  tx,
  pattern,
  onPatternChange,
  worker,
  onWorkerChange,
  workers,
  unmatchedTxs,
  saving,
  onSave,
  onClose,
}) {
  const preview = (() => {
    const p = pattern.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (p.length < 4) return <p className={`${SCALE.text.meta} text-[var(--slate-dim)] mt-1`}>Mínimo 4 caracteres.</p>;
    const matchCount = (unmatchedTxs || []).filter(t => t.descricao.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(p)).length;
    if (matchCount === 0) return <p className={`${SCALE.text.meta} text-amber-600 mt-1 flex items-center gap-1`}><AlertCircle size={10} /> Nenhuma transação corresponde.</p>;
    if (matchCount > 1) return <p className={`${SCALE.text.meta} text-amber-600 mt-1 flex items-center gap-1`}><AlertCircle size={10} /> Vai capturar {matchCount} transferências.</p>;
    return <p className={`${SCALE.text.meta} text-emerald-600 mt-1 flex items-center gap-1`}><CheckCircle size={10} /> Corresponde exactamente a 1.</p>;
  })();

  return (
    <ModalShell
      isOpen
      onClose={onClose}
      busy={saving}
      title="Associar Transferência"
      size="md"
      footer={
        <div className="flex gap-2 px-6 py-4">
          <button onClick={onClose}
            className={`flex-1 px-4 py-2.5 rounded-2xl border border-[var(--border)] text-[var(--ink-soft)] hover:bg-[var(--surface)] transition-colors ${SCALE.text.badge}`}>
            Cancelar
          </button>
          <button
            disabled={!pattern.trim() || !worker || saving}
            onClick={onSave}
 className={`flex-1 px-4 py-2.5 rounded-2xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 hover:opacity-90 ${SCALE.text.badge}`}
            style={{ backgroundColor: FT.orange, color: FT.navy }}
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />} Guardar
          </button>
        </div>
      }
    >
      <div className="p-6 space-y-4">
        <div className="bg-[var(--surface)] rounded-2xl px-4 py-3">
          <p className={`${SCALE.text.statLabel} text-[var(--slate-dim)] mb-1`}>Descrição do movimento</p>
          <p className="text-[12px] text-[var(--ink-mid)] break-all">{tx.descricao}</p>
          <p className={`${SCALE.text.body} text-[var(--slate-dim)] mt-1`}>{tx.date} · {fmtEur(tx.amount)}</p>
        </div>
        <div className="space-y-3">
          <div>
            <label className={`${SCALE.text.statLabel} text-[var(--slate-dim)] block mb-1`}>
              Padrão a identificar (parte da descrição)
            </label>
            <input
              value={pattern}
              onChange={e => onPatternChange(e.target.value)}
              placeholder="Ex: João Silva"
              className="w-full border border-[var(--border)] rounded-xl px-3 py-2 text-sm text-[var(--ink-mid)] focus:outline-none focus:ring-2 focus:ring-[#1B3A57]/30"
            />
            {preview}
          </div>
          <div>
            <label className={`${SCALE.text.statLabel} text-[var(--slate-dim)] block mb-1`}>Trabalhador</label>
            <select value={worker} onChange={e => onWorkerChange(e.target.value)}
              className="w-full border border-[var(--border)] rounded-xl px-3 py-2 text-sm text-[var(--ink-mid)] focus:outline-none focus:ring-2 focus:ring-[#1B3A57]/30">
              <option value="">Seleccionar…</option>
              {workers.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </ModalShell>
  );
}
