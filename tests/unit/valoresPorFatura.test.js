import { describe, it, expect } from 'vitest';
import { calcularValoresPorClienteMes, mesSeguinte, mesAtualISO } from '../../src/lib/ajudas/valoresPorFatura.js';

// Mesmo mock de query builder encadeável usado em percentagemHistorica.test.js.
function makeQueryBuilder(result) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return builder;
}

function makeDbClient({ clients = [], validations = [] }) {
  return {
    from(table) {
      if (table === 'clients') return makeQueryBuilder({ data: clients, error: null });
      if (table === 'receipt_validations') return makeQueryBuilder({ data: validations, error: null });
      throw new Error(`tabela inesperada: ${table}`);
    },
  };
}

// Item bruto "plano" (sem envelope attributes), como confirmado em
// create-fatura.js — mesmo formato usado em percentagemHistorica.test.js.
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

describe('mesSeguinte', () => {
  it('avança um mês normal', () => {
    expect(mesSeguinte('2026-03')).toBe('2026-04');
  });
  it('vira o ano em dezembro', () => {
    expect(mesSeguinte('2025-12')).toBe('2026-01');
  });
});

describe('calcularValoresPorClienteMes — duplo desvio M→M-1', () => {
  it('busca faturas e receipt_validations do MÊS SEGUINTE (mesFatura), não do mês pedido — mas grava `mes` como o mês de referência nas linhas', async () => {
    const dbClient = makeDbClient({
      clients: [{ id: 'c1', name: 'Cliente A', elegivel_ajudas_custo: true }],
      validations: [{ ajudas_custo_extraidas: 500, estado: 'valido' }],
    });
    // Fatura datada de 2020-04 (mesFatura) — declara o trabalho de 2020-03 (mes pedido)
    const fetchVendasFn = async ({ dataDe }) => {
      expect(dataDe).toBe('2020-04-01'); // confirma que buscou o mês seguinte, não o mês pedido
      return [fatura({ cliente: 'Cliente A', valor: 1000, data: '2020-04-05', docNum: 'FT1', notes: '€500,00' })];
    };

    const r = await calcularValoresPorClienteMes({ mes: '2020-03', dbClient, fetchVendasFn });

    expect(r.dadosInsuficientes).toBe(false);
    expect(r.mesFatura).toBe('2020-04');
    expect(r.totalRealRecibos).toBeCloseTo(500, 6);
    expect(r.totalDeclarado).toBeCloseTo(500, 6);
    expect(r.linhas).toHaveLength(1);
    expect(r.linhas[0].mes).toBe('2020-03'); // mês de REFERÊNCIA, não mesFatura
    expect(r.linhas[0].fatura_id).toBe('FT1');
    expect(r.linhas[0].origem).toBe('declarado');
  });

  it('mesFatura no mês corrente (ou futuro) → dadosInsuficientes=true, nada calculado, saldo transporta-se inalterado', async () => {
    const dbClient = makeDbClient({ clients: [], validations: [] });
    const fetchVendasFn = async () => { throw new Error('não devia chamar fetchVendasFn quando dadosInsuficientes'); };

    // 2099-01 garante mesFatura (2099-02) sempre no futuro, independente da data real de execução do teste.
    const r = await calcularValoresPorClienteMes({ mes: '2099-01', dbClient, fetchVendasFn, saldoAcumuladoEntrada: 77 });

    expect(r.dadosInsuficientes).toBe(true);
    expect(r.linhas).toEqual([]);
    expect(r.saldoAcumuladoEntrada).toBe(77);
    expect(r.saldoAcumuladoSaida).toBe(77); // inalterado
  });

  it('mesAtualISO() devolve o mês corrente real no formato YYYY-MM', () => {
    const d = new Date();
    const esperado = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    expect(mesAtualISO()).toBe(esperado);
  });
});

