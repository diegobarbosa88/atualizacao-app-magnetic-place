import formidable from 'formidable';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '../_authUtils.js';
import { runMatchingEngine, normalizeEntityName, detectInternalTransfers } from './_matchingEngine.js';
import { parseCsv, parseCsvColumns, parseCsvWithMapping, parseOfxContent } from './_parseUtils.js';
import { fetchFaturasERecibos } from './_dadosBase.js';
import { getValidToken } from '../toconline/_token.js';
import { tocFetch } from '../toconline/_fetch.js';

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

// tipo=upload removido — era código morto (zero chamadores no frontend), duplicava por completo handleParse+handleProcess. Ver git history se precisares de recuperar.

// ---------------------------------------------------------------------------
// tipo=process — reprocessa/importa TOConline/grava um novo run (corpo JSON)
// ---------------------------------------------------------------------------

// Corre a deteção de transferências internas + o motor de matching normal
// sobre uma lista de transações, e devolve os resultados já prontos para
// gravar num run — partilhado entre o caminho "criar run" (upload/TOConline/
// misto) e "reprocess". As transferências internas nunca chegam ao motor de
// faturas (são removidas antes) e entram em `matched` com uma regra própria,
// para nunca aparecerem em Órfãos Banco nem tentarem casar com uma fatura.
async function processarTransacoes(supabaseClient, transacoes) {
  const { data: settings } = await supabaseClient
    .from('system_settings')
    .select('company_name')
    .eq('id', 1)
    .maybeSingle();
  const companyNameNorm = normalizeEntityName(settings?.company_name || '');

  const { confirmadas, presumidas, ambiguas } = detectInternalTransfers(transacoes, companyNameNorm);

  const idxAmbiguas = new Set(ambiguas);
  const idxPresumidas = new Set(presumidas.filter(i => !idxAmbiguas.has(i)));
  const idxConfirmadas = new Set(confirmadas.flat());
  const idxRemover = new Set([...idxConfirmadas, ...idxPresumidas, ...idxAmbiguas]);

  const restantes = transacoes.filter((_, i) => !idxRemover.has(i));

  const { faturasNorm, recibosNorm, aliasRows } = await fetchFaturasERecibos(supabaseClient);
  const { matched, orphan_bank, orphan_system } = runMatchingEngine(
    restantes,
    [...faturasNorm, ...recibosNorm],
    aliasRows
  );

  const internalMatched = [];
  for (const [idxCredito, idxDebito] of confirmadas) {
    internalMatched.push({ transacao: transacoes[idxCredito], fatura: null, rule: 'internal_transfer_confirmed', pair_transacao: transacoes[idxDebito] });
    internalMatched.push({ transacao: transacoes[idxDebito], fatura: null, rule: 'internal_transfer_confirmed', pair_transacao: transacoes[idxCredito] });
  }

  // manuaisParaGravar guarda a transação original — o índice final dentro de
  // `matched` só se sabe depois de o array completo estar montado (ver abaixo)
  const manuaisParaGravar = [];
  for (const i of idxPresumidas) {
    internalMatched.push({ transacao: transacoes[i], fatura: null, rule: 'internal_transfer_presumed', ambiguous: false });
    manuaisParaGravar.push({ transacao: transacoes[i], ambiguous: false });
  }
  for (const i of idxAmbiguas) {
    internalMatched.push({ transacao: transacoes[i], fatura: null, rule: 'internal_transfer_presumed', ambiguous: true });
    manuaisParaGravar.push({ transacao: transacoes[i], ambiguous: true });
  }

  const matchedFinal = [...matched, ...internalMatched];

  // Agora que matchedFinal está fechado, resolve o índice de cada entrada
  // manual dentro dele — é aí que transaction_index vai apontar.
  const manuaisComIndice = manuaisParaGravar.map(m => ({
    ...m,
    matchedIndex: matchedFinal.findIndex(x => x.transacao === m.transacao),
  }));

  return {
    matched: matchedFinal,
    orphan_bank,
    orphan_system,
    manuaisComIndice,
    _debug: { faturas_fetched: faturasNorm.length, recibos_fetched: recibosNorm.length },
  };
}

