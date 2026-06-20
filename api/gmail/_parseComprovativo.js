import { createRequire } from 'module';
const _require = createRequire(import.meta.url);

// Query Gmail para emails de comprovativo do novobanco
export const COMPROVATIVO_QUERY =
  'is:unread from:(alertas@novobanco.pt OR comprovativos@novobanco.pt OR info@novobanco.pt) (comprovativo OR "operação submetida" OR "operacao submetida" OR "pagamento executado")';

/**
 * Extrai campos financeiros do texto bruto (PDF ou corpo do email).
 * Cobre dois formatos novobanco:
 *   1. Comprovativo PDF — "Pagamento ao Estado", transferência SEPA, etc.
 *   2. Corpo HTML/texto — padrões "Beneficiário:", "NIB/IBAN:", etc.
 */
export function extractFromText(text) {
  const t = text || '';

  // Tipo de operação — "seguinte operação:" (comprovativos) ou "pagamento executado" no título
  const operacaoMatch = t.match(/seguinte opera[cç][aã]o:\s*(.+?)(?:\r?\n|$)/i);
  const tipoOperacao = operacaoMatch?.[1]?.trim() || null;

  // Montante/Valor — cobre vários rótulos usados pelo novobanco
  // "Montante ,729,00 EUR" / "Montante: 1.200,50 EUR" / "Valor: 500,00 EUR" / "Valor do Pagamento 100,00"
  function parseValor(raw) {
    if (!raw) return null;
    const normalised = raw.includes('.') && raw.includes(',')
      ? raw.replace(/\./g, '').replace(',', '.')
      : raw.replace(',', '.');
    const n = parseFloat(normalised);
    return isNaN(n) ? null : n;
  }
  let valor = null;
  const valorPatterns = [
    /Montante\s*[,:\s]+\s*([\d.,]+)\s*EUR/i,
    /Valor\s+(?:do\s+)?(?:Pagamento|Transfer[eê]ncia|Opera[cç][aã]o)?\s*[,:\s]+\s*([\d.,]+)\s*(?:EUR)?/i,
    /Quantia\s*[,:\s]+\s*([\d.,]+)\s*(?:EUR)?/i,
    /Valor\s*[,:\s]+\s*([\d.,]+)\s*(?:EUR)?/i,
  ];
  for (const p of valorPatterns) {
    const m = t.match(p);
    if (m) { valor = parseValor(m[1]); if (valor !== null) break; }
  }

  // Data — "Data do Pedido", "Data de Execução", "Data de Pagamento", "Data Valor", "Data:"
  let data_documento = null;
  const dataPatterns = [
    /Data\s+do\s+Pedido\s*[,:\s]+\s*(\d{2}[-/]\d{2}[-/]\d{4})/i,
    /Data\s+(?:de\s+)?(?:Execu[cç][aã]o|Pagamento|Processamento|Valuta)\s*[,:\s]+\s*(\d{2}[-/]\d{2}[-/]\d{4})/i,
    /Data\s+Valor\s*[,:\s]+\s*(\d{2}[-/]\d{2}[-/]\d{4})/i,
    /Data\s*[,:\s]+\s*(\d{2}[-/]\d{2}[-/]\d{4})/i,
  ];
  for (const p of dataPatterns) {
    const m = t.match(p);
    if (m) {
      const [d, mo, y] = m[1].split(/[-/]/);
      data_documento = `${y}-${mo}-${d}`;
      break;
    }
  }

  // Referência
  const refMatch = t.match(/Refer[eê]ncia\s*(?:do\s+Pagamento\s*)?[,:\s]+\s*(\S+)/i);
  const referencia = refMatch?.[1] || null;

  // NIF / Número Contribuinte
  const nifMatch = t.match(/N[uú]mero\s+Contribuinte\s*[,:\s]+\s*([\d\s]+)/i);
  const fornecedor_nif = nifMatch?.[1]?.replace(/\s/g, '') || null;

  // Beneficiário — "Beneficiário:", "Nome do Beneficiário:", "Entidade:"
  const benefMatch = t.match(/(?:Nome\s+do\s+)?Benefici[aá]rio\s*[,:\s]+\s*(.+?)(?:\r?\n|$)/i)
    || t.match(/Entidade\s*[,:\s]+\s*(.+?)(?:\r?\n|$)/i);
  const beneficiario = benefMatch?.[1]?.trim() || null;

  // IBAN — "NIB/IBAN:", "IBAN do Beneficiário:", "IBAN:"
  const ibanMatch = t.match(/(?:NIB\/)?IBAN\s*(?:do\s+Benefici[aá]rio\s*)?[,:\s]+\s*([A-Z]{2}[0-9A-Z ]+?)(?:\r?\n|$)/i);
  const fornecedor_iban = ibanMatch?.[1]?.replace(/\s/g, '') || null;

  // Descrição
  const descMatch = t.match(/Descri[cç][aã]o\s*[,:\s]+\s*(.+?)(?:\r?\n|$)/i)
    || t.match(/Motivo\s*[,:\s]+\s*(.+?)(?:\r?\n|$)/i);
  const descricao = descMatch?.[1]?.trim() || tipoOperacao || null;

  // Resolver fornecedor em cascata
  let fornecedor = beneficiario;
  if (!fornecedor && tipoOperacao) {
    if (/estado/i.test(tipoOperacao)) fornecedor = 'Estado Português';
    else if (/segurança social/i.test(tipoOperacao)) fornecedor = 'Segurança Social';
    else if (/at\b|autoridade tributária/i.test(tipoOperacao)) fornecedor = 'Autoridade Tributária';
    else fornecedor = tipoOperacao;
  }
  if (!fornecedor) fornecedor = 'novobanco (origem desconhecida)';

  return {
    fornecedor,
    fornecedor_nif,
    fornecedor_iban,
    valor,
    data_documento,
    referencia,
    descricao,
    moeda: 'EUR',
    _tipo_operacao: tipoOperacao,
  };
}

/**
 * Extrai campos de um buffer PDF usando pdf-parse.
 * O require é lazy (dentro da função) para não falhar ao carregar o módulo.
 */
export async function extractFromPdf(buffer) {
  const pdfParse = _require('pdf-parse');
  const parsed = await pdfParse(buffer);
  return extractFromText(parsed.text);
}

/**
 * Extrai o corpo plain-text de um payload Gmail (recursivo).
 * Prefere text/plain; fallback para text/html (strip tags).
 */
export function extractBodyText(payload) {
  if (!payload) return '';

  const parts = payload.parts || [];

  // Preferência: text/plain directo no payload
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64url').toString('utf8');
  }

  for (const part of parts) {
    if (part.mimeType === 'text/plain' && part.body?.data) {
      return Buffer.from(part.body.data, 'base64url').toString('utf8');
    }
  }

  // Fallback: text/html — strip tags básico
  for (const part of parts) {
    if (part.mimeType === 'text/html' && part.body?.data) {
      const html = Buffer.from(part.body.data, 'base64url').toString('utf8');
      return html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s{2,}/g, '\n');
    }
  }

  // Recursivo para multipart
  for (const part of parts) {
    const text = extractBodyText(part);
    if (text) return text;
  }

  return '';
}

/** Encontra partes com anexo PDF num payload Gmail (recursivo). */
export function findPdfParts(parts = []) {
  const found = [];
  for (const part of parts) {
    if (part.mimeType === 'application/pdf' && part.body?.attachmentId) {
      found.push(part);
    }
    if (part.parts) found.push(...findPdfParts(part.parts));
  }
  return found;
}
