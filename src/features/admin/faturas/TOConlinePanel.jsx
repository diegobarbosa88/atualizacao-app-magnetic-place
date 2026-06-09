import React, { useState, useEffect, useMemo } from 'react';
import {
  ChevronDown, ChevronUp, Link2, Link2Off, Loader2, Download,
  Search, X, Eye, ArrowUpDown, ArrowUp, ArrowDown, RefreshCw,
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';

const MESES = [
  { val: '01', label: 'Janeiro' }, { val: '02', label: 'Fevereiro' },
  { val: '03', label: 'Março' }, { val: '04', label: 'Abril' },
  { val: '05', label: 'Maio' }, { val: '06', label: 'Junho' },
  { val: '07', label: 'Julho' }, { val: '08', label: 'Agosto' },
  { val: '09', label: 'Setembro' }, { val: '10', label: 'Outubro' },
  { val: '11', label: 'Novembro' }, { val: '12', label: 'Dezembro' },
];

const TIPOS_IMPORT = [
  { key: 'vendas', label: 'Faturas de vendas' },
  { key: 'compras', label: 'Faturas de compras' },
  { key: 'recibos', label: 'Recibos de venda' },
];

const FIELD_LABELS_TOC = {
  document_number: 'Nº Documento',
  date: 'Data',
  due_date: 'Data Vencimento',
  customer_name: 'Cliente',
  customer_tax_number: 'NIF Cliente',
  supplier_name: 'Fornecedor',
  supplier_tax_number: 'NIF Fornecedor',
  entity_name: 'Entidade',
  entity_tax_number: 'NIF Entidade',
  total_amount: 'Total (€)',
  total_tax_amount: 'IVA (€)',
  net_amount: 'Líquido (€)',
  received_value: 'Valor Recebido (€)',
  document_type_name: 'Tipo de Documento',
  status: 'Estado',
  notes: 'Notas',
  series: 'Série',
  payment_method: 'Forma de Pagamento',
  payment_status: 'Estado Pagamento',
  currency: 'Moeda',
  description: 'Descrição',
  gross_total: 'Total Bruto (€)',
  discount: 'Desconto',
};

const VALOR_KEYS = ['total_amount', 'total_tax_amount', 'net_amount', 'received_value', 'gross_total'];

function getNomeEntidade(attrs, tipo) {
  if (tipo === 'compras') return attrs.supplier_name || attrs.entity_name || '';
  return attrs.customer_name || attrs.entity_name || '';
}

function getValorTotal(attrs) {
  return attrs.total_amount ?? attrs.gross_total ?? attrs.received_value ?? null;
}

function getIva(attrs) {
  return attrs.total_tax_amount ?? null;
}

function ModalDocToc({ doc, tipo, onClose }) {
  const [pdfUrl, setPdfUrl] = useState(null);
  const [carregandoPdf, setCarregandoPdf] = useState(false);

  if (!doc) return null;
  const attrs = doc.attributes || {};

  const campos = Object.entries(attrs)
    .filter(([, v]) => v != null && v !== '' && typeof v !== 'object')
    .sort(([a], [b]) => {
      const order = ['document_number', 'date', 'customer_name', 'supplier_name', 'entity_name', 'total_amount', 'total_tax_amount'];
      const ia = order.indexOf(a), ib = order.indexOf(b);
      if (ia >= 0 && ib >= 0) return ia - ib;
      if (ia >= 0) return -1;
      if (ib >= 0) return 1;
      return a.localeCompare(b);
    });

  const formatVal = (k, v) => {
    if (VALOR_KEYS.includes(k)) {
      const n = parseFloat(v);
      return isNaN(n) ? String(v) : n.toFixed(2) + ' €';
    }
    return String(v);
  };

  const handleBaixarPdf = async () => {
    if (pdfUrl) { window.open(pdfUrl, '_blank'); return; }
    setCarregandoPdf(true);
    try {
      const tipoDoc = tipo === 'compras' ? 'compra' : tipo === 'recibos' ? 'recibo' : 'venda';
      const res = await fetch(`/api/toconline/documento?id=${doc.id}&tipo=${tipoDoc}`);
      const data = await res.json();
      if (data.pdf_url) {
        setPdfUrl(data.pdf_url);
        window.open(data.pdf_url, '_blank');
      } else {
        alert('PDF não disponível para este documento.');
      }
    } catch (e) {
      alert('Erro ao obter PDF: ' + e.message);
    } finally {
      setCarregandoPdf(false);
    }
  };

  const entidade = getNomeEntidade(attrs, tipo);
  const tipoLabel = tipo === 'compras' ? 'Documento de Compra' : tipo === 'recibos' ? 'Recibo' : 'Documento de Venda';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-slate-100">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{tipoLabel}</p>
            <p className="text-sm font-bold text-slate-700">{attrs.document_number || `Doc #${doc.id}`}</p>
            {entidade && <p className="text-xs text-slate-500 mt-0.5">{entidade}</p>}
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors ml-3">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {campos.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">Sem dados disponíveis.</p>
          ) : (
            <div className="space-y-3">
              {campos.map(([k, v]) => (
                <div key={k} className="flex gap-3">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 w-36 shrink-0 pt-0.5">
                    {FIELD_LABELS_TOC[k] || k.replace(/_/g, ' ')}
                  </span>
                  <span className="text-sm text-slate-700 font-semibold flex-1 break-words">
                    {formatVal(k, v)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 pb-6 pt-4 border-t border-slate-100">
          <button
            onClick={handleBaixarPdf}
            disabled={carregandoPdf}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-sm disabled:opacity-60"
          >
            {carregandoPdf ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            {pdfUrl ? 'Abrir PDF' : 'Baixar PDF Original'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TOConlinePanel({ onImportDone, importing, setImporting, importResult, setImportResult }) {
  const { supabase } = useApp();
  const [ligado, setLigado] = useState(false);
  const [ligando, setLigando] = useState(false);
  const [subtab, setSubtab] = useState('relatorios');

  // Import state
  const [tipos, setTipos] = useState(['vendas', 'compras', 'recibos']);
  const [dataDe, setDataDe] = useState('');
  const [dataAte, setDataAte] = useState('');

  // Relatórios state
  const [tipoRel, setTipoRel] = useState('vendas');
  const [dataDeRel, setDataDeRel] = useState(() => `${new Date().getFullYear()}-01-01`);
  const [dataAteRel, setDataAteRel] = useState(() => new Date().toISOString().slice(0, 10));
  const [docsRel, setDocsRel] = useState([]);
  const [carregandoRel, setCarregandoRel] = useState(false);
  const [erroRel, setErroRel] = useState(null);
  const [temMais, setTemMais] = useState(false);

  // Client-side filters
  const [pesquisaRel, setPesquisaRel] = useState('');
  const [filtroMesRel, setFiltroMesRel] = useState('');
  const [filtroAnoRel, setFiltroAnoRel] = useState('');
  const [filtroEntidadeRel, setFiltroEntidadeRel] = useState('');
  const [mostrarFiltrosRel, setMostrarFiltrosRel] = useState(false);
  const [ordemRel, setOrdemRel] = useState({ campo: 'date', dir: 'desc' });
  const [docDetalhe, setDocDetalhe] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('toconline_connected')) {
      setLigado(true);
      window.history.replaceState({}, '', window.location.pathname);
    }
    if (params.get('toconline_error')) {
      setImportResult({ error: decodeURIComponent(params.get('toconline_error')) });
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (!supabase) return;
    supabase
      .from('system_settings')
      .select('toconline_access_token')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data }) => setLigado(!!data?.toconline_access_token));
  }, [supabase]);

  const handleLigar = async () => {
    setLigando(true);
    try {
      const res = await fetch('/api/toconline/auth-init');
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      window.location.href = data.authUrl;
    } catch (e) {
      setImportResult({ error: e.message });
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
    setImportResult(null);
  };

  const handleImportar = async () => {
    setImporting(true);
    setImportResult(null);
    try {
      const res = await fetch('/api/toconline/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipos, data_de: dataDe || undefined, data_ate: dataAte || undefined }),
      });
      const data = await res.json();
      setImportResult(data);
      if (!data.error) onImportDone?.();
    } catch (e) {
      setImportResult({ error: e.message });
    } finally {
      setImporting(false);
    }
  };

  const carregarRelatorio = async () => {
    setCarregandoRel(true);
    setErroRel(null);
    setDocsRel([]);
    setTemMais(false);
    try {
      const params = new URLSearchParams({ tipo: tipoRel, page: 1 });
      if (dataDeRel) params.set('data_de', dataDeRel);
      if (dataAteRel) params.set('data_ate', dataAteRel);
      const res = await fetch(`/api/toconline/relatorio?${params}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const lista = data.data || [];
      setDocsRel(lista);
      setTemMais(lista.length === 50);
    } catch (e) {
      setErroRel(e.message);
    } finally {
      setCarregandoRel(false);
    }
  };

  const toggleTipo = (key) =>
    setTipos(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);

  // Derived filter options
  const anosDisponiveisRel = useMemo(() => {
    const anos = new Set(docsRel.map(d => (d.attributes?.date || '').slice(0, 4)).filter(a => a && a.length === 4));
    return [...anos].sort().reverse();
  }, [docsRel]);

  const entidadesDisponiveisRel = useMemo(() => {
    return [...new Set(docsRel.map(d => getNomeEntidade(d.attributes || {}, tipoRel)).filter(Boolean))].sort();
  }, [docsRel, tipoRel]);

  const toggleOrdemRel = (campo) => setOrdemRel(prev =>
    prev.campo === campo ? { campo, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { campo, dir: 'asc' }
  );

  const docsFiltrados = useMemo(() => {
    let lista = [...docsRel];
    const q = pesquisaRel.toLowerCase().trim();
    if (q) lista = lista.filter(d => {
      const a = d.attributes || {};
      const ent = getNomeEntidade(a, tipoRel).toLowerCase();
      return ent.includes(q) || (a.document_number || '').toLowerCase().includes(q);
    });
    if (filtroAnoRel) lista = lista.filter(d => (d.attributes?.date || '').slice(0, 4) === filtroAnoRel);
    if (filtroMesRel) lista = lista.filter(d => (d.attributes?.date || '').slice(5, 7) === filtroMesRel);
    if (filtroEntidadeRel) lista = lista.filter(d => getNomeEntidade(d.attributes || {}, tipoRel) === filtroEntidadeRel);

    lista.sort((a, b) => {
      const aa = a.attributes || {}, ba = b.attributes || {};
      let va, vb;
      if (ordemRel.campo === 'entidade') { va = getNomeEntidade(aa, tipoRel); vb = getNomeEntidade(ba, tipoRel); }
      else if (ordemRel.campo === 'total') { va = getValorTotal(aa) ?? -1; vb = getValorTotal(ba) ?? -1; }
      else { va = aa.date || ''; vb = ba.date || ''; }
      if (va < vb) return ordemRel.dir === 'asc' ? -1 : 1;
      if (va > vb) return ordemRel.dir === 'asc' ? 1 : -1;
      return 0;
    });
    return lista;
  }, [docsRel, pesquisaRel, filtroAnoRel, filtroMesRel, filtroEntidadeRel, ordemRel, tipoRel]);

  const filtrosRelAtivos = pesquisaRel || filtroMesRel || filtroAnoRel || filtroEntidadeRel;
  const limparFiltrosRel = () => { setPesquisaRel(''); setFiltroMesRel(''); setFiltroAnoRel(''); setFiltroEntidadeRel(''); };

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

  const selectClass = "w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white";

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

      {/* Subtabs */}
      {ligado && (
        <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl w-fit">
          {[
            { key: 'relatorios', label: 'Relatórios' },
            { key: 'importar', label: 'Importar' },
          ].map(({ key, label }) => (
            <button key={key} onClick={() => setSubtab(key)}
              className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${subtab === key ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
              {label}
            </button>
          ))}
        </div>
      )}

      {/* ── Tab: Importar ── */}
      {ligado && subtab === 'importar' && (
        <div className="border-t border-slate-100 pt-4 space-y-4">
          <div className="space-y-1.5">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tipos de documentos</p>
            <div className="flex gap-3 flex-wrap">
              {TIPOS_IMPORT.map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" checked={tipos.includes(key)} onChange={() => toggleTipo(key)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-300 cursor-pointer" />
                  <span className="text-xs font-black uppercase tracking-widest text-slate-600">{label}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-3">
            <div className="space-y-1 flex-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Data de</p>
              <input type="date" value={dataDe} onChange={e => setDataDe(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div className="space-y-1 flex-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Data até</p>
              <input type="date" value={dataAte} onChange={e => setDataAte(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={handleImportar} disabled={importing || tipos.length === 0}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-md shadow-blue-100 disabled:opacity-60">
              {importing ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              Importar do TOConline
            </button>
            {importResult && (
              <span className={`text-xs font-semibold ${importResult.error ? 'text-red-600' : 'text-emerald-700'}`}>
                {importResult.error
                  ? `Erro: ${importResult.error}`
                  : `Vendas: ${importResult.vendas ?? 0} · Compras: ${importResult.compras ?? 0} · Recibos: ${importResult.recibos ?? 0}${importResult.duplicados ? ` · ${importResult.duplicados} dup.` : ''}${importResult.erros?.length ? ` · ${importResult.erros.length} erro(s)` : ''}`}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: Relatórios ── */}
      {ligado && subtab === 'relatorios' && (
        <div className="border-t border-slate-100 pt-4 space-y-4">
          {/* Controlos de pesquisa */}
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl">
              {[
                { key: 'vendas', label: 'Vendas' },
                { key: 'compras', label: 'Compras' },
                { key: 'recibos', label: 'Recibos' },
              ].map(({ key, label }) => (
                <button key={key} onClick={() => { setTipoRel(key); setDocsRel([]); }}
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
            <button onClick={carregarRelatorio} disabled={carregandoRel}
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
              {/* Pesquisa + filtros */}
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

              {/* Tabela */}
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
                        const a = doc.attributes || {};
                        const entidade = getNomeEntidade(a, tipoRel);
                        const total = getValorTotal(a);
                        const iva = getIva(a);
                        return (
                          <tr key={doc.id}
                            className={`border-b border-slate-50 transition-colors cursor-pointer ${i % 2 === 0 ? 'hover:bg-slate-50' : 'bg-slate-50/40 hover:bg-slate-100/60'}`}
                            onClick={() => setDocDetalhe(doc)}>
                            <td className="px-4 py-3 text-xs font-mono text-slate-600 whitespace-nowrap">{a.document_number || `#${doc.id}`}</td>
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

      <ModalDocToc doc={docDetalhe} tipo={tipoRel} onClose={() => setDocDetalhe(null)} />
    </div>
  );
}
