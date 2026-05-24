import { parse } from 'csv-parse/sync';
import { parse as parseOFX } from 'ofx-js';

const MONTH_NAMES = {
  jan: '01', fev: '02', feb: '02', mar: '03', abr: '04', apr: '04',
  mai: '05', may: '05', jun: '06', jul: '07', ago: '08', aug: '08',
  set: '09', sep: '09', oct: '10', out: '10', nov: '11', dez: '12', dec: '12',
  janeiro: '01', fevereiro: '02', marco: '03', abril: '04', maio: '05',
  junho: '06', julho: '07', agosto: '08', setembro: '09', outubro: '10',
  novembro: '11', dezembro: '12',
  january: '01', february: '02', march: '03', april: '04',
  june: '06', july: '07', august: '08', september: '09',
  october: '10', november: '11', december: '12',
};

export function normalizeDate(dateStr) {
  if (!dateStr) return null;
  const s = String(dateStr).trim();
  // ISO com ou sem hora: 2024-01-15 | 2024-01-15T00:00:00 | 2024-01-15 00:00:00
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  // 8 dígitos compactos: 20240115
  if (/^\d{8}$/.test(s)) {
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  }
  // YYYY/MM/DD | YYYY.MM.DD (ano primeiro, separador não-hífen)
  const matchYMD = s.match(/^(\d{4})[\/\.](\d{1,2})[\/\.](\d{1,2})/);
  if (matchYMD) return `${matchYMD[1]}-${matchYMD[2].padStart(2,'0')}-${matchYMD[3].padStart(2,'0')}`;
  // DD/MM/YYYY | DD-MM-YYYY | DD.MM.YYYY | D/M/YYYY (com ou sem hora no final)
  const matchDMY = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
  if (matchDMY) return `${matchDMY[3]}-${matchDMY[2].padStart(2,'0')}-${matchDMY[1].padStart(2,'0')}`;
  // DD-MON-YYYY | DD/MON/YYYY | DD MON YYYY (nomes de mês PT/EN: "15-Abr-2026", "15 Apr 2026")
  const matchTextMonth = s.match(/^(\d{1,2})[\s\/\-]([a-záéíóúâêãõü]+)[\s\/\-](\d{4})/i);
  if (matchTextMonth) {
    const key = matchTextMonth[2].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const mm = MONTH_NAMES[key];
    if (mm) return `${matchTextMonth[3]}-${mm}-${matchTextMonth[1].padStart(2, '0')}`;
  }
  return null;
}

