import { describe, it, expect } from 'vitest';
import { runReconciliacaoSalarial } from '../../src/utils/reconciliacaoSalarialEngine.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeRecibo(overrides = {}) {
  return {
    worker_name: 'João Silva',
    worker_id: 'w1',
    mes: '2026-06',
    liquido_extraido: 1200.00,
    ...overrides,
  };
}

function makeTx(overrides = {}) {
  return {
    tipo: 'debito',
    valor: 1200.00,
    data: '2026-06-10',
    descricao: 'TRF JOAO SILVA SALARIO',
    ...overrides,
  };
}

// Alias helper: liga um padrão de descrição a um nome de trabalhador
function makeAlias(pattern, workerName) {
  return { pattern, worker_name: workerName };
}

// PaymentsMap helper: mapa de transfers já ligados manualmente via UI
function makePaymentsMap(workerId, mes, transfers) {
  return { [workerId]: { [mes]: transfers } };
}

// ---------------------------------------------------------------------------
// Comportamento do matching automático por score
// ---------------------------------------------------------------------------
// normStr() remove espaços antes de split(), pelo que qualquer nome com
// espaços é tratado como UM único token. Score máximo = 1; limiar = 2.
// O matching automático nunca resulta para nomes de 2 palavras.
// Na prática, o matching é feito via aliases ou paymentsMap.
// ---------------------------------------------------------------------------

