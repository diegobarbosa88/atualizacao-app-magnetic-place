import React, { useState, useEffect, useCallback, useRef } from 'react';
import { CheckCircle, XCircle, AlertCircle, AlertTriangle, Loader2, ReceiptText, Files, Save, FileDown, History, RefreshCw, ChevronRight, Settings, Coins, Trash2, Scissors, Upload, TriangleAlert } from 'lucide-react';
import {
  extrairPaginasPdf,
  extrairMetadadosTOConline,
  parseReciboTOConline,
} from '../../utils/validarReciboTOConline';
import {
  separarRecibosTOConline,
  associarDocumentoAoTrabalhador,
} from '../../utils/separarRecibosTOConline';
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

// ─── Picker de estado (clicável) ──────────────────────────────────────────────
const ESTADOS_OPTIONS = [
  { id: 'valido',   label: 'Válido',   Icon: CheckCircle,   color: 'text-emerald-500' },
  { id: 'aviso',    label: 'Aviso',    Icon: AlertTriangle, color: 'text-yellow-500' },
  { id: 'invalido', label: 'Inválido', Icon: XCircle,       color: 'text-red-500' },
  { id: 'erro',     label: 'Erro',     Icon: AlertCircle,   color: 'text-amber-500' },
];

function EstadoPicker({ atual, onChange, size = 16 }) {
  const [aberto, setAberto] = useState(false);
  const opt = ESTADOS_OPTIONS.find(o => o.id === atual) ?? ESTADOS_OPTIONS[2];
  const { Icon, color } = opt;

  return (
    <div className="relative inline-flex" onClick={e => e.stopPropagation()}>
      <button
        onClick={() => setAberto(o => !o)}
        title="Alterar estado"
        className="p-0.5 rounded hover:bg-slate-100 transition-colors"
      >
        <Icon size={size} className={color} />
      </button>
      {aberto && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setAberto(false)} />
          <div className="absolute top-full left-0 mt-1 z-20 bg-white border border-slate-200 rounded-xl shadow-lg p-1 flex flex-col min-w-[110px]">
            {ESTADOS_OPTIONS.map(o => (
              <button key={o.id}
                onClick={() => { setAberto(false); if (o.id !== atual) onChange(o.id); }}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 ${o.id === atual ? 'bg-slate-50' : ''}`}
              >
                <o.Icon size={12} className={o.color} /> {o.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// Deriva o objeto "r" (com sucesso/valido/aviso) a partir do estado string
function estadoStringToFlags(estado) {
  if (estado === 'valido')   return { sucesso: true,  valido: true,  aviso: false };
  if (estado === 'aviso')    return { sucesso: true,  valido: false, aviso: true  };
  if (estado === 'invalido') return { sucesso: true,  valido: false, aviso: false };
  return                            { sucesso: false, valido: false, aviso: false }; // erro
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
  const [enviandoRecibos, setEnviandoRecibos] = useState(false);
  const [erroBurst, setErroBurst] = useState(null);
  const [burstResultados, setBurstResultados] = useState(null);
  const [selecionadosEnvio, setSelecionadosEnvio] = useState(new Set());
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
    setErroBurst(null);
    setBurstResultados(null);
    setSelecionadosEnvio(new Set());
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
    setErroBurst(null);

    // Fase 1: Validação
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
    if (!acc[r.mes]) acc[r.mes] = { ss: 0, irs: 0, ssEmpresa: 0 };
    acc[r.mes].ss        += r.ssExtraido  ?? 0;
    acc[r.mes].irs       += r.irsExtraido ?? 0;
    acc[r.mes].ssEmpresa += (r.ssExtraido ?? 0) * (23.75 / 11);
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
        if (totais.ssEmpresa > 0) {
          const id = `e${Date.now()}_sse_${mes}`;
          await saveToDb('expenses', id, {
            id, name: `Seg. Social Empresa - ${mesNome}`,
            amount: parseFloat(totais.ssEmpresa.toFixed(2)),
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


  const handleIniciarEnvio = async () => {
    setEnviandoRecibos(true);
    setErroBurst(null);
    setBurstResultados(null);
    try {
      const supabase = window.supabaseInstance;
      const workerIdsLista = [...new Set(resultados.map(r => r.worker?.id).filter(Boolean))];

      // Verificar quais já foram enviados na BD
      const jaEnviados = new Set();
      if (supabase && workerIdsLista.length) {
        const { data: docs } = await supabase
          .from('documents')
          .select('workerId, nomeFicheiro')
          .eq('tipo', 'Recibo de Vencimento')
          .in('workerId', workerIdsLista);
        (docs ?? []).forEach(d => {
          const m = d.nomeFicheiro?.match(/recibo_(\d{4}-\d{2})/);
          if (m) jaEnviados.add(`${d.workerId}|${m[1]}`);
        });
      }

      // Burst de todos os ficheiros
      const todosBurst = [];
      for (const file of files) {
        const burst = await separarRecibosTOConline(file);
        todosBurst.push(...burst.resultados);
      }

      // Associar cada resultado do burst ao worker validado
      const filtrados = [];
      for (const br of todosBurst) {
        const worker = br.nome ? encontrarWorker(br.nome, workers) : null;
        if (!worker || !workerIdsLista.includes(worker.id)) continue;
        if (filtrados.find(f => f.worker?.id === worker.id)) continue;
        const resValidado = resultados.find(rv => rv.worker?.id === worker.id);
        const mes = resValidado?.mes ?? br.mes;
        filtrados.push({
          ...br, worker, mes,
          jaEnviado: jaEnviados.has(`${worker.id}|${mes}`),
        });
      }
      if (!filtrados.length) throw new Error('Nenhum trabalhador encontrado no PDF.');
      setBurstResultados(filtrados);
      // Pré-selecionar apenas os que ainda não foram enviados
      setSelecionadosEnvio(new Set(filtrados.filter(r => !r.jaEnviado).map(r => r.nif)));
    } catch (err) {
      setErroBurst(err.message);
    } finally {
      setEnviandoRecibos(false);
    }
  };

  const handleConfirmarEnvio = async () => {
    const supabase = window.supabaseInstance;
    if (!supabase || !burstResultados) return;
    setEnviandoRecibos(true);
    setErroBurst(null);
    const selecionados = burstResultados.filter(r => selecionadosEnvio.has(r.nif));
    const envioMap = new Map();
    for (const r of selecionados) {
      try {
        await associarDocumentoAoTrabalhador({ ...r, supabase });
        envioMap.set(r.worker.id, { status: 'enviado' });
      } catch (e) {
        envioMap.set(r.worker.id, { status: 'erro_envio', error: e.message });
      }
    }
    // Marcar os que já tinham sido enviados anteriormente
    burstResultados.filter(r => !selecionadosEnvio.has(r.nif) && r.jaEnviado).forEach(r => {
      envioMap.set(r.worker.id, { status: 'ja_enviado' });
    });
    setBurstResultados(null);
    setEnviandoRecibos(false);
    setResultados(prev => prev.map(r => ({
      ...r,
      envioStatus: envioMap.get(r.worker?.id)?.status ?? r.envioStatus ?? null,
      erroEnvio:   envioMap.get(r.worker?.id)?.error  ?? null,
    })));
    const erros = [...envioMap.values()].filter(v => v.status === 'erro_envio').map(v => v.error);
    if (erros.length) setErroBurst(erros.join(' | '));
  };

  const toggleEnvio = (nif) => setSelecionadosEnvio(prev => {
    const next = new Set(prev);
    next.has(nif) ? next.delete(nif) : next.add(nif);
    return next;
  });

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
                <th className="px-4 py-2.5 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">Envio</th>
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
                        <EstadoPicker
                          atual={!r.sucesso ? 'erro' : r.valido ? 'valido' : r.aviso ? 'aviso' : 'invalido'}
                          onChange={(novo) => {
                            const flags = estadoStringToFlags(novo);
                            setResultados(prev => prev.map((x, idx) => idx === i ? { ...x, ...flags } : x));
                          }}
                        />
                        {r.sucesso && r.divergenciaSinal != null && (
                          <DivergenciaBadge sinal={r.divergenciaSinal} className="text-xs font-bold" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {enviandoRecibos && !r.envioStatus
                        ? <Loader2 size={13} className="animate-spin text-indigo-400 mx-auto" />
                        : r.envioStatus === 'enviado'    ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[9px] font-black uppercase"><CheckCircle size={10} />Enviado</span>
                        : r.envioStatus === 'ja_enviado' ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[9px] font-black uppercase"><CheckCircle size={10} />Já enviado</span>
                        : r.envioStatus === 'erro_envio' ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-600 text-[9px] font-black uppercase" title={r.erroEnvio}><XCircle size={10} />Erro</span>
                        : r.envioStatus === 'sem_pdf'    ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-600 text-[9px] font-black uppercase"><AlertCircle size={10} />Sem PDF</span>
                        : <span className="text-slate-300">—</span>
                      }
                    </td>
                  </tr>

                  {expandido === i && (
                    <tr className="bg-slate-50">
                      <td colSpan={6} className="px-4 py-4">
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
          <div className="flex gap-3 justify-end flex-wrap">
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
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:border-indigo-400 hover:text-indigo-600 transition-all">
              <FileDown size={13} />
              Exportar PDF
            </button>
            <button
              onClick={burstResultados ? handleConfirmarEnvio : handleIniciarEnvio}
              disabled={enviandoRecibos || (burstResultados && selecionadosEnvio.size === 0)}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 transition-all shadow-sm shadow-indigo-200 disabled:opacity-40 disabled:cursor-not-allowed">
              {enviandoRecibos ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
              {burstResultados ? `Confirmar Envio (${selecionadosEnvio.size})` : 'Enviar Recibos'}
            </button>
          </div>

          {burstResultados && (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600">
                  Selecionar trabalhadores para envio
                </span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setSelecionadosEnvio(new Set(burstResultados.filter(r => !r.jaEnviado).map(r => r.nif)))}
                    className="text-[9px] font-bold uppercase text-indigo-500 hover:text-indigo-700 px-1.5 py-0.5 rounded">Todos</button>
                  <span className="text-indigo-200">|</span>
                  <button onClick={() => setSelecionadosEnvio(new Set())}
                    className="text-[9px] font-bold uppercase text-indigo-500 hover:text-indigo-700 px-1.5 py-0.5 rounded">Nenhum</button>
                  <span className="text-indigo-200">|</span>
                  <button onClick={() => setBurstResultados(null)}
                    className="text-[9px] font-bold uppercase text-slate-400 hover:text-slate-600 px-1.5 py-0.5 rounded">Cancelar</button>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                {burstResultados.map(r => (
                  <label key={r.nif} className={`flex items-center gap-1.5 cursor-pointer ${r.jaEnviado ? 'opacity-50' : ''}`}>
                    <input
                      type="checkbox"
                      checked={selecionadosEnvio.has(r.nif)}
                      onChange={() => !r.jaEnviado && toggleEnvio(r.nif)}
                      disabled={r.jaEnviado}
                      className="accent-indigo-600 w-3.5 h-3.5"
                    />
                    <span className="text-xs font-bold text-slate-700">{r.worker?.name ?? r.nome ?? r.nif}</span>
                    {r.jaEnviado && <span className="text-[9px] text-slate-400">(já enviado)</span>}
                  </label>
                ))}
              </div>
            </div>
          )}

          {Object.keys(totaisPorMes).length > 0 && (
            <p className="text-[10px] text-slate-400 text-right">
              {Object.entries(totaisPorMes).map(([mes, t]) =>
                `${formatarMes(mes)}: SS ${t.ss.toFixed(2)}€ + IRS ${t.irs.toFixed(2)}€`
              ).join('  ·  ')}
            </p>
          )}
          {erroGuardar   && <p className="text-[10px] text-red-500 text-right">{erroGuardar}</p>}
          {erroAdicionar && <p className="text-[10px] text-red-500 text-right">{erroAdicionar}</p>}
          {erroBurst     && <p className="text-[10px] text-red-500 text-right">{erroBurst}</p>}
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

function SessaoRow({ sessao, onAlterarEstado, onApagarRegisto, onApagarSessao, onAdicionarACustos, onEnviarRecibos }) {
  const [aberto, setAberto] = useState(false);
  const [apagandoSessao, setApagandoSessao] = useState(false);
  const [adicionandoCustos, setAdicionandoCustos] = useState(false);
  const [adicionadoCustos, setAdicionadoCustos] = useState(false);
  const [burstResultados, setBurstResultados] = useState(null); // resultados filtrados após burst
  const [selecionadosEnvio, setSelecionadosEnvio] = useState(new Set());
  const [bursting,      setBursting]      = useState(false);
  const [enviandoRecibos, setEnviandoRecibos] = useState(false);
  const [enviadosNifs, setEnviadosNifs]   = useState(new Set());
  const [erroEnvio, setErroEnvio]         = useState(null);
  const fileInputRef = useRef(null);

  // Passo 1 — burst + filtrar pelos workers da sessão → abrir painel de seleção
  const handleFileEnvio = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || file.type !== 'application/pdf') return;
    setBursting(true);
    setErroEnvio(null);
    setBurstResultados(null);
    try {
      const res = await separarRecibosTOConline(file);
      // Mapeia nome do PDF → sessão para filtrar apenas trabalhadores desta sessão
      const nomesWorker = new Set(sessao.map(r => r.worker_name?.toUpperCase()).filter(Boolean));
      const filtrados = res.resultados.filter(r => {
        const nomeUp = r.nome?.toUpperCase() ?? '';
        return nomeUp && nomesWorker.has(nomeUp);
      }).map(r => {
        const sessaoRecord = sessao.find(s => s.worker_name?.toUpperCase() === r.nome?.toUpperCase());
        return { ...r, mes: sessaoRecord?.mes ?? r.mes, worker_id: sessaoRecord?.worker_id };
      });
      if (!filtrados.length) throw new Error('Nenhum trabalhador desta sessão encontrado no PDF.');
      setBurstResultados(filtrados);
      setSelecionadosEnvio(new Set(filtrados.map(r => r.nif)));
    } catch (err) {
      setErroEnvio(err.message);
    } finally {
      setBursting(false);
    }
  };

  // Passo 2 — enviar só os selecionados
  const handleConfirmarEnvio = async () => {
    if (!burstResultados) return;
    setEnviandoRecibos(true);
    setErroEnvio(null);
    const selecionados = burstResultados.filter(r => selecionadosEnvio.has(r.nif));
    try {
      const sessaoRecord = (nif) => sessao.find(s => s.worker_id === selecionados.find(r => r.nif === nif)?.worker?.id);
      await onEnviarRecibos(selecionados.map(r => ({
        ...r,
        mes: sessaoRecord(r.nif)?.mes ?? r.mes,
      })));
      setEnviadosNifs(prev => new Set([...prev, ...selecionados.map(r => r.nif)]));
      setBurstResultados(null);
    } catch (err) {
      setErroEnvio(err.message);
    } finally {
      setEnviandoRecibos(false);
    }
  };

  const toggleEnvio = (nif) => setSelecionadosEnvio(prev => {
    const next = new Set(prev);
    next.has(nif) ? next.delete(nif) : next.add(nif);
    return next;
  });
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
            <ChevronRight size={16} className={`text-slate-400 transition-transform shrink-0 ${aberto ? 'rotate-90' : ''}`} />
            <div className="flex flex-col">
              <span className="text-sm font-black text-slate-800 whitespace-nowrap leading-tight">
                {[...new Set(sessao.map(r => r.mes).filter(Boolean))].map(formatarMes).join(', ') || '—'}
              </span>
              <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">
                Processado a {formatarDataHora(sessao[0].created_at)}
              </span>
            </div>
          </div>
        </td>
        <td className="px-4 py-3">
          <span className="text-xs text-slate-500 font-medium">
            {sessao.length} recibo{sessao.length !== 1 ? 's' : ''}
          </span>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              {nValidos   > 0 && <span className="flex items-center gap-1 text-xs font-black text-emerald-600"><CheckCircle size={15} />{nValidos}</span>}
              {nAvisos    > 0 && <span className="flex items-center gap-1 text-xs font-black text-yellow-600"><AlertTriangle size={15} />{nAvisos}</span>}
              {nInvalidos > 0 && <span className="flex items-center gap-1 text-xs font-black text-red-500"><XCircle size={15} />{nInvalidos}</span>}
              {nErros     > 0 && <span className="flex items-center gap-1 text-xs font-black text-amber-500"><AlertCircle size={15} />{nErros}</span>}
            </div>
            <div className="flex items-center gap-2">
              {/* Input oculto para upload do PDF de envio */}
              <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={handleFileEnvio} />
              {enviadosNifs.size > 0 && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[9px] font-black uppercase tracking-widest">
                  <CheckCircle size={11} /> Enviado {enviadosNifs.size}
                </span>
              )}
              <button
                onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}
                disabled={bursting || enviandoRecibos}
                title={enviadosNifs.size > 0 ? 'Reenviar recibos' : 'Enviar recibos aos trabalhadores'}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors disabled:opacity-40"
              >
                {bursting ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} className={enviadosNifs.size > 0 ? 'text-indigo-600' : ''} />}
              </button>
              <button
                onClick={async e => {
                  e.stopPropagation();
                  setAdicionandoCustos(true);
                  try { await onAdicionarACustos(sessao); setAdicionadoCustos(true); } finally { setAdicionandoCustos(false); }
                }}
                disabled={adicionandoCustos || adicionadoCustos}
                title="Adicionar SS e IRS a Custos"
                className="p-1.5 rounded-lg text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 transition-colors disabled:opacity-40"
              >
                {adicionandoCustos ? <Loader2 size={18} className="animate-spin" /> : <Coins size={18} className={adicionadoCustos ? 'text-emerald-600' : ''} />}
              </button>
              <button
                onClick={async e => {
                  e.stopPropagation();
                  if (!window.confirm(`Apagar este processamento (${sessao.length} recibo${sessao.length !== 1 ? 's' : ''})?`)) return;
                  setApagandoSessao(true);
                  try { await onApagarSessao(sessao); } finally { setApagandoSessao(false); }
                }}
                disabled={apagandoSessao}
                title="Apagar processamento"
                className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-40"
              >
                {apagandoSessao ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
              </button>
            </div>
            {erroEnvio && (
              <p className="text-[9px] text-red-500 font-medium mt-1 max-w-xs truncate" title={erroEnvio}>{erroEnvio}</p>
            )}
          </div>
        </td>
      </tr>

      {/* Painel de seleção de trabalhadores para envio */}
      {burstResultados && (
        <tr>
          <td colSpan={3} className="px-4 pb-2 pt-0">
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600">
                  Selecionar trabalhadores para envio
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setSelecionadosEnvio(new Set(burstResultados.map(r => r.nif)))}
                    className="text-[9px] font-bold uppercase text-indigo-500 hover:text-indigo-700 px-1.5 py-0.5 rounded"
                  >Todos</button>
                  <span className="text-indigo-200">|</span>
                  <button
                    onClick={() => setSelecionadosEnvio(new Set())}
                    className="text-[9px] font-bold uppercase text-indigo-500 hover:text-indigo-700 px-1.5 py-0.5 rounded"
                  >Nenhum</button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {burstResultados.map(r => (
                  <label key={r.nif} className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selecionadosEnvio.has(r.nif)}
                      onChange={() => toggleEnvio(r.nif)}
                      className="accent-indigo-600 w-3.5 h-3.5"
                    />
                    <span className="text-xs font-bold text-slate-700">
                      {r.worker?.name ?? r.nome ?? r.nif}
                    </span>
                  </label>
                ))}
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={e => { e.stopPropagation(); handleConfirmarEnvio(); }}
                  disabled={enviandoRecibos || selecionadosEnvio.size === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold disabled:opacity-40 hover:bg-indigo-700 transition-colors"
                >
                  {enviandoRecibos ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  Enviar {selecionadosEnvio.size > 0 ? selecionadosEnvio.size : ''}
                </button>
                <button
                  onClick={e => { e.stopPropagation(); setBurstResultados(null); }}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-100 transition-colors"
                >Cancelar</button>
              </div>
            </div>
          </td>
        </tr>
      )}

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
                          <EstadoPicker atual={r.estado} onChange={(novo) => onAlterarEstado(r.id, novo)} size={14} />
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${ESTADO_BADGE[r.estado] ?? 'bg-slate-100 text-slate-500'}`}>
                            {ESTADO_PT[r.estado] ?? r.estado}
                          </span>
                          {r.liquido_extraido != null && r.bruto_plataforma != null && r.ss_extraido != null && r.irs_extraido != null && (
                            <DivergenciaBadge
                              sinal={parseFloat((Number(r.liquido_extraido) - (Number(r.bruto_plataforma) - Number(r.ss_extraido) - Number(r.irs_extraido))).toFixed(2))}
                              className="text-xs font-bold"
                            />
                          )}
                          <button
                            onClick={() => {
                              if (window.confirm('Apagar este registo?')) onApagarRegisto(r.id);
                            }}
                            title="Apagar registo"
                            className="ml-1 p-1 rounded text-slate-300 hover:bg-red-50 hover:text-red-600 transition-colors"
                          >
                            <Trash2 size={11} />
                          </button>
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

const ModoHistorico = ({ workers, saveToDb }) => {
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

  const apagarRegisto = async (id) => {
    const db = window.supabaseInstance;
    if (!db) return;
    const { error } = await db.from('receipt_validations').delete().eq('id', id);
    if (error) { console.error(error); return; }
    setRegistos(prev => prev.filter(r => r.id !== id));
  };

  const adicionarACustosSessao = async (sessao) => {
    const totaisPorMes = sessao.reduce((acc, r) => {
      if (r.estado !== 'valido' && r.estado !== 'aviso') return acc;
      if (!r.mes) return acc;
      if (!acc[r.mes]) acc[r.mes] = { ss: 0, irs: 0, ssEmpresa: 0 };
      acc[r.mes].ss        += Number(r.ss_extraido)  || 0;
      acc[r.mes].irs       += Number(r.irs_extraido) || 0;
      acc[r.mes].ssEmpresa += (Number(r.ss_extraido) || 0) * (23.75 / 11);
      return acc;
    }, {});
    for (const [mes, totais] of Object.entries(totaisPorMes)) {
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
      if (totais.ssEmpresa > 0) {
        const id = `e${Date.now()}_sse_${mes}`;
        await saveToDb('expenses', id, {
          id, name: `Seg. Social Empresa - ${mesNome}`,
          amount: parseFloat(totais.ssEmpresa.toFixed(2)),
          type: 'variável', date: dataMes,
        });
      }
    }
  };

  const enviarRecibosSessao = async (resultadosFiltrados) => {
    const supabase = window.supabaseInstance;
    if (!supabase) throw new Error('Sem ligação à base de dados.');
    const erros = [];
    for (const r of resultadosFiltrados) {
      const worker = r.nome ? encontrarWorker(r.nome, workers) : null;
      if (!worker) { erros.push(`${r.nif}: trabalhador não encontrado`); continue; }
      try {
        await associarDocumentoAoTrabalhador({ ...r, worker, supabase });
      } catch (e) {
        erros.push(`${worker.name}: ${e.message}`);
      }
    }
    if (erros.length) throw new Error(erros.join(' | '));
  };

  const apagarSessao = async (sessao) => {
    const db = window.supabaseInstance;
    if (!db) return;
    const ids = sessao.map(r => r.id);
    const { error } = await db.from('receipt_validations').delete().in('id', ids);
    if (error) { console.error(error); return; }
    setRegistos(prev => prev.filter(r => !ids.includes(r.id)));
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
                <SessaoRow
                  key={sessao[0].session_id ?? sessao[0].id}
                  sessao={sessao}
                  onAlterarEstado={alterarEstado}
                  onApagarRegisto={apagarRegisto}
                  onApagarSessao={apagarSessao}
                  onAdicionarACustos={adicionarACustosSessao}
                  onEnviarRecibos={enviarRecibosSessao}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ─── Modo Bursting ────────────────────────────────────────────────────────────
const ModoBursting = ({ workers, logs, systemSettings, saveToDb }) => {
  const [ficheiro,    setFicheiro]    = useState(null);
  const [resultado,   setResultado]   = useState(null);
  const [processando, setProcessando] = useState(false);
  const [progresso,   setProgresso]   = useState({ atual: 0, total: 0 });
  const [enviando,     setEnviando]     = useState(false);
  const [enviados,     setEnviados]     = useState(new Set());
  const [selecionados, setSelecionados] = useState(new Set());
  const [erros,        setErros]        = useState([]);
  const [orfaosAberto, setOrfaosAberto] = useState(false);
  const [guardando,     setGuardando]     = useState(false);
  const [guardados,     setGuardados]     = useState(false);
  const [erroGuardar,   setErroGuardar]   = useState(null);
  const [adicionando,   setAdicionando]   = useState(false);
  const [adicionado,    setAdicionado]    = useState(false);
  const [erroAdicionar, setErroAdicionar] = useState(null);

  const handleFicheiro = (e) => {
    const f = e.target.files?.[0];
    if (!f || f.type !== 'application/pdf') return;
    setFicheiro(f);
    setResultado(null);
    setEnviados(new Set());
    setSelecionados(new Set());
    setErros([]);
    setGuardados(false); setErroGuardar(null);
    setAdicionado(false); setErroAdicionar(null);
  };

  const downloadPdf = (r) => {
    const blob = new Blob([r.pdfBytes], { type: 'application/pdf' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `recibo_${r.mes ?? 'sem-mes'}_${r.nif}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadTodos = () => {
    resultado?.resultados.forEach(r => downloadPdf(r));
  };

  const toggleSelecionado = (nif) => {
    setSelecionados(prev => {
      const next = new Set(prev);
      next.has(nif) ? next.delete(nif) : next.add(nif);
      return next;
    });
  };

  const toggleTodos = (nifs) => {
    setSelecionados(prev => prev.size === nifs.length ? new Set() : new Set(nifs));
  };

  const tolerancias = {
    valido: parseFloat(String(systemSettings?.toleranciaValido ?? 0.77).replace(',', '.')),
    aviso:  parseFloat(String(systemSettings?.toleranciaAviso  ?? 10).replace(',', '.')),
  };

  const handleBurst = async () => {
    if (!ficheiro) return;
    setProcessando(true);
    setResultado(null);
    setProgresso({ atual: 0, total: 0 });
    setErros([]);
    setGuardados(false); setAdicionado(false);
    try {
      const res = await separarRecibosTOConline(ficheiro, (atual, total) =>
        setProgresso({ atual, total })
      );
      const enriquecidos = res.resultados.map(r => {
        const worker = r.nome ? encontrarWorker(r.nome, workers) : null;
        let bruto = 0;
        if (worker && r.mes) {
          const logsDoMes = (logs ?? []).filter(l => l.workerId === worker.id && l.date?.startsWith(r.mes));
          bruto = logsDoMes.reduce((s, l) => s + (parseFloat(l.hours) || 0), 0) * (worker.valorHora || 0);
        }
        const validacao = aplicarOverrideSempreValido(parseReciboTOConline(r.texto, bruto, tolerancias), worker);
        return { ...r, worker, bruto, ...validacao };
      });
      setResultado({ resultados: enriquecidos, orfaos: res.orfaos });
      setSelecionados(new Set(enriquecidos.map(r => r.nif)));
    } catch (err) {
      console.error('[Burst]', err);
      setErros([{ nif: '—', msg: err.message }]);
    } finally {
      setProcessando(false);
    }
  };

  const handleGuardarValidacoes = async () => {
    if (!resultado) return;
    setGuardando(true); setErroGuardar(null);
    try {
      const sessionId = crypto.randomUUID();
      await Promise.all(resultado.resultados.map(r =>
        guardarValidacao(r, { sessionId, origem: r.nif })
      ));
      setGuardados(true);
    } catch (e) { setErroGuardar(e.message); }
    finally { setGuardando(false); }
  };

  const totaisPorMesBurst = (resultado?.resultados ?? []).reduce((acc, r) => {
    if (!r.sucesso || !r.mes || r.mes === '—') return acc;
    if (!acc[r.mes]) acc[r.mes] = { ss: 0, irs: 0, ssEmpresa: 0 };
    acc[r.mes].ss        += r.ssExtraido  ?? 0;
    acc[r.mes].irs       += r.irsExtraido ?? 0;
    acc[r.mes].ssEmpresa += (r.ssExtraido ?? 0) * (23.75 / 11);
    return acc;
  }, {});

  const handleAdicionarACustosBurst = async () => {
    setAdicionando(true); setErroAdicionar(null);
    try {
      for (const [mes, totais] of Object.entries(totaisPorMesBurst)) {
        const dataMes = `${mes}-01`;
        const mesNome = formatarMes(mes);
        if (totais.ss > 0) {
          const id = `e${Date.now()}_ss_${mes}`;
          await saveToDb('expenses', id, { id, name: `Segurança Social - ${mesNome}`, amount: parseFloat(totais.ss.toFixed(2)), type: 'variável', date: dataMes });
        }
        if (totais.irs > 0) {
          const id = `e${Date.now()}_irs_${mes}`;
          await saveToDb('expenses', id, { id, name: `IRS - ${mesNome}`, amount: parseFloat(totais.irs.toFixed(2)), type: 'variável', date: dataMes });
        }
        if (totais.ssEmpresa > 0) {
          const id = `e${Date.now()}_sse_${mes}`;
          await saveToDb('expenses', id, { id, name: `Seg. Social Empresa - ${mesNome}`, amount: parseFloat(totais.ssEmpresa.toFixed(2)), type: 'variável', date: dataMes });
        }
      }
      setAdicionado(true);
    } catch (e) { setErroAdicionar(e.message); }
    finally { setAdicionando(false); }
  };

  const handleEnviarSelecionados = async () => {
    if (!resultado || selecionados.size === 0) return;
    const supabase = window.supabaseInstance;
    if (!supabase) return;
    setEnviando(true);
    const novosErros = [];
    for (const r of resultado.resultados) {
      if (!selecionados.has(r.nif) || enviados.has(r.nif)) continue;
      try {
        await associarDocumentoAoTrabalhador({ ...r, supabase });
        setEnviados(prev => new Set([...prev, r.nif]));
      } catch (err) {
        novosErros.push({ nif: r.nif, msg: err.message });
      }
    }
    setErros(novosErros);
    setEnviando(false);
  };

  const totalResultados  = resultado?.resultados.length ?? 0;
  const totalOrfaos      = resultado?.orfaos.length ?? 0;
  const nifsTodos        = resultado?.resultados.map(r => r.nif) ?? [];
  const todosSelected    = nifsTodos.length > 0 && selecionados.size === nifsTodos.length;
  const pct = progresso.total > 0 ? Math.round((progresso.atual / progresso.total) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* Upload */}
      <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-8 flex flex-col items-center gap-3 hover:border-indigo-300 transition-colors">
        <Scissors size={28} className="text-slate-300" />
        <p className="text-[11px] font-black text-slate-400 tracking-widest">PDF AGREGADO TOCONLINE</p>
        <label className="cursor-pointer">
          <input type="file" accept="application/pdf" className="hidden" onChange={handleFicheiro} />
          <span className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-colors">
            <Upload size={12} /> Selecionar PDF
          </span>
        </label>
        {ficheiro && (
          <p className="text-[10px] text-slate-500 font-medium">{ficheiro.name}</p>
        )}
      </div>

      {/* Botão Separar */}
      {ficheiro && !resultado && (
        <button onClick={handleBurst} disabled={processando}
          className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all disabled:opacity-50">
          {processando
            ? <><Loader2 size={13} className="animate-spin" /> A separar... {progresso.total > 0 ? `${progresso.atual}/${progresso.total} páginas` : ''}</>
            : <><Scissors size={13} /> Separar Recibos</>
          }
        </button>
      )}

      {/* Barra de progresso */}
      {processando && progresso.total > 0 && (
        <div className="w-full bg-slate-100 rounded-full h-1.5">
          <div className="bg-indigo-500 h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
      )}

      {/* Tabela de resultados */}
      {resultado && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[10px] font-black text-slate-500 tracking-widest flex-1">
              {totalResultados} RECIBO{totalResultados !== 1 ? 'S' : ''}
              {totalOrfaos > 0 && ` · ${totalOrfaos} ÓRFÃO${totalOrfaos !== 1 ? 'S' : ''}`}
              {selecionados.size > 0 && ` · ${selecionados.size} SEL.`}
            </p>
            <button onClick={handleGuardarValidacoes} disabled={guardando || guardados}
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:border-indigo-400 hover:text-indigo-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
              {guardando ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
              {guardados ? 'Guardado' : 'Guardar'}
            </button>
            <button onClick={handleAdicionarACustosBurst} disabled={adicionando || adicionado}
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:border-emerald-400 hover:text-emerald-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
              {adicionando ? <Loader2 size={11} className="animate-spin" /> : <Coins size={11} />}
              {adicionado ? 'Adicionado' : 'A Custos'}
            </button>
            <button onClick={downloadTodos}
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:border-indigo-400 hover:text-indigo-600 transition-all">
              <FileDown size={11} /> PDF
            </button>
            <button onClick={handleEnviarSelecionados} disabled={enviando || selecionados.size === 0}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
              {enviando ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />}
              {selecionados.size > 0 ? `Enviar ${selecionados.size}` : 'Enviar'}
            </button>
          </div>
          {erroGuardar   && <p className="text-[10px] text-red-500 font-medium px-1">{erroGuardar}</p>}
          {erroAdicionar && <p className="text-[10px] text-red-500 font-medium px-1">{erroAdicionar}</p>}

          <div className="rounded-2xl border border-slate-100 overflow-hidden">
            <table className="w-full text-[10px]">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2.5">
                    <input type="checkbox" checked={todosSelected} onChange={() => toggleTodos(nifsTodos)}
                      className="rounded accent-indigo-600 cursor-pointer" />
                  </th>
                  {['Trabalhador','Mês','Bruto','SS','IRS','Líquido','Estado',''].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left font-black text-slate-400 tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {resultado.resultados.map(r => {
                  const enviado     = enviados.has(r.nif);
                  const selecionado = selecionados.has(r.nif);
                  return (
                    <tr key={r.nif} onClick={() => !enviado && toggleSelecionado(r.nif)}
                      className={`transition-colors cursor-pointer ${selecionado ? 'bg-indigo-50 hover:bg-indigo-100' : 'hover:bg-slate-50'} ${enviado ? 'opacity-50 cursor-default' : ''}`}>
                      <td className="px-3 py-2.5">
                        <input type="checkbox" checked={selecionado} readOnly disabled={enviado}
                          className="rounded accent-indigo-600 pointer-events-none" />
                      </td>
                      <td className="px-3 py-2.5">
                        {r.worker
                          ? <span className="text-slate-700 font-black">{r.worker.name}</span>
                          : <span className="text-red-400 font-black">{r.nomeExtraido ?? r.nome ?? '—'}</span>}
                      </td>
                      <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{r.mes ? formatarMes(r.mes) : '—'}</td>
                      <td className="px-3 py-2.5 text-slate-500 text-right">{r.bruto ? r.bruto.toFixed(2) : '—'}</td>
                      <td className="px-3 py-2.5 text-slate-600 text-right">{r.ssExtraido != null ? r.ssExtraido.toFixed(2) : '—'}</td>
                      <td className="px-3 py-2.5 text-slate-600 text-right">{r.irsExtraido != null ? r.irsExtraido.toFixed(2) : '—'}</td>
                      <td className="px-3 py-2.5 text-slate-700 font-black text-right">{r.liquidoExtraido != null ? r.liquidoExtraido.toFixed(2) : '—'}</td>
                      <td className="px-3 py-2.5">
                        {!r.sucesso
                          ? <span className="flex items-center gap-1 text-amber-500 font-black"><AlertCircle size={11} /> Erro</span>
                          : r.valido
                            ? <span className="flex items-center gap-1 text-emerald-500 font-black"><CheckCircle size={11} /> Válido</span>
                            : r.aviso
                              ? <span className="flex items-center gap-1 text-yellow-500 font-black"><AlertTriangle size={11} /> Aviso</span>
                              : <span className="flex items-center gap-1 text-red-500 font-black"><XCircle size={11} /> Inválido</span>
                        }
                        {r.divergenciaSinal != null && r.divergenciaSinal !== 0 && (
                          <DivergenciaBadge sinal={r.divergenciaSinal} className="text-[9px] font-black block" />
                        )}
                      </td>
                      <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                        <button onClick={() => downloadPdf(r)} title="Guardar PDF"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                          <FileDown size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Órfãos */}
          {totalOrfaos > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 overflow-hidden">
              <button onClick={() => setOrfaosAberto(o => !o)}
                className="w-full flex items-center justify-between px-4 py-3 text-[10px] font-black text-amber-700 tracking-widest">
                <span className="flex items-center gap-2"><TriangleAlert size={12} /> {totalOrfaos} PÁGINA{totalOrfaos !== 1 ? 'S' : ''} ÓRFÃ{totalOrfaos !== 1 ? 'S' : ''} (SEM NIF)</span>
                <ChevronRight size={12} className={`transition-transform ${orfaosAberto ? 'rotate-90' : ''}`} />
              </button>
              {orfaosAberto && (
                <div className="px-4 pb-3 space-y-1">
                  {resultado.orfaos.map(o => (
                    <div key={o.pageIndex} className="text-[9px] text-amber-700 bg-amber-100 rounded-lg px-3 py-1.5">
                      <span className="font-black">Pág. {o.pageIndex + 1}:</span> {o.texto}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Erros de envio (por NIF) */}
          {erros.filter(e => e.nif !== '—').length > 0 && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 space-y-1">
              <p className="text-[10px] font-black text-red-600 tracking-widest mb-2">ERROS DE ENVIO</p>
              {erros.filter(e => e.nif !== '—').map((e, i) => (
                <p key={i} className="text-[9px] text-red-500">NIF {e.nif}: {e.msg}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Erro geral de processamento (fora do bloco resultado) */}
      {erros.some(e => e.nif === '—') && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-[10px] font-black text-red-600 tracking-widest mb-1">ERRO AO SEPARAR PDF</p>
          {erros.filter(e => e.nif === '—').map((e, i) => (
            <p key={i} className="text-[9px] text-red-500">{e.msg}</p>
          ))}
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
      <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-2xl max-w-sm mx-auto">
        {[
          { id: 'validar',   icon: ReceiptText, label: 'Validar' },
          { id: 'historico', icon: History,     label: 'Histórico' },
          { id: 'burst',     icon: Scissors,    label: 'Burst' },
        ].map(({ id, icon: Icon, label }) => (
          <button key={id} onClick={() => setModo(id)}
            className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${modo === id ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      {modo === 'validar'   && <ModoLote      workers={workers} logs={logs} systemSettings={systemSettings} saveSystemSettings={saveSystemSettings} saveToDb={saveToDb} />}
      {modo === 'historico' && <ModoHistorico workers={workers} saveToDb={saveToDb} />}
      {modo === 'burst'     && <ModoBursting  workers={workers} logs={logs} systemSettings={systemSettings} saveToDb={saveToDb} />}
    </div>
  );
};

export default ValidarReciboAdmin;
