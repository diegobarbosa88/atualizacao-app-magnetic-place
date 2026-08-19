import { describe, it, expect } from 'vitest';
import { separarPorWorker } from '../../src/utils/validacaoHelpers.js';

describe('separarPorWorker', () => {
  it('separa resultados com worker resolvido dos que não têm — nenhum resultado sem worker fica em comWorker', () => {
    const resultados = [
      { nif: '111', nome: 'ANDRE MARCOS SILVA', worker: { id: 'w1', name: 'ANDRE MARCOS SILVA' } },
      { nif: '222', nome: 'ALEX SANTANA SOUZA', worker: null }, // encontrarWorker() não encontrou correspondência
      { nif: '333', nome: 'CASSIO COSTA', worker: { id: 'w3', name: 'CASSIO COSTA' } },
    ];

    const { comWorker, semWorker } = separarPorWorker(resultados);

    expect(comWorker).toHaveLength(2);
    expect(comWorker.every(r => r.worker)).toBe(true);
    expect(comWorker.map(r => r.nif)).toEqual(['111', '333']);

    expect(semWorker).toHaveLength(1);
    expect(semWorker[0].nif).toBe('222');
    expect(semWorker.every(r => !r.worker)).toBe(true);
  });

  it('todos os resultados sem worker → comWorker vazio, nada seria gravado', () => {
    const resultados = [
      { nif: '111', nome: 'X', worker: null },
      { nif: '222', nome: 'Y', worker: undefined },
    ];

    const { comWorker, semWorker } = separarPorWorker(resultados);

    expect(comWorker).toEqual([]);
    expect(semWorker).toHaveLength(2);
  });

  it('todos os resultados com worker → semWorker vazio, nada bloqueado', () => {
    const resultados = [
      { nif: '111', worker: { id: 'w1' } },
      { nif: '222', worker: { id: 'w2' } },
    ];

    const { comWorker, semWorker } = separarPorWorker(resultados);

    expect(comWorker).toHaveLength(2);
    expect(semWorker).toEqual([]);
  });

  it('lista vazia ou undefined não rebenta', () => {
    expect(separarPorWorker([])).toEqual({ comWorker: [], semWorker: [] });
    expect(separarPorWorker(undefined)).toEqual({ comWorker: [], semWorker: [] });
  });
});
