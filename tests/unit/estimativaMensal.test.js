import { describe, it, expect } from 'vitest';
import { calcularEstimativaMensal } from '../../src/lib/ajudas/estimativaMensal.js';

// Mock de query builder encadeável, com suporte a .maybeSingle(), .in(), .order(), .limit().
function makeQueryBuilder(result) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    in: () => builder,
    order: () => builder,
    limit: () => builder,
    maybeSingle: () => Promise.resolve(result.single ?? result),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return builder;
}

// `ultimoReconc`: linha { mes, saldo_acumulado } que o "último fecho de
// mês" devolveria (ordenado por mes desc, limit 1) — null simula ausência
// de qualquer registo (usa SALDO_ACUMULADO_INICIAL como semente).
function makeDbClient({ clients = [], percentagemAtiva = null, ultimoReconc = null }) {
  return {
    from(table) {
      if (table === 'clients') return makeQueryBuilder({ data: clients, error: null });
      if (table === 'ajudas_percentagem_historica') {
        return makeQueryBuilder({ single: { data: percentagemAtiva, error: null } });
      }
      if (table === 'ajudas_reconciliacao_mensal') {
        return makeQueryBuilder({ single: { data: ultimoReconc, error: null } });
      }
      throw new Error(`tabela inesperada: ${table}`);
    },
  };
}

