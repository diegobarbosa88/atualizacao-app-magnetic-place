import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

// Query Gmail para emails de comprovativo do novobanco
export const COMPROVATIVO_QUERY =
  'is:unread from:(alertas@novobanco.pt OR comprovativos@novobanco.pt) (comprovativo OR "operação submetida" OR "operacao submetida")';

/**
 * Extrai campos financeiros do texto bruto (PDF ou corpo do email).
 * Cobre dois formatos novobanco:
 *   1. Comprovativo PDF — "Pagamento ao Estado", transferência SEPA, etc.
 *   2. Corpo HTML/texto — padrões "Beneficiário:", "NIB/IBAN:", etc.
 */
export function extractFromText(text) {
  const t = text || '';

  // Tipo de operação (linha após "seguinte operação:")
  const operacaoMatch = t.match(/seguinte opera[cç][aã]o:\s*(.+?)(?:\r?\n|$)/i);
  const tipoOperacao = operacaoMatch?.[1]?.trim() || null;

  // Montante — aceita vírgula decimal e ponto como milhar
  // Ex: "Montante ,729,00 EUR" ou "Montante: 1.200,50 EUR"
  const montanteMatch = t.match(/Montante\s*[,:\s]+\s*([\d.,]+)\s*EUR/i);
  let valor = null;
  if (montanteMatch) {
    const raw = montanteMatch[1];
    // Se tem ponto E vírgula, ponto é milhar; se só vírgula, vírgula é decimal
    const normalised = raw.includes('.') && raw.includes(',')
      ? raw.replace(/\./g, '').replace(',', '.')
      : raw.replace(',', '.');
    valor = parseFloat(normalised);
    if (isNaN(valor)) valor = null;
  }

  // Data do pedido — DD-MM-YYYY ou DD/MM/YYYY
  const dataMatch = t.match(/Data do Pedido\s*[,:\s]+\s*(\d{2}[-/]\d{2}[-/]\d{4})/i);
  let data_documento = null;
  if (dataMatch) {
    const [d, m, y] = dataMatch[1].split(/[-/]/);
    data_documento = `${y}-${m}-${d}`;
  }

  // Referência (sequência numérica ou alfanumérica)
  const refMatch = t.match(/Refer[eê]ncia\s*[,:\s]+\s*(\S+)/i);
  const referencia = refMatch?.[1] || null;

  // NIF / Número Contribuinte
  const nifMatch = t.match(/N[uú]mero Contribuinte\s*[,:\s]+\s*([\d\s]+)/i);
  const fornecedor_nif = nifMatch?.[1]?.replace(/\s/g, '') || null;

  // Beneficiário (transferências para terceiros)
  const benefMatch = t.match(/Benefici[aá]rio\s*[,:\s]+\s*(.+?)(?:\r?\n|$)/i);
  const beneficiario = benefMatch?.[1]?.trim() || null;

  // IBAN / NIB do beneficiário
  const ibanMatch = t.match(/NIB\/IBAN\s*[,:\s]+\s*([A-Z0-9 ]+?)(?:\r?\n|$)/i);
  const fornecedor_iban = ibanMatch?.[1]?.replace(/\s/g, '') || null;

  // Descrição (campo explícito no corpo)
  const descMatch = t.match(/Descri[cç][aã]o\s*[,:\s]+\s*(.+?)(?:\r?\n|$)/i);
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
    _tipo_operacao: tipoOperacao, // informativo, não persiste como coluna separada
  };
}

/**
 * Extrai campos de um buffer PDF usando pdf-parse.
 * Lança erro se o parse falhar.
 */
export async function extractFromPdf(buffer) {
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
