import React, { useState, useRef } from 'react';
import { X, Loader2, ArrowRightLeft } from 'lucide-react';

function AutocompleteFornecedor({ value, onChange }) {
  const [q, setQ] = useState(value?.nome || '');
  const [opcoes, setOpcoes] = useState([]);
  const [aberto, setAberto] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const timer = useRef(null);

  const buscar = (termo) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      if (!termo || termo.length < 2) { setOpcoes([]); return; }
      setBuscando(true);
      try {
        const res = await fetch(`/api/toconline?action=fornecedores&q=${encodeURIComponent(termo)}`);
        const data = await res.json();
        const lista = (data.data || []).map(f => ({
          nome: f.attributes?.business_name || f.attributes?.name || '',
          nif: f.attributes?.tax_registration_number || '',
          iban: f.attributes?.iban || '',
        }));
        setOpcoes(lista);
        setAberto(lista.length > 0);
      } catch { setOpcoes([]); }
      finally { setBuscando(false); }
    }, 300);
  };

  return (
    <div className="relative">
      <input
        type="text"
        value={q}
        placeholder="Pesquisar fornecedor TOConline..."
        onChange={e => { setQ(e.target.value); onChange({ nome: e.target.value }); buscar(e.target.value); setAberto(true); }}
        onFocus={() => { if (opcoes.length > 0) setAberto(true); }}
        onBlur={() => setTimeout(() => setAberto(false), 150)}
        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-300"
      />
      {buscando && <Loader2 size={12} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400" />}
      {aberto && opcoes.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
          {opcoes.map((f, i) => (
            <button key={i} type="button"
              className="w-full px-3 py-2 text-left text-xs hover:bg-violet-50 transition-colors"
              onMouseDown={() => { onChange(f); setQ(f.nome); setAberto(false); }}>
              <span className="font-semibold text-slate-800">{f.nome}</span>
              {f.nif && <span className="ml-2 text-slate-400 font-mono">{f.nif}</span>}
              {f.iban && <span className="ml-2 text-slate-400 font-mono text-[10px]">{f.iban}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function NovoPagamentoModal({ onClose, onCriado }) {
  const [form, setForm] = useState({
    fornecedor_nome: '',
    fornecedor_nif: '',
    fornecedor_iban: '',
    valor: '',
    referencia: '',
    data_pagamento: new Date().toISOString().slice(0, 10),
  });
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState(null);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleFornecedor = (f) => {
    if (!f) return;
    setForm(prev => ({
      ...prev,
      fornecedor_nome: f.nome || prev.fornecedor_nome,
      fornecedor_nif: f.nif || prev.fornecedor_nif,
      fornecedor_iban: f.iban || prev.fornecedor_iban,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setCriando(true);
    setErro(null);
    try {
      const res = await fetch('/api/pagamentos?action=criar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, valor: Number(form.valor) }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || `Erro ${res.status}`);
      onCriado(d.data);
      onClose();
    } catch (err) {
      setErro(err.message);
    } finally {
      setCriando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-violet-50 rounded-xl"><ArrowRightLeft size={14} className="text-violet-600" /></div>
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-700">Novo Pagamento</h2>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-3">
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Fornecedor *</p>
            <AutocompleteFornecedor value={{ nome: form.fornecedor_nome }} onChange={handleFornecedor} />
            {form.fornecedor_nome && (
              <input type="text" value={form.fornecedor_nome} onChange={e => set('fornecedor_nome', e.target.value)}
                placeholder="Nome do fornecedor"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-300" />
            )}
          </div>

          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">IBAN *</p>
            <input type="text" value={form.fornecedor_iban} onChange={e => set('fornecedor_iban', e.target.value.toUpperCase())}
              placeholder="PT50 0000 0000 0000 0000 0000 0"
              required
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-300" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">NIF</p>
              <input type="text" value={form.fornecedor_nif} onChange={e => set('fornecedor_nif', e.target.value)}
                placeholder="123456789"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-300" />
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Valor (€) *</p>
              <input type="number" step="0.01" min="0.01" value={form.valor} onChange={e => set('valor', e.target.value)}
                placeholder="0,00"
                required
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-300" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Data *</p>
              <input type="date" value={form.data_pagamento} onChange={e => set('data_pagamento', e.target.value)}
                required
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-300" />
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Referência</p>
              <input type="text" value={form.referencia} onChange={e => set('referencia', e.target.value)}
                placeholder="Nº fatura..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-300" />
            </div>
          </div>

          {erro && <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-xs text-red-600 font-semibold">{erro}</div>}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 rounded-xl transition-all">
              Cancelar
            </button>
            <button type="submit" disabled={criando}
              className="flex-1 px-4 py-2.5 bg-violet-600 text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-violet-700 transition-all disabled:opacity-60 flex items-center justify-center gap-1.5">
              {criando ? <Loader2 size={13} className="animate-spin" /> : <ArrowRightLeft size={13} />}
              {criando ? 'A guardar...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
