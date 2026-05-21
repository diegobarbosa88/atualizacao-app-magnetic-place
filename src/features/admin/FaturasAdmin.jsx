import React, { useState, useEffect, useMemo, useRef } from 'react';
import { FileText, Download, Loader2, RefreshCw, ExternalLink, Trash2, Search, Save, ChevronDown, ChevronUp, X, ArrowUpDown, ArrowUp, ArrowDown, Sparkles, Check, CheckCircle, Pencil, Printer } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { jsPDF } from 'jspdf';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

const DEFAULT_CONFIG = {
  lidos: true,
  naoLidos: true,
  temAnexo: true,
  assuntos: ['fatura', 'invoice', 'FT'],
  remetente: '',
  palavras: '',
};

function configParaQuery(cfg) {
  const parts = [];
  if (cfg.naoLidos && !cfg.lidos) parts.push('is:unread');
  if (cfg.lidos && !cfg.naoLidos) parts.push('is:read');
  if (cfg.temAnexo) parts.push('has:attachment');
  if (cfg.assuntos.length) {
    const s = cfg.assuntos.map(a => `subject:${a}`).join(' ');
    parts.push(cfg.assuntos.length > 1 ? `{${s}}` : s);
  }
  if (cfg.remetente.trim()) parts.push(`from:${cfg.remetente.trim()}`);
  if (cfg.palavras.trim()) parts.push(cfg.palavras.trim());
  return parts.join(' ') || 'has:attachment';
}

