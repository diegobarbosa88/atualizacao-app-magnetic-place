import React from 'react';
import { Loader2, CheckCircle, Copy, AlertTriangle, FileSearch, RotateCcw, Zap } from 'lucide-react';
import { formatarMes } from '../../../../utils/validacaoHelpers';
import { fmtEur, fmtPct } from './ajudasUtils';

export default function TabelaEstimativa({
  selectedMonth, semHoras,
  clientesMesFinal, linhas,
  totalFaturaMes, totalAjudasMes, ajudasEfetivoMes,
  eEstimativa, ajudasReciboMes,
  regraCumprida, somaFixas, saldoRestante, nVazias,
  confirmado, confirmando, copiado,
  tocSemAuth, carregandoToC,
  overrides, setOverrides,
  obsAplicados, setObsAplicados,
  selecionados, setSelecionados,
  obsResult, extraindoObs,
  onExtrairObs, onRedistribuir, onCopiar, onConfirmar,
  onFaturarCliente,
}) {
  const nFixas = linhas.filter(l => l.eFixa).length;
  return (
    <div className="rounded-2xl border border-slate-100 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <div>
          <h3 className="text-sm font-black text-slate-800">
            Distribuição — {formatarMes(selectedMonth)}
          </h3>
          <p className="text-[10px] text-slate-400 mt-0.5">
            Pass 1: {nFixas} fixa(s) {fmtEur(somaFixas)} | Pass 2: saldo {fmtEur(saldoRestante)} p/ {nVazias} estimada(s)
          </p>
        </div>
        <div className="flex items-center gap-2">
          {semHoras && clientesMesFinal.length > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-xl">
              <span className="text-[10px] font-bold text-blue-700">Valores de faturas TOConline</span>
            </div>
          )}
          {tocSemAuth && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-xl">
              <AlertTriangle size={12} className="text-amber-500" />
              <span className="text-[10px] font-bold text-amber-700">TOConline sem autenticação — sem faturas do mês</span>
            </div>
          )}
          {clientesMesFinal.length > 0 && (
            regraCumprida ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                <CheckCircle size={12} className="text-emerald-600" />
                <span className="text-[10px] font-bold text-emerald-700">Regra cumprida</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-xl" title="O total de ajudas faturadas ficará abaixo do total de recibos processados no ano">
                <AlertTriangle size={12} className="text-amber-500" />
                <span className="text-[10px] font-bold text-amber-700">Saldo por absorver</span>
              </div>
            )
          )}
          {confirmado && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl">
              <CheckCircle size={12} className="text-emerald-600" />
              <span className="text-[10px] font-bold text-emerald-700">Confirmado</span>
            </div>
          )}
        </div>
      </div>

      {carregandoToC ? (
        <div className="flex items-center justify-center gap-2 py-10 text-slate-400">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-xs font-semibold">A obter faturas do TOConline…</span>
        </div>
      ) : clientesMesFinal.length === 0 ? (
        <p className="text-center text-sm text-slate-400 py-10">
          Sem registos de horas nem faturas TOConline para {formatarMes(selectedMonth)}.
        </p>
      ) : (
        <>
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-2 py-2 w-7">
                  <input type="checkbox" title="Selecionar todos"
                    checked={selecionados.size === linhas.length && linhas.length > 0}
                    onChange={e => setSelecionados(e.target.checked ? new Set(linhas.map(l => l.clientId)) : new Set())}
                    className="accent-indigo-600 cursor-pointer" />
                </th>
                <th className="px-3 py-2 text-left text-[9px] font-black uppercase tracking-widest text-slate-400">Cliente</th>
                <th className="px-3 py-2 text-right text-[9px] font-black uppercase tracking-widest text-slate-400">Horas</th>
                <th className="px-3 py-2 text-right text-[9px] font-black uppercase tracking-widest text-slate-400">Valor Fatura</th>
                <th className="px-3 py-2 text-right text-[9px] font-black uppercase tracking-widest text-slate-400">% Total</th>
                <th className="px-3 py-2 text-right text-[9px] font-black uppercase tracking-widest text-slate-400">Ajudas de Custo <span className="font-normal normal-case tracking-normal">Fixa / Estimada</span></th>
                <th className="px-2 py-2 w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {linhas.map(l => (
                <tr key={l.clientId} className={`transition-colors ${selecionados.has(l.clientId) ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}>
                  <td className="px-2 py-2.5 w-7">
                    <input type="checkbox" checked={selecionados.has(l.clientId)}
                      onChange={e => setSelecionados(prev => { const n = new Set(prev); e.target.checked ? n.add(l.clientId) : n.delete(l.clientId); return n; })}
                      className="accent-indigo-600 cursor-pointer" />
                  </td>
                  <td className="px-3 py-2.5 font-bold text-slate-800">
                    {l.nome}
                    {l.fromToC && l.docNum && (
                      <span className="ml-1.5 font-mono font-normal text-[10px] text-slate-400">{l.docNum}</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right text-slate-500">{l.fromToC ? '—' : `${l.horas.toFixed(2)}h`}</td>
                  <td className="px-3 py-2.5 text-right font-bold text-slate-700">{fmtEur(l.valorFatura)}</td>
                  <td className="px-3 py-2.5 text-right text-slate-400">{fmtPct(l.proporcao * 100)}</td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {l.eFixa && l.daObservacao && (
                        <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[8px] font-black uppercase tracking-wider" title="Valor fixo extraído da observação da fatura TOConline">Fixa</span>
                      )}
                      {l.eFixa && !l.daObservacao && (
                        <span className="px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded text-[8px] font-black uppercase tracking-wider" title="Valor fixo definido manualmente">Manual</span>
                      )}
                      {!l.eFixa && (
                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-400 rounded text-[8px] font-black uppercase tracking-wider" title="Valor estimado proporcionalmente ao saldo disponível">Est.</span>
                      )}
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={overrides[l.clientId] !== undefined ? overrides[l.clientId] : l.ajudasEstimadas.toFixed(2)}
                        onChange={e => {
                          setOverrides(prev => ({ ...prev, [l.clientId]: e.target.value }));
                          setObsAplicados(prev => { if (!prev.has(l.clientId)) return prev; const n = new Set(prev); n.delete(l.clientId); return n; });
                        }}
                        className="w-24 text-right p-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-indigo-700 outline-none focus:ring-2 focus:ring-indigo-400"
                      />
                    </div>
                  </td>
                  <td className="px-2 py-2.5 w-8">
                    <button
                      onClick={() => {
                        const val = overrides[l.clientId] !== undefined
                          ? parseFloat(overrides[l.clientId]) || 0
                          : l.ajudasEstimadas;
                        onFaturarCliente({ clienteId: l.dbClientId, ajudasValor: val });
                      }}
                      title="Faturar este cliente"
                      className="p-1.5 rounded-lg text-slate-300 hover:text-emerald-600 hover:bg-emerald-50 transition-all"
                    >
                      <Zap size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-slate-200 bg-slate-50">
              <tr>
                <td className="px-2 py-2.5 w-7" />
                <td className="px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-500">TOTAL</td>
                <td className="px-3 py-2.5 text-right text-[10px] font-black text-slate-600">{semHoras ? '—' : `${linhas.reduce((s,l)=>s+l.horas,0).toFixed(2)}h`}</td>
                <td className="px-3 py-2.5 text-right text-[10px] font-black text-slate-700">{fmtEur(totalFaturaMes)}</td>
                <td className="px-3 py-2.5 text-right text-[10px] text-slate-400">100%</td>
                <td className="px-3 py-2.5 text-right">
                  <span className={`text-[10px] font-black ${ajudasEfetivoMes > 0 && Math.abs(totalAjudasMes - ajudasEfetivoMes) > 0.5 ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {fmtEur(totalAjudasMes)}
                  </span>
                </td>
                <td className="px-2 py-2.5 w-8" />
              </tr>
            </tfoot>
          </table>

          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 gap-2 flex-wrap">
            <p className="text-[10px] text-slate-400">
              Saldo disponível:{' '}
              <span className="font-bold text-indigo-600">{fmtEur(ajudasEfetivoMes)}</span>
              {ajudasEfetivoMes > 0 && Math.abs(totalAjudasMes - ajudasEfetivoMes) > 0.5 && (
                <span className="ml-2 text-amber-500 font-bold">
                  (diferença de {fmtEur(Math.abs(totalAjudasMes - ajudasEfetivoMes))})
                </span>
              )}
              {obsResult && (
                <span className={`ml-2 font-bold ${obsResult.startsWith('Erro') ? 'text-red-500' : obsResult.startsWith('Nenhuma') ? 'text-amber-500' : 'text-blue-600'}`}>
                  · {obsResult}
                </span>
              )}
            </p>
            <div className="flex gap-2">
              <button onClick={onExtrairObs} disabled={extraindoObs}
                className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-100 transition-all disabled:opacity-40"
                title="Procura as faturas TOConline do mês e preenche as ajudas com o valor da observação">
                {extraindoObs ? <Loader2 size={12} className="animate-spin" /> : <FileSearch size={12} />}
                {extraindoObs ? 'A extrair...' : 'Extrair da observação'}
              </button>
              <button onClick={onRedistribuir}
                disabled={selecionados.size === 0 && Object.keys(overrides).filter(k => !obsAplicados.has(k)).length === 0}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all disabled:opacity-40"
                title={selecionados.size > 0 ? `Repor distribuição proporcional nos ${selecionados.size} selecionado(s)` : 'Repor distribuição proporcional automática'}>
                <RotateCcw size={12} />
                {selecionados.size > 0 ? `Redistribuir (${selecionados.size})` : 'Redistribuir'}
              </button>
              <button onClick={onCopiar}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all">
                <Copy size={12} />
                {copiado ? 'Copiado!' : 'Copiar'}
              </button>
              <button onClick={onConfirmar} disabled={confirmando || confirmado}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 transition-all disabled:opacity-40">
                {confirmando ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                {confirmado ? 'Confirmado' : confirmando ? 'A guardar...' : 'Confirmar mês'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
