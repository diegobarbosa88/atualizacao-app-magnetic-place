import formidable from 'formidable';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import { runMatchingEngine } from './_matchingEngine.js';
import { parseCsv, parseCsvColumns, parseCsvWithMapping, parseOfxContent } from './_parseUtils.js';
import { getValidToken } from '../toconline/_token.js';
import { fetchAllPages, tocFetch } from '../toconline/_fetch.js';

// Router único para os 3 endpoints de reconciliação bancária — consolidados
// num só ficheiro para não exceder o limite de Serverless Functions do plano
// Hobby da Vercel (12). Dispatch feito por ?tipo=, mapeado via rewrites em
// vercel.json para preservar os caminhos originais (/api/reconciliacao/parse,
// /api/reconciliacao/process, /api/reconciliacao/upload) sem alterar nada no
// frontend. bodyParser tem de ficar desligado para o ficheiro inteiro (parse/
// upload recebem multipart/form-data via formidable); tipo=process lê e
// faz parse do corpo JSON manualmente em readJsonBody().
export const config = { api: { bodyParser: false } };

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf-8');
  return raw ? JSON.parse(raw) : {};
}

// ---------------------------------------------------------------------------
// tipo=parse — extrai transações de um ficheiro (preview, sem gravar em DB)
// ---------------------------------------------------------------------------

async function parsePdfWithGemini(rawBuf) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY não configurado.');

  const prompt = `Analisa este extrato bancário em PDF e extrai TODAS as transações/movimentos.
Devolve um array JSON com cada movimento no formato exacto:
[
  { "data": "YYYY-MM-DD", "descricao": "descrição do movimento", "valor": 1234.56, "tipo": "debito" },
  ...
]
Regras:
- data: sempre YYYY-MM-DD. Converte DD/MM/YYYY ou DD-MM-YYYY → YYYY-MM-DD.
- valor: número decimal positivo. NUNCA negativo.
- tipo: "debito" para pagamentos/saídas, "credito" para depósitos/entradas.
- Inclui TODOS os movimentos visíveis, sem excepções.
- Responde APENAS com o array JSON válido, sem markdown, sem bloco de código.`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: 'application/pdf', data: rawBuf.toString('base64') } }] }],
        generationConfig: { temperature: 0 },
      }),
    }
  );

  if (!response.ok) throw new Error(`Gemini PDF error: ${await response.text()}`);

  const data = await response.json();
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const jsonStr = raw.replace(/```json|```/g, '').trim();
  let parsed;
  try { parsed = JSON.parse(jsonStr); } catch { throw new Error('Gemini não devolveu JSON válido.'); }
  if (!Array.isArray(parsed)) throw new Error('Resposta do Gemini não é um array.');

  return parsed
    .map(t => ({
      data: t.data || null,
      descricao: String(t.descricao || '').trim(),
      valor: Math.abs(parseFloat(t.valor) || 0),
      tipo: String(t.tipo || '').toLowerCase() === 'credito' ? 'credito' : 'debito',
      tipoMovimento: null,
    }))
    .filter(t => t.valor > 0);
}

