import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Loader2, CheckCircle, Copy, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';
import { MESES_PT, mesesDisponiveis, formatarMes } from '../../../utils/validacaoHelpers';

const fmtEur = v => (parseFloat(v) || 0).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
const fmtPct = v => (parseFloat(v) || 0).toFixed(2) + '%';

// Mês anterior ao mês fornecido no formato 'YYYY-MM'
function mesAnterior(mes) {
  const [y, m] = mes.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return d.toISOString().slice(0, 7);
}

export default function AjudasCalculadora({ logs, clients, selectedMonth }) {
  const ano = selectedMonth.slice(0, 4);
  const numMes = parseInt(selectedMonth.slice(5, 7), 10);
  const mesesRestantes = 13 - numMes; // inclui mês atual

  // — Estado —
  const [carregando, setCarregando] = useState(false);
  const [recibosAno, setRecibosAno] = useState([]);         // receipt_validations do ano
  const [faturadosAno, setFaturadosAno] = useState([]);     // ajudas_faturadas_clientes do ano
  const [confirmando, setConfirmando] = useState(false);
  const [confirmado, setConfirmado] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [historicoAberto, setHistoricoAberto] = useState(false);
  const [expandidoHistMes, setExpandidoHistMes] = useState(null);
  const [histOverrides, setHistOverrides] = useState({});   // 'YYYY-MM|clientId' → valorString
  const [gravandoHist, setGravandoHist] = useState(null);   // mes a gravar
  // overrides manuais: { clientId: valorString }
  const [overrides, setOverrides] = useState({});

  // — Carregar dados da BD —
  const carregar = useCallback(async () => {
    const db = window.supabaseInstance;
    if (!db) return;
    setCarregando(true);
    const [{ data: rv }, { data: af }] = await Promise.all([
      db.from('receipt_validations').select('mes, ajudas_custo_extraidas').like('mes', `${ano}-%`),
      db.from('ajudas_faturadas_clientes').select('*').like('mes', `${ano}-%`),
    ]);
    setRecibosAno(rv ?? []);
    setFaturadosAno(af ?? []);
    setCarregando(false);
    setConfirmado((af ?? []).some(r => r.mes === selectedMonth && r.confirmado));
  }, [ano, selectedMonth]);

  // Polling para supabaseInstance
  useEffect(() => {
    if (window.supabaseInstance) { carregar(); return; }
    let tries = 0;
    const id = setInterval(() => {
      tries++;
      if (window.supabaseInstance) { clearInterval(id); carregar(); }
      else if (tries >= 20) clearInterval(id);
    }, 250);
    return () => clearInterval(id);
  }, [carregar]);

  // Reset overrides ao mudar mês
  useEffect(() => { setOverrides({}); setConfirmado(false); }, [selectedMonth]);

  // — Cálculos anuais —
  const orcamentoAnual = useMemo(
    () => recibosAno.reduce((s, r) => s + (parseFloat(r.ajudas_custo_extraidas) || 0), 0),
    [recibosAno]
  );

  const jaFaturadoYTD = useMemo(
    () => faturadosAno.filter(r => r.mes < selectedMonth).reduce((s, r) => s + (parseFloat(r.valor_ajudas) || 0), 0),
    [faturadosAno, selectedMonth]
  );

  const saldoDisponivel = orcamentoAnual - jaFaturadoYTD;
  const sugestaoMes = mesesRestantes > 0 ? saldoDisponivel / mesesRestantes : 0;
  const progressoPct = orcamentoAnual > 0 ? Math.min((jaFaturadoYTD / orcamentoAnual) * 100, 100) : 0;

  // — Faturação por cliente no mês atual —
  const clientesMes = useMemo(() => {
    const logsDoMes = logs.filter(l => l.date?.startsWith(selectedMonth));
    const map = {};
    logsDoMes.forEach(l => {
      if (!l.clientId) return;
      if (!map[l.clientId]) map[l.clientId] = 0;
      map[l.clientId] += parseFloat(l.hours) || 0;
    });
    return Object.entries(map).map(([clientId, horas]) => {
      const client = clients.find(c => c.id === clientId);
      const valorFatura = horas * (parseFloat(client?.valorHora) || 0);
      return { clientId, nome: client?.name ?? clientId, horas, valorFatura };
    }).filter(c => c.valorFatura > 0).sort((a, b) => b.valorFatura - a.valorFatura);
  }, [logs, clients, selectedMonth]);

  const totalFaturaMes = useMemo(() => clientesMes.reduce((s, c) => s + c.valorFatura, 0), [clientesMes]);

  // — Ajudas estimadas por cliente (com overrides) —
  const linhas = useMemo(() => clientesMes.map(c => {
    const proporcao = totalFaturaMes > 0 ? c.valorFatura / totalFaturaMes : 0;
    const estimadoAuto = sugestaoMes * proporcao;
    const valorStr = overrides[c.clientId];
    const ajudas = valorStr !== undefined ? (parseFloat(valorStr.replace(',', '.')) || 0) : estimadoAuto;
    return { ...c, proporcao, ajudasEstimadas: ajudas };
  }), [clientesMes, totalFaturaMes, sugestaoMes, overrides]);

  const totalAjudasMes = linhas.reduce((s, l) => s + l.ajudasEstimadas, 0);

  // — Confirmar e guardar —
  const handleConfirmar = async () => {
    const db = window.supabaseInstance;
    if (!db || !linhas.length) return;
    setConfirmando(true);
    await Promise.all(linhas.map(l =>
      db.from('ajudas_faturadas_clientes').upsert(
        { mes: selectedMonth, client_id: l.clientId, valor_ajudas: parseFloat(l.ajudasEstimadas.toFixed(2)), confirmado: true },
        { onConflict: 'mes,client_id' }
      )
    ));
    await carregar();
    setConfirmando(false);
    setConfirmado(true);
  };

  // — Copiar tabela —
  const handleCopiar = () => {
    const header = ['Cliente', 'Horas', 'Valor Fatura', 'Ajudas de Custo (incluídas)'].join('\t');
    const rows = linhas.map(l =>
      [l.nome, l.horas.toFixed(2), l.valorFatura.toFixed(2), l.ajudasEstimadas.toFixed(2)].join('\t')
    );
    const total = ['TOTAL', linhas.reduce((s,l)=>s+l.horas,0).toFixed(2), totalFaturaMes.toFixed(2), totalAjudasMes.toFixed(2)].join('\t');
    navigator.clipboard.writeText([header, ...rows, total].join('\n'));
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  // — Histórico anual —
  const historicoAnual = useMemo(() => {
    const meses = [...new Set([
      ...recibosAno.map(r => r.mes),
      ...faturadosAno.map(r => r.mes),
    ])].sort((a, b) => b.localeCompare(a));
    return meses.map(mes => {
      const ajudasRecibo = recibosAno.filter(r => r.mes === mes).reduce((s, r) => s + (parseFloat(r.ajudas_custo_extraidas) || 0), 0);
      const ajudasFaturadas = faturadosAno.filter(r => r.mes === mes).reduce((s, r) => s + (parseFloat(r.valor_ajudas) || 0), 0);
      return { mes, ajudasRecibo, ajudasFaturadas, dif: ajudasFaturadas - ajudasRecibo };
    });
  }, [recibosAno, faturadosAno]);

  // — Guardar edições do histórico —
  const handleGuardarHist = async (mes) => {
    const db = window.supabaseInstance;
    if (!db) return;
    setGravandoHist(mes);
    const linhasMes = faturadosAno.filter(r => r.mes === mes);
    await Promise.all(linhasMes.map(r => {
      const key = `${mes}|${r.client_id}`;
      const val = histOverrides[key] !== undefined
        ? parseFloat(String(histOverrides[key]).replace(',', '.')) || 0
        : parseFloat(r.valor_ajudas) || 0;
      return db.from('ajudas_faturadas_clientes')
        .upsert({ mes, client_id: r.client_id, valor_ajudas: parseFloat(val.toFixed(2)), confirmado: true }, { onConflict: 'mes,client_id' });
    }));
    await carregar();
    setHistOverrides(prev => {
      const next = { ...prev };
      linhasMes.forEach(r => delete next[`${mes}|${r.client_id}`]);
      return next;
    });
    setGravandoHist(null);
  };

  // — Cor da barra de progresso —
  const barCls = progressoPct >= 95 ? 'bg-red-500' : progressoPct >= 75 ? 'bg-yellow-400' : 'bg-emerald-500';

  if (carregando) return (
    <div className="flex justify-center py-16"><Loader2 size={22} className="animate-spin text-indigo-400" /></div>
  );

  return (
    <div className="space-y-5">

      {/* ── Painel anual ── */}
      <div className="rounded-2xl border border-slate-100 bg-white p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-black text-slate-800">Orçamento Anual de Ajudas — {ano}</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Baseado nos recibos TOConline processados do ano</p>
          </div>
          {orcamentoAnual === 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-xl">
              <AlertTriangle size={12} className="text-amber-500" />
              <span className="text-[10px] font-bold text-amber-600">Sem recibos processados este ano</span>
            </div>
          )}
        </div>

        {/* Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {[
            { label: 'Orçamento anual', val: fmtEur(orcamentoAnual), cls: 'indigo' },
            { label: 'Já faturado', val: fmtEur(jaFaturadoYTD), cls: 'slate' },
            { label: 'Saldo restante', val: fmtEur(saldoDisponivel), cls: saldoDisponivel < 0 ? 'red' : 'emerald' },
            { label: 'Meses restantes', val: mesesRestantes, cls: 'slate' },
            { label: 'Sugestão este mês', val: fmtEur(sugestaoMes), cls: 'indigo' },
          ].map(({ label, val, cls }) => (
            <div key={label} className={`bg-${cls}-50 border border-${cls}-100 rounded-xl p-3 text-center`}>
              <p className={`text-base font-black text-${cls}-700`}>{val}</p>
              <p className={`text-[9px] font-black uppercase tracking-widest text-${cls}-400 mt-0.5`}>{label}</p>
            </div>
          ))}
        </div>

        {/* Barra de progresso */}
        {orcamentoAnual > 0 && (
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>Faturado vs Orçamento</span>
              <span>{fmtPct(progressoPct)}</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${barCls}`} style={{ width: `${progressoPct}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* ── Estimativa do mês atual ── */}
      <div className="rounded-2xl border border-slate-100 bg-white overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-black text-slate-800">
              Estimativa — {formatarMes(selectedMonth)}
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Sugestão distribui {fmtEur(sugestaoMes)} proporcional à faturação de cada cliente
            </p>
          </div>
          {confirmado && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl">
              <CheckCircle size={12} className="text-emerald-600" />
              <span className="text-[10px] font-bold text-emerald-700">Confirmado</span>
            </div>
          )}
        </div>

        {clientesMes.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-10">Sem registos de horas para {formatarMes(selectedMonth)}.</p>
        ) : (
          <>
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-3 py-2 text-left text-[9px] font-black uppercase tracking-widest text-slate-400">Cliente</th>
                  <th className="px-3 py-2 text-right text-[9px] font-black uppercase tracking-widest text-slate-400">Horas</th>
                  <th className="px-3 py-2 text-right text-[9px] font-black uppercase tracking-widest text-slate-400">Valor Fatura</th>
                  <th className="px-3 py-2 text-right text-[9px] font-black uppercase tracking-widest text-slate-400">% Total</th>
                  <th className="px-3 py-2 text-right text-[9px] font-black uppercase tracking-widest text-slate-400">Ajudas Incluídas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {linhas.map(l => (
                  <tr key={l.clientId} className="hover:bg-slate-50 transition-colors">
                    <td className="px-3 py-2.5 font-bold text-slate-800">{l.nome}</td>
                    <td className="px-3 py-2.5 text-right text-slate-500">{l.horas.toFixed(2)}h</td>
                    <td className="px-3 py-2.5 text-right font-bold text-slate-700">{fmtEur(l.valorFatura)}</td>
                    <td className="px-3 py-2.5 text-right text-slate-400">{fmtPct(l.proporcao * 100)}</td>
                    <td className="px-3 py-2.5 text-right">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={overrides[l.clientId] !== undefined ? overrides[l.clientId] : l.ajudasEstimadas.toFixed(2)}
                        onChange={e => setOverrides(prev => ({ ...prev, [l.clientId]: e.target.value }))}
                        className="w-24 text-right p-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-indigo-700 outline-none focus:ring-2 focus:ring-indigo-400"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-slate-200 bg-slate-50">
                <tr>
                  <td className="px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-500">TOTAL</td>
                  <td className="px-3 py-2.5 text-right text-[10px] font-black text-slate-600">{linhas.reduce((s,l)=>s+l.horas,0).toFixed(2)}h</td>
                  <td className="px-3 py-2.5 text-right text-[10px] font-black text-slate-700">{fmtEur(totalFaturaMes)}</td>
                  <td className="px-3 py-2.5 text-right text-[10px] text-slate-400">100%</td>
                  <td className="px-3 py-2.5 text-right">
                    <span className={`text-[10px] font-black ${Math.abs(totalAjudasMes - sugestaoMes) > 0.5 ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {fmtEur(totalAjudasMes)}
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>

            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 gap-2">
              <p className="text-[10px] text-slate-400">
                Sugestão: <span className="font-bold text-indigo-600">{fmtEur(sugestaoMes)}</span>
                {Math.abs(totalAjudasMes - sugestaoMes) > 0.5 && (
                  <span className="ml-2 text-amber-500 font-bold">
                    (diferença de {fmtEur(Math.abs(totalAjudasMes - sugestaoMes))})
                  </span>
                )}
              </p>
              <div className="flex gap-2">
                <button onClick={handleCopiar}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all">
                  <Copy size={12} />
                  {copiado ? 'Copiado!' : 'Copiar'}
                </button>
                <button onClick={handleConfirmar} disabled={confirmando || confirmado}
                  className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 transition-all disabled:opacity-40">
                  {confirmando ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                  {confirmado ? 'Confirmado' : confirmando ? 'A guardar...' : 'Confirmar mês'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Histórico anual ── */}
      <div className="rounded-2xl border border-slate-100 bg-white overflow-hidden">
        <button onClick={() => setHistoricoAberto(o => !o)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors">
          <span className="text-sm font-black text-slate-700">Histórico {ano}</span>
          <ChevronRight size={14} className={`text-slate-400 transition-transform ${historicoAberto ? 'rotate-90' : ''}`} />
        </button>
        {historicoAberto && (
          <div className="border-t border-slate-100">
            {historicoAnual.length === 0 ? (
              <p className="text-center text-sm text-slate-400 py-8">Sem dados para {ano}.</p>
            ) : (
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-3 py-2 text-left text-[9px] font-black uppercase tracking-widest text-slate-400">Mês</th>
                    <th className="px-3 py-2 text-right text-[9px] font-black uppercase tracking-widest text-slate-400">Ajudas Recibos</th>
                    <th className="px-3 py-2 text-right text-[9px] font-black uppercase tracking-widest text-slate-400">Ajudas Faturadas</th>
                    <th className="px-3 py-2 text-right text-[9px] font-black uppercase tracking-widest text-slate-400">Diferença</th>
                    <th className="px-3 py-2 w-6"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {historicoAnual.map(h => {
                    const aberto = expandidoHistMes === h.mes;
                    const clientesMesHist = faturadosAno.filter(r => r.mes === h.mes);
                    const temEdicoes = clientesMesHist.some(r => histOverrides[`${h.mes}|${r.client_id}`] !== undefined);
                    return (
                      <React.Fragment key={h.mes}>
                        <tr
                          onClick={() => setExpandidoHistMes(aberto ? null : h.mes)}
                          className={`cursor-pointer select-none transition-colors ${h.mes === selectedMonth ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}
                        >
                          <td className="px-3 py-2.5 font-bold text-slate-700">
                            <div className="flex items-center gap-1.5">
                              <ChevronRight size={12} className={`text-slate-300 transition-transform shrink-0 ${aberto ? 'rotate-90' : ''}`} />
                              {formatarMes(h.mes)}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-right text-slate-600">{fmtEur(h.ajudasRecibo)}</td>
                          <td className="px-3 py-2.5 text-right text-slate-600">{fmtEur(h.ajudasFaturadas)}</td>
                          <td className={`px-3 py-2.5 text-right font-bold ${h.dif > 0.5 ? 'text-red-600' : h.dif < -0.5 ? 'text-emerald-600' : 'text-slate-400'}`}>
                            {h.dif > 0 ? '+' : ''}{fmtEur(h.dif)}
                          </td>
                          <td className="px-3 py-2.5"></td>
                        </tr>
                        {aberto && (
                          <tr onClick={e => e.stopPropagation()}>
                            <td colSpan={5} className="px-4 py-3 bg-slate-50 border-b border-slate-100">
                              {clientesMesHist.length === 0 ? (
                                <p className="text-[10px] text-slate-400 text-center py-2">Sem registos por cliente para este mês.</p>
                              ) : (
                                <div className="space-y-2" onClick={e => e.stopPropagation()}>
                                  {clientesMesHist.map(r => {
                                    const key = `${h.mes}|${r.client_id}`;
                                    const nomeCliente = clients.find(c => c.id === r.client_id)?.name ?? r.client_id;
                                    const val = histOverrides[key] !== undefined ? histOverrides[key] : parseFloat(r.valor_ajudas).toFixed(2);
                                    return (
                                      <div key={r.client_id} className="flex items-center justify-between gap-3 py-1 border-b border-slate-100 last:border-0">
                                        <span className="text-xs font-bold text-slate-700">{nomeCliente}</span>
                                        <input
                                          type="text"
                                          inputMode="decimal"
                                          value={val}
                                          onChange={e => setHistOverrides(prev => ({ ...prev, [key]: e.target.value }))}
                                          onClick={e => e.stopPropagation()}
                                          className="w-28 text-right p-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-indigo-700 outline-none focus:ring-2 focus:ring-indigo-400"
                                        />
                                      </div>
                                    );
                                  })}
                                  <div className="flex justify-end pt-1">
                                    <button
                                      onClick={e => { e.stopPropagation(); handleGuardarHist(h.mes); }}
                                      disabled={gravandoHist === h.mes || !temEdicoes}
                                      className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 transition-all disabled:opacity-40"
                                    >
                                      {gravandoHist === h.mes ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle size={11} />}
                                      {gravandoHist === h.mes ? 'A guardar...' : 'Guardar'}
                                    </button>
                                  </div>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                  <tr className="border-t-2 border-slate-200 bg-slate-50">
                    <td className="px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-500">TOTAL {ano}</td>
                    <td className="px-3 py-2.5 text-right text-[10px] font-black text-slate-700">{fmtEur(orcamentoAnual)}</td>
                    <td className="px-3 py-2.5 text-right text-[10px] font-black text-slate-700">
                      {fmtEur(faturadosAno.reduce((s,r) => s + (parseFloat(r.valor_ajudas)||0), 0))}
                    </td>
                    <td className={`px-3 py-2.5 text-right text-[10px] font-black ${(faturadosAno.reduce((s,r)=>s+(parseFloat(r.valor_ajudas)||0),0) - orcamentoAnual) > 0.5 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {(() => {
                        const d = faturadosAno.reduce((s,r)=>s+(parseFloat(r.valor_ajudas)||0),0) - orcamentoAnual;
                        return `${d > 0 ? '+' : ''}${fmtEur(d)}`;
                      })()}
                    </td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
