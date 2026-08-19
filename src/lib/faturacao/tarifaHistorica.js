// Fonte única de tarifa histórica (trabalhador ou cliente) por data de log.
// Extraída de src/features/admin/cost-reports/useCostReportsData.js — era a
// fonte original, agora partilhada para nunca haver duas implementações a
// divergir (bug corrigido: FaturarClienteModal.jsx usava sempre a tarifa
// ATUAL do cliente, ignorando client_rate_history, produzindo um valor
// por defeito diferente do que Custos → Clientes já mostrava ao admin).

/**
 * Devolve a tarifa em vigor numa data, dado um histórico de alterações.
 * Sem histórico (ou data anterior ao primeiro registo), cai para a
 * tarifa "atual" passada como fallback.
 */
export function getRateAtDate(logDate, history, currentRate) {
  if (!history || history.length === 0) return Number(currentRate) || 0;
  const sorted = [...history].sort(
    (a, b) => new Date(a.data_alteracao) - new Date(b.data_alteracao)
  );
  const firstDate = sorted[0].data_alteracao.substring(0, 10);
  if (logDate < firstDate) return Number(sorted[0].valor_anterior) || 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (logDate >= sorted[i].data_alteracao.substring(0, 10)) {
      return Number(sorted[i].valor_novo) || 0;
    }
  }
  return Number(currentRate) || 0;
}

/**
 * Calcula o valor a faturar a um cliente num período (mês 'YYYY-MM'),
 * somando horas × tarifa em vigor na data de cada log — mesma fórmula
 * usada em Custos → Clientes, para qualquer ecrã que proponha um valor
 * de faturação por defeito nunca divergir silenciosamente dela.
 *
 * @param {object} params
 * @param {Array<{clientId: string, date: string, hours: number}>} params.logs
 * @param {string} params.clientId
 * @param {string} params.periodo  'YYYY-MM'
 * @param {number} params.valorHoraAtual  fallback quando não há histórico para a data
 * @param {Array<{client_id: string, data_alteracao: string, valor_anterior: number, valor_novo: number}>} [params.clientRateHistory]
 * @returns {{ totalHoras: number, valorFaturado: number }}
 */
export function calcularFaturacaoCliente({ logs, clientId, periodo, valorHoraAtual, clientRateHistory = [] }) {
  const clientHistory = (clientRateHistory || []).filter(h => h.client_id === clientId);
  const logsCliente = (logs || []).filter(l => l.clientId === clientId && (l.date || '').startsWith(periodo));

  let totalHoras = 0;
  let valorFaturado = 0;
  for (const l of logsCliente) {
    const hours = Number(l.hours) || 0;
    const rate = getRateAtDate(l.date, clientHistory, valorHoraAtual);
    totalHoras += hours;
    valorFaturado += hours * rate;
  }

  return { totalHoras, valorFaturado };
}
