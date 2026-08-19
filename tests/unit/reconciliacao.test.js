import { describe, it, expect } from 'vitest';
import { verificarFechoMes, fecharReconciliacaoMes, verificarMesFechavel, SALDO_ACUMULADO_INICIAL } from '../../src/lib/ajudas/reconciliacao.js';

// Mock de query builder encadeável com filtros reais (.eq/.gte/.lte),
// necessário porque verificarMesFechavel filtra por mes/data de verdade —
// devolver sempre tudo (como os mocks mais simples de outros ficheiros)
// não discriminaria os casos de teste.
function makeFilteringBuilder(fullData, { single = false } = {}) {
  const filtros = [];
  let ordenarPor = null, ordemDesc = false, limite = null;
  const builder = {
    select: () => builder,
    eq: (campo, valor) => { filtros.push(row => row[campo] === valor); return builder; },
    gte: (campo, valor) => { filtros.push(row => row[campo] >= valor); return builder; },
    lte: (campo, valor) => { filtros.push(row => row[campo] <= valor); return builder; },
    order: (campo, opts) => { ordenarPor = campo; ordemDesc = opts?.ascending === false; return builder; },
    limit: (n) => { limite = n; return builder; },
    insert: (payload) => {
      const inserido = { id: 'novo-id', ...payload };
      return { select: () => ({ single: () => Promise.resolve({ data: inserido, error: null }) }) };
    },
    maybeSingle: () => {
      let data = (fullData || []).filter(row => filtros.every(f => f(row)));
      if (ordenarPor) data = [...data].sort((a, b) => ordemDesc ? String(b[ordenarPor]).localeCompare(a[ordenarPor]) : String(a[ordenarPor]).localeCompare(b[ordenarPor]));
      if (limite != null) data = data.slice(0, limite);
      return Promise.resolve({ data: data[0] ?? null, error: null });
    },
    then: (resolve, reject) => {
      let data = (fullData || []).filter(row => filtros.every(f => f(row)));
      if (ordenarPor) data = [...data].sort((a, b) => ordemDesc ? String(b[ordenarPor]).localeCompare(a[ordenarPor]) : String(a[ordenarPor]).localeCompare(b[ordenarPor]));
      if (limite != null) data = data.slice(0, limite);
      return Promise.resolve({ data: single ? (data[0] ?? null) : data, error: null }).then(resolve, reject);
    },
  };
  return builder;
}

function makeDbClient({ clients = [{ id: 'c1', name: 'Cliente A', elegivel_ajudas_custo: true }], logs = [], validations = [], valoresPorCliente = [], reconciliacoes = [] }) {
  return {
    from(table) {
      if (table === 'clients') return makeFilteringBuilder(clients);
      if (table === 'logs') return makeFilteringBuilder(logs);
      if (table === 'receipt_validations') return makeFilteringBuilder(validations);
      if (table === 'ajudas_valores_por_cliente_mes') return makeFilteringBuilder(valoresPorCliente);
      if (table === 'ajudas_reconciliacao_mensal') return makeFilteringBuilder(reconciliacoes);
      throw new Error(`tabela inesperada: ${table}`);
    },
  };
}

// fetchVendasFn injetado — mesmo formato "plano" usado em
// percentagemHistorica.test.js / valoresPorFatura.test.js.
function fatura({ cliente, valor, data, notes = null, docNum }) {
  return {
    document_type_name: 'FT',
    customer_business_name: cliente,
    gross_total: valor,
    date: data,
    notes,
    document_number: docNum,
  };
}

describe('verificarMesFechavel', () => {
  it('trabalhador com horas no mês mas sem receipt_validations no mês seguinte → não fechável', async () => {
    const dbClient = makeDbClient({
      logs: [{ workerId: 'w1', date: '2026-03-05' }],
      validations: [], // nada em mes=2026-04 (mesSeguinte de 2026-03)
    });

    const r = await verificarMesFechavel({ mes: '2026-03', dbClient });

    expect(r.fechavel).toBe(false);
    expect(r.motivo).toMatch(/w1/);
  });

  it('todos os trabalhadores com horas têm receipt_validations no mês seguinte → fechável', async () => {
    const dbClient = makeDbClient({
      logs: [{ workerId: 'w1', date: '2026-03-05' }],
      validations: [{ worker_id: 'w1', mes: '2026-04' }],
    });

    const r = await verificarMesFechavel({ mes: '2026-03', dbClient });

    expect(r.fechavel).toBe(true);
    expect(r.motivo).toBeNull();
  });
});

