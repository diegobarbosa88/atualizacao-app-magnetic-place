import {
  CheckCircle, AlertCircle,
  ArrowLeftRight, Link, FileText, MessageSquare,
  UserCheck, FileMinus,
} from 'lucide-react';

// ── Constantes ────────────────────────────────────────────────────────────────

export const MESES = { '01': 'Jan', '02': 'Fev', '03': 'Mar', '04': 'Abr', '05': 'Mai', '06': 'Jun', '07': 'Jul', '08': 'Ago', '09': 'Set', '10': 'Out', '11': 'Nov', '12': 'Dez' };

export const INTERNO_KEYWORDS = [
  'TRF INTERNA', 'TRANSF INTERNA', 'TRANSFERENCIA INTERNA',
  'TRF ENTRE CONTAS', 'TRANSFERENCIA ENTRE CONTAS',
  'CONTA PROPRIA', 'PROPRIA CONTA',
  'MAGNETIC PLACE'
];

export const IMPOSTO_KEYWORDS = ['PAGTO AO ESTADO', 'PGT TSU'];

export const BANCO_KEYWORDS = [
  'COMISSÃO DE MANUTENÇÃO', 'MANUTENÇÃO DE CONTA',
  'IMPOSTO SELO', 'DEB IMPOSTO SELO',
  'COMISSÃO', 'TARIFA', 'TAXE', 'COMMISSION',
  'COMISSAO', 'COMISSÃO DE', 'DEB COMISSÃO',
];

// Status internos (não mudam com tipo da tx)
export const STATUS_KEYS = {
  COM_CLIENTE:  'Com Cliente',
  COM_RECIBO:   'Com Recibo',
  COM_FATURA:   'Com Fatura',
  NOTA_CREDITO: 'Nota Crédito',
  INTERNO:      'Interno',
  IMPOSTO:      'Imposto',
  JUSTIFICADO:  'Justificado',
  SEM_CLIENTE:  'Sem Cliente',
};

export const STATUS_CFG = {
  'Com Cliente':  { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: CheckCircle },
  'Com Recibo':   { bg: 'bg-teal-100',    text: 'text-teal-700',    icon: UserCheck },
  'Com Fatura':   { bg: 'bg-orange-100',  text: 'text-orange-700',  icon: FileMinus },
  'Nota Crédito': { bg: 'bg-blue-100',    text: 'text-blue-700',    icon: Link },
  'NC':           { bg: 'bg-blue-100',    text: 'text-blue-700',    icon: FileText },
  'Com NC':       { bg: 'bg-indigo-100',  text: 'text-indigo-700',  icon: FileText },
  'Interno':      { bg: 'bg-purple-100',  text: 'text-purple-700',  icon: ArrowLeftRight },
  'Imposto':      { bg: 'bg-amber-100',   text: 'text-amber-700',   icon: AlertCircle },
  'Justificado':  { bg: 'bg-violet-100',  text: 'text-violet-700',  icon: MessageSquare },
  'Sem Cliente':  { bg: 'bg-amber-100',   text: 'text-amber-700',   icon: AlertCircle },
};

export function isTaxaBancaria(desc) {
  if (!desc) return false;
  const descUpper = String(desc).toUpperCase();
  return BANCO_KEYWORDS.some(k => descUpper.includes(k));
}

// Labels visuais dependentes do tipo da transacção
export function labelStatus(status, tipo, ncEntry, faturasData, descricao) {
  if (status === 'Interno' && descricao && isTaxaBancaria(descricao)) return 'Taxa Bancária';
  if (tipo === 'debito') {
    if (status === 'Com Cliente')  return 'Com Fatura';
    if (status === 'Nota Crédito') return 'Fatura';
    if (status === 'Sem Cliente')  return 'Sem Fatura';
  }
  if (status === 'Nota Crédito') return 'NC';
  if (status === 'Sem Cliente') return 'Sem Entrada';
  return status;
}

// ── Utilitários ───────────────────────────────────────────────────────────────

export function fmtEur(v) {
  return (parseFloat(v) || 0).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

export function fmtMes(yyyymm) {
  if (!yyyymm) return '—';
  const [ano, mm] = yyyymm.split('-');
  return `${MESES[mm] || mm} ${ano}`;
}

export function txKey(tx) {
  return `${tx.data}|${tx.descricao}|${tx.valor}`;
}

export function extractMonthYearName(transactionsJson) {
  if (!transactionsJson || transactionsJson.length === 0) return null;
  const firstDate = transactionsJson[0]?.data;
  if (!firstDate) return null;
  try {
    const date = new Date(firstDate + 'T00:00:00');
    return date.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });
  } catch {
    return null;
  }
}