async function gravarMovimentosManuais(supabaseClient, runId, manuaisComIndice) {
  // Reprocessar pode mudar os índices — limpa os antigos deste run antes de
  // regravar, para nunca acumular registos obsoletos/duplicados.
  await supabaseClient.from('conta_manual_movimentos').delete().eq('reconciliation_run_id', runId);
  if (!manuaisComIndice.length) return;
  const rows = manuaisComIndice.map(m => ({
    nome_conta: 'Novobanco Poupança',
    valor: m.transacao.tipo === 'credito' ? -m.transacao.valor : m.transacao.valor,
    data: m.transacao.data,
    reconciliation_run_id: runId,
    transaction_index: m.matchedIndex,
  }));
  const { error } = await supabaseClient.from('conta_manual_movimentos').insert(rows);
  if (error) console.error('[reconciliacao] falha ao gravar conta_manual_movimentos:', error.message);
}

async function handleProcess(req, res) {
  const { action } = req.query;

  // ── saldo-manual: soma da conta manual (Novobanco Poupança) — leitura, GET ──
  if (action === 'saldo-manual') {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
    const supabaseClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data, error } = await supabaseClient.from('conta_manual_movimentos').select('valor');
    if (error) return res.status(500).json({ error: error.message });
    const saldo = (data || []).reduce((acc, r) => acc + Number(r.valor || 0), 0);
    return res.status(200).json({ saldo, count: (data || []).length });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  req.body = await readJsonBody(req);
  const supabaseClient = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // ── toconline-fetch: busca movimentos de UMA conta/período — preview,
  // não cria run. Paridade com handleParse para ficheiros.
  if (action === 'toconline-fetch') {
    const { contaId, de, ate } = req.body || {};
    if (!contaId || !de || !ate) {
      return res.status(400).json({ error: 'contaId, de e ate são obrigatórios (de/ate no formato YYYY-MM).' });
    }
    const dateFrom = `${de}-01`;
    const [ateY, ateM] = ate.split('-').map(Number);
    const dateTo = new Date(ateY, ateM, 0).toISOString().split('T')[0];

    try {
      const accessToken = await getValidToken();
      const contaData = await tocFetch(`/api/bank_accounts/${contaId}`, accessToken);
      const conta = contaData.data || contaData;
      const a = conta.attributes || conta;
      const nomeConta = a.name || `Conta ${contaId}`;

      const txRaw = [];
      let page = 1;
      outer: while (true) {
        const data = await tocFetch(
          `/api/bank_transactions?filter[bank_account_id]=${contaId}&sort=-transaction_date&page[number]=${page}&page[size]=100`,
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

      const transacoes = [];
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

      return res.status(200).json({ conta: nomeConta, transactions: transacoes });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

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
      const { matched, orphan_bank, orphan_system, manuaisComIndice, _debug } = await processarTransacoes(supabaseClient, transacoes);

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

      await gravarMovimentosManuais(supabaseClient, runId, manuaisComIndice);

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
        _debug,
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── Criar novo run — transactions_json já consolidado no frontend,
  // independentemente da mistura de origens (upload + TOConline, várias
  // contas/ficheiros já acumulados no preview antes de "Processar").
  const { transactions_json, filename } = req.body || {};

  if (!Array.isArray(transactions_json) || transactions_json.length === 0) {
    return res.status(400).json({ error: 'transactions_json obrigatório e não pode estar vazio.' });
  }

  try {
    const { matched, orphan_bank, orphan_system, manuaisComIndice } = await processarTransacoes(supabaseClient, transactions_json);

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

    await gravarMovimentosManuais(supabaseClient, run.id, manuaisComIndice);

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
  if (!requireAuth(req, res, ['admin'])) return;

  const { tipo } = req.query;
  if (tipo === 'parse') return handleParse(req, res);
  if (tipo === 'process') return handleProcess(req, res);
  return res.status(400).json({ error: `tipo desconhecido: ${tipo || '(não definido)'}` });
}
