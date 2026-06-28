import React, { useState, useEffect, useCallback } from 'react';
import { Landmark, Plus, Loader2, RefreshCw, X, ChevronRight, ArrowUpRight, ArrowDownLeft } from 'lucide-react';

function fmtEur(val, currency = 'EUR') {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency }).format(val ?? 0);
}

function fmtData(str) {
  if (!str) return '—';
  return new Date(str).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

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
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-3">
          {[{ key: 'nome', label: 'Nome *', required: true }, { key: 'iban', label: 'IBAN' }, { key: 'banco', label: 'Banco' }].map(({ key, label, required }) => (
            <div key={key} className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
              <input type="text" value={form[key]} onChange={e => set(key, e.target.value)} required={required}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          ))}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Moeda</p>
              <select value={form.moeda} onChange={e => set('moeda', e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="EUR">EUR</option><option value="USD">USD</option><option value="GBP">GBP</option>
              </select>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Saldo Inicial</p>
              <input type="number" step="0.01" value={form.saldo_inicial} onChange={e => set('saldo_inicial', e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>
          {erro && <p className="text-xs text-red-600 font-semibold">{erro}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 rounded-xl transition-all">Cancelar</button>
            <button type="submit" disabled={salvando} className="flex-1 px-4 py-2 bg-blue-600 text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-blue-700 transition-all disabled:opacity-60 flex items-center justify-center gap-1.5">
              {salvando && <Loader2 size={13} className="animate-spin" />} Guardar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PainelMovimentos({ conta, onClose }) {
  const a = conta.attributes || conta;
  const [movimentos, setMovimentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [page, setPage] = useState(1);
  const [temMais, setTemMais] = useState(false);

  const carregar = useCallback(async (p = 1) => {
    setLoading(true);
    setErro(null);
    try {
      const res = await fetch(`/api/toconline/bank-accounts?movimentos=1&id=${conta.id}&page=${p}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
      const items = data.data || [];
      setMovimentos(prev => p === 1 ? items : [...prev, ...items]);
      setTemMais(items.length === 30);
      setPage(p);
    } catch (e) {
      setErro(e.message);
    } finally {
      setLoading(false);
    }
  }, [conta.id]);

  useEffect(() => { carregar(1); }, [carregar]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 rounded-xl"><Landmark size={14} className="text-emerald-600" /></div>
            <div>
              <p className="text-sm font-black text-slate-800">{a.name || '—'}</p>
              {conta.saldo_atual != null && (
                <p className="text-xs font-bold text-emerald-600">{fmtEur(conta.saldo_atual)}</p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"><X size={16} /></button>
        </div>

        {/* Lista de movimentos */}
        <div className="overflow-y-auto flex-1">
          {loading && movimentos.length === 0 ? (
            <div className="flex justify-center py-10"><Loader2 size={20} className="animate-spin text-slate-300" /></div>
          ) : erro ? (
            <div className="px-5 py-4 text-xs text-red-600 font-semibold">{erro}</div>
          ) : movimentos.length === 0 ? (
            <div className="px-5 py-10 text-center text-xs text-slate-400 font-semibold">Sem movimentos registados</div>
          ) : (
            <div className="divide-y divide-slate-50">
              {movimentos.map((m, i) => {
                const at = m.attributes || m;
                const valor = Number(at.value ?? 0);
                const saldoApos = at.imported_balance != null ? Number(at.imported_balance) : null;
                const entrada = valor >= 0;
                return (
                  <div key={i} className="px-5 py-3 flex items-center gap-3">
                    <div className={`p-1.5 rounded-lg shrink-0 ${entrada ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                      {entrada
                        ? <ArrowDownLeft size={13} className="text-emerald-500" />
                        : <ArrowUpRight size={13} className="text-rose-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-700 truncate">{at.description || at.annotation || '—'}</p>
                      <p className="text-[10px] text-slate-400">{fmtData(at.transaction_date || at.posted_date)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-xs font-black ${entrada ? 'text-emerald-600' : 'text-rose-500'}`}>
                        {entrada ? '+' : ''}{fmtEur(valor)}
                      </p>
                      {saldoApos != null && (
                        <p className="text-[10px] text-slate-400">{fmtEur(saldoApos)}</p>
                      )}
                    </div>
                  </div>
                );
              })}
              {temMais && (
                <div className="px-5 py-3 text-center">
                  <button onClick={() => carregar(page + 1)} disabled={loading}
                    className="text-xs font-black uppercase tracking-widest text-blue-600 hover:text-blue-800 disabled:opacity-50 flex items-center gap-1 mx-auto">
                    {loading ? <Loader2 size={12} className="animate-spin" /> : null} Ver mais
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TOConlineBankAccounts({ onDesligado }) {
  const [contas, setContas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [contaMovimentos, setContaMovimentos] = useState(null);
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

  useEffect(() => { carregar(); }, [carregar]);

  const totalSaldo = contas.reduce((s, c) => s + (Number(c.saldo_atual ?? 0) || 0), 0);

  return (
    <div className="space-y-4">
      {/* Card de saldo total */}
      {contas.length > 0 && (
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 rounded-2xl px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 rounded-xl"><Landmark size={16} className="text-emerald-600" /></div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Saldo Total</p>
              <p className="text-2xl font-black text-emerald-800">{fmtEur(totalSaldo)}</p>
            </div>
          </div>
          <p className="text-[10px] text-emerald-400 font-semibold">{contas.length} conta{contas.length !== 1 ? 's' : ''}</p>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 rounded-xl"><Landmark size={16} className="text-emerald-600" /></div>
            <span className="text-sm font-black text-slate-800">Contas Bancárias</span>
          </div>
          <div className="flex items-center gap-2">
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
            Sem contas bancárias registadas
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {contas.map((c) => {
              const a = c.attributes || c;
              return (
                <button key={c.id} onClick={() => setContaMovimentos(c)}
                  className="w-full px-5 py-4 flex items-center gap-4 hover:bg-slate-50 transition-colors text-left">
                  <div className="p-2 bg-slate-100 rounded-xl shrink-0">
                    <Landmark size={14} className="text-slate-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-800">{a.name || '—'}</p>
                    <p className="text-[10px] font-mono text-slate-400 truncate">{a.iban || a.nib || '—'}</p>
                    {a.swift && <p className="text-[10px] text-slate-300 font-mono">{a.swift}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-base font-black text-emerald-700">
                      {c.saldo_atual != null ? fmtEur(c.saldo_atual) : '—'}
                    </p>
                    <p className="text-[10px] text-slate-400">{a.account_type || '—'}</p>
                  </div>
                  <ChevronRight size={14} className="text-slate-300 shrink-0" />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {mostrarModal && (
        <NovaConta onClose={() => setMostrarModal(false)} onSalva={nova => setContas(prev => [nova, ...prev])} />
      )}

      {contaMovimentos && (
        <PainelMovimentos conta={contaMovimentos} onClose={() => setContaMovimentos(null)} />
      )}
    </div>
  );
}
