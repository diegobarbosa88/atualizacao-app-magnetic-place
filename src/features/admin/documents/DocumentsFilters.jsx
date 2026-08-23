import React from 'react';
import { Search, Plus, X } from 'lucide-react';
import { CATEGORIAS_RH_ACT } from '../../../constants/rhCategories';
import { FT } from '../../../styles/designTokens';

// Tabs de estado com contador e o botão "A Expirar" foram substituídos pelo
// stat strip clicável no cabeçalho de DocumentsAdmin.jsx — evita repetir o
// mesmo sinal (contagens por estado) em dois sítios da mesma página.
export default function DocumentsFilters({
  stateFilter, setStateFilter,
  counts,
  searchTerm, setSearchTerm,
  sourceFilter, setSourceFilter,
  tipoFilter, setTipoFilter,
  tipoOptions,
  categoriaFilter, setCategoriaFilter,
  validadeFilter, setValidadeFilter,
  onShowUpload,
}) {
  const hasActiveFilter = stateFilter !== 'all' || (validadeFilter === 'expiring');
  return (
    <>
      {hasActiveFilter && (
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] font-black uppercase tracking-widest text-[var(--slate-dim)]">A filtrar por:</span>
          {stateFilter !== 'all' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black bg-[#1B3A57]/5 text-[var(--navy)]">
              {{ pending: 'Pendentes', awaiting_admin: 'Aguarda aprovação', signed: 'Assinados' }[stateFilter] || stateFilter}
            </span>
          )}
          {validadeFilter === 'expiring' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black bg-red-50 text-red-600">A expirar/expirados</span>
          )}
          <button
            onClick={() => { setStateFilter('all'); setValidadeFilter && setValidadeFilter(''); }}
            className="flex items-center gap-1 text-[10px] font-black text-[var(--slate-dim)] hover:text-[var(--ink-soft)] transition-colors"
          >
            <X size={11} /> Limpar
          </button>
        </div>
      )}

      {/* Filtro por categoria — dropdown */}
      <div className="mb-4">
        <select
          className="w-full p-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-xs font-bold text-[var(--ink-mid)] outline-none"
          value={categoriaFilter || ''}
          onChange={(e) => setCategoriaFilter && setCategoriaFilter(e.target.value)}
        >
          <option value="">Todas as categorias</option>
          {CATEGORIAS_RH_ACT.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2 mb-5">
        <div className="flex gap-2 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--slate)]" size={15} />
            <input
              type="text"
              placeholder="Pesquisar..."
              className="w-full pl-9 pr-3 py-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-sm outline-none transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button
            onClick={onShowUpload}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-black text-xs uppercase transition-all shadow-md shrink-0 whitespace-nowrap"
            style={{ backgroundColor: FT.orange, color: FT.navy }}
            title="Adicionar documento"
          >
            <Plus size={16} /> Adicionar
          </button>
        </div>
        <div className="flex gap-2">
          <select
            className="flex-1 p-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-xs font-bold text-[var(--ink-mid)] outline-none"
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
          >
            <option value="all">Todas as fontes</option>
            <option value="manual">Manual</option>
            <option value="template">Template</option>
          </select>
          <select
            className="flex-1 p-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-xs font-bold text-[var(--ink-mid)] outline-none"
            value={tipoFilter}
            onChange={(e) => setTipoFilter(e.target.value)}
          >
            <option value="all">Todos os Tipos</option>
            {tipoOptions.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>
    </>
  );
}
