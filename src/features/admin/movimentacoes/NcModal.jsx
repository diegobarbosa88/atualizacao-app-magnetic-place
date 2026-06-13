import React, { useState } from 'react';
import { X, Receipt, Link, Loader2 } from 'lucide-react';
import { fmtEur, extractBankName } from './txUtils';

export default function NcModal({ tx, clients, onClose, onSave }) {
  const [clientId, setClientId] = useState('');
  const [period, setPeriod] = useState((tx.data || '').substring(0, 7));
  const [notas, setNotas] = useState('');
  const [saveAlias, setSaveAlias] = useState(false);
  const [aliasName, setAliasName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    setSaving(true);
    await onSave(tx, { clientId, period, notas, saveAlias, aliasName });
    setSaving(false);
    onClose();
  };

  const sortedClients = (clients || []).sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-start justify-between">
          <h3 className="text-sm font-black text-slate-800">
            {tx.tipo === 'debito' ? 'Ligar a Fatura' : 'Ligar a NC'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
        </div>
        <div className={`rounded-2xl px-4 py-3 ${tx.tipo === 'debito' ? 'bg-rose-50' : 'bg-blue-50'}`}>
          <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${tx.tipo === 'debito' ? 'text-rose-600' : 'text-blue-600'}`}>Transacção</p>
          <p className="text-sm font-bold text-slate-800">{fmtEur(Math.abs(parseFloat(tx.valor) || 0))}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">{tx.data}</p>
          <p className="text-[10px] text-slate-400 mt-0.5 break-all">{tx.descricao}</p>
        </div>
        <div className="space-y-3">
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
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">Mês de referência</label>
            <input type="month" value={period} onChange={e => setPeriod(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">Notas (opcional)</label>
            <input type="text" value={notas} onChange={e => setNotas(e.target.value)}
              placeholder={tx.tipo === 'debito' ? 'Ex: Fatura nº 42, pagamento a fornecedor…' : 'Ex: Nota de crédito nº 42, pagamento parcial…'}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>
          {tx.tipo === 'credito' && (
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" checked={saveAlias} onChange={e => {
                setSaveAlias(e.target.checked);
                if (e.target.checked) setAliasName(extractBankName(tx.descricao));
              }} className="w-4 h-4 rounded accent-blue-600" />
              <span className="text-[11px] font-bold text-slate-600">
                Guardar alias <span className="font-normal text-slate-400">— auto-match futuro para este remetente</span>
              </span>
            </label>
          )}
          {saveAlias && tx.tipo === 'credito' && (
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">Nome do alias</label>
              <input type="text" value={aliasName} onChange={e => setAliasName(e.target.value)}
                className="w-full border border-blue-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-blue-50" />
            </div>
          )}
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
            Cancelar
          </button>
          <button disabled={!clientId || !period || saving} onClick={handleConfirm}
            className={`flex-1 px-4 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest text-white transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5 ${tx.tipo === 'debito' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
            {saving ? <Loader2 size={13} className="animate-spin" /> : tx.tipo === 'debito' ? <Receipt size={13} /> : <Link size={13} />}
            {tx.tipo === 'debito' ? 'Ligar Fatura' : 'Ligar'}
          </button>
        </div>
      </div>
    </div>
  );
}