describe('calcularEstimativaMensal', () => {
  it('sem % ativa → todas as linhas do mês ficam bloqueadas', async () => {
    const dbClient = makeDbClient({
      clients: [{ id: 'c1', elegivel_ajudas_custo: true }],
      percentagemAtiva: null,
    });
    const faturasDoMes = [{ clientId: 'c1', faturaId: null, valorFaturado: 1000 }];

    const r = await calcularEstimativaMensal({ mes: '2026-07', faturasDoMes, dbClient });

    expect(r.percentagemUsada).toBeNull();
    expect(r.linhas).toHaveLength(1);
    expect(r.linhas[0].status).toBe('bloqueado');
    expect(r.linhas[0].motivoBloqueio).toBe('sem percentagem historica ativa');
  });

  it('cliente elegivel_ajudas_custo=NULL → linha bloqueada; cliente false → ausente do rateio (não bloqueada)', async () => {
    const dbClient = makeDbClient({
      clients: [
        { id: 'c1', elegivel_ajudas_custo: true },
        { id: 'c2', elegivel_ajudas_custo: false },
        { id: 'c3', elegivel_ajudas_custo: null },
      ],
      percentagemAtiva: { id: 'pct1', percentagem: 0.1 },
    });
    const faturasDoMes = [
      { clientId: 'c1', faturaId: null, valorFaturado: 1000 },
      { clientId: 'c2', faturaId: null, valorFaturado: 5000 },
      { clientId: 'c3', faturaId: null, valorFaturado: 2000 },
    ];

    const r = await calcularEstimativaMensal({ mes: '2026-07', faturasDoMes, dbClient });

    expect(r.linhas).toHaveLength(2); // c2 (não elegível) nunca aparece
    const linhaPorDecidir = r.linhas.find(l => l.clientId === 'c3');
    expect(linhaPorDecidir.status).toBe('bloqueado');
    expect(linhaPorDecidir.motivoBloqueio).toBe('cliente sem decisao de elegibilidade');

    const linhaC2 = r.linhas.find(l => l.clientId === 'c2');
    expect(linhaC2).toBeUndefined();

    const linhaElegivel = r.linhas.find(l => l.clientId === 'c1');
    expect(linhaElegivel.status).toBe('calculado');
    expect(linhaElegivel.valorEstimadoBruto).toBeCloseTo(100, 6); // 1000 × 10%, sozinho no rateio elegível
  });

  it('cliente sem registo em `clients` (não encontrado) → bloqueado, tratado como "por decidir"', async () => {
    const dbClient = makeDbClient({
      clients: [], // c1 não existe
      percentagemAtiva: { id: 'pct1', percentagem: 0.1 },
    });
    const faturasDoMes = [{ clientId: 'c1', faturaId: null, valorFaturado: 1000 }];

    const r = await calcularEstimativaMensal({ mes: '2026-07', faturasDoMes, dbClient });

    expect(r.linhas).toHaveLength(1);
    expect(r.linhas[0].status).toBe('bloqueado');
    expect(r.linhas[0].motivoBloqueio).toBe('cliente sem decisao de elegibilidade');
  });

  it('faturasDoMes vazio → sem linhas, sem erro', async () => {
    const dbClient = makeDbClient({ percentagemAtiva: { id: 'pct1', percentagem: 0.1 } });
    const r = await calcularEstimativaMensal({ mes: '2026-07', faturasDoMes: [], dbClient });
    expect(r.linhas).toEqual([]);
  });

  // Fase 3 — o resíduo pendente deixou de ser um valor livre somado; passa
  // a ser o saldoAcumulado do último fecho de mês, aplicado como
  // RESTRIÇÃO (max(0, estimativaBruta + saldoAcumulado)).

  describe('saldoAcumulado — restrição, não soma livre (Fase 3)', () => {
    it('nenhum registo em ajudas_reconciliacao_mensal → usa SALDO_ACUMULADO_INICIAL (-7155.94) como semente, sinalizado em residuoOrigem', async () => {
      const dbClient = makeDbClient({
        clients: [{ id: 'c1', elegivel_ajudas_custo: true }],
        percentagemAtiva: { id: 'pct1', percentagem: 0.1 },
        ultimoReconc: null,
      });
      const faturasDoMes = [{ clientId: 'c1', faturaId: null, valorFaturado: 1000 }]; // estimativaBruta = 100

      const r = await calcularEstimativaMensal({ mes: '2026-08', faturasDoMes, dbClient });

      // 100 + (-7155.94) é muito negativo → max(0, ...) = 0
      expect(r.linhas[0].valorFinal).toBe(0);
      expect(r.linhas[0].valorEstimadoBruto).toBeCloseTo(100, 6);
      expect(r.linhas[0].residuoAplicado).toBeCloseTo(-100, 6); // ajuste que zera a estimativa bruta
      expect(r.residuoOrigem.semente).toBe(true);
      expect(r.residuoOrigem.saldoAcumuladoDisponivel).toBe(-7155.94);
    });

    it('saldoAcumulado muito negativo (maior em módulo do que a estimativa bruta) → estimativa do mês fica em 0, nunca negativa', async () => {
      const dbClient = makeDbClient({
        clients: [{ id: 'c1', elegivel_ajudas_custo: true }],
        percentagemAtiva: { id: 'pct1', percentagem: 0.1 },
        ultimoReconc: { mes: '2026-06', saldo_acumulado: -1000 }, // dívida bem maior que a estimativa bruta (100)
      });
      const faturasDoMes = [{ clientId: 'c1', faturaId: null, valorFaturado: 1000 }]; // estimativaBruta = 100

      const r = await calcularEstimativaMensal({ mes: '2026-08', faturasDoMes, dbClient });

      expect(r.linhas[0].valorFinal).toBe(0); // nunca negativa, mesmo com -1000+100=-900
      expect(r.residuoOrigem.saldoAcumuladoDisponivel).toBe(-1000);
    });

    it('saldoAcumulado negativo mas menor em módulo do que a estimativa bruta → REDUZ a estimativa pelo valor do saldo', async () => {
      const dbClient = makeDbClient({
        clients: [{ id: 'c1', elegivel_ajudas_custo: true }],
        percentagemAtiva: { id: 'pct1', percentagem: 0.1 },
        ultimoReconc: { mes: '2026-06', saldo_acumulado: -30 },
      });
      const faturasDoMes = [{ clientId: 'c1', faturaId: null, valorFaturado: 1000 }]; // estimativaBruta = 100

      const r = await calcularEstimativaMensal({ mes: '2026-08', faturasDoMes, dbClient });

      expect(r.linhas[0].valorEstimadoBruto).toBeCloseTo(100, 6);
      expect(r.linhas[0].residuoAplicado).toBeCloseTo(-30, 6);
      expect(r.linhas[0].valorFinal).toBeCloseTo(70, 6); // 100 - 30
    });

    it('saldoAcumulado positivo → soma-se à estimativa bruta normalmente, sem teto', async () => {
      const dbClient = makeDbClient({
        clients: [
          { id: 'c1', elegivel_ajudas_custo: true },
          { id: 'c2', elegivel_ajudas_custo: true },
        ],
        percentagemAtiva: { id: 'pct1', percentagem: 0.1 },
        ultimoReconc: { mes: '2026-06', saldo_acumulado: 100 },
      });
      const faturasDoMes = [
        { clientId: 'c1', faturaId: null, valorFaturado: 6000 }, // 60% do faturamento elegível
        { clientId: 'c2', faturaId: null, valorFaturado: 4000 }, // 40%
      ];

      const r = await calcularEstimativaMensal({ mes: '2026-08', faturasDoMes, dbClient });

      // estimativaBruta total = 1000 (10% de 10000); ajuste total = +100 → ajustada = 1100
      expect(r.percentagemUsada).toBe(0.1);
      const linhaA = r.linhas.find(l => l.clientId === 'c1');
      const linhaB = r.linhas.find(l => l.clientId === 'c2');

      expect(linhaA.valorEstimadoBruto).toBeCloseTo(600, 6);
      expect(linhaB.valorEstimadoBruto).toBeCloseTo(400, 6);
      expect(linhaA.residuoAplicado).toBeCloseTo(60, 6); // 60% de +100
      expect(linhaB.residuoAplicado).toBeCloseTo(40, 6); // 40% de +100
      expect(linhaA.valorFinal).toBeCloseTo(660, 6);
      expect(linhaB.valorFinal).toBeCloseTo(440, 6);
    });

    it('saldoAcumulado = 0 → estimativa fica igual à bruta, sem ajuste', async () => {
      const dbClient = makeDbClient({
        clients: [{ id: 'c1', elegivel_ajudas_custo: true }],
        percentagemAtiva: { id: 'pct1', percentagem: 0.1 },
        ultimoReconc: { mes: '2026-06', saldo_acumulado: 0 },
      });
      const faturasDoMes = [{ clientId: 'c1', faturaId: null, valorFaturado: 1000 }];

      const r = await calcularEstimativaMensal({ mes: '2026-08', faturasDoMes, dbClient });

      expect(r.linhas[0].residuoAplicado).toBeCloseTo(0, 6);
      expect(r.linhas[0].valorFinal).toBeCloseTo(100, 6);
      expect(r.residuoOrigem.semente).toBeUndefined();
      expect(r.residuoOrigem.mes).toBe('2026-06');
    });
  });

  it('uma linha bloqueada não impede o cálculo das restantes', async () => {
    const dbClient = makeDbClient({
      clients: [
        { id: 'c1', elegivel_ajudas_custo: true },
        { id: 'c2', elegivel_ajudas_custo: null },
      ],
      percentagemAtiva: { id: 'pct1', percentagem: 0.2 },
      ultimoReconc: { mes: '2026-06', saldo_acumulado: 0 },
    });
    const faturasDoMes = [
      { clientId: 'c1', faturaId: null, valorFaturado: 1000 },
      { clientId: 'c2', faturaId: null, valorFaturado: 500 },
    ];

    const r = await calcularEstimativaMensal({ mes: '2026-07', faturasDoMes, dbClient });

    expect(r.linhas).toHaveLength(2);
    const calculada = r.linhas.find(l => l.status === 'calculado');
    const bloqueada = r.linhas.find(l => l.status === 'bloqueado');
    expect(calculada.valorEstimadoBruto).toBeCloseTo(200, 6); // 1000 × 20%
    expect(bloqueada.motivoBloqueio).toBe('cliente sem decisao de elegibilidade');
  });
});
