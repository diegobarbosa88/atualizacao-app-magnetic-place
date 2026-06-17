import React, { useState, useEffect, useCallback } from 'react';
import { Search, Plus, Loader2, RefreshCw, User, X, Users } from 'lucide-react';

function NovoClienteModal({ onClose, onSalvo }) {
  const [form, setForm] = useState({ nome: '', nif: '', email: '', morada: '', codigo_postal: '', localidade: '' });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    try {
      const res = await fetch('/api/toconline/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao criar cliente');
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
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-sm font-black uppercase tracking-widest text-slate-700">Novo Cliente</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-3">
          {[
            { key: 'nome', label: 'Nome *', required: true },
            { key: 'nif', label: 'NIF' },
            { key: 'email', label: 'Email', type: 'email' },
            { key: 'morada', label: 'Morada' },
            { key: 'codigo_postal', label: 'Código Postal' },
            { key: 'localidade', label: 'Localidade' },
          ].map(({ key, label, required, type = 'text' }) => (
            <div key={key} className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
              <input
                type={type}
                value={form[key]}
                onChange={e => set(key, e.target.value)}
                required={required}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
          ))}

          {erro && <p className="text-xs text-red-600 font-semibold">{erro}</p>}

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

export default function TOConlineClientes({ onDesligado }) {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);
  const [pesquisa, setPesquisa] = useState('');
  const [pagina, setPagina] = useState(1);
  const [meta, setMeta] = useState({});
  const [mostrarModal, setMostrarModal] = useState(false);

  const carregar = useCallback(async (q = pesquisa, pg = pagina) => {
    setLoading(true);
    setErro(null);
    try {
      const params = new URLSearchParams({ page: pg });
      if (q) params.set('q', q);
      const res = await fetch(`/api/toconline/clientes?${params}`);
      const data = await res.json();
      if (res.status === 401) { onDesligado?.(); return; }
      if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
      setClientes(data.data || []);
      setMeta(data.meta || {});
    } catch (e) {
      setErro(e.message);
      setClientes([]);
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
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 rounded-xl">
            <Users size={16} className="text-blue-600" />
          </div>
          <span className="text-sm font-black text-slate-800">Clientes</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => carregar()}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 rounded-xl transition-all">
            <RefreshCw size={13} /> Sincronizar
          </button>
          <button onClick={() => setMostrarModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-sm">
            <Plus size={13} /> Novo Cliente
          </button>
        </div>
      </div>

      {/* Pesquisa */}
      <div className="px-5 py-3 border-b border-slate-100">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Pesquisar por nome ou NIF..."
            value={pesquisa}
            onChange={e => handlePesquisa(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </div>
      </div>

      {erro && (
        <div className="mx-5 my-3 bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-xs text-red-600 font-semibold">{erro}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12 text-slate-400">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : !erro && clientes.length === 0 ? (
        <div className="px-5 py-12 text-center text-slate-400 text-xs font-semibold">
          {pesquisa ? 'Nenhum cliente encontrado' : 'Sem clientes — sincronize ou crie um novo'}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {['Nome', 'NIF', 'Email', 'Morada'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {clientes.map((c) => {
                const a = c.attributes || {};
                return (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-slate-800">
                      <div className="flex items-center gap-2">
                        <User size={12} className="text-slate-400 shrink-0" />
                        {a.business_name || '—'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 font-mono">{a.tax_registration_number || '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{a.email || '—'}</td>
                    <td className="px-4 py-3 text-slate-500 max-w-[200px] truncate">{a.address || a.main_address?.street || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {meta.total_pages > 1 && (
        <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-center gap-2">
          <button disabled={pagina <= 1} onClick={() => { setPagina(p => p - 1); carregar(pesquisa, pagina - 1); }}
            className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl disabled:opacity-40 transition-all">
            Anterior
          </button>
          <span className="text-xs text-slate-400">{pagina} / {meta.total_pages}</span>
          <button disabled={pagina >= meta.total_pages} onClick={() => { setPagina(p => p + 1); carregar(pesquisa, pagina + 1); }}
            className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl disabled:opacity-40 transition-all">
            Próxima
          </button>
        </div>
      )}

      {mostrarModal && (
        <NovoClienteModal onClose={() => setMostrarModal(false)} onSalvo={c => setClientes(prev => [c, ...prev])} />
      )}
    </div>
  );
}
