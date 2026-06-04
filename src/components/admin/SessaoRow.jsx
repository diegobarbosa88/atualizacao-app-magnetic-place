import React, { useState, useRef, useCallback } from 'react';
import { CheckCircle, AlertTriangle, XCircle, AlertCircle, ChevronRight, Loader2, Upload, Coins, Trash2 } from 'lucide-react';
import {
  separarRecibosTOConline,
  associarDocumentoAoTrabalhador,
} from '../../utils/separarRecibosTOConline';
import {
  formatarMes,
  formatarDataHora,
  ESTADO_BADGE,
  ESTADO_PT,
} from '../../utils/validacaoHelpers';
import { DivergenciaBadge, EstadoPicker } from './ValidacaoUI';

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
          <td colSpan={8} className="px-0 py-0">
            <div className="mx-4 mb-3 rounded-xl border border-slate-100 overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-3 py-2 text-left text-[9px] font-black uppercase tracking-widest text-slate-400">Trabalhador</th>
                    <th className="px-3 py-2 text-left text-[9px] font-black uppercase tracking-widest text-slate-400">Mês</th>
                    <th className="px-3 py-2 text-right text-[9px] font-black uppercase tracking-widest text-slate-400">Bruto</th>
                    <th className="px-3 py-2 text-right text-[9px] font-black uppercase tracking-widest text-slate-400">Bruto PDF</th>
                    <th className="px-3 py-2 text-right text-[9px] font-black uppercase tracking-widest text-slate-400">SS</th>
                    <th className="px-3 py-2 text-right text-[9px] font-black uppercase tracking-widest text-slate-400">IRS</th>
                    <th className="px-3 py-2 text-right text-[9px] font-black uppercase tracking-widest text-slate-400">Ajudas de Custo</th>
                    <th className="px-3 py-2 text-center text-[9px] font-black uppercase tracking-widest text-slate-400">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {sessao.map(r => (
                    <tr key={r.id} className="hover:bg-slate-50 transition-colors" title={r.mensagem}>
                      <td className="px-3 py-2.5 font-bold text-slate-800 max-w-[140px] truncate">{r.worker_name ?? '—'}</td>
                      <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">{r.mes ? formatarMes(r.mes) : '—'}</td>
                      <td className="px-3 py-2.5 text-right font-bold text-slate-700">{r.bruto_plataforma != null ? `${Number(r.bruto_plataforma).toFixed(2)}€` : '—'}</td>
                      <td className="px-3 py-2.5 text-right font-bold text-indigo-700">{r.bruto_extraido != null ? `${Number(r.bruto_extraido).toFixed(2)}€` : '—'}</td>
                      <td className="px-3 py-2.5 text-right text-slate-500">{r.ss_extraido != null ? `${Number(r.ss_extraido).toFixed(2)}€` : '—'}</td>
                      <td className="px-3 py-2.5 text-right text-slate-500">{r.irs_extraido != null ? `${Number(r.irs_extraido).toFixed(2)}€` : '—'}</td>
                      <td className="px-3 py-2.5 text-right text-emerald-600 font-bold">{r.ajudas_custo_extraidas != null ? `${Number(r.ajudas_custo_extraidas).toFixed(2)}€` : '—'}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-center gap-2">
                          <EstadoPicker atual={r.estado} onChange={(novo) => onAlterarEstado(r.id, novo)} size={14} />
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${ESTADO_BADGE[r.estado] ?? 'bg-slate-100 text-slate-500'}`}>
                            {ESTADO_PT[r.estado] ?? r.estado}
                          </span>
                          {r.liquido_extraido != null && (
                            (r.bruto_plataforma != null && r.ss_extraido != null && r.irs_extraido != null && (
                              <DivergenciaBadge
                                sinal={parseFloat((Number(r.liquido_extraido) - (Number(r.bruto_plataforma) - Number(r.ss_extraido) - Number(r.irs_extraido))).toFixed(2))}
                                className="text-xs font-bold"
                              />
                            ))
                            ||
                            (r.bruto_extraido != null && (
                              <DivergenciaBadge
                                sinal={parseFloat((Number(r.liquido_extraido) - Number(r.bruto_extraido)).toFixed(2))}
                                className="text-xs font-bold"
                              />
                            ))
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

export default SessaoRow;
