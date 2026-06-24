/**
 * Testes unitários para o Matching Engine da Reconciliação Bancária
 *
 * Regra 1: valor numérico exato (fatura.valor === transacao.valor)
 * Regra 2: fatura.entidade substring na transacao.descricao (case-insensitive)
 *
 * Importa a função diretamente de api/reconciliacao/matchingEngine.js
 * (ficheiro que será criado na fase GREEN).
 */
import { describe, it, expect } from 'vitest';
import { runMatchingEngine } from '../../api/reconciliacao/_matchingEngine.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeFatura(overrides = {}) {
  return {
    id: `fatura-${Math.random().toString(36).slice(2)}`,
    tipo: 'fatura',
    valor: 100.0,
    data_documento: '2026-05-01',
    descricao: 'Fatura de serviços',
    entidade: 'Empresa XYZ',
    status: 'PENDENTE',
    fonte: 'manual',
    ...overrides,
  };
}

function makeTransacao(overrides = {}) {
  return {
    data: '2026-05-10',
    descricao: 'PAGAMENTO EMPRESA XYZ REF 001',
    valor: 100.0,
    tipo: 'credito',
    ...overrides,
  };
}

// ─── Testes ──────────────────────────────────────────────────────────────────

describe('runMatchingEngine — Regra 1: valor exato', () => {
  it('deve retornar matched quando fatura e transação têm valor exato igual', () => {
    const faturas = [makeFatura({ valor: 150.0 })];
    const transacoes = [makeTransacao({ valor: 150.0 })];

    const { matched, orphan_bank, orphan_system } = runMatchingEngine(transacoes, faturas);

    expect(matched).toHaveLength(1);
    expect(matched[0].transacao).toEqual(transacoes[0]);
    expect(matched[0].fatura).toEqual(faturas[0]);
    expect(matched[0].rule).toBe('exact_value');
    expect(orphan_bank).toHaveLength(0);
    expect(orphan_system).toHaveLength(0);
  });

  it('deve retornar orphan_bank quando não há fatura com o valor da transação', () => {
    const faturas = [makeFatura({ valor: 200.0 })];
    const transacoes = [makeTransacao({ valor: 50.0 })];

    const { matched, orphan_bank, orphan_system } = runMatchingEngine(transacoes, faturas);

    expect(matched).toHaveLength(0);
    expect(orphan_bank).toHaveLength(1);
    expect(orphan_bank[0].transacao).toEqual(transacoes[0]);
    expect(orphan_bank[0].reason).toBe('no_match');
    expect(orphan_system).toHaveLength(1);
  });

  it('deve retornar orphan_system para faturas sem correspondência de transação', () => {
    const faturas = [makeFatura({ valor: 100.0 }), makeFatura({ valor: 300.0 })];
    const transacoes = [makeTransacao({ valor: 100.0 })];

    const { matched, orphan_bank, orphan_system } = runMatchingEngine(transacoes, faturas);

    expect(matched).toHaveLength(1);
    expect(orphan_bank).toHaveLength(0);
    expect(orphan_system).toHaveLength(1);
    expect(orphan_system[0].reason).toBe('no_transaction');
  });
});

describe('runMatchingEngine — Regra 2: desambiguação por descrição', () => {
  it('deve usar entidade para desambiguar quando há 2 faturas com mesmo valor', () => {
    const faturaA = makeFatura({ id: 'fat-A', valor: 150.0, entidade: 'EMPRESA XPTO' });
    const faturaB = makeFatura({ id: 'fat-B', valor: 150.0, entidade: 'OUTRA EMPRESA' });
    const transacao = makeTransacao({
      valor: 150.0,
      descricao: 'TRF EMPRESA XPTO LDA REF 2026',
    });

    const { matched, orphan_bank, orphan_system } = runMatchingEngine(
      [transacao],
      [faturaA, faturaB]
    );

    expect(matched).toHaveLength(1);
    expect(matched[0].fatura.id).toBe('fat-A');
    expect(matched[0].rule).toBe('description_match');
    expect(orphan_bank).toHaveLength(0);
    expect(orphan_system).toHaveLength(1);
    expect(orphan_system[0].fatura.id).toBe('fat-B');
  });

  it('deve retornar ambiguous quando há múltiplos candidatos e Regra 2 não resolve', () => {
    const faturaA = makeFatura({ id: 'fat-A', valor: 150.0, entidade: 'EMPRESA A' });
    const faturaB = makeFatura({ id: 'fat-B', valor: 150.0, entidade: 'EMPRESA B' });
    const transacao = makeTransacao({
      valor: 150.0,
      descricao: 'PAGAMENTO MENSAL SEM REFERENCIA',
    });

    const { matched, orphan_bank, orphan_system } = runMatchingEngine(
      [transacao],
      [faturaA, faturaB]
    );

    expect(matched).toHaveLength(0);
    expect(orphan_bank).toHaveLength(1);
    expect(orphan_bank[0].reason).toBe('ambiguous');
    expect(orphan_bank[0].candidates).toHaveLength(2);
    // Ambas as faturas ficam orphan_system pois não foram consumidas
    expect(orphan_system).toHaveLength(2);
  });

  it('matching de entidade deve ser case-insensitive', () => {
    const fatura = makeFatura({ valor: 200.0, entidade: 'empresa lda' });
    const transacao = makeTransacao({
      valor: 200.0,
      descricao: 'PAGAMENTO EMPRESA LDA MAIO 2026',
    });
    const outraFatura = makeFatura({ valor: 200.0, entidade: 'OUTRA' });

    const { matched } = runMatchingEngine([transacao], [fatura, outraFatura]);

    expect(matched).toHaveLength(1);
    expect(matched[0].fatura.entidade).toBe('empresa lda');
    expect(matched[0].rule).toBe('description_match');
  });
});

