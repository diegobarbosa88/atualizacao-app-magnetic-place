import React, { useState } from 'react';
import { X, UserCheck, Loader2 } from 'lucide-react';
import { fmtEur, fmtMes, previousMonth } from './txUtils';

export default function ReciboModal({ tx, receipts, onClose, onSave }) {
  const [workerName, setWorkerName] = useState('');
  const [workerId, setWorkerId] = useState('');
  const [mes, setMes] = useState(previousMonth(tx.data));
  const [saving, setSaving] = useState(false);

  const handleWorkerChange = (selected) => {
    setWorkerName(selected);
    const workerReceipt = receipts.find(r => r.worker_name === selected);
    setWorkerId(workerReceipt?.worker_id || '');
    const prevM = previousMonth(tx.data);
    const hasPrev = receipts.some(r => r.worker_name === selected && r.mes === prevM);
    setMes(hasPrev ? prevM : (workerReceipt?.mes || ''));
  };

  const handleConfirm = async () => {
    setSaving(true);
    await onSave(tx, { workerName, workerId, mes });
    setSaving(false);
    onClose();
  };

  const workerNames = [...new Set(receipts.map(r => r.worker_name))].sort();
  const workerReceipts = receipts
    .filter(r => r.worker_name === workerName)
    .sort((a, b) => b.mes.localeCompare(a.mes));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-start justify-between">
          <h3 className="text-sm font-black text-slate-800">Ligar a Recibo de Trabalhador</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
        </div>
        <div className="bg-teal-50 rounded-2xl px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-teal-600 mb-1">Transacção</p>
          <p className="text-sm font-bold text-slate-800">{fmtEur(Math.abs(parseFloat(tx.valor) || 0))}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">{tx.data}</p>
          <p className="text-[10px] text-slate-400 mt-0.5 break-all">{tx.descricao}</p>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">Trabalhador</label>
            <select value={workerName} onChange={e => handleWorkerChange(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-300 bg-white">
              <option value="">— Selecionar trabalhador —</option>
              {workerNames.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
          {workerName && (
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">Mês do recibo</label>
              <select value={mes} onChange={e => setMes(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-300 bg-white">
                <option value="">— Selecionar mês —</option>
                {workerReceipts.map((r, i) => (
                  <option key={`${r.mes}-${i}`} value={r.mes}>
                    {fmtMes(r.mes)} — {fmtEur(r.liquido_extraido)}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
            Cancelar
          </button>
          <button disabled={!workerName || !mes || saving} onClick={handleConfirm}
            className="flex-1 px-4 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest bg-teal-600 text-white hover:bg-teal-700 transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <UserCheck size={13} />} Ligar Recibo
          </button>
        </div>
      </div>
    </div>
  );
}
