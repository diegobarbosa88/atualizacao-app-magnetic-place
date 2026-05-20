import { createClient } from '@supabase/supabase-js';
import { runMatchingEngine } from './matchingEngine.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { transactions_json, filename } = req.body || {};
  if (!Array.isArray(transactions_json) || transactions_json.length === 0) {
    return res.status(400).json({ error: 'transactions_json obrigatório e não pode estar vazio.' });
  }

  const supabase = createClient(
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

  const { data: recibos, error: recError } = await supabase
    .from('receipt_validations')
    .select('id, worker_name, liquido_extraido, mes, estado')
    .not('estado', 'eq', 'pago');

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
    estado_original: r.estado,
  })).filter(r => r.valor != null && r.valor > 0);

  const { data: aliasRows } = await supabase
    .from('reconciliacao_entity_aliases')
    .select('bank_name, system_entity');

  const { matched, orphan_bank, orphan_system } = runMatchingEngine(
    transactions_json,
    [...faturasNorm, ...recibosNorm],
    aliasRows || []
  );

  const { data: run, error: runError } = await supabase
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
}