describe('calcularValoresPorClienteMes — saldo acumulado', () => {
  const dbClientBase = (validations) => makeDbClient({
    clients: [
      { id: 'c1', name: 'Cliente A', elegivel_ajudas_custo: true },
      { id: 'c2', name: 'Cliente B', elegivel_ajudas_custo: true },
    ],
    validations,
  });

  it('saldoAcumuladoEntrada soma-se ao resíduo bruto ANTES de distribuir', async () => {
    // real=100, declarado=0 → residuoBruto=100; com saldoAcumuladoEntrada=50 → saldoAntes=150
    const dbClient = dbClientBase([{ ajudas_custo_extraidas: 100, estado: 'valido' }]);
    const fetchVendasFn = async () => [
      fatura({ cliente: 'Cliente A', valor: 1000, data: '2020-04-05', docNum: 'FT1', notes: null }),
    ];

    const r = await calcularValoresPorClienteMes({ mes: '2020-03', dbClient, fetchVendasFn, saldoAcumuladoEntrada: 50 });

    expect(r.residuoBruto).toBeCloseTo(100, 6);
    expect(r.linhas[0].valor_atribuido).toBeCloseTo(150, 6); // 50 + 100, única fatura sem declaração
    expect(r.saldoAcumuladoSaida).toBe(0); // todo alocado
  });

  it('saldo <= 0 → não distribui nada este mês; faturas sem declaração ficam a 0; saldo transporta-se inalterado', async () => {
    // real=50, declarado=0 → residuoBruto=50; saldoAcumuladoEntrada=-200 → saldoAntes=-150 (negativo)
    const dbClient = dbClientBase([{ ajudas_custo_extraidas: 50, estado: 'valido' }]);
    const fetchVendasFn = async () => [
      fatura({ cliente: 'Cliente A', valor: 1000, data: '2020-04-05', docNum: 'FT1', notes: null }),
    ];

    const r = await calcularValoresPorClienteMes({ mes: '2020-03', dbClient, fetchVendasFn, saldoAcumuladoEntrada: -200 });

    expect(r.linhas[0].valor_atribuido).toBe(0);
    expect(r.saldoAcumuladoSaida).toBeCloseTo(-150, 6); // inalterado, transporta para o mês seguinte
  });

  it('saldo positivo mas SEM faturas sem declaração para o receber → saldo transporta-se sem zerar', async () => {
    const dbClient = dbClientBase([{ ajudas_custo_extraidas: 500, estado: 'valido' }]);
    // Única fatura do mês já tem valor declarado — nenhuma "sem declaração" disponível
    const fetchVendasFn = async () => [
      fatura({ cliente: 'Cliente A', valor: 1000, data: '2020-04-05', docNum: 'FT1', notes: '€100,00' }),
    ];

    const r = await calcularValoresPorClienteMes({ mes: '2020-03', dbClient, fetchVendasFn, saldoAcumuladoEntrada: 0 });

    // residuoBruto = 500 - 100 = 400, mas não há fatura sem declaração para o receber
    expect(r.residuoBruto).toBeCloseTo(400, 6);
    expect(r.saldoAcumuladoSaida).toBeCloseTo(400, 6); // transporta-se, não zera
    expect(r.linhas).toHaveLength(1);
    expect(r.linhas[0].origem).toBe('declarado');
  });

  it('rateio do saldo entre faturas sem declaração é proporcional ao valor_fatura, elegíveis e não elegíveis juntos', async () => {
    const dbClient = makeDbClient({
      clients: [
        { id: 'c1', name: 'Cliente A', elegivel_ajudas_custo: true },
        { id: 'c2', name: 'Cliente B', elegivel_ajudas_custo: false }, // não elegível — participa do rateio na mesma
      ],
      validations: [{ ajudas_custo_extraidas: 100, estado: 'valido' }],
    });
    const fetchVendasFn = async () => [
      fatura({ cliente: 'Cliente A', valor: 6000, data: '2020-04-05', docNum: 'FT1', notes: null }),
      fatura({ cliente: 'Cliente B', valor: 4000, data: '2020-04-06', docNum: 'FT2', notes: null }),
    ];

    const r = await calcularValoresPorClienteMes({ mes: '2020-03', dbClient, fetchVendasFn });

    const l1 = r.linhas.find(l => l.fatura_id === 'FT1');
    const l2 = r.linhas.find(l => l.fatura_id === 'FT2');
    expect(l1.valor_atribuido).toBeCloseTo(60, 6); // 100 × 6000/10000
    expect(l2.valor_atribuido).toBeCloseTo(40, 6); // 100 × 4000/10000
    expect(l1.elegivel_na_data).toBe(true);
    expect(l2.elegivel_na_data).toBe(false);
  });
});
