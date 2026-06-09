import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Loader2, CheckCircle, Copy, ChevronDown, ChevronRight, AlertTriangle, FileSearch, Trash2, RotateCcw } from 'lucide-react';
import { MESES_PT, mesesDisponiveis, formatarMes } from '../../../utils/validacaoHelpers';

const fmtEur = v => (parseFloat(v) || 0).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
const fmtPct = v => (parseFloat(v) || 0).toFixed(2) + '%';

// Mês anterior ao mês fornecido no formato 'YYYY-MM'
function mesAnterior(mes) {
  const [y, m] = mes.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return d.toISOString().slice(0, 7);
}

// Mês seguinte ao mês fornecido no formato 'YYYY-MM'
function mesSeguinte(mes) {
  const [y, m] = mes.split('-').map(Number);
  const d = new Date(y, m, 1); // Date usa meses 0-indexed, m já é o próximo
  return d.toISOString().slice(0, 7);
}

// Observação de uma fatura TOConline
function getObservacao(a) {
  return a.notes || a.observations || a.observation || a.remarks || a.memo || a.description || null;
}

// Converte string numérica em PT/EN para float (ex: "2.308,50" → 2308.50)
function _parseMonetario(s) {
  s = (s || '').replace(/\s/g, '');
  if (!s) return null;
  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  if (lastDot >= 0 && lastComma >= 0) {
    const dec = Math.max(lastDot, lastComma);
    s = s.slice(0, dec).replace(/[.,]/g, '') + '.' + s.slice(dec + 1);
  } else if (lastComma >= 0) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if ((s.match(/\./g) || []).length > 1) {
    s = s.replace(/\./g, '');
  }
  const v = parseFloat(s);
  return isNaN(v) || v <= 0 ? null : v;
}

