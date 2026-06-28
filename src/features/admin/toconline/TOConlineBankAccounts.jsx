import React, { useState, useEffect, useCallback } from 'react';
import { Landmark, Plus, Loader2, RefreshCw, X, FlaskConical } from 'lucide-react';

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

function fmtEur(val, currency = 'EUR') {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency }).format(val ?? 0);
}

export default function TOConlineBankAccounts({ onDesligado }) {
  const [contas, setContas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);
  const [mostrarModal, setMostrarModal] = useState(false);
  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const res = await fetch('/api/toconline/bank-accounts?com_saldo=1');
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

  const [debug, setDebug] = useState(null);
  const [debugLoading, setDebugLoading] = useState(false);

  const handleDebug = async () => {
    setDebugLoading(true);
    setDebug(null);
    try {
      const res = await fetch('/api/toconline/bank-accounts?debug_types=1');
      const data = await res.json();
      setDebug(data);
    } catch (e) {
      setDebug({ erro: e.message });
    } finally {
      setDebugLoading(false);
    }
  };

  useEffect(() => { carregar(); }, [carregar]);

  const totalSaldo = contas.reduce((s, c) => s + (Number(c.saldo_atual ?? 0) || 0), 0);

  return (
    <div className="space-y-4">
      {/* Card de saldo total */}
      {contas.length > 0 && (
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 rounded-2xl px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 rounded-xl">
              <Landmark size={16} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Saldo Total</p>
              <p className="text-2xl font-black text-emerald-800">{fmtEur(totalSaldo)}</p>
            </div>
          </div>
          <p className="text-[10px] text-emerald-400 font-semibold">{contas.length} conta{contas.length !== 1 ? 's' : ''}</p>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 rounded-xl">
              <Landmark size={16} className="text-emerald-600" />
            </div>
            <span className="text-sm font-black text-slate-800">Contas Bancárias</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={handleDebug} disabled={debugLoading}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-black uppercase tracking-widest text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-xl transition-all disabled:opacity-50">
              {debugLoading ? <Loader2 size={13} className="animate-spin" /> : <FlaskConical size={13} />} Debug Tipos
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

        {debug && (
          <div className="mx-5 my-3 bg-amber-50 border border-amber-100 rounded-xl p-4 space-y-3 text-xs">
            <p className="font-black uppercase tracking-widest text-amber-600 text-[10px]">Debug — Tipos ({debug.total} total)</p>
            <div>
              <p className="font-bold text-slate-600 mb-1">entity_type:</p>
              {Object.entries(debug.entity_types || {}).map(([k, v]) => (
                <div key={k} className="flex gap-2"><span className="font-mono text-slate-500">{k}</span><span className="font-black">{v}</span></div>
              ))}
            </div>
            <div>
              <p className="font-bold text-slate-600 mb-1">sub_type:</p>
              {Object.entries(debug.sub_types || {}).map(([k, v]) => (
                <div key={k} className="flex gap-2"><span className="font-mono text-slate-500">{k}</span><span className="font-black">{v}</span></div>
              ))}
            </div>
            <div>
              <p className="font-bold text-slate-600 mb-1">Contas com SWIFT:</p>
              {(debug.contas_com_swift || []).map((c, i) => (
                <div key={i} className="font-mono text-[10px] text-slate-500 break-all">{c.name} | et: {c.entity_type || '—'} | st: {c.sub_type || '—'} | {c.swift}</div>
              ))}
            </div>
          </div>
        )}

        {erro && (
          <div className="mx-5 my-3 bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-xs text-red-600 font-semibold">{erro}</div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12 text-slate-400">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : !erro && contas.length === 0 ? (
          <div className="px-5 py-12 text-center text-slate-400 text-xs font-semibold">
            Sem contas bancárias — crie uma nova ou sincronize com o TOConline
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {['Nome / Banco', 'IBAN', 'SWIFT', 'Tipo', 'Saldo'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {contas.map((c) => {
                  const a = c.attributes || c;
                  const saldo = c.saldo_atual ?? null;
                  return (
                    <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-semibold text-slate-800">
                        <div className="flex items-center gap-2">
                          <Landmark size={12} className="text-slate-400 shrink-0" />
                          <div>
                            <p>{a.name || '—'}</p>
                            {a.description && <p className="text-[10px] text-slate-400 font-normal">{a.description}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 font-mono text-[10px]">
                        <p>{a.iban || '—'}</p>
                        {a.nib && a.nib !== a.iban && <p className="text-slate-400">NIB: {a.nib}</p>}
                      </td>
                      <td className="px-4 py-3 text-slate-500 font-mono text-[10px]">{a.swift || '—'}</td>
                      <td className="px-4 py-3 text-slate-500">{a.account_type || '—'}</td>
                      <td className="px-4 py-3 font-bold text-emerald-700">
                        {saldo != null ? fmtEur(saldo) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {mostrarModal && (
        <NovaConta onClose={() => setMostrarModal(false)} onSalva={nova => setContas(prev => [nova, ...prev])} />
      )}
    </div>
  );
}
