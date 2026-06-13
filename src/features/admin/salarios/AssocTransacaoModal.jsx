import React from 'react';
import { X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { fmtEur } from './salarioUtils';

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
    if (p.length < 4) return <p className="text-[10px] text-slate-400 mt-1">Mínimo 4 caracteres.</p>;
    const matchCount = (unmatchedTxs || []).filter(t => t.descricao.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(p)).length;
    if (matchCount === 0) return <p className="text-[10px] text-amber-600 mt-1 flex items-center gap-1"><AlertCircle size={10} /> Nenhuma transação corresponde.</p>;
    if (matchCount > 1) return <p className="text-[10px] text-amber-600 mt-1 flex items-center gap-1"><AlertCircle size={10} /> Vai capturar {matchCount} transferências.</p>;
    return <p className="text-[10px] text-emerald-600 mt-1 flex items-center gap-1"><CheckCircle size={10} /> Corresponde exactamente a 1.</p>;
  })();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-start justify-between">
          <h3 className="text-sm font-black text-slate-800">Associar Transferência</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
        </div>
        <div className="bg-slate-50 rounded-2xl px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Descrição do movimento</p>
          <p className="text-[12px] text-slate-700 break-all">{tx.descricao}</p>
          <p className="text-[11px] text-slate-500 mt-1">{tx.date} · {fmtEur(tx.amount)}</p>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">
              Padrão a identificar (parte da descrição)
            </label>
            <input
              value={pattern}
              onChange={e => onPatternChange(e.target.value)}
              placeholder="Ex: João Silva"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
            {preview}
          </div>
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">Trabalhador</label>
            <select value={worker} onChange={e => onWorkerChange(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300">
              <option value="">Seleccionar…</option>
              {workers.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex gap-2 pt-2">
          <button onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
            Cancelar
          </button>
          <button
            disabled={!pattern.trim() || !worker || saving}
            onClick={onSave}
            className="flex-1 px-4 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />} Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