describe('verificarFechoMes / fecharReconciliacaoMes', () => {
  it('mês não fechável (recibos incompletos) → não grava nada', async () => {
    const dbClient = makeDbClient({
      logs: [{ workerId: 'w1', date: '2026-03-05' }],
      validations: [],
    });
    const fetchVendasFn = async () => { throw new Error('não devia chegar a calcular valores num mês não fechável'); };

    const r = await fecharReconciliacaoMes({ mes: '2026-03', dbClient, fetchVendasFn });

    expect(r.fechavel).toBe(false);
    expect(r.gravado).toBeUndefined();
  });

  it('resíduo positivo (real > escrito) → soma corretamente ao saldoAcumulado', async () => {
    const dbClient = makeDbClient({
      logs: [{ workerId: 'w1', date: '2026-03-05' }],
      validations: [{ worker_id: 'w1', mes: '2026-04', ajudas_custo_extraidas: 500, estado: 'valido' }],
      valoresPorCliente: [
        { mes: '2026-03', client_id: 'c1', valor_atribuido: 300, elegivel_na_data: true, origem: 'sistema' },
      ],
      reconciliacoes: [{ mes: '2026-02', saldo_acumulado: 100 }],
    });
    const fetchVendasFn = async () => [
      fatura({ cliente: 'Cliente A', valor: 1000, data: '2026-04-05', docNum: 'FT1', notes: '€500,00' }),
    ];

    const r = await fecharReconciliacaoMes({ mes: '2026-03', dbClient, fetchVendasFn });

    expect(r.fechavel).toBe(true);
    expect(r.totalReal).toBeCloseTo(500, 6);
    expect(r.totalEscrito).toBeCloseTo(300, 6);
    expect(r.residuoDoMes).toBeCloseTo(200, 6);
    expect(r.saldoAcumuladoAnterior).toBeCloseTo(100, 6);
    expect(r.novoSaldoAcumulado).toBeCloseTo(300, 6); // 100 + 200
    expect(r.gravado).toBe(true);
    expect(r.linhaParaGravar.saldo_acumulado).toBeCloseTo(300, 6);
    expect(r.linhaParaGravar.mes_aplicacao).toBe('2026-04');
  });

  it('resíduo negativo (real < escrito) → subtrai, saldoAcumulado pode ficar negativo', async () => {
    const dbClient = makeDbClient({
      logs: [{ workerId: 'w1', date: '2026-03-05' }],
      validations: [{ worker_id: 'w1', mes: '2026-04', ajudas_custo_extraidas: 200, estado: 'valido' }],
      valoresPorCliente: [
        { mes: '2026-03', client_id: 'c1', valor_atribuido: 500, elegivel_na_data: true, origem: 'sistema' },
      ],
      reconciliacoes: [{ mes: '2026-02', saldo_acumulado: 100 }],
    });
    const fetchVendasFn = async () => [
      fatura({ cliente: 'Cliente A', valor: 1000, data: '2026-04-05', docNum: 'FT1', notes: null }),
    ];

    const r = await fecharReconciliacaoMes({ mes: '2026-03', dbClient, fetchVendasFn });

    expect(r.totalReal).toBeCloseTo(200, 6);
    expect(r.totalEscrito).toBeCloseTo(500, 6);
    expect(r.residuoDoMes).toBeCloseTo(-300, 6);
    expect(r.novoSaldoAcumulado).toBeCloseTo(-200, 6); // 100 - 300
  });

  it('ausência de qualquer registo anterior em ajudas_reconciliacao_mensal → usa SALDO_ACUMULADO_INICIAL (-7155.94) como semente', async () => {
    const dbClient = makeDbClient({
      logs: [{ workerId: 'w1', date: '2026-03-05' }],
      validations: [{ worker_id: 'w1', mes: '2026-04', ajudas_custo_extraidas: 100, estado: 'valido' }],
      valoresPorCliente: [],
      reconciliacoes: [], // nenhum registo ainda
    });
    // Precisa de pelo menos uma fatura em mesFatura (2026-04) para o real
    // (100) ter uma linha onde ser atribuído — sem faturas nenhumas,
    // calcularValoresPorClienteMes não tem onde pôr o valor (mesmo
    // comportamento, já estabelecido, de consolidarTotalReal).
    const fetchVendasFn = async () => [
      fatura({ cliente: 'Cliente A', valor: 1000, data: '2026-04-05', docNum: 'FT1', notes: null }),
    ];

    const r = await verificarFechoMes({ mes: '2026-03', dbClient, fetchVendasFn });

    expect(SALDO_ACUMULADO_INICIAL).toBe(-7155.94);
    expect(r.saldoAcumuladoAnteriorEraSemente).toBe(true);
    expect(r.saldoAcumuladoAnterior).toBe(-7155.94);
    expect(r.novoSaldoAcumulado).toBeCloseTo(-7155.94 + 100, 6); // real=100, escrito=0
  });
});
