import React, { useState, useEffect, useCallback } from 'react';
import { Landmark, Plus, Loader2, RefreshCw, Trash2, X } from 'lucide-react';

function NovaConta({ onClose, onSalva }) {
  const [form, setForm] = useState({ nome: '', iban: '', banco: '', moeda: 'EUR', saldo_inicial: '' });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    try {
      const res = await fetch('/api/toconline/bank-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, saldo_inicial: Number(form.saldo_inicial) || 0 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao criar conta');
      onSalva(data.data);
      onClose();
    } catch (e) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-sm font-black uppercase tracking-widest text-slate-700">Nova Conta Bancária</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-3">
          {[
            { key: 'nome', label: 'Nome *', required: true },
            { key: 'iban', label: 'IBAN' },
            { key: 'banco', label: 'Banco' },
          ].map(({ key, label, required }) => (
            <div key={key} className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
              <input
                type="text"
                value={form[key]}
                onChange={e => set(key, e.target.value)}
                required={required}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
          ))}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Moeda</p>
              <select
                value={form.moeda}
                onChange={e => set('moeda', e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
                <option value="GBP">GBP</option>
              </select>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Saldo Inicial</p>
              <input
                type="number"
                step="0.01"
                value={form.saldo_inicial}
                onChange={e => set('saldo_inicial', e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
          </div>

          {erro && <p className="text-xs text-red-600 font-semibold">{erro}</p>}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 rounded-xl transition-all">
              Cancelar
            </button>
            <button type="submit" disabled={salvando}
              className="flex-1 px-4 py-2 bg-blue-600 text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-blue-700 transition-all disabled:opacity-60 flex items-center justify-center gap-1.5">
              {salvando && <Loader2 size={13} className="animate-spin" />}
              Guardar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function TOConlineBankAccounts({ onDesligado }) {
  const [contas, setContas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [removendo, setRemovendo] = useState(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const res = await fetch('/api/toconline/bank-accounts');
      const data = await res.json();
      if (res.status === 401) { onDesligado?.(); return; }
      if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
      setContas(data.data || []);
    } catch (e) {
      setErro(e.message);
      setContas([]);
    } finally {
      setLoading(false);
    }
  }, [onDesligado]);

  useEffect(() => { carregar(); }, [carregar]);

  const handleRemover = async (id, nome) => {
    if (!window.confirm(`Remover a conta "${nome}" do Toconline?`)) return;
    setRemovendo(id);
    try {
      const res = await fetch(`/api/toconline/bank-accounts?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao remover');
      setContas(prev => prev.filter(c => c.id !== id));
    } catch (e) {
      alert(e.message);
    } finally {
      setRemovendo(null);
    }
  };

  const handleConectarTink = async () => {
    try {
      const res = await fetch('/api/pagamentos?action=tink-get-link');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao obter link Tink');
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (e) {
      alert(e.message);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-50 rounded-xl">
            <Landmark size={16} className="text-emerald-600" />
          </div>
          <span className="text-sm font-black text-slate-800">Contas Bancárias</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleConectarTink}
            className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:from-violet-700 hover:to-indigo-700 transition-all shadow-sm">
            <RefreshCw size={13} /> Conectar Tink
          </button>
          <button onClick={carregar}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 rounded-xl transition-all">
            <RefreshCw size={13} /> Sincronizar
          </button>
          <button onClick={() => setMostrarModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-sm">
            <Plus size={13} /> Nova Conta
          </button>
        </div>
      </div>

      {erro && (
        <div className="mx-5 my-3 bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-xs text-red-600 font-semibold">{erro}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12 text-slate-400">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : !erro && contas.length === 0 ? (
        <div className="px-5 py-12 text-center text-slate-400 text-xs font-semibold">
          Sem contas bancárias — sincronize ou crie uma nova
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {['Nome / Banco', 'IBAN / NIB', 'SWIFT', 'Tipo', 'Saldo Inicial', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-400 last:w-10">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {contas.map((c) => {
                const a = c.attributes || c;
                const saldo = a.initial_balance ?? a.current_balance ?? a.balance ?? null;
                return (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-slate-800">
                      <div className="flex items-center gap-2">
                        <Landmark size={12} className="text-slate-400 shrink-0" />
                        <div>
                          <p>{a.name || '—'}</p>
                          {a.description && <p className="text-[10px] text-slate-400 font-normal">{a.description}</p>}
                        </div>
                        {a.is_connected && (
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 text-[9px] font-black rounded-full uppercase">ligado</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 font-mono text-[10px]">
                      <p>{a.iban || '—'}</p>
                      {a.nib && a.nib !== a.iban && <p className="text-slate-400">NIB: {a.nib}</p>}
                    </td>
                    <td className="px-4 py-3 text-slate-500 font-mono text-[10px]">{a.swift || '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{a.account_type || '—'}</td>
                    <td className="px-4 py-3 font-bold text-slate-700">
                      {saldo != null
                        ? new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(saldo)
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleRemover(c.id, a.name)}
                        disabled={removendo === c.id}
                        className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all disabled:opacity-40"
                      >
                        {removendo === c.id
                          ? <Loader2 size={13} className="animate-spin" />
                          : <Trash2 size={13} />}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {mostrarModal && (
        <NovaConta onClose={() => setMostrarModal(false)} onSalva={nova => setContas(prev => [nova, ...prev])} />
      )}
    </div>
  );
}
