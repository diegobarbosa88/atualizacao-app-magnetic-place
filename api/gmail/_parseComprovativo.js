import { createRequire } from 'module';
const _require = createRequire(import.meta.url);

// Query Gmail para emails de comprovativo do novobanco
export const COMPROVATIVO_QUERY =
  'is:unread from:(alertas@novobanco.pt OR comprovativos@novobanco.pt OR info@novobanco.pt) (comprovativo OR "operação submetida" OR "operacao submetida" OR "pagamento executado")';

// Normalisa número português: "1.200,50" → 1200.50 / "729,00" → 729.00
function parsePortugueseNumber(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  const normalised = s.includes('.') && s.includes(',')
    ? s.replace(/\./g, '').replace(',', '.')
    : s.replace(',', '.');
  const n = parseFloat(normalised);
  return isNaN(n) ? null : n;
}

// Converte DD-MM-YYYY (aceita U+2010 non-breaking hyphen e /) em YYYY-MM-DD
function parseDate(raw) {
  if (!raw) return null;
  const m = String(raw).match(/(\d{2})[-‐\/](\d{2})[-‐\/](\d{4})/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function resolveFornecedor(beneficiario, tipoOperacao) {
  if (beneficiario) return beneficiario;
  if (tipoOperacao) {
    if (/estado/i.test(tipoOperacao)) return 'Estado Português';
    if (/segurança social/i.test(tipoOperacao)) return 'Segurança Social';
    if (/at\b|autoridade tributária/i.test(tipoOperacao)) return 'Autoridade Tributária';
    return tipoOperacao;
  }
  return 'novobanco (origem desconhecida)';
}

/**
 * Extrai campos financeiros do texto bruto (PDF ou corpo do email).
 *
 * O pdf-parse extrai PDFs novobanco em layout de 2 colunas como dois blocos:
 *   Bloco 1 (esquerda): todos os labels (Número do Pedido, Montante, …)
 *   Separador: "De acordo com as suas instruções…"
 *   Bloco 2 (direita): todos os valores na mesma ordem
 *
 * Quando esse padrão é detetado usamos mapeamento posicional.
 * Caso contrário, tentamos regex inline (corpo HTML/texto).
 */
export function extractFromText(text) {
  const t = text || '';
  if (/de acordo com as suas instru[cç][oõ]es/i.test(t)) {
    return extractFromTableLayout(t);
  }
  return extractFromInlineFormat(t);
}

function extractFromTableLayout(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l);

  // Linha separadora "De acordo com as suas instruções…"
  const sepIdx = lines.findIndex(l => /de acordo com as suas instru[cç][oõ]es/i.test(l));
  if (sepIdx < 0) return extractFromInlineFormat(text);

  const labels = lines.slice(0, sepIdx);
  const afterSep = lines.slice(sepIdx + 1);

  // Primeira linha a seguir ao separador é o tipo de operação ("Pagamento ao Estado", etc.)
  const tipoOperacao = afterSep[0]?.trim() || null;
  const values = afterSep.slice(1);

  // Mapeamento posicional insensível a acentos
  const normalize = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const fieldMap = {};
  for (let i = 0; i < labels.length; i++) {
    if (values[i] !== undefined) fieldMap[normalize(labels[i])] = values[i];
  }
  const get = key => fieldMap[normalize(key)];

  // Montante: "729,00 EUR" → extrair a parte numérica
  const montanteRaw = get('Montante') || '';
  const montanteNum = montanteRaw.match(/([\d.,]+)/);
  const valor = montanteNum ? parsePortugueseNumber(montanteNum[1]) : null;

  const data_documento = parseDate(get('Data do Pedido') || '');
  const referencia = get('Referência') || get('Referencia') || null;
  const nifRaw = get('Número Contribuinte') || get('Numero Contribuinte') || '';
  const fornecedor_nif = nifRaw.replace(/\s/g, '') || null;
  const fornecedor = resolveFornecedor(null, tipoOperacao);

  return {
    fornecedor,
    fornecedor_nif: fornecedor_nif || null,
    fornecedor_iban: null,
    valor,
    data_documento,
    referencia,
    descricao: tipoOperacao || null,
    moeda: 'EUR',
    _tipo_operacao: tipoOperacao,
  };
}

function extractFromInlineFormat(text) {
  const t = text || '';

  const operacaoMatch = t.match(/seguinte opera[cç][aã]o:\s*(.+?)(?:\r?\n|$)/i);
  const tipoOperacao = operacaoMatch?.[1]?.trim() || null;

  // Montante/Valor — vários rótulos possíveis
  let valor = null;
  const valorPatterns = [
    /Montante\s*[,:\s]+\s*([\d.,]+)\s*EUR/i,
    /Valor\s+(?:do\s+)?(?:Pagamento|Transfer[eê]ncia|Opera[cç][aã]o)?\s*[,:\s]+\s*([\d.,]+)\s*(?:EUR)?/i,
    /Quantia\s*[,:\s]+\s*([\d.,]+)\s*(?:EUR)?/i,
    /Valor\s*[,:\s]+\s*([\d.,]+)\s*(?:EUR)?/i,
  ];
  for (const p of valorPatterns) {
    const m = t.match(p);
    if (m) { valor = parsePortugueseNumber(m[1]); if (valor !== null) break; }
  }

  // Data — aceita non-breaking hyphen (U+2010)
  let data_documento = null;
  const dateRe = /(\d{2})[-‐\/](\d{2})[-‐\/](\d{4})/;
  const dataPatterns = [
    new RegExp(`Data\\s+do\\s+Pedido\\s*[,:\\s]+\\s*${dateRe.source}`, 'i'),
    new RegExp(`Data\\s+(?:de\\s+)?(?:Execu[cç][aã]o|Pagamento|Processamento|Valuta)\\s*[,:\\s]+\\s*${dateRe.source}`, 'i'),
    new RegExp(`Data\\s*[,:\\s]+\\s*${dateRe.source}`, 'i'),
  ];
  for (const p of dataPatterns) {
    const m = t.match(p);
    if (m) { data_documento = parseDate(`${m[1]}-${m[2]}-${m[3]}`); break; }
  }

  const refMatch = t.match(/Refer[eê]ncia\s*(?:do\s+Pagamento\s*)?[,:\s]+\s*(\S+)/i);
  const referencia = refMatch?.[1] || null;

  const nifMatch = t.match(/N[uú]mero\s+Contribuinte\s*[,:\s]+\s*([\d\s]+)/i);
  const fornecedor_nif = nifMatch?.[1]?.replace(/\s/g, '') || null;

  const benefMatch = t.match(/(?:Nome\s+do\s+)?Benefici[aá]rio\s*[,:\s]+\s*(.+?)(?:\r?\n|$)/i)
    || t.match(/Entidade\s*[,:\s]+\s*(.+?)(?:\r?\n|$)/i);
  const beneficiario = benefMatch?.[1]?.trim() || null;

  const ibanMatch = t.match(/(?:NIB\/)?IBAN\s*(?:do\s+Benefici[aá]rio\s*)?[,:\s]+\s*([A-Z]{2}[0-9A-Z ]+?)(?:\r?\n|$)/i);
  const fornecedor_iban = ibanMatch?.[1]?.replace(/\s/g, '') || null;

  const descMatch = t.match(/Descri[cç][aã]o\s*[,:\s]+\s*(.+?)(?:\r?\n|$)/i)
    || t.match(/Motivo\s*[,:\s]+\s*(.+?)(?:\r?\n|$)/i);
  const descricao = descMatch?.[1]?.trim() || tipoOperacao || null;

  return {
    fornecedor: resolveFornecedor(beneficiario, tipoOperacao),
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

/** Devolve o texto bruto extraído de um PDF (para debug ou parsing). */
export async function extractPdfText(buffer) {
  const pdfParse = _require('pdf-parse');
  const parsed = await pdfParse(buffer);
  return parsed.text;
}

export async function extractFromPdf(buffer) {
  return extractFromText(await extractPdfText(buffer));
}

/**
 * Extrai o corpo plain-text de um payload Gmail (recursivo).
 * Prefere text/plain; fallback para text/html (strip tags).
 */
export function extractBodyText(payload) {
  if (!payload) return '';
  const parts = payload.parts || [];

  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64url').toString('utf8');
  }
  for (const part of parts) {
    if (part.mimeType === 'text/plain' && part.body?.data) {
      return Buffer.from(part.body.data, 'base64url').toString('utf8');
    }
  }
  for (const part of parts) {
    if (part.mimeType === 'text/html' && part.body?.data) {
      const html = Buffer.from(part.body.data, 'base64url').toString('utf8');
      return html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s{2,}/g, '\n');
    }
  }
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