export default function FaturasAdmin() {
  const { supabase, gmailQueryConfig, saveGmailQueryConfig, systemSettings } = useApp();
  const [faturas, setFaturas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [apagando, setApagando] = useState(false);
  const [selecionados, setSelecionados] = useState(new Set());

  const [cfg, setCfg] = useState(() => gmailQueryConfig || DEFAULT_CONFIG);
  const [assuntoInput, setAssuntoInput] = useState('');
  const [mostrarConfig, setMostrarConfig] = useState(false);
  const [importando, setImportando] = useState(false);
  const query = configParaQuery(cfg);
  const [importResult, setImportResult] = useState(null);
  const [extraindo, setExtraindo] = useState(false);
  const [extraindoErros, setExtraindoErros] = useState([]);

  // Edição inline
  const [celEdit, setCelEdit] = useState(null); // { id, campo }
  const [celValor, setCelValor] = useState('');
  const [salvandoCell, setSalvandoCell] = useState(false);
  const inputRef = useRef(null);

  // Filtros
  const [pesquisa, setPesquisa] = useState('');
  const [filtroDataDe, setFiltroDataDe] = useState('');
  const [filtroDataAte, setFiltroDataAte] = useState('');
  const [filtroValorMin, setFiltroValorMin] = useState('');
  const [filtroValorMax, setFiltroValorMax] = useState('');
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState('todas'); // 'todas' | 'pendentes' | 'pagas'
  const [ordem, setOrdem] = useState({ campo: 'importado_em', dir: 'desc' });

  // Sincronizar quando o context carregar a config do Supabase
  useEffect(() => {
    if (gmailQueryConfig) setCfg(gmailQueryConfig);
  }, [gmailQueryConfig]);

  const guardarConfig = (novaCfg) => {
    saveGmailQueryConfig(novaCfg);
    setMostrarConfig(false);
  };

  const setCfgField = (field, val) => setCfg(prev => ({ ...prev, [field]: val }));

  const addAssunto = () => {
    const a = assuntoInput.trim();
    if (a && !cfg.assuntos.includes(a)) setCfg(prev => ({ ...prev, assuntos: [...prev.assuntos, a] }));
    setAssuntoInput('');
  };

  const removeAssunto = (a) => setCfg(prev => ({ ...prev, assuntos: prev.assuntos.filter(x => x !== a) }));

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
        if (!resp.ok) {
          erros.push({ filename: f.filename, msg: `Ficheiro não encontrado no Storage (${resp.status})` });
          continue;
        }
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
      } catch (e) {
        erros.push({ filename: f.filename, msg: e.message });
      }
    }
    setExtraindoErros(erros);
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
        await processarFaturas(novas || []);
      }
    } catch (e) { setImportResult({ error: e.message }); }
    finally { setImportando(false); }
  };

  const handleReextrairSelecionados = async () => {
    const alvos = faturas.filter(f => selecionados.has(f.id));
    await processarFaturas(alvos, true);
  };

  useEffect(() => { carregar(); }, []);

  // --- Edição inline ---
  const abrirEdit = (e, fatura, campo, valorAtual) => {
    e.stopPropagation();
    setCelEdit({ id: fatura.id, campo });
    setCelValor(valorAtual ?? '');
  };

  useEffect(() => {
    if (celEdit) inputRef.current?.focus();
  }, [celEdit]);

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
    } catch (e) {
      alert(`Erro ao guardar: ${e.message}`);
    } finally { setSalvandoCell(false); }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') guardarEdit();
    if (e.key === 'Escape') cancelarEdit();
  };

  // --- Filtros + ordenação ---
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
  }, [faturas, pesquisa, filtroDataDe, filtroDataAte, filtroValorMin, filtroValorMax, filtroStatus, ordem]);

  const toggleOrdem = (campo) => setOrdem(prev =>
    prev.campo === campo ? { campo, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { campo, dir: 'asc' }
  );

  const IconeOrdem = ({ campo }) => {
    if (ordem.campo !== campo) return <ArrowUpDown size={11} className="text-slate-300" />;
    return ordem.dir === 'asc' ? <ArrowUp size={11} className="text-indigo-500" /> : <ArrowDown size={11} className="text-indigo-500" />;
  };

  const filtrosAtivos = pesquisa || filtroDataDe || filtroDataAte || filtroValorMin !== '' || filtroValorMax !== '';
  const limparFiltros = () => { setPesquisa(''); setFiltroDataDe(''); setFiltroDataAte(''); setFiltroValorMin(''); setFiltroValorMax(''); };

  const toggleSel = (id) => setSelecionados(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleTodos = () => {
    if (faturasFiltradas.every(f => selecionados.has(f.id))) setSelecionados(new Set());
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
    } catch (e) { alert(`Erro ao apagar: ${e.message}`); }
    finally { setApagando(false); }
  };

  const handleApagarUm = (f) => { if (!confirm(`Apagar "${f.filename}"?`)) return; apagarFaturas([f.id]); };
  const handleApagarSelecionados = () => { if (!selecionados.size || !confirm(`Apagar ${selecionados.size} fatura(s)?`)) return; apagarFaturas([...selecionados]); };

  const [gerandoPdf, setGerandoPdf] = useState(false);

  const gerarPDF = async (listaOverride = null) => {
    const lista = listaOverride ?? (selecionados.size > 0
      ? faturasFiltradas.filter(f => selecionados.has(f.id))
      : faturasFiltradas);
    if (!lista.length) return;
    const soReconciliadas = listaOverride != null || filtroStatus === 'pagas';
    setGerandoPdf(true);
    try {
      const hoje = new Date().toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const empresa = systemSettings?.companyName || 'Magnetic Place';
      const totalValor = lista.reduce((s, f) => s + (f.dados?.valor_total ?? 0), 0);
      const totalIva = lista.reduce((s, f) => s + (f.dados?.iva ?? 0), 0);

      // Fetch logo as base64
      let logoDataUrl = null;
      try {
        const logoSrc = systemSettings?.companyLogo || '/MAGNETIC (3).png';
        const res = await fetch(logoSrc);
        if (res.ok) {
          const blob = await res.blob();
          logoDataUrl = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
          });
        }
      } catch { /* logo opcional */ }

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const M = 14; // margin
      const pW = 210;
      const pH = 297;
      const cW = pW - M * 2; // content width = 182mm

      // Column definitions [label, width, align]
      const cols = [
        ['Nº Fatura',  30, 'left'],
        ['Fornecedor', 50, 'left'],
        ['Data',       20, 'center'],
        ['Total (€)',  22, 'right'],
        ['IVA (€)',    18, 'right'],
        ['Estado',     18, 'center'],
        ['Ficheiro',   24, 'left'],
      ];

      const rowH = 7;
      let y = M;

      // ── Header ──
      const headerH = 14;

      // Logo
      if (logoDataUrl) {
        try {
          pdf.addImage(logoDataUrl, M, y + 1, 12, 12);
        } catch { /* ignora se formato não suportado */ }
      }

      const textX = logoDataUrl ? M + 14 : M;
      pdf.setTextColor(30, 41, 59); // slate-800
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.text(empresa.toUpperCase(), textX, y + 7);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7.5);
      pdf.setTextColor(100, 116, 139); // slate-500
      pdf.text(soReconciliadas ? 'Relatório de Faturas Reconciliadas' : 'Relatório de Faturas', textX, y + 12);

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7);
      pdf.setTextColor(30, 41, 59);
      pdf.text(`Emitido em ${hoje}`, pW - M, y + 7, { align: 'right' });
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(100, 116, 139);
      pdf.text(`${lista.length} fatura(s)`, pW - M, y + 12, { align: 'right' });

      y += headerH + 2;
      // Linha separadora
      pdf.setDrawColor(226, 232, 240);
      pdf.line(M, y, M + cW, y);
      y += 4;

      // ── Column headers ──
      pdf.setFillColor(241, 245, 249);
      pdf.rect(M, y, cW, rowH, 'F');
      pdf.setDrawColor(203, 213, 225);
      pdf.line(M, y + rowH, M + cW, y + rowH);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(6.5);
      pdf.setTextColor(100, 116, 139);

      let cx = M;
      for (const [label, w, align] of cols) {
        if (align === 'right') pdf.text(label, cx + w - 2, y + rowH - 2, { align: 'right' });
        else if (align === 'center') pdf.text(label, cx + w / 2, y + rowH - 2, { align: 'center' });
        else pdf.text(label, cx + 2, y + rowH - 2);
        cx += w;
      }
      y += rowH;

      // ── Data rows ──
      const truncate = (text, maxW, pdf) => {
        let t = String(text ?? '—');
        while (t.length > 1 && pdf.getTextWidth(t) > maxW) t = t.slice(0, -1);
        return t.length < String(text ?? '—').length ? t.slice(0, -1) + '…' : t;
      };

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7.5);

      for (let i = 0; i < lista.length; i++) {
        if (y + rowH > pH - M - 10) {
          pdf.addPage();
          y = M;
        }

        const d = lista[i].dados || {};

        if (i % 2 === 1) {
          pdf.setFillColor(248, 250, 252);
          pdf.rect(M, y, cW, rowH, 'F');
        }
        pdf.setDrawColor(226, 232, 240);
        pdf.line(M, y + rowH, M + cW, y + rowH);

        const values = [
          d.numero_fatura,
          d.fornecedor,
          d.data_fatura,
          d.valor_total != null ? Number(d.valor_total).toFixed(2) + ' €' : '—',
          d.iva != null ? Number(d.iva).toFixed(2) + ' €' : '—',
          lista[i].status === 'PAGO' ? '✓ Pago' : 'Pendente',
          lista[i].filename,
        ];

        cx = M;
        pdf.setTextColor(30, 41, 59);
        for (let c = 0; c < cols.length; c++) {
          const [, w, align] = cols[c];
          const cell = truncate(values[c], w - 4, pdf);
          const ty = y + rowH - 2;
          if (align === 'right') pdf.text(cell, cx + w - 2, ty, { align: 'right' });
          else if (align === 'center') pdf.text(cell, cx + w / 2, ty, { align: 'center' });
          else pdf.text(cell, cx + 2, ty);
          cx += w;
        }
        y += rowH;
      }

      // ── Totals footer ──
      y += 1;
      pdf.setFillColor(79, 70, 229);
      pdf.rect(M, y, cW, rowH + 1, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.text('TOTAL', M + 3, y + rowH - 1);

      cx = M;
      for (const [, w, align] of cols.slice(0, 3)) { cx += w; }
      pdf.text(totalValor.toFixed(2) + ' €', cx + cols[3][1] - 2, y + rowH - 1, { align: 'right' });
      cx += cols[3][1];
      pdf.setTextColor(199, 210, 254);
      pdf.text(totalIva.toFixed(2) + ' €', cx + cols[4][1] - 2, y + rowH - 1, { align: 'right' });

      pdf.save(`${soReconciliadas ? 'reconciliadas' : 'faturas'}_${hoje.replace(/\//g, '-')}.pdf`);
    } catch (e) {
      alert('Erro ao gerar PDF: ' + e.message);
    } finally {
      setGerandoPdf(false);
    }
  };

  const formatDate = (iso) => !iso ? '—' : new Date(iso).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const todosSelec = faturasFiltradas.length > 0 && faturasFiltradas.every(f => selecionados.has(f.id));
  const algunsSelec = faturasFiltradas.some(f => selecionados.has(f.id)) && !todosSelec;

  const ThSort = ({ campo, label }) => (
    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 cursor-pointer select-none hover:text-slate-600 transition-colors" onClick={() => toggleOrdem(campo)}>
      <span className="flex items-center gap-1">{label}<IconeOrdem campo={campo} /></span>
    </th>
  );

  // Célula editável
  const CelEdit = ({ fatura, campo, valor, className = '', tipo = 'text', placeholder = '—' }) => {
    const editando = celEdit?.id === fatura.id && celEdit?.campo === campo;
    if (editando) {
      return (
        <td className="px-2 py-2" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-1">
            <input ref={inputRef} type={tipo} value={celValor} onChange={e => setCelValor(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full px-2 py-1 rounded-lg border border-indigo-300 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
              style={{ minWidth: 80 }} />
            <button onClick={guardarEdit} disabled={salvandoCell}
              className="p-1 text-emerald-600 hover:text-emerald-700 disabled:opacity-50"><Check size={13} /></button>
            <button onClick={cancelarEdit} className="p-1 text-slate-400 hover:text-slate-600"><X size={13} /></button>
          </div>
        </td>
      );
    }
    return (
      <td className={`px-4 py-3 group relative ${className}`} onClick={e => e.stopPropagation()}
        onDoubleClick={e => abrirEdit(e, fatura, campo, valor)}>
        <span className="cursor-default">{valor !== null && valor !== undefined && valor !== '' ? valor : <span className="text-slate-300">—</span>}</span>
        <button onClick={e => abrirEdit(e, fatura, campo, valor)}
          className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1 text-slate-300 hover:text-indigo-500">
          <Pencil size={11} />
        </button>
      </td>
    );
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">

      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl sm:text-2xl font-black flex items-center gap-2">
          <FileText size={22} className="text-emerald-600" />
          Faturas Importadas
        </h2>
        <div className="flex items-center gap-2">
          <button onClick={() => gerarPDF(faturas.filter(f => f.status === 'PAGO'))} disabled={gerandoPdf || faturas.filter(f => f.status === 'PAGO').length === 0}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-emerald-700 transition-all disabled:opacity-50 shadow-sm">
            {gerandoPdf ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            <span className="hidden sm:inline">Reconciliadas</span>
          </button>
          <button onClick={() => gerarPDF()} disabled={gerandoPdf || faturasFiltradas.length === 0}
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

      {/* Painel importação + config Gmail */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">Pesquisa Gmail activa</p>
            <p className="text-xs font-mono text-slate-500 break-all">{query}</p>
          </div>
          <button onClick={() => setMostrarConfig(v => !v)}
            className="flex items-center gap-1 px-3 py-2 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-indigo-600 transition-colors shrink-0">
            {mostrarConfig ? <ChevronUp size={14} /> : <ChevronDown size={14} />} Configurar
          </button>
        </div>

        {mostrarConfig && (
          <div className="border-t border-slate-100 pt-4 space-y-4">

            {/* Estado dos emails */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Estado dos emails</p>
              <div className="flex gap-3 flex-wrap">
                {[{ key: 'naoLidos', label: 'Sem ler' }, { key: 'lidos', label: 'Lidos' }].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" checked={cfg[key]} onChange={e => setCfgField(key, e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-300 cursor-pointer" />
                    <span className="text-xs font-black uppercase tracking-widest text-slate-600">{label}</span>
                  </label>
                ))}
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" checked={cfg.temAnexo} onChange={e => setCfgField('temAnexo', e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-300 cursor-pointer" />
                  <span className="text-xs font-black uppercase tracking-widest text-slate-600">Tem anexo</span>
                </label>
              </div>
            </div>

            {/* Assuntos */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Palavras no assunto</p>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {cfg.assuntos.map(a => (
                  <span key={a} className="flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-semibold">
                    {a}
                    <button onClick={() => removeAssunto(a)} className="text-indigo-400 hover:text-indigo-700"><X size={11} /></button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input value={assuntoInput} onChange={e => setAssuntoInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addAssunto(); } }}
                  placeholder="ex: recibo, nota de crédito..."
                  className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                <button onClick={addAssunto}
                  className="px-3 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-black hover:bg-indigo-100 transition-colors">
                  Adicionar
                </button>
              </div>
            </div>

            {/* Remetente */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Remetente (from:)</p>
              <input value={cfg.remetente} onChange={e => setCfgField('remetente', e.target.value)}
                placeholder="ex: fornecedor@empresa.pt"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>

            {/* Palavras extra */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Outros filtros (sintaxe Gmail)</p>
              <input value={cfg.palavras} onChange={e => setCfgField('palavras', e.target.value)}
                placeholder='ex: larger:1M after:2024/01/01'
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>

            <div className="flex items-center gap-2 justify-end pt-1">
              <button onClick={() => { setCfg(DEFAULT_CONFIG); setAssuntoInput(''); }}
                className="px-3 py-2 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors">
                Repor padrão
              </button>
              <button onClick={() => guardarConfig(cfg)}
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
              {importResult.error ? `Erro: ${importResult.error}` : `${importResult.processados} email(s) · ${importResult.ficheiros} ficheiro(s)${importResult.erros?.length ? ` · ${importResult.erros.length} erro(s)` : ''}`}
            </span>
          )}
        </div>
      </div>

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
              <input type="number" min="0" step="0.01" value={filtroValorMin} onChange={e => setFiltroValorMin(e.target.value)} placeholder="0.00"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Valor máx (€)</label>
              <input type="number" min="0" step="0.01" value={filtroValorMax} onChange={e => setFiltroValorMax(e.target.value)} placeholder="9999.00"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
          </div>
        )}
      </div>

      {/* Pills de filtro por status */}
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
              className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filtroStatus === key ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}>
              {jsx ?? label}
            </button>
          ))}
        </div>
      )}

      {/* Barra de acções em lote */}
      {selecionados.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl flex-wrap">
          <span className="text-xs font-black text-slate-600 uppercase tracking-widest">{selecionados.size} selecionada(s)</span>
          <button onClick={() => gerarPDF()} disabled={gerandoPdf}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-700 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-900 transition-all disabled:opacity-50">
            {gerandoPdf ? <Loader2 size={13} className="animate-spin" /> : <Printer size={13} />}
            PDF
          </button>
          <button onClick={handleReextrairSelecionados} disabled={extraindo}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all disabled:opacity-50">
            {extraindo ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            Reextrair com IA
          </button>
          <button onClick={handleApagarSelecionados} disabled={apagando}
            className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-700 transition-all disabled:opacity-50">
            {apagando ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
            Apagar
          </button>
          <button onClick={() => setSelecionados(new Set())} className="text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors">Cancelar</button>
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
          <div className="px-5 py-3 border-b border-slate-50">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Duplo clique numa célula para editar · <span className="text-indigo-400">Enter</span> para guardar · <span className="text-slate-400">Esc</span> para cancelar</p>
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
                    <tr key={f.id} className={`border-b border-slate-50 transition-colors ${sel ? 'bg-indigo-50/50' : i % 2 === 0 ? 'hover:bg-slate-50' : 'bg-slate-50/40 hover:bg-slate-100/60'}`}
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
                      <CelEdit fatura={f} campo="numero_fatura" valor={d.numero_fatura} className="text-xs font-mono text-slate-600" />
                      <CelEdit fatura={f} campo="fornecedor" valor={d.fornecedor} className="text-xs text-slate-600 max-w-[160px] truncate" />
                      <CelEdit fatura={f} campo="data_fatura" valor={d.data_fatura} tipo="date" className="text-xs text-slate-500 whitespace-nowrap" />
                      <CelEdit fatura={f} campo="valor_total" valor={d.valor_total != null ? Number(d.valor_total).toFixed(2) : null} tipo="number" className="text-xs font-semibold text-slate-700 whitespace-nowrap" />
                      <CelEdit fatura={f} campo="iva" valor={d.iva != null ? Number(d.iva).toFixed(2) : null} tipo="number" className="text-xs text-slate-500 whitespace-nowrap" />
                      <td className="px-4 py-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        {f.status === 'PAGO'
                          ? <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase tracking-widest"><CheckCircle size={11} /> Pago</span>
                          : <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 text-amber-600 text-[10px] font-black uppercase tracking-widest">Pendente</span>
                        }
                      </td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          <a href={f.url} target="_blank" rel="noopener noreferrer" className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors" title="Abrir"><ExternalLink size={14} /></a>
                          <a href={f.url} download={f.filename} className="p-1.5 text-slate-400 hover:text-emerald-600 transition-colors" title="Download"><Download size={14} /></a>
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
    </div>
  );
}