export function previousMonth(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function extractBankName(desc) {
  const patterns = [
    /TRF\s+IMEDIATA\s+DE\s+/i, /TRANSFERENCIA\s+DE\s+/i,
    /TRANSF(?:ERENCIA)?\s+DE\s+/i, /TRF\s+DE\s+/i,
    /ORDEM\s+DE\s+PAGAMENTO\s+DE\s+/i, /PAGAMENTO\s+DE\s+/i,
    /PAGT\s+DE\s+/i, /RECEBIDO\s+DE\s+/i, /REC\s+DE\s+/i,
  ];
  for (const p of patterns) {
    const m = String(desc || '').match(p);
    if (m) return String(desc).slice(m.index + m[0].length).trim();
  }
  return String(desc || '').trim();
}

export function normName(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\b(unipessoal|lda|s\.?a\.?|ltd|sa|sl|srl|eirl|me|eireli|inc|llc|gmbh|bv)\b/gi, '')
    .replace(/[.,\-&']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function sigTokens(name) {
  return normName(name).split(' ').filter(w => w.length >= 3);
}

export function matchClientByTokens(descricao, clients) {
  const descNorm = normName(descricao || '');
  let bestMatch = null;
  let bestScore = 0;
  for (const client of (clients || [])) {
    const tokens = sigTokens(client.name || '');
    if (tokens.length === 0) continue;
    const hits = tokens.filter(t => descNorm.includes(t)).length;
    const score = hits / tokens.length;
    if (hits >= 1 && score >= 0.75 && score > bestScore) {
      bestScore = score;
      bestMatch = client;
    }
  }
  return bestMatch;
}

export function clienteLink(tx, pagamentos) {
  const key = txKey(tx);
  return pagamentos?.find(p => p.tx_key === key);
}

export function statusTx(tx, pagamentos, justificacoes, internos, notasCredito, reciboLinks, faturaLinks, impostos) {
  const key = txKey(tx);
  if (clienteLink(tx, pagamentos)) return STATUS_KEYS.COM_CLIENTE;
  if (notasCredito?.some(n => n.tx_key === key)) return STATUS_KEYS.NOTA_CREDITO;
  if (impostos?.some(i => i.tx_key === key)) return STATUS_KEYS.IMPOSTO;
  if (reciboLinks?.some(r => r.tx_key === key)) return STATUS_KEYS.COM_RECIBO;
  if (faturaLinks?.some(f => f.tx_key === key)) return STATUS_KEYS.COM_FATURA;
  if (internos?.some(i => i.tx_key === key)) return STATUS_KEYS.INTERNO;
  if (impostos?.some(i => i.tx_key === key)) return STATUS_KEYS.IMPOSTO;
  if (justificacoes?.some(j => j.tx_key === key)) return STATUS_KEYS.JUSTIFICADO;
  return STATUS_KEYS.SEM_CLIENTE;
}

// Normalização para matching de nomes de trabalhadores
export function normWorker(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[.,\-&']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function workerScore(descricao, workerName) {
  const descNorm = normWorker(descricao);
  const workerNorm = normWorker(workerName);
  if (!workerNorm || workerNorm.length < 3) return 0;
  if (descNorm.includes(workerNorm) || workerNorm.includes(descNorm)) return 3;
  const tokens = workerNorm.split(' ').filter(w => w.length >= 3);
  if (tokens.length === 0) return 0;
  const hits = tokens.filter(t => descNorm.includes(t)).length;
  return hits;
}

export function findBestReceipt(matchedWorkerName, txData, receipts) {
  const prevMonth = previousMonth(txData);
  const txMonth = txData.substring(0, 7);
  const txDay = parseInt(txData.split('-')[2]);
  const receiptMonth = txDay >= 16 ? txMonth : prevMonth;
  const workerNorm = normWorker(matchedWorkerName);
  const workerReceipts = receipts.filter(r => {
    const rNorm = normWorker(r.worker_name);
    return rNorm.includes(workerNorm) || workerNorm.includes(rNorm);
  });
  if (workerReceipts.length === 0) return null;
  return workerReceipts.find(r => r.mes === receiptMonth) || null;
}

export function findSubsetSum(items, target) {
  const tolerance = 0.01;
  const vals = items.map(tx => tx._valor || Math.abs(parseFloat(tx.valor) || 0));

  function backtrack(index, currentSum, path) {
    if (Math.abs(currentSum - target) < tolerance) return path.slice();
    if (currentSum > target || index >= vals.length) return null;
    for (let i = index; i < vals.length; i++) {
      path.push(i);
      const result = backtrack(i + 1, currentSum + vals[i], path);
      if (result) return result;
      path.pop();
    }
    return null;
  }

  const result = backtrack(0, 0, []);
  if (!result) return [];
  return result.map(i => items[i]);
}
