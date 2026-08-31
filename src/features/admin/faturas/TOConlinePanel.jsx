import React, { useState, useEffect } from 'react';
import {
  ChevronDown, ChevronUp, Link2, Link2Off, Loader2,
  Search, X, Eye, ArrowUpDown, ArrowUp, ArrowDown, RefreshCw,
} from 'lucide-react';
import { authFetch } from '../../../utils/authFetch';
import { FT, SCALE } from '../../../styles/designTokens';
import { useApp } from '../../../context/AppContext';
import { MESES, getAttrs, getNomeEntidade, getValorTotal, getIva, getDocNum } from '../toconline/utils/tocUtils';
import { useTableFilters } from '../toconline/hooks/useTableFilters';
import { useTocRelatorios } from '../toconline/hooks/useTocRelatorios';
import ModalDocToc from '../toconline/components/ModalDocToc';

const selectClass = "w-full px-3 py-2 rounded-xl border border-[var(--border)] text-xs text-[var(--ink-mid)] focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white";

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
      const res = await authFetch('/api/toconline/auth-init');
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
    <th className={`px-4 py-3 ${SCALE.text.statLabel} text-[var(--slate-dim)] cursor-pointer select-none hover:text-[var(--ink-soft)] transition-colors`}
      onClick={() => toggleOrdemRel(campo)}>
      <span className="flex items-center gap-1">
        {label}
        {ordemRel.campo !== campo
          ? <ArrowUpDown size={11} className="text-[var(--slate)]" />
          : ordemRel.dir === 'asc' ? <ArrowUp size={11} className="text-blue-500" /> : <ArrowDown size={11} className="text-blue-500" />
        }
      </span>
    </th>
  );

  return (
    <div className="bg-white rounded-[2rem] border border-[var(--border-soft)] shadow-sm p-5 space-y-4">
      {/* Header de conexão */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${ligado ? 'bg-emerald-500' : 'bg-[var(--slate)]'}`} />
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-[var(--slate-dim)] mb-0.5">TOConline</p>
            <p className="text-xs text-[var(--slate-dim)]">{ligado ? 'Ligado — pronto a usar' : 'Não ligado'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {ligado ? (
            <button onClick={handleDesligar}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-black uppercase tracking-widest text-[var(--slate-dim)] hover:text-red-500 transition-colors">
              <Link2Off size={13} /> Desligar
            </button>
          ) : (
            <button onClick={handleLigar} disabled={ligando}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all disabled:opacity-60 text-[var(--navy-solid)] hover:opacity-90"
              style={{ backgroundColor: FT.orange }}>
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
        <div className="border-t border-[var(--border-soft)] pt-4 space-y-4">
          <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:items-end">
            <div className="flex gap-1 bg-[var(--surface-dim)] p-1 rounded-2xl w-full sm:w-auto overflow-x-auto">
              {[
                { key: 'vendas', label: 'Vendas' },
                { key: 'compras', label: 'Compras' },
                { key: 'recibos', label: 'Recibos' },
              ].map(({ key, label }) => (
                <button key={key} onClick={() => setTipoRel(key)}
                  className={`flex-1 sm:flex-none px-3 py-1.5 rounded-xl ${SCALE.text.badge} transition-all whitespace-nowrap`}
                  style={tipoRel === key ? { backgroundColor: 'rgba(235,141,0,0.15)', color: 'var(--navy)' } : { color: 'var(--ink-soft)' }}>
                  {label}
                </button>
              ))}
            </div>
            <div className="flex gap-2 w-full sm:w-auto sm:flex-1 sm:min-w-0">
              <div className="space-y-0.5 flex-1 min-w-0">
                <p className={`${SCALE.text.statLabel} text-[var(--slate-dim)]`}>De</p>
                <input type="date" value={dataDeRel} onChange={e => setDataDeRel(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--border)] text-xs text-[var(--ink-mid)] focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
              <div className="space-y-0.5 flex-1 min-w-0">
                <p className={`${SCALE.text.statLabel} text-[var(--slate-dim)]`}>Até</p>
                <input type="date" value={dataAteRel} onChange={e => setDataAteRel(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--border)] text-xs text-[var(--ink-mid)] focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
            </div>
            <button onClick={handleCarregarRelatorio} disabled={carregandoRel}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all disabled:opacity-60 w-full sm:w-auto sm:self-end text-[var(--navy-solid)] hover:opacity-90"
              style={{ backgroundColor: FT.orange }}>
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
                    <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--slate)]" />
                    <input value={pesquisaRel} onChange={e => setPesquisaRel(e.target.value)}
                      placeholder="Pesquisar por entidade ou nº documento..."
                      className="w-full pl-9 pr-4 py-2.5 rounded-2xl border border-[var(--border)] text-sm text-[var(--ink-mid)] placeholder-[var(--slate)] focus:outline-none focus:ring-2 focus:ring-blue-300" />
                    {pesquisaRel && <button onClick={() => setPesquisaRel('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--slate)] hover:text-[var(--ink-soft)]"><X size={13} /></button>}
                  </div>
                  <button onClick={() => setMostrarFiltrosRel(v => !v)}
                    className={`flex items-center gap-1.5 px-4 py-2.5 rounded-2xl border text-xs font-black uppercase tracking-widest transition-all ${mostrarFiltrosRel || filtrosRelAtivos ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-[var(--border)] text-[var(--slate-dim)] hover:text-blue-600 hover:border-blue-200'}`}>
                    {mostrarFiltrosRel ? <ChevronUp size={13} /> : <ChevronDown size={13} />} Filtros
                    {filtrosRelAtivos && <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                  </button>
                  {filtrosRelAtivos && (
                    <button onClick={limparFiltrosRel} className="flex items-center gap-1 px-3 py-2.5 text-xs font-black uppercase tracking-widest text-[var(--slate-dim)] hover:text-red-500 transition-colors">
                      <X size={12} /> Limpar
                    </button>
                  )}
                </div>
                {mostrarFiltrosRel && (
                  <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border-soft)] p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className={`${SCALE.text.statLabel} text-[var(--slate-dim)]`}>Ano</label>
                      <select value={filtroAnoRel} onChange={e => setFiltroAnoRel(e.target.value)} className={selectClass}>
                        <option value="">Todos</option>
                        {anosDisponiveisRel.map(a => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className={`${SCALE.text.statLabel} text-[var(--slate-dim)]`}>Mês</label>
                      <select value={filtroMesRel} onChange={e => setFiltroMesRel(e.target.value)} className={selectClass}>
                        <option value="">Todos</option>
                        {MESES.map(m => <option key={m.val} value={m.val}>{m.label}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className={`${SCALE.text.statLabel} text-[var(--slate-dim)]`}>{tipoRel === 'compras' ? 'Fornecedor' : 'Cliente'}</label>
                      <select value={filtroEntidadeRel} onChange={e => setFiltroEntidadeRel(e.target.value)} className={selectClass}>
                        <option value="">Todos</option>
                        {entidadesDisponiveisRel.map(e => <option key={e} value={e}>{e}</option>)}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-white rounded-[2rem] border border-[var(--border-soft)] shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[var(--border-soft)] bg-[var(--surface)]">
                        <th className={`px-4 py-3 ${SCALE.text.statLabel} text-[var(--slate-dim)]`}>Nº Doc</th>
                        <ThSortRel campo="entidade" label={tipoRel === 'compras' ? 'Fornecedor' : 'Cliente'} />
                        <ThSortRel campo="date" label="Data" />
                        <ThSortRel campo="total" label="Total" />
                        <th className={`px-4 py-3 ${SCALE.text.statLabel} text-[var(--slate-dim)]`}>IVA</th>
                        <th className={`px-4 py-3 ${SCALE.text.statLabel} text-[var(--slate-dim)]`}>Ações</th>
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
                            className={`border-b border-[var(--border-soft)] transition-colors cursor-pointer ${i % 2 === 0 ? 'hover:bg-[var(--surface)]' : 'bg-[var(--surface)] hover:bg-[var(--surface-dim)]'}`}
                            onClick={() => setDocDetalhe(doc)}>
                            <td className="px-4 py-3 text-xs font-mono text-[var(--ink-soft)] whitespace-nowrap">{getDocNum(doc, a) || `#${doc.id}`}</td>
                            <td className="px-4 py-3 text-xs text-[var(--ink-mid)] max-w-[160px] truncate">{entidade || '—'}</td>
                            <td className="px-4 py-3 text-xs text-[var(--slate-dim)] whitespace-nowrap">{a.date || '—'}</td>
                            <td className="px-4 py-3 text-xs font-semibold text-[var(--ink-mid)] whitespace-nowrap">
                              {total != null ? Number(total).toFixed(2) + ' €' : '—'}
                            </td>
                            <td className="px-4 py-3 text-xs text-[var(--slate-dim)] whitespace-nowrap">
                              {iva != null ? Number(iva).toFixed(2) + ' €' : '—'}
                            </td>
                            <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                              <button onClick={() => setDocDetalhe(doc)}
                                className="p-1.5 text-[var(--slate)] hover:text-blue-600 transition-colors" title="Ver detalhes e descarregar PDF">
                                <Eye size={14} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="px-4 py-3 text-xs text-[var(--slate-dim)] font-semibold border-t border-[var(--border-soft)] flex items-center justify-between gap-2 flex-wrap">
                  <span>
                    {docsFiltrados.length !== docsRel.length
                      ? `${docsFiltrados.length} de ${docsRel.length} documento(s)`
                      : `${docsRel.length} documento(s)`}
                    {temMais && docsRel.length === docsFiltrados.length && ' · pode haver mais'}
                  </span>
                  {temMais && (
                    <span className={`${SCALE.text.meta} text-[var(--slate-dim)]`}>Mostrando os primeiros 50 resultados — afine as datas para reduzir.</span>
                  )}
                </div>
              </div>
            </>
          )}

          {!carregandoRel && docsRel.length === 0 && !erroRel && (
            <div className="text-center py-10 text-[var(--slate-dim)] text-sm font-semibold">
              Selecione o tipo e o período, depois clique em <span className="text-blue-500">Carregar</span>.
            </div>
          )}
        </div>
      )}

      <ModalDocToc item={docDetalhe} tipo={tipoRel} onClose={() => setDocDetalhe(null)} />
    </div>
  );
}
