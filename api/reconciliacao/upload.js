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

// Detecta coluna CSV por nome — devolve o nome real da coluna no CSV
function detectColumn(headers, candidates) {
  for (const c of candidates) {
    const found = headers.find(h => h.toLowerCase().trim() === c.toLowerCase());
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

  // Limpar fórmulas Excel de todos os valores
  const cleanedRecords = records.map(row =>
    Object.fromEntries(Object.entries(row).map(([k, v]) => [k, cleanCsvValue(v)]))
  );

  const headers = Object.keys(cleanedRecords[0]).map(h => cleanCsvValue(h));
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

  return cleanedRecords.map(row => {
    let valor, tipo;
    if (valorCol) {
      const raw = parseFloat(String(row[valorCol]).replace(',', '.').replace(/\s/g, ''));
      valor = Math.abs(raw);
      // Se tipoCol presente (ex: 'C'/'Crédito' = crédito, 'D'/'Débito' = débito)
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

    const content = fs.readFileSync(file.filepath, 'utf-8');
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

    const { data: faturas, error: fatError } = await supabase
      .from('faturas')
      .select('id, tipo, valor, data_documento, descricao, entidade, status, fonte, dados')
      .eq('status', 'PENDENTE');

    if (fatError) throw new Error(`Supabase query failed: ${fatError.message}`);

    // Normalizar: faturas Gmail guardam valor em dados.valor_total
    const faturasNorm = (faturas || []).map(f => ({
      ...f,
      valor: f.valor ?? f.dados?.valor_total ?? null,
      entidade: f.entidade || f.dados?.fornecedor || '',
      descricao: f.descricao || f.dados?.numero_fatura || f.filename || '',
      data_documento: f.data_documento || f.dados?.data_fatura || null,
      fonte: f.fonte || 'fatura',
    })).filter(f => f.valor != null);

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
    });

  } catch (err) {
    console.error('[reconciliacao/upload]', err);
    return res.status(500).json({ error: err.message || 'Erro interno no servidor.' });
  }
}
