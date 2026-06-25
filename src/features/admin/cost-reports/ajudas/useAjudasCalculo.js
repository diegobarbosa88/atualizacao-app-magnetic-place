import { useState, useEffect, useMemo, useCallback } from 'react';
import { extrairValorObs, getObservacao, histKey, getHistInvoiceKeys } from './ajudasUtils';
import { fetchVendasMes } from './tocFetch';

export function useAjudasCalculo({
  logs, clients, selectedMonth,
  semHoras, clientesMes,
  recibosAno, recibosRef, faturadosAno, faturasToC,
}) {
  const [overrides, setOverrides] = useState({});
  const [histOverrides, setHistOverrides] = useState({});
  const [obsAplicados, setObsAplicados] = useState(new Set());
  const [selecionados, setSelecionados] = useState(new Set());
  const [obsResult, setObsResult] = useState(null);
  const [copiado, setCopiado] = useState(false);
  const [extraindoObs, setExtraindoObs] = useState(false);

  // Reset estado de UI ao mudar mês
  useEffect(() => {
    setOverrides({});
    setObsResult(null);
    setObsAplicados(new Set());
    setSelecionados(new Set());
  }, [selectedMonth]);

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

  const ajudasReciboMes = useMemo(() => {
    return [...recibosAno, ...recibosRef]
      .filter(r => r.mes === selectedMonth)
      .reduce((s, r) => s + (parseFloat(r.ajudas_custo_extraidas) || 0), 0);
  }, [recibosAno, recibosRef, selectedMonth]);

  // — Clientes via faturas TOConline (fallback quando sem horas) —
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
        clientId: `${dbClientId}#${item.id ?? idx}`,
        dbClientId,
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

  const clientesMesFinal = semHoras ? clientesToC : clientesMes;

  const totalFaturaMes = useMemo(() => clientesMesFinal.reduce((s, c) => s + c.valorFatura, 0), [clientesMesFinal]);

  // Taxa histórica: total ajudas faturadas / total faturas de todos os meses guardados
  const taxaAjudas = useMemo(() => {
    const totalFat = faturadosAno.reduce((s, r) => s + (parseFloat(r.total_fatura) || 0), 0);
    const totalAj  = faturadosAno.reduce((s, r) => s + (parseFloat(r.valor_ajudas) || 0), 0);
    return totalFat > 0 ? totalAj / totalFat : 0;
  }, [faturadosAno]);

  const ajudasEstimadoMes = useMemo(
    () => Math.max(0, totalFaturaMes * taxaAjudas + saldoDisponivel),
    [taxaAjudas, totalFaturaMes, saldoDisponivel]
  );

  const ajudasEfetivoMes = ajudasEstimadoMes > 0 ? ajudasEstimadoMes : ajudasReciboMes;
  const eEstimativa = taxaAjudas > 0 || saldoDisponivel > 0;

  // — Distribuição de ajudas por cliente —
  // Override/obs mantém valor fixo. O alvo global é sempre distribuído na íntegra:
  // o que sobra após os fixos vai proporcionalmente aos restantes.
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
        ajudas = c.fixo + (todosSaoFixos && restante > 0 ? restante * proporcao : 0);
      } else {
        ajudas = faturaNaoFixos > 0 ? restante * (c.valorFatura / faturaNaoFixos) : 0;
      }
      return { ...c, proporcao, ajudasEstimadas: ajudas };
    });
  }, [clientesMesFinal, totalFaturaMes, ajudasEfetivoMes, overrides]);

  const totalAjudasMes = linhas.reduce((s, l) => s + l.ajudasEstimadas, 0);

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

  // Limpa histOverrides para as linhas que foram gravadas na BD.
  const clearHistOverridesForMes = useCallback((linhasMes) => {
    setHistOverrides(prev => {
      const next = { ...prev };
      linhasMes.forEach(r => {
        delete next[histKey(r.mes, r.client_id)];
        getHistInvoiceKeys(next, r.mes, r.client_id).forEach(k => delete next[k]);
      });
      return next;
    });
  }, []);

  const handleRedistribuir = useCallback(() => {
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
    setSelecionados(new Set());
    setObsResult(null);
  }, [selecionados, linhas, obsAplicados]);

  // Extrai valores de ajudas das observações das faturas TOConline do próprio mês
  // (usa selectedMonth, não mesSeguinte — comportamento intencional para meses com horas)
  const handleExtrairObs = useCallback(async () => {
    if (!clientesMesFinal.length) return;
    setExtraindoObs(true);
    setObsResult(null);
    try {
      const result = await fetchVendasMes(selectedMonth);
      if (!result.ok) throw new Error(`Erro ${result.status}`);
      const porCliente = {};
      result.data.forEach(item => {
        const a = item.attributes || item;
        const nome = a.customer_business_name || a.customer_name;
        if (!nome) return;
        const valObs = extrairValorObs(getObservacao(a));
        if (valObs == null) return;
        const client = clients.find(c => c.name?.toLowerCase().trim() === nome.toLowerCase().trim());
        const key = client?.id ?? `toc:${nome}`;
        porCliente[key] = (porCliente[key] || 0) + valObs;
      });
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
  }, [clientesMesFinal, selectedMonth, clients]);

  const handleCopiar = useCallback(() => {
    const header = ['Cliente', 'Horas', 'Valor Fatura', 'Ajudas de Custo (incluídas)'].join('\t');
    const rows = linhas.map(l =>
      [l.nome, l.horas.toFixed(2), l.valorFatura.toFixed(2), l.ajudasEstimadas.toFixed(2)].join('\t')
    );
    const total = ['TOTAL', linhas.reduce((s,l)=>s+l.horas,0).toFixed(2), totalFaturaMes.toFixed(2), totalAjudasMes.toFixed(2)].join('\t');
    navigator.clipboard.writeText([header, ...rows, total].join('\n'));
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }, [linhas, totalFaturaMes, totalAjudasMes]);

  return {
    orcamentoAnual, jaFaturadoYTD, saldoDisponivel, progressoPct, ajudasReciboMes,
    clientesMesFinal, totalFaturaMes, taxaAjudas,
    ajudasEstimadoMes, ajudasEfetivoMes, eEstimativa,
    linhas, totalAjudasMes,
    historicoAnual,
    overrides, setOverrides,
    histOverrides, setHistOverrides,
    obsAplicados, setObsAplicados,
    selecionados, setSelecionados,
    obsResult, copiado, extraindoObs,
    clearHistOverridesForMes,
    handleRedistribuir, handleExtrairObs, handleCopiar,
  };
}
