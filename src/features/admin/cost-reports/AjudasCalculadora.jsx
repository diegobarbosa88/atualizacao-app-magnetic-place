import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Loader2, CheckCircle, Copy, ChevronDown, ChevronRight, AlertTriangle, Trash2, RotateCcw } from 'lucide-react';
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
  const [apagandoHist, setApagandoHist] = useState(null);   // mes a apagar
  // overrides manuais: { clientId: valorString }
  const [overrides, setOverrides] = useState({});

  // Recibos de referência para estimativa (meses anteriores, quando o mês atual não tem dados)
  const [recibosRef, setRecibosRef] = useState([]);

  const [selecionados, setSelecionados] = useState(new Set()); // clientIds selecionados para redistribuição

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
  useEffect(() => { setOverrides({}); setConfirmado(false); setSelecionados(new Set()); }, [selectedMonth]);

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
  const progressoPct = orcamentoAnual > 0 ? Math.min((jaFaturadoYTD / orcamentoAnual) * 100, 100) : 0;

  // — Faturação por cliente no mês atual —
  // selectedMonth = mês de trabalho; as horas são do próprio mês selecionado.
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
      return { clientId, dbClientId: clientId, nome: client?.name ?? clientId, horas, valorFatura };
    }).filter(c => c.valorFatura > 0).sort((a, b) => b.valorFatura - a.valorFatura);
  }, [logs, clients, selectedMonth]);

  const semHoras = clientesMes.length === 0;

  // Ajudas e recibos são sempre do mês seleccionado.
  const mesDoRecibo = selectedMonth;

  // Carrega meses anteriores com dados para estimar quando mesDoRecibo não tem recibos
  useEffect(() => {
    const db = window.supabaseInstance;
    if (!db) return;
    const temDados = recibosAno.some(r => r.mes === mesDoRecibo && parseFloat(r.ajudas_custo_extraidas) > 0);
    if (temDados) { setRecibosRef([]); return; }
    const [y, m] = mesDoRecibo.split('-').map(Number);
    const limite = new Date(y, m - 7, 1);
    const limiteStr = `${limite.getFullYear()}-${String(limite.getMonth() + 1).padStart(2, '0')}`;
    db.from('receipt_validations')
      .select('mes, ajudas_custo_extraidas')
      .lte('mes', mesDoRecibo)   // inclui mesDoRecibo quando não está em recibosAno (ex: Dez do ano anterior)
      .gte('mes', limiteStr)
      .gt('ajudas_custo_extraidas', 0)
      .order('mes', { ascending: false })
      .then(({ data }) => setRecibosRef(data || []));
  }, [mesDoRecibo, recibosAno]);

  // Ajudas do recibo do mês anterior ao seleccionado.
  // Inclui recibosRef para cobrir o caso em que mesDoRecibo é de outro ano.
  const ajudasReciboMes = useMemo(() => {
    return [...recibosAno, ...recibosRef]
      .filter(r => r.mes === mesDoRecibo)
      .reduce((s, r) => s + (parseFloat(r.ajudas_custo_extraidas) || 0), 0);
  }, [recibosAno, recibosRef, mesDoRecibo]);


  const clientesMesFinal = clientesMes;

  const totalFaturaMes = useMemo(() => clientesMesFinal.reduce((s, c) => s + c.valorFatura, 0), [clientesMesFinal]);

  // Taxa histórica de ajudas sobre faturação: total ajudas faturadas / total faturas
  // Usa apenas meses anteriores ao seleccionado para não contaminar a estimativa corrente.
  const taxaAjudas = useMemo(() => {
    const totalFat = faturadosAno.reduce((s, r) => s + (parseFloat(r.total_fatura) || 0), 0);
    const totalAj  = faturadosAno.reduce((s, r) => s + (parseFloat(r.valor_ajudas) || 0), 0);
    return totalFat > 0 ? totalAj / totalFat : 0;
  }, [faturadosAno]);

  // Total alvo: totalFaturaMes × taxa + saldo. Sempre calculado — saldo incluído mesmo sem taxa histórica.
  const ajudasEstimadoMes = useMemo(
    () => Math.max(0, totalFaturaMes * taxaAjudas + saldoDisponivel),
    [taxaAjudas, totalFaturaMes, saldoDisponivel]
  );

  const ajudasEfetivoMes = ajudasEstimadoMes > 0 ? ajudasEstimadoMes : ajudasReciboMes;
  const eEstimativa = taxaAjudas > 0 || saldoDisponivel > 0;

  // — Ajudas por cliente —
  // Override/obs mantém o valor fixo. O alvo global (ajudasEfetivoMes) é sempre
  // distribuído na íntegra: o que sobra após os fixos vai proporcionalmente aos restantes;
  // se todos tiverem fixo, o saldo residual é adicionado proporcionalmente a todos.
  const linhas = useMemo(() => {
    const comFixo = clientesMesFinal.map(c => {
      const valorStr = overrides[c.clientId];
      let fixo = null;
      if (valorStr !== undefined) fixo = parseFloat(String(valorStr).replace(',', '.')) || 0;
      else if (c.ajudasObs != null) fixo = c.ajudasObs;
      return { ...c, fixo, daObservacao: c.ajudasObs != null };
    });
    const somaFixos = comFixo.reduce((s, c) => s + (c.fixo ?? 0), 0);
    const restante = Math.max(0, ajudasEfetivoMes - somaFixos);
    const faturaNaoFixos = comFixo.filter(c => c.fixo == null).reduce((s, c) => s + c.valorFatura, 0);
    const todosSaoFixos = faturaNaoFixos === 0;
    return comFixo.map(c => {
      const proporcao = totalFaturaMes > 0 ? c.valorFatura / totalFaturaMes : 0;
      let ajudas;
      if (c.fixo != null) {
        // Quando todos têm valor fixo, distribuir o saldo residual proporcionalmente por cima
        ajudas = c.fixo + (todosSaoFixos && restante > 0 ? restante * proporcao : 0);
      } else {
        ajudas = faturaNaoFixos > 0 ? restante * (c.valorFatura / faturaNaoFixos) : 0;
      }
      return { ...c, proporcao, ajudasEstimadas: ajudas };
    });
  }, [clientesMesFinal, totalFaturaMes, ajudasEfetivoMes, overrides]);

  const totalAjudasMes = linhas.reduce((s, l) => s + l.ajudasEstimadas, 0);

  // — Confirmar e guardar —
  const handleConfirmar = async () => {
    const db = window.supabaseInstance;
    if (!db || !linhas.length) return;
    setConfirmando(true);
    // Guarda exatamente os valores visíveis na tabela (ajudasEstimadas já incorpora
    // overrides manuais e valores de observação). Agrega por dbClientId porque a
    // tabela tem UNIQUE(mes, client_id) e um cliente pode ter várias faturas no mês.
    const porCliente = {};
    linhas.forEach(l => {
      const dbId = l.dbClientId ?? l.clientId;
      if (!porCliente[dbId]) porCliente[dbId] = { valor: 0, fatura: 0 };
      porCliente[dbId].valor += l.ajudasEstimadas;
      porCliente[dbId].fatura += l.valorFatura || 0;
    });
    await Promise.all(Object.entries(porCliente).map(([clientId, v]) =>
      db.from('ajudas_faturadas_clientes').upsert(
        {
          mes: selectedMonth,
          client_id: clientId,
          valor_ajudas: parseFloat(v.valor.toFixed(2)),
          total_fatura: parseFloat(v.fatura.toFixed(2)),
          confirmado: true,
        },
        { onConflict: 'mes,client_id' }
      )
    ));
    await carregar();
    setConfirmando(false);
    setConfirmado(true);
  };

  // Redistribuir = limpar overrides manuais dos clientes alvo, deixando o
  // cálculo proporcional automático (linhas useMemo) assumir.
  const handleRedistribuir = () => {
    const alvoIds = selecionados.size > 0
      ? [...selecionados]
      : linhas.map(l => l.clientId);
    if (!alvoIds.length) return;
    setOverrides(prev => {
      const next = { ...prev };
      alvoIds.forEach(id => delete next[id]);
      return next;
    });
    setSelecionados(new Set());
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
      const linhasMes = faturadosAno.filter(r => r.mes === mes);
      const ajudasRecibo = recibosAno.filter(r => r.mes === mes).reduce((s, r) => s + (parseFloat(r.ajudas_custo_extraidas) || 0), 0);
      const ajudasFaturadas = linhasMes.reduce((s, r) => s + (parseFloat(r.valor_ajudas) || 0), 0);
      // Prefere o total guardado (inclui faturas TOConline); fallback para horas dos logs
      const totalGuardado = linhasMes.reduce((s, r) => s + (parseFloat(r.total_fatura) || 0), 0);
      const totalLogs = logs.filter(l => l.date?.startsWith(mes)).reduce((s, l) => {
        const client = clients.find(c => c.id === l.clientId);
        return s + (parseFloat(l.hours) || 0) * (parseFloat(client?.valorHora) || 0);
      }, 0);
      const totalFatura = totalGuardado > 0 ? totalGuardado : totalLogs;
      const ajudasEstimado = ajudasRecibo === 0 ? totalFatura * taxaAjudas : 0;
      const referencia = ajudasRecibo > 0 ? ajudasRecibo : ajudasEstimado;
      return { mes, ajudasRecibo, ajudasEstimado, ajudasFaturadas, totalFatura, dif: ajudasFaturadas - referencia };
    });
  }, [recibosAno, faturadosAno, logs, clients, taxaAjudas]);

  // — Guardar edições do histórico —
  // Suporta overrides por fatura (chave "mes|client_id|docNum") e por cliente ("mes|client_id").
  // Quando existem overrides por fatura, soma-os para obter o total do cliente.
  const handleGuardarHist = async (mes) => {
    const db = window.supabaseInstance;
    if (!db) return;
    setGravandoHist(mes);
    const linhasMes = faturadosAno.filter(r => r.mes === mes);
    await Promise.all(linhasMes.map(r => {
      const prefixFatura = `${mes}|${r.client_id}|`;
      const invoiceKeys = Object.keys(histOverrides).filter(k => k.startsWith(prefixFatura));
      const val = invoiceKeys.length > 0
        ? invoiceKeys.reduce((s, k) => s + (parseFloat(String(histOverrides[k]).replace(',', '.')) || 0), 0)
        : histOverrides[`${mes}|${r.client_id}`] !== undefined
          ? parseFloat(String(histOverrides[`${mes}|${r.client_id}`]).replace(',', '.')) || 0
          : parseFloat(r.valor_ajudas) || 0;
      return db.from('ajudas_faturadas_clientes')
        .upsert({ mes, client_id: r.client_id, valor_ajudas: parseFloat(val.toFixed(2)), total_fatura: parseFloat(r.total_fatura) || 0, confirmado: true }, { onConflict: 'mes,client_id' });
    }));
    await carregar();
    setHistOverrides(prev => {
      const next = { ...prev };
      linhasMes.forEach(r => {
        delete next[`${mes}|${r.client_id}`];
        Object.keys(next).filter(k => k.startsWith(`${mes}|${r.client_id}|`)).forEach(k => delete next[k]);
      });
      return next;
    });
    setGravandoHist(null);
  };

  // — Apagar um mês do histórico —
  const handleApagarHist = async (mes) => {
    const db = window.supabaseInstance;
    if (!db) return;
    if (!confirm(`Apagar as ajudas faturadas de ${formatarMes(mes)}? Esta ação não pode ser desfeita.`)) return;
    setApagandoHist(mes);
    await db.from('ajudas_faturadas_clientes').delete().eq('mes', mes);
    await carregar();
    setExpandidoHistMes(prev => (prev === mes ? null : prev));
    if (mes === selectedMonth) setConfirmado(false);
    setApagandoHist(null);
  };

  const toggleExpandidoHist = (mes) => {
    setExpandidoHistMes(prev => prev === mes ? null : mes);
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
            <h3 className="text-sm font-black text-slate-800">Ajudas de Custo — {ano}</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Baseado nos recibos processados do ano</p>
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
            { label: 'Total recibos ano', val: fmtEur(orcamentoAnual), cls: 'indigo' },
            { label: 'Já faturado', val: fmtEur(jaFaturadoYTD), cls: 'slate' },
            { label: 'Saldo restante', val: fmtEur(saldoDisponivel), cls: saldoDisponivel < 0 ? 'red' : 'emerald' },
            { label: 'Meses restantes', val: mesesRestantes, cls: 'slate' },
            { label: eEstimativa ? 'Ajudas (estimativa)' : semHoras ? 'Recibos mês anterior' : 'Recibos deste mês', val: fmtEur(ajudasEfetivoMes), cls: eEstimativa ? 'amber' : 'indigo' },
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
              <span>Faturado vs Total recibos</span>
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
              {eEstimativa
                ? `Estimativa por taxa histórica (${fmtPct(taxaAjudas * 100)}) × faturação do mês — ${fmtEur(ajudasEfetivoMes)}${saldoDisponivel > 0 && ajudasEstimadoMes < totalFaturaMes * taxaAjudas ? ' (limitado pelo saldo)' : ''}`
                : `Distribui as ajudas dos recibos do mês (${fmtEur(ajudasReciboMes)}) proporcional à faturação de cada cliente`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {confirmado && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                <CheckCircle size={12} className="text-emerald-600" />
                <span className="text-[10px] font-bold text-emerald-700">Confirmado</span>
              </div>
            )}
          </div>
        </div>

        {clientesMesFinal.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-10">
            Sem registos de horas para {formatarMes(selectedMonth)}.
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
                  <th className="px-3 py-2 text-right text-[9px] font-black uppercase tracking-widest text-slate-400">Ajudas Incluídas</th>
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
                    <td className="px-3 py-2.5 font-bold text-slate-800">{l.nome}</td>
                    <td className="px-3 py-2.5 text-right text-slate-500">{`${l.horas.toFixed(2)}h`}</td>
                    <td className="px-3 py-2.5 text-right font-bold text-slate-700">{fmtEur(l.valorFatura)}</td>
                    <td className="px-3 py-2.5 text-right text-slate-400">{fmtPct(l.proporcao * 100)}</td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={overrides[l.clientId] !== undefined ? overrides[l.clientId] : l.ajudasEstimadas.toFixed(2)}
                          onChange={e => {
                            setOverrides(prev => ({ ...prev, [l.clientId]: e.target.value }));
                          }}
                          className="w-24 text-right p-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-indigo-700 outline-none focus:ring-2 focus:ring-indigo-400"
                        />
                      </div>
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
                </tr>
              </tfoot>
            </table>

            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 gap-2 flex-wrap">
              <p className="text-[10px] text-slate-400">
                {eEstimativa ? 'Estimativa' : 'Recibos do mês'}:{' '}
                <span className={`font-bold ${eEstimativa ? 'text-amber-600' : 'text-indigo-600'}`}>{fmtEur(ajudasEfetivoMes)}</span>
                {eEstimativa && <span className="ml-1 text-amber-500">(taxa {fmtPct(taxaAjudas * 100)})</span>}
                {ajudasEfetivoMes > 0 && Math.abs(totalAjudasMes - ajudasEfetivoMes) > 0.5 && (
                  <span className="ml-2 text-amber-500 font-bold">
                    (diferença de {fmtEur(Math.abs(totalAjudasMes - ajudasEfetivoMes))})
                  </span>
                )}
              </p>
              <div className="flex gap-2">
                <button onClick={handleRedistribuir}
                  disabled={selecionados.size === 0 && Object.keys(overrides).length === 0}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all disabled:opacity-40"
                  title={selecionados.size > 0 ? `Repor distribuição proporcional nos ${selecionados.size} selecionado(s)` : 'Repor distribuição proporcional automática'}>
                  <RotateCcw size={12} />
                  {selecionados.size > 0 ? `Redistribuir (${selecionados.size})` : 'Redistribuir'}
                </button>
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
                    const temLogsNoMes = logs.some(l => l.date?.startsWith(h.mes));
                    const temEdicoes = clientesMesHist.some(r =>
                      histOverrides[`${h.mes}|${r.client_id}`] !== undefined ||
                      Object.keys(histOverrides).some(k => k.startsWith(`${h.mes}|${r.client_id}|`))
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
                                onClick={() => handleGuardarHist(h.mes)}
                                disabled={gravandoHist === h.mes || !temEdicoes}
                                className="flex items-center gap-1 px-2 py-1 bg-indigo-600 text-white rounded-lg text-[9px] font-black hover:bg-slate-900 transition-all disabled:opacity-30"
                                title="Guardar edições"
                              >
                                {gravandoHist === h.mes ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle size={10} />}
                                Guardar
                              </button>
                              {clientesMesHist.length > 0 && (
                                <button
                                  onClick={() => handleApagarHist(h.mes)}
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
                        {/* Linhas por cliente — só visíveis quando mês expandido */}
                        {aberto && (() => {
                          if (clientesMesHist.length === 0) {
                            return (
                              <tr>
                                <td colSpan={6} className="px-3 py-2 text-[10px] text-slate-400 text-center italic">Sem registos por cliente.</td>
                              </tr>
                            );
                          }

                          return clientesMesHist.map(r => {
                            const client = clients.find(c => c.id === r.client_id);
                            const nomeCliente = client?.name ?? r.client_id;
                            const horasCliente = logs
                              .filter(l => l.clientId === r.client_id && l.date?.startsWith(h.mes))
                              .reduce((s, l) => s + (parseFloat(l.hours) || 0), 0);
                            const totalFaturaCliente = (parseFloat(r.total_fatura) || 0) > 0
                              ? parseFloat(r.total_fatura)
                              : horasCliente * (parseFloat(client?.valorHora) || 0);
                            const pct = h.totalFatura > 0 ? (totalFaturaCliente / h.totalFatura) * 100 : 0;
                            const ajudasSalvo = parseFloat(r.valor_ajudas) || 0;
                            const ajudasTotal = ajudasSalvo > 0 ? ajudasSalvo : totalFaturaCliente * taxaAjudas;
                            const rowCls = `border-t border-slate-50 transition-colors ${h.mes === selectedMonth ? 'bg-indigo-50/40' : 'hover:bg-slate-50'}`;

                            const key = `${h.mes}|${r.client_id}`;
                            const val = histOverrides[key] !== undefined
                              ? histOverrides[key]
                              : ajudasTotal.toFixed(2);
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
                        })()}
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

    </div>
  );
}
