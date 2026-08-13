// ─── Matching Engine ──────────────────────────────────────────────────────────

// Extrai nome da entidade de descrições de transferência bancária
export function extractEntityFromDesc(desc) {
  const patterns = [
    /TRF\s+IMEDIATA\s+DE\s+/i,
    /TRANSFERENCIA\s+DE\s+/i,
    /TRANSF(?:ERENCIA)?\s+DE\s+/i,
    /TRF\s+DE\s+/i,
    /ORDEM\s+DE\s+PAGAMENTO\s+DE\s+/i,
    /PAGAMENTO\s+DE\s+/i,
    /PAGT\s+DE\s+/i,
    /RECEBIDO\s+DE\s+/i,
    /REC\s+DE\s+/i,
  ];
  for (const p of patterns) {
    const m = desc.match(p);
    if (m) return desc.slice(m.index + m[0].length).trim();
  }
  return desc;
}

// Normaliza nome para comparação (remove sufixos legais, acentos, pontuação)
export function normalizeEntityName(name) {
  return String(name)
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\b(unipessoal|unip|lda|s\.?a\.?|s\.?l\.?|ltd|llc|inc|srl|bv|nv|gmbh|ag|spa|sarl)\b\.?/gi, '')
    .replace(/[.,\-&']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Cruza transações bancárias com faturas pendentes do sistema.
 *
 * @param {Array} transacoes - Transacao[] dos parsers
 *   { data: string, descricao: string, valor: number, tipo: 'credito'|'debito' }
 * @param {Array} faturas    - Faturas com status PENDENTE do Supabase
 *   { id, tipo, valor, data_documento, descricao, entidade, status, fonte }
 * @returns {{ matched, orphan_bank, orphan_system }}
 *
 * Regra 1: valor numérico exato (±1 cêntimo)
 * Regra 2: fatura.entidade substring na transacao.descricao (case-insensitive)
 * Regra 3: data_documento mais próxima da data da transação (janela de 60 dias)
 *
 * Transação pode ser:
 *   - matched      → 1 fatura encontrada
 *   - ambiguous    → múltiplos candidatos, nenhuma regra resolveu → orphan_bank
 *   - orphan_bank  → nenhuma fatura encontrada
 *
 * Fatura pode ser:
 *   - matched       → consumida por uma transação
 *   - orphan_system → sem transação correspondente
 */

export function dateDiffDays(dateA, dateB) {
  if (!dateA || !dateB) return Infinity;
  const a = new Date(dateA);
  const b = new Date(dateB);
  if (isNaN(a) || isNaN(b)) return Infinity;
  return Math.abs((a - b) / 86400000);
}

export function runMatchingEngine(transacoes, faturas, aliases = []) {
  const matched = [];
  const orphan_bank = [];
  const usedFaturaIds = new Set();

  for (const transacao of transacoes) {
    // Regra 1: candidatos por valor (tolerância de 1 cêntimo para evitar erros de float)
    const txCents = Math.round(transacao.valor * 100);
    const candidatos = faturas.filter(f =>
      !usedFaturaIds.has(f.id) &&
      f.valor != null &&
      f.valor > 0 &&
      Math.abs(Math.round(Number(f.valor) * 100) - txCents) <= 1
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

    // Regra 2: desambiguação por entidade — substring directo + extração de TRF + aliases
    const extracted = extractEntityFromDesc(transacao.descricao || '');
    const extractedNorm = normalizeEntityName(extracted);
    const descFullNorm = normalizeEntityName(transacao.descricao || '');

    let aliasRuleUsed = false;
    const porDescricao = candidatos.filter(f => {
      if (!f.entidade) return false;
      const entNorm = normalizeEntityName(f.entidade);
      if (!entNorm) return false;
      // Match directo na descrição completa
      if (descFullNorm.includes(entNorm)) return true;
      // Match na parte extraída (após "TRF IMEDIATA DE", etc.) — só se o nome tiver >=3 chars
      if (extractedNorm.length >= 3 && entNorm.length >= 3) {
        if (extractedNorm.includes(entNorm) || entNorm.includes(extractedNorm)) return true;
      }
      // Match por alias guardado
      const hasAlias = aliases.some(a =>
        normalizeEntityName(a.bank_name) === extractedNorm &&
        normalizeEntityName(a.system_entity) === entNorm
      );
      if (hasAlias) { aliasRuleUsed = true; return true; }
      return false;
    });

    if (porDescricao.length === 1) {
      const rule = aliasRuleUsed ? 'alias_match' : 'description_match';
      matched.push({ transacao, fatura: porDescricao[0], rule });
      usedFaturaIds.add(porDescricao[0].id);
      continue;
    }

    // Regra 3: data mais próxima da transação (pool = porDescricao se >0, senão todos os candidatos)
    const pool = porDescricao.length > 0 ? porDescricao : candidatos;
    const comData = pool.filter(f => f.data_documento);
    if (comData.length > 0) {
      comData.sort((a, b) => dateDiffDays(a.data_documento, transacao.data) - dateDiffDays(b.data_documento, transacao.data));
      const melhor = comData[0];
      const segundo = comData[1];
      // Só aceita se o melhor for claramente mais próximo (diferença > 3 dias face ao segundo)
      if (!segundo || dateDiffDays(melhor.data_documento, transacao.data) + 3 < dateDiffDays(segundo.data_documento, transacao.data)) {
        matched.push({ transacao, fatura: melhor, rule: 'date_proximity' });
        usedFaturaIds.add(melhor.id);
        continue;
      }
    }

    // Ambiguous — múltiplos candidatos, nenhuma regra resolveu
    orphan_bank.push({
      transacao,
      reason: 'ambiguous',
      candidates: candidatos.map(f => ({ id: f.id, entidade: f.entidade, valor: f.valor, data_documento: f.data_documento })),
    });
  }

  // Faturas sem correspondência
  const orphan_system = faturas
    .filter(f => !usedFaturaIds.has(f.id))
    .map(f => ({ fatura: f, reason: 'no_transaction' }));

  return { matched, orphan_bank, orphan_system };
}

// ─── Deteção de transferências internas ──────────────────────────────────────
//
// Transferências entre contas próprias da empresa mostram o nome legal dela
// na descrição do lado do banco (confirmado com dados reais: "TRF.IMED. DE/P/
// MAGNETIC PLACE...", "TRF CRED INTRAB DE MAGNETIC PLACE..."). Reaproveita
// extractEntityFromDesc/normalizeEntityName já usados no matching normal.
//
// Regras (decididas depois de verificar ambiguidade real nos dados — valores
// repetidos como 10000€ aparecem várias vezes no mesmo período):
//   - Agrupa candidatas (menção ao nome próprio) por valor absoluto exato.
//   - Grupo com exatamente 1 crédito + 1 débito → par confirmado.
//   - Grupo só com um lado (nenhum contra-valor) → presumida (foi para/veio
//     da conta não ligada, tipicamente a poupança).
//   - Grupo com mais de uma candidata em qualquer lado (mesmo valor a repetir-
//     se) → AMBÍGUO, propositadamente NÃO emparelhado — cai como presumida
//     mas marcada `ambiguous: true`, para o admin resolver manualmente. Nunca
//     adivinha qual par é o certo quando há mais que uma hipótese.
export function detectInternalTransfers(transacoes, companyNameNorm) {
  if (!companyNameNorm) return { confirmadas: [], presumidas: [], ambiguas: [] };

  const candidateIdx = [];
  transacoes.forEach((t, i) => {
    const extracted = extractEntityFromDesc(t.descricao || '');
    const extractedNorm = normalizeEntityName(extracted);
    const descNorm = normalizeEntityName(t.descricao || '');
    const bate =
      (extractedNorm && (companyNameNorm.includes(extractedNorm) || extractedNorm.includes(companyNameNorm))) ||
      descNorm.includes(companyNameNorm);
    if (bate) candidateIdx.push(i);
  });

  // Agrupa por valor absoluto em cêntimos (evita problemas de float)
  const porValor = new Map();
  for (const i of candidateIdx) {
    const cents = Math.round(transacoes[i].valor * 100);
    if (!porValor.has(cents)) porValor.set(cents, { creditos: [], debitos: [] });
    const grupo = porValor.get(cents);
    (transacoes[i].tipo === 'credito' ? grupo.creditos : grupo.debitos).push(i);
  }

  const confirmadas = []; // [ [idxCredito, idxDebito], ... ]
  const presumidas = [];
  const ambiguas = [];

  for (const { creditos, debitos } of porValor.values()) {
    if (creditos.length === 1 && debitos.length === 1) {
      confirmadas.push([creditos[0], debitos[0]]);
    } else if (creditos.length === 0) {
      presumidas.push(...debitos);
    } else if (debitos.length === 0) {
      presumidas.push(...creditos);
    } else {
      // ambos os lados têm candidatas, mas mais que uma nalgum lado — sem
      // forma fiável de saber qual par é o certo
      ambiguas.push(...creditos, ...debitos);
    }
  }

  return { confirmadas, presumidas, ambiguas };
}