export function normStr(s) {
  return String(s).toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function detectColumn(headers, candidates) {
  for (const c of candidates) {
    const nc = normStr(c);
    const found = headers.find(h => normStr(h) === nc);
    if (found) return found;
  }
  return undefined;
}

export function cleanCsvValue(v) {
  if (typeof v !== 'string') return v;
  const formulaMatch = v.match(/^=(?:ASC\(")?(.*?)(?:"\))?$/);
  if (formulaMatch) return formulaMatch[1];
  return v;
}

export function detectDelimiter(firstLine) {
  const semicolons = (firstLine.match(/;/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  return semicolons > commas ? ';' : ',';
}

export function normalizeValorCsv(v) {
  const s = String(v).trim().replace(/\s/g, '');
  return s.includes(',')
    ? s.replace(/\./g, '').replace(',', '.')
    : s;
}

export function parseCsv(content) {
  const cleaned = content.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const firstLine = cleaned.split('\n')[0];
  const delimiter = detectDelimiter(firstLine);

  const records = parse(cleaned, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    delimiter,
    relax_quotes: true,
    relax_column_count: true,
  });
  if (!records.length) return [];

  const rows = records.map(row =>
    Object.fromEntries(Object.entries(row).map(([k, v]) => [cleanCsvValue(k), cleanCsvValue(v)]))
  );

  const headers = Object.keys(rows[0]);
  const dataCol = detectColumn(headers, ['data', 'datavalor', 'data valor', 'data operacao', 'data operação', 'date']);
  const valorCol = detectColumn(headers, ['valor', 'value', 'montante', 'amount']);
  const descricaoCol = detectColumn(headers, ['descrição movimento', 'descricao movimento', 'descrição', 'descricao', 'description', 'movimento', 'memo']);
  const debitoCol = detectColumn(headers, ['débito', 'debito', 'debit']);
  const creditoCol = detectColumn(headers, ['crédito', 'credito', 'credit']);
  const tipoCol = detectColumn(headers, ['tipo movimento', 'tipo', 'type']);
  const nibCol = detectColumn(headers, ['nib', 'iban', 'nib ordenante', 'iban ordenante', 'nib do ordenante', 'conta origem', 'conta_origem', 'nib origem']);

  if (!dataCol || (!valorCol && !debitoCol && !creditoCol)) {
    const err = new Error('UNRECOGNIZED_COLUMNS');
    err.detected = headers;
    throw err;
  }

  return rows.map(row => {
    let valor, tipo;
    if (valorCol) {
      const raw = parseFloat(normalizeValorCsv(row[valorCol]));
      valor = Math.abs(raw);
      if (tipoCol) {
        const t = normStr(String(row[tipoCol] || ''));
        if (t === 'c' || t === 'e' || t.startsWith('cr') || t.startsWith('entr')) {
          tipo = 'credito';
        } else if (t === 'd' || t === 's' || t.startsWith('deb') || t.startsWith('said')) {
          tipo = 'debito';
        } else {
          tipo = raw >= 0 ? 'credito' : 'debito';
        }
      } else {
        tipo = raw >= 0 ? 'credito' : 'debito';
      }
    } else {
      const debito = parseFloat(normalizeValorCsv(row[debitoCol] || '0')) || 0;
      const credito = parseFloat(normalizeValorCsv(row[creditoCol] || '0')) || 0;
      if (credito > 0) { valor = credito; tipo = 'credito'; }
      else { valor = debito; tipo = 'debito'; }
    }
    return {
      data: normalizeDate(row[dataCol]),
      descricao: String(row[descricaoCol] || '').trim(),
      tipoMovimento: tipoCol ? String(row[tipoCol] || '').trim() : null,
      nib: nibCol ? String(row[nibCol] || '').trim() || null : null,
      valor,
      tipo,
    };
  }).filter(t => t.valor > 0);
}

// Devolve colunas detectadas + prévia das primeiras linhas (para UI de mapeamento)
export function parseCsvColumns(content) {
  const cleaned = content.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const firstLine = cleaned.split('\n')[0];
  const delimiter = detectDelimiter(firstLine);
  const records = parse(cleaned, {
    columns: true, skip_empty_lines: true, trim: true, delimiter,
    relax_quotes: true, relax_column_count: true,
  });
  if (!records.length) return { columns: [], preview: [] };
  const rows = records.map(row =>
    Object.fromEntries(Object.entries(row).map(([k, v]) => [cleanCsvValue(k), cleanCsvValue(v)]))
  );
  return { columns: Object.keys(rows[0]), preview: rows.slice(0, 10) };
}

// Processa CSV com mapeamento explícito de colunas fornecido pelo utilizador
export function parseCsvWithMapping(content, mapping) {
  const { dataCol, valorCol, descricaoCol, debitoCol, creditoCol, tipoCol, nibCol } = mapping;
  const cleaned = content.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const firstLine = cleaned.split('\n')[0];
  const delimiter = detectDelimiter(firstLine);
  const records = parse(cleaned, {
    columns: true, skip_empty_lines: true, trim: true, delimiter,
    relax_quotes: true, relax_column_count: true,
  });
  if (!records.length) return [];
  const rows = records.map(row =>
    Object.fromEntries(Object.entries(row).map(([k, v]) => [cleanCsvValue(k), cleanCsvValue(v)]))
  );
  return rows.map(row => {
    let valor, tipo;
    if (valorCol) {
      const raw = parseFloat(normalizeValorCsv(row[valorCol] || '0'));
      valor = Math.abs(raw);
      if (tipoCol) {
        const t = normStr(String(row[tipoCol] || ''));
        if (t === 'c' || t === 'e' || t.startsWith('cr') || t.startsWith('entr')) tipo = 'credito';
        else if (t === 'd' || t === 's' || t.startsWith('deb') || t.startsWith('said')) tipo = 'debito';
        else tipo = raw >= 0 ? 'credito' : 'debito';
      } else {
        tipo = raw >= 0 ? 'credito' : 'debito';
      }
    } else {
      const debito = parseFloat(normalizeValorCsv(row[debitoCol] || '0')) || 0;
      const credito = parseFloat(normalizeValorCsv(row[creditoCol] || '0')) || 0;
      if (credito > 0) { valor = credito; tipo = 'credito'; }
      else { valor = debito; tipo = 'debito'; }
    }
    return {
      data: normalizeDate(row[dataCol]),
      descricao: String(row[descricaoCol] || '').trim(),
      tipoMovimento: tipoCol ? String(row[tipoCol] || '').trim() : null,
      nib: nibCol ? String(row[nibCol] || '').trim() || null : null,
      valor,
      tipo,
    };
  }).filter(t => t.valor > 0);
}

export async function parseOfxContent(content) {
  const parsed = await parseOFX(content);
  const stmtTrn = parsed?.OFX?.BANKMSGSRSV1?.STMTTRNRS?.STMTRS?.BANKTRANLIST?.STMTTRN;
  if (!stmtTrn) return [];
  const list = Array.isArray(stmtTrn) ? stmtTrn : [stmtTrn];
  return list.map(t => {
    const raw = parseFloat(t.TRNAMT);
    return {
      data: normalizeDate(String(t.DTPOSTED || '').slice(0, 8)),
      descricao: String(t.NAME || t.MEMO || '').trim(),
      valor: Math.abs(raw),
      tipo: raw >= 0 ? 'credito' : 'debito',
    };
  }).filter(t => t.valor > 0);
}
