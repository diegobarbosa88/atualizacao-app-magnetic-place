import React from 'react';
import { X, CheckCircle, Loader2 } from 'lucide-react';
import { fmtEur, fmtMes } from './salarioUtils';

export default function JustificarModal({ entry, text, onTextChange, saving, onSave, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-start justify-between">
          <h3 className="text-sm font-black text-slate-800">Justificar Diferença</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
        </div>
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
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none"
          />
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
            Cancelar
          </button>
          <button
            disabled={!text.trim() || saving}
            onClick={onSave}
            className="flex-1 px-4 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest bg-violet-600 text-white hover:bg-violet-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />} Marcar Ok
          </button>
        </div>
      </div>
    </div>
  );
}