async function handleParse(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const form = formidable({ maxFileSize: 20 * 1024 * 1024 });
    const [fields, files] = await form.parse(req);
    const file = Array.isArray(files.file) ? files.file[0] : files.file;

    if (!file) return res.status(400).json({ error: 'Nenhum ficheiro recebido.' });

    const filename = file.originalFilename || file.newFilename || '';
    const ext = filename.split('.').pop().toLowerCase();
    const isPdf = ext === 'pdf' || file.mimetype === 'application/pdf';

    if (!['csv', 'ofx', 'qfx', 'pdf'].includes(ext)) {
      return res.status(400).json({ error: `Extensão .${ext} não suportada. Formatos aceites: .csv, .ofx, .qfx, .pdf` });
    }

    const rawBuf = fs.readFileSync(file.filepath);

    if (isPdf) {
      const transactions = await parsePdfWithGemini(rawBuf);
      return res.status(200).json({ filename, transactions });
    }

    const utfStr = rawBuf.toString('utf-8');
    const content = utfStr.includes('�') ? rawBuf.toString('latin1') : utfStr;

    // Se veio mapeamento explícito de colunas, usar directamente
    const mappingRaw = Array.isArray(fields.column_mapping) ? fields.column_mapping[0] : fields.column_mapping;
    if (mappingRaw) {
      const mapping = JSON.parse(mappingRaw);
      const transactions = parseCsvWithMapping(content, mapping);
      return res.status(200).json({ filename, transactions });
    }

    // Tentar auto-detecção
    try {
      const transactions = ext === 'csv' ? parseCsv(content) : await parseOfxContent(content);
      return res.status(200).json({ filename, transactions });
    } catch (parseErr) {
      if (parseErr.message === 'UNRECOGNIZED_COLUMNS') {
        // Devolver colunas para o utilizador mapear no frontend
        const { columns, preview } = parseCsvColumns(content);
        return res.status(200).json({ filename, needs_mapping: true, columns, preview });
      }
      throw parseErr;
    }
  } catch (err) {
    console.error('[reconciliacao/parse]', err);
    return res.status(500).json({ error: err.message || 'Erro interno no servidor.' });
  }
}

// ---------------------------------------------------------------------------
// tipo=upload — extrai transações de um ficheiro E já corre o matching + grava run
// ---------------------------------------------------------------------------

