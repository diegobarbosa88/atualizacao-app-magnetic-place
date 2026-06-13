import React, { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { fmtEur } from './txUtils';

export default function NcManualModal({ tx, faturas, loading, onClose, onSave }) {
  const [selectedId, setSelectedId] = useState('');
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    setSaving(true);
    await onSave(tx, selectedId);
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-start justify-between">
          <h3 className="text-sm font-black text-slate-800">Ligar a Nota de Crédito</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
        </div>
        <div className="rounded-2xl px-4 py-3 bg-indigo-50">
          <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600 mb-1">Transacção</p>
          <p className="text-sm font-bold text-slate-800">{fmtEur(Math.abs(parseFloat(tx.valor) || 0))}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">{tx.data}</p>
          <p className="text-[10px] text-slate-400 mt-0.5 break-all">{tx.descricao}</p>
        </div>
        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">Selecionar Fatura NC</label>
          {loading ? (
            <p className="text-[11px] text-slate-400">A carregar...</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {faturas.length === 0 && <p className="text-[11px] text-slate-400">Sem faturas NC disponíveis</p>}
              {faturas.map(f => (
                <button key={f.id} onClick={() => setSelectedId(f.id)}
                  className={`w-full text-left px-3 py-2 rounded-xl border transition-colors ${selectedId === f.id ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                  <p className="text-[11px] font-bold text-slate-700">{f.dados?.numero_fatura}</p>
                  <p className="text-[10px] text-slate-500">{f.dados?.fornecedor}</p>
                  <p className="text-[10px] font-bold text-slate-600">{fmtEur(parseFloat(f.dados?.valor_total) || 0)}</p>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
            Cancelar
          </button>
          <button disabled={!selectedId || saving} onClick={handleConfirm}
            className="flex-1 px-4 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5">
            {saving ? <Loader2 size={13} className="animate-spin" /> : null} Ligar NC
          </button>
        </div>
      </div>
    </div>
  );
}
