import { createRequire } from 'module';
import { inflateSync } from 'zlib';
const _require = createRequire(import.meta.url);

// pdfjs-dist v5 requer DOMMatrix (Web API ausente no Node.js < 21 e no Vercel).
// Polyfill mínimo funcional — garante que a inicialização do pdfjs não falha.
function _buildDomMatrixPolyfill() {
  return class DOMMatrix {
    constructor(init) {
      const v = Array.isArray(init) && init.length >= 6 ? init : [1,0,0,1,0,0];
      [this.a,this.b,this.c,this.d,this.e,this.f] = v;
      this.m11=this.a; this.m12=this.b; this.m13=0; this.m14=0;
      this.m21=this.c; this.m22=this.d; this.m23=0; this.m24=0;
      this.m31=0; this.m32=0; this.m33=1; this.m34=0;
      this.m41=this.e; this.m42=this.f; this.m43=0; this.m44=1;
      this.is2D=true;
      this.isIdentity=(this.a===1&&this.b===0&&this.c===0&&this.d===1&&this.e===0&&this.f===0);
    }
    static fromMatrix(m) { const P=globalThis.DOMMatrix; return new P(m?[m.a,m.b,m.c,m.d,m.e,m.f]:undefined); }
    static fromFloat32Array(a) { return new globalThis.DOMMatrix([...a]); }
    static fromFloat64Array(a) { return new globalThis.DOMMatrix([...a]); }
    multiply(m) {
      return new globalThis.DOMMatrix([
        this.a*m.a+this.b*m.c, this.a*m.b+this.b*m.d,
        this.c*m.a+this.d*m.c, this.c*m.b+this.d*m.d,
        this.e*m.a+this.f*m.c+m.e, this.e*m.b+this.f*m.d+m.f,
      ]);
    }
    translate(tx=0,ty=0) { return this.multiply(new globalThis.DOMMatrix([1,0,0,1,tx,ty])); }
    scale(sx=1,sy=sx)   { return this.multiply(new globalThis.DOMMatrix([sx,0,0,sy,0,0])); }
    rotate(deg=0) {
      const r=deg*Math.PI/180,cos=Math.cos(r),sin=Math.sin(r);
      return this.multiply(new globalThis.DOMMatrix([cos,sin,-sin,cos,0,0]));
    }
    inverse() {
      const det=this.a*this.d-this.b*this.c;
      if(!det) return new globalThis.DOMMatrix();
      return new globalThis.DOMMatrix([this.d/det,-this.b/det,-this.c/det,this.a/det,(this.c*this.f-this.d*this.e)/det,(this.b*this.e-this.a*this.f)/det]);
    }
    transformPoint(p={}) { return {x:this.a*(p.x||0)+this.c*(p.y||0)+this.e,y:this.b*(p.x||0)+this.d*(p.y||0)+this.f,z:0,w:1}; }
    toFloat32Array() { return new Float32Array([this.a,this.b,this.c,this.d,this.e,this.f]); }
    toFloat64Array() { return new Float64Array([this.a,this.b,this.c,this.d,this.e,this.f]); }
    toString() { return `matrix(${this.a},${this.b},${this.c},${this.d},${this.e},${this.f})`; }
  };
}

// Aplica ao carregar o módulo (cold start)
if (typeof globalThis.DOMMatrix === 'undefined') {
  globalThis.DOMMatrix = _buildDomMatrixPolyfill();
}

