import React, { useState, useEffect, useCallback, useRef } from 'react';
import { CheckCircle, XCircle, AlertCircle, Loader2, ReceiptText, Files, Save, FileDown, Settings, Coins, ChevronRight, Upload } from 'lucide-react';
import {
  extrairPaginasPdf,
  extrairMetadadosTOConline,
  parseReciboTOConline,
} from '../../utils/validarReciboTOConline';
import {
  separarRecibosTOConline,
  associarDocumentoAoTrabalhador,
} from '../../utils/separarRecibosTOConline';
import {
  normalizarNome,
  encontrarWorker,
  aplicarOverrideSempreValido,
  estadoBg,
  estadoLabel,
  estadoStringToFlags,
  guardarValidacao,
  formatarMes,
  calcularTolerancias,
  calcularBrutoDeMes,
  agregarTotaisPorMes,
  adicionarCustosAoMes,
  guardarValidacoesEmLote,
  ESTADO_BADGE,
  ESTADO_PT,
} from '../../utils/validacaoHelpers';
import { DivergenciaBadge, EstadoPicker } from './ValidacaoUI';

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

  const tolerancias = calcularTolerancias(systemSettings);

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
    const bruto = calcularBrutoDeMes(worker, mes, logs);
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
        // Divide o PDF em secções: cada secção termina com "Emitido por TOConline".
        // Isto preserva todas as páginas de cada trabalhador (incluindo a pág. 1
        // com "Ajudas de Custo") independentemente de quantos trabalhadores existam.
        const paginas = await extrairPaginasPdf(file);
        const secoes = [];
        let atual = [];
        for (const pag of paginas) {
          atual.push(pag);
          if (pag.includes('Emitido por TOConline')) {
            secoes.push(atual.join('\n'));
            atual = [];
          }
        }
        if (secoes.length === 0) {
          res.push({ origem: file.name, nomeExtraido: '—', worker: null, mes: '—', bruto: 0, sucesso: false, valido: false, aviso: false, mensagem: 'Documento não reconhecido como recibo TOConline.' });
        } else {
          for (const texto of secoes) {
            res.push(await processarPagina(texto, file.name));
          }
        }
      } catch (err) {
        res.push({ origem: file.name, nomeExtraido: '—', worker: null, mes: '—', bruto: 0, sucesso: false, valido: false, aviso: false, mensagem: `Erro: ${err.message}` });
      }
    }
    const seen = new Set();
    const agregados = {};
    for (const r of res) {
      const key = `${r.worker?.id ?? normalizarNome(r.nomeExtraido ?? '')}|${r.mes}`;
      if (!agregados[key]) {
        agregados[key] = { ...r };
      } else {
        const existing = agregados[key];
        existing.bruto = (existing.bruto || 0) + (r.bruto || 0);
        if (r.liquidoExtraido != null) {
          existing.liquidoExtraido = (existing.liquidoExtraido || 0) + r.liquidoExtraido;
        }
        if (r.abonosExtraidos != null) {
          existing.abonosExtraidos = (existing.abonosExtraidos || 0) + r.abonosExtraidos;
        }
        if (r.ssExtraido != null) {
          existing.ssExtraido = (existing.ssExtraido || 0) + r.ssExtraido;
        }
        if (r.irsExtraido != null) {
          existing.irsExtraido = (existing.irsExtraido || 0) + r.irsExtraido;
        }
        existing.mensagem = existing.mensagem || r.mensagem;
      }
      seen.add(key);
    }
    const deduplicados = Object.values(agregados);
    setResultados(deduplicados);
    setProcessando(false);
  };

  const totaisPorMes = agregarTotaisPorMes(resultados);

  const handleAdicionarACustos = async () => {
    setAdicionando(true); setErroAdicionar(null);
    try {
      await adicionarCustosAoMes(totaisPorMes, saveToDb, formatarMes);
      setAdicionado(true);
    } catch (e) { setErroAdicionar(e.message); }
    finally { setAdicionando(false); }
  };

  const handleGuardarTodos = async () => {
    setGuardando(true); setErroGuardar(null);
    try {
      const sessionId = crypto.randomUUID();
      await guardarValidacoesEmLote(resultados, sessionId);
      setGuardados(true);
    } catch (e) { setErroGuardar(e.message); }
    finally { setGuardando(false); }
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
      {/* Tolerâncias */}
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

      {/* Upload */}
      <label className="flex flex-col items-center justify-center gap-2 p-8 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-all">
        <Files size={28} className="text-slate-300" />
        <span className="text-sm font-bold text-slate-500">
          {files.length > 0
            ? `${files.length} ficheiro${files.length > 1 ? 's' : ''} selecionado${files.length > 1 ? 's' : ''}`
            : 'Clique para selecionar PDF(s)'}
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Válidos',   val: validos,   cls: 'emerald' },
            { label: 'Avisos',    val: avisos,    cls: 'yellow'  },
            { label: 'Inválidos', val: invalidos, cls: 'red'     },
            { label: 'Erros',     val: erros,     cls: 'amber'   },
          ].map(({ label, val, cls }) => (
            <div key={label} className={`bg-${cls}-50 border border-${cls}-200 rounded-xl p-3 text-center`}>
              <p className={`text-lg font-black text-${cls}-600`}>{val}</p>
              <p className={`text-[9px] font-black uppercase tracking-widest text-${cls}-500`}>{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabela de resultados */}
      {resultados.length > 0 && (
        <div className="rounded-2xl border border-slate-100 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-4 py-2.5 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Trabalhador</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Mês</th>
                <th className="px-4 py-2.5 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Líquido</th>
                <th className="px-4 py-2.5 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">Divergência</th>
                <th className="px-4 py-2.5 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">Estado</th>
                {burstResultados && (
                  <th className="px-4 py-2.5 text-center text-[10px] font-black uppercase tracking-widest text-indigo-400">Enviar</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {resultados.map((r, i) => {
                const estadoAtual = !r.sucesso ? 'erro' : r.valido ? 'valido' : r.aviso ? 'aviso' : 'invalido';
                const burstMatch  = burstResultados?.find(b => b.worker?.id === r.worker?.id);
                return (
                  <React.Fragment key={i}>
                    <tr
                      onClick={() => setExpandido(expandido === i ? null : i)}
                      className="hover:bg-slate-50 transition-colors cursor-pointer select-none"
                    >
                      {/* Trabalhador */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <ChevronRight size={13} className={`text-slate-300 transition-transform shrink-0 ${expandido === i ? 'rotate-90' : ''}`} />
                          <div>
                            <p className="font-bold text-slate-800">
                              {r.worker?.name ?? <span className="text-amber-500">Não encontrado</span>}
                            </p>
                            {!r.worker && <p className="text-[10px] text-slate-400 truncate max-w-[160px]">{r.nomeExtraido}</p>}
                          </div>
                        </div>
                      </td>

                      {/* Mês */}
                      <td className="px-4 py-3 text-slate-600 font-medium whitespace-nowrap">
                        {r.mes !== '—' ? formatarMes(r.mes) : '—'}
                      </td>

                      {/* Líquido */}
                      <td className="px-4 py-3 text-right font-bold text-slate-700">
                        {r.liquidoExtraido != null ? `${r.liquidoExtraido.toFixed(2)}€` : '—'}
                      </td>

                      {/* Divergência */}
                      <td className="px-4 py-3 text-center">
                        {r.sucesso && r.divergenciaSinal != null
                          ? <DivergenciaBadge sinal={r.divergenciaSinal} className="text-xs font-bold" />
                          : <span className="text-slate-300">—</span>
                        }
                      </td>

                      {/* Estado (validação + envio) */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-center gap-1">
                          <div className="flex items-center gap-1.5">
                            <EstadoPicker
                              atual={estadoAtual}
                              onChange={(novo) => {
                                const flags = estadoStringToFlags(novo);
                                setResultados(prev => prev.map((x, idx) => idx === i ? { ...x, ...flags } : x));
                              }}
                            />
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${ESTADO_BADGE[estadoAtual] ?? 'bg-slate-100 text-slate-500'}`}>
                              {ESTADO_PT[estadoAtual] ?? estadoAtual}
                            </span>
                          </div>
                          {r.envioStatus === 'enviado'    && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[9px] font-black uppercase"><CheckCircle size={10} />Enviado</span>}
                          {r.envioStatus === 'ja_enviado' && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[9px] font-black uppercase"><CheckCircle size={10} />Já enviado</span>}
                          {r.envioStatus === 'erro_envio' && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-600 text-[9px] font-black uppercase" title={r.erroEnvio}><XCircle size={10} />Erro envio</span>}
                          {r.envioStatus === 'sem_pdf'    && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-600 text-[9px] font-black uppercase"><AlertCircle size={10} />Sem PDF</span>}
                        </div>
                      </td>

                      {/* Checkbox de envio (só quando burstResultados disponível) */}
                      {burstResultados && (
                        <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                          {burstMatch
                            ? <input
                                type="checkbox"
                                checked={selecionadosEnvio.has(burstMatch.nif)}
                                onChange={() => !burstMatch.jaEnviado && toggleEnvio(burstMatch.nif)}
                                disabled={burstMatch.jaEnviado}
                                title={burstMatch.jaEnviado ? 'Já enviado anteriormente' : undefined}
                                className="accent-indigo-600 w-4 h-4 disabled:opacity-40 cursor-pointer"
                              />
                            : <span className="text-slate-300">—</span>
                          }
                        </td>
                      )}
                    </tr>

                    {/* Linha expandida — detalhe numérico */}
                    {expandido === i && (
                      <tr className="bg-slate-50">
                        <td colSpan={burstResultados ? 6 : 5} className="px-6 py-4">
                          <div className={`rounded-xl border p-4 space-y-3 ${estadoBg(r)}`}>
                            {r.sucesso && (
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {[
                                  ['Bruto plataforma', r.bruto > 0 ? `${r.bruto.toFixed(2)}€` : '—'],
                                  ['Bruto PDF',        r.abonosExtraidos != null ? `${r.abonosExtraidos.toFixed(2)}€` : '—'],
                                  ['Seg. Social',      r.ssExtraido != null ? `${r.ssExtraido.toFixed(2)}€` : '—'],
                                  ['IRS',              r.irsExtraido != null ? `${r.irsExtraido.toFixed(2)}€` : '—'],
                                ].map(([label, val]) => (
                                  <div key={label} className="bg-white rounded-xl p-3 text-center border border-slate-100">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">{label}</p>
                                    <p className="text-sm font-black text-slate-800">{val}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                            {r.mensagem && (
                              <p className="text-xs font-bold text-slate-700">{r.mensagem}</p>
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
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Ações pós-processamento */}
      {resultados.length > 0 && (
        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row sm:justify-end sm:flex-wrap gap-2">
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
            {burstResultados ? (
              <>
                <button
                  onClick={handleConfirmarEnvio}
                  disabled={enviandoRecibos || selecionadosEnvio.size === 0}
                  className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 transition-all shadow-sm shadow-indigo-200 disabled:opacity-40 disabled:cursor-not-allowed">
                  {enviandoRecibos ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                  Confirmar Envio ({selecionadosEnvio.size})
                </button>
                <button onClick={() => { setBurstResultados(null); setSelecionadosEnvio(new Set()); }}
                  className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all">
                  Cancelar
                </button>
              </>
            ) : (
              <button
                onClick={handleIniciarEnvio}
                disabled={enviandoRecibos}
                className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 transition-all shadow-sm shadow-indigo-200 disabled:opacity-40 disabled:cursor-not-allowed">
                {enviandoRecibos ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                Enviar Recibos
              </button>
            )}
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
          {erroBurst     && <p className="text-[10px] text-red-500 text-right">{erroBurst}</p>}
        </div>
      )}
    </div>
  );
};

export default ModoLote;
