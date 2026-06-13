import React, { useState } from 'react';
import { X, Plus, Loader2 } from 'lucide-react';
import { STATUS_CFG } from './txUtils';

export default function AddAliasModal({ clients, onClose, onSave }) {
  const [aliasName, setAliasName] = useState('');
  const [resolucao, setResolucao] = useState('interno');
  const [clientId, setClientId] = useState('');
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    setSaving(true);
    await onSave({ aliasName, resolucao, clientId });
    setSaving(false);
    onClose();
  };

  const sortedClients = (clients || []).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  const disabled = !aliasName.trim() || (resolucao === 'nota_credito' && !clientId) || saving;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-start justify-between">
          <h3 className="text-sm font-black text-slate-800">Novo Alias</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">Nome do banco/remetente</label>
            <input type="text" value={aliasName} onChange={e => setAliasName(e.target.value)}
              placeholder="Ex: EMPRESA EXEMPLO LDA"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">Resolução</label>
            <div className="flex gap-2">
              {[
                { val: 'interno',      label: 'Interno',  cfg: STATUS_CFG['Interno'] },
                { val: 'nota_credito', label: 'Cliente',  cfg: STATUS_CFG['Nota Crédito'] },
              ].map(({ val, label, cfg }) => (
                <button key={val} onClick={() => setResolucao(val)}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 transition-all ${resolucao === val ? `border-current ${cfg.bg} ${cfg.text}` : 'border-slate-200 text-slate-400 hover:border-slate-300'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          {resolucao === 'nota_credito' && (
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">Cliente</label>
              <select value={clientId} onChange={e => setClientId(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white">
                <option value="">— Selecionar cliente —</option>
                {sortedClients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
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
          <button disabled={disabled} onClick={handleConfirm}
            className="flex-1 px-4 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
