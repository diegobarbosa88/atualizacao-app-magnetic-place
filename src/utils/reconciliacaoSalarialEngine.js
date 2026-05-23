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
  const [txYear, txMonth, txDay] = txDate.split('-').map(Number);

  if (txYear === refYear && txMonth === refMonth && txDay >= 15) return 'Adiantamento';

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

// aliases: [{ pattern: string, worker_name: string }]
export function runReconciliacaoSalarial({ recibos, transacoes, ano, aliases = [] }) {
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

  const matchedIndices = new Set();

  txDebito.forEach((tx, idx) => {
    // 1. Check manual aliases first (exact substring in description)
    let targetWorker = null;
    const nDesc = normStr(tx.descricao);
    for (const alias of aliases) {
      if (alias.pattern && nDesc.includes(normStr(alias.pattern))) {
        targetWorker = workerMap[normStr(alias.worker_name)] ?? null;
        if (targetWorker) break;
      }
    }

    // 2. Fallback: score-based automatic matching
    if (!targetWorker) {
      let bestScore = 0;
      Object.values(workerMap).forEach(w => {
        const score = workerScore(w.employee_name, tx.descricao);
        if (score > bestScore) { bestScore = score; targetWorker = w; }
      });
      if (!targetWorker || bestScore < 2) return; // unmatched
    }

    matchedIndices.add(idx);

    Object.values(targetWorker._monthsMap).forEach(monthData => {
      const type = classifyTransfer(tx.data, monthData.month);
      if (!type) return;
      const alreadyAdded = monthData.transfers.some(
        t => t.date === toDisplayDate(tx.data) && t.amount === tx.valor && t.type === type
      );
      if (!alreadyAdded) {
        monthData.transfers.push({ date: toDisplayDate(tx.data), amount: tx.valor, type });
      }
    });
  });

  // Unmatched debits — returned so the UI can let the user assign them manually
  const unmatched_transactions = txDebito
    .filter((_, i) => !matchedIndices.has(i))
    .map(tx => ({ date: toDisplayDate(tx.data), data: tx.data, amount: tx.valor, descricao: tx.descricao }));

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
    unmatched_transactions,
  };
}
