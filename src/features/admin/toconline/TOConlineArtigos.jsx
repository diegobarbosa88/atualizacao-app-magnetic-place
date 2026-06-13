import React, { useState, useEffect, useCallback } from 'react';
import { Search, Plus, Loader2, RefreshCw, Package, X } from 'lucide-react';

function NovoArtigoModal({ onClose, onSalvo }) {
  const [form, setForm] = useState({ descricao: '', codigo: '', preco_unitario: '', taxa_iva: '23', tipo: 'Service', unidade: '' });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    try {
      const res = await fetch('/api/toconline/artigos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          preco_unitario: form.preco_unitario ? parseFloat(form.preco_unitario) : undefined,
          taxa_iva: parseFloat(form.taxa_iva),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao criar artigo');
      onSalvo(data.data);
      onClose();
    } catch (e) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black uppercase tracking-widest text-slate-700">Novo Artigo</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Descrição *</p>
            <input type="text" value={form.descricao} onChange={e => set('descricao', e.target.value)} required
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Código</p>
              <input type="text" value={form.codigo} onChange={e => set('codigo', e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Unidade</p>
              <input type="text" value={form.unidade} onChange={e => set('unidade', e.target.value)} placeholder="un, h, kg..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Preço Unit. (€)</p>
              <input type="number" step="0.01" value={form.preco_unitario} onChange={e => set('preco_unitario', e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">IVA (%)</p>
              <select value={form.taxa_iva} onChange={e => set('taxa_iva', e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300">
                {['0', '6', '13', '23'].map(v => <option key={v} value={v}>{v}%</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tipo</p>
            <select value={form.tipo} onChange={e => set('tipo', e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300">
              <option value="Service">Serviço</option>
              <option value="Product">Produto</option>
            </select>
          </div>

          {erro && <p className="text-xs text-red-600">{erro}</p>}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 rounded-xl transition-all">
              Cancelar
            </button>
            <button type="submit" disabled={salvando}
              className="flex-1 px-4 py-2 bg-blue-600 text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-blue-700 transition-all disabled:opacity-60 flex items-center justify-center gap-1.5">
              {salvando ? <Loader2 size={13} className="animate-spin" /> : null}
              Guardar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function TOConlineArtigos({ onDesligado }) {
  const [artigos, setArtigos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);
  const [pesquisa, setPesquisa] = useState('');
  const [meta, setMeta] = useState({});
  const [pagina, setPagina] = useState(1);
  const [mostrarModal, setMostrarModal] = useState(false);

  const carregar = useCallback(async (q = pesquisa, pg = pagina) => {
    setLoading(true);
    setErro(null);
    try {
      const params = new URLSearchParams({ page: pg });
      if (q) params.set('q', q);
      const res = await fetch(`/api/toconline/artigos?${params}`);
      const data = await res.json();
      if (res.status === 401) { onDesligado?.(); return; }
      if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
      setArtigos(data.data || []);
      setMeta(data.meta || {});
    } catch (e) {
      setErro(e.message);
      setArtigos([]);
    } finally {
      setLoading(false);
    }
  }, [pesquisa, pagina, onDesligado]);

  useEffect(() => { carregar(); }, []);

  const handlePesquisa = (v) => {
    setPesquisa(v);
    setPagina(1);
    carregar(v, 1);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Pesquisar por código ou descrição..."
            value={pesquisa}
            onChange={e => handlePesquisa(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </div>
        <button onClick={() => carregar()}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 rounded-xl transition-all">
          <RefreshCw size={13} /> Sincronizar
        </button>
        <button onClick={() => setMostrarModal(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition-all">
          <Plus size={13} /> Novo Artigo
        </button>
      </div>

      {erro && (
        <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3 text-xs text-red-600 font-semibold">{erro}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12 text-slate-400">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : !erro && artigos.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-xs font-semibold">
          {pesquisa ? 'Nenhum artigo encontrado' : 'Sem artigos — sincronize ou crie um novo'}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-100">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {['Código', 'Descrição', 'Tipo', 'Preço Unit.', 'IVA'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {artigos.map((a) => {
                const attrs = a.attributes || {};
                return (
                  <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-slate-500">{attrs.item_code || '—'}</td>
                    <td className="px-4 py-3 font-semibold text-slate-800 flex items-center gap-2">
                      <Package size={12} className="text-slate-400 shrink-0" />
                      {attrs.item_description || attrs.description || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest ${a._kind === 'product' ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'}`}>
                        {a._kind === 'product' ? 'Produto' : 'Serviço'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700 font-semibold">
                      {attrs.sales_price != null ? `${Number(attrs.sales_price).toFixed(2)} €` : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{attrs.tax_code || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {(meta.total_pages > 1) && (
        <div className="flex items-center justify-center gap-2">
          <button disabled={pagina <= 1} onClick={() => { setPagina(p => p - 1); carregar(pesquisa, pagina - 1); }}
            className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-lg disabled:opacity-40 transition-all">
            Anterior
          </button>
          <span className="text-xs text-slate-400">{pagina} / {meta.total_pages}</span>
          <button disabled={pagina >= meta.total_pages} onClick={() => { setPagina(p => p + 1); carregar(pesquisa, pagina + 1); }}
            className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-lg disabled:opacity-40 transition-all">
            Próxima
          </button>
        </div>
      )}

      {mostrarModal && (
        <NovoArtigoModal onClose={() => setMostrarModal(false)} onSalvo={a => setArtigos(prev => [a, ...prev])} />
      )}
    </div>
  );
}
