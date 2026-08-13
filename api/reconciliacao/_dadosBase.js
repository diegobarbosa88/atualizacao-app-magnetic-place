// Dados base para o motor de reconciliação — faturas pendentes + recibos +
// aliases guardados. Extraído de handleProcess (estava duplicado entre os
// caminhos reprocess/toconline/manual, todos com a mesma lógica inline).

function parseValorFatura(v) {
  if (v == null) return null;
  if (typeof v === 'number') return isNaN(v) ? null : v;
  const s = String(v).trim().replace(/\s/g, '');
  const normalized = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s;
  const n = parseFloat(normalized);
  return isNaN(n) ? null : n;
}

export async function fetchFaturasERecibos(supabase) {
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
}
