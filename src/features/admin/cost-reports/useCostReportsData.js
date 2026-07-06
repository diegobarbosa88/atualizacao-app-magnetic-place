import { useMemo } from 'react';
import { parseFaturaValor } from './costReportsUtils';

function getRateAtDate(logDate, history, currentRate) {
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
  const workerCosts = useMemo(() => {
    if (!logs || !workers) return [];
    const filteredLogs = logs.filter(log => log.date?.startsWith(selectedMonth));
    const grouped = filteredLogs.reduce((acc, log) => {
      const worker = workers.find(w => w.id === log.workerId);
      const history = workerRateHistory.filter(h => h.worker_id === log.workerId);
      const rate = getRateAtDate(log.date, history, worker?.valorHora);
      const hours = Number(log.hours) || 0;
      if (!acc[log.workerId]) acc[log.workerId] = { hours: 0, cost: 0 };
      acc[log.workerId].hours += hours;
      acc[log.workerId].cost += hours * rate;
      return acc;
    }, {});
    return Object.entries(grouped).map(([workerId, data]) => {
      const worker = workers.find(w => w.id === workerId);
      return {
        id: workerId,
        name: worker?.name || 'Desconhecido',
        totalHours: data.hours,
        cost: data.cost,
      };
    }).sort((a, b) => b.cost - a.cost);
  }, [logs, workers, selectedMonth, workerRateHistory]);

  const clientCosts = useMemo(() => {
    if (!logs || !clients) return [];
    const filteredLogs = logs.filter(log => log.date?.startsWith(selectedMonth));
    const grouped = filteredLogs.reduce((acc, log) => {
      const client = clients.find(c => c.id === log.clientId);
      const history = clientRateHistory.filter(h => h.client_id === log.clientId);
      const rate = getRateAtDate(log.date, history, client?.valorHora);
      const hours = Number(log.hours) || 0;
      if (!acc[log.clientId]) acc[log.clientId] = { hours: 0, cost: 0 };
      acc[log.clientId].hours += hours;
      acc[log.clientId].cost += hours * rate;
      return acc;
    }, {});
    return Object.entries(grouped).map(([clientId, data]) => {
      const client = clients.find(c => c.id === clientId);
      return {
        id: clientId,
        name: client?.name || 'Desconhecido',
        totalHours: data.hours,
        cost: data.cost,
      };
    }).sort((a, b) => b.cost - a.cost);
  }, [logs, clients, selectedMonth, clientRateHistory]);

  const clientMargins = useMemo(() => {
    if (!logs || !clients || !workers) return [];
    const filteredLogs = logs.filter(log => log.date?.startsWith(selectedMonth));
    const grouped = filteredLogs.reduce((acc, log) => {
      if (!acc[log.clientId]) acc[log.clientId] = { totalHours: 0, faturation: 0, cost: 0 };
      const hours = Number(log.hours) || 0;
      const client = clients.find(c => c.id === log.clientId);
      const worker = workers.find(w => w.id === log.workerId);
      const clientHistory = clientRateHistory.filter(h => h.client_id === log.clientId);
      const workerHistory = workerRateHistory.filter(h => h.worker_id === log.workerId);
      acc[log.clientId].totalHours += hours;
      acc[log.clientId].faturation += hours * getRateAtDate(log.date, clientHistory, client?.valorHora);
      acc[log.clientId].cost += hours * getRateAtDate(log.date, workerHistory, worker?.valorHora);
      return acc;
    }, {});
    return Object.entries(grouped).map(([clientId, data]) => {
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
  }, [logs, clients, workers, selectedMonth, workerRateHistory, clientRateHistory]);

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