describe('runMatchingEngine — Múltiplas transações', () => {
  it('não deve reutilizar a mesma fatura para múltiplas transações', () => {
    const fatura = makeFatura({ id: 'fat-unica', valor: 100.0 });
    const transacaoA = makeTransacao({ valor: 100.0, descricao: 'TRF A' });
    const transacaoB = makeTransacao({ valor: 100.0, descricao: 'TRF B' });

    const { matched, orphan_bank } = runMatchingEngine(
      [transacaoA, transacaoB],
      [fatura]
    );

    // Primeira transação faz match, segunda fica orphan_bank (fatura já usada)
    expect(matched).toHaveLength(1);
    expect(orphan_bank).toHaveLength(1);
    expect(orphan_bank[0].reason).toBe('no_match');
  });

  it('deve processar múltiplas transações com múltiplas faturas corretamente', () => {
    const fat1 = makeFatura({ id: 'f1', valor: 100.0 });
    const fat2 = makeFatura({ id: 'f2', valor: 200.0 });
    const fat3 = makeFatura({ id: 'f3', valor: 300.0 });

    const t1 = makeTransacao({ valor: 100.0 });
    const t2 = makeTransacao({ valor: 200.0 });
    const t3 = makeTransacao({ valor: 999.0 }); // sem correspondência

    const { matched, orphan_bank, orphan_system } = runMatchingEngine(
      [t1, t2, t3],
      [fat1, fat2, fat3]
    );

    expect(matched).toHaveLength(2);
    expect(orphan_bank).toHaveLength(1);
    expect(orphan_bank[0].reason).toBe('no_match');
    expect(orphan_system).toHaveLength(1);
    expect(orphan_system[0].fatura.id).toBe('f3');
  });
});

describe('runMatchingEngine — Casos extremos', () => {
  it('deve retornar arrays vazios quando não há transações nem faturas', () => {
    const { matched, orphan_bank, orphan_system } = runMatchingEngine([], []);
    expect(matched).toHaveLength(0);
    expect(orphan_bank).toHaveLength(0);
    expect(orphan_system).toHaveLength(0);
  });

  it('deve lidar com fatura sem entidade (entidade null)', () => {
    const fat1 = makeFatura({ valor: 100.0, entidade: null });
    const fat2 = makeFatura({ valor: 100.0, entidade: 'EMPRESA X' });
    const transacao = makeTransacao({
      valor: 100.0,
      descricao: 'PAGAMENTO EMPRESA X',
    });

    const { matched, orphan_bank } = runMatchingEngine([transacao], [fat1, fat2]);

    // fat1 sem entidade não pode ser desambiguada — fat2 com "EMPRESA X" deve ganhar
    expect(matched).toHaveLength(1);
    expect(matched[0].fatura.entidade).toBe('EMPRESA X');
    expect(orphan_bank).toHaveLength(0);
  });

  it('deve lidar com transação sem descrição (descricao vazia)', () => {
    const fat1 = makeFatura({ valor: 50.0 });
    const fat2 = makeFatura({ valor: 50.0 });
    const transacao = makeTransacao({ valor: 50.0, descricao: '' });

    const { orphan_bank } = runMatchingEngine([transacao], [fat1, fat2]);

    // Sem descrição, Regra 2 não pode resolver — deve ser ambiguous
    expect(orphan_bank).toHaveLength(1);
    expect(orphan_bank[0].reason).toBe('ambiguous');
  });
});