// Query Gmail para emails de comprovativo do novobanco
export const COMPROVATIVO_QUERY =
  'is:unread from:(alertas@novobanco.pt OR comprovativos@novobanco.pt OR info@novobanco.pt) (comprovativo OR "operação submetida" OR "operacao submetida" OR "pagamento executado" OR "transferência executada" OR "transferencia executada")';

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
  const montanteRaw = get('Montante') || get('Valor') || get('Valor da Transferência') || get('Valor da transferencia') || '';
  const montanteNum = montanteRaw.match(/([\d.,]+)/);
  const valor = montanteNum ? parsePortugueseNumber(montanteNum[1]) : null;

  const data_documento = parseDate(
    get('Data do Pedido') || get('Data de Execução') || get('Data de Execucao') ||
    get('Data de Valor') || get('Data da Transferência') || get('Data da transferencia') || ''
  );
  const referencia = get('Referência') || get('Referencia') || get('Referência do Movimento') || null;
  const nifRaw = get('Número Contribuinte') || get('Numero Contribuinte') || '';
  const fornecedor_nif = nifRaw.replace(/\s/g, '') || null;
  // Transferências usam "Destinatário"; pagamentos usam "Beneficiário" / "Entidade"
  const destinatarioRaw = get('Destinatário') || get('Destinatario') || get('Nome do Destinatário') || get('Nome do Destinatario') || null;
  const beneficiarioRaw = get('Beneficiário') || get('Beneficiario') || null;
  const fornecedor = resolveFornecedor(destinatarioRaw || beneficiarioRaw, tipoOperacao);
  const ibanRaw = get('IBAN do Destinatário') || get('IBAN do Destinatario') || get('IBAN do Beneficiário') || get('IBAN do Beneficiario') || get('NIB/IBAN') || null;
  const fornecedor_iban = ibanRaw ? ibanRaw.replace(/\s/g, '') : null;

  const contaOrigemRaw = get('Conta Origem') || get('Conta de Débito') || get('Conta Debitada') || get('IBAN de Origem') || get('NIB/IBAN de Origem') || get('Conta Ordenante') || null;
  const conta_origem = contaOrigemRaw ? contaOrigemRaw.replace(/\s/g, '') : null;

  return {
    fornecedor,
    fornecedor_nif: fornecedor_nif || null,
    fornecedor_iban,
    conta_origem,
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
    new RegExp(`Data\\s+(?:da\\s+)?Transfer[eê]ncia\\s*[,:\\s]+\\s*${dateRe.source}`, 'i'),
    new RegExp(`Data\\s+(?:de\\s+)?Valor\\s*[,:\\s]+\\s*${dateRe.source}`, 'i'),
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

  const benefMatch = t.match(/(?:Nome\s+do\s+)?Destinat[aá]rio\s*[,:\s]+\s*(.+?)(?:\r?\n|$)/i)
    || t.match(/(?:Nome\s+do\s+)?Benefici[aá]rio\s*[,:\s]+\s*(.+?)(?:\r?\n|$)/i)
    || t.match(/Entidade\s*[,:\s]+\s*(.+?)(?:\r?\n|$)/i);
  const beneficiario = benefMatch?.[1]?.trim() || null;

  const ibanMatch = t.match(/(?:NIB\/)?IBAN\s*(?:do\s+(?:Destinat[aá]rio|Benefici[aá]rio)\s*)?[,:\s]+\s*([A-Z]{2}[0-9A-Z ]+?)(?:\r?\n|$)/i);
  const fornecedor_iban = ibanMatch?.[1]?.replace(/\s/g, '') || null;

  const descMatch = t.match(/Descri[cç][aã]o\s*[,:\s]+\s*(.+?)(?:\r?\n|$)/i)
    || t.match(/Motivo\s*[,:\s]+\s*(.+?)(?:\r?\n|$)/i);
  const descricao = descMatch?.[1]?.trim() || tipoOperacao || null;

  const contaOrigemMatch = t.match(/Conta\s+(?:de\s+)?(?:Origem|D[eé]bito|Debitada|Ordenante)\s*[,:\s]+\s*([A-Z0-9][^\r\n]+?)(?:\r?\n|$)/i)
    || t.match(/(?:NIB\/)?IBAN\s+de\s+Origem\s*[,:\s]+\s*([A-Z]{2}[0-9A-Z ]+?)(?:\r?\n|$)/i);
  const conta_origem = contaOrigemMatch?.[1]?.trim().replace(/\s/g, '') || null;

  return {
    fornecedor: resolveFornecedor(beneficiario, tipoOperacao),
    fornecedor_nif,
    fornecedor_iban,
    conta_origem,
    valor,
    data_documento,
    referencia,
    descricao,
    moeda: 'EUR',
    _tipo_operacao: tipoOperacao,
  };
}

// ---------------------------------------------------------------------------
// Extrator nativo de PDF — puro Node.js, sem pdfjs-dist / DOMMatrix
// Suporta PDFs com fontes CID 2-byte (ToUnicode bfrange/bfchar embedding)
// como os gerados pelo EvoPdf para o novobanco.
// ---------------------------------------------------------------------------

function _buildCMapFromPdf(raw) {
  const cmap = new Map();
  const rangeRe = /beginbfrange([\s\S]*?)endbfrange/g;
  let m;
  while ((m = rangeRe.exec(raw)) !== null) {
    const block = m[1];
    const entryRe = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g;
    let entry;
    while ((entry = entryRe.exec(block)) !== null) {
      const start = parseInt(entry[1], 16);
      const end   = parseInt(entry[2], 16);
      const uStart = parseInt(entry[3], 16);
      for (let i = 0; i <= (end - start); i++) cmap.set(start + i, String.fromCodePoint(uStart + i));
    }
  }
  const charRe = /beginbfchar([\s\S]*?)endbfchar/g;
  while ((m = charRe.exec(raw)) !== null) {
    const block = m[1];
    const entryRe = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g;
    let entry;
    while ((entry = entryRe.exec(block)) !== null) {
      cmap.set(parseInt(entry[1], 16), String.fromCodePoint(parseInt(entry[2], 16)));
    }
  }
  return cmap;
}

