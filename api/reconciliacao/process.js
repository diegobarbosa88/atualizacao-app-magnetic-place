import { createClient } from '@supabase/supabase-js';
import { runMatchingEngine } from './_matchingEngine.js';
import { getValidToken } from '../toconline/_token.js';
import { fetchAllPages } from '../toconline/_fetch.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

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
        const txRaw = await fetchAllPages(
          `/api/bank_transactions?filter[bank_account_id]=${conta.id}&filter[transaction_date_from]=${dateFrom}&filter[transaction_date_to]=${dateTo}&sort=-transaction_date`,
          accessToken
        );
        for (const tx of txRaw) {
          const attrs = tx.attributes || tx;
          const txDate = attrs.transaction_date || attrs.posted_date || '';
          if (txDate && (txDate < dateFrom || txDate > dateTo)) continue;
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
