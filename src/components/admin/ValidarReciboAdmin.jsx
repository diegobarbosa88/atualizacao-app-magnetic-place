import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, AlertCircle, AlertTriangle, Loader2, ReceiptText, Files, Save, FileDown, History, RefreshCw, ChevronRight, Settings, Coins } from 'lucide-react';
import {
  extrairPaginasPdf,
  extrairMetadadosTOConline,
  parseReciboTOConline,
} from '../../utils/validarReciboTOConline';
import { useApp } from '../../context/AppContext';

const MESES_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const mesesDisponiveis = Array.from({ length: 12 }, (_, i) => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - i);
  return { value: d.toISOString().slice(0, 7), label: `${MESES_PT[d.getMonth()]} ${d.getFullYear()}` };
});

function normalizarNome(str) {
  return str.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

// Trabalhadores isentos de validação automática — recibo é sempre marcado como válido
const TRABALHADORES_SEMPRE_VALIDOS = [
  'diego rocha barbosa',
  'nicole emanuele rosa da costa galtieri',
].map(normalizarNome);

function isWorkerSempreValido(worker) {
  if (!worker?.name) return false;
  return TRABALHADORES_SEMPRE_VALIDOS.includes(normalizarNome(worker.name));
}

function aplicarOverrideSempreValido(resultado, worker) {
  if (!resultado?.sucesso || !isWorkerSempreValido(worker)) return resultado;
  return {
    ...resultado,
    valido: true,
    aviso: false,
    divergencia: 0,
    divergenciaSinal: 0,
    mensagem: 'Recibo marcado como válido (trabalhador isento de validação automática).',
  };
}
function encontrarWorker(nomeExtraido, workers) {
  if (!nomeExtraido) return null;
  const n = normalizarNome(nomeExtraido);

  // 1. correspondência exata
  let found = workers.find(w => normalizarNome(w.name) === n);
  if (found) return found;

  // 2. um nome contém o outro (substring)
  found = workers.find(w => { const wn = normalizarNome(w.name); return wn.includes(n) || n.includes(wn); });
  if (found) return found;

  // 3. palavras significativas em comum (≥3 chars) — apanha "da/de" intercalados
  const nWords = n.split(/\s+/).filter(w => w.length >= 3);
  found = workers.find(w => {
    const wWords = normalizarNome(w.name).split(/\s+/).filter(w => w.length >= 3);
    const comuns = nWords.filter(nw => wWords.includes(nw));
    return comuns.length >= 2 && comuns.length / Math.max(nWords.length, wWords.length) >= 0.6;
  });
  return found ?? null;
}

// ─── Divergência com sinal ────────────────────────────────────────────────────
function DivergenciaBadge({ sinal, className = 'text-sm font-black' }) {
  if (sinal == null || sinal === 0) return <span className={`${className} text-slate-400`}>0,00€</span>;
  const pos = sinal > 0;
  return (
    <span className={`${className} ${pos ? 'text-emerald-600' : 'text-red-600'}`}>
      {pos ? '+' : ''}{sinal.toFixed(2).replace('.', ',')}€
    </span>
  );
}

// ─── Helpers de estado ────────────────────────────────────────────────────────
function IconEstado({ r, size = 16 }) {
  if (!r.sucesso) return <AlertCircle size={size} className="text-amber-500" />;
  if (r.valido)   return <CheckCircle  size={size} className="text-emerald-500" />;
  if (r.aviso)    return <AlertTriangle size={size} className="text-yellow-500" />;
  return                 <XCircle      size={size} className="text-red-500" />;
}

function estadoBg(r) {
  if (!r.sucesso) return 'bg-amber-50 border-amber-200';
  if (r.valido)   return 'bg-emerald-50 border-emerald-200';
  if (r.aviso)    return 'bg-yellow-50 border-yellow-200';
  return               'bg-red-50 border-red-200';
}

function estadoLabel(r) {
  if (!r.sucesso) return 'Erro';
  if (r.valido)   return 'Válido';
  if (r.aviso)    return 'Aviso';
  return               'Inválido';
}

// ─── Guardar no Supabase ───────────────────────────────────────────────────────
async function guardarValidacao(r, extra = {}) {
  const db = window.supabaseInstance;
  if (!db) throw new Error('Supabase não disponível');
  const { error } = await db.from('receipt_validations').insert({
    worker_id:        extra.worker?.id   ?? r.worker?.id   ?? null,
    worker_name:      extra.worker?.name ?? r.worker?.name ?? r.nomeExtraido ?? null,
    mes:              extra.mes  ?? r.mes  ?? null,
    bruto_plataforma: extra.bruto ?? r.bruto ?? null,
    abonos_extraidos: r.abonosExtraidos ?? null,
    ss_extraido:      r.ssExtraido      ?? null,
    irs_extraido:     r.irsExtraido     ?? null,
    liquido_extraido: r.liquidoExtraido ?? null,
    divergencia:      r.divergencia     ?? null,
    estado:           !r.sucesso ? 'erro' : r.valido ? 'valido' : r.aviso ? 'aviso' : 'invalido',
    mensagem:         r.mensagem ?? null,
    origem:           r.origem ?? extra.origem ?? null,
    session_id:       extra.sessionId ?? null,
  });
  if (error) throw error;
}

// ─── Modo Lote ────────────────────────────────────────────────────────────────
const ModoLote = ({ workers, logs, systemSettings, saveSystemSettings, saveToDb }) => {
  const [files, setFiles] = useState([]);
  const [resultados, setResultados] = useState([]);
  const [processando, setProcessando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [guardados, setGuardados] = useState(false);
  const [erroGuardar, setErroGuardar] = useState(null);
  const [expandido, setExpandido] = useState(null);
  const [adicionando, setAdicionando] = useState(false);
  const [adicionado, setAdicionado] = useState(false);
  const [erroAdicionar, setErroAdicionar] = useState(null);
  const [configAberto, setConfigAberto] = useState(false);
  const [tolValidoLocal, setTolValidoLocal] = useState(String(systemSettings?.toleranciaValido ?? 0.77));
  const [tolAvisoLocal,  setTolAvisoLocal]  = useState(String(systemSettings?.toleranciaAviso  ?? 10));

  const tolerancias = {
    valido: parseFloat(String(systemSettings?.toleranciaValido ?? 0.77).replace(',', '.')),
    aviso:  parseFloat(String(systemSettings?.toleranciaAviso  ?? 10).replace(',', '.')),
  };

  const guardarTolerancias = () => {
    const v = parseFloat(tolValidoLocal.replace(',', '.'));
    const a = parseFloat(tolAvisoLocal.replace(',', '.'));
    if (Number.isNaN(v) || Number.isNaN(a) || v < 0 || a <= v) return;
    saveSystemSettings({ ...systemSettings, toleranciaValido: v, toleranciaAviso: a });
  };

  const handleFiles = (e) => {
    const fs = Array.from(e.target.files).filter(f => f.type === 'application/pdf');
    setFiles(fs);
    setResultados([]);
    setGuardados(false);
    setErroGuardar(null);
    setAdicionado(false);
    setErroAdicionar(null);
  };

  const processarPagina = async (text, origem) => {
    const { nome, mes } = extrairMetadadosTOConline(text);
    const worker = nome ? encontrarWorker(nome, workers) : null;
    let bruto = 0;
    if (worker && mes) {
      const logsDoMes = logs.filter(l => l.workerId === worker.id && l.date?.startsWith(mes));
      const totalHoras = logsDoMes.reduce((s, l) => s + (parseFloat(l.hours) || 0), 0);
      bruto = totalHoras * (worker.valorHora || 0);
    }
    const validacao = aplicarOverrideSempreValido(parseReciboTOConline(text, bruto, tolerancias), worker);
    return { origem, nomeExtraido: nome ?? '—', worker: worker ?? null, mes: mes ?? '—', bruto, ...validacao };
  };

  const handleProcessar = async () => {
    if (!files.length) return;
    setProcessando(true);
    setResultados([]);
    setGuardados(false);
    setErroGuardar(null);
    const res = [];
    for (const file of files) {
      try {
        const paginas = await extrairPaginasPdf(file);
        const paginasRecibo = paginas.filter(p => p.includes('Emitido por TOConline'));
        if (paginasRecibo.length === 0) {
          res.push({ origem: file.name, nomeExtraido: '—', worker: null, mes: '—', bruto: 0, sucesso: false, valido: false, aviso: false, mensagem: 'Documento não reconhecido como recibo TOConline.' });
        } else {
          for (const texto of paginasRecibo) {
            res.push(await processarPagina(texto, file.name));
          }
        }
      } catch (err) {
        res.push({ origem: file.name, nomeExtraido: '—', worker: null, mes: '—', bruto: 0, sucesso: false, valido: false, aviso: false, mensagem: `Erro: ${err.message}` });
      }
    }
    // Remove cópias duplicadas (ORIGINAL/DUPLICADO/TRIPLICADO em páginas separadas):
    // mesmo trabalhador + mesmo mês = mesmo recibo impresso várias vezes
    const seen = new Set();
    const deduplicados = res.filter(r => {
      const key = `${r.worker?.id ?? normalizarNome(r.nomeExtraido ?? '')}|${r.mes}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    setResultados(deduplicados);
    setProcessando(false);
  };

  // Agrupa SS + IRS por mês — usado pelo botão "Adicionar a Custos"
  const totaisPorMes = resultados.reduce((acc, r) => {
    if (!r.sucesso || r.mes === '—' || !r.mes) return acc;
    if (!acc[r.mes]) acc[r.mes] = { ss: 0, irs: 0 };
    acc[r.mes].ss  += r.ssExtraido  ?? 0;
    acc[r.mes].irs += r.irsExtraido ?? 0;
    return acc;
  }, {});

  const handleAdicionarACustos = async () => {
    setAdicionando(true);
    setErroAdicionar(null);
    try {
      const entradas = Object.entries(totaisPorMes);
      for (const [mes, totais] of entradas) {
        const dataMes = `${mes}-01`;
        const mesNome = formatarMes(mes);
        if (totais.ss > 0) {
          const id = `e${Date.now()}_ss_${mes}`;
          await saveToDb('expenses', id, {
            id, name: `Segurança Social - ${mesNome}`,
            amount: parseFloat(totais.ss.toFixed(2)),
            type: 'variável', date: dataMes,
          });
        }
        if (totais.irs > 0) {
          const id = `e${Date.now()}_irs_${mes}`;
          await saveToDb('expenses', id, {
            id, name: `IRS - ${mesNome}`,
            amount: parseFloat(totais.irs.toFixed(2)),
            type: 'variável', date: dataMes,
          });
        }
      }
      setAdicionado(true);
    } catch (e) {
      setErroAdicionar(e.message);
    } finally {
      setAdicionando(false);
    }
  };

  const handleGuardarTodos = async () => {
    setGuardando(true);
    setErroGuardar(null);
    try {
      const sessionId = crypto.randomUUID();
      await Promise.all(resultados.map(r => guardarValidacao(r, { sessionId })));
      setGuardados(true);
    } catch (e) {
      setErroGuardar(e.message);
    } finally {
      setGuardando(false);
    }
  };

  const handleExportarPDF = async () => {
    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    pdf.setFontSize(15);
    pdf.setFont(undefined, 'bold');
    pdf.text('Relatório de Validação de Recibos', 14, 18);

    pdf.setFontSize(8);
    pdf.setFont(undefined, 'normal');
    pdf.text(`Gerado em ${new Date().toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' })}`, 14, 25);

    const nValidos   = resultados.filter(r => r.sucesso && r.valido).length;
    const nAvisos    = resultados.filter(r => r.sucesso && !r.valido && r.aviso).length;
    const nInvalidos = resultados.filter(r => r.sucesso && !r.valido && !r.aviso).length;
    const nErros     = resultados.filter(r => !r.sucesso).length;
    pdf.text(`Total: ${resultados.length}  |  Válidos: ${nValidos}  |  Avisos: ${nAvisos}  |  Inválidos: ${nInvalidos}  |  Erros: ${nErros}`, 14, 32);

    const cols = [
      { label: 'Trabalhador',   w: 50 },
      { label: 'Mês',           w: 22 },
      { label: 'Bruto €',       w: 22 },
      { label: 'SS €',          w: 18 },
      { label: 'IRS €',         w: 18 },
      { label: 'Líquido PDF €', w: 28 },
      { label: 'Diverg. €',     w: 22 },
      { label: 'Estado',        w: 20 },
    ];

    let y = 40;
    pdf.setFontSize(7);
    pdf.setFont(undefined, 'bold');
    let x = 14;
    cols.forEach(col => { pdf.text(col.label, x, y); x += col.w; });
    y += 2;
    pdf.setDrawColor(180, 180, 180);
    pdf.line(14, y, 14 + cols.reduce((a, c) => a + c.w, 0), y);
    y += 4;
    pdf.setFont(undefined, 'normal');

    const larguraTotal = cols.reduce((a, c) => a + c.w, 0);

    resultados.forEach(r => {
      const row = [
        (r.worker?.name ?? r.nomeExtraido ?? '—').slice(0, 30),
        r.mes !== '—' ? formatarMes(r.mes) : '—',
        r.bruto > 0 ? r.bruto.toFixed(2) : '—',
        r.ssExtraido      != null ? r.ssExtraido.toFixed(2)      : '—',
        r.irsExtraido     != null ? r.irsExtraido.toFixed(2)     : '—',
        r.liquidoExtraido != null ? r.liquidoExtraido.toFixed(2) : '—',
        r.divergenciaSinal != null
          ? (r.divergenciaSinal > 0 ? '+' : '') + r.divergenciaSinal.toFixed(2) + '€'
          : '—',
        estadoLabel(r),
      ];

      const invalido = r.sucesso && !r.valido && !r.aviso;
      if (invalido) {
        pdf.setFillColor(254, 226, 226); // red-100
        pdf.rect(14, y - 4, larguraTotal, 5, 'F');
        pdf.setTextColor(185, 28, 28);   // red-700
      } else {
        pdf.setTextColor(30, 41, 59);    // slate-800
      }

      x = 14;
      row.forEach((cell, i) => { pdf.text(String(cell), x, y); x += cols[i].w; });
      y += 5;
      if (y > 190) { pdf.addPage(); y = 20; }
    });

    pdf.setTextColor(0, 0, 0);

    pdf.save(`validacao-recibos-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const validos   = resultados.filter(r => r.sucesso && r.valido).length;
  const avisos    = resultados.filter(r => r.sucesso && !r.valido && r.aviso).length;
  const invalidos = resultados.filter(r => r.sucesso && !r.valido && !r.aviso).length;
  const erros     = resultados.filter(r => !r.sucesso).length;

  return (
    <div className="space-y-5">
      {/* Botão Configurar tolerâncias */}
      <div className="flex justify-end">
        <button onClick={() => setConfigAberto(o => !o)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-indigo-600 transition-colors">
          <Settings size={13} />
          Tolerâncias
          <ChevronRight size={12} className={`transition-transform ${configAberto ? 'rotate-90' : ''}`} />
        </button>
      </div>

      {configAberto && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Limites de validação (€)</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-emerald-600 block mb-1">Válido até</label>
              <input type="number" min="0" step="0.01" value={tolValidoLocal}
                onChange={e => setTolValidoLocal(e.target.value)}
                onBlur={guardarTolerancias}
                className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-yellow-600 block mb-1">Aviso até</label>
              <input type="number" min="0" step="0.01" value={tolAvisoLocal}
                onChange={e => setTolAvisoLocal(e.target.value)}
                onBlur={guardarTolerancias}
                className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-yellow-500" />
            </div>
          </div>
          <p className="text-[10px] text-slate-400">
            Divergência ≤ {tolValidoLocal}€ → válido · ≤ {tolAvisoLocal}€ → aviso · acima → inválido
          </p>
        </div>
      )}

      {/* Upload múltiplo */}
      <label className="flex flex-col items-center justify-center gap-2 p-8 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-all">
        <Files size={28} className="text-slate-300" />
        <span className="text-sm font-bold text-slate-500">
          {files.length > 0 ? `${files.length} ficheiro${files.length > 1 ? 's' : ''} selecionado${files.length > 1 ? 's' : ''}` : 'Clique para selecionar PDF(s)'}
        </span>
        <span className="text-[10px] text-slate-400">1 PDF com todos os recibos, ou vários PDFs separados</span>
        <input type="file" accept=".pdf" multiple className="hidden" onChange={handleFiles} />
      </label>

      <button onClick={handleProcessar} disabled={!files.length || processando}
        className="w-full py-3 bg-indigo-600 text-white rounded-xl text-sm font-black uppercase tracking-widest hover:bg-slate-900 transition-all shadow-md shadow-indigo-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
        {processando ? <Loader2 size={16} className="animate-spin" /> : <ReceiptText size={16} />}
        {processando ? 'A processar...' : files.length > 0 ? `Processar ${files.length} Ficheiro${files.length > 1 ? 's' : ''}` : 'Processar'}
      </button>

      {/* Sumário */}
      {resultados.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
            <p className="text-lg font-black text-emerald-600">{validos}</p>
            <p className="text-[9px] font-black uppercase tracking-widest text-emerald-500">Válidos</p>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-center">
            <p className="text-lg font-black text-yellow-600">{avisos}</p>
            <p className="text-[9px] font-black uppercase tracking-widest text-yellow-500">Avisos</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
            <p className="text-lg font-black text-red-500">{invalidos}</p>
            <p className="text-[9px] font-black uppercase tracking-widest text-red-400">Inválidos</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
            <p className="text-lg font-black text-amber-500">{erros}</p>
            <p className="text-[9px] font-black uppercase tracking-widest text-amber-400">Erros</p>
          </div>
        </div>
      )}

      {/* Tabela de resultados */}
      {resultados.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-slate-100">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-4 py-2.5 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Trabalhador</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Mês</th>
                <th className="px-4 py-2.5 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Bruto</th>
                <th className="px-4 py-2.5 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Líquido PDF</th>
                <th className="px-4 py-2.5 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {resultados.map((r, i) => (
                <React.Fragment key={i}>
                  <tr
                    onClick={() => setExpandido(expandido === i ? null : i)}
                    className="hover:bg-slate-50 transition-colors cursor-pointer select-none"
                  >
                    <td className="px-4 py-3">
                      <p className="font-bold text-slate-800">{r.worker?.name ?? <span className="text-amber-500 font-bold">Não encontrado</span>}</p>
                      {!r.worker && <p className="text-[10px] text-slate-400 truncate max-w-[160px]">{r.nomeExtraido}</p>}
                    </td>
                    <td className="px-4 py-3 text-slate-600 font-medium">{r.mes !== '—' ? formatarMes(r.mes) : '—'}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-700">{r.bruto > 0 ? `${r.bruto.toFixed(2)}€` : '—'}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-700">{r.liquidoExtraido != null ? `${r.liquidoExtraido.toFixed(2)}€` : '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <IconEstado r={r} />
                        {r.sucesso && r.divergenciaSinal != null && (
                          <DivergenciaBadge sinal={r.divergenciaSinal} className="text-xs font-bold" />
                        )}
                      </div>
                    </td>
                  </tr>

                  {expandido === i && (
                    <tr className="bg-slate-50">
                      <td colSpan={5} className="px-4 py-4">
                        <div className={`rounded-xl border p-4 space-y-3 ${estadoBg(r)}`}>
                          <p className="text-xs font-bold text-slate-700">{r.mensagem}</p>

                          {r.sucesso && (
                            <div className="grid grid-cols-3 gap-2">
                              {[['Seg. Social', r.ssExtraido], ['IRS', r.irsExtraido], ['Líquido', r.liquidoExtraido]].map(([label, val]) => (
                                <div key={label} className="bg-white rounded-xl p-3 text-center border border-slate-100">
                                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">{label}</p>
                                  <p className="text-sm font-black text-slate-800">{val?.toFixed(2)}€</p>
                                </div>
                              ))}
                            </div>
                          )}

                          {r.sucesso && !r.valido && (
                            <div className={`bg-white rounded-xl px-4 py-2.5 flex items-center justify-between border ${r.aviso ? 'border-yellow-100' : 'border-red-100'}`}>
                              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Divergência</span>
                              <DivergenciaBadge sinal={r.divergenciaSinal} />
                            </div>
                          )}

                          {!r.sucesso && r._textoExtraido && (
                            <details>
                              <summary className="text-[10px] font-black uppercase tracking-widest text-slate-400 cursor-pointer">Texto extraído (debug)</summary>
                              <pre className="mt-2 text-[10px] text-slate-600 bg-white border border-slate-200 rounded-xl p-3 overflow-auto max-h-40 whitespace-pre-wrap break-all">{r._textoExtraido}</pre>
                            </details>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Ações pós-processamento */}
      {resultados.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex gap-3 justify-end">
            <button onClick={handleAdicionarACustos} disabled={adicionando || adicionado || Object.keys(totaisPorMes).length === 0}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:border-emerald-400 hover:text-emerald-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
              {adicionando ? <Loader2 size={13} className="animate-spin" /> : <Coins size={13} />}
              {adicionado ? 'Adicionado a Custos' : 'Adicionar a Custos'}
            </button>
            <button onClick={handleGuardarTodos} disabled={guardando || guardados}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:border-indigo-400 hover:text-indigo-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
              {guardando ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              {guardados ? 'Guardado' : 'Guardar Todos'}
            </button>
            <button onClick={handleExportarPDF}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 transition-all shadow-sm shadow-indigo-200">
              <FileDown size={13} />
              Exportar PDF
            </button>
          </div>
          {Object.keys(totaisPorMes).length > 0 && (
            <p className="text-[10px] text-slate-400 text-right">
              {Object.entries(totaisPorMes).map(([mes, t]) =>
                `${formatarMes(mes)}: SS ${t.ss.toFixed(2)}€ + IRS ${t.irs.toFixed(2)}€`
              ).join('  ·  ')}
            </p>
          )}
          {erroGuardar   && <p className="text-[10px] text-red-500 text-right">{erroGuardar}</p>}
          {erroAdicionar && <p className="text-[10px] text-red-500 text-right">{erroAdicionar}</p>}
        </div>
      )}
    </div>
  );
};

// ─── Helper de formatação de mês ──────────────────────────────────────────────
function formatarMes(mesStr) {
  if (!mesStr || mesStr === '—') return '—';
  const [ano, m] = mesStr.split('-');
  return `${MESES_PT[parseInt(m, 10) - 1]} ${ano}`;
}

// ─── Modo Histórico ───────────────────────────────────────────────────────────
const ESTADO_BADGE = {
  valido:   'bg-emerald-100 text-emerald-700',
  aviso:    'bg-yellow-100 text-yellow-700',
  invalido: 'bg-red-100 text-red-600',
  erro:     'bg-amber-100 text-amber-700',
};
const ESTADO_PT = { valido: 'Válido', aviso: 'Aviso', invalido: 'Inválido', erro: 'Erro' };

function agruparPorSessao(registos) {
  const mapa = new Map();
  for (const r of registos) {
    const key = r.session_id ?? r.id;
    if (!mapa.has(key)) mapa.set(key, []);
    mapa.get(key).push(r);
  }
  return [...mapa.values()].sort((a, b) =>
    new Date(b[0].created_at) - new Date(a[0].created_at)
  );
}

function formatarDataHora(isoStr) {
  const d = new Date(isoStr);
  return d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })
    + ' · ' + d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
}

function SessaoRow({ sessao, onMarcarValido }) {
  const [aberto, setAberto] = useState(false);
  const [marcando, setMarcando] = useState(null); // id em curso
  const nValidos   = sessao.filter(r => r.estado === 'valido').length;
  const nAvisos    = sessao.filter(r => r.estado === 'aviso').length;
  const nInvalidos = sessao.filter(r => r.estado === 'invalido').length;
  const nErros     = sessao.filter(r => r.estado === 'erro').length;

  return (
    <>
      {/* Linha de sessão */}
      <tr
        onClick={() => setAberto(o => !o)}
        className="cursor-pointer hover:bg-slate-50 transition-colors select-none"
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <ChevronRight size={14} className={`text-slate-400 transition-transform shrink-0 ${aberto ? 'rotate-90' : ''}`} />
            <span className="text-xs font-bold text-slate-700 whitespace-nowrap">
              {formatarDataHora(sessao[0].created_at)}
            </span>
          </div>
        </td>
        <td className="px-4 py-3">
          <span className="text-xs text-slate-500 font-medium">
            {sessao.length} recibo{sessao.length !== 1 ? 's' : ''}
          </span>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            {nValidos   > 0 && <span className="flex items-center gap-1 text-[10px] font-black text-emerald-600"><CheckCircle size={11} />{nValidos}</span>}
            {nAvisos    > 0 && <span className="flex items-center gap-1 text-[10px] font-black text-yellow-600"><AlertTriangle size={11} />{nAvisos}</span>}
            {nInvalidos > 0 && <span className="flex items-center gap-1 text-[10px] font-black text-red-500"><XCircle size={11} />{nInvalidos}</span>}
            {nErros     > 0 && <span className="flex items-center gap-1 text-[10px] font-black text-amber-500"><AlertCircle size={11} />{nErros}</span>}
          </div>
        </td>
      </tr>

      {/* Sub-tabela expandida */}
      {aberto && (
        <tr>
          <td colSpan={3} className="px-0 py-0">
            <div className="mx-4 mb-3 rounded-xl border border-slate-100 overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-3 py-2 text-left text-[9px] font-black uppercase tracking-widest text-slate-400">Trabalhador</th>
                    <th className="px-3 py-2 text-left text-[9px] font-black uppercase tracking-widest text-slate-400">Mês</th>
                    <th className="px-3 py-2 text-right text-[9px] font-black uppercase tracking-widest text-slate-400">Bruto</th>
                    <th className="px-3 py-2 text-right text-[9px] font-black uppercase tracking-widest text-slate-400">SS</th>
                    <th className="px-3 py-2 text-right text-[9px] font-black uppercase tracking-widest text-slate-400">IRS</th>
                    <th className="px-3 py-2 text-right text-[9px] font-black uppercase tracking-widest text-slate-400">Líquido</th>
                    <th className="px-3 py-2 text-center text-[9px] font-black uppercase tracking-widest text-slate-400">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {sessao.map(r => (
                    <tr key={r.id} className="hover:bg-slate-50 transition-colors" title={r.mensagem}>
                      <td className="px-3 py-2.5 font-bold text-slate-800 max-w-[140px] truncate">{r.worker_name ?? '—'}</td>
                      <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">{r.mes ? formatarMes(r.mes) : '—'}</td>
                      <td className="px-3 py-2.5 text-right font-bold text-slate-700">{r.bruto_plataforma != null ? `${Number(r.bruto_plataforma).toFixed(2)}€` : '—'}</td>
                      <td className="px-3 py-2.5 text-right text-slate-500">{r.ss_extraido != null ? `${Number(r.ss_extraido).toFixed(2)}€` : '—'}</td>
                      <td className="px-3 py-2.5 text-right text-slate-500">{r.irs_extraido != null ? `${Number(r.irs_extraido).toFixed(2)}€` : '—'}</td>
                      <td className="px-3 py-2.5 text-right font-bold text-slate-700">{r.liquido_extraido != null ? `${Number(r.liquido_extraido).toFixed(2)}€` : '—'}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-center gap-2">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${ESTADO_BADGE[r.estado] ?? 'bg-slate-100 text-slate-500'}`}>
                            {ESTADO_PT[r.estado] ?? r.estado}
                          </span>
                          {r.liquido_extraido != null && r.bruto_plataforma != null && r.ss_extraido != null && r.irs_extraido != null && (
                            <DivergenciaBadge
                              sinal={parseFloat((Number(r.liquido_extraido) - (Number(r.bruto_plataforma) - Number(r.ss_extraido) - Number(r.irs_extraido))).toFixed(2))}
                              className="text-xs font-bold"
                            />
                          )}
                          {r.estado !== 'valido' && (
                            <button
                              onClick={async () => {
                                setMarcando(r.id);
                                try { await onMarcarValido(r.id); } finally { setMarcando(null); }
                              }}
                              disabled={marcando === r.id}
                              title="Marcar como válido"
                              className="ml-1 p-1 rounded-full text-emerald-500 hover:bg-emerald-50 hover:text-emerald-700 transition-colors disabled:opacity-40"
                            >
                              {marcando === r.id ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle size={11} />}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

const ModoHistorico = ({ workers }) => {
  const [registos, setRegistos] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [filtroWorker, setFiltroWorker] = useState('');
  const [filtroMes, setFiltroMes] = useState('');

  const carregar = useCallback(async () => {
    const db = window.supabaseInstance;
    if (!db) return;
    setCarregando(true);
    const { data } = await db
      .from('receipt_validations')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);
    setRegistos(data ?? []);
    setCarregando(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const marcarValido = async (id) => {
    const db = window.supabaseInstance;
    if (!db) return;
    const { error } = await db
      .from('receipt_validations')
      .update({
        estado: 'valido',
        divergencia: 0,
        mensagem: 'Recibo marcado como válido manualmente pelo administrador.',
      })
      .eq('id', id);
    if (error) { console.error(error); return; }
    setRegistos(prev => prev.map(r => r.id === id
      ? { ...r, estado: 'valido', divergencia: 0, mensagem: 'Recibo marcado como válido manualmente pelo administrador.' }
      : r));
  };

  // Filtrar registos individualmente e depois agrupar por sessão
  const registosFiltrados = registos.filter(r => {
    if (filtroWorker && r.worker_id !== filtroWorker) return false;
    if (filtroMes    && r.mes       !== filtroMes)    return false;
    return true;
  });
  const sessoes = agruparPorSessao(registosFiltrados);

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        <select value={filtroWorker} onChange={e => setFiltroWorker(e.target.value)}
          className="flex-1 min-w-[180px] p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">Todos os trabalhadores</option>
          {workers.filter(w => !w.isAdmin).sort((a,b) => a.name.localeCompare(b.name)).map(w => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
        <select value={filtroMes} onChange={e => setFiltroMes(e.target.value)}
          className="flex-1 min-w-[160px] p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">Todos os meses</option>
          {mesesDisponiveis.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        <button onClick={carregar} disabled={carregando}
          className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 hover:text-indigo-600 hover:border-indigo-300 transition-all disabled:opacity-40">
          <RefreshCw size={15} className={carregando ? 'animate-spin' : ''} />
        </button>
      </div>

      {carregando && (
        <div className="flex justify-center py-10">
          <Loader2 size={22} className="animate-spin text-indigo-400" />
        </div>
      )}

      {!carregando && sessoes.length === 0 && (
        <p className="text-center text-sm text-slate-400 py-10">Nenhuma validação guardada.</p>
      )}

      {!carregando && sessoes.length > 0 && (
        <div className="rounded-2xl border border-slate-100 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-4 py-2.5 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Processamento</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Recibos</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Resumo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sessoes.map(sessao => (
                <SessaoRow key={sessao[0].session_id ?? sessao[0].id} sessao={sessao} onMarcarValido={marcarValido} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ─── Componente principal ─────────────────────────────────────────────────────
const ValidarReciboAdmin = ({ workers = [] }) => {
  const { logs = [], systemSettings, saveSystemSettings, saveToDb } = useApp();
  const [modo, setModo] = useState('validar');

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-2xl max-w-xs mx-auto">
        {[
          { id: 'validar',   icon: ReceiptText, label: 'Validar' },
          { id: 'historico', icon: History,     label: 'Histórico' },
        ].map(({ id, icon: Icon, label }) => (
          <button key={id} onClick={() => setModo(id)}
            className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${modo === id ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      {modo === 'validar'   && <ModoLote      workers={workers} logs={logs} systemSettings={systemSettings} saveSystemSettings={saveSystemSettings} saveToDb={saveToDb} />}
      {modo === 'historico' && <ModoHistorico workers={workers} />}
    </div>
  );
};

export default ValidarReciboAdmin;
