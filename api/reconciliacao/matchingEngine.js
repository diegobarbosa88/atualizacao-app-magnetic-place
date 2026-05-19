// ─── Matching Engine ──────────────────────────────────────────────────────────

/**
 * Cruza transações bancárias com faturas pendentes do sistema.
 *
 * @param {Array} transacoes - Transacao[] dos parsers
 *   { data: string, descricao: string, valor: number, tipo: 'credito'|'debito' }
 * @param {Array} faturas    - Faturas com status PENDENTE do Supabase
 *   { id, tipo, valor, data_documento, descricao, entidade, status, fonte }
 * @returns {{ matched, orphan_bank, orphan_system }}
 *
 * Regra 1: valor numérico exato (fatura.valor === transacao.valor)
 * Regra 2: fatura.entidade substring na transacao.descricao (case-insensitive)
 *
 * Transação pode ser:
 *   - matched      → 1 fatura encontrada (Regra 1 ou 1+2)
 *   - ambiguous    → múltiplos candidatos, Regra 2 não resolveu → orphan_bank
 *   - orphan_bank  → nenhuma fatura encontrada
 *
 * Fatura pode ser:
 *   - matched       → consumida por uma transação
 *   - orphan_system → sem transação correspondente
 */
export function runMatchingEngine(transacoes, faturas) {
  const matched = [];
  const orphan_bank = [];
  const usedFaturaIds = new Set();

  for (const transacao of transacoes) {
    // Regra 1: candidatos por valor exato (ignora faturas sem valor extraído)
    const candidatos = faturas.filter(f =>
      !usedFaturaIds.has(f.id) &&
      f.valor != null &&
      Number(f.valor) === transacao.valor
    );

    if (candidatos.length === 0) {
      orphan_bank.push({ transacao, reason: 'no_match' });
      continue;
    }

    if (candidatos.length === 1) {
      matched.push({ transacao, fatura: candidatos[0], rule: 'exact_value' });
      usedFaturaIds.add(candidatos[0].id);
      continue;
    }

    // Regra 2: desambiguação por entidade na descrição
    const descLower = (transacao.descricao || '').toLowerCase();
    const porDescricao = candidatos.filter(f =>
      f.entidade && descLower.includes(f.entidade.toLowerCase())
    );

    if (porDescricao.length === 1) {
      matched.push({ transacao, fatura: porDescricao[0], rule: 'description_match' });
      usedFaturaIds.add(porDescricao[0].id);
      continue;
    }

    // Ambiguous — múltiplos candidatos, Regra 2 não resolveu
    orphan_bank.push({
      transacao,
      reason: 'ambiguous',
      candidates: candidatos.map(f => ({ id: f.id, entidade: f.entidade, valor: f.valor })),
    });
  }

  // Faturas sem correspondência
  const orphan_system = faturas
    .filter(f => !usedFaturaIds.has(f.id))
    .map(f => ({ fatura: f, reason: 'no_transaction' }));

  return { matched, orphan_bank, orphan_system };
}
