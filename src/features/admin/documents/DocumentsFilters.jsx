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
      <div className="flex overflow-x-auto gap-1 mb-4 pb-0.5 bg-slate-100 p-1 rounded-2xl w-full">
        {[
          { key: 'all', label: 'Todos', icon: LayoutList, activeColor: 'text-slate-700' },
          { key: 'pending', label: 'Pendentes', icon: Clock, activeColor: 'text-amber-500' },
          { key: 'awaiting_admin', label: 'Aprovação', icon: FileSignature, activeColor: 'text-indigo-600' },
          { key: 'signed', label: 'Assinados', icon: CheckCircle, activeColor: 'text-emerald-600' },
        ].map(({ key, label, icon: Icon, activeColor }) => {
          const active = stateFilter === key;
          return (
            <button
              key={key}
              onClick={() => setStateFilter(key)}
              className={`flex-shrink-0 flex items-center justify-center gap-1 py-2 rounded-xl transition-all ${active ? 'bg-white shadow-sm' : 'hover:text-slate-600'}`}
            >
              <Icon size={13} className={active ? activeColor : 'text-slate-400'} />
              <span className={`text-[9px] font-black uppercase whitespace-nowrap ${active ? activeColor : 'text-slate-400'}`}>{label}</span>
              {counts[key] > 0 && <span className={`text-[9px] font-black tabular-nums ${active ? activeColor : 'text-slate-400'}`}>({counts[key]})</span>}
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

      {/* Filtro por categoria ACT */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {['Todas', ...CATEGORIAS_RH_ACT].map(c => {
          const val = c === 'Todas' ? '' : c;
          const active = (categoriaFilter || '') === val;
          return (
            <button
              key={c}
              onClick={() => setCategoriaFilter && setCategoriaFilter(val)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all ${
                active
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              {c}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-2 mb-5">
        <div className="flex gap-2 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              type="text"
              placeholder="Pesquisar..."
              className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button
            onClick={onShowUpload}
            className="p-2.5 bg-indigo-600 text-white rounded-xl flex items-center justify-center hover:bg-slate-900 transition-all shadow-md shadow-indigo-200 shrink-0"
            title="Upload Manual"
          >
            <Plus size={16} />
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
