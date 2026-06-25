import React from 'react';
import { Loader2, CheckCircle, ChevronRight, Trash2 } from 'lucide-react';
import { formatarMes } from '../../../../utils/validacaoHelpers';
import { fmtEur, fmtPct, histKey, histKeyFatura, getHistInvoiceKeys, indexarFaturasPorCliente } from './ajudasUtils';

// Sub-componente interno: linhas de clientes de um mês expandido no histórico.
function HistMesLinhas({ mes, clientesMesHist, faturasHist, histOverrides, setHistOverrides, carregandoFaturasHist, clients, logs, selectedMonth, taxaAjudas, h }) {
  if (carregandoFaturasHist === mes) {
    return (
      <tr>
        <td colSpan={6} className="px-3 py-3 text-center">
          <Loader2 size={12} className="animate-spin inline text-slate-400" />
        </td>
      </tr>
    );
  }

  if (clientesMesHist.length === 0) {
    return (
      <tr>
        <td colSpan={6} className="px-3 py-2 text-[10px] text-slate-400 text-center italic">Sem registos por cliente.</td>
      </tr>
    );
  }

  const temLogsNoMes = logs.some(l => l.date?.startsWith(mes));
  const faturasDoMes = faturasHist[mes] ?? [];
  const faturasPorCliente = indexarFaturasPorCliente(faturasDoMes, clients);

  return clientesMesHist.map(r => {
    const client = clients.find(c => c.id === r.client_id);
    const nomeCliente = client?.name ?? r.client_id;
    const horasCliente = logs
      .filter(l => l.clientId === r.client_id && l.date?.startsWith(mes))
      .reduce((s, l) => s + (parseFloat(l.hours) || 0), 0);
    const totalFaturaCliente = (parseFloat(r.total_fatura) || 0) > 0
      ? parseFloat(r.total_fatura)
      : horasCliente * (parseFloat(client?.valorHora) || 0);
    const pct = h.totalFatura > 0 ? (totalFaturaCliente / h.totalFatura) * 100 : 0;
    const invoices = faturasPorCliente[r.client_id] ?? [];
    const ajudasSalvo = parseFloat(r.valor_ajudas) || 0;
    const ajudasTotal = ajudasSalvo > 0 ? ajudasSalvo : totalFaturaCliente * taxaAjudas;
    const totalFaturaInv = invoices.reduce((s, inv) => s + inv.valor, 0);
    const rowCls = `border-t border-slate-50 transition-colors ${mes === selectedMonth ? 'bg-indigo-50/40' : 'hover:bg-slate-50'}`;
    const subRowCls = `border-t border-slate-50/50 ${mes === selectedMonth ? 'bg-indigo-50/20' : 'bg-white'}`;

    if (invoices.length > 1) {
      // Várias faturas: cabeçalho do cliente + sub-linha por fatura
      return (
        <React.Fragment key={r.client_id}>
          <tr className={rowCls}>
            <td className="px-3 py-2.5 pl-8 font-bold text-slate-800">{nomeCliente}</td>
            <td className="px-3 py-2.5 text-right text-slate-500">
              {temLogsNoMes ? `${horasCliente.toFixed(2)}h` : '—'}
            </td>
            <td className="px-3 py-2.5 text-right font-bold text-slate-700">
              {totalFaturaCliente > 0 ? fmtEur(totalFaturaCliente) : '—'}
            </td>
            <td className="px-3 py-2.5 text-right text-slate-400">{fmtPct(pct)}</td>
            <td className="px-3 py-2.5 text-right text-[10px] font-black text-slate-500">
              {fmtEur(invoices.reduce((s, inv) => {
                const k = histKeyFatura(mes, r.client_id, inv.docNum);
                return s + (histOverrides[k] !== undefined
                  ? parseFloat(String(histOverrides[k]).replace(',', '.')) || 0
                  : (totalFaturaInv > 0 ? ajudasTotal * (inv.valor / totalFaturaInv) : 0));
              }, 0))}
            </td>
            <td />
          </tr>
          {invoices.map(inv => {
            const invKey = histKeyFatura(mes, r.client_id, inv.docNum);
            const invDefault = totalFaturaInv > 0
              ? (ajudasTotal * (inv.valor / totalFaturaInv)).toFixed(2)
              : '0.00';
            const invVal = histOverrides[invKey] !== undefined ? histOverrides[invKey] : invDefault;
            return (
              <tr key={inv.docNum} className={subRowCls}>
                <td className="px-3 py-1.5 pl-12 text-[10px] text-slate-400 font-mono">{inv.docNum}</td>
                <td />
                <td className="px-3 py-1.5 text-right text-[10px] text-slate-500">{fmtEur(inv.valor)}</td>
                <td />
                <td className="px-3 py-1.5 text-right">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={invVal}
                    onChange={e => setHistOverrides(prev => ({ ...prev, [invKey]: e.target.value }))}
                    className="w-24 text-right p-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-indigo-700 outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </td>
                <td />
              </tr>
            );
          })}
        </React.Fragment>
      );
    }

    // 0 ou 1 fatura: linha simples com input de ajudas no cliente
    const key = histKey(mes, r.client_id);
    const val = histOverrides[key] !== undefined ? histOverrides[key] : ajudasTotal.toFixed(2);
    return (
      <React.Fragment key={r.client_id}>
        <tr className={rowCls}>
          <td className="px-3 py-2.5 pl-8 font-bold text-slate-800">
            {nomeCliente}
            {invoices[0] && <span className="ml-2 text-[9px] font-mono text-slate-400">{invoices[0].docNum}</span>}
          </td>
          <td className="px-3 py-2.5 text-right text-slate-500">
            {temLogsNoMes ? `${horasCliente.toFixed(2)}h` : '—'}
          </td>
          <td className="px-3 py-2.5 text-right font-bold text-slate-700">
            {totalFaturaCliente > 0 ? fmtEur(totalFaturaCliente) : '—'}
          </td>
          <td className="px-3 py-2.5 text-right text-slate-400">{fmtPct(pct)}</td>
          <td className="px-3 py-2.5 text-right">
            <input
              type="number"
              min="0"
              step="0.01"
              value={val}
              onChange={e => setHistOverrides(prev => ({ ...prev, [key]: e.target.value }))}
              className="w-24 text-right p-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-indigo-700 outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </td>
          <td />
        </tr>
      </React.Fragment>
    );
  });
}

