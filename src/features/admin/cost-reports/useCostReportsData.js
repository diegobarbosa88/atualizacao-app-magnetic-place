import { useMemo } from 'react';
import { parseFaturaValor } from './costReportsUtils';

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

export const useCostReportsData = ({ logs, workers, clients, expenses, selectedMonth, faturasPago, workerRateHistory = [], clientRateHistory = [] }) => {
  // Uma única passagem sobre filteredLogs alimenta, em simultâneo, os
  // agrupamentos por trabalhador e por cliente — clientCosts deriva-se
  // diretamente de clientMargins (mesma soma, faturation === cost do
  // cliente); workerCosts usa outra chave de agrupamento (workerId), por
  // isso é acumulado ao lado, na mesma iteração, em vez de duplicar a
  // lógica de lookup de taxa noutro reduce à parte.
  const { workerCosts, clientCosts, clientMargins } = useMemo(() => {
    if (!logs || !workers || !clients) return { workerCosts: [], clientCosts: [], clientMargins: [] };
    const filteredLogs = logs.filter(log => log.date?.startsWith(selectedMonth));
    const byWorker = {};
    const byClient = {};

    filteredLogs.forEach(log => {
      const hours = Number(log.hours) || 0;
      const worker = workers.find(w => w.id === log.workerId);
      const client = clients.find(c => c.id === log.clientId);
      const workerHistory = workerRateHistory.filter(h => h.worker_id === log.workerId);
      const clientHistory = clientRateHistory.filter(h => h.client_id === log.clientId);
      const workerRate = getRateAtDate(log.date, workerHistory, worker?.valorHora);
      const clientRate = getRateAtDate(log.date, clientHistory, client?.valorHora);

      if (!byWorker[log.workerId]) byWorker[log.workerId] = { hours: 0, cost: 0 };
      byWorker[log.workerId].hours += hours;
      byWorker[log.workerId].cost += hours * workerRate;

      if (!byClient[log.clientId]) byClient[log.clientId] = { totalHours: 0, faturation: 0, cost: 0 };
      byClient[log.clientId].totalHours += hours;
      byClient[log.clientId].faturation += hours * clientRate;
      byClient[log.clientId].cost += hours * workerRate;
    });

    const workerCosts = Object.entries(byWorker).map(([workerId, data]) => {
      const worker = workers.find(w => w.id === workerId);
      return { id: workerId, name: worker?.name || 'Desconhecido', totalHours: data.hours, cost: data.cost };
    }).sort((a, b) => b.cost - a.cost);

    const clientMargins = Object.entries(byClient).map(([clientId, data]) => {
      const client = clients.find(c => c.id === clientId);
      return {
        id: clientId,
        name: client?.name || 'Desconhecido',
        totalHours: data.totalHours,
        faturation: data.faturation,
        cost: data.cost,
        margin: data.faturation - data.cost,
      };
    }).sort((a, b) => b.margin - a.margin);

    const clientCosts = clientMargins
      .map(({ id, name, totalHours, faturation }) => ({ id, name, totalHours, cost: faturation }))
      .sort((a, b) => b.cost - a.cost);

    return { workerCosts, clientCosts, clientMargins };
  }, [logs, workers, clients, selectedMonth, workerRateHistory, clientRateHistory]);

  const filteredExpenses = useMemo(
    () => expenses.filter(e => e.date?.startsWith(selectedMonth)),
    [expenses, selectedMonth]
  );

  const sortedExpenses = useMemo(
    () => [...filteredExpenses].sort((a, b) => new Date(b.date) - new Date(a.date)),
    [filteredExpenses]
  );

  const totalExpenses = useMemo(
    () => filteredExpenses.reduce((acc, e) => acc + (Number(e.amount) || 0), 0),
    [filteredExpenses]
  );

  const faturasMes = useMemo(() => {
    return faturasPago.map(f => ({
      id: `fatura_${f.id}`,
      _faturaId: f.id,
      date: f.dados?.data_pagamento || f.dados?.data_fatura || f.data_documento || f.importado_em,
      name: f.dados?.fornecedor || f.entidade || f.descricao || f.filename || 'Fatura',
      amount: parseFaturaValor(f),
      type: 'fatura',
      _isFatura: true,
      _tipo: f.tipo || null,
    })).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [faturasPago]);

  const totalFaturas = useMemo(() => faturasMes.reduce((s, f) => s + f.amount, 0), [faturasMes]);

  const allExpensesSorted = useMemo(
    () => [...sortedExpenses.map(e => ({ ...e, _isFatura: false })), ...faturasMes]
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)),
    [sortedExpenses, faturasMes]
  );

  const totalAllExpenses = useMemo(() => totalExpenses + totalFaturas, [totalExpenses, totalFaturas]);

  return { workerCosts, clientCosts, clientMargins, allExpensesSorted, totalAllExpenses };
};
