import React, { useState } from 'react';
import { X, FileMinus, Loader2 } from 'lucide-react';
import { fmtEur } from './txUtils';

export default function FaturaModal({ tx, faturasData, faturaLinks, onClose, onSave }) {
  const [selectedId, setSelectedId] = useState('');
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    setSaving(true);
    await onSave(tx, selectedId);
    setSaving(false);
    onClose();
  };

  const disponiveis = (faturasData || [])
    .filter(f => f.status !== 'PAGO' && !(faturaLinks || []).some(l => l.fatura_id === f.id))
    .sort((a, b) => (a.dados?.fornecedor || '').localeCompare(b.dados?.fornecedor || ''));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-start justify-between">
          <h3 className="text-sm font-black text-slate-800">Ligar a Fatura de Fornecedor</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
        </div>
        <div className="bg-orange-50 rounded-2xl px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-orange-600 mb-1">Transacção</p>
          <p className="text-sm font-bold text-slate-800">{fmtEur(Math.abs(parseFloat(tx.valor) || 0))}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">{tx.data}</p>
          <p className="text-[10px] text-slate-400 mt-0.5 break-all">{tx.descricao}</p>
        </div>
        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">Fatura</label>
          <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-300 bg-white">
            <option value="">— Selecionar fatura —</option>
            {disponiveis.map(f => (
              <option key={f.id} value={f.id}>
                {f.dados?.fornecedor || 'Sem fornecedor'} · {f.dados?.numero_fatura || '—'} · {fmtEur(f.dados?.valor_total)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
            Cancelar
          </button>
          <button disabled={!selectedId || saving} onClick={handleConfirm}
            className="flex-1 px-4 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest bg-orange-600 text-white hover:bg-orange-700 transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <FileMinus size={13} />} Ligar Fatura
          </button>
        </div>
      </div>
    </div>
  );
}