describe('matching automático por score (comportamento documentado)', () => {
  it('nome de 2 palavras → score 1 → transferência vai para unmatched_transactions', () => {
    const recibos = [makeRecibo({ worker_name: 'João Silva' })];
    const transacoes = [makeTx({ descricao: 'TRF JOAO SILVA SALARIO' })];
    const { employees, unmatched_transactions } = runReconciliacaoSalarial({ recibos, transacoes, ano: 2026 });
    // score = 1 < limiar 2 → não associado automaticamente
    expect(employees[0].months[0].transfers).toHaveLength(0);
    expect(unmatched_transactions).toHaveLength(1);
  });

  it('débito sem prefixo TRF ou P/ não é candidato a matching mas aparece em unmatched', () => {
    const recibos = [makeRecibo()];
    const transacoes = [makeTx({ descricao: 'COMP JOAO SILVA' })];
    const { employees, unmatched_transactions } = runReconciliacaoSalarial({ recibos, transacoes, ano: 2026 });
    expect(employees[0].months[0].transfers).toHaveLength(0);
    // Débitos não-TRF/P/ não entram no motor de matching, mas ainda aparecem
    // em unmatched_transactions (todos os débitos não associados ficam aqui)
    expect(unmatched_transactions).toHaveLength(1);
  });

  it('transacções de crédito são completamente ignoradas', () => {
    const recibos = [makeRecibo()];
    const transacoes = [makeTx({ tipo: 'credito' })];
    const { employees, unmatched_transactions } = runReconciliacaoSalarial({ recibos, transacoes, ano: 2026 });
    expect(employees[0].months[0].transfers).toHaveLength(0);
    expect(unmatched_transactions).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Matching via aliases
// ---------------------------------------------------------------------------

describe('matching via aliases', () => {
  it('alias com pattern exacto associa transferência ao trabalhador correcto', () => {
    const recibos = [makeRecibo({ worker_name: 'João Silva', liquido_extraido: 1200 })];
    const transacoes = [makeTx({ descricao: 'TRF JSILVA REF SALARIO', valor: 1200 })];
    const aliases = [makeAlias('JSILVA', 'João Silva')];
    const { employees } = runReconciliacaoSalarial({ recibos, transacoes, ano: 2026, aliases });
    expect(employees[0].months[0].transfers).toHaveLength(1);
  });

  it('alias tem prioridade sobre matching automático por score', () => {
    const recibos = [
      makeRecibo({ worker_name: 'Maria Costa', worker_id: 'w1', liquido_extraido: 900 }),
      makeRecibo({ worker_name: 'Ana Costa', worker_id: 'w2', mes: '2026-06', liquido_extraido: 800 }),
    ];
    // Sem alias: score = 1 para ambas (só "costa" em comum) → nenhuma associada
    // Com alias: "MCOSTA" aponta para Maria Costa
    const transacoes = [makeTx({ descricao: 'TRF MCOSTA SALARIO JUN', valor: 900 })];
    const aliases = [makeAlias('MCOSTA', 'Maria Costa')];
    const { employees } = runReconciliacaoSalarial({ recibos, transacoes, ano: 2026, aliases });
    const maria = employees.find(e => e.employee_name === 'Maria Costa');
    const ana = employees.find(e => e.employee_name === 'Ana Costa');
    expect(maria.months[0].transfers).toHaveLength(1);
    expect(ana.months[0].transfers).toHaveLength(0);
  });

  it('alias com worker_name inexistente → fallback para score (score 1 → unmatched)', () => {
    const recibos = [makeRecibo()];
    const transacoes = [makeTx({ descricao: 'TRF ALIAS_X' })];
    const aliases = [makeAlias('ALIAS_X', 'Trabalhador Inexistente')];
    const { unmatched_transactions } = runReconciliacaoSalarial({ recibos, transacoes, ano: 2026, aliases });
    expect(unmatched_transactions).toHaveLength(1);
  });

  it('prefixo P/ funciona com alias', () => {
    const recibos = [makeRecibo({ liquido_extraido: 1000 })];
    const transacoes = [makeTx({ descricao: 'P/JSILVA SALARIO', valor: 1000 })];
    const aliases = [makeAlias('JSILVA', 'João Silva')];
    const { employees } = runReconciliacaoSalarial({ recibos, transacoes, ano: 2026, aliases });
    expect(employees[0].months[0].transfers).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// classifyTransfer — testado via alias para garantir match
// ---------------------------------------------------------------------------

describe('classifyTransfer — classificação por data', () => {
  const aliasSilva = [makeAlias('JSILVA', 'João Silva')];
  const recibosBase = [makeRecibo({ mes: '2026-06' })];

  it('dia 1-6 do mês de referência → Adiantamento', () => {
    const transacoes = [makeTx({ data: '2026-06-05', descricao: 'TRF JSILVA', valor: 1200 })];
    const { employees } = runReconciliacaoSalarial({ recibos: recibosBase, transacoes, ano: 2026, aliases: aliasSilva });
    expect(employees[0].months[0].transfers[0].type).toBe('Adiantamento');
  });

  it('dia 7-15 do mês de referência → Liquidação', () => {
    const transacoes = [makeTx({ data: '2026-06-10', descricao: 'TRF JSILVA', valor: 1200 })];
    const { employees } = runReconciliacaoSalarial({ recibos: recibosBase, transacoes, ano: 2026, aliases: aliasSilva });
    expect(employees[0].months[0].transfers[0].type).toBe('Liquidação');
  });

  it('dia 16+ do mês de referência → Adiantamento', () => {
    const transacoes = [makeTx({ data: '2026-06-20', descricao: 'TRF JSILVA', valor: 1200 })];
    const { employees } = runReconciliacaoSalarial({ recibos: recibosBase, transacoes, ano: 2026, aliases: aliasSilva });
    expect(employees[0].months[0].transfers[0].type).toBe('Adiantamento');
  });

  it('dia 7-15 do mês seguinte → Liquidação', () => {
    const transacoes = [makeTx({ data: '2026-07-10', descricao: 'TRF JSILVA', valor: 1200 })];
    const { employees } = runReconciliacaoSalarial({ recibos: recibosBase, transacoes, ano: 2026, aliases: aliasSilva });
    expect(employees[0].months[0].transfers[0].type).toBe('Liquidação');
  });

  it('dia 1-6 do mês seguinte → Adiantamento', () => {
    const transacoes = [makeTx({ data: '2026-07-04', descricao: 'TRF JSILVA', valor: 1200 })];
    const { employees } = runReconciliacaoSalarial({ recibos: recibosBase, transacoes, ano: 2026, aliases: aliasSilva });
    expect(employees[0].months[0].transfers[0].type).toBe('Adiantamento');
  });

  it('transferência de 2 meses depois não é classificada → não adicionada ao mês', () => {
    const transacoes = [makeTx({ data: '2026-08-10', descricao: 'TRF JSILVA', valor: 1200 })];
    const { employees } = runReconciliacaoSalarial({ recibos: recibosBase, transacoes, ano: 2026, aliases: aliasSilva });
    expect(employees[0].months[0].transfers).toHaveLength(0);
  });

  it('date formatada como DD.MM.YYYY na saída', () => {
    const transacoes = [makeTx({ data: '2026-06-10', descricao: 'TRF JSILVA', valor: 1200 })];
    const { employees } = runReconciliacaoSalarial({ recibos: recibosBase, transacoes, ano: 2026, aliases: aliasSilva });
    expect(employees[0].months[0].transfers[0].date).toBe('10.06.2026');
  });
});

// ---------------------------------------------------------------------------
// Status de reconciliação (tolerância) — via alias para garantir match
// ---------------------------------------------------------------------------

describe('status de reconciliação (tolerância)', () => {
  const alias = [makeAlias('JSILVA', 'João Silva')];

  it('balanço zero → Match Exato', () => {
    const recibos = [makeRecibo({ liquido_extraido: 1200 })];
    const transacoes = [makeTx({ descricao: 'TRF JSILVA', valor: 1200 })];
    const { employees } = runReconciliacaoSalarial({ recibos, transacoes, ano: 2026, aliases: alias });
    expect(employees[0].months[0].status).toBe('Match Exato');
    expect(employees[0].months[0].balance).toBe(0);
  });

  it('diferença dentro da tolerância padrão (€0.01) → Match Exato', () => {
    const recibos = [makeRecibo({ liquido_extraido: 1200.00 })];
    const transacoes = [makeTx({ descricao: 'TRF JSILVA', valor: 1200.01 })];
    const { employees } = runReconciliacaoSalarial({ recibos, transacoes, ano: 2026, aliases: alias });
    expect(employees[0].months[0].status).toBe('Match Exato');
  });

  it('diferença acima da tolerância padrão → Saldo Pendente', () => {
    const recibos = [makeRecibo({ liquido_extraido: 1200.00 })];
    const transacoes = [makeTx({ descricao: 'TRF JSILVA', valor: 1150.00 })];
    const { employees } = runReconciliacaoSalarial({ recibos, transacoes, ano: 2026, aliases: alias });
    expect(employees[0].months[0].status).toBe('Saldo Pendente');
    expect(employees[0].months[0].balance).toBeCloseTo(50, 2);
  });

  it('tolerância personalizada respeitada', () => {
    const recibos = [makeRecibo({ liquido_extraido: 1200.00 })];
    const transacoes = [makeTx({ descricao: 'TRF JSILVA', valor: 1195.00 })];
    const { employees } = runReconciliacaoSalarial({ recibos, transacoes, ano: 2026, aliases: alias, tolerancia: 10 });
    expect(employees[0].months[0].status).toBe('Match Exato');
  });

  it('sem transferência → Saldo Pendente com balance igual ao liquido_extraido', () => {
    const recibos = [makeRecibo({ liquido_extraido: 1200 })];
    const { employees } = runReconciliacaoSalarial({ recibos, transacoes: [], ano: 2026 });
    expect(employees[0].months[0].status).toBe('Saldo Pendente');
    expect(employees[0].months[0].balance).toBe(1200);
    expect(employees[0].months[0].total_paid).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// paymentsMap (pré-populado de movimentacao_recibo_links)
// ---------------------------------------------------------------------------

describe('paymentsMap pré-populado', () => {
  it('transfers do paymentsMap são adicionados ao mês correcto', () => {
    const recibos = [makeRecibo({ worker_id: 'w1', mes: '2026-06', liquido_extraido: 1200 })];
    const paymentsMap = makePaymentsMap('w1', '2026-06', [
      { data: '2026-06-10', amount: 1200, type: 'Liquidação', linkId: 'lnk1' },
    ]);
    const { employees } = runReconciliacaoSalarial({ recibos, transacoes: [], ano: 2026, paymentsMap });
    expect(employees[0].months[0].transfers).toHaveLength(1);
    expect(employees[0].months[0].transfers[0].linkId).toBe('lnk1');
    expect(employees[0].months[0].status).toBe('Match Exato');
  });

  it('quando paymentsMap existe, auto-match não duplica transferências', () => {
    const recibos = [makeRecibo({ worker_id: 'w1', mes: '2026-06', liquido_extraido: 1200 })];
    const transacoes = [makeTx({ descricao: 'TRF JOAO SILVA', valor: 1200 })];
    const paymentsMap = makePaymentsMap('w1', '2026-06', [
      { data: '2026-06-10', amount: 1200, type: 'Liquidação', linkId: 'lnk1' },
    ]);
    const { employees } = runReconciliacaoSalarial({ recibos, transacoes, ano: 2026, paymentsMap });
    // Apenas o transfer do paymentsMap; auto-match não adiciona segundo transfer
    expect(employees[0].months[0].transfers).toHaveLength(1);
  });

  it('entradas duplicadas no paymentsMap são deduplicadas', () => {
    const recibos = [makeRecibo({ worker_id: 'w1', mes: '2026-06', liquido_extraido: 1200 })];
    const paymentsMap = makePaymentsMap('w1', '2026-06', [
      { data: '2026-06-10', amount: 1200, type: 'Liquidação', linkId: 'lnk1' },
      { data: '2026-06-10', amount: 1200, type: 'Liquidação', linkId: 'lnk1' }, // duplicado
    ]);
    const { employees } = runReconciliacaoSalarial({ recibos, transacoes: [], ano: 2026, paymentsMap });
    expect(employees[0].months[0].transfers).toHaveLength(1);
  });

  it('paymentsMap com workerId inexistente não afecta outros workers', () => {
    const recibos = [makeRecibo({ worker_id: 'w1', mes: '2026-06', liquido_extraido: 1200 })];
    const paymentsMap = makePaymentsMap('w999', '2026-06', [
      { data: '2026-06-10', amount: 1200, type: 'Liquidação', linkId: 'lnk1' },
    ]);
    const { employees } = runReconciliacaoSalarial({ recibos, transacoes: [], ano: 2026, paymentsMap });
    expect(employees[0].months[0].transfers).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// unmatched_transactions
// ---------------------------------------------------------------------------

describe('unmatched_transactions', () => {
  it('débito TRF sem match vai para unmatched com campos correctos', () => {
    const recibos = [makeRecibo()];
    const transacoes = [makeTx({ descricao: 'TRF ENTIDADE DESCONHECIDA', data: '2026-06-10', valor: 500 })];
    const { unmatched_transactions } = runReconciliacaoSalarial({ recibos, transacoes, ano: 2026 });
    expect(unmatched_transactions).toHaveLength(1);
    expect(unmatched_transactions[0]).toMatchObject({
      descricao: 'TRF ENTIDADE DESCONHECIDA',
      amount: 500,
      date: '10.06.2026',
      data: '2026-06-10',
    });
  });

  it('créditos nunca vão para unmatched_transactions', () => {
    const recibos = [makeRecibo()];
    const transacoes = [makeTx({ tipo: 'credito' })];
    const { unmatched_transactions } = runReconciliacaoSalarial({ recibos, transacoes, ano: 2026 });
    expect(unmatched_transactions).toHaveLength(0);
  });

  it('transferência associada via alias não aparece em unmatched', () => {
    const recibos = [makeRecibo()];
    const transacoes = [makeTx({ descricao: 'TRF JSILVA SALARIO' })];
    const aliases = [makeAlias('JSILVA', 'João Silva')];
    const { unmatched_transactions } = runReconciliacaoSalarial({ recibos, transacoes, ano: 2026, aliases });
    expect(unmatched_transactions).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Summary e casos extremos
// ---------------------------------------------------------------------------

describe('summary e casos extremos', () => {
  it('summary reflecte contagens correctas com paymentsMap', () => {
    const recibos = [
      makeRecibo({ worker_name: 'João Silva', worker_id: 'w1', mes: '2026-06', liquido_extraido: 1200 }),
      makeRecibo({ worker_name: 'Ana Costa', worker_id: 'w2', mes: '2026-06', liquido_extraido: 900 }),
    ];
    // João tem pagamento completo; Ana fica sem pagamento
    const paymentsMap = makePaymentsMap('w1', '2026-06', [
      { data: '2026-06-10', amount: 1200, type: 'Liquidação', linkId: 'lnk1' },
    ]);
    const { summary } = runReconciliacaoSalarial({ recibos, transacoes: [], ano: 2026, paymentsMap });
    expect(summary.total_employees_processed).toBe(2);
    expect(summary.total_exact_matches).toBe(1);
    expect(summary.total_pending_balances).toBe(1);
  });

  it('reconciliation_period usa o ano fornecido como string', () => {
    const { reconciliation_period } = runReconciliacaoSalarial({ recibos: [], transacoes: [], ano: 2025 });
    expect(reconciliation_period).toBe('2025');
  });

  it('lista de recibos vazia → employees e unmatched_transactions vazios', () => {
    const { employees, unmatched_transactions } = runReconciliacaoSalarial({ recibos: [], transacoes: [], ano: 2026 });
    expect(employees).toHaveLength(0);
    expect(unmatched_transactions).toHaveLength(0);
  });

  it('múltiplos meses do mesmo trabalhador são ordenados cronologicamente', () => {
    const recibos = [
      makeRecibo({ mes: '2026-08', liquido_extraido: 1200 }),
      makeRecibo({ mes: '2026-06', liquido_extraido: 1200 }),
      makeRecibo({ mes: '2026-07', liquido_extraido: 1200 }),
    ];
    const { employees } = runReconciliacaoSalarial({ recibos, transacoes: [], ano: 2026 });
    expect(employees[0].months.map(m => m.month)).toEqual(['2026-06', '2026-07', '2026-08']);
  });

  it('não quebra com lista de transacções vazia', () => {
    const recibos = [makeRecibo()];
    expect(() => runReconciliacaoSalarial({ recibos, transacoes: [], ano: 2026 })).not.toThrow();
  });

  it('não quebra com aliases vazio', () => {
    const recibos = [makeRecibo()];
    const transacoes = [makeTx()];
    expect(() => runReconciliacaoSalarial({ recibos, transacoes, ano: 2026, aliases: [] })).not.toThrow();
  });

  it('dois recibos do mesmo trabalhador no mesmo mês são deduplicados em 1 mês', () => {
    // O workerMap usa worker_name como chave, mês como sub-chave
    const recibos = [
      makeRecibo({ mes: '2026-06', liquido_extraido: 1200 }),
      makeRecibo({ mes: '2026-06', liquido_extraido: 1200 }), // duplicado
    ];
    const { employees } = runReconciliacaoSalarial({ recibos, transacoes: [], ano: 2026 });
    expect(employees[0].months).toHaveLength(1);
  });
});
