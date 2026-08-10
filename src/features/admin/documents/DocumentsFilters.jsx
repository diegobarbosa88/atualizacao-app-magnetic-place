import React from 'react';
import { LayoutList, Clock, FileSignature, CheckCircle, Search, Plus, AlertTriangle } from 'lucide-react';
import { CATEGORIAS_RH_ACT } from '../../../constants/rhCategories';

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
  return (
    <>
      {/* Tabs de estado — sublinhado laranja */}
      <div className="flex overflow-x-auto gap-0 mb-4 border-b border-slate-100">
        {[
          { key: 'all', label: 'Todos', icon: LayoutList },
          { key: 'pending', label: 'Pendentes', icon: Clock },
          { key: 'awaiting_admin', label: 'Aprovação', icon: FileSignature },
          { key: 'signed', label: 'Assinados', icon: CheckCircle },
        ].map(({ key, label, icon: Icon }) => {
          const active = stateFilter === key;
          return (
            <button
              key={key}
              onClick={() => setStateFilter(key)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 pb-2.5 pt-1 text-[10px] font-black uppercase tracking-wider transition-all border-b-2 -mb-px whitespace-nowrap ${active ? 'border-[#EB8D00] text-[#1B3A57]' : 'border-transparent text-slate-400 hover:text-[#1B3A57]'}`}
            >
              <Icon size={12} /> {label}
              {counts[key] > 0 && <span className="tabular-nums">({counts[key]})</span>}
            </button>
          );
        })}
      </div>

      {/* Filtro rápido "A Expirar" */}
      <div className="mb-3">
        <button
          onClick={() => setValidadeFilter && setValidadeFilter(validadeFilter === 'expiring' ? '' : 'expiring')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wide transition-all border ${
            validadeFilter === 'expiring'
              ? 'bg-red-600 text-white border-red-600 shadow-sm shadow-red-200'
              : 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
          }`}
        >
          <AlertTriangle size={11} /> A Expirar / Expirados
        </button>
      </div>

      {/* Filtro por categoria — dropdown */}
      <div className="mb-4">
        <select
          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none"
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
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              type="text"
              placeholder="Pesquisar..."
              className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button
            onClick={onShowUpload}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-black text-xs uppercase transition-all shadow-md shrink-0 whitespace-nowrap"
            style={{ backgroundColor: '#EB8D00', color: '#1B3A57' }}
            title="Adicionar documento"
          >
            <Plus size={16} /> Adicionar
          </button>
        </div>
        <div className="flex gap-2">
          <select
            className="flex-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none"
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
          >
            <option value="all">Todas as fontes</option>
            <option value="manual">Manual</option>
            <option value="template">Template</option>
          </select>
          <select
            className="flex-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none"
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
