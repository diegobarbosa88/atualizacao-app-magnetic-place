import { describe, it, expect } from 'vitest';
import { runMatchingEngine } from '../../../api/reconciliacao/_matchingEngine.js';

function makeFatura(overrides = {}) {
  return {
    id: `f-${Math.random().toString(36).slice(2)}`,
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

function makeTx(overrides = {}) {
  return {
    data: '2026-05-10',
    descricao: 'PAGAMENTO EMPRESA XYZ REF 001',
    valor: 100.0,
    tipo: 'credito',
    ...overrides,
  };
}

describe('runMatchingEngine — Regra 1: valor exato', () => {
  it('faz match quando valor é idêntico', () => {
    const faturas = [makeFatura({ valor: 150.0 })];
    const transacoes = [makeTx({ valor: 150.0 })];
    const { matched, orphan_bank, orphan_system } = runMatchingEngine(transacoes, faturas);
    expect(matched).toHaveLength(1);
    expect(orphan_bank).toHaveLength(0);
    expect(orphan_system).toHaveLength(0);
    expect(matched[0].rule).toBe('exact_value');
  });

  it('faz match com diferença de 1 cêntimo (tolerância float)', () => {
    const faturas = [makeFatura({ valor: 100.00 })];
    const transacoes = [makeTx({ valor: 100.01 })];
    const { matched } = runMatchingEngine(transacoes, faturas);
    expect(matched).toHaveLength(1);
  });

  it('orphan_bank quando nenhuma fatura tem o mesmo valor', () => {
    const faturas = [makeFatura({ valor: 200.0 })];
    const transacoes = [makeTx({ valor: 150.0 })];
    const { matched, orphan_bank } = runMatchingEngine(transacoes, faturas);
    expect(matched).toHaveLength(0);
    expect(orphan_bank).toHaveLength(1);
    expect(orphan_bank[0].reason).toBe('no_match');
  });

  it('não reutiliza a mesma fatura em duas transações', () => {
    const fatura = makeFatura({ valor: 100.0 });
    const transacoes = [makeTx({ valor: 100.0 }), makeTx({ valor: 100.0 })];
    const { matched, orphan_bank } = runMatchingEngine(transacoes, [fatura]);
    expect(matched).toHaveLength(1);
    expect(orphan_bank).toHaveLength(1);
  });
});

describe('runMatchingEngine — Regra 2: desambiguação por entidade', () => {
  it('usa descrição para desambiguar quando dois candidatos têm o mesmo valor', () => {
    const f1 = makeFatura({ id: 'f1', valor: 100.0, entidade: 'Empresa ABC' });
    const f2 = makeFatura({ id: 'f2', valor: 100.0, entidade: 'Empresa XYZ' });
    const tx = makeTx({ valor: 100.0, descricao: 'TRF IMEDIATA DE EMPRESA XYZ' });
    const { matched } = runMatchingEngine([tx], [f1, f2]);
    expect(matched).toHaveLength(1);
    expect(matched[0].fatura.id).toBe('f2');
    expect(matched[0].rule).toBe('description_match');
  });

  it('extrai entidade após "TRF IMEDIATA DE"', () => {
    const f1 = makeFatura({ id: 'f1', valor: 100.0, entidade: 'ABC Lda' });
    const f2 = makeFatura({ id: 'f2', valor: 100.0, entidade: 'XYZ Sa' });
    const tx = makeTx({ valor: 100.0, descricao: 'TRF IMEDIATA DE XYZ SA REFERENCIA 123' });
    const { matched } = runMatchingEngine([tx], [f1, f2]);
    expect(matched).toHaveLength(1);
    expect(matched[0].fatura.id).toBe('f2');
  });

  it('match por alias quando entidade não aparece diretamente na descrição', () => {
    const f1 = makeFatura({ id: 'f1', valor: 100.0, entidade: 'Empresa Interna' });
    const f2 = makeFatura({ id: 'f2', valor: 100.0, entidade: 'Outra Empresa' });
    const tx = makeTx({ valor: 100.0, descricao: 'TRF DE ALIAS BANCO' });
    const aliases = [{ bank_name: 'ALIAS BANCO', system_entity: 'Empresa Interna' }];
    const { matched } = runMatchingEngine([tx], [f1, f2], aliases);
    expect(matched).toHaveLength(1);
    expect(matched[0].rule).toBe('alias_match');
    expect(matched[0].fatura.id).toBe('f1');
  });
});

describe('runMatchingEngine — Regra 3: data mais próxima', () => {
  it('escolhe fatura com data mais próxima quando descrição não desambigua', () => {
    const f1 = makeFatura({ id: 'f1', valor: 100.0, entidade: null, data_documento: '2026-01-01' });
    const f2 = makeFatura({ id: 'f2', valor: 100.0, entidade: null, data_documento: '2026-05-09' });
    const tx = makeTx({ valor: 100.0, data: '2026-05-10', descricao: 'PAGAMENTO SEM ENTIDADE' });
    const { matched } = runMatchingEngine([tx], [f1, f2]);
    expect(matched).toHaveLength(1);
    expect(matched[0].fatura.id).toBe('f2');
    expect(matched[0].rule).toBe('date_proximity');
  });
});

describe('runMatchingEngine — orphan_system', () => {
  it('faturas sem transação ficam em orphan_system', () => {
    const faturas = [makeFatura({ valor: 300.0 }), makeFatura({ valor: 400.0 })];
    const transacoes = [makeTx({ valor: 300.0 })];
    const { orphan_system } = runMatchingEngine(transacoes, faturas);
    expect(orphan_system).toHaveLength(1);
    expect(orphan_system[0].fatura.valor).toBe(400.0);
    expect(orphan_system[0].reason).toBe('no_transaction');
  });

  it('array vazio de transações coloca todas as faturas em orphan_system', () => {
    const faturas = [makeFatura(), makeFatura()];
    const { matched, orphan_bank, orphan_system } = runMatchingEngine([], faturas);
    expect(matched).toHaveLength(0);
    expect(orphan_bank).toHaveLength(0);
    expect(orphan_system).toHaveLength(2);
  });
});
