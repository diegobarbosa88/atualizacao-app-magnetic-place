import { parse } from 'csv-parse/sync';
import { parse as parseOFX } from 'ofx-js';

export function normalizeDate(dateStr) {
  if (!dateStr) return null;
  const s = String(dateStr).trim();
  if (/^\d{8}/.test(s)) {
    const d = s.slice(0, 8);
    return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
  }
  const match = s.match(/^(\d{2})[-\/](\d{2})[-\/](\d{4})$/);
  if (match) return `${match[3]}-${match[2]}-${match[1]}`;
  return s;
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
  return { columns: Object.keys(rows[0]), preview: rows.slice(0, 3) };
}

// Processa CSV com mapeamento explícito de colunas fornecido pelo utilizador
export function parseCsvWithMapping(content, mapping) {
  const { dataCol, valorCol, descricaoCol, debitoCol, creditoCol, tipoCol } = mapping;
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
