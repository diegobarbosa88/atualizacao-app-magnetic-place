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

// Converte DD-MM-YYYY (aceita hífen normal, U+2010 e /) em YYYY-MM-DD
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
 * Com o pagerender personalizado (Y-based), o texto sai inline:
 *   "Montante 729,00 EUR" — labels e valores na mesma linha.
 * Com o pdf-parse padrão (quando funciona), os labels ficam antes de
 *   "De acordo com as suas instruções…" e os valores depois (layout de tabela).
 *
 * Detetamos o layout de tabela verificando se "Montante" ou "Referência"
 * aparecem ANTES da linha "De acordo…". Caso contrário, usa inline.
 */
export function extractFromText(text) {
  const t = text || '';
  const sepIdx = t.search(/de acordo com as suas instru[cç][oõ]es/i);
  const isTableLayout = sepIdx > 0 && /Montante|Refer[eê]ncia/i.test(t.slice(0, sepIdx));
  return isTableLayout ? extractFromTableLayout(t) : extractFromInlineFormat(t);
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

/** Devolve o texto bruto extraído de um PDF.
 *  pagerender personalizado: agrupa items por posição Y e ordena por X
 *  dentro de cada linha — evita "DOMMatrix is not defined" no Vercel e
 *  produz texto inline "Label Valor" em vez de colunas separadas. */
export async function extractPdfText(buffer) {
  const pdfParse = _require('pdf-parse');

  const renderPage = async (pageData) => {
    const content = await pageData.getTextContent();
    const lineMap = {};
    for (const item of content.items) {
      if (!item.str) continue;
      const y = Math.round(item.transform?.[5] ?? 0);
      if (!lineMap[y]) lineMap[y] = [];
      lineMap[y].push({ x: item.transform?.[4] ?? 0, str: item.str });
    }
    // Y decresce de cima para baixo na página (maior Y = topo)
    return Object.keys(lineMap)
      .map(Number)
      .sort((a, b) => b - a)
      .map(y => lineMap[y].sort((a, b) => a.x - b.x).map(i => i.str).join(' '))
      .join('\n');
  };

  const parsed = await pdfParse(buffer, { pagerender: renderPage });
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

/** Encontra partes com anexo PDF num payload Gmail (recursivo).
 *  Aceita application/pdf, application/octet-stream ou qualquer parte
 *  cujo filename termine em .pdf. */
export function findPdfParts(parts = []) {
  const found = [];
  for (const part of parts) {
    const looksLikePdf = part.mimeType === 'application/pdf'
      || part.filename?.toLowerCase().endsWith('.pdf');
    if (looksLikePdf && part.body?.attachmentId) {
      found.push(part);
    }
    if (part.parts) found.push(...findPdfParts(part.parts));
  }
  return found;
}