export default function PainelHistorico({
  ano, selectedMonth,
  historicoAnual, faturadosAno, taxaAjudas,
  faturasHist, histOverrides, setHistOverrides,
  expandidoHistMes, toggleExpandidoHist,
  gravandoHist, apagandoHist, carregandoFaturasHist,
  onGuardarHist, onApagarHist,
  clients, logs,
}) {
  const [historicoAberto, setHistoricoAberto] = React.useState(false);

  return (
    <div className="rounded-2xl border border-slate-100 bg-white overflow-hidden">
      <button onClick={() => setHistoricoAberto(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors">
        <span className="text-sm font-black text-slate-700">Histórico {ano}</span>
        <ChevronRight size={14} className={`text-slate-400 transition-transform ${historicoAberto ? 'rotate-90' : ''}`} />
      </button>
      {historicoAberto && (
        <div className="border-t border-slate-100 max-h-[70vh] overflow-y-auto">
          {historicoAnual.length === 0 ? (
            <p className="text-center text-sm text-slate-400 py-8">Sem dados para {ano}.</p>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-100 sticky top-0 z-20">
                <tr>
                  <th className="px-3 py-2 text-left text-[9px] font-black uppercase tracking-widest text-slate-400">Cliente</th>
                  <th className="px-3 py-2 text-right text-[9px] font-black uppercase tracking-widest text-slate-400">Horas</th>
                  <th className="px-3 py-2 text-right text-[9px] font-black uppercase tracking-widest text-slate-400">Valor Fatura</th>
                  <th className="px-3 py-2 text-right text-[9px] font-black uppercase tracking-widest text-slate-400">% Total</th>
                  <th className="px-3 py-2 text-right text-[9px] font-black uppercase tracking-widest text-slate-400">Ajudas Faturadas</th>
                  <th className="px-3 py-2 w-20"></th>
                </tr>
              </thead>
              <tbody>
                {historicoAnual.map(h => {
                  const aberto = expandidoHistMes === h.mes;
                  const clientesMesHist = faturadosAno.filter(r => r.mes === h.mes);
                  const temEdicoes = clientesMesHist.some(r =>
                    histOverrides[histKey(h.mes, r.client_id)] !== undefined ||
                    getHistInvoiceKeys(histOverrides, h.mes, r.client_id).length > 0
                  );
                  return (
                    <React.Fragment key={h.mes}>
                      {/* Cabeçalho do mês — clicável para expandir, sticky abaixo do thead */}
                      <tr
                        className="bg-slate-50 border-t border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors select-none sticky top-[30px] z-10"
                        onClick={() => toggleExpandidoHist(h.mes)}
                      >
                        <td colSpan={3} className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <ChevronRight size={12} className={`text-slate-400 transition-transform shrink-0 ${aberto ? 'rotate-90' : ''}`} />
                            <span className="font-black text-slate-700">{formatarMes(h.mes)}</span>
                            {h.mes === selectedMonth && (
                              <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-600 rounded text-[8px] font-black uppercase tracking-wider">Seleccionado</span>
                            )}
                            {h.ajudasRecibo > 0 ? (
                              <span className="text-[9px] text-slate-400">
                                Recibos: <span className="font-bold text-slate-600">{fmtEur(h.ajudasRecibo)}</span>
                              </span>
                            ) : h.ajudasEstimado > 0 ? (
                              <span className="text-[9px] text-amber-500">
                                Estimativa ({fmtPct(taxaAjudas * 100)}): <span className="font-bold">{fmtEur(h.ajudasEstimado)}</span>
                              </span>
                            ) : null}
                            {temEdicoes && (
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" title="Edições por guardar" />
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <span className={`text-[9px] font-black ${h.dif > 0.5 ? 'text-red-500' : h.dif < -0.5 ? 'text-emerald-600' : 'text-slate-400'}`}>
                            {h.dif !== 0 ? `${h.dif > 0 ? '+' : ''}${fmtEur(h.dif)}` : ''}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-black text-slate-700">{fmtEur(h.ajudasFaturadas)}</td>
                        <td className="px-3 py-2 text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => onGuardarHist(h.mes)}
                              disabled={gravandoHist === h.mes || !temEdicoes}
                              className="flex items-center gap-1 px-2 py-1 bg-indigo-600 text-white rounded-lg text-[9px] font-black hover:bg-slate-900 transition-all disabled:opacity-30"
                              title="Guardar edições"
                            >
                              {gravandoHist === h.mes ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle size={10} />}
                              Guardar
                            </button>
                            {clientesMesHist.length > 0 && (
                              <button
                                onClick={() => onApagarHist(h.mes)}
                                disabled={apagandoHist === h.mes}
                                className="p-1 text-slate-300 hover:text-red-500 transition-colors disabled:opacity-40"
                                title={`Apagar ${formatarMes(h.mes)}`}
                              >
                                {apagandoHist === h.mes ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {aberto && (
                        <HistMesLinhas
                          mes={h.mes}
                          clientesMesHist={clientesMesHist}
                          faturasHist={faturasHist}
                          histOverrides={histOverrides}
                          setHistOverrides={setHistOverrides}
                          carregandoFaturasHist={carregandoFaturasHist}
                          clients={clients}
                          logs={logs}
                          selectedMonth={selectedMonth}
                          taxaAjudas={taxaAjudas}
                          h={h}
                        />
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
              <tfoot className="border-t-2 border-slate-200 bg-slate-50">
                <tr>
                  <td className="px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-500">TOTAL {ano}</td>
                  <td />
                  <td className="px-3 py-2.5 text-right text-[10px] font-black text-slate-700">
                    {fmtEur(historicoAnual.reduce((s, h) => s + h.totalFatura, 0))}
                  </td>
                  <td />
                  <td className="px-3 py-2.5 text-right text-[10px] font-black text-slate-700">
                    {fmtEur(faturadosAno.reduce((s, r) => s + (parseFloat(r.valor_ajudas) || 0), 0))}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
