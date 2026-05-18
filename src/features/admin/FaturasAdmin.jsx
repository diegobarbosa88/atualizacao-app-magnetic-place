import React, { useState, useEffect, useMemo } from 'react';
import { FileText, Download, Loader2, RefreshCw, ExternalLink, Trash2, Search, Save, ChevronDown, ChevronUp, X, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

const DEFAULT_QUERY = 'is:unread has:attachment {subject:fatura subject:invoice subject:FT}';
const STORAGE_KEY = 'faturas_gmail_query';

export default function FaturasAdmin() {
  const { supabase } = useApp();
  const [faturas, setFaturas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [apagando, setApagando] = useState(false);
  const [selecionados, setSelecionados] = useState(new Set());

  const [query, setQuery] = useState(() => localStorage.getItem(STORAGE_KEY) || DEFAULT_QUERY);
  const [queryEditando, setQueryEditando] = useState(query);
  const [mostrarConfig, setMostrarConfig] = useState(false);
  const [importando, setImportando] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [extraindo, setExtraindo] = useState(false);

  // Filtros
  const [pesquisa, setPesquisa] = useState('');
  const [filtroDataDe, setFiltroDataDe] = useState('');
  const [filtroDataAte, setFiltroDataAte] = useState('');
  const [filtroValorMin, setFiltroValorMin] = useState('');
  const [filtroValorMax, setFiltroValorMax] = useState('');
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [ordem, setOrdem] = useState({ campo: 'importado_em', dir: 'desc' });

  const guardarQuery = () => {
    const q = queryEditando.trim() || DEFAULT_QUERY;
    setQuery(q); setQueryEditando(q);
    localStorage.setItem(STORAGE_KEY, q);
    setMostrarConfig(false);
  };

  const carregar = async () => {
    setLoading(true); setErro(null);
    try {
      const { data, error } = await supabase
        .from('faturas').select('*').order('importado_em', { ascending: false });
      if (error) throw error;
      setFaturas(data || []);
      setSelecionados(new Set());
    } catch (e) { setErro(e.message); }
    finally { setLoading(false); }
  };

  const extrairTextoPDF = async (url) => {
    const resp = await fetch(url);
    const buffer = await resp.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    let texto = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      texto += content.items.map(it => it.str).join(' ') + '\n';
    }
    return texto;
  };

  const parsearComGemini = async (texto) => {
    const res = await fetch('/api/parse-fatura', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texto }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.raw) return null;
    return data;
  };

  const processarSemDados = async (lista) => {
    const semDados = lista.filter(f => !f.dados && f.mime_type === 'application/pdf');
    if (!semDados.length) return;
    setExtraindo(true);
    for (const f of semDados) {
      try {
        const texto = await extrairTextoPDF(f.url);
        const dados = await parsearComGemini(texto);
        if (dados) {
          await supabase.from('faturas').update({ dados }).eq('id', f.id);
          setFaturas(prev => prev.map(x => x.id === f.id ? { ...x, dados } : x));
        }
      } catch { /* falhou silenciosamente */ }
    }
    setExtraindo(false);
  };

  const handleImportar = async () => {
    setImportando(true); setImportResult(null);
    try {
      const res = await fetch('/api/gmail/import-faturas', {
        method: 'POST',
        headers: { 'x-import-secret': import.meta.env.VITE_GMAIL_IMPORT_SECRET || '', 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      setImportResult(data);
      if (!data.error) {
        const { data: novas } = await supabase.from('faturas').select('*').order('importado_em', { ascending: false });
        setFaturas(novas || []);
        setSelecionados(new Set());
        await processarSemDados(novas || []);
      }
    } catch (e) { setImportResult({ error: e.message }); }
    finally { setImportando(false); }
  };

  useEffect(() => { carregar(); }, []);

  // --- Filtros + ordenação (client-side) ---
  const faturasFiltradas = useMemo(() => {
    let lista = [...faturas];
    const q = pesquisa.toLowerCase().trim();

    if (q) {
      lista = lista.filter(f => {
        const d = f.dados || {};
        return (
          f.filename?.toLowerCase().includes(q) ||
          d.fornecedor?.toLowerCase().includes(q) ||
          d.numero_fatura?.toLowerCase().includes(q)
        );
      });
    }

    if (filtroDataDe) {
      lista = lista.filter(f => {
        const data = (f.dados?.data_fatura || f.importado_em || '').slice(0, 10);
        return data >= filtroDataDe;
      });
    }
    if (filtroDataAte) {
      lista = lista.filter(f => {
        const data = (f.dados?.data_fatura || f.importado_em || '').slice(0, 10);
        return data <= filtroDataAte;
      });
    }
    if (filtroValorMin !== '') {
      lista = lista.filter(f => (f.dados?.valor_total ?? 0) >= parseFloat(filtroValorMin));
    }
    if (filtroValorMax !== '') {
      lista = lista.filter(f => (f.dados?.valor_total ?? 0) <= parseFloat(filtroValorMax));
    }

    lista.sort((a, b) => {
      let va, vb;
      if (ordem.campo === 'fornecedor') { va = a.dados?.fornecedor || ''; vb = b.dados?.fornecedor || ''; }
      else if (ordem.campo === 'data_fatura') { va = a.dados?.data_fatura || ''; vb = b.dados?.data_fatura || ''; }
      else if (ordem.campo === 'valor_total') { va = a.dados?.valor_total ?? -1; vb = b.dados?.valor_total ?? -1; }
      else if (ordem.campo === 'numero_fatura') { va = a.dados?.numero_fatura || ''; vb = b.dados?.numero_fatura || ''; }
      else { va = a.importado_em || ''; vb = b.importado_em || ''; }
      if (va < vb) return ordem.dir === 'asc' ? -1 : 1;
      if (va > vb) return ordem.dir === 'asc' ? 1 : -1;
      return 0;
    });

    return lista;
  }, [faturas, pesquisa, filtroDataDe, filtroDataAte, filtroValorMin, filtroValorMax, ordem]);

  const toggleOrdem = (campo) => setOrdem(prev =>
    prev.campo === campo ? { campo, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { campo, dir: 'asc' }
  );

  const IconeOrdem = ({ campo }) => {
    if (ordem.campo !== campo) return <ArrowUpDown size={11} className="text-slate-300" />;
    return ordem.dir === 'asc' ? <ArrowUp size={11} className="text-indigo-500" /> : <ArrowDown size={11} className="text-indigo-500" />;
  };

  const filtrosAtivos = pesquisa || filtroDataDe || filtroDataAte || filtroValorMin !== '' || filtroValorMax !== '';

  const limparFiltros = () => {
    setPesquisa(''); setFiltroDataDe(''); setFiltroDataAte('');
    setFiltroValorMin(''); setFiltroValorMax('');
  };

  const toggleSel = (id) => setSelecionados(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const toggleTodos = () => {
    if (selecionados.size === faturasFiltradas.length) setSelecionados(new Set());
    else setSelecionados(new Set(faturasFiltradas.map(f => f.id)));
  };

  const apagarFaturas = async (ids) => {
    const alvo = faturas.filter(f => ids.includes(f.id));
    setApagando(true);
    try {
      const paths = alvo.map(f => f.storage_path);
      if (paths.length) await supabase.storage.from('faturas').remove(paths);
      const { error } = await supabase.from('faturas').delete().in('id', ids);
      if (error) throw error;
      setFaturas(prev => prev.filter(f => !ids.includes(f.id)));
      setSelecionados(new Set());
    } catch (e) {
      alert(`Erro ao apagar: ${e.message}`);
    } finally { setApagando(false); }
  };

  const handleApagarUm = (f) => {
    if (!confirm(`Apagar "${f.filename}"?`)) return;
    apagarFaturas([f.id]);
  };

  const handleApagarSelecionados = () => {
    if (!selecionados.size) return;
    if (!confirm(`Apagar ${selecionados.size} fatura(s) selecionada(s)?`)) return;
    apagarFaturas([...selecionados]);
  };

  const formatDate = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const todosSelec = faturasFiltradas.length > 0 && faturasFiltradas.every(f => selecionados.has(f.id));
  const algunsSelec = faturasFiltradas.some(f => selecionados.has(f.id)) && !todosSelec;

  const ThSort = ({ campo, label }) => (
    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 cursor-pointer select-none hover:text-slate-600 transition-colors"
      onClick={() => toggleOrdem(campo)}>
      <span className="flex items-center gap-1">{label}<IconeOrdem campo={campo} /></span>
    </th>
  );

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">

      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl sm:text-2xl font-black flex items-center gap-2">
          <FileText size={22} className="text-emerald-600" />
          Faturas Importadas
        </h2>
        <button onClick={carregar} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-all disabled:opacity-50">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Atualizar
        </button>
      </div>

      {/* Painel importação + config Gmail */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">Pesquisa Gmail activa</p>
            <p className="text-sm font-mono text-slate-600 break-all">{query}</p>
          </div>
          <button onClick={() => { setMostrarConfig(v => !v); setQueryEditando(query); }}
            className="flex items-center gap-1 px-3 py-2 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-indigo-600 transition-colors shrink-0">
            {mostrarConfig ? <ChevronUp size={14} /> : <ChevronDown size={14} />} Editar
          </button>
        </div>

        {mostrarConfig && (
          <div className="border-t border-slate-100 pt-4 space-y-3">
            <p className="text-xs text-slate-400 font-semibold">
              Sintaxe de pesquisa do Gmail. Ex: <span className="font-mono">subject:fatura</span>, <span className="font-mono">from:empresa@pt</span>, <span className="font-mono">is:unread</span>.
            </p>
            <textarea value={queryEditando} onChange={e => setQueryEditando(e.target.value)} rows={3}
              className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-sm font-mono text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
              placeholder="is:unread has:attachment {subject:fatura subject:invoice}" />
            <div className="flex items-center gap-2 justify-end">
              <button onClick={() => setQueryEditando(DEFAULT_QUERY)}
                className="px-3 py-2 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors">
                Repor padrão
              </button>
              <button onClick={guardarQuery}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all">
                <Save size={13} /> Guardar
              </button>
            </div>
          </div>
        )}

        <div className="border-t border-slate-100 pt-4 flex items-center gap-3 flex-wrap">
          <button onClick={handleImportar} disabled={importando}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-md shadow-emerald-100 disabled:opacity-60">
            {importando ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            Importar do Gmail
          </button>
          {importResult && (
            <span className={`text-xs font-semibold ${importResult.error ? 'text-red-600' : 'text-emerald-700'}`}>
              {importResult.error
                ? `Erro: ${importResult.error}`
                : `${importResult.processados} email(s) · ${importResult.ficheiros} ficheiro(s)${importResult.erros?.length ? ` · ${importResult.erros.length} erro(s)` : ''}`}
            </span>
          )}
        </div>
      </div>

      {erro && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-2xl text-sm font-semibold">Erro: {erro}</div>}

      {/* Barra de pesquisa + filtros */}
      <div className="space-y-3">
        <div className="flex gap-2 items-center">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={pesquisa} onChange={e => setPesquisa(e.target.value)}
              placeholder="Pesquisar por ficheiro, fornecedor ou nº fatura..."
              className="w-full pl-9 pr-4 py-2.5 rounded-2xl border border-slate-200 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            {pesquisa && (
              <button onClick={() => setPesquisa('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X size={13} />
              </button>
            )}
          </div>
          <button onClick={() => setMostrarFiltros(v => !v)}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-2xl border text-xs font-black uppercase tracking-widest transition-all ${mostrarFiltros || (filtrosAtivos && !pesquisa) ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-200'}`}>
            {mostrarFiltros ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            Filtros
            {filtrosAtivos && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />}
          </button>
          {filtrosAtivos && (
            <button onClick={limparFiltros}
              className="flex items-center gap-1 px-3 py-2.5 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-red-500 transition-colors">
              <X size={12} /> Limpar
            </button>
          )}
        </div>

        {mostrarFiltros && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Data de</label>
              <input type="date" value={filtroDataDe} onChange={e => setFiltroDataDe(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Data até</label>
              <input type="date" value={filtroDataAte} onChange={e => setFiltroDataAte(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Valor mín (€)</label>
              <input type="number" min="0" step="0.01" value={filtroValorMin} onChange={e => setFiltroValorMin(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Valor máx (€)</label>
              <input type="number" min="0" step="0.01" value={filtroValorMax} onChange={e => setFiltroValorMax(e.target.value)}
                placeholder="9999.00"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
          </div>
        )}
      </div>

      {/* Barra de acções em lote */}
      {selecionados.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-100 rounded-2xl">
          <span className="text-xs font-black text-red-700 uppercase tracking-widest">
            {selecionados.size} selecionada(s)
          </span>
          <button onClick={handleApagarSelecionados} disabled={apagando}
            className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-700 transition-all disabled:opacity-50">
            {apagando ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
            Apagar selecionadas
          </button>
          <button onClick={() => setSelecionados(new Set())}
            className="text-xs font-black uppercase tracking-widest text-red-400 hover:text-red-600 transition-colors">
            Cancelar
          </button>
        </div>
      )}

      {/* Tabela */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={32} className="animate-spin text-slate-300" /></div>
      ) : faturas.length === 0 ? (
        <div className="text-center py-16 text-slate-400 text-sm font-semibold">Nenhuma fatura importada ainda.</div>
      ) : faturasFiltradas.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm font-semibold">
          Nenhuma fatura corresponde aos filtros.
          <button onClick={limparFiltros} className="ml-2 text-indigo-500 hover:underline">Limpar filtros</button>
        </div>
      ) : (
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-4 py-3 w-8">
                    <input type="checkbox" checked={todosSelec} ref={el => { if (el) el.indeterminate = algunsSelec; }}
                      onChange={toggleTodos}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-300 cursor-pointer" />
                  </th>
                  <ThSort campo="importado_em" label="Ficheiro" />
                  <ThSort campo="numero_fatura" label="Nº Fatura" />
                  <ThSort campo="fornecedor" label="Fornecedor" />
                  <ThSort campo="data_fatura" label="Data" />
                  <ThSort campo="valor_total" label="Total" />
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">IVA</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Ações</th>
                </tr>
              </thead>
              <tbody>
                {faturasFiltradas.map((f, i) => {
                  const d = f.dados || {};
                  const sel = selecionados.has(f.id);
                  return (
                    <tr key={f.id} className={`border-b border-slate-50 transition-colors cursor-pointer ${sel ? 'bg-red-50' : i % 2 === 0 ? 'hover:bg-slate-50' : 'bg-slate-50/40 hover:bg-slate-100/60'}`}
                      onClick={() => toggleSel(f.id)}>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={sel} onChange={() => toggleSel(f.id)}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-300 cursor-pointer" />
                      </td>
                      <td className="px-4 py-3 max-w-[160px]">
                        <p className="text-xs font-semibold text-slate-700 truncate" title={f.filename}>{f.filename}</p>
                        <p className="text-[10px] text-slate-400">{formatDate(f.importado_em)}</p>
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-slate-600">{d.numero_fatura || <span className="text-slate-300">—</span>}</td>
                      <td className="px-4 py-3 text-xs text-slate-600 max-w-[160px] truncate" title={d.fornecedor}>{d.fornecedor || <span className="text-slate-300">—</span>}</td>
                      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{d.data_fatura ? new Date(d.data_fatura).toLocaleDateString('pt-PT') : <span className="text-slate-300">—</span>}</td>
                      <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{d.valor_total != null ? `${Number(d.valor_total).toFixed(2)} €` : <span className="text-slate-300">—</span>}</td>
                      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{d.iva != null ? `${Number(d.iva).toFixed(2)} €` : <span className="text-slate-300">—</span>}</td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          <a href={f.url} target="_blank" rel="noopener noreferrer"
                            className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors" title="Abrir">
                            <ExternalLink size={14} />
                          </a>
                          <a href={f.url} download={f.filename}
                            className="p-1.5 text-slate-400 hover:text-emerald-600 transition-colors" title="Download">
                            <Download size={14} />
                          </a>
                          <button onClick={() => handleApagarUm(f)} disabled={apagando}
                            className="p-1.5 text-slate-400 hover:text-red-500 transition-colors disabled:opacity-50" title="Apagar">
                            {apagando ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 text-xs text-slate-400 font-semibold border-t border-slate-50 flex items-center gap-2">
            {extraindo
              ? <><Loader2 size={12} className="animate-spin text-indigo-400" /><span className="text-indigo-500">A extrair dados das faturas com IA...</span></>
              : <>
                  {faturasFiltradas.length !== faturas.length
                    ? <>{faturasFiltradas.length} de {faturas.length} fatura(s)</>
                    : <>{faturas.length} fatura(s)</>
                  }
                  {selecionados.size > 0 && <> · {selecionados.size} selecionada(s)</>}
                  {selecionados.size === 0 && <> · clica numa linha para selecionar</>}
                </>
            }
          </div>
        </div>
      )}
    </div>
  );
}
