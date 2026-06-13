import { useMemo } from 'react';
import { parseFaturaValor } from './costReportsUtils';

export const useCostReportsData = ({ logs, workers, clients, expenses, selectedMonth, faturasPago }) => {
  const workerCosts = useMemo(() => {
    if (!logs || !workers) return [];
    const filteredLogs = logs.filter(log => log.date?.startsWith(selectedMonth));
    const grouped = filteredLogs.reduce((acc, log) => {
      acc[log.workerId] = (acc[log.workerId] || 0) + (Number(log.hours) || 0);
      return acc;
    }, {});
    return Object.entries(grouped).map(([workerId, totalHours]) => {
      const worker = workers.find(w => w.id === workerId);
      return {
        id: workerId,
        name: worker?.name || 'Desconhecido',
        totalHours,
        cost: totalHours * (Number(worker?.valorHora) || 0),
      };
    }).sort((a, b) => b.cost - a.cost);
  }, [logs, workers, selectedMonth]);

  const clientCosts = useMemo(() => {
    if (!logs || !clients) return [];
    const filteredLogs = logs.filter(log => log.date?.startsWith(selectedMonth));
    const grouped = filteredLogs.reduce((acc, log) => {
      acc[log.clientId] = (acc[log.clientId] || 0) + (Number(log.hours) || 0);
      return acc;
    }, {});
    return Object.entries(grouped).map(([clientId, totalHours]) => {
      const client = clients.find(c => c.id === clientId);
      return {
        id: clientId,
        name: client?.name || 'Desconhecido',
        totalHours,
        cost: totalHours * (Number(client?.valorHora) || 0),
      };
    }).sort((a, b) => b.cost - a.cost);
  }, [logs, clients, selectedMonth]);

  const clientMargins = useMemo(() => {
    if (!logs || !clients || !workers) return [];
    const filteredLogs = logs.filter(log => log.date?.startsWith(selectedMonth));
    const grouped = filteredLogs.reduce((acc, log) => {
      if (!acc[log.clientId]) acc[log.clientId] = { totalHours: 0, faturation: 0, cost: 0 };
      const hours = Number(log.hours) || 0;
      const client = clients.find(c => c.id === log.clientId);
      const worker = workers.find(w => w.id === log.workerId);
      acc[log.clientId].totalHours += hours;
      acc[log.clientId].faturation += hours * (Number(client?.valorHora) || 0);
      acc[log.clientId].cost += hours * (Number(worker?.valorHora) || 0);
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
  }, [logs, clients, workers, selectedMonth]);

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
