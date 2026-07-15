import React, { useState, useRef } from 'react';
import { Loader2, Scissors, Upload, Save, FileDown, Coins, ChevronRight, TriangleAlert } from 'lucide-react';
import {
  parseReciboTOConline,
} from '../../utils/validarReciboTOConline';
import {
  separarRecibosTOConline,
  associarDocumentoAoTrabalhador,
} from '../../utils/separarRecibosTOConline';
import {
  encontrarWorker,
  aplicarOverrideSempreValido,
  guardarValidacao,
  formatarMes,
  calcularTolerancias,
  calcularBrutoDeMes,
  agregarTotaisPorMes,
  adicionarCustosAoMes,
  guardarValidacoesEmLote,
} from '../../utils/validacaoHelpers';

// ─── Modo Bursting ────────────────────────────────────────────────────────────
const ModoBursting = ({ workers, logs, systemSettings, saveToDb, workerRateHistory = [] }) => {
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
  const [nomes, setNomes] = useState(new Map());
  const [prefixo, setPrefixo] = useState('');
  const [tipoDoc, setTipoDoc] = useState('Recibo de Vencimento');

  const handleFicheiro = (e) => {
    const f = e.target.files?.[0];
    if (!f || f.type !== 'application/pdf') return;
    setFicheiro(f);
    setResultado(null);
    setEnviados(new Set());
    setSelecionados(new Set());
    setErros([]);
    setNomes(new Map());
    setGuardados(false); setErroGuardar(null);
    setAdicionado(false); setErroAdicionar(null);
  };

  const downloadPdf = (r) => {
    const blob = new Blob([r.pdfBytes], { type: 'application/pdf' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${nomes.get(r.nif) ?? `recibo_${r.mes ?? 'sem-mes'}_${r.nif}`}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadTodos = () => {
    resultado?.resultados.forEach(r => downloadPdf(r));
  };

  const aplicarPrefixo = () => {
    if (!resultado || !prefixo.trim()) return;
    setNomes(new Map(resultado.resultados.map(r => {
      const nome = r.worker?.name ?? r.nome ?? r.nif;
      const mes  = r.mes ?? 'sem-mes';
      const slug = `${prefixo.trim()} ${nome} ${mes}`.replace(/[/\\:*?"<>|]/g, '-');
      return [r.nif, slug];
    })));
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

  const tolerancias = calcularTolerancias(systemSettings);

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
        const bruto = calcularBrutoDeMes(worker, r.mes, logs, workerRateHistory);
        const validacao = aplicarOverrideSempreValido(parseReciboTOConline(r.texto, bruto, tolerancias), worker);
        return { ...r, worker, bruto, ...validacao };
      });
      setResultado({ resultados: enriquecidos, orfaos: res.orfaos });
      setSelecionados(new Set(enriquecidos.map(r => r.nif)));
      setNomes(new Map(enriquecidos.map(r => {
        const tipo = (r.tipo ?? 'recibo-de-vencimento').toLowerCase().replace(/\s+/g, '-');
        return [r.nif, `${tipo}_${r.mes ?? 'sem-mes'}_${r.nif}`];
      })));
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
      await guardarValidacoesEmLote(resultado.resultados, sessionId, r => ({ origem: r.nif }));
      setGuardados(true);
    } catch (e) { setErroGuardar(e.message); }
    finally { setGuardando(false); }
  };

  const totaisPorMesBurst = agregarTotaisPorMes(resultado?.resultados);

  const handleAdicionarACustosBurst = async () => {
    setAdicionando(true); setErroAdicionar(null);
    try {
      await adicionarCustosAoMes(totaisPorMesBurst, saveToDb, formatarMes);
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
        await associarDocumentoAoTrabalhador({ ...r, tipo: tipoDoc, supabase, nomeFicheiro: nomes.get(r.nif) });
        setEnviados(prev => new Set([...prev, r.nif]));
      } catch (err) {
        novosErros.push({ nif: r.nif, msg: err.message });
      }
    }
    setErros(novosErros);
    setEnviando(false);
  };

  const [guardandoPortal, setGuardandoPortal] = useState(false);
  const [guardadosPortal, setGuardadosPortal] = useState(false);
  const [erroPortal,      setErroPortal]      = useState(null);

  const handleGuardarNoPortal = async () => {
    const supabase = window.supabaseInstance;
    if (!supabase || !resultado) return;
    setGuardandoPortal(true); setErroPortal(null);
    const erros = [];
    for (const r of resultado.resultados) {
      if (!r.worker) { erros.push(`${r.nif}: trabalhador não encontrado`); continue; }
      try {
        await associarDocumentoAoTrabalhador({ ...r, tipo: tipoDoc, supabase, status: 'Rascunho', nomeFicheiro: nomes.get(r.nif) });
      } catch (e) {
        erros.push(`${r.worker.name}: ${e.message}`);
      }
    }
    if (erros.length) setErroPortal(erros.join(' | '));
    else setGuardadosPortal(true);
    setGuardandoPortal(false);
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
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:flex-wrap">
            <p className="text-[10px] font-black text-slate-500 tracking-widest sm:flex-1">
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
            <button onClick={handleGuardarNoPortal} disabled={guardandoPortal || guardadosPortal}
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:border-violet-400 hover:text-violet-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
              {guardandoPortal ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
              {guardadosPortal ? 'Guardado' : 'Guardar no Portal'}
            </button>
            <button onClick={handleEnviarSelecionados} disabled={enviando || selecionados.size === 0}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
              {enviando ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />}
              {selecionados.size > 0 ? `Enviar ${selecionados.size}` : 'Enviar'}
            </button>
          </div>
          {erroGuardar   && <p className="text-[10px] text-red-500 font-medium px-1">{erroGuardar}</p>}
          {erroAdicionar && <p className="text-[10px] text-red-500 font-medium px-1">{erroAdicionar}</p>}
          {erroPortal    && <p className="text-[10px] text-red-500 font-medium px-1">{erroPortal}</p>}

          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <select value={tipoDoc} onChange={e => {
              const tipo = e.target.value;
              setTipoDoc(tipo);
              if (resultado) {
                setNomes(new Map(resultado.resultados.map(r => {
                  const nome = r.worker?.name ?? r.nome ?? r.nif;
                  const slug = `${tipo} ${nome} ${r.mes ?? 'sem-mes'}`.replace(/[/\\:*?"<>|]/g, '-');
                  return [r.nif, slug];
                })));
              }
            }}
              className="text-[10px] font-black uppercase tracking-widest border border-slate-200 rounded-xl px-3 py-2 bg-white text-slate-600 focus:outline-none focus:border-indigo-400">
              {['Recibo de Vencimento','Mapa de Ajudas de Custo','Mapa de Deslocamento','Contrato de Trabalho','Outro'].map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <input
              value={prefixo}
              onChange={e => setPrefixo(e.target.value)}
              placeholder="Nome base (ex: Mapa de Ajuda de Custo)"
              className="flex-1 text-[10px] border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-400 bg-white text-slate-700 placeholder:text-slate-300"
            />
            <button onClick={aplicarPrefixo} disabled={!prefixo.trim()}
              className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-colors disabled:opacity-40">
              Aplicar a todos
            </button>
          </div>

          <div className="rounded-2xl border border-slate-100 overflow-hidden">
            <table className="w-full text-[10px]">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2.5">
                    <input type="checkbox" checked={todosSelected} onChange={() => toggleTodos(nifsTodos)}
                      className="rounded accent-indigo-600 cursor-pointer" />
                  </th>
                  {['Trabalhador','Mês','Nome do ficheiro',''].map(h => (
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
                      <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-0.5">
                          <input
                            value={nomes.get(r.nif) ?? ''}
                            onChange={e => setNomes(prev => { const next = new Map(prev); next.set(r.nif, e.target.value); return next; })}
                            className="text-[10px] text-slate-700 border border-slate-200 rounded-lg px-2 py-1 w-48 focus:outline-none focus:border-indigo-400 bg-white"
                          />
                          <span className="text-[10px] text-slate-400">.pdf</span>
                        </div>
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

export default ModoBursting;
