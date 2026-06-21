import React, { useState, useMemo } from 'react';
import { Truck, Edit2, Trash2, CreditCard, Mail, Phone, Globe, LayoutGrid, List, Search, AlertCircle } from 'lucide-react';
import { useFornecedor } from '../contexts/FornecedorContext';

function maskIban(iban) {
  if (!iban || iban.length < 8) return iban || '—';
  return iban.slice(0, 4) + '••••••••' + iban.slice(-4);
}

export default function FornecedorList() {
  const { fornecedores, loading, editarFornecedor, apagar } = useFornecedor();
  const [view, setView] = useState(window.innerWidth < 768 ? 'grid' : 'list');
  const [search, setSearch] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [sortKey, setSortKey] = useState('nome');
  const [sortDir, setSortDir] = useState('asc');

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return [...fornecedores]
      .filter(f => !q || f.nome?.toLowerCase().includes(q) || f.nif?.includes(q) || f.email?.toLowerCase().includes(q))
      .sort((a, b) => {
        const va = (a[sortKey] || '').toString().toLowerCase();
        const vb = (b[sortKey] || '').toString().toLowerCase();
        return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      });
  }, [fornecedores, search, sortKey, sortDir]);

  const handleDelete = async (id) => {
    await apagar(id);
    setConfirmDeleteId(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400">
        <div className="w-6 h-6 border-2 border-slate-200 border-t-indigo-500 rounded-full animate-spin mr-3" />
        A carregar fornecedores...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search + view toggle */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Pesquisar por nome ou NIF..."
            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50"
          />
        </div>
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
          <button onClick={() => setView('list')} className={`p-1.5 rounded-lg transition-colors ${view === 'list' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}><List size={15} /></button>
          <button onClick={() => setView('grid')} className={`p-1.5 rounded-lg transition-colors ${view === 'grid' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}><LayoutGrid size={15} /></button>
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-14 text-slate-400">
          <Truck size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-bold">{search ? 'Nenhum fornecedor encontrado' : 'Nenhum fornecedor registado'}</p>
          {!search && <p className="text-xs mt-1">Clique em "+ Novo Fornecedor" para começar</p>}
        </div>
      )}

      {/* List view */}
      {view === 'list' && filtered.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-slate-100">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {[
                  { key: 'nome', label: 'Fornecedor' },
                  { key: 'email', label: 'Contacto' },
                  { key: 'iban', label: 'IBAN' },
                  { key: null, label: 'Flags' },
                  { key: 'status', label: 'Status' },
                  { key: null, label: 'Ações' },
                ].map(col => (
                  <th
                    key={col.label}
                    onClick={col.key ? () => toggleSort(col.key) : undefined}
                    className={`px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap ${col.key ? 'cursor-pointer hover:text-slate-600 select-none' : ''}`}
                  >
                    {col.label}
                    {col.key === sortKey && <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(f => (
                <tr key={f.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-black text-slate-800 text-sm">{f.nome}</p>
                    {f.nif && <p className="text-[10px] text-slate-400 font-mono mt-0.5">NIF {f.nif}</p>}
                  </td>
                  <td className="px-4 py-3">
                    {f.email && <p className="text-xs text-slate-600">{f.email}</p>}
                    {f.telefone && <p className="text-[10px] text-slate-400 mt-0.5">{f.telefone}</p>}
                    {!f.email && !f.telefone && <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {f.iban
                      ? <span className="font-mono text-[11px] text-slate-600">{maskIban(f.iban)}</span>
                      : <span className="flex items-center gap-1 text-[10px] text-amber-500 font-bold"><AlertCircle size={11} /> Sem IBAN</span>
                    }
                  </td>
                  <td className="px-4 py-3">
                    {f.debito_automatico && (
                      <span className="inline-flex items-center px-2 py-1 rounded-lg bg-violet-50 text-violet-700 text-[9px] font-black uppercase tracking-widest">D.A.</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${f.status === 'ativo' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                      {f.status === 'ativo' ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => editarFornecedor(f)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                        <Edit2 size={13} />
                      </button>
                      {confirmDeleteId === f.id ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleDelete(f.id)} className="px-2 py-1 bg-red-600 text-white rounded-lg text-[9px] font-black uppercase">Sim</button>
                          <button onClick={() => setConfirmDeleteId(null)} className="px-2 py-1 bg-slate-100 text-slate-500 rounded-lg text-[9px] font-black uppercase">Não</button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmDeleteId(f.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Grid view */}
      {view === 'grid' && filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(f => (
            <div key={f.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
              {/* Card header */}
              <div className="bg-indigo-50 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="bg-indigo-100 p-1.5 rounded-lg">
                    <Truck size={14} className="text-indigo-600" />
                  </div>
                  <span className="text-xs font-black text-indigo-800 truncate max-w-[160px]">{f.nome}</span>
                </div>
                <div className="flex items-center gap-1">
                  {f.debito_automatico && (
                    <span className="px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 text-[8px] font-black uppercase">D.A.</span>
                  )}
                  <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${f.status === 'ativo' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                    {f.status === 'ativo' ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
              </div>

              {/* Card body */}
              <div className="p-4 space-y-2">
                {f.nif && (
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="font-mono font-bold">NIF {f.nif}</span>
                  </div>
                )}
                {f.iban ? (
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <CreditCard size={11} className="shrink-0 text-emerald-500" />
                    <span className="font-mono">{maskIban(f.iban)}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-[10px] text-amber-500 font-bold">
                    <AlertCircle size={11} /> Sem IBAN
                  </div>
                )}
                {f.email && (
                  <div className="flex items-center gap-2 text-xs text-slate-500 truncate">
                    <Mail size={11} className="shrink-0" />
                    <span className="truncate">{f.email}</span>
                  </div>
                )}
                {f.telefone && (
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Phone size={11} className="shrink-0" />
                    <span>{f.telefone}</span>
                  </div>
                )}
                {f.website && (
                  <div className="flex items-center gap-2 text-xs text-slate-500 truncate">
                    <Globe size={11} className="shrink-0" />
                    <span className="truncate">{f.website}</span>
                  </div>
                )}
              </div>

              {/* Card footer */}
              <div className="border-t border-slate-100 px-4 py-2 flex items-center justify-end gap-1">
                <button onClick={() => editarFornecedor(f)} className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                  <Edit2 size={11} /> Editar
                </button>
                {confirmDeleteId === f.id ? (
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleDelete(f.id)} className="px-2 py-1.5 bg-red-600 text-white rounded-lg text-[9px] font-black uppercase">Confirmar</button>
                    <button onClick={() => setConfirmDeleteId(null)} className="px-2 py-1.5 bg-slate-100 text-slate-500 rounded-lg text-[9px] font-black uppercase">Cancelar</button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDeleteId(f.id)} className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase text-red-400 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors">
                    <Trash2 size={11} /> Apagar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
