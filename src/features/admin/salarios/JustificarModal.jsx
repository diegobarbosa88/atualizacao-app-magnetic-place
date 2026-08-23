import React from 'react';
import { CheckCircle, Loader2 } from 'lucide-react';
import { fmtEur, fmtMes } from './salarioUtils';
import ModalShell from '../../../components/common/ModalShell';
import { FT } from '../../../styles/designTokens';

export default function JustificarModal({ entry, text, onTextChange, saving, onSave, onClose }) {
  return (
    <ModalShell
      isOpen
      onClose={onClose}
      busy={saving}
      title="Justificar Diferença"
      size="md"
      footer={
        <div className="flex gap-2 px-6 py-4">
          <button onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
            Cancelar
          </button>
          <button
            disabled={!text.trim() || saving}
            onClick={onSave}
            className="flex-1 px-4 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 hover:opacity-90"
            style={{ backgroundColor: FT.orange, color: FT.navy }}
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />} Marcar Ok
          </button>
        </div>
      }
    >
      <div className="p-6 space-y-4">
        <div className="bg-amber-50 rounded-2xl px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 mb-1">Mês pendente</p>
          <p className="text-sm font-bold text-slate-800">{entry.employee_name}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {fmtMes(entry.month)} · Saldo em falta: <strong className="text-red-600">{fmtEur(Math.abs(entry.balance))}</strong>
          </p>
        </div>
        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">Justificação</label>
          <textarea
            value={text}
            onChange={e => onTextChange(e.target.value)}
            placeholder="Ex: Adiantamento pago em numerário, remuneração acordada diferente, pagamento parcial pendente…"
            rows={3}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1B3A57]/30 resize-none"
          />
        </div>
      </div>
    </ModalShell>
  );
}