// Extrai o valor monetário de um texto livre.
// Prioriza o padrão "€X.XXX,XX" (formato das notas TOConline).
function extrairValorObs(obs) {
  if (!obs) return null;
  const str = String(obs);
  // 1.ª prioridade: número imediatamente após símbolo €
  const mEuro = str.match(/€\s*([\d][\d.,]*)/);
  if (mEuro) return _parseMonetario(mEuro[1]);
  // Fallback: primeiro número sem atravessar espaços
  const m = str.match(/\d[\d.,]*\d|\d/);
  if (!m) return null;
  return _parseMonetario(m[0]);
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
  const [faturasHist, setFaturasHist] = useState({});       // { 'YYYY-MM': faturas[] } detalhe por mês
  const [carregandoFaturasHist, setCarregandoFaturasHist] = useState(null); // mes a carregar detalhe
  // overrides manuais: { clientId: valorString }
  const [overrides, setOverrides] = useState({});

  // Recibos de referência para estimativa (meses anteriores, quando o mês atual não tem dados)
  const [recibosRef, setRecibosRef] = useState([]);

  // Faturas TOConline para meses sem horas
  const [faturasToC, setFaturasToC] = useState([]);
  const [carregandoToC, setCarregandoToC] = useState(false);
  // Extração manual de observações (meses com horas)
  const [extraindoObs, setExtraindoObs] = useState(false);
  const [obsResult, setObsResult] = useState(null);
  const [obsAplicados, setObsAplicados] = useState(new Set()); // clientIds preenchidos via observação
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
  useEffect(() => { setOverrides({}); setConfirmado(false); setObsResult(null); setObsAplicados(new Set()); setSelecionados(new Set()); }, [selectedMonth]);

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
  // As faturas de um mês referem-se ao trabalho do mês anterior.
  const clientesMes = useMemo(() => {
    const logsDoMes = logs.filter(l => l.date?.startsWith(mesAnterior(selectedMonth)));
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

  // Faturas de um mês são referentes às horas do mês anterior.
  // Para meses sem horas (mês de faturação), o recibo a usar é do mês anterior (mês de trabalho).
  const mesDoRecibo = semHoras ? mesAnterior(selectedMonth) : selectedMonth;

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
      .lt('mes', mesDoRecibo)
      .gte('mes', limiteStr)
      .gt('ajudas_custo_extraidas', 0)
      .order('mes', { ascending: false })
      .then(({ data }) => setRecibosRef(data || []));
  }, [mesDoRecibo, recibosAno]);

  // Ajudas do recibo do mês de trabalho.
  // Com horas: usa o recibo do próprio mês (comportamento original, apenas recibosAno).
  // Sem horas: usa o recibo do mês anterior (inclui recibosRef para cobrir anos anteriores).
  const ajudasReciboMes = useMemo(() => {
    if (!semHoras) {
      return recibosAno
        .filter(r => r.mes === selectedMonth)
        .reduce((s, r) => s + (parseFloat(r.ajudas_custo_extraidas) || 0), 0);
    }
    return [...recibosAno, ...recibosRef]
      .filter(r => r.mes === mesDoRecibo)
      .reduce((s, r) => s + (parseFloat(r.ajudas_custo_extraidas) || 0), 0);
  }, [recibosAno, recibosRef, semHoras, selectedMonth, mesDoRecibo]);

  // Estimativa baseada nos meses anteriores (média) quando não há dados do mês atual
  const ajudasEstimadoMes = useMemo(() => {
    if (recibosRef.length === 0) return 0;
    const total = recibosRef.reduce((s, r) => s + (parseFloat(r.ajudas_custo_extraidas) || 0), 0);
    return total / recibosRef.length;
  }, [recibosRef]);

  // Valor efetivo: dados reais do recibo, ou estimativa dos meses anteriores
  const ajudasEfetivoMes = ajudasReciboMes > 0 ? ajudasReciboMes : ajudasEstimadoMes;
  const eEstimativa = ajudasReciboMes === 0 && ajudasEstimadoMes > 0;

  // Buscar faturas de vendas TOConline para meses sem horas registadas
  useEffect(() => {
    setFaturasToC([]);
    if (!semHoras) return;
    let cancelled = false;
    (async () => {
      setCarregandoToC(true);
      try {
        const [y, m] = selectedMonth.split('-').map(Number);
        const ultimoDia = new Date(y, m, 0).getDate();
        const params = new URLSearchParams({
          tipo: 'vendas',
          data_de: `${selectedMonth}-01`,
          data_ate: `${selectedMonth}-${String(ultimoDia).padStart(2, '0')}`,
        });
        const res = await fetch(`/api/toconline/relatorio?${params}`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled) setFaturasToC(data.data || []);
      } catch { /* ignora */ }
      finally { if (!cancelled) setCarregandoToC(false); }
    })();
    return () => { cancelled = true; };
  }, [selectedMonth, semHoras]);

  // — Faturação a partir das faturas TOConline (fallback sem horas) —
  // Uma linha POR FATURA: clientes com várias faturas no mês aparecem separadamente.
  const clientesToC = useMemo(() => {
    if (!semHoras || faturasToC.length === 0) return [];
    const linhas = [];
    faturasToC.forEach((item, idx) => {
      const a = item.attributes || item;
      const nome = a.customer_business_name || a.customer_name;
      if (!nome) return;
      const valor = parseFloat(a.gross_total ?? a.total_amount ?? a.total_value ?? 0) || 0;
      if (valor <= 0) return;
      const client = clients.find(c => c.name?.toLowerCase().trim() === nome.toLowerCase().trim());
      const dbClientId = client?.id ?? `toc:${nome}`;
      const docNum = a.document_number || a.document_no || `#${item.id ?? idx}`;
      const valObs = extrairValorObs(getObservacao(a));
      linhas.push({
        clientId: `${dbClientId}#${item.id ?? idx}`, // chave única por fatura
        dbClientId,                                   // cliente real (para gravação)
        nome: client?.name ?? nome,
        docNum,
        horas: 0,
        valorFatura: valor,
        ajudasObs: valObs,
        fromToC: true,
      });
    });
    return linhas.sort((a, b) => b.valorFatura - a.valorFatura);
  }, [semHoras, faturasToC, clients]);

  // Lista efetiva: horas registadas ou, em falta, faturas TOConline
  const clientesMesFinal = semHoras ? clientesToC : clientesMes;

  const totalFaturaMes = useMemo(() => clientesMesFinal.reduce((s, c) => s + c.valorFatura, 0), [clientesMesFinal]);

  // — Ajudas estimadas por cliente —
  // Clientes com valor fixo (observação da fatura ou edição manual) mantêm o valor;
  // o restante das ajudas do recibo do mês é redistribuído apenas pelos não-fixos.
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
    return comFixo.map(c => {
      const proporcao = totalFaturaMes > 0 ? c.valorFatura / totalFaturaMes : 0;
      const ajudas = c.fixo != null
        ? c.fixo
        : (faturaNaoFixos > 0 ? restante * (c.valorFatura / faturaNaoFixos) : 0);
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

  // — Extrair ajudas das observações das faturas TOConline (também com horas) —
  const handleExtrairObs = async () => {
    if (!clientesMesFinal.length) return;
    setExtraindoObs(true);
    setObsResult(null);
    try {
      // Faturas de um mês referem-se ao trabalho do mês anterior → buscar o mês seguinte
      const mesFaturas = mesSeguinte(selectedMonth);
      const [y, m] = mesFaturas.split('-').map(Number);
      const ultimoDia = new Date(y, m, 0).getDate();
      const params = new URLSearchParams({
        tipo: 'vendas',
        data_de: `${mesFaturas}-01`,
        data_ate: `${mesFaturas}-${String(ultimoDia).padStart(2, '0')}`,
      });
      const res = await fetch(`/api/toconline/relatorio?${params}`);
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      const data = await res.json();
      const faturas = data.data || [];

      // Mapa cliente → valor de ajudas extraído da observação
      const porCliente = {};
      faturas.forEach(item => {
        const a = item.attributes || item;
        const nome = a.customer_business_name || a.customer_name;
        if (!nome) return;
        const valObs = extrairValorObs(getObservacao(a));
        if (valObs == null) return;
        const client = clients.find(c => c.name?.toLowerCase().trim() === nome.toLowerCase().trim());
        const key = client?.id ?? `toc:${nome}`;
        porCliente[key] = (porCliente[key] || 0) + valObs;
      });

      // Aplica como override aos clientes presentes na tabela
      const aplicados = clientesMesFinal.filter(c => porCliente[c.clientId] != null);
      setOverrides(prev => {
        const next = { ...prev };
        aplicados.forEach(c => { next[c.clientId] = porCliente[c.clientId].toFixed(2); });
        return next;
      });
      setObsAplicados(new Set(aplicados.map(c => c.clientId)));
      setObsResult(
        aplicados.length > 0
          ? `${aplicados.length} cliente(s) preenchido(s) com valor da observação`
          : 'Nenhuma observação com valor encontrada para este mês'
      );
    } catch (e) {
      setObsResult('Erro: ' + e.message);
    } finally {
      setExtraindoObs(false);
    }
  };

  // — Redistribuir: pega a diferença (alvo − total atual) e distribui-a proporcionalmente
  // entre os selecionados (ou todos os não-fixos se não houver seleção).
  const handleRedistribuir = () => {
    const diferenca = ajudasEfetivoMes - totalAjudasMes;
    const alvo = linhas.filter(l =>
      selecionados.size > 0 ? selecionados.has(l.clientId) : (!obsAplicados.has(l.clientId) && !l.daObservacao)
    );
    if (!alvo.length) return;
    const totalFaturaAlvo = alvo.reduce((s, l) => s + l.valorFatura, 0);
    setOverrides(prev => {
      const next = { ...prev };
      alvo.forEach(l => {
        const extra = totalFaturaAlvo > 0 ? diferenca * (l.valorFatura / totalFaturaAlvo) : 0;
        const novo = Math.max(0, l.ajudasEstimadas + extra);
        next[l.clientId] = novo.toFixed(2);
      });
      return next;
    });
    setObsAplicados(prev => {
      const n = new Set(prev);
      alvo.forEach(l => n.delete(l.clientId));
      return n;
    });
    setSelecionados(new Set());
    setObsResult(null);
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
      return { mes, ajudasRecibo, ajudasFaturadas, totalFatura, dif: ajudasFaturadas - ajudasRecibo };
    });
  }, [recibosAno, faturadosAno, logs, clients]);

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
        .upsert({ mes, client_id: r.client_id, valor_ajudas: parseFloat(val.toFixed(2)), total_fatura: parseFloat(r.total_fatura) || 0, confirmado: true }, { onConflict: 'mes,client_id' });
    }));
    await carregar();
    setHistOverrides(prev => {
      const next = { ...prev };
      linhasMes.forEach(r => delete next[`${mes}|${r.client_id}`]);
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
    setFaturasHist(prev => { const n = { ...prev }; delete n[mes]; return n; });
    if (mes === selectedMonth) setConfirmado(false);
    setApagandoHist(null);
  };

  // — Buscar faturas individuais TOConline de um mês (detalhe do histórico) —
  const buscarFaturasMes = async (mes) => {
    if (faturasHist[mes] !== undefined) return; // já em cache
    setCarregandoFaturasHist(mes);
    try {
      // Faturas do mês de trabalho estão datadas do mês seguinte (faturação do mês anterior)
      const mesFaturas = mesSeguinte(mes);
      const [y, m] = mesFaturas.split('-').map(Number);
      const ultimoDia = new Date(y, m, 0).getDate();
      const params = new URLSearchParams({
        tipo: 'vendas',
        data_de: `${mesFaturas}-01`,
        data_ate: `${mesFaturas}-${String(ultimoDia).padStart(2, '0')}`,
      });
      const res = await fetch(`/api/toconline/relatorio?${params}`);
      const data = res.ok ? await res.json() : {};
      setFaturasHist(prev => ({ ...prev, [mes]: data.data || [] }));
    } catch {
      setFaturasHist(prev => ({ ...prev, [mes]: [] }));
    } finally {
      setCarregandoFaturasHist(null);
    }
  };

  const toggleExpandidoHist = (mes) => {
    setExpandidoHistMes(prev => {
      const novo = prev === mes ? null : mes;
      if (novo) buscarFaturasMes(novo);
      return novo;
    });
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
              {eEstimativa
                ? `Estimativa baseada em ${recibosRef.length} mês(es) anterior(es) — ${fmtEur(ajudasEfetivoMes)}`
                : `Distribui as ajudas dos recibos do mês (${fmtEur(ajudasReciboMes)}) proporcional à faturação de cada cliente`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {semHoras && clientesMesFinal.length > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-xl">
                <span className="text-[10px] font-bold text-blue-700">Valores de faturas TOConline</span>
              </div>
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
                        {(obsAplicados.has(l.clientId) || (l.daObservacao && overrides[l.clientId] === undefined)) && (
                          <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[8px] font-black uppercase tracking-wider" title="Valor obtido da observação da fatura TOConline">Obs.</span>
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
                {eEstimativa && <span className="ml-1 text-amber-500">(média de {recibosRef.length} mês(es))</span>}
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
                <button onClick={handleExtrairObs} disabled={extraindoObs}
                  className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-100 transition-all disabled:opacity-40"
                  title="Procura as faturas TOConline do mês e preenche as ajudas com o valor da observação">
                  {extraindoObs ? <Loader2 size={12} className="animate-spin" /> : <FileSearch size={12} />}
                  {extraindoObs ? 'A extrair...' : 'Extrair da observação'}
                </button>
                <button onClick={handleRedistribuir}
                  disabled={Math.abs(ajudasEfetivoMes - totalAjudasMes) < 0.01 && selecionados.size === 0}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all disabled:opacity-40"
                  title={selecionados.size > 0 ? `Redistribuir entre ${selecionados.size} selecionado(s)` : 'Redistribuir todos proporcionalmente'}>
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
          <div className="border-t border-slate-100">
            {historicoAnual.length === 0 ? (
              <p className="text-center text-sm text-slate-400 py-8">Sem dados para {ano}.</p>
            ) : (
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-3 py-2 text-left text-[9px] font-black uppercase tracking-widest text-slate-400">Mês</th>
                    <th className="px-3 py-2 text-right text-[9px] font-black uppercase tracking-widest text-slate-400">Total Fatura</th>
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
                    const temLogsNoMes = logs.some(l => l.date?.startsWith(h.mes));
                    const ehMesTOConline = !temLogsNoMes;
                    const temEdicoes = !ehMesTOConline && clientesMesHist.some(r => histOverrides[`${h.mes}|${r.client_id}`] !== undefined);
                    return (
                      <React.Fragment key={h.mes}>
                        <tr
                          onClick={() => toggleExpandidoHist(h.mes)}
                          className={`cursor-pointer select-none transition-colors ${h.mes === selectedMonth ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}
                        >
                          <td className="px-3 py-2.5 font-bold text-slate-700">
                            <div className="flex items-center gap-1.5">
                              <ChevronRight size={12} className={`text-slate-300 transition-transform shrink-0 ${aberto ? 'rotate-90' : ''}`} />
                              {formatarMes(h.mes)}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-right font-bold text-slate-700">{fmtEur(h.totalFatura)}</td>
                          <td className="px-3 py-2.5 text-right text-slate-600">{fmtEur(h.ajudasRecibo)}</td>
                          <td className="px-3 py-2.5 text-right text-slate-600">{fmtEur(h.ajudasFaturadas)}</td>
                          <td className={`px-3 py-2.5 text-right font-bold ${h.dif > 0.5 ? 'text-red-600' : h.dif < -0.5 ? 'text-emerald-600' : 'text-slate-400'}`}>
                            {h.dif > 0 ? '+' : ''}{fmtEur(h.dif)}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            {clientesMesHist.length > 0 && (
                              <button
                                onClick={e => { e.stopPropagation(); handleApagarHist(h.mes); }}
                                disabled={apagandoHist === h.mes}
                                className="p-1 text-slate-300 hover:text-red-500 transition-colors disabled:opacity-40"
                                title={`Apagar ${formatarMes(h.mes)} do histórico`}
                              >
                                {apagandoHist === h.mes ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                              </button>
                            )}
                          </td>
                        </tr>
                        {aberto && (
                          <tr onClick={e => e.stopPropagation()}>
                            <td colSpan={6} className="px-4 py-3 bg-slate-50 border-b border-slate-100">
                              {clientesMesHist.length === 0 ? (
                                <p className="text-[10px] text-slate-400 text-center py-2">Sem registos por cliente para este mês.</p>
                              ) : (
                                <div className="space-y-2" onClick={e => e.stopPropagation()}>
                                  <div className="flex items-center justify-between gap-3 pb-1 border-b border-slate-200">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Cliente</span>
                                    <div className="flex items-center gap-3">
                                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 w-28 text-right">Total Fatura</span>
                                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 w-28 text-right">Ajudas</span>
                                    </div>
                                  </div>
                                  {clientesMesHist.map(r => {
                                    const key = `${h.mes}|${r.client_id}`;
                                    const client = clients.find(c => c.id === r.client_id);
                                    const nomeCliente = client?.name ?? r.client_id;
                                    const horasCliente = logs
                                      .filter(l => l.clientId === r.client_id && l.date?.startsWith(h.mes))
                                      .reduce((s, l) => s + (parseFloat(l.hours) || 0), 0);
                                    // Prefere total guardado (inclui faturas TOConline); fallback para horas
                                    const totalFaturaCliente = (parseFloat(r.total_fatura) || 0) > 0
                                      ? parseFloat(r.total_fatura)
                                      : horasCliente * (parseFloat(client?.valorHora) || 0);
                                    const val = histOverrides[key] !== undefined ? histOverrides[key] : parseFloat(r.valor_ajudas).toFixed(2);
                                    // Faturas individuais TOConline deste cliente neste mês
                                    const faturasCliente = (faturasHist[h.mes] || []).filter(f => {
                                      const a = f.attributes || f;
                                      const nomeF = a.customer_business_name || a.customer_name;
                                      if (!nomeF) return false;
                                      const cli = clients.find(c => c.name?.toLowerCase().trim() === nomeF.toLowerCase().trim());
                                      return (cli?.id ?? `toc:${nomeF}`) === r.client_id;
                                    });
                                    return (
                                      <div key={r.client_id} className="py-1 border-b border-slate-100 last:border-0">
                                        <div className="flex items-center justify-between gap-3">
                                          <span className="text-xs font-bold text-slate-700">{nomeCliente}</span>
                                          <div className="flex items-center gap-3">
                                            <span className="w-28 text-right text-xs font-bold text-slate-600">{totalFaturaCliente > 0 ? fmtEur(totalFaturaCliente) : '—'}</span>
                                            {ehMesTOConline ? (
                                              <span className="w-28 text-right text-xs font-bold text-slate-600 px-1.5 py-1.5 inline-block">{fmtEur(parseFloat(val) || 0)}</span>
                                            ) : (
                                              <input
                                                type="text"
                                                inputMode="decimal"
                                                value={val}
                                                onChange={e => setHistOverrides(prev => ({ ...prev, [key]: e.target.value }))}
                                                onClick={e => e.stopPropagation()}
                                                className="w-28 text-right p-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-indigo-700 outline-none focus:ring-2 focus:ring-indigo-400"
                                              />
                                            )}
                                          </div>
                                        </div>
                                        {faturasCliente.length > 1 && (
                                          <div className="mt-1 ml-2 pl-2 border-l-2 border-slate-200 space-y-0.5">
                                            {faturasCliente.map((f, fi) => {
                                              const a = f.attributes || f;
                                              const docNum = a.document_number || a.document_no || `#${f.id ?? fi}`;
                                              const valF = parseFloat(a.gross_total ?? a.total_amount ?? a.total_value ?? 0) || 0;
                                              const obsF = extrairValorObs(getObservacao(a));
                                              return (
                                                <div key={f.id ?? fi} className="flex items-center justify-between gap-3 text-[10px] text-slate-500">
                                                  <span className="font-mono">{docNum}</span>
                                                  <div className="flex items-center gap-3">
                                                    <span className="w-28 text-right">{fmtEur(valF)}</span>
                                                    <span className="w-28 text-right">{obsF != null ? <span className="text-blue-600 font-bold">{fmtEur(obsF)}</span> : '—'}</span>
                                                  </div>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                  {carregandoFaturasHist === h.mes && (
                                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 pt-1">
                                      <Loader2 size={10} className="animate-spin" /> A carregar detalhe das faturas…
                                    </div>
                                  )}
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
                    <td className="px-3 py-2.5 text-right text-[10px] font-black text-slate-700">
                      {fmtEur(historicoAnual.reduce((s, h) => s + h.totalFatura, 0))}
                    </td>
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
