import React, { useState, useEffect } from 'react';
import {
  ChevronDown, ChevronUp, Link2, Link2Off, Loader2,
  Search, X, Eye, ArrowUpDown, ArrowUp, ArrowDown, RefreshCw,
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { MESES, getAttrs, getNomeEntidade, getValorTotal, getIva, getDocNum } from '../toconline/utils/tocUtils';
import { useTableFilters } from '../toconline/hooks/useTableFilters';
import { useTocRelatorios } from '../toconline/hooks/useTocRelatorios';
import ModalDocToc from '../toconline/components/ModalDocToc';

const selectClass = "w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white";

export default function TOConlinePanel() {
  const { supabase } = useApp();
  const [ligado, setLigado] = useState(false);
  const [ligando, setLigando] = useState(false);
  const [erroAuth, setErroAuth] = useState(null);
  const connectedFromCallback = React.useRef(false);

  // Relatórios state
  const [tipoRel, setTipoRel] = useState('vendas');
  const [dataDeRel, setDataDeRel] = useState(() => `${new Date().getFullYear()}-01-01`);
  const [dataAteRel, setDataAteRel] = useState(() => new Date().toISOString().slice(0, 10));
  const [docDetalhe, setDocDetalhe] = useState(null);

  const { docs: docsRel, loading: carregandoRel, erro: erroRel, temMais, carregar: carregarRelatorio } = useTocRelatorios();
  const {
    pesquisa: pesquisaRel, setPesquisa: setPesquisaRel,
    filtroMes: filtroMesRel, setFiltroMes: setFiltroMesRel,
    filtroAno: filtroAnoRel, setFiltroAno: setFiltroAnoRel,
    filtroEntidade: filtroEntidadeRel, setFiltroEntidade: setFiltroEntidadeRel,
    mostrarFiltros: mostrarFiltrosRel, setMostrarFiltros: setMostrarFiltrosRel,
    ordem: ordemRel, toggleOrdem: toggleOrdemRel,
    anosDisponiveis: anosDisponiveisRel,
    entidadesDisponiveis: entidadesDisponiveisRel,
    docsFiltrados,
    filtrosAtivos: filtrosRelAtivos,
    limparFiltros: limparFiltrosRel,
  } = useTableFilters({ docs: docsRel, tipo: tipoRel });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get('toconline_connected');
    const errorParam = params.get('toconline_error');
    if (connected || errorParam) {
      window.history.replaceState({}, '', window.location.pathname);
    }
    if (connected) {
      connectedFromCallback.current = true;
      setLigado(true);
      return;
    }
    if (errorParam) {
      setErroAuth(decodeURIComponent(errorParam));
    }
  }, []);

  useEffect(() => {
    if (!supabase) return;
    if (connectedFromCallback.current) return;
    supabase
      .from('system_settings')
      .select('toconline_access_token')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data }) => setLigado(!!data?.toconline_access_token));
  }, [supabase]);

  const handleLigar = async () => {
    setLigando(true);
    setErroAuth(null);
    try {
      const res = await fetch('/api/toconline/auth-init');
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (!data.authUrl) throw new Error(`Resposta inválida: ${JSON.stringify(data)}`);
      window.location.href = data.authUrl;
    } catch (e) {
      setErroAuth(e.message);
      setLigando(false);
    }
  };

  const handleDesligar = async () => {
    if (!confirm('Desligar o TOConline? Os documentos já importados ficam guardados.')) return;
    await supabase.from('system_settings').update({
      toconline_access_token: null,
      toconline_refresh_token: null,
      toconline_token_expires_at: null,
    }).eq('id', 1);
    setLigado(false);
  };

  const handleCarregarRelatorio = () => {
    carregarRelatorio({ tipo: tipoRel, dataDe: dataDeRel, dataAte: dataAteRel });
  };

  const ThSortRel = ({ campo, label }) => (
    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 cursor-pointer select-none hover:text-slate-600 transition-colors"
      onClick={() => toggleOrdemRel(campo)}>
      <span className="flex items-center gap-1">
        {label}
        {ordemRel.campo !== campo
          ? <ArrowUpDown size={11} className="text-slate-300" />
          : ordemRel.dir === 'asc' ? <ArrowUp size={11} className="text-blue-500" /> : <ArrowDown size={11} className="text-blue-500" />
        }
      </span>
    </th>
  );

  return (
    <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-5 space-y-4">
      {/* Header de conexão */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${ligado ? 'bg-emerald-500' : 'bg-slate-300'}`} />
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-0.5">TOConline</p>
            <p className="text-xs text-slate-500">{ligado ? 'Ligado — pronto a usar' : 'Não ligado'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {ligado ? (
            <button onClick={handleDesligar}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-red-500 transition-colors">
              <Link2Off size={13} /> Desligar
            </button>
          ) : (
            <button onClick={handleLigar} disabled={ligando}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition-all disabled:opacity-60">
              {ligando ? <Loader2 size={13} className="animate-spin" /> : <Link2 size={13} />}
              Ligar TOConline
            </button>
          )}
        </div>
      </div>

      {erroAuth && (
        <div className="bg-red-50 border border-red-100 text-red-700 px-4 py-3 rounded-2xl text-xs font-semibold">
          Erro ao ligar: {erroAuth}
        </div>
      )}

      {/* ── Relatórios ── */}
      {ligado && (
        <div className="border-t border-slate-100 pt-4 space-y-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl">
              {[
                { key: 'vendas', label: 'Vendas' },
                { key: 'compras', label: 'Compras' },
                { key: 'recibos', label: 'Recibos' },
              ].map(({ key, label }) => (
                <button key={key} onClick={() => setTipoRel(key)}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${tipoRel === key ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                  {label}
                </button>
              ))}
            </div>
            <div className="flex gap-2 flex-1 min-w-0">
              <div className="space-y-0.5 flex-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">De</p>
                <input type="date" value={dataDeRel} onChange={e => setDataDeRel(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
              <div className="space-y-0.5 flex-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Até</p>
                <input type="date" value={dataAteRel} onChange={e => setDataAteRel(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
            </div>
            <button onClick={handleCarregarRelatorio} disabled={carregandoRel}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-md shadow-blue-100 disabled:opacity-60 self-end">
              {carregandoRel ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              Carregar
            </button>
          </div>

          {erroRel && (
            <div className="bg-red-50 text-red-700 px-4 py-3 rounded-2xl text-xs font-semibold">Erro: {erroRel}</div>
          )}

          {docsRel.length > 0 && (
            <>
              <div className="space-y-3">
                <div className="flex gap-2 items-center">
                  <div className="relative flex-1">
                    <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input value={pesquisaRel} onChange={e => setPesquisaRel(e.target.value)}
                      placeholder="Pesquisar por entidade ou nº documento..."
                      className="w-full pl-9 pr-4 py-2.5 rounded-2xl border border-slate-200 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-300" />
                    {pesquisaRel && <button onClick={() => setPesquisaRel('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X size={13} /></button>}
                  </div>
                  <button onClick={() => setMostrarFiltrosRel(v => !v)}
                    className={`flex items-center gap-1.5 px-4 py-2.5 rounded-2xl border text-xs font-black uppercase tracking-widest transition-all ${mostrarFiltrosRel || filtrosRelAtivos ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-slate-200 text-slate-500 hover:text-blue-600 hover:border-blue-200'}`}>
                    {mostrarFiltrosRel ? <ChevronUp size={13} /> : <ChevronDown size={13} />} Filtros
                    {filtrosRelAtivos && <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                  </button>
                  {filtrosRelAtivos && (
                    <button onClick={limparFiltrosRel} className="flex items-center gap-1 px-3 py-2.5 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-red-500 transition-colors">
                      <X size={12} /> Limpar
                    </button>
                  )}
                </div>
                {mostrarFiltrosRel && (
                  <div className="bg-slate-50 rounded-2xl border border-slate-100 p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ano</label>
                      <select value={filtroAnoRel} onChange={e => setFiltroAnoRel(e.target.value)} className={selectClass}>
                        <option value="">Todos</option>
                        {anosDisponiveisRel.map(a => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Mês</label>
                      <select value={filtroMesRel} onChange={e => setFiltroMesRel(e.target.value)} className={selectClass}>
                        <option value="">Todos</option>
                        {MESES.map(m => <option key={m.val} value={m.val}>{m.label}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{tipoRel === 'compras' ? 'Fornecedor' : 'Cliente'}</label>
                      <select value={filtroEntidadeRel} onChange={e => setFiltroEntidadeRel(e.target.value)} className={selectClass}>
                        <option value="">Todos</option>
                        {entidadesDisponiveisRel.map(e => <option key={e} value={e}>{e}</option>)}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50">
                        <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Nº Doc</th>
                        <ThSortRel campo="entidade" label={tipoRel === 'compras' ? 'Fornecedor' : 'Cliente'} />
                        <ThSortRel campo="date" label="Data" />
                        <ThSortRel campo="total" label="Total" />
                        <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">IVA</th>
                        <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {docsFiltrados.map((doc, i) => {
                        const a = getAttrs(doc);
                        const entidade = getNomeEntidade(a, tipoRel);
                        const total = getValorTotal(a);
                        const iva = getIva(a);
                        return (
                          <tr key={doc.id}
                            className={`border-b border-slate-50 transition-colors cursor-pointer ${i % 2 === 0 ? 'hover:bg-slate-50' : 'bg-slate-50/40 hover:bg-slate-100/60'}`}
                            onClick={() => setDocDetalhe(doc)}>
                            <td className="px-4 py-3 text-xs font-mono text-slate-600 whitespace-nowrap">{getDocNum(doc, a) || `#${doc.id}`}</td>
                            <td className="px-4 py-3 text-xs text-slate-700 max-w-[160px] truncate">{entidade || '—'}</td>
                            <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{a.date || '—'}</td>
                            <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">
                              {total != null ? Number(total).toFixed(2) + ' €' : '—'}
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                              {iva != null ? Number(iva).toFixed(2) + ' €' : '—'}
                            </td>
                            <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                              <button onClick={() => setDocDetalhe(doc)}
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
                <div className="px-4 py-3 text-xs text-slate-400 font-semibold border-t border-slate-50 flex items-center justify-between gap-2 flex-wrap">
                  <span>
                    {docsFiltrados.length !== docsRel.length
                      ? `${docsFiltrados.length} de ${docsRel.length} documento(s)`
                      : `${docsRel.length} documento(s)`}
                    {temMais && docsRel.length === docsFiltrados.length && ' · pode haver mais'}
                  </span>
                  {temMais && (
                    <span className="text-[10px] text-slate-400">Mostrando os primeiros 50 resultados — afine as datas para reduzir.</span>
                  )}
                </div>
              </div>
            </>
          )}

          {!carregandoRel && docsRel.length === 0 && !erroRel && (
            <div className="text-center py-10 text-slate-400 text-sm font-semibold">
              Selecione o tipo e o período, depois clique em <span className="text-blue-500">Carregar</span>.
            </div>
          )}
        </div>
      )}

      <ModalDocToc item={docDetalhe} tipo={tipoRel} onClose={() => setDocDetalhe(null)} />
    </div>
  );
}
