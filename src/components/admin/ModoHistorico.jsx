import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Loader2, RefreshCw, Download, FileDown, X,
  ChevronRight, CheckCircle, AlertTriangle, XCircle, AlertCircle,
  Upload, Coins, Trash2, ScanSearch, ReceiptText, Files, Settings,
} from 'lucide-react';
import {
  MESES_PT,
  mesesDisponiveis,
  normalizarNome,
  encontrarWorker,
  aplicarOverrideSempreValido,
  formatarMes,
  calcularTolerancias,
  calcularBrutoDeMes,
  guardarValidacoesEmLote,
  ESTADO_PT,
  ESTADO_BADGE,
} from '../../utils/validacaoHelpers';
import {
  associarDocumentoAoTrabalhador,
  separarRecibosTOConline,
} from '../../utils/separarRecibosTOConline';
import {
  extrairPaginasPdf,
  extrairMetadadosTOConline,
  parseReciboTOConline,
} from '../../utils/validarReciboTOConline';
import { DivergenciaBadge, EstadoPicker } from './ValidacaoUI';

// ─── Modal de exportação ──────────────────────────────────────────────────────
function ExportModal({ show, onClose, onExportPdf, onExportCsv, exportFilters, setExportFilters, years, availableMonths, workers }) {
  if (!show) return null;
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100]">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-black text-slate-800">Exportar Relatório</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Ano</label>
            <select value={exportFilters.ano} onChange={e => setExportFilters(f => ({ ...f, ano: e.target.value, mes: '' }))}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">Todos os anos</option>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Mês</label>
            <select value={exportFilters.mes} onChange={e => setExportFilters(f => ({ ...f, mes: e.target.value }))}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">Todos os meses</option>
              {availableMonths.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Trabalhador</label>
            <select value={exportFilters.workerId} onChange={e => setExportFilters(f => ({ ...f, workerId: e.target.value }))}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">Todos os trabalhadores</option>
              {workers.filter(w => !w.isAdmin).sort((a, b) => a.name.localeCompare(b.name)).map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex gap-2 pt-2">
          <button onClick={onExportPdf} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors">
            <FileDown size={14} /> PDF
          </button>
          <button onClick={onExportCsv} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-colors">
            <FileDown size={14} /> CSV
          </button>
          <button onClick={onClose} className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 transition-colors">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}


// ─── Componente principal ─────────────────────────────────────────────────────
const ModoHistorico = ({ workers, logs = [], saveToDb, systemSettings, saveSystemSettings }) => {
  // — Estado da lista mensal —
  const [registos, setRegistos] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [filtroWorker, setFiltroWorker] = useState('');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFilters, setExportFilters] = useState({ ano: '', mes: '', workerId: '' });

  // — Estado do processamento —
  const [uploadAberto, setUploadAberto] = useState(false);
  const [files, setFiles] = useState([]);
  const [processando, setProcessando] = useState(false);
  const [expandidoId, setExpandidoId] = useState(null);
  const [erroProcessamento, setErroProcessamento] = useState(null);
  const [configAberto, setConfigAberto] = useState(false);
  const [tolValidoLocal, setTolValidoLocal] = useState(String(systemSettings?.toleranciaValido ?? 0.77));
  const [tolAvisoLocal,  setTolAvisoLocal]  = useState(String(systemSettings?.toleranciaAviso  ?? 10));

  const fmtEur = v => (parseFloat(v) || 0).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  const fmtMesLabel = m => {
    if (!m) return '';
    const [year, month] = m.split('-');
    return `${MESES_PT[parseInt(month) - 1]} ${year}`;
  };

  const years = useMemo(() => {
    const ys = [...new Set(registos.map(r => r.mes?.split('-')[0]).filter(Boolean))];
    return ys.sort((a, b) => b - a);
  }, [registos]);

  const availableMonths = useMemo(() => {
    if (!exportFilters.ano) return mesesDisponiveis;
    return mesesDisponiveis.filter(m => m.value.startsWith(exportFilters.ano));
  }, [exportFilters.ano]);

  // — Carregar lista da BD —
  const carregar = useCallback(async () => {
    const db = window.supabaseInstance;
    if (!db) return;
    setCarregando(true);
    const { data } = await db
      .from('receipt_validations')
      .select('*')
      .order('mes', { ascending: false })
      .limit(500);
    setRegistos(data ?? []);
    setCarregando(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  // — Guardar tolerâncias —
  const guardarTolerancias = () => {
    if (!saveSystemSettings) return;
    const v = parseFloat(tolValidoLocal.replace(',', '.'));
    const a = parseFloat(tolAvisoLocal.replace(',', '.'));
    if (Number.isNaN(v) || Number.isNaN(a) || v < 0 || a <= v) return;
    saveSystemSettings({ ...systemSettings, toleranciaValido: v, toleranciaAviso: a });
  };

  // — Processar PDFs e guardar automaticamente —
  const handleProcessar = async () => {
    if (!files.length) return;
    setProcessando(true);
    setErroProcessamento(null);
    const tolerancias = calcularTolerancias(systemSettings);
    try {
      const res = [];
      for (const file of files) {
        try {
          const paginas = await extrairPaginasPdf(file);
          const paginasRecibo = paginas.filter(p => p.includes('Emitido por TOConline'));
          if (!paginasRecibo.length) {
            res.push({ sucesso: false, mensagem: `${file.name}: documento não reconhecido como TOConline.` });
          } else {
            for (const texto of paginasRecibo) {
              const { nome, mes } = extrairMetadadosTOConline(texto);
              const worker = nome ? encontrarWorker(nome, workers) : null;
              const bruto  = calcularBrutoDeMes(worker, mes, logs);
              const validacao = aplicarOverrideSempreValido(parseReciboTOConline(texto, bruto, tolerancias), worker);
              res.push({ nomeExtraido: nome ?? '—', worker, mes: mes ?? '—', bruto, sucesso: true, ...validacao });
            }
          }
        } catch (err) {
          res.push({ sucesso: false, mensagem: `${file.name}: ${err.message}` });
        }
      }
      const agregados = {};
      for (const r of res) {
        if (!r.sucesso) continue;
        const key = `${r.worker?.id ?? normalizarNome(r.nomeExtraido ?? '')}|${r.mes}`;
        if (!agregados[key]) {
          agregados[key] = { ...r };
        } else {
          const ex = agregados[key];
          ex.bruto = (ex.bruto || 0) + (r.bruto || 0);
          if (r.liquidoExtraido != null)  ex.liquidoExtraido  = (ex.liquidoExtraido  || 0) + r.liquidoExtraido;
          if (r.abonosExtraidos != null)  ex.abonosExtraidos  = (ex.abonosExtraidos  || 0) + r.abonosExtraidos;
          if (r.ssExtraido != null)       ex.ssExtraido       = (ex.ssExtraido       || 0) + r.ssExtraido;
          if (r.irsExtraido != null)      ex.irsExtraido      = (ex.irsExtraido      || 0) + r.irsExtraido;
        }
      }
      const deduplicados = Object.values(agregados);
      if (!deduplicados.length) throw new Error('Nenhum recibo TOConline reconhecido nos ficheiros.');
      const sessionId = crypto.randomUUID();
      await guardarValidacoesEmLote(deduplicados, sessionId);
      await carregar();
      setFiles([]);
      setUploadAberto(false);
    } catch (err) {
      setErroProcessamento(err.message);
    } finally {
      setProcessando(false);
    }
  };

  // — Acções sobre registos —
  const alterarEstado = async (id, novoEstado) => {
    const db = window.supabaseInstance;
    if (!db) return;
    const patch = {
      estado: novoEstado,
      mensagem: `Estado alterado manualmente para "${ESTADO_PT[novoEstado] ?? novoEstado}" pelo administrador.`,
      ...(novoEstado === 'valido' ? { divergencia: 0 } : {}),
    };
    const { error } = await db.from('receipt_validations').update(patch).eq('id', id);
    if (error) { console.error(error); return; }
    setRegistos(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
  };

  const atualizarExtracaoPdf = async (updates) => {
    const db = window.supabaseInstance;
    if (!db) return;
    for (const { id, ...campos } of updates) {
      await db.from('receipt_validations').update(campos).eq('id', id);
    }
    setRegistos(prev => prev.map(r => { const u = updates.find(u => u.id === r.id); return u ? { ...r, ...u } : r; }));
  };

  const apagarRegisto = async (id) => {
    const db = window.supabaseInstance;
    if (!db) return;
    await db.from('receipt_validations').delete().eq('id', id);
    setRegistos(prev => prev.filter(r => r.id !== id));
  };

  const apagarMes = async (registosMes) => {
    const db = window.supabaseInstance;
    if (!db) return;
    const ids = registosMes.map(r => r.id);
    await db.from('receipt_validations').delete().in('id', ids);
    setRegistos(prev => prev.filter(r => !ids.includes(r.id)));
  };

  const adicionarACustosMes = async (registosMes) => {
    const totais = registosMes.reduce((acc, r) => {
      if (r.estado !== 'valido' && r.estado !== 'aviso') return acc;
      if (!r.mes) return acc;
      if (!acc[r.mes]) acc[r.mes] = { ss: 0, irs: 0 };
      acc[r.mes].ss  += Number(r.ss_extraido)  || 0;
      acc[r.mes].irs += Number(r.irs_extraido) || 0;
      return acc;
    }, {});
    for (const [mes, t] of Object.entries(totais)) {
      const dataMes = `${mes}-01`;
      const mesNome = formatarMes(mes);
      if (t.ss > 0) {
        const id = `e${Date.now()}_ss_${mes}`;
        await saveToDb('expenses', id, { id, name: `Segurança Social - ${mesNome}`, amount: parseFloat(t.ss.toFixed(2)), type: 'variável', date: dataMes });
      }
      if (t.irs > 0) {
        const id = `e${Date.now()}_irs_${mes}`;
        await saveToDb('expenses', id, { id, name: `IRS - ${mesNome}`, amount: parseFloat(t.irs.toFixed(2)), type: 'variável', date: dataMes });
      }
    }
  };

  const enviarRecibosMes = async (resultados) => {
    const supabase = window.supabaseInstance;
    if (!supabase) throw new Error('Sem ligação à base de dados.');
    const erros = [];
    for (const r of resultados) {
      const worker = r.nome ? encontrarWorker(r.nome, workers) : null;
      if (!worker) { erros.push(`${r.nif}: trabalhador não encontrado`); continue; }
      try { await associarDocumentoAoTrabalhador({ ...r, worker, supabase }); }
      catch (e) { erros.push(`${worker.name}: ${e.message}`); }
    }
    if (erros.length) throw new Error(erros.join(' | '));
  };

  // — Agrupamento —
  const registosFiltrados = useMemo(
    () => registos.filter(r => !filtroWorker || r.worker_id === filtroWorker),
    [registos, filtroWorker]
  );



  // — Exportação —
  const handleExportPdf = () => {
    let data = registosFiltrados;
    if (exportFilters.ano) data = data.filter(r => r.mes?.startsWith(exportFilters.ano));
    if (exportFilters.mes) data = data.filter(r => r.mes === exportFilters.mes);
    if (exportFilters.workerId) data = data.filter(r => r.worker_id === exportFilters.workerId);
    if (!data.length) return;

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const margin = 15;
    let yPos = margin;
    try { doc.addImage('/MAGNETIC (3).png', 'PNG', margin, yPos, 25, 25); } catch {}
    doc.setFontSize(18); doc.setTextColor(30);
    doc.text('Relatório de Recibos', margin + 30, yPos + 8);
    doc.setFontSize(9); doc.setTextColor(120);
    doc.text(`Gerado em ${new Date().toLocaleDateString('pt-PT')} — ${data.length} registo(s)`, margin + 30, yPos + 16);
    yPos += 32;

    const byMonth = {};
    data.forEach(r => {
      const m = r.mes || 'Sem mês';
      if (!byMonth[m]) byMonth[m] = { count: 0, ss: 0, irs: 0, ajudas: 0, liquido: 0 };
      byMonth[m].count++;
      byMonth[m].ss      += Number(r.ss_extraido) || 0;
      byMonth[m].irs     += Number(r.irs_extraido) || 0;
      byMonth[m].ajudas  += Number(r.ajudas_custo_extraidas) || 0;
      byMonth[m].liquido += Number(r.liquido_extraido) || 0;
    });
    const totalSS  = data.reduce((s, r) => s + (Number(r.ss_extraido) || 0), 0);
    const totalIRS = data.reduce((s, r) => s + (Number(r.irs_extraido) || 0), 0);
    const totalLiq = data.reduce((s, r) => s + (Number(r.liquido_extraido) || 0), 0);

    doc.setFontSize(11); doc.setTextColor(30);
    doc.text('Resumo por Mês', margin, yPos); yPos += 4;
    autoTable(doc, {
      startY: yPos,
      head: [['Mês', 'Recibos', 'SS', 'IRS', 'Ajudas', 'Líquido']],
      body: [
        ...Object.entries(byMonth).sort((a, b) => b[0].localeCompare(a[0])).map(([m, v]) => [
          fmtMesLabel(m), v.count, fmtEur(v.ss), fmtEur(v.irs), fmtEur(v.ajudas), fmtEur(v.liquido),
        ]),
        ['TOTAL', data.length, fmtEur(totalSS), fmtEur(totalIRS), fmtEur(data.reduce((s, r) => s + (Number(r.ajudas_custo_extraidas) || 0), 0)), fmtEur(totalLiq)],
      ],
      styles: { fontSize: 7, cellPadding: 1.2 },
      headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: margin, right: margin },
      didParseCell: d => {
        if (d.section === 'body' && d.row.index === Object.keys(byMonth).length) {
          d.cell.styles.fillColor = [220, 220, 255]; d.cell.styles.fontStyle = 'bold';
        }
      },
    });
    doc.save(`recibos_${new Date().toISOString().slice(0, 10)}.pdf`);
    setShowExportModal(false);
  };

  const handleExportCsv = () => {
    let data = registosFiltrados;
    if (exportFilters.ano) data = data.filter(r => r.mes?.startsWith(exportFilters.ano));
    if (exportFilters.mes) data = data.filter(r => r.mes === exportFilters.mes);
    if (exportFilters.workerId) data = data.filter(r => r.worker_id === exportFilters.workerId);
    const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = ['Trabalhador', 'Mês', 'SS', 'IRS', 'Ajudas', 'Líquido', 'Estado'].map(esc).join(';');
    const rows = data.map(r => [
      esc(r.worker_name ?? ''), esc(r.mes ?? ''),
      esc(r.ss_extraido ?? ''), esc(r.irs_extraido ?? ''),
      esc(r.ajudas_custo_extraidas ?? ''), esc(r.liquido_extraido ?? ''), esc(r.estado ?? ''),
    ].join(';'));
    const blob = new Blob(['﻿' + [header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `recibos_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
    setShowExportModal(false);
  };

  return (
    <div className="space-y-4">

      {/* ── Secção de processamento ── */}
      <div className="rounded-2xl border border-slate-100 overflow-hidden">
        <button
          onClick={() => setUploadAberto(o => !o)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <ReceiptText size={15} className="text-indigo-500" />
            <span className="text-sm font-black text-slate-700">Processar novos recibos</span>
          </div>
          <ChevronRight size={15} className={`text-slate-400 transition-transform ${uploadAberto ? 'rotate-90' : ''}`} />
        </button>

        {uploadAberto && (
          <div className="border-t border-slate-100 p-4 space-y-3">
            {/* Tolerâncias */}
            <div className="flex justify-end">
              <button onClick={() => setConfigAberto(o => !o)}
                className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600 transition-colors">
                <Settings size={12} /> Tolerâncias
                <ChevronRight size={11} className={`transition-transform ${configAberto ? 'rotate-90' : ''}`} />
              </button>
            </div>
            {configAberto && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-emerald-600 block mb-1">Válido até (€)</label>
                    <input type="number" min="0" step="0.01" value={tolValidoLocal}
                      onChange={e => setTolValidoLocal(e.target.value)} onBlur={guardarTolerancias}
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-yellow-600 block mb-1">Aviso até (€)</label>
                    <input type="number" min="0" step="0.01" value={tolAvisoLocal}
                      onChange={e => setTolAvisoLocal(e.target.value)} onBlur={guardarTolerancias}
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-yellow-500" />
                  </div>
                </div>
              </div>
            )}

            {/* Upload */}
            <label className="flex flex-col items-center justify-center gap-2 p-6 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-all">
              <Files size={24} className="text-slate-300" />
              <span className="text-sm font-bold text-slate-500">
                {files.length > 0
                  ? `${files.length} ficheiro${files.length > 1 ? 's' : ''} selecionado${files.length > 1 ? 's' : ''}`
                  : 'Clique para selecionar PDF(s)'}
              </span>
              <span className="text-[10px] text-slate-400">1 PDF agregado ou vários PDFs individuais</span>
              <input type="file" accept=".pdf" multiple className="hidden" onChange={e => { setFiles(Array.from(e.target.files).filter(f => f.type === 'application/pdf')); setErroProcessamento(null); }} />
            </label>

            <button onClick={handleProcessar} disabled={!files.length || processando}
              className="w-full py-3 bg-indigo-600 text-white rounded-xl text-sm font-black uppercase tracking-widest hover:bg-slate-900 transition-all shadow-md shadow-indigo-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {processando ? <Loader2 size={16} className="animate-spin" /> : <ReceiptText size={16} />}
              {processando ? 'A processar e guardar...' : files.length > 0 ? `Processar ${files.length} ficheiro${files.length > 1 ? 's' : ''}` : 'Processar'}
            </button>

            {erroProcessamento && <p className="text-xs text-red-500 font-medium">{erroProcessamento}</p>}
          </div>
        )}
      </div>

      {/* ── Barra de filtros ── */}
      <div className="flex gap-2">
        <select value={filtroWorker} onChange={e => setFiltroWorker(e.target.value)}
          className="flex-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">Todos os trabalhadores</option>
          {workers.filter(w => !w.isAdmin).sort((a, b) => a.name.localeCompare(b.name)).map(w => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
        <button onClick={carregar} disabled={carregando}
          className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 hover:text-indigo-600 hover:border-indigo-300 transition-all disabled:opacity-40">
          <RefreshCw size={15} className={carregando ? 'animate-spin' : ''} />
        </button>
        <div className="relative">
          <button onClick={() => setShowExportMenu(o => !o)}
            className="p-2.5 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-600 hover:bg-indigo-100 transition-all">
            <Download size={15} />
          </button>
          {showExportMenu && (
            <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden">
              <button onClick={() => { setShowExportModal(true); setShowExportMenu(false); }}
                className="flex items-center gap-2 w-full px-4 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap">
                <FileDown size={14} /> Exportar PDF / CSV
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Tabela de recibos ── */}
      {carregando && <div className="flex justify-center py-10"><Loader2 size={22} className="animate-spin text-indigo-400" /></div>}

      {!carregando && registosFiltrados.length === 0 && (
        <p className="text-center text-sm text-slate-400 py-10">Nenhum recibo guardado. Processe os PDFs acima para começar.</p>
      )}

      {!carregando && registosFiltrados.length > 0 && (
        <div className="rounded-xl border border-slate-100 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-3 py-2 text-left text-[9px] font-black uppercase tracking-widest text-slate-400">Trabalhador</th>
                <th className="px-3 py-2 text-left text-[9px] font-black uppercase tracking-widest text-slate-400">Mês</th>
                <th className="px-3 py-2 text-right text-[9px] font-black uppercase tracking-widest text-slate-400">Líquido</th>
                <th className="px-3 py-2 text-center text-[9px] font-black uppercase tracking-widest text-slate-400">Divergência</th>
                <th className="px-3 py-2 text-center text-[9px] font-black uppercase tracking-widest text-slate-400">Estado</th>
                <th className="px-3 py-2 w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {[...registosFiltrados].sort((a, b) => (b.mes ?? '').localeCompare(a.mes ?? '')).map(r => {
                const workerLabel = workers.find(w => w.id === r.worker_id)?.name ?? r.worker_name ?? '—';
                const estadoAtual = r.estado ?? 'erro';
                const aberto = expandidoId === r.id;
                return (
                  <React.Fragment key={r.id}>
                    <tr onClick={() => setExpandidoId(aberto ? null : r.id)} className="cursor-pointer hover:bg-slate-50 transition-colors select-none">
                      <td className="px-3 py-2.5 font-bold text-slate-800">
                        <div className="flex items-center gap-1.5">
                          <ChevronRight size={12} className={`text-slate-300 transition-transform shrink-0 ${aberto ? 'rotate-90' : ''}`} />
                          {workerLabel}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{r.mes ? formatarMes(r.mes) : '—'}</td>
                      <td className="px-3 py-2.5 text-right font-bold text-slate-700">{r.liquido_extraido != null ? `${Number(r.liquido_extraido).toFixed(2)}€` : '—'}</td>
                      <td className="px-3 py-2.5 text-center">
                        {r.divergencia != null ? <DivergenciaBadge sinal={r.divergencia} /> : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5">
                          <EstadoPicker atual={estadoAtual} onChange={novo => alterarEstado(r.id, novo)} />
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${ESTADO_BADGE[estadoAtual] ?? 'bg-slate-100 text-slate-500'}`}>
                            {ESTADO_PT[estadoAtual] ?? estadoAtual}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                        <button onClick={() => apagarRegisto(r.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                    {aberto && (
                      <tr className="bg-slate-50">
                        <td colSpan={6} className="px-4 py-3">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                            {[
                              ['Bruto plataforma', r.bruto_plataforma != null ? `${Number(r.bruto_plataforma).toFixed(2)}€` : '—'],
                              ['Bruto PDF',        r.abonos_extraidos != null ? `${Number(r.abonos_extraidos).toFixed(2)}€` : '—'],
                              ['Seg. Social',      r.ss_extraido != null ? `${Number(r.ss_extraido).toFixed(2)}€` : '—'],
                              ['IRS',              r.irs_extraido != null ? `${Number(r.irs_extraido).toFixed(2)}€` : '—'],
                            ].map(([label, val]) => (
                              <div key={label} className="bg-white rounded-xl p-2.5 text-center border border-slate-100">
                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">{label}</p>
                                <p className="text-sm font-black text-slate-800">{val}</p>
                              </div>
                            ))}
                          </div>
                          {r.mensagem && <p className="text-[10px] text-slate-500 mt-1">{r.mensagem}</p>}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ExportModal
        show={showExportModal}
        onClose={() => setShowExportModal(false)}
        onExportPdf={handleExportPdf}
        onExportCsv={handleExportCsv}
        exportFilters={exportFilters}
        setExportFilters={setExportFilters}
        years={years}
        availableMonths={availableMonths}
        workers={workers}
      />
    </div>
  );
};

export default ModoHistorico;
