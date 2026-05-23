const STOP_WORDS = new Set(['da', 'de', 'do', 'das', 'dos', 'e', 'em', 'a', 'o', 'os', 'as', 'um', 'uns', 'uma', 'umas']);

function normStr(s) {
  return String(s || '').toLowerCase().trim()
    .normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function workerScore(workerName, descricao) {
  const words = normStr(workerName).split(/\s+/)
    .filter(w => w.length >= 3 && !STOP_WORDS.has(w));
  if (!words.length) return 0;
  const nDesc = normStr(descricao);
  return words.filter(w => nDesc.includes(w)).length;
}

function classifyTransfer(txDate, refMes) {
  if (!txDate || !refMes) return null;
  const [refYear, refMonth] = refMes.split('-').map(Number);
  const parts = txDate.split('-').map(Number);
  const [txYear, txMonth, txDay] = parts;

  // Adiantamento: dias 15-31 do mês de referência
  if (txYear === refYear && txMonth === refMonth && txDay >= 15) return 'Adiantamento';

  // Liquidação: dias 1-15 do mês seguinte
  const nextMonth = refMonth === 12 ? 1 : refMonth + 1;
  const nextYear = refMonth === 12 ? refYear + 1 : refYear;
  if (txYear === nextYear && txMonth === nextMonth && txDay <= 15) return 'Liquidação';

  return null;
}

function toDisplayDate(isoDate) {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-');
  return `${d}.${m}.${y}`;
}

export function runReconciliacaoSalarial({ recibos, transacoes, ano }) {
  // Only outgoing payments
  const txDebito = transacoes.filter(t => t.tipo === 'debito' && t.valor > 0);

  // Build worker map from receipts
  const workerMap = {};
  recibos.forEach(r => {
    const key = normStr(r.worker_name);
    if (!workerMap[key]) {
      workerMap[key] = {
        employee_name: r.worker_name,
        employee_id: String(r.worker_id || ''),
        months: [],
        _monthsMap: {},
      };
    }
    const entry = workerMap[key];
    if (!entry._monthsMap[r.mes]) {
      const monthData = {
        month: r.mes,
        expected_amount: parseFloat(r.liquido_extraido) || 0,
        transfers: [],
      };
      entry._monthsMap[r.mes] = monthData;
      entry.months.push(monthData);
    }
  });

  // Assign each transaction to best-matching worker, then classify per month
  txDebito.forEach(tx => {
    let bestWorker = null;
    let bestScore = 0;

    Object.values(workerMap).forEach(w => {
      const score = workerScore(w.employee_name, tx.descricao);
      if (score > bestScore) {
        bestScore = score;
        bestWorker = w;
      }
    });

    // Require at least 2 matching significant words
    if (!bestWorker || bestScore < 2) return;

    // Classify against every month this worker has a receipt for
    Object.values(bestWorker._monthsMap).forEach(monthData => {
      const type = classifyTransfer(tx.data, monthData.month);
      if (!type) return;
      // Avoid duplicate (same tx already added to this month)
      const alreadyAdded = monthData.transfers.some(
        t => t.date === toDisplayDate(tx.data) && t.amount === tx.valor && t.type === type
      );
      if (!alreadyAdded) {
        monthData.transfers.push({
          date: toDisplayDate(tx.data),
          amount: tx.valor,
          type,
        });
      }
    });
  });

  // Compute totals and status
  const employees = Object.values(workerMap)
    .filter(w => w.months.length > 0)
    .map(w => ({
      employee_name: w.employee_name,
      employee_id: w.employee_id,
      months: w.months
        .sort((a, b) => a.month.localeCompare(b.month))
        .map(m => {
          const total_paid = Math.round(m.transfers.reduce((s, t) => s + t.amount, 0) * 100) / 100;
          const balance = Math.round((m.expected_amount - total_paid) * 100) / 100;
          return {
            month: m.month,
            expected_amount: m.expected_amount,
            total_paid,
            balance,
            status: Math.abs(balance) <= 0.01 ? 'Match Exato' : 'Saldo Pendente',
            transfers: m.transfers,
          };
        }),
    }));

  const totalExact = employees.reduce((s, e) => s + e.months.filter(m => m.status === 'Match Exato').length, 0);
  const totalPending = employees.reduce((s, e) => s + e.months.filter(m => m.status === 'Saldo Pendente').length, 0);

  return {
    reconciliation_period: String(ano || new Date().getFullYear()),
    summary: {
      total_employees_processed: employees.length,
      total_exact_matches: totalExact,
      total_pending_balances: totalPending,
    },
    employees,
  };
}
