import React, { useState, useEffect, useMemo, useRef } from 'react';
import { FileText, Download, Loader2, RefreshCw, ExternalLink, Trash2, Search, ChevronDown, ChevronUp, X, ArrowUpDown, ArrowUp, ArrowDown, Sparkles, CheckCircle, Printer, Eye, Receipt, Repeat } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { DEFAULT_GMAIL_CONFIG, configParaQuery } from './faturas/faturasUtils';
import GmailConfigPanel from './faturas/GmailConfigPanel';
import TOConlinePanel from './faturas/TOConlinePanel';
import FaturaConfigPanel from './faturas/FaturaConfigPanel';
import CelEditTd from './faturas/CelEditTd';
import { gerarRelatorioFaturasPDF } from './faturas/faturasExport';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

const MESES = [
  { val: '01', label: 'Janeiro' }, { val: '02', label: 'Fevereiro' },
  { val: '03', label: 'Março' }, { val: '04', label: 'Abril' },
  { val: '05', label: 'Maio' }, { val: '06', label: 'Junho' },
  { val: '07', label: 'Julho' }, { val: '08', label: 'Agosto' },
  { val: '09', label: 'Setembro' }, { val: '10', label: 'Outubro' },
  { val: '11', label: 'Novembro' }, { val: '12', label: 'Dezembro' },
];

const FIELD_LABELS = {
  numero_fatura: 'Nº Fatura',
  fornecedor: 'Fornecedor',
  data_fatura: 'Data da Fatura',
  valor_total: 'Valor Total (€)',
  iva: 'IVA (€)',
  subtotal: 'Subtotal (€)',
  desconto: 'Desconto',
  descricao: 'Descrição',
  categoria: 'Categoria',
  moeda: 'Moeda',
  forma_pagamento: 'Forma de Pagamento',
  nif_fornecedor: 'NIF Fornecedor',
  nif_cliente: 'NIF Cliente',
  banco: 'Banco',
  iban: 'IBAN',
  prazo_pagamento: 'Prazo de Pagamento',
  notas: 'Notas',
};

