import React, { useState } from 'react';
import {
  BarChart2, Loader2, Search, X, ChevronDown, ChevronUp,
  Eye, ArrowUpDown, ArrowUp, ArrowDown,
} from 'lucide-react';
import { MESES, getAttrs, getNomeEntidade, getValorTotal, getIva, getDocNum, getObservacao } from './utils/tocUtils';
import { useTableFilters } from './hooks/useTableFilters';
import { useTocRelatorios } from './hooks/useTocRelatorios';
import ModalDocToc from './components/ModalDocToc';

const selectClass = "w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white";

export default function TOConlineRelatorios({ onDesligado }) {
  const [tipo, setTipo] = useState('vendas');
  const [dataDe, setDataDe] = useState(() => `${new Date().getFullYear()}-01-01`);
  const [dataAte, setDataAte] = useState(() => new Date().toISOString().slice(0, 10));
  const [itemDetalhe, setItemDetalhe] = useState(null);

  const { docs, loading, erro, temMais, carregar } = useTocRelatorios({ onDesligado });
  const {
    pesquisa, setPesquisa,
    filtroMes, setFiltroMes,
    filtroAno, setFiltroAno,
    filtroEntidade, setFiltroEntidade,
    mostrarFiltros, setMostrarFiltros,
    ordem, toggleOrdem,
    anosDisponiveis,
    entidadesDisponiveis,
    docsFiltrados,
    filtrosAtivos,
    limparFiltros,
  } = useTableFilters({ docs, tipo });

  const handleGerar = () => {
    limparFiltros();
    carregar({ tipo, dataDe, dataAte });
  };

  const totalValor = docsFiltrados.reduce((sum, d) => sum + (getValorTotal(getAttrs(d)) ?? 0), 0);
  const totalIva = docsFiltrados.reduce((sum, d) => sum + (getIva(getAttrs(d)) ?? 0), 0);

  const ThSort = ({ campo, label }) => (
    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 cursor-pointer select-none hover:text-slate-600 transition-colors"
      onClick={() => toggleOrdem(campo)}>
      <span className="flex items-center gap-1">
        {label}
        {ordem.campo !== campo
          ? <ArrowUpDown size={11} className="text-slate-300" />
          : ordem.dir === 'asc' ? <ArrowUp size={11} className="text-blue-500" /> : <ArrowDown size={11} className="text-blue-500" />
        }
      </span>
    </th>
  );

  return (
    <div className="space-y-5">
      {/* Controlos principais */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-4">
        <p className="text-xs font-black uppercase tracking-widest text-slate-400">Filtrar documentos</p>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tipo</p>
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
              {[
                { key: 'vendas', label: 'Vendas' },
                { key: 'compras', label: 'Compras' },
                { key: 'recibos', label: 'Recibos' },
              ].map(({ key, label }) => (
                <button key={key} onClick={() => { setTipo(key); }}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${tipo === key ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Data de</p>
            <input type="date" value={dataDe} onChange={e => setDataDe(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>

          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Data até</p>
            <input type="date" value={dataAte} onChange={e => setDataAte(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>

          <button onClick={handleGerar} disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition-all disabled:opacity-60 shadow-sm shadow-blue-100">
            {loading ? <Loader2 size={13} className="animate-spin" /> : <BarChart2 size={13} />}
            Carregar
          </button>
        </div>
      </div>

      {erro && (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-xs text-red-600 font-semibold">{erro}</div>
      )}

      {docs.length > 0 && (
        <>
          {/* Totais */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl border border-slate-100 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Documentos</p>
              <p className="text-2xl font-black text-slate-800">
                {docsFiltrados.length}
                {docsFiltrados.length !== docs.length && <span className="text-sm text-slate-400 font-semibold ml-1">/ {docs.length}</span>}
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Total</p>
              <p className="text-2xl font-black text-slate-800">{totalValor.toFixed(2)} €</p>
            </div>
            {totalIva > 0 && (
              <div className="bg-white rounded-2xl border border-slate-100 p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">IVA</p>
                <p className="text-2xl font-black text-slate-800">{totalIva.toFixed(2)} €</p>
              </div>
            )}
          </div>

          {/* Pesquisa + filtros */}
          <div className="space-y-3">
            <div className="flex gap-2 items-center">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={pesquisa} onChange={e => setPesquisa(e.target.value)}
                  placeholder={`Pesquisar por ${tipo === 'compras' ? 'fornecedor' : 'cliente'} ou nº documento...`}
                  className="w-full pl-9 pr-4 py-2.5 rounded-2xl border border-slate-200 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-300" />
                {pesquisa && (
                  <button onClick={() => setPesquisa('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <X size={13} />
                  </button>
                )}
              </div>
              <button onClick={() => setMostrarFiltros(v => !v)}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-2xl border text-xs font-black uppercase tracking-widest transition-all ${mostrarFiltros || filtrosAtivos ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-slate-200 text-slate-500 hover:text-blue-600 hover:border-blue-200'}`}>
                {mostrarFiltros ? <ChevronUp size={13} /> : <ChevronDown size={13} />} Filtros
                {filtrosAtivos && <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
              </button>
              {filtrosAtivos && (
                <button onClick={limparFiltros} className="flex items-center gap-1 px-3 py-2.5 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-red-500 transition-colors">
                  <X size={12} /> Limpar
                </button>
              )}
            </div>

            {mostrarFiltros && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ano</label>
                  <select value={filtroAno} onChange={e => setFiltroAno(e.target.value)} className={selectClass}>
                    <option value="">Todos</option>
                    {anosDisponiveis.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Mês</label>
                  <select value={filtroMes} onChange={e => setFiltroMes(e.target.value)} className={selectClass}>
                    <option value="">Todos</option>
                    {MESES.map(m => <option key={m.val} value={m.val}>{m.label}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    {tipo === 'compras' ? 'Fornecedor' : 'Cliente'}
                  </label>
                  <select value={filtroEntidade} onChange={e => setFiltroEntidade(e.target.value)} className={selectClass}>
                    <option value="">Todos</option>
                    {entidadesDisponiveis.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Tabela */}
          {docsFiltrados.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm font-semibold">
              Nenhum documento corresponde aos filtros.
              <button onClick={limparFiltros} className="ml-2 text-blue-500 hover:underline">Limpar filtros</button>
            </div>
          ) : (
            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Nº Doc.</th>
                      <ThSort campo="entidade" label={tipo === 'compras' ? 'Fornecedor' : 'Cliente'} />
                      <ThSort campo="date" label="Data" />
                      <ThSort campo="total" label="Total" />
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">IVA</th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Observação</th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {docsFiltrados.map((item, i) => {
                      const a = getAttrs(item);
                      const ent = getNomeEntidade(a, tipo);
                      const total = getValorTotal(a);
                      const iva = getIva(a);
                      const docNum = getDocNum(item, a);
                      const obs = getObservacao(a);
                      return (
                        <tr key={item.id ?? i}
                          className={`border-b border-slate-50 transition-colors cursor-pointer ${i % 2 === 0 ? 'hover:bg-slate-50' : 'bg-slate-50/40 hover:bg-slate-100/60'}`}
                          onClick={() => setItemDetalhe(item)}>
                          <td className="px-4 py-3 text-xs font-mono text-slate-600 whitespace-nowrap">{docNum}</td>
                          <td className="px-4 py-3 text-xs font-semibold text-slate-700 max-w-[180px] truncate">{ent || '—'}</td>
                          <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{a.date || '—'}</td>
                          <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">
                            {total != null ? Number(total).toFixed(2) + ' €' : '—'}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                            {iva != null ? Number(iva).toFixed(2) + ' €' : '—'}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500 max-w-[200px]">
                            {obs
                              ? <span className="truncate block" title={obs}>{obs}</span>
                              : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                            <button onClick={() => setItemDetalhe(item)}
                              className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors" title="Ver detalhes e descarregar PDF">
                              <Eye size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-3 text-xs text-slate-400 font-semibold border-t border-slate-50 flex items-center justify-between gap-2">
                <span>
                  {docsFiltrados.length !== docs.length
                    ? `${docsFiltrados.length} de ${docs.length} documento(s)`
                    : `${docs.length} documento(s)`}
                </span>
                {temMais && (
                  <span className="text-[10px] text-amber-500">Mostrando primeiros 50 resultados — afine as datas para ver mais.</span>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {!loading && docs.length === 0 && !erro && (
        <div className="text-center py-16 text-slate-400 text-sm font-semibold">
          Selecione o tipo e o período, depois clique em <span className="text-blue-500">Carregar</span>.
        </div>
      )}

      <ModalDocToc item={itemDetalhe} tipo={tipo} onClose={() => setItemDetalhe(null)} />
    </div>
  );
}
