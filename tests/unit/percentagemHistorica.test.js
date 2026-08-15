import { describe, it, expect } from 'vitest';
import {
  verificarClientesPorDecidir,
  consolidarTotalReal,
  filtrarFaturasElegiveis,
  ratearHistorico,
  calcularPercentagemHistorica,
  executarCalculoFase1,
  extrairValorObs,
} from '../../src/lib/ajudas/percentagemHistorica.js';

// Mesmo mock de query builder encadeável usado em elegibilidade.test.js.
function makeQueryBuilder(result) {
  const builder = {
    select: () => builder,
    gte: () => builder,
    lte: () => builder,
    in: () => builder,
    eq: () => builder,
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return builder;
}

function makeDbClient({ clients = [], validations = [], logs = [] }) {
  return {
    from(table) {
      if (table === 'clients') return makeQueryBuilder({ data: clients, error: null });
      if (table === 'receipt_validations') return makeQueryBuilder({ data: validations, error: null });
      if (table === 'logs') return makeQueryBuilder({ data: logs, error: null });
      throw new Error(`tabela inesperada: ${table}`);
    },
  };
}

// Item bruto "plano" (sem envelope attributes), como confirmado em
// create-fatura.js — o mesmo formato que fetchVendasFn devolve na
// implementação real (fetchVendasTOConline).
function fatura({ documentType = 'FT', cliente, valor, data, notes = null, docNum }) {
  return {
    document_type_name: documentType,
    customer_business_name: cliente,
    gross_total: valor,
    date: data,
    notes,
    document_number: docNum,
  };
}

describe('verificarClientesPorDecidir (gate fail-closed)', () => {
  it('bloqueia quando há cliente por decidir', async () => {
    const dbClient = makeDbClient({
      clients: [{ id: 'c1', name: 'Cliente A', elegivel_ajudas_custo: null }],
    });
    const fetchVendasFn = async () => [
      fatura({ cliente: 'Cliente A', valor: 1000, data: '2026-05-10', docNum: 'FT1' }),
    ];

    const r = await verificarClientesPorDecidir({ periodoInicio: '2026-05', periodoFim: '2026-05', dbClient, fetchVendasFn });

    expect(r.bloqueado).toBe(true);
    expect(r.clientesPorDecidir).toEqual([{ clientId: 'c1', nome: 'Cliente A' }]);
  });

  it('permite quando todos os clientes com faturas no período estão decididos (true ou false)', async () => {
    const dbClient = makeDbClient({
      clients: [
        { id: 'c1', name: 'Cliente Elegível', elegivel_ajudas_custo: true },
        { id: 'c2', name: 'Cliente Não Elegível', elegivel_ajudas_custo: false },
      ],
    });
    const fetchVendasFn = async () => [
      fatura({ cliente: 'Cliente Elegível', valor: 1000, data: '2026-05-10', docNum: 'FT1' }),
      fatura({ cliente: 'Cliente Não Elegível', valor: 500, data: '2026-05-11', docNum: 'FT2' }),
    ];

    const r = await verificarClientesPorDecidir({ periodoInicio: '2026-05', periodoFim: '2026-05', dbClient, fetchVendasFn });

    expect(r.bloqueado).toBe(false);
    expect(r.clientesPorDecidir).toEqual([]);
  });

  it('ignora documentos que não são faturas de receita (nota de crédito) para efeitos do gate', async () => {
    const dbClient = makeDbClient({
      clients: [{ id: 'c1', name: 'Cliente A', elegivel_ajudas_custo: null }],
    });
    const fetchVendasFn = async () => [
      fatura({ documentType: 'NC', cliente: 'Cliente A', valor: 200, data: '2026-05-12', docNum: 'NC1' }),
    ];

    const r = await verificarClientesPorDecidir({ periodoInicio: '2026-05', periodoFim: '2026-05', dbClient, fetchVendasFn });

    // Nota de crédito não conta como fatura de receita → não gera bloqueio
    expect(r.bloqueado).toBe(false);
  });
});

describe('consolidarTotalReal', () => {
  it('mês com dados incompletos entra em mesesExcluidos e não conta no total', async () => {
    const dbClient = makeDbClient({
      logs: [
        { workerId: 'w1', date: '2026-05-05' }, // maio: w1 trabalhou
        { workerId: 'w2', date: '2026-06-05' }, // junho: w2 trabalhou, sem validação
      ],
      validations: [
        { worker_id: 'w1', mes: '2026-05', ajudas_custo_extraidas: 150, estado: 'valido' },
        // w2 em junho não tem receipt_validations nenhuma → junho fica incompleto
      ],
    });

    const r = await consolidarTotalReal({ periodoInicio: '2026-05', periodoFim: '2026-06', dbClient });

    expect(r.mesesIncluidos).toEqual(['2026-05']);
    expect(r.mesesExcluidos).toHaveLength(1);
    expect(r.mesesExcluidos[0].mes).toBe('2026-06');
    expect(r.mesesExcluidos[0].motivo).toMatch(/w2/);
    // total só conta maio (150), não inclui nada de junho
    expect(r.totalReal).toBeCloseTo(150, 6);
  });

  it('mês com validação em estado != valido também é excluído', async () => {
    const dbClient = makeDbClient({
      logs: [{ workerId: 'w1', date: '2026-05-05' }],
      validations: [{ worker_id: 'w1', mes: '2026-05', ajudas_custo_extraidas: 150, estado: 'erro' }],
    });

    const r = await consolidarTotalReal({ periodoInicio: '2026-05', periodoFim: '2026-05', dbClient });

    expect(r.mesesIncluidos).toEqual([]);
    expect(r.mesesExcluidos).toHaveLength(1);
    expect(r.totalReal).toBe(0);
  });
});

describe('filtrarFaturasElegiveis / totalFaturamento', () => {
  it('faturamento de cliente não elegível nunca entra no denominador', () => {
    const faturas = [
      { clientId: 'c1', clienteNome: 'Elegível', valor: 1000, elegivel: true },
      { clientId: 'c2', clienteNome: 'Não elegível', valor: 5000, elegivel: false },
    ];

    const elegiveis = filtrarFaturasElegiveis(faturas);
    const totalFaturamento = elegiveis.reduce((s, f) => s + f.valor, 0);

    expect(elegiveis).toHaveLength(1);
    expect(elegiveis[0].clientId).toBe('c1');
    expect(totalFaturamento).toBe(1000); // os 5000 do cliente não elegível NUNCA entram
  });

  it('via executarCalculoFase1 (fim a fim): totalBrutoReferencia exclui o não elegível', async () => {
    const dbClient = makeDbClient({
      clients: [
        { id: 'c1', name: 'Elegível', elegivel_ajudas_custo: true },
        { id: 'c2', name: 'Não Elegível', elegivel_ajudas_custo: false },
      ],
      logs: [{ workerId: 'w1', date: '2026-05-05' }],
      validations: [{ worker_id: 'w1', mes: '2026-05', ajudas_custo_extraidas: 100, estado: 'valido' }],
    });
    const fetchVendasFn = async () => [
      fatura({ cliente: 'Elegível', valor: 1000, data: '2026-05-10', docNum: 'FT1' }),
      fatura({ cliente: 'Não Elegível', valor: 5000, data: '2026-05-11', docNum: 'FT2' }),
    ];

    const r = await executarCalculoFase1({ periodoInicio: '2026-05', periodoFim: '2026-05', dbClient, fetchVendasFn });

    expect(r.bloqueado).toBe(false);
    expect(r.totalBrutoReferencia).toBe(1000);
    expect(r.clientesElegiveis).toEqual(['c1']);
  });
});

describe('ratearHistorico', () => {
  it('fatura sem valor manual prévio na observação ainda assim entra no rateio (valor_observacao_manual fica null)', () => {
    const faturasElegiveisDoPeriodo = [
      { clientId: 'c1', faturaId: 'FT1', mes: '2026-05', valor: 600, valorObservacaoManual: null },
      { clientId: 'c2', faturaId: 'FT2', mes: '2026-05', valor: 400, valorObservacaoManual: 45.5 },
    ];

    const linhas = ratearHistorico({ totalReal: 100, faturasElegiveisDoPeriodo });

    expect(linhas).toHaveLength(2);
    const l1 = linhas.find(l => l.client_id === 'c1');
    const l2 = linhas.find(l => l.client_id === 'c2');

    expect(l1.valor_observacao_manual).toBeNull();
    expect(l1.valor_estimado_bruto).toBeCloseTo(60, 6); // 600/1000 × 100
    expect(l1.origem).toBe('historico');
    expect(l1.status).toBe('historico');

    expect(l2.valor_observacao_manual).toBeCloseTo(45.5, 6);
    expect(l2.valor_estimado_bruto).toBeCloseTo(40, 6); // 400/1000 × 100
  });
});

describe('calcularPercentagemHistorica', () => {
  it('calcula a percentagem como totalReal / totalFaturamento', () => {
    const r = calcularPercentagemHistorica({ totalReal: 85, totalFaturamento: 1000 });
    expect(r.percentagem).toBeCloseTo(0.085, 6);
    expect(r.totalAjudasReal).toBe(85);
    expect(r.totalBrutoReferencia).toBe(1000);
  });

  it('totalFaturamento 0 → percentagem 0, sem divisão por zero', () => {
    const r = calcularPercentagemHistorica({ totalReal: 85, totalFaturamento: 0 });
    expect(r.percentagem).toBe(0);
  });
});

describe('extrairValorObs', () => {
  it('prioriza o padrão €X.XXX,XX sobre um número genérico no texto', () => {
    expect(extrairValorObs('Ref. 2026 — €1.234,56 incluídos')).toBeCloseTo(1234.56, 6);
  });

  it('sem observação → null', () => {
    expect(extrairValorObs(null)).toBeNull();
    expect(extrairValorObs('')).toBeNull();
  });
});
