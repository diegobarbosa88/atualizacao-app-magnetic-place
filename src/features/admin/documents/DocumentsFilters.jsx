import React from 'react';
import { Search, X } from 'lucide-react';
import { SCALE } from '../../../styles/designTokens';

const SOURCE_OPTIONS = [
  { v: 'all', l: 'Todas' },
  { v: 'manual', l: 'Manual' },
  { v: 'template', l: 'Template' },
];

// Tabs de estado com contador e o botão "A Expirar" foram substituídos pelo
// stat strip clicável no cabeçalho de DocumentsAdmin.jsx — evita repetir o
// mesmo sinal (contagens por estado) em dois sítios da mesma página.
// Categoria saiu daqui para a rail vertical (DocumentsAdmin.jsx); "Adicionar"
// saiu para o botão de ação do cabeçalho partilhado.
export default function DocumentsFilters({
  stateFilter, setStateFilter,
  counts,
  searchTerm, setSearchTerm,
  sourceFilter, setSourceFilter,
  tipoFilter, setTipoFilter,
  tipoOptions,
  validadeFilter, setValidadeFilter,
}) {
  const hasActiveFilter = stateFilter !== 'all' || (validadeFilter === 'expiring');
  return (
    <>
      {hasActiveFilter && (
        <div className="flex items-center gap-2 mb-3">
          <span className={`${SCALE.text.badge} text-[var(--slate-dim)]`}>A filtrar por:</span>
          {stateFilter !== 'all' && (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg ${SCALE.text.meta} bg-[#1B3A57]/5 text-[var(--navy)]`}>
              {{ pending: 'Pendentes', awaiting_admin: 'Aguarda aprovação', signed: 'Assinados' }[stateFilter] || stateFilter}
            </span>
          )}
          {validadeFilter === 'expiring' && (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg ${SCALE.text.meta} bg-red-50 text-red-600`}>A expirar/expirados</span>
          )}
          <button
            onClick={() => { setStateFilter('all'); setValidadeFilter && setValidadeFilter(''); }}
            className={`flex items-center gap-1 ${SCALE.text.meta} text-[var(--slate-dim)] hover:text-[var(--ink-soft)] transition-colors`}
          >
            <X size={11} /> Limpar
          </button>
        </div>
      )}

      <div className="flex flex-col gap-2 mb-5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--slate)]" size={15} />
          <input
            type="text"
            placeholder="Pesquisar..."
            className="w-full pl-9 pr-3 py-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-sm outline-none transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <div className="inline-flex bg-[var(--surface-dim)] rounded-lg p-1">
            {SOURCE_OPTIONS.map(opt => (
              <button
                key={opt.v}
                onClick={() => setSourceFilter(opt.v)}
                className={`px-3 py-1.5 rounded-md transition-all ${SCALE.text.badge} ${
                  sourceFilter === opt.v ? 'bg-white text-[var(--navy)] shadow-sm' : 'text-[var(--ink-soft)] hover:text-[var(--ink)]'
                }`}
              >
                {opt.l}
              </button>
            ))}
          </div>
          <select
            className="flex-1 min-w-[140px] p-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-xs font-bold text-[var(--ink-mid)] outline-none"
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