function ModalDetalhe({ fatura, onClose }) {
  if (!fatura) return null;
  const d = fatura.dados || {};
  const todasChaves = Object.keys(d).filter(k => d[k] != null && d[k] !== '');

  const formatVal = (k, v) => {
    if (k === 'valor_total' || k === 'iva' || k === 'subtotal' || k === 'desconto') {
      const n = parseFloat(v);
      return isNaN(n) ? String(v) : n.toFixed(2) + ' €';
    }
    return String(v);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-slate-100">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Detalhes da Fatura</p>
            <p className="text-sm font-bold text-slate-700 truncate" title={fatura.filename}>{fatura.filename}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Importada em {fatura.importado_em ? new Date(fatura.importado_em).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
            </p>
          </div>
          <div className="flex items-center gap-2 ml-3">
            {fatura.status === 'PAGO'
              ? <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase tracking-widest"><CheckCircle size={11} /> Pago</span>
              : <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 text-amber-600 text-[10px] font-black uppercase tracking-widest">Pendente</span>
            }
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Campos extraídos */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {todasChaves.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">Nenhum dado extraído para esta fatura.</p>
          ) : (
            <div className="space-y-3">
              {todasChaves.map(k => (
                <div key={k} className="flex gap-3">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 w-32 shrink-0 pt-0.5">
                    {FIELD_LABELS[k] || k.replace(/_/g, ' ')}
                  </span>
                  <span className="text-sm text-slate-700 font-semibold flex-1 break-words">
                    {formatVal(k, d[k])}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Ações */}
        {fatura.url && (
          <div className="px-6 pb-6 pt-4 border-t border-slate-100 flex gap-3">
            <a
              href={fatura.url}
              download={fatura.filename}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-sm"
            >
              <Download size={16} /> Baixar PDF Original
            </a>
            <a
              href={fatura.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 text-slate-600 rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
            >
              <ExternalLink size={16} /> Abrir
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

export default function FaturasAdmin() {
  const { supabase, gmailQueryConfig, saveGmailQueryConfig, systemSettings } = useApp();
  const [faturas, setFaturas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [apagando, setApagando] = useState(false);
  const [selecionados, setSelecionados] = useState(new Set());

  const [cfg, setCfg] = useState(() => gmailQueryConfig || DEFAULT_GMAIL_CONFIG);
  const [importando, setImportando] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importandoToc, setImportandoToc] = useState(false);
  const [importResultToc, setImportResultToc] = useState(null);
  const [importandoComp, setImportandoComp] = useState(false);
  const [importResultComp, setImportResultComp] = useState(null);
  const [extraindo, setExtraindo] = useState(false);
  const [extraindoErros, setExtraindoErros] = useState([]);

  const [celEdit, setCelEdit] = useState(null);
  const [celValor, setCelValor] = useState('');
  const [salvandoCell, setSalvandoCell] = useState(false);

  const [pesquisa, setPesquisa] = useState('');
  const [filtroDataDe, setFiltroDataDe] = useState('');
  const [filtroDataAte, setFiltroDataAte] = useState('');
  const [filtroValorMin, setFiltroValorMin] = useState('');
  const [filtroValorMax, setFiltroValorMax] = useState('');
  const [filtroMes, setFiltroMes] = useState('');
  const [filtroAno, setFiltroAno] = useState('');
  const [filtroFornecedor, setFiltroFornecedor] = useState('');
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState('todas');
  const [ordem, setOrdem] = useState({ campo: 'importado_em', dir: 'desc' });
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [faturaDetalhe, setFaturaDetalhe] = useState(null);

  useEffect(() => {
    if (gmailQueryConfig) setCfg(gmailQueryConfig);
  }, [gmailQueryConfig]);

  const carregar = async () => {
    setLoading(true); setErro(null);
    try {
      const { data, error } = await supabase.from('faturas').select('*').order('importado_em', { ascending: false });
      if (error) throw error;
      setFaturas(data || []);
      setSelecionados(new Set());
    } catch (e) { setErro(e.message); }
    finally { setLoading(false); }
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

  const processarFaturas = async (lista, forcar = false) => {
    const alvo = forcar
      ? lista.filter(f => f.mime_type === 'application/pdf')
      : lista.filter(f => !f.dados && f.mime_type === 'application/pdf');
    if (!alvo.length) return;
    setExtraindo(true);
    setExtraindoErros([]);
    const erros = [];
    for (const f of alvo) {
      try {
        const resp = await fetch(f.url);
        if (!resp.ok) { erros.push({ filename: f.filename, msg: `Ficheiro não encontrado (${resp.status})` }); continue; }
        const buffer = await resp.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
        let texto = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          texto += content.items.map(it => it.str).join(' ') + '\n';
        }
        const dados = await parsearComGemini(texto);
        if (dados) {
          const { error: updateError } = await supabase.from('faturas').update({ dados }).eq('id', f.id);
          if (updateError) throw new Error(`DB update: ${updateError.message}`);
          setFaturas(prev => prev.map(x => x.id === f.id ? { ...x, dados } : x));
        }
      } catch (e) { erros.push({ filename: f.filename, msg: e.message }); }
    }
    setExtraindoErros(erros);
    setExtraindo(false);
  };

  const handleImportarComprovativos = async () => {
    setImportandoComp(true); setImportResultComp(null);
    try {
      const res = await fetch('/api/gmail/import-faturas', {
        method: 'POST',
        headers: { 'x-import-secret': import.meta.env.VITE_GMAIL_IMPORT_SECRET || '', 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'comprovativos' }),
      });
      const data = await res.json();
      setImportResultComp(data);
    } catch (e) { setImportResultComp({ error: e.message }); }
    finally { setImportandoComp(false); }
  };

  const handleImportar = async () => {
    setImportando(true); setImportResult(null);
    try {
      const query = configParaQuery(cfg);
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
        await processarFaturas(novas || []);
      }
    } catch (e) { setImportResult({ error: e.message }); }
    finally { setImportando(false); }
  };

  useEffect(() => { carregar(); }, []);

  const anosDisponiveis = useMemo(() => {
    const anos = new Set(
      faturas.map(f => (f.dados?.data_fatura || f.importado_em || '').slice(0, 4)).filter(a => a && a.length === 4)
    );
    return [...anos].sort().reverse();
  }, [faturas]);

  const fornecedoresDisponiveis = useMemo(() => {
    return [...new Set(faturas.map(f => f.dados?.fornecedor).filter(Boolean))].sort();
  }, [faturas]);

  const abrirEdit = (e, fatura, campo, valorAtual) => {
    e.stopPropagation();
    setCelEdit({ id: fatura.id, campo });
    setCelValor(valorAtual ?? '');
  };

  const cancelarEdit = () => { setCelEdit(null); setCelValor(''); };

  const guardarEdit = async () => {
    if (!celEdit) return;
    setSalvandoCell(true);
    try {
      const { id, campo } = celEdit;
      const fatura = faturas.find(f => f.id === id);
      const dadosAtuais = fatura?.dados || {};
      let valor = celValor;
      if (campo === 'valor_total' || campo === 'iva') valor = celValor === '' ? null : parseFloat(celValor);
      const novosDados = { ...dadosAtuais, [campo]: valor === '' ? null : valor };
      const { error } = await supabase.from('faturas').update({ dados: novosDados }).eq('id', id);
      if (error) throw error;
      setFaturas(prev => prev.map(f => f.id === id ? { ...f, dados: novosDados } : f));
      setCelEdit(null);
    } catch (e) { alert(`Erro ao guardar: ${e.message}`); }
    finally { setSalvandoCell(false); }
  };

  const faturasFiltradas = useMemo(() => {
    let lista = [...faturas];
    const q = pesquisa.toLowerCase().trim();
    if (q) lista = lista.filter(f => {
      const d = f.dados || {};
      return f.filename?.toLowerCase().includes(q) || d.fornecedor?.toLowerCase().includes(q) || d.numero_fatura?.toLowerCase().includes(q);
    });
    if (filtroDataDe) lista = lista.filter(f => (f.dados?.data_fatura || f.importado_em || '').slice(0, 10) >= filtroDataDe);
    if (filtroDataAte) lista = lista.filter(f => (f.dados?.data_fatura || f.importado_em || '').slice(0, 10) <= filtroDataAte);
    if (filtroValorMin !== '') lista = lista.filter(f => (f.dados?.valor_total ?? 0) >= parseFloat(filtroValorMin));
    if (filtroValorMax !== '') lista = lista.filter(f => (f.dados?.valor_total ?? 0) <= parseFloat(filtroValorMax));
    if (filtroAno) lista = lista.filter(f => (f.dados?.data_fatura || f.importado_em || '').slice(0, 4) === filtroAno);
    if (filtroMes) lista = lista.filter(f => (f.dados?.data_fatura || f.importado_em || '').slice(5, 7) === filtroMes);
    if (filtroFornecedor) lista = lista.filter(f => f.dados?.fornecedor === filtroFornecedor);
    if (filtroStatus === 'pendentes') lista = lista.filter(f => (f.status || 'PENDENTE') === 'PENDENTE');
    if (filtroStatus === 'pagas') lista = lista.filter(f => f.status === 'PAGO');
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
  }, [faturas, pesquisa, filtroDataDe, filtroDataAte, filtroValorMin, filtroValorMax, filtroAno, filtroMes, filtroFornecedor, filtroStatus, ordem]);

  const toggleOrdem = (campo) => setOrdem(prev =>
    prev.campo === campo ? { campo, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { campo, dir: 'asc' }
  );

  const IconeOrdem = ({ campo }) => {
    if (ordem.campo !== campo) return <ArrowUpDown size={11} className="text-slate-300" />;
    return ordem.dir === 'asc' ? <ArrowUp size={11} className="text-indigo-500" /> : <ArrowDown size={11} className="text-indigo-500" />;
  };

  const filtrosAtivos = pesquisa || filtroDataDe || filtroDataAte || filtroValorMin !== '' || filtroValorMax !== '' || filtroMes || filtroAno || filtroFornecedor;
  const limparFiltros = () => {
    setPesquisa(''); setFiltroDataDe(''); setFiltroDataAte('');
    setFiltroValorMin(''); setFiltroValorMax('');
    setFiltroMes(''); setFiltroAno(''); setFiltroFornecedor('');
  };

  const toggleSel = (id) => setSelecionados(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleTodos = () => {
    if (faturasFiltradas.every(f => selecionados.has(f.id))) setSelecionados(new Set());
    else setSelecionados(new Set(faturasFiltradas.map(f => f.id)));
  };

  const apagarFaturas = async (ids) => {
    const alvo = faturas.filter(f => ids.includes(f.id));
    setApagando(true);
    try {
      const paths = alvo.map(f => f.storage_path).filter(Boolean);
      if (paths.length) await supabase.storage.from('faturas').remove(paths);
      const { error } = await supabase.from('faturas').delete().in('id', ids);
      if (error) throw error;
      setFaturas(prev => prev.filter(f => !ids.includes(f.id)));
      setSelecionados(new Set());
    } catch (e) { alert(`Erro ao apagar: ${e.message}`); }
    finally { setApagando(false); }
  };

  const handleApagarUm = (f) => { if (!confirm(`Apagar "${f.filename}"?`)) return; apagarFaturas([f.id]); };

  const toggleDebitoAutomatico = async (f) => {
    const novo = !f.debito_automatico;
    const { error } = await supabase.from('faturas').update({ debito_automatico: novo }).eq('id', f.id);
    if (error) { alert(`Erro: ${error.message}`); return; }
    setFaturas(prev => prev.map(x => x.id === f.id ? { ...x, debito_automatico: novo } : x));
  };
  const handleApagarSelecionados = () => { if (!selecionados.size || !confirm(`Apagar ${selecionados.size} fatura(s)?`)) return; apagarFaturas([...selecionados]); };

  const handleGerarPDF = async (listaOverride = null) => {
    const lista = listaOverride ?? (selecionados.size > 0
      ? faturasFiltradas.filter(f => selecionados.has(f.id))
      : faturasFiltradas);
    if (!lista.length) return;
    setGerandoPdf(true);
    try {
      await gerarRelatorioFaturasPDF({ lista, filtroStatus, systemSettings });
    } catch (e) { alert('Erro ao gerar PDF: ' + e.message); }
    finally { setGerandoPdf(false); }
  };

  const handleReextrairSelecionados = async () => {
    const alvos = faturas.filter(f => selecionados.has(f.id));
    await processarFaturas(alvos, true);
  };

  const formatDate = (iso) => !iso ? '—' : new Date(iso).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const todosSelec = faturasFiltradas.length > 0 && faturasFiltradas.every(f => selecionados.has(f.id));
  const algunsSelec = faturasFiltradas.some(f => selecionados.has(f.id)) && !todosSelec;

  const ThSort = ({ campo, label }) => (
    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 cursor-pointer select-none hover:text-slate-600 transition-colors" onClick={() => toggleOrdem(campo)}>
      <span className="flex items-center gap-1">{label}<IconeOrdem campo={campo} /></span>
    </th>
  );

  const selectClass = "w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white";
  const celEditProps = { celEdit, celValor, salvandoCell, onOpen: abrirEdit, onValorChange: setCelValor, onSave: guardarEdit, onCancel: cancelarEdit };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl sm:text-2xl font-black flex items-center gap-2">
          <FileText size={22} className="text-emerald-600" />
          Faturas Importadas
        </h2>
        <div className="flex items-center gap-2">
          <button onClick={() => handleGerarPDF(faturas.filter(f => f.status === 'PAGO'))}
            disabled={gerandoPdf || faturas.filter(f => f.status === 'PAGO').length === 0}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-emerald-700 transition-all disabled:opacity-50 shadow-sm">
            {gerandoPdf ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
            <span className="hidden sm:inline">Reconciliadas</span>
          </button>
          <button onClick={() => handleGerarPDF()}
            disabled={gerandoPdf || faturasFiltradas.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all disabled:opacity-50 shadow-sm">
            {gerandoPdf ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}
            <span className="hidden sm:inline">{selecionados.size > 0 ? `PDF (${selecionados.size})` : 'PDF'}</span>
          </button>
          <button onClick={carregar} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-all disabled:opacity-50">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            <span className="hidden sm:inline">Atualizar</span>
          </button>
        </div>
      </div>

      <FaturaConfigPanel />

      <GmailConfigPanel
        cfg={cfg}
        onCfgChange={setCfg}
        onSave={(novaCfg) => { saveGmailQueryConfig(novaCfg); }}
        onImport={handleImportar}
        importing={importando}
        importResult={importResult}
      />

      {/* Comprovativos novobanco */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 space-y-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-rose-50 flex items-center justify-center shrink-0">
              <Receipt size={18} className="text-rose-500" />
            </div>
            <div>
              <p className="text-sm font-black text-slate-700">Comprovativos novobanco</p>
              <p className="text-[10px] text-slate-400 font-semibold">Débitos confirmados de alertas@novobanco.pt / comprovativos@novobanco.pt / info@novobanco.pt</p>
            </div>
          </div>
          <button
            onClick={handleImportarComprovativos}
            disabled={importandoComp}
            className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-rose-700 transition-all disabled:opacity-50 shadow-sm"
          >
            {importandoComp ? <Loader2 size={14} className="animate-spin" /> : <Receipt size={14} />}
            {importandoComp ? 'A importar...' : 'Importar Comprovativos'}
          </button>
        </div>
        {importResultComp && (
          <div className={`px-4 py-3 rounded-2xl text-xs font-semibold ${importResultComp.error ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
            {importResultComp.error
              ? `Erro: ${importResultComp.error}`
              : `${importResultComp.processados ?? 0} comprovativo(s) importado(s)${importResultComp.erros?.length ? ` · ${importResultComp.erros.length} aviso(s)` : ''}`
            }
            {importResultComp.erros?.length > 0 && (
              <div className="mt-2 space-y-2">
                {importResultComp.erros.map((e, i) => (
                  <div key={i} className="bg-white/60 rounded-xl p-2 text-[10px] font-mono break-all whitespace-pre-wrap">
                    <div className="font-black text-slate-600 mb-1">{e.aviso || e.error}</div>
                    {e.subject && <div><span className="text-slate-400">subject:</span> {e.subject}</div>}
                    {e.fonte && <div><span className="text-slate-400">fonte:</span> {e.fonte}</div>}
                    {e.campos_extraidos && <div><span className="text-slate-400">campos:</span> {JSON.stringify(e.campos_extraidos)}</div>}
                    {e.partes && <div><span className="text-slate-400">partes email:</span> {JSON.stringify(e.partes)}</div>}
                    {e.texto_debug && <div><span className="text-slate-400">texto:</span> {e.texto_debug}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <TOConlinePanel
        onImportDone={carregar}
        importing={importandoToc}
        setImporting={setImportandoToc}
        importResult={importResultToc}
        setImportResult={setImportResultToc}
      />

      {erro && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-2xl text-sm font-semibold">Erro: {erro}</div>}

      {/* Pesquisa + filtros */}
      <div className="space-y-3">
        <div className="flex gap-2 items-center">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={pesquisa} onChange={e => setPesquisa(e.target.value)}
              placeholder="Pesquisar por ficheiro, fornecedor ou nº fatura..."
              className="w-full pl-9 pr-4 py-2.5 rounded-2xl border border-slate-200 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            {pesquisa && <button onClick={() => setPesquisa('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X size={13} /></button>}
          </div>
          <button onClick={() => setMostrarFiltros(v => !v)}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-2xl border text-xs font-black uppercase tracking-widest transition-all ${mostrarFiltros || (filtrosAtivos && !pesquisa) ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-200'}`}>
            {mostrarFiltros ? <ChevronUp size={13} /> : <ChevronDown size={13} />} Filtros
            {filtrosAtivos && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />}
          </button>
          {filtrosAtivos && <button onClick={limparFiltros} className="flex items-center gap-1 px-3 py-2.5 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-red-500 transition-colors"><X size={12} /> Limpar</button>}
        </div>
        {mostrarFiltros && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
            {/* Linha 1: Ano, Mês, Fornecedor */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Fornecedor</label>
                <select value={filtroFornecedor} onChange={e => setFiltroFornecedor(e.target.value)} className={selectClass}>
                  <option value="">Todos</option>
                  {fornecedoresDisponiveis.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
            </div>
            {/* Linha 2: Datas e valores */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
                <input type="number" min="0" step="0.01" value={filtroValorMin} onChange={e => setFiltroValorMin(e.target.value)} placeholder="0.00"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Valor máx (€)</label>
                <input type="number" min="0" step="0.01" value={filtroValorMax} onChange={e => setFiltroValorMax(e.target.value)} placeholder="9999.00"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
            </div>
          </div>
        )}
      </div>

      {faturas.length > 0 && (
        <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl w-fit">
          {[
            { key: 'todas', label: `Todas (${faturas.length})` },
            { key: 'pendentes', label: `Pendentes (${faturas.filter(f => (f.status || 'PENDENTE') === 'PENDENTE').length})` },
            { key: 'pagas', label: null, jsx: (
              <span className="flex items-center gap-1">
                <CheckCircle size={11} className={filtroStatus === 'pagas' ? 'text-emerald-500' : 'text-slate-400'} />
                {`Reconciliadas (${faturas.filter(f => f.status === 'PAGO').length})`}
              </span>
            )},
          ].map(({ key, label, jsx }) => (
            <button key={key} onClick={() => setFiltroStatus(key)}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filtroStatus === key ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
              {jsx ?? label}
            </button>
          ))}
        </div>
      )}

      {selecionados.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl flex-wrap">
          <span className="text-xs font-black text-slate-600 uppercase tracking-widest">{selecionados.size} selecionada(s)</span>
          <button onClick={() => handleGerarPDF()} disabled={gerandoPdf}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-700 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-900 transition-all disabled:opacity-50">
            {gerandoPdf ? <Loader2 size={13} className="animate-spin" /> : <Printer size={13} />} PDF
          </button>
          <button onClick={handleReextrairSelecionados} disabled={extraindo}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all disabled:opacity-50">
            {extraindo ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} Reextrair com IA
          </button>
          <button onClick={handleApagarSelecionados} disabled={apagando}
            className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-700 transition-all disabled:opacity-50">
            {apagando ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />} Apagar
          </button>
          <button onClick={() => setSelecionados(new Set())} className="text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors">Cancelar</button>
        </div>
      )}

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
          <div className="px-5 py-3 border-b border-slate-50">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Duplo clique numa célula para editar · <span className="text-indigo-400">Enter</span> para guardar · <span className="text-slate-400">Esc</span> para cancelar · <span className="text-slate-400"><Eye size={9} className="inline" /> Ver detalhes</span></p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-4 py-3 w-8">
                    <input type="checkbox" checked={todosSelec} ref={el => { if (el) el.indeterminate = algunsSelec; }}
                      onChange={toggleTodos} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-300 cursor-pointer" />
                  </th>
                  <ThSort campo="importado_em" label="Ficheiro" />
                  <ThSort campo="numero_fatura" label="Nº Fatura" />
                  <ThSort campo="fornecedor" label="Fornecedor" />
                  <ThSort campo="data_fatura" label="Data" />
                  <ThSort campo="valor_total" label="Total" />
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">IVA</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Estado</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Ações</th>
                </tr>
              </thead>
              <tbody>
                {faturasFiltradas.map((f, i) => {
                  const d = f.dados || {};
                  const sel = selecionados.has(f.id);
                  const reextraindo = extraindo && selecionados.has(f.id);
                  return (
                    <tr key={f.id}
                      className={`border-b border-slate-50 transition-colors ${sel ? 'bg-indigo-50/50' : i % 2 === 0 ? 'hover:bg-slate-50' : 'bg-slate-50/40 hover:bg-slate-100/60'}`}
                      onClick={() => { if (!celEdit) toggleSel(f.id); }}>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        {reextraindo
                          ? <Loader2 size={14} className="animate-spin text-indigo-400" />
                          : <input type="checkbox" checked={sel} onChange={() => toggleSel(f.id)}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-300 cursor-pointer" />
                        }
                      </td>
                      <td className="px-4 py-3 max-w-[160px]" onClick={e => e.stopPropagation()}>
                        <p className="text-xs font-semibold text-slate-700 truncate" title={f.filename}>{f.filename}</p>
                        <p className="text-[10px] text-slate-400">{formatDate(f.importado_em)}</p>
                      </td>
                      <CelEditTd fatura={f} campo="numero_fatura" valor={d.numero_fatura} className="text-xs font-mono text-slate-600" {...celEditProps} />
                      <CelEditTd fatura={f} campo="fornecedor" valor={d.fornecedor} className="text-xs text-slate-600 max-w-[160px] truncate" {...celEditProps} />
                      <CelEditTd fatura={f} campo="data_fatura" valor={d.data_fatura} tipo="date" className="text-xs text-slate-500 whitespace-nowrap" {...celEditProps} />
                      <CelEditTd fatura={f} campo="valor_total" valor={d.valor_total != null ? Number(d.valor_total).toFixed(2) : null} tipo="number" className="text-xs font-semibold text-slate-700 whitespace-nowrap" {...celEditProps} />
                      <CelEditTd fatura={f} campo="iva" valor={d.iva != null ? Number(d.iva).toFixed(2) : null} tipo="number" className="text-xs text-slate-500 whitespace-nowrap" {...celEditProps} />
                      <td className="px-4 py-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        {f.status === 'PAGO'
                          ? <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase tracking-widest"><CheckCircle size={11} /> Pago</span>
                          : <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 text-amber-600 text-[10px] font-black uppercase tracking-widest">Pendente</span>
                        }
                      </td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          <button onClick={() => setFaturaDetalhe(f)} className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors" title="Ver detalhes e descarregar">
                            <Eye size={14} />
                          </button>
                          {f.url && (
                            <a href={f.url} download={f.filename} className="p-1.5 text-slate-400 hover:text-emerald-600 transition-colors" title="Download PDF">
                              <Download size={14} />
                            </a>
                          )}
                          <button
                            onClick={() => toggleDebitoAutomatico(f)}
                            title={f.debito_automatico ? 'Débito Automático (clique para remover)' : 'Marcar como Débito Automático'}
                            className={`p-1.5 transition-colors rounded ${f.debito_automatico ? 'text-violet-600 bg-violet-50 hover:bg-violet-100' : 'text-slate-400 hover:text-violet-600'}`}
                          >
                            <Repeat size={14} />
                          </button>
                          <button onClick={() => handleApagarUm(f)} disabled={apagando} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors disabled:opacity-50" title="Apagar">
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
          <div className="px-4 py-3 text-xs text-slate-400 font-semibold border-t border-slate-50 flex items-center gap-2 flex-wrap">
            {extraindo
              ? <><Loader2 size={12} className="animate-spin text-indigo-400" /><span className="text-indigo-500">A extrair dados com IA...</span></>
              : extraindoErros.length > 0 ? <span className="text-amber-600">{extraindoErros.length} ficheiro(s) não processado(s): {extraindoErros.map(e => e.filename).join(', ')}</span>
              : <>{faturasFiltradas.length !== faturas.length ? <>{faturasFiltradas.length} de {faturas.length} fatura(s)</> : <>{faturas.length} fatura(s)</>}{selecionados.size > 0 ? <> · {selecionados.size} selecionada(s)</> : <> · duplo clique para editar</>}</>
            }
          </div>
        </div>
      )}

      <ModalDetalhe fatura={faturaDetalhe} onClose={() => setFaturaDetalhe(null)} />
    </div>
  );
}
