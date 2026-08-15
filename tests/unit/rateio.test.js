import { describe, it, expect } from 'vitest';
import { ratearProporcional } from '../../src/lib/ajudas/rateio.js';

describe('ratearProporcional', () => {
  it('distribui o total proporcionalmente ao valor de cada item', () => {
    const itens = [
      { clientId: 'A', valor: 600 },
      { clientId: 'B', valor: 400 },
    ];
    const rateadas = ratearProporcional(1000, itens);

    expect(rateadas.find(i => i.clientId === 'A').valorRateado).toBeCloseTo(600, 6);
    expect(rateadas.find(i => i.clientId === 'B').valorRateado).toBeCloseTo(400, 6);
  });

  it('a soma dos valores rateados bate com o total, mesmo com valores não redondos', () => {
    const itens = [
      { clientId: 'A', valor: 333.33 },
      { clientId: 'B', valor: 111.11 },
      { clientId: 'C', valor: 777.77 },
    ];
    const rateadas = ratearProporcional(850.5, itens);
    const soma = rateadas.reduce((s, i) => s + i.valorRateado, 0);
    expect(soma).toBeCloseTo(850.5, 6);
  });

  it('sem itens → devolve array vazio, sem erro', () => {
    expect(ratearProporcional(1000, [])).toEqual([]);
  });

  it('soma dos valores é 0 → todos os itens ficam com valorRateado 0 (nunca divide por zero)', () => {
    const itens = [
      { clientId: 'A', valor: 0 },
      { clientId: 'B', valor: 0 },
    ];
    const rateadas = ratearProporcional(500, itens);
    expect(rateadas.every(i => i.valorRateado === 0)).toBe(true);
  });

  it('preserva todos os campos originais de cada item, só adiciona valorRateado', () => {
    const itens = [{ clientId: 'A', faturaId: 'FT-1', valor: 100, observacao: 'nota livre' }];
    const [r] = ratearProporcional(200, itens);
    expect(r).toMatchObject({ clientId: 'A', faturaId: 'FT-1', valor: 100, observacao: 'nota livre' });
    expect(r.valorRateado).toBeCloseTo(200, 6);
  });

  it('um único item recebe o total inteiro', () => {
    const [r] = ratearProporcional(999.99, [{ clientId: 'A', valor: 42 }]);
    expect(r.valorRateado).toBeCloseTo(999.99, 6);
  });
});
