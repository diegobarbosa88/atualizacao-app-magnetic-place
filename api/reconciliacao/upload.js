import formidable from 'formidable';
import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { parse as parseOFX } from 'ofx-js';
import { createClient } from '@supabase/supabase-js';
import { runMatchingEngine } from './matchingEngine.js';

export const config = { api: { bodyParser: false } };

// Normaliza datas DD-MM-YYYY, DD/MM/YYYY ou YYYYMMDD para YYYY-MM-DD
function normalizeDate(dateStr) {
  if (!dateStr) return null;
  const s = String(dateStr).trim();
  // OFX format YYYYMMDD (primeiros 8 dígitos)
  if (/^\d{8}/.test(s)) {
    const d = s.slice(0, 8);
    return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
  }
  // Formato português DD-MM-YYYY ou DD/MM/YYYY
  const match = s.match(/^(\d{2})[-\/](\d{2})[-\/](\d{4})$/);
  if (match) return `${match[3]}-${match[2]}-${match[1]}`;
  return s;
}

// Normaliza string para comparação: minúsculas + sem diacríticos
function normStr(s) {
  return String(s).toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Detecta coluna CSV por nome — devolve o nome real da coluna no CSV
function detectColumn(headers, candidates) {
  for (const c of candidates) {
    const nc = normStr(c);
    const found = headers.find(h => normStr(h) === nc);
    if (found) return found;
  }
  return undefined;
}

// Limpa valores com fórmulas Excel (=ASC(...), =...) e aspas Excel
function cleanCsvValue(v) {
  if (typeof v !== 'string') return v;
  // Remove fórmulas Excel: =ASC("valor") → valor, ="valor" → valor, =valor → valor
  const formulaMatch = v.match(/^=(?:ASC\(")?(.*?)(?:"\))?$/);
  if (formulaMatch) return formulaMatch[1];
  return v;
}

// Detecta delimitador: usa ';' se o header tiver mais ';' do que ','
function detectDelimiter(firstLine) {
  const semicolons = (firstLine.match(/;/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  return semicolons > commas ? ';' : ',';
}

function parseCsv(content) {
  // Normaliza BOM e line endings
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

  // Reconstruir rows com chaves e valores limpos (resolve =ASC("...") em cabeçalhos e valores)
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

  // Colunas mínimas obrigatórias: data + valor (ou débito/crédito)
  if (!dataCol || (!valorCol && !debitoCol && !creditoCol)) {
    const err = new Error('UNRECOGNIZED_COLUMNS');
    err.detected = headers;
    throw err;
  }

  return rows.map(row => {
    let valor, tipo;
    if (valorCol) {
      const raw = parseFloat(String(row[valorCol]).replace(',', '.').replace(/\s/g, ''));
      valor = Math.abs(raw);
      if (tipoCol) {
        const t = String(row[tipoCol] || '').trim().toLowerCase();
        tipo = (t === 'c' || t.startsWith('cr')) ? 'credito' : 'debito';
      } else {
        tipo = raw >= 0 ? 'credito' : 'debito';
      }
    } else {
      const debito = parseFloat(String(row[debitoCol] || '0').replace(',', '.').replace(/\s/g, '')) || 0;
      const credito = parseFloat(String(row[creditoCol] || '0').replace(',', '.').replace(/\s/g, '')) || 0;
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

async function parseOfxContent(content) {
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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const form = formidable({ maxFileSize: 10 * 1024 * 1024 }); // 10 MB
    const [, files] = await form.parse(req);
    const file = Array.isArray(files.file) ? files.file[0] : files.file;

    if (!file) return res.status(400).json({ error: 'Nenhum ficheiro recebido.' });

    const filename = file.originalFilename || file.newFilename || '';
    const ext = filename.split('.').pop().toLowerCase();

    // Rejeitar PDFs explicitamente — Ficheiros PDF não são processados.
    if (ext === 'pdf' || file.mimetype === 'application/pdf') {
      return res.status(400).json({
        error: 'Formato não suportado. Apenas CSV e OFX são aceites. Ficheiros PDF não são processados.',
      });
    }

    if (!['csv', 'ofx', 'qfx'].includes(ext)) {
      return res.status(400).json({
        error: `Extensão .${ext} não suportada. Formatos aceites: .csv, .ofx, .qfx`,
      });
    }

    // Detectar encoding: tentar UTF-8, cair em latin1 se houver chars de substituição
    const rawBuf = fs.readFileSync(file.filepath);
    const utfStr = rawBuf.toString('utf-8');
    const content = utfStr.includes('�') ? rawBuf.toString('latin1') : utfStr;
    let transacoes;

    try {
      transacoes = ext === 'csv'
        ? parseCsv(content)
        : await parseOfxContent(content);
    } catch (parseErr) {
      if (parseErr.message === 'UNRECOGNIZED_COLUMNS') {
        return res.status(400).json({
          error: 'Colunas do CSV não reconhecidas. Esperado: Data, Valor (ou Débito/Crédito), Descrição.',
          detected: parseErr.detected,
        });
      }
      throw parseErr;
    }

    // Buscar faturas pendentes do Supabase
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Buscar todas as faturas excepto as já confirmadas (PAGO)
    // Inclui PENDENTE, NULL e qualquer outro status não-PAGO
    const { data: faturas, error: fatError } = await supabase
      .from('faturas')
      .select('id, tipo, valor, data_documento, descricao, entidade, status, fonte, dados, filename')
      .not('status', 'eq', 'PAGO');

    if (fatError) throw new Error(`Supabase query failed: ${fatError.message}`);

    // Normalizar valor de uma fatura para number
    // Supabase NUMERIC → string EN "1500.00"; Gemini → PT "1.500,00" ou "1500,00"
    const parseValorFatura = (v) => {
      if (v == null) return null;
      if (typeof v === 'number') return isNaN(v) ? null : v;
      const s = String(v).trim().replace(/\s/g, '');
      // Só aplicar lógica PT (remover ponto milhar) quando há vírgula decimal
      const normalized = s.includes(',')
        ? s.replace(/\./g, '').replace(',', '.')  // "1.500,00" → "1500.00"
        : s;                                       // "1500.00" → "1500.00" (Supabase)
      const r = parseFloat(normalized);
      return isNaN(r) ? null : r;
    };

    // Normalizar: faturas Gmail guardam valor em dados.valor_total (JSONB)
    const faturasNorm = (faturas || []).map(f => ({
      ...f,
      valor: parseValorFatura(f.valor) ?? parseValorFatura(f.dados?.valor_total) ?? null,
      entidade: f.entidade || f.dados?.fornecedor || '',
      descricao: f.descricao || f.dados?.numero_fatura || f.dados?.fornecedor || f.filename || '',
      data_documento: f.data_documento || f.dados?.data_fatura || null,
      fonte: f.fonte || 'fatura',
    }));
    // Inclui faturas sem valor — aparecem em Órfãos Sistema mesmo sem matching possível

    // Buscar recibos validados (tabela receipt_validations)
    const { data: recibos, error: recError } = await supabase
      .from('receipt_validations')
      .select('id, worker_name, liquido_extraido, mes, estado')
      .eq('estado', 'valido');

    if (recError) throw new Error(`Supabase query (recibos) failed: ${recError.message}`);

    const recibosNorm = (recibos || []).map(r => ({
      id: r.id,
      tipo: 'recibo',
      valor: r.liquido_extraido ?? null,
      entidade: r.worker_name || '',
      descricao: `Recibo ${r.worker_name || ''} ${r.mes || ''}`.trim(),
      data_documento: null,
      fonte: 'recibo',
      status: 'PENDENTE',
    })).filter(r => r.valor != null && r.valor > 0);

    const { matched, orphan_bank, orphan_system } = runMatchingEngine(
      transacoes,
      [...faturasNorm, ...recibosNorm]
    );

    // Gravar run em reconciliation_runs
    const { data: run, error: runError } = await supabase
      .from('reconciliation_runs')
      .insert({
        filename,
        transaction_count: transacoes.length,
        matched_count: matched.length,
        orphan_bank_count: orphan_bank.length,
        orphan_system_count: orphan_system.length,
        transactions_json: transacoes,
        results_json: { matched, orphan_bank, orphan_system },
      })
      .select('id')
      .single();

    if (runError) throw new Error(`Failed to save run: ${runError.message}`);

    return res.status(200).json({
      ok: true,
      run_id: run.id,
      filename,
      transaction_count: transacoes.length,
      matched_count: matched.length,
      orphan_bank_count: orphan_bank.length,
      orphan_system_count: orphan_system.length,
      matched,
      orphan_bank,
      orphan_system,
      _debug: {
        faturas_fetched: faturasNorm.length,
        recibos_fetched: recibosNorm.length,
        faturas_sample: faturasNorm.slice(0, 3).map(f => ({ id: f.id, valor: f.valor, status: f.status, fonte: f.fonte, dados_valor_total: f.dados?.valor_total })),
      },
    });

  } catch (err) {
    console.error('[reconciliacao/upload]', err);
    return res.status(500).json({ error: err.message || 'Erro interno no servidor.' });
  }
}
