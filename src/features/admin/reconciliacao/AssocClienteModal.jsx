import React, { useState } from 'react';
import { X, Link2, Loader2 } from 'lucide-react';

export default function AssocClienteModal({ modal, clients, onClose, onSave }) {
  const [clienteId, setClienteId] = useState('');
  const [periodo, setPeriodo] = useState(modal.defaultPeriod || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!clienteId || !periodo) return;
    setSaving(true);
    await onSave(modal, clienteId, periodo);
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Associar a Cliente</h3>
            <p className="text-sm font-bold text-slate-800 mt-1">
              €{Number(modal.tx?.valor || 0).toFixed(2)} · {modal.tx?.data}
            </p>
            <p className="text-[10px] text-slate-400 truncate">{modal.tx?.descricao}</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-all">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cliente</label>
            <select
              value={clienteId}
              onChange={e => setClienteId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-300"
            >
              <option value="">Selecionar cliente...</option>
              {(clients || []).sort((a, b) => (a.name || '').localeCompare(b.name || '')).map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Período (AAAA-MM)</label>
            <input
              type="month"
              value={periodo}
              onChange={e => setPeriodo(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={handleSave}
            disabled={!clienteId || !periodo || saving}
            className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 text-white rounded-xl py-2.5 text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all disabled:opacity-50"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Link2 size={12} />}
            Associar
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-slate-500 hover:text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-200 hover:border-slate-300 transition-all"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
