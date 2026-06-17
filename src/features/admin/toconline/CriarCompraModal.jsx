import React, { useState, useRef } from 'react';
import { Plus, Trash2, Loader2, ShoppingCart } from 'lucide-react';
import ModalShell from '../../../components/common/ModalShell';

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
          id: f.id,
          nome: f.attributes?.business_name || f.attributes?.name || '',
          nif: f.attributes?.tax_registration_number || '',
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
        placeholder="Pesquisar fornecedor..."
        onChange={e => { setQ(e.target.value); onChange(null); buscar(e.target.value); setAberto(true); }}
        onFocus={() => { if (opcoes.length > 0) setAberto(true); }}
        onBlur={() => setTimeout(() => setAberto(false), 150)}
        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-300"
      />
      {buscando && <Loader2 size={12} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400" />}
      {aberto && opcoes.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
          {opcoes.map(f => (
            <button key={f.id} type="button"
              className="w-full px-3 py-2 text-left text-xs hover:bg-orange-50 transition-colors"
              onMouseDown={() => { onChange(f); setQ(f.nome); setAberto(false); }}>
              <span className="font-semibold text-slate-800">{f.nome}</span>
              {f.nif && <span className="ml-2 text-slate-400 font-mono">{f.nif}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const linhaVazia = () => ({ descricao: '', quantidade: 1, preco_unitario: '', taxa_iva: 23 });

export default function CriarCompraModal({ onClose, onCriado }) {
  const [fornecedor, setFornecedor] = useState(null);
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [linhas, setLinhas] = useState([linhaVazia()]);
  const [referencia, setReferencia] = useState('');
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState(null);

  const setLinha = (i, k, v) => setLinhas(prev => prev.map((l, idx) => idx === i ? { ...l, [k]: v } : l));
  const addLinha = () => setLinhas(prev => [...prev, linhaVazia()]);
  const removeLinha = (i) => setLinhas(prev => prev.filter((_, idx) => idx !== i));

  const total = linhas.reduce((acc, l) => {
    const base = (Number(l.preco_unitario) || 0) * (Number(l.quantidade) || 0);
    return acc + base * (1 + (Number(l.taxa_iva) || 0) / 100);
  }, 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!fornecedor) { setErro('Selecione um fornecedor.'); return; }
    const linhasValidas = linhas.filter(l => l.descricao && Number(l.preco_unitario) > 0);
    if (linhasValidas.length === 0) { setErro('Adicione pelo menos uma linha com descrição e preço.'); return; }
    setCriando(true);
    setErro(null);
    try {
      const res = await fetch('/api/toconline/create-compra', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fornecedor, data, linhas: linhasValidas, referencia }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || `Erro ${res.status}`);
      onCriado?.();
      onClose();
    } catch (err) {
      setErro(err.message);
    } finally {
      setCriando(false);
    }
  };

  return (
    <ModalShell isOpen onClose={onClose} title="Registar Compra" subtitle="Documento de compra a fornecedor" icon={<ShoppingCart size={16} />} accent="orange">
      <div onClick={e => e.stopPropagation()}>
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          {/* Fornecedor + Data */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Fornecedor *</p>
              <AutocompleteFornecedor value={fornecedor} onChange={setFornecedor} />
              {fornecedor && (
                <p className="text-[10px] text-emerald-600 font-semibold">
                  {fornecedor.nome}{fornecedor.nif ? ` · NIF ${fornecedor.nif}` : ''}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Data *</p>
              <input type="date" value={data} onChange={e => setData(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-300" />
            </div>
          </div>

          {/* Referência */}
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Referência / Notas</p>
            <input type="text" value={referencia} onChange={e => setReferencia(e.target.value)}
              placeholder="Nº fatura do fornecedor, notas..."
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-300" />
          </div>

          {/* Linhas */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Linhas</p>
              <button type="button" onClick={addLinha}
                className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-orange-600 hover:text-orange-800 transition-colors">
                <Plus size={11} /> Adicionar linha
              </button>
            </div>

            <div className="space-y-2">
              <div className="grid gap-2 text-[9px] font-black uppercase tracking-widest text-slate-400 px-1"
                style={{ gridTemplateColumns: '1fr 60px 90px 60px auto' }}>
                <span>Descrição</span><span className="text-center">Qtd</span>
                <span className="text-center">Preço/un</span><span className="text-center">IVA %</span><span />
              </div>
              {linhas.map((l, i) => (
                <div key={i} className="grid gap-2 items-center" style={{ gridTemplateColumns: '1fr 60px 90px 60px auto' }}>
                  <input value={l.descricao} onChange={e => setLinha(i, 'descricao', e.target.value)}
                    placeholder="Descrição do artigo..."
                    className="px-2 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-300" />
                  <input type="number" min="0.01" step="0.01" value={l.quantidade} onChange={e => setLinha(i, 'quantidade', e.target.value)}
                    className="px-2 py-2 rounded-xl border border-slate-200 text-xs text-center text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-300" />
                  <input type="number" min="0" step="0.01" value={l.preco_unitario} onChange={e => setLinha(i, 'preco_unitario', e.target.value)}
                    placeholder="0,00"
                    className="px-2 py-2 rounded-xl border border-slate-200 text-xs text-center text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-300" />
                  <select value={l.taxa_iva} onChange={e => setLinha(i, 'taxa_iva', e.target.value)}
                    className="px-2 py-2 rounded-xl border border-slate-200 text-xs text-center text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-300">
                    {[0, 6, 13, 23].map(v => <option key={v} value={v}>{v}%</option>)}
                  </select>
                  <button type="button" onClick={() => removeLinha(i)} disabled={linhas.length === 1}
                    className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all disabled:opacity-30">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="flex justify-end pt-1">
              <div className="bg-slate-50 rounded-xl px-4 py-2 text-right">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total c/ IVA</p>
                <p className="text-lg font-black text-slate-800">{total.toFixed(2)} €</p>
              </div>
            </div>
          </div>

          {erro && (
            <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-xs text-red-600 font-semibold">{erro}</div>
          )}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 rounded-xl transition-all">
              Cancelar
            </button>
            <button type="submit" disabled={criando}
              className="flex-1 px-4 py-2.5 bg-orange-500 text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-orange-600 transition-all disabled:opacity-60 flex items-center justify-center gap-1.5 shadow-sm shadow-orange-100">
              {criando ? <Loader2 size={14} className="animate-spin" /> : <ShoppingCart size={14} />}
              {criando ? 'A criar...' : 'Registar Compra'}
            </button>
          </div>
        </form>
      </div>
    </ModalShell>
  );
}
