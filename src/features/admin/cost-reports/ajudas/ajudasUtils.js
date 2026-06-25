export const fmtEur = v => (parseFloat(v) || 0).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
export const fmtPct = v => (parseFloat(v) || 0).toFixed(2) + '%';

export function mesAnterior(mes) {
  const [y, m] = mes.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return d.toISOString().slice(0, 7);
}

export function mesSeguinte(mes) {
  const [y, m] = mes.split('-').map(Number);
  const d = new Date(y, m, 1);
  return d.toISOString().slice(0, 7);
}

export function getObservacao(a) {
  return a.notes || a.observations || a.observation || a.remarks || a.memo || a.description || null;
}

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
export function extrairValorObs(obs) {
  if (!obs) return null;
  const str = String(obs);
  const mEuro = str.match(/€\s*([\d][\d.,]*)/);
  if (mEuro) return _parseMonetario(mEuro[1]);
  const m = str.match(/\d[\d.,]*\d|\d/);
  if (!m) return null;
  return _parseMonetario(m[0]);
}

// Agrega linhas por dbClientId para guardar na BD (UNIQUE(mes, client_id)).
export function agruparPorCliente(linhas) {
  const porCliente = {};
  linhas.forEach(l => {
    const dbId = l.dbClientId ?? l.clientId;
    if (!porCliente[dbId]) porCliente[dbId] = { valor: 0, fatura: 0 };
    porCliente[dbId].valor += l.ajudasEstimadas;
    porCliente[dbId].fatura += l.valorFatura || 0;
  });
  return porCliente;
}

// Indexa faturas TOConline por dbClientId para o painel do histórico.
export function indexarFaturasPorCliente(faturasDoMes, clients) {
  const map = {};
  faturasDoMes.forEach((item, idx) => {
    const a = item.attributes || item;
    const nome = a.customer_business_name || a.customer_name;
    if (!nome) return;
    const c = clients.find(x => x.name?.toLowerCase().trim() === nome.toLowerCase().trim());
    const dbId = c?.id ?? `toc:${nome}`;
    if (!map[dbId]) map[dbId] = [];
    map[dbId].push({
      docNum: a.document_number || a.document_no || `#${item.id ?? idx}`,
      valor: parseFloat(a.gross_total ?? a.total_amount ?? a.total_value ?? 0) || 0,
    });
  });
  return map;
}

// Helpers para chaves compostas do histOverrides.
export const histKey = (mes, clientId) => `${mes}|${clientId}`;
export const histKeyFatura = (mes, clientId, docNum) => `${mes}|${clientId}|${docNum}`;
export const getHistInvoiceKeys = (histOverrides, mes, clientId) =>
  Object.keys(histOverrides).filter(k => k.startsWith(`${mes}|${clientId}|`));

/**
 * Two-Pass allocation algorithm.
 * Pass 1: Classify each invoice as Fixed (ajudasObs or manual override) vs Empty.
 * Pass 2: saldoRestante = max(0, saldoDisponivel − somaFixas); distribute to empty invoices proportionally.
 * regraCumprida = true when jaFaturadoYTD + totalAjudasMes >= orcamentoAnual.
 */
export function calcularLinhasTwoPass({ clientesMesFinal, saldoDisponivel, totalFaturaMes, overrides, jaFaturadoYTD, orcamentoAnual }) {
  // Pass 1
  const comClass = clientesMesFinal.map(c => {
    const valorStr = overrides[c.clientId];
    let fixo = null;
    if (valorStr !== undefined) fixo = parseFloat(String(valorStr).replace(',', '.')) || 0;
    else if (c.ajudasObs != null) fixo = c.ajudasObs;
    return { ...c, fixo, eFixa: fixo !== null, daObservacao: c.ajudasObs != null };
  });

  const somaFixas = comClass.reduce((s, c) => s + (c.fixo ?? 0), 0);

  // Pass 2
  const saldoRestante = Math.max(0, saldoDisponivel - somaFixas);
  const vazias = comClass.filter(c => !c.eFixa);
  const totalFatVazias = vazias.reduce((s, c) => s + c.valorFatura, 0);

  const linhas = comClass.map(c => {
    const proporcao = totalFaturaMes > 0 ? c.valorFatura / totalFaturaMes : 0;
    const ajudas = c.eFixa
      ? Math.min(c.fixo, c.valorFatura)
      : Math.min(totalFatVazias > 0 ? saldoRestante * (c.valorFatura / totalFatVazias) : 0, c.valorFatura);
    return { ...c, proporcao, ajudasEstimadas: ajudas };
  });

  const totalAjudasMes = linhas.reduce((s, l) => s + l.ajudasEstimadas, 0);
  const regraCumprida = orcamentoAnual === 0 || (jaFaturadoYTD + totalAjudasMes) >= orcamentoAnual;

  return { linhas, totalAjudasMes, regraCumprida, somaFixas, saldoRestante, nVazias: vazias.length };
}
