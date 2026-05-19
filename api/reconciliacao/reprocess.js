import { createClient } from '@supabase/supabase-js';
import { runMatchingEngine } from './matchingEngine.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { runId } = req.body || {};
  if (!runId) return res.status(400).json({ error: 'runId obrigatório.' });

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Buscar run existente
  const { data: run, error: runFetchErr } = await supabase
    .from('reconciliation_runs')
    .select('id, filename, transactions_json')
    .eq('id', runId)
    .single();

  if (runFetchErr || !run) {
    return res.status(404).json({ error: 'Run não encontrado.' });
  }

  const transacoes = run.transactions_json;
  if (!Array.isArray(transacoes) || transacoes.length === 0) {
    return res.status(400).json({ error: 'Run não tem transações guardadas para reprocessar.' });
  }

  const parseValorFatura = (v) => {
    if (v == null) return null;
    if (typeof v === 'number') return isNaN(v) ? null : v;
    const s = String(v).trim().replace(/\s/g, '');
    const normalized = s.includes(',')
      ? s.replace(/\./g, '').replace(',', '.')
      : s;
    const n = parseFloat(normalized);
    return isNaN(n) ? null : n;
  };

  // Buscar faturas frescas (excluindo PAGO)
  const { data: faturas, error: fatError } = await supabase
    .from('faturas')
    .select('id, tipo, valor, data_documento, descricao, entidade, status, fonte, dados, filename')
    .not('status', 'eq', 'PAGO');

  if (fatError) return res.status(500).json({ error: `Erro ao buscar faturas: ${fatError.message}` });

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

  // Buscar recibos validados
  const { data: recibos, error: recError } = await supabase
    .from('receipt_validations')
    .select('id, worker_name, liquido_extraido, mes, estado')
    .in('estado', ['valido', 'aviso']);

  if (recError) return res.status(500).json({ error: `Erro ao buscar recibos: ${recError.message}` });

  const recibosNorm = (recibos || []).map(r => ({
    id: r.id,
    tipo: 'recibo',
    valor: parseValorFatura(r.liquido_extraido),
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

  // Actualizar run existente com os novos resultados
  const { error: updateErr } = await supabase
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
      recibos_raw_count: (recibos || []).length,
      recibos_sample: (recibos || []).slice(0, 5).map(r => ({ id: r.id, worker_name: r.worker_name, liquido_extraido: r.liquido_extraido, estado: r.estado, valor_parsed: parseValorFatura(r.liquido_extraido) })),
    },
  });
}