function _parsePdfStringBytes(raw) {
  // Resolve PDF string escape sequences → Buffer de bytes lógicos
  const bytes = [];
  for (let i = 0; i < raw.length; i++) {
    const c = raw.charCodeAt(i);
    if (c === 0x5C) {
      i++;
      if (i >= raw.length) break;
      const n = raw.charCodeAt(i);
      if (n >= 0x30 && n <= 0x37) {
        let oct = String.fromCharCode(n);
        for (let j = 0; j < 2 && i + 1 < raw.length; j++) {
          const nx = raw.charCodeAt(i + 1);
          if (nx < 0x30 || nx > 0x37) break;
          oct += String.fromCharCode(nx); i++;
        }
        bytes.push(parseInt(oct, 8));
      } else {
        const ESC = { 0x6E:0x0A, 0x72:0x0D, 0x74:0x09, 0x62:0x08, 0x66:0x0C, 0x28:0x28, 0x29:0x29, 0x5C:0x5C };
        bytes.push(ESC[n] ?? (n & 0xFF));
      }
    } else {
      bytes.push(c & 0xFF);
    }
  }
  return Buffer.from(bytes);
}

function _decodeGlyphs2Byte(rawStr, cmap) {
  const buf = _parsePdfStringBytes(rawStr);
  let result = '';
  for (let i = 0; i + 1 < buf.length; i += 2) result += cmap.get((buf[i] << 8) | buf[i + 1]) || '';
  return result;
}

function _extractTextItems(content, cmap) {
  const items = [];
  const btRe = /BT([\s\S]*?)ET/g;
  let m;
  while ((m = btRe.exec(content)) !== null) {
    const block = m[1];
    let x = 0, y = 0;
    const td = block.match(/([\d.-]+)\s+([\d.-]+)\s+Td/);
    if (td) { x = parseFloat(td[1]); y = parseFloat(td[2]); }
    let text = '';
    const tjRe = /\(((?:[^()\\]|\\.)*)\)\s*Tj/g;
    let tj;
    while ((tj = tjRe.exec(block)) !== null) text += _decodeGlyphs2Byte(tj[1], cmap);
    const t = text.trim();
    if (t) items.push({ x, y, text: t });
  }
  return items;
}

/** Extrai texto de um PDF usando apenas Node.js nativo (zlib + regex).
 *  Não depende de pdfjs-dist nem de DOMMatrix — funciona no Vercel. */
export function extractPdfTextNative(buffer) {
  const raw = buffer.toString('latin1');
  const cmap = _buildCMapFromPdf(raw);
  if (cmap.size === 0) return '';

  const allItems = [];
  const streamRe = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let m;
  while ((m = streamRe.exec(raw)) !== null) {
    let content = m[1];
    if (!content.includes('BT')) {
      try { content = inflateSync(Buffer.from(content, 'latin1')).toString('latin1'); } catch {
        try { content = inflateSync(Buffer.from(content, 'latin1').slice(2)).toString('latin1'); } catch { continue; }
      }
    }
    if (content.includes('BT')) allItems.push(..._extractTextItems(content, cmap));
  }

  if (allItems.length === 0) return '';

  // Ordena por Y decrescente; agrupa itens cujo Y difere ≤ 2 (label+valor estão 1 pt afastados)
  allItems.sort((a, b) => b.y - a.y || a.x - b.x);
  const groups = [];
  let cur = null;
  for (const item of allItems) {
    if (!cur || Math.abs(cur.y - item.y) > 2) { cur = { y: item.y, items: [] }; groups.push(cur); }
    cur.items.push(item);
  }
  return groups.map(g => g.items.sort((a, b) => a.x - b.x).map(i => i.text).join(' ')).join('\n');
}

/** Devolve o texto bruto extraído de um PDF.
 *  Tenta primeiro o extrator nativo (sem dependências externas).
 *  Fallback para pdf-parse com pagerender Y-based caso o nativo não produza texto. */
export async function extractPdfText(buffer) {
  const nativeText = extractPdfTextNative(buffer);
  if (nativeText.trim().length > 20) return nativeText;

  // Fallback: pdf-parse via pdfjs-dist (requer DOMMatrix — pode falhar no Vercel)
  if (typeof globalThis.DOMMatrix === 'undefined') {
    globalThis.DOMMatrix = _buildDomMatrixPolyfill();
  }
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
    return Object.keys(lineMap).map(Number).sort((a, b) => b - a)
      .map(y => lineMap[y].sort((a, b) => a.x - b.x).map(i => i.str).join(' ')).join('\n');
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