async function handleUpload(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Normaliza datas DD-MM-YYYY, DD/MM/YYYY ou YYYYMMDD para YYYY-MM-DD
  function normalizeDate(dateStr) {
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

  // Normaliza string para comparação: minúsculas + sem diacríticos
  function normStr(s) {
    return String(s).toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  function detectColumn(headers, candidates) {
    for (const c of candidates) {
      const nc = normStr(c);
      const found = headers.find(h => normStr(h) === nc);
      if (found) return found;
    }
    return undefined;
  }

  function cleanCsvValue(v) {
    if (typeof v !== 'string') return v;
    const formulaMatch = v.match(/^=(?:ASC\(")?(.*?)(?:"\))?$/);
    if (formulaMatch) return formulaMatch[1];
    return v;
  }

  function detectDelimiter(firstLine) {
    const semicolons = (firstLine.match(/;/g) || []).length;
    const commas = (firstLine.match(/,/g) || []).length;
    return semicolons > commas ? ';' : ',';
  }

  function normalizeValorCsv(v) {
    const s = String(v).trim().replace(/\s/g, '');
    return s.includes(',')
      ? s.replace(/\./g, '').replace(',', '.')
      : s;
  }

  async function parseCsvUpload(content) {
    const { parse } = await import('csv-parse/sync');
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

  async function parseOfxContentUpload(content) {
    const { parse: parseOFX } = await import('ofx-js');
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

  try {
    const form = formidable({ maxFileSize: 10 * 1024 * 1024 }); // 10 MB
    const [, files] = await form.parse(req);
    const file = Array.isArray(files.file) ? files.file[0] : files.file;

    if (!file) return res.status(400).json({ error: 'Nenhum ficheiro recebido.' });

    const filename = file.originalFilename || file.newFilename || '';
    const ext = filename.split('.').pop().toLowerCase();

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

    const rawBuf = fs.readFileSync(file.filepath);
    const utfStr = rawBuf.toString('utf-8');
    const content = utfStr.includes('�') ? rawBuf.toString('latin1') : utfStr;
    let transacoes;

    try {
      transacoes = ext === 'csv'
        ? await parseCsvUpload(content)
        : await parseOfxContentUpload(content);
    } catch (parseErr) {
      if (parseErr.message === 'UNRECOGNIZED_COLUMNS') {
        return res.status(400).json({
          error: 'Colunas do CSV não reconhecidas. Esperado: Data, Valor (ou Débito/Crédito), Descrição.',
          detected: parseErr.detected,
        });
      }
      throw parseErr;
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: faturas, error: fatError } = await supabase
      .from('faturas')
      .select('id, tipo, valor, data_documento, descricao, entidade, status, fonte, dados, filename')
      .not('status', 'eq', 'PAGO');

    if (fatError) throw new Error(`Supabase query failed: ${fatError.message}`);

    const parseValorFatura = (v) => {
      if (v == null) return null;
      if (typeof v === 'number') return isNaN(v) ? null : v;
      const s = String(v).trim().replace(/\s/g, '');
      const normalized = s.includes(',')
        ? s.replace(/\./g, '').replace(',', '.')
        : s;
      const r = parseFloat(normalized);
      return isNaN(r) ? null : r;
    };

    const faturasNorm = (faturas || []).map(f => {
      const v1 = parseValorFatura(f.valor);
      const v2 = parseValorFatura(f.dados?.valor_total);
      return {
      ...f,
      valor: (v1 != null && v1 > 0) ? v1 : (v2 != null && v2 > 0 ? v2 : null),
      entidade: f.entidade || f.dados?.fornecedor || '',
      descricao: f.descricao || f.dados?.numero_fatura || f.dados?.fornecedor || f.filename || '',
      data_documento: f.data_documento || f.dados?.data_fatura || null,
      fonte: f.fonte || 'fatura',
      };
    });

    const { data: recibos, error: recError } = await supabase
      .from('receipt_validations')
      .select('id, worker_name, liquido_extraido, mes, estado')
      .not('estado', 'eq', 'pago');

    if (recError) throw new Error(`Supabase query (recibos) failed: ${recError.message}`);

    const recibosNorm = (recibos || []).map(r => ({
      id: r.id,
      tipo: 'recibo',
      valor: parseValorFatura(r.liquido_extraido),
      entidade: r.worker_name || '',
      descricao: `Recibo ${r.worker_name || ''} ${r.mes || ''}`.trim(),
      data_documento: null,
      fonte: 'recibo',
      status: 'PENDENTE',
      estado_original: r.estado,
    })).filter(r => r.valor != null && r.valor > 0);

    const { matched, orphan_bank, orphan_system } = runMatchingEngine(
      transacoes,
      [...faturasNorm, ...recibosNorm]
    );

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
        recibos_raw_count: (recibos || []).length,
        faturas_sample: faturasNorm.slice(0, 3).map(f => ({ id: f.id, valor: f.valor, status: f.status, fonte: f.fonte, dados_valor_total: f.dados?.valor_total })),
        recibos_sample: (recibos || []).slice(0, 5).map(r => ({ id: r.id, worker_name: r.worker_name, liquido_extraido: r.liquido_extraido, estado: r.estado, valor_parsed: parseValorFatura(r.liquido_extraido) })),
      },
    });

  } catch (err) {
    console.error('[reconciliacao/upload]', err);
    return res.status(500).json({ error: err.message || 'Erro interno no servidor.' });
  }
}

// ---------------------------------------------------------------------------
// tipo=process — reprocessa/importa TOConline/grava um novo run (corpo JSON)
// ---------------------------------------------------------------------------

async function handleProcess(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  req.body = await readJsonBody(req);
  const { action } = req.query;

  const supabaseClient = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const parseValorFatura = (v) => {
    if (v == null) return null;
    if (typeof v === 'number') return isNaN(v) ? null : v;
    const s = String(v).trim().replace(/\s/g, '');
    const normalized = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s;
    const n = parseFloat(normalized);
    return isNaN(n) ? null : n;
  };

  const fetchFaturasERecibos = async (supabase) => {
    const { data: faturas, error: fatError } = await supabase
      .from('faturas')
      .select('id, tipo, valor, data_documento, descricao, entidade, status, fonte, dados, filename');
    if (fatError) throw new Error(`Erro ao buscar faturas: ${fatError.message}`);

    const faturasNorm = (faturas || []).map(f => {
      const v1 = parseValorFatura(f.valor);
      const v2 = parseValorFatura(f.dados?.valor_total);
      return {
        ...f,
        status_original: f.status,
        valor: (v1 != null && v1 > 0) ? v1 : (v2 != null && v2 > 0 ? v2 : null),
        entidade: f.entidade || f.dados?.fornecedor || '',
        descricao: f.descricao || f.dados?.numero_fatura || f.dados?.fornecedor || f.filename || '',
        data_documento: f.data_documento || f.dados?.data_fatura || null,
        fonte: f.fonte || 'fatura',
      };
    });

    const { data: recibos, error: recError } = await supabase
      .from('receipt_validations')
      .select('id, worker_name, liquido_extraido, mes, estado');
    if (recError) throw new Error(`Erro ao buscar recibos: ${recError.message}`);

    const recibosNorm = (recibos || []).map(r => ({
      id: r.id,
      tipo: 'recibo',
      valor: parseValorFatura(r.liquido_extraido),
      entidade: r.worker_name || '',
      descricao: `Recibo ${r.worker_name || ''} ${r.mes || ''}`.trim(),
      data_documento: null,
      fonte: 'recibo',
      status: r.estado === 'pago' ? 'PAGO' : 'PENDENTE',
      estado_original: r.estado,
    })).filter(r => r.valor != null && r.valor > 0);

    const { data: aliasRows } = await supabase
      .from('reconciliacao_entity_aliases')
      .select('bank_name, system_entity');

    return { faturasNorm, recibosNorm, aliasRows: aliasRows || [] };
  };

  if (action === 'reprocess') {
    const { runId } = req.body || {};
    if (!runId) return res.status(400).json({ error: 'runId obrigatório.' });

    const { data: run, error: runFetchErr } = await supabaseClient
      .from('reconciliation_runs')
      .select('id, filename, transactions_json')
      .eq('id', runId)
      .single();

    if (runFetchErr || !run) return res.status(404).json({ error: 'Run não encontrado.' });

    const transacoes = run.transactions_json;
    if (!Array.isArray(transacoes) || transacoes.length === 0) {
      return res.status(400).json({ error: 'Run não tem transações guardadas para reprocessar.' });
    }

    try {
      const { faturasNorm, recibosNorm, aliasRows } = await fetchFaturasERecibos(supabaseClient);
      const { matched, orphan_bank, orphan_system } = runMatchingEngine(
        transacoes,
        [...faturasNorm, ...recibosNorm],
        aliasRows
      );

      const { error: updateErr } = await supabaseClient
        .from('reconciliation_runs')
        .update({
          matched_count: matched.length,
          orphan_bank_count: orphan_bank.length,
          orphan_system_count: orphan_system.length,
          results_json: { matched, orphan_bank, orphan_system },
        })
        .eq('id', runId);

      if (updateErr) return res.status(500).json({ error: `Erro ao guardar resultados: ${updateErr.message}` });

      return res.status(200).json({
        ok: true,
        run_id: runId,
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
        },
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── Modo TOConline: busca movimentos directamente da API ─────────────────
  const { fonte, de, ate, transactions_json, filename } = req.body || {};

  if (fonte === 'toconline') {
    if (!de || !ate) {
      return res.status(400).json({ error: 'Parâmetros de e ate são obrigatórios (YYYY-MM).' });
    }
    const dateFrom = `${de}-01`;
    const [ateY, ateM] = ate.split('-').map(Number);
    const dateTo = new Date(ateY, ateM, 0).toISOString().split('T')[0];

    try {
      const accessToken = await getValidToken();
      const todasContas = await fetchAllPages('/api/bank_accounts', accessToken);
      const contasEmpresa = todasContas.filter(c => {
        const a = c.attributes || c;
        return a.entity_type === 'Company';
      });
      if (!contasEmpresa.length) {
        return res.status(400).json({ error: 'Nenhuma conta da empresa encontrada no TOConline.' });
      }

      const transacoes = [];
      for (const conta of contasEmpresa) {
        const a = conta.attributes || conta;
        const nomeConta = a.name || `Conta ${conta.id}`;
        const txRaw = [];
        let page = 1;
        outer: while (true) {
          const data = await tocFetch(
            `/api/bank_transactions?filter[bank_account_id]=${conta.id}&sort=-transaction_date&page[number]=${page}&page[size]=100`,
            accessToken
          );
          const items = Array.isArray(data) ? data : (data.data || []);
          if (!items.length) break;
          for (const item of items) {
            const attrs = item.attributes || item;
            const d = (attrs.transaction_date || attrs.posted_date || '').slice(0, 10);
            if (d && d < dateFrom) break outer;
            txRaw.push(item);
          }
          if (items.length < 100) break;
          page++;
        }
        for (const tx of txRaw) {
          const attrs = tx.attributes || tx;
          const txDate = (attrs.transaction_date || attrs.posted_date || '').slice(0, 10);
          if (!txDate || txDate < dateFrom || txDate > dateTo) continue;
          const valor = Number(attrs.value ?? 0);
          transacoes.push({
            data: txDate,
            descricao: attrs.description || attrs.annotation || '',
            valor: Math.abs(valor),
            tipo: valor >= 0 ? 'credito' : 'debito',
            conta: nomeConta,
            iban_origem: attrs.payer_iban || null,
          });
        }
      }

      if (!transacoes.length) {
        return res.status(400).json({ error: `Sem movimentos TOConline entre ${de} e ${ate}.` });
      }

      const { faturasNorm, recibosNorm, aliasRows } = await fetchFaturasERecibos(supabaseClient);
      const { matched, orphan_bank, orphan_system } = runMatchingEngine(
        transacoes,
        [...faturasNorm, ...recibosNorm],
        aliasRows
      );

      const tocFilename = `TOConline ${de} a ${ate}`;
      const { data: tocRun, error: tocRunErr } = await supabaseClient
        .from('reconciliation_runs')
        .insert({
          filename: tocFilename,
          transaction_count: transacoes.length,
          matched_count: matched.length,
          orphan_bank_count: orphan_bank.length,
          orphan_system_count: orphan_system.length,
          transactions_json: transacoes,
          results_json: { matched, orphan_bank, orphan_system },
        })
        .select('id')
        .single();

      if (tocRunErr) return res.status(500).json({ error: `Erro ao guardar run: ${tocRunErr.message}` });

      return res.status(200).json({
        ok: true,
        run_id: tocRun.id,
        filename: tocFilename,
        transaction_count: transacoes.length,
        matched_count: matched.length,
        orphan_bank_count: orphan_bank.length,
        orphan_system_count: orphan_system.length,
        matched,
        orphan_bank,
        orphan_system,
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (!Array.isArray(transactions_json) || transactions_json.length === 0) {
    return res.status(400).json({ error: 'transactions_json obrigatório e não pode estar vazio.' });
  }

  try {
    const { faturasNorm, recibosNorm, aliasRows } = await fetchFaturasERecibos(supabaseClient);
    const { matched, orphan_bank, orphan_system } = runMatchingEngine(
      transactions_json,
      [...faturasNorm, ...recibosNorm],
      aliasRows
    );

    const { data: run, error: runError } = await supabaseClient
      .from('reconciliation_runs')
      .insert({
        filename: filename || 'manual',
        transaction_count: transactions_json.length,
        matched_count: matched.length,
        orphan_bank_count: orphan_bank.length,
        orphan_system_count: orphan_system.length,
        transactions_json,
        results_json: { matched, orphan_bank, orphan_system },
      })
      .select('id')
      .single();

    if (runError) return res.status(500).json({ error: `Erro ao guardar run: ${runError.message}` });

    return res.status(200).json({
      ok: true,
      run_id: run.id,
      filename: filename || 'manual',
      transaction_count: transactions_json.length,
      matched_count: matched.length,
      orphan_bank_count: orphan_bank.length,
      orphan_system_count: orphan_system.length,
      matched,
      orphan_bank,
      orphan_system,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// ---------------------------------------------------------------------------

export default async function handler(req, res) {
  const { tipo } = req.query;
  if (tipo === 'parse') return handleParse(req, res);
  if (tipo === 'upload') return handleUpload(req, res);
  if (tipo === 'process') return handleProcess(req, res);
  return res.status(400).json({ error: `tipo desconhecido: ${tipo || '(não definido)'}` });
}
