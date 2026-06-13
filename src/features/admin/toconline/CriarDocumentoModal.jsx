import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Trash2, Loader2, Search } from 'lucide-react';

const TIPOS_DOC = [
  { value: 'FT', label: 'FT — Fatura' },
  { value: 'FR', label: 'FR — Fatura Recibo' },
  { value: 'FS', label: 'FS — Fatura Simplificada' },
  { value: 'NC', label: 'NC — Nota de Crédito' },
  { value: 'ND', label: 'ND — Nota de Débito' },
  { value: 'VD', label: 'VD — Venda a Dinheiro' },
  { value: 'GT', label: 'GT — Guia de Transporte' },
  { value: 'ORC', label: 'ORC — Orçamento' },
];

const LINHA_VAZIA = { descricao: '', quantidade: 1, preco_unitario: '', taxa_iva: 23, artigo_id: null };

function AutocompleteCliente({ value, onChange }) {
  const [query, setQuery] = useState(value?.nome || '');
  const [resultados, setResultados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [aberto, setAberto] = useState(false);
  const timer = useRef(null);

  const pesquisar = (q) => {
    setQuery(q);
    onChange(null);
    clearTimeout(timer.current);
    if (!q) { setResultados([]); return; }
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/toconline/clientes?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setResultados(data.data || []);
        setAberto(true);
      } catch { setResultados([]); }
      finally { setLoading(false); }
    }, 300);
  };

  const selecionar = (c) => {
    const a = c.attributes || {};
    onChange({ id: c.id, nome: a.business_name, nif: a.tax_registration_number });
    setQuery(a.business_name || '');
    setAberto(false);
    setResultados([]);
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Pesquisar cliente..."
          value={query}
          onChange={e => pesquisar(e.target.value)}
          onFocus={() => resultados.length > 0 && setAberto(true)}
          className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
        {loading && <Loader2 size={12} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400" />}
      </div>
      {aberto && resultados.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
          {resultados.map(c => {
            const a = c.attributes || {};
            return (
              <button key={c.id} type="button" onClick={() => selecionar(c)}
                className="w-full px-3 py-2 text-left text-xs hover:bg-blue-50 transition-colors">
                <span className="font-semibold text-slate-800">{a.business_name || a.name}</span>
                {a.tax_registration_number && <span className="text-slate-400 ml-2 font-mono">{a.tax_registration_number}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AutocompleteArtigo({ value, onChange }) {
  const [query, setQuery] = useState(value?.descricao || '');
  const [resultados, setResultados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [aberto, setAberto] = useState(false);
  const timer = useRef(null);

  const pesquisar = (q) => {
    setQuery(q);
    onChange({ ...value, descricao: q, artigo_id: null });
    clearTimeout(timer.current);
    if (!q) { setResultados([]); return; }
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/toconline/artigos?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setResultados(data.data || []);
        setAberto(true);
      } catch { setResultados([]); }
      finally { setLoading(false); }
    }, 300);
  };

  const selecionar = (a) => {
    const attrs = a.attributes || {};
    onChange({
      ...value,
      artigo_id: a.id,
      descricao: attrs.item_description || attrs.description || '',
      preco_unitario: attrs.sales_price ?? attrs.unit_price ?? value.preco_unitario,
      taxa_iva: attrs.tax_percentage ?? value.taxa_iva,
    });
    setQuery(attrs.item_description || attrs.description || '');
    setAberto(false);
    setResultados([]);
  };

  return (
    <div className="relative">
      <input
        type="text"
        placeholder="Descrição / artigo..."
        value={query}
        onChange={e => pesquisar(e.target.value)}
        onFocus={() => resultados.length > 0 && setAberto(true)}
        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
      />
      {loading && <Loader2 size={12} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400" />}
      {aberto && resultados.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-40 overflow-y-auto">
          {resultados.map(a => {
            const attrs = a.attributes || {};
            return (
              <button key={a.id} type="button" onClick={() => selecionar(a)}
                className="w-full px-3 py-2 text-left text-xs hover:bg-blue-50 transition-colors">
                <span className="font-semibold text-slate-800">{attrs.item_description || attrs.description}</span>
                {(attrs.sales_price ?? attrs.unit_price) != null && <span className="text-slate-400 ml-2">{Number(attrs.sales_price ?? attrs.unit_price).toFixed(2)} €</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function CriarDocumentoModal({ onClose, onCriado }) {
  const [tipo, setTipo] = useState('FT');
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [cliente, setCliente] = useState(null);
  const [linhas, setLinhas] = useState([{ ...LINHA_VAZIA }]);
  const [serie, setSerie] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState(null);

  const setLinha = (i, k, v) => setLinhas(prev => prev.map((l, idx) => idx === i ? { ...l, [k]: v } : l));
  const addLinha = () => setLinhas(prev => [...prev, { ...LINHA_VAZIA }]);
  const removeLinha = (i) => setLinhas(prev => prev.filter((_, idx) => idx !== i));

  const totalLinhas = linhas.reduce((sum, l) => {
    const base = (Number(l.quantidade) || 0) * (Number(l.preco_unitario) || 0);
    return sum + base * (1 + (Number(l.taxa_iva) || 0) / 100);
  }, 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!cliente) { setErro('Seleciona um cliente'); return; }
    if (linhas.some(l => !l.descricao || !l.preco_unitario)) { setErro('Todas as linhas precisam de descrição e preço'); return; }

    setCriando(true);
    setErro(null);
    try {
      const res = await fetch('/api/toconline/create-fatura', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo_documento: tipo,
          data,
          cliente,
          linhas: linhas.map(l => ({
            ...l,
            quantidade: Number(l.quantidade),
            preco_unitario: Number(l.preco_unitario),
            taxa_iva: Number(l.taxa_iva),
          })),
          serie: serie || undefined,
          observacoes: observacoes || undefined,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Erro ao criar documento');
      onCriado?.(d);
      onClose();
    } catch (e) {
      setErro(e.message);
    } finally {
      setCriando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl my-8 p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black uppercase tracking-widest text-slate-700">Criar Documento TOConline</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tipo Doc.</p>
              <select value={tipo} onChange={e => setTipo(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300">
                {TIPOS_DOC.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Data</p>
              <input type="date" value={data} onChange={e => setData(e.target.value)} required
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Série (opcional)</p>
              <input type="text" value={serie} onChange={e => setSerie(e.target.value)} placeholder="Ex: A"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cliente *</p>
            <AutocompleteCliente value={cliente} onChange={setCliente} />
            {cliente && (
              <p className="text-[10px] text-emerald-600 font-semibold">
                {cliente.nome}{cliente.nif ? ` · NIF ${cliente.nif}` : ''}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Linhas *</p>
              <button type="button" onClick={addLinha}
                className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-700 transition-colors">
                <Plus size={11} /> Adicionar linha
              </button>
            </div>

            <div className="space-y-2">
              {linhas.map((l, i) => (
                <div key={i} className="grid gap-2 items-start" style={{ gridTemplateColumns: '1fr 70px 90px 70px auto' }}>
                  <AutocompleteArtigo value={l} onChange={v => setLinhas(prev => prev.map((x, idx) => idx === i ? { ...x, ...v } : x))} />
                  <input type="number" min="0.01" step="0.01" value={l.quantidade} onChange={e => setLinha(i, 'quantidade', e.target.value)}
                    placeholder="Qtd" className="px-2 py-2 rounded-xl border border-slate-200 text-xs text-center focus:outline-none focus:ring-2 focus:ring-blue-300" />
                  <input type="number" min="0" step="0.01" value={l.preco_unitario} onChange={e => setLinha(i, 'preco_unitario', e.target.value)}
                    placeholder="€/un" className="px-2 py-2 rounded-xl border border-slate-200 text-xs text-center focus:outline-none focus:ring-2 focus:ring-blue-300" />
                  <select value={l.taxa_iva} onChange={e => setLinha(i, 'taxa_iva', e.target.value)}
                    className="px-2 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-300">
                    {[0, 6, 13, 23].map(v => <option key={v} value={v}>{v}%</option>)}
                  </select>
                  <button type="button" onClick={() => removeLinha(i)} disabled={linhas.length === 1}
                    className="p-2 text-slate-300 hover:text-red-500 transition-colors disabled:opacity-0">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>

            <div className="text-right text-sm font-black text-slate-700 pt-1">
              Total c/IVA: {totalLinhas.toFixed(2)} €
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Observações</p>
            <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={2}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none" />
          </div>

          {erro && <p className="text-xs text-red-600 font-semibold">{erro}</p>}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 rounded-xl transition-all">
              Cancelar
            </button>
            <button type="submit" disabled={criando}
              className="flex-1 px-4 py-2.5 bg-blue-600 text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-blue-700 transition-all disabled:opacity-60 flex items-center justify-center gap-1.5 shadow-md shadow-blue-100">
              {criando ? <Loader2 size={13} className="animate-spin" /> : null}
              Emitir Documento
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
