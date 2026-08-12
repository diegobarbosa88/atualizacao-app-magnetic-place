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

// O stream do ToUnicode CMap (beginbfrange/beginbfchar) pode estar comprimido
// (Flate), tal como os content streams de desenho — sem isto, _buildCMapsFromPdf
// nunca encontra nada em PDFs que comprimem o CMap (ex: TOConline).
function _inflateAllStreamsForScan(raw) {
  const streamRe = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let combined = raw;
  let m;
  while ((m = streamRe.exec(raw)) !== null) {
    const chunk = m[1];
    if (chunk.includes('beginbfrange') || chunk.includes('beginbfchar') || chunk.includes('BT')) continue;
    try {
      combined += '\n' + inflateSync(Buffer.from(chunk, 'latin1')).toString('latin1');
    } catch {
      try { combined += '\n' + inflateSync(Buffer.from(chunk, 'latin1').slice(2)).toString('latin1'); } catch { /* não é zlib, ignora */ }
    }
  }
  return combined;
}

// PDFs com mais do que uma fonte embutida (ex: uma para títulos/cabeçalhos,
// outra para os dados da tabela) podem ter VÁRIOS objetos ToUnicode CMap,
// cada um delimitado por "begincmap...endcmap" — e os códigos de glifo
// costumam SOBREPOR-SE entre fontes (o código 0x25 pode ser "A" numa fonte e
// outra letra completamente diferente noutra). Fundir tudo num mapa só
// (como uma versão anterior deste ficheiro fazia) causa decodificação
// errada sempre que dois CMaps definem o mesmo código com significados
// diferentes. Por isso mantemos os CMaps SEPARADOS e escolhemos, por cada
// trecho de texto (cada Tj pertence sempre a uma única fonte), o que
// decodifica mais códigos com sucesso.
function _buildCMapsFromPdf(raw) {
  const cmaps = [];
  const cmapBlockRe = /begincmap([\s\S]*?)endcmap/g;
  let cb;
  while ((cb = cmapBlockRe.exec(raw)) !== null) {
    const block = cb[1];
    const map = new Map();
    const rangeRe = /beginbfrange([\s\S]*?)endbfrange/g;
    let m;
    while ((m = rangeRe.exec(block)) !== null) {
      const entryRe = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g;
      let entry;
      while ((entry = entryRe.exec(m[1])) !== null) {
        const start = parseInt(entry[1], 16);
        const end   = parseInt(entry[2], 16);
        const uStart = parseInt(entry[3], 16);
        for (let i = 0; i <= (end - start); i++) map.set(start + i, String.fromCodePoint(uStart + i));
      }
    }
    const charRe = /beginbfchar([\s\S]*?)endbfchar/g;
    while ((m = charRe.exec(block)) !== null) {
      const entryRe = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g;
      let entry;
      while ((entry = entryRe.exec(m[1])) !== null) {
        map.set(parseInt(entry[1], 16), String.fromCodePoint(parseInt(entry[2], 16)));
      }
    }
    if (map.size > 0) cmaps.push(map);
  }
  return cmaps;
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

function _codesFromPdfString(rawStr) {
  const buf = _parsePdfStringBytes(rawStr);
  const codes = [];
  for (let i = 0; i + 1 < buf.length; i += 2) codes.push((buf[i] << 8) | buf[i + 1]);
  return codes;
}

// Alguns geradores (ex: EvoPdf/novobanco) escrevem os glifos como strings
// literais escapadas "(...)"; outros (ex: TOConline) usam hex strings
// "<0030...>" para o mesmo operador Tj — cada grupo de 4 dígitos hex é um
// código de glifo de 2 bytes.
function _codesFromHex(hexStr) {
  const clean = hexStr.replace(/\s+/g, '');
  const codes = [];
  for (let i = 0; i + 3 < clean.length; i += 4) codes.push(parseInt(clean.slice(i, i + 4), 16));
  return codes;
}

// Deteta "1 0 0 -1 0 <H> cm" logo no início do content stream — idioma comum
// em geradores (ex: TOConline) que desenham já em coordenadas Y-para-baixo,
// ao contrário da convenção PDF nativa (Y cresce para cima). Sem compensar
// isto, a reconstrução de linhas por Y (mais abaixo) ficava invertida.
function _detectYFlip(content) {
  return /1\s+0\s+0\s+-1(?:\.0+)?\s+[\d.-]+\s+[\d.-]+\s+cm/.test(content);
}

// Nome da fonte ativa num bloco BT (ex: "/F0 8 Tf" → "F0") — usado para saber
// a que CMap cada trecho de texto pertence quando há mais do que um no PDF.
function _extractFontKey(block) {
  const m = block.match(/\/(F\d+)\s+[\d.]+\s+Tf/);
  return m ? m[1] : '__default__';
}

// Primeira passagem: recolhe cada bloco BT/ET (posição + fonte ativa + os
// códigos de glifo de cada Tj, ainda por decodificar) sem decidir já qual
// CMap usar — essa decisão só é fiável depois de agregar TODOS os códigos
// vistos por fonte (ver extractPdfTextNative).
function _extractRawBlocks(content, yFlip) {
  const blocks = [];
  const btRe = /BT([\s\S]*?)ET/g;
  let m;
  while ((m = btRe.exec(content)) !== null) {
    const block = m[1];
    let x = 0, y = 0;
    const td = block.match(/([\d.-]+)\s+([\d.-]+)\s+Td/);
    if (td) {
      x = parseFloat(td[1]); y = parseFloat(td[2]);
    } else {
      // Sem Td, a posição vem dos dois últimos números de "a b c d e f Tm"
      // (e=x, f=y) — usado por geradores que posicionam texto diretamente
      // via matriz em vez de translação relativa.
      const tm = block.match(/[\d.-]+\s+[\d.-]+\s+[\d.-]+\s+[\d.-]+\s+([\d.-]+)\s+([\d.-]+)\s+Tm/);
      if (tm) { x = parseFloat(tm[1]); y = parseFloat(tm[2]); }
    }
    if (yFlip) y = -y;
    const fontKey = _extractFontKey(block);
    const codesList = [];
    const tjRe = /\(((?:[^()\\]|\\.)*)\)\s*Tj|<([0-9A-Fa-f\s]*)>\s*Tj/g;
    let tj;
    while ((tj = tjRe.exec(block)) !== null) {
      codesList.push(tj[1] !== undefined ? _codesFromPdfString(tj[1]) : _codesFromHex(tj[2]));
    }
    if (codesList.length) blocks.push({ x, y, fontKey, codesList });
  }
  return blocks;
}

/** Extrai texto de um PDF usando apenas Node.js nativo (zlib + regex).
 *  Não depende de pdfjs-dist nem de DOMMatrix — funciona no Vercel. */
export function extractPdfTextNative(buffer) {
  const raw = buffer.toString('latin1');
  const cmaps = _buildCMapsFromPdf(_inflateAllStreamsForScan(raw));
  if (cmaps.length === 0) return '';

  const allBlocks = [];
  const streamRe = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let m;
  while ((m = streamRe.exec(raw)) !== null) {
    let content = m[1];
    if (!content.includes('BT')) {
      try { content = inflateSync(Buffer.from(content, 'latin1')).toString('latin1'); } catch {
        try { content = inflateSync(Buffer.from(content, 'latin1').slice(2)).toString('latin1'); } catch { continue; }
      }
    }
    if (content.includes('BT')) allBlocks.push(..._extractRawBlocks(content, _detectYFlip(content)));
  }
  if (allBlocks.length === 0) return '';

  // Segunda passagem: com só 1 CMap no PDF não há ambiguidade nenhuma. Com
  // mais do que 1, calibra qual pertence a cada nome de fonte (/F0, /F1...)
  // agregando TODOS os códigos vistos com essa fonte no documento inteiro —
  // muito mais fiável do que decidir por cada Tj isolado (uma data ou um
  // valor tem poucos códigos para desempatar com confiança; o texto todo
  // de uma fonte já não deixa dúvidas sobre qual CMap é o dela).
  let cmapPorFonte = null;
  if (cmaps.length > 1) {
    const codigosPorFonte = new Map();
    for (const b of allBlocks) {
      const acc = codigosPorFonte.get(b.fontKey) || [];
      for (const codes of b.codesList) acc.push(...codes);
      codigosPorFonte.set(b.fontKey, acc);
    }
    cmapPorFonte = new Map();
    for (const [fontKey, codigos] of codigosPorFonte) {
      let best = cmaps[0], bestScore = -1;
      for (const map of cmaps) {
        let score = 0;
        for (const c of codigos) if (map.has(c)) score++;
        if (score > bestScore) { bestScore = score; best = map; }
      }
      cmapPorFonte.set(fontKey, best);
    }
  }

  const allItems = [];
  for (const b of allBlocks) {
    const cmap = cmaps.length === 1 ? cmaps[0] : cmapPorFonte.get(b.fontKey);
    const text = b.codesList.map(codes => codes.map(c => cmap.get(c) || '').join('')).join('').trim();
    if (text) allItems.push({ x: b.x, y: b.y, text });
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

  // Fallback: pdf-parse via pdfjs-dist (requer DOMMatrix — pode falhar no Vercel).
  // API de classes desde a v2 (breaking change face à v1, que exportava uma
  // função só): const { PDFParse } = require('pdf-parse'); new PDFParse({data}).
  // getText() já devolve o texto em ordem de leitura — não precisa do
  // agrupamento manual por linha/coluna (pagerender) que a v1 exigia.
  if (typeof globalThis.DOMMatrix === 'undefined') {
    globalThis.DOMMatrix = _buildDomMatrixPolyfill();
  }
  const { PDFParse } = _require('pdf-parse');
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
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

const XLSX_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // .xls (raro, mas alguns clientes de email etiquetam .xlsx assim)
];

/** Encontra partes com anexo PDF OU .xlsx num payload Gmail (recursivo) —
 *  usado pelo modo 'contador', cujos emails vêm ora com relatório em PDF,
 *  ora em Excel (ex: "Mapa de conferência e-Fatura" exportado do TOConline).
 *  Devolve cada parte com um campo extra `kind`: 'pdf' | 'xlsx'. */
export function findContadorAttachmentParts(parts = []) {
  const found = [];
  for (const part of parts) {
    const looksLikePdf = part.mimeType === 'application/pdf'
      || part.filename?.toLowerCase().endsWith('.pdf');
    const looksLikeXlsx = XLSX_MIME_TYPES.includes(part.mimeType)
      || part.filename?.toLowerCase().endsWith('.xlsx');
    if ((looksLikePdf || looksLikeXlsx) && part.body?.attachmentId) {
      found.push({ ...part, kind: looksLikeXlsx ? 'xlsx' : 'pdf' });
    }
    if (part.parts) found.push(...findContadorAttachmentParts(part.parts));
  }
  return found;
}
