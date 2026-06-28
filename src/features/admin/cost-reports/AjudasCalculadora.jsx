import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Loader2, CheckCircle, Copy, ChevronDown, ChevronRight, AlertTriangle, FileSearch, Trash2, RotateCcw, Zap, Download } from 'lucide-react';
import { useRef } from 'react';
import FaturarClienteModal from '../toconline/FaturarClienteModal';
import { MESES_PT, mesesDisponiveis, formatarMes } from '../../../utils/validacaoHelpers';

const fmtEur = v => (parseFloat(v) || 0).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
const fmtPct = v => (parseFloat(v) || 0).toFixed(2) + '%';

// Mês anterior ao mês fornecido no formato 'YYYY-MM'
function mesAnterior(mes) {
  const [y, m] = mes.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Mês seguinte ao mês fornecido no formato 'YYYY-MM'
function mesSeguinte(mes) {
  const [y, m] = mes.split('-').map(Number);
  const d = new Date(y, m, 1); // Date usa meses 0-indexed, m já é o próximo
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
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
  const [tocSemAuth, setTocSemAuth] = useState(false);
  // overrides manuais: { clientId: valorString }
  const [overrides, setOverrides] = useState({});
  // modal faturar cliente
  const [faturarCliente, setFaturarCliente] = useState(null);

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
  const [redistribuidos, setRedistribuidos] = useState(new Set()); // clientIds cujo ajudasObs foi explicitamente ignorado
  const [flashInfo, setFlashInfo] = useState(null);  // { editadoId, prevMap } — destaque visual da redistribuição
  const flashTimer = useRef(null);

  // — Carregar dados da BD —
  // Carrega ano actual + ano anterior para taxaAjudas funcionar em Janeiro
  const carregar = useCallback(async () => {
    const db = window.supabaseInstance;
    if (!db) return;
    setCarregando(true);
    const anoAnterior = String(parseInt(ano) - 1);
    const [{ data: rv }, { data: af }] = await Promise.all([
      db.from('receipt_validations').select('mes, ajudas_custo_extraidas')
        .gte('mes', `${anoAnterior}-01`).lte('mes', `${ano}-12`),
      db.from('ajudas_faturadas_clientes').select('*')
        .gte('mes', `${anoAnterior}-01`).lte('mes', `${ano}-12`),
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
  useEffect(() => { setOverrides({}); setConfirmado(false); setObsResult(null); setObsAplicados(new Set()); setSelecionados(new Set()); setRedistribuidos(new Set()); }, [selectedMonth]);

  // — Saldo acumulado de diferenças —
  // Fatura do mês M refere-se aos recibos do mês M-1.
  // Só conta meses com recibos E com fatura confirmada na app (meses sem confirmação
  // ainda não foram faturados — não entram no saldo).
  // saldo = Σ(recibo_real - ajudas_faturadas) para meses confirmados anteriores
  // Positivo → sub-faturado (acrescentar à previsão seguinte)
  // Negativo → sobre-faturado (descontar da previsão seguinte)
  const saldoCarregado = useMemo(() => {
    return recibosAno
      .filter(r => r.mes < selectedMonth && parseFloat(r.ajudas_custo_extraidas) > 0)
      .reduce((s, r) => {
        const confirmacoesDoMes = faturadosAno.filter(f => f.mes === r.mes && f.confirmado);
        if (!confirmacoesDoMes.length) return s; // ainda não confirmado → excluir do saldo
        const faturadoMes = confirmacoesDoMes.reduce((sf, f) => sf + (parseFloat(f.valor_ajudas) || 0), 0);
        return s + (parseFloat(r.ajudas_custo_extraidas) || 0) - faturadoMes;
      }, 0);
  }, [recibosAno, faturadosAno, selectedMonth]);

  // Informativo: totais do ano actual para o painel
  const orcamentoAnual = useMemo(
    () => recibosAno.filter(r => r.mes.startsWith(ano)).reduce((s, r) => s + (parseFloat(r.ajudas_custo_extraidas) || 0), 0),
    [recibosAno, ano]
  );
  const jaFaturadoAno = useMemo(
    () => faturadosAno.filter(r => r.mes.startsWith(ano)).reduce((s, r) => s + (parseFloat(r.valor_ajudas) || 0), 0),
    [faturadosAno, ano]
  );
  const progressoPct = orcamentoAnual > 0 ? Math.min((jaFaturadoAno / orcamentoAnual) * 100, 100) : 0;

  // Meses anteriores ao selecionado com recibos mas sem confirmação em ajudas_faturadas_clientes
  const mesesNaoConfirmados = useMemo(() => {
    const mesesUnicos = [...new Set(
      recibosAno
        .filter(r => r.mes < selectedMonth && parseFloat(r.ajudas_custo_extraidas) > 0)
        .map(r => r.mes)
    )];
    return mesesUnicos
      .filter(mes => !faturadosAno.some(f => f.mes === mes && f.confirmado))
      .sort();
  }, [recibosAno, faturadosAno, selectedMonth]);

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


  // Buscar faturas de vendas TOConline para meses sem horas registadas
  useEffect(() => {
    setFaturasToC([]);
    if (!semHoras) return;
    let cancelled = false;
    (async () => {
      setCarregandoToC(true);
      try {
        // As faturas emitidas são do mês seguinte ao mês de trabalho seleccionado.
        const mesFat = mesSeguinte(selectedMonth);
        const [y, m] = mesFat.split('-').map(Number);
        const ultimoDia = new Date(y, m, 0).getDate();
        const params = new URLSearchParams({
          tipo: 'vendas',
          data_de: `${mesFat}-01`,
          data_ate: `${mesFat}-${String(ultimoDia).padStart(2, '0')}`,
        });
        const res = await fetch(`/api/toconline/relatorio?${params}`);
        if (cancelled) return;
        if (res.status === 401) { setTocSemAuth(true); return; }
        if (!res.ok) return;
        setTocSemAuth(false);
        const data = await res.json();
        if (!cancelled) setFaturasToC(data.data || []);
      } catch { /* ignora */ }
      finally { if (!cancelled) setCarregandoToC(false); }
    })();
    return () => { cancelled = true; };
  }, [selectedMonth, semHoras]);

  // Auto-extrair valores das notas TOConline para Modo A (com horas registadas).
  // Para cada fatura do mês seguinte: se tiver valor monetário nas notas → override fixo para esse cliente.
  // Clientes sem valor nas notas ficam com distribuição proporcional do restante.
  useEffect(() => {
    if (semHoras) return; // Modo B já tem ajudasObs via clientesToC
    let cancelled = false;
    (async () => {
      try {
        const mesFat = mesSeguinte(selectedMonth);
        const [y, m] = mesFat.split('-').map(Number);
        const ultimoDia = new Date(y, m, 0).getDate();
        const params = new URLSearchParams({
          tipo: 'vendas',
          data_de: `${mesFat}-01`,
          data_ate: `${mesFat}-${String(ultimoDia).padStart(2, '0')}`,
        });
        const res = await fetch(`/api/toconline/relatorio?${params}`);
        if (cancelled) return;
        if (res.status === 401) { setTocSemAuth(true); return; }
        if (!res.ok) return;
        setTocSemAuth(false);
        const data = await res.json();
        if (cancelled) return;
        const faturas = data.data || [];
        const porCliente = {};
        faturas.forEach(item => {
          const a = item.attributes || item;
          const nome = a.customer_business_name || a.customer_name;
          if (!nome) return;
          const valObs = extrairValorObs(getObservacao(a));
          if (valObs == null) return; // sem valor nas notas → distribuição proporcional
          const client = clients.find(c => c.name?.toLowerCase().trim() === nome.toLowerCase().trim());
          const key = client?.id ?? `toc:${nome}`;
          porCliente[key] = (porCliente[key] || 0) + valObs;
        });
        if (cancelled) return;
        const ids = Object.keys(porCliente);
        if (!ids.length) return;
        setOverrides(prev => {
          const next = { ...prev };
          ids.forEach(id => { next[id] = porCliente[id].toFixed(2); });
          return next;
        });
        setObsAplicados(new Set(ids));
      } catch { /* ignora — sem TOConline auth ou sem faturas */ }
    })();
    return () => { cancelled = true; };
  }, [selectedMonth, semHoras]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Taxa histórica: só meses confirmados (fatura criada e registada na app)
  const taxaAjudas = useMemo(() => {
    const confirmados = faturadosAno.filter(r => r.confirmado);
    const totalFat = confirmados.reduce((s, r) => s + (parseFloat(r.total_fatura) || 0), 0);
    const totalAj  = confirmados.reduce((s, r) => s + (parseFloat(r.valor_ajudas) || 0), 0);
    return totalFat > 0 ? totalAj / totalFat : 0;
  }, [faturadosAno]);

  // Estimativa base: taxa histórica × faturação do mês corrente
  const ajudasEstimadoMes = useMemo(
    () => Math.max(0, totalFaturaMes * taxaAjudas),
    [taxaAjudas, totalFaturaMes]
  );

  // Regra principal:
  //   • Mês sem recibos ainda → PREVISÃO para criar as faturas:
  //       taxa histórica × faturação + saldo acumulado de meses anteriores
  //       (saldo positivo = sub-faturado antes → acrescentar; negativo = sobre-faturado → descontar)
  //   • Mês com recibos processados → total exacto dos recibos
  //       (para consultar o que deveria ter sido faturado; a diferença já entrou no saldoCarregado)
  const temRecibosDoMes = ajudasReciboMes > 0;
  const ajudasEfetivoMes = temRecibosDoMes
    ? ajudasReciboMes
    : Math.max(0, ajudasEstimadoMes + saldoCarregado);
  const eEstimativa = !temRecibosDoMes;
  // True quando há clientes no mês mas não há nenhum valor de ajudas calculável
  const semDadosAjudas = ajudasEfetivoMes === 0;

  // — Ajudas por cliente —
  // Override/obs mantém o valor fixo. O alvo global (ajudasEfetivoMes) é sempre
  // distribuído na íntegra: o que sobra após os fixos vai proporcionalmente aos restantes;
  // se todos tiverem fixo, o saldo residual é adicionado proporcionalmente a todos.
  const linhas = useMemo(() => {
    const comFixo = clientesMesFinal.map(c => {
      const valorStr = overrides[c.clientId];
      let fixo = null;
      if (valorStr !== undefined) fixo = parseFloat(String(valorStr).replace(',', '.')) || 0;
      else if (c.ajudasObs != null && !redistribuidos.has(c.clientId)) fixo = c.ajudasObs;
      return { ...c, fixo, daObservacao: c.ajudasObs != null && !redistribuidos.has(c.clientId) };
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
  }, [clientesMesFinal, totalFaturaMes, ajudasEfetivoMes, overrides, redistribuidos]);

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
      // As faturas são emitidas no mês seguinte ao mês de trabalho (igual ao Modo B)
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

  // Redistribuir = limpar overrides manuais dos clientes alvo, deixando o
  // cálculo proporcional automático (linhas useMemo) assumir.
  const handleRedistribuir = () => {
    const alvoIds = selecionados.size > 0
      ? [...selecionados]
      : linhas.filter(l => !obsAplicados.has(l.clientId) && !l.daObservacao).map(l => l.clientId);
    if (!alvoIds.length) return;
    setOverrides(prev => {
      const next = { ...prev };
      alvoIds.forEach(id => delete next[id]);
      return next;
    });
    setObsAplicados(prev => {
      const n = new Set(prev);
      alvoIds.forEach(id => n.delete(id));
      return n;
    });
    // Linhas com valor fixo vindo de c.ajudasObs (daObservacao) precisam de ser
    // marcadas explicitamente para que o useMemo ignore o valor da observação.
    const obsAlvoIds = alvoIds.filter(id => linhas.find(l => l.clientId === id)?.daObservacao);
    if (obsAlvoIds.length > 0) {
      setRedistribuidos(prev => { const n = new Set(prev); obsAlvoIds.forEach(id => n.add(id)); return n; });
    }
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

  // — Exportar XLS —
  const handleExportarXLS = () => {
    const fmtN = (n) => n.toFixed(2).replace('.', ',');
    const th = (txt, align = 'left') =>
      `<th style="background:#4F46E5;color:white;padding:10px 14px;text-align:${align};font-size:11px;font-weight:700;">${txt}</th>`;
    const td = (txt, align = 'left', bold = false) =>
      `<td style="padding:9px 14px;border-bottom:1px solid #e2e8f0;font-size:11px;text-align:${align};${bold ? 'font-weight:700;' : ''}">${txt}</td>`;

    const linhasRows = linhas.map((l, i) => {
      const bg = i % 2 ? '#f8fafc' : '#fff';
      return `<tr style="background:${bg};">
        ${td(l.nome)} ${td(l.fromToC ? '—' : `${l.horas.toFixed(2)}h`, 'right')}
        ${td(`${(l.proporcao * 100).toFixed(1)}%`, 'right')} ${td(`${fmtN(l.valorFatura)} €`, 'right')}
        ${td(`${fmtN(l.ajudasEstimadas)} €`, 'right', true)}
      </tr>`;
    }).join('');
    const totalRow = `<tr style="background:#eef2ff;">
      ${td('TOTAL', 'left', true)} ${td(semHoras ? '—' : `${linhas.reduce((s,l)=>s+l.horas,0).toFixed(2)}h`, 'right', true)}
      ${td('100%', 'right', true)} ${td(`${fmtN(totalFaturaMes)} €`, 'right', true)}
      ${td(`${fmtN(totalAjudasMes)} €`, 'right', true)}
    </tr>`;

    const histRows = historicoAnual.map((h, i) => {
      const bg = i % 2 ? '#f8fafc' : '#fff';
      const okBg = h.confirmado ? '#f0fdf4' : bg;
      return `<tr style="background:${okBg};">
        ${td(h.mes)} ${td(h.confirmado ? 'Sim' : 'Não', 'center')}
        ${td(`${fmtN(h.ajudasRecibo)} €`, 'right')} ${td(`${fmtN(h.ajudasFaturadas)} €`, 'right', true)}
        ${td(`${fmtN(h.totalFatura)} €`, 'right')}
      </tr>`;
    }).join('');

    const hoje = new Date().toLocaleDateString('pt-PT');
    const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><style>
body{font-family:'Segoe UI',Arial,sans-serif;margin:0;padding:30px;background:#f8fafc;}
.header{background:linear-gradient(135deg,#4F46E5,#7C3AED);color:white;padding:22px 30px;border-radius:14px 14px 0 0;}
.info-bar{background:white;padding:14px 30px;display:flex;gap:30px;border-bottom:1px solid #e2e8f0;}
.il{font-size:9px;text-transform:uppercase;color:#94a3b8;font-weight:700;letter-spacing:1px;}
.iv{font-size:13px;font-weight:600;color:#334155;}
.content{background:white;padding:24px 30px;border-radius:0 0 14px 14px;box-shadow:0 4px 6px -1px rgba(0,0,0,.1);}
.sec{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#4F46E5;padding:14px 0 6px;border-bottom:2px solid #4F46E5;margin-bottom:0;}
table{width:100%;border-collapse:collapse;margin-bottom:20px;}
</style></head>
<body>
<div class="header">
  <div style="font-size:18px;font-weight:800;text-transform:uppercase;letter-spacing:2px;">Magnetic Place</div>
  <div style="font-size:11px;opacity:.9;margin-top:2px;">Ajudas de Custo — ${selectedMonth}</div>
</div>
<div class="info-bar">
  <div><div class="il">Mês</div><div class="iv">${selectedMonth}</div></div>
  <div><div class="il">Total Ajudas</div><div class="iv">${fmtN(totalAjudasMes)} €</div></div>
  <div><div class="il">Total Fatura</div><div class="iv">${fmtN(totalFaturaMes)} €</div></div>
  <div><div class="il">Gerado em</div><div class="iv">${hoje}</div></div>
</div>
<div class="content">
  <div class="sec">Distribuição Mensal</div>
  <table>
    <thead><tr>${th('Cliente')}${th('Horas','right')}${th('%','right')}${th('Valor Fatura','right')}${th('Ajudas Incluídas','right')}</tr></thead>
    <tbody>${linhasRows}</tbody>
    <tfoot>${totalRow}</tfoot>
  </table>
  <div class="sec">Histórico Anual</div>
  <table>
    <thead><tr>${th('Mês')}${th('Confirmado','center')}${th('Ajudas Recibo','right')}${th('Ajudas Faturadas','right')}${th('Total Fatura','right')}</tr></thead>
    <tbody>${histRows}</tbody>
  </table>
</div>
</body></html>`;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ajudas-custo-${selectedMonth}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // — Histórico —
  // dif = faturado - recibo: positivo = sobre-faturado (descontar depois); negativo = sub-faturado (acrescentar depois)
  const historicoAnual = useMemo(() => {
    const meses = [...new Set([
      ...recibosAno.map(r => r.mes),
      ...faturadosAno.map(r => r.mes),
    ])].filter(m => m.startsWith(ano)).sort((a, b) => b.localeCompare(a));
    return meses.map(mes => {
      const linhasMes = faturadosAno.filter(r => r.mes === mes);
      const ajudasRecibo = recibosAno.filter(r => r.mes === mes).reduce((s, r) => s + (parseFloat(r.ajudas_custo_extraidas) || 0), 0);
      const ajudasFaturadas = linhasMes.reduce((s, r) => s + (parseFloat(r.valor_ajudas) || 0), 0);
      const totalGuardado = linhasMes.reduce((s, r) => s + (parseFloat(r.total_fatura) || 0), 0);
      const totalLogs = logs.filter(l => l.date?.startsWith(mes)).reduce((s, l) => {
        const client = clients.find(c => c.id === l.clientId);
        return s + (parseFloat(l.hours) || 0) * (parseFloat(client?.valorHora) || 0);
      }, 0);
      const totalFatura = totalGuardado > 0 ? totalGuardado : totalLogs;
      const confirmado = linhasMes.some(r => r.confirmado);
      // dif: quanto foi faturado a mais (+) ou a menos (-) face ao recibo real
      const dif = ajudasRecibo > 0 ? ajudasFaturadas - ajudasRecibo : 0;
      return { mes, ajudasRecibo, ajudasFaturadas, totalFatura, confirmado, dif };
    });
  }, [recibosAno, faturadosAno, logs, clients, ano]);

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
            <h3 className="text-sm font-black text-slate-800">Ajudas de Custo — {ano}</h3>
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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {[
            { label: 'Total recibos ano', val: fmtEur(orcamentoAnual), cls: 'indigo' },
            { label: 'Faturado no ano', val: fmtEur(jaFaturadoAno), cls: 'slate' },
            { label: saldoCarregado >= 0 ? 'Saldo a acrescentar' : 'Saldo a descontar', val: fmtEur(Math.abs(saldoCarregado)), cls: saldoCarregado < 0 ? 'red' : saldoCarregado > 0 ? 'amber' : 'slate' },
            { label: 'Taxa histórica', val: fmtPct(taxaAjudas * 100), cls: 'slate' },
            { label: semDadosAjudas ? 'Sem dados' : eEstimativa ? 'Previsão este mês' : 'Recibos este mês', val: fmtEur(ajudasEfetivoMes), cls: semDadosAjudas ? 'slate' : eEstimativa ? 'amber' : 'indigo' },
          ].map(({ label, val, cls }) => (
            <div key={label} className={`bg-${cls}-50 border border-${cls}-100 rounded-xl p-3 text-center`}>
              <p className={`text-base font-black text-${cls}-700`}>{val}</p>
              <p className={`text-[9px] font-black uppercase tracking-widest text-${cls}-400 mt-0.5`}>{label}</p>
            </div>
          ))}
        </div>

        {/* Aviso de meses anteriores não confirmados */}
        {mesesNaoConfirmados.length > 0 && (
          <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl">
            <AlertTriangle size={13} className="text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] font-black text-amber-700">
                {mesesNaoConfirmados.length === 1
                  ? `${formatarMes(mesesNaoConfirmados[0])} tem ajudas por confirmar`
                  : `${mesesNaoConfirmados.length} meses anteriores com ajudas por confirmar`}
              </p>
              <p className="text-[9px] text-amber-600 mt-0.5">
                {mesesNaoConfirmados.map(m => formatarMes(m)).join(' · ')}
              </p>
            </div>
          </div>
        )}

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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-4 py-3 border-b border-slate-100 gap-2">
          <div>
            <h3 className="text-sm font-black text-slate-800">
              {temRecibosDoMes ? `Ajudas de Custo — ${formatarMes(selectedMonth)}` : `Previsão para fatura de ${formatarMes(mesSeguinte(selectedMonth))} (trabalho de ${formatarMes(selectedMonth)})`}
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5 max-w-xs sm:max-w-none">
              {semDadosAjudas && clientesMesFinal.length > 0
                ? 'Sem ajudas disponíveis — confirme meses anteriores para calcular a taxa histórica'
                : temRecibosDoMes
                  ? `Recibos processados: ${fmtEur(ajudasReciboMes)} — diferença face ao faturado entra automaticamente no saldo do próximo mês`
                  : taxaAjudas > 0
                    ? `Taxa histórica ${fmtPct(taxaAjudas * 100)} × ${fmtEur(totalFaturaMes)}${saldoCarregado !== 0 ? ` ${saldoCarregado > 0 ? '+ ' : '− '}${fmtEur(Math.abs(saldoCarregado))} saldo de meses anteriores` : ''} = ${fmtEur(ajudasEfetivoMes)}`
                    : 'Sem histórico confirmado — confirme meses anteriores para calcular a taxa'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {semHoras && clientesMesFinal.length > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-50 border border-blue-200 rounded-xl">
                <span className="text-[10px] font-bold text-blue-700">Faturas TOConline</span>
              </div>
            )}
            {tocSemAuth && (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-50 border border-amber-200 rounded-xl">
                <AlertTriangle size={12} className="text-amber-500" />
                <span className="text-[10px] font-bold text-amber-700">TOConline sem auth</span>
              </div>
            )}
            {confirmado && (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl">
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
            <div className="overflow-x-auto">
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
                  <th className="px-3 py-2 text-right text-[9px] font-black uppercase tracking-widest text-slate-400 hidden sm:table-cell">Horas</th>
                  <th className="px-3 py-2 text-right text-[9px] font-black uppercase tracking-widest text-slate-400">Valor Fatura</th>
                  <th className="px-3 py-2 text-right text-[9px] font-black uppercase tracking-widest text-slate-400 hidden sm:table-cell">% Total</th>
                  <th className="px-3 py-2 text-right text-[9px] font-black uppercase tracking-widest text-slate-400">Ajudas Incluídas</th>
                  <th className="px-2 py-2 w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {linhas.map(l => {
                  const isFlashEdited = flashInfo?.editadoId === l.clientId;
                  const flashDiff = flashInfo && !isFlashEdited && !l.daObservacao && !obsAplicados.has(l.clientId)
                    ? l.ajudasEstimadas - (flashInfo.prevMap[l.clientId] ?? l.ajudasEstimadas)
                    : null;
                  return (
                  <tr key={l.clientId} className={`transition-colors ${isFlashEdited ? 'bg-amber-50' : selecionados.has(l.clientId) ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}>
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
                    <td className="px-3 py-2.5 text-right text-slate-500 hidden sm:table-cell">{l.fromToC ? '—' : `${l.horas.toFixed(2)}h`}</td>
                    <td className="px-3 py-2.5 text-right font-bold text-slate-700">{fmtEur(l.valorFatura)}</td>
                    <td className="px-3 py-2.5 text-right text-slate-400 hidden sm:table-cell">{fmtPct(l.proporcao * 100)}</td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {flashDiff !== null && Math.abs(flashDiff) >= 0.005 && (
                          <span className={`px-1 py-0.5 rounded text-[9px] font-black ${flashDiff > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500'}`}>
                            {flashDiff > 0 ? '▲' : '▼'} {Math.abs(flashDiff).toFixed(2)}
                          </span>
                        )}
                        {(obsAplicados.has(l.clientId) || (l.daObservacao && overrides[l.clientId] === undefined)) && (
                          <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[8px] font-black uppercase tracking-wider" title="Valor obtido da observação da fatura TOConline">Obs.</span>
                        )}
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={overrides[l.clientId] !== undefined ? overrides[l.clientId] : l.ajudasEstimadas.toFixed(2)}
                          onChange={e => {
                            // Snapshot antes da actualização para calcular diferença depois
                            const prevMap = Object.fromEntries(linhas.map(r => [r.clientId, r.ajudasEstimadas]));
                            clearTimeout(flashTimer.current);
                            setFlashInfo({ editadoId: l.clientId, prevMap });
                            flashTimer.current = setTimeout(() => setFlashInfo(null), 1800);
                            setOverrides(prev => ({ ...prev, [l.clientId]: e.target.value }));
                            setObsAplicados(prev => { if (!prev.has(l.clientId)) return prev; const n = new Set(prev); n.delete(l.clientId); return n; });
                            setRedistribuidos(prev => { if (!prev.has(l.clientId)) return prev; const n = new Set(prev); n.delete(l.clientId); return n; });
                          }}
                          className="w-20 sm:w-24 text-right p-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-indigo-700 outline-none focus:ring-2 focus:ring-indigo-400"
                        />
                      </div>
                    </td>
                    <td className="px-2 py-2.5 w-8">
                      <button
                        onClick={() => {
                          const val = overrides[l.clientId] !== undefined
                            ? parseFloat(overrides[l.clientId]) || 0
                            : l.ajudasEstimadas;
                          setFaturarCliente({ clienteId: l.dbClientId, ajudasValor: val });
                        }}
                        title="Faturar este cliente"
                        className="p-1.5 rounded-lg text-slate-300 hover:text-emerald-600 hover:bg-emerald-50 transition-all"
                      >
                        <Zap size={12} />
                      </button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
              {semDadosAjudas && (
                <caption className="caption-bottom px-4 py-2 text-[10px] text-slate-400 italic border-t border-slate-100 text-left">
                  Os valores de ajudas aparecem a zero porque ainda não existem recibos de vencimento processados nem histórico de faturação para este mês.
                </caption>
              )}
              <tfoot className="border-t-2 border-slate-200 bg-slate-50">
                <tr>
                  <td className="px-2 py-2.5 w-7" />
                  <td className="px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-500">TOTAL</td>
                  <td className="px-3 py-2.5 text-right text-[10px] font-black text-slate-600 hidden sm:table-cell">{semHoras ? '—' : `${linhas.reduce((s,l)=>s+l.horas,0).toFixed(2)}h`}</td>
                  <td className="px-3 py-2.5 text-right text-[10px] font-black text-slate-700">{fmtEur(totalFaturaMes)}</td>
                  <td className="px-3 py-2.5 text-right text-[10px] text-slate-400 hidden sm:table-cell">100%</td>
                  <td className="px-3 py-2.5 text-right">
                    <span className={`text-[10px] font-black ${ajudasEfetivoMes > 0 && Math.abs(totalAjudasMes - ajudasEfetivoMes) > 0.5 ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {fmtEur(totalAjudasMes)}
                    </span>
                  </td>
                  <td className="px-2 py-2.5 w-8" />
                </tr>
              </tfoot>
            </table>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-4 py-3 border-t border-slate-100 gap-3">
              <p className="text-[10px] text-slate-400">
                {eEstimativa ? 'Estimativa' : 'Recibos do mês'}:{' '}
                <span className={`font-bold ${eEstimativa ? 'text-amber-600' : 'text-indigo-600'}`}>{fmtEur(ajudasEfetivoMes)}</span>
                {eEstimativa && <span className="ml-1 text-amber-500">(taxa {fmtPct(taxaAjudas * 100)})</span>}
                {ajudasEfetivoMes > 0 && Math.abs(totalAjudasMes - ajudasEfetivoMes) > 0.5 && (
                  <span className="ml-2 text-amber-500 font-bold">
                    (dif. {fmtEur(Math.abs(totalAjudasMes - ajudasEfetivoMes))})
                  </span>
                )}
                {obsResult && (
                  <span className={`ml-2 font-bold ${obsResult.startsWith('Erro') ? 'text-red-500' : obsResult.startsWith('Nenhuma') ? 'text-amber-500' : 'text-blue-600'}`}>
                    · {obsResult}
                  </span>
                )}
              </p>
              <div className="flex flex-wrap gap-2">
                <button onClick={handleExtrairObs} disabled={extraindoObs}
                  className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-100 transition-all disabled:opacity-40"
                  title="Procura as faturas TOConline do mês e preenche as ajudas com o valor da observação">
                  {extraindoObs ? <Loader2 size={12} className="animate-spin" /> : <FileSearch size={12} />}
                  {extraindoObs ? 'A extrair...' : 'Extrair obs.'}
                </button>
                <button onClick={handleRedistribuir}
                  disabled={selecionados.size === 0 && Object.keys(overrides).filter(k => !obsAplicados.has(k)).length === 0 && !linhas.some(l => l.daObservacao)}
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
                <button onClick={handleExportarXLS}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                  title="Exportar tabela e histórico para Excel">
                  <Download size={12} />
                  XLS
                </button>
                <button onClick={handleConfirmar} disabled={confirmando || confirmado}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 transition-all disabled:opacity-40">
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
          <div className="border-t border-slate-100 max-h-[70vh] overflow-y-auto overflow-x-auto">
            {historicoAnual.length === 0 ? (
              <p className="text-center text-sm text-slate-400 py-8">Sem dados para {ano}.</p>
            ) : (
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b border-slate-100 sticky top-0 z-20">
                  <tr>
                    <th className="px-3 py-2 text-left text-[9px] font-black uppercase tracking-widest text-slate-400">Cliente</th>
                    <th className="px-3 py-2 text-right text-[9px] font-black uppercase tracking-widest text-slate-400 hidden sm:table-cell">Horas</th>
                    <th className="px-3 py-2 text-right text-[9px] font-black uppercase tracking-widest text-slate-400 hidden sm:table-cell">Valor Fatura</th>
                    <th className="px-3 py-2 text-right text-[9px] font-black uppercase tracking-widest text-slate-400 hidden sm:table-cell">% Total</th>
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
                                  {h.dif !== 0 && (
                                    <span className={`ml-1 font-bold ${h.dif > 0 ? 'text-rose-500' : 'text-emerald-600'}`}>
                                      ({h.dif > 0 ? '+' : ''}{fmtEur(h.dif)})
                                    </span>
                                  )}
                                </span>
                              ) : null}
                              {faturasHist[h.mes] !== undefined && faturasHist[h.mes].length > 0 && (
                                <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded text-[8px] font-black uppercase tracking-wider shrink-0">
                                  {faturasHist[h.mes].length} fat. TOC
                                </span>
                              )}
                              {temEdicoes && (
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" title="Edições por guardar" />
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right hidden sm:table-cell">
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
                          if (carregandoFaturasHist === h.mes) {
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
                          // Indexar faturas TOConline por dbClientId
                          const faturasDoMes = faturasHist[h.mes] ?? [];
                          const faturasPorCliente = {};
                          faturasDoMes.forEach((item, idx) => {
                            const a = item.attributes || item;
                            const nome = a.customer_business_name || a.customer_name;
                            if (!nome) return;
                            const c = clients.find(x => x.name?.toLowerCase().trim() === nome.toLowerCase().trim());
                            const dbId = c?.id ?? `toc:${nome}`;
                            if (!faturasPorCliente[dbId]) faturasPorCliente[dbId] = [];
                            faturasPorCliente[dbId].push({
                              docNum: a.document_number || a.document_no || `#${item.id ?? idx}`,
                              valor: parseFloat(a.gross_total ?? a.total_amount ?? a.total_value ?? 0) || 0,
                            });
                          });

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
                            const invoices = faturasPorCliente[r.client_id] ?? [];
                            // Se não há recibo real, usar taxa histórica × fatura como valor de referência
                            const ajudasSalvo = parseFloat(r.valor_ajudas) || 0;
                            const ajudasTotal = ajudasSalvo > 0 ? ajudasSalvo : totalFaturaCliente * taxaAjudas;
                            const totalFaturaInv = invoices.reduce((s, inv) => s + inv.valor, 0);
                            const rowCls = `border-t border-slate-50 transition-colors ${h.mes === selectedMonth ? 'bg-indigo-50/40' : 'hover:bg-slate-50'}`;
                            const subRowCls = `border-t border-slate-50/50 ${h.mes === selectedMonth ? 'bg-indigo-50/20' : 'bg-white'}`;

                            if (invoices.length > 1) {
                              // Várias faturas: linha-cabeçalho do cliente (sem input) + sub-linha por fatura com input individual
                              return (
                                <React.Fragment key={r.client_id}>
                                  <tr className={rowCls}>
                                    <td className="px-3 py-2.5 pl-8 font-bold text-slate-800">{nomeCliente}</td>
                                    <td className="px-3 py-2.5 text-right text-slate-500 hidden sm:table-cell">
                                      {temLogsNoMes ? `${horasCliente.toFixed(2)}h` : '—'}
                                    </td>
                                    <td className="px-3 py-2.5 text-right font-bold text-slate-700 hidden sm:table-cell">
                                      {totalFaturaCliente > 0 ? fmtEur(totalFaturaCliente) : '—'}
                                    </td>
                                    <td className="px-3 py-2.5 text-right text-slate-400 hidden sm:table-cell">{fmtPct(pct)}</td>
                                    <td className="px-3 py-2.5 text-right text-[10px] font-black text-slate-500">
                                      {fmtEur(invoices.reduce((s, inv) => {
                                        const k = `${h.mes}|${r.client_id}|${inv.docNum}`;
                                        return s + (histOverrides[k] !== undefined
                                          ? parseFloat(String(histOverrides[k]).replace(',', '.')) || 0
                                          : (totalFaturaInv > 0 ? ajudasTotal * (inv.valor / totalFaturaInv) : 0));
                                      }, 0))}
                                    </td>
                                    <td />
                                  </tr>
                                  {invoices.map(inv => {
                                    const invKey = `${h.mes}|${r.client_id}|${inv.docNum}`;
                                    const invDefault = totalFaturaInv > 0
                                      ? (ajudasTotal * (inv.valor / totalFaturaInv)).toFixed(2)
                                      : '0.00';
                                    const invVal = histOverrides[invKey] !== undefined ? histOverrides[invKey] : invDefault;
                                    return (
                                      <tr key={inv.docNum} className={subRowCls}>
                                        <td className="px-3 py-1.5 pl-12">
                                          <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[8px] font-mono">{inv.docNum}</span>
                                        </td>
                                        <td className="hidden sm:table-cell" />
                                        <td className="px-3 py-1.5 text-right text-[10px] text-slate-500 hidden sm:table-cell">{fmtEur(inv.valor)}</td>
                                        <td className="hidden sm:table-cell" />
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

                            // 0 ou 1 fatura: linha normal com input de ajudas no cliente
                            const key = `${h.mes}|${r.client_id}`;
                            const val = histOverrides[key] !== undefined
                              ? histOverrides[key]
                              : ajudasTotal.toFixed(2);
                            return (
                              <React.Fragment key={r.client_id}>
                                <tr className={rowCls}>
                                  <td className="px-3 py-2.5 pl-8 font-bold text-slate-800">
                                    {nomeCliente}
                                    {invoices[0] && <span className="ml-2 px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[8px] font-mono">{invoices[0].docNum}</span>}
                                  </td>
                                  <td className="px-3 py-2.5 text-right text-slate-500 hidden sm:table-cell">
                                    {temLogsNoMes ? `${horasCliente.toFixed(2)}h` : '—'}
                                  </td>
                                  <td className="px-3 py-2.5 text-right font-bold text-slate-700 hidden sm:table-cell">
                                    {totalFaturaCliente > 0 ? fmtEur(totalFaturaCliente) : '—'}
                                  </td>
                                  <td className="px-3 py-2.5 text-right text-slate-400 hidden sm:table-cell">{fmtPct(pct)}</td>
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
                    <td className="hidden sm:table-cell" />
                    <td className="px-3 py-2.5 text-right text-[10px] font-black text-slate-700 hidden sm:table-cell">
                      {fmtEur(historicoAnual.reduce((s, h) => s + h.totalFatura, 0))}
                    </td>
                    <td className="hidden sm:table-cell" />
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

      {faturarCliente && (
        <FaturarClienteModal
          clienteIdInicial={faturarCliente.clienteId}
          ajudasValorInicial={faturarCliente.ajudasValor}
          periodoInicial={selectedMonth}
          onClose={() => setFaturarCliente(null)}
          onFaturado={() => setFaturarCliente(null)}
        />
      )}
    </div>
  );
}
